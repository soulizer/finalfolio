import { createDefaultProject, normalizeProjectState } from './demoData';
import { Asset, ExportSettings, ProjectState } from './types';

const DRAFT_STORAGE_KEY = 'finalfolio-project-draft-v2';
const ASSET_REMOVAL_BROADCAST_KEY = 'finalfolio-draft-asset-removal-v1';
const ASSET_REMOVAL_EVENT = 'finalfolio:draft-asset-removal';
const EXPORT_SETTINGS_STORAGE_KEY = 'finalfolio-export-settings-v1';
const DRAFT_UPLOAD_DB_NAME = 'finalfolio-draft-uploads-v1';
const DRAFT_UPLOAD_STORE_NAME = 'uploads';
const PERSISTED_DRAFT_UPLOAD_SCHEME = 'guest-upload://';

export type DraftAssetRemovalDetail = {
  assetId: string;
  at: number;
};

type DraftUploadRecord = {
  assetId: string;
  blob: Blob;
  name: string;
  type: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  updatedAt: number;
};

type RestoredDraftProjectResult = {
  project: ProjectState;
  restoredAssetCount: number;
  missingAssetCount: number;
  clearedPlacementCount: number;
};

export function removeAssetsFromProject(project: ProjectState, assetIds: Iterable<string>) {
  const removedAssetIds = new Set(Array.from(assetIds));
  if (removedAssetIds.size === 0) {
    return {
      project,
      removedAssetCount: 0,
      clearedPlacementCount: 0,
    };
  }

  let removedAssetCount = 0;
  const nextAssets = project.assets.filter((asset) => {
    const shouldKeep = !removedAssetIds.has(asset.id);
    if (!shouldKeep) {
      removedAssetCount += 1;
    }
    return shouldKeep;
  });

  if (removedAssetCount === 0) {
    return {
      project,
      removedAssetCount: 0,
      clearedPlacementCount: 0,
    };
  }

  let clearedPlacementCount = 0;
  const nextPages = project.pages.map((page) => {
    let pageChanged = false;
    const nextSlots = Object.fromEntries(
      Object.entries(page.slots).map(([slot, assetId]) => {
        if (!assetId || !removedAssetIds.has(assetId)) {
          return [slot, assetId];
        }

        pageChanged = true;
        clearedPlacementCount += 1;
        return [slot, null];
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
    project: {
      ...project,
      assets: nextAssets,
      pages: nextPages,
    },
    removedAssetCount,
    clearedPlacementCount,
  };
}

export function removeAssetsFromDraft(assetIds: Iterable<string>) {
  const nextDraft = removeAssetsFromProject(readDraftProject(), assetIds);
  if (nextDraft.removedAssetCount > 0) {
    writeDraftProject(nextDraft.project);
  }
  return nextDraft;
}

export function broadcastDraftAssetRemoval(detail: DraftAssetRemovalDetail) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<DraftAssetRemovalDetail>(ASSET_REMOVAL_EVENT, { detail }));
  localStorage.setItem(ASSET_REMOVAL_BROADCAST_KEY, JSON.stringify(detail));
}

export function subscribeToDraftAssetRemoval(listener: (detail: DraftAssetRemovalDetail) => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleCustomEvent = (event: Event) => {
    const detail = (event as CustomEvent<DraftAssetRemovalDetail>).detail;
    if (detail?.assetId) {
      listener(detail);
    }
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== ASSET_REMOVAL_BROADCAST_KEY || !event.newValue) {
      return;
    }

    try {
      const detail = JSON.parse(event.newValue) as DraftAssetRemovalDetail;
      if (detail?.assetId) {
        listener(detail);
      }
    } catch {
      return;
    }
  };

  window.addEventListener(ASSET_REMOVAL_EVENT, handleCustomEvent as EventListener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(ASSET_REMOVAL_EVENT, handleCustomEvent as EventListener);
    window.removeEventListener('storage', handleStorage);
  };
}

// Uploads are written to IndexedDB before the project state contains the new asset.
// The draft-sync effect can run in that window and would otherwise delete the file it
// just saw. Ids stay protected until the project references them.
const pendingDraftUploadIds = new Set<string>();

export function createPersistedDraftUploadSource(assetId: string) {
  return `${PERSISTED_DRAFT_UPLOAD_SCHEME}${assetId}`;
}

export function isPersistedDraftUploadSource(source: string) {
  return source.startsWith(PERSISTED_DRAFT_UPLOAD_SCHEME);
}

function openDraftUploadDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve<IDBDatabase | null>(null);
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DRAFT_UPLOAD_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DRAFT_UPLOAD_STORE_NAME)) {
        database.createObjectStore(DRAFT_UPLOAD_STORE_NAME, { keyPath: 'assetId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open local draft upload storage.'));
  });
}

function withDraftUploadTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
) {
  return openDraftUploadDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        if (!database) {
          resolve(null as T);
          return;
        }

        const transaction = database.transaction(DRAFT_UPLOAD_STORE_NAME, mode);
        const store = transaction.objectStore(DRAFT_UPLOAD_STORE_NAME);
        let settled = false;

        const finishResolve = (value: T) => {
          if (!settled) {
            settled = true;
            resolve(value);
          }
        };
        const finishReject = (reason?: unknown) => {
          if (!settled) {
            settled = true;
            reject(reason);
          }
        };

        transaction.oncomplete = () => {
          database.close();
        };
        transaction.onabort = () => {
          database.close();
          finishReject(transaction.error ?? new Error('Local draft upload storage aborted.'));
        };
        transaction.onerror = () => {
          database.close();
          finishReject(transaction.error ?? new Error('Local draft upload storage failed.'));
        };

        try {
          run(store, finishResolve, finishReject);
        } catch (error) {
          database.close();
          finishReject(error);
        }
      }),
  );
}

function normalizeDraftAsset(asset: Asset): Asset {
  if (!(asset.src.startsWith('blob:') || isPersistedDraftUploadSource(asset.src))) {
    return asset;
  }

  const persistedSource = createPersistedDraftUploadSource(asset.id);
  const normalizedVariant = {
    src: persistedSource,
    ...(asset.width ? { width: asset.width } : {}),
    ...(asset.height ? { height: asset.height } : {}),
    ...(asset.bytes ? { bytes: asset.bytes } : {}),
    ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
  };

  return {
    ...asset,
    src: persistedSource,
    variants: {
      original: normalizedVariant,
      preview: normalizedVariant,
      thumb: normalizedVariant,
    },
    delivery: {
      state: 'local',
    },
    lastUsedAt: asset.lastUsedAt ?? null,
  };
}

function hydrateRestoredDraftAsset(asset: Asset, file: File): Asset {
  const objectUrl = URL.createObjectURL(file);
  const normalizedVariant = {
    src: objectUrl,
    ...(asset.width ? { width: asset.width } : {}),
    ...(asset.height ? { height: asset.height } : {}),
    ...(asset.bytes ?? file.size ? { bytes: asset.bytes ?? file.size } : {}),
    ...((asset.mimeType || file.type) ? { mimeType: asset.mimeType || file.type } : {}),
  };

  return {
    ...asset,
    src: objectUrl,
    bytes: asset.bytes ?? file.size,
    mimeType: asset.mimeType || file.type || undefined,
    variants: {
      original: normalizedVariant,
      preview: normalizedVariant,
      thumb: normalizedVariant,
    },
    delivery: {
      state: 'local',
    },
    lastUsedAt: asset.lastUsedAt ?? null,
  };
}

export async function writePersistedDraftUpload(
  assetId: string,
  file: File,
  {
    width,
    height,
  }: {
    width?: number;
    height?: number;
  } = {},
) {
  pendingDraftUploadIds.add(assetId);

  try {
    await withDraftUploadTransaction<void>('readwrite', (store, resolve, reject) => {
      const request = store.put({
        assetId,
        blob: file,
        name: file.name,
        type: file.type,
        width: typeof width === 'number' ? width : null,
        height: typeof height === 'number' ? height : null,
        bytes: typeof file.size === 'number' ? file.size : null,
        updatedAt: Date.now(),
      } satisfies DraftUploadRecord);

      request.onsuccess = () => resolve(undefined);
      request.onerror = () => reject(request.error ?? new Error('Unable to cache this local draft upload.'));
    });
  } catch (error) {
    pendingDraftUploadIds.delete(assetId);
    throw error;
  }
}

export async function readPersistedDraftUploadFile(
  assetId: string,
  {
    fallbackName = `${assetId}.jpg`,
    fallbackType,
  }: {
    fallbackName?: string;
    fallbackType?: string;
  } = {},
) {
  const record = await withDraftUploadTransaction<DraftUploadRecord | null>('readonly', (store, resolve, reject) => {
    const request = store.get(assetId);

    request.onsuccess = () => resolve((request.result as DraftUploadRecord | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Unable to read this cached draft upload.'));
  });

  if (!record?.blob) {
    return null;
  }

  return new File([record.blob], record.name || fallbackName, {
    type: record.type || fallbackType || record.blob.type || 'application/octet-stream',
    lastModified: record.updatedAt || Date.now(),
  });
}

export async function removePersistedDraftUpload(assetId: string) {
  pendingDraftUploadIds.delete(assetId);
  await withDraftUploadTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(assetId);
    request.onsuccess = () => resolve(undefined);
    request.onerror = () => reject(request.error ?? new Error('Unable to remove this cached draft upload.'));
  });
}

