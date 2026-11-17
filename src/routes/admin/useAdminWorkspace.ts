import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAdminProject,
  fetchAdminProductConfig,
  fetchAdminProjects,
  fetchAdminSummary,
  fetchAdminUpload,
  fetchAdminUploads,
  fetchAdminUsers,
  fetchBootstrapStatus,
  type AdminAiConfigDraft,
  type AdminObjectStorageDraft,
  type AdminProjectDetail,
  type AdminProjectListItem,
  type AdminSummary,
  type AdminUploadDetail,
  type AdminUploadListItem,
  type BootstrapStatus,
  type ProductConfigPayload,
  type UserSession,
} from '../../editor/api';
import type { Asset } from '../../editor/types';
import type { SiteContent, TemplateGovernance } from '../../product/types';

export function createAdminAiDraft(ai: ProductConfigPayload['ai']): AdminAiConfigDraft {
  return {
    enabled: ai.enabled,
    userTotalLimit: ai.userTotalLimit,
    dailyLimit: ai.dailyLimit,
    maxImages: ai.maxImages,
    requestTimeoutMs: ai.requestTimeoutMs,
    prompt: ai.prompt,
    providers: ai.providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      model: provider.model,
      baseUrl: provider.baseUrl,
      apiKey: '',
      order: provider.order,
      enabled: provider.enabled,
      hasApiKey: provider.hasApiKey,
      apiKeyHint: provider.apiKeyHint,
    })),
  };
}

export function createAdminObjectStorageDraft(objectStorage: ProductConfigPayload['objectStorage']): AdminObjectStorageDraft {
  return {
    enabled: objectStorage.enabled,
    provider: objectStorage.provider,
    endpoint: objectStorage.endpoint,
    region: objectStorage.region,
    bucket: objectStorage.bucket,
    prefix: objectStorage.prefix,
    publicBaseUrl: objectStorage.publicBaseUrl,
    accessKeyId: '',
    secretAccessKey: '',
  };
}

function filterBySearch(values: string[], search: string) {
  if (!search) {
    return true;
  }

  return values.some((value) => value.toLowerCase().includes(search));
}

