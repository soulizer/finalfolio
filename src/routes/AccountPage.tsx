
import { useT } from '../i18n';
import { confirmAction } from '../ui/confirm';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingStack } from '../components/LoadingStack';
import { SiteLegalFooter } from '../components/SiteLegalFooter';
import { SitePageHeader } from '../components/SitePageHeader';
import { TransientNotice } from '../components/TransientNotice';
import { getConfirmationMessage } from '../editor/confirmations';
import {
  type AccountUploadListItem,
  createProjectFromUserTemplate,
  deleteOwnedAsset,
  deleteProject,
  deleteUserTemplate,
  disableProjectShare,
  duplicateProject,
  duplicateUserTemplate,
  enableProjectShare,
  logoutUser,
  patchProject,
  retryOwnedAssetObjectStorageSync,
  updateAccountPassword,
  updateAccountPreferences,
  updateAccountProfile,
  updateUserTemplate,
} from '../editor/api';
import { broadcastDraftAssetRemoval, removeAssetsFromDraft } from '../editor/storage';
import type { ProjectRecord, UserTemplateRecord } from '../editor/types';
import { buildTermsPath } from '../legal/terms';
import { useSession } from '../session';
import { useDelayedVisibility } from '../useDelayedVisibility';
import { AccountConsoleHeader } from './account/AccountConsoleHeader';
import { AccountOverviewPanel } from './account/AccountOverviewPanel';
import { AccountPreferencesPanel } from './account/AccountPreferencesPanel';
import { AccountProjectsPanel } from './account/AccountProjectsPanel';
import { AccountSettingsPanel } from './account/AccountSettingsPanel';
import { AccountTemplatesPanel } from './account/AccountTemplatesPanel';
import { AccountUploadsPanel } from './account/AccountUploadsPanel';
import { buildAbsoluteUrl } from './account/accountFormatting';
import { ACCOUNT_SECTIONS, normalizeAccountSection, type AccountSectionKey } from './account/accountSections';
import { useAccountWorkspace } from './account/useAccountWorkspace';