async function listPersistedDraftUploadIds() {
  const keys =
    (await withDraftUploadTransaction<IDBValidKey[] | null>('readonly', (store, resolve, reject) => {
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error ?? new Error('Unable to inspect cached draft uploads.'));
    })) ?? [];

  return keys.map((value) => String(value));
}

export async function syncPersistedDraftUploads(project: ProjectState) {
  const activeDraftUploadIds = new Set(
    project.assets
      .filter((asset) => asset.src.startsWith('blob:') || isPersistedDraftUploadSource(asset.src))
      .map((asset) => asset.id),
  );
  const storedIds = await listPersistedDraftUploadIds();
  const removableIds = storedIds.filter(
    (assetId) => !activeDraftUploadIds.has(assetId) && !pendingDraftUploadIds.has(assetId),
  );

  await Promise.all(removableIds.map((assetId) => removePersistedDraftUpload(assetId)));

  // Once the project references the upload the normal lifecycle can manage it again.
  activeDraftUploadIds.forEach((assetId) => pendingDraftUploadIds.delete(assetId));
}

export async function clearPersistedDraftUploads() {
  pendingDraftUploadIds.clear();
  await withDraftUploadTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve(undefined);
    request.onerror = () => reject(request.error ?? new Error('Unable to clear cached draft uploads.'));
  });
}

export async function restoreDraftProjectUploads(project: ProjectState): Promise<RestoredDraftProjectResult> {
  const persistedDraftAssets = project.assets.filter((asset) => isPersistedDraftUploadSource(asset.src));
  if (persistedDraftAssets.length === 0) {
    return {
      project,
      restoredAssetCount: 0,
      missingAssetCount: 0,
      clearedPlacementCount: 0,
    };
  }

  const restoredAssetsById = new Map<string, Asset>();
  const missingAssetIds: string[] = [];

  for (const asset of persistedDraftAssets) {
    const file = await readPersistedDraftUploadFile(asset.id, {
      fallbackName: asset.name,
      fallbackType: asset.mimeType,
    });

    if (!file) {
      missingAssetIds.push(asset.id);
      continue;
    }

    restoredAssetsById.set(asset.id, hydrateRestoredDraftAsset(asset, file));
  }

  const removal = missingAssetIds.length ? removeAssetsFromProject(project, missingAssetIds) : null;
  const baseProject = removal ? removal.project : project;

  return {
    project:
      restoredAssetsById.size > 0
        ? {
            ...baseProject,
            assets: baseProject.assets.map((asset) => restoredAssetsById.get(asset.id) ?? asset),
          }
        : baseProject,
    restoredAssetCount: restoredAssetsById.size,
    missingAssetCount: missingAssetIds.length,
    clearedPlacementCount: removal?.clearedPlacementCount ?? 0,
  };
}

export function readDraftProject() {
  const stored = localStorage.getItem(DRAFT_STORAGE_KEY);

  if (!stored) {
    return createDefaultProject();
  }

  try {
    return normalizeProjectState(JSON.parse(stored) as ProjectState);
  } catch {
    return createDefaultProject();
  }
}

export function writeDraftProject(project: ProjectState) {
  const sanitizedProject = {
    ...project,
    assets: project.assets.map((asset) => normalizeDraftAsset(asset)),
  };
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(sanitizedProject));
}

export function clearDraftProject() {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
  void clearPersistedDraftUploads();
}

function normalizeExportSettings(record: unknown): ExportSettings | null {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const candidate = record as Partial<ExportSettings>;
  const format = candidate.format === 'project' || candidate.format === 'jpg' ? candidate.format : candidate.format === 'pdf' ? 'pdf' : null;
  const pageSize =
    candidate.pageSize === 'a5' || candidate.pageSize === 'a4' || candidate.pageSize === 'a3' ? candidate.pageSize : null;
  const quality =
    candidate.quality === 'draft' || candidate.quality === 'standard' || candidate.quality === 'print' ? candidate.quality : null;
  const jpgMode = candidate.jpgMode === 'combined' || candidate.jpgMode === 'separate' ? candidate.jpgMode : 'separate';

  if (!format || !pageSize || !quality) {
    return null;
  }

  return {
    format,
    pageSize,
    quality,
    jpgMode,
  };
}

export function readStoredExportSettings() {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = localStorage.getItem(EXPORT_SETTINGS_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    return normalizeExportSettings(JSON.parse(stored));
  } catch {
    return null;
  }
}

export function writeStoredExportSettings(settings: ExportSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(EXPORT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
