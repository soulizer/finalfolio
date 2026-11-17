import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useT } from '../../i18n';
import {
  fetchAiStatus,
  generateAiPlans,
  type AiStatus,
} from '../../editor/api';
import { getAssetSource } from '../../editor/assetResources';
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
  availableAssets: Asset[];
};

type Phase = 'select' | 'generating' | 'results' | 'applying';

const MAX_THUMBNAIL_SIZE = 320;
const THUMBNAIL_QUALITY = 0.68;

const AI_STYLE_PRESETS = [
  {
    id: 'editorial',
    label: 'Editorial restraint',
    description: 'Leaded image, generous whitespace, precise short copy.',
    prompt: '整体克制、留白充足、编辑感强；主图突出，文字少而精准，避免营销腔。',
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
  {
    id: 'minimal',
    label: 'Minimal whitespace',
    description: 'Very few words, photos carry the page.',
    prompt: '极简、大量留白、文字非常克制，让照片本身承担页面主角。',
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

function isTransientAiError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return /Network connection failed|Failed to fetch|NetworkError|temporarily unavailable|Request failed \(5\d\d\)|All AI providers failed/i.test(
    message,
  );
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}:${String(rest).padStart(2, '0')}` : `${rest}s`;
}

export function AiArrangeDialog({
  maxPhotos: maxPhotosProp,
  onApply,
  onClose,
  onImportUrl,
  onUploadPhotos,
  uploadCompleted,
  uploadTotal,
  availableAssets,
}: AiArrangeDialogProps) {
  const t = useT();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<AiPhoto[]>([]);
  const [readingFiles, setReadingFiles] = useState(false);

  const [uploadingFiles, setUploadingFiles] = useState(false);
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
          setStatusError(statusFetchError instanceof Error ? localizeAiError(statusFetchError.message, t) : t('Unable to load AI settings.'));
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
    try {
      const uploaded = await onUploadPhotos(accepted);
      if (uploaded) {
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

  async function handleGenerate() {
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
      const stylePreset = AI_STYLE_PRESETS.find((preset) => preset.id === stylePresetId) ?? AI_STYLE_PRESETS[0];
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
        const failedFast = Date.now() - attemptStartedAt < 15_000;
        if (controller.signal.aborted || !failedFast || !isTransientAiError(firstError)) {
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
      setError(generateError instanceof Error ? localizeAiError(generateError.message, t) : t('AI arrangement failed. Try again.'));
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
      setError(applyError instanceof Error ? localizeAiError(applyError.message, t) : t('Unable to apply this AI plan.'));
      setPhase('results');
    }
  }

  function handleCancelGeneration() {
    abortRef.current?.abort();
    setPhase('select');
  }

  return (
    <div className="ai-dialog-overlay" role="presentation">
      <div className="ai-dialog surface-popover" role="dialog" aria-modal="true" aria-labelledby="ai-dialog-title">
        <header className="ai-dialog__header">
          <div>
            <p className="eyebrow">{t('AI arrangement')}</p>
            <h2 id="ai-dialog-title">{t('Let AI shape a first folio sequence')}</h2>
            <p className="panel-note">
              {t('Select up to %s photos. AI proposes three sequences; you choose one before it touches the editor.').replace(
                '%s',
                String(maxPhotos),
              )}
            </p>
            <p className="panel-note">
              {t('Only small thumbnails are sent to the AI interfaces configured by the administrator.')}
            </p>
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
            <Icon name="x" />
          </button>
        </header>

        {statusError ? (
          <div className="ai-dialog__body ai-dialog__body--message">
            <p className="ai-dialog__error">{t(statusError)}</p>
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
                  <p className="eyebrow">{t('Choose a direction')}</p>
                  <h3>{t('Three plans, same photos')}</h3>
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
              {error ? <p className="ai-dialog__error" role="alert">{t(error)}</p> : null}
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
                  <span className="panel-tag">
                    {photos.length}/{maxPhotos}
                  </span>
                </div>

                {availableAssets.length ? (
                  <div className="ai-library-grid">
                    {availableAssets.map((asset) => {
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
                    <Icon name="upload" />
                    {t('Upload from device')}
                  </button>
                  <button
                    type="button"
                    className={`button button--ghost button--small ${sourcePanel === 'url' ? 'is-active' : ''}`.trim()}
                    aria-expanded={sourcePanel === 'url'}
                    onClick={() => setSourcePanel((current) => (current === 'url' ? 'none' : 'url'))}
                  >
                    <Icon name="link" />
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
                      <Icon name="upload" />
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

                <p className="panel-note">
                  {photos.length
                    ? t('%s selected. Click a checked photo to remove it.').replace('%s', String(photos.length))
                    : t('No photos selected yet.')}
                </p>
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
                {error ? <p className="ai-dialog__error" role="alert">{t(error)}</p> : null}
              </section>
            </div>
            <footer className="ai-dialog__footer">
              <span className="panel-note">
                {t('AI only proposes a sequence. Nothing changes until you choose a plan and apply it.')}
              </span>
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
                  {t('Generate 3 plans')}
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
