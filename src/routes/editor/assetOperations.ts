import {
  deleteOwnedAsset,
  deleteProjectAsset as deleteProjectAssetRecord,
  retryOwnedAssetObjectStorageSync,
  updateProject as persistProject,
  type UserSession,
} from '../../editor/api';
import { createDefaultCrop } from '../../editor/demoData';
import { removeAssetsFromProject } from '../../editor/storage';
import { Asset, ProjectRecord, ProjectState } from '../../editor/types';

type UpdateProject = (updater: (current: ProjectState) => ProjectState) => void;
type ApplyServerProjectRecord = (record: ProjectRecord, nextMessage?: string) => void;

export function assignAssetToProject({
  project,
  selectedPageId,
  assetsById,
  libraryAssetsById,
  slot,
  assetId,
}: {
  project: ProjectState;
  selectedPageId: string;
  assetsById: Record<string, Asset>;
  libraryAssetsById: Record<string, Asset>;
  slot: string;
  assetId: string;
}) {
  const usedAt = new Date().toISOString();
  const sourceAsset = libraryAssetsById[assetId] ?? assetsById[assetId];
  if (!selectedPageId || !sourceAsset) {
    return null;
  }

  return {
    ...project,
    assets: project.assets.some((asset) => asset.id === assetId)
      ? project.assets.map((asset) => (asset.id === assetId ? { ...asset, lastUsedAt: usedAt } : asset))
      : [{ ...sourceAsset, lastUsedAt: usedAt }, ...project.assets],
    pages: project.pages.map((page) => {
      if (page.id !== selectedPageId) {
        return page;
      }

      const currentAssetId = page.slots[slot];
      const currentCrop = page.crops[slot] ?? createDefaultCrop();
      return {
        ...page,
        slots: {
          ...page.slots,
          [slot]: assetId,
        },
        crops: {
          ...page.crops,
          [slot]:
            currentAssetId === assetId
              ? currentCrop
              : createDefaultCrop({
                  fit: currentCrop.fit,
                }),
        },
      };
    }),
  };
}

export function clearAssetPlacementsInProject(project: ProjectState, assetId: string) {
  let clearedCount = 0;

  const nextProject = {
    ...project,
    pages: project.pages.map((page) => {
      let didChange = false;
      const nextSlots = Object.fromEntries(
        Object.entries(page.slots).map(([slot, currentAssetId]) => {
          if (currentAssetId !== assetId) {
            return [slot, currentAssetId];
          }

          didChange = true;
          clearedCount += 1;
          return [slot, null];
        }),
      );

      return didChange
        ? {
            ...page,
            slots: nextSlots,
          }
        : page;
    }),
  };

  return {
    nextProject,
    clearedCount,
  };
}

export function getUnusedProjectAssets(project: ProjectState, assetUsageCounts: Record<string, number>) {
  return project.assets.filter((asset) => (assetUsageCounts[asset.id] ?? 0) === 0);
}

export async function removeAssetFromIssue({
  asset,
  project,
  projectRecord,
  session,
  updateProject,
  applyServerProjectRecord,
}: {
  asset: Asset;
  project: ProjectState;
  projectRecord: ProjectRecord | null;
  session: UserSession | null;
  updateProject: UpdateProject;
  applyServerProjectRecord: ApplyServerProjectRecord;
}) {
  const nextProject = removeAssetsFromProject(project, [asset.id]);
  if (nextProject.removedAssetCount === 0) {
    return {
      clearedPlacementCount: 0,
    };
  }

  if (projectRecord) {
    const record = await persistProject(projectRecord.id, nextProject.project);
    applyServerProjectRecord(record);
    return {
      clearedPlacementCount: nextProject.clearedPlacementCount,
    };
  }

  if (asset.src.startsWith('/uploads/')) {
    if (!session) {
      throw new Error('Sign in to delete uploaded photos from the server.');
    }

    try {
      await deleteOwnedAsset(asset.id);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'Asset not found.') {
        throw error;
      }
    }
  }

  updateProject(() => nextProject.project);
  return {
    clearedPlacementCount: nextProject.clearedPlacementCount,
  };
}

export async function retryAssetMirrorForProject(asset: Asset, updateProject: UpdateProject) {
  const payload = await retryOwnedAssetObjectStorageSync(asset.id);
  updateProject((current) => ({
    ...current,
    assets: current.assets.map((entry) => (entry.id === asset.id ? { ...entry, ...payload.asset } : entry)),
  }));
}

export async function removeUnusedAssetsFromProject({
  removableAssets,
  projectRecord,
  session,
  updateProject,
  applyServerProjectRecord,
}: {
  removableAssets: Asset[];
  projectRecord: ProjectRecord | null;
  session: UserSession | null;
  updateProject: UpdateProject;
  applyServerProjectRecord: ApplyServerProjectRecord;
}) {
  if (projectRecord) {
    let latestRecord = projectRecord;
    for (const asset of removableAssets) {
      latestRecord = await deleteProjectAssetRecord(latestRecord.id, asset.id);
    }
    applyServerProjectRecord(latestRecord);
    return;
  }

  for (const asset of removableAssets) {
    if (asset.src.startsWith('/uploads/')) {
      if (!session) {
        throw new Error('Sign in to delete uploaded photos from the server.');
      }
      await deleteOwnedAsset(asset.id);
    }
  }

  const removableIdSet = new Set(removableAssets.map((asset) => asset.id));
  updateProject((current) => ({
    ...current,
    assets: current.assets.filter((asset) => !removableIdSet.has(asset.id)),
  }));
}
