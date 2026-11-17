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
        <div className="editor-history-row" role="group" aria-label={t('Edit history')}>
          <button
            type="button"
            className="button button--ghost button--small editor-history-button"
            disabled={!canUndo}
            onClick={onUndo}
            title={t('Undo (Ctrl+Z)')}
          >
            {t('Undo')}</button>
          <button
            type="button"
            className="button button--ghost button--small editor-history-button"
            disabled={!canRedo}
            onClick={onRedo}
            title={t('Redo (Ctrl+Shift+Z)')}
          >
            {t('Redo')}</button>
        </div>
        <div className="editor-panel__actions editor-panel__actions--tight">
          <button
            type="button"
            className="button button--primary button--small editor-project-action"
            disabled={saveState === 'saving' || libraryBusy || exportActionBusy || !canSaveProject}
            onClick={onSaveProject}
          >
            {saveActionLabel}
          </button>
          <button
            type="button"
            className="button button--ghost button--small editor-project-action"
            disabled={libraryBusy || exportActionBusy}
            onClick={onToggleExportCenter}
          >
            {exportActionLabel}
          </button>
          <button
            type="button"
            className="button button--ghost button--small editor-project-action"
            disabled={!projectRecord || Boolean(projectActionBusy) || !session}
            onClick={onDuplicateProject}
          >
            {projectActionBusy === 'duplicate' ? t('Duplicating…') : t('Duplicate')}
          </button>
          <button
            type="button"
            className="button button--ghost button--small editor-project-action"
            disabled={!projectRecord || Boolean(projectActionBusy) || projectMutationLocked}
            onClick={onArchiveToggle}
          >
            {archiveActionLabel}
          </button>
          <button
            type="button"
            className="button button--ghost button--small editor-project-action editor-project-action--wide"
            disabled={libraryBusy || exportActionBusy}
            onClick={onStartNewDraft}
          >
            {t('New draft')}</button>
          <button
            type="button"
            className="button button--ghost button--small editor-project-action editor-project-action--wide"
            disabled={!session || templateSaveBusy}
            onClick={onToggleTemplateComposer}
          >
            {t('Save as template')}</button>
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
            {projectRecord?.share.enabled
              ? t('The public route opens a read-only folio viewer with swipe, drag, keyboard, and button navigation.')
              : projectMutationLocked
                ? t('Legacy ownerless folios can still be read, but only an owned duplicate can publish or change sharing.')
                : t('The public link is off. Enable it when this folio should be viewable outside the editor.')}
          </p>
          <div className="editor-panel__actions editor-panel__actions--tight">
            {!projectRecord ? null : projectRecord.share.enabled ? (
              <>
                <button type="button" className="button button--primary button--small" disabled={shareBusy} onClick={onOpenSharedProject}>
                  {t('Open shared')}</button>
                <button type="button" className="button button--ghost button--small" disabled={shareBusy} onClick={onCopyPublicShareLink}>
                  {publicShareCopyLabel}
                </button>
                <button type="button" className="button button--ghost button--small" disabled={shareBusy || projectMutationLocked} onClick={onRegenerateShare}>
                  {shareBusy ? t('Updating…') : t('Regenerate')}
                </button>
                <button type="button" className="button button--ghost button--small" disabled={shareBusy || projectMutationLocked} onClick={onDisableShare}>
                  {shareBusy ? t('Updating…') : t('Disable')}
                </button>
              </>
            ) : (
              <button type="button" className="button button--primary button--small" disabled={shareBusy || projectMutationLocked} onClick={onEnableShare}>
                {shareBusy ? t('Sharing…') : t('Share project')}
              </button>
            )}
          </div>
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
