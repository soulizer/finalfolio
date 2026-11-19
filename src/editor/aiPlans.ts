import { translate } from '../i18n';
import {
  createPageDraft,
  getPageSlotOrder,
  pageStarters,
  templateMeta,
} from './demoData';
import {
  PROJECT_FRAME_RADIUS_DEFAULT,
  PROJECT_FRAME_RADIUS_MAX,
  PROJECT_FRAME_RADIUS_MIN,
  PROJECT_PAGE_LIMIT,
} from './limits';
import type { Asset, PageThemeId, ProjectState, TemplateId } from './types';

export const AI_PAGE_TEMPLATES: TemplateId[] = [
  'cover',
  'essay',
  'folio',
  'grid',
  'diptych',
  'panorama',
  'mosaic',
  'triptych',
];

export const AI_PAGE_THEMES: PageThemeId[] = [
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

export type AiPlanPage = {
  template: TemplateId;
  theme: PageThemeId;
  kicker: string;
  title: string;
  deck: string;
  body: string;
  caption: string;
  assetIndexes: number[];
};

export type AiPlan = {
  id: string;
  name: string;
  style: string;
  summary: string;
  /** Optional per-plan folio identity; falls back to the bundle values. */
  folioTitle?: string;
  folioSubtitle?: string;
  issue?: string;
  frameRadius?: number;
  pageCount: number;
  photoCount: number;
  pages: AiPlanPage[];
};

export type AiPlanBundle = {
  folioTitle: string;
  folioSubtitle: string;
  issue: string;
  frameRadius: number;
  plans: AiPlan[];
  prompt: string;
  providerName?: string;
};

/** How many photo frames a built-in template has. */
export function planPageCapacity(template: TemplateId) {
  return getPageSlotOrder({ template, customTemplate: null }).length;
}

function pageCapacity(page: AiPlanPage) {
  return planPageCapacity(page.template);
}

/**
 * Every page must carry a title: the server rejects projects with empty page
 * titles, and a blank heading is a broken page for the reader. Providers
 * sometimes omit the title, and the padding pages we add ourselves (odd page
 * count, unused photos) have no model copy at all — both get the localized
 * starter title for their template instead.
 */
function defaultPlanPageTitle(template: TemplateId) {
  return translate(pageStarters[template]?.title ?? 'Untitled page');
}

function createEmptyPlanPage(template: TemplateId, theme: PageThemeId): AiPlanPage {
  return {
    template,
    theme,
    kicker: '',
    title: defaultPlanPageTitle(template),
    deck: '',
    body: '',
    caption: '',
    assetIndexes: [],
  };
}

/**
 * The model tends to leave some selected photos unused. Every selected photo
 * must land somewhere: fill free frames first, then append pages until every
 * photo is placed. The caller keeps the page count even afterwards.
 */
function ensureAllPhotosUsed(pages: AiPlanPage[], imageCount: number): AiPlanPage[] {
  if (!Number.isFinite(imageCount) || imageCount <= 0) {
    return pages;
  }

  const used = new Set<number>();
  pages.forEach((page) => page.assetIndexes.forEach((index) => used.add(index)));
  const missing: number[] = [];
  for (let index = 0; index < imageCount; index += 1) {
    if (!used.has(index)) {
      missing.push(index);
    }
  }
  if (!missing.length) {
    return pages;
  }

  const result = pages.map((page) => ({ ...page, assetIndexes: [...page.assetIndexes] }));

  // 1) Fill frames that are still empty in existing pages.
  for (const page of result) {
    const capacity = pageCapacity(page);
    while (page.assetIndexes.length < capacity && missing.length) {
      page.assetIndexes.push(missing.shift() as number);
    }
  }

  // 2) Append extra pages for whatever is left, largest capacity first.
  const fillers: Array<{ template: TemplateId; capacity: number }> = [
    { template: 'grid', capacity: 4 },
    { template: 'triptych', capacity: 3 },
    { template: 'diptych', capacity: 2 },
    { template: 'folio', capacity: 1 },
  ];
  while (missing.length && result.length < PROJECT_PAGE_LIMIT) {
    const remaining = missing.length;
    const filler = fillers.find((entry) => entry.capacity <= remaining) ?? fillers[fillers.length - 1];
    const template = remaining === 1 ? 'folio' : filler.template;
    const capacity = remaining === 1 ? 1 : filler.capacity;
    const theme = result[result.length - 1]?.theme ?? 'warm-beige';
    const page = createEmptyPlanPage(template, theme);
    page.assetIndexes = missing.splice(0, capacity);
    result.push(page);
  }

  return result;
}

function clampFrameRadius(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return PROJECT_FRAME_RADIUS_DEFAULT;
  }

  return Math.min(PROJECT_FRAME_RADIUS_MAX, Math.max(PROJECT_FRAME_RADIUS_MIN, Math.round(value)));
}

function sanitizeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizePage(value: unknown, imageCount: number): AiPlanPage | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const page = value as Partial<AiPlanPage>;
  const template = typeof page.template === 'string' ? page.template.toLowerCase() : '';
  if (!template || !AI_PAGE_TEMPLATES.includes(template as TemplateId)) {
    return null;
  }

  const rawTheme = typeof page.theme === 'string' ? page.theme.toLowerCase() : '';
  const theme = AI_PAGE_THEMES.includes(rawTheme as PageThemeId) ? (rawTheme as PageThemeId) : 'warm-beige';
  const assetIndexes = Array.isArray(page.assetIndexes)
    ? page.assetIndexes
        .map((index) => {
          if (typeof index === 'number' && Number.isInteger(index)) {
            return index;
          }
          if (typeof index === 'string' && /^\d+$/.test(index)) {
            return Number(index);
          }
          return null;
        })
        .filter((index): index is number => index !== null && index >= 0 && index < imageCount)
        .slice(0, 8)
    : [];

  return {
    template: template as TemplateId,
    theme,
    kicker: sanitizeString(page.kicker),
    title: sanitizeString(page.title) || defaultPlanPageTitle(template as TemplateId),
    deck: sanitizeString(page.deck),
    body: sanitizeString(page.body),
    caption: sanitizeString(page.caption),
    assetIndexes,
  };
}

