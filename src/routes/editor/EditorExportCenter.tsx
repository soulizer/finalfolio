import { useT } from '../../i18n';
import {
  exportFormatMeta,
  exportPageSizeMeta,
  exportQualityMeta,
  jpgExportModeMeta,
} from '../../editor/export';
import type {
  ExportFormat,
  ExportPageSize,
  ExportPreflightIssue,
  ExportQuality,
  ExportSettings,
  JpgExportMode,
} from '../../editor/types';
import type { ExportDialogState } from './useEditorExportState';

const EXPORT_FORMAT_ORDER: ExportFormat[] = ['pdf', 'jpg', 'project'];
const EXPORT_PAGE_SIZE_ORDER: ExportPageSize[] = ['a4', 'a5', 'a3'];

type EditorExportCenterProps = {
  exportActionBusy: boolean;
  exportAdvisories: string[];
  exportDialogState: ExportDialogState | null;
  exportPreflightIssues: ExportPreflightIssue[];
  exportSettings: ExportSettings;
  exportSubmitLabel: string;
  onClose: () => void;
  onRequestCloseIfIdle: () => void;
  onRunExport: () => void;
  onRunPrint: () => void;
  onSelectPreflightIssue: (issue: ExportPreflightIssue) => void;
  updateExportSettings: (updater: ExportSettings | ((current: ExportSettings) => ExportSettings)) => void;
};

