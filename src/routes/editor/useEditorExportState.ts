import { useEffect, useRef, useState } from 'react';
import { measureExportInnerMarginMm } from '../../editor/export';
import { runExportPreflight } from '../../editor/preflight';
import { readStoredExportSettings, writeStoredExportSettings } from '../../editor/storage';
import type { ExportPreflightIssue, ExportSettings, ProjectState } from '../../editor/types';

export type ExportDialogState = {
  tone: 'neutral' | 'error';
  text: string;
};

type UseEditorExportStateOptions = {
  defaultExportSettings: ExportSettings;
  printPreparing: boolean;
  project: ProjectState;
};

export function useEditorExportState({ defaultExportSettings, printPreparing, project }: UseEditorExportStateOptions) {
  const storedExportSettingsRef = useRef<ExportSettings | null>(readStoredExportSettings());
  const hadStoredExportSettingsRef = useRef(Boolean(storedExportSettingsRef.current));
  const exportSettingsTouchedRef = useRef(false);

  const [exportCenterOpen, setExportCenterOpen] = useState(false);
  const [exportSettings, setExportSettingsState] = useState<ExportSettings>(() => storedExportSettingsRef.current ?? defaultExportSettings);
  const [exportDialogState, setExportDialogState] = useState<ExportDialogState | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportPreflightIssues, setExportPreflightIssues] = useState<ExportPreflightIssue[]>([]);
  const [exportCaptureActive, setExportCaptureActive] = useState(false);

  useEffect(() => {
    if (!exportCenterOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExportCenterOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exportCenterOpen]);

  useEffect(() => {
    if (!exportCenterOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [exportCenterOpen]);

  useEffect(() => {
    if (!exportCenterOpen && !exportBusy) {
      setExportDialogState(null);
    }
  }, [exportBusy, exportCenterOpen]);

  useEffect(() => {
    storedExportSettingsRef.current = exportSettings;
    writeStoredExportSettings(exportSettings);
  }, [exportSettings]);

  useEffect(() => {
    setExportPreflightIssues(
      runExportPreflight(project, exportSettings, { innerMarginMm: measureExportInnerMarginMm() }),
    );
  }, [exportSettings, project]);

  function updateExportSettings(updater: ExportSettings | ((current: ExportSettings) => ExportSettings)) {
    exportSettingsTouchedRef.current = true;
    if (!exportBusy && !printPreparing) {
      setExportDialogState(null);
    }
    setExportSettingsState(updater);
  }

  function setExportDialogMessage(text: string, tone: ExportDialogState['tone'] = 'neutral') {
    setExportDialogState({ tone, text });
  }

  function applyAccountExportSettings(nextSettings: ExportSettings) {
    if (!hadStoredExportSettingsRef.current && !exportSettingsTouchedRef.current) {
      setExportSettingsState(nextSettings);
    }
  }

  function applyDefaultExportSettings(nextSettings: ExportSettings) {
    if (!hadStoredExportSettingsRef.current) {
      setExportSettingsState(nextSettings);
    }
  }

  return {
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
  };
}
