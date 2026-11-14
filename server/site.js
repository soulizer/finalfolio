import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createBadRequest } from './lib/httpErrors.js';

const DEFAULT_SITE_CONTENT = {
  hero: {
    eyebrow: 'Folios, not endless galleries',
    title: 'Turn your photographs into a paced folio.',
    lede:
      'FinalFolio gives photographers, studios, and brand teams a calmer workflow to upload, sequence, write, crop, and export polished pages that still hold up as a PDF.',
    primaryCtaLabel: 'Start a folio',
    secondaryCtaLabel: 'Sign in',
    tertiaryCtaLabel: 'See the workflow',
  },
  editorialNote: {
    body:
      'Designed for teams that want editorial restraint, multi-page pacing, and a calmer publishing flow before committing to heavyweight desktop layout software.',
  },
  features: [
    {
      id: 'issue-composition',
      title: 'Folio composition, not asset dumping',
      copy:
        'Build a paced sequence of pages with cover, essay, grid, panorama, diptych, and triptych rhythms instead of dropping images into an endless strip.',
    },
    {
      id: 'preview-to-pdf',
      title: 'Preview that stays close to export',
      copy:
        'Crop, fit, copy, and page geometry stay grounded in the same page model the product uses when you print or export to PDF.',
    },
    {
      id: 'governed-projects',
      title: 'Projects that belong to a product',
      copy:
        'Accounts, uploads, projects, exports, and failures stay attached to users and can be reviewed from the admin backend instead of disappearing into a demo sandbox.',
    },
  ],
  workflow: {
    eyebrow: 'Workflow',
    title: 'From upload to folio, without jumping into desktop publishing too early.',
    body:
      'Start from a starter pack, shape the story page by page, refine crop and fit in place, and export a calmer PDF without losing sight of the final form.',
    steps: [
      'Upload photographs and keep them attached to a real project on the server.',
      'Sequence cover, essay, grid, panorama, and custom pages while the folio stays visible.',
      'Save the project at a stable URL, then print or export the finished folio.',
    ],
  },
  positioning: {
    eyebrow: 'Positioning',
    title: 'Closer to a lightweight editorial studio than a generic photo SaaS.',
    body:
      'FinalFolio is built around pacing, page rhythm, and printable output. The editor handles creation, the homepage proves the product, and the admin backend governs the system.',
  },
  cta: {
    eyebrow: 'Editor',
    title: 'Start shaping a folio now.',
    body:
      'Upload a real set of photographs, compose the sequence page by page, and keep the final export model visible while you work.',
    primaryLabel: 'Open Editor',
    secondaryLabel: 'Open sign in',
  },
  featuredIssue: {
    eyebrow: 'Featured folio output',
    title: 'What the system actually renders',
    body:
      'The homepage preview uses the same page renderer as the editor. Admin can pin a live folio here, or the product falls back to a built-in demonstration sequence.',
    projectId: null,
    pageIds: [],
  },
};

const DEFAULT_TEMPLATE_GOVERNANCE = {
  templates: {
    cover: { enabled: true, order: 10, category: 'Foundations', tag: 'Opening' },
    essay: { enabled: true, order: 20, category: 'Foundations', tag: 'Narrative' },
    folio: { enabled: true, order: 30, category: 'Foundations', tag: 'Hero' },
    grid: { enabled: true, order: 40, category: 'Rhythm', tag: 'Four-up' },
    diptych: { enabled: true, order: 50, category: 'Rhythm', tag: 'Pair' },
    panorama: { enabled: true, order: 60, category: 'Rhythm', tag: 'Wide' },
    mosaic: { enabled: true, order: 70, category: 'Details', tag: 'Lead + details' },
    triptych: { enabled: true, order: 80, category: 'Details', tag: 'Series' },
    custom: { enabled: true, order: 90, category: 'Custom', tag: 'User layout' },
  },
  packs: {
    'feature-story': { enabled: true, order: 10, category: 'Starter packs', tag: 'Editorial', featured: true },
    'lookbook-run': { enabled: true, order: 20, category: 'Starter packs', tag: 'Visual cadence', featured: true },
    'process-journal': { enabled: true, order: 30, category: 'Starter packs', tag: 'Notes + detail', featured: false },
  },
};