export function normalizeAiPlanBundle(value: unknown, prompt: string, imageCount = Number.POSITIVE_INFINITY): AiPlanBundle {
  const payload = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const rawPlans = Array.isArray(payload.plans) ? payload.plans : [];
  const plans = rawPlans
    .map((rawPlan, planIndex) => {
      if (!rawPlan || typeof rawPlan !== 'object') {
        return null;
      }

      const plan = rawPlan as Record<string, unknown>;
      const pages = (Array.isArray(plan.pages) ? plan.pages : [])
        .map((page) => normalizePage(page, imageCount))
        .filter((page): page is AiPlanPage => Boolean(page))
        .slice(0, PROJECT_PAGE_LIMIT);
      if (!pages.length) {
        return null;
      }

      // Turn.js reads more naturally with an even page count. The prompt asks
      // for an even count, and this fallback keeps the promise if a provider
      // returns an odd sequence.
      if (pages.length % 2 === 1 && pages.length < PROJECT_PAGE_LIMIT) {
        const lastPage = pages[pages.length - 1];
        const closingAssetIndex = [...lastPage.assetIndexes].reverse().find((index) => index >= 0 && index < imageCount);
        const closingPage = createEmptyPlanPage('folio', lastPage.theme);
        closingPage.assetIndexes = closingAssetIndex === undefined ? [] : [closingAssetIndex];
        pages.push(closingPage);
      }

      const filledPages = [...ensureAllPhotosUsed(pages, imageCount)];
      if (filledPages.length % 2 === 1 && filledPages.length < PROJECT_PAGE_LIMIT) {
        const lastPage = filledPages[filledPages.length - 1];
        filledPages.push(createEmptyPlanPage('folio', lastPage.theme));
      }

      const usedIndexes = new Set<number>();
      filledPages.forEach((page) => page.assetIndexes.forEach((index) => usedIndexes.add(index)));

      return {
        id: sanitizeString(plan.id, `plan-${planIndex + 1}`),
        name: sanitizeString(plan.name, `Plan ${planIndex + 1}`),
        style: sanitizeString(plan.style),
        summary: sanitizeString(plan.summary),
        ...(sanitizeString(plan.folioTitle) ? { folioTitle: sanitizeString(plan.folioTitle) } : {}),
        ...(sanitizeString(plan.folioSubtitle) ? { folioSubtitle: sanitizeString(plan.folioSubtitle) } : {}),
        ...(sanitizeString(plan.issue) ? { issue: sanitizeString(plan.issue) } : {}),
        ...(typeof plan.frameRadius === 'number' ? { frameRadius: clampFrameRadius(plan.frameRadius) } : {}),
        pageCount: filledPages.length,
        photoCount: usedIndexes.size,
        pages: filledPages,
      } satisfies AiPlan;
    })
    .filter((plan): plan is AiPlan => Boolean(plan))
    .slice(0, 3);

  if (!plans.length) {
    throw new Error('The AI response did not contain any usable plans.');
  }

  return {
    folioTitle: sanitizeString(payload.folioTitle),
    folioSubtitle: sanitizeString(payload.folioSubtitle),
    issue: sanitizeString(payload.issue),
    frameRadius: clampFrameRadius(payload.frameRadius),
    plans,
    prompt,
    providerName: sanitizeString(payload.providerName) || undefined,
  };
}

export function applyAiPlanToProject({
  project,
  bundle,
  plan,
  assets,
  createPageId,
}: {
  project: ProjectState;
  bundle: AiPlanBundle;
  plan: AiPlan;
  assets: Array<Asset | null>;
  createPageId: () => string;
}): ProjectState {
  const pages = plan.pages.slice(0, PROJECT_PAGE_LIMIT).map((page) => {
    const slotOrder = getPageSlotOrder({ template: page.template, customTemplate: null });
    const slots = Object.fromEntries(
      slotOrder.map((slot, slotIndex) => {
        const assetIndex = page.assetIndexes[slotIndex];
        return [slot, typeof assetIndex === 'number' ? assets[assetIndex]?.id ?? null : null];
      }),
    );

    return createPageDraft(page.template, createPageId(), {
      theme: page.theme,
      kicker: page.kicker,
      title: page.title.trim() || defaultPlanPageTitle(page.template),
      deck: page.deck,
      body: page.body,
      caption: page.caption,
      slots,
    });
  });

  return {
    ...project,
    // The chosen plan owns the folio identity: title, subtitle, issue mark and
    // frame radius all change together with the pages.
    title: plan.folioTitle || bundle.folioTitle || project.title,
    subtitle: plan.folioSubtitle || bundle.folioSubtitle || project.subtitle,
    issue: plan.issue || bundle.issue || project.issue,
    frameRadius: clampFrameRadius(plan.frameRadius ?? bundle.frameRadius),
    pages: pages.length ? pages : project.pages,
  };
}

export function aiTemplateLabel(template: TemplateId) {
  return templateMeta[template]?.label ?? template;
}
