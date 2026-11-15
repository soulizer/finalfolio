import { useT } from '../../i18n';
import type { AdminProjectListItem, ProductConfigPayload } from '../../editor/api';
import { templateMeta, templatePacks } from '../../editor/demoData';
import type { SiteContent, TemplateGovernance } from '../../product/types';
import { AdminInlineField, AdminToggleField } from './AdminFormFields';

type TemplateSettingField = 'enabled' | 'order' | 'category' | 'tag' | 'featured';

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
            <div className="admin-config-list">
              {Object.entries(templateMeta).map(([templateId, meta]) => (
                <article key={templateId} className="admin-config-row">
                  <div className="admin-config-row__copy">
                    <strong>{t(meta.label)}</strong>
                    <p>{t(meta.description)}</p>
                  </div>
                  <div className="admin-config-row__controls">
                    <div className="admin-config-row__toggles">
                      <AdminToggleField
                        label={t('Enabled')}
                        checked={templateGovernanceDraft.templates[templateId]?.enabled ?? true}
                        onChange={(checked) => updateTemplateSetting('templates', templateId, 'enabled', checked)}
                      />
                    </div>
                    <div className="admin-inline-field-stack">
                      <AdminInlineField label={t('Order')}>
                        <input
                          type="number"
                          value={templateGovernanceDraft.templates[templateId]?.order ?? 0}
                          onChange={(event) => updateTemplateSetting('templates', templateId, 'order', Number(event.target.value) || 0)}
                        />
                      </AdminInlineField>
                      <AdminInlineField label={t('Category')}>
                        <input
                          value={templateGovernanceDraft.templates[templateId]?.category ?? ''}
                          onChange={(event) => updateTemplateSetting('templates', templateId, 'category', event.target.value)}
                        />
                      </AdminInlineField>
                      <AdminInlineField label={t('Tag')}>
                        <input
                          value={templateGovernanceDraft.templates[templateId]?.tag ?? ''}
                          onChange={(event) => updateTemplateSetting('templates', templateId, 'tag', event.target.value)}
                        />
                      </AdminInlineField>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="admin-config-list">
              {Object.entries(templatePacks).map(([packId, pack]) => (
                <article key={packId} className="admin-config-row">
                  <div className="admin-config-row__copy">
                    <strong>{t(pack.label)}</strong>
                    <p>{t(pack.description)}</p>
                  </div>
                  <div className="admin-config-row__controls">
                    <div className="admin-config-row__toggles">
                      <AdminToggleField
                        label={t('Enabled')}
                        checked={templateGovernanceDraft.packs[packId]?.enabled ?? true}
                        onChange={(checked) => updateTemplateSetting('packs', packId, 'enabled', checked)}
                      />
                      <AdminToggleField
                        label={t('Featured')}
                        checked={templateGovernanceDraft.packs[packId]?.featured ?? false}
                        onChange={(checked) => updateTemplateSetting('packs', packId, 'featured', checked)}
                      />
                    </div>
                    <div className="admin-inline-field-stack">
                      <AdminInlineField label={t('Order')}>
                        <input
                          type="number"
                          value={templateGovernanceDraft.packs[packId]?.order ?? 0}
                          onChange={(event) => updateTemplateSetting('packs', packId, 'order', Number(event.target.value) || 0)}
                        />
                      </AdminInlineField>
                      <AdminInlineField label={t('Category')}>
                        <input
                          value={templateGovernanceDraft.packs[packId]?.category ?? ''}
                          onChange={(event) => updateTemplateSetting('packs', packId, 'category', event.target.value)}
                        />
                      </AdminInlineField>
                      <AdminInlineField label={t('Tag')}>
                        <input
                          value={templateGovernanceDraft.packs[packId]?.tag ?? ''}
                          onChange={(event) => updateTemplateSetting('packs', packId, 'tag', event.target.value)}
                        />
                      </AdminInlineField>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="editor-panel__actions admin-panel__actions--end">
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
                  <strong>{`Feature ${index + 1}`}</strong>
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
                <AdminInlineField key={index} label={`Workflow step ${index + 1}`}>
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

            <div className="editor-panel__actions admin-panel__actions--end">
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
