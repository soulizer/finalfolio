import {
  CUSTOM_TEMPLATE_FRAME_LABEL_LIMIT,
  CUSTOM_TEMPLATE_FRAME_LIMIT,
  CUSTOM_TEMPLATE_NAME_LIMIT,
  PAGE_BODY_LIMIT,
  PAGE_CAPTION_LIMIT,
  PAGE_DECK_LIMIT,
  PAGE_KICKER_LIMIT,
  PAGE_TITLE_LIMIT,
  PROJECT_FRAME_RADIUS_DEFAULT,
  PROJECT_FRAME_RADIUS_MAX,
  PROJECT_FRAME_RADIUS_MIN,
  PROJECT_ISSUE_LIMIT,
  PROJECT_SUBTITLE_LIMIT,
  PROJECT_TITLE_LIMIT,
} from './limits';
import { DEFAULT_PROJECT_FONTS } from './fonts';
import {
  CUSTOM_LAYOUT_GAP_X_PERCENT,
  CUSTOM_LAYOUT_GAP_Y_PERCENT,
} from './layoutGeometry';
import { translate } from '../i18n';
import {
  Asset,
  CropSettings,
  CustomTemplateDefinition,
  CustomTemplateFrame,
  ImageFit,
  LayoutArea,
  PageData,
  PageThemeId,
  ProjectState,
  TemplateId,
  UserTemplateKind,
  UserTemplatePage,
  UserTemplatePayload,
} from './types';

export interface TemplateDefinition {
  label: string;
  summary: string;
  description: string;
  useCase: string;
  slots: string[];
}

export interface PageThemeDefinition {
  label: string;
  summary: string;
  description: string;
}

export interface CustomLayoutPreset {
  id: string;
  label: string;
  summary: string;
  template: CustomTemplateDefinition;
}

export interface TemplatePackPageSpec {
  template: TemplateId;
  customTemplate?: CustomTemplateDefinition;
  overrides?: Partial<Omit<PageData, 'id' | 'template' | 'slots' | 'crops' | 'customTemplate'>>;
}

export interface TemplatePackDefinition {
  id: string;
  label: string;
  summary: string;
  description: string;
  pages: TemplatePackPageSpec[];
}

const defaultFit: ImageFit = 'cover';
export const DEFAULT_FILL_SCALE = 1.1;
export const defaultPageTheme: PageThemeId = 'warm-beige';

function normalizeFrameRadius(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return PROJECT_FRAME_RADIUS_DEFAULT;
  }

  return clamp(Math.round(value), PROJECT_FRAME_RADIUS_MIN, PROJECT_FRAME_RADIUS_MAX);
}

export const pageThemeMeta: Record<PageThemeId, PageThemeDefinition> = {
  'warm-beige': {
    label: 'Warm beige',
    summary: 'Editorial paper',
    description: 'The current signature paper tone with warm contrast for classic magazine pages.',
  },
  'butter-cream': {
    label: 'Butter cream',
    summary: 'Soft warmth',
    description: 'A mellow cream sheet that lifts skin tones and travel imagery without looking yellow.',
  },
  'pale-blue': {
    label: 'Pale blue',
    summary: 'Cool daylight',
    description: 'A quiet blue paper tone that keeps the page airy without flattening photographs.',
  },
  'sea-glass': {
    label: 'Sea glass',
    summary: 'Cool green',
    description: 'A pale blue-green paper for calmer spreads, coastal sets, and softer documentary pages.',
  },
  'pure-white': {
    label: 'Pure white',
    summary: 'Bright neutral',
    description: 'A crisp white sheet for maximum contrast and the cleanest print background.',
  },
  'light-gray': {
    label: 'Light gray',
    summary: 'Soft neutral',
    description: 'A restrained gray sheet when you want a quieter page without a warm cast.',
  },
  sandstone: {
    label: 'Sand stone',
    summary: 'Muted sand',
    description: 'A dry sand-toned paper that adds body to product, interior, and desert work without going dark.',
  },
  'sage-mist': {
    label: 'Sage mist',
    summary: 'Muted green',
    description: 'A soft green-gray paper tone for calmer spreads and quieter product or landscape work.',
  },
  'dusty-rose': {
    label: 'Dusty rose',
    summary: 'Warm tint',
    description: 'A restrained rose paper tone that adds warmth without turning the page sugary.',
  },
  'pearl-blush': {
    label: 'Pearl blush',
    summary: 'Light blush',
    description: 'A pale blush sheet for wedding, portrait, and softer lifestyle stories that still need editorial restraint.',
  },
};

export const pageThemeOrder: PageThemeId[] = [
  'warm-beige',
  'butter-cream',
  'pale-blue',
  'sea-glass',
  'pure-white',
  'light-gray',
  'sandstone',
  'sage-mist',
  'dusty-rose',
  'pearl-blush',
];

