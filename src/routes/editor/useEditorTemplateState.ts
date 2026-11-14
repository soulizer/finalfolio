import { useEffect, useState } from 'react';
import { fetchAccountPreferences, fetchTemplateGovernance, type UserSession } from '../../editor/api';
import type { AccountPreferences, ExportSettings, ProjectState, UserTemplateKind, UserTemplateRecord } from '../../editor/types';
import type { TemplateGovernance } from '../../product/types';
import { refreshUserTemplateLibrary } from './templateOperations';

type ApplyExportSettings = (settings: ExportSettings) => void;

type UseEditorTemplateStateOptions = {
  authReady: boolean;
  session: UserSession | null;
  project: ProjectState;
  defaultExportSettings: ExportSettings;
  applyAccountExportSettings: ApplyExportSettings;
  applyDefaultExportSettings: ApplyExportSettings;
};

function createExportSettingsFromPreferences(preferences: AccountPreferences): ExportSettings {
  return {
    format: preferences.defaultExportFormat,
    pageSize: preferences.defaultPageSize,
    quality: preferences.defaultExportQuality,
    jpgMode: 'separate',
  };
}

function createDefaultTemplateSaveName(project: ProjectState) {
  return `${project.title.trim() || project.issue.trim() || 'Untitled folio'} Template`;
}

export function useEditorTemplateState({
  authReady,
  session,
  project,
  defaultExportSettings,
  applyAccountExportSettings,
  applyDefaultExportSettings,
}: UseEditorTemplateStateOptions) {
  const [userTemplates, setUserTemplates] = useState<UserTemplateRecord[]>([]);
  const [templateLibraryBusy, setTemplateLibraryBusy] = useState(false);
  const [templateActionBusyId, setTemplateActionBusyId] = useState<string | null>(null);
  const [templateSaveBusy, setTemplateSaveBusy] = useState(false);
  const [templateComposerOpen, setTemplateComposerOpen] = useState(false);
  const [templateSaveName, setTemplateSaveName] = useState('');
  const [templateSaveDescription, setTemplateSaveDescription] = useState('');
  const [templatePreserveCopy, setTemplatePreserveCopy] = useState(true);
  const [templateSaveKind, setTemplateSaveKind] = useState<UserTemplateKind>('project');
  const [accountPreferences, setAccountPreferences] = useState<AccountPreferences | null>(null);
  const [templateGovernance, setTemplateGovernance] = useState<TemplateGovernance | null>(null);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    void refreshUserTemplateLibrary(session ?? null, setUserTemplates, setTemplateLibraryBusy);
  }, [authReady, session]);

  useEffect(() => {
    let cancelled = false;

    void fetchTemplateGovernance()
      .then((payload) => {
        if (!cancelled) {
          setTemplateGovernance(payload.templateGovernance);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTemplateGovernance(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAccountPreferences() {
      if (!authReady || !session) {
        if (!cancelled) {
          setAccountPreferences(null);
          setTemplatePreserveCopy(true);
          applyDefaultExportSettings(defaultExportSettings);
        }
        return;
      }

      try {
        const payload = await fetchAccountPreferences();
        if (cancelled) {
          return;
        }

        setAccountPreferences(payload.preferences);
        setTemplatePreserveCopy(payload.preferences.preserveCopyWhenSavingTemplate);
        applyAccountExportSettings(createExportSettingsFromPreferences(payload.preferences));
      } catch {
        if (!cancelled) {
          setAccountPreferences(null);
          setTemplatePreserveCopy(true);
          applyDefaultExportSettings(defaultExportSettings);
        }
      }
    }

    void loadAccountPreferences();

    return () => {
      cancelled = true;
    };
  }, [authReady, defaultExportSettings, session]);

  function toggleTemplateComposer() {
    if (!templateComposerOpen) {
      setTemplateSaveName((current) => current || createDefaultTemplateSaveName(project));
      setTemplateSaveDescription((current) => current || project.subtitle.trim());
      setTemplatePreserveCopy(accountPreferences?.preserveCopyWhenSavingTemplate ?? true);
    }

    setTemplateComposerOpen((current) => !current);
  }

  return {
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
  };
}