function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeText(value, fieldName, maxLength, { allowEmpty = false } = {}) {
  if (typeof value !== 'string') {
    throw createBadRequest(`${fieldName} is invalid.`);
  }

  const nextValue = value.trim();
  if (!allowEmpty && nextValue.length === 0) {
    throw createBadRequest(`${fieldName} is required.`);
  }

  if (nextValue.length > maxLength) {
    throw createBadRequest(`${fieldName} is too long.`);
  }

  return nextValue;
}

function sanitizeOptionalIdentifier(value, fieldName) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const nextValue = sanitizeText(value, fieldName, 80);
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(nextValue)) {
    throw createBadRequest(`${fieldName} is invalid.`);
  }

  return nextValue;
}

function sanitizePageIds(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .slice(0, 5)
    .map((entry) => sanitizeOptionalIdentifier(entry, 'Featured page ID'))
    .filter((entry) => entry !== null);
}

function sanitizeSiteContent(payload, fallback = DEFAULT_SITE_CONTENT) {
  const next = payload && typeof payload === 'object' ? payload : {};
  const features = Array.isArray(next.features) ? next.features : fallback.features;
  const workflowSteps = Array.isArray(next.workflow?.steps) ? next.workflow.steps : fallback.workflow.steps;

  return {
    hero: {
      eyebrow: sanitizeText(next.hero?.eyebrow ?? fallback.hero.eyebrow, 'Hero eyebrow', 80),
      title: sanitizeText(next.hero?.title ?? fallback.hero.title, 'Hero title', 180),
      lede: sanitizeText(next.hero?.lede ?? fallback.hero.lede, 'Hero lede', 360),
      primaryCtaLabel: sanitizeText(next.hero?.primaryCtaLabel ?? fallback.hero.primaryCtaLabel, 'Hero primary CTA', 48),
      secondaryCtaLabel: sanitizeText(next.hero?.secondaryCtaLabel ?? fallback.hero.secondaryCtaLabel, 'Hero secondary CTA', 48),
      tertiaryCtaLabel: sanitizeText(next.hero?.tertiaryCtaLabel ?? fallback.hero.tertiaryCtaLabel, 'Hero tertiary CTA', 48),
    },
    editorialNote: {
      body: sanitizeText(next.editorialNote?.body ?? fallback.editorialNote.body, 'Editorial note', 320),
    },
    features: fallback.features.map((feature, index) => ({
      id: feature.id,
      title: sanitizeText(features[index]?.title ?? feature.title, `Feature ${index + 1} title`, 80),
      copy: sanitizeText(features[index]?.copy ?? feature.copy, `Feature ${index + 1} copy`, 240),
    })),
    workflow: {
      eyebrow: sanitizeText(next.workflow?.eyebrow ?? fallback.workflow.eyebrow, 'Workflow eyebrow', 80),
      title: sanitizeText(next.workflow?.title ?? fallback.workflow.title, 'Workflow title', 160),
      body: sanitizeText(next.workflow?.body ?? fallback.workflow.body, 'Workflow body', 320),
      steps: fallback.workflow.steps.map((step, index) =>
        sanitizeText(workflowSteps[index] ?? step, `Workflow step ${index + 1}`, 180),
      ),
    },
    positioning: {
      eyebrow: sanitizeText(next.positioning?.eyebrow ?? fallback.positioning.eyebrow, 'Positioning eyebrow', 80),
      title: sanitizeText(next.positioning?.title ?? fallback.positioning.title, 'Positioning title', 180),
      body: sanitizeText(next.positioning?.body ?? fallback.positioning.body, 'Positioning body', 320),
    },
    cta: {
      eyebrow: sanitizeText(next.cta?.eyebrow ?? fallback.cta.eyebrow, 'CTA eyebrow', 80),
      title: sanitizeText(next.cta?.title ?? fallback.cta.title, 'CTA title', 160),
      body: sanitizeText(next.cta?.body ?? fallback.cta.body, 'CTA body', 280),
      primaryLabel: sanitizeText(next.cta?.primaryLabel ?? fallback.cta.primaryLabel, 'CTA primary label', 48),
      secondaryLabel: sanitizeText(next.cta?.secondaryLabel ?? fallback.cta.secondaryLabel, 'CTA secondary label', 48),
    },
    featuredIssue: {
      eyebrow: sanitizeText(next.featuredIssue?.eyebrow ?? fallback.featuredIssue.eyebrow, 'Featured folio eyebrow', 80),
      title: sanitizeText(next.featuredIssue?.title ?? fallback.featuredIssue.title, 'Featured folio title', 160),
      body: sanitizeText(next.featuredIssue?.body ?? fallback.featuredIssue.body, 'Featured folio body', 280),
      projectId: sanitizeOptionalIdentifier(next.featuredIssue?.projectId ?? fallback.featuredIssue.projectId, 'Featured project ID'),
      pageIds: sanitizePageIds(next.featuredIssue?.pageIds, fallback.featuredIssue.pageIds),
    },
  };
}

