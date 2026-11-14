import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createBadRequest } from './lib/httpErrors.js';

const DEFAULT_CACHE_TTL_MS = 5_000;
const DEFAULT_FILL_SCALE = 1.1;
const TEMPLATE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{7,63}$/i;
const TEMPLATE_NAME_LIMIT = 80;
const TEMPLATE_DESCRIPTION_LIMIT = 240;
const TEMPLATE_KIND_VALUES = new Set(['page', 'project']);


function sanitizeText(value, fieldName, maxLength, { allowEmpty = false, trim = true } = {}) {
  if (typeof value !== 'string') {
    throw createBadRequest(`${fieldName} is invalid.`);
  }

  const nextValue = trim ? value.trim() : value;
  if (!allowEmpty && nextValue.length === 0) {
    throw createBadRequest(`${fieldName} is required.`);
  }

  if (nextValue.length > maxLength) {
    throw createBadRequest(`${fieldName} is too long.`);
  }

  return nextValue;
}

function sanitizeIdentifier(value, fieldName, maxLength = 80, { allowEmpty = false } = {}) {
  if ((value === null || value === undefined || value === '') && allowEmpty) {
    return null;
  }

  const nextValue = sanitizeText(value, fieldName, maxLength, { allowEmpty: false, trim: true });
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(nextValue)) {
    throw createBadRequest(`${fieldName} is invalid.`);
  }

  return nextValue;
}

function sanitizeTemplateKind(value) {
  if (typeof value !== 'string' || !TEMPLATE_KIND_VALUES.has(value)) {
    return 'project';
  }

  return value;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeLayoutArea(area) {
  if (
    !area ||
    typeof area !== 'object' ||
    typeof area.x !== 'number' ||
    typeof area.y !== 'number' ||
    typeof area.width !== 'number' ||
    typeof area.height !== 'number'
  ) {
    throw createBadRequest('Template layout area is invalid.');
  }

  const x = clamp(area.x, 0, 100);
  const y = clamp(area.y, 0, 100);
  const width = clamp(area.width, 12, 100);
  const height = clamp(area.height, 12, 100);

  if (x + width > 100 || y + height > 100) {
    throw createBadRequest('Template layout area is invalid.');
  }

  return {
    x,
    y,
    width,
    height,
  };
}

function sanitizeCustomTemplate(customTemplate, { textLimits }) {
  if (
    !customTemplate ||
    typeof customTemplate !== 'object' ||
    typeof customTemplate.name !== 'string' ||
    !Array.isArray(customTemplate.frames) ||
    customTemplate.frames.length === 0
  ) {
    throw createBadRequest('Custom template is invalid.');
  }

  const usedSlots = new Set();
  const frames = customTemplate.frames.map((frame, index) => {
    if (!frame || typeof frame !== 'object') {
      throw createBadRequest('Custom template frame is invalid.');
    }

    const slot = sanitizeText(frame.slot, 'Custom frame slot', 32, { allowEmpty: false, trim: true }).toLowerCase();
    if (!/^frame\d+$/.test(slot) || usedSlots.has(slot)) {
      throw createBadRequest('Custom template frame slot is invalid.');
    }

    usedSlots.add(slot);

    return {
      slot,
      label: sanitizeText(frame.label, 'Custom frame label', textLimits.customFrameLabel, { allowEmpty: false, trim: true }) || `Frame ${index + 1}`,
      ...sanitizeLayoutArea(frame),
    };
  });

  return {
    name: sanitizeText(customTemplate.name, 'Custom template name', textLimits.customTemplateName, { allowEmpty: false, trim: true }),
    text: sanitizeLayoutArea(customTemplate.text),
    frames,
  };
}

function createDefaultCrop() {
  return {
    x: 50,
    y: 50,
    scale: DEFAULT_FILL_SCALE,
    fit: 'cover',
  };
}

function sanitizeTemplatePage(page, { templateSlots, allowedPageThemes, textLimits }) {
  if (!page || typeof page !== 'object') {
    throw createBadRequest('Template page is invalid.');
  }

  const template = sanitizeText(page.template, 'Template page template', 32, { allowEmpty: false, trim: true });
  if (template !== 'custom' && !(template in templateSlots)) {
    throw createBadRequest('Template page template is invalid.');
  }

  const theme = sanitizeText(page.theme, 'Template page theme', 32, { allowEmpty: false, trim: true });
  if (!allowedPageThemes.has(theme)) {
    throw createBadRequest('Template page theme is invalid.');
  }

  return {
    template,
    theme,
    kicker: sanitizeText(page.kicker ?? '', 'Template page kicker', textLimits.pageKicker, { allowEmpty: true, trim: false }),
    title: sanitizeText(page.title, 'Template page title', textLimits.pageTitle, { allowEmpty: false, trim: false }),
    deck: sanitizeText(page.deck ?? '', 'Template page deck', textLimits.pageDeck, { allowEmpty: true, trim: false }),
    body: sanitizeText(page.body ?? '', 'Template page body', textLimits.pageBody, { allowEmpty: true, trim: false }),
    caption: sanitizeText(page.caption ?? '', 'Template page caption', textLimits.pageCaption, { allowEmpty: true, trim: false }),
    customTemplate: template === 'custom' ? sanitizeCustomTemplate(page.customTemplate, { textLimits }) : null,
  };
}

function sanitizeTemplatePayload(payload, { maxPageCount, templateSlots, allowedPageThemes, textLimits, frameRadiusRange }) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.pages) || payload.pages.length === 0) {
    throw createBadRequest('Template payload is invalid.');
  }

  if (payload.pages.length > maxPageCount) {
    throw createBadRequest('Template page count exceeds the allowed maximum.');
  }

  return {
    title: sanitizeText(payload.title, 'Template folio title', textLimits.projectTitle, { allowEmpty: false, trim: false }),
    subtitle: sanitizeText(payload.subtitle ?? '', 'Template folio subtitle', textLimits.projectSubtitle, { allowEmpty: true, trim: false }),
    issue: sanitizeText(payload.issue, 'Template folio mark', textLimits.projectIssue, { allowEmpty: false, trim: false }),
    frameRadius:
      typeof payload.frameRadius === 'number' && Number.isFinite(payload.frameRadius)
        ? clamp(Math.round(payload.frameRadius), frameRadiusRange.min, frameRadiusRange.max)
        : frameRadiusRange.defaultValue,
    pages: payload.pages.map((page) => sanitizeTemplatePage(page, { templateSlots, allowedPageThemes, textLimits })),
  };
}

