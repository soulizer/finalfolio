import { useT } from '../i18n';
import { useState } from 'react';
import { SiteLegalFooter } from '../components/SiteLegalFooter';
import { SitePageHeader } from '../components/SitePageHeader';
import { TransientNotice } from '../components/TransientNotice';
import { useSession } from '../session';
import { AdminAiPanel } from './admin/AdminAiPanel';
import { AdminConsoleHeader } from './admin/AdminConsoleHeader';
import { AdminEventsPanel } from './admin/AdminEventsPanel';
import { AdminGovernancePanel } from './admin/AdminGovernancePanel';
import { AdminOverviewPanel } from './admin/AdminOverviewPanel';
import { AdminProjectsPanel } from './admin/AdminProjectsPanel';
import { AdminUploadsPanel } from './admin/AdminUploadsPanel';
import { AdminStoragePanel } from './admin/AdminStoragePanel';
import { AdminUsersPanel } from './admin/AdminUsersPanel';
import { useAdminAiConfig } from './admin/useAdminAiConfig';
import { useAdminAssetGovernanceActions } from './admin/useAdminAssetGovernanceActions';
import { AdminLoadingState, AdminUnavailableState } from './admin/AdminShellStates';
import { useAdminShellState } from './admin/useAdminShellState';
import { useAdminConfigState } from './admin/useAdminConfigState';
import { useAdminUserManagement } from './admin/useAdminUserManagement';
import { createAdminObjectStorageDraft, useAdminWorkspace } from './admin/useAdminWorkspace';

