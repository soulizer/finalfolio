import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MagazinePreview } from '../components/MagazinePreview';
import { createDefaultProject, templateMeta } from '../editor/demoData';
import { Asset, PageData, ProjectState } from '../editor/types';

const STORAGE_KEY = 'crazyalbum-project-v1';

function readProjectState(): ProjectState {
  const fresh = createDefaultProject();
  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) return fresh;

  try {
    const parsed = JSON.parse(stored) as ProjectState;
    if (!parsed.pages?.length || !parsed.assets?.length) return fresh;
    return parsed;
  } catch {
    return fresh;
  }
}

function createPageId() {
  return `page-${crypto.randomUUID()}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function EditorPage() {
  const [project, setProject] = useState<ProjectState>(() => readProjectState());
  const [selectedPageId, setSelectedPageId] = useState(project.pages[0]?.id ?? '');
  const [selectedSlot, setSelectedSlot] = useState<string | null>('hero');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  }, [project]);

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

  useEffect(() => {
    if (!selectedPage) return;
    const firstSlot = Object.keys(selectedPage.slots)[0] ?? null;
    if (!selectedSlot || !(selectedSlot in selectedPage.slots)) {
      setSelectedSlot(firstSlot);
    }
  }, [selectedPage, selectedSlot]);

  if (!selectedPage) return null;

  function updateProject(updater: (current: ProjectState) => ProjectState) {
    setProject((current) => updater(current));
  }

  function updateSelectedPage(updater: (page: PageData) => PageData) {
    updateProject((current) => ({
      ...current,
      pages: current.pages.map((page) => (page.id === selectedPage.id ? updater(page) : page)),
    }));
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const uploads = await Promise.all(
      files.map(async (file) => ({
        id: `upload-${crypto.randomUUID()}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        src: await fileToDataUrl(file),
        note: 'Uploaded to this browser session.',
      })),
    );

    updateProject((current) => ({
      ...current,
      assets: [...uploads, ...current.assets],
    }));

    event.target.value = '';
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
    const nextPage: PageData = {
      id: createPageId(),
      template: selectedPage.template,
      kicker: 'New page',
      title: 'Untitled page',
      deck: 'Swap templates, place images, and edit the copy.',
      body: 'Use this page as a fresh spread inside the demo issue.',
      caption: 'Printed output will use the same page geometry.',
      slots: Object.fromEntries(templateMeta[selectedPage.template].slots.map((slot) => [slot, null])),
      crops: Object.fromEntries(templateMeta[selectedPage.template].slots.map((slot) => [slot, { x: 50, y: 50, scale: 1 }])),
    };

    updateProject((current) => ({
      ...current,
      pages: [...current.pages, nextPage],
    }));
    setSelectedPageId(nextPage.id);
    setSelectedSlot(templateMeta[nextPage.template].slots[0] ?? null);
  }

  function duplicatePage() {
    const duplicate: PageData = {
      ...selectedPage,
      id: createPageId(),
      title: `${selectedPage.title} Copy`,
    };

    updateProject((current) => ({
      ...current,
      pages: [...current.pages, duplicate],
    }));
    setSelectedPageId(duplicate.id);
  }

  function resetProject() {
    const fresh = createDefaultProject();
    setProject(fresh);
    setSelectedPageId(fresh.pages[0].id);
    setSelectedSlot('hero');
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

  const currentCrop = selectedSlot ? selectedPage.crops[selectedSlot] : undefined;

  return (
    <div className="editor-shell">
      <header className="editor-topbar">
        <div className="editor-topbar__brand">
          <Link to="/">CrazyAlbum</Link>
          <span>WYSIWYG magazine prototype</span>
        </div>
        <div className="editor-topbar__actions">
          <button type="button" className="button button--ghost" onClick={resetProject}>
            Reset issue
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
                Upload
                <input type="file" accept="image/*" multiple onChange={handleUpload} />
              </label>
            </div>
            <p className="panel-note">Drag onto a frame or click an asset after selecting a frame.</p>
            <div className="asset-rail">
              {project.assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className="asset-tile"
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData('text/crazyalbum-asset', asset.id)}
                  onClick={() => {
                    if (selectedSlot) assignAsset(selectedSlot, asset.id);
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

