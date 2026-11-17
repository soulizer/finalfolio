import { useEffect, useRef } from 'react';
import { countLabel, translate } from '../../i18n';
import { type AccountUploadListItem, fetchAccountUploads, type UserSession } from '../../editor/api';
import { getAssetSource } from '../../editor/assetResources';
import { readImageIntrinsicSize } from '../../editor/imageOptimization';
import { removeAssetsFromProject, subscribeToDraftAssetRemoval } from '../../editor/storage';
import type { Asset, ProjectRecord, ProjectState } from '../../editor/types';
import {
  createRecoveredGuestUploadTransferIntro,
  createRecoveredGuestUploadTransferState,
  createRecoveredGuestUploadTransferSummary,
  isEphemeralDraftUploadAsset,
  isGuestDraftUploadAsset,
  promoteGuestDraftUploads,
  reconcileDraftOwnedUploadState,
  stripServerBackedUploadsFromDraft,
} from './uploadOperations';
import { createIdleUploadState, type UploadState } from './uploadState';

type LoadState = 'loading' | 'ready' | 'error';
type SetProjectState = (value: ProjectState | ((current: ProjectState) => ProjectState)) => void;
type SetUploadState = (value: UploadState | ((current: UploadState) => UploadState)) => void;
type SetOwnedUploads = (uploads: AccountUploadListItem[]) => void;

type UseEditorAssetLifecycleOptions = {
  authReady: boolean;
  authRefreshFailed: boolean;
  guestDraftAssetFingerprint: string;
  guestUploadTransferBusy: boolean;
  hasPendingProjectUploads: boolean;
  loadState: LoadState;
  printAssetFingerprintRef: { current: string };
  project: ProjectState;
  projectRecord: ProjectRecord | null;
  serverBackedAssetFingerprint: string;
  session: UserSession | null;
  setGuestUploadTransferBusy: (busy: boolean) => void;
  setMessage: (message: string | null) => void;
  setOwnedUploads: SetOwnedUploads;
  setPrintAssetsById: (assetsById: Record<string, Asset> | null) => void;
  setProject: SetProjectState;
  setUploadState: SetUploadState;
  uploadBusy: boolean;
  usedAssetFingerprint: string;
};

