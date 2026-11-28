import { useState } from 'react';
import { useLocale, useT } from '../../i18n';
import { DEFAULT_PROJECT_FONTS, FONT_OPTIONS, getFontOption, normalizeProjectFonts } from '../../editor/fonts';
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
import { PanelCollapseToggle } from '../../ui/PanelCollapseToggle';
import { EditorSubsection } from '../../ui/EditorSubsection';
import { ExperimentalBadge } from '../../ui/ExperimentalBadge';

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
  const { locale } = useLocale();
  const fontOptions = locale === 'zh' ? FONT_OPTIONS.filter((font) => font.chinese) : FONT_OPTIONS;
  const [loadingFontRole, setLoadingFontRole] = useState<string | null>(null);

  async function ensureFontReady(role: string, fontId: string) {
    if (typeof document === 'undefined' || !('fonts' in document)) {
      return;
    }
    const family = getFontOption(fontId).stack.split(',')[0]?.trim();
    if (!family || family.startsWith('var(')) {
      return;
    }
    if (document.fonts.check(`16px ${family}`)) {
      return;
    }
    setLoadingFontRole(role);
    try {
      await document.fonts.load(`16px ${family}`);
    } catch {
      // A missing font falls back to the next family in the stack.
    } finally {
      setLoadingFontRole((current) => (current === role ? null : current));
    }
  }

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
                <PanelCollapseToggle />
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
                : t('Your photos, project links and deletion records stay with this account.')
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
                <PanelCollapseToggle />
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
        <div className="editor-font-fields" role="group" aria-label={t('Typography')}>
          <span className="editor-stack-field__label">{t('Typography')}</span>
          {(['title', 'deck', 'caption', 'body'] as const).map((role) => (
            <label className="field" key={role}>
              <span>
                {t(
                  role === 'title'
                    ? 'Title font'
                    : role === 'deck'
                      ? 'Deck font'
                      : role === 'caption'
                        ? 'Caption font'
                        : 'Body font',
                )}
              </span>
              <select
                value={normalizeProjectFonts(project.fonts)[role] ?? DEFAULT_PROJECT_FONTS[role]}
                onChange={(event) => {
                  void ensureFontReady(role, event.target.value);
                  updateProject((current) => ({
                    ...current,
                    fonts: { ...normalizeProjectFonts(current.fonts), [role]: event.target.value },
                  }));
                }}
              >
                {fontOptions.map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {loadingFontRole ? (
          <p className="panel-note editor-font-loading" role="status">
            {t('Loading font…')}
          </p>
        ) : null}
        <p className="panel-note panel-note--status">{t(statusText)}</p>
        {saveConflict ? (
          <div className="editor-conflict-notice" role="alert">
            <p>{saveConflict}</p>
            <button type="button" className="button button--primary button--small" onClick={onReloadLatest}>
              {t('Reload latest')}</button>
          </div>
        ) : null}
        <div className="editor-project-action-rows" role="group" aria-label={t('Project actions')}>
          <div className="editor-button-grid editor-button-grid--two" role="group" aria-label={t('History')}>
            <button
              type="button"
              className="button button--ghost button--small"
              disabled={!canUndo}
              onClick={onUndo}
              title={t('Undo (Ctrl+Z)')}
            >
              {t('Undo')}
            </button>
            <button
              type="button"
              className="button button--ghost button--small"
              disabled={!canRedo}
              onClick={onRedo}
              title={t('Redo (Ctrl+Shift+Z)')}
            >
              {t('Redo')}
            </button>
          </div>
          <div className="editor-button-grid editor-button-grid--two" role="group" aria-label={t('Save and export')}>
            <button
              type="button"
              className="button button--primary button--small"
              disabled={saveState === 'saving' || libraryBusy || exportActionBusy || !canSaveProject}
              onClick={onSaveProject}
            >
              {saveActionLabel}
            </button>
            <button
              type="button"
              className="button button--ghost button--small"
              disabled={libraryBusy || exportActionBusy}
              onClick={onToggleExportCenter}
              aria-expanded={exportActionLabel === t('Close export')}
            >
              {exportActionLabel}
            </button>
          </div>
          <div className="editor-button-grid editor-button-grid--two" role="group" aria-label={t('Duplicate and archive')}>
            <button
              type="button"
              className="button button--ghost button--small"
              disabled={!projectRecord || Boolean(projectActionBusy) || !session}
              onClick={onDuplicateProject}
            >
              {projectActionBusy === 'duplicate' ? t('Duplicating…') : t('Duplicate')}
            </button>
            <button
              type="button"
              className="button button--ghost button--small"
              disabled={!projectRecord || Boolean(projectActionBusy) || projectMutationLocked}
              onClick={onArchiveToggle}
            >
              {archiveActionLabel}
            </button>
          </div>
        </div>

        <button
          type="button"
          className="button button--primary button--small editor-project-action editor-project-action--ai"
          onClick={onOpenAiArrange}
        >
          {t('Lay out with AI')}
        </button>
        <p className="panel-note editor-project-action__hint">
          <ExperimentalBadge /> {t('Choose photos and let AI build a complete layout.')}
        </p>

        <div className="editor-button-grid editor-button-grid--two" role="group" aria-label={t('Project tools')}>
          <button
            type="button"
            className="button button--ghost button--small"
            disabled={libraryBusy || exportActionBusy}
            onClick={onStartNewDraft}
          >
            {t('New draft')}
          </button>
          <button
            type="button"
            className="button button--ghost button--small"
            disabled={!session || templateSaveBusy}
            onClick={onToggleTemplateComposer}
            aria-expanded={templateComposerOpen}
          >
            {t('Save template')}
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
                  ? t('Save to create a link.')
                  : projectRecord.share.enabled
                    ? undefined
                    : projectMutationLocked
                      ? t('Duplicate to enable sharing.')
                      : t('Enable sharing to publish a read-only viewer.')
              }
            />
          </label>
          <p className="panel-note">
            {projectRecord?.share.enabled
              ? t('The public route opens a read-only folio viewer with swipe, drag, keyboard, and button navigation.')
              : projectMutationLocked
                ? t('Legacy ownerless folios can still be read, but only an owned duplicate can publish or change sharing.')
                : null}
          </p>
          {!projectRecord ? null : projectRecord.share.enabled ? (
            <div className="editor-button-grid editor-button-grid--two" role="group" aria-label={t('Share actions')}>
              <button
                type="button"
                className="button button--primary button--small"
                disabled={shareBusy}
                onClick={onOpenSharedProject}
                title={t('Open shared')}
              >
                {t('Open shared')}
              </button>
              <button
                type="button"
                className="button button--ghost button--small"
                disabled={shareBusy}
                onClick={onCopyPublicShareLink}
              >
                {publicShareCopyLabel}
              </button>
              <button
                type="button"
                className="button button--ghost button--small"
                disabled={shareBusy || projectMutationLocked}
                onClick={onRegenerateShare}
              >
                {shareBusy ? t('Updating…') : t('Regenerate')}
              </button>
              <button
                type="button"
                className="button button--ghost button--small"
                disabled={shareBusy || projectMutationLocked}
                onClick={onDisableShare}
              >
                {shareBusy ? t('Updating…') : t('Disable')}
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

        <EditorSubsection
          label={t('Folio details')}
          meta={project.issue}
          open={projectDetailsOpen}
          onToggle={setProjectDetailsOpen}
        >
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
        </EditorSubsection>

        <EditorSubsection className="editor-corners-section" label={t('Image corners')} meta={frameRadiusLabel}>
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
        </EditorSubsection>
      </section>
    </aside>
  );
}