function sanitizeTemplateRecord(record, options) {
  if (
    !record ||
    typeof record !== 'object' ||
    typeof record.id !== 'string' ||
    typeof record.createdAt !== 'string' ||
    typeof record.updatedAt !== 'string'
  ) {
    throw createBadRequest('Template record is invalid.');
  }

  if (!TEMPLATE_ID_PATTERN.test(record.id)) {
    throw createBadRequest('Template record is invalid.');
  }

  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ownerUserId: sanitizeIdentifier(record.ownerUserId, 'Template owner', 80),
    name: sanitizeText(record.name, 'Template name', TEMPLATE_NAME_LIMIT, { allowEmpty: false, trim: true }),
    description: sanitizeText(record.description ?? '', 'Template description', TEMPLATE_DESCRIPTION_LIMIT, { allowEmpty: true, trim: true }),
    kind: sanitizeTemplateKind(record.kind),
    sourceProjectId: sanitizeIdentifier(record.sourceProjectId, 'Source project', 80, { allowEmpty: true }),
    includesCopy: record.includesCopy === true || record.preserveCopy === true,
    previewPageIndex:
      typeof record.previewPageIndex === 'number' && Number.isFinite(record.previewPageIndex) && record.previewPageIndex >= 0
        ? Math.floor(record.previewPageIndex)
        : 0,
    templatePayload: sanitizeTemplatePayload(record.templatePayload, options),
  };
}

function materializeProjectFromTemplatePayload(templatePayload, { idFactory, templateSlots, frameRadiusDefault }) {
  const payload = templatePayload;
  const pages = payload.pages.map((page, index) => {
    const slots =
      page.template === 'custom'
        ? page.customTemplate.frames.map((frame) => frame.slot)
        : templateSlots[page.template];

    return {
      id: `page-${idFactory(8)}-${index + 1}`,
      template: page.template,
      theme: page.theme,
      kicker: page.kicker,
      title: page.title,
      deck: page.deck,
      body: page.body,
      caption: page.caption,
      customTemplate: page.customTemplate,
      slots: Object.fromEntries(slots.map((slot) => [slot, null])),
      crops: Object.fromEntries(slots.map((slot) => [slot, createDefaultCrop()])),
    };
  });

  return {
    title: payload.title,
    subtitle: payload.subtitle,
    issue: payload.issue,
    frameRadius: typeof payload.frameRadius === 'number' ? payload.frameRadius : frameRadiusDefault,
    assets: [],
    pages,
  };
}

