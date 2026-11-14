import { startTransition } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import {
  type AccountUploadListItem,
  createProject,
  disableProjectShare,
  enableProjectShare,
  type UserSession,
  updateProject as persistProject,
} from '../../editor/api';
import { getAssetVariant } from '../../editor/assetResources';
import { createDefaultProject } from '../../editor/demoData';
import { clearDraftProject, writeDraftProject } from '../../editor/storage';
import { Asset, ProjectRecord, ProjectState } from '../../editor/types';
import { confirmAction } from '../../ui/confirm';
import {
  buildDraftProjectHydration,
  CREATED_EDITOR_URL_MESSAGE,
  DRAFT_ONLY_MESSAGE,
  type EditorProjectHydration,
  normalizeEditorProjectRecord,
} from './projectLifecycle';

type SaveState = 'draft' | 'dirty' | 'saving' | 'saved' | 'error';
type CopyState = 'idle' | 'copied' | 'error';

type ProjectHydrationSetters = {
  setProject: (project: ProjectState) => void;
  setProjectRecord: (record: ProjectRecord | null) => void;
  setSelectedPageId: (pageId: string) => void;
  setSelectedSlot: (slot: string | null) => void;
  setTemplateChoice: (template: EditorProjectHydration['templateChoice']) => void;
  setThemeChoice: (theme: EditorProjectHydration['themeChoice']) => void;
  setCustomTemplateDraft: (draft: EditorProjectHydration['customTemplateDraft']) => void;
};

type ApplyServerProjectRecordStateOptions = {
  record: ProjectRecord;
  nextMessage?: string;
  requestSnapshot?: string;
  getCurrentProject?: () => ProjectState;
  lastSavedSnapshotRef: { current: string };
  setProject: (project: ProjectState) => void;
  setProjectRecord: (record: ProjectRecord) => void;
  setSaveState: (state: SaveState) => void;
  setShareCopyState: (state: CopyState) => void;
  setMessage: (message: string | null) => void;
};

type SaveProjectRecordOptions = {
  manual: boolean;
  getCurrentProject?: () => ProjectState;
  onConflict?: (message: string) => void;
  onSaveSuccess?: () => void;
  session: UserSession | null;
  project: ProjectState;
  projectRecord: ProjectRecord | null;
  lastSavedSnapshotRef: { current: string };
  setSaveState: (state: SaveState) => void;
  setMessage: (message: string | null) => void;
  createPersistableProjectSnapshot: (currentProject: ProjectState) => ProjectState;
  applyServerProjectRecord: (
    record: ProjectRecord,
    nextMessage?: string,
    options?: { requestSnapshot?: string },
  ) => void;
  formatSavedAt: (updatedAt: string) => string;
  navigate: NavigateFunction;
};

type ProjectShareOptions = {
  getCurrentProject?: () => ProjectState;
  project: ProjectState;
  projectRecord: ProjectRecord | null;
  applyServerProjectRecord: (
    record: ProjectRecord,
    nextMessage?: string,
    options?: { requestSnapshot?: string },
  ) => void;
  setShareBusy: (busy: boolean) => void;
  setShareCopyState: (state: CopyState) => void;
  setMessage: (message: string | null) => void;
};

type StartNewDraftOptions = ProjectHydrationSetters & {
  getInitialSlot: (page?: EditorProjectHydration['project']['pages'][number]) => string | null;
  lastSavedSnapshotRef: { current: string };
  setLoadState: (state: 'loading' | 'ready' | 'error') => void;
  setSaveState: (state: SaveState) => void;
  setLoadError: (message: string | null) => void;
  setMessage: (message: string | null) => void;
  setCopyState: (state: CopyState) => void;
  setShareCopyState: (state: CopyState) => void;
  navigate: NavigateFunction;
};