const GAP_X = CUSTOM_LAYOUT_GAP_X_PERCENT;
const GAP_Y = CUSTOM_LAYOUT_GAP_Y_PERCENT;
const EDITORIAL_FRAME_X = 32 + GAP_X;
const EDITORIAL_FRAME_W = 100 - EDITORIAL_FRAME_X;
const EDITORIAL_HALF_W = (EDITORIAL_FRAME_W - GAP_X) / 2;
const EDITORIAL_DETAIL_Y = 58 + GAP_Y;
const EDITORIAL_DETAIL_H = 100 - EDITORIAL_DETAIL_Y;

const RIBBON_FRAMES_Y = 24 + GAP_Y;
const RIBBON_FRAMES_H = 100 - RIBBON_FRAMES_Y;
const RIBBON_INSET_X = 62 + GAP_X;
const RIBBON_INSET_W = 100 - RIBBON_INSET_X;
const RIBBON_INSET_H = (RIBBON_FRAMES_H - GAP_Y) / 2;

const CAPTION_START_X = 24 + GAP_X;
const CAPTION_FRAME_W = (100 - CAPTION_START_X - GAP_X * 2) / 3;

const CONTACT_FRAME_W = (100 - GAP_X) / 2;
const CONTACT_FRAME_H = (74 - GAP_Y * 2) / 2;
const CONTACT_SECOND_X = CONTACT_FRAME_W + GAP_X;
const CONTACT_SECOND_Y = CONTACT_FRAME_H + GAP_Y;

const defaultCustomTemplateSource: CustomTemplateDefinition = {
  name: 'Editorial Split',
  text: {
    x: 0,
    y: 0,
    width: 32,
    height: 100,
  },
  frames: [
    {
      slot: 'frame1',
      label: 'Lead',
      x: EDITORIAL_FRAME_X,
      y: 0,
      width: EDITORIAL_FRAME_W,
      height: 58,
    },
    {
      slot: 'frame2',
      label: 'Detail A',
      x: EDITORIAL_FRAME_X,
      y: EDITORIAL_DETAIL_Y,
      width: EDITORIAL_HALF_W,
      height: EDITORIAL_DETAIL_H,
    },
    {
      slot: 'frame3',
      label: 'Detail B',
      x: EDITORIAL_FRAME_X + EDITORIAL_HALF_W + GAP_X,
      y: EDITORIAL_DETAIL_Y,
      width: EDITORIAL_HALF_W,
      height: EDITORIAL_DETAIL_H,
    },
  ],
};

const customLayoutPresetSource = [
  {
    id: 'editorial-split',
    label: 'Editorial split',
    summary: 'Text rail with a lead image and two supporting frames.',
    template: defaultCustomTemplateSource,
  },
  {
    id: 'ribbon-essay',
    label: 'Ribbon essay',
    summary: 'A wide text band above a lead image and two quiet details.',
    template: {
      name: 'Ribbon Essay',
      text: {
        x: 0,
        y: 0,
        width: 100,
        height: 24,
      },
      frames: [
        {
          slot: 'frame1',
          label: 'Lead',
          x: 0,
          y: RIBBON_FRAMES_Y,
          width: 62,
          height: RIBBON_FRAMES_H,
        },
        {
          slot: 'frame2',
          label: 'Inset A',
          x: RIBBON_INSET_X,
          y: RIBBON_FRAMES_Y,
          width: RIBBON_INSET_W,
          height: RIBBON_INSET_H,
        },
        {
          slot: 'frame3',
          label: 'Inset B',
          x: RIBBON_INSET_X,
          y: RIBBON_FRAMES_Y + RIBBON_INSET_H + GAP_Y,
          width: RIBBON_INSET_W,
          height: RIBBON_INSET_H,
        },
      ],
    },
  },
  {
    id: 'caption-rail',
    label: 'Caption rail',
    summary: 'A left note rail with three tall vertical frames.',
    template: {
      name: 'Caption Rail',
      text: {
        x: 0,
        y: 0,
        width: 24,
        height: 100,
      },
      frames: [
        {
          slot: 'frame1',
          label: 'Frame A',
          x: CAPTION_START_X,
          y: 0,
          width: CAPTION_FRAME_W,
          height: 100,
        },
        {
          slot: 'frame2',
          label: 'Frame B',
          x: CAPTION_START_X + CAPTION_FRAME_W + GAP_X,
          y: 0,
          width: CAPTION_FRAME_W,
          height: 100,
        },
        {
          slot: 'frame3',
          label: 'Frame C',
          x: CAPTION_START_X + (CAPTION_FRAME_W + GAP_X) * 2,
          y: 0,
          width: CAPTION_FRAME_W,
          height: 100,
        },
      ],
    },
  },
  {
    id: 'contact-grid',
    label: 'Contact grid',
    summary: 'A four-frame grid with a bottom text band for notes and credits.',
    template: {
      name: 'Contact Grid',
      text: {
        x: 0,
        y: 74,
        width: 100,
        height: 26,
      },
      frames: [
        {
          slot: 'frame1',
          label: 'Frame A',
          x: 0,
          y: 0,
          width: CONTACT_FRAME_W,
          height: CONTACT_FRAME_H,
        },
        {
          slot: 'frame2',
          label: 'Frame B',
          x: CONTACT_SECOND_X,
          y: 0,
          width: CONTACT_FRAME_W,
          height: CONTACT_FRAME_H,
        },
        {
          slot: 'frame3',
          label: 'Frame C',
          x: 0,
          y: CONTACT_SECOND_Y,
          width: CONTACT_FRAME_W,
          height: CONTACT_FRAME_H,
        },
        {
          slot: 'frame4',
          label: 'Frame D',
          x: CONTACT_SECOND_X,
          y: CONTACT_SECOND_Y,
          width: CONTACT_FRAME_W,
          height: CONTACT_FRAME_H,
        },
      ],
    },
  },
] as const;

