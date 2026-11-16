import type { NavigateFunction } from 'react-router-dom';
import {
  type AccountUploadListItem,
  type UploadRequestProgress,
  uploadAssets,
  type UserSession,
} from '../../editor/api';
import { countLabel, translate } from '../../i18n';
import { getUserPrimaryIdentity } from '../../editor/identity';
import { optimizeUploadFiles, type PreparedUploadItem, readImageIntrinsicSize } from '../../editor/imageOptimization';
import {
  isPersistedDraftUploadSource,
  readPersistedDraftUploadFile,
  removeAssetsFromProject,
  removePersistedDraftUpload,
  writePersistedDraftUpload,
} from '../../editor/storage';
import type { Asset, ProjectState } from '../../editor/types';
import { buildTermsPath } from '../../legal/terms';
import { hydrateOwnedUploadAsset } from './projectPersistence';
import { createIdleUploadState, updateUploadQueueItem, type UploadState } from './uploadState';

type SetProjectState = (value: ProjectState | ((current: ProjectState) => ProjectState)) => void;
type UpdateProject = (updater: (current: ProjectState) => ProjectState) => void;
type SetUploadState = (value: UploadState | ((current: UploadState) => UploadState)) => void;
type SetMessage = (message: string | null) => void;

type PromoteGuestDraftUploadsOptions = {
  guestAssets: Asset[];
  setProject: SetProjectState;
  setUploadState: SetUploadState;
  isCancelled: () => boolean;
};

type PromoteGuestDraftUploadsResult = {
  completedFiles: number;
  failedFiles: number;
  cancelled: boolean;
};

type UploadFilesIntoProjectOptions = {
  files: File[];
  navigate: NavigateFunction;
  session: UserSession | null;
  setMessage: SetMessage;
  setUploadState: SetUploadState;
  updateProject: UpdateProject;
};

type CreateEditorUploadActionsOptions = {
  navigate: NavigateFunction;
  session: UserSession | null;
  setProject: SetProjectState;
  setMessage: SetMessage;
  setUploadState: SetUploadState;
  updateProject: UpdateProject;
};

type ReconcileDraftOwnedUploadsResult = {
  project: ProjectState;
  didChange: boolean;
  message: string | null;
};