export function createUserTemplateStore({
  dataRoot,
  idFactory,
  now = () => new Date().toISOString(),
  maxPageCount,
  templateSlots,
  allowedPageThemes,
  textLimits,
  frameRadiusRange,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
} = {}) {
  const templatesDir = path.join(dataRoot, 'user-templates');
  let cachedRecords = null;
  let cachedExpiresAt = 0;

  function templatePath(templateId) {
    return path.join(templatesDir, `${templateId}.json`);
  }

  function invalidateCache() {
    cachedRecords = null;
    cachedExpiresAt = 0;
  }

  async function ensureTemplatesDirectory() {
    await fs.mkdir(templatesDir, { recursive: true });
  }

  async function writeTemplateRecord(record) {
    const filename = templatePath(record.id);
    const tempFile = `${filename}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(record, null, 2), 'utf8');
    await fs.rename(tempFile, filename);
    invalidateCache();
  }

  async function readTemplateRecord(templateId) {
    try {
      const payload = JSON.parse(await fs.readFile(templatePath(templateId), 'utf8'));
      return sanitizeTemplateRecord(payload, {
        maxPageCount,
        templateSlots,
        allowedPageThemes,
        textLimits,
        frameRadiusRange,
      });
    } catch (error) {
      if (error?.code === 'ENOENT') {
        const notFound = new Error('Template not found.');
        notFound.statusCode = 404;
        throw notFound;
      }

      throw error;
    }
  }

  async function listTemplateRecords() {
    if (cachedRecords && cachedExpiresAt > Date.now()) {
      return cachedRecords;
    }

    await ensureTemplatesDirectory();
    const entries = await fs.readdir(templatesDir, { withFileTypes: true });
    const records = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map(async (entry) =>
          sanitizeTemplateRecord(JSON.parse(await fs.readFile(path.join(templatesDir, entry.name), 'utf8')), {
            maxPageCount,
            templateSlots,
            allowedPageThemes,
            textLimits,
            frameRadiusRange,
          }),
        ),
    );

    cachedRecords = records.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    cachedExpiresAt = Date.now() + cacheTtlMs;
    return cachedRecords;
  }

  async function createTemplateRecord(payload, { ownerUserId }) {
    const timestamp = now();
    const record = {
      id: `utmpl-${idFactory(8)}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      ownerUserId: sanitizeIdentifier(ownerUserId, 'Template owner', 80),
      name: sanitizeText(payload.name, 'Template name', TEMPLATE_NAME_LIMIT, { allowEmpty: false, trim: true }),
      description: sanitizeText(payload.description ?? '', 'Template description', TEMPLATE_DESCRIPTION_LIMIT, { allowEmpty: true, trim: true }),
      kind: sanitizeTemplateKind(payload.kind),
      sourceProjectId: sanitizeIdentifier(payload.sourceProjectId, 'Source project', 80, { allowEmpty: true }),
      includesCopy: payload.includesCopy === true || payload.preserveCopy === true,
      previewPageIndex:
        typeof payload.previewPageIndex === 'number' && Number.isFinite(payload.previewPageIndex) && payload.previewPageIndex >= 0
          ? Math.floor(payload.previewPageIndex)
          : 0,
      templatePayload: sanitizeTemplatePayload(payload.templatePayload, {
        maxPageCount,
        templateSlots,
        allowedPageThemes,
        textLimits,
        frameRadiusRange,
      }),
    };

    await ensureTemplatesDirectory();
    await writeTemplateRecord(record);
    return sanitizeTemplateRecord(record, {
      maxPageCount,
      templateSlots,
      allowedPageThemes,
      textLimits,
      frameRadiusRange,
    });
  }

  async function updateTemplateRecord(templateId, patch) {
    const current = await readTemplateRecord(templateId);
    const next = {
      ...current,
      name: patch.name === undefined ? current.name : sanitizeText(patch.name, 'Template name', TEMPLATE_NAME_LIMIT, { allowEmpty: false, trim: true }),
      description:
        patch.description === undefined
          ? current.description
          : sanitizeText(patch.description, 'Template description', TEMPLATE_DESCRIPTION_LIMIT, { allowEmpty: true, trim: true }),
      kind: patch.kind === undefined ? current.kind : sanitizeTemplateKind(patch.kind),
      includesCopy:
        patch.includesCopy === undefined && patch.preserveCopy === undefined
          ? current.includesCopy
          : patch.includesCopy === true || patch.preserveCopy === true,
      previewPageIndex:
        patch.previewPageIndex === undefined
          ? current.previewPageIndex
          : typeof patch.previewPageIndex === 'number' && Number.isFinite(patch.previewPageIndex) && patch.previewPageIndex >= 0
            ? Math.floor(patch.previewPageIndex)
            : current.previewPageIndex,
      updatedAt: now(),
    };

    await writeTemplateRecord(next);
    return sanitizeTemplateRecord(next, {
      maxPageCount,
      templateSlots,
      allowedPageThemes,
      textLimits,
      frameRadiusRange,
    });
  }

  async function deleteTemplateRecord(templateId) {
    await fs.rm(templatePath(templateId), { force: true });
    invalidateCache();
  }

  async function duplicateTemplateRecord(templateId, { ownerUserId }) {
    const current = await readTemplateRecord(templateId);
    return createTemplateRecord(
      {
        name: `${current.name} Copy`.slice(0, TEMPLATE_NAME_LIMIT),
        description: current.description,
        kind: current.kind,
        includesCopy: current.includesCopy,
        previewPageIndex: current.previewPageIndex,
        sourceProjectId: current.sourceProjectId,
        templatePayload: current.templatePayload,
      },
      { ownerUserId: ownerUserId ?? current.ownerUserId },
    );
  }

  function materializeTemplateProject(templatePayload) {
    return materializeProjectFromTemplatePayload(templatePayload, {
      idFactory,
      templateSlots,
      frameRadiusDefault: frameRadiusRange.defaultValue,
    });
  }

  return {
    ensureTemplatesDirectory,
    readTemplateRecord,
    listTemplateRecords,
    createTemplateRecord,
    updateTemplateRecord,
    deleteTemplateRecord,
    duplicateTemplateRecord,
    materializeTemplateProject,
  };
}
