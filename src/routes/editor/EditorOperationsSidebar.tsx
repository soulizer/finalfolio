import { useState } from 'react';
import { useT } from '../../i18n';
import type { UserSession } from '../../editor/api';
import { getUserPrimaryIdentity } from '../../editor/identity';
import {
  PROJECT_FRAME_RADIUS_DEFAULT,
  PROJECT_FRAME_RADIUS_MAX,
  PROJECT_FRAME_RADIUS_MIN,
  PROJECT_ISSUE_LIMIT,
  PROJECT_SUBTITLE_LIMIT,
  PROJECT_TITLE_LIMIT,
} from '../../editor/limits';
import type { ProjectRecord, ProjectState, UserTemplateKind } from '../../editor/types';

type SaveState = 'draft' | 'dirty' | 'saving' | 'saved' | 'error';
type ProjectActionBusy = 'duplicate' | 'archive' | 'unarchive' | null;

type EditorOperationsSidebarProps = {
  archiveActionLabel: string;
  authReady: boolean;
  canRedo: boolean;
  canSaveProject: boolean;
  canUndo: boolean;
  exportActionBusy: boolean;
  exportActionLabel: string;
  guestUploadTransferBusy: boolean;
  hasGuestUploadAssets: boolean;
  libraryBusy: boolean;
  onArchiveToggle: () => void;
  onCloseTemplateComposer: () => void;
  onOpenAiArrange: () => void;
  onCopyPublicShareLink: () => void;
  onDisableShare: () => void;
  onDuplicateProject: () => void;
  onEnableShare: () => void;
  onOpenAccountPage: () => void;
  onOpenAdminPage: () => void;
  onOpenSharedProject: () => void;
  onRedo: () => void;
  onRegenerateShare: () => void;
  onSaveCurrentProjectAsTemplate: () => void;
  onSaveProject: () => void;
  onStartNewDraft: () => void;
  onTemplatePreserveCopyChange: (value: boolean) => void;
  onTemplateSaveDescriptionChange: (value: string) => void;
  onTemplateSaveKindChange: (kind: UserTemplateKind) => void;
  onTemplateSaveNameChange: (value: string) => void;
  onToggleExportCenter: () => void;
  onToggleTemplateComposer: () => void;
  onUndo: () => void;
  project: ProjectState;
  projectActionBusy: ProjectActionBusy;
  projectModeTag: string;
  projectMutationLocked: boolean;
  projectRecord: ProjectRecord | null;
  onReloadLatest: () => void;
  saveConflict: string | null;
  publicShareCopyLabel: string;
  publicShareUrl: string;
  saveActionLabel: string;
  saveState: SaveState;
  selectedPagePositionLabel: string;
  sequenceLabel: string;
  session: UserSession | null;
  shareBusy: boolean;
  statusText: string;
  templateComposerOpen: boolean;
  templatePreserveCopy: boolean;
  templateSaveActionLabel: string;
  templateSaveBusy: boolean;
  templateSaveDescription: string;
  templateSaveKind: UserTemplateKind;
  templateSaveName: string;
  updateFrameRadius: (value: number) => void;
  updateProject: (updater: (current: ProjectState) => ProjectState) => void;
};