export function useEditorAssetLifecycle({
  authReady,
  authRefreshFailed,
  guestDraftAssetFingerprint,
  guestUploadTransferBusy,
  hasPendingProjectUploads,
  loadState,
  printAssetFingerprintRef,
  project,
  projectRecord,
  serverBackedAssetFingerprint,
  session,
  setGuestUploadTransferBusy,
  setMessage,
  setOwnedUploads,
  setPrintAssetsById,
  setProject,
  setUploadState,
  uploadBusy,
  usedAssetFingerprint,
}: UseEditorAssetLifecycleOptions) {
  const ephemeralAssetUrlsRef = useRef<Record<string, string>>({});
  const guestUploadPromotionFingerprintRef = useRef('');

  useEffect(() => {
    return subscribeToDraftAssetRemoval(({ assetId }) => {
      const nextProject = removeAssetsFromProject(project, [assetId]);
      if (nextProject.removedAssetCount === 0) {
        return;
      }

      setProject(nextProject.project);
      setMessage(
        nextProject.clearedPlacementCount > 0
          ? translate(
              'This photo was deleted from My uploads, so it was also removed from this draft and cleared from %s.',
            ).replace(
              '%s',
              countLabel(nextProject.clearedPlacementCount, '1 frame', '%s frames'),
            )
          : translate('This photo was deleted from My uploads, so it was also removed from this draft.'),
      );
    });
  }, [project, setMessage, setProject]);

  useEffect(() => {
    if (!session) {
      guestUploadPromotionFingerprintRef.current = '';
    }
  }, [session]);

  useEffect(() => {
    if (!authReady || authRefreshFailed || !session || loadState !== 'ready' || uploadBusy || guestUploadTransferBusy || !guestDraftAssetFingerprint) {
      return;
    }

    if (guestUploadPromotionFingerprintRef.current === guestDraftAssetFingerprint) {
      return;
    }

    guestUploadPromotionFingerprintRef.current = guestDraftAssetFingerprint;
    const guestAssets = project.assets.filter(isGuestDraftUploadAsset);
    if (!guestAssets.length) {
      return;
    }

    let cancelled = false;
    setGuestUploadTransferBusy(true);
    setUploadState(createRecoveredGuestUploadTransferState(guestAssets));
    setMessage(createRecoveredGuestUploadTransferIntro(guestAssets, session));

    void promoteGuestDraftUploads({
      guestAssets,
      setProject,
      setUploadState,
      isCancelled: () => cancelled,
    })
      .then((result) => {
        if (cancelled || result.cancelled) {
          return;
        }

        setGuestUploadTransferBusy(false);
        setMessage(createRecoveredGuestUploadTransferSummary(result, session));
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : translate('Unable to attach recovered uploads.'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setGuestUploadTransferBusy(false);
          setUploadState((current) => (current.phase === 'idle' ? current : createIdleUploadState()));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    authReady,
    authRefreshFailed,
    guestDraftAssetFingerprint,
    guestUploadTransferBusy,
    loadState,
    project.assets,
    session,
    setGuestUploadTransferBusy,
    setMessage,
    setProject,
    setUploadState,
    uploadBusy,
  ]);

  useEffect(() => {
    const liveEphemeralIds = new Set<string>();

    project.assets.forEach((asset) => {
      if (!isEphemeralDraftUploadAsset(asset)) {
        return;
      }

      liveEphemeralIds.add(asset.id);
      if (!ephemeralAssetUrlsRef.current[asset.id]) {
        ephemeralAssetUrlsRef.current[asset.id] = asset.src;
      }
    });

    Object.entries(ephemeralAssetUrlsRef.current).forEach(([assetId, src]) => {
      if (liveEphemeralIds.has(assetId)) {
        return;
      }

      URL.revokeObjectURL(src);
      delete ephemeralAssetUrlsRef.current[assetId];
    });
  }, [project.assets]);

  useEffect(
    () => () => {
      Object.values(ephemeralAssetUrlsRef.current).forEach((src) => URL.revokeObjectURL(src));
      ephemeralAssetUrlsRef.current = {};
    },
    [],
  );

  useEffect(() => {
    if (!authReady || authRefreshFailed || session || projectRecord || loadState !== 'ready') {
      return;
    }

    const sanitizedDraft = stripServerBackedUploadsFromDraft(project);
    if (sanitizedDraft.removedAssetCount === 0) {
      return;
    }

    setProject(sanitizedDraft.project);
    setMessage(
      sanitizedDraft.clearedPlacementCount > 0
        ? translate('Signed out. Removed %s from this local draft and cleared %s.')
            .replace(
              '%s',
              countLabel(sanitizedDraft.removedAssetCount, '1 uploaded photo', '%s uploaded photos'),
            )
            .replace(
              '%s',
              countLabel(sanitizedDraft.clearedPlacementCount, '1 frame', '%s frames'),
            )
        : translate('Signed out. Removed %s from this local draft.').replace(
            '%s',
            countLabel(sanitizedDraft.removedAssetCount, '1 uploaded photo', '%s uploaded photos'),
          ),
    );
  }, [authReady, authRefreshFailed, loadState, project, projectRecord, session, setMessage, setProject]);

  useEffect(() => {
    if (!session) {
      setOwnedUploads([]);
    }
  }, [session, setOwnedUploads]);

  useEffect(() => {
    if (!authReady || authRefreshFailed || !session || loadState !== 'ready') {
      return;
    }

    let cancelled = false;

    // Only reconcile server-backed project assets against the signed-in account's upload inventory
    // when that account actually owns the current project. Admin sessions can open another user's
    // editor link, and treating foreign project assets as missing local inventory would purge them.
    const canReconcileOwnedUploads = !projectRecord?.ownerUserId || projectRecord.ownerUserId === session.id;
    const refreshOwnedUploads = () =>
      fetchAccountUploads()
        .then((payload) => {
          if (cancelled) {
            return;
          }

          setOwnedUploads(payload.uploads);
          if (canReconcileOwnedUploads) {
            setProject((current) => reconcileDraftOwnedUploadState(current, payload.uploads, { silent: true }).project);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setOwnedUploads([]);
          }
        });

    void refreshOwnedUploads();

    const timer = hasPendingProjectUploads ? window.setInterval(() => void refreshOwnedUploads(), 4000) : null;

    return () => {
      cancelled = true;
      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, [
    authReady,
    authRefreshFailed,
    hasPendingProjectUploads,
    loadState,
    projectRecord?.ownerUserId,
    serverBackedAssetFingerprint,
    session,
    setOwnedUploads,
    setProject,
  ]);

  useEffect(() => {
    setPrintAssetsById(null);
    printAssetFingerprintRef.current = '';
  }, [printAssetFingerprintRef, setPrintAssetsById, usedAssetFingerprint]);

  useEffect(() => {
    let cancelled = false;

    const assetsMissingSize = project.assets.filter((asset) => !(asset.width && asset.height));
    if (!assetsMissingSize.length) {
      return;
    }

    void Promise.all(
      assetsMissingSize.map(async (asset) => {
        try {
          const size = await readImageIntrinsicSize(getAssetSource(asset, 'original'));
          return {
            id: asset.id,
            width: size.width,
            height: size.height,
          };
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) {
        return;
      }

      const discoveredById = Object.fromEntries(
        results
          .filter((result): result is { id: string; width: number; height: number } => result !== null)
          .map((result) => [result.id, result]),
      );

      if (Object.keys(discoveredById).length === 0) {
        return;
      }

      setProject((current) => {
        let didChange = false;
        const nextAssets = current.assets.map((asset) => {
          if (asset.width && asset.height) {
            return asset;
          }

          const discovered = discoveredById[asset.id];
          if (!discovered) {
            return asset;
          }

          didChange = true;
          return {
            ...asset,
            width: discovered.width,
            height: discovered.height,
          };
        });

        return didChange
          ? {
              ...current,
              assets: nextAssets,
            }
          : current;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [project.assets, setProject]);
}
