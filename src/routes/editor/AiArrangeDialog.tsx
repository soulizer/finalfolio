import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../i18n';
import {
  fetchAiStatus,
  generateAiPlans,
  type AiStatus,
} from '../../editor/api';
import { getAssetSource } from '../../editor/assetResources';
import { confirmAction } from '../../ui/confirm';
import type { Asset } from '../../editor/types';
import {
  aiTemplateLabel,
  normalizeAiPlanBundle,
  type AiPlan,
  type AiPlanBundle,
} from '../../editor/aiPlans';

export type AiPhoto = {
  id: string;
  kind: 'local' | 'asset';
  file?: File;
  asset?: Asset;
  assetId?: string;
  name: string;
  previewUrl: string;
  width: number;
  height: number;
  thumbnail: string;
};

type AiArrangeDialogProps = {
  maxPhotos?: number;
  onApply: (bundle: AiPlanBundle, plan: AiPlan, photos: AiPhoto[]) => Promise<void>;
  onClose: () => void;
  onImportUrl: (url: string) => Promise<Asset>;
  onUploadPhotos: (files: File[]) => Promise<Array<Asset | null> | undefined>;
  uploadCompleted: number;
  uploadTotal: number;
  uploadProgressPercent: number;
  availableAssets: Asset[];
};

type Phase = 'select' | 'generating' | 'results' | 'applying';

// Smaller thumbnails keep the vision request fast and cheap; layout planning
// does not need print resolution.
const MAX_THUMBNAIL_SIZE = 256;
const THUMBNAIL_QUALITY = 0.6;

const AI_STYLE_PRESETS = [
  {
    id: 'editorial',
    label: 'Restrained whitespace',
    description: 'Generous whitespace, few precise words, photos carry the page.',
    prompt: '整体克制、大量留白；主图突出，文字少而精准，让照片承担页面主角，避免营销腔。',
  },
  {
    id: 'impact',
    label: 'Visual impact',
    description: 'Large images, strong contrast, faster rhythm.',
    prompt: '强烈视觉冲击，大图和强对比，节奏更快，适合时尚、商业大片或强情绪照片。',
  },
  {
    id: 'quiet',
    label: 'Quiet journal',
    description: 'Soft paper tones, short lines, calm pacing.',
    prompt: '安静、柔和、手记感；纸色淡雅，短句，慢节奏，适合日常和私人叙事。',
  },
  {
    id: 'magazine',
    label: 'Magazine feature',
    description: 'Cover story structure with a clear editorial arc.',
    prompt: '杂志专题感，封面故事结构，图文并茂，有明确的起承转合和章节节奏。',
  },
] as const;

