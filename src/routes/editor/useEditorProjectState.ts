import { useCallback, useEffect, useRef, useState } from 'react';
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

const HISTORY_LIMIT = 60;
const HISTORY_COALESCE_MS = 700;

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
  const [historyBounds, setHistoryBounds] = useState({ past: 0, future: 0 });

  const projectRef = useRef(project);
  projectRef.current = project;
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;
  const projectRecordRef = useRef(projectRecord);
  projectRecordRef.current = projectRecord;
  const selectedPageIdRef = useRef(selectedPageId);
  selectedPageIdRef.current = selectedPageId;
  const selectedSlotRef = useRef(selectedSlot);
  selectedSlotRef.current = selectedSlot;

  const pastRef = useRef<ProjectState[]>([]);
  const futureRef = useRef<ProjectState[]>([]);
  const lastHistoryAtRef = useRef(0);

  const syncHistoryBounds = useCallback(() => {
    setHistoryBounds({ past: pastRef.current.length, future: futureRef.current.length });
  }, []);

  const recordHistory = useCallback((snapshot: ProjectState) => {
    const now = Date.now();
    if (now - lastHistoryAtRef.current < HISTORY_COALESCE_MS && pastRef.current.length > 0) {
      lastHistoryAtRef.current = now;
      return;
    }

    lastHistoryAtRef.current = now;
    pastRef.current.push(snapshot);
    if (pastRef.current.length > HISTORY_LIMIT) {
      pastRef.current.splice(0, pastRef.current.length - HISTORY_LIMIT);
    }
    futureRef.current = [];
    syncHistoryBounds();
  }, [syncHistoryBounds]);

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

  const updateProject = useCallback(
    (updater: (current: ProjectState) => ProjectState, options: { recordHistory?: boolean } = {}) => {
      const current = projectRef.current;
      const next = updater(current);
      if (next === current) {
        return;
      }

      if (options.recordHistory !== false) {
        recordHistory(current);
      }

      setMessage(null);
      setProject(next);
      if (saveStateRef.current === 'error') {
        setSaveState(projectRecordRef.current ? 'dirty' : 'draft');
      }
    },
    [recordHistory, setMessage, setSaveState],
  );

  const updateSelectedPage = useCallback(
    (updater: (page: PageData) => PageData) => {
      const pageId = selectedPageIdRef.current;
      if (!pageId) {
        return;
      }

      updateProject((current) => ({
        ...current,
        pages: current.pages.map((page) => (page.id === pageId ? updater(page) : page)),
      }));
    },
    [updateProject],
  );

  const updateSelectedCrop = useCallback(
    (updater: (crop: CropSettings) => CropSettings) => {
      const slot = selectedSlotRef.current;
      if (!slot) {
        return;
      }

      updateSelectedPage((page) => {
        if (!(slot in page.slots)) {
          return page;
        }

        return {
          ...page,
          crops: {
            ...page.crops,
            [slot]: normalizeCrop(updater(page.crops[slot] ?? createDefaultCrop())),
          },
        };
      });
    },
    [updateSelectedPage],
  );

  const updateSlotCrop = useCallback(
    (slot: string, updater: (crop: CropSettings) => CropSettings) => {
      updateSelectedPage((page) => {
        if (!(slot in page.slots)) {
          return page;
        }

        return {
          ...page,
          crops: {
            ...page.crops,
            [slot]: normalizeCrop(updater(page.crops[slot] ?? createDefaultCrop())),
          },
        };
      });
    },
    [updateSelectedPage],
  );

  const selectPage = useCallback(
    (pageId: string) => {
      const nextPage = projectRef.current.pages.find((page) => page.id === pageId);
      setSelectedPageId(pageId);
      setSelectedSlot(getInitialSlot(nextPage));
      if (nextPage) {
        setTemplateChoice(nextPage.template);
      }
    },
    [getInitialSlot],
  );

  const undo = useCallback(() => {
    const previous = pastRef.current.pop();
    if (!previous) {
      return;
    }

    futureRef.current.push(projectRef.current);
    lastHistoryAtRef.current = 0;
    setProject(previous);
    setMessage(null);
    setSaveState(projectRecordRef.current ? 'dirty' : 'draft');
    syncHistoryBounds();
  }, [setMessage, setSaveState, syncHistoryBounds]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) {
      return;
    }

    pastRef.current.push(projectRef.current);
    lastHistoryAtRef.current = 0;
    setProject(next);
    setMessage(null);
    setSaveState(projectRecordRef.current ? 'dirty' : 'draft');
    syncHistoryBounds();
  }, [setMessage, setSaveState, syncHistoryBounds]);

  const resetHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    lastHistoryAtRef.current = 0;
    syncHistoryBounds();
  }, [syncHistoryBounds]);

  return {
    canRedo: historyBounds.future > 0,
    canUndo: historyBounds.past > 0,
    currentCrop,
    getProject: () => projectRef.current,
    customTemplateDraft,
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
  };
}
