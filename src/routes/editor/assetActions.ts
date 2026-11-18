import { countLabel, translate } from '../../i18n';
import { deleteOwnedAsset, type UserSession } from '../../editor/api';
import { getConfirmationMessage } from '../../editor/confirmations';
import { confirmAction } from '../../ui/confirm';
import type { Asset, PageData, ProjectRecord, ProjectState } from '../../editor/types';
import {
  assignAssetToProject,
  clearAssetPlacementsInProject,
  getUnusedProjectAssets,
  removeAssetFromIssue as removeAssetFromProjectState,
  removeUnusedAssetsFromProject,
  retryAssetMirrorForProject,
} from './assetOperations';

type UpdateProject = (updater: (current: ProjectState) => ProjectState) => void;
type UpdateSelectedPage = (updater: (page: PageData) => PageData) => void;
type ApplyServerProjectRecord = (record: ProjectRecord, nextMessage?: string) => void;
type SetMessage = (message: string | null) => void;
type SetBusy = (busy: boolean) => void;
type SetAssetTargetId = (assetId: string | null) => void;
type SetSelectedPageId = (pageId: string) => void;
type SetSelectedSlot = (slot: string | null) => void;
type SetTemplateChoice = (value: PageData['template']) => void;
type RemoveOwnedUpload = (assetId: string) => void;
type FocusPlacement = {
  pageId: string;
  slot: string;
};

type CreateEditorAssetActionsOptions = {
  project: ProjectState;
  projectRecord: ProjectRecord | null;
  session: UserSession | null;
  selectedPageId: string | null;
  selectedSlot: string | null;
  assetUsageCounts: Record<string, number>;
  assetsById: Record<string, Asset>;
  libraryAssetsById: Record<string, Asset>;
  updateProject: UpdateProject;
  updateSelectedPage: UpdateSelectedPage;
  applyServerProjectRecord: ApplyServerProjectRecord;
  setMessage: SetMessage;
  setAssetDeleteBusy: SetBusy;
  setAssetDeleteTargetId: SetAssetTargetId;
  setAssetRetryTargetId: SetAssetTargetId;
  setSelectedPageId: SetSelectedPageId;
  setSelectedSlot: SetSelectedSlot;
  setTemplateChoice: SetTemplateChoice;
  removeOwnedUpload: RemoveOwnedUpload;
};

