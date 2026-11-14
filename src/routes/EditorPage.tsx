import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CustomLayoutMap } from '../components/CustomLayoutMap';
import { MagazinePreview } from '../components/MagazinePreview';
import { TemplateIssuePreview } from '../components/TemplateIssuePreview';
import { TemplateLayoutPreview } from '../components/TemplateLayoutPreview';
import { AccountUploadListItem } from '../editor/api';
import { getConfirmationMessage } from '../editor/confirmations';
import { formatDateTime } from '../editor/dateFormat';
import { getAssetSource } from '../editor/assetResources';
import {
  createDefaultProject,
  customLayoutPresets,
  defaultCustomLayoutPresetId,
  defaultTemplatePackId,
  getPageSlotOrder,
  getTemplateLabel,
  pageThemeMeta,
  pageThemeOrder,
  templateUsesBody,
  templateUsesDeck,
  templateUsesKicker,
  templatePacks,
  templateMeta,
  TemplatePackId,
} from '../editor/demoData';
import {
  CUSTOM_TEMPLATE_FRAME_LIMIT,
  CUSTOM_TEMPLATE_FRAME_LABEL_LIMIT,
  CUSTOM_TEMPLATE_NAME_LIMIT,
  PROJECT_ASSET_LIMIT,
  PROJECT_PAGE_LIMIT,
} from '../editor/limits';
import { buildExportAdvisories } from '../editor/export';
import { readDraftProject } from '../editor/storage';
import {
  Asset,
  ExportSettings,
  LayoutArea,
  PageData,
  ProjectRecord,
  ProjectState,
} from '../editor/types';
import { getGovernedTemplateIds, getGovernedTemplatePackIds } from '../product/governance';
import { buildTermsPath } from '../legal/terms';
import { useSession } from '../session';
import { useDelayedVisibility } from '../useDelayedVisibility';
import { createEditorAssetActions } from './editor/assetActions';
import { EditorContentSidebar } from './editor/EditorContentSidebar';
import { EditorExportCenter } from './editor/EditorExportCenter';
import { EditorOperationsSidebar } from './editor/EditorOperationsSidebar';
import { EditorLoadingState, EditorLockedState, EditorUnavailableState } from './editor/EditorShellStates';
import { createEditorExportActions } from './editor/exportFlow';
import { createEditorProjectShellActions } from './editor/projectActions';
import { createEditorPageActions } from './editor/pageActions';
import { createEditorDesignActions } from './editor/designActions';
import { createEditorProjectPersistenceActions } from './editor/projectPersistence';
import { createIdleUploadState, type UploadState } from './editor/uploadState';
import {
  createAssetFromOwnedUpload,
  createEditorUploadActions,
  isGuestDraftUploadAsset,
  isServerBackedUploadAsset,
} from './editor/uploadOperations';
import { createEditorTemplateActions } from './editor/templateOperations';
import { useEditorExportState } from './editor/useEditorExportState';
import { useEditorProjectLifecycle } from './editor/useEditorProjectLifecycle';
import { useEditorProjectState } from './editor/useEditorProjectState';
import { useEditorTemplateState } from './editor/useEditorTemplateState';
import { useEditorAssetLifecycle } from './editor/useEditorAssetLifecycle';
import { useEditorPreviewScale } from './editor/useEditorPreviewScale';
import { useEditorUiState } from './editor/useEditorUiState';

type LoadState = 'loading' | 'ready' | 'error';
type SaveState = 'draft' | 'dirty' | 'saving' | 'saved' | 'error';
type AssetPlacement = {
  pageId: string;
  pageIndex: number;
  pageTitle: string;
  slot: string;
};
type PrintState =
  | { phase: 'idle' }
  | { phase: 'preparing'; totalAssets: number; completedAssets: number; originalBytes: number; optimizedBytes: number };
const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'pdf',
  pageSize: 'a4',
  quality: 'standard',
  jpgMode: 'separate',
};
const customAreaFields: Array<{ key: keyof LayoutArea; label: string; min: number; max: number }> = [
  { key: 'x', label: 'X', min: 0, max: 88 },
  { key: 'y', label: 'Y', min: 0, max: 88 },
  { key: 'width', label: 'W', min: 12, max: 100 },
  { key: 'height', label: 'H', min: 12, max: 100 },
];

function createPageId() {
  return `page-${crypto.randomUUID()}`;
}

function getInitialSlot(page?: PageData) {
  return page ? (getPageSlotOrder(page)[0] ?? null) : null;
}

