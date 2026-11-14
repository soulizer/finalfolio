import type { NavigateFunction } from 'react-router-dom';
import {
  createProjectFromUserTemplate,
  createUserTemplate,
  fetchOwnedTemplates,
  type UserSession,
} from '../../editor/api';
import { extractUserTemplatePayloadForKind } from '../../editor/demoData';
import type { ProjectRecord, ProjectState, UserTemplateKind, UserTemplateRecord } from '../../editor/types';

type UserTemplatesSetter = (
  value: UserTemplateRecord[] | ((current: UserTemplateRecord[]) => UserTemplateRecord[])
) => void;

type MessageSetter = (message: string | null) => void;

type TemplateBusySetter = (busy: boolean) => void;
type TemplateActionSetter = (templateId: string | null) => void;

type SaveProjectAsTemplateOptions = {
  session: UserSession | null;
  project: ProjectState;
  projectRecord: ProjectRecord | null;
  templateSaveName: string;
  templateSaveDescription: string;
  templateSaveKind: UserTemplateKind;
  templatePreserveCopy: boolean;
  selectedPageIndex: number;
  selectedPageId: string;
  setTemplateSaveBusy: TemplateBusySetter;
  setTemplateComposerOpen: (open: boolean) => void;
  setTemplateSaveName: (name: string) => void;
  setUserTemplates: UserTemplatesSetter;
  setMessage: MessageSetter;
};

type OpenUserTemplateProjectOptions = {
  template: UserTemplateRecord;
  navigate: NavigateFunction;
  setTemplateActionBusyId: TemplateActionSetter;
  setMessage: MessageSetter;
};

type CreateEditorTemplateActionsOptions = SaveProjectAsTemplateOptions & {
  navigate: NavigateFunction;
  setTemplateActionBusyId: TemplateActionSetter;
};

function sortTemplatesByUpdatedAt(templates: UserTemplateRecord[]) {
  return templates.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function createEditorTemplateActions({
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
}: CreateEditorTemplateActionsOptions) {
  async function handleSaveCurrentProjectAsTemplate() {
    await saveProjectAsTemplate({
      session,
      project,
      projectRecord,
      templateSaveName,
      templateSaveDescription,
      templateSaveKind,
      templatePreserveCopy,
      selectedPageIndex,
      selectedPageId,
      setTemplateSaveBusy,
      setTemplateComposerOpen,
      setTemplateSaveName,
      setUserTemplates,
      setMessage,
    });
  }

  async function handleOpenUserTemplate(template: UserTemplateRecord) {
    await openUserTemplateProject({
      template,
      navigate,
      setTemplateActionBusyId,
      setMessage,
    });
  }

  return {
    handleOpenUserTemplate,
    handleSaveCurrentProjectAsTemplate,
  };
}

export async function refreshUserTemplateLibrary(
  currentSession: UserSession | null,
  setUserTemplates: UserTemplatesSetter,
  setTemplateLibraryBusy: TemplateBusySetter,
) {
  if (!currentSession) {
    setUserTemplates([]);
    setTemplateLibraryBusy(false);
    return;
  }

  setTemplateLibraryBusy(true);
  try {
    const payload = await fetchOwnedTemplates();
    setUserTemplates(payload.templates);
  } catch {
    setUserTemplates([]);
  } finally {
    setTemplateLibraryBusy(false);
  }
}

export async function saveProjectAsTemplate({
  session,
  project,
  projectRecord,
  templateSaveName,
  templateSaveDescription,
  templateSaveKind,
  templatePreserveCopy,
  selectedPageIndex,
  selectedPageId,
  setTemplateSaveBusy,
  setTemplateComposerOpen,
  setTemplateSaveName,
  setUserTemplates,
  setMessage,
}: SaveProjectAsTemplateOptions) {
  if (!session) {
    setMessage('Sign in to save reusable templates to your account.');
    return;
  }

  const nextName = templateSaveName.trim() || project.title.trim() || project.issue.trim() || 'Untitled template';
  setTemplateSaveBusy(true);
  setMessage(`Saving this ${templateSaveKind === 'page' ? 'page' : 'project'} as a reusable template...`);

  try {
    const payload = await createUserTemplate({
      name: nextName,
      description: templateSaveDescription.trim(),
      kind: templateSaveKind,
      includesCopy: templatePreserveCopy,
      sourceProjectId: projectRecord?.id ?? null,
      previewPageIndex: templateSaveKind === 'page' ? Math.max(0, selectedPageIndex) : 0,
      templatePayload: extractUserTemplatePayloadForKind(project, templateSaveKind, {
        preserveCopy: templatePreserveCopy,
        pageId: selectedPageId,
      }),
    });
    setUserTemplates((current) => sortTemplatesByUpdatedAt([payload.template, ...current.filter((template) => template.id !== payload.template.id)]));
    setTemplateComposerOpen(false);
    setTemplateSaveName(nextName);
    setMessage('Template saved to My templates.');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Unable to save this template.');
  } finally {
    setTemplateSaveBusy(false);
  }
}

export async function openUserTemplateProject({
  template,
  navigate,
  setTemplateActionBusyId,
  setMessage,
}: OpenUserTemplateProjectOptions) {
  setTemplateActionBusyId(template.id);
  setMessage(`Opening ${template.name} as a new project...`);

  try {
    const record = await createProjectFromUserTemplate(template.id);
    navigate(record.sharePath);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Unable to open this template as a new project.');
  } finally {
    setTemplateActionBusyId(null);
  }
}
