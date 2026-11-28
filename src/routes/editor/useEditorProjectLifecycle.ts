import { useEffect } from 'react';
import { translate } from '../../i18n';
import { fetchProject } from '../../editor/api';
import {
  clearDraftProject,
  readDraftProject,
  restoreDraftProjectUploads,
  syncPersistedDraftUploads,
  writeDraftProject,
} from '../../editor/storage';
import type { CustomTemplateDefinition, PageData, PageThemeId, ProjectRecord, ProjectState, TemplateId } from '../../editor/types';
import {
  buildDraftProjectHydration,
  buildServerProjectHydration,
  createDraftLoadMessage,
  STABLE_EDITOR_URL_MESSAGE,
} from './projectLifecycle';
import { applyHydratedProjectState } from './projectPersistence';

type LoadState = 'loading' | 'ready' | 'error';
type SaveState = 'draft' | 'dirty' | 'saving' | 'saved' | 'error';
type CopyState = 'idle' | 'copied' | 'error';

type HydrationSetters = {
  setProject: (project: ProjectState) => void;
  setProjectRecord: (record: ProjectRecord | null) => void;
  setSelectedPageId: (pageId: string) => void;
  setSelectedSlot: (slot: string | null) => void;
  setTemplateChoice: (template: TemplateId) => void;
  setThemeChoice: (theme: PageThemeId) => void;
  setCustomTemplateDraft: (draft: CustomTemplateDefinition) => void;
};

type UseEditorProjectLifecycleOptions = HydrationSetters & {
  projectId?: string;
  project: ProjectState;
  projectRecord: ProjectRecord | null;
  loadState: LoadState;
  saveConflict: boolean;
  saveState: SaveState;
  getInitialSlot: (page?: PageData) => string | null;
  lastSavedSnapshotRef: { current: string };
  saveProject: (options: { manual: boolean }) => Promise<void>;
  setLoadState: (state: LoadState) => void;
  setSaveState: (state: SaveState) => void;
  setLoadError: (message: string | null) => void;
  setMessage: (message: string | null) => void;
  setCopyState: (state: CopyState) => void;
  setShareCopyState: (state: CopyState) => void;
};

export function useEditorProjectLifecycle({
  projectId,
  project,
  projectRecord,
  loadState,
  saveConflict,
  saveState,
  getInitialSlot,
  lastSavedSnapshotRef,
  saveProject,
  setProject,
  setProjectRecord,
  setSelectedPageId,
  setSelectedSlot,
  setTemplateChoice,
  setThemeChoice,
  setCustomTemplateDraft,
  setLoadState,
  setSaveState,
  setLoadError,
  setMessage,
  setCopyState,
  setShareCopyState,
}: UseEditorProjectLifecycleOptions) {
  useEffect(() => {
    let cancelled = false;

    async function loadServerProject() {
      if (!projectId) {
        const draft = readDraftProject();
        const restoredDraft = await restoreDraftProjectUploads(draft);
        if (cancelled) {
          restoredDraft.project.assets
            .filter((asset) => asset.src.startsWith('blob:'))
            .forEach((asset) => URL.revokeObjectURL(asset.src));
          return;
        }

        const nextDraftState = buildDraftProjectHydration(restoredDraft.project, getInitialSlot);
        applyHydratedProjectState(nextDraftState, {
          setProject,
          setProjectRecord,
          setSelectedPageId,
          setSelectedSlot,
          setTemplateChoice,
          setThemeChoice,
          setCustomTemplateDraft,
        });
        setLoadState('ready');
        setSaveState('draft');
        setLoadError(null);
        setMessage(createDraftLoadMessage(restoredDraft));
        lastSavedSnapshotRef.current = nextDraftState.snapshot;
        return;
      }

      setLoadState('loading');
      setSaveState('saving');
      setMessage(translate('Loading the saved folio from the server...'));
      setLoadError(null);
      setCopyState('idle');
      setShareCopyState('idle');

      try {
        const record = await fetchProject(projectId);
        if (cancelled) {
          return;
        }

        const nextProjectState = buildServerProjectHydration(record, getInitialSlot);
        lastSavedSnapshotRef.current = nextProjectState.snapshot;
        clearDraftProject();
        applyHydratedProjectState(nextProjectState, {
          setProject,
          setProjectRecord,
          setSelectedPageId,
          setSelectedSlot,
          setTemplateChoice,
          setThemeChoice,
          setCustomTemplateDraft,
        });
        setLoadState('ready');
        setSaveState('saved');
        setMessage(STABLE_EDITOR_URL_MESSAGE);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setProjectRecord(null);
        setLoadState('error');
        setSaveState('error');
        setLoadError(error instanceof Error ? error.message : 'Unable to load this folio.');
        setMessage(null);
      }
    }

    void loadServerProject();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      return;
    }
    const currentProjectId = projectId;

    let checking = false;
    let lastCheckedAt = 0;

    async function checkProjectStillExists() {
      const now = Date.now();
      if (checking || now - lastCheckedAt < 15_000) {
        return;
      }
      checking = true;
      lastCheckedAt = now;

      try {
        await fetchProject(currentProjectId);
      } catch (error) {
        if ((error as { status?: number }).status !== 404) {
          return;
        }
        setProjectRecord(null);
        setLoadState('error');
        setSaveState('error');
        setLoadError(error instanceof Error ? error.message : translate('Project not found.'));
        setMessage(null);
      } finally {
        checking = false;
      }
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void checkProjectStillExists();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkProjectStillExists();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [projectId, setLoadError, setLoadState, setMessage, setProjectRecord, setSaveState]);

  useEffect(() => {
    if (loadState !== 'ready' || saveConflict) {
      return;
    }

    if (!projectRecord) {
      writeDraftProject(project);
      void syncPersistedDraftUploads(project);
      setSaveState('draft');
      return;
    }

    const snapshot = JSON.stringify(project);
    if (snapshot === lastSavedSnapshotRef.current || saveState === 'saving') {
      return;
    }

    setSaveState('dirty');
    const timer = window.setTimeout(() => {
      void saveProject({ manual: false });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [loadState, project, projectRecord, saveConflict, saveProject, saveState]);
}