type CreateEditorProjectPersistenceActionsOptions = ProjectHydrationSetters & {
  getCurrentProject?: () => ProjectState;
  onConflict?: (message: string) => void;
  onSaveSuccess?: () => void;
  session: UserSession | null;
  project: ProjectState;
  projectRecord: ProjectRecord | null;
  ownedUploads: AccountUploadListItem[];
  getInitialSlot: (page?: EditorProjectHydration['project']['pages'][number]) => string | null;
  lastSavedSnapshotRef: { current: string };
  setLoadState: (state: 'loading' | 'ready' | 'error') => void;
  setSaveState: (state: SaveState) => void;
  setLoadError: (message: string | null) => void;
  setMessage: (message: string | null) => void;
  setCopyState: (state: CopyState) => void;
  setShareBusy: (busy: boolean) => void;
  setShareCopyState: (state: CopyState) => void;
  navigate: NavigateFunction;
  formatSavedAt: (updatedAt: string) => string;
};

export function createEditorProjectPersistenceActions({
  session,
  project,
  projectRecord,
  ownedUploads,
  getCurrentProject,
  onConflict,
  onSaveSuccess,
  getInitialSlot,
  lastSavedSnapshotRef,
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
  setShareBusy,
  setShareCopyState,
  navigate,
  formatSavedAt,
}: CreateEditorProjectPersistenceActionsOptions) {
  function applyServerProjectRecord(
    record: ProjectRecord,
    nextMessage?: string,
    options: { requestSnapshot?: string } = {},
  ) {
    applyServerProjectRecordState({
      record,
      nextMessage,
      requestSnapshot: options.requestSnapshot,
      getCurrentProject,
      lastSavedSnapshotRef,
      setProject,
      setProjectRecord: (nextRecord) => setProjectRecord(nextRecord),
      setSaveState,
      setShareCopyState,
      setMessage,
    });
  }

  async function saveProject({ manual }: { manual: boolean }) {
    await saveProjectRecord({
      manual,
      getCurrentProject,
      onConflict,
      onSaveSuccess,
      session,
      project,
      projectRecord,
      lastSavedSnapshotRef,
      setSaveState,
      setMessage,
      createPersistableProjectSnapshot: (currentProject) => createPersistableProjectSnapshot(currentProject, ownedUploads),
      applyServerProjectRecord,
      formatSavedAt,
      navigate,
    });
  }

  async function handleEnableProjectShare({ rotate = false }: { rotate?: boolean } = {}) {
    await enableProjectShareLink({
      getCurrentProject,
      project,
      projectRecord,
      applyServerProjectRecord,
      setShareBusy,
      setShareCopyState,
      setMessage,
      rotate,
    });
  }

  async function handleDisableProjectShare() {
    await disableProjectShareLink({
      getCurrentProject,
      project,
      projectRecord,
      applyServerProjectRecord,
      setShareBusy,
      setShareCopyState,
      setMessage,
    });
  }

  async function handleCopyPublicShareLink() {
    await copyProjectShareLink(projectRecord, setShareCopyState, setMessage);
  }

  function startNewDraft() {
    startNewDraftProject({
      getInitialSlot,
      lastSavedSnapshotRef,
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
      navigate,
    });
  }

  return {
    applyServerProjectRecord,
    handleCopyPublicShareLink,
    handleDisableProjectShare,
    handleEnableProjectShare,
    saveProject,
    startNewDraft,
  };
}

export function createFreshDraft() {
  const fresh = createDefaultProject();
  writeDraftProject(fresh);
  return fresh;
}

export function applyHydratedProjectState(hydration: EditorProjectHydration, setters: ProjectHydrationSetters) {
  setters.setProject(hydration.project);
  setters.setProjectRecord(hydration.projectRecord);
  setters.setSelectedPageId(hydration.selectedPageId);
  setters.setSelectedSlot(hydration.selectedSlot);
  setters.setTemplateChoice(hydration.templateChoice);
  setters.setThemeChoice(hydration.themeChoice);
  setters.setCustomTemplateDraft(hydration.customTemplateDraft);
}

