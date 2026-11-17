import { countLabel, translate } from '../../i18n';
import { recordExportEvent } from '../../editor/api';
import { getAssetSource, getAssetVariant } from '../../editor/assetResources';
import {
  applyPrintLayout,
  buildExportFilenameBase,
  capturePageNodeAsJpeg,
  createCombinedJpeg,
  createJpegZip,
  createPdfFromJpegPages,
  createProjectExportBlob,
  downloadBlob,
  getExportOptimizationOptions,
  waitForFontsReady,
} from '../../editor/export';
import { createExportDataUrl } from '../../editor/imageOptimization';
import { runExportPreflight } from '../../editor/preflight';
import type { Asset, ExportPreflightIssue, ExportSettings, ProjectState } from '../../editor/types';
import {
  createExportDocumentTitle,
  waitForImageElement,
  waitForRenderFrame,
  waitForSettledPrintFrames,
} from './exportRuntime';

type PrintState =
  | { phase: 'idle' }
  | { phase: 'preparing'; totalAssets: number; completedAssets: number; originalBytes: number; optimizedBytes: number };

type SetMessage = (message: string | null) => void;
type SetPrintState = (state: PrintState) => void;
type SetPrintAssetsById = (assets: Record<string, Asset> | null) => void;
type SetExportCaptureActive = (active: boolean) => void;
type SetExportBusy = (busy: boolean) => void;
type SetExportCenterOpen = (open: boolean) => void;
type SetExportPreflightIssues = (issues: ExportPreflightIssue[]) => void;
type SetExportDialogMessage = (text: string, tone?: 'neutral' | 'error') => void;

type PreparePrintAssetsOptions = {
  settings: ExportSettings;
  usedAssets: Asset[];
  assetsById: Record<string, Asset>;
  currentPrintAssetsById: Record<string, Asset> | null;
  usedAssetFingerprint: string;
  printAssetFingerprintRef: { current: string };
  setPrintState: SetPrintState;
  setMessage: SetMessage;
  setPrintAssetsById: SetPrintAssetsById;
  formatBytes: (bytes: number) => string;
};

type RunPrintExportOptions = {
  settings: ExportSettings;
  project: ProjectState;
  projectRecordId?: string | null;
  getPrintStackRoot: () => HTMLElement | null;
  setExportCaptureActive: SetExportCaptureActive;
  setExportDialogMessage: SetExportDialogMessage;
  setPrintState: SetPrintState;
  setMessage: SetMessage;
  preparePrintAssets: (settings: ExportSettings) => Promise<Record<string, Asset>>;
};

type RunPdfExportOptions = {
  settings: ExportSettings;
  project: ProjectState;
  projectRecordId?: string | null;
  getPrintStackRoot: () => HTMLElement | null;
  getPrintPageRefs: () => Record<string, HTMLDivElement | null>;
  setExportCaptureActive: SetExportCaptureActive;
  setExportDialogMessage: SetExportDialogMessage;
  setPrintState: SetPrintState;
  setMessage: SetMessage;
  setExportCenterOpen: SetExportCenterOpen;
  preparePrintAssets: (settings: ExportSettings) => Promise<Record<string, Asset>>;
};

type CaptureJpgPagesOptions = {
  settings: ExportSettings;
  project: ProjectState;
  getPrintStackRoot: () => HTMLElement | null;
  getPrintPageRefs: () => Record<string, HTMLDivElement | null>;
  setExportCaptureActive: SetExportCaptureActive;
  setExportDialogMessage: SetExportDialogMessage;
  setMessage: SetMessage;
  preparePrintAssets: (settings: ExportSettings) => Promise<Record<string, Asset>>;
};