function formatSavedAt(timestamp?: string) {
  if (!timestamp) {
    return 'Saved on the server.';
  }

  return `Saved ${formatDateTime(timestamp)}.`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

function getAssetOrientation(asset: Asset) {
  if (!asset.width || !asset.height) {
    return 'unknown';
  }

  if (asset.width > asset.height) {
    return 'landscape';
  }

  if (asset.height > asset.width) {
    return 'portrait';
  }

  return 'square';
}
export function EditorPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { user: session, ready: authReady, refreshFailed: authRefreshFailed } = useSession();
  const initialDraftRef = useRef<ProjectState | null>(null);
  if (!projectId && initialDraftRef.current === null) {
    initialDraftRef.current = readDraftProject();
  }
  const initialDraft = initialDraftRef.current ?? createDefaultProject();
  const initialDraftRequiresRestore = !projectId && initialDraft.assets.some((asset) => isGuestDraftUploadAsset(asset));
  const initialProject = projectId ? createDefaultProject() : initialDraft;
  const [projectRecord, setProjectRecord] = useState<ProjectRecord | null>(null);
  const [loadState, setLoadState] = useState<LoadState>(projectId || initialDraftRequiresRestore ? 'loading' : 'ready');
  const [saveState, setSaveState] = useState<SaveState>(projectId ? 'saving' : 'draft');
  const [message, setMessage] = useState<string | null>(null);
  const {
    canRedo,
    canUndo,
    currentCrop,
    customTemplateDraft,
    getProject,
    project,
    redo,
    resetHistory,
    selectedPage,
    selectedPageId,
    selectedPageIndex,
    selectedSlot,
    selectPage,
    setCustomTemplateDraft,
    setProject,
    setSelectedPageId,
    setSelectedSlot,
    setTemplateChoice,
    setThemeChoice,
    templateChoice,
    themeChoice,
    undo,
    updateProject,
    updateSelectedCrop,
    updateSelectedPage,
    updateSlotCrop,
  } = useEditorProjectState({
    initialProject,
    getInitialSlot,
    projectRecord,
    saveState,
    setSaveState,
    setMessage,
  });
  const [uploadState, setUploadState] = useState<UploadState>(() => createIdleUploadState());
  const [printState, setPrintState] = useState<PrintState>({ phase: 'idle' });
  const {
    applyAccountExportSettings,
    applyDefaultExportSettings,
    exportBusy,
    exportCaptureActive,
    exportCenterOpen,
    exportDialogState,
    exportPreflightIssues,
    exportSettings,
    setExportBusy,
    setExportCaptureActive,
    setExportCenterOpen,
    setExportDialogMessage,
    setExportPreflightIssues,
    updateExportSettings,
  } = useEditorExportState({
    defaultExportSettings: DEFAULT_EXPORT_SETTINGS,
    printPreparing: printState.phase === 'preparing',
    project,
  });
  const [printAssetsById, setPrintAssetsById] = useState<Record<string, Asset> | null>(null);
  const {
    setTemplateActionBusyId,
    setTemplateComposerOpen,
    setTemplatePreserveCopy,
    setTemplateSaveBusy,
    setTemplateSaveDescription,
    setTemplateSaveKind,
    setTemplateSaveName,
    setUserTemplates,
    templateActionBusyId,
    templateComposerOpen,
    templateGovernance,
    templateLibraryBusy,
    templatePreserveCopy,
    templateSaveBusy,
    templateSaveDescription,
    templateSaveKind,
    templateSaveName,
    toggleTemplateComposer,
    userTemplates,
  } = useEditorTemplateState({
    authReady,
    session,
    project,
    defaultExportSettings: DEFAULT_EXPORT_SETTINGS,
    applyAccountExportSettings,
    applyDefaultExportSettings,
  });
  const [projectActionBusy, setProjectActionBusy] = useState<'duplicate' | 'archive' | 'unarchive' | null>(null);
  const [ownedUploads, setOwnedUploads] = useState<AccountUploadListItem[]>([]);
  const [guestUploadTransferBusy, setGuestUploadTransferBusy] = useState(false);
  const [assetDeleteBusy, setAssetDeleteBusy] = useState(false);
  const [assetDeleteTargetId, setAssetDeleteTargetId] = useState<string | null>(null);
  const [assetRetryTargetId, setAssetRetryTargetId] = useState<string | null>(null);
  const [saveConflict, setSaveConflict] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [shareCopyState, setShareCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [starterPacksOpen, setStarterPacksOpen] = useState(false);
  const lastSavedSnapshotRef = useRef('');
  const printAssetFingerprintRef = useRef('');
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const sheetProbeRef = useRef<HTMLDivElement | null>(null);
  const printStackRef = useRef<HTMLElement | null>(null);
  const printPageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const customLayoutBuilderRef = useRef<HTMLDivElement | null>(null);
  const editorStageRef = useRef<HTMLElement | null>(null);
  const previewScale = useEditorPreviewScale({
    loadState,
    canvasRef,
    sheetProbeRef,
  });

  useEffect(() => {
    resetHistory();
  }, [projectId, resetHistory]);

  useEffect(() => {
    if (!authReady || !session?.needsTermsAcceptance) {
      return;
    }

    navigate(buildTermsPath(`${window.location.pathname}${window.location.search}${window.location.hash}`), { replace: true });
  }, [authReady, navigate, session?.needsTermsAcceptance]);


  const assetsById = useMemo<Record<string, Asset>>(
    () => Object.fromEntries(project.assets.map((asset) => [asset.id, asset])),
    [project.assets],
  );
  const ownedLibraryAssets = useMemo(() => ownedUploads.map(createAssetFromOwnedUpload), [ownedUploads]);
  const assetUsageCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    project.pages.forEach((page) => {
      Object.values(page.slots).forEach((assetId) => {
        if (!assetId) {
          return;
        }

        counts[assetId] = (counts[assetId] ?? 0) + 1;
      });
    });
    return counts;
  }, [project.pages]);
  const assetPlacementsById = useMemo<Record<string, AssetPlacement[]>>(() => {
    const placements: Record<string, AssetPlacement[]> = {};

    project.pages.forEach((page, pageIndex) => {
      Object.entries(page.slots).forEach(([slot, assetId]) => {
        if (!assetId) {
          return;
        }

        if (!placements[assetId]) {
          placements[assetId] = [];
        }

        placements[assetId].push({
          pageId: page.id,
          pageIndex,
          pageTitle: page.title,
          slot,
        });
      });
    });

    return placements;
  }, [project.pages]);
  const selectedAsset = selectedSlot && selectedPage?.slots[selectedSlot] ? assetsById[selectedPage.slots[selectedSlot] as string] : null;
  const selectedAssetPlacements = selectedAsset ? assetPlacementsById[selectedAsset.id] ?? [] : [];
  const placedAssetCount = Object.keys(assetUsageCounts).length;
  const unusedAssetCount = Math.max(project.assets.length - placedAssetCount, 0);
  const libraryAssetsById = useMemo<Record<string, Asset>>(() => {
    const merged = new Map<string, Asset>();

    ownedLibraryAssets.forEach((asset) => {
      merged.set(asset.id, asset);
    });

    project.assets.forEach((asset) => {
      const existing = merged.get(asset.id);
      if (!existing) {
        merged.set(asset.id, asset);
        return;
      }

      merged.set(asset.id, {
        ...existing,
        ...asset,
        note: asset.note || existing.note,
        variants: {
          original: asset.variants?.original ?? existing.variants?.original,
          preview: asset.variants?.preview ?? existing.variants?.preview ?? null,
          thumb: asset.variants?.thumb ?? existing.variants?.thumb ?? null,
        },
        delivery: asset.delivery ?? existing.delivery,
        lastUsedAt: asset.lastUsedAt ?? existing.lastUsedAt ?? null,
      });
    });

    return Object.fromEntries(merged);
  }, [ownedLibraryAssets, project.assets]);
  const libraryAssetIdsInOrder = useMemo(() => {
    const orderedIds: string[] = [];
    const seenIds = new Set<string>();

    [...project.assets.map((asset) => asset.id), ...ownedUploads.map((upload) => upload.assetId)].forEach((assetId) => {
      if (seenIds.has(assetId)) {
        return;
      }

      seenIds.add(assetId);
      orderedIds.push(assetId);
    });

    return orderedIds;
  }, [ownedUploads, project.assets]);
  const libraryAssets = useMemo(
    () => libraryAssetIdsInOrder.map((assetId) => libraryAssetsById[assetId]).filter((asset): asset is Asset => Boolean(asset)),
    [libraryAssetIdsInOrder, libraryAssetsById],
  );
  const projectAssetIds = useMemo(() => new Set(project.assets.map((asset) => asset.id)), [project.assets]);
  const usedAssets = useMemo(
    () => project.assets.filter((asset) => (assetUsageCounts[asset.id] ?? 0) > 0),
    [assetUsageCounts, project.assets],
  );
  const exportAdvisories = useMemo(() => buildExportAdvisories(exportSettings), [exportSettings]);
  const usedAssetFingerprint = useMemo(
    () => usedAssets.map((asset) => `${asset.id}:${getAssetSource(asset, 'original')}:${asset.delivery?.state ?? 'local'}`).sort().join('|'),
    [usedAssets],
  );
  const serverBackedAssetFingerprint = useMemo(
    () => project.assets.filter(isServerBackedUploadAsset).map((asset) => asset.id).sort().join('|'),
    [project.assets],
  );
  const shareUrl = useMemo(() => {
    if (!projectRecord) {
      return '';
    }

    return new URL(projectRecord.sharePath, window.location.origin).toString();
  }, [projectRecord]);
  const previewStyle = useMemo(
    () =>
      ({
        '--page-scale': previewScale,
      }) as CSSProperties,
    [previewScale],
  );

  const visibleTemplateIds = useMemo(
    () => getGovernedTemplateIds(templateGovernance, selectedPage?.template ?? null),
    [selectedPage?.template, templateGovernance],
  );
  const visibleTemplatePackIds = useMemo(() => getGovernedTemplatePackIds(templateGovernance), [templateGovernance]);
  const uploadBusy = uploadState.phase !== 'idle';
  const assetMutationBusy = assetDeleteBusy || Boolean(assetRetryTargetId);
  const libraryBusy = assetMutationBusy;
  const printBusy = printState.phase === 'preparing';
  const hasGuestUploadAssets = project.assets.some(isGuestDraftUploadAsset);
  const hasPendingProjectUploads = project.assets.some((asset) => asset.delivery?.state === 'pending');
  const guestDraftAssetFingerprint = useMemo(
    () => project.assets.filter(isGuestDraftUploadAsset).map((asset) => asset.id).sort().join('|'),
    [project.assets],
  );
  const canUploadAssets = true;
  const legacyProjectReadOnly = Boolean(projectRecord && !projectRecord.ownerUserId && session?.role !== 'admin');
  const saveNeedsSession = !projectRecord || Boolean(projectRecord?.ownerUserId) || legacyProjectReadOnly;
  const canSaveProject = !hasGuestUploadAssets && !legacyProjectReadOnly && (!saveNeedsSession || Boolean(session));
  const currentUploadFraction =
    uploadState.phase === 'uploading' && uploadState.currentFileTotalBytes > 0
      ? uploadState.currentFileLoadedBytes / uploadState.currentFileTotalBytes
      : 0;
  const uploadProgressPercent = Math.round(
    ((uploadState.completedFiles + currentUploadFraction) / Math.max(uploadState.totalFiles, 1)) * 100,
  );
  const uploadProgressLabel = uploadBusy ? `Photo ${Math.max(uploadState.currentFileIndex, 1)}/${Math.max(uploadState.totalFiles, 1)}` : 'Upload';
  const uploadProgressDetail =
    uploadState.phase === 'preparing'
      ? `Optimizing ${uploadState.currentFileName} before ${session ? 'upload' : 'adding it locally'}.`
      : uploadState.phase === 'uploading'
        ? session
          ? `${uploadState.currentFileName} · ${formatBytes(uploadState.currentFileLoadedBytes)} of ${formatBytes(
              uploadState.currentFileTotalBytes,
            )} sent.`
          : `${uploadState.currentFileName} · finalizing for this local draft.`
        : null;

  useEditorAssetLifecycle({
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
  });


  const {
    activateCustomLayoutPreview,
    clearTemplateHoverPreview,
    commitZoomInputValue,
    customLayoutPreviewActive,
    deactivateCustomLayoutPreview,
    handleCropMetricsChange,
    handleCustomLayoutPreviewBlur,
    handleCustomLayoutPreviewFocus,
    handleZoomInputChange,
    nudgeSelectedCrop,
    nudgeSelectedScale,
    openTemplateHoverPreview,
    pinnedCustomLayoutPreview,
    resetZoomInputValue,
    selectedCropMetrics,
    templateHoverPreview,
    zoomInputValue,
  } = useEditorUiState({
    selectedPageId: selectedPage?.id,
    selectedSlot,
    currentCrop,
    templatePickerOpen,
    templateChoice,
    customLayoutBuilderRef,
    editorStageRef,
    updateSelectedCrop,
  });

  const {
    addCustomFrame,
    applyTheme,
    loadCustomLayoutPreset,
    removeCustomFrame,
    updateCustomArea,
    updateCustomFrameArea,
    updateCustomTemplateDraft,
    updateFrameRadius,
  } = createEditorDesignActions({
    updateProject,
    updateSelectedPage,
    setCustomTemplateDraft,
    setTemplateChoice,
    setMessage,
  });

  // The persistence factory closes over the current project/session. Keeping the newest
  // instance in a ref lets us expose a stable saveProject function, which the autosave
  // effect depends on. Without this the 1.2s debounce restarts on every render and the
  // save never fires while the editor is busy re-rendering.
  const persistenceActionsRef = useRef<ReturnType<typeof createEditorProjectPersistenceActions> | null>(null);
  persistenceActionsRef.current = createEditorProjectPersistenceActions({
    session,
    project,
    projectRecord,
    ownedUploads,
    getCurrentProject: getProject,
    onConflict: setSaveConflict,
    onSaveSuccess: () => setSaveConflict(null),
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
  });
  const persistenceActions = persistenceActionsRef.current;
  const {
    applyServerProjectRecord,
    handleCopyPublicShareLink,
    handleDisableProjectShare,
    handleEnableProjectShare,
  } = persistenceActions;
  const saveProjectRef = useRef(persistenceActions.saveProject);
  saveProjectRef.current = persistenceActions.saveProject;
  const saveProject = useCallback(
    (options: { manual: boolean }) => saveProjectRef.current(options),
    [],
  );
  const handleStartNewDraft = useCallback(() => {
    resetHistory();
    persistenceActionsRef.current?.startNewDraft();
  }, [resetHistory]);

  useEditorProjectLifecycle({
    projectId,
    project,
    projectRecord,
    loadState,
    saveConflict: Boolean(saveConflict),
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
  });

  const {
    handleOpenUserTemplate,
    handleSaveCurrentProjectAsTemplate,
  } = createEditorTemplateActions({
    session,
    project,
    projectRecord,
    templateSaveName,
    templateSaveDescription,
    templateSaveKind,
    templatePreserveCopy,
    selectedPageIndex,
    selectedPageId,
    navigate,
    setTemplateSaveBusy,
    setTemplateComposerOpen,
    setTemplateSaveName,
    setUserTemplates,
    setTemplateActionBusyId,
    setMessage,
  });

  const { handlePrint, handleRunExport } = createEditorExportActions({
    project,
    projectRecordId: projectRecord?.id,
    exportSettings,
    usedAssets,
    assetsById,
    printAssetsById,
    usedAssetFingerprint,
    printAssetFingerprintRef,
    getPrintStackRoot: () => printStackRef.current,
    getPrintPageRefs: () => printPageRefs.current,
    setPrintState,
    setMessage,
    setPrintAssetsById,
    setExportCaptureActive,
    setExportBusy,
    setExportCenterOpen,
    setExportPreflightIssues,
    setExportDialogMessage,
    formatBytes,
  });

  const {
    handleArchiveToggle,
    handleCopyLink,
    handleDuplicateCurrentProject,
    openAccountPage,
    openAdminPage,
  } = createEditorProjectShellActions({
    session,
    projectRecord,
    shareUrl,
    navigate,
    setProjectActionBusy,
    setMessage,
    setProjectRecord,
    setCopyState,
  });

  const {
    assignAsset,
    clearAssetPlacements,
    clearSelectedSlot,
    focusAssetPlacement,
    handleDeleteAsset,
    handleRetryAssetMirror,
    removeUnusedAssetsFromIssue,
  } = createEditorAssetActions({
    project,
    projectRecord,
    session,
    selectedPageId: selectedPage?.id ?? null,
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
  });

  const {
    addPage,
    applyTemplateChoice,
    applyTemplatePack,
    duplicatePage,
    moveSelectedPage,
    removeSelectedPage,
  } = createEditorPageActions({
    project,
    selectedPage,
    selectedPageIndex,
    templateChoice,
    customTemplateDraft,
    updateProject,
    updateSelectedPage,
    setSelectedPageId,
    setSelectedSlot,
    setTemplateChoice,
    setCustomTemplateDraft,
    setMessage,
    createPageId,
    getInitialSlot,
  });

  const { handleUploadFiles } = createEditorUploadActions({
    navigate,
    session,
    setProject,
    setMessage,
    setUploadState,
    updateProject,
  });
  const handleUploadFilesWithLimit = useCallback(
    (files: File[]) => {
      const remaining = PROJECT_ASSET_LIMIT - project.assets.length;
      if (files.length > remaining) {
        setMessage(
          remaining > 0
            ? `This folio can hold ${PROJECT_ASSET_LIMIT} photos. Add ${remaining} more or remove unused photos first.`
            : `This folio already holds the maximum of ${PROJECT_ASSET_LIMIT} photos.`,
        );
        return;
      }

      void handleUploadFiles(files);
    },
    [handleUploadFiles, project.assets.length, setMessage],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }

      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
        return;
      }

      if (event.key.toLowerCase() !== 'z') {
        return;
      }

      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [redo, undo]);

  if (!selectedPage) {
    return (
      <EditorUnavailableState
        loadError="This folio has no pages to edit. Start a new draft to keep working."
        startNewDraft={handleStartNewDraft}
      />
    );
  }

  const selectedFrameLabel =
    selectedSlot && selectedPage?.template === 'custom'
      ? selectedPage.customTemplate?.frames.find((frame) => frame.slot === selectedSlot)?.label ?? selectedSlot
      : selectedSlot;
  const fallbackStatus = !projectRecord
    ? hasGuestUploadAssets
      ? session
        ? guestUploadTransferBusy
          ? 'Attaching recovered local uploads to this account before saving.'
          : 'Recovered local uploads are still pending account attachment before this folio can be saved.'
        : 'Local uploads are kept on this device. Sign in to attach them to your account before creating a saved link.'
      : 'Draft only. Create a stable editor URL to save this folio on the server.'
    : legacyProjectReadOnly
      ? session
        ? 'Legacy read-only project. Duplicate it into your account before saving, sharing, or archiving.'
        : 'Legacy read-only project. Sign in to duplicate it into your account before editing.'
      : saveState === 'saving'
        ? 'Saving changes to the server...'
        : saveState === 'dirty'
          ? 'Changes queued. Autosave will sync this folio shortly.'
          : saveState === 'error'
            ? 'Save failed. Retry to keep this URL current.'
            : formatSavedAt(projectRecord.updatedAt);
  // Pending/unsaved state must never be hidden behind an action message such as
  // "Preset applied"; the user needs to see that the folio still has to be saved.
  const showSaveState =
    saveState === 'dirty' || saveState === 'saving' || saveState === 'error' || !projectRecord || legacyProjectReadOnly;
  const statusText =
    printBusy
      ? `Preparing print-ready pages ${printState.completedAssets}/${printState.totalAssets}...`
      : assetMutationBusy
        ? 'Updating the media library...'
      : uploadState.phase === 'preparing'
        ? `Preparing upload ${uploadState.completedFiles}/${uploadState.totalFiles}...`
        : uploadState.phase === 'uploading'
          ? `${session ? 'Uploading' : 'Adding'} images ${uploadProgressPercent}%...`
          : showSaveState
            ? fallbackStatus
            : message ?? fallbackStatus;
  const sequenceLabel = `${project.pages.length} page${project.pages.length === 1 ? '' : 's'}`;
  const selectedPagePositionLabel = `Page ${selectedPageIndex + 1} of ${project.pages.length}`;
  const selectedTemplateMeta = templateMeta[templateChoice];
  const selectedTemplateLabel = getTemplateLabel(templateChoice, templateChoice === 'custom' ? customTemplateDraft : null);
  const chosenThemeMeta = pageThemeMeta[themeChoice];
  const templatePanelTag =
    templateChoice === 'custom'
      ? `${customTemplateDraft.frames.length} frame${customTemplateDraft.frames.length === 1 ? '' : 's'}`
      : selectedTemplateMeta.summary;
  const selectedAssetId = selectedSlot ? selectedPage.slots[selectedSlot] : null;
  const selectedPageUsesKicker = templateUsesKicker(selectedPage.template);
  const selectedPageUsesDeck = templateUsesDeck(selectedPage.template);
  const selectedPageUsesBody = templateUsesBody(selectedPage.template, selectedPage.customTemplate);
  const projectModeTag = !projectRecord
    ? session
      ? 'Local draft'
      : 'Guest draft'
    : legacyProjectReadOnly
      ? 'Legacy read-only'
      : projectRecord.archivedAt
        ? 'Archived'
        : 'Saved link';
  const copyButtonLabel = copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy link';
  const publicShareUrl =
    projectRecord?.share.path && typeof window !== 'undefined' ? new URL(projectRecord.share.path, window.location.origin).toString() : '';
  const publicShareCopyLabel =
    shareCopyState === 'copied' ? 'Copied' : shareCopyState === 'error' ? 'Copy failed' : 'Copy public link';
  const saveActionLabel = saveState === 'saving'
    ? 'Saving…'
    : legacyProjectReadOnly
      ? 'Duplicate to edit'
      : hasGuestUploadAssets
        ? session
          ? 'Uploads pending'
          : 'Sign in to save'
        : projectRecord
          ? 'Save'
          : 'Save folio';
  const exportActionBusy = exportBusy || printBusy;
  const exportActionLabel = exportActionBusy ? 'Preparing…' : exportCenterOpen ? 'Close export' : 'Export Center';
  const themeChoiceMatchesAllPages = project.pages.every((page) => page.theme === themeChoice);
  const pageStylePanel = (
    <section className="editor-panel editor-panel--page-style">
      <div className="editor-panel__heading">
        <div>
          <p className="eyebrow">Page style</p>
          <h2>Paper color</h2>
        </div>
        <span className="panel-tag">{chosenThemeMeta.label}</span>
      </div>
      <div className="theme-grid" role="group" aria-label="Paper color">
        {pageThemeOrder.map((themeId) => {
          const meta = pageThemeMeta[themeId];
          return (
            <button
              key={themeId}
              type="button"
              className={`theme-card ${themeChoice === themeId ? 'is-active' : ''}`}
              onClick={() => {
                setThemeChoice(themeId);
                if (selectedPage.theme !== themeId) {
                  applyTheme(themeId, 'page');
                }
              }}
              aria-pressed={themeChoice === themeId}
            >
              <span className={`theme-card__swatch theme-card__swatch--${themeId}`} aria-hidden="true" />
              <span className="theme-card__meta">
                <strong>{meta.label}</strong>
                <small>{meta.summary}</small>
              </span>
            </button>
          );
        })}
      </div>
      <div className="theme-apply-actions">
        <button
          type="button"
          className="button button--ghost button--small"
          disabled={themeChoiceMatchesAllPages}
          onClick={() => applyTheme(themeChoice, 'all')}
        >
          {themeChoiceMatchesAllPages ? 'Already global' : 'Apply all'}
        </button>
      </div>
    </section>
  );
  const exportSubmitDefaultLabel =
    exportSettings.format === 'project'
      ? 'Download project'
      : exportSettings.format === 'pdf'
        ? 'Export PDF'
        : exportSettings.jpgMode === 'combined'
          ? 'Export stitched JPG'
          : 'Export JPG set';
  const exportSubmitLabel =
    exportDialogState?.text ??
    (printBusy ? `Preparing ${printState.completedAssets}/${printState.totalAssets}...` : exportSubmitDefaultLabel);
  const templateSaveActionLabel =
    templateSaveBusy ? 'Saving…' : templateSaveKind === 'page' ? 'Save page template' : 'Save project template';
  const archiveActionLabel =
    projectActionBusy === 'archive'
      ? 'Archiving…'
      : projectActionBusy === 'unarchive'
        ? 'Restoring…'
        : projectRecord?.archivedAt
          ? 'Unarchive'
          : 'Archive';
  const hoveredTemplateMeta = templateHoverPreview ? templateMeta[templateHoverPreview.templateId] : null;
  const hoveredTemplateLabel = templateHoverPreview
    ? getTemplateLabel(templateHoverPreview.templateId, templateHoverPreview.templateId === 'custom' ? customTemplateDraft : null)
    : '';
  const hoveredTemplateDescription = templateHoverPreview
    ? templateHoverPreview.templateId === 'custom'
      ? 'Current custom scaffold preview.'
      : hoveredTemplateMeta?.description ?? ''
    : '';
  const hoveredTemplateSlotCount = templateHoverPreview
    ? templateHoverPreview.templateId === 'custom'
      ? customTemplateDraft.frames.length
      : hoveredTemplateMeta?.slots.length ?? 0
    : 0;
  const showInlineCustomLayoutOverview = customLayoutPreviewActive && !pinnedCustomLayoutPreview;
  const customLayoutOverview = showInlineCustomLayoutOverview ? (
    <div className="custom-layout-overview">
      <div className="custom-layout-overview__copy">
        <p className="eyebrow">Layout map</p>
        <h3>Start from a scaffold</h3>
        <p className="panel-note">
          Pick the closest structure first. Open the geometry controls only when the preset still needs fine tuning.
        </p>
      </div>
      <CustomLayoutMap template={customTemplateDraft} highlightedSlot={selectedSlot} />
    </div>
  ) : null;
  const protectedProjectLocked = authReady && !authRefreshFailed && !session && Boolean(projectRecord?.ownerUserId);
  const projectTemplateSectionTag = `${visibleTemplatePackIds.length} ready`;
  const showLoadingShell = useDelayedVisibility(loadState === 'loading');

  if (loadState === 'loading') {
    if (!showLoadingShell) {
      return <div className="editor-shell" aria-hidden="true" />;
    }

    return <EditorLoadingState />;
  }

  if (loadState === 'error') {
    return <EditorUnavailableState loadError={loadError} startNewDraft={handleStartNewDraft} />;
  }

  if (protectedProjectLocked) {
    return <EditorLockedState openAccountPage={openAccountPage} startNewDraft={handleStartNewDraft} />;
  }


  return (
    <div className="editor-shell">
      <h1 className="sr-only">Folio editor</h1>
      <div className="editor-layout">
        <aside className="editor-sidebar editor-sidebar--navigation">
          <section className="page-strip-panel">
            <div className="page-strip-panel__header page-strip-panel__header--compact">
              <div>
                <p className="eyebrow">Sequence</p>
              </div>
              <span className="panel-tag">{sequenceLabel}</span>
            </div>

            <div className="page-strip">
              {project.pages.map((page, index) => {
                const isActive = page.id === selectedPage.id;
                const pagePositionLabel = `Page ${index + 1}`;

                return (
                  <article
                    key={page.id}
                    className={`page-chip page-chip--theme-${page.theme} ${isActive ? 'is-active' : ''}`.trim()}
                  >
                    <button type="button" className="page-chip__main" onClick={() => selectPage(page.id)}>
                      <span>{pagePositionLabel}</span>
                      <strong>{page.title}</strong>
                      <em>{getTemplateLabel(page.template, page.customTemplate)}</em>
                    </button>
                    {isActive ? (
                      <div className="page-chip__actions" aria-label={`Actions for ${pagePositionLabel}`}>
                        <button
                          type="button"
                          className="page-chip__action"
                          title="Duplicate page"
                          aria-label="Duplicate page"
                          onClick={duplicatePage}
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          className="page-chip__action"
                          title="Move page up"
                          aria-label="Move page up"
                          disabled={selectedPageIndex <= 0}
                          onClick={() => moveSelectedPage(-1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="page-chip__action"
                          title="Move page down"
                          aria-label="Move page down"
                          disabled={selectedPageIndex >= project.pages.length - 1}
                          onClick={() => moveSelectedPage(1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="page-chip__action page-chip__action--danger"
                          title={project.pages.length === 1 ? 'Keep at least one page' : 'Delete page'}
                          aria-label={project.pages.length === 1 ? 'Keep at least one page' : 'Delete page'}
                          disabled={project.pages.length === 1}
                          onClick={removeSelectedPage}
                        >
                          ×
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
          {pageStylePanel}

          <section className="editor-panel editor-panel--layout">
            <div className="editor-panel__heading">
              <div>
                <p className="eyebrow">Page templates</p>
                <h2>{selectedTemplateLabel}</h2>
              </div>
              <div className="editor-collapsible-meta">
                <span className="panel-tag">{templatePanelTag}</span>
                <button
                  type="button"
                  className="button button--ghost button--small editor-toggle-button"
                  onClick={() => setTemplatePickerOpen((current) => !current)}
                  aria-expanded={templatePickerOpen}
                >
                  {templatePickerOpen ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {templatePickerOpen ? (
              <>
                <div className="template-grid">
                  {visibleTemplateIds.map((templateId) => {
                    const meta = templateMeta[templateId];
                    return (
                      <button
                        key={templateId}
                        type="button"
                        className={`template-card ${templateChoice === templateId ? 'is-active' : ''}`}
                        onClick={() => setTemplateChoice(templateId)}
                        onMouseEnter={(event) => openTemplateHoverPreview(templateId, event.currentTarget)}
                        onMouseLeave={clearTemplateHoverPreview}
                        onFocus={(event) => openTemplateHoverPreview(templateId, event.currentTarget)}
                        onBlur={clearTemplateHoverPreview}
                      >
                        <span>{meta.label}</span>
                        <strong>{meta.summary}</strong>
                        <small>{meta.slots.length} image slot{meta.slots.length === 1 ? '' : 's'}</small>
                      </button>
                    );
                  })}
                </div>
                {templateChoice === 'custom' ? (
                  <div
                    ref={customLayoutBuilderRef}
                    className="custom-layout-builder"
                    onMouseEnter={activateCustomLayoutPreview}
                    onMouseLeave={deactivateCustomLayoutPreview}
                    onFocus={handleCustomLayoutPreviewFocus}
                    onBlur={handleCustomLayoutPreviewBlur}
                  >
                    <div className="editor-panel__heading">
                      <div>
                        <p className="eyebrow">Custom layout</p>
                        <h2>{customTemplateDraft.name}</h2>
                      </div>
                      <span className="panel-tag">{`${customTemplateDraft.frames.length} frame${
                        customTemplateDraft.frames.length === 1 ? '' : 's'
                      }`}</span>
                    </div>
                    {customLayoutOverview}
                    <div className="template-grid template-grid--compact">
                      {customLayoutPresets.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={`template-card ${customTemplateDraft.name === preset.template.name ? 'is-active' : ''}`}
                          onClick={() => loadCustomLayoutPreset(preset.id)}
                        >
                          <CustomLayoutMap template={preset.template} className="custom-layout-map--card" />
                          <span>{preset.label}</span>
                          <strong>{preset.template.name}</strong>
                          <small>{preset.summary}</small>
                        </button>
                      ))}
                    </div>
                    <label className="field">
                      <span>Layout name</span>
                      <input
                        maxLength={CUSTOM_TEMPLATE_NAME_LIMIT}
                        value={customTemplateDraft.name}
                        onChange={(event) =>
                          updateCustomTemplateDraft((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className="editor-panel__actions editor-panel__actions--tight">
                      <button
                        type="button"
                        className="button button--ghost button--small"
                        onClick={() => loadCustomLayoutPreset(defaultCustomLayoutPresetId)}
                      >
                        Reset base
                      </button>
                      <button
                        type="button"
                        className="button button--ghost button--small"
                        disabled={customTemplateDraft.frames.length >= CUSTOM_TEMPLATE_FRAME_LIMIT}
                        onClick={addCustomFrame}
                      >
                        {customTemplateDraft.frames.length >= CUSTOM_TEMPLATE_FRAME_LIMIT ? 'Frame limit' : 'Add frame'}
                      </button>
                    </div>
                    <details className="custom-layout-details">
                      <summary>Text block geometry</summary>
                      <div className="custom-layout-grid">
                        {customAreaFields.map((field) => (
                          <label className="field" key={`text-${field.key}`}>
                            <span>{field.label}</span>
                            <input
                              type="number"
                              min={field.min}
                              max={field.max}
                              step="1"
                              value={Math.round(customTemplateDraft.text[field.key])}
                              onChange={(event) =>
                                updateCustomTemplateDraft((current) => ({
                                  ...current,
                                  text: updateCustomArea(current.text, field.key, Number(event.target.value)),
                                }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </details>
                    <div className="custom-frame-list">
                      {customTemplateDraft.frames.map((frame, frameIndex) => (
                        <section key={frame.slot} className="custom-frame-card">
                          <div className="editor-panel__heading">
                            <div>
                              <p className="eyebrow">Frame {frameIndex + 1}</p>
                              <h2>{frame.label}</h2>
                            </div>
                            <span className="panel-tag">{frame.slot.toUpperCase()}</span>
                          </div>
                          <label className="field">
                            <span>Label</span>
                            <input
                              maxLength={CUSTOM_TEMPLATE_FRAME_LABEL_LIMIT}
                              value={frame.label}
                              onChange={(event) =>
                                updateCustomTemplateDraft((current) => ({
                                  ...current,
                                  frames: current.frames.map((entry) =>
                                    entry.slot === frame.slot
                                      ? {
                                          ...entry,
                                          label: event.target.value,
                                        }
                                      : entry,
                                  ),
                                }))
                              }
                            />
                          </label>
                          <div className="editor-panel__actions editor-panel__actions--tight">
                            <button
                              type="button"
                              className="button button--ghost button--small"
                              disabled={customTemplateDraft.frames.length === 1}
                              onClick={() => removeCustomFrame(frame.slot)}
                            >
                              {customTemplateDraft.frames.length === 1 ? 'Keep one' : 'Remove'}
                            </button>
                            <button
                              type="button"
                              className="button button--ghost button--small"
                              onClick={() => setSelectedSlot(frame.slot)}
                            >
                              Focus
                            </button>
                          </div>
                          <details className="custom-layout-details">
                            <summary>Advanced frame geometry</summary>
                            <div className="custom-layout-grid">
                              {customAreaFields.map((field) => (
                                <label className="field" key={`${frame.slot}-${field.key}`}>
                                  <span>{field.label}</span>
                                  <input
                                    type="number"
                                    min={field.min}
                                    max={field.max}
                                    step="1"
                                    value={Math.round(frame[field.key])}
                                    onChange={(event) =>
                                      updateCustomTemplateDraft((current) => ({
                                        ...current,
                                        frames: current.frames.map((entry) =>
                                          entry.slot === frame.slot
                                            ? updateCustomFrameArea(entry, field.key, Number(event.target.value))
                                            : entry,
                                        ),
                                      }))
                                    }
                                  />
                                </label>
                              ))}
                            </div>
                          </details>
                        </section>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="editor-panel__actions editor-panel__actions--end">
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    disabled={project.pages.length >= PROJECT_PAGE_LIMIT}
                    title={
                      project.pages.length >= PROJECT_PAGE_LIMIT
                        ? `Maximum ${PROJECT_PAGE_LIMIT} pages per folio`
                        : 'Add a page after the current one'
                    }
                    onClick={() => addPage()}
                  >
                    {project.pages.length >= PROJECT_PAGE_LIMIT ? 'Page limit' : 'Add page'}
                  </button>
                  <button
                    type="button"
                    className="button button--primary button--small"
                    disabled={templateChoice === selectedPage.template && templateChoice !== 'custom'}
                    onClick={applyTemplateChoice}
                  >
                    {templateChoice === selectedPage.template && templateChoice !== 'custom' ? 'Current' : 'Apply'}
                  </button>
                </div>
              </>
            ) : null}
          </section>
          {templateHoverPreview ? (
            <div
              className="template-hover-preview"
              style={{
                left: `${templateHoverPreview.left}px`,
                top: `${templateHoverPreview.top}px`,
              }}
              aria-hidden="true"
            >
              <TemplateLayoutPreview
                templateId={templateHoverPreview.templateId}
                customTemplate={templateHoverPreview.templateId === 'custom' ? customTemplateDraft : null}
                className="template-hover-preview__map"
              />
              <div className="template-hover-preview__meta">
                <span>{hoveredTemplateLabel}</span>
                <strong>{hoveredTemplateMeta?.summary ?? 'User-defined'}</strong>
                <p>{hoveredTemplateDescription}</p>
                <small>{`${hoveredTemplateSlotCount} image slot${hoveredTemplateSlotCount === 1 ? '' : 's'}`}</small>
              </div>
            </div>
          ) : null}
          {!templateHoverPreview && pinnedCustomLayoutPreview ? (
            <div
              className="template-hover-preview template-hover-preview--pinned-custom"
              style={{
                left: `${pinnedCustomLayoutPreview.left}px`,
                top: `${pinnedCustomLayoutPreview.top}px`,
              }}
              aria-hidden="true"
            >
              <div className="custom-layout-overview custom-layout-overview--floating">
                <div className="custom-layout-overview__copy">
                  <p className="eyebrow">Layout map</p>
                  <h3>Start from a scaffold</h3>
                  <p className="panel-note">
                    Pick the closest structure first. Open the geometry controls only when the preset still needs fine tuning.
                  </p>
                </div>
                <CustomLayoutMap
                  template={customTemplateDraft}
                  highlightedSlot={selectedSlot}
                  className="template-hover-preview__map"
                />
              </div>
            </div>
          ) : null}

          <section className="editor-panel editor-panel--starter-packs">
            <div className="editor-panel__heading">
              <div>
                <p className="eyebrow">Project templates</p>
                <h2>Built-in folio starters</h2>
              </div>
              <div className="editor-collapsible-meta">
                <span className="panel-tag">{projectTemplateSectionTag}</span>
                <button
                  type="button"
                  className="button button--ghost button--small editor-toggle-button"
                  onClick={() => setStarterPacksOpen((current) => !current)}
                  aria-expanded={starterPacksOpen}
                >
                  {starterPacksOpen ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {starterPacksOpen ? (
              <div className="template-pack-grid">
                {visibleTemplatePackIds.map((packId) => {
                  const pack = templatePacks[packId];
                  return (
                    <article key={packId} className={`template-pack-card ${packId === defaultTemplatePackId ? 'is-featured' : ''}`}>
                      <div className="template-pack-card__copy">
                        <span>{packId === defaultTemplatePackId ? `${pack.label} default` : pack.label}</span>
                        <strong>{pack.summary}</strong>
                        <p>{pack.description}</p>
                      </div>
                      <p className="template-pack-card__sequence">
                        {pack.pages.map((page) => getTemplateLabel(page.template, page.customTemplate)).join(' / ')}
                      </p>
                      <div className="template-pack-card__actions">
                        <button
                          type="button"
                          className="button button--primary button--small"
                          onClick={() => applyTemplatePack(packId, 'replace')}
                        >
                          Use as project
                        </button>
                        <button
                          type="button"
                          className="button button--ghost button--small"
                          onClick={() => applyTemplatePack(packId, 'insert')}
                        >
                          Insert
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>

          <section className="editor-panel editor-panel--user-templates">
            <div className="editor-panel__heading">
              <div>
                <p className="eyebrow">My templates</p>
                <h2>Reusable folios</h2>
              </div>
              <div className="editor-collapsible-meta">
                <span className="panel-tag">{session ? `${userTemplates.length} saved` : 'Sign in'}</span>
                {session ? (
                  <Link to="/account?section=templates" className="button button--ghost button--small editor-toggle-button">
                    Manage
                  </Link>
                ) : null}
              </div>
            </div>
            {!session ? (
              <p className="panel-note">Sign in to save reusable templates and reopen them as new folios.</p>
            ) : templateLibraryBusy ? (
              <p className="panel-note">Loading saved templates...</p>
            ) : userTemplates.length ? (
              <div className="template-library-grid template-library-grid--editor">
                {userTemplates.map((template) => (
                  <article key={template.id} className="template-library-card">
                    <TemplateIssuePreview templatePayload={template.templatePayload} className="template-library-card__preview" />
                    <div className="template-library-card__body">
                      <div className="template-library-card__header">
                        <strong>{template.name}</strong>
                        <span className="admin-pill admin-pill--strong">{`${template.templatePayload.pages.length} pages`}</span>
                      </div>
                      <p className="template-library-card__description">
                        {template.description || 'Reusable folio structure saved from your editor.'}
                      </p>
                      <p className="template-library-card__meta">
                        {template.preserveCopy ? 'Includes saved copy' : 'Structure and style only'}
                      </p>
                    </div>
                    <div className="template-library-card__actions">
                      <button
                        type="button"
                        className="button button--primary button--small"
                        disabled={templateActionBusyId === template.id}
                        onClick={() => void handleOpenUserTemplate(template)}
                      >
                        {templateActionBusyId === template.id ? 'Opening…' : 'Start new'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="panel-note">Save the current folio as a template to reuse it across future projects.</p>
            )}
          </section>
        </aside>

        <main id="main-content" ref={editorStageRef} className="editor-stage" aria-label="Live page editor">
          <div className="editor-canvas" ref={canvasRef}>
            <div ref={sheetProbeRef} className="magazine-sheet-probe" aria-hidden="true" />
            <div className="magazine-sheet magazine-sheet--editor" style={previewStyle}>
              <MagazinePreview
                issue={project.issue}
                page={selectedPage}
                assets={assetsById}
                frameRadius={project.frameRadius}
                pageNumber={selectedPageIndex + 1}
                selectedSlot={selectedSlot}
                interactive
                onSelectSlot={setSelectedSlot}
                onAssignDroppedAsset={assignAsset}
                onUpdateCrop={updateSlotCrop}
                onCropMetricsChange={handleCropMetricsChange}
              />
            </div>
          </div>
        </main>

        <EditorContentSidebar
          assetDeleteBusy={assetDeleteBusy}
          assetDeleteTargetId={assetDeleteTargetId}
          assetMutationBusy={assetMutationBusy}
          assetRetryTargetId={assetRetryTargetId}
          assetUsageCounts={assetUsageCounts}
          assignAsset={assignAsset}
          canUploadAssets={canUploadAssets}
          clearAssetPlacements={clearAssetPlacements}
          clearSelectedSlot={clearSelectedSlot}
          commitZoomInputValue={commitZoomInputValue}
          currentCrop={currentCrop}
          focusAssetPlacement={focusAssetPlacement}
          handleDeleteAsset={handleDeleteAsset}
          handleRetryAssetMirror={handleRetryAssetMirror}
          handleUploadFiles={handleUploadFilesWithLimit}
          handleZoomInputChange={handleZoomInputChange}
          libraryAssets={libraryAssets}
          nudgeSelectedCrop={nudgeSelectedCrop}
          nudgeSelectedScale={nudgeSelectedScale}
          projectAssetIds={projectAssetIds}
          removeUnusedAssetsFromIssue={removeUnusedAssetsFromIssue}
          resetZoomInputValue={resetZoomInputValue}
          selectedAsset={selectedAsset}
          selectedAssetId={selectedAssetId}
          selectedAssetPlacements={selectedAssetPlacements}
          selectedFrameLabel={selectedFrameLabel}
          selectedPage={selectedPage}
          selectedPagePositionLabel={selectedPagePositionLabel}
          selectedPageUsesBody={selectedPageUsesBody}
          selectedPageUsesDeck={selectedPageUsesDeck}
          selectedPageUsesKicker={selectedPageUsesKicker}
          selectedSlot={selectedSlot}
          unusedAssetCount={unusedAssetCount}
          updateSelectedCrop={updateSelectedCrop}
          updateSelectedPage={updateSelectedPage}
          uploadBusy={uploadBusy}
          uploadProgressDetail={uploadProgressDetail}
          uploadProgressLabel={uploadProgressLabel}
          uploadProgressPercent={uploadProgressPercent}
          uploadState={uploadState}
          zoomInputValue={zoomInputValue}
        />


        <EditorOperationsSidebar
          archiveActionLabel={archiveActionLabel}
          canRedo={canRedo}
          canUndo={canUndo}
          authReady={authReady}
          canSaveProject={canSaveProject}
          copyButtonLabel={copyButtonLabel}
          copyState={copyState}
          exportActionBusy={exportActionBusy}
          exportActionLabel={exportActionLabel}
          guestUploadTransferBusy={guestUploadTransferBusy}
          hasGuestUploadAssets={hasGuestUploadAssets}
          libraryBusy={libraryBusy}
          onArchiveToggle={() => void handleArchiveToggle(!projectRecord?.archivedAt)}
          onCloseTemplateComposer={() => setTemplateComposerOpen(false)}
          onCopyLink={() => void handleCopyLink()}
          onCopyPublicShareLink={() => void handleCopyPublicShareLink()}
          onDisableShare={() => void handleDisableProjectShare()}
          onDuplicateProject={() => void handleDuplicateCurrentProject()}
          onEnableShare={() => void handleEnableProjectShare()}
          onOpenAccountPage={openAccountPage}
          onOpenAdminPage={openAdminPage}
          onRedo={redo}
          onUndo={undo}
          onOpenSharedProject={() => {
            if (projectRecord?.share.path) {
              navigate(projectRecord.share.path);
            }
          }}
          onRegenerateShare={() => void handleEnableProjectShare({ rotate: true })}
          onSaveCurrentProjectAsTemplate={() => void handleSaveCurrentProjectAsTemplate()}
          onSaveProject={() => void saveProject({ manual: true })}
          onStartNewDraft={handleStartNewDraft}
          onTemplatePreserveCopyChange={(value) => setTemplatePreserveCopy(value)}
          onTemplateSaveDescriptionChange={(value) => setTemplateSaveDescription(value)}
          onTemplateSaveKindChange={(kind) => setTemplateSaveKind(kind)}
          onTemplateSaveNameChange={(value) => setTemplateSaveName(value)}
          onToggleExportCenter={() => setExportCenterOpen((current) => !current)}
          onToggleTemplateComposer={toggleTemplateComposer}
          project={project}
          projectActionBusy={projectActionBusy}
          projectModeTag={projectModeTag}
          projectMutationLocked={legacyProjectReadOnly}
          projectRecord={projectRecord}
          publicShareCopyLabel={publicShareCopyLabel}
          publicShareUrl={publicShareUrl}
          saveActionLabel={saveActionLabel}
          saveConflict={saveConflict}
          saveState={saveState}
          onReloadLatest={() => window.location.reload()}
          selectedPagePositionLabel={selectedPagePositionLabel}
          sequenceLabel={sequenceLabel}
          session={session}
          shareBusy={shareBusy}
          shareUrl={shareUrl}
          statusText={statusText}
          templateComposerOpen={templateComposerOpen}
          templatePreserveCopy={templatePreserveCopy}
          templateSaveActionLabel={templateSaveActionLabel}
          templateSaveBusy={templateSaveBusy}
          templateSaveDescription={templateSaveDescription}
          templateSaveKind={templateSaveKind}
          templateSaveName={templateSaveName}
          updateFrameRadius={updateFrameRadius}
          updateProject={updateProject}
        />
      </div>

      {exportCenterOpen ? (
        <EditorExportCenter
          exportActionBusy={exportActionBusy}
          exportAdvisories={exportAdvisories}
          exportDialogState={exportDialogState}
          exportPreflightIssues={exportPreflightIssues}
          exportSettings={exportSettings}
          exportSubmitLabel={exportSubmitLabel}
          onClose={() => setExportCenterOpen(false)}
          onRequestCloseIfIdle={() => {
            if (!exportActionBusy) {
              setExportCenterOpen(false);
            }
          }}
          onRunExport={() => void handleRunExport()}
          onRunPrint={() => void handlePrint()}
          onSelectPreflightIssue={(issue) => {
            setExportCenterOpen(false);
            setSelectedPageId(issue.pageId);
            setSelectedSlot(issue.slot ?? getInitialSlot(project.pages[issue.pageIndex]));
          }}
          updateExportSettings={updateExportSettings}
        />
      ) : null}

      {exportCaptureActive ? (
        <section
          ref={printStackRef}
          className="editor-print-stack is-export-capture-active"
          aria-hidden="true"
        >
          {project.pages.map((page, index) => (
            <div
              className="editor-print-page"
              key={page.id}
              ref={(node) => {
                printPageRefs.current[page.id] = node;
              }}
            >
              <div className="magazine-sheet magazine-sheet--print">
                <MagazinePreview
                  issue={project.issue}
                  page={page}
                  assets={printAssetsById ?? assetsById}
                  frameRadius={project.frameRadius}
                  pageNumber={index + 1}
                />
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
