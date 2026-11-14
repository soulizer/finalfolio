import type { UserSession } from '../../editor/api';
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
      setMessage('This image is not placed on any page.');
      return;
    }

    updateProject(() => nextProject);
    setMessage('Image cleared from ' + clearedCount + ' frame' + (clearedCount === 1 ? '' : 's') + ' across this folio.');
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
    const confirmed = await confirmAction({
      title: 'Remove this photo from the folio?',
      body: getConfirmationMessage('removeIssueAsset', { assetName: asset.name }),
      confirmLabel: 'Remove photo',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setAssetDeleteBusy(true);
    setAssetDeleteTargetId(asset.id);
    setMessage('Removing ' + asset.name + '...');

    try {
      const removal = await removeAssetFromIssue(asset);
      setMessage(
        removal.clearedPlacementCount > 0
          ? 'Removed ' +
              asset.name +
              ' from this folio and cleared ' +
              removal.clearedPlacementCount +
              ' frame' +
              (removal.clearedPlacementCount === 1 ? '' : 's') +
              '.'
          : 'Removed ' + asset.name + ' from this folio.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to remove this photo.');
    } finally {
      setAssetDeleteBusy(false);
      setAssetDeleteTargetId(null);
    }
  }

  async function handleRetryAssetMirror(asset: Asset) {
    setAssetRetryTargetId(asset.id);
    setMessage('Retrying remote delivery for ' + asset.name + '...');

    try {
      await retryAssetMirrorForProject(asset, updateProject);
      setMessage('Remote delivery retry queued.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to retry remote delivery.');
    } finally {
      setAssetRetryTargetId(null);
    }
  }

  async function removeUnusedAssetsFromIssue() {
    const removableAssets = getUnusedProjectAssets(project, assetUsageCounts);

    if (!removableAssets.length) {
      setMessage('No unused uploads to remove from this folio.');
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
    setMessage('Removing ' + removableAssets.length + ' unused photo' + (removableAssets.length === 1 ? '' : 's') + '...');

    try {
      await removeUnusedAssetsFromProject({
        removableAssets,
        projectRecord,
        session,
        updateProject,
        applyServerProjectRecord,
      });
      setMessage('Removed ' + removableAssets.length + ' unused photo' + (removableAssets.length === 1 ? '' : 's') + ' from this folio.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to remove unused photos.');
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
    handleRetryAssetMirror,
    removeUnusedAssetsFromIssue,
  };
}
