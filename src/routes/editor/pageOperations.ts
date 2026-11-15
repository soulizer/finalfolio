import {
  cloneCustomTemplateDefinition,
  createPageDraft,
  createPagesFromTemplatePack,
  remapPageToTemplate,
  templatePacks,
  type TemplatePackId,
} from '../../editor/demoData';
import { PAGE_TITLE_LIMIT } from '../../editor/limits';
import type { CustomTemplateDefinition, PageData, PageThemeId, ProjectState, TemplateId } from '../../editor/types';

type AddPageToProjectOptions = {
  project: ProjectState;
  selectedPageIndex: number;
  template: TemplateId;
  selectedPageTheme?: PageThemeId;
  customTemplateDraft: CustomTemplateDefinition;
  createPageId: () => string;
};

type DuplicateProjectPageOptions = {
  project: ProjectState;
  selectedPage: PageData;
  selectedPageIndex: number;
  createPageId: () => string;
};

type MoveProjectPageOptions = {
  project: ProjectState;
  selectedPageIndex: number;
  offset: -1 | 1;
};

type RemoveProjectPageOptions = {
  project: ProjectState;
  selectedPage: PageData;
  selectedPageIndex: number;
};

type ApplyTemplatePackOptions = {
  packId: TemplatePackId;
  mode: 'replace' | 'insert';
  project: ProjectState;
  selectedPageIndex: number;
  createPageId: () => string;
};

type ApplyTemplateChoiceOptions = {
  selectedPage: PageData;
  templateChoice: TemplateId;
  customTemplateDraft: CustomTemplateDefinition;
};

function clonePage(page: PageData): PageData {
  return {
    ...page,
    customTemplate: page.customTemplate ? cloneCustomTemplateDefinition(page.customTemplate) : null,
    slots: { ...page.slots },
    crops: Object.fromEntries(Object.entries(page.crops).map(([slot, crop]) => [slot, { ...crop }])),
  };
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

export function addPageToProject({
  project,
  selectedPageIndex,
  template,
  selectedPageTheme,
  customTemplateDraft,
  createPageId,
}: AddPageToProjectOptions) {
  const nextPage = createPageDraft(template, createPageId(), {
    theme: selectedPageTheme,
    ...(template === 'custom' ? { customTemplate: customTemplateDraft } : {}),
  });
  const insertAt = selectedPageIndex >= 0 ? selectedPageIndex + 1 : project.pages.length;

  return {
    nextPage,
    nextProject: {
      ...project,
      pages: [...project.pages.slice(0, insertAt), nextPage, ...project.pages.slice(insertAt)],
    },
  };
}

export function duplicateProjectPage({
  project,
  selectedPage,
  selectedPageIndex,
  createPageId,
}: DuplicateProjectPageOptions) {
  const duplicate: PageData = {
    ...clonePage(selectedPage),
    id: createPageId(),
    title: `${selectedPage.title} Copy`.slice(0, PAGE_TITLE_LIMIT),
  };
  const insertAt = selectedPageIndex >= 0 ? selectedPageIndex + 1 : project.pages.length;
  const sourcePageLabel = selectedPage.title.trim() || `Page ${selectedPageIndex + 1}`;
  const duplicatedPageLabel = duplicate.title.trim() || `Page ${insertAt + 1}`;

  return {
    message: `Duplicated the page. Now editing "${duplicatedPageLabel}" at position ${insertAt + 1} of ${project.pages.length + 1}.`,
    nextPage: duplicate,
    nextProject: {
      ...project,
      pages: [...project.pages.slice(0, insertAt), duplicate, ...project.pages.slice(insertAt)],
    },
  };
}

export function moveProjectPage({ project, selectedPageIndex, offset }: MoveProjectPageOptions) {
  if (selectedPageIndex < 0) {
    return null;
  }

  const nextIndex = selectedPageIndex + offset;
  if (nextIndex < 0 || nextIndex >= project.pages.length) {
    return null;
  }

  return {
    ...project,
    pages: moveItem(project.pages, selectedPageIndex, nextIndex),
  };
}

export function removeProjectPage({ project, selectedPage, selectedPageIndex }: RemoveProjectPageOptions) {
  const nextPage = project.pages[selectedPageIndex + 1] ?? project.pages[selectedPageIndex - 1];
  if (!nextPage) {
    return null;
  }

  return {
    nextPage,
    nextProject: {
      ...project,
      pages: project.pages.filter((page) => page.id !== selectedPage.id),
    },
  };
}

export function applyTemplatePackToProject({
  packId,
  mode,
  project,
  selectedPageIndex,
  createPageId,
}: ApplyTemplatePackOptions) {
  const pack = templatePacks[packId];
  const nextPages = createPagesFromTemplatePack(packId, {
    idFactory: (page, index) => `${createPageId()}-${page.template}-${index + 1}`,
  });
  const nextPage = nextPages[0];
  if (!nextPage) {
    throw new Error('Template pack did not return any pages.');
  }

  const nextProject =
    mode === 'replace'
      ? {
          ...project,
          pages: nextPages,
        }
      : {
          ...project,
          pages: [
            ...project.pages.slice(0, selectedPageIndex >= 0 ? selectedPageIndex + 1 : project.pages.length),
            ...nextPages,
            ...project.pages.slice(selectedPageIndex >= 0 ? selectedPageIndex + 1 : project.pages.length),
          ],
        };

  return {
    message:
      mode === 'replace'
        ? `Replaced every page with the ${pack.label} template. Uploaded photos stayed in the library.`
        : `Inserted the ${pack.label} template after the current page. Every inserted page stays editable.`,
    nextPage,
    nextProject,
  };
}

export function applyTemplateChoiceToPage({ selectedPage, templateChoice, customTemplateDraft }: ApplyTemplateChoiceOptions) {
  const nextPage = remapPageToTemplate(selectedPage, templateChoice, templateChoice === 'custom' ? customTemplateDraft : null);

  return {
    message:
      templateChoice === 'custom'
        ? 'Applied the custom layout. Existing photos and copy were kept.'
        : 'Applied the new layout. Existing photos and copy were kept.',
    nextPage,
  };
}
