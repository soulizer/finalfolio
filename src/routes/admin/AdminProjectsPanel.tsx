import { countLabel, useT } from '../../i18n';
import { DeleteIconButton } from '../../ui/DeleteIconButton';
import type { CSSProperties } from 'react';
import { MagazinePreview } from '../../components/MagazinePreview';
import type { AdminProjectDetail, AdminProjectListItem } from '../../editor/api';
import { getTemplateLabel, templateMeta } from '../../editor/demoData';
import { buildProjectFontVars } from '../../editor/fonts';
import { createPreviewPageStyle } from '../../editor/previewScale';
import type { Asset } from '../../editor/types';
import { formatCompactTimestamp, formatTimestamp } from './adminFormatting';
import { PanelCollapseToggle } from '../../ui/PanelCollapseToggle';
import { handleRowSelectKeyDown } from '../../ui/rowSelection';

const adminPreviewStyle = createPreviewPageStyle();

type AdminProjectsPanelProps = {
  filteredProjects: AdminProjectListItem[];
  handleDeleteProject: (projectId: string) => void | Promise<void>;
  projectSearch: string;
  selectedProjectDetail: AdminProjectDetail | null;
  selectedProjectId: string | null;
  setProjectSearch: (value: string) => void;
  setSelectedProjectId: (projectId: string) => void;
};