function createGuestDraftUploadId() {
  return `guest-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

function createGuestDraftUploadAsset(preparedItem: PreparedUploadItem, assetId = createGuestDraftUploadId()): Asset {
  const src = URL.createObjectURL(preparedItem.file);
  const originalVariant = {
    src,
    width: preparedItem.width,
    height: preparedItem.height,
    bytes: preparedItem.file.size,
    mimeType: preparedItem.file.type,
  };

  return {
    id: assetId,
    name: preparedItem.file.name,
    src,
    note: '',
    width: preparedItem.width,
    height: preparedItem.height,
    bytes: preparedItem.file.size,
    mimeType: preparedItem.file.type,
    variants: {
      original: originalVariant,
      preview: originalVariant,
      thumb: originalVariant,
    },
    delivery: {
      state: 'local',
    },
    lastUsedAt: null,
  };
}

function replaceProjectAsset(project: ProjectState, currentAssetId: string, nextAsset: Asset) {
  let assetReplaced = false;
  const nextAssets = project.assets.map((asset) => {
    if (asset.id !== currentAssetId) {
      return asset;
    }

    assetReplaced = true;
    return nextAsset;
  });

  if (!assetReplaced) {
    return project;
  }

  const nextPages = project.pages.map((page) => {
    let pageChanged = false;
    const nextSlots = Object.fromEntries(
      Object.entries(page.slots).map(([slot, assetId]) => {
        if (assetId !== currentAssetId) {
          return [slot, assetId];
        }

        pageChanged = true;
        return [slot, nextAsset.id];
      }),
    );

    return pageChanged
      ? {
          ...page,
          slots: nextSlots,
        }
      : page;
  });

  return {
    ...project,
    assets: nextAssets,
    pages: nextPages,
  };
}

async function readGuestDraftUploadFile(asset: Asset) {
  const persistedFile = await readPersistedDraftUploadFile(asset.id, {
    fallbackName: asset.name,
    fallbackType: asset.mimeType,
  });
  if (persistedFile) {
    return persistedFile;
  }

  if (!asset.src.startsWith('blob:')) {
    return null;
  }

  try {
    const response = await fetch(asset.src);
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    return new File([blob], asset.name || `${asset.id}.jpg`, {
      type: asset.mimeType || blob.type || 'application/octet-stream',
      lastModified: Date.now(),
    });
  } catch {
    return null;
  }
}

function redirectToTerms(navigate: NavigateFunction) {
  navigate(buildTermsPath(`${window.location.pathname}${window.location.search}${window.location.hash}`), { replace: true });
}

export function isServerBackedUploadAsset(asset: Asset) {
  return asset.src.startsWith('/uploads/');
}

export function isEphemeralDraftUploadAsset(asset: Asset) {
  return asset.src.startsWith('blob:');
}

export function isGuestDraftUploadAsset(asset: Asset) {
  return isEphemeralDraftUploadAsset(asset) || isPersistedDraftUploadSource(asset.src);
}

export function stripServerBackedUploadsFromDraft(project: ProjectState) {
  return removeAssetsFromProject(
    project,
    project.assets.filter(isServerBackedUploadAsset).map((asset) => asset.id),
  );
}

export function createAssetFromOwnedUpload(upload: AccountUploadListItem): Asset {
  const originalMimeType = upload.original?.mimeType ?? upload.preview?.mimeType ?? upload.thumb?.mimeType ?? undefined;
  const originalVariant = upload.original ?? {
    src: upload.src,
    ...(upload.width ? { width: upload.width } : {}),
    ...(upload.height ? { height: upload.height } : {}),
    ...(upload.bytes ? { bytes: upload.bytes } : {}),
    ...(originalMimeType ? { mimeType: originalMimeType } : {}),
  };

  return {
    id: upload.assetId,
    name: upload.name || upload.filename,
    src: upload.src,
    note: upload.note,
    ...(upload.width ? { width: upload.width } : {}),
    ...(upload.height ? { height: upload.height } : {}),
    ...(upload.bytes ? { bytes: upload.bytes } : {}),
    ...(originalMimeType ? { mimeType: originalMimeType } : {}),
    variants: {
      original: originalVariant,
      preview: upload.preview ?? null,
      thumb: upload.thumb ?? null,
    },
    delivery: upload.delivery,
    lastUsedAt: upload.lastUsedAt ?? null,
  };
}

export function createRecoveredGuestUploadTransferState(guestAssets: Asset[]): UploadState {
  return {
    ...createIdleUploadState(),
    phase: 'uploading',
    totalFiles: guestAssets.length,
    currentFileIndex: 1,
    currentFileName: guestAssets[0]?.name ?? '',
    originalBytes: guestAssets.reduce((total, asset) => total + (asset.bytes ?? 0), 0),
    optimizedBytes: guestAssets.reduce((total, asset) => total + (asset.bytes ?? 0), 0),
    currentFileTotalBytes: Math.max(guestAssets[0]?.bytes ?? 0, 1),
    queue: guestAssets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      state: 'queued',
      error: null,
    })),
  };
}

export function createRecoveredGuestUploadTransferIntro(guestAssets: Asset[], session: UserSession) {
  return translate('Restored %s. Attaching them to %s now...')
    .replace('%s', countLabel(guestAssets.length, '1 local photo', '%s local photos'))
    .replace('%s', getUserPrimaryIdentity(session));
}

export function createRecoveredGuestUploadTransferSummary(
  result: PromoteGuestDraftUploadsResult,
  session: UserSession,
) {
  if (result.failedFiles > 0) {
    return result.completedFiles > 0
      ? translate('Attached %s to your account. %s still need attention.')
          .replace('%s', countLabel(result.completedFiles, '1 recovered photo', '%s recovered photos'))
          .replace('%s', countLabel(result.failedFiles, '1 photo', '%s photos'))
      : translate('Recovered local photos are still here, but %s could not be attached to your account automatically.').replace(
          '%s',
          countLabel(result.failedFiles, '1 photo', '%s photos'),
        );
  }

  return translate('Attached %s to %s. You can save this folio now.')
    .replace('%s', countLabel(result.completedFiles, '1 recovered photo', '%s recovered photos'))
    .replace('%s', getUserPrimaryIdentity(session));
}

export async function promoteGuestDraftUploads({
  guestAssets,
  setProject,
  setUploadState,
  isCancelled,
}: PromoteGuestDraftUploadsOptions): Promise<PromoteGuestDraftUploadsResult> {
  let completedFiles = 0;
  let failedFiles = 0;

  for (let index = 0; index < guestAssets.length; index += 1) {
    const guestAsset = guestAssets[index];
    const nextFileName = guestAssets[index + 1]?.name ?? '';

    if (isCancelled()) {
      return {
        completedFiles,
        failedFiles,
        cancelled: true,
      };
    }

    try {
      setUploadState((current) => ({
        ...current,
        phase: 'uploading',
        currentFileIndex: index + 1,
        currentFileName: guestAsset.name,
        completedFiles,
        currentFileLoadedBytes: 0,
        currentFileTotalBytes: Math.max(guestAsset.bytes ?? 0, 1),
        queue: updateUploadQueueItem(current.queue, guestAsset.id, {
          state: 'uploading',
          error: null,
        }),
      }));

      const file = await readGuestDraftUploadFile(guestAsset);
      if (!file) {
        throw new Error('Missing local draft upload payload.');
      }
      const intrinsicSize = guestAsset.width && guestAsset.height ? null : await readImageIntrinsicSize(file);
      const uploadWidth = guestAsset.width ?? intrinsicSize?.width ?? 1;
      const uploadHeight = guestAsset.height ?? intrinsicSize?.height ?? 1;

      const uploads = await uploadAssets(
        [file],
        [
          {
            width: uploadWidth,
            height: uploadHeight,
          },
        ],
        (progress: UploadRequestProgress) => {
          setUploadState((current) => ({
            ...current,
            phase: 'uploading',
            currentFileIndex: index + 1,
            currentFileName: guestAsset.name,
            completedFiles,
            currentFileLoadedBytes: progress.loadedBytes,
            currentFileTotalBytes: progress.totalBytes,
            queue: updateUploadQueueItem(current.queue, guestAsset.id, {
              state: 'uploading',
              error: null,
            }),
          }));
        },
      );
      const uploadedAsset = uploads[0];
      if (!uploadedAsset) {
        throw new Error('The upload completed without returning an asset record.');
      }

      const hydratedUpload = {
        ...uploadedAsset,
        width: guestAsset.width ?? uploadedAsset.width ?? uploadWidth,
        height: guestAsset.height ?? uploadedAsset.height ?? uploadHeight,
      };

      setProject((current) => replaceProjectAsset(current, guestAsset.id, hydratedUpload));
      await removePersistedDraftUpload(guestAsset.id).catch(() => null);

      completedFiles += 1;
      setUploadState((current) => ({
        ...current,
        phase: index + 1 < guestAssets.length ? 'uploading' : 'idle',
        completedFiles,
        currentFileIndex: index + 1 < guestAssets.length ? index + 2 : 0,
        currentFileName: nextFileName,
        currentFileLoadedBytes: 0,
        currentFileTotalBytes: 0,
        queue: updateUploadQueueItem(current.queue, guestAsset.id, {
          state: 'complete',
          error: null,
        }),
      }));
    } catch (error) {
      failedFiles += 1;
      const errorMessage = error instanceof Error ? error.message : 'Unable to attach this recovered photo.';
      setUploadState((current) => ({
        ...current,
        phase: index + 1 < guestAssets.length ? 'uploading' : 'idle',
        completedFiles,
        currentFileIndex: index + 1 < guestAssets.length ? index + 2 : 0,
        currentFileName: nextFileName,
        currentFileLoadedBytes: 0,
        currentFileTotalBytes: 0,
        queue: updateUploadQueueItem(current.queue, guestAsset.id, {
          state: 'failed',
          error: errorMessage,
        }),
      }));
    }
  }

  return {
    completedFiles,
    failedFiles,
    cancelled: false,
  };
}

export async function uploadFilesIntoProject({
  files,
  navigate,
  session,
  setMessage,
  setUploadState,
  updateProject,
}: UploadFilesIntoProjectOptions) {
  const guestMode = !session;
  const originalBytes = files.reduce((total, file) => total + file.size, 0);
  const queue = files.map((file, index) => ({
    id: `${Date.now()}-${index}-${file.name}`,
    name: file.name,
    state: 'queued' as const,
    error: null,
  }));
  let completedFiles = 0;
  let optimizedBytes = 0;
  let failedFiles = 0;

  setUploadState({
    ...createIdleUploadState(),
    phase: 'preparing',
    totalFiles: files.length,
    currentFileIndex: 1,
    currentFileName: files[0].name,
    originalBytes,
    queue,
  });
  setMessage(
    guestMode
      ? `Adding ${files.length} photo${files.length === 1 ? '' : 's'} to this local draft...`
      : `Uploading ${files.length} photo${files.length === 1 ? '' : 's'} one by one...`,
  );

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const nextFileName = files[index + 1]?.name ?? '';
    const queueItemId = queue[index].id;

    try {
      setUploadState((current) => ({
        ...current,
        phase: 'preparing',
        currentFileIndex: index + 1,
        currentFileName: file.name,
        completedFiles,
        currentFileLoadedBytes: 0,
        currentFileTotalBytes: 0,
        queue: updateUploadQueueItem(current.queue, queueItemId, {
          state: 'preparing',
          error: null,
        }),
      }));

      const prepared = await optimizeUploadFiles([file]);
      const preparedItem = prepared.items[0];
      if (!preparedItem) {
        throw new Error('Unable to prepare this photo for upload.');
      }

      optimizedBytes += prepared.optimizedBytes;
      setUploadState((current) => ({
        ...current,
        phase: 'uploading',
        currentFileIndex: index + 1,
        currentFileName: file.name,
        completedFiles,
        optimizedBytes,
        currentFileLoadedBytes: 0,
        currentFileTotalBytes: Math.max(preparedItem.file.size, 1),
        queue: updateUploadQueueItem(current.queue, queueItemId, {
          state: 'uploading',
          error: null,
        }),
      }));

      if (guestMode) {
        const assetId = createGuestDraftUploadId();
        await writePersistedDraftUpload(assetId, preparedItem.file, {
          width: preparedItem.width,
          height: preparedItem.height,
        });
        const localAsset = createGuestDraftUploadAsset(preparedItem, assetId);
        updateProject((current) => ({
          ...current,
          assets: [localAsset, ...current.assets],
        }));
        completedFiles += 1;
        setUploadState((current) => ({
          ...current,
          phase: index + 1 < files.length ? 'preparing' : 'idle',
          completedFiles,
          currentFileIndex: index + 1 < files.length ? index + 2 : 0,
          currentFileName: nextFileName,
          optimizedBytes,
          currentFileLoadedBytes: 0,
          currentFileTotalBytes: 0,
          queue: updateUploadQueueItem(current.queue, queueItemId, {
            state: 'complete',
            error: null,
          }),
        }));
        setMessage(
          translate('Added %s locally. %s/%s photos ready in this local draft.')
            .replace('%s', file.name)
            .replace('%s', String(completedFiles))
            .replace('%s', String(files.length)),
        );
        continue;
      }

      const uploads = await uploadAssets(
        [preparedItem.file],
        [
          {
            width: preparedItem.width,
            height: preparedItem.height,
          },
        ],
        (progress: UploadRequestProgress) => {
          setUploadState((current) => ({
            ...current,
            phase: 'uploading',
            currentFileIndex: index + 1,
            currentFileName: file.name,
            completedFiles,
            optimizedBytes,
            currentFileLoadedBytes: progress.loadedBytes,
            currentFileTotalBytes: progress.totalBytes,
            queue: updateUploadQueueItem(current.queue, queueItemId, {
              state: 'uploading',
              error: null,
            }),
          }));
        },
      );
      const uploadedAsset = uploads[0];
      if (!uploadedAsset) {
        throw new Error('The upload completed without returning an asset record.');
      }

      const hydratedUpload = {
        ...uploadedAsset,
        width: preparedItem.width ?? uploadedAsset.width,
        height: preparedItem.height ?? uploadedAsset.height,
      };
      updateProject((current) => ({
        ...current,
        assets: [hydratedUpload, ...current.assets],
      }));
      completedFiles += 1;
      setUploadState((current) => ({
        ...current,
        phase: index + 1 < files.length ? 'preparing' : 'idle',
        completedFiles,
        currentFileIndex: index + 1 < files.length ? index + 2 : 0,
        currentFileName: nextFileName,
        optimizedBytes,
        currentFileLoadedBytes: 0,
        currentFileTotalBytes: 0,
        queue: updateUploadQueueItem(current.queue, queueItemId, {
          state: 'complete',
          error: null,
        }),
      }));
      setMessage(
        translate('Added %s. %s/%s photos ready in the library.')
          .replace('%s', file.name)
          .replace('%s', String(completedFiles))
          .replace('%s', String(files.length)),
      );
    } catch (error) {
      if ((error as Error & { code?: string })?.code === 'terms_required') {
        redirectToTerms(navigate);
        return;
      }

      failedFiles += 1;
      const errorMessage = error instanceof Error ? error.message : 'Upload failed.';
      setUploadState((current) => ({
        ...current,
        phase: index + 1 < files.length ? 'preparing' : 'idle',
        completedFiles,
        currentFileIndex: index + 1 < files.length ? index + 2 : 0,
        currentFileName: nextFileName,
        optimizedBytes,
        currentFileLoadedBytes: 0,
        currentFileTotalBytes: 0,
        queue: updateUploadQueueItem(current.queue, queueItemId, {
          state: 'failed',
          error: errorMessage,
        }),
      }));
      setMessage(translate('%s failed. Continuing with the remaining uploads.').replace('%s', file.name));
    }
  }

  if (failedFiles > 0) {
    setMessage(
      completedFiles > 0
        ? translate('%s added. %s failed without blocking the rest.')
            .replace('%s', countLabel(completedFiles, '1 photo', '%s photos'))
            .replace('%s', countLabel(failedFiles, '1 photo', '%s photos'))
        : translate('%s failed. No uploads were added.').replace(
            '%s',
            countLabel(failedFiles, '1 photo', '%s photos'),
          ),
    );
    return;
  }

  setMessage(
    guestMode
      ? translate('%s added locally for this session.').replace(
          '%s',
          countLabel(completedFiles, '1 photo', '%s photos'),
        )
      : translate('%s added.').replace('%s', countLabel(completedFiles, '1 photo', '%s photos')),
  );
}

export function createEditorUploadActions({
  navigate,
  session,
  setProject,
  setMessage,
  setUploadState,
  updateProject,
}: CreateEditorUploadActionsOptions) {
  function reconcileDraftOwnedUploads(ownedUploads: AccountUploadListItem[], { silent = false } = {}) {
    let nextMessage: string | null = null;

    setProject((current) => {
      const result = reconcileDraftOwnedUploadState(current, ownedUploads, { silent });
      nextMessage = result.message;
      return result.project;
    });

    if (nextMessage) {
      setMessage(nextMessage);
    }
  }

  async function handleUploadFiles(files: File[]) {
    await uploadFilesIntoProject({
      files,
      navigate,
      session,
      setMessage,
      setUploadState,
      updateProject,
    });
  }

  return {
    handleUploadFiles,
    reconcileDraftOwnedUploads,
  };
}

export function reconcileDraftOwnedUploadState(
  current: ProjectState,
  ownedUploads: AccountUploadListItem[],
  { silent = false }: { silent?: boolean } = {},
): ReconcileDraftOwnedUploadsResult {
  const uploadsById = new Map(ownedUploads.map((upload) => [upload.assetId, upload]));
  let message: string | null = null;
  let detectedFailure = false;

  const staleAssetIds = current.assets
    .filter((asset) => isServerBackedUploadAsset(asset) && !uploadsById.has(asset.id))
    .map((asset) => asset.id);
  const removal = staleAssetIds.length ? removeAssetsFromProject(current, staleAssetIds) : null;
  const baseProject = removal ? removal.project : current;
  let didChange = Boolean(removal?.removedAssetCount);

  const nextAssets = baseProject.assets.map((asset) => {
    const upload = uploadsById.get(asset.id);
    if (!upload) {
      return asset;
    }

    const nextAsset = hydrateOwnedUploadAsset(asset, upload);
    if (
      JSON.stringify(nextAsset.variants ?? null) === JSON.stringify(asset.variants ?? null) &&
      JSON.stringify(nextAsset.delivery ?? null) === JSON.stringify(asset.delivery ?? null) &&
      nextAsset.bytes === asset.bytes &&
      nextAsset.width === asset.width &&
      nextAsset.height === asset.height &&
      nextAsset.note === asset.note &&
      nextAsset.src === asset.src
    ) {
      return asset;
    }

    if (asset.delivery?.state !== 'failed' && upload.delivery.state === 'failed') {
      detectedFailure = true;
    }

    didChange = true;
    return nextAsset;
  });

  if (!didChange) {
    return {
      project: current,
      didChange: false,
      message: null,
    };
  }

  if (removal?.removedAssetCount && !silent) {
    message =
      removal.clearedPlacementCount > 0
        ? `Removed ${removal.removedAssetCount} unavailable photo${removal.removedAssetCount === 1 ? '' : 's'} from this draft and cleared ${removal.clearedPlacementCount} frame${removal.clearedPlacementCount === 1 ? '' : 's'}.`
        : `Removed ${removal.removedAssetCount} unavailable photo${removal.removedAssetCount === 1 ? '' : 's'} from this draft.`;
  } else if (detectedFailure && !silent) {
    message = 'One or more upload mirrors failed. Retry delivery from Account or Admin to restore remote access.';
  }

  return {
    project: {
      ...baseProject,
      assets: nextAssets,
    },
    didChange: true,
    message,
  };
}
