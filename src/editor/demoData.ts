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
import { Asset, CropSettings, ImageFit, PageData, ProjectState, TemplateId } from './types';

export interface TemplateDefinition {
  label: string;
  summary: string;
  description: string;
  slots: string[];
}

const defaultFit: ImageFit = 'cover';

export const templateMeta: Record<TemplateId, TemplateDefinition> = {
  cover: {
    label: 'Cover',
    summary: 'Lead opener',
    description: 'One lead image with restrained copy for the opening page.',
    slots: ['hero'],
  },
  essay: {
    label: 'Essay',
    summary: 'Image + text',
    description: 'A single image paired with a text column for opening notes, credits, or context.',
    slots: ['hero'],
  },
  folio: {
    label: 'Folio',
    summary: 'Hero page',
    description: 'A large image page with a slim editorial header and caption band.',
    slots: ['hero'],
  },
  grid: {
    label: 'Grid',
    summary: 'Four-up rhythm',
    description: 'A quiet four-frame page for pacing, details, or contact-sheet rhythm.',
    slots: ['a', 'b', 'c', 'd'],
  },
  diptych: {
    label: 'Diptych',
    summary: 'Balanced pair',
    description: 'Two balanced frames for comparison, transitions, or a quieter ending.',
    slots: ['left', 'right'],
  },
  panorama: {
    label: 'Panorama',
    summary: 'Wide pair',
    description: 'Two wide horizontal frames for landscapes, establishing shots, or top-and-tail pacing.',
    slots: ['top', 'bottom'],
  },
  mosaic: {
    label: 'Mosaic',
    summary: 'Lead + details',
    description: 'One dominant frame with two supporting details for product, interior, or sequence work.',
    slots: ['lead', 'top', 'bottom'],
  },
  triptych: {
    label: 'Triptych',
    summary: 'Three-up set',
    description: 'Three vertical frames for portraits, process work, or steady mid-issue pacing.',
    slots: ['a', 'b', 'c'],
  },
};

export const templateOrder: TemplateId[] = ['cover', 'essay', 'folio', 'grid', 'diptych', 'panorama', 'mosaic', 'triptych'];

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
    kicker: 'Opening note',
    title: 'Add a feature page',
    deck: 'Pair one image with a short deck and a block of copy.',
    body: 'Write an opening note, editor statement, credits, or context for the sequence here.',
    caption: 'This page prints exactly as composed in the editor.',
  },
  folio: {
    kicker: 'Feature',
    title: 'Give one image the page',
    deck: 'Use a hero page when the sequence needs scale before returning to smaller rhythms.',
    body: '',
    caption: 'Folio pages are useful for anchors, transitions, and chapter beats.',
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
  panorama: {
    kicker: 'Landscape',
    title: 'Stack two wide frames',
    deck: 'Panorama pages keep horizontal images predictable without stretching the page geometry.',
    body: '',
    caption: 'Wide frames stay fixed; adjust fit and crop independently per slot.',
  },
  mosaic: {
    kicker: 'Composition',
    title: 'Lead image with two details',
    deck: 'Use a dominant image and smaller secondary frames to hold context and close-ups together.',
    body: '',
    caption: 'Mosaic pages preserve a stable lead frame while supporting images stay secondary.',
  },
  triptych: {
    kicker: 'Series',
    title: 'Run a three-frame sequence',
    deck: 'Triptychs keep repeated subjects or portrait runs evenly paced on a single page.',
    body: '',
    caption: 'The first three assigned images stay in order when applying this preset.',
  },
};

function trimToLimit(value: string, limit: number) {
  return value.slice(0, limit);
}

function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === 'string' && value in templateMeta;
}

function isAsset(value: unknown): value is Asset {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as Asset).id === 'string' &&
    typeof (value as Asset).name === 'string' &&
    typeof (value as Asset).src === 'string' &&
    typeof (value as Asset).note === 'string'
  );
}

export function createDefaultCrop(overrides: Partial<CropSettings> = {}): CropSettings {
  return {
    x: 50,
    y: 50,
    scale: 1,
    fit: defaultFit,
    ...overrides,
  };
}

export function normalizeCropSettings(value: unknown): CropSettings {
  if (!value || typeof value !== 'object') {
    return createDefaultCrop();
  }

  const crop = value as Partial<CropSettings>;
  return createDefaultCrop({
    x: typeof crop.x === 'number' ? Math.min(100, Math.max(0, crop.x)) : 50,
    y: typeof crop.y === 'number' ? Math.min(100, Math.max(0, crop.y)) : 50,
    scale: typeof crop.scale === 'number' ? Math.min(2.2, Math.max(1, crop.scale)) : 1,
    fit: crop.fit === 'contain' ? 'contain' : defaultFit,
  });
}

function createStarterPage(template: TemplateId, id: string) {
  const slots = templateMeta[template].slots;
  const starter = pageStarters[template];

  return {
    id,
    template,
    kicker: starter.kicker,
    title: starter.title,
    deck: starter.deck,
    body: starter.body,
    caption: starter.caption,
    slots: Object.fromEntries(slots.map((slot) => [slot, null])),
    crops: Object.fromEntries(slots.map((slot) => [slot, createDefaultCrop()])),
  } satisfies PageData;
}