export function AdminProjectsPanel({
  filteredProjects,
  handleDeleteProject,
  projectSearch,
  selectedProjectDetail,
  selectedProjectId,
  setProjectSearch,
  setSelectedProjectId,
}: AdminProjectsPanelProps) {
  const t = useT();
  const selectedProjectMetrics = selectedProjectDetail?.metrics ?? null;
  const selectedProjectEvents = selectedProjectDetail?.recentEvents ?? [];
  const selectedProjectFailures = selectedProjectDetail?.recentFailures ?? [];
  const selectedProjectAssetsById: Record<string, Asset> = selectedProjectDetail
    ? Object.fromEntries(selectedProjectDetail.preview.assets.map((asset) => [asset.id, asset]))
    : {};

  return (
    <div className="admin-page admin-page--single">
      <section className="editor-panel admin-panel">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">{t('Projects')}</p>
            <h2>{t('Folio governance')}</h2>
          </div>
          <span className="panel-tag">{filteredProjects.length}</span>
                <PanelCollapseToggle />
        </div>
        <label className="field admin-search-field">
          <span>{t('Search projects')}</span>
          <input
            placeholder={t('Title, folio mark, owner username/email, or project ID')}
            value={projectSearch}
            onChange={(event) => setProjectSearch(event.target.value)}
          />
        </label>
        <div className={`admin-split-panel admin-split-panel--inspector ${filteredProjects.length ? '' : 'is-single'}`.trim()}>
          <div className="admin-list">
            {filteredProjects.length ? (
              filteredProjects.map((project) => {
                const metrics = project.metrics;
                return (
                  <article
                    key={project.id}
                    className={`admin-row ${selectedProjectId === project.id ? 'is-selected' : ''}`}
                  >
                    <div
                      className="admin-row__main"
                      role="button"
                      tabIndex={0}
                      aria-label={t('Select a project')}
                      onClick={() => setSelectedProjectId(project.id)}
                      onKeyDown={(event) => handleRowSelectKeyDown(event, () => setSelectedProjectId(project.id))}
                    >
                      <div className="admin-row__header">
                        <strong className="admin-row__title admin-row__title--truncate" title={project.title}>
                          {project.title}
                        </strong>
                      </div>
                      <p className="admin-row__subline">{project.id}</p>
                      <p className="admin-row__description">
                        {t('%s · %s · %s · Updated %s')
                          .replace('%s', project.ownerDisplay ?? t('unowned'))
                          .replace('%s', countLabel(metrics.pageCount, '1 page', '%s pages'))
                          .replace('%s', countLabel(metrics.assetCount, '1 image', '%s images'))
                          .replace('%s', formatCompactTimestamp(project.updatedAt))}
                      </p>
                    </div>
                    <div className="admin-row__aside">
                      <div className="admin-row__meta">
                        <span className="admin-pill admin-pill--strong">{project.issue}</span>
                        <span className={`admin-pill ${project.ownerDisplay ? '' : 'admin-pill--warning'}`}>
                          {project.ownerDisplay ?? t('unowned')}
                        </span>
                        <span className={`admin-pill ${project.health === 'healthy' ? 'admin-pill--success' : 'admin-pill--warning'}`}>
                          {t(project.health)}
                        </span>
                      </div>
                      <div className="admin-row__actions">
                        {project.publicSharePath ? (
                          <a
                            className="button button--ghost button--small"
                            href={project.publicSharePath}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t('Public Link')}</a>
                        ) : null}
                        <a
                          className="button button--primary button--small"
                          href={`/editor/${project.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t('Edit')}</a>
                        <DeleteIconButton
                          label={t('Delete')}
                          onClick={() => {
                            void handleDeleteProject(project.id);
                          }}
                        />
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <article className="admin-list__empty">
                <strong>{t('No matching projects')}</strong>
                <p>{t('Try a different folio mark, title, owner username/email, or project ID.')}</p>
              </article>
            )}
          </div>

          {filteredProjects.length ? (
          <aside className="admin-detail-card">
            {selectedProjectDetail && selectedProjectMetrics ? (
              <>
                <div className="admin-detail-card__header">
                  <div>
                    <p className="eyebrow">{t('Inspect')}</p>
                    <h2>{selectedProjectDetail.title}</h2>
                  </div>
                  <span className="panel-tag">{selectedProjectDetail.issue}</span>
                </div>
                {selectedProjectDetail.preview.pages.length ? (
                  <div className="admin-detail-preview">
                    <div className="admin-detail-preview__strip">
                      {selectedProjectDetail.preview.pages.map((page, index) => (
                        <article key={page.id} className="admin-detail-preview__page">
                          <div
                            className="magazine-sheet magazine-sheet--editor"
                            style={{
                              ...adminPreviewStyle,
                              ...buildProjectFontVars(selectedProjectDetail.preview.fonts),
                            }}
                          >
                            <MagazinePreview
                              issue={selectedProjectDetail.issue}
                              page={page}
                              assets={selectedProjectAssetsById}
                              assetVariant="preview"
                              frameRadius={selectedProjectDetail.frameRadius}
                              pageNumber={index + 1}
                            />
                          </div>
                          <div className="admin-detail-preview__caption">
                            <span>{String(index + 1).padStart(2, '0')}</span>
                            <strong>{page.title.trim() || getTemplateLabel(page.template, page.customTemplate)}</strong>
                            <small>{getTemplateLabel(page.template, page.customTemplate)}</small>
                          </div>
                        </article>
                      ))}
                    </div>
                    <p className="panel-note">{t('Scroll horizontally to inspect the full sequence. Preview derivatives are used instead of pulling full originals into admin.')}</p>
                  </div>
                ) : null}
                <div className="admin-detail-metrics admin-detail-metrics--compact">
                  <article>
                    <span>{t('Owner')}</span>
                    <strong>{selectedProjectDetail.ownerDisplay ?? t('unowned')}</strong>
                  </article>
                  <article>
                    <span>{t('Pages')}</span>
                    <strong>{selectedProjectMetrics.pageCount}</strong>
                  </article>
                  <article>
                    <span>{t('Assets')}</span>
                    <strong>{selectedProjectMetrics.assetCount}</strong>
                  </article>
                  <article>
                    <span>{t('Unused assets')}</span>
                    <strong>{selectedProjectMetrics.unusedAssetCount}</strong>
                  </article>
                  <article>
                    <span>{t('Blank pages')}</span>
                    <strong>{selectedProjectMetrics.blankPages}</strong>
                  </article>
                  <article>
                    <span>{t('Missing assets')}</span>
                    <strong>{selectedProjectMetrics.missingAssetCount}</strong>
                  </article>
                </div>
                <div className="admin-detail-section">
                  <strong>{t('Template distribution')}</strong>
                  <div className="admin-tag-cloud">
                    {Object.entries(selectedProjectMetrics.templateUsage).map(([templateId, count]) => (
                      <span key={templateId} className="admin-pill">
                        {`${getTemplateLabel(templateId as keyof typeof templateMeta, null)} · ${count}`}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="admin-detail-section">
                  <strong>{t('Recent project events')}</strong>
                  <div className="admin-mini-list">
                    {selectedProjectEvents.length ? (
                      selectedProjectEvents.map((event) => (
                        <article key={event.id} className="admin-mini-list__item">
                          <span>{event.type}</span>
                          <strong>{formatTimestamp(event.createdAt)}</strong>
                        </article>
                      ))
                    ) : (
                      <p className="panel-note">{t('No recent project events recorded for this folio.')}</p>
                    )}
                  </div>
                </div>
                {selectedProjectFailures.length ? (
                  <div className="admin-detail-section">
                    <strong>{t('Recent failures')}</strong>
                    <div className="admin-mini-list">
                      {selectedProjectFailures.map((failure) => (
                        <article key={failure.id} className="admin-mini-list__item">
                          <span>{failure.type}</span>
                          <strong>{failure.detail?.message ?? t('Unknown error')}</strong>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="admin-detail-card__empty">
                <strong>{t('Select a project')}</strong>
                <p>{t('Pick a folio from the list to inspect its first page, health signals, and recent operations.')}</p>
              </div>
            )}
          </aside>
          ) : null}
        </div>
      </section>
    </div>
  );
}