export function applyServerProjectRecordState({
  record,
  nextMessage,
  requestSnapshot,
  getCurrentProject,
  lastSavedSnapshotRef,
  setProject,
  setProjectRecord,
  setSaveState,
  setShareCopyState,
  setMessage,
}: ApplyServerProjectRecordStateOptions) {
  const normalizedRecord = normalizeEditorProjectRecord(record);
  const currentProject = getCurrentProject?.();
  const hasNewerLocalEdits =
    Boolean(requestSnapshot) && Boolean(currentProject) && JSON.stringify(currentProject) !== requestSnapshot;

  if (hasNewerLocalEdits) {
    // The response only contains the version that was sent. Replacing local state here
    // would silently discard everything the user typed while the request was in flight.
    lastSavedSnapshotRef.current = requestSnapshot ?? '';
    setProjectRecord(normalizedRecord.projectRecord);
    setSaveState('dirty');
    setShareCopyState('idle');
    setMessage(
      nextMessage
        ? `${nextMessage} Newer edits are queued for the next save.`
        : 'Newer edits are queued for the next save.',
    );
    return;
  }

  lastSavedSnapshotRef.current = normalizedRecord.snapshot;
  clearDraftProject();
  setProject(normalizedRecord.project);
  setProjectRecord(normalizedRecord.projectRecord);
  setSaveState('saved');
  setShareCopyState('idle');
  if (nextMessage) {
    setMessage(nextMessage);
  }
}

export function hydrateOwnedUploadAsset(currentAsset: Asset, upload: AccountUploadListItem): Asset {
  return {
    ...currentAsset,
    name: upload.name || currentAsset.name,
    src: upload.src,
    note: upload.note,
    bytes: upload.bytes,
    width: upload.width ?? currentAsset.width,
    height: upload.height ?? currentAsset.height,
    variants: {
      original: upload.original ?? getAssetVariant(currentAsset, 'original') ?? undefined,
      preview: upload.preview ?? currentAsset.variants?.preview ?? null,
      thumb: upload.thumb ?? currentAsset.variants?.thumb ?? null,
    },
    delivery: upload.delivery,
  };
}

export function createPersistableProjectSnapshot(currentProject: ProjectState, ownedUploads: AccountUploadListItem[]) {
  if (!ownedUploads.length) {
    return currentProject;
  }

  const uploadsById = new Map(ownedUploads.map((upload) => [upload.assetId, upload]));
  let didChange = false;
  const nextAssets = currentProject.assets.map((asset) => {
    const upload = uploadsById.get(asset.id);
    if (!upload) {
      return asset;
    }

    const nextAsset = hydrateOwnedUploadAsset(asset, upload);
    if (
      nextAsset.src === asset.src &&
      nextAsset.name === asset.name &&
      nextAsset.note === asset.note &&
      nextAsset.bytes === asset.bytes &&
      nextAsset.width === asset.width &&
      nextAsset.height === asset.height &&
      JSON.stringify(nextAsset.variants ?? null) === JSON.stringify(asset.variants ?? null) &&
      JSON.stringify(nextAsset.delivery ?? null) === JSON.stringify(asset.delivery ?? null)
    ) {
      return asset;
    }

    didChange = true;
    return nextAsset;
  });

  return didChange
    ? {
        ...currentProject,
        assets: nextAssets,
      }
    : currentProject;
}

