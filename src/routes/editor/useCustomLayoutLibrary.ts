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
import type { CustomTemplateDefinition, PageData, TemplateId } from '../../editor/types';
import { confirmAction } from '../../ui/confirm';

type UseCustomLayoutLibraryOptions = {
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
 * The large layout editor owns the draft; this hook only persists records and
 * keeps the picker selection in sync.
 */
export function useCustomLayoutLibrary({
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

  const persistCustomLayouts = useCallback((nextLayouts: CustomLayoutRecord[]) => {
    setCustomLayouts(nextLayouts);
    return writeCustomLayouts(nextLayouts);
  }, []);

  const selectBuiltinLayout = useCallback(
    (templateId: TemplateId) => {
      setTemplateChoice(templateId);
      setActiveCustomLayoutId(null);
    },
    [setTemplateChoice],
  );

  const selectCustomLayout = useCallback(
    (layout: CustomLayoutRecord) => {
      setTemplateChoice('custom');
      setActiveCustomLayoutId(layout.id);
      setCustomTemplateDraft(cloneCustomTemplateDefinition(layout.template));
    },
    [setCustomTemplateDraft, setTemplateChoice],
  );

  const upsertCustomLayout = useCallback(
    (layoutId: string | null, template: CustomTemplateDefinition) => {
      const existing = layoutId ? customLayouts.find((layout) => layout.id === layoutId) ?? null : null;
      // Keep canonical English keys for built-in scaffolds so the library still
      // follows the interface language. A name the user actually typed is kept
      // verbatim.
      const name = existing && template.name === t(existing.template.name) ? existing.template.name : template.name;
      const canonicalTemplate: CustomTemplateDefinition = {
        ...template,
        name,
        frames: template.frames.map((frame) => {
          const original = existing?.template.frames.find((entry) => entry.slot === frame.slot);
          const label = original && frame.label === t(original.label) ? original.label : frame.label;
          return {
            ...frame,
            label,
          };
        }),
      };
      const record: CustomLayoutRecord = existing
        ? {
            ...existing,
            name: canonicalTemplate.name,
            template: canonicalTemplate,
          }
        : {
            id: createCustomLayoutId(),
            name: canonicalTemplate.name,
            summary: '',
            template: canonicalTemplate,
          };
      const nextLayouts = existing
        ? customLayouts.map((layout) => (layout.id === existing.id ? record : layout))
        : [record, ...customLayouts];
      const persisted = persistCustomLayouts(nextLayouts);

      setTemplateChoice('custom');
      setActiveCustomLayoutId(record.id);
      setCustomTemplateDraft(cloneCustomTemplateDefinition(record.template));
      setMessage(
        persisted
          ? t(existing ? 'Layout saved.' : 'Saved as a new layout.')
          : t('Saved for this session only. This browser blocked local storage.'),
      );

      return record;
    },
    [
      customLayouts,
      persistCustomLayouts,
      setCustomTemplateDraft,
      setMessage,
      setTemplateChoice,
      t,
    ],
  );

  const deleteCustomLayoutById = useCallback(
    async (layoutId: string) => {
      const existing = customLayouts.find((layout) => layout.id === layoutId);
      if (!existing) {
        return false;
      }

      const confirmed = await confirmAction({
        title: 'Delete this layout?',
        body: 'The layout is removed from your library. Pages already using it keep their current design.',
        confirmLabel: 'Delete layout',
        tone: 'danger',
      });
      if (!confirmed) {
        return false;
      }

      const persisted = persistCustomLayouts(customLayouts.filter((layout) => layout.id !== layoutId));
      setActiveCustomLayoutId((current) => (current === layoutId ? null : current));
      if (activeCustomLayoutId === layoutId) {
        setCustomTemplateDraft(
          selectedPage?.template === 'custom' && selectedPage.customTemplate
            ? cloneCustomTemplateDefinition(selectedPage.customTemplate)
            : createCustomTemplateDefinition({ name: t('Untitled layout') }),
        );
      }
      setMessage(
        persisted
          ? t('Removed the custom layout. Pages already using it keep their current design.')
          : t('Removed for this session only. This browser blocked local storage.'),
      );

      return true;
    },
    [
      activeCustomLayoutId,
      customLayouts,
      persistCustomLayouts,
      selectedPage,
      setCustomTemplateDraft,
      setMessage,
      t,
    ],
  );

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
    customLayouts,
    deleteCustomLayoutById,
    layoutsExpanded,
    selectBuiltinLayout,
    selectCustomLayout,
    setLayoutsExpanded,
    upsertCustomLayout,
  };
}