export function AccountPage() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = normalizeAccountSection(searchParams.get('section'));
  const [usernameDraft, setUsernameDraft] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [preferencesBusy, setPreferencesBusy] = useState(false);
  const [projectBusyId, setProjectBusyId] = useState<string | null>(null);
  const [projectBusyAction, setProjectBusyAction] = useState<'delete' | 'share' | 'rename' | 'duplicate' | 'archive' | null>(null);
  const [projectEditingId, setProjectEditingId] = useState<string | null>(null);
  const [projectTitleDraft, setProjectTitleDraft] = useState('');
  const [projectIssueDraft, setProjectIssueDraft] = useState('');
  const [uploadBusyId, setUploadBusyId] = useState<string | null>(null);
  const [templateBusyId, setTemplateBusyId] = useState<string | null>(null);
  const [templateEditingId, setTemplateEditingId] = useState<string | null>(null);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [templateDescriptionDraft, setTemplateDescriptionDraft] = useState('');
  const { user: session, ready: sessionReady, refreshSession, setSessionUser } = useSession();
  const {
    activity,
    appendTemplateRecord,
    busy,
    clearWorkspace,
    filteredProjects,
    filteredTemplates,
    filteredUploads,
    loadWorkspace,
    preferences,
    projectSearch,
    projectVisibilityFilter,
    replaceProjectRecord,
    replaceTemplateRecord,
    selectedProject,
    selectedProjectAssetsById,
    selectedUpload,
    setPreferences,
    setProjectSearch,
    setProjectVisibilityFilter,
    setSelectedProjectId,
    setSelectedUploadAssetId,
    setTemplateSearch,
    setTemplates,
    setUploadSearch,
    summary,
    templateSearch,
    templates,
    uploadSearch,
  } = useAccountWorkspace({
    session,
    setMessage,
    setProjectEditingId,
    setProjectIssueDraft,
    setProjectTitleDraft,
    setTemplateDescriptionDraft,
    setTemplateEditingId,
    setTemplateNameDraft,
  });

  function openRoute(path: string, { replace = false }: { replace?: boolean } = {}) {
    navigate(path, replace ? { replace: true } : undefined);
  }

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (session?.needsTermsAcceptance) {
      navigate(buildTermsPath('/account'), { replace: true });
      return;
    }

    if (!session) {
      clearWorkspace();
      setUsernameDraft('');
      return;
    }

    setUsernameDraft(session.username ?? '');
    void loadWorkspace(session);
  }, [clearWorkspace, loadWorkspace, navigate, session, sessionReady]);

  async function refreshAll() {
    setMessage(null);

    const currentUser = await refreshSession();
    if (currentUser?.needsTermsAcceptance) {
      navigate(buildTermsPath('/account'), { replace: true });
      return;
    }

    if (!currentUser) {
      clearWorkspace();
      setUsernameDraft('');
      return;
    }

    setUsernameDraft(currentUser.username ?? '');
    await loadWorkspace(currentUser);
  }

  function selectSection(section: AccountSectionKey) {
    const nextParams = new URLSearchParams(searchParams);
    if (section === 'overview') {
      nextParams.delete('section');
    } else {
      nextParams.set('section', section);
    }
    setSearchParams(nextParams, { replace: true });
  }

  async function handleLogout() {
    await logoutUser();
    setSessionUser(null);
    clearWorkspace();
    setMessage(t('Signed out.'));
  }

  async function handleDeleteProject(projectId: string) {
    const confirmed = await confirmAction({
      title: t('Delete this folio?'),
      body: `${getConfirmationMessage('deleteProject')} Photos that no other folio uses are removed too.`,
      confirmLabel: t('Delete folio'),
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setProjectBusyId(projectId);
    setProjectBusyAction('delete');
    setMessage(null);

    try {
      await deleteProject(projectId);
      if (projectEditingId === projectId) {
        stopEditingProject();
      }
      await refreshAll();
      setMessage(t('Project deleted.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to delete project.'));
    } finally {
      setProjectBusyId(null);
      setProjectBusyAction(null);
    }
  }

  function startEditingTemplate(template: UserTemplateRecord) {
    setTemplateEditingId(template.id);
    setTemplateNameDraft(template.name);
    setTemplateDescriptionDraft(template.description);
  }

  function stopEditingTemplate() {
    setTemplateEditingId(null);
    setTemplateNameDraft('');
    setTemplateDescriptionDraft('');
  }

  function startEditingProject(project: ProjectRecord) {
    setSelectedProjectId(project.id);
    setProjectEditingId(project.id);
    setProjectTitleDraft(project.project.title);
    setProjectIssueDraft(project.project.issue);
  }

  function stopEditingProject() {
    setProjectEditingId(null);
    setProjectTitleDraft('');
    setProjectIssueDraft('');
  }

  async function handleSaveProjectRename(project: ProjectRecord) {
    const nextTitle = projectTitleDraft.trim();
    const nextIssue = projectIssueDraft.trim();
    if (!nextTitle || !nextIssue) {
      setMessage(t('Project title and folio mark are required.'));
      return;
    }

    setProjectBusyId(project.id);
    setProjectBusyAction('rename');
    setMessage(null);
    try {
      const updatedProject = await patchProject(project.id, {
        project: {
          title: nextTitle,
          issue: nextIssue,
        },
      });
      replaceProjectRecord(updatedProject);
      stopEditingProject();
      setMessage(t('Project renamed.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to rename project.'));
    } finally {
      setProjectBusyId(null);
      setProjectBusyAction(null);
    }
  }

  async function handleDuplicateProject(project: ProjectRecord) {
    setProjectBusyId(project.id);
    setProjectBusyAction('duplicate');
    setMessage(null);
    try {
      const duplicated = await duplicateProject(project.id);
      replaceProjectRecord(duplicated);
      setMessage(t('Project duplicated.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to duplicate project.'));
    } finally {
      setProjectBusyId(null);
      setProjectBusyAction(null);
    }
  }

  async function handleArchiveProject(project: ProjectRecord, nextArchived: boolean) {
    setProjectBusyId(project.id);
    setProjectBusyAction('archive');
    setMessage(null);
    try {
      const updatedProject = await patchProject(project.id, nextArchived ? { archive: true } : { unarchive: true });
      replaceProjectRecord(updatedProject);
      setMessage(nextArchived ? t('Project archived.') : t('Project restored.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to update archive status.'));
    } finally {
      setProjectBusyId(null);
      setProjectBusyAction(null);
    }
  }

  async function handleEnableShare(project: ProjectRecord) {
    setProjectBusyId(project.id);
    setProjectBusyAction('share');
    setMessage(null);

    try {
      const updatedProject = await enableProjectShare(project.id);
      replaceProjectRecord(updatedProject);
      setMessage(t('Share link enabled.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to enable sharing.'));
    } finally {
      setProjectBusyId(null);
      setProjectBusyAction(null);
    }
  }

  async function handleDisableShare(project: ProjectRecord) {
    const confirmed = await confirmAction({
      title: t('Disable this share link?'),
      body: t('Anyone with the old public URL will lose access immediately.'),
      confirmLabel: t('Disable link'),
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setProjectBusyId(project.id);
    setProjectBusyAction('share');
    setMessage(null);

    try {
      const updatedProject = await disableProjectShare(project.id);
      replaceProjectRecord(updatedProject);
      setMessage(t('Share link disabled.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to disable sharing.'));
    } finally {
      setProjectBusyId(null);
      setProjectBusyAction(null);
    }
  }

  async function handleCopyShareLink(project: ProjectRecord) {
    if (!project.share.enabled || !project.share.path) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildAbsoluteUrl(project.share.path));
      setMessage(t('Share link copied.'));
    } catch {
      setMessage(t('Unable to copy the share link.'));
    }
  }

  async function handleOpenTemplate(template: UserTemplateRecord) {
    setTemplateBusyId(template.id);
    setMessage(null);

    try {
      const record = await createProjectFromUserTemplate(template.id);
      navigate(record.sharePath);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to create a new folio from this template.'));
    } finally {
      setTemplateBusyId(null);
    }
  }

  async function handleDuplicateTemplate(template: UserTemplateRecord) {
    setTemplateBusyId(template.id);
    setMessage(null);

    try {
      const payload = await duplicateUserTemplate(template.id);
      appendTemplateRecord(payload.template);
      setMessage(t('Template duplicated.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to duplicate template.'));
    } finally {
      setTemplateBusyId(null);
    }
  }

  async function handleSaveTemplate(template: UserTemplateRecord) {
    const nextName = templateNameDraft.trim();
    if (!nextName) {
      setMessage(t('Template name is required.'));
      return;
    }

    setTemplateBusyId(template.id);
    setMessage(null);

    try {
      const payload = await updateUserTemplate(template.id, {
        name: nextName,
        description: templateDescriptionDraft.trim(),
      });
      replaceTemplateRecord(payload.template);
      stopEditingTemplate();
      setMessage(t('Template updated.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to update template.'));
    } finally {
      setTemplateBusyId(null);
    }
  }

  async function handleDeleteTemplate(template: UserTemplateRecord) {
    const confirmed = await confirmAction({
      title: t('Delete this template?'),
      body: `“${template.name}” will be removed from your saved templates. Folios created from it keep their current pages.`,
      confirmLabel: t('Delete template'),
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setTemplateBusyId(template.id);
    setMessage(null);

    try {
      await deleteUserTemplate(template.id);
      setTemplates((current) => current.filter((entry) => entry.id !== template.id));
      if (templateEditingId === template.id) {
        stopEditingTemplate();
      }
      setMessage(t('Template deleted.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to delete template.'));
    } finally {
      setTemplateBusyId(null);
    }
  }

  async function handleDeleteUpload(upload: AccountUploadListItem) {
    const confirmed = await confirmAction({
      title: t('Delete this upload?'),
      body: getConfirmationMessage('deleteUpload', { filename: upload.filename }),
      confirmLabel: t('Delete upload'),
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setUploadBusyId(upload.assetId);
    setMessage(null);

    try {
      await deleteOwnedAsset(upload.assetId);
      removeAssetsFromDraft([upload.assetId]);
      broadcastDraftAssetRemoval({
        assetId: upload.assetId,
        at: Date.now(),
      });
      await refreshAll();
      setMessage(t('Upload deleted.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to delete upload.'));
    } finally {
      setUploadBusyId(null);
    }
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsBusy(true);
    setMessage(null);

    try {
      const payload = await updateAccountProfile({ username: usernameDraft.trim() });
      setSessionUser(payload.user);
      setUsernameDraft(payload.user.username ?? '');
      setMessage(t('Profile updated.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to update profile.'));
    } finally {
      setSettingsBusy(false);
    }
  }

  async function handleSavePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPreferencesBusy(true);
    setMessage(null);

    try {
      const payload = await updateAccountPreferences(preferences);
      setPreferences(payload.preferences);
      setMessage(t('Preferences updated.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to update preferences.'));
    } finally {
      setPreferencesBusy(false);
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage(t('New password confirmation does not match.'));
      return;
    }

    setSettingsBusy(true);
    setMessage(null);

    try {
      const payload = await updateAccountPassword(currentPassword, newPassword);
      setSessionUser(payload.user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage(t('Password updated.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to update password.'));
    } finally {
      setSettingsBusy(false);
    }
  }

  async function handleRetryUpload(upload: AccountUploadListItem) {
    setUploadBusyId(upload.assetId);
    setMessage(null);

    try {
      await retryOwnedAssetObjectStorageSync(upload.assetId);
      await refreshAll();
      setMessage(t('Remote delivery retry queued.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to retry remote delivery.'));
    } finally {
      setUploadBusyId(null);
    }
  }

  const showLoadingShell = useDelayedVisibility(!sessionReady);

  if (!sessionReady) {
    if (!showLoadingShell) {
      return (
        <div className="editor-shell editor-shell--site-page editor-shell--account" aria-hidden="true">
          <SitePageHeader current="account" accountPath="/auth" sessionReady={false} canAccessAdmin={false} />
          <SiteLegalFooter />
        </div>
      );
    }

    return (
      <div className="editor-shell editor-shell--site-page editor-shell--account">
        <SitePageHeader current="account" accountPath="/auth" sessionReady={false} canAccessAdmin={false} />

        <div id="main-content" className="admin-console account-console" aria-busy="true">
          <section className="editor-panel admin-hero">
            <div className="editor-panel__heading">
              <div>
                <p className="eyebrow">{t('Account')}</p>
                <h2>{t('Account workspace.')}</h2>
                <p className="panel-note admin-hero__lede">{t('Checking the active session and loading projects, uploads, templates, and settings.')}</p>
              </div>
              <div className="admin-hero__meta">
                <span className="panel-tag">{t('Checking session')}</span>
              </div>
            </div>
            <div className="loading-tab-strip" aria-hidden="true">
              {ACCOUNT_SECTIONS.map((section) => (
                <span
                  key={section.id}
                  className="loading-tab"
                  style={{ width: `${Math.max(5.4, Math.min(9.2, section.label.length * 0.48 + 3.2))}rem` }}
                />
              ))}
            </div>
          </section>

          <div className="admin-page admin-page--overview">
            <div className="admin-page__main admin-dashboard__primary">
              <section className="editor-panel admin-panel">
                <div className="editor-panel__heading">
                  <div>
                    <p className="eyebrow">{t('Overview')}</p>
                    <h2>{t('Your working set')}</h2>
                  </div>
                  <span className="panel-tag">{t('Loading')}</span>
                </div>
                <LoadingStack lines={['title', 'line-long', 'line-full', 'line-medium']} />
              </section>
            </div>

            <div className="admin-page__side admin-side-stack">
              <section className="editor-panel admin-panel">
                <div className="editor-panel__heading">
                  <div>
                    <p className="eyebrow">{t('Recent activity')}</p>
                    <h2>{t('Recent activity')}</h2>
                  </div>
                  <span className="panel-tag">{t('Loading')}</span>
                </div>
                <LoadingStack lines={['line-full', 'line-long', 'line-medium']} />
              </section>
            </div>
          </div>
        </div>

        <SiteLegalFooter />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="editor-shell editor-shell--site-page editor-shell--auth">
        <SitePageHeader current="account" accountPath="/auth" sessionReady={sessionReady} canAccessAdmin={false} />

        <section className="editor-empty-state">
          <p className="eyebrow">{t('Account')}</p>
          <h1>{t('Sign in to open your workspace.')}</h1>
          <p>{t('Projects, uploads, and account settings now live in a dedicated self-service backend.')}</p>
          <div className="editor-empty-state__actions">
            <button type="button" className="button button--primary" onClick={() => openRoute('/auth?next=/account')}>
              {t('Sign in')}</button>
            <button type="button" className="button button--ghost" onClick={() => openRoute('/')}>
              {t('Back home')}</button>
          </div>
          {message ? <p>{message}</p> : null}
        </section>
        <SiteLegalFooter />
      </div>
    );
  }


  return (
    <div className="editor-shell editor-shell--site-page editor-shell--account">
      <TransientNotice message={message} onDismiss={() => setMessage(null)} label={t('Account update')} />
      <SitePageHeader
        current="account"
        signedIn
        sessionReady={sessionReady}
        onSignOut={handleLogout}
        canAccessAdmin={session.role === 'admin'}
        actions={
          <>
            <button type="button" className="button button--ghost button--small" onClick={() => void refreshAll()} disabled={busy}>
              {t('Refresh')}</button>
            {session.role === 'admin' ? (
              <button type="button" className="button button--ghost button--small" onClick={() => openRoute('/admin')}>
                {t('Open admin')}</button>
            ) : null}
          </>
        }
      />

      <div id="main-content" className="admin-console account-console">
        <h1 className="sr-only">{t('Account workspace')}</h1>
        <AccountConsoleHeader
          activeSection={activeSection}
          selectSection={selectSection}
          session={session}
          summary={summary}
        />

        {activeSection === 'overview' ? (
          <AccountOverviewPanel
            activity={activity}
            openRoute={openRoute}
            preferences={preferences}
            selectSection={selectSection}
            session={session}
            summary={summary}
            templateCount={templates.length}
          />
        ) : null}

        {activeSection === 'projects' ? (
          <AccountProjectsPanel
            filteredProjects={filteredProjects}
            handleCopyShareLink={handleCopyShareLink}
            handleDeleteProject={handleDeleteProject}
            handleDisableShare={handleDisableShare}
            handleEnableShare={handleEnableShare}
            handleSaveProjectRename={handleSaveProjectRename}
            openRoute={openRoute}
            projectBusyAction={projectBusyAction}
            projectBusyId={projectBusyId}
            projectEditingId={projectEditingId}
            projectIssueDraft={projectIssueDraft}
            projectSearch={projectSearch}
            projectTitleDraft={projectTitleDraft}
            projectVisibilityFilter={projectVisibilityFilter}
            selectedProject={selectedProject}
            selectedProjectAssetsById={selectedProjectAssetsById}
            setProjectIssueDraft={setProjectIssueDraft}
            setProjectSearch={setProjectSearch}
            setProjectTitleDraft={setProjectTitleDraft}
            setProjectVisibilityFilter={setProjectVisibilityFilter}
            setSelectedProjectId={setSelectedProjectId}
            stopEditingProject={stopEditingProject}
          />
        ) : null}

        {activeSection === 'uploads' ? (
          <AccountUploadsPanel
            filteredUploads={filteredUploads}
            handleDeleteUpload={handleDeleteUpload}
            handleRetryUpload={handleRetryUpload}
            selectedUpload={selectedUpload}
            setSelectedUploadAssetId={setSelectedUploadAssetId}
            setUploadSearch={setUploadSearch}
            uploadBusyId={uploadBusyId}
            uploadSearch={uploadSearch}
          />
        ) : null}

        {activeSection === 'settings' ? (
          <AccountSettingsPanel
            confirmPassword={confirmPassword}
            currentPassword={currentPassword}
            handleChangePassword={handleChangePassword}
            handleSaveProfile={handleSaveProfile}
            newPassword={newPassword}
            session={session}
            setConfirmPassword={setConfirmPassword}
            setCurrentPassword={setCurrentPassword}
            setNewPassword={setNewPassword}
            setUsernameDraft={setUsernameDraft}
            settingsBusy={settingsBusy}
            usernameDraft={usernameDraft}
          />
        ) : null}

        {activeSection === 'templates' ? (
          <AccountTemplatesPanel
            filteredTemplates={filteredTemplates}
            handleDeleteTemplate={handleDeleteTemplate}
            handleDuplicateTemplate={handleDuplicateTemplate}
            handleOpenTemplate={handleOpenTemplate}
            handleSaveTemplate={handleSaveTemplate}
            setTemplateDescriptionDraft={setTemplateDescriptionDraft}
            setTemplateNameDraft={setTemplateNameDraft}
            setTemplateSearch={setTemplateSearch}
            startEditingTemplate={startEditingTemplate}
            stopEditingTemplate={stopEditingTemplate}
            templateBusyId={templateBusyId}
            templateDescriptionDraft={templateDescriptionDraft}
            templateEditingId={templateEditingId}
            templateNameDraft={templateNameDraft}
            templateSearch={templateSearch}
          />
        ) : null}

        {activeSection === 'preferences' ? (
          <AccountPreferencesPanel
            handleSavePreferences={handleSavePreferences}
            preferences={preferences}
            preferencesBusy={preferencesBusy}
            setPreferences={setPreferences}
          />
        ) : null}
      </div>
      <SiteLegalFooter />
    </div>
  );
}