function createPhotoId(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}:${Math.random().toString(36).slice(2, 7)}`;
}

function loadImageElement(url: string, crossOrigin = false) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to read this image.'));
    image.src = url;
  });
}

function createThumbnail(image: HTMLImageElement) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.min(1, MAX_THUMBNAIL_SIZE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to prepare this image.');
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return {
    width,
    height,
    thumbnail: canvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY),
  };
}

async function readPhoto(file: File): Promise<AiPhoto> {
  const previewUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(previewUrl);
    const thumbnail = createThumbnail(image);
    return {
      id: createPhotoId(file),
      kind: 'local',
      file,
      name: file.name,
      previewUrl,
      ...thumbnail,
    };
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error;
  }
}

async function readAssetPhoto(asset: Asset): Promise<AiPhoto> {
  const previewUrl = getAssetSource(asset, 'thumb') || getAssetSource(asset, 'preview') || asset.src;
  let image: HTMLImageElement;
  try {
    image = await loadImageElement(previewUrl, true);
  } catch {
    image = await loadImageElement(previewUrl);
  }
  try {
    const thumbnail = createThumbnail(image);
    return {
      id: `asset:${asset.id}`,
      kind: 'asset',
      asset,
      assetId: asset.id,
      name: asset.name,
      previewUrl,
      ...thumbnail,
    };
  } catch {
    throw new Error('Unable to read this image thumbnail. Upload the file instead.');
  }
}

function localizeAiError(message: string, t: (key: string) => string) {
  if (/^All AI providers failed/i.test(message)) {
    return t('All AI providers failed. Check the interface pool and try again.');
  }
  if (/^AI connection failed/i.test(message)) {
    return t('AI connection failed. Check the interface settings.');
  }
  if (/Network connection failed|Failed to fetch|NetworkError|temporarily unavailable|Request failed \(5\d\d\)/i.test(message)) {
    return t('AI service is temporarily unavailable. Please try again in a moment.');
  }
  if (/Request failed/i.test(message)) {
    return t('AI arrangement could not be completed. Please try again.');
  }
  return t(message);
}

function localizeProviderReason(reason: string, t: (key: string) => string) {
  const timeout = /^Timed out after (\d+)s\.?$/i.exec(reason);
  if (timeout) {
    return t('Timed out after %ss.').replace('%s', timeout[1]);
  }
  if (/^Skipped because/i.test(reason) || /Skipped because/i.test(reason)) {
    return t('Skipped: the earlier providers used the whole time budget.');
  }
  const http = /^HTTP (\d{3})/i.exec(reason);
  if (http) {
    return t('The provider returned HTTP %s.').replace('%s', http[1]);
  }
  if (/empty message/i.test(reason)) {
    return t('The provider returned an empty response.');
  }
  if (/cut the response off/i.test(reason)) {
    return t('The response was cut off before it finished.');
  }
  if (/did not include any plans/i.test(reason)) {
    return t('The response did not contain any usable plans.');
  }
  if (/non-JSON/i.test(reason)) {
    return t('The provider returned a non-JSON response.');
  }
  if (/fetch failed|ECONNRESET|ENOTFOUND|socket hang up/i.test(reason)) {
    return t('The network connection to the provider failed.');
  }
  return reason;
}

type AiErrorReport = { headline: string; details: string[]; raw: string };

function describeAiError(message: string, t: (key: string) => string): AiErrorReport {
  const statusMatch = /\[HTTP (\d{3})\]$/i.exec(message);
  if (statusMatch && !/^All AI providers failed/i.test(message)) {
    const status = statusMatch[1];
    const explanation =
      status === '502' || status === '503' || status === '504'
        ? t('The gateway or service failed before the AI providers answered.')
        : t('The server rejected the request.');
    return {
      headline: t('The server returned HTTP %s.').replace('%s', status),
      details: [explanation],
      raw: message,
    };
  }
  if (/Network connection failed|Failed to fetch|NetworkError/i.test(message)) {
    return {
      headline: t('Could not reach the server.'),
      details: [t('The request was interrupted before any AI provider answered. Check the network and try again.')],
      raw: message,
    };
  }

  const providerFailure = /^All AI providers failed\.?\s*/i.test(message);
  if (providerFailure) {
    const rest = message.replace(/^All AI providers failed\.?\s*/i, '').trim();
    const details = rest
      .split('|')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf(':');
        const name = separator > 0 ? entry.slice(0, separator).trim() : '';
        const reason = separator > 0 ? entry.slice(separator + 1).trim() : entry;
        return `${name}${name ? '：' : ''}${localizeProviderReason(reason, t)}`;
      });
    return { headline: t('AI arrangement failed on every provider.'), details, raw: message };
  }

  const headline = localizeAiError(message, t);
  return { headline, details: [], raw: headline === message ? '' : message };
}

function isTransientAiError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return /Network connection failed|Failed to fetch|NetworkError|temporarily unavailable|Request failed \(5\d\d\)|All AI providers failed/i.test(
    message,
  );
}

function rawErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return '';
  }
  const status = (error as { status?: number }).status;
  return status ? `${error.message} [HTTP ${status}]` : error.message;
}

function AiErrorReportView({
  report,
  t,
}: {
  report: AiErrorReport;
  t: (key: string) => string;
}) {
  return (
    <div className="ai-dialog__error-block" role="alert">
      <p className="ai-dialog__error">{report.headline}</p>
      {report.details.length ? (
        <ul className="ai-dialog__error-list">
          {report.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
      {report.raw ? (
        <details className="ai-dialog__error-raw">
          <summary>{t('Technical details')}</summary>
          <code>{report.raw}</code>
        </details>
      ) : null}
      <p className="ai-dialog__error-hint">
        {t('If this keeps failing, check the AI provider settings (endpoint URL, model, and API key).')}
      </p>
    </div>
  );
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}:${String(rest).padStart(2, '0')}` : `${rest}s`;
}

