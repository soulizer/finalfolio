import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '../../i18n';
import {
  cloneCustomTemplateDefinition,
  createCustomTemplateDefinition,
} from '../../editor/demoData';
import {
  CUSTOM_LAYOUT_STORAGE_KEY,
  createCustomLayoutId,
  customTemplatesEqual,
  readCustomLayouts,
  writeCustomLayouts,
  type CustomLayoutRecord,
} from '../../editor/customLayouts';
import { CUSTOM_TEMPLATE_NAME_LIMIT } from '../../editor/limits';
import type { CustomTemplateDefinition, PageData, TemplateId } from '../../editor/types';
import { confirmAction } from '../../ui/confirm';

type UseCustomLayoutLibraryOptions = {
  customTemplateDraft: CustomTemplateDefinition;
  selectedPage: PageData | undefined;
  selectedPageId: string | undefined;
  templateChoice: TemplateId;
  setCustomTemplateDraft: (
    value: CustomTemplateDefinition | ((current: CustomTemplateDefinition) => CustomTemplateDefinition),
  ) => void;
  setTemplateChoice: (value: TemplateId) => void;
  setMessage: (message: string | null) => void;
};

/**
 * Saved page layouts (a name plus frame/text geometry) live in localStorage so
 * they behave like reusable templates without requiring a second server store.
 * The hook owns selection, rename/save, duplicate and delete so the editor page
 * only has to render the grid.
 */
