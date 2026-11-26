import { countLabel, useT } from '../../i18n';
import { DeleteIconButton } from '../../ui/DeleteIconButton';
import type { KeyboardEvent } from 'react';
import { MagazinePreview } from '../../components/MagazinePreview';
import { getTemplateLabel } from '../../editor/demoData';
import { buildProjectFontVars } from '../../editor/fonts';
import { createPreviewPageStyle } from '../../editor/previewScale';
import type { Asset, ProjectRecord } from '../../editor/types';
import { formatCompactTimestamp, formatTimestamp } from './accountFormatting';
import type { ProjectVisibilityFilter } from './useAccountWorkspace';
import { PanelCollapseToggle } from '../../ui/PanelCollapseToggle';
import { handleRowClick, handleRowSelectKeyDown } from '../../ui/rowSelection';

const accountPreviewStyle = createPreviewPageStyle();

type AccountProjectsPanelProps = {
  filteredProjects: ProjectRecord[];
  handleCopyShareLink: (project: ProjectRecord) => void | Promise<void>;
  handleDeleteProject: (projectId: string) => void | Promise<void>;
  handleDisableShare: (project: ProjectRecord) => void | Promise<void>;
  handleEnableShare: (project: ProjectRecord) => void | Promise<void>;
  handleSaveProjectRename: (project: ProjectRecord) => void | Promise<void>;
  openRoute: (path: string) => void;
  projectBusyAction: 'delete' | 'share' | 'rename' | 'duplicate' | 'archive' | null;
  projectBusyId: string | null;
  projectEditingId: string | null;
  projectIssueDraft: string;
  projectSearch: string;
  projectTitleDraft: string;
  projectVisibilityFilter: ProjectVisibilityFilter;
  selectedProject: ProjectRecord | null;
  selectedProjectAssetsById: Record<string, Asset>;
  setProjectIssueDraft: (value: string) => void;
  setProjectSearch: (value: string) => void;
  setProjectTitleDraft: (value: string) => void;
  setProjectVisibilityFilter: (value: ProjectVisibilityFilter) => void;
  setSelectedProjectId: (projectId: string) => void;
  stopEditingProject: () => void;
};

const PROJECT_VISIBILITY_FILTERS: ProjectVisibilityFilter[] = ['active', 'archived', 'all'];