export const templateMeta: Record<TemplateId, TemplateDefinition> = {
  cover: {
    label: 'Cover',
    summary: 'Lead opener',
    useCase: 'Cover opener',
    description: 'One lead image with restrained copy for the opening page.',
    slots: ['hero'],
  },
  essay: {
    label: 'Essay',
    summary: 'Image + text',
    useCase: 'Text and image pairing',
    description: 'A single image paired with a text column for opening notes, credits, or context.',
    slots: ['hero'],
  },
  folio: {
    label: 'Folio',
    summary: 'Hero page',
    useCase: 'Single hero image',
    description: 'A large image page with a slim editorial header and caption band.',
    slots: ['hero'],
  },
  grid: {
    label: 'Grid',
    summary: 'Four-up rhythm',
    useCase: 'Multi-image comparison',
    description: 'A quiet four-frame page for pacing, details, or contact-sheet rhythm.',
    slots: ['a', 'b', 'c', 'd'],
  },
  diptych: {
    label: 'Diptych',
    summary: 'Balanced pair',
    useCase: 'Two-image transitions',
    description: 'Two balanced frames for comparison, transitions, or a quieter ending.',
    slots: ['left', 'right'],
  },
  panorama: {
    label: 'Panorama',
    summary: 'Wide pair',
    useCase: 'Wide landscape sets',
    description: 'Two wide horizontal frames for landscapes, establishing shots, or top-and-tail pacing.',
    slots: ['top', 'bottom'],
  },
  mosaic: {
    label: 'Mosaic',
    summary: 'Lead + details',
    useCase: 'Lead image with details',
    description: 'A dominant image with two secondary frames and a compact editorial band.',
    slots: ['lead', 'top', 'bottom'],
  },
  triptych: {
    label: 'Triptych',
    summary: 'Three-up set',
    useCase: 'Portrait series',
    description: 'Three tall frames with a restrained editorial rail for portrait runs and repeated subjects.',
    slots: ['a', 'b', 'c'],
  },
  custom: {
    label: 'Custom',
    summary: 'User-defined',
    useCase: 'User-defined',
    description: 'Define your own image and text arrangement, then apply it as a page preset.',
    slots: [],
  },
};

export const templateOrder: TemplateId[] = [
  'cover',
  'essay',
  'folio',
  'grid',
  'diptych',
  'panorama',
  'mosaic',
  'triptych',
  'custom',
];

const templateFieldSupport: Record<
  TemplateId,
  {
    kicker: boolean;
    deck: boolean;
    body: boolean;
  }
> = {
  cover: {
    kicker: false,
    deck: true,
    body: false,
  },
  essay: {
    kicker: true,
    deck: true,
    body: true,
  },
  folio: {
    kicker: true,
    deck: true,
    body: false,
  },
  grid: {
    kicker: true,
    deck: false,
    body: true,
  },
  diptych: {
    kicker: true,
    deck: true,
    body: true,
  },
  panorama: {
    kicker: true,
    deck: true,
    body: false,
  },
  mosaic: {
    kicker: true,
    deck: true,
    body: true,
  },
  triptych: {
    kicker: true,
    deck: true,
    body: true,
  },
  custom: {
    kicker: true,
    deck: true,
    body: true,
  },
};

export function templateUsesKicker(template: TemplateId) {
  return templateFieldSupport[template].kicker;
}

export function templateUsesDeck(template: TemplateId) {
  return templateFieldSupport[template].deck;
}

function customTemplateSupportsBody(customTemplate?: CustomTemplateDefinition | null) {
  if (!customTemplate) {
    return true;
  }

  return customTemplate.text.width >= 28 && customTemplate.text.height >= 30;
}

export function templateUsesBody(template: TemplateId, customTemplate?: CustomTemplateDefinition | null) {
  if (template === 'custom') {
    return templateFieldSupport[template].body && customTemplateSupportsBody(customTemplate);
  }

  return templateFieldSupport[template].body;
}

export const pageStarters: Record<TemplateId, Omit<PageData, 'id' | 'slots' | 'crops' | 'template' | 'customTemplate' | 'theme'>> = {
  cover: {
    kicker: 'Cover',
    title: 'Untitled Project',
    deck: 'Folio 01',
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
    title: 'Use a two-image page',
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
    deck: 'Use one dominant image and two supporting details to hold context and close-ups together.',
    body: '',
    caption: 'Mosaic pages keep the lead frame prominent while supporting images stay clearly secondary.',
  },
  triptych: {
    kicker: 'Series',
    title: 'Run a three-frame sequence',
    deck: 'Triptychs keep repeated subjects or portrait runs evenly paced beside a narrow editorial rail.',
    body: '',
    caption: 'The first three assigned images stay in order when applying this preset.',
  },
  custom: {
    kicker: 'Custom layout',
    title: 'Design your own page',
    deck: 'Define the text block and image frames, then keep editing the page like any other preset.',
    body: 'Use the custom layout builder to position the text area and frame geometry for this page.',
    caption: 'Custom layouts stay editable after you apply them to the page.',
  },
};