function readBuildId() {
  if (typeof document === 'undefined') {
    return null;
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="ff-build"]');
  return typeof meta?.content === 'string' && meta.content.trim() ? meta.content.trim() : null;
}

export function AiArrangeDialog({
  maxPhotos: maxPhotosProp,
  onApply,
  onClose,
  onImportUrl,
  onUploadPhotos,
  uploadCompleted,
  uploadTotal,
  uploadProgressPercent,
  availableAssets,
}: AiArrangeDialogProps) {
  const t = useT();
  const [buildId] = useState(readBuildId);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<AiPhoto[]>([]);
  const [readingFiles, setReadingFiles] = useState(false);

  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadBatchTotal, setUploadBatchTotal] = useState(0);
  const [uploadedAssets, setUploadedAssets] = useState<Asset[]>([]);
  const [basePrompt, setBasePrompt] = useState('');
  const [stylePresetId, setStylePresetId] = useState<(typeof AI_STYLE_PRESETS)[number]['id']>('editorial');
  const [ideas, setIdeas] = useState('');
  const [phase, setPhase] = useState<Phase>('select');
  const [bundle, setBundle] = useState<AiPlanBundle | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [sourcePanel, setSourcePanel] = useState<'none' | 'upload' | 'url'>('none');
  const [importUrlValue, setImportUrlValue] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const readingAssetRef = useRef<string | null>(null);
  const photosRef = useRef<AiPhoto[]>([]);

  photosRef.current = photos;
  const maxPhotos = Math.max(0, Math.min(status?.maxImages ?? 50, maxPhotosProp ?? 50));
  const selectedPlan = useMemo(
    () => bundle?.plans.find((plan) => plan.id === selectedPlanId) ?? bundle?.plans[0] ?? null,
    [bundle, selectedPlanId],
  );
  const quotaExhausted = status
    ? (status.remaining.total !== null && status.remaining.total <= 0) ||
      (status.remaining.daily !== null && status.remaining.daily <= 0)
    : false;
  const selectedAssetIds = useMemo(
    () => new Set(photos.filter((photo) => photo.kind === 'asset').map((photo) => photo.assetId).filter(Boolean)),
    [photos],
  );
  const allAssets = useMemo(() => {
    const merged = new Map<string, Asset>();
    availableAssets.forEach((asset) => merged.set(asset.id, asset));
    uploadedAssets.forEach((asset) => {
      if (!merged.has(asset.id)) {
        merged.set(asset.id, asset);
      }
    });
    return Array.from(merged.values());
  }, [availableAssets, uploadedAssets]);
  const localPhotos = useMemo(() => photos.filter((photo) => photo.kind === 'local'), [photos]);
  const uploadTotalCount = Math.max(uploadBatchTotal, uploadTotal, 1);
  const uploadDoneCount = Math.min(uploadCompleted, uploadTotalCount);

  useEffect(() => {
    let cancelled = false;
    void fetchAiStatus()
      .then((nextStatus) => {
        if (!cancelled) {
          setStatus(nextStatus);
          setBasePrompt(nextStatus.prompt);
        }
      })
      .catch((statusFetchError) => {
        if (!cancelled) {
          setStatusError(rawErrorMessage(statusFetchError) || t('Unable to load AI settings.'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    },
    [],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'generating') {
      return;
    }

    const startedAt = Date.now();
    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      if (phase === 'generating') {
        abortRef.current?.abort();
      }
      if (phase !== 'applying') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, phase]);

  async function addFiles(fileList: FileList | File[]) {
    if (readingFiles || uploadingFiles) {
      return;
    }

    const incoming = Array.from(fileList).filter((file) => file.type.startsWith('image/'));
    if (!incoming.length) {
      return;
    }

    const existingKeys = new Set(
      photos
        .filter((photo) => photo.kind === 'local' && photo.file)
        .map((photo) => `${photo.file!.name}:${photo.file!.size}:${photo.file!.lastModified}`),
    );
    const unique = incoming.filter((file) => !existingKeys.has(`${file.name}:${file.size}:${file.lastModified}`));
    const available = Math.max(0, maxPhotos - photos.length);
    const accepted = unique.slice(0, available);
    if (!accepted.length) {
      setError(
        t('You can select up to %s photos.').replace('%s', String(maxPhotos)),
      );
      return;
    }

    setReadingFiles(true);
    setError(null);
    let nextPhotos: AiPhoto[] = [];
    try {
      nextPhotos = await Promise.all(accepted.map(readPhoto));
      setPhotos((current) => [...current, ...nextPhotos]);
      if (unique.length > accepted.length) {
        setError(t('Only the first %s photos were added.').replace('%s', String(accepted.length)));
      }
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : t('Unable to read one of the selected photos.'));
    } finally {
      setReadingFiles(false);
    }

    if (!nextPhotos.length) {
      return;
    }

    // Upload immediately so applying a plan stays fast. If an upload fails, the
    // photo remains local and the apply step can retry it.
    setUploadingFiles(true);
    setUploadBatchTotal(accepted.length);
    try {
      const uploaded = await onUploadPhotos(accepted);
      if (uploaded) {
        const uploadedList = uploaded.filter((asset): asset is Asset => Boolean(asset));
        setUploadedAssets((current) => {
          const merged = new Map(current.map((asset) => [asset.id, asset]));
          uploadedList.forEach((asset) => merged.set(asset.id, asset));
          return Array.from(merged.values());
        });
        setPhotos((current) =>
          current.map((photo) => {
            const index = nextPhotos.findIndex((entry) => entry.id === photo.id);
            const asset = index >= 0 ? uploaded[index] : null;
            if (!asset) {
              return photo;
            }
            URL.revokeObjectURL(photo.previewUrl);
            return {
              ...photo,
              kind: 'asset',
              asset,
              assetId: asset.id,
              file: undefined,
              name: asset.name,
              previewUrl: getAssetSource(asset, 'thumb') || getAssetSource(asset, 'preview') || asset.src,
            };
          }),
        );
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? t(uploadError.message) : t('Unable to upload the selected photos.'));
    } finally {
      setUploadingFiles(false);
      setUploadBatchTotal(0);
    }
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const photo = current.find((entry) => entry.id === id);
      if (photo?.kind === 'local') {
        URL.revokeObjectURL(photo.previewUrl);
      }
      return current.filter((entry) => entry.id !== id);
    });
  }

  async function addAssetPhoto(asset: Asset) {
    if (photos.length >= maxPhotos) {
      setError(t('You can select up to %s photos.').replace('%s', String(maxPhotos)));
      return;
    }
    if (photos.some((photo) => photo.assetId === asset.id)) {
      return;
    }

    if (readingAssetRef.current === asset.id) {
      return;
    }

    readingAssetRef.current = asset.id;
    setError(null);
    try {
      const photo = await readAssetPhoto(asset);
      setPhotos((current) => [...current, photo]);
    } catch (readError) {
      setError(readError instanceof Error ? t(readError.message) : t('Unable to read one of the selected photos.'));
    } finally {
      readingAssetRef.current = null;
    }
  }

  async function handleImportUrl() {
    const url = importUrlValue.trim();
    if (!url || importBusy) {
      return;
    }

    setImportBusy(true);
    setImportError(null);
    try {
      const asset = await onImportUrl(url);
      await addAssetPhoto(asset);
      setImportUrlValue('');
    } catch (importFailure) {
      setImportError(importFailure instanceof Error ? localizeAiError(importFailure.message, t) : t('Unable to import this URL.'));
    } finally {
      setImportBusy(false);
    }
  }

  async function selectAllPhotos() {
    const remaining = maxPhotos - photos.length;
    if (remaining <= 0) {
      return;
    }
    const candidates = allAssets
      .filter((asset) => !selectedAssetIds.has(asset.id))
      .slice(0, remaining);
    for (const asset of candidates) {
      await addAssetPhoto(asset);
    }
  }

  function clearAllPhotos() {
    photos.forEach((photo) => removePhoto(photo.id));
  }

  async function regenerateWithStyle(nextStyleId: (typeof AI_STYLE_PRESETS)[number]['id']) {
    if (nextStyleId === stylePresetId) {
      return;
    }
    const confirmed = await confirmAction({
      title: t('Switch style and regenerate?'),
      body: t(
        'The current plans will be replaced. Pages already applied to your folio stay as they are until you apply a new plan.',
      ),
      confirmLabel: t('Regenerate'),
      tone: 'default',
    });
    if (!confirmed) {
      return;
    }
    setStylePresetId(nextStyleId);
    await handleGenerate(nextStyleId);
  }

  async function handleGenerate(styleOverride?: (typeof AI_STYLE_PRESETS)[number]['id']) {
    if (!photos.length || !status?.enabled || quotaExhausted || phase === 'generating') {
      return;
    }

    setPhase('generating');
    setError(null);
    setBundle(null);
    setSelectedPlanId(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const stylePreset =
        AI_STYLE_PRESETS.find((preset) => preset.id === (styleOverride ?? stylePresetId)) ?? AI_STYLE_PRESETS[0];
      const composedPrompt = [
        basePrompt,
        `用户偏好的风格是：【${t(stylePreset.label)}】。${stylePreset.prompt}`,
        ideas.trim() ? `用户补充要求是：【${ideas.trim()}】` : '',
      ]
        .filter(Boolean)
        .join('\n\n');
      const requestPlans = () =>
        generateAiPlans(
          {
            images: photos.map((photo) => ({
              name: photo.name,
              width: photo.width,
              height: photo.height,
              dataUrl: photo.thumbnail,
            })),
            prompt: composedPrompt,
          },
          controller.signal,
        );

      let response;
      const attemptStartedAt = Date.now();
      try {
        response = await requestPlans();
      } catch (firstError) {
        // Retry once for transient failures, including a slow failure, but never
        // double a request that already spent the full pool budget.
        const spentMs = Date.now() - attemptStartedAt;
        const worthRetrying = spentMs < 75_000;
        if (controller.signal.aborted || !worthRetrying || !isTransientAiError(firstError)) {
          throw firstError;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        if (controller.signal.aborted) {
          throw firstError;
        }
        response = await requestPlans();
      }
      const nextBundle = normalizeAiPlanBundle(response, response.prompt || composedPrompt, photos.length);
      setBundle(nextBundle);
      setSelectedPlanId(nextBundle.plans[0]?.id ?? null);
      setPhase('results');
    } catch (generateError) {
      if (controller.signal.aborted) {
        setPhase('select');
        return;
      }
      // Keep the raw server message: the renderer turns it into a readable,
      // per-provider explanation, and the raw text stays available for support.
      setError(rawErrorMessage(generateError) || t('AI arrangement failed. Try again.'));
      setPhase('select');
    } finally {
      abortRef.current = null;
    }
  }

  async function handleApply() {
    if (!bundle || !selectedPlan || phase === 'applying') {
      return;
    }

    setPhase('applying');
    setError(null);
    try {
      await onApply(bundle, selectedPlan, photos);
      onClose();
    } catch (applyError) {
      setError(rawErrorMessage(applyError) || t('Unable to apply this AI plan.'));
      setPhase('results');
    }
  }

  function handleCancelGeneration() {
    abortRef.current?.abort();
    setPhase('select');
  }

  const errorReport = error ? describeAiError(error, t) : null;
  const statusReport = statusError ? describeAiError(statusError, t) : null;

  return (
    <div className="ai-dialog-overlay" role="presentation">
      <div className="ai-dialog surface-popover" role="dialog" aria-modal="true" aria-labelledby="ai-dialog-title">
        <header className="ai-dialog__header">
          <div>
            <p className="eyebrow">
              {t('AI arrangement')}
              {buildId ? ` · v${buildId.slice(0, 8)}` : ''}
            </p>
            <h2 id="ai-dialog-title">{t('Pick photos, generate layout plans')}</h2>
          </div>
          <button
            type="button"
            className="layout-editor-close"
            aria-label={t('Close')}
            title={t('Close')}
            disabled={phase === 'applying'}
            onClick={() => {
              if (phase === 'generating') {
                abortRef.current?.abort();
              }
              onClose();
            }}
          >
            {t('Close')}
          </button>
        </header>

        {statusReport ? (
          <div className="ai-dialog__body ai-dialog__body--message">
            <AiErrorReportView report={statusReport} t={t} />
          </div>
        ) : phase === 'generating' ? (
          <div className="ai-dialog__body ai-dialog__body--message">
            <div className="ai-waiting" role="status" aria-live="polite">
              <span className="ai-waiting__spinner" aria-hidden="true" />
              <h3>{t('AI is analysing %s photos').replace('%s', String(photos.length))}</h3>
              <p>
                {t('This usually takes 20–90 seconds. Please keep this window open; the AI pool tries interfaces in order.')}
              </p>
              <span className="ai-waiting__elapsed">{t('Elapsed %s').replace('%s', formatElapsed(elapsedSeconds))}</span>
              <button type="button" className="button button--ghost button--small" onClick={handleCancelGeneration}>
                {t('Cancel generation')}
              </button>
            </div>
          </div>
        ) : phase === 'results' && bundle ? (
          <>
            <div className="ai-dialog__body ai-dialog__results">
              <div className="ai-results__intro">
                <div>
                  <p className="eyebrow">{t('AI plans')}</p>
                  <h3>{t('Choose one plan')}</h3>
                  <p className="panel-note">
                    {t('The selected plan replaces the current page sequence when you apply it. Your uploaded photos stay in the media library.')}
                  </p>
                </div>
                <span className="panel-tag">
                  {t('%s photos · %s plans')
                    .replace('%s', String(photos.length))
                    .replace('%s', String(bundle.plans.length))}
                </span>
              </div>
              <div className="ai-results__folio">
                <strong>{bundle.folioTitle || t('Untitled folio')}</strong>
                {bundle.folioSubtitle ? <span>{bundle.folioSubtitle}</span> : null}
                <span>
                  {bundle.issue || t('AI issue')} · {t('Corner radius %s px').replace('%s', String(bundle.frameRadius))}
                </span>
              </div>
              <div className="ai-style-switch">
                <span className="ai-style-switch__label">{t('Change style')}</span>
                <div className="ai-style-switch__options" role="radiogroup" aria-label={t('AI style')}>
                  {AI_STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      role="radio"
                      aria-checked={preset.id === stylePresetId}
                      className={`ai-style-pill ${preset.id === stylePresetId ? 'is-active' : ''}`.trim()}
                      onClick={() => void regenerateWithStyle(preset.id)}
                    >
                      {t(preset.label)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="ai-plan-grid">
                {bundle.plans.map((plan) => {
                  const isSelected = plan.id === selectedPlan?.id;
                  const themeColors = Array.from(new Set(plan.pages.map((page) => page.theme))).slice(0, 4);
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      className={`ai-plan-card ${isSelected ? 'is-selected' : ''}`}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedPlanId(plan.id)}
                    >
                      <span className="ai-plan-card__eyebrow">{plan.name}</span>
                      <strong>{plan.style || plan.summary}</strong>
                      <span className="ai-plan-card__summary">{plan.summary}</span>
                      <span className="ai-plan-card__stats">
                        {t('%s pages · %s photos').replace('%s', String(plan.pageCount)).replace('%s', String(plan.photoCount))}
                      </span>
                      <span className="ai-plan-card__themes" aria-hidden="true">
                        {themeColors.map((theme) => (
                          <span key={theme} className={`ai-theme-dot ai-theme-dot--${theme}`} />
                        ))}
                      </span>
                      <span className="ai-plan-card__sequence">
                        {plan.pages.map((page, index) => (
                          <span key={`${plan.id}-${index}`}>{t(aiTemplateLabel(page.template))}</span>
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
              {bundle.providerName ? (
                <p className="panel-note">
                  {t('Generated by %s').replace('%s', bundle.providerName)}
                </p>
              ) : null}
              {errorReport ? <AiErrorReportView report={errorReport} t={t} /> : null}
            </div>
            <footer className="ai-dialog__footer">
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => {
                  setPhase('select');
                  setBundle(null);
                  setError(null);
                }}
              >
                {t('Back to photos')}
              </button>
              <div className="ai-dialog__footer-actions">
                <button type="button" className="button button--ghost button--small" onClick={onClose}>
                  {t('Cancel')}
                </button>
                <button
                  type="button"
                  className="button button--primary button--small"
                  disabled={!selectedPlan}
                  onClick={() => void handleApply()}
                >
                  {t('Apply this plan')}
                </button>
              </div>
            </footer>
          </>
        ) : phase === 'applying' ? (
          <div className="ai-dialog__body ai-dialog__body--message">
            <div className="ai-waiting" role="status" aria-live="polite">
              <span className="ai-waiting__spinner" aria-hidden="true" />
              <h3>{t('Applying the plan and building pages')}</h3>
              <p>{t('Photos are already prepared. This usually takes only a few seconds.')}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="ai-dialog__body ai-dialog__select">
              <section className="ai-photo-panel">
                <div className="ai-section-heading">
                  <div>
                    <p className="eyebrow">{t('Existing photos')}</p>
                    <h3>{t('Pick photos for AI to arrange')}</h3>
                  </div>
                  <div className="ai-photo-actions">
                    <span className="panel-tag">
                      {photos.length}/{maxPhotos}
                    </span>
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      disabled={allAssets.length === 0 || photos.length >= maxPhotos}
                      onClick={() => void selectAllPhotos()}
                    >
                      {t('Select all')}
                    </button>
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      disabled={photos.length === 0}
                      onClick={clearAllPhotos}
                    >
                      {t('Clear')}
                    </button>
                  </div>
                </div>

                {allAssets.length || localPhotos.length ? (
                  <div className="ai-library-grid">
                    {allAssets.map((asset) => {
                      const selected = selectedAssetIds.has(asset.id);
                      const disabled = !selected && photos.length >= maxPhotos;
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          className={`ai-library-item ${selected ? 'is-selected' : ''}`.trim()}
                          aria-pressed={selected}
                          disabled={disabled}
                          onClick={() => {
                            if (selected) {
                              removePhoto(`asset:${asset.id}`);
                            } else {
                              void addAssetPhoto(asset);
                            }
                          }}
                        >
                          <img src={getAssetSource(asset, 'thumb')} alt={asset.name} />
                          <span className="ai-library-item__name">{asset.name}</span>
                          {selected ? <span className="ai-library-item__check" aria-hidden="true">✓</span> : null}
                        </button>
                      );
                    })}
                    {localPhotos.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        className="ai-library-item is-selected is-local"
                        aria-pressed="true"
                        onClick={() => removePhoto(photo.id)}
                      >
                        <img src={photo.previewUrl} alt={photo.name} />
                        <span className="ai-library-item__name">{photo.name}</span>
                        {uploadingFiles ? (
                          <span className="ai-library-item__status">{t('Uploading…')}</span>
                        ) : null}
                        <span className="ai-library-item__check" aria-hidden="true">✓</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="ai-library-empty">
                    <strong>{t('No photos yet')}</strong>
                    <p className="panel-note">{t('Upload from this device or import a URL to add the first photos.')}</p>
                  </div>
                )}

                <div className="ai-source-buttons">
                  <button
                    type="button"
                    className={`button button--ghost button--small ${sourcePanel === 'upload' ? 'is-active' : ''}`.trim()}
                    aria-expanded={sourcePanel === 'upload'}
                    onClick={() => setSourcePanel((current) => (current === 'upload' ? 'none' : 'upload'))}
                  >
                    {t('Upload from device')}
                  </button>
                  <button
                    type="button"
                    className={`button button--ghost button--small ${sourcePanel === 'url' ? 'is-active' : ''}`.trim()}
                    aria-expanded={sourcePanel === 'url'}
                    onClick={() => setSourcePanel((current) => (current === 'url' ? 'none' : 'url'))}
                  >
                    {t('Import from URL')}
                  </button>
                </div>

                {sourcePanel === 'upload' ? (
                  <div className="ai-source-panel">
                    <div
                      className={`ai-dropzone ${dragging ? 'is-dragging' : ''}`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        void addFiles(event.dataTransfer.files);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                    >
                      <strong>
                        {uploadingFiles
                          ? t('Uploading photos… %s/%s')
                              .replace('%s', String(Math.min(uploadCompleted + 1, Math.max(uploadTotal, 1))))
                              .replace('%s', String(Math.max(uploadTotal, 1)))
                          : readingFiles
                            ? t('Reading photos…')
                            : t('Drop photos here or choose files')}
                      </strong>
                      <span>{t('JPEG, PNG, WebP, GIF or AVIF. Up to %s photos.').replace('%s', String(maxPhotos))}</span>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                      multiple
                      hidden
                      aria-label={t('Photos')}
                      onChange={(event) => {
                        if (event.currentTarget.files) {
                          void addFiles(event.currentTarget.files);
                        }
                        event.currentTarget.value = '';
                      }}
                    />
                    {uploadingFiles ? (
                      <div
                        className="ai-upload-progress"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={uploadProgressPercent}
                      >
                        <div className="ai-upload-progress__track">
                          <span className="ai-upload-progress__bar" style={{ width: `${uploadProgressPercent}%` }} />
                        </div>
                        <span className="ai-upload-progress__label">
                          {t('Uploading photos… %s/%s')
                            .replace('%s', String(Math.min(uploadDoneCount + 1, uploadTotalCount)))
                            .replace('%s', String(uploadTotalCount))}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {sourcePanel === 'url' ? (
                  <form
                    className="ai-url-import"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleImportUrl();
                    }}
                  >
                    <label className="field">
                      <span>{t('Image URL')}</span>
                      <input
                        value={importUrlValue}
                        placeholder="https://example.com/photo.jpg"
                        onChange={(event) => setImportUrlValue(event.target.value)}
                      />
                    </label>
                    <button
                      type="submit"
                      className="button button--primary button--small"
                      disabled={!importUrlValue.trim() || importBusy}
                    >
                      {importBusy ? t('Importing…') : t('Import URL')}
                    </button>
                  </form>
                ) : null}

                {importError ? (
                  <p className="ai-dialog__error" role="alert">
                    {importError}
                  </p>
                ) : null}

              </section>

              <section className="ai-prompt-panel">
                <div className="ai-section-heading">
                  <div>
                    <p className="eyebrow">{t('Style')}</p>
                    <h3>{t('Choose a direction for AI')}</h3>
                  </div>
                </div>
                <div className="ai-style-grid" role="radiogroup" aria-label={t('AI style')}>
                  {AI_STYLE_PRESETS.map((preset) => {
                    const active = preset.id === stylePresetId;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`ai-style-card ${active ? 'is-selected' : ''}`.trim()}
                        onClick={() => setStylePresetId(preset.id)}
                      >
                        <strong>{t(preset.label)}</strong>
                        <span>{t(preset.description)}</span>
                      </button>
                    );
                  })}
                </div>
                <label className="field">
                  <span>{t('Your notes (optional)')}</span>
                  <textarea
                    rows={4}
                    value={ideas}
                    placeholder={t('For example: people-focused, cool tones, fewer words, 6–8 pages.')}
                    onChange={(event) => setIdeas(event.target.value)}
                  />
                </label>
                <div className="ai-quota">
                  {status ? (
                    <>
                      <span>
                        {status.remaining.daily === null
                          ? t('Daily limit: unlimited')
                          : t('Daily remaining: %s').replace('%s', String(status.remaining.daily))}
                      </span>
                      <span>
                        {status.remaining.total === null
                          ? t('Total limit: unlimited')
                          : t('Total remaining: %s').replace('%s', String(status.remaining.total))}
                      </span>
                    </>
                  ) : (
                    <span>{t('Loading AI settings…')}</span>
                  )}
                </div>
                {!status?.enabled && status ? (
                  <p className="ai-dialog__error">{t('AI arrangement is currently disabled by the administrator.')}</p>
                ) : null}
                {quotaExhausted ? (
                  <p className="ai-dialog__error">{t('You have no AI arrangement uses left right now.')}</p>
                ) : null}
                {errorReport ? <AiErrorReportView report={errorReport} t={t} /> : null}
              </section>
            </div>
            <footer className="ai-dialog__footer">
              <div className="ai-dialog__footer-actions">
                <button type="button" className="button button--ghost button--small" onClick={onClose}>
                  {t('Cancel')}
                </button>
                <button
                  type="button"
                  className="button button--primary button--small"
                  disabled={!photos.length || !status?.enabled || quotaExhausted || readingFiles || uploadingFiles}
                  onClick={() => void handleGenerate()}
                >
                  {t('Generate plans')}
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
