import { customLayoutPresets, normalizeCustomTemplateDefinition } from './demoData';
import type { CustomTemplateDefinition, LayoutArea } from './types';

export const CUSTOM_LAYOUT_STORAGE_KEY = 'finalfolio-custom-layouts-v1';

/**
 * A saved layout is a normal page template: a name plus the text/frame geometry.
 * Built-in scaffolds are seeded into the same library so they behave exactly like
 * layouts the user created (renameable, deletable, restorable by re-creating).
 */
export type CustomLayoutRecord = {
  id: string;
  name: string;
  summary: string;
  template: CustomTemplateDefinition;
};

function cloneRecord(record: CustomLayoutRecord): CustomLayoutRecord {
  return {
    id: record.id,
    name: record.name,
    summary: record.summary,
    template: normalizeCustomTemplateDefinition(record.template),
  };
}

const seedLayouts: CustomLayoutRecord[] = customLayoutPresets.map((preset) => ({
  id: preset.id,
  name: preset.template.name,
  summary: preset.summary,
  template: normalizeCustomTemplateDefinition(preset.template),
}));

function normalizeRecord(value: unknown): CustomLayoutRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Partial<CustomLayoutRecord>;
  if (typeof record.id !== 'string' || !record.id.trim()) {
    return null;
  }

  const template = normalizeCustomTemplateDefinition(record.template);
  const name = typeof record.name === 'string' && record.name.trim() ? record.name.trim() : template.name;

  return {
    id: record.id.trim(),
    name,
    summary: typeof record.summary === 'string' ? record.summary : '',
    template: {
      ...template,
      name,
    },
  };
}

export function readCustomLayouts(): CustomLayoutRecord[] {
  if (typeof window === 'undefined') {
    return seedLayouts.map(cloneRecord);
  }

  try {
    const raw = window.localStorage.getItem(CUSTOM_LAYOUT_STORAGE_KEY);
    if (!raw) {
      return seedLayouts.map(cloneRecord);
    }

    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { layouts?: unknown }).layouts)
        ? (parsed as { layouts: unknown[] }).layouts
        : null;

    // An empty stored list is intentional: the user deleted every layout.
    if (!list) {
      return seedLayouts.map(cloneRecord);
    }

    const seen = new Set<string>();
    return list
      .map(normalizeRecord)
      .filter((record): record is CustomLayoutRecord => {
        if (!record || seen.has(record.id)) {
          return false;
        }
        seen.add(record.id);
        return true;
      });
  } catch {
    return seedLayouts.map(cloneRecord);
  }
}

export function writeCustomLayouts(layouts: CustomLayoutRecord[]) {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    window.localStorage.setItem(
      CUSTOM_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        layouts,
      }),
    );
    return true;
  } catch {
    // A full or unavailable storage area must not break editing; the in-memory
    // library still works for the current session.
    return false;
  }
}

export function createCustomLayoutId() {
  return `layout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function layoutAreaEquals(a: LayoutArea, b: LayoutArea) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export function customTemplatesEqual(a: CustomTemplateDefinition, b: CustomTemplateDefinition) {
  if (a.name !== b.name || !layoutAreaEquals(a.text, b.text) || a.frames.length !== b.frames.length) {
    return false;
  }

  return a.frames.every((frame, index) => {
    const other = b.frames[index];
    return Boolean(
      other &&
        frame.slot === other.slot &&
        frame.label === other.label &&
        layoutAreaEquals(frame, other),
    );
  });
}
