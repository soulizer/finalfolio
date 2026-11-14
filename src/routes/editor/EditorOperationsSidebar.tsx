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
type CopyState = 'idle' | 'copied' | 'error';

type EditorOperationsSidebarProps = {
  archiveActionLabel: string;
  authReady: boolean;
  canSaveProject: boolean;
  copyButtonLabel: string;
  copyState: CopyState;
  exportActionBusy: boolean;
  exportActionLabel: string;
  guestUploadTransferBusy: boolean;
  hasGuestUploadAssets: boolean;
  libraryBusy: boolean;
  onArchiveToggle: () => void;
  onCloseTemplateComposer: () => void;
  onCopyLink: () => void;
  onCopyPublicShareLink: () => void;
  onDisableShare: () => void;
  onDuplicateProject: () => void;
  onEnableShare: () => void;
  onOpenAccountPage: () => void;
  onOpenAdminPage: () => void;
  onOpenSharedProject: () => void;
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
  project: ProjectState;
  projectActionBusy: ProjectActionBusy;
  projectModeTag: string;
  projectMutationLocked: boolean;
  projectRecord: ProjectRecord | null;
  publicShareCopyLabel: string;
  publicShareUrl: string;
  saveActionLabel: string;
  saveState: SaveState;
  selectedPagePositionLabel: string;
  sequenceLabel: string;
  session: UserSession | null;
  shareBusy: boolean;
  shareUrl: string;
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
  canSaveProject,
  copyButtonLabel,
  copyState,
  exportActionBusy,
  exportActionLabel,
  guestUploadTransferBusy,
  hasGuestUploadAssets,
  libraryBusy,
  onArchiveToggle,
  onCloseTemplateComposer,
  onCopyLink,
  onCopyPublicShareLink,
  onDisableShare,
  onDuplicateProject,
  onEnableShare,
  onOpenAccountPage,
  onOpenAdminPage,
  onOpenSharedProject,
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
  project,
  projectActionBusy,
  projectModeTag,
  projectMutationLocked,
  projectRecord,
  publicShareCopyLabel,
  publicShareUrl,
  saveActionLabel,
  saveState,
  selectedPagePositionLabel,
  sequenceLabel,
  session,
  shareBusy,
  shareUrl,
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
  const frameRadiusRoundThreshold = Math.max(PROJECT_FRAME_RADIUS_DEFAULT + 10, PROJECT_FRAME_RADIUS_MAX - 12);
  const frameRadiusLabel =
    project.frameRadius <= 2 ? 'Square' : project.frameRadius >= frameRadiusRoundThreshold ? 'Round' : `${project.frameRadius}px`;

  return (
    <aside className="editor-sidebar editor-sidebar--operations">
      <section className="editor-panel editor-panel--account">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">Account</p>
            <h2>{authReady ? (session ? getUserPrimaryIdentity(session) : 'Sign in required') : 'Account'}</h2>
          </div>
          <span className="panel-tag">{authReady ? (session ? `${session.role}` : 'Guest') : 'Session'}</span>
        </div>
        <p className="panel-note">
          {!authReady
            ? 'Keeping the current workspace warm while the shared session finishes loading.'
            : session
              ? hasGuestUploadAssets
                ? guestUploadTransferBusy
                  ? 'Recovered local photos are being attached to this account now. Saving will unlock as soon as that finishes.'
                  : 'This account can save links and keep uploads. Recovered local photos below stay visible and will be attached to this account before saving.'
                : 'Uploads, saved project links, and deletion governance now stay tied to this account.'
              : 'Guest mode can stage uploads locally on this device and export, but saved or shareable links still require sign-in.'}
        </p>
        <div className="editor-panel__actions editor-panel__actions--tight">
          <button type="button" className="button button--ghost button--small" onClick={onOpenAccountPage}>
            {session ? 'My Account' : 'Sign in'}
          </button>
          {session?.role === 'admin' ? (
            <button type="button" className="button button--ghost button--small" onClick={onOpenAdminPage}>
              Open admin
            </button>
          ) : null}
        </div>
      </section>

      <section className="editor-panel editor-panel--project-actions">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">Project</p>
            <h2>{project.issue}</h2>
          </div>
          <span className="panel-tag">{projectModeTag}</span>
        </div>
        <p className="panel-note panel-note--status">{statusText}</p>
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
            {projectActionBusy === 'duplicate' ? 'Duplicating…' : 'Duplicate'}
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
            New
          </button>
          <button
            type="button"
            className="button button--ghost button--small editor-project-action editor-project-action--wide"
            disabled={!session || templateSaveBusy}
            onClick={onToggleTemplateComposer}
          >
            Save as template
          </button>
        </div>
        <div className="editor-project-url">
          <input
            aria-label="Project URL"
            className="editor-project-bar__input"
            readOnly
            value={projectRecord ? shareUrl : 'Create a link to save this folio.'}
          />
          <button
            type="button"
            className={`editor-icon-button ${copyState === 'copied' ? 'is-active' : ''} ${copyState === 'error' ? 'is-error' : ''}`.trim()}
            disabled={!projectRecord}
            onClick={onCopyLink}
            aria-label={copyButtonLabel}
            title={copyButtonLabel}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <rect x="5" y="3" width="8" height="10" rx="1.5" />
              <path d="M3.5 11V5.5C3.5 4.67 4.17 4 5 4" />
            </svg>
          </button>
        </div>

        <section className="editor-panel__section">
          <div className="editor-section-heading">
            <div>
              <p className="eyebrow">Share project</p>
              <h3>Public viewer</h3>
            </div>
            <span className="panel-tag">{!projectRecord ? 'Save first' : projectRecord.share.enabled ? 'Live' : 'Off'}</span>
          </div>
          <label className="field">
            <span>Share link</span>
            <input
              readOnly
              value={
                !projectRecord
                  ? 'Save this folio first to create a public viewer link.'
                  : projectRecord.share.enabled
                    ? publicShareUrl
                    : projectMutationLocked
                      ? 'Duplicate this legacy folio into your account before enabling public sharing.'
                      : 'Enable sharing to publish a read-only viewer.'
              }
            />
          </label>
          <p className="panel-note">
            {projectRecord?.share.enabled
              ? 'The public route opens a read-only folio viewer with swipe, drag, keyboard, and button navigation.'
              : projectMutationLocked
                ? 'Legacy ownerless folios can still be read, but only an owned duplicate can publish or change sharing.'
                : 'The saved editor URL remains private. Enable sharing when this folio should be viewable outside the editor.'}
          </p>
          <div className="editor-panel__actions editor-panel__actions--tight">
            {!projectRecord ? (
              <button type="button" className="button button--ghost button--small" disabled>
                Save to share
              </button>
            ) : projectRecord.share.enabled ? (
              <>
                <button type="button" className="button button--primary button--small" disabled={shareBusy} onClick={onOpenSharedProject}>
                  Open shared
                </button>
                <button type="button" className="button button--ghost button--small" disabled={shareBusy} onClick={onCopyPublicShareLink}>
                  {publicShareCopyLabel}
                </button>
                <button type="button" className="button button--ghost button--small" disabled={shareBusy || projectMutationLocked} onClick={onRegenerateShare}>
                  {shareBusy ? 'Updating…' : 'Regenerate'}
                </button>
                <button type="button" className="button button--ghost button--small" disabled={shareBusy || projectMutationLocked} onClick={onDisableShare}>
                  {shareBusy ? 'Updating…' : 'Disable'}
                </button>
              </>
            ) : (
              <button type="button" className="button button--primary button--small" disabled={shareBusy || projectMutationLocked} onClick={onEnableShare}>
                {shareBusy ? 'Sharing…' : 'Share project'}
              </button>
            )}
          </div>
        </section>

        {templateComposerOpen ? (
          <section className="editor-panel__section">
            <div className="editor-section-heading">
              <div>
                <p className="eyebrow">Template</p>
                <h3>Save to My templates</h3>
              </div>
              <span className="panel-tag">{templateSaveKind === 'page' ? 'Page template' : 'Project template'}</span>
            </div>
            <p className="panel-note">
              Save the current page or the whole folio as a reusable template. Page templates change one page at a time; project templates keep the full sequence.
            </p>
            <div className="template-grid template-grid--compact">
              <button
                type="button"
                className={`template-card ${templateSaveKind === 'page' ? 'is-active' : ''}`}
                onClick={() => onTemplateSaveKindChange('page')}
              >
                <span>Page template</span>
                <strong>{selectedPagePositionLabel}</strong>
                <small>Save the selected page layout, theme, and optional copy.</small>
              </button>
              <button
                type="button"
                className={`template-card ${templateSaveKind === 'project' ? 'is-active' : ''}`}
                onClick={() => onTemplateSaveKindChange('project')}
              >
                <span>Project template</span>
                <strong>{sequenceLabel}</strong>
                <small>Save the current page order and reusable folio structure.</small>
              </button>
            </div>
            <label className="field">
              <span>Template name</span>
              <input value={templateSaveName} onChange={(event) => onTemplateSaveNameChange(event.target.value)} />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea rows={3} value={templateSaveDescription} onChange={(event) => onTemplateSaveDescriptionChange(event.target.value)} />
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={templatePreserveCopy}
                onChange={(event) => onTemplatePreserveCopyChange(event.target.checked)}
              />
              <span>Preserve the current folio title and page copy inside the template.</span>
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
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        <section className="editor-panel__section">
          <div className="editor-section-heading">
            <div>
              <p className="eyebrow">Project info</p>
              <h3>Folio details</h3>
            </div>
          </div>
          <label className="field">
            <span>Title</span>
            <input
              maxLength={PROJECT_TITLE_LIMIT}
              value={project.title}
              onChange={(event) => updateProject((current) => ({ ...current, title: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Subtitle</span>
            <textarea
              rows={2}
              maxLength={PROJECT_SUBTITLE_LIMIT}
              value={project.subtitle}
              onChange={(event) => updateProject((current) => ({ ...current, subtitle: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Folio mark</span>
            <input
              maxLength={PROJECT_ISSUE_LIMIT}
              value={project.issue}
              onChange={(event) => updateProject((current) => ({ ...current, issue: event.target.value }))}
            />
          </label>
        </section>

        <section className="editor-panel__section">
          <div className="editor-section-heading">
            <div>
              <p className="eyebrow">Folio style</p>
              <h3>Image corners</h3>
            </div>
            <span className="panel-tag">{frameRadiusLabel}</span>
          </div>
          <div className="segmented-control segmented-control--three" role="group" aria-label="Image corner presets">
            <button type="button" className={project.frameRadius <= 2 ? 'is-active' : ''} onClick={() => updateFrameRadius(0)}>
              Square
            </button>
            <button
              type="button"
              className={project.frameRadius > 2 && project.frameRadius < frameRadiusRoundThreshold ? 'is-active' : ''}
              onClick={() => updateFrameRadius(PROJECT_FRAME_RADIUS_DEFAULT)}
            >
              Soft
            </button>
            <button
              type="button"
              className={project.frameRadius >= frameRadiusRoundThreshold ? 'is-active' : ''}
              onClick={() => updateFrameRadius(PROJECT_FRAME_RADIUS_MAX)}
            >
              Round
            </button>
          </div>
          <label className="field field--range">
            <span>Corner radius</span>
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
      </section>
    </aside>
  );
}
