import { useRef } from 'react';
import { useT } from '../../i18n';
import { useModalFocus } from '../../ui/useModalFocus';
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

function preflightMessage(issue: ExportPreflightIssue, t: (key: string) => string) {
  switch (issue.code) {
    case 'empty-page':
      return t('This page has no placed image and no text content.');
    case 'missing-image':
      return t('Frame %s is empty.').replace('%s', issue.slot ?? '');
    case 'uncovered-frame':
      return t('Frame %s will expose page background because the image is not covering the full frame.').replace(
        '%s',
        issue.slot ?? '',
      );
    case 'low-resolution':
      return t('Frame %s is drawing from a source image that is too small for this export size and quality.').replace(
        '%s',
        issue.slot ?? '',
      );
    case 'odd-page-count':
      return t('This folio has an odd number of pages. Bound output needs an even count, or the inside back page stays blank.');
    case 'tight-gutter':
      return t('The inner page margin is too small for binding. Content close to the spine can be lost in the gutter.');
    default:
      return issue.message;
  }
}

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
  const dialogRef = useRef<HTMLElement | null>(null);
  useModalFocus(dialogRef, { active: true });
  return (
    <div className="editor-modal" role="presentation" onClick={onRequestCloseIfIdle}>
      <section
        ref={dialogRef}
        className="editor-modal__panel export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-center-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="export-dialog__header">
          <div>
            <p className="eyebrow">{t('Export Center')}</p>
            <h2 id="export-center-title">{t('Preflight and output')}</h2>
          </div>
          <div className="editor-modal__actions">
            <span className="panel-tag">{exportFormatMeta[exportSettings.format].label}</span>
            <button type="button" className="button button--ghost button--small" disabled={exportActionBusy} onClick={onClose}>
              {t('Close')}</button>
          </div>
        </header>
        <div className="export-dialog__body">
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
                  <strong>{t(exportPageSizeMeta[pageSize].emphasis)}</strong>
                  <small>{`${exportPageSizeMeta[pageSize].widthMm.toFixed(1)} × ${exportPageSizeMeta[pageSize].heightMm.toFixed(1)} mm · ${t(exportPageSizeMeta[pageSize].description)}`}</small>
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
                  <span>{t(exportQualityMeta[quality].label)}</span>
                  <strong>{`${exportQualityMeta[quality].baseDpi} dpi · ${t(exportQualityMeta[quality].estimatedFileSizeLabel)}`}</strong>
                  <small>{t(exportQualityMeta[quality].description)}</small>
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
                  <span>{t(jpgExportModeMeta[jpgMode].label)}</span>
                  <strong>{jpgMode === 'separate' ? t('ZIP package') : t('Single long image')}</strong>
                  <small>{t(jpgExportModeMeta[jpgMode].description)}</small>
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
                  {t(advisory)}
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
                  <strong>{issue.pageId ? issue.pageTitle : t('Whole folio')}</strong>
                  <span>{preflightMessage(issue, t)}</span>
                </button>
              ))}
              {exportPreflightIssues.length > 6 ? (
                <p className="panel-note">
                  {t('%s more warnings remain in this folio.').replace(
                    '%s',
                    String(exportPreflightIssues.length - 6),
                  )}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="panel-note">{t('No high-confidence issues detected for the current export settings.')}</p>
          )}
        </div>

        </div>
        <footer className="export-dialog__footer">
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
        </footer>
      </section>
    </div>
  );
}
