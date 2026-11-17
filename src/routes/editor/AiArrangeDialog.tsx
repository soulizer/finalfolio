import { useEffect, useMemo, useRef, useState } from 'react';
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
  return t(message);
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
  const [prompt, setPrompt] = useState('');
  const [promptEditing, setPromptEditing] = useState(false);
  const [phase, setPhase] = useState<Phase>('select');
  const [bundle, setBundle] = useState<AiPlanBundle | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [sourceTab, setSourceTab] = useState<'upload' | 'library' | 'url'>('upload');
  const [importUrlValue, setImportUrlValue] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
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
          setPrompt(nextStatus.prompt);
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

    setReadingFiles(true);
    setError(null);
    try {
      const photo = await readAssetPhoto(asset);
      setPhotos((current) => [...current, photo]);
    } catch (readError) {
      setError(readError instanceof Error ? t(readError.message) : t('Unable to read one of the selected photos.'));
    } finally {
      setReadingFiles(false);
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
      const response = await generateAiPlans(
        {
          images: photos.map((photo) => ({
            name: photo.name,
            width: photo.width,
            height: photo.height,
            dataUrl: photo.thumbnail,
          })),
          prompt,
        },
        controller.signal,
      );
      const nextBundle = normalizeAiPlanBundle(response, response.prompt || prompt, photos.length);
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
      <div className="ai-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-dialog-title">
        <header className="ai-dialog__header">
          <div>
            <p className="eyebrow">{t('AI arrangement')}</p>
            <h2 id="ai-dialog-title">{t('Let AI shape a first folio sequence')}</h2>
            <p className="panel-note">
              {t('Upload up to %s photos. AI proposes three sequences; you choose one before it touches the editor.').replace(
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
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
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
                    <p className="eyebrow">{t('Photos')}</p>
                    <h3>{t('Choose the set AI should sequence')}</h3>
                  </div>
                  <span className="panel-tag">
                    {photos.length}/{maxPhotos}
                  </span>
                </div>
                <div className="ai-source-tabs" role="tablist" aria-label={t('Photo source')}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sourceTab === 'upload'}
                    className={`ai-source-tab ${sourceTab === 'upload' ? 'is-active' : ''}`}
                    onClick={() => setSourceTab('upload')}
                  >
                    {t('Upload photos')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sourceTab === 'library'}
                    className={`ai-source-tab ${sourceTab === 'library' ? 'is-active' : ''}`}
                    onClick={() => setSourceTab('library')}
                  >
                    {t('Choose from library')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sourceTab === 'url'}
                    className={`ai-source-tab ${sourceTab === 'url' ? 'is-active' : ''}`}
                    onClick={() => setSourceTab('url')}
                  >
                    {t('URL import')}
                  </button>
                </div>

                {sourceTab === 'upload' ? (
                  <>
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
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 16V4M7 9l5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
                      </svg>
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
                  </>
                ) : null}

                {sourceTab === 'library' ? (
                  availableAssets.length ? (
                    <div className="ai-library-grid">
                      {availableAssets.map((asset) => {
                        const selected = selectedAssetIds.has(asset.id);
                        const disabled = !selected && photos.length >= maxPhotos;
                        return (
                          <button
                            key={asset.id}
                            type="button"
                            className={`ai-library-item ${selected ? 'is-selected' : ''}`}
                            aria-pressed={selected}
                            disabled={disabled || readingFiles}
                            onClick={() => {
                              if (selected) {
                                removePhoto(`asset:${asset.id}`);
                              } else {
                                void addAssetPhoto(asset);
                              }
                            }}
                          >
                            <img src={getAssetSource(asset, 'thumb')} alt={asset.name} />
                            <span>{asset.name}</span>
                            {selected ? <span className="ai-library-item__check">✓</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="panel-note">{t('No photos in the media library yet. Upload or import a URL first.')}</p>
                  )
                ) : null}

                {sourceTab === 'url' ? (
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

                {photos.length ? (
                  <div className="ai-photo-grid">
                    {photos.map((photo, index) => (
                      <figure className="ai-photo-card" key={photo.id}>
                        <img src={photo.previewUrl} alt={photo.name} />
                        <figcaption>
                          <span>{index + 1}</span>
                          <small>{photo.name}</small>
                        </figcaption>
                        <button
                          type="button"
                          className="ai-photo-card__remove"
                          aria-label={t('Remove photo')}
                          title={t('Remove photo')}
                          onClick={() => removePhoto(photo.id)}
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M4 4l8 8M12 4l-8 8" />
                          </svg>
                        </button>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <p className="panel-note">{t('No photos selected yet.')}</p>
                )}
              </section>

              <section className="ai-prompt-panel">
                <div className="ai-section-heading">
                  <div>
                    <p className="eyebrow">{t('Prompt')}</p>
                    <h3>{t('What AI will follow')}</h3>
                  </div>
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={() => setPromptEditing((current) => !current)}
                  >
                    {promptEditing ? t('Done editing') : t('Edit prompt')}
                  </button>
                </div>
                <textarea
                  className="ai-prompt-textarea"
                  aria-label={t('Prompt')}
                  rows={14}
                  readOnly={!promptEditing}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
                {promptEditing && status ? (
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={() => {
                      setPrompt(status.prompt);
                      setPromptEditing(false);
                    }}
                  >
                    {t('Restore default prompt')}
                  </button>
                ) : null}
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