function normalizeSlots(template: TemplateId, slots: unknown) {
  const expectedSlots = templateMeta[template].slots;
  const nextSlots = slots && typeof slots === 'object' ? (slots as Record<string, unknown>) : {};

  return Object.fromEntries(
    expectedSlots.map((slot) => [slot, typeof nextSlots[slot] === 'string' ? nextSlots[slot] : null]),
  );
}

function normalizeCrops(template: TemplateId, crops: unknown) {
  const expectedSlots = templateMeta[template].slots;
  const nextCrops = crops && typeof crops === 'object' ? (crops as Record<string, unknown>) : {};

  return Object.fromEntries(expectedSlots.map((slot) => [slot, normalizeCropSettings(nextCrops[slot])]));
}

function normalizePageData(page: unknown, index: number): PageData {
  const template = isTemplateId((page as PageData | undefined)?.template) ? (page as PageData).template : 'essay';
  const starter = createStarterPage(template, `page-${template}-${index + 1}`);

  if (!page || typeof page !== 'object') {
    return starter;
  }

  const nextPage = page as Partial<PageData>;
  return {
    id: typeof nextPage.id === 'string' && nextPage.id.trim().length ? nextPage.id : starter.id,
    template,
    kicker: trimToLimit(typeof nextPage.kicker === 'string' ? nextPage.kicker : starter.kicker, PAGE_KICKER_LIMIT),
    title: trimToLimit(typeof nextPage.title === 'string' ? nextPage.title : starter.title, PAGE_TITLE_LIMIT),
    deck: trimToLimit(typeof nextPage.deck === 'string' ? nextPage.deck : starter.deck, PAGE_DECK_LIMIT),
    body: trimToLimit(typeof nextPage.body === 'string' ? nextPage.body : starter.body, PAGE_BODY_LIMIT),
    caption: trimToLimit(typeof nextPage.caption === 'string' ? nextPage.caption : starter.caption, PAGE_CAPTION_LIMIT),
    slots: normalizeSlots(template, nextPage.slots),
    crops: normalizeCrops(template, nextPage.crops),
  };
}

function carryAssetsToTemplate(page: PageData, template: TemplateId) {
  const currentSlots = templateMeta[page.template].slots;
  const nextSlots = templateMeta[template].slots;
  const nextPage = createPageDraft(template, page.id, {
    kicker: page.kicker,
    title: page.title,
    deck: page.deck,
    body: page.body,
    caption: page.caption,
  });
  const usedSourceSlots = new Set<string>();
  const carryQueue = currentSlots
    .map((slot) => ({
      slot,
      assetId: page.slots[slot],
      crop: normalizeCropSettings(page.crops[slot]),
    }))
    .filter((entry) => entry.assetId !== null);

  nextSlots.forEach((slot) => {
    const currentAssetId = page.slots[slot];
    if (typeof currentAssetId === 'string') {
      nextPage.slots[slot] = currentAssetId;
      nextPage.crops[slot] = normalizeCropSettings(page.crops[slot]);
      usedSourceSlots.add(slot);
    }
  });

  carryQueue
    .filter((entry) => !usedSourceSlots.has(entry.slot))
    .forEach((entry) => {
      const targetSlot = nextSlots.find((slot) => nextPage.slots[slot] === null);
      if (!targetSlot) {
        return;
      }

      nextPage.slots[targetSlot] = entry.assetId;
      nextPage.crops[targetSlot] = entry.crop;
    });

  return nextPage;
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
    crops: overrides.crops ?? Object.fromEntries(slots.map((slot) => [slot, createDefaultCrop()])),
  };
}

export function remapPageToTemplate(page: PageData, template: TemplateId) {
  return carryAssetsToTemplate(page, template);
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
      createPageDraft('diptych', 'page-diptych'),
    ],
  };
}

export function normalizeProjectState(project: unknown): ProjectState {
  const fresh = createDefaultProject();
  if (!project || typeof project !== 'object') {
    return fresh;
  }

  const nextProject = project as Partial<ProjectState>;
  const pages =
    Array.isArray(nextProject.pages) && nextProject.pages.length
      ? nextProject.pages.map((page, index) => normalizePageData(page, index))
      : fresh.pages;
  const assets = Array.isArray(nextProject.assets) ? nextProject.assets.filter(isAsset) : [];

  return {
    title: trimToLimit(typeof nextProject.title === 'string' ? nextProject.title : fresh.title, PROJECT_TITLE_LIMIT),
    subtitle: trimToLimit(
      typeof nextProject.subtitle === 'string' ? nextProject.subtitle : fresh.subtitle,
      PROJECT_SUBTITLE_LIMIT,
    ),
    issue: trimToLimit(typeof nextProject.issue === 'string' ? nextProject.issue : fresh.issue, PROJECT_ISSUE_LIMIT),
    assets,
    pages,
  };
}
