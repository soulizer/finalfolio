import { ChangeEvent, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MagazinePreview } from '../components/MagazinePreview';
import { createProject, fetchProject, updateProject as persistProject, uploadAssets } from '../editor/api';
import { createDefaultProject, createPageDraft, templateMeta } from '../editor/demoData';
import {
  PAGE_BODY_LIMIT,
  PAGE_CAPTION_LIMIT,
  PAGE_DECK_LIMIT,
  PAGE_KICKER_LIMIT,
  PAGE_TITLE_LIMIT,
  PROJECT_ISSUE_LIMIT,
  PROJECT_SUBTITLE_LIMIT,
  PROJECT_TITLE_LIMIT,
  UPLOAD_HELP_TEXT,
} from '../editor/limits';
import { clearDraftProject, readDraftProject, writeDraftProject } from '../editor/storage';
import { Asset, PageData, ProjectRecord, ProjectState } from '../editor/types';

type LoadState = 'loading' | 'ready' | 'error';
type SaveState = 'draft' | 'dirty' | 'saving' | 'saved' | 'error';

function createPageId() {
  return `page-${crypto.randomUUID()}`;
}

function getInitialSlot(page?: PageData) {
  return page ? (Object.keys(page.slots)[0] ?? null) : null;
}

function formatSavedAt(timestamp?: string) {
  if (!timestamp) {
    return 'Saved on the server.';
  }

  return `Saved ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))}.`;
}

function clonePage(page: PageData): PageData {
  return {
    ...page,
    slots: { ...page.slots },
    crops: Object.fromEntries(Object.entries(page.crops).map(([slot, crop]) => [slot, { ...crop }])),
  };
}

