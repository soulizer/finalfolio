import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import type { AdminProjectListItem, ProductConfigPayload } from '../../editor/api';
import { templateMeta, templatePacks } from '../../editor/demoData';
import type { SiteContent, TemplateGovernance, TemplateGovernanceEntry } from '../../product/types';
import { AdminInlineField } from './AdminFormFields';

type TemplateSettingField = 'enabled' | 'order' | 'category' | 'tag' | 'featured';

type GovernanceRow = {
  id: string;
  label: string;
  description: string;
  entry: TemplateGovernanceEntry | undefined;
};

function GovernanceCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="admin-config-table__cell">
      <span className="admin-config-table__cell-label">{label}</span>
      {children}
    </label>
  );
}

function GovernanceTable({
  group,
  onChange,
  rows,
  showFeatured,
}: {
  group: keyof TemplateGovernance;
  onChange: (group: keyof TemplateGovernance, id: string, field: TemplateSettingField, value: boolean | number | string) => void;
  rows: GovernanceRow[];
  showFeatured: boolean;
}) {
  const t = useT();
  return (
    <div className={`admin-config-table ${showFeatured ? 'admin-config-table--packs' : 'admin-config-table--templates'}`}>
      <div className="admin-config-table__head">
        <span>{t('Template')}</span>
        <span>{t('Enabled')}</span>
        {showFeatured ? <span>{t('Featured')}</span> : null}
        <span>{t('Order')}</span>
        <span>{t('Category')}</span>
        <span>{t('Tag')}</span>
      </div>
      {rows.map((row) => {
        const name = t(row.label);
        return (
          <div className="admin-config-table__row" key={row.id}>
            <div className="admin-config-table__copy">
              <strong>{name}</strong>
              <p>{t(row.description)}</p>
            </div>
            <GovernanceCell label={t('Enabled')}>
              <input
                type="checkbox"
                aria-label={`${t('Enabled')} · ${name}`}
                checked={row.entry?.enabled ?? true}
                onChange={(event) => onChange(group, row.id, 'enabled', event.target.checked)}
              />
            </GovernanceCell>
            {showFeatured ? (
              <GovernanceCell label={t('Featured')}>
                <input
                  type="checkbox"
                  aria-label={`${t('Featured')} · ${name}`}
                  checked={row.entry?.featured ?? false}
                  onChange={(event) => onChange(group, row.id, 'featured', event.target.checked)}
                />
              </GovernanceCell>
            ) : null}
            <GovernanceCell label={t('Order')}>
              <input
                type="number"
                aria-label={`${t('Order')} · ${name}`}
                value={row.entry?.order ?? 0}
                onChange={(event) => onChange(group, row.id, 'order', Number(event.target.value) || 0)}
              />
            </GovernanceCell>
            <GovernanceCell label={t('Category')}>
              <input
                aria-label={`${t('Category')} · ${name}`}
                value={row.entry?.category ?? ''}
                onChange={(event) => onChange(group, row.id, 'category', event.target.value)}
              />
            </GovernanceCell>
            <GovernanceCell label={t('Tag')}>
              <input
                aria-label={`${t('Tag')} · ${name}`}
                value={row.entry?.tag ?? ''}
                onChange={(event) => onChange(group, row.id, 'tag', event.target.value)}
              />
            </GovernanceCell>
          </div>
        );
      })}
    </div>
  );
}