export function EditorOperationsSidebar({
  archiveActionLabel,
  authReady,
  canRedo,
  canSaveProject,
  canUndo,
  exportActionBusy,
  exportActionLabel,
  guestUploadTransferBusy,
  hasGuestUploadAssets,
  libraryBusy,
  onArchiveToggle,
  onCloseTemplateComposer,
  onOpenAiArrange,
  onCopyPublicShareLink,
  onDisableShare,
  onDuplicateProject,
  onEnableShare,
  onOpenAccountPage,
  onOpenAdminPage,
  onOpenSharedProject,
  onRedo,
  onRegenerateShare,
  onSaveCurrentProjectAsTemplate,
  onSaveProject,
  onStartNewDraft,
  onTemplatePreserveCopyChange,
  onTemplateSaveDescriptionChange,
  onTemplateSaveKindChange,
  onTemplateSaveNameChange,
  onToggleExportCenter,
  onToggleTemplateComposer,
  onUndo,
  project,
  projectActionBusy,
  projectModeTag,
  projectMutationLocked,
  projectRecord,
  onReloadLatest,
  saveConflict,
  publicShareCopyLabel,
  publicShareUrl,
  saveActionLabel,
  saveState,
  selectedPagePositionLabel,
  sequenceLabel,
  session,
  shareBusy,
  statusText,
  templateComposerOpen,
  templatePreserveCopy,
  templateSaveActionLabel,
  templateSaveBusy,
  templateSaveDescription,
  templateSaveKind,
  templateSaveName,
  updateFrameRadius,
  updateProject,
}: EditorOperationsSidebarProps) {
  const t = useT();
  const [projectDetailsOpen, setProjectDetailsOpen] = useState(false);
  const frameRadiusRoundThreshold = Math.max(PROJECT_FRAME_RADIUS_DEFAULT + 10, PROJECT_FRAME_RADIUS_MAX - 12);
  const frameRadiusLabel =
    project.frameRadius <= 2 ? t('Square') : project.frameRadius >= frameRadiusRoundThreshold ? t('Round') : `${project.frameRadius}px`;

  return (
    <aside className="editor-sidebar editor-sidebar--operations">
      <section className="editor-panel editor-panel--account">
        <div className="editor-panel__toolbar">
          <span className="editor-panel__label">{t('Account')}</span>
          <span className="panel-tag">{authReady ? (session ? t(session.role) : t('Guest')) : t('Session')}</span>
        </div>
        <p className="editor-panel__value">
          {authReady ? (session ? getUserPrimaryIdentity(session) : t('Sign in required')) : t('Account')}
        </p>
        <p className="panel-note">
          {!authReady
            ? t('Keeping the current workspace warm while the shared session finishes loading.')
            : session
              ? hasGuestUploadAssets
                ? guestUploadTransferBusy
                  ? t('Recovered local photos are being attached to this account now. Saving will unlock as soon as that finishes.')
                  : t('This account can save links and keep uploads. Recovered local photos below stay visible and will be attached to this account before saving.')
                : t('Uploads, saved project links, and deletion governance now stay tied to this account.')
              : t('Guest mode can stage uploads locally on this device and export, but saved or shareable links still require sign-in.')}
        </p>
        <div className="editor-panel__actions editor-panel__actions--tight">
          <button type="button" className="button button--ghost button--small" onClick={onOpenAccountPage}>
            {session ? t('My Account') : t('Sign in')}
          </button>
          {session?.role === 'admin' ? (
            <button type="button" className="button button--ghost button--small" onClick={onOpenAdminPage}>
              {t('Open admin')}</button>
          ) : null}
        </div>
      </section>

      <section className="editor-panel editor-panel--project-actions">
        <div className="editor-panel__toolbar">
          <span className="editor-panel__label">{t('Project')}</span>
          <span className="panel-tag">{projectModeTag}</span>
        </div>
        <p className="editor-panel__value">{project.issue}</p>
        <label className="field">
          <span>{t('Title')}</span>
          <input
            maxLength={PROJECT_TITLE_LIMIT}
            value={project.title}
            onChange={(event) => updateProject((current) => ({ ...current, title: event.target.value }))}
          />
        </label>
        <p className="panel-note panel-note--status">{t(statusText)}</p>
        {saveConflict ? (
          <div className="editor-conflict-notice" role="alert">
            <p>{saveConflict}</p>
            <button type="button" className="button button--primary button--small" onClick={onReloadLatest}>
              {t('Reload latest')}</button>
          </div>
        ) : null}
        <div className="editor-icon-toolbar" role="group" aria-label={t('Project actions')}>
          <button
            type="button"
            className="editor-icon-button"
            disabled={!canUndo}
            onClick={onUndo}
            aria-label={t('Undo')}
            title={t('Undo (Ctrl+Z)')}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3.5 2.5 7 6 10.5M2.5 7h6.2a3.4 3.4 0 0 1 0 6.8H6.5" />
            </svg>
          </button>
          <button
            type="button"
            className="editor-icon-button"
            disabled={!canRedo}
            onClick={onRedo}
            aria-label={t('Redo')}
            title={t('Redo (Ctrl+Shift+Z)')}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3.5 13.5 7 10 10.5M13.5 7H7.3a3.4 3.4 0 0 0 0 6.8h2.2" />
            </svg>
          </button>
          <button
            type="button"
            className={`editor-icon-button editor-icon-button--primary ${saveState === 'dirty' ? 'is-dirty' : ''}`.trim()}
            disabled={saveState === 'saving' || libraryBusy || exportActionBusy || !canSaveProject}
            onClick={onSaveProject}
            aria-label={saveActionLabel}
            title={saveActionLabel}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 2.8h8L13.2 5v8.2H3zM5.4 2.8v3.4h5.2V2.8M5.2 13.2V9.4h5.6v3.8" />
            </svg>
            {saveState === 'dirty' ? <span className="editor-icon-button__dot" aria-hidden="true" /> : null}
          </button>
          <button
            type="button"
            className="editor-icon-button"
            disabled={libraryBusy || exportActionBusy}
            onClick={onToggleExportCenter}
            aria-label={exportActionLabel}
            title={exportActionLabel}
            aria-expanded={exportActionLabel === t('Close export')}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 10.2V2.4M4.6 5.8 8 2.4l3.4 3.4M3.2 10.2v2.6a.8.8 0 0 0 .8.8h8a.8.8 0 0 0 .8-.8v-2.6" />
            </svg>
          </button>
          <button
            type="button"
            className="editor-icon-button"
            disabled={!projectRecord || Boolean(projectActionBusy) || !session}
            onClick={onDuplicateProject}
            aria-label={projectActionBusy === 'duplicate' ? t('Duplicating…') : t('Duplicate')}
            title={projectActionBusy === 'duplicate' ? t('Duplicating…') : t('Duplicate')}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M5.2 5.2h7.6v7.6H5.2zM3.2 10.8V3.2h7.6" />
            </svg>
          </button>
          <button
            type="button"
            className="editor-icon-button"
            disabled={!projectRecord || Boolean(projectActionBusy) || projectMutationLocked}
            onClick={onArchiveToggle}
            aria-label={archiveActionLabel}
            title={archiveActionLabel}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2.2 5.4h11.6v7.4H2.2zM2.2 5.4 3.8 3h8.4l1.6 2.4M6 8.2h4" />
            </svg>
          </button>
        </div>

        <div className="editor-primary-row">
          <button
            type="button"
            className="button button--primary button--small editor-project-action ai-arrange-button"
            onClick={onOpenAiArrange}
            title={t('Choose photos and let AI build a complete layout.')}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 1.8l1.2 3.3 3.3 1.2-3.3 1.2L8 10.8 6.8 7.5 3.5 6.3l3.3-1.2L8 1.8Z" />
              <path d="M12.6 9.4l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
            </svg>
            {t('Lay out with AI')}
          </button>
          <button
            type="button"
            className="editor-icon-button"
            disabled={libraryBusy || exportActionBusy}
            onClick={onStartNewDraft}
            aria-label={t('New draft')}
            title={t('New draft')}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M9 2.4H3.6v11.2h8.8V5.8L9 2.4ZM9 2.4v3.4h3.4M8 8.2v4M6 10.2h4" />
            </svg>
          </button>
          <button
            type="button"
            className="editor-icon-button"
            disabled={!session || templateSaveBusy}
            onClick={onToggleTemplateComposer}
            aria-label={t('Save as template')}
            title={t('Save as template')}
            aria-expanded={templateComposerOpen}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.6 2.6h8.8v10.8L8 10.6l-4.4 2.8zM8 4.6v3.2M6.4 6.2h3.2" />
            </svg>
          </button>
        </div>
        <section className="editor-panel__section">
          <div className="editor-panel__toolbar">
            <span className="editor-panel__label">{t('Share project')}</span>
            <span className="panel-tag">{!projectRecord ? t('Save first') : projectRecord.share.enabled ? t('Live') : t('Off')}</span>
          </div>
          <label className="field">
            <span>{t('Share link')}</span>
            <input
              readOnly
              value={!projectRecord || !projectRecord.share.enabled ? '' : publicShareUrl}
              placeholder={
                !projectRecord
                  ? t('Save this folio first to create a public viewer link.')
                  : projectRecord.share.enabled
                    ? undefined
                    : projectMutationLocked
                      ? t('Duplicate this legacy folio into your account before enabling public sharing.')
                      : t('Enable sharing to publish a read-only viewer.')
              }
            />
          </label>
          <p className="panel-note">
            {!projectRecord
              ? t('The public link is created automatically after you save this folio.')
              : projectRecord.share.enabled
                ? t('The public route opens a read-only folio viewer with swipe, drag, keyboard, and button navigation.')
                : projectMutationLocked
                  ? t('Legacy ownerless folios can still be read, but only an owned duplicate can publish or change sharing.')
                  : t('The public link is off. Enable it when this folio should be viewable outside the editor.')}
          </p>
          {!projectRecord ? null : projectRecord.share.enabled ? (
            <div className="editor-icon-toolbar editor-icon-toolbar--share" role="group" aria-label={t('Share actions')}>
              <button
                type="button"
                className="editor-icon-button editor-icon-button--primary"
                disabled={shareBusy}
                onClick={onOpenSharedProject}
                aria-label={t('Open shared')}
                title={t('Open shared')}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M9.2 3h3.8v3.8M13 3 7.4 8.6M11.8 9.2v3.2a.6.6 0 0 1-.6.6H3.6a.6.6 0 0 1-.6-.6V4.8a.6.6 0 0 1 .6-.6h3.2" />
                </svg>
              </button>
              <button
                type="button"
                className="editor-icon-button"
                disabled={shareBusy}
                onClick={onCopyPublicShareLink}
                aria-label={publicShareCopyLabel}
                title={publicShareCopyLabel}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M5.6 5.6h6.8v6.8H5.6zM3.6 10.4V3.6h6.8" />
                </svg>
              </button>
              <button
                type="button"
                className="editor-icon-button"
                disabled={shareBusy || projectMutationLocked}
                onClick={onRegenerateShare}
                aria-label={shareBusy ? t('Updating…') : t('Regenerate')}
                title={shareBusy ? t('Updating…') : t('Regenerate')}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M13 8a5 5 0 1 1-1.5-3.5M13 3v4H9" />
                </svg>
              </button>
              <button
                type="button"
                className="editor-icon-button"
                disabled={shareBusy || projectMutationLocked}
                onClick={onDisableShare}
                aria-label={shareBusy ? t('Updating…') : t('Disable')}
                title={shareBusy ? t('Updating…') : t('Disable')}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M8 2.4v5.2M4.7 4.6a4.6 4.6 0 1 0 6.6 0" />
                </svg>
              </button>
            </div>
          ) : (
            <button type="button" className="button button--primary button--small" disabled={shareBusy || projectMutationLocked} onClick={onEnableShare}>
              {shareBusy ? t('Sharing…') : t('Share project')}
            </button>
          )}
        </section>

        {templateComposerOpen ? (
          <section className="editor-panel__section">
            <div className="editor-panel__toolbar">
              <span className="editor-panel__label">{t('Template')}</span>
              <span className="panel-tag">{templateSaveKind === 'page' ? t('Page template') : t('Project template')}</span>
            </div>
            <p className="panel-note">
              {t('Save the current page or the whole folio as a reusable template. Page templates change one page at a time; project templates keep the full sequence.')}</p>
            <div className="template-grid template-grid--compact">
              <button
                type="button"
                className={`template-card ${templateSaveKind === 'page' ? 'is-active' : ''}`}
                onClick={() => onTemplateSaveKindChange('page')}
              >
                <span>{t('Page template')}</span>
                <strong>{selectedPagePositionLabel}</strong>
                <small>{t('Save the selected page layout, theme, and optional copy.')}</small>
              </button>
              <button
                type="button"
                className={`template-card ${templateSaveKind === 'project' ? 'is-active' : ''}`}
                onClick={() => onTemplateSaveKindChange('project')}
              >
                <span>{t('Project template')}</span>
                <strong>{sequenceLabel}</strong>
                <small>{t('Save the current page order and reusable folio structure.')}</small>
              </button>
            </div>
            <label className="field">
              <span>{t('Template name')}</span>
              <input value={templateSaveName} onChange={(event) => onTemplateSaveNameChange(event.target.value)} />
            </label>
            <label className="field">
              <span>{t('Description')}</span>
              <textarea rows={3} value={templateSaveDescription} onChange={(event) => onTemplateSaveDescriptionChange(event.target.value)} />
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={templatePreserveCopy}
                onChange={(event) => onTemplatePreserveCopyChange(event.target.checked)}
              />
              <span>{t('Preserve the current folio title and page copy inside the template.')}</span>
            </label>
            <div className="editor-panel__actions editor-panel__actions--tight">
              <button
                type="button"
                className="button button--primary button--small"
                disabled={!session || templateSaveBusy}
                onClick={onSaveCurrentProjectAsTemplate}
              >
                {templateSaveActionLabel}
              </button>
              <button type="button" className="button button--ghost button--small" onClick={onCloseTemplateComposer}>
                {t('Cancel')}</button>
            </div>
          </section>
        ) : null}

        <details
          className="editor-project-details"
          open={projectDetailsOpen}
          onToggle={(event) => setProjectDetailsOpen(event.currentTarget.open)}
        >
          <summary>
            <span>{t('Folio details')}</span>
            <small>{project.title}</small>
          </summary>
          <section className="editor-panel__section">
          <label className="field">
            <span>{t('Subtitle')}</span>
            <textarea
              rows={2}
              maxLength={PROJECT_SUBTITLE_LIMIT}
              value={project.subtitle}
              onChange={(event) => updateProject((current) => ({ ...current, subtitle: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>{t('Folio mark')}</span>
            <input
              maxLength={PROJECT_ISSUE_LIMIT}
              value={project.issue}
              onChange={(event) => updateProject((current) => ({ ...current, issue: event.target.value }))}
            />
          </label>
        </section>

        <section className="editor-panel__section">
          <div className="editor-panel__toolbar">
            <span className="editor-panel__label">{t('Image corners')}</span>
            <span className="panel-tag">{frameRadiusLabel}</span>
          </div>
          <div className="segmented-control segmented-control--three" role="group" aria-label={t('Image corner presets')}>
            <button type="button" className={project.frameRadius <= 2 ? 'is-active' : ''} onClick={() => updateFrameRadius(0)}>
              {t('Square')}</button>
            <button
              type="button"
              className={project.frameRadius > 2 && project.frameRadius < frameRadiusRoundThreshold ? 'is-active' : ''}
              onClick={() => updateFrameRadius(PROJECT_FRAME_RADIUS_DEFAULT)}
            >
              {t('Soft')}</button>
            <button
              type="button"
              className={project.frameRadius >= frameRadiusRoundThreshold ? 'is-active' : ''}
              onClick={() => updateFrameRadius(PROJECT_FRAME_RADIUS_MAX)}
            >
              {t('Round')}</button>
          </div>
          <label className="field field--range">
            <span>{t('Corner radius')}</span>
            <input
              type="range"
              min={PROJECT_FRAME_RADIUS_MIN}
              max={PROJECT_FRAME_RADIUS_MAX}
              step="1"
              value={project.frameRadius}
              onChange={(event) => updateFrameRadius(Number(event.target.value))}
            />
          </label>
        </section>
        </details>
      </section>
    </aside>
  );
}