export function AdminPage() {
  const t = useT();
  const [message, setMessage] = useState<string | null>(null);
  const { user: session, ready: sessionReady, refreshSession, setSessionUser } = useSession();
  const {
    activeDailyTrend,
    activeHourlyTrend,
    aiConfigDraft,
    bootstrapStatus,
    busy,
    clearAdminData,
    enabledPackCount,
    enabledTemplateCount,
    filteredProjects,
    filteredUploads,
    filteredUsers,
    loadAdminData,
    objectStorageDraft,
    productConfig,
    projectSearch,
    projects,
    projectsById,
    rankedEventBreakdown,
    selectedProjectDetail,
    selectedProjectId,
    selectedUpload,
    selectedUploadDetail,
    setAiConfigDraft,
    setObjectStorageDraft,
    setProjectSearch,
    setSelectedProjectId,
    setSelectedUploadFilename,
    setSiteContentDraft,
    setTemplateGovernanceDraft,
    setUploadSearch,
    setUserSearch,
    siteContentDraft,
    summary,
    templateGovernanceDraft,
    uploadSearch,
    users,
    usersById,
    userSearch,
  } = useAdminWorkspace({
    session,
    setMessage,
  });
  const {
    accountPath,
    activeSection,
    adminLoading,
    blocked,
    canAccessAdmin,
    fallbackBody,
    fallbackTitle,
    handleLogout,
    handlePrimaryFallbackAction,
    openRoute,
    primaryFallbackDisabled,
    primaryFallbackLabel,
    refreshAll,
    selectSection,
    showLoadingShell,
  } = useAdminShellState({
    bootstrapStatus,
    busy,
    clearAdminData,
    loadAdminData,
    message,
    refreshSession,
    session,
    sessionReady,
    setMessage,
    setSessionUser,
    summary,
  });
  const {
    configBusy,
    handleRestoreObjectStorage,
    handleSaveObjectStorage,
    handleSaveSiteContent,
    handleSaveTemplateGovernance,
    handleSyncObjectStorage,
    handleTestObjectStorage,
    objectStorageBusy,
    updateFeaturedIssue,
    updateFeaturedPageIds,
    updateFeaturedProjectId,
    updateObjectStorageDraftField,
    updateSiteCta,
    updateSiteFeature,
    updateSiteHero,
    updateTemplateSetting,
    updateWorkflow,
    updateWorkflowStep,
  } = useAdminConfigState({
    objectStorageDraft,
    refreshAll,
    setMessage,
    setObjectStorageDraft,
    setSiteContentDraft,
    setTemplateGovernanceDraft,
    siteContentDraft,
    templateGovernanceDraft,
  });
  const {
    createUserEmail,
    createUserPassword,
    createUserRole,
    createUsername,
    handleCreateUser,
    handleDeleteUser,
    handleToggleUser,
    setCreateUserEmail,
    setCreateUserPassword,
    setCreateUserRole,
    setCreateUsername,
    userActionBusy,
    userActionKind,
    userActionTargetId,
  } = useAdminUserManagement({
    refreshAll,
    setMessage,
  });
  const {
    aiBusy,
    aiTestBusyId,
    handleSaveAiConfig,
    handleTestAiProvider,
    saveAiConfig,
    updateField: updateAiField,
  } = useAdminAiConfig({
    aiConfigDraft,
    refreshAll,
    setAiConfigDraft,
    setMessage,
  });
  const {
    handleDeleteProject,
    handleDeleteUpload,
    handleRetryUpload,
  } = useAdminAssetGovernanceActions({
    refreshAll,
    setMessage,
  });

  return (
    <div className="editor-shell editor-shell--site-page editor-shell--admin">
      <TransientNotice message={message} onDismiss={() => setMessage(null)} label={t('Admin update')} />
      <SitePageHeader
        current="admin"
        accountPath={accountPath}
        signedIn={Boolean(session)}
        sessionReady={sessionReady}
        onSignOut={session ? handleLogout : undefined}
        canAccessAdmin={canAccessAdmin}
        actions={
          <button type="button" className="button button--ghost button--small" onClick={() => void refreshAll()} disabled={busy || !sessionReady}>
            {t('Refresh')}
          </button>
        }
      />

      <div id="main-content" className="admin-console">
      <h1 className="sr-only">{t('Admin console')}</h1>
        <AdminConsoleHeader
          activeSection={activeSection}
          selectSection={selectSection}
          session={session}
          sessionReady={sessionReady}
          summary={summary}
        />

        {summary && !blocked ? (
          <>
            {activeSection === 'overview' ? (
              <AdminOverviewPanel
                activeHourlyTrend={activeHourlyTrend}
                enabledPackCount={enabledPackCount}
                enabledTemplateCount={enabledTemplateCount}
                productConfig={productConfig}
                selectSection={selectSection}
                summary={summary}
              />
            ) : null}

            {activeSection === 'projects' ? (
              <AdminProjectsPanel
                filteredProjects={filteredProjects}
                handleDeleteProject={handleDeleteProject}
                projectSearch={projectSearch}
                selectedProjectDetail={selectedProjectDetail}
                selectedProjectId={selectedProjectId}
                setProjectSearch={setProjectSearch}
                setSelectedProjectId={setSelectedProjectId}
              />
            ) : null}

            {activeSection === 'uploads' ? (
              <AdminUploadsPanel
                filteredUploads={filteredUploads}
                handleDeleteUpload={handleDeleteUpload}
                handleRetryUpload={handleRetryUpload}
                selectedUploadDetail={selectedUploadDetail}
                selectedUploadFilename={selectedUpload?.filename ?? null}
                setSelectedUploadFilename={setSelectedUploadFilename}
                setUploadSearch={setUploadSearch}
                uploadSearch={uploadSearch}
              />
            ) : null}

            {activeSection === 'governance' ? (
              <AdminGovernancePanel
                configBusy={configBusy}
                enabledPackCount={enabledPackCount}
                enabledTemplateCount={enabledTemplateCount}
                handleSaveSiteContent={handleSaveSiteContent}
                handleSaveTemplateGovernance={handleSaveTemplateGovernance}
                productConfig={productConfig}
                projects={projects}
                siteContentDraft={siteContentDraft}
                templateGovernanceDraft={templateGovernanceDraft}
                updateFeaturedIssue={updateFeaturedIssue}
                updateFeaturedPageIds={updateFeaturedPageIds}
                updateFeaturedProjectId={updateFeaturedProjectId}
                updateSiteCta={updateSiteCta}
                updateSiteFeature={updateSiteFeature}
                updateSiteHero={updateSiteHero}
                updateTemplateSetting={updateTemplateSetting}
                updateWorkflow={updateWorkflow}
                updateWorkflowStep={updateWorkflowStep}
              />
            ) : null}

            {activeSection === 'ai' ? (
              <AdminAiPanel
                aiBusy={aiBusy}
                aiConfigDraft={aiConfigDraft}
                aiTestBusyId={aiTestBusyId}
                handleSaveAiConfig={handleSaveAiConfig}
                handleTestAiProvider={handleTestAiProvider}
                saveAiConfig={saveAiConfig}
                updateField={updateAiField}
              />
            ) : null}

            {activeSection === 'storage' ? (
              <AdminStoragePanel
                handleRestoreObjectStorage={handleRestoreObjectStorage}
                handleSaveObjectStorage={handleSaveObjectStorage}
                handleSyncObjectStorage={handleSyncObjectStorage}
                handleTestObjectStorage={handleTestObjectStorage}
                objectStorageBusy={objectStorageBusy}
                objectStorageDraft={objectStorageDraft}
                onResetObjectStorageDraft={() =>
                  setObjectStorageDraft(productConfig ? createAdminObjectStorageDraft(productConfig.objectStorage) : null)
                }
                productConfig={productConfig}
                updateObjectStorageDraftField={updateObjectStorageDraftField}
              />
            ) : null}

            {activeSection === 'users' ? (
              <AdminUsersPanel
                createUserEmail={createUserEmail}
                createUserPassword={createUserPassword}
                createUserRole={createUserRole}
                createUsername={createUsername}
                currentUserId={session?.id ?? null}
                filteredUsers={filteredUsers}
                handleCreateUser={handleCreateUser}
                handleDeleteUser={handleDeleteUser}
                handleToggleUser={handleToggleUser}
                setCreateUserEmail={setCreateUserEmail}
                setCreateUserPassword={setCreateUserPassword}
                setCreateUserRole={setCreateUserRole}
                setCreateUsername={setCreateUsername}
                setUserSearch={setUserSearch}
                userActionBusy={userActionBusy}
                userActionKind={userActionKind}
                userActionTargetId={userActionTargetId}
                userSearch={userSearch}
              />
            ) : null}

            {activeSection === 'events' ? (
              <AdminEventsPanel
                activeDailyTrend={activeDailyTrend}
                activeHourlyTrend={activeHourlyTrend}
                projectsById={projectsById}
                rankedEventBreakdown={rankedEventBreakdown}
                summary={summary}
                usersById={usersById}
              />
            ) : null}
          </>
        ) : adminLoading && showLoadingShell ? (
          <AdminLoadingState activeSection={activeSection} />
        ) : adminLoading ? null : (
          <AdminUnavailableState
            fallbackBody={fallbackBody}
            fallbackTitle={fallbackTitle}
            onBackToEditor={() => openRoute('/editor')}
            onPrimaryAction={handlePrimaryFallbackAction}
            primaryFallbackDisabled={primaryFallbackDisabled}
            primaryFallbackLabel={primaryFallbackLabel}
          />
        )}
      </div>
      <SiteLegalFooter />
    </div>
  );
}