function createFreshDraft() {
  const fresh = createDefaultProject();
  writeDraftProject(fresh);
  return fresh;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

export function EditorPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const [project, setProject] = useState<ProjectState>(() => (projectId ? createDefaultProject() : readDraftProject()));
  const [projectRecord, setProjectRecord] = useState<ProjectRecord | null>(null);
  const [loadState, setLoadState] = useState<LoadState>(projectId ? 'loading' : 'ready');
  const [saveState, setSaveState] = useState<SaveState>(projectId ? 'saving' : 'draft');
  const [selectedPageId, setSelectedPageId] = useState(project.pages[0]?.id ?? '');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(getInitialSlot(project.pages[0]));
  const [uploadState, setUploadState] = useState<'idle' | 'uploading'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastSavedSnapshotRef = useRef('');

  useEffect(() => {
    let cancelled = false;

    async function loadServerProject() {
      if (!projectId) {
        const draft = readDraftProject();
        setProject(draft);
        setProjectRecord(null);
        setLoadState('ready');
        setSaveState('draft');
        setSelectedPageId(draft.pages[0]?.id ?? '');
        setSelectedSlot(getInitialSlot(draft.pages[0]));
        setLoadError(null);
        setMessage('Draft only on this device. Create a stable editor URL when you want to reopen the issue later.');
        lastSavedSnapshotRef.current = '';
        return;
      }

      setLoadState('loading');
      setSaveState('saving');
      setMessage('Loading the saved issue from the server...');
      setLoadError(null);
      setCopyState('idle');

      try {
        const record = await fetchProject(projectId);
        if (cancelled) {
          return;
        }

        const snapshot = JSON.stringify(record.project);
        lastSavedSnapshotRef.current = snapshot;
        clearDraftProject();
        setProject(record.project);
        setProjectRecord(record);
        setLoadState('ready');
        setSaveState('saved');
        setSelectedPageId(record.project.pages[0]?.id ?? '');
        setSelectedSlot(getInitialSlot(record.project.pages[0]));
        setMessage('Stable editor URL. Reopen this issue from the same link whenever you need to edit or export again.');
      } catch (error) {
        if (cancelled) {
          return;
        }

        setProjectRecord(null);
        setLoadState('error');
        setSaveState('error');
        setLoadError(error instanceof Error ? error.message : 'Unable to load this issue.');
        setMessage(null);
      }
    }

    void loadServerProject();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!project.pages.some((page) => page.id === selectedPageId)) {
      setSelectedPageId(project.pages[0]?.id ?? '');
    }
  }, [project.pages, selectedPageId]);

  const selectedPageIndex = project.pages.findIndex((page) => page.id === selectedPageId);
  const selectedPage = project.pages[selectedPageIndex] ?? project.pages[0];
  const assetsById = useMemo<Record<string, Asset>>(
    () => Object.fromEntries(project.assets.map((asset) => [asset.id, asset])),
    [project.assets],
  );
  const selectedAsset = selectedSlot && selectedPage?.slots[selectedSlot] ? assetsById[selectedPage.slots[selectedSlot] as string] : null;
  const shareUrl = useMemo(() => {
    if (!projectRecord) {
      return '';
    }

    return new URL(projectRecord.sharePath, window.location.origin).toString();
  }, [projectRecord]);

  useEffect(() => {
    if (!selectedPage) {
      return;
    }

    const firstSlot = getInitialSlot(selectedPage);
    if (!selectedSlot || !(selectedSlot in selectedPage.slots)) {
      setSelectedSlot(firstSlot);
    }
  }, [selectedPage, selectedSlot]);

  useEffect(() => {
    if (loadState !== 'ready') {
      return;
    }

    if (!projectRecord) {
      writeDraftProject(project);
      setSaveState('draft');
      return;
    }

    const snapshot = JSON.stringify(project);
    if (snapshot === lastSavedSnapshotRef.current || saveState === 'saving') {
      return;
    }

    setSaveState('dirty');
    const timer = window.setTimeout(() => {
      void saveProject({ manual: false });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [loadState, project, projectRecord, saveState]);

  if (!selectedPage && loadState === 'ready') {
    return null;
  }

  function updateProject(updater: (current: ProjectState) => ProjectState) {
    setMessage(null);
    setProject((current) => updater(current));
    if (saveState === 'error') {
      setSaveState(projectRecord ? 'dirty' : 'draft');
    }
  }

  function updateSelectedPage(updater: (page: PageData) => PageData) {
    if (!selectedPage) {
      return;
    }

    updateProject((current) => ({
      ...current,
      pages: current.pages.map((page) => (page.id === selectedPage.id ? updater(page) : page)),
    }));
  }

  function selectPage(pageId: string) {
    const nextPage = project.pages.find((page) => page.id === pageId);
    setSelectedPageId(pageId);
    setSelectedSlot(getInitialSlot(nextPage));
  }

  async function saveProject({ manual }: { manual: boolean }) {
    const snapshot = JSON.stringify(project);
    if (projectRecord && snapshot === lastSavedSnapshotRef.current && !manual) {
      return;
    }

    setSaveState('saving');
    setMessage(projectRecord ? 'Saving changes to the server...' : 'Creating a stable editor URL on the server...');

    try {
      const record = projectRecord ? await persistProject(projectRecord.id, project) : await createProject(project);

      lastSavedSnapshotRef.current = snapshot;
      setProjectRecord(record);
      setSaveState('saved');
      setMessage(
        projectRecord
          ? formatSavedAt(record.updatedAt)
          : 'Stable editor URL created. This link is now the canonical place to reopen the issue.',
      );
      clearDraftProject();

      if (!projectRecord) {
        startTransition(() => navigate(record.sharePath, { replace: true }));
      }
    } catch (error) {
      setSaveState('error');
      setMessage(error instanceof Error ? error.message : 'Save failed.');
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    setUploadState('uploading');
    setMessage('Uploading images to the server...');

    try {
      const uploads = await uploadAssets(files);
      updateProject((current) => ({
        ...current,
        assets: [...uploads, ...current.assets],
      }));
      setMessage(`${uploads.length} image${uploads.length === 1 ? '' : 's'} uploaded to the server.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploadState('idle');
      event.target.value = '';
    }
  }

  function assignAsset(slot: string, assetId: string) {
    updateSelectedPage((page) => ({
      ...page,
      slots: {
        ...page.slots,
        [slot]: assetId,
      },
    }));
  }

  function clearSelectedSlot() {
    if (!selectedSlot) {
      return;
    }

    updateSelectedPage((page) => ({
      ...page,
      slots: {
        ...page.slots,
        [selectedSlot]: null,
      },
    }));
  }

  function addPage() {
    if (!selectedPage) {
      return;
    }

    const nextPage = createPageDraft(selectedPage.template, createPageId());
    const insertAt = selectedPageIndex >= 0 ? selectedPageIndex + 1 : project.pages.length;

    updateProject((current) => ({
      ...current,
      pages: [...current.pages.slice(0, insertAt), nextPage, ...current.pages.slice(insertAt)],
    }));
    setSelectedPageId(nextPage.id);
    setSelectedSlot(getInitialSlot(nextPage));
  }

  function duplicatePage() {
    if (!selectedPage) {
      return;
    }

    const duplicate: PageData = {
      ...clonePage(selectedPage),
      id: createPageId(),
      title: `${selectedPage.title} Copy`.slice(0, PAGE_TITLE_LIMIT),
    };
    const insertAt = selectedPageIndex >= 0 ? selectedPageIndex + 1 : project.pages.length;

    updateProject((current) => ({
      ...current,
      pages: [...current.pages.slice(0, insertAt), duplicate, ...current.pages.slice(insertAt)],
    }));
    setSelectedPageId(duplicate.id);
    setSelectedSlot(getInitialSlot(duplicate));
  }

  function moveSelectedPage(offset: -1 | 1) {
    if (selectedPageIndex < 0) {
      return;
    }

    const nextIndex = selectedPageIndex + offset;
    if (nextIndex < 0 || nextIndex >= project.pages.length) {
      return;
    }

    updateProject((current) => ({
      ...current,
      pages: moveItem(current.pages, selectedPageIndex, nextIndex),
    }));
  }

  function removeSelectedPage() {
    if (project.pages.length === 1 || selectedPageIndex < 0) {
      return;
    }

    const nextPage = project.pages[selectedPageIndex + 1] ?? project.pages[selectedPageIndex - 1];
    updateProject((current) => ({
      ...current,
      pages: current.pages.filter((page) => page.id !== selectedPage.id),
    }));
    setSelectedPageId(nextPage.id);
    setSelectedSlot(getInitialSlot(nextPage));
  }

  function startNewDraft() {
    const fresh = createFreshDraft();
    lastSavedSnapshotRef.current = '';
    setProject(fresh);
    setProjectRecord(null);
    setLoadState('ready');
    setSaveState('draft');
    setSelectedPageId(fresh.pages[0]?.id ?? '');
    setSelectedSlot(getInitialSlot(fresh.pages[0]));
    setLoadError(null);
    setMessage('Draft only on this device. Create a stable editor URL when you want to reopen the issue later.');
    setCopyState('idle');
    startTransition(() => navigate('/editor'));
  }

  function updateTemplate(template: PageData['template']) {
    const slots = templateMeta[template].slots;
    updateSelectedPage((page) => ({
      ...page,
      template,
      slots: Object.fromEntries(slots.map((slot) => [slot, page.slots[slot] ?? null])),
      crops: Object.fromEntries(slots.map((slot) => [slot, page.crops[slot] ?? { x: 50, y: 50, scale: 1 }])),
    }));
    setSelectedSlot(slots[0] ?? null);
  }

  async function handleCopyLink() {
    if (!shareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch {
      setCopyState('error');
    }
  }

  const currentCrop = selectedSlot && selectedPage ? selectedPage.crops[selectedSlot] : undefined;
  const fallbackStatus = !projectRecord
    ? 'Draft only. Create a stable editor URL to save this issue on the server.'
    : saveState === 'saving'
      ? 'Saving changes to the server...'
      : saveState === 'dirty'
        ? 'Changes queued. Autosave will sync this issue shortly.'
        : saveState === 'error'
          ? 'Save failed. Retry to keep this URL current.'
          : formatSavedAt(projectRecord.updatedAt);
  const statusText = uploadState === 'uploading' ? 'Uploading images to the server...' : message ?? fallbackStatus;
  const sequenceLabel = `${project.pages.length} page${project.pages.length === 1 ? '' : 's'} in print order`;

  if (loadState === 'loading') {
    return (
      <div className="editor-shell">
        <header className="editor-topbar">
          <div className="editor-topbar__brand">
            <Link to="/">CrazyAlbum</Link>
            <span>Server-backed editorial builder</span>
          </div>
        </header>
        <section className="editor-empty-state">
          <p className="eyebrow">Loading</p>
          <h1>Opening project…</h1>
          <p>Loading the saved issue from the server.</p>
        </section>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="editor-shell">
        <header className="editor-topbar">
          <div className="editor-topbar__brand">
            <Link to="/">CrazyAlbum</Link>
            <span>Server-backed editorial builder</span>
          </div>
          <div className="editor-topbar__actions">
            <button type="button" className="button button--ghost" onClick={startNewDraft}>
              New draft
            </button>
          </div>
        </header>
        <section className="editor-empty-state">
          <p className="eyebrow">Unavailable</p>
          <h1>Project not available.</h1>
          <p>{loadError ?? 'The link is invalid or the project file could not be read.'}</p>
          <div className="editor-empty-state__actions">
            <button type="button" className="button button--primary" onClick={startNewDraft}>
              Start a new draft
            </button>
            <Link to="/" className="button button--ghost">
              Back home
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="editor-shell">
      <header className="editor-topbar">
        <div className="editor-topbar__brand">
          <Link to="/">CrazyAlbum</Link>
          <span>Server-backed editorial builder</span>
        </div>
        <div className="editor-topbar__actions">
          <button type="button" className="button button--ghost" onClick={startNewDraft}>
            New draft
          </button>
          <button type="button" className="button button--primary" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
      </header>

      <section className="editor-project-bar">
        <div className="editor-project-bar__copy">
          <p className="eyebrow">Project</p>
          <h2>{projectRecord ? 'Stable editor URL' : 'Draft on this device'}</h2>
          <p>{statusText}</p>
        </div>
        <div className="editor-project-bar__actions">
          <input
            aria-label="Project URL"
            className="editor-project-bar__input"
            readOnly
            value={projectRecord ? shareUrl : 'Create a stable editor URL to save this issue on the server.'}
          />
          <button
            type="button"
            className="button button--ghost"
            disabled={!projectRecord}
            onClick={() => void handleCopyLink()}
          >
            {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy link'}
          </button>
          <button
            type="button"
            className="button button--primary"
            disabled={saveState === 'saving' || uploadState === 'uploading'}
            onClick={() => void saveProject({ manual: true })}
          >
            {saveState === 'saving' ? 'Saving…' : projectRecord ? 'Save issue' : 'Create stable URL'}
          </button>
        </div>
      </section>

      <div className="editor-layout">
        <aside className="editor-sidebar editor-sidebar--assets">
          <div className="editor-panel">
            <p className="eyebrow">Issue</p>
            <label className="field">
              <span>Title</span>
              <input
                maxLength={PROJECT_TITLE_LIMIT}
                value={project.title}
                onChange={(event) => updateProject((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Subtitle</span>
              <textarea
                rows={3}
                maxLength={PROJECT_SUBTITLE_LIMIT}
                value={project.subtitle}
                onChange={(event) => updateProject((current) => ({ ...current, subtitle: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Issue mark</span>
              <input
                maxLength={PROJECT_ISSUE_LIMIT}
                value={project.issue}
                onChange={(event) => updateProject((current) => ({ ...current, issue: event.target.value }))}
              />
            </label>
          </div>

          <div className="editor-panel">
            <div className="editor-panel__heading">
              <div>
                <p className="eyebrow">Assets</p>
                <h2>Photos</h2>
              </div>
              <label className="upload-button">
                {uploadState === 'uploading' ? 'Uploading…' : 'Upload'}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" multiple onChange={handleUpload} />
              </label>
            </div>
            <p className="panel-note">{UPLOAD_HELP_TEXT}</p>
            <div className="asset-rail">
              {project.assets.length ? (
                project.assets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    className="asset-tile"
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('text/crazyalbum-asset', asset.id)}
                    onClick={() => {
                      if (selectedSlot) {
                        assignAsset(selectedSlot, asset.id);
                      }
                    }}
                  >
                    <img alt={asset.name} src={asset.src} />
                    <div className="asset-tile__copy">
                      <strong>{asset.name}</strong>
                      <span>{asset.note}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="asset-rail__empty">
                  <strong>No photos yet.</strong>
                  <p>Upload a set of images, then click or drag them onto the selected frame.</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="editor-canvas-wrap">
          <section className="editor-stage">
            <div className="editor-stage__header">
              <div>
                <p className="eyebrow">Live page</p>
                <h1>{project.title}</h1>
                <p>{project.subtitle}</p>
              </div>
              <div className="editor-stage__meta">
                <span>{project.issue}</span>
                <span>{templateMeta[selectedPage.template].label}</span>
                <span>{`Page ${selectedPageIndex + 1} of ${project.pages.length}`}</span>
              </div>
            </div>

            <div className="editor-canvas">
              <MagazinePreview
                issue={project.issue}
                page={selectedPage}
                assets={assetsById}
                pageNumber={selectedPageIndex + 1}
                selectedSlot={selectedSlot}
                interactive
                onSelectSlot={setSelectedSlot}
                onAssignDroppedAsset={assignAsset}
              />
            </div>
          </section>

          <section className="page-strip-panel">
            <div className="page-strip-panel__header">
              <div>
                <p className="eyebrow">Sequence</p>
                <h2>{sequenceLabel}</h2>
                <p>The print and PDF export follow this order exactly.</p>
              </div>
              <div className="page-strip-panel__actions">
                <button type="button" className="button button--ghost button--small" onClick={addPage}>
                  Add page
                </button>
                <button type="button" className="button button--ghost button--small" onClick={duplicatePage}>
                  Duplicate
                </button>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  disabled={selectedPageIndex <= 0}
                  onClick={() => moveSelectedPage(-1)}
                >
                  Move earlier
                </button>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  disabled={selectedPageIndex >= project.pages.length - 1}
                  onClick={() => moveSelectedPage(1)}
                >
                  Move later
                </button>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  disabled={project.pages.length === 1}
                  onClick={removeSelectedPage}
                >
                  Remove page
                </button>
              </div>
            </div>

            <div className="page-strip">
              {project.pages.map((page, index) => (
                <button
                  key={page.id}
                  type="button"
                  className={`page-chip ${page.id === selectedPage.id ? 'is-active' : ''}`}
                  onClick={() => selectPage(page.id)}
                >
                  <span>Page {index + 1}</span>
                  <strong>{page.title}</strong>
                  <em>{templateMeta[page.template].label}</em>
                </button>
              ))}
            </div>
          </section>
        </main>

        <aside className="editor-sidebar editor-sidebar--controls">
          <div className="editor-panel">
            <p className="eyebrow">Page settings</p>
            <label className="field">
              <span>Template</span>
              <select value={selectedPage.template} onChange={(event) => updateTemplate(event.target.value as PageData['template'])}>
                {Object.entries(templateMeta).map(([id, meta]) => (
                  <option value={id} key={id}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="panel-note">{templateMeta[selectedPage.template].description}</p>
            <label className="field">
              <span>Kicker</span>
              <input
                maxLength={PAGE_KICKER_LIMIT}
                value={selectedPage.kicker}
                onChange={(event) => updateSelectedPage((page) => ({ ...page, kicker: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Title</span>
              <textarea
                rows={3}
                maxLength={PAGE_TITLE_LIMIT}
                value={selectedPage.title}
                onChange={(event) => updateSelectedPage((page) => ({ ...page, title: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Deck</span>
              <textarea
                rows={3}
                maxLength={PAGE_DECK_LIMIT}
                value={selectedPage.deck}
                onChange={(event) => updateSelectedPage((page) => ({ ...page, deck: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Body</span>
              <textarea
                rows={5}
                maxLength={PAGE_BODY_LIMIT}
                value={selectedPage.body}
                onChange={(event) => updateSelectedPage((page) => ({ ...page, body: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Caption</span>
              <textarea
                rows={3}
                maxLength={PAGE_CAPTION_LIMIT}
                value={selectedPage.caption}
                onChange={(event) => updateSelectedPage((page) => ({ ...page, caption: event.target.value }))}
              />
            </label>
          </div>

          <div className="editor-panel">
            <p className="eyebrow">Selected frame</p>
            <h2>{selectedSlot ? selectedSlot.toUpperCase() : 'None'}</h2>
            <p className="selected-frame-status">
              {selectedAsset ? `Assigned image: ${selectedAsset.name}` : 'No image assigned to this frame yet.'}
            </p>
            {selectedSlot && currentCrop && selectedAsset ? (
              <>
                <div className="editor-panel__actions editor-panel__actions--tight">
                  <button type="button" className="button button--ghost button--small" onClick={clearSelectedSlot}>
                    Clear image
                  </button>
                </div>
                <label className="field field--range">
                  <span>Horizontal crop</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={currentCrop.x}
                    onChange={(event) =>
                      updateSelectedPage((page) => ({
                        ...page,
                        crops: {
                          ...page.crops,
                          [selectedSlot]: { ...page.crops[selectedSlot], x: Number(event.target.value) },
                        },
                      }))
                    }
                  />
                </label>
                <label className="field field--range">
                  <span>Vertical crop</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={currentCrop.y}
                    onChange={(event) =>
                      updateSelectedPage((page) => ({
                        ...page,
                        crops: {
                          ...page.crops,
                          [selectedSlot]: { ...page.crops[selectedSlot], y: Number(event.target.value) },
                        },
                      }))
                    }
                  />
                </label>
                <label className="field field--range">
                  <span>Scale</span>
                  <input
                    type="range"
                    min="1"
                    max="1.8"
                    step="0.01"
                    value={currentCrop.scale}
                    onChange={(event) =>
                      updateSelectedPage((page) => ({
                        ...page,
                        crops: {
                          ...page.crops,
                          [selectedSlot]: { ...page.crops[selectedSlot], scale: Number(event.target.value) },
                        },
                      }))
                    }
                  />
                </label>
              </>
            ) : (
              <p className="panel-note">Select a frame, then click or drag an uploaded image onto it to unlock crop controls.</p>
            )}
          </div>
        </aside>
      </div>

      <section className="editor-print-stack" aria-hidden="true">
        {project.pages.map((page, index) => (
          <div className="editor-print-page" key={page.id}>
            <MagazinePreview issue={project.issue} page={page} assets={assetsById} pageNumber={index + 1} />
          </div>
        ))}
      </section>
    </div>
  );
}
