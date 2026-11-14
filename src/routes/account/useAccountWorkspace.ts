import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAccountActivity,
  fetchAccountPreferences,
  fetchAccountSummary,
  fetchAccountUploads,
  fetchOwnedProjects,
  fetchOwnedTemplates,
  type AccountSummary,
  type AccountUploadListItem,
  type UserSession,
} from '../../editor/api';
import type { AccountActivityItem, AccountPreferences, Asset, ProjectRecord, UserTemplateRecord } from '../../editor/types';

export type ProjectVisibilityFilter = 'active' | 'archived' | 'all';

export const DEFAULT_ACCOUNT_PREFERENCES: AccountPreferences = {
  defaultExportFormat: 'pdf',
  defaultExportQuality: 'standard',
  defaultPageSize: 'a4',
  defaultPageTheme: null,
  preserveCopyWhenSavingTemplate: true,
};

type UseAccountWorkspaceOptions = {
  session: UserSession | null;
  setMessage: (message: string | null) => void;
  setProjectEditingId: (value: string | null) => void;
  setProjectIssueDraft: (value: string) => void;
  setProjectTitleDraft: (value: string) => void;
  setTemplateDescriptionDraft: (value: string) => void;
  setTemplateEditingId: (value: string | null) => void;
  setTemplateNameDraft: (value: string) => void;
};

function filterBySearch(values: string[], search: string) {
  if (!search) {
    return true;
  }

  return values.some((value) => value.toLowerCase().includes(search));
}

export function useAccountWorkspace({
  session,
  setMessage,
  setProjectEditingId,
  setProjectIssueDraft,
  setProjectTitleDraft,
  setTemplateDescriptionDraft,
  setTemplateEditingId,
  setTemplateNameDraft,
}: UseAccountWorkspaceOptions) {
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [uploads, setUploads] = useState<AccountUploadListItem[]>([]);
  const [templates, setTemplates] = useState<UserTemplateRecord[]>([]);
  const [preferences, setPreferences] = useState<AccountPreferences>(DEFAULT_ACCOUNT_PREFERENCES);
  const [activity, setActivity] = useState<AccountActivityItem[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [uploadSearch, setUploadSearch] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [projectVisibilityFilter, setProjectVisibilityFilter] = useState<ProjectVisibilityFilter>('active');
  const [busy, setBusy] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedUploadAssetId, setSelectedUploadAssetId] = useState<string | null>(null);

  const clearWorkspace = useCallback(() => {
    setSummary(null);
    setProjects([]);
    setSelectedProjectId(null);
    setUploads([]);
    setSelectedUploadAssetId(null);
    setTemplates([]);
    setPreferences(DEFAULT_ACCOUNT_PREFERENCES);
    setActivity([]);
    setTemplateEditingId(null);
    setTemplateNameDraft('');
    setTemplateDescriptionDraft('');
    setProjectEditingId(null);
    setProjectTitleDraft('');
    setProjectIssueDraft('');
  }, [
    setProjectEditingId,
    setProjectIssueDraft,
    setProjectTitleDraft,
    setTemplateDescriptionDraft,
    setTemplateEditingId,
    setTemplateNameDraft,
  ]);

  const loadWorkspace = useCallback(
    async (currentSession = session) => {
      setBusy(true);

      try {
        if (!currentSession) {
          clearWorkspace();
          return;
        }

        const [summaryPayload, projectsPayload, uploadsPayload, templatesPayload, preferencesPayload, activityPayload] = await Promise.all([
          fetchAccountSummary(),
          fetchOwnedProjects('', 'all'),
          fetchAccountUploads(),
          fetchOwnedTemplates(),
          fetchAccountPreferences(),
          fetchAccountActivity(),
        ]);

        setSummary(summaryPayload);
        setProjects(projectsPayload.projects);
        setSelectedProjectId((current) => current ?? projectsPayload.projects[0]?.id ?? null);
        setUploads(uploadsPayload.uploads);
        setSelectedUploadAssetId((current) => current ?? uploadsPayload.uploads[0]?.assetId ?? null);
        setTemplates(templatesPayload.templates);
        setPreferences(preferencesPayload.preferences);
        setActivity(activityPayload.activity);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Unable to load your account.');
      } finally {
        setBusy(false);
      }
    },
    [clearWorkspace, session, setMessage],
  );

  const filteredProjects = useMemo(() => {
    const normalizedSearch = projectSearch.trim().toLowerCase();
    return projects
      .filter((project) => {
        if (projectVisibilityFilter === 'active') {
          return !project.archivedAt;
        }
        if (projectVisibilityFilter === 'archived') {
          return Boolean(project.archivedAt);
        }
        return true;
      })
      .filter((project) => filterBySearch([project.id, project.project.issue, project.project.title], normalizedSearch));
  }, [projectSearch, projectVisibilityFilter, projects]);

  const filteredUploads = useMemo(() => {
    const normalizedSearch = uploadSearch.trim().toLowerCase();
    return [...uploads]
      .sort((left, right) => (right.lastUsedAt ?? right.updatedAt).localeCompare(left.lastUsedAt ?? left.updatedAt))
      .filter((upload) => filterBySearch([upload.filename, upload.name, ...upload.referencedProjectTitles], normalizedSearch));
  }, [uploadSearch, uploads]);

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = templateSearch.trim().toLowerCase();
    return templates.filter((template) =>
      filterBySearch([template.id, template.name, template.description, template.sourceProjectId ?? ''], normalizedSearch),
    );
  }, [templateSearch, templates]);

  const selectedProject = useMemo(
    () => filteredProjects.find((project) => project.id === selectedProjectId) ?? filteredProjects[0] ?? projects[0] ?? null,
    [filteredProjects, projects, selectedProjectId],
  );
  const selectedUpload = useMemo(
    () => filteredUploads.find((upload) => upload.assetId === selectedUploadAssetId) ?? filteredUploads[0] ?? uploads[0] ?? null,
    [filteredUploads, selectedUploadAssetId, uploads],
  );
  const selectedProjectAssetsById = useMemo<Record<string, Asset>>(
    () => (selectedProject ? Object.fromEntries(selectedProject.project.assets.map((asset) => [asset.id, asset])) : {}),
    [selectedProject],
  );

  useEffect(() => {
    const nextProjectId = selectedProject?.id ?? null;
    if (nextProjectId !== selectedProjectId) {
      setSelectedProjectId(nextProjectId);
    }
  }, [selectedProject?.id, selectedProjectId]);

  useEffect(() => {
    const nextUploadAssetId = selectedUpload?.assetId ?? null;
    if (nextUploadAssetId !== selectedUploadAssetId) {
      setSelectedUploadAssetId(nextUploadAssetId);
    }
  }, [selectedUpload?.assetId, selectedUploadAssetId]);

  const replaceProjectRecord = useCallback((updatedProject: ProjectRecord) => {
    setProjects((current) => {
      const exists = current.some((project) => project.id === updatedProject.id);
      const nextProjects = exists
        ? current.map((project) => (project.id === updatedProject.id ? updatedProject : project))
        : [updatedProject, ...current];
      return nextProjects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    });
  }, []);

  const replaceTemplateRecord = useCallback((updatedTemplate: UserTemplateRecord) => {
    setTemplates((current) =>
      current
        .map((template) => (template.id === updatedTemplate.id ? updatedTemplate : template))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    );
  }, []);

  const appendTemplateRecord = useCallback((updatedTemplate: UserTemplateRecord) => {
    setTemplates((current) =>
      [updatedTemplate, ...current.filter((template) => template.id !== updatedTemplate.id)].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    );
  }, []);

  return {
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
  };
}
