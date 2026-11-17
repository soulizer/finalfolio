import {
  createPageDraft,
  getPageSlotOrder,
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
    title: sanitizeString(page.title),
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
        pages.push({
          template: 'folio',
          theme: lastPage.theme,
          kicker: '',
          title: '',
          deck: '',
          body: '',
          caption: '',
          assetIndexes: closingAssetIndex === undefined ? [] : [closingAssetIndex],
        });
      }

      const usedIndexes = new Set<number>();
      pages.forEach((page) => page.assetIndexes.forEach((index) => usedIndexes.add(index)));

      return {
        id: sanitizeString(plan.id, `plan-${planIndex + 1}`),
        name: sanitizeString(plan.name, `Plan ${planIndex + 1}`),
        style: sanitizeString(plan.style),
        summary: sanitizeString(plan.summary),
        pageCount: pages.length,
        photoCount: usedIndexes.size,
        pages,
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
      title: page.title,
      deck: page.deck,
      body: page.body,
      caption: page.caption,
      slots,
    });
  });

  return {
    ...project,
    title: bundle.folioTitle || project.title,
    subtitle: bundle.folioSubtitle || project.subtitle,
    issue: bundle.issue || project.issue,
    frameRadius: clampFrameRadius(bundle.frameRadius),
    pages: pages.length ? pages : project.pages,
  };
}

export function aiTemplateLabel(template: TemplateId) {
  return templateMeta[template]?.label ?? template;
}