export function useCustomLayoutLibrary({
  customTemplateDraft,
  selectedPage,
  selectedPageId,
  templateChoice,
  setCustomTemplateDraft,
  setTemplateChoice,
  setMessage,
}: UseCustomLayoutLibraryOptions) {
  const t = useT();
  const [customLayouts, setCustomLayouts] = useState<CustomLayoutRecord[]>(() => readCustomLayouts());
  const [activeCustomLayoutId, setActiveCustomLayoutId] = useState<string | null>(null);
  const [layoutsExpanded, setLayoutsExpanded] = useState(false);

  const activeCustomLayout = useMemo(
    () => customLayouts.find((layout) => layout.id === activeCustomLayoutId) ?? null,
    [activeCustomLayoutId, customLayouts],
  );
  const customLayoutDirty = useMemo(() => {
    if (!activeCustomLayout) {
      return false;
    }

    return !customTemplatesEqual(
      customTemplateDraft,
      cloneCustomTemplateDefinition(activeCustomLayout.template),
    );
  }, [activeCustomLayout, customTemplateDraft]);

  const persistCustomLayouts = useCallback((nextLayouts: CustomLayoutRecord[]) => {
    setCustomLayouts(nextLayouts);
    return writeCustomLayouts(nextLayouts);
  }, []);

  const confirmDiscardIfNeeded = useCallback(async () => {
    if (!customLayoutDirty) {
      return true;
    }

    return confirmAction({
      title: 'Discard unsaved layout changes?',
      body: 'This layout has changes that have not been saved to the library yet.',
      confirmLabel: 'Discard changes',
      tone: 'danger',
    });
  }, [customLayoutDirty]);

  const selectBuiltinLayout = useCallback(
    async (templateId: TemplateId) => {
      if (!(await confirmDiscardIfNeeded())) {
        return;
      }

      setTemplateChoice(templateId);
      setActiveCustomLayoutId(null);
    },
    [confirmDiscardIfNeeded, setTemplateChoice],
  );

  const selectCustomLayout = useCallback(
    async (layout: CustomLayoutRecord) => {
      if (!(await confirmDiscardIfNeeded())) {
        return;
      }

      setTemplateChoice('custom');
      setActiveCustomLayoutId(layout.id);
      setCustomTemplateDraft(cloneCustomTemplateDefinition(layout.template));
    },
    [confirmDiscardIfNeeded, setCustomTemplateDraft, setTemplateChoice],
  );

  const startNewCustomLayout = useCallback(async () => {
    if (!(await confirmDiscardIfNeeded())) {
      return;
    }

    setTemplateChoice('custom');
    setActiveCustomLayoutId(null);
    setCustomTemplateDraft(createCustomTemplateDefinition({ name: t('Untitled layout') }));
  }, [confirmDiscardIfNeeded, setCustomTemplateDraft, setTemplateChoice, t]);

  const resetCustomLayoutBase = useCallback(() => {
    setCustomTemplateDraft(
      createCustomTemplateDefinition({
        name: customTemplateDraft.name,
      }),
    );
  }, [customTemplateDraft.name, setCustomTemplateDraft]);

  const buildCustomLayoutTemplate = useCallback(
    (existing: CustomLayoutRecord | null): CustomTemplateDefinition => {
      const draft = customTemplateDraft;
      const nextName = draft.name.trim() || t('Untitled layout');
      // Keep canonical English keys for built-in scaffolds so the library still
      // follows the interface language. A name the user actually typed is kept
      // verbatim.
      const name = existing && nextName === t(existing.template.name) ? existing.template.name : nextName;
      const frames = draft.frames.map((frame) => {
        const original = existing?.template.frames.find((entry) => entry.slot === frame.slot);
        const label = original && frame.label === t(original.label) ? original.label : frame.label;
        return {
          ...frame,
          label,
        };
      });

      return {
        name,
        text: { ...draft.text },
        frames,
      };
    },
    [customTemplateDraft, t],
  );

  const saveCustomLayout = useCallback(() => {
    if (activeCustomLayout) {
      const template = buildCustomLayoutTemplate(activeCustomLayout);
      const nextLayouts = customLayouts.map((layout) =>
        layout.id === activeCustomLayout.id
          ? {
              ...layout,
              name: template.name,
              template,
            }
          : layout,
      );
      const persisted = persistCustomLayouts(nextLayouts);
      setCustomTemplateDraft(cloneCustomTemplateDefinition(template));
      setMessage(
        persisted
          ? t('Layout saved.')
          : t('Saved for this session only. This browser blocked local storage.'),
      );
      return;
    }

    const template = buildCustomLayoutTemplate(null);
    const record: CustomLayoutRecord = {
      id: createCustomLayoutId(),
      name: template.name,
      summary: '',
      template,
    };
    const persisted = persistCustomLayouts([record, ...customLayouts]);
    setActiveCustomLayoutId(record.id);
    setCustomTemplateDraft(cloneCustomTemplateDefinition(template));
    setMessage(
      persisted
        ? t('Saved as a new layout.')
        : t('Saved for this session only. This browser blocked local storage.'),
    );
  }, [
    activeCustomLayout,
    buildCustomLayoutTemplate,
    customLayouts,
    persistCustomLayouts,
    setCustomTemplateDraft,
    setMessage,
    t,
  ]);

  const saveCustomLayoutAsNew = useCallback(() => {
    const template = buildCustomLayoutTemplate(activeCustomLayout);
    const copyName = t('%s copy').replace('%s', t(template.name)).slice(0, CUSTOM_TEMPLATE_NAME_LIMIT);
    const record: CustomLayoutRecord = {
      id: createCustomLayoutId(),
      name: copyName,
      summary: '',
      template: {
        ...template,
        name: copyName,
      },
    };
    const persisted = persistCustomLayouts([record, ...customLayouts]);
    setActiveCustomLayoutId(record.id);
    setCustomTemplateDraft(cloneCustomTemplateDefinition(record.template));
    setMessage(
      persisted
        ? t('Saved as a new layout.')
        : t('Saved for this session only. This browser blocked local storage.'),
    );
  }, [
    activeCustomLayout,
    buildCustomLayoutTemplate,
    customLayouts,
    persistCustomLayouts,
    setCustomTemplateDraft,
    setMessage,
    t,
  ]);

  const deleteCustomLayout = useCallback(async () => {
    if (!activeCustomLayout) {
      return;
    }

    const confirmed = await confirmAction({
      title: 'Delete this layout?',
      body: 'The layout is removed from your library. Pages already using it keep their current design.',
      confirmLabel: 'Delete layout',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    const persisted = persistCustomLayouts(customLayouts.filter((layout) => layout.id !== activeCustomLayout.id));
    setActiveCustomLayoutId(null);
    setCustomTemplateDraft(
      selectedPage?.template === 'custom' && selectedPage.customTemplate
        ? cloneCustomTemplateDefinition(selectedPage.customTemplate)
        : createCustomTemplateDefinition({ name: t('Untitled layout') }),
    );
    setMessage(
      persisted
        ? t('Removed the custom layout. Pages already using it keep their current design.')
        : t('Removed for this session only. This browser blocked local storage.'),
    );
  }, [
    activeCustomLayout,
    customLayouts,
    persistCustomLayouts,
    selectedPage,
    setCustomTemplateDraft,
    setMessage,
    t,
  ]);

  useEffect(() => {
    if (templateChoice !== 'custom') {
      setActiveCustomLayoutId(null);
    }
  }, [templateChoice]);

  // Intentionally keyed by page id only: saving or editing the library must not
  // re-evaluate and detach the active layout.
  useEffect(() => {
    setActiveCustomLayoutId((current) => {
      if (!current) {
        return null;
      }

      const active = customLayouts.find((layout) => layout.id === current);
      if (!active || selectedPage?.template !== 'custom' || !selectedPage.customTemplate) {
        return null;
      }

      // Keep the link when the newly selected page still uses this saved layout
      // (for example right after inserting a page). Otherwise the builder would
      // look like an unsaved layout and could overwrite the wrong preset.
      return customTemplatesEqual(cloneCustomTemplateDefinition(active.template), selectedPage.customTemplate)
        ? current
        : null;
    });
  }, [selectedPageId]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === CUSTOM_LAYOUT_STORAGE_KEY) {
        setCustomLayouts(readCustomLayouts());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return {
    activeCustomLayout,
    activeCustomLayoutId,
    customLayoutDirty,
    customLayouts,
    deleteCustomLayout,
    layoutsExpanded,
    resetCustomLayoutBase,
    saveCustomLayout,
    saveCustomLayoutAsNew,
    selectBuiltinLayout,
    selectCustomLayout,
    setLayoutsExpanded,
    startNewCustomLayout,
  };
}