export async function saveProjectRecord({
  manual,
  getCurrentProject,
  onConflict,
  onSaveSuccess,
  session,
  project,
  projectRecord,
  lastSavedSnapshotRef,
  setSaveState,
  setMessage,
  createPersistableProjectSnapshot,
  applyServerProjectRecord,
  formatSavedAt,
  navigate,
}: SaveProjectRecordOptions) {
  const legacyReadOnly = Boolean(projectRecord && !projectRecord.ownerUserId && session?.role !== 'admin');
  const needsSession = !projectRecord || Boolean(projectRecord?.ownerUserId) || legacyReadOnly;
  if (legacyReadOnly) {
    setSaveState('error');
    setMessage('This legacy project is read-only. Duplicate it into your account before saving changes.');
    return;
  }

  if (needsSession && !session) {
    setSaveState(projectRecord ? 'error' : 'draft');
    setMessage(projectRecord ? 'Sign in again to save this owned project.' : 'Sign in to create a saved project link.');
    return;
  }

  const snapshot = JSON.stringify(project);
  if (projectRecord && snapshot === lastSavedSnapshotRef.current && !manual) {
    return;
  }

  if (project.assets.some((asset) => asset.src.startsWith('blob:') || asset.src.startsWith('guest-upload://'))) {
    setSaveState('dirty');
    setMessage('Local photos are still being attached. This folio will save automatically once they finish.');
    return;
  }

  const requestSnapshot = snapshot;
  setSaveState('saving');
  setMessage(projectRecord ? 'Saving changes to the server...' : 'Creating a stable editor URL on the server...');

  try {
    const projectToPersist = createPersistableProjectSnapshot(project);
    const record = projectRecord
      ? await persistProject(projectRecord.id, projectToPersist, projectRecord.rev, { autosave: !manual })
      : await createProject(projectToPersist);
    applyServerProjectRecord(record, projectRecord ? formatSavedAt(record.updatedAt) : CREATED_EDITOR_URL_MESSAGE, {
      requestSnapshot,
    });

    onSaveSuccess?.();

    if (!projectRecord) {
      startTransition(() => navigate(record.sharePath, { replace: true }));
    }
  } catch (error) {
    setSaveState('error');
    const messageText = error instanceof Error ? error.message : 'Save failed.';
    setMessage(messageText);

    if ((error as { code?: string }).code === 'revision_conflict') {
      onConflict?.(messageText);
    }

    if (manual && (error as { code?: string }).code === 'revision_conflict') {
      const reloadLatest = await confirmAction({
        title: 'This folio changed in another window',
        body: messageText,
        confirmLabel: 'Reload latest',
        cancelLabel: 'Keep editing',
      });
      if (reloadLatest && typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  }
}

export async function enableProjectShareLink({
  project,
  projectRecord,
  applyServerProjectRecord,
  setShareBusy,
  setShareCopyState,
  setMessage,
  rotate = false,
}: ProjectShareOptions & { rotate?: boolean }) {

  if (!projectRecord) {
    setMessage('Save this folio first, then enable a public share link.');
    return;
  }

  const requestSnapshot = JSON.stringify(project);
  setShareBusy(true);
  setShareCopyState('idle');
  setMessage(rotate ? 'Regenerating the public share link...' : 'Enabling the public share link...');

  try {
    const record = await enableProjectShare(projectRecord.id, { rotate });
    applyServerProjectRecord(record, rotate ? 'Public share link regenerated.' : 'Public share link enabled.', {
      requestSnapshot,
    });
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Unable to enable project sharing.');
  } finally {
    setShareBusy(false);
  }
}

export async function disableProjectShareLink({
  project,
  projectRecord,
  applyServerProjectRecord,
  setShareBusy,
  setShareCopyState,
  setMessage,
}: ProjectShareOptions) {
  if (!projectRecord?.share.enabled) {
    return;
  }

  const confirmed = await confirmAction({
    title: 'Disable this public share link?',
    body: 'Anyone using the current share URL will lose access immediately.',
    confirmLabel: 'Disable link',
    tone: 'danger',
  });
  if (!confirmed) {
    return;
  }

  setShareBusy(true);
  setShareCopyState('idle');
  setMessage('Turning off the public share link...');

  try {
    const record = await disableProjectShare(projectRecord.id);
    applyServerProjectRecord(record, 'Public share link disabled.', {
      requestSnapshot: JSON.stringify(project),
    });
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Unable to disable project sharing.');
  } finally {
    setShareBusy(false);
  }
}

export async function copyProjectShareLink(projectRecord: ProjectRecord | null, setShareCopyState: (state: CopyState) => void, setMessage: (message: string | null) => void) {
  if (!projectRecord?.share.enabled || !projectRecord.share.path) {
    return;
  }

  try {
    await navigator.clipboard.writeText(new URL(projectRecord.share.path, window.location.origin).toString());
    setShareCopyState('copied');
    window.setTimeout(() => setShareCopyState('idle'), 1800);
    setMessage('Public share link copied.');
  } catch {
    setShareCopyState('error');
    setMessage('Unable to copy the public share link.');
  }
}

export function startNewDraftProject({
  getInitialSlot,
  lastSavedSnapshotRef,
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
  navigate,
}: StartNewDraftOptions) {
  const freshState = buildDraftProjectHydration(createFreshDraft(), getInitialSlot);
  lastSavedSnapshotRef.current = freshState.snapshot;
  applyHydratedProjectState(freshState, {
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
  setMessage(DRAFT_ONLY_MESSAGE);
  setCopyState('idle');
  setShareCopyState('idle');
  startTransition(() => navigate('/editor'));
}