export function EditorExportCenter({
  exportActionBusy,
  exportAdvisories,
  exportDialogState,
  exportPreflightIssues,
  exportSettings,
  exportSubmitLabel,
  onClose,
  onRequestCloseIfIdle,
  onRunExport,
  onRunPrint,
  onSelectPreflightIssue,
  updateExportSettings,
}: EditorExportCenterProps) {
  const t = useT();
  return (
    <div className="editor-modal" role="presentation" onClick={onRequestCloseIfIdle}>
      <section
        className="editor-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-center-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">{t('Export Center')}</p>
            <h2 id="export-center-title">{t('Preflight and output')}</h2>
          </div>
          <div className="editor-modal__actions">
            <span className="panel-tag">{exportFormatMeta[exportSettings.format].label}</span>
            <button type="button" className="button button--ghost button--small" disabled={exportActionBusy} onClick={onClose}>
              {t('Close')}</button>
          </div>
        </div>
        <p className="panel-note">
          {t('Choose export format, same-ratio page size, and quality first. JPG can export as a ZIP package of separate pages or as one stitched image.')}</p>
        <div className="editor-stack-field">
          <span className="editor-stack-field__label">{t('Format')}</span>
          <div className="template-grid template-grid--compact">
            {EXPORT_FORMAT_ORDER.map((format) => {
              const meta = exportFormatMeta[format];
              return (
                <button
                  key={format}
                  type="button"
                  className={`template-card ${exportSettings.format === format ? 'is-active' : ''}`}
                  onClick={() => updateExportSettings((current) => ({ ...current, format }))}
                >
                  <span>{t(meta.label)}</span>
                  <strong>{format === 'jpg' ? t('Image output') : format === 'pdf' ? t('Print output') : t('Reusable source')}</strong>
                  <small>{t(meta.description)}</small>
                </button>
              );
            })}
          </div>
        </div>

        {exportSettings.format !== 'project' ? (
          <div className="editor-stack-field">
            <span className="editor-stack-field__label">{t('Page size (same ratio)')}</span>
            <div className="template-grid template-grid--compact">
              {EXPORT_PAGE_SIZE_ORDER.map((pageSize) => (
                <button
                  key={pageSize}
                  type="button"
                  className={`template-card ${exportSettings.pageSize === pageSize ? 'is-active' : ''}`}
                  onClick={() => updateExportSettings((current) => ({ ...current, pageSize }))}
                >
                  <span>{exportPageSizeMeta[pageSize].label}</span>
                  <strong>{exportPageSizeMeta[pageSize].emphasis}</strong>
                  <small>{`${exportPageSizeMeta[pageSize].widthMm.toFixed(1)} × ${exportPageSizeMeta[pageSize].heightMm.toFixed(1)} mm · ${exportPageSizeMeta[pageSize].description}`}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {exportSettings.format !== 'project' ? (
          <div className="editor-stack-field">
            <span className="editor-stack-field__label">{t('Quality / file size')}</span>
            <div className="template-grid template-grid--compact">
              {(Object.keys(exportQualityMeta) as ExportQuality[]).map((quality) => (
                <button
                  key={quality}
                  type="button"
                  className={`template-card ${exportSettings.quality === quality ? 'is-active' : ''}`}
                  onClick={() => updateExportSettings((current) => ({ ...current, quality }))}
                >
                  <span>{exportQualityMeta[quality].label}</span>
                  <strong>{`${exportQualityMeta[quality].baseDpi} dpi · ${exportQualityMeta[quality].estimatedFileSizeLabel}`}</strong>
                  <small>{exportQualityMeta[quality].description}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {exportSettings.format === 'jpg' ? (
          <div className="editor-stack-field">
            <span className="editor-stack-field__label">{t('JPG output mode')}</span>
            <div className="template-grid template-grid--compact">
              {(Object.keys(jpgExportModeMeta) as JpgExportMode[]).map((jpgMode) => (
                <button
                  key={jpgMode}
                  type="button"
                  className={`template-card ${exportSettings.jpgMode === jpgMode ? 'is-active' : ''}`}
                  onClick={() => updateExportSettings((current) => ({ ...current, jpgMode }))}
                >
                  <span>{jpgExportModeMeta[jpgMode].label}</span>
                  <strong>{jpgMode === 'separate' ? t('ZIP package') : t('Single long image')}</strong>
                  <small>{jpgExportModeMeta[jpgMode].description}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="editor-stack-field">
          <span className="editor-stack-field__label">{t('Advisory')}</span>
          {exportAdvisories.length ? (
            <div>
              {exportAdvisories.map((advisory) => (
                <p key={advisory} className="panel-note">
                  {advisory}
                </p>
              ))}
            </div>
          ) : (
            <p className="panel-note">{t('No extra export advisory for this combination.')}</p>
          )}
        </div>

        <div className="editor-stack-field">
          <span className="editor-stack-field__label">{t('Preflight')}</span>
          {exportPreflightIssues.length ? (
            <div className="editor-warning-list">
              {exportPreflightIssues.slice(0, 6).map((issue) => (
                <button
                  key={`${issue.pageId}-${issue.code}-${issue.slot ?? 'page'}`}
                  type="button"
                  className="editor-warning-item"
                  onClick={() => onSelectPreflightIssue(issue)}
                >
                  <strong>{issue.pageTitle}</strong>
                  <span>{issue.message}</span>
                </button>
              ))}
              {exportPreflightIssues.length > 6 ? (
                <p className="panel-note">{`${exportPreflightIssues.length - 6} more warning${
                  exportPreflightIssues.length - 6 === 1 ? '' : 's'
                } remain in this folio.`}</p>
              ) : null}
            </div>
          ) : (
            <p className="panel-note">{t('No high-confidence issues detected for the current export settings.')}</p>
          )}
        </div>

        <div className="editor-panel__actions editor-panel__actions--tight">
          <button
            type="button"
            className={`button button--primary button--small ${
              exportDialogState ? 'editor-export-button--status' : ''
            } ${exportDialogState?.tone === 'error' ? 'editor-export-button--error' : ''}`.trim()}
            disabled={exportActionBusy}
            onClick={onRunExport}
            aria-live="polite"
          >
            {exportSubmitLabel}
          </button>
          {exportSettings.format === 'pdf' ? (
            <button
              type="button"
              className="button button--ghost button--small"
              disabled={exportActionBusy}
              onClick={onRunPrint}
            >
              {t('Print instead')}</button>
          ) : null}
          <button type="button" className="button button--ghost button--small" disabled={exportActionBusy} onClick={onClose}>
            {t('Cancel')}</button>
        </div>
      </section>
    </div>
  );
}