function getFilteredProjects(projects: AdminProjectListItem[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  return projects.filter((project) =>
    filterBySearch([project.id, project.issue, project.title, project.ownerDisplay ?? '', project.ownerUsername ?? '', project.ownerEmail ?? ''], normalizedSearch),
  );
}

function getFilteredUsers(users: UserSession[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  return users.filter((user) => filterBySearch([user.id, user.username ?? '', user.email], normalizedSearch));
}

function getFilteredUploads(uploads: AdminUploadListItem[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  return uploads.filter((upload) =>
    filterBySearch(
      [
        upload.filename,
        upload.src,
        ...upload.ownerEmails,
        ...upload.ownerDisplayNames,
        ...upload.referencedProjectTitles,
      ],
      normalizedSearch,
    ),
  );
}

type UseAdminWorkspaceOptions = {
  session: UserSession | null;
  setMessage: (message: string | null) => void;
};

export function useAdminWorkspace({ session, setMessage }: UseAdminWorkspaceOptions) {
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus | null>(null);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [users, setUsers] = useState<UserSession[]>([]);
  const [projects, setProjects] = useState<AdminProjectListItem[]>([]);
  const [selectedProjectDetail, setSelectedProjectDetail] = useState<AdminProjectDetail | null>(null);
  const [uploads, setUploads] = useState<AdminUploadListItem[]>([]);
  const [selectedUploadDetail, setSelectedUploadDetail] = useState<AdminUploadDetail | null>(null);
  const [productConfig, setProductConfig] = useState<ProductConfigPayload | null>(null);
  const [siteContentDraft, setSiteContentDraft] = useState<SiteContent | null>(null);
  const [templateGovernanceDraft, setTemplateGovernanceDraft] = useState<TemplateGovernance | null>(null);
  const [objectStorageDraft, setObjectStorageDraft] = useState<AdminObjectStorageDraft | null>(null);
  const [aiConfigDraft, setAiConfigDraft] = useState<AdminAiConfigDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [uploadSearch, setUploadSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedUploadFilename, setSelectedUploadFilename] = useState<string | null>(null);

  const clearAdminData = useCallback(() => {
    setSummary(null);
    setUsers([]);
    setProjects([]);
    setSelectedProjectDetail(null);
    setSelectedProjectId(null);
    setUploads([]);
    setSelectedUploadDetail(null);
    setSelectedUploadFilename(null);
    setProductConfig(null);
    setSiteContentDraft(null);
    setTemplateGovernanceDraft(null);
    setObjectStorageDraft(null);
    setAiConfigDraft(null);
  }, []);

  const loadAdminData = useCallback(
    async (currentSession = session) => {
      setBusy(true);

      try {
        const bootstrapPayload = await fetchBootstrapStatus();
        setBootstrapStatus(bootstrapPayload);

        if (!currentSession || currentSession.role !== 'admin') {
          clearAdminData();
          return;
        }

        const [summaryPayload, userPayload, projectPayload, uploadPayload, configPayload] = await Promise.all([
          fetchAdminSummary(),
          fetchAdminUsers(),
          fetchAdminProjects(),
          fetchAdminUploads(),
          fetchAdminProductConfig(),
        ]);

        setSummary(summaryPayload);
        setUsers(userPayload.users);
        setProjects(projectPayload.projects);
        setSelectedProjectDetail(null);
        setUploads(uploadPayload.uploads);
        setSelectedUploadDetail(null);
        setProductConfig(configPayload);
        setSiteContentDraft(configPayload.siteContent);
        setTemplateGovernanceDraft(configPayload.templateGovernance);
        setObjectStorageDraft(createAdminObjectStorageDraft(configPayload.objectStorage));
        setAiConfigDraft(createAdminAiDraft(configPayload.ai));
        setSelectedProjectId((current) => current ?? projectPayload.projects[0]?.id ?? null);
        setSelectedUploadFilename((current) => current ?? uploadPayload.uploads[0]?.filename ?? null);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Unable to load admin data.');
      } finally {
        setBusy(false);
      }
    },
    [clearAdminData, session, setMessage],
  );

  const filteredUsers = useMemo(() => getFilteredUsers(users, userSearch), [userSearch, users]);
  const filteredProjects = useMemo(() => getFilteredProjects(projects, projectSearch), [projectSearch, projects]);
  const filteredUploads = useMemo(() => getFilteredUploads(uploads, uploadSearch), [uploadSearch, uploads]);

  const selectedProject = useMemo(
    () => filteredProjects.find((project) => project.id === selectedProjectId) ?? filteredProjects[0] ?? projects[0] ?? null,
    [filteredProjects, projects, selectedProjectId],
  );
  const selectedUpload = useMemo(
    () => filteredUploads.find((upload) => upload.filename === selectedUploadFilename) ?? filteredUploads[0] ?? uploads[0] ?? null,
    [filteredUploads, selectedUploadFilename, uploads],
  );

  useEffect(() => {
    const nextProjectId = selectedProject?.id ?? null;
    if (nextProjectId !== selectedProjectId) {
      setSelectedProjectId(nextProjectId);
    }
  }, [selectedProject?.id, selectedProjectId]);

  useEffect(() => {
    const nextUploadFilename = selectedUpload?.filename ?? null;
    if (nextUploadFilename !== selectedUploadFilename) {
      setSelectedUploadFilename(nextUploadFilename);
    }
  }, [selectedUpload?.filename, selectedUploadFilename]);

  useEffect(() => {
    if (!session || session.role !== 'admin' || !selectedProject?.id) {
      setSelectedProjectDetail(null);
      return;
    }

    let cancelled = false;
    setSelectedProjectDetail(null);
    void fetchAdminProject(selectedProject.id)
      .then((payload) => {
        if (!cancelled) {
          setSelectedProjectDetail(payload.project);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSelectedProjectDetail(null);
          setMessage(error instanceof Error ? error.message : 'Unable to load project detail.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id, session?.id, session?.role, setMessage]);

  useEffect(() => {
    if (!session || session.role !== 'admin' || !selectedUpload?.filename) {
      setSelectedUploadDetail(null);
      return;
    }

    let cancelled = false;
    setSelectedUploadDetail(null);
    void fetchAdminUpload(selectedUpload.filename)
      .then((payload) => {
        if (!cancelled) {
          setSelectedUploadDetail(payload.upload);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSelectedUploadDetail(null);
          setMessage(error instanceof Error ? error.message : 'Unable to load upload detail.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedUpload?.filename, session?.id, session?.role, setMessage]);

  const selectedProjectMetrics = selectedProjectDetail?.metrics ?? null;
  const selectedProjectAssetsById = useMemo<Record<string, Asset>>(
    () =>
      selectedProjectDetail
        ? Object.fromEntries(selectedProjectDetail.preview.assets.map((asset) => [asset.id, asset]))
        : {},
    [selectedProjectDetail],
  );
  const selectedProjectEvents = selectedProjectDetail?.recentEvents ?? [];
  const selectedProjectFailures = selectedProjectDetail?.recentFailures ?? [];
  const usersById = useMemo(() => Object.fromEntries(users.map((user) => [user.id, user])), [users]);
  const projectsById = useMemo(() => Object.fromEntries(projects.map((project) => [project.id, project])), [projects]);
  const rankedEventBreakdown = useMemo(
    () =>
      summary
        ? Object.entries(summary.eventTypeBreakdown).sort((left, right) => {
            if (right[1].failures !== left[1].failures) {
              return right[1].failures - left[1].failures;
            }
            return right[1].total - left[1].total;
          })
        : [],
    [summary],
  );
  const activeDailyTrend = useMemo(
    () => summary?.trends.last7Days.filter((bucket) => bucket.total > 0 || bucket.failures > 0) ?? [],
    [summary],
  );
  const activeHourlyTrend = useMemo(
    () => summary?.trends.last24Hours.filter((bucket) => bucket.total > 0 || bucket.failures > 0) ?? [],
    [summary],
  );
  const enabledTemplateCount = useMemo(
    () => Object.values(templateGovernanceDraft?.templates ?? {}).filter((entry) => entry.enabled).length,
    [templateGovernanceDraft?.templates],
  );
  const enabledPackCount = useMemo(
    () => Object.values(templateGovernanceDraft?.packs ?? {}).filter((entry) => entry.enabled).length,
    [templateGovernanceDraft?.packs],
  );

  return {
    activeDailyTrend,
    aiConfigDraft,
    activeHourlyTrend,
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
    selectedProject,
    selectedProjectId,
    selectedProjectAssetsById,
    selectedProjectDetail,
    selectedProjectEvents,
    selectedProjectFailures,
    selectedProjectMetrics,
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
  };
}
