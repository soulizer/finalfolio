import {
  cloneCustomTemplateDefinition,
  createCustomTemplateDefinition,
  normalizeProjectState,
} from '../../editor/demoData';
import { CustomTemplateDefinition, PageData, PageThemeId, ProjectRecord, ProjectState, TemplateId } from '../../editor/types';

export const DRAFT_ONLY_MESSAGE = 'Draft only on this device. Save this folio to reopen it from any device later.';
export const STABLE_EDITOR_URL_MESSAGE = 'Saved. Reopen this folio from the same link whenever you need to edit or export again.';
export const CREATED_EDITOR_URL_MESSAGE = 'Folio saved. This link is now the permanent address for the folio.';

export type EditorSelectionState = {
  selectedPageId: string;
  selectedSlot: string | null;
  templateChoice: TemplateId;
  themeChoice: PageThemeId;
  customTemplateDraft: CustomTemplateDefinition;
};

export type NormalizedProjectRecordState = {
  project: ProjectState;
  projectRecord: ProjectRecord;
  snapshot: string;
};

export type EditorProjectHydration = EditorSelectionState & {
  project: ProjectState;
  projectRecord: ProjectRecord | null;
  snapshot: string;
};

type DraftLoadSummary = {
  restoredAssetCount: number;
  missingAssetCount: number;
  clearedPlacementCount: number;
};

function buildEditorSelectionState(project: ProjectState, getInitialSlot: (page?: PageData) => string | null): EditorSelectionState {
  const firstPage = project.pages[0];

  return {
    selectedPageId: firstPage?.id ?? '',
    selectedSlot: getInitialSlot(firstPage),
    templateChoice: firstPage?.template ?? 'cover',
    themeChoice: firstPage?.theme ?? 'warm-beige',
    customTemplateDraft: firstPage?.customTemplate
      ? cloneCustomTemplateDefinition(firstPage.customTemplate)
      : createCustomTemplateDefinition(),
  };
}

export function normalizeEditorProjectRecord(record: ProjectRecord): NormalizedProjectRecordState {
  const project = normalizeProjectState(record.project);

  return {
    project,
    projectRecord: {
      ...record,
      project,
    },
    snapshot: JSON.stringify(project),
  };
}

export function buildDraftProjectHydration(project: ProjectState, getInitialSlot: (page?: PageData) => string | null): EditorProjectHydration {
  const normalizedProject = normalizeProjectState(project);

  return {
    project: normalizedProject,
    projectRecord: null,
    snapshot: '',
    ...buildEditorSelectionState(normalizedProject, getInitialSlot),
  };
}

export function buildServerProjectHydration(record: ProjectRecord, getInitialSlot: (page?: PageData) => string | null): EditorProjectHydration {
  const normalizedRecord = normalizeEditorProjectRecord(record);

  return {
    ...normalizedRecord,
    ...buildEditorSelectionState(normalizedRecord.project, getInitialSlot),
  };
}

export function createDraftLoadMessage(summary: DraftLoadSummary) {
  if (summary.missingAssetCount > 0) {
    return `Restored this local draft, but ${summary.missingAssetCount} cached photo${
      summary.missingAssetCount === 1 ? '' : 's'
    } could not be recovered and ${summary.clearedPlacementCount > 0 ? 'were removed from the affected frames.' : 'were removed.'}`;
  }

  if (summary.restoredAssetCount > 0) {
    return `Recovered ${summary.restoredAssetCount} local photo${
      summary.restoredAssetCount === 1 ? '' : 's'
    } from this device. Sign in to attach them to your account before creating a saved link.`;
  }

  return DRAFT_ONLY_MESSAGE;
}