type RunProjectExportFlowOptions = {
  project: ProjectState;
  projectRecordId?: string | null;
  exportSettings: ExportSettings;
  setExportPreflightIssues: SetExportPreflightIssues;
  setExportBusy: SetExportBusy;
  setExportCenterOpen: SetExportCenterOpen;
  setExportDialogMessage: SetExportDialogMessage;
  setMessage: SetMessage;
  runPrintExport: (settings: ExportSettings) => Promise<void>;
  runPdfExport: (settings: ExportSettings) => Promise<void>;
  captureJpgPages: (settings: ExportSettings) => Promise<Array<{ name: string; dataUrl: string }>>;
};

type CreateEditorExportActionsOptions = {
  project: ProjectState;
  projectRecordId?: string | null;
  exportSettings: ExportSettings;
  usedAssets: Asset[];
  assetsById: Record<string, Asset>;
  printAssetsById: Record<string, Asset> | null;
  usedAssetFingerprint: string;
  printAssetFingerprintRef: { current: string };
  getPrintStackRoot: () => HTMLElement | null;
  getPrintPageRefs: () => Record<string, HTMLDivElement | null>;
  setPrintState: SetPrintState;
  setMessage: SetMessage;
  setPrintAssetsById: SetPrintAssetsById;
  setExportCaptureActive: SetExportCaptureActive;
  setExportBusy: SetExportBusy;
  setExportCenterOpen: SetExportCenterOpen;
  setExportPreflightIssues: SetExportPreflightIssues;
  setExportDialogMessage: SetExportDialogMessage;
  formatBytes: (bytes: number) => string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function createEditorExportActions({
  project,
  projectRecordId,
  exportSettings,
  usedAssets,
  assetsById,
  printAssetsById,
  usedAssetFingerprint,
  printAssetFingerprintRef,
  getPrintStackRoot,
  getPrintPageRefs,
  setPrintState,
  setMessage,
  setPrintAssetsById,
  setExportCaptureActive,
  setExportBusy,
  setExportCenterOpen,
  setExportPreflightIssues,
  setExportDialogMessage,
  formatBytes,
}: CreateEditorExportActionsOptions) {
  async function preparePrintAssetsIfNeeded(settings: ExportSettings = exportSettings) {
    return preparePrintAssetsForExport({
      settings,
      usedAssets,
      assetsById,
      currentPrintAssetsById: printAssetsById,
      usedAssetFingerprint,
      printAssetFingerprintRef,
      setPrintState,
      setMessage,
      setPrintAssetsById,
      formatBytes,
    });
  }

  async function handlePrint(settings: ExportSettings = exportSettings) {
    await runPrintExport({
      settings,
      project,
      projectRecordId,
      getPrintStackRoot,
      setExportCaptureActive,
      setExportDialogMessage,
      setPrintState,
      setMessage,
      preparePrintAssets: preparePrintAssetsIfNeeded,
    });
  }

  async function handlePdfExport(settings: ExportSettings = exportSettings) {
    await runPdfExport({
      settings,
      project,
      projectRecordId,
      getPrintStackRoot,
      getPrintPageRefs,
      setExportCaptureActive,
      setExportDialogMessage,
      setPrintState,
      setMessage,
      setExportCenterOpen,
      preparePrintAssets: preparePrintAssetsIfNeeded,
    });
  }

  async function captureProjectJpgPages(settings: ExportSettings) {
    return captureJpgPages({
      settings,
      project,
      getPrintStackRoot,
      getPrintPageRefs,
      setExportCaptureActive,
      setExportDialogMessage,
      setMessage,
      preparePrintAssets: preparePrintAssetsIfNeeded,
    });
  }

  async function handleRunExport() {
    await runProjectExportFlow({
      project,
      projectRecordId,
      exportSettings,
      setExportPreflightIssues,
      setExportBusy,
      setExportCenterOpen,
      setExportDialogMessage,
      setMessage,
      runPrintExport: handlePrint,
      runPdfExport: handlePdfExport,
      captureJpgPages: captureProjectJpgPages,
    });
  }

  return {
    handlePrint,
    handleRunExport,
  };
}

export async function preparePrintAssetsForExport({
  settings,
  usedAssets,
  assetsById,
  currentPrintAssetsById,
  usedAssetFingerprint,
  printAssetFingerprintRef,
  setPrintState,
  setMessage,
  setPrintAssetsById,
  formatBytes,
}: PreparePrintAssetsOptions) {
  if (!usedAssets.length) {
    setPrintAssetsById(null);
    return assetsById;
  }

  const exportFingerprint = `${usedAssetFingerprint}:${settings.format}:${settings.pageSize}:${settings.quality}`;
  if (currentPrintAssetsById && printAssetFingerprintRef.current === exportFingerprint) {
    return currentPrintAssetsById;
  }

  setPrintState({
    phase: 'preparing',
    totalAssets: usedAssets.length,
    completedAssets: 0,
    originalBytes: 0,
    optimizedBytes: 0,
  });
  setMessage(translate('Preparing print-ready pages...'));

  const nextAssetsById: Record<string, Asset> = { ...assetsById };
  let originalBytes = 0;
  let optimizedBytes = 0;
  const optimization = getExportOptimizationOptions(settings);

  for (let index = 0; index < usedAssets.length; index += 1) {
    const asset = usedAssets[index];

    try {
      const originalSource = getAssetSource(asset, 'original');
      const optimized = await createExportDataUrl(originalSource, optimization);
      const originalVariant = getAssetVariant(asset, 'original');
      originalBytes += optimized.originalBytes;
      optimizedBytes += optimized.optimizedBytes;
      nextAssetsById[asset.id] = {
        ...asset,
        src: optimized.dataUrl,
        variants: {
          ...asset.variants,
          original: {
            ...(originalVariant ?? {}),
            src: optimized.dataUrl,
          },
        },
      };
    } catch {
      nextAssetsById[asset.id] = asset;
    }

    setPrintState({
      phase: 'preparing',
      totalAssets: usedAssets.length,
      completedAssets: index + 1,
      originalBytes,
      optimizedBytes,
    });
  }

  setPrintAssetsById(nextAssetsById);
  printAssetFingerprintRef.current = exportFingerprint;
  setPrintState({ phase: 'idle' });
  setMessage(
    optimizedBytes > 0 && optimizedBytes < originalBytes
      ? translate('Print pages prepared from %s down to %s.')
          .replace('%s', formatBytes(originalBytes))
          .replace('%s', formatBytes(optimizedBytes))
      : translate('Print-ready pages prepared.'),
  );
  return nextAssetsById;
}

export async function waitForPrintSurfaceReady(root: HTMLElement | null) {
  await waitForRenderFrame();
  await waitForFontsReady();
  await waitForRenderFrame();

  if (!root) {
    return;
  }

  const images = Array.from(root.querySelectorAll('img'));
  if (images.length) {
    await Promise.all(images.map((image) => waitForImageElement(image)));
  }

  await waitForSettledPrintFrames(root);
  await waitForRenderFrame();
}

export async function runPrintExport({
  settings,
  project,
  projectRecordId,
  getPrintStackRoot,
  setExportCaptureActive,
  setExportDialogMessage,
  setPrintState,
  setMessage,
  preparePrintAssets,
}: RunPrintExportOptions) {
  const exportProjectRecordId = projectRecordId ?? undefined;
  const previousTitle = document.title;
  const nextTitle = createExportDocumentTitle(project.title, project.issue);
  let didRestoreTitle = false;
  const restoreLayout = applyPrintLayout(settings.pageSize);
  setExportCaptureActive(true);
  const restoreTitle = () => {
    if (didRestoreTitle) {
      return;
    }

    didRestoreTitle = true;
    setExportCaptureActive(false);
    document.title = previousTitle;
    restoreLayout();
    window.removeEventListener('afterprint', restoreTitle);
  };

  try {
    setExportDialogMessage(translate('Preparing PDF...'));
    await preparePrintAssets(settings);
    document.title = nextTitle;
    window.addEventListener('afterprint', restoreTitle, { once: true });
    await waitForRenderFrame();
    await waitForPrintSurfaceReady(getPrintStackRoot());
    setExportDialogMessage(translate('Opening print dialog...'));
    await recordExportEvent(exportProjectRecordId, 'requested', undefined, settings);
    window.print();
    setMessage(translate('Print dialog opened. Final PDF save or print happens in the browser dialog.'));
    window.setTimeout(restoreTitle, 2000);
  } catch (error) {
    const errorMessage = getErrorMessage(error, translate('Unable to prepare print pages.'));
    void recordExportEvent(exportProjectRecordId, 'error', errorMessage, settings);
    restoreTitle();
    setPrintState({ phase: 'idle' });
    setExportDialogMessage(errorMessage, 'error');
    setMessage(errorMessage);
  }
}

export async function captureJpgPages({
  settings,
  project,
  getPrintStackRoot,
  getPrintPageRefs,
  setExportCaptureActive,
  setExportDialogMessage,
  setMessage,
  preparePrintAssets,
}: CaptureJpgPagesOptions) {
  const restoreLayout = applyPrintLayout(settings.pageSize);
  setExportCaptureActive(true);

  try {
    setExportDialogMessage(translate('Preparing JPG...'));
    setMessage(translate('Rendering JPG export pages...'));
    await preparePrintAssets(settings);
    await waitForFontsReady();
    await waitForRenderFrame();
    await waitForRenderFrame();
    await waitForPrintSurfaceReady(getPrintStackRoot());
    const printPageRefs = getPrintPageRefs();

    const renderedPages = [];
    for (let index = 0; index < project.pages.length; index += 1) {
      const page = project.pages[index];
      setExportDialogMessage(translate('Rendering %s/%s...').replace('%s', String(index + 1)).replace('%s', String(project.pages.length)));
      const node = printPageRefs[page.id];
      if (!node) {
        throw new Error('One or more export pages are not ready yet.');
      }

      const dataUrl = await capturePageNodeAsJpeg(node, settings);
      renderedPages.push({
        name: `${buildExportFilenameBase(project)}_page-${String(index + 1).padStart(2, '0')}.jpg`,
        dataUrl,
      });
    }

    return renderedPages;
  } finally {
    restoreLayout();
    setExportCaptureActive(false);
  }
}

export async function runPdfExport({
  settings,
  project,
  projectRecordId,
  getPrintStackRoot,
  getPrintPageRefs,
  setExportCaptureActive,
  setExportDialogMessage,
  setPrintState,
  setMessage,
  setExportCenterOpen,
  preparePrintAssets,
}: RunPdfExportOptions) {
  const restoreLayout = applyPrintLayout(settings.pageSize);
  setExportCaptureActive(true);

  try {
    setExportDialogMessage(translate('Preparing PDF...'));
    await preparePrintAssets(settings);
    await waitForRenderFrame();
    await waitForFontsReady();
    await waitForPrintSurfaceReady(getPrintStackRoot());
    const printPageRefs = getPrintPageRefs();

    const blob = await createPdfFromJpegPages(project.pages.length, settings, async (index) => {
      const page = project.pages[index];
      setExportDialogMessage(translate('Rendering page %s/%s...').replace('%s', String(index + 1)).replace('%s', String(project.pages.length)));
      const node = printPageRefs[page.id];
      if (!node) {
        throw new Error('One or more export pages are not ready yet.');
      }

      return await capturePageNodeAsJpeg(node, settings);
    });

    downloadBlob(`${buildExportFilenameBase(project)}.pdf`, blob);
    await recordExportEvent(projectRecordId ?? undefined, 'ok', undefined, settings);
    setExportCenterOpen(false);
  } catch (error) {
    const errorMessage = getErrorMessage(error, 'Unable to build the PDF.');
    void recordExportEvent(projectRecordId ?? undefined, 'error', errorMessage, settings);
    setExportDialogMessage(errorMessage, 'error');
    setMessage(errorMessage);
  } finally {
    setPrintState({ phase: 'idle' });
    setExportCaptureActive(false);
    restoreLayout();
  }
}

export async function runProjectExportFlow({
  project,
  projectRecordId,
  exportSettings,
  setExportPreflightIssues,
  setExportBusy,
  setExportCenterOpen,
  setExportDialogMessage,
  setMessage,
  runPrintExport,
  runPdfExport,
  captureJpgPages,
}: RunProjectExportFlowOptions) {
  const exportProjectRecordId = projectRecordId ?? undefined;
  const nextIssues = runExportPreflight(project, exportSettings);
  setExportPreflightIssues(nextIssues);
  setExportBusy(true);

  try {
    if (exportSettings.format === 'jpg') {
      setExportDialogMessage(translate('Preparing JPG...'));
      const renderedPages = await captureJpgPages(exportSettings);
      if (exportSettings.jpgMode === 'combined') {
        setExportDialogMessage(translate('Building stitched JPG...'));
        const combinedBlob = await createCombinedJpeg(
          renderedPages.map((page) => page.dataUrl),
          exportSettings,
        );
        downloadBlob(`${buildExportFilenameBase(project)}_strip.jpg`, combinedBlob);
      } else {
        setExportDialogMessage(translate('Packaging ZIP...'));
        const zipBlob = await createJpegZip(renderedPages, project);
        downloadBlob(`${buildExportFilenameBase(project)}_pages.zip`, zipBlob);
      }

      await recordExportEvent(exportProjectRecordId, 'ok', undefined, exportSettings);
      setMessage(
        nextIssues.length
          ? translate('JPG export finished with %s.').replace(
              '%s',
              countLabel(nextIssues.length, '1 preflight warning', '%s preflight warnings'),
            )
          : translate(
              exportSettings.jpgMode === 'combined'
                ? 'Stitched JPG export downloaded.'
                : 'JPG page set downloaded.',
            ),
      );
      setExportCenterOpen(false);
      return;
    }

    if (exportSettings.format === 'project') {
      setExportDialogMessage(translate('Preparing project...'));
      const filename = `${buildExportFilenameBase(project)}.finalfolio.json`;
      const blob = createProjectExportBlob(project, exportSettings);
      downloadBlob(filename, blob);
      await recordExportEvent(exportProjectRecordId, 'ok', undefined, exportSettings);
      setMessage(
        nextIssues.length
          ? translate('Project export downloaded with %s.').replace(
              '%s',
              countLabel(nextIssues.length, '1 preflight warning', '%s preflight warnings'),
            )
          : translate('Project export downloaded.'),
      );
      setExportCenterOpen(false);
      return;
    }

    if (exportSettings.format === 'pdf') {
      await runPdfExport(exportSettings);
      setMessage(
        nextIssues.length
          ? translate('PDF downloaded with %s.').replace(
              '%s',
              countLabel(nextIssues.length, '1 preflight warning', '%s preflight warnings'),
            )
          : translate('PDF downloaded.'),
      );
      setExportCenterOpen(false);
      return;
    }

    await runPrintExport(exportSettings);
    setMessage(
      nextIssues.length
        ? translate('Print dialog opened with %s.').replace(
            '%s',
            countLabel(nextIssues.length, '1 preflight warning', '%s preflight warnings'),
          )
        : translate('Print dialog opened. Save as PDF or print from the browser dialog.'),
    );
    setExportCenterOpen(false);
  } catch (error) {
    const errorMessage = getErrorMessage(error, translate('Unable to run export.'));
    setExportDialogMessage(errorMessage, 'error');
    void recordExportEvent(exportProjectRecordId, 'error', errorMessage, exportSettings);
    setMessage(errorMessage);
  } finally {
    setExportBusy(false);
  }
}
