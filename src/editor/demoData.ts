import {
  PAGE_BODY_LIMIT,
  PAGE_CAPTION_LIMIT,
  PAGE_DECK_LIMIT,
  PAGE_KICKER_LIMIT,
  PAGE_TITLE_LIMIT,
  PROJECT_ISSUE_LIMIT,
  PROJECT_SUBTITLE_LIMIT,
  PROJECT_TITLE_LIMIT,
} from './limits';
import { CropSettings, PageData, ProjectState, TemplateId } from './types';

const defaultCrop = (): CropSettings => ({ x: 50, y: 50, scale: 1 });

export const templateMeta: Record<TemplateId, { label: string; description: string; slots: string[] }> = {
  cover: {
    label: 'Cover',
    description: 'One lead image with restrained copy for the opening page.',
    slots: ['hero'],
  },
  essay: {
    label: 'Essay',
    description: 'A single image paired with a text column for opening notes, credits, or context.',
    slots: ['hero'],
  },
  grid: {
    label: 'Grid',
    description: 'A quiet four-frame page for pacing, details, or contact-sheet style rhythm.',
    slots: ['a', 'b', 'c', 'd'],
  },
  diptych: {
    label: 'Diptych',
    description: 'Two balanced frames for comparison, transitions, or a calmer ending.',
    slots: ['left', 'right'],
  },
};

const pageStarters: Record<
  TemplateId,
  Omit<PageData, 'id' | 'slots' | 'crops' | 'template'>
> = {
  cover: {
    kicker: 'Cover',
    title: 'Untitled Issue',
    deck: 'Issue 01',
    body: '',
    caption: 'Choose a lead image for the opening page.',
  },
  essay: {
    kicker: 'Opening spread',
    title: 'Add a feature page',
    deck: 'Pair one image with a short deck and a block of copy.',
    body: 'Write an opening note, editor statement, credits, or context for the sequence here.',
    caption: 'This page prints exactly as composed in the editor.',
  },
  grid: {
    kicker: 'Sequence',
    title: 'Build the interior rhythm',
    deck: 'Use smaller frames to control pacing before export.',
    body: '',
    caption: 'Upload your own photographs and drag them onto each frame.',
  },
  diptych: {
    kicker: 'Pairing',
    title: 'Use a two-image spread',
    deck: 'Diptychs are useful for transitions, comparison, or a quieter ending.',
    body: '',
    caption: 'Reorder pages below to control the exported sequence.',
  },
};

function trimToLimit(value: string, limit: number) {
  return value.slice(0, limit);
}

export function createPageDraft(template: TemplateId, id: string, overrides: Partial<PageData> = {}): PageData {
  const slots = templateMeta[template].slots;
  const starter = pageStarters[template];

  return {
    id,
    template,
    kicker: trimToLimit(overrides.kicker ?? starter.kicker, PAGE_KICKER_LIMIT),
    title: trimToLimit(overrides.title ?? starter.title, PAGE_TITLE_LIMIT),
    deck: trimToLimit(overrides.deck ?? starter.deck, PAGE_DECK_LIMIT),
    body: trimToLimit(overrides.body ?? starter.body, PAGE_BODY_LIMIT),
    caption: trimToLimit(overrides.caption ?? starter.caption, PAGE_CAPTION_LIMIT),
    slots: overrides.slots ?? Object.fromEntries(slots.map((slot) => [slot, null])),
    crops: overrides.crops ?? Object.fromEntries(slots.map((slot) => [slot, defaultCrop()])),
  };
}

export function createDefaultProject(): ProjectState {
  return {
    title: 'Untitled Issue'.slice(0, PROJECT_TITLE_LIMIT),
    subtitle: 'Upload photographs, shape the sequence page by page, then print only the finished magazine pages.'.slice(
      0,
      PROJECT_SUBTITLE_LIMIT,
    ),
    issue: 'Issue 01'.slice(0, PROJECT_ISSUE_LIMIT),
    assets: [],
    pages: [
      createPageDraft('cover', 'page-cover'),
      createPageDraft('essay', 'page-essay'),
      createPageDraft('grid', 'page-grid'),
    ],
  };
}