export const customLayoutPresets: CustomLayoutPreset[] = customLayoutPresetSource.map((preset) => ({
  ...preset,
  template: normalizeCustomTemplateDefinition(preset.template),
}));


const templatePackSource: TemplatePackDefinition[] = [
  {
    id: 'feature-story',
    label: 'Feature Story',
    summary: 'Balanced opener',
    description: 'A cover-led sequence that opens with text, widens into detail rhythm, then closes quietly.',
    pages: [
      { template: 'cover' },
      { template: 'essay' },
      { template: 'mosaic' },
      { template: 'triptych' },
      { template: 'folio' },
      { template: 'diptych' },
    ],
  },
  {
    id: 'lookbook-run',
    label: 'Lookbook Run',
    summary: 'Wide visual cadence',
    description: 'Built for fashion, interiors, and product sets that alternate broad anchors with tighter supporting pages.',
    pages: [
      { template: 'cover' },
      { template: 'panorama' },
      { template: 'triptych' },
      { template: 'grid' },
      { template: 'folio' },
      { template: 'essay' },
    ],
  },
  {
    id: 'process-journal',
    label: 'Process Journal',
    summary: 'Notes + details',
    description: 'A sequence for behind-the-scenes work, making-of notes, and denser editorial pacing.',
    pages: [
      { template: 'cover' },
      { template: 'essay' },
      { template: 'custom', customTemplate: customLayoutPresetSource[1].template },
      { template: 'mosaic' },
      { template: 'grid' },
      { template: 'diptych' },
    ],
  },
];

export type TemplatePackId = (typeof templatePackSource)[number]['id'];

export const templatePackOrder: TemplatePackId[] = templatePackSource.map((pack) => pack.id);

export const templatePacks: Record<TemplatePackId, TemplatePackDefinition> = Object.fromEntries(
  templatePackSource.map((pack) => [
    pack.id,
    {
      ...pack,
      pages: pack.pages.map((page) => ({
        ...page,
        customTemplate: page.customTemplate ? normalizeCustomTemplateDefinition(page.customTemplate) : undefined,
      })),
    },
  ]),
) as Record<TemplatePackId, TemplatePackDefinition>;
export const projectTemplateMeta = templatePacks;

export const defaultTemplatePackId: TemplatePackId = 'feature-story';

function trimToLimit(value: string, limit: number) {
  return value.slice(0, limit);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === 'string' && value in templateMeta;
}

