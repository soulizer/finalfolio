import { useEffect, useState } from 'react';
import {
  cloneCustomTemplateDefinition,
  createCustomTemplateDefinition,
  createDefaultCrop,
  DEFAULT_FILL_SCALE,
} from '../../editor/demoData';
import type {
  CropSettings,
  CustomTemplateDefinition,
  PageData,
  PageThemeId,
  ProjectRecord,
  ProjectState,
  TemplateId,
} from '../../editor/types';

type SaveState = 'draft' | 'dirty' | 'saving' | 'saved' | 'error';
type SetProjectState = (value: ProjectState | ((current: ProjectState) => ProjectState)) => void;
type SetSaveState = (state: SaveState) => void;
type SetMessage = (message: string | null) => void;

type UseEditorProjectStateOptions = {
  initialProject: ProjectState;
  getInitialSlot: (page?: PageData) => string | null;
  projectRecord: ProjectRecord | null;
  saveState: SaveState;
  setSaveState: SetSaveState;
  setMessage: SetMessage;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeCrop(crop: CropSettings): CropSettings {
  const minimumScale = crop.fit === 'contain' ? 1 : DEFAULT_FILL_SCALE;
  return {
    ...crop,
    x: clamp(crop.x, 0, 100),
    y: clamp(crop.y, 0, 100),
    scale: clamp(crop.scale, minimumScale, 2.2),
    fit: crop.fit === 'contain' ? 'contain' : 'cover',
  };
}

export function useEditorProjectState({
  initialProject,
  getInitialSlot,
  projectRecord,
  saveState,
  setSaveState,
  setMessage,
}: UseEditorProjectStateOptions) {
  const [project, setProject] = useState<ProjectState>(() => initialProject);
  const [selectedPageId, setSelectedPageId] = useState(initialProject.pages[0]?.id ?? '');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(getInitialSlot(initialProject.pages[0]));
  const [templateChoice, setTemplateChoice] = useState<TemplateId>(initialProject.pages[0]?.template ?? 'cover');
  const [themeChoice, setThemeChoice] = useState<PageThemeId>(initialProject.pages[0]?.theme ?? 'warm-beige');
  const [customTemplateDraft, setCustomTemplateDraft] = useState<CustomTemplateDefinition>(() =>
    initialProject.pages[0]?.customTemplate
      ? cloneCustomTemplateDefinition(initialProject.pages[0].customTemplate)
      : createCustomTemplateDefinition(),
  );

  useEffect(() => {
    if (!project.pages.some((page) => page.id === selectedPageId)) {
      setSelectedPageId(project.pages[0]?.id ?? '');
    }
  }, [project.pages, selectedPageId]);

  const selectedPageIndex = project.pages.findIndex((page) => page.id === selectedPageId);
  const selectedPage = project.pages[selectedPageIndex] ?? project.pages[0];
  const currentCrop = selectedSlot && selectedPage ? selectedPage.crops[selectedSlot] : undefined;

  useEffect(() => {
    if (!selectedPage) {
      return;
    }

    const firstSlot = getInitialSlot(selectedPage);
    if (!selectedSlot || !(selectedSlot in selectedPage.slots)) {
      setSelectedSlot(firstSlot);
    }
  }, [getInitialSlot, selectedPage, selectedSlot]);

  useEffect(() => {
    if (!selectedPage) {
      return;
    }

    setTemplateChoice(selectedPage.template);
    setThemeChoice(selectedPage.theme);
    if (selectedPage.customTemplate) {
      setCustomTemplateDraft(cloneCustomTemplateDefinition(selectedPage.customTemplate));
    }
  }, [selectedPage?.id, selectedPage?.template, selectedPage?.theme, selectedPage?.customTemplate]);

  function updateProject(updater: (current: ProjectState) => ProjectState) {
    setMessage(null);
    setProject((current) => updater(current));
    if (saveState === 'error') {
      setSaveState(projectRecord ? 'dirty' : 'draft');
    }
  }

  function updateSelectedPage(updater: (page: PageData) => PageData) {
    if (!selectedPage) {
      return;
    }

    updateProject((current) => ({
      ...current,
      pages: current.pages.map((page) => (page.id === selectedPage.id ? updater(page) : page)),
    }));
  }

  function updateSelectedCrop(updater: (crop: CropSettings) => CropSettings) {
    if (!selectedSlot || !selectedPage) {
      return;
    }

    updateSelectedPage((page) => ({
      ...page,
      crops: {
        ...page.crops,
        [selectedSlot]: normalizeCrop(updater(page.crops[selectedSlot] ?? createDefaultCrop())),
      },
    }));
  }

  function updateSlotCrop(slot: string, updater: (crop: CropSettings) => CropSettings) {
    if (!selectedPage || !(slot in selectedPage.slots)) {
      return;
    }

    updateSelectedPage((page) => ({
      ...page,
      crops: {
        ...page.crops,
        [slot]: normalizeCrop(updater(page.crops[slot] ?? createDefaultCrop())),
      },
    }));
  }

  function selectPage(pageId: string) {
    const nextPage = project.pages.find((page) => page.id === pageId);
    setSelectedPageId(pageId);
    setSelectedSlot(getInitialSlot(nextPage));
    if (nextPage) {
      setTemplateChoice(nextPage.template);
    }
  }

  return {
    currentCrop,
    customTemplateDraft,
    project,
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
    updateProject,
    updateSelectedCrop,
    updateSelectedPage,
    updateSlotCrop,
  };
}