function sanitizeGovernanceEntry(value, fallback, { allowFeatured = false } = {}) {
  const next = value && typeof value === 'object' ? value : {};
  const entry = {
    enabled: typeof next.enabled === 'boolean' ? next.enabled : fallback.enabled,
    order:
      typeof next.order === 'number' && Number.isFinite(next.order) && next.order >= 0
        ? Math.round(next.order)
        : fallback.order,
    category: sanitizeText(next.category ?? fallback.category, 'Category', 48),
    tag: sanitizeText(next.tag ?? fallback.tag, 'Tag', 48),
  };

  if (allowFeatured) {
    entry.featured = typeof next.featured === 'boolean' ? next.featured : fallback.featured;
  }

  return entry;
}

function sanitizeTemplateGovernance(payload, fallback = DEFAULT_TEMPLATE_GOVERNANCE) {
  const next = payload && typeof payload === 'object' ? payload : {};
  const templateSettings = next.templates && typeof next.templates === 'object' ? next.templates : {};
  const packSettings = next.packs && typeof next.packs === 'object' ? next.packs : {};

  return {
    templates: Object.fromEntries(
      Object.entries(fallback.templates).map(([id, entry]) => [id, sanitizeGovernanceEntry(templateSettings[id], entry)]),
    ),
    packs: Object.fromEntries(
      Object.entries(fallback.packs).map(([id, entry]) => [id, sanitizeGovernanceEntry(packSettings[id], entry, { allowFeatured: true })]),
    ),
  };
}

export function createSiteStore({
  dataRoot,
} = {}) {
  const siteDir = path.join(dataRoot, 'site');
  const siteContentFile = path.join(siteDir, 'site-content.json');
  const templateGovernanceFile = path.join(siteDir, 'template-governance.json');

  async function ensureSiteDirectory() {
    await fs.mkdir(siteDir, { recursive: true });
  }

  async function writeJsonRecord(filename, record) {
    const tempFile = `${filename}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(record, null, 2), 'utf8');
    await fs.rename(tempFile, filename);
  }

  async function readStoredRecord(filename) {
    await ensureSiteDirectory();

    try {
      return JSON.parse(await fs.readFile(filename, 'utf8'));
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  async function readSiteContent() {
    const stored = await readStoredRecord(siteContentFile);
    return sanitizeSiteContent(stored ?? clone(DEFAULT_SITE_CONTENT));
  }

  async function updateSiteContent(payload) {
    const nextRecord = sanitizeSiteContent(payload);
    await ensureSiteDirectory();
    await writeJsonRecord(siteContentFile, nextRecord);
    return nextRecord;
  }

  async function readTemplateGovernance() {
    const stored = await readStoredRecord(templateGovernanceFile);
    return sanitizeTemplateGovernance(stored ?? clone(DEFAULT_TEMPLATE_GOVERNANCE));
  }

  async function updateTemplateGovernance(payload) {
    const nextRecord = sanitizeTemplateGovernance(payload);
    await ensureSiteDirectory();
    await writeJsonRecord(templateGovernanceFile, nextRecord);
    return nextRecord;
  }

  return {
    ensureSiteDirectory,
    readSiteContent,
    updateSiteContent,
    readTemplateGovernance,
    updateTemplateGovernance,
  };
}
