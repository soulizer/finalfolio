import { countLabel, useT } from '../i18n';
import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MagazinePreview } from '../components/MagazinePreview';
import { TemplateIssuePreview } from '../components/TemplateIssuePreview';
import { LayoutThumbnail } from '../components/LayoutThumbnail';
import { AccountUploadListItem, importAssetFromUrl } from '../editor/api';
import { getConfirmationMessage } from '../editor/confirmations';
import { formatDateTime } from '../editor/dateFormat';
import { getAssetSource } from '../editor/assetResources';
import {
  cloneCustomTemplateDefinition,
  countImageSlots,
  createCustomTemplateDefinition,
  createDefaultProject,
  defaultTemplatePackId,
  getPageSlotOrder,
  getTemplateLabel,
  pageThemeMeta,
  pageThemeOrder,
  pageStarters,
  templateUsesBody,
  templateUsesDeck,
  templateUsesKicker,
  templatePacks,
  templateMeta,
  TemplatePackId,
} from '../editor/demoData';
import {
  PROJECT_ASSET_LIMIT,
  PROJECT_PAGE_LIMIT,
} from '../editor/limits';
import { applyAiPlanToProject, type AiPlan, type AiPlanBundle } from '../editor/aiPlans';
import { customTemplatesEqual, type CustomLayoutRecord } from '../editor/customLayouts';
import { buildExportAdvisories } from '../editor/export';
import { readDraftProject } from '../editor/storage';
import {
  Asset,
  CustomTemplateDefinition,
  ExportSettings,
  PageData,
  ProjectRecord,
  ProjectState,
  TemplateId,
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
import { AiArrangeDialog, type AiPhoto } from './editor/AiArrangeDialog';
import { LayoutEditorDialog } from './editor/LayoutEditorDialog';
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
import { useCustomLayoutLibrary } from './editor/useCustomLayoutLibrary';
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

  return 'Saved %s.'.replace('%s', formatDateTime(timestamp));
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
  const t = useT();
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
  const {
    activeCustomLayout,
    activeCustomLayoutId,
    customLayouts,
    deleteCustomLayoutById,
    layoutsExpanded,
    selectBuiltinLayout,
    selectCustomLayout,
    setLayoutsExpanded,
    upsertCustomLayout,
  } = useCustomLayoutLibrary({
    selectedPage,
    selectedPageId,
    templateChoice,
    setCustomTemplateDraft,
    setTemplateChoice,
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
  const [templatePickerOpen, setTemplatePickerOpen] = useState(true);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [layoutEditor, setLayoutEditor] = useState<{
    mode: 'new' | 'edit';
    layoutId: string | null;
    template: CustomTemplateDefinition;
    name: string;
  } | null>(null);
  const [starterPacksOpen, setStarterPacksOpen] = useState(false);
  const [colorPickerPageId, setColorPickerPageId] = useState<string | null>(null);
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const pendingUploadSlotRef = useRef<string | null>(null);
  const quickUploadInputRef = useRef<HTMLInputElement | null>(null);
  const assetCountRef = useRef(0);
  const [dragOverPageId, setDragOverPageId] = useState<string | null>(null);
  const [importUrlBusy, setImportUrlBusy] = useState(false);
  const [starterPacksAutoOpened, setStarterPacksAutoOpened] = useState(false);
  const lastSavedSnapshotRef = useRef('');
  const printAssetFingerprintRef = useRef('');
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const sheetProbeRef = useRef<HTMLDivElement | null>(null);
  const printStackRef = useRef<HTMLElement | null>(null);
  const printPageRefs = useRef<Record<string, HTMLDivElement | null>>({});
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
  // Custom layouts are ordinary templates: they sit in the same picker grid.
  // Four familiar built-ins and two saved layouts stay visible; the rest fold
  // behind one control so the panel does not become a long wall of cards.
  const layoutPickerEntries = useMemo(() => {
    const builtIns = visibleTemplateIds
      .filter((templateId) => templateId !== 'custom')
      .map((templateId) => ({ kind: 'builtin' as const, templateId, key: `builtin:${templateId}` }));
    const custom = customLayouts.map((layout) => ({
      kind: 'custom' as const,
      layout,
      key: `custom:${layout.id}`,
    }));
    return [...builtIns, ...custom];
  }, [customLayouts, visibleTemplateIds]);
  const commonLayoutEntries = useMemo(
    () => [
      ...layoutPickerEntries.filter((entry) => entry.kind === 'builtin').slice(0, 4),
      ...layoutPickerEntries.filter((entry) => entry.kind === 'custom').slice(0, 2),
    ],
    [layoutPickerEntries],
  );
  const moreLayoutEntries = useMemo(
    () => layoutPickerEntries.filter((entry) => !commonLayoutEntries.includes(entry)),
    [commonLayoutEntries, layoutPickerEntries],
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
  const uploadProgressLabel = uploadBusy ? `Photo ${Math.max(uploadState.currentFileIndex, 1)}/${Math.max(uploadState.totalFiles, 1)}` : t('Upload');
  const uploadProgressDetail =
    uploadState.phase === 'preparing'
      ? `Optimizing ${uploadState.currentFileName} before ${session ? 'upload' : t('adding it locally')}.`
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
    clearTemplateHoverPreview,
    commitZoomInputValue,
    handleCropMetricsChange,
    handleZoomInputChange,
    nudgeSelectedCrop,
    nudgeSelectedScale,
    openTemplateHoverPreview,
    resetZoomInputValue,
    selectedCropMetrics,
    templateHoverPreview,
    zoomInputValue,
  } = useEditorUiState({
    selectedPageId: selectedPage?.id,
    selectedSlot,
    currentCrop,
    templatePickerOpen,
    updateSelectedCrop,
  });

  const {
    applyTheme,
    updateFrameRadius,
  } = createEditorDesignActions({
    updateProject,
    updateSelectedPage,
    setCustomTemplateDraft,
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
    insertPage,
    moveSelectedPage,
    removeSelectedPage,
    reorderPages,
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

  const openNewLayoutEditor = useCallback(() => {
    setLayoutEditor({
      mode: 'new',
      layoutId: null,
      template: createCustomTemplateDefinition({ name: t('Untitled layout') }),
      name: '',
    });
  }, [t]);

  const openEditLayoutEditor = useCallback(
    (layout: CustomLayoutRecord) => {
      const template = cloneCustomTemplateDefinition(layout.template);
      selectCustomLayout(layout);
      setLayoutEditor({
        mode: 'edit',
        layoutId: layout.id,
        template,
        name: template.name,
      });
    },
    [selectCustomLayout],
  );

  const handleSaveLayoutEditor = useCallback(
    (template: CustomTemplateDefinition, applyToPage: boolean) => {
      const record = upsertCustomLayout(layoutEditor?.layoutId ?? null, template);
      if (applyToPage) {
        applyTemplateChoice('custom', record.template);
      }
      setLayoutEditor(null);
    },
    [applyTemplateChoice, layoutEditor?.layoutId, upsertCustomLayout],
  );

  const handleDeleteLayoutEditor = useCallback(async () => {
    if (!layoutEditor?.layoutId) {
      return;
    }

    const deleted = await deleteCustomLayoutById(layoutEditor.layoutId);
    if (deleted) {
      setLayoutEditor(null);
    }
  }, [deleteCustomLayoutById, layoutEditor?.layoutId]);

  const handleOpenProjectTemplateComposer = useCallback(() => {
    setTemplateSaveKind('project');
    setTemplateComposerOpen(true);
  }, [setTemplateComposerOpen, setTemplateSaveKind]);

  const handleImportFromUrl = useCallback(
    async (rawUrl: string) => {
      const url = rawUrl.trim();
      if (!url || importUrlBusy) {
        return;
      }

      setImportUrlBusy(true);
      try {
        const asset = await importAssetFromUrl(url);
        updateProject((current) => ({
          ...current,
          assets: [asset, ...current.assets],
        }));
        setMessage(t('Added %s from the URL.').replace('%s', asset.name));
      } catch (error) {
        setMessage(error instanceof Error ? t(error.message) : t('Unable to import from this URL.'));
      } finally {
        setImportUrlBusy(false);
      }
    },
    [importUrlBusy, setMessage, t, updateProject],
  );

  const handleRequestUpload = useCallback((slot: string) => {
    pendingUploadSlotRef.current = slot;
    quickUploadInputRef.current?.click();
  }, []);

  const assignAssetRef = useRef(assignAsset);
  assignAssetRef.current = assignAsset;

  useEffect(() => {
    const previousCount = assetCountRef.current;
    assetCountRef.current = project.assets.length;
    const pendingSlot = pendingUploadSlotRef.current;
    if (pendingSlot && project.assets.length > previousCount && project.assets[0]) {
      assignAssetRef.current(pendingSlot, project.assets[0].id);
      pendingUploadSlotRef.current = null;
    }
  }, [project.assets]);

  const handleTextEditCommit = useCallback(
    (field: 'kicker' | 'title' | 'deck' | 'body' | 'caption', value: string) => {
      updateSelectedPage((current) => ({ ...current, [field]: value }));
    },
    [updateSelectedPage],
  );

  useEffect(() => {
    if (!colorPickerPageId) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setColorPickerPageId(null);
      }
    };
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.page-color-popover') && !target?.closest('.page-chip__dot')) {
        setColorPickerPageId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [colorPickerPageId]);

  // Empty drafts open the starter packs so the first step is obvious; drafts with
  // real content keep them collapsed to protect the existing work.
  useEffect(() => {
    if (starterPacksAutoOpened) {
      return;
    }
    const pageMatchesStarter = (page: (typeof project.pages)[number]) => {
      const starter = pageStarters[page.template];
      if (!starter) {
        return false;
      }
      return (['kicker', 'title', 'deck', 'body', 'caption'] as const).every(
        (key) => page[key] === starter[key],
      );
    };
    const hasContent =
      project.pages.some((page) => Array.from(projectAssetIds).some((assetId) => Object.values(page.slots).includes(assetId))) ||
      !project.pages.every(pageMatchesStarter);
    if (!hasContent && !projectRecord) {
      setStarterPacksAutoOpened(true);
      setStarterPacksOpen(true);
    } else if (hasContent || projectRecord) {
      setStarterPacksAutoOpened(true);
      setStarterPacksOpen(false);
    }
  }, [project, projectRecord, projectAssetIds, starterPacksAutoOpened]);

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

  const aiPhotoCapacity = Math.max(0, PROJECT_ASSET_LIMIT - project.assets.length);

  const openAiDialog = useCallback(() => {
    if (!session) {
      navigate(`/auth?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`);
      return;
    }

    if (aiPhotoCapacity <= 0) {
      setMessage(
        t('This folio is full. Remove unused photos before using AI arrangement.').replace(
          '%s',
          String(PROJECT_ASSET_LIMIT),
        ),
      );
      return;
    }

    setAiDialogOpen(true);
  }, [aiPhotoCapacity, navigate, session, setMessage, t]);

  const handleImportUrlForAi = useCallback(
    async (url: string) => {
      const asset = await importAssetFromUrl(url);
      updateProject((current) => ({
        ...current,
        assets: [asset, ...current.assets.filter((entry) => entry.id !== asset.id)],
      }));
      setMessage(t('Added %s from the URL.').replace('%s', asset.name));
      return asset;
    },
    [setMessage, t, updateProject],
  );

  const handleApplyAiPlan = useCallback(
    async (bundle: AiPlanBundle, plan: AiPlan, photos: AiPhoto[]) => {
      const localPhotos = photos.filter((photo) => photo.kind === 'local' && photo.file);
      let uploaded: Array<Asset | null> | undefined = [];
      if (localPhotos.length) {
        uploaded = await handleUploadFiles(localPhotos.map((photo) => photo.file!));
        if (!uploaded) {
          throw new Error(t('Unable to upload the selected photos.'));
        }
      }

      let localIndex = 0;
      const resolvedAssets: Array<Asset | null> = photos.map((photo) => {
        if (photo.kind === 'asset') {
          return photo.asset ?? assetsById[photo.assetId ?? ''] ?? null;
        }
        const asset = uploaded?.[localIndex] ?? null;
        localIndex += 1;
        return asset;
      });
      const availableAssets = resolvedAssets.filter((asset): asset is Asset => Boolean(asset));
      if (!availableAssets.length) {
        throw new Error(t('None of the selected photos could be uploaded.'));
      }

      const latestProject = getProject();
      const usedIndexes = new Set(plan.pages.flatMap((page) => page.assetIndexes));
      const usedAssets = resolvedAssets.filter(
        (asset, index): asset is Asset => Boolean(asset) && usedIndexes.has(index),
      );
      const resolvedIds = new Set(usedAssets.map((asset) => asset.id));
      const projectWithUploads = {
        ...latestProject,
        assets: [...usedAssets, ...latestProject.assets.filter((asset) => !resolvedIds.has(asset.id))],
      };
      const nextProject = applyAiPlanToProject({
        project: projectWithUploads,
        bundle,
        plan,
        assets: resolvedAssets,
        createPageId,
      });
      updateProject(() => nextProject);

      const firstPage = nextProject.pages[0];
      if (firstPage) {
        setSelectedPageId(firstPage.id);
        setSelectedSlot(getInitialSlot(firstPage));
        setTemplateChoice(firstPage.template);
      }

      const failedCount = resolvedAssets.filter((asset) => !asset).length;
      setMessage(
        failedCount > 0
          ? t('AI arrangement applied. %s photos could not be uploaded and their frames are empty.').replace(
              '%s',
              String(failedCount),
            )
          : t('AI arrangement applied.'),
      );
    },
    [
      assetsById,
      getProject,
      handleUploadFiles,
      setMessage,
      setSelectedPageId,
      setSelectedSlot,
      setTemplateChoice,
      t,
      updateProject,
    ],
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

  const slotLabelKeys: Record<string, string> = {
    hero: 'Hero',
    lead: 'Lead frame',
    left: 'Left frame',
    right: 'Right frame',
    top: 'Top frame',
    bottom: 'Bottom frame',
    a: 'Frame A',
    b: 'Frame B',
    c: 'Frame C',
    d: 'Frame D',
  };
  const selectedFrameLabel =
    selectedSlot && selectedPage?.template === 'custom'
      ? selectedPage.customTemplate?.frames.find((frame) => frame.slot === selectedSlot)?.label ?? selectedSlot
      : selectedSlot
        ? t(slotLabelKeys[selectedSlot] ?? selectedSlot)
        : null;
  const fallbackStatus = !projectRecord
    ? hasGuestUploadAssets
      ? session
        ? guestUploadTransferBusy
          ? t('Attaching recovered local uploads to this account before saving.')
          : t('Recovered local uploads are still pending account attachment before this folio can be saved.')
        : t('Local uploads are kept on this device. Sign in to attach them to your account before creating a saved link.')
      : t('Draft only. Create a stable editor URL to save this folio on the server.')
    : legacyProjectReadOnly
      ? session
        ? t('Legacy read-only project. Duplicate it into your account before saving, sharing, or archiving.')
        : t('Legacy read-only project. Sign in to duplicate it into your account before editing.')
      : saveState === 'saving'
        ? t('Saving changes to the server...')
        : saveState === 'dirty'
          ? t('Changes queued. Autosave will sync this folio shortly.')
          : saveState === 'error'
            ? t('Save failed. Retry to keep this URL current.')
            : formatSavedAt(projectRecord.updatedAt);
  // Pending/unsaved state must never be hidden behind an action message such as
  // "Preset applied"; the user needs to see that the folio still has to be saved.
  const showSaveState =
    saveState === 'dirty' || saveState === 'saving' || saveState === 'error' || !projectRecord || legacyProjectReadOnly;
  const statusText =
    printBusy
      ? t('Preparing print-ready pages %s/%s...')
          .replace('%s', String(printState.completedAssets))
          .replace('%s', String(printState.totalAssets))
      : assetMutationBusy
        ? t('Updating the media library...')
      : uploadState.phase === 'preparing'
        ? t('Preparing upload %s/%s...')
          .replace('%s', String(uploadState.completedFiles))
          .replace('%s', String(uploadState.totalFiles))
        : uploadState.phase === 'uploading'
          ? `${session ? t('Uploading') : t('Adding')} images %s%...`.replace('%s', String(uploadProgressPercent))
          : showSaveState
            ? fallbackStatus
            : message ?? fallbackStatus;
  const sequenceLabel =
    project.pages.length === 1 ? t('1 page') : t('%s pages').replace('%s', String(project.pages.length));
  const selectedPagePositionLabel = t('Page %s of %s')
    .replace('%s', String(selectedPageIndex + 1))
    .replace('%s', String(project.pages.length));
  const selectedTemplateLabel = getTemplateLabel(templateChoice, templateChoice === 'custom' ? customTemplateDraft : null);
  const isCurrentLayoutSelected =
    templateChoice === 'custom'
      ? Boolean(
          selectedPage.template === 'custom' &&
            selectedPage.customTemplate &&
            customTemplatesEqual(customTemplateDraft, selectedPage.customTemplate),
        )
      : templateChoice === selectedPage.template;
  const selectedAssetId = selectedSlot ? selectedPage.slots[selectedSlot] : null;
  const selectedPageUsesKicker = templateUsesKicker(selectedPage.template);
  const selectedPageUsesDeck = templateUsesDeck(selectedPage.template);
  const selectedPageUsesBody = templateUsesBody(selectedPage.template, selectedPage.customTemplate);
  const projectModeTag = !projectRecord
    ? session
      ? t('Local draft')
      : t('Guest draft')
    : legacyProjectReadOnly
      ? t('Legacy read-only')
      : projectRecord.archivedAt
        ? t('Archived')
        : t('Saved link');
  const copyButtonLabel = copyState === 'copied' ? t('Copied') : copyState === 'error' ? t('Copy failed') : t('Copy link');
  const publicShareUrl =
    projectRecord?.share.path && typeof window !== 'undefined' ? new URL(projectRecord.share.path, window.location.origin).toString() : '';
  const publicShareCopyLabel =
    shareCopyState === 'copied' ? t('Copied') : shareCopyState === 'error' ? t('Copy failed') : t('Copy public link');
  const saveActionLabel = saveState === 'saving'
    ? t('Saving…')
    : legacyProjectReadOnly
      ? t('Duplicate to edit')
      : hasGuestUploadAssets
        ? session
          ? t('Uploads pending')
          : t('Sign in to save')
        : projectRecord
          ? t('Save')
          : t('Save folio');
  const exportActionBusy = exportBusy || printBusy;
  const exportActionLabel = exportActionBusy ? t('Preparing…') : exportCenterOpen ? t('Close export') : t('Export Center');
  const themeChoiceMatchesAllPages = project.pages.every((page) => page.theme === themeChoice);
  const exportSubmitDefaultLabel =
    exportSettings.format === 'project'
      ? t('Download project')
      : exportSettings.format === 'pdf'
        ? t('Export PDF')
        : exportSettings.jpgMode === 'combined'
          ? t('Export stitched JPG')
          : t('Export JPG set');
  const exportSubmitLabel =
    exportDialogState?.text ??
    (printBusy ? `Preparing ${printState.completedAssets}/${printState.totalAssets}...` : exportSubmitDefaultLabel);
  const templateSaveActionLabel =
    templateSaveBusy ? t('Saving…') : templateSaveKind === 'page' ? t('Save page template') : t('Save project template');
  const archiveActionLabel =
    projectActionBusy === 'archive'
      ? t('Archiving…')
      : projectActionBusy === 'unarchive'
        ? t('Restoring…')
        : projectRecord?.archivedAt
          ? t('Unarchive')
          : t('Archive');
  const hoveredTemplateMeta = templateHoverPreview ? templateMeta[templateHoverPreview.templateId] : null;
  const hoveredTemplateLabel = templateHoverPreview
    ? templateHoverPreview.label ??
      getTemplateLabel(templateHoverPreview.templateId, templateHoverPreview.templateId === 'custom' ? customTemplateDraft : null)
    : '';
  const hoveredTemplateDescription = templateHoverPreview
    ? templateHoverPreview.description ??
      (templateHoverPreview.templateId === 'custom'
        ? t('Current custom scaffold preview.')
        : hoveredTemplateMeta?.description ?? '')
    : '';
  const hoveredTemplateUseCase = templateHoverPreview?.useCase ?? hoveredTemplateMeta?.useCase ?? '';
  const protectedProjectLocked = authReady && !authRefreshFailed && !session && Boolean(projectRecord?.ownerUserId);
  const projectTemplateSectionTag = t('%s ready').replace('%s', String(visibleTemplatePackIds.length));
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

  const renderLayoutCard = (entry: (typeof layoutPickerEntries)[number]) => {
    if (entry.kind === 'custom') {
      const layout = entry.layout;
      const isSelected = templateChoice === 'custom' && activeCustomLayoutId === layout.id;
      const description = layout.summary
        ? t(layout.summary)
        : t('%s frames').replace('%s', String(layout.template.frames.length));
      const openPreview = (element: HTMLElement, point?: { x: number; y: number }) =>
        openTemplateHoverPreview('custom', element, point, {
          label: layout.name,
          description,
        });

      return (
        <article
          key={entry.key}
          className={`layout-card layout-card--custom ${isSelected ? 'is-active' : ''}`}
          onMouseEnter={(event) => openPreview(event.currentTarget, { x: event.clientX, y: event.clientY })}
          onMouseMove={(event) => openPreview(event.currentTarget, { x: event.clientX, y: event.clientY })}
          onMouseLeave={clearTemplateHoverPreview}
        >
          <button
            type="button"
            className="layout-card__pick"
            aria-pressed={isSelected}
            title={t(layout.name)}
            onClick={() => void selectCustomLayout(layout)}
            onFocus={(event) => openPreview(event.currentTarget)}
            onBlur={clearTemplateHoverPreview}
          >
            <LayoutThumbnail templateId="custom" customTemplate={layout.template} />
            <span className="layout-card__name">{t(layout.name)}</span>
          </button>
          <button
            type="button"
            className="layout-card__edit"
            aria-label={t('Edit layout')}
            title={t('Edit layout')}
            onClick={() => openEditLayoutEditor(layout)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M9.6 3.1l3.3 3.3M3.2 12.8l1.1-3.4 6-6a1.4 1.4 0 0 1 2 0l.3.3a1.4 1.4 0 0 1 0 2l-6 6-3.4 1.1Z" />
            </svg>
          </button>
        </article>
      );
    }

    const templateId = entry.templateId;
    const isSelected = templateChoice === templateId;
    const openPreview = (element: HTMLElement, point?: { x: number; y: number }) =>
      openTemplateHoverPreview(templateId, element, point);

    return (
      <article
        key={entry.key}
        className={`layout-card ${isSelected ? 'is-active' : ''}`}
        onMouseEnter={(event) => openPreview(event.currentTarget, { x: event.clientX, y: event.clientY })}
        onMouseMove={(event) => openPreview(event.currentTarget, { x: event.clientX, y: event.clientY })}
        onMouseLeave={clearTemplateHoverPreview}
      >
        <button
          type="button"
          className="layout-card__pick"
          aria-pressed={isSelected}
          title={t(templateMeta[templateId].label)}
          onClick={() => void selectBuiltinLayout(templateId)}
          onFocus={(event) => openPreview(event.currentTarget)}
          onBlur={clearTemplateHoverPreview}
        >
          <LayoutThumbnail templateId={templateId} />
          <span className="layout-card__name">{t(templateMeta[templateId].label)}</span>
        </button>
      </article>
    );
  };

  return (
    <div className="editor-shell">
      <h1 className="sr-only">{t('Folio editor')}</h1>
      <input
        ref={quickUploadInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        multiple
        hidden
        aria-label={t('Upload photo')}
        onChange={(event) => {
          const input = event.currentTarget;
          const files = Array.from(input.files ?? []);
          if (files.length) {
            void handleUploadFilesWithLimit(files);
          }
          input.value = '';
        }}
      />
      <div className="editor-layout">
        <aside className="editor-sidebar editor-sidebar--navigation">
          <section className="page-strip-panel">
            <div className="editor-panel__toolbar">
              <span className="editor-panel__label">{t('Sequence')}</span>
              <span className="panel-tag">{sequenceLabel}</span>
            </div>

            <button type="button" className="button button--primary button--small ai-arrange-button" onClick={openAiDialog}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 1.8l1.2 3.3 3.3 1.2-3.3 1.2L8 10.8 6.8 7.5 3.5 6.3l3.3-1.2L8 1.8Z" />
                <path d="M12.6 9.4l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
              </svg>
              {t('Arrange with AI')}
            </button>

            <div className="page-strip">
              {project.pages.map((page, index) => {
                const isActive = page.id === selectedPage.id;
                const pagePositionLabel = t('Page %s').replace('%s', String(index + 1));

                return (
                  <article
                    key={page.id}
                    className={`page-chip page-chip--theme-${page.theme} ${isActive ? 'is-active' : ''} ${
                      draggedPageId === page.id ? 'is-dragging' : ''
                    } ${dragOverPageId === page.id && draggedPageId !== page.id ? 'is-drop-target' : ''}`.trim()}
                    onDragOver={(event) => {
                      if (!draggedPageId) {
                        return;
                      }
                      event.preventDefault();
                      setDragOverPageId(page.id);
                    }}
                    onDragLeave={() => {
                      setDragOverPageId((current) => (current === page.id ? null : current));
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const fromIndex = project.pages.findIndex((entry) => entry.id === draggedPageId);
                      if (fromIndex >= 0) {
                        reorderPages(fromIndex, index);
                      }
                      setDraggedPageId(null);
                      setDragOverPageId(null);
                    }}
                  >
                    <div className="page-chip__head">
                      <button
                        type="button"
                        className="page-chip__select"
                        draggable
                        title={t('Drag to reorder pages')}
                        onDragStart={(event) => {
                          setDraggedPageId(page.id);
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', page.id);
                        }}
                        onDragEnd={() => {
                          setDraggedPageId(null);
                          setDragOverPageId(null);
                        }}
                        onClick={() => {
                          selectPage(page.id);
                          setColorPickerPageId(null);
                        }}
                      >
                        <span className="page-chip__index">{pagePositionLabel}</span>
                        <em>{t(getTemplateLabel(page.template, page.customTemplate))}</em>
                      </button>
                      <button
                        type="button"
                        className={`page-chip__dot theme-card__swatch--${page.theme}`}
                        title={t('Paper color')}
                        aria-label={t('Paper color')}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!isActive) {
                            selectPage(page.id);
                          }
                          setColorPickerPageId((current) => (current === page.id ? null : page.id));
                        }}
                      />
                    </div>
                    {isActive ? (
                      <button
                        type="button"
                        className="page-chip__title"
                        onClick={() => {
                          selectPage(page.id);
                          setColorPickerPageId(null);
                        }}
                      >
                        {page.title}
                      </button>
                    ) : null}
                    {colorPickerPageId === page.id ? (
                      <div className="page-color-popover surface-popover" role="group" aria-label={t('Paper color')}>
                        <div className="page-color-popover__swatches">
                          {pageThemeOrder.map((themeId) => (
                            <button
                              key={themeId}
                              type="button"
                              className={`page-color-popover__swatch theme-card__swatch--${themeId} ${page.theme === themeId ? 'is-active' : ''}`}
                              title={t(pageThemeMeta[themeId].label)}
                              aria-label={t(pageThemeMeta[themeId].label)}
                              aria-pressed={page.theme === themeId}
                              onClick={() => {
                                if (!isActive) {
                                  selectPage(page.id);
                                }
                                if (page.theme !== themeId) {
                                  applyTheme(themeId, 'page');
                                }
                                setColorPickerPageId(null);
                              }}
                            >
                              {page.theme === themeId ? (
                                <span className="page-color-popover__check" aria-hidden="true">
                                  ✓
                                </span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="page-color-popover__apply-all"
                          onClick={() => {
                            applyTheme(page.theme, 'all');
                            setColorPickerPageId(null);
                          }}
                        >
                          {t('Apply to all pages')}
                        </button>
                      </div>
                    ) : null}
                    {isActive ? (
                      <div className="page-chip__actions" aria-label={t('Actions for %s').replace('%s', pagePositionLabel)}>
                        <button
                          type="button"
                          className="page-chip__action"
                          title={t('Duplicate page')}
                          aria-label={t('Duplicate page')}
                          onClick={duplicatePage}
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <rect x="5.5" y="3.5" width="7" height="9" rx="1.2" />
                            <path d="M10.5 12.5H4.5A1 1 0 0 1 3.5 11.5V6" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="page-chip__action"
                          title={t('Move page up')}
                          aria-label={t('Move page up')}
                          disabled={selectedPageIndex <= 0}
                          onClick={() => moveSelectedPage(-1)}
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M8 12.5V4M4.5 7.5 8 4l3.5 3.5" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="page-chip__action"
                          title={t('Move page down')}
                          aria-label={t('Move page down')}
                          disabled={selectedPageIndex >= project.pages.length - 1}
                          onClick={() => moveSelectedPage(1)}
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M8 3.5V12M4.5 8.5 8 12l3.5-3.5" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="page-chip__action page-chip__action--danger"
                          title={project.pages.length === 1 ? t('Keep at least one page') : t('Delete page')}
                          aria-label={project.pages.length === 1 ? t('Keep at least one page') : t('Delete page')}
                          disabled={project.pages.length === 1}
                          onClick={removeSelectedPage}
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M3.5 4.5h9M6.2 4.5V3.2h3.6v1.3M5 4.5l.5 8.3h5l.5-8.3M6.8 7v3.6M9.2 7v3.6" />
                          </svg>
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="editor-panel editor-panel--layout">
            <div className="editor-panel__toolbar">
              <span className="editor-panel__label">{t('Page layout')}</span>
              <div className="editor-collapsible-meta">
                <span className="panel-tag">{t(selectedTemplateLabel)}</span>
                <button
                  type="button"
                  className="editor-toggle-icon"
                  onClick={() => setTemplatePickerOpen((current) => !current)}
                  aria-expanded={templatePickerOpen}
                  aria-label={templatePickerOpen ? t('Collapse page layouts') : t('Expand page layouts')}
                  title={templatePickerOpen ? t('Collapse page layouts') : t('Expand page layouts')}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d={templatePickerOpen ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} />
                  </svg>
                </button>
              </div>
            </div>
            {templatePickerOpen ? (
              <>
                <div className="layout-grid">
                  {commonLayoutEntries.map(renderLayoutCard)}
                </div>
                {layoutsExpanded && moreLayoutEntries.length ? (
                  <div className="layout-grid layout-grid--more" id="layout-grid-more">
                    {moreLayoutEntries.map(renderLayoutCard)}
                  </div>
                ) : null}
                <div className="layout-picker-footer">
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={openNewLayoutEditor}
                  >
                    {t('New custom layout')}
                  </button>
                  {moreLayoutEntries.length ? (
                    <button
                      type="button"
                      className="button button--ghost button--small layout-grid__more"
                      aria-expanded={layoutsExpanded}
                      aria-controls="layout-grid-more"
                      onClick={() => setLayoutsExpanded((current) => !current)}
                    >
                      {layoutsExpanded
                        ? t('Show fewer layouts')
                        : `${t('More layouts')} (${moreLayoutEntries.length})`}
                    </button>
                  ) : null}
                </div>
                <p className="panel-note layout-picker-note">
                  {t('Saved layouts stay in this browser.')}
                </p>
                <div className="layout-selection-actions">
                  <div className="layout-selection-actions__label-row">
                    <span className="layout-selection-actions__label">{t(selectedTemplateLabel)}</span>
                    {activeCustomLayout ? (
                      <button
                        type="button"
                        className="button button--ghost button--small layout-selection-actions__edit"
                        onClick={() => openEditLayoutEditor(activeCustomLayout)}
                      >
                        {t('Edit layout')}
                      </button>
                    ) : null}
                  </div>
                  <div className="layout-selection-actions__buttons">
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      disabled={project.pages.length >= PROJECT_PAGE_LIMIT}
                      onClick={() => insertPage(templateChoice, 'before')}
                    >
                      {t('Insert above')}
                    </button>
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      disabled={isCurrentLayoutSelected}
                      onClick={() => applyTemplateChoice(templateChoice)}
                    >
                      {t('Replace this page')}
                    </button>
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      disabled={project.pages.length >= PROJECT_PAGE_LIMIT}
                      onClick={() => insertPage(templateChoice, 'after')}
                    >
                      {t('Insert below')}
                    </button>
                  </div>
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
              <div className="template-hover-preview__meta">
                <span>{t(hoveredTemplateLabel)}</span>
                <p>{t(hoveredTemplateDescription)}</p>
                {hoveredTemplateUseCase ? (
                  <small>
                    {t('Recommended for')} · {t(hoveredTemplateUseCase)}
                  </small>
                ) : null}
              </div>
            </div>
          ) : null}

          <section className="editor-panel editor-panel--starter-packs">
            <div className="editor-panel__toolbar">
              <span className="editor-panel__label">{t('Project templates')}</span>
              <div className="editor-collapsible-meta">
                <span className="panel-tag">{projectTemplateSectionTag}</span>
                <button
                  type="button"
                  className="editor-toggle-icon"
                  onClick={() => setStarterPacksOpen((current) => !current)}
                  aria-expanded={starterPacksOpen}
                  aria-label={starterPacksOpen ? t('Collapse project templates') : t('Expand project templates')}
                  title={starterPacksOpen ? t('Collapse project templates') : t('Expand project templates')}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d={starterPacksOpen ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} />
                  </svg>
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
                        <span>{packId === defaultTemplatePackId ? t('%s default').replace('%s', t(pack.label)) : t(pack.label)}</span>
                        <strong>{t(pack.summary)}</strong>
                        <p>{t(pack.description)}</p>
                      </div>
                      <p className="template-pack-card__stats">
                        {t('%s pages · %s image areas')
                          .replace('%s', String(pack.pages.length))
                          .replace('%s', String(countImageSlots(pack.pages)))}
                      </p>
                      <p className="template-pack-card__sequence">
                        {pack.pages
                          .map((page) => t(getTemplateLabel(page.template, page.customTemplate)))
                          .join(' / ')}
                      </p>
                      <div className="template-pack-card__actions">
                        <button
                          type="button"
                          className="button button--danger-ghost button--small"
                          title={t('Replaces every page in this folio. Photos stay in the media library.')}
                          onClick={() => applyTemplatePack(packId, 'replace')}
                        >
                          {t('Use as project')}</button>
                        <button
                          type="button"
                          className="button button--ghost button--small"
                          onClick={() => applyTemplatePack(packId, 'insert')}
                        >
                          {t('Insert')}</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
            <button
              type="button"
              className="button button--ghost button--small template-pack-save"
              disabled={!session}
              title={!session ? t('Sign in to save project templates.') : t('Save the current folio as a reusable project template.')}
              onClick={handleOpenProjectTemplateComposer}
            >
              {t('Save current project as template')}
            </button>
          </section>

          <section className="editor-panel editor-panel--user-templates">
            <div className="editor-panel__toolbar">
              <span className="editor-panel__label">{t('My templates')}</span>
              <div className="editor-collapsible-meta">
                <span className="panel-tag">
                  {session ? countLabel(userTemplates.length, '1 saved', '%s saved') : t('Sign in')}
                </span>
                {session ? (
                  <Link
                    to="/account?section=templates"
                    className="editor-icon-link"
                    aria-label={t('Manage templates')}
                    title={t('Manage templates')}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M9.6 3.1l3.3 3.3M3.2 12.8l1.1-3.4 6-6a1.4 1.4 0 0 1 2 0l.3.3a1.4 1.4 0 0 1 0 2l-6 6-3.4 1.1Z" />
                    </svg>
                  </Link>
                ) : null}
              </div>
            </div>
            {!session ? (
              <p className="panel-note">{t('Sign in to save reusable templates and reopen them as new folios.')}</p>
            ) : templateLibraryBusy ? (
              <p className="panel-note">{t('Loading saved templates...')}</p>
            ) : userTemplates.length ? (
              <div className="template-library-grid template-library-grid--editor">
                {userTemplates.map((template) => (
                  <article key={template.id} className="template-library-card">
                    <TemplateIssuePreview templatePayload={template.templatePayload} className="template-library-card__preview" />
                    <div className="template-library-card__body">
                      <div className="template-library-card__header">
                        <strong>{template.name}</strong>
                        <span className="admin-pill admin-pill--strong">
                          {countLabel(template.templatePayload.pages.length, '1 page', '%s pages')}
                        </span>
                      </div>
                      <p className="template-library-card__description">
                        {template.description || t('Reusable folio structure saved from your editor.')}
                      </p>
                      <p className="template-library-card__meta">
                        {t('%s pages · %s image areas')
                          .replace('%s', String(template.templatePayload.pages.length))
                          .replace('%s', String(countImageSlots(template.templatePayload.pages)))}
                      </p>
                      <p className="template-library-card__meta">
                        {template.preserveCopy ? t('Includes saved copy') : t('Structure and style only')}
                      </p>
                    </div>
                    <div className="template-library-card__actions">
                      <button
                        type="button"
                        className="button button--primary button--small"
                        disabled={templateActionBusyId === template.id}
                        onClick={() => void handleOpenUserTemplate(template)}
                      >
                        {templateActionBusyId === template.id ? t('Opening…') : t('Start new')}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="panel-note">{t('Save the current folio as a template to reuse it across future projects.')}</p>
            )}
          </section>
        </aside>

        <main id="main-content" ref={editorStageRef} className="editor-stage" aria-label={t('Live page editor')}>
          <div className="editor-canvas" ref={canvasRef}>
            <div ref={sheetProbeRef} className="magazine-sheet-probe" aria-hidden="true" />
            <div className="magazine-sheet magazine-sheet--editor" style={previewStyle}>
              <MagazinePreview
                issue={project.issue}
                page={selectedPage}
                onTextEditCommit={handleTextEditCommit}
                onRequestUpload={handleRequestUpload}
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
          importUrlBusy={importUrlBusy}
          onImportFromUrl={handleImportFromUrl}
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
      {aiDialogOpen ? (
        <AiArrangeDialog
          maxPhotos={Math.min(50, aiPhotoCapacity)}
          onApply={handleApplyAiPlan}
          onClose={() => setAiDialogOpen(false)}
          onImportUrl={handleImportUrlForAi}
          onUploadPhotos={handleUploadFiles}
          uploadCompleted={uploadState.completedFiles}
          uploadTotal={uploadState.totalFiles}
          availableAssets={libraryAssets}
        />
      ) : null}

      {layoutEditor ? (
        <LayoutEditorDialog
          mode={layoutEditor.mode}
          initialTemplate={layoutEditor.template}
          initialName={layoutEditor.name}
          onClose={() => setLayoutEditor(null)}
          onDelete={layoutEditor.mode === 'edit' ? () => void handleDeleteLayoutEditor() : undefined}
          onSave={handleSaveLayoutEditor}
        />
      ) : null}
    </div>
  );
}
