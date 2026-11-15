import {
  cloneCustomTemplateDefinition,
  type TemplatePackId,
} from '../../editor/demoData';
import { getConfirmationMessage } from '../../editor/confirmations';
import { PROJECT_PAGE_LIMIT } from '../../editor/limits';
import { confirmAction } from '../../ui/confirm';
import type {
  CustomTemplateDefinition,
  PageData,
  ProjectState,
  TemplateId,
} from '../../editor/types';
import {
  addPageToProject,
  applyTemplateChoiceToPage,
  applyTemplatePackToProject,
  duplicateProjectPage,
  moveProjectPage,
  removeProjectPage,
} from './pageOperations';

type UpdateProject = (updater: (current: ProjectState) => ProjectState) => void;
type UpdateSelectedPage = (updater: (page: PageData) => PageData) => void;
type SetSelectedPageId = (pageId: string) => void;
type SetSelectedSlot = (slot: string | null) => void;
type SetTemplateChoice = (value: TemplateId) => void;
type SetMessage = (message: string | null) => void;
type SetCustomTemplateDraft = (
  value: CustomTemplateDefinition | ((current: CustomTemplateDefinition) => CustomTemplateDefinition)
) => void;
type GetInitialSlot = (page?: PageData) => string | null;

type CreateEditorPageActionsOptions = {
  project: ProjectState;
  selectedPage: PageData | undefined;
  selectedPageIndex: number;
  templateChoice: TemplateId;
  customTemplateDraft: CustomTemplateDefinition;
  updateProject: UpdateProject;
  updateSelectedPage: UpdateSelectedPage;
  setSelectedPageId: SetSelectedPageId;
  setSelectedSlot: SetSelectedSlot;
  setTemplateChoice: SetTemplateChoice;
  setCustomTemplateDraft: SetCustomTemplateDraft;
  setMessage: SetMessage;
  createPageId: () => string;
  getInitialSlot: GetInitialSlot;
};

export function createEditorPageActions({
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
}: CreateEditorPageActionsOptions) {
  async function applyTemplatePack(packId: TemplatePackId, mode: 'replace' | 'insert') {
    if (mode === 'replace') {
      const confirmed = await confirmAction({
        title: 'Replace every page in this folio?',
        body: 'Page titles, captions, body copy, and frame assignments are replaced by the starter pack. Photos stay in the media library.',
        confirmLabel: 'Replace pages',
        tone: 'danger',
      });
      if (!confirmed) {
        return;
      }
    }

    const nextState = applyTemplatePackToProject({
      packId,
      mode,
      project,
      selectedPageIndex,
      createPageId,
    });

    updateProject(() => nextState.nextProject);
    setSelectedPageId(nextState.nextPage.id);
    setSelectedSlot(getInitialSlot(nextState.nextPage));
    setTemplateChoice(nextState.nextPage.template);
    if (nextState.nextPage.customTemplate) {
      setCustomTemplateDraft(cloneCustomTemplateDefinition(nextState.nextPage.customTemplate));
    }
    setMessage(nextState.message);
  }

  function addPage(template = templateChoice) {
    if (!selectedPage) {
      return;
    }

    if (project.pages.length >= PROJECT_PAGE_LIMIT) {
      setMessage(`This folio already has the maximum of ${PROJECT_PAGE_LIMIT} pages.`);
      return;
    }

    const nextState = addPageToProject({
      project,
      selectedPageIndex,
      template,
      selectedPageTheme: selectedPage.theme,
      customTemplateDraft,
      createPageId,
    });

    updateProject(() => nextState.nextProject);
    setSelectedPageId(nextState.nextPage.id);
    setSelectedSlot(getInitialSlot(nextState.nextPage));
    setTemplateChoice(nextState.nextPage.template);
  }

  function duplicatePage() {
    if (!selectedPage) {
      return;
    }

    const nextState = duplicateProjectPage({
      project,
      selectedPage,
      selectedPageIndex,
      createPageId,
    });

    updateProject(() => nextState.nextProject);
    setSelectedPageId(nextState.nextPage.id);
    setSelectedSlot(getInitialSlot(nextState.nextPage));
    setMessage(nextState.message);
  }

  function moveSelectedPage(offset: -1 | 1) {
    const nextProject = moveProjectPage({
      project,
      selectedPageIndex,
      offset,
    });
    if (!nextProject) {
      return;
    }

    updateProject(() => nextProject);
  }

  async function removeSelectedPage() {
    if (!selectedPage || project.pages.length === 1 || selectedPageIndex < 0) {
      return;
    }

    const pageTitle = selectedPage.title.trim() || 'Page ' + (selectedPageIndex + 1);
    const confirmed = await confirmAction({
      title: 'Delete this page?',
      body: getConfirmationMessage('deletePage', { pageTitle }),
      confirmLabel: 'Delete page',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    const nextState = removeProjectPage({
      project,
      selectedPage,
      selectedPageIndex,
    });
    if (!nextState) {
      return;
    }

    updateProject(() => nextState.nextProject);
    setSelectedPageId(nextState.nextPage.id);
    setSelectedSlot(getInitialSlot(nextState.nextPage));
    setTemplateChoice(nextState.nextPage.template);
  }

  function applyTemplateChoice(nextTemplate: TemplateId = templateChoice) {
    if (!selectedPage || (nextTemplate === selectedPage.template && nextTemplate !== 'custom')) {
      return;
    }

    const nextState = applyTemplateChoiceToPage({
      selectedPage,
      templateChoice: nextTemplate,
      customTemplateDraft,
    });
    updateSelectedPage(() => nextState.nextPage);
    setSelectedSlot(getInitialSlot(nextState.nextPage));
    if (nextState.nextPage.customTemplate) {
      setCustomTemplateDraft(cloneCustomTemplateDefinition(nextState.nextPage.customTemplate));
    }
    setMessage(nextState.message);
  }

  return {
    addPage,
    applyTemplateChoice,
    applyTemplatePack,
    duplicatePage,
    moveSelectedPage,
    removeSelectedPage,
  };
}
