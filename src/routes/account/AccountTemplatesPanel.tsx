import { useT } from '../../i18n';
import { TemplateIssuePreview } from '../../components/TemplateIssuePreview';
import type { UserTemplateRecord } from '../../editor/types';
import { formatTimestamp } from './accountFormatting';

type AccountTemplatesPanelProps = {
  filteredTemplates: UserTemplateRecord[];
  handleDeleteTemplate: (template: UserTemplateRecord) => void | Promise<void>;
  handleDuplicateTemplate: (template: UserTemplateRecord) => void | Promise<void>;
  handleOpenTemplate: (template: UserTemplateRecord) => void | Promise<void>;
  handleSaveTemplate: (template: UserTemplateRecord) => void | Promise<void>;
  setTemplateDescriptionDraft: (value: string) => void;
  setTemplateNameDraft: (value: string) => void;
  setTemplateSearch: (value: string) => void;
  startEditingTemplate: (template: UserTemplateRecord) => void;
  stopEditingTemplate: () => void;
  templateBusyId: string | null;
  templateDescriptionDraft: string;
  templateEditingId: string | null;
  templateNameDraft: string;
  templateSearch: string;
};

export function AccountTemplatesPanel({
  filteredTemplates,
  handleDeleteTemplate,
  handleDuplicateTemplate,
  handleOpenTemplate,
  handleSaveTemplate,
  setTemplateDescriptionDraft,
  setTemplateNameDraft,
  setTemplateSearch,
  startEditingTemplate,
  stopEditingTemplate,
  templateBusyId,
  templateDescriptionDraft,
  templateEditingId,
  templateNameDraft,
  templateSearch,
}: AccountTemplatesPanelProps) {
  const t = useT();
  return (
    <div className="admin-page admin-page--single">
      <section className="editor-panel admin-panel">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">{t('Templates')}</p>
            <h2>{t('My templates')}</h2>
          </div>
          <span className="panel-tag">{filteredTemplates.length}</span>
        </div>
        <label className="field admin-search-field">
          <span>{t('Search templates')}</span>
          <input
            placeholder={t('Template name, description, or source project')}
            value={templateSearch}
            onChange={(event) => setTemplateSearch(event.target.value)}
          />
        </label>
        <div className="template-library-grid">
          {filteredTemplates.length ? (
            filteredTemplates.map((template) => {
              const isEditing = templateEditingId === template.id;
              return (
                <article key={template.id} className="template-library-card">
                  <TemplateIssuePreview templatePayload={template.templatePayload} className="template-library-card__preview" />
                  <div className="template-library-card__body">
                    {isEditing ? (
                      <div className="template-library-card__form">
                        <label className="field">
                          <span>{t('Name')}</span>
                          <input value={templateNameDraft} onChange={(event) => setTemplateNameDraft(event.target.value)} />
                        </label>
                        <label className="field">
                          <span>{t('Description')}</span>
                          <textarea
                            rows={3}
                            value={templateDescriptionDraft}
                            onChange={(event) => setTemplateDescriptionDraft(event.target.value)}
                          />
                        </label>
                      </div>
                    ) : (
                      <>
                        <div className="template-library-card__header">
                          <strong>{template.name}</strong>
                          <span className="admin-pill admin-pill--strong">
                            {template.kind === 'page' ? t('Page template') : t('Project template')}
                          </span>
                        </div>
                        <p className="template-library-card__description">
                          {template.description || t('Saved from the editor as a reusable folio scaffold.')}
                        </p>
                        <p className="template-library-card__meta">
                          {`${template.templatePayload.pages.length} pages · ${template.includesCopy ? t('Includes copy') : t('Structure first')} · Updated ${formatTimestamp(template.updatedAt)}`}
                        </p>
                        {template.sourceProjectId ? <p className="template-library-card__meta">{`Source project ${template.sourceProjectId}`}</p> : null}
                      </>
                    )}
                  </div>
                  <div className="template-library-card__actions">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className="button button--primary button--small"
                          disabled={templateBusyId === template.id}
                          onClick={() => void handleSaveTemplate(template)}
                        >
                          {templateBusyId === template.id ? t('Saving…') : t('Save')}
                        </button>
                        <button type="button" className="button button--ghost button--small" onClick={stopEditingTemplate}>
                          {t('Cancel')}</button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="button button--primary button--small"
                          disabled={templateBusyId === template.id}
                          onClick={() => void handleOpenTemplate(template)}
                        >
                          {templateBusyId === template.id ? t('Opening…') : t('Use template')}
                        </button>
                        <button type="button" className="button button--ghost button--small" onClick={() => startEditingTemplate(template)}>
                          {t('Rename')}</button>
                        <button
                          type="button"
                          className="button button--ghost button--small"
                          disabled={templateBusyId === template.id}
                          onClick={() => void handleDuplicateTemplate(template)}
                        >
                          {templateBusyId === template.id ? t('Working…') : t('Duplicate')}
                        </button>
                        <button
                          type="button"
                          className="button button--danger button--small"
                          disabled={templateBusyId === template.id}
                          onClick={() => void handleDeleteTemplate(template)}
                        >
                          {templateBusyId === template.id ? t('Deleting…') : t('Delete')}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <article className="admin-list__empty">
              <strong>{t('No templates yet')}</strong>
              <p>{t('Save the current folio as a template from the editor, then manage and reuse it here.')}</p>
            </article>
          )}
        </div>
      </section>
    </div>
  );
}