export function normalizePageTheme(value: unknown): PageThemeId {
  return typeof value === 'string' && value in pageThemeMeta ? (value as PageThemeId) : defaultPageTheme;
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

function normalizeAssetRecord(value: unknown): Asset | null {
  if (!isAsset(value)) {
    return null;
  }

  const asset = value as Asset;
  const hasIntrinsicSize =
    typeof asset.width === 'number' &&
    Number.isFinite(asset.width) &&
    asset.width > 0 &&
    typeof asset.height === 'number' &&
    Number.isFinite(asset.height) &&
    asset.height > 0;
  const deliveryState =
    asset.delivery?.state === 'pending' ||
    asset.delivery?.state === 'remote' ||
    asset.delivery?.state === 'failed' ||
    asset.delivery?.state === 'local'
      ? asset.delivery.state
      : null;

  return {
    id: asset.id,
    name: asset.name,
    src: asset.src,
    note: asset.note,
    builtIn: asset.builtIn === true,
    ...(typeof asset.bytes === 'number' && Number.isFinite(asset.bytes) && asset.bytes >= 0 ? { bytes: Math.round(asset.bytes) } : {}),
    ...(typeof asset.mimeType === 'string' && asset.mimeType.trim() ? { mimeType: asset.mimeType.trim() } : {}),
    ...(asset.variants && typeof asset.variants === 'object'
      ? {
          variants: {
            ...(asset.variants.original && typeof asset.variants.original === 'object' ? { original: { ...asset.variants.original } } : {}),
            ...(asset.variants.preview !== undefined ? { preview: asset.variants.preview ? { ...asset.variants.preview } : null } : {}),
            ...(asset.variants.thumb !== undefined ? { thumb: asset.variants.thumb ? { ...asset.variants.thumb } : null } : {}),
          },
        }
      : {}),
    ...(hasIntrinsicSize
      ? {
          width: Math.round(asset.width as number),
          height: Math.round(asset.height as number),
        }
      : {}),
    ...(deliveryState
      ? {
          delivery: {
            state: deliveryState,
            ...(typeof asset.delivery?.canRetry === 'boolean' ? { canRetry: asset.delivery.canRetry } : {}),
            ...(typeof asset.delivery?.queuedAt === 'string' || asset.delivery?.queuedAt === null
              ? { queuedAt: asset.delivery?.queuedAt ?? null }
              : {}),
            ...(typeof asset.delivery?.lastAttemptAt === 'string' || asset.delivery?.lastAttemptAt === null
              ? { lastAttemptAt: asset.delivery?.lastAttemptAt ?? null }
              : {}),
            ...(typeof asset.delivery?.syncedAt === 'string' || asset.delivery?.syncedAt === null
              ? { syncedAt: asset.delivery?.syncedAt ?? null }
              : {}),
            ...(typeof asset.delivery?.error === 'string' || asset.delivery?.error === null
              ? { error: asset.delivery?.error ?? null }
              : {}),
            ...(typeof asset.delivery?.attempts === 'number' && Number.isFinite(asset.delivery.attempts)
              ? { attempts: Math.max(0, Math.round(asset.delivery.attempts)) }
              : {}),
          },
        }
      : {}),
    ...(typeof asset.lastUsedAt === 'string' || asset.lastUsedAt === null ? { lastUsedAt: asset.lastUsedAt ?? null } : {}),
  };
}

function isValidFrameSlot(value: unknown): value is string {
  return typeof value === 'string' && /^frame\d+$/i.test(value.trim());
}

function normalizeArea(value: unknown, fallback: LayoutArea): LayoutArea {
  if (!value || typeof value !== 'object') {
    return { ...fallback };
  }

  const nextArea = value as Partial<LayoutArea>;
  const x = typeof nextArea.x === 'number' ? clamp(nextArea.x, 0, 100) : fallback.x;
  const y = typeof nextArea.y === 'number' ? clamp(nextArea.y, 0, 100) : fallback.y;
  const width = typeof nextArea.width === 'number' ? clamp(nextArea.width, 12, 100) : fallback.width;
  const height = typeof nextArea.height === 'number' ? clamp(nextArea.height, 12, 100) : fallback.height;

  return {
    x,
    y,
    width: clamp(width, 12, 100 - x),
    height: clamp(height, 12, 100 - y),
  };
}

function defaultFrameArea(index: number): LayoutArea {
  if (index === 1) {
    return defaultCustomTemplateSource.frames[0];
  }

  if (index === 2) {
    return defaultCustomTemplateSource.frames[1];
  }

  if (index === 3) {
    return defaultCustomTemplateSource.frames[2];
  }

  const column = (index - 4) % 2;
  const row = Math.floor((index - 4) / 2);

  return {
    x: 36 + column * 32,
    y: 6 + row * 30,
    width: 30,
    height: 26,
  };
}

function createDefaultFrame(index: number): CustomTemplateFrame {
  const area = defaultFrameArea(index);

  return {
    slot: `frame${index}`,
    label: `Frame ${index}`,
    ...area,
  };
}

function normalizeFrame(frame: unknown, index: number): CustomTemplateFrame {
  const fallback = createDefaultFrame(index);

  if (!frame || typeof frame !== 'object') {
    return fallback;
  }

  const nextFrame = frame as Partial<CustomTemplateFrame>;
  return {
    slot: isValidFrameSlot(nextFrame.slot) ? nextFrame.slot.trim().toLowerCase() : fallback.slot,
    label: trimToLimit(typeof nextFrame.label === 'string' ? nextFrame.label : fallback.label, CUSTOM_TEMPLATE_FRAME_LABEL_LIMIT) || fallback.label,
    ...normalizeArea(nextFrame, fallback),
  };
}

export function localizeCustomTemplateDefinition(template: CustomTemplateDefinition): CustomTemplateDefinition {
  return {
    ...template,
    name: translate(template.name),
    frames: template.frames.map((frame) => ({ ...frame, label: translate(frame.label) })),
  };
}

export function createCustomTemplateDefinition(overrides: Partial<CustomTemplateDefinition> = {}): CustomTemplateDefinition {
  return localizeCustomTemplateDefinition(
    normalizeCustomTemplateDefinition({
      ...defaultCustomTemplateSource,
      ...overrides,
      text: overrides.text ?? defaultCustomTemplateSource.text,
      frames: overrides.frames ?? defaultCustomTemplateSource.frames,
    }),
  );
}

export function cloneCustomTemplateDefinition(template?: CustomTemplateDefinition | null) {
  return localizeCustomTemplateDefinition(normalizeCustomTemplateDefinition(template ?? defaultCustomTemplateSource));
}

export function normalizeCustomTemplateDefinition(value: unknown): CustomTemplateDefinition {
  const fallback = defaultCustomTemplateSource;
  if (!value || typeof value !== 'object') {
    return {
      name: fallback.name,
      text: { ...fallback.text },
      frames: fallback.frames.map((frame) => ({ ...frame })),
    };
  }

  const nextTemplate = value as Partial<CustomTemplateDefinition>;
  const rawFrames =
    Array.isArray(nextTemplate.frames) && nextTemplate.frames.length
      ? nextTemplate.frames.slice(0, CUSTOM_TEMPLATE_FRAME_LIMIT)
      : fallback.frames;
  const usedSlots = new Set<string>();
  const frames = rawFrames.map((frame, index) => {
    const normalizedFrame = normalizeFrame(frame, index + 1);
    let slot = normalizedFrame.slot;

    while (usedSlots.has(slot)) {
      slot = `frame${usedSlots.size + 1}`;
    }

    usedSlots.add(slot);
    return {
      ...normalizedFrame,
      slot,
    };
  });

  return {
    name:
      trimToLimit(
        typeof nextTemplate.name === 'string' ? nextTemplate.name : fallback.name,
        CUSTOM_TEMPLATE_NAME_LIMIT,
      ) || fallback.name,
    text: normalizeArea(nextTemplate.text, fallback.text),
    frames,
  };
}

export function createDefaultCrop(overrides: Partial<CropSettings> = {}): CropSettings {
  const fit = overrides.fit === 'contain' ? 'contain' : defaultFit;
  return {
    x: 50,
    y: 50,
    scale: fit === 'contain' ? 1 : DEFAULT_FILL_SCALE,
    fit,
    ...overrides,
  };
}

export function normalizeCropSettings(value: unknown): CropSettings {
  if (!value || typeof value !== 'object') {
    return createDefaultCrop();
  }

  const crop = value as Partial<CropSettings>;
  const fit = crop.fit === 'contain' ? 'contain' : defaultFit;
  const minimumScale = fit === 'contain' ? 1 : DEFAULT_FILL_SCALE;
  return createDefaultCrop({
    x: typeof crop.x === 'number' ? Math.min(100, Math.max(0, crop.x)) : 50,
    y: typeof crop.y === 'number' ? Math.min(100, Math.max(0, crop.y)) : 50,
    scale: typeof crop.scale === 'number' ? Math.min(2.2, Math.max(minimumScale, crop.scale)) : minimumScale,
    fit,
  });
}

export function getTemplateSlots(template: TemplateId, customTemplate?: CustomTemplateDefinition | null) {
  if (template === 'custom') {
    return (customTemplate ?? defaultCustomTemplateSource).frames.map((frame) => frame.slot);
  }

  return templateMeta[template].slots;
}

export function getPageSlotOrder(page: Pick<PageData, 'template' | 'customTemplate'>) {
  return getTemplateSlots(page.template, page.customTemplate);
}

export function countImageSlots(
  pages: Array<{ template: TemplateId; customTemplate?: CustomTemplateDefinition | null }>,
) {
  return pages.reduce(
    (total, page) =>
      total + getPageSlotOrder({ template: page.template, customTemplate: page.customTemplate ?? null }).length,
    0,
  );
}

export function getTemplateLabel(template: TemplateId, customTemplate?: CustomTemplateDefinition | null) {
  if (template === 'custom') {
    return customTemplate?.name || templateMeta.custom.label;
  }

  return templateMeta[template].label;
}

function createStarterPage(template: TemplateId, id: string, customTemplate?: CustomTemplateDefinition | null) {
  const normalizedCustomTemplate = template === 'custom' ? cloneCustomTemplateDefinition(customTemplate) : null;
  const slots = getTemplateSlots(template, normalizedCustomTemplate);
  const starter = pageStarters[template];
  const localizedStarter = {
    kicker: translate(starter.kicker),
    title: translate(starter.title),
    deck: translate(starter.deck),
    body: translate(starter.body),
    caption: translate(starter.caption),
  };

  return {
    id,
    template,
    theme: defaultPageTheme,
    kicker: localizedStarter.kicker,
    title: localizedStarter.title,
    deck: localizedStarter.deck,
    body: localizedStarter.body,
    caption: localizedStarter.caption,
    customTemplate: normalizedCustomTemplate,
    slots: Object.fromEntries(slots.map((slot) => [slot, null])),
    crops: Object.fromEntries(slots.map((slot) => [slot, createDefaultCrop()])),
  } satisfies PageData;
}

function normalizeSlots(template: TemplateId, customTemplate: CustomTemplateDefinition | null, slots: unknown) {
  const expectedSlots = getTemplateSlots(template, customTemplate);
  const nextSlots = slots && typeof slots === 'object' ? (slots as Record<string, unknown>) : {};

  return Object.fromEntries(
    expectedSlots.map((slot) => [slot, typeof nextSlots[slot] === 'string' ? nextSlots[slot] : null]),
  );
}

function normalizeCrops(template: TemplateId, customTemplate: CustomTemplateDefinition | null, crops: unknown) {
  const expectedSlots = getTemplateSlots(template, customTemplate);
  const nextCrops = crops && typeof crops === 'object' ? (crops as Record<string, unknown>) : {};

  return Object.fromEntries(expectedSlots.map((slot) => [slot, normalizeCropSettings(nextCrops[slot])]));
}

function normalizePageData(page: unknown, index: number): PageData {
  const template = isTemplateId((page as PageData | undefined)?.template) ? (page as PageData).template : 'essay';
  const normalizedCustomTemplate =
    template === 'custom' ? normalizeCustomTemplateDefinition((page as Partial<PageData> | undefined)?.customTemplate) : null;
  const starter = createStarterPage(template, `page-${template}-${index + 1}`, normalizedCustomTemplate);

  if (!page || typeof page !== 'object') {
    return starter;
  }

  const nextPage = page as Partial<PageData>;
  const customTemplate = template === 'custom' ? normalizedCustomTemplate : null;

  return {
    id: typeof nextPage.id === 'string' && nextPage.id.trim().length ? nextPage.id : starter.id,
    template,
    theme: normalizePageTheme(nextPage.theme),
    kicker: trimToLimit(typeof nextPage.kicker === 'string' ? nextPage.kicker : starter.kicker, PAGE_KICKER_LIMIT),
    title: trimToLimit(typeof nextPage.title === 'string' ? nextPage.title : starter.title, PAGE_TITLE_LIMIT),
    deck: trimToLimit(typeof nextPage.deck === 'string' ? nextPage.deck : starter.deck, PAGE_DECK_LIMIT),
    body: trimToLimit(typeof nextPage.body === 'string' ? nextPage.body : starter.body, PAGE_BODY_LIMIT),
    caption: trimToLimit(typeof nextPage.caption === 'string' ? nextPage.caption : starter.caption, PAGE_CAPTION_LIMIT),
    customTemplate,
    slots: normalizeSlots(template, customTemplate, nextPage.slots),
    crops: normalizeCrops(template, customTemplate, nextPage.crops),
  };
}

function carryAssetsToTemplate(page: PageData, template: TemplateId, customTemplate?: CustomTemplateDefinition | null) {
  const currentSlots = getPageSlotOrder(page);
  const nextPage = createPageDraft(template, page.id, {
    theme: page.theme,
    kicker: page.kicker,
    title: page.title,
    deck: page.deck,
    body: page.body,
    caption: page.caption,
    customTemplate,
  });
  const nextSlots = getPageSlotOrder(nextPage);
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
  const customTemplate = template === 'custom' ? cloneCustomTemplateDefinition(overrides.customTemplate) : null;
  const slots = getTemplateSlots(template, customTemplate);
  const starter = pageStarters[template];

  const starterCopy = {
    kicker: translate(starter.kicker),
    title: translate(starter.title),
    deck: translate(starter.deck),
    body: translate(starter.body),
    caption: translate(starter.caption),
  };

  return {
    id,
    template,
    theme: normalizePageTheme(overrides.theme),
    kicker: trimToLimit(overrides.kicker ?? starterCopy.kicker, PAGE_KICKER_LIMIT),
    title: trimToLimit(overrides.title ?? starterCopy.title, PAGE_TITLE_LIMIT),
    deck: trimToLimit(overrides.deck ?? starterCopy.deck, PAGE_DECK_LIMIT),
    body: trimToLimit(overrides.body ?? starterCopy.body, PAGE_BODY_LIMIT),
    caption: trimToLimit(overrides.caption ?? starterCopy.caption, PAGE_CAPTION_LIMIT),
    customTemplate,
    slots:
      overrides.slots && typeof overrides.slots === 'object'
        ? Object.fromEntries(slots.map((slot) => [slot, typeof overrides.slots?.[slot] === 'string' ? overrides.slots[slot] : null]))
        : Object.fromEntries(slots.map((slot) => [slot, null])),
    crops:
      overrides.crops && typeof overrides.crops === 'object'
        ? Object.fromEntries(slots.map((slot) => [slot, normalizeCropSettings(overrides.crops?.[slot])]))
        : Object.fromEntries(slots.map((slot) => [slot, createDefaultCrop()])),
  };
}

export function remapPageToTemplate(page: PageData, template: TemplateId, customTemplate?: CustomTemplateDefinition | null) {
  return carryAssetsToTemplate(page, template, customTemplate);
}

export function createPagesFromTemplatePack(
  packId: TemplatePackId,
  {
    idFactory,
  }: {
    idFactory?: (page: TemplatePackPageSpec, index: number) => string;
  } = {},
) {
  const pack = templatePacks[packId];

  return pack.pages.map((page, index) =>
    createPageDraft(page.template, idFactory?.(page, index) ?? `page-${packId}-${index + 1}`, {
      ...page.overrides,
      customTemplate: page.customTemplate ? cloneCustomTemplateDefinition(page.customTemplate) : undefined,
    }),
  );
}

export function createDefaultProject(): ProjectState {
  return {
    title: translate('Untitled Project').slice(0, PROJECT_TITLE_LIMIT),
    subtitle: translate(
      'Upload photographs, shape the sequence page by page, then print only the finished magazine pages.',
    ).slice(0, PROJECT_SUBTITLE_LIMIT),
    issue: translate('Folio 01').slice(0, PROJECT_ISSUE_LIMIT),
    frameRadius: PROJECT_FRAME_RADIUS_DEFAULT,
    fonts: { ...DEFAULT_PROJECT_FONTS },
    assets: [],
    pages: createPagesFromTemplatePack(defaultTemplatePackId),
  };
}

function buildTemplatePageBlueprint(page: PageData, { preserveCopy }: { preserveCopy: boolean }): UserTemplatePage {
  const starterPage = createPageDraft(page.template, `template-${page.template}`, {
    theme: page.theme,
    customTemplate: page.customTemplate ?? undefined,
  });

  return {
    template: page.template,
    theme: page.theme,
    kicker: preserveCopy ? page.kicker : starterPage.kicker,
    title: preserveCopy ? page.title : starterPage.title,
    deck: preserveCopy ? page.deck : starterPage.deck,
    body: preserveCopy ? page.body : starterPage.body,
    caption: preserveCopy ? page.caption : starterPage.caption,
    customTemplate: page.customTemplate ? cloneCustomTemplateDefinition(page.customTemplate) : null,
  };
}

export function extractUserTemplatePayload(
  project: ProjectState,
  { preserveCopy = true }: { preserveCopy?: boolean } = {},
): UserTemplatePayload {
  const defaultProject = createDefaultProject();

  return {
    title: preserveCopy ? project.title : defaultProject.title,
    subtitle: preserveCopy ? project.subtitle : defaultProject.subtitle,
    issue: preserveCopy ? project.issue : defaultProject.issue,
    frameRadius: normalizeFrameRadius(project.frameRadius),
    pages: project.pages.map((page) => buildTemplatePageBlueprint(page, { preserveCopy })),
  };
}

export function extractUserTemplatePayloadForKind(
  project: ProjectState,
  kind: UserTemplateKind,
  {
    preserveCopy = true,
    pageId,
  }: {
    preserveCopy?: boolean;
    pageId?: string | null;
  } = {},
): UserTemplatePayload {
  if (kind === 'project') {
    return extractUserTemplatePayload(project, { preserveCopy });
  }

  const selectedPage = project.pages.find((page) => page.id === pageId) ?? project.pages[0];
  if (!selectedPage) {
    return extractUserTemplatePayload(project, { preserveCopy });
  }

  const defaultProject = createDefaultProject();
  return {
    title: preserveCopy ? project.title : defaultProject.title,
    subtitle: preserveCopy ? project.subtitle : defaultProject.subtitle,
    issue: preserveCopy ? project.issue : defaultProject.issue,
    frameRadius: normalizeFrameRadius(project.frameRadius),
    pages: [buildTemplatePageBlueprint(selectedPage, { preserveCopy })],
  };
}

export function createProjectFromUserTemplate(templatePayload: UserTemplatePayload): ProjectState {
  const normalizedPayload =
    templatePayload && typeof templatePayload === 'object'
      ? templatePayload
      : {
          title: '',
          subtitle: '',
          issue: '',
          frameRadius: PROJECT_FRAME_RADIUS_DEFAULT,
          pages: [],
        };

  const project = createDefaultProject();
  const pages =
    Array.isArray(normalizedPayload.pages) && normalizedPayload.pages.length
      ? normalizedPayload.pages.map((page, index) =>
          createPageDraft(page.template, `page-template-${index + 1}`, {
            theme: normalizePageTheme(page.theme),
            kicker: typeof page.kicker === 'string' ? page.kicker : undefined,
            title: typeof page.title === 'string' ? page.title : undefined,
            deck: typeof page.deck === 'string' ? page.deck : undefined,
            body: typeof page.body === 'string' ? page.body : undefined,
            caption: typeof page.caption === 'string' ? page.caption : undefined,
            customTemplate: page.customTemplate ? cloneCustomTemplateDefinition(page.customTemplate) : undefined,
          }),
        )
      : project.pages;

  return normalizeProjectState({
    title: typeof normalizedPayload.title === 'string' ? normalizedPayload.title : project.title,
    subtitle: typeof normalizedPayload.subtitle === 'string' ? normalizedPayload.subtitle : project.subtitle,
    issue: typeof normalizedPayload.issue === 'string' ? normalizedPayload.issue : project.issue,
    frameRadius: normalizedPayload.frameRadius,
    assets: [],
    pages,
  });
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
  const assets = Array.isArray(nextProject.assets)
    ? nextProject.assets
        .map((asset) => normalizeAssetRecord(asset))
        .filter((asset) => asset !== null)
    : [];

  const normalizedTitleSource = typeof nextProject.title === 'string' ? nextProject.title : fresh.title;
  const normalizedIssueSource = typeof nextProject.issue === 'string' ? nextProject.issue : fresh.issue;
  const title = normalizedTitleSource.trim() === 'Untitled Issue' || normalizedTitleSource.trim() === 'Untitled Folio' ? fresh.title : normalizedTitleSource;
  const issue = normalizedIssueSource.trim() === 'Issue 01' || normalizedIssueSource.trim() === 'Folio 01' ? fresh.issue : normalizedIssueSource;

  return {
    title: trimToLimit(title, PROJECT_TITLE_LIMIT),
    subtitle: trimToLimit(
      typeof nextProject.subtitle === 'string' ? nextProject.subtitle : fresh.subtitle,
      PROJECT_SUBTITLE_LIMIT,
    ),
    issue: trimToLimit(issue, PROJECT_ISSUE_LIMIT),
    frameRadius: normalizeFrameRadius(nextProject.frameRadius),
    assets,
    pages,
  };
}
