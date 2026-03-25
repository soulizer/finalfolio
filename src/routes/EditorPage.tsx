import { ChangeEvent, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MagazinePreview } from '../components/MagazinePreview';
import { createProject, fetchProject, updateProject as persistProject, uploadAssets } from '../editor/api';
import { createDefaultProject, templateMeta } from '../editor/demoData';
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
        setMessage('Draft only. Create a shareable URL when you are ready to reopen this issue later.');
        lastSavedSnapshotRef.current = '';
        return;
      }

      setLoadState('loading');
      setSaveState('saving');
      setMessage('Loading project from the server...');
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
        setMessage('Public editable URL. Anyone with this link can reopen and continue editing.');
      } catch (error) {
        if (cancelled) {
          return;
        }

        setProjectRecord(null);
        setLoadState('error');
        setSaveState('error');
        setLoadError(error instanceof Error ? error.message : 'Unable to load this project.');
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

  const selectedPage = project.pages.find((page) => page.id === selectedPageId) ?? project.pages[0];
  const assetsById = useMemo<Record<string, Asset>>(
    () => Object.fromEntries(project.assets.map((asset) => [asset.id, asset])),
    [project.assets],
  );
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

  async function saveProject({ manual }: { manual: boolean }) {
    const snapshot = JSON.stringify(project);
    if (projectRecord && snapshot === lastSavedSnapshotRef.current && !manual) {
      return;
    }

    setSaveState('saving');
    setMessage(projectRecord ? 'Saving changes to the server...' : 'Creating a shareable project on the server...');

    try {
      const record = projectRecord
        ? await persistProject(projectRecord.id, project)
        : await createProject(project);

      lastSavedSnapshotRef.current = snapshot;
      setProjectRecord(record);
      setSaveState('saved');
      setMessage(projectRecord ? formatSavedAt(record.updatedAt) : 'Shareable project created. This URL is now the canonical editor link.');
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

  function addPage() {
    if (!selectedPage) {
      return;
    }

    const nextPage: PageData = {
      id: createPageId(),
      template: selectedPage.template,
      kicker: 'New page',
      title: 'Untitled page',
      deck: 'Swap templates, place images, and edit the copy.',
      body: 'Use this page as a fresh spread inside the issue.',
      caption: 'Printed output will use the same page geometry.',
      slots: Object.fromEntries(templateMeta[selectedPage.template].slots.map((slot) => [slot, null])),
      crops: Object.fromEntries(templateMeta[selectedPage.template].slots.map((slot) => [slot, { x: 50, y: 50, scale: 1 }])),
    };

    updateProject((current) => ({
      ...current,
      pages: [...current.pages, nextPage],
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
      title: `${selectedPage.title} Copy`,
    };

    updateProject((current) => ({
      ...current,
      pages: [...current.pages, duplicate],
    }));
    setSelectedPageId(duplicate.id);
    setSelectedSlot(getInitialSlot(duplicate));
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
    setMessage('Draft only. Create a shareable URL when you are ready to reopen this issue later.');
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
    ? 'Draft only. Create a shareable project to save on the server.'
    : saveState === 'saving'
      ? 'Saving changes to the server...'
      : saveState === 'dirty'
        ? 'Changes queued. Autosave will sync this issue shortly.'
        : saveState === 'error'
          ? 'Save failed. Retry to keep this URL current.'
          : formatSavedAt(projectRecord.updatedAt);
  const statusText = uploadState === 'uploading' ? 'Uploading images to the server...' : message ?? fallbackStatus;

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
          <button type="button" className="button button--ghost" onClick={duplicatePage}>
            Duplicate page
          </button>
          <button type="button" className="button button--ghost" onClick={addPage}>
            Add page
          </button>
          <button type="button" className="button button--primary" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
      </header>

      <section className="editor-project-bar">
        <div className="editor-project-bar__copy">
          <p className="eyebrow">Project</p>
          <h2>{projectRecord ? 'Shareable editor URL' : 'Unsaved draft'}</h2>
          <p>{statusText}</p>
        </div>
        <div className="editor-project-bar__actions">
          <input
            aria-label="Project URL"
            className="editor-project-bar__input"
            readOnly
            value={projectRecord ? shareUrl : 'Create a shareable project to save this issue on the server.'}
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
            {saveState === 'saving' ? 'Saving…' : projectRecord ? 'Save now' : 'Create project'}
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
                value={project.title}
                onChange={(event) => updateProject((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Subtitle</span>
              <textarea
                rows={3}
                value={project.subtitle}
                onChange={(event) => updateProject((current) => ({ ...current, subtitle: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Issue mark</span>
              <input
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
                <input type="file" accept="image/*" multiple onChange={handleUpload} />
              </label>
            </div>
            <p className="panel-note">Uploads are stored on the server and added to the current issue.</p>
            <div className="asset-rail">
              {project.assets.map((asset) => (
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
              ))}
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
              </div>
            </div>

            <div className="editor-canvas">
              <MagazinePreview
                issue={project.issue}
                page={selectedPage}
                assets={assetsById}
                selectedSlot={selectedSlot}
                interactive
                onSelectSlot={setSelectedSlot}
                onAssignDroppedAsset={assignAsset}
              />
            </div>
          </section>

          <section className="page-strip">
            {project.pages.map((page, index) => (
              <button
                key={page.id}
                type="button"
                className={`page-chip ${page.id === selectedPage.id ? 'is-active' : ''}`}
                onClick={() => setSelectedPageId(page.id)}
              >
                <span>Page {index + 1}</span>
                <strong>{page.title}</strong>
                <em>{templateMeta[page.template].label}</em>
              </button>
            ))}
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
              <input value={selectedPage.kicker} onChange={(event) => updateSelectedPage((page) => ({ ...page, kicker: event.target.value }))} />
            </label>
            <label className="field">
              <span>Title</span>
              <textarea rows={3} value={selectedPage.title} onChange={(event) => updateSelectedPage((page) => ({ ...page, title: event.target.value }))} />
            </label>
            <label className="field">
              <span>Deck</span>
              <textarea rows={3} value={selectedPage.deck} onChange={(event) => updateSelectedPage((page) => ({ ...page, deck: event.target.value }))} />
            </label>
            <label className="field">
              <span>Body</span>
              <textarea rows={5} value={selectedPage.body} onChange={(event) => updateSelectedPage((page) => ({ ...page, body: event.target.value }))} />
            </label>
            <label className="field">
              <span>Caption</span>
              <textarea rows={3} value={selectedPage.caption} onChange={(event) => updateSelectedPage((page) => ({ ...page, caption: event.target.value }))} />
            </label>
          </div>

          <div className="editor-panel">
            <p className="eyebrow">Selected frame</p>
            <h2>{selectedSlot ? selectedSlot.toUpperCase() : 'None'}</h2>
            {selectedSlot && currentCrop ? (
              <>
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
              <p className="panel-note">Click a frame on the page to edit crop controls.</p>
            )}
          </div>
        </aside>
      </div>

      <section className="editor-print-stack" aria-hidden="true">
        {project.pages.map((page) => (
          <div className="editor-print-page" key={page.id}>
            <MagazinePreview issue={project.issue} page={page} assets={assetsById} />
          </div>
        ))}
      </section>
    </div>
  );
}
