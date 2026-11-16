import { translate } from '../../i18n';
import {
  cloneCustomTemplateDefinition,
  customLayoutPresets,
  pageThemeMeta,
} from '../../editor/demoData';
import {
  CUSTOM_TEMPLATE_FRAME_LIMIT,
  PROJECT_FRAME_RADIUS_MAX,
  PROJECT_FRAME_RADIUS_MIN,
} from '../../editor/limits';
import type {
  CustomTemplateDefinition,
  CustomTemplateFrame,
  LayoutArea,
  PageData,
  PageThemeId,
  ProjectState,
  TemplateId,
} from '../../editor/types';

type UpdateProject = (updater: (current: ProjectState) => ProjectState) => void;
type UpdateSelectedPage = (updater: (page: PageData) => PageData) => void;
type SetCustomTemplateDraft = (
  value: CustomTemplateDefinition | ((current: CustomTemplateDefinition) => CustomTemplateDefinition)
) => void;
type SetTemplateChoice = (value: TemplateId) => void;
type SetMessage = (message: string | null) => void;

type CreateEditorDesignActionsOptions = {
  updateProject: UpdateProject;
  updateSelectedPage: UpdateSelectedPage;
  setCustomTemplateDraft: SetCustomTemplateDraft;
  setTemplateChoice: SetTemplateChoice;
  setMessage: SetMessage;
};

function clampLayoutArea(area: LayoutArea): LayoutArea {
  const x = Math.min(100, Math.max(0, area.x));
  const y = Math.min(100, Math.max(0, area.y));
  const width = Math.min(100 - x, Math.max(12, area.width));
  const height = Math.min(100 - y, Math.max(12, area.height));

  return {
    x,
    y,
    width,
    height,
  };
}

export function createEditorDesignActions({
  updateProject,
  updateSelectedPage,
  setCustomTemplateDraft,
  setTemplateChoice,
  setMessage,
}: CreateEditorDesignActionsOptions) {
  function updateCustomTemplateDraft(updater: (current: CustomTemplateDefinition) => CustomTemplateDefinition) {
    setCustomTemplateDraft((current) => cloneCustomTemplateDefinition(updater(cloneCustomTemplateDefinition(current))));
  }

  function updateCustomArea(area: LayoutArea, field: keyof LayoutArea, value: number): LayoutArea {
    return clampLayoutArea({
      ...area,
      [field]: value,
    });
  }

  function updateCustomFrameArea(frame: CustomTemplateFrame, field: keyof LayoutArea, value: number): CustomTemplateFrame {
    return {
      ...frame,
      ...updateCustomArea(frame, field, value),
    };
  }

  function loadCustomLayoutPreset(presetId: string) {
    const preset = customLayoutPresets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }

    setTemplateChoice('custom');
    setCustomTemplateDraft(cloneCustomTemplateDefinition(preset.template));
    setMessage(
      translate('Loaded the %s scaffold. Apply it when the structure feels right.').replace('%s', translate(preset.label)),
    );
  }

  function addCustomFrame() {
    updateCustomTemplateDraft((current) => {
      if (current.frames.length >= CUSTOM_TEMPLATE_FRAME_LIMIT) {
        return current;
      }

      const nextIndex = current.frames.length + 1;
      const frame = {
        slot: `frame${nextIndex}`,
        label: `Frame ${nextIndex}`,
        x: 36 + ((nextIndex - 1) % 2) * 32,
        y: Math.min(70, 6 + Math.floor((nextIndex - 1) / 2) * 30),
        width: 30,
        height: 26,
      };

      return {
        ...current,
        frames: [...current.frames, frame],
      };
    });
  }

  function removeCustomFrame(slot: string) {
    updateCustomTemplateDraft((current) => {
      if (current.frames.length === 1) {
        return current;
      }

      return {
        ...current,
        frames: current.frames.filter((frame) => frame.slot !== slot),
      };
    });
  }

  function applyTheme(themeId: PageThemeId, scope: 'page' | 'all') {
    const themeLabel = pageThemeMeta[themeId].label;

    if (scope === 'all') {
      updateProject((current) => ({
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          theme: themeId,
        })),
      }));
      setMessage(translate('Applied %s across the full folio.').replace('%s', translate(themeLabel)));
      return;
    }

    updateSelectedPage((page) => ({
      ...page,
      theme: themeId,
    }));
    setMessage(translate('Applied %s to this page.').replace('%s', translate(themeLabel)));
  }

  function updateFrameRadius(frameRadius: number) {
    const nextRadius = Math.min(PROJECT_FRAME_RADIUS_MAX, Math.max(PROJECT_FRAME_RADIUS_MIN, Math.round(frameRadius)));
    updateProject((current) => ({
      ...current,
      frameRadius: nextRadius,
    }));
  }

  return {
    addCustomFrame,
    applyTheme,
    loadCustomLayoutPreset,
    removeCustomFrame,
    updateCustomArea,
    updateCustomFrameArea,
    updateCustomTemplateDraft,
    updateFrameRadius,
  };
}