export function createEditorAssetActions({
  project,
  projectRecord,
  session,
  selectedPageId,
  selectedSlot,
  assetUsageCounts,
  assetsById,
  libraryAssetsById,
  updateProject,
  updateSelectedPage,
  applyServerProjectRecord,
  setMessage,
  setAssetDeleteBusy,
  setAssetDeleteTargetId,
  setAssetRetryTargetId,
  setSelectedPageId,
  setSelectedSlot,
  setTemplateChoice,
  removeOwnedUpload,
}: CreateEditorAssetActionsOptions) {
  function assignAsset(slot: string, assetId: string) {
    const nextProject = assignAssetToProject({
      project,
      selectedPageId: selectedPageId ?? '',
      assetsById,
      libraryAssetsById,
      slot,
      assetId,
    });
    if (!nextProject) {
      return;
    }

    updateProject(() => nextProject);
  }

  function focusAssetPlacement(placement: FocusPlacement) {
    const nextPage = project.pages.find((page) => page.id === placement.pageId);
    if (!nextPage) {
      return;
    }

    setSelectedPageId(placement.pageId);
    setSelectedSlot(placement.slot);
    setTemplateChoice(nextPage.template);
  }

  function clearAssetPlacements(assetId: string) {
    const { nextProject, clearedCount } = clearAssetPlacementsInProject(project, assetId);
    if (!clearedCount) {
      setMessage(translate('This image is not placed on any page.'));
      return;
    }

    updateProject(() => nextProject);
    setMessage(
      translate('Image cleared from %s across this folio.').replace(
        '%s',
        countLabel(clearedCount, '1 frame', '%s frames'),
      ),
    );
  }

  function clearSelectedSlot() {
    if (!selectedSlot) {
      return;
    }

    updateSelectedPage((page) => ({
      ...page,
      slots: {
        ...page.slots,
        [selectedSlot]: null,
      },
    }));
  }

  async function removeAssetFromIssue(asset: Asset) {
    return removeAssetFromProjectState({
      asset,
      project,
      projectRecord,
      session,
      updateProject,
      applyServerProjectRecord,
    });
  }

  async function handleDeleteAsset(asset: Asset) {
    // The gallery lists account-library photos, so delete means deleting the
    // photo itself: out of this folio (clearing its frames) and out of the
    // account library, so the tile really disappears.
    const inProject = project.assets.some((entry) => entry.id === asset.id);
    const isServerUpload = asset.src.startsWith('/uploads/');
    const confirmed = await confirmAction({
      title: inProject ? 'Delete this photo from every folio and the library?' : 'Delete this photo from the library?',
      confirmLabel: 'Delete photo',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setAssetDeleteBusy(true);
    setAssetDeleteTargetId(asset.id);
    setMessage(translate('Deleting %s...').replace('%s', asset.name));

    try {
      let clearedPlacementCount = 0;
      // removeAssetFromIssue already deletes the library copy when the draft is
      // not server-backed; only delete here when it handled just the folio.
      const handledLibraryDelete = inProject && !projectRecord;
      if (inProject) {
        const removal = await removeAssetFromIssue(asset);
        clearedPlacementCount = removal.clearedPlacementCount;
      }
      if (isServerUpload && !handledLibraryDelete) {
        if (!session) {
          throw new Error(translate('Sign in to delete uploaded photos from the server.'));
        }
        try {
          await deleteOwnedAsset(asset.id);
        } catch (error) {
          if (error instanceof Error && error.message === 'Asset not found.') {
            // Already gone from the library; keep going so the tile disappears.
          } else if (error instanceof Error && /still referenced/i.test(error.message)) {
            throw new Error(
              translate('This photo is still used in another folio. Remove it there first, then delete it here.'),
            );
          } else {
            throw error;
          }
        }
      }
      removeOwnedUpload(asset.id);
      setMessage(
        clearedPlacementCount > 0
          ? translate('Deleted %s and cleared %s.').replace('%s', asset.name).replace(
              '%s',
              countLabel(clearedPlacementCount, '1 frame', '%s frames'),
            )
          : translate('Deleted %s.').replace('%s', asset.name),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : translate('Unable to delete this photo.'));
    } finally {
      setAssetDeleteBusy(false);
      setAssetDeleteTargetId(null);
    }
  }

  async function handleDeleteAssets(assets: Asset[]) {
    if (!assets.length) {
      return;
    }
    const confirmed = await confirmAction({
      title: translate('Delete %s photos from every folio and the library?').replace(
        '%s',
        String(assets.length),
      ),
      confirmLabel: 'Delete photos',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setAssetDeleteBusy(true);
    const ids = new Set(assets.map((asset) => asset.id));
    try {
      for (const asset of assets) {
        if (asset.src.startsWith('/uploads/') && session) {
          try {
            await deleteOwnedAsset(asset.id);
          } catch (error) {
            if (!(error instanceof Error) || !/not found/i.test(error.message)) {
              throw error;
            }
          }
        }
        removeOwnedUpload(asset.id);
      }
      updateProject((current) => ({
        ...current,
        assets: current.assets.filter((asset) => !ids.has(asset.id)),
        pages: current.pages.map((page) => ({
          ...page,
          slots: Object.fromEntries(
            Object.entries(page.slots).map(([slot, assetId]) => [
              slot,
              typeof assetId === 'string' && ids.has(assetId) ? null : assetId,
            ]),
          ),
        })),
      }));
      setMessage(translate('Deleted %s photos.').replace('%s', String(assets.length)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : translate('Unable to delete these photos.'));
    } finally {
      setAssetDeleteBusy(false);
      setAssetDeleteTargetId(null);
    }
  }

  async function handleRetryAssetMirror(asset: Asset) {
    setAssetRetryTargetId(asset.id);
    setMessage(translate('Retrying remote delivery for %s...').replace('%s', asset.name));

    try {
      await retryAssetMirrorForProject(asset, updateProject);
      setMessage(translate('Remote delivery retry queued.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : translate('Unable to retry remote delivery.'));
    } finally {
      setAssetRetryTargetId(null);
    }
  }

  async function removeUnusedAssetsFromIssue() {
    const removableAssets = getUnusedProjectAssets(project, assetUsageCounts);

    if (!removableAssets.length) {
      setMessage(translate('No unused uploads to remove from this folio.'));
      return;
    }

    const confirmed = await confirmAction({
      title: 'Remove unused photos?',
      body: getConfirmationMessage('removeUnusedAssets', { unusedAssetCount: removableAssets.length }),
      confirmLabel: 'Remove photos',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setAssetDeleteBusy(true);
    setAssetDeleteTargetId(null);
    setMessage(translate('Removing %s...').replace('%s', countLabel(removableAssets.length, '1 unused photo', '%s unused photos')));

    try {
      await removeUnusedAssetsFromProject({
        removableAssets,
        projectRecord,
        session,
        updateProject,
        applyServerProjectRecord,
      });
      setMessage(translate('Removed %s from this folio.').replace('%s', countLabel(removableAssets.length, '1 unused photo', '%s unused photos')));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : translate('Unable to remove unused photos.'));
    } finally {
      setAssetDeleteBusy(false);
      setAssetDeleteTargetId(null);
    }
  }

  return {
    assignAsset,
    clearAssetPlacements,
    clearSelectedSlot,
    focusAssetPlacement,
    handleDeleteAsset,
    handleDeleteAssets,
    handleRetryAssetMirror,
    removeUnusedAssetsFromIssue,
  };
}