export function AccountProjectsPanel({
  filteredProjects,
  handleCopyShareLink,
  handleDeleteProject,
  handleDisableShare,
  handleEnableShare,
  handleSaveProjectRename,
  openRoute,
  projectBusyAction,
  projectBusyId,
  projectEditingId,
  projectIssueDraft,
  projectSearch,
  projectTitleDraft,
  projectVisibilityFilter,
  selectedProject,
  selectedProjectAssetsById,
  setProjectIssueDraft,
  setProjectSearch,
  setProjectTitleDraft,
  setProjectVisibilityFilter,
  setSelectedProjectId,
  stopEditingProject,
}: AccountProjectsPanelProps) {
  const t = useT();
  return (
    <div className="admin-page admin-page--single">
      <section className="editor-panel admin-panel">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">{t('Projects')}</p>
            <h2>{t('My projects')}</h2>
          </div>
          <span className="panel-tag">{filteredProjects.length}</span>
                <PanelCollapseToggle />
        </div>
        <div className="editor-filter-row" role="tablist" aria-label={t('Project visibility filters')}>
          {PROJECT_VISIBILITY_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`editor-filter-chip ${projectVisibilityFilter === filter ? 'is-active' : ''}`}
              onClick={() => setProjectVisibilityFilter(filter)}
            >
              {filter === 'active' ? t('Active') : filter === 'archived' ? t('Archived') : t('All')}
            </button>
          ))}
        </div>
        <label className="field admin-search-field">
          <span>{t('Search projects')}</span>
          <input
            placeholder={t('Title, folio mark, or project ID')}
            value={projectSearch}
            onChange={(event) => setProjectSearch(event.target.value)}
          />
        </label>
        <div className={`admin-split-panel admin-split-panel--inspector ${filteredProjects.length ? '' : 'is-single'}`.trim()}>
          <div className="admin-list">
            {filteredProjects.length ? (
              filteredProjects.map((project) => {
                const isEditing = projectEditingId === project.id;
                return (
                  <article
                    key={project.id}
                    className={`admin-row admin-row--interactive ${selectedProject?.id === project.id ? 'is-selected' : ''}`}
                    onClick={(event) => handleRowClick(event, () => setSelectedProjectId(project.id))}
                    >
                    <div
                      className="admin-row__main"
                      {...(isEditing
                        ? {}
                        : {
                            role: 'button',
                            tabIndex: 0,
                            'aria-label': t('Select a project'),
                            onClick: () => setSelectedProjectId(project.id),
                            onKeyDown: (event: KeyboardEvent<HTMLDivElement>) =>
                              handleRowSelectKeyDown(event, () => setSelectedProjectId(project.id)),
                          })}>
                      {isEditing ? (
                        <div className="template-library-card__form">
                          <label className="field">
                            <span>{t('Project title')}</span>
                            <input value={projectTitleDraft} onChange={(event) => setProjectTitleDraft(event.target.value)} />
                          </label>
                          <label className="field">
                            <span>{t('Folio mark')}</span>
                            <input value={projectIssueDraft} onChange={(event) => setProjectIssueDraft(event.target.value)} />
                          </label>
                        </div>
                      ) : (
                        <>
                          <div className="admin-row__header">
                            <strong className="admin-row__title admin-row__title--truncate" title={project.project.title}>
                              {project.project.title}
                            </strong>
                          </div>
                          <p className="admin-row__subline">{project.id}</p>
                          <p className="admin-row__description">
                            {t('%s · %s · %s · Updated %s')
                              .replace('%s', project.project.issue)
                              .replace('%s', countLabel(project.project.pages.length, '1 page', '%s pages'))
                              .replace('%s', countLabel(project.project.assets.length, '1 image', '%s images'))
                              .replace('%s', formatCompactTimestamp(project.updatedAt))}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="admin-row__aside">
                      <div className="admin-row__meta">
                        <span className="admin-pill admin-pill--strong">{project.project.issue}</span>
                        <span className={`admin-pill ${project.share.enabled ? 'admin-pill--success' : 'admin-pill--warning'}`}>
                          {project.share.enabled ? t('Shared') : t('Private')}
                        </span>
                        {project.archivedAt ? <span className="admin-pill admin-pill--warning">{t('Archived')}</span> : null}
                      </div>
                      <div className="admin-row__actions">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              className="button button--primary button--small"
                              disabled={projectBusyId === project.id}
                              onClick={() => void handleSaveProjectRename(project)}
                            >
                              {projectBusyId === project.id && projectBusyAction === 'rename' ? t('Saving…') : t('Save')}
                            </button>
                            <button type="button" className="button button--ghost button--small" onClick={stopEditingProject}>
                              {t('Cancel')}</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="button button--primary button--small" onClick={() => openRoute(project.sharePath)}>
                              {t('Edit')}</button>
                            {project.share.enabled ? (
                              <>
                                <button type="button" className="button button--ghost button--small" onClick={() => void handleCopyShareLink(project)}>
                                  {t('Copy link')}</button>
                                <button
                                  type="button"
                                  className="button button--ghost button--small"
                                  disabled={projectBusyId === project.id}
                                  onClick={() => void handleDisableShare(project)}
                                >
                                  {projectBusyId === project.id && projectBusyAction === 'share' ? t('Updating…') : t('Disable')}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="button button--ghost button--small"
                                disabled={projectBusyId === project.id}
                                onClick={() => void handleEnableShare(project)}
                              >
                                {projectBusyId === project.id && projectBusyAction === 'share' ? t('Sharing…') : t('Share')}
                              </button>
                            )}
                            <DeleteIconButton
                              label={
                                projectBusyId === project.id && projectBusyAction === 'delete'
                                  ? t('Deleting…')
                                  : t('Delete')
                              }
                              disabled={projectBusyId === project.id}
                              onClick={() => void handleDeleteProject(project.id)}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <article className="admin-list__empty">
                <strong>{t('No matching projects')}</strong>
                <p>{t('Try a different title, folio mark, or project ID.')}</p>
                <button type="button" className="button button--primary button--small" onClick={() => openRoute('/editor')}>
                  {t('Create a folio')}
                </button>
              </article>
            )}
          </div>

          {filteredProjects.length ? (
          <aside className="admin-detail-card">
            {selectedProject ? (
              <>
                <div className="admin-detail-card__header">
                  <div>
                    <p className="eyebrow">{t('Inspect')}</p>
                    <h2>{selectedProject.project.title}</h2>
                  </div>
                  <span className="panel-tag">{selectedProject.project.issue}</span>
                </div>
                {selectedProject.project.pages.length ? (
                  <div className="admin-detail-preview">
                    <div className="admin-detail-preview__strip">
                      {selectedProject.project.pages.map((page, index) => (
                        <article key={page.id} className="admin-detail-preview__page">
                          <div
                            className="magazine-sheet magazine-sheet--editor"
                            style={{ ...accountPreviewStyle, ...buildProjectFontVars(selectedProject.project.fonts) }}
                          >
                            <MagazinePreview
                              issue={selectedProject.project.issue}
                              page={page}
                              assets={selectedProjectAssetsById}
                              assetVariant="preview"
                              frameRadius={selectedProject.project.frameRadius}
                              pageNumber={index + 1}
                            />
                          </div>
                          <div className="admin-detail-preview__caption">
                            <span>{String(index + 1).padStart(2, '0')}</span>
                            <strong>{page.title.trim() || t(getTemplateLabel(page.template, page.customTemplate))}</strong>
                            <small>{t(getTemplateLabel(page.template, page.customTemplate))}</small>
                          </div>
                        </article>
                      ))}
                    </div>
                    <p className="panel-note">{t('Scroll horizontally to inspect the full sequence.')}</p>
                  </div>
                ) : null}
                <div className="admin-detail-metrics admin-detail-metrics--compact">
                  <article>
                    <span>{t('Updated')}</span>
                    <strong>{formatTimestamp(selectedProject.updatedAt)}</strong>
                  </article>
                  <article>
                    <span>{t('Pages')}</span>
                    <strong>{selectedProject.project.pages.length}</strong>
                  </article>
                  <article>
                    <span>{t('Assets')}</span>
                    <strong>{selectedProject.project.assets.length}</strong>
                  </article>
                  <article>
                    <span>{t('Visibility')}</span>
                    <strong>{selectedProject.share.enabled ? t('Shared') : t('Private')}</strong>
                  </article>
                  <article>
                    <span>{t('Status')}</span>
                    <strong>{selectedProject.archivedAt ? t('Archived') : t('Active')}</strong>
                  </article>
                </div>
                {selectedProject.project.subtitle ? (
                  <div className="admin-detail-section">
                    <strong>{t('Subtitle')}</strong>
                    <p className="panel-note">{selectedProject.project.subtitle}</p>
                  </div>
                ) : null}
                <div className="editor-panel__actions admin-panel__actions--flush">
                  <button type="button" className="button button--primary button--small" onClick={() => openRoute(selectedProject.sharePath)}>
                    {t('Edit')}</button>
                  {selectedProject.share.enabled ? (
                    <button type="button" className="button button--ghost button--small" onClick={() => void handleCopyShareLink(selectedProject)}>
                      {t('Copy link')}</button>
                  ) : (
                    <button type="button" className="button button--ghost button--small" onClick={() => void handleEnableShare(selectedProject)}>
                      {t('Enable public link')}</button>
                  )}
                </div>
              </>
            ) : (
              <div className="admin-detail-card__empty">
                <strong>{t('Select a project')}</strong>
                <p>{t('Choose a project from the list to inspect its pages, metadata, and sharing state.')}</p>
              </div>
            )}
          </aside>
          ) : null}
        </div>
      </section>
    </div>
  );
}