type AdminGovernancePanelProps = {
  configBusy: boolean;
  enabledPackCount: number;
  enabledTemplateCount: number;
  handleSaveSiteContent: () => void | Promise<void>;
  handleSaveTemplateGovernance: () => void | Promise<void>;
  productConfig: ProductConfigPayload | null;
  projects: AdminProjectListItem[];
  siteContentDraft: SiteContent | null;
  templateGovernanceDraft: TemplateGovernance | null;
  updateFeaturedIssue: (field: 'eyebrow' | 'title' | 'body', value: string) => void;
  updateFeaturedPageIds: (value: string) => void;
  updateFeaturedProjectId: (value: string) => void;
  updateSiteCta: (field: keyof SiteContent['cta'], value: string) => void;
  updateSiteFeature: (index: number, field: 'title' | 'copy', value: string) => void;
  updateSiteHero: (field: keyof SiteContent['hero'], value: string) => void;
  updateTemplateSetting: (group: keyof TemplateGovernance, id: string, field: TemplateSettingField, value: boolean | number | string) => void;
  updateWorkflow: (field: 'eyebrow' | 'title' | 'body', value: string) => void;
  updateWorkflowStep: (index: number, value: string) => void;
};

export function AdminGovernancePanel({
  configBusy,
  enabledPackCount,
  enabledTemplateCount,
  handleSaveSiteContent,
  handleSaveTemplateGovernance,
  productConfig,
  projects,
  siteContentDraft,
  templateGovernanceDraft,
  updateFeaturedIssue,
  updateFeaturedPageIds,
  updateFeaturedProjectId,
  updateSiteCta,
  updateSiteFeature,
  updateSiteHero,
  updateTemplateSetting,
  updateWorkflow,
  updateWorkflowStep,
}: AdminGovernancePanelProps) {
  const t = useT();
  return (
    <div className="admin-page admin-page--governance">
      <section className="editor-panel admin-panel">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">{t('Templates')}</p>
            <h2>{t('Govern page types and starter packs')}</h2>
          </div>
          <span className="panel-tag">{enabledTemplateCount + enabledPackCount}</span>
        </div>
        {templateGovernanceDraft ? (
          <>
            <h3 className="admin-subsection-title">{t('Page layouts')}</h3>
            <GovernanceTable
              group="templates"
              onChange={updateTemplateSetting}
              rows={Object.entries(templateMeta).map(([templateId, meta]) => ({
                id: templateId,
                label: meta.label,
                description: meta.description,
                entry: templateGovernanceDraft.templates[templateId],
              }))}
              showFeatured={false}
            />
            <h3 className="admin-subsection-title">{t('Starter packs')}</h3>
            <GovernanceTable
              group="packs"
              onChange={updateTemplateSetting}
              rows={Object.entries(templatePacks).map(([packId, pack]) => ({
                id: packId,
                label: pack.label,
                description: pack.description,
                entry: templateGovernanceDraft.packs[packId],
              }))}
              showFeatured
            />
            <div className="editor-panel__actions admin-panel__actions--end admin-save-bar">
              <button
                type="button"
                className="button button--primary button--small"
                onClick={() => void handleSaveTemplateGovernance()}
                disabled={configBusy}
              >
                {t('Save template governance')}</button>
            </div>
          </>
        ) : null}
      </section>

      <section className="editor-panel admin-panel">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">{t('Site settings')}</p>
            <h2>{t('Homepage content and featured folio')}</h2>
          </div>
          <span className="panel-tag">{productConfig?.homepagePreview?.source === 'project' ? t('live preview') : t('demo fallback')}</span>
        </div>
        {siteContentDraft ? (
          <div className="admin-settings-stack">
            <div className="admin-form-grid">
              <AdminInlineField label={t('Hero eyebrow')}>
                <input value={siteContentDraft.hero.eyebrow} onChange={(event) => updateSiteHero('eyebrow', event.target.value)} />
              </AdminInlineField>
              <AdminInlineField label={t('Hero title')} multiline stacked>
                <textarea value={siteContentDraft.hero.title} onChange={(event) => updateSiteHero('title', event.target.value)} rows={3} />
              </AdminInlineField>
              <AdminInlineField label={t('Hero lede')} multiline stacked>
                <textarea value={siteContentDraft.hero.lede} onChange={(event) => updateSiteHero('lede', event.target.value)} rows={4} />
              </AdminInlineField>
            </div>

            <div className="admin-form-grid">
              {siteContentDraft.features.map((feature, index) => (
                <article key={feature.id} className="admin-inline-card">
                  <strong>{t('Feature %s').replace('%s', String(index + 1))}</strong>
                  <div className="admin-inline-field-stack">
                    <AdminInlineField label={t('Title')}>
                      <input value={feature.title} onChange={(event) => updateSiteFeature(index, 'title', event.target.value)} />
                    </AdminInlineField>
                    <AdminInlineField label={t('Copy')} multiline stacked>
                      <textarea value={feature.copy} onChange={(event) => updateSiteFeature(index, 'copy', event.target.value)} rows={4} />
                    </AdminInlineField>
                  </div>
                </article>
              ))}
            </div>

            <div className="admin-form-grid">
              <AdminInlineField label={t('Workflow title')} multiline stacked>
                <textarea value={siteContentDraft.workflow.title} onChange={(event) => updateWorkflow('title', event.target.value)} rows={3} />
              </AdminInlineField>
              <AdminInlineField label={t('Workflow body')} multiline stacked>
                <textarea value={siteContentDraft.workflow.body} onChange={(event) => updateWorkflow('body', event.target.value)} rows={4} />
              </AdminInlineField>
              {siteContentDraft.workflow.steps.map((step, index) => (
                <AdminInlineField key={index} label={t('Workflow step %s').replace('%s', String(index + 1))}>
                  <input value={step} onChange={(event) => updateWorkflowStep(index, event.target.value)} />
                </AdminInlineField>
              ))}
            </div>

            <div className="admin-form-grid">
              <AdminInlineField label={t('Featured title')}>
                <input value={siteContentDraft.featuredIssue.title} onChange={(event) => updateFeaturedIssue('title', event.target.value)} />
              </AdminInlineField>
              <AdminInlineField label={t('Featured body')} multiline stacked>
                <textarea value={siteContentDraft.featuredIssue.body} onChange={(event) => updateFeaturedIssue('body', event.target.value)} rows={4} />
              </AdminInlineField>
              <AdminInlineField label={t('Featured project')}>
                <select value={siteContentDraft.featuredIssue.projectId ?? ''} onChange={(event) => updateFeaturedProjectId(event.target.value)}>
                  <option value="">{t('Built-in demo preview')}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {`${project.issue} · ${project.title}`}
                    </option>
                  ))}
                </select>
              </AdminInlineField>
              <AdminInlineField label={t('Featured page IDs')}>
                <input
                  placeholder={t('page-cover, page-essay')}
                  value={siteContentDraft.featuredIssue.pageIds.join(', ')}
                  onChange={(event) => updateFeaturedPageIds(event.target.value)}
                />
              </AdminInlineField>
            </div>

            <div className="admin-form-grid">
              <AdminInlineField label={t('CTA title')}>
                <input value={siteContentDraft.cta.title} onChange={(event) => updateSiteCta('title', event.target.value)} />
              </AdminInlineField>
              <AdminInlineField label={t('CTA body')} multiline stacked>
                <textarea value={siteContentDraft.cta.body} onChange={(event) => updateSiteCta('body', event.target.value)} rows={4} />
              </AdminInlineField>
              <AdminInlineField label={t('Primary CTA')}>
                <input value={siteContentDraft.cta.primaryLabel} onChange={(event) => updateSiteCta('primaryLabel', event.target.value)} />
              </AdminInlineField>
              <AdminInlineField label={t('Secondary CTA')}>
                <input value={siteContentDraft.cta.secondaryLabel} onChange={(event) => updateSiteCta('secondaryLabel', event.target.value)} />
              </AdminInlineField>
            </div>

            <div className="editor-panel__actions admin-panel__actions--end admin-save-bar">
              <button
                type="button"
                className="button button--primary button--small"
                onClick={() => void handleSaveSiteContent()}
                disabled={configBusy}
              >
                {t('Save site settings')}</button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
