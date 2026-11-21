import crypto from 'node:crypto';
import dns from 'node:dns';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIP } from 'node:net';
import express from 'express';
import multer from 'multer';
import { createAccountPreferencesStore } from './accountPreferences.js';
import { createAiStore } from './ai.js';
import { createAssetStore } from './assets.js';
import { createAuthStore } from './auth.js';
import { CURRENT_TOS_VERSION, hasAcceptedCurrentTerms } from './legal.js';
import { createMailService } from './mail.js';
import { createObjectStorageStore } from './objectStorage.js';
import { createOpsStore } from './ops.js';
import { createSecurityStore } from './security.js';
import { createSiteStore } from './site.js';
import { createUserTemplateStore } from './userTemplates.js';
import { sanitizeAssetAnalysis } from './lib/assetAnalysis.js';
import { createAssetVariantService, getUploadFilenameFromPath } from './uploadVariants.js';
import { createUnalbumStore } from './unalbum.js';
import { createBadRequest, createForbidden } from './lib/httpErrors.js';

export { createBadRequest };

const DEFAULT_PORT = 3000;
const DEFAULT_DATA_ROOT = '/data';
const DEFAULT_MAX_UPLOAD_COUNT = 24;
const DEFAULT_MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_PAGE_COUNT = 48;
const DEFAULT_MAX_ASSET_COUNT = 64;
const DEFAULT_STORE_CACHE_TTL_MS = 5_000;
const DEFAULT_FRAME_RADIUS = 18;
const MIN_FRAME_RADIUS = 0;
const MAX_FRAME_RADIUS = 28;
const PROJECT_ID_PATTERN = /^[a-z0-9_-]{8,40}$/;

const dirname = path.dirname(fileURLToPath(import.meta.url));
export const defaultDistDir = path.resolve(dirname, '..', 'dist');
export const defaultTextLimits = {
  projectTitle: 80,
  projectSubtitle: 220,
  projectIssue: 40,
  assetId: 80,
  assetName: 80,
  assetNote: 160,
  pageId: 80,
  pageKicker: 48,
  pageTitle: 120,
  pageDeck: 220,
  pageBody: 1200,
  pageCaption: 220,
  customTemplateName: 48,
  customFrameLabel: 32,
};
export const templateSlots = {
  cover: ['hero'],
  essay: ['hero'],
  folio: ['hero'],
  grid: ['a', 'b', 'c', 'd'],
  diptych: ['left', 'right'],
  panorama: ['top', 'bottom'],
  mosaic: ['lead', 'top', 'bottom'],
  triptych: ['a', 'b', 'c'],
};
const allowedImageFits = new Set(['cover', 'contain']);
const allowedPageThemes = new Set([
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
]);
const defaultPageTheme = 'warm-beige';
const CUSTOM_TEMPLATE_SLOT_LIMIT = 6;

const allowedUploadTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const allowedUploadExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const SESSION_COOKIE_NAME = 'finalfolio_session';
const REGISTER_IP_RATE_LIMIT = {
  scope: 'auth-register-ip',
  limit: 3,
  windowMs: 60 * 60 * 1000,
  message: 'Too many registration attempts from this IP. Try again later.',
};
const VERIFICATION_RESEND_IP_RATE_LIMIT = {
  scope: 'auth-verification-resend-ip',
  limit: 5,
  windowMs: 60 * 60 * 1000,
  message: 'Too many verification email requests from this IP. Try again later.',
};
const PASSWORD_RESET_IP_RATE_LIMIT = {
  scope: 'auth-password-reset-ip',
  limit: 5,
  windowMs: 60 * 60 * 1000,
  message: 'Too many password reset requests from this IP. Try again later.',
};
const LOGIN_IP_RATE_LIMIT = {
  scope: 'auth-login-ip',
  limit: Number(process.env.FINALFOLIO_LOGIN_IP_LIMIT ?? 30),
  windowMs: 15 * 60 * 1000,
  message: 'Too many sign-in attempts from this network. Try again later.',
};
const LOGIN_IDENTIFIER_RATE_LIMIT = {
  scope: 'auth-login-identifier',
  limit: Number(process.env.FINALFOLIO_LOGIN_IDENTIFIER_LIMIT ?? 10),
  windowMs: 15 * 60 * 1000,
  message: 'Too many sign-in attempts for this account. Try again later.',
};
const EXPORT_EVENT_IP_RATE_LIMIT = {
  scope: 'export-event-ip',
  limit: 60,
  windowMs: 10 * 60 * 1000,
  message: 'Too many export events. Try again later.',
};
const UNALBUM_START_IP_RATE_LIMIT = {
  scope: 'unalbum-start-ip',
  limit: 20,
  windowMs: 10 * 60 * 1000,
  message: 'Too many UnAlbum sign-in attempts. Try again later.',
};
const UNALBUM_THUMB_RATE_LIMIT = {
  scope: 'unalbum-thumb-user',
  limit: 600,
  windowMs: 10 * 60 * 1000,
  message: 'Too many UnAlbum preview requests. Try again later.',
};
const UNALBUM_USER_RATE_LIMIT = {
  scope: 'unalbum-user',
  limit: 90,
  windowMs: 10 * 60 * 1000,
  message: 'Too many UnAlbum requests. Try again later.',
};
const AI_PLAN_RATE_LIMIT = {
  scope: 'ai-plan-user',
  limit: 12,
  windowMs: 10 * 60 * 1000,
  message: 'Too many AI arrangement requests. Try again later.',
};
const PUBLIC_ORIGIN_FALLBACK = 'https://finalfolio.com';
const PUBLIC_HOST_ALLOWLIST = new Set(['finalfolio.com', 'www.finalfolio.com']);

function createId(bytes = 9) {
  return crypto.randomBytes(bytes).toString('base64url').replace(/[-_]/g, '').toLowerCase();
}

export function createSharePath(projectId) {
  return `/editor/${projectId}`;
}

export function createPublicIssuePath(shareId) {
  return `/project/${shareId}`;
}


function getUserDisplayIdentity(user) {
  const username = typeof user?.username === 'string' ? user.username.trim() : '';
  if (username) {
    return username;
  }

  const email = typeof user?.email === 'string' ? user.email.trim() : '';
  return email || null;
}

function throwInvalidProject() {
  throw createBadRequest('Project payload is invalid.');
}

function sanitizeText(value, fieldName, maxLength, { allowEmpty = true, trim = false } = {}) {
  if (typeof value !== 'string') {
    throwInvalidProject();
  }

  const nextValue = trim ? value.trim() : value;
  if (!allowEmpty && nextValue.length === 0) {
    throw createBadRequest(`${fieldName} is required.`);
  }

  if (nextValue.length > maxLength) {
    throw createBadRequest(`${fieldName} exceeds the allowed length.`);
  }

  return nextValue;
}

function validateIdentifier(value, fieldName, maxLength) {
  const nextValue = sanitizeText(value, fieldName, maxLength, { allowEmpty: false, trim: true });
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(nextValue)) {
    throw createBadRequest(`${fieldName} is invalid.`);
  }

  return nextValue;
}

function validateLocalAssetPath(value) {
  const nextValue = sanitizeText(value, 'Asset path', 240, { allowEmpty: false, trim: true });
  if (nextValue.includes('..') || (!nextValue.startsWith('/uploads/') && !nextValue.startsWith('/builtins/'))) {
    throw createBadRequest('Asset path is invalid.');
  }

  return nextValue;
}

function validateAssetResourcePath(value) {
  const nextValue = sanitizeText(value, 'Asset resource path', 400, { allowEmpty: false, trim: true });
  if (nextValue.startsWith('/uploads/') || nextValue.startsWith('/builtins/')) {
    if (nextValue.includes('..')) {
      throw createBadRequest('Asset resource path is invalid.');
    }
    return nextValue;
  }

  try {
    const url = new URL(nextValue);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('invalid protocol');
    }
    return url.toString();
  } catch {
    throw createBadRequest('Asset resource path is invalid.');
  }
}

function normalizeAssetDimensions(width, height, { strict = false } = {}) {
  const hasWidth = width !== undefined;
  const hasHeight = height !== undefined;

  if (!hasWidth && !hasHeight) {
    return {};
  }

  if (
    typeof width !== 'number' ||
    !Number.isFinite(width) ||
    width <= 0 ||
    typeof height !== 'number' ||
    !Number.isFinite(height) ||
    height <= 0
  ) {
    if (strict) {
      throwInvalidProject();
    }

    return {};
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

function normalizeAssetScalar(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;
}

function sanitizeAssetVariantResource(resource) {
  if (!resource || typeof resource !== 'object') {
    return null;
  }

  if (typeof resource.src !== 'string') {
    throwInvalidProject();
  }

  return {
    src: validateAssetResourcePath(resource.src),
    ...(normalizeAssetDimensions(resource.width, resource.height) ?? {}),
    ...(normalizeAssetScalar(resource.bytes) !== undefined ? { bytes: normalizeAssetScalar(resource.bytes) } : {}),
    ...(typeof resource.mimeType === 'string' && resource.mimeType.trim() ? { mimeType: resource.mimeType.trim() } : {}),
  };
}

function sanitizeAssetVariants(variants) {
  if (!variants || typeof variants !== 'object') {
    return undefined;
  }

  return {
    ...(sanitizeAssetVariantResource(variants.original) ? { original: sanitizeAssetVariantResource(variants.original) } : {}),
    ...(variants.preview === null
      ? { preview: null }
      : sanitizeAssetVariantResource(variants.preview)
        ? { preview: sanitizeAssetVariantResource(variants.preview) }
        : {}),
    ...(variants.thumb === null
      ? { thumb: null }
      : sanitizeAssetVariantResource(variants.thumb)
        ? { thumb: sanitizeAssetVariantResource(variants.thumb) }
        : {}),
  };
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...valueParts] = part.split('=');
        return [name, decodeURIComponent(valueParts.join('='))];
      }),
  );
}

function isSecureCookieEnabled() {
  return process.env.NODE_ENV === 'production' || process.env.FINALFOLIO_COOKIE_SECURE === 'true';
}

function serializeSessionCookie(value) {
  const secure = isSecureCookieEnabled() ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
    30 * 24 * 60 * 60
  }${secure}`;
}

function serializeClearedSessionCookie() {
  const secure = isSecureCookieEnabled() ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function resolvePublicOrigin(request) {
  const configuredOrigin = String(process.env.FINALFOLIO_PUBLIC_ORIGIN ?? '').trim();
  if (configuredOrigin) {
    try {
      const url = new URL(configuredOrigin);
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        return url.origin;
      }
    } catch {
      // Fall through to the request-derived origin.
    }
  }

  const protocolHeader = String(request.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
  const hostHeader = String(request.headers['x-forwarded-host'] ?? request.headers.host ?? '').split(',')[0].trim();
  const protocol = protocolHeader === 'http' ? 'http' : 'https';
  const host = hostHeader || 'finalfolio.com';
  const hostname = host.replace(/:\d+$/, '').toLowerCase();

  // Never let a forged Host/X-Forwarded-Host turn an emailed reset link into a link to
  // an attacker-controlled domain.
  if (!PUBLIC_HOST_ALLOWLIST.has(hostname) && !hostname.endsWith('.localhost') && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return PUBLIC_ORIGIN_FALLBACK;
  }

  return `${protocol}://${host}`;
}

function resolveClientIp(request) {
  const forwardedFor = String(request.headers['x-forwarded-for'] ?? '')
    .split(',')[0]
    .trim();
  const requestIp = typeof request.ip === 'string' ? request.ip.trim() : '';
  const remoteAddress = typeof request.socket?.remoteAddress === 'string' ? request.socket.remoteAddress.trim() : '';
  const value = forwardedFor || requestIp || remoteAddress || 'unknown';
  return value.startsWith('::ffff:') ? value.slice(7) : value;
}

function normalizeTemplate(template) {
  const nextValue = sanitizeText(template, 'Template', 32, { allowEmpty: false, trim: true });
  if (nextValue !== 'custom' && !(nextValue in templateSlots)) {
    throwInvalidProject();
  }

  return nextValue;
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
    throwInvalidProject();
  }

  const x = area.x;
  const y = area.y;
  const width = area.width;
  const height = area.height;

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    x < 0 ||
    y < 0 ||
    x > 100 ||
    y > 100 ||
    width < 12 ||
    height < 12 ||
    x + width > 100 ||
    y + height > 100
  ) {
    throwInvalidProject();
  }

  return { x, y, width, height };
}

function sanitizeCustomTemplate(customTemplate) {
  if (!customTemplate || typeof customTemplate !== 'object' || !Array.isArray(customTemplate.frames) || !customTemplate.frames.length) {
    throwInvalidProject();
  }

  if (customTemplate.frames.length > CUSTOM_TEMPLATE_SLOT_LIMIT) {
    throwInvalidProject();
  }

  const usedSlots = new Set();
  const frames = customTemplate.frames.map((frame, index) => {
    if (!frame || typeof frame !== 'object') {
      throwInvalidProject();
    }

    const slot = sanitizeText(frame.slot, 'Custom frame slot', 32, { allowEmpty: false, trim: true }).toLowerCase();
    if (!/^frame\d+$/.test(slot) || usedSlots.has(slot)) {
      throwInvalidProject();
    }

    usedSlots.add(slot);

    return {
      slot,
      label:
        sanitizeText(frame.label, 'Custom frame label', defaultTextLimits.customFrameLabel, {
          allowEmpty: false,
          trim: true,
        }) || `Frame ${index + 1}`,
      ...sanitizeLayoutArea(frame),
    };
  });

  return {
    name: sanitizeText(customTemplate.name, 'Custom template name', defaultTextLimits.customTemplateName, {
      allowEmpty: false,
      trim: true,
    }),
    text: sanitizeLayoutArea(customTemplate.text),
    frames,
  };
}

function resolveTemplateSlots(template, customTemplate) {
  if (template === 'custom') {
    return customTemplate.frames.map((frame) => frame.slot);
  }

  return templateSlots[template];
}

export function sanitizeProjectId(projectId) {
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw createBadRequest('Invalid project identifier.');
  }

  return projectId;
}

function sanitizeAsset(asset) {
  if (!asset || typeof asset !== 'object') {
    throwInvalidProject();
  }

  return {
    id: validateIdentifier(asset.id, 'Asset identifier', defaultTextLimits.assetId),
    name: sanitizeText(asset.name, 'Asset name', defaultTextLimits.assetName, { allowEmpty: false, trim: true }),
    src: validateLocalAssetPath(asset.src),
    note: sanitizeText(asset.note, 'Asset note', defaultTextLimits.assetNote, { trim: true }),
    builtIn: asset.builtIn === true,
    ...(typeof asset.unalbumId === 'string' && asset.unalbumId.trim()
      ? { unalbumId: asset.unalbumId.trim().slice(0, 120) }
      : {}),
    ...(sanitizeAssetAnalysis(asset.analysis) ? { analysis: sanitizeAssetAnalysis(asset.analysis) } : {}),
    ...(normalizeAssetScalar(asset.bytes) !== undefined ? { bytes: normalizeAssetScalar(asset.bytes) } : {}),
    ...(typeof asset.mimeType === 'string' && asset.mimeType.trim() ? { mimeType: asset.mimeType.trim() } : {}),
    ...(sanitizeAssetVariants(asset.variants) ? { variants: sanitizeAssetVariants(asset.variants) } : {}),
    ...(typeof asset.lastUsedAt === 'string' ? { lastUsedAt: asset.lastUsedAt } : {}),
    ...normalizeAssetDimensions(asset.width, asset.height, { strict: true }),
  };
}

function sanitizeCropSettings(expectedSlots, crops) {
  if (!crops || typeof crops !== 'object') {
    throwInvalidProject();
  }

  const providedSlots = Object.keys(crops);
  if (providedSlots.length !== expectedSlots.length || !expectedSlots.every((slot) => providedSlots.includes(slot))) {
    throwInvalidProject();
  }

  return Object.fromEntries(
    expectedSlots.map((slot) => {
      const crop = crops[slot];
      if (
        !crop ||
        typeof crop !== 'object' ||
        typeof crop.x !== 'number' ||
        typeof crop.y !== 'number' ||
        typeof crop.scale !== 'number' ||
        crop.x < 0 ||
        crop.x > 100 ||
        crop.y < 0 ||
        crop.y > 100 ||
        crop.scale < 1 ||
        crop.scale > 2.2 ||
        (crop.fit !== undefined && !allowedImageFits.has(crop.fit))
      ) {
        throwInvalidProject();
      }

      return [slot, { x: crop.x, y: crop.y, scale: crop.scale, fit: crop.fit === 'contain' ? 'contain' : 'cover' }];
    }),
  );
}

function sanitizePageTheme(theme) {
  if (theme === undefined) {
    return defaultPageTheme;
  }

  if (typeof theme !== 'string' || !allowedPageThemes.has(theme)) {
    throwInvalidProject();
  }

  return theme;
}

const PROJECT_FONT_IDS = new Set([
  'default',
  'serif-cn',
  'sans-cn',
  'wenkai',
  'mashanzheng',
  'zhimangxing',
  'longcang',
  'smileysans',
]);
const LEGACY_PROJECT_FONT_IDS = {
  'default-display': 'default',
  'default-ui': 'default',
  inherit: 'default',
  'kai-cn': 'wenkai',
  'newsreader': 'default',
  inter: 'sans-cn',
};
const DEFAULT_PROJECT_FONTS = { title: 'default', deck: 'default', caption: 'default', body: 'default' };

function sanitizeProjectFonts(fonts) {
  const source = fonts && typeof fonts === 'object' ? fonts : {};
  const pick = (value, fallback) => {
    const normalized =
      typeof value === 'string' && LEGACY_PROJECT_FONT_IDS[value] ? LEGACY_PROJECT_FONT_IDS[value] : value;
    return typeof normalized === 'string' && PROJECT_FONT_IDS.has(normalized) ? normalized : fallback;
  };
  return {
    title: pick(source.title, DEFAULT_PROJECT_FONTS.title),
    deck: pick(source.deck, DEFAULT_PROJECT_FONTS.deck),
    caption: pick(source.caption, DEFAULT_PROJECT_FONTS.caption),
    body: pick(source.body, DEFAULT_PROJECT_FONTS.body),
  };
}

function sanitizeFrameRadius(frameRadius) {
  if (frameRadius === undefined) {
    return DEFAULT_FRAME_RADIUS;
  }

  if (typeof frameRadius !== 'number' || !Number.isFinite(frameRadius)) {
    throwInvalidProject();
  }

  return Math.min(MAX_FRAME_RADIUS, Math.max(MIN_FRAME_RADIUS, Math.round(frameRadius)));
}

function sanitizeSlots(expectedSlots, slots, assetIds) {
  if (!slots || typeof slots !== 'object') {
    throwInvalidProject();
  }

  const providedSlots = Object.keys(slots);
  if (providedSlots.length !== expectedSlots.length || !expectedSlots.every((slot) => providedSlots.includes(slot))) {
    throwInvalidProject();
  }

  return Object.fromEntries(
    expectedSlots.map((slot) => {
      const assetId = slots[slot];
      if (assetId !== null && (typeof assetId !== 'string' || !assetIds.has(assetId))) {
        throwInvalidProject();
      }

      return [slot, assetId];
    }),
  );
}

function sanitizePage(page, assetIds, pageIds) {
  if (!page || typeof page !== 'object') {
    throwInvalidProject();
  }

  const template = normalizeTemplate(page.template);
  const customTemplate = template === 'custom' ? sanitizeCustomTemplate(page.customTemplate) : null;
  const expectedSlots = resolveTemplateSlots(template, customTemplate);
  const pageId = validateIdentifier(page.id, 'Page identifier', defaultTextLimits.pageId);
  if (pageIds.has(pageId)) {
    throw createBadRequest('Page identifiers must be unique.');
  }
  pageIds.add(pageId);

  return {
    id: pageId,
    template,
    theme: sanitizePageTheme(page.theme),
    kicker: sanitizeText(page.kicker, 'Page kicker', defaultTextLimits.pageKicker, { trim: true }),
    title: sanitizeText(page.title, 'Page title', defaultTextLimits.pageTitle, { allowEmpty: false, trim: true }),
    deck: sanitizeText(page.deck, 'Page deck', defaultTextLimits.pageDeck, { trim: true }),
    body: sanitizeText(page.body, 'Page body', defaultTextLimits.pageBody, { trim: true }),
    caption: sanitizeText(page.caption, 'Page caption', defaultTextLimits.pageCaption, { trim: true }),
    customTemplate,
    slots: sanitizeSlots(expectedSlots, page.slots, assetIds),
    crops: sanitizeCropSettings(expectedSlots, page.crops),
  };
}

export function sanitizeProjectState(payload, { maxPageCount = DEFAULT_MAX_PAGE_COUNT, maxAssetCount = DEFAULT_MAX_ASSET_COUNT } = {}) {
  const project = payload?.project ?? payload;
  if (!project || typeof project !== 'object') {
    throwInvalidProject();
  }

  if (!Array.isArray(project.assets) || !Array.isArray(project.pages) || project.pages.length === 0) {
    throwInvalidProject();
  }

  if (project.assets.length > maxAssetCount) {
    throw createBadRequest('Too many assets in one project.');
  }

  if (project.pages.length > maxPageCount) {
    throw createBadRequest('Too many pages in one project.');
  }

  const pageIds = new Set();
  const assets = project.assets.map(sanitizeAsset);
  const assetIds = new Set();
  assets.forEach((asset) => {
    if (assetIds.has(asset.id)) {
      throw createBadRequest('Asset identifiers must be unique.');
    }
    assetIds.add(asset.id);
  });

  return {
    title: sanitizeText(project.title, 'Project title', defaultTextLimits.projectTitle, { allowEmpty: false, trim: true }),
    subtitle: sanitizeText(project.subtitle, 'Project subtitle', defaultTextLimits.projectSubtitle, { trim: true }),
    issue: sanitizeText(project.issue, 'Folio mark', defaultTextLimits.projectIssue, { allowEmpty: false, trim: true }),
    frameRadius: sanitizeFrameRadius(project.frameRadius),
    fonts: sanitizeProjectFonts(project.fonts),
    assets,
    pages: project.pages.map((page) => sanitizePage(page, assetIds, pageIds)),
  };
}

function sanitizeProjectShare(share) {
  const shareId = typeof share?.shareId === 'string' && PROJECT_ID_PATTERN.test(share.shareId) ? share.shareId : null;
  const shareEnabled = share?.shareEnabled === true && Boolean(shareId);
  const shareVersion =
    typeof share?.shareVersion === 'number' && Number.isFinite(share.shareVersion) && share.shareVersion >= 0
      ? Math.round(share.shareVersion)
      : shareId
        ? 1
        : 0;

  return {
    shareId,
    shareEnabled,
    sharedAt: typeof share?.sharedAt === 'string' ? share.sharedAt : null,
    shareVersion,
  };
}

function sanitizeArchivedAt(value) {
  return typeof value === 'string' ? value : null;
}

function serializeProjectShare(share) {
  const normalized = sanitizeProjectShare(share);
  return {
    id: normalized.shareId,
    enabled: normalized.shareEnabled,
    path: normalized.shareEnabled && normalized.shareId ? createPublicIssuePath(normalized.shareId) : null,
    sharedAt: normalized.sharedAt,
    version: normalized.shareVersion,
  };
}

export function serializeProjectRecord(record) {
  return {
    id: record.id,
    rev: Number.isInteger(record.rev) && record.rev >= 0 ? record.rev : 0,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archivedAt: sanitizeArchivedAt(record.archivedAt),
    ownerUserId: typeof record.ownerUserId === 'string' ? record.ownerUserId : null,
    sharePath: createSharePath(record.id),
    share: serializeProjectShare(record.share),
    project: record.project,
  };
}

/**
 * Browsers send multipart filenames as raw UTF-8 bytes, but Busboy/multer
 * decodes that header as latin1. Left alone, a photo called 晨雾.jpg is stored
 * as mojibake. Recover the UTF-8 reading when it round-trips cleanly, and keep
 * the original string otherwise (a genuinely latin1 name).
 */
export function decodeMultipartFilename(value) {
  const name = typeof value === 'string' ? value : '';
  if (!name || /[^\u0000-\u00ff]/.test(name)) {
    return name;
  }
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? name : decoded;
}

export function createUploadFilename(originalName = '', { idFactory = createId } = {}) {
  const extension = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, '');
  const safeExtension = extension.length > 1 ? extension : '.png';
  return `${Date.now()}-${idFactory(6)}${safeExtension}`;
}

function resolveUploadTimestamp(filename, stats) {
  const match = /^(\d{11,})-/.exec(filename);
  if (match) {
    return new Date(Number(match[1])).toISOString();
  }

  const fallbackMs = Number.isFinite(stats?.birthtimeMs) && stats.birthtimeMs > 0 ? stats.birthtimeMs : stats?.mtimeMs;
  return new Date(fallbackMs || Date.now()).toISOString();
}

const imageMagicMatchers = [
  { mime: 'image/jpeg', test: (bytes) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  {
    mime: 'image/png',
    test: (bytes) =>
      bytes.length > 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  { mime: 'image/gif', test: (bytes) => bytes.length > 4 && bytes.subarray(0, 4).toString('latin1') === 'GIF8' },
  {
    mime: 'image/webp',
    test: (bytes) =>
      bytes.length > 12 &&
      bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
      bytes.subarray(8, 12).toString('latin1') === 'WEBP',
  },
  {
    mime: 'image/avif',
    test: (bytes) =>
      bytes.length > 16 &&
      bytes.subarray(4, 8).toString('latin1') === 'ftyp' &&
      ['avif', 'avis'].includes(bytes.subarray(8, 12).toString('latin1')),
  },
];

async function assertReadableImageFile(file) {
  const handle = await fs.open(file.path, 'r');
  try {
    const header = Buffer.alloc(32);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const bytes = header.subarray(0, bytesRead);
    const matched = imageMagicMatchers.find((matcher) => matcher.test(bytes));
    if (!matched || !allowedUploadTypes.has(matched.mime)) {
      throw createBadRequest('This file is not a readable JPG, PNG, WebP, GIF, or AVIF image.');
    }
  } finally {
    await handle.close();
  }
}

function mapImageProcessingError(error) {
  if (error?.statusCode) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/ffmpeg|ffprobe|Invalid data|moov atom|decode/i.test(message)) {
    const mapped = new Error('This image could not be processed. Try exporting it again as JPG or PNG.');
    mapped.statusCode = 400;
    return mapped;
  }

  return error;
}

/**
 * URL import guard: only public http/https origins may be fetched. Each hop
 * (the original URL plus up to three redirects) must resolve to addresses
 * outside loopback, link-local, private, and other non-routable ranges so the
 * endpoint cannot be used to reach internal services.
 */
function assertPublicImportAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const parts = address.split('.').map((part) => Number(part));
    const [a, b] = parts;
    const blocked =
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224;
    if (blocked) {
      throw createBadRequest('Only public image URLs can be imported.');
    }
    return;
  }

  if (family === 6) {
    const value = address.toLowerCase();
    const firstHextet = value.split(':')[0];

    if (value === '::' || value === '::1') {
      throw createBadRequest('Only public image URLs can be imported.');
    }

    // IPv4-mapped / IPv4-compatible addresses re-use the IPv4 rules.
    const mappedMatch = /(?:^|:)((?:\d{1,3}\.){3}\d{1,3})$/.exec(value);
    if (mappedMatch) {
      assertPublicImportAddress(mappedMatch[1]);
      return;
    }

    const secondHextet = value.split(':')[1] ?? '';
    const blocked =
      firstHextet === 'fe8' ||
      firstHextet === 'fe9' ||
      firstHextet === 'fea' ||
      firstHextet === 'feb' || // link-local fe80::/10
      firstHextet === 'fc' ||
      firstHextet === 'fd' || // unique local fc00::/7
      (firstHextet === '2001' && (secondHextet === 'db8' || secondHextet === '0')) || // docs / Teredo
      firstHextet === '0';
    if (blocked) {
      throw createBadRequest('Only public image URLs can be imported.');
    }
    return;
  }

  throw createBadRequest('Only public image URLs can be imported.');
}

async function assertPublicImportUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw createBadRequest('This URL is invalid.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw createBadRequest('Only http and https URLs can be imported.');
  }

  const credentials = `${parsed.username}${parsed.password}`;
  if (credentials) {
    throw createBadRequest('Only public image URLs can be imported.');
  }

  const lookup = await dns.promises.lookup(parsed.hostname, { all: true, verbatim: true }).catch(() => null);
  const addresses = lookup && lookup.length ? lookup : [{ address: parsed.hostname }];
  for (const entry of addresses) {
    assertPublicImportAddress(entry.address);
  }

  return parsed;
}

async function downloadImageFromUrl(rawUrl, { maxBytes, uploadsDir, idFactory }) {
  let currentUrl = await assertPublicImportUrl(rawUrl);
  let response = null;

  for (let hop = 0; hop < 4; hop += 1) {
    response = await fetch(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
      headers: { accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/*;q=0.8' },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.arrayBuffer().catch(() => null);
      if (!location) {
        throw createBadRequest('This URL could not be downloaded.');
      }
      currentUrl = await assertPublicImportUrl(new URL(location, currentUrl).toString());
      continue;
    }
    break;
  }

  if (!response || !response.ok) {
    throw createBadRequest('This URL could not be downloaded.');
  }

  const declaredLength = Number(response.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw createBadRequest('This image is too large to import from a URL.');
  }

  const chunks = [];
  let totalBytes = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => null);
      throw createBadRequest('This image is too large to import from a URL.');
    }
    chunks.push(Buffer.from(value));
  }

  const buffer = Buffer.concat(chunks);
  if (totalBytes === 0) {
    throw createBadRequest('This URL returned an empty response.');
  }

  const matched = imageMagicMatchers.find((matcher) => matcher.test(buffer));
  if (!matched || !allowedUploadTypes.has(matched.mime)) {
    throw createBadRequest('This file is not a readable JPG, PNG, WebP, GIF, or AVIF image.');
  }

  const extensionByMime = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
  };
  const extension = extensionByMime[matched.mime];
  const sourceName = path.basename(new URL(currentUrl).pathname).replace(/[^.a-zA-Z0-9_-]/g, '').slice(0, 60);
  const filename = createUploadFilename(sourceName ? `${sourceName}${extension}` : `import${extension}`, {
    idFactory,
  });
  const targetPath = path.join(uploadsDir, filename);
  await fs.writeFile(targetPath, buffer, { mode: 0o600 });

  const displayName = sourceName ? `${sourceName}${extension}` : filename;

  return {
    file: {
      path: targetPath,
      filename,
      originalname: displayName,
      mimetype: matched.mime,
    },
    bytes: totalBytes,
  };
}

/**
 * Downloads one image from UnAlbum's API/CDN. Unlike generic URL import this
 * allows an Authorization header (the API hands out token-protected variants)
 * but *only* to UnAlbum's own origin, and it never forwards the token to a
 * storage origin. Everything else reuses the same size and magic-byte checks
 * as a normal upload.
 */
async function downloadUnalbumImage(rawUrl, { accessToken, authOrigin, allowedOrigins, maxBytes, uploadsDir, suggestedName, idFactory }) {
  let currentUrl;
  try {
    currentUrl = new URL(String(rawUrl ?? '').trim());
  } catch {
    throw createBadRequest('UnAlbum returned an invalid image URL.');
  }

  if (currentUrl.protocol !== 'http:' && currentUrl.protocol !== 'https:') {
    throw createBadRequest('UnAlbum returned an unsupported image URL.');
  }
  if (currentUrl.username || currentUrl.password) {
    throw createBadRequest('UnAlbum returned an unsupported image URL.');
  }

  let response = null;
  for (let hop = 0; hop < 4; hop += 1) {
    if (!allowedOrigins.has(currentUrl.origin)) {
      throw createBadRequest('UnAlbum returned an image URL outside its storage origins.');
    }
    const headers = {
      accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/*;q=0.8',
    };
    if (accessToken && authOrigin && currentUrl.origin === authOrigin) {
      headers.authorization = `Bearer ${accessToken}`;
    }
    response = await fetch(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.arrayBuffer().catch(() => null);
      if (!location) {
        throw createBadRequest('This UnAlbum photo could not be downloaded.');
      }
      currentUrl = new URL(location, currentUrl);
      continue;
    }
    break;
  }

  if (!response || !response.ok) {
    throw createBadRequest('This UnAlbum photo could not be downloaded.');
  }

  const declaredLength = Number(response.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw createBadRequest('This UnAlbum photo is too large to import.');
  }

  const chunks = [];
  let totalBytes = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => null);
      throw createBadRequest('This UnAlbum photo is too large to import.');
    }
    chunks.push(Buffer.from(value));
  }

  const buffer = Buffer.concat(chunks);
  if (!totalBytes) {
    throw createBadRequest('This UnAlbum photo returned an empty response.');
  }

  const matched = imageMagicMatchers.find((matcher) => matcher.test(buffer));
  if (!matched || !allowedUploadTypes.has(matched.mime)) {
    throw createBadRequest('This UnAlbum file is not a readable JPG, PNG, WebP, GIF, or AVIF image.');
  }

  const extensionByMime = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
  };
  const safeName = String(suggestedName ?? '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 60);
  const extension = extensionByMime[matched.mime];
  const sourceName = safeName ? safeName.replace(/\.[a-z0-9]+$/i, '') : 'unalbum-photo';
  const filename = createUploadFilename(`${sourceName}${extension}`, { idFactory });
  const targetPath = path.join(uploadsDir, filename);
  await fs.writeFile(targetPath, buffer, { mode: 0o600 });

  return {
    file: {
      path: targetPath,
      filename,
      originalname: `${sourceName}${extension}`,
      mimetype: matched.mime,
      size: totalBytes,
    },
  };
}

export function validateUploadFile(file) {
  const extension = path.extname(file?.originalname ?? '').toLowerCase();
  if (!allowedUploadTypes.has(file?.mimetype) || !allowedUploadExtensions.has(extension)) {
    throw createBadRequest('Upload JPG, PNG, WebP, GIF, or AVIF images only.');
  }
}

export function createProjectStore({
  dataRoot = process.env.FINALFOLIO_DATA_ROOT ?? DEFAULT_DATA_ROOT,
  maxPageCount = Number(process.env.FINALFOLIO_MAX_PAGE_COUNT ?? DEFAULT_MAX_PAGE_COUNT),
  maxAssetCount = Number(process.env.FINALFOLIO_MAX_ASSET_COUNT ?? DEFAULT_MAX_ASSET_COUNT),
  idFactory = createId,
  now = () => new Date().toISOString(),
  cacheTtlMs = DEFAULT_STORE_CACHE_TTL_MS,
  objectStorageStore = null,
} = {}) {
  const projectsDir = path.join(dataRoot, 'projects');
  const uploadsDir = path.join(dataRoot, 'uploads');
  const assetVariantService = createAssetVariantService({ uploadsDir });
  let cachedProjectRecords = null;
  let cachedProjectRecordsExpiresAt = 0;
  let cachedUploadInventory = null;
  let cachedUploadInventoryExpiresAt = 0;

  function createProjectFilePath(projectId) {
    return path.join(projectsDir, `${sanitizeProjectId(projectId)}.json`);
  }

  function invalidateProjectRecordCache() {
    cachedProjectRecords = null;
    cachedProjectRecordsExpiresAt = 0;
  }

  function invalidateUploadInventoryCache() {
    cachedUploadInventory = null;
    cachedUploadInventoryExpiresAt = 0;
  }

  function invalidateStoreCaches() {
    invalidateProjectRecordCache();
    invalidateUploadInventoryCache();
  }

  async function ensureDataDirectories() {
    await fs.mkdir(projectsDir, { recursive: true });
    await fs.mkdir(uploadsDir, { recursive: true });
  }

  async function writeProjectRecord(record) {
    const filename = createProjectFilePath(record.id);
    const tempFile = `${filename}.tmp`;
    const payload = JSON.stringify(record, null, 2);
    await fs.writeFile(tempFile, payload, 'utf8');
    await fs.rename(tempFile, filename);
    invalidateStoreCaches();
  }

  async function readProjectRecord(projectId) {
    const filename = createProjectFilePath(projectId);

    try {
      const payload = await fs.readFile(filename, 'utf8');
      const record = JSON.parse(payload);

      if (
        !record ||
        typeof record !== 'object' ||
        typeof record.id !== 'string' ||
        typeof record.createdAt !== 'string' ||
        typeof record.updatedAt !== 'string'
      ) {
        throw new Error('Stored project is invalid.');
      }

      return {
        id: record.id,
        rev: Number.isInteger(record.rev) && record.rev >= 0 ? record.rev : 0,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        archivedAt: sanitizeArchivedAt(record.archivedAt),
        ownerUserId: typeof record.ownerUserId === 'string' ? record.ownerUserId : null,
        share: sanitizeProjectShare(record.share),
        project: sanitizeProjectState(record.project, { maxPageCount, maxAssetCount }),
      };
    } catch (error) {
      if (error?.code === 'ENOENT') {
        const notFound = new Error('Project not found.');
        notFound.statusCode = 404;
        throw notFound;
      }

      throw error;
    }
  }

  async function createProjectRecord(payload, { ownerUserId = null } = {}) {
    const project = sanitizeProjectState(payload, { maxPageCount, maxAssetCount });
    const timestamp = now();
    const record = {
      id: idFactory(9),
      rev: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
      ownerUserId: typeof ownerUserId === 'string' ? ownerUserId : null,
      share: sanitizeProjectShare(null),
      project,
    };

    await writeProjectRecord(record);
    return record;
  }

  async function updateProjectRecord(projectId, payload) {
    const sanitizedProjectId = sanitizeProjectId(projectId);
    const existingRecord = await readProjectRecord(sanitizedProjectId);
    const project = sanitizeProjectState(payload, { maxPageCount, maxAssetCount });
    const nextRecord = {
      ...existingRecord,
      rev: (existingRecord.rev ?? 0) + 1,
      updatedAt: now(),
      project,
      archivedAt: sanitizeArchivedAt(existingRecord.archivedAt),
    };

    await writeProjectRecord(nextRecord);
    return nextRecord;
  }

  async function patchProjectRecord(projectId, patch = {}) {
    const sanitizedProjectId = sanitizeProjectId(projectId);
    const existingRecord = await readProjectRecord(sanitizedProjectId);
    const timestamp = now();
    const projectPatch = patch.project && typeof patch.project === 'object' ? patch.project : {};
    const nextProject = {
      ...existingRecord.project,
      ...(projectPatch.title !== undefined ? { title: sanitizeText(projectPatch.title, 'Project title', defaultTextLimits.projectTitle, { allowEmpty: false, trim: true }) } : {}),
      ...(projectPatch.subtitle !== undefined ? { subtitle: sanitizeText(projectPatch.subtitle, 'Project subtitle', defaultTextLimits.projectSubtitle, { trim: true }) } : {}),
      ...(projectPatch.issue !== undefined ? { issue: sanitizeText(projectPatch.issue, 'Folio mark', defaultTextLimits.projectIssue, { allowEmpty: false, trim: true }) } : {}),
      ...(projectPatch.frameRadius !== undefined ? { frameRadius: sanitizeFrameRadius(projectPatch.frameRadius) } : {}),
      ...(projectPatch.fonts !== undefined ? { fonts: sanitizeProjectFonts(projectPatch.fonts) } : {}),
    };
    const nextRecord = {
      ...existingRecord,
      rev: (existingRecord.rev ?? 0) + 1,
      updatedAt: timestamp,
      archivedAt:
        patch.archivedAt === undefined
          ? sanitizeArchivedAt(existingRecord.archivedAt)
          : patch.archivedAt === null
            ? null
            : timestamp,
      project: nextProject,
    };

    await writeProjectRecord(nextRecord);
    return nextRecord;
  }

  async function listProjectRecords() {
    if (cachedProjectRecords && cachedProjectRecordsExpiresAt > Date.now()) {
      return cachedProjectRecords;
    }

    await ensureDataDirectories();
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    const records = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => readProjectRecord(entry.name.slice(0, -'.json'.length))),
    );

    cachedProjectRecords = records.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    cachedProjectRecordsExpiresAt = Date.now() + cacheTtlMs;
    return cachedProjectRecords;
  }

  async function deleteProjectRecord(projectId) {
    const sanitizedProjectId = sanitizeProjectId(projectId);
    await fs.rm(createProjectFilePath(sanitizedProjectId), { force: true });
    invalidateStoreCaches();
  }

  async function updateProjectShareRecord(projectId, { enable = true, rotate = false } = {}) {
    const sanitizedProjectId = sanitizeProjectId(projectId);
    const existingRecord = await readProjectRecord(sanitizedProjectId);
    const currentShare = sanitizeProjectShare(existingRecord.share);

    if (enable && currentShare.shareEnabled && currentShare.shareId && !rotate) {
      return existingRecord;
    }

    const timestamp = now();
    const nextShare = enable
      ? {
          shareId: idFactory(12),
          shareEnabled: true,
          sharedAt: timestamp,
          shareVersion: Math.max(0, currentShare.shareVersion) + 1,
        }
      : {
          ...currentShare,
          shareEnabled: false,
        };
    const nextRecord = {
      ...existingRecord,
      rev: (existingRecord.rev ?? 0) + 1,
      updatedAt: timestamp,
      share: nextShare,
    };

    await writeProjectRecord(nextRecord);
    return nextRecord;
  }

  async function readProjectRecordByShareId(shareId) {
    const normalizedShareId = sanitizeProjectId(shareId);
    const records = await listProjectRecords();
    const record = records.find((entry) => sanitizeProjectShare(entry.share).shareId === normalizedShareId);

    if (!record || !sanitizeProjectShare(record.share).shareEnabled) {
      const notFound = new Error('Shared folio not found.');
      notFound.statusCode = 404;
      throw notFound;
    }

    return record;
  }

  async function readProjectUploadReferences() {
    const references = new Map();
    const records = await listProjectRecords();

    for (const record of records) {
      record.project.assets.forEach((asset) => {
        const filename = getUploadFilenameFromPath(asset.src);
        if (!filename) {
          return;
        }

        if (!references.has(filename)) {
          references.set(filename, new Set());
        }

        references.get(filename).add(record.id);
      });
    }

    return references;
  }

  async function getUploadArtifacts(filename, { ensureVariants = false, originalWidth, originalHeight } = {}) {
    if (ensureVariants) {
      await assetVariantService.ensureUploadVariants(filename);
    }

    const resources = await assetVariantService.readUploadResources(filename, {
      originalWidth,
      originalHeight,
    });

    return {
      filename,
      originalPath: path.join(uploadsDir, filename),
      previewPath: path.join(uploadsDir, 'variants', filename, 'preview.webp'),
      thumbPath: path.join(uploadsDir, 'variants', filename, 'thumb.webp'),
      resources,
    };
  }

  async function hydrateStoredUploadAsset(asset, { ensureVariants = false } = {}) {
    const filename = getUploadFilenameFromPath(asset?.src);
    if (!filename) {
      return asset;
    }

    const originalPath = path.join(uploadsDir, filename);
    const probedDimensions =
      typeof asset.width === 'number' && typeof asset.height === 'number'
        ? null
        : await assetVariantService.probeImageDimensions(originalPath);

    if (ensureVariants) {
      await assetVariantService.ensureUploadVariants(filename);
    }

    const originalWidth = typeof asset.width === 'number' ? asset.width : probedDimensions?.width;
    const originalHeight = typeof asset.height === 'number' ? asset.height : probedDimensions?.height;
    const artifacts = await getUploadArtifacts(filename, {
      ensureVariants,
      originalWidth,
      originalHeight,
    });
    if (!artifacts?.resources) {
      return asset;
    }

    const syncEntry = objectStorageStore ? await objectStorageStore.readSyncEntry(filename) : null;
    const objectStorageEnabled = objectStorageStore ? (await objectStorageStore.readConfig()).enabled === true : false;
    const resources = syncEntry ? objectStorageStore.buildRemoteResources(syncEntry, artifacts.resources) : artifacts.resources;

    return {
      ...asset,
      ...(originalWidth ? { width: originalWidth } : {}),
      ...(originalHeight ? { height: originalHeight } : {}),
      ...(typeof asset.bytes === 'number' ? { bytes: asset.bytes } : resources.original.bytes ? { bytes: resources.original.bytes } : {}),
      ...(typeof asset.mimeType === 'string' ? { mimeType: asset.mimeType } : resources.original.mimeType ? { mimeType: resources.original.mimeType } : {}),
      variants: {
        original: resources.original,
        preview: resources.preview,
        thumb: resources.thumb,
      },
      ...(objectStorageStore
        ? {
            delivery: objectStorageStore.buildDeliveryStatus(syncEntry, {
              enabled: objectStorageEnabled,
            }),
          }
        : {}),
    };
  }

  async function collectUploadInventory({ nowMs = Date.parse(now()) || Date.now() } = {}) {
    if (cachedUploadInventory && cachedUploadInventoryExpiresAt > Date.now()) {
      return cachedUploadInventory;
    }

    await ensureDataDirectories();

    const [entries, references] = await Promise.all([fs.readdir(uploadsDir, { withFileTypes: true }), readProjectUploadReferences()]);
    const objectStorageConfig = objectStorageStore ? await objectStorageStore.readConfig().catch(() => null) : null;
    const objectStorageEnabled = objectStorageConfig?.enabled === true;
    const syncEntriesByFilename = objectStorageStore ? (await objectStorageStore.readSyncIndex()).uploads : {};
    const filenames = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
    const filenameSet = new Set(filenames);
    const items = await Promise.all(
      filenames.map(async (filename) => {
        const filePath = path.join(uploadsDir, filename);
        const stats = await fs.stat(filePath);
        const uploadedAt = resolveUploadTimestamp(filename, stats);
        const uploadedAtMs = Date.parse(uploadedAt) || nowMs;
        const referencedByProjectIds = Array.from(references.get(filename) ?? []).sort();
        const artifacts = await getUploadArtifacts(filename);
        const syncEntry = syncEntriesByFilename[filename] ?? null;
        const resources =
          syncEntry && artifacts?.resources ? objectStorageStore.buildRemoteResources(syncEntry, artifacts.resources) : artifacts?.resources ?? null;
        const derivedBytes = [resources?.preview?.bytes ?? 0, resources?.thumb?.bytes ?? 0].reduce((sum, value) => sum + value, 0);
        const delivery =
          objectStorageStore
            ? objectStorageStore.buildDeliveryStatus(syncEntry, {
                enabled: objectStorageEnabled,
              })
            : {
                state: 'local',
                canRetry: false,
                queuedAt: null,
                lastAttemptAt: null,
                syncedAt: null,
                error: null,
                attempts: 0,
              };

        return {
          filename,
          src: `/uploads/${filename}`,
          bytes: stats.size,
          derivedBytes,
          totalBytes: stats.size + derivedBytes,
          original: resources?.original ?? null,
          preview: resources?.preview ?? null,
          thumb: resources?.thumb ?? null,
          uploadedAt,
          ageHours: Math.max(0, (nowMs - uploadedAtMs) / 3_600_000),
          ageMs: Math.max(0, nowMs - uploadedAtMs),
          referencedByProjectIds,
          delivery,
          remoteSyncedAt: delivery.syncedAt,
        };
      }),
    );

    const missingReferencedFiles = Array.from(references.entries())
      .filter(([filename]) => !filenameSet.has(filename))
      .map(([filename, projectIds]) => ({
        filename,
        referencedByProjectIds: Array.from(projectIds).sort(),
      }));

    cachedUploadInventory = {
      items,
      missingReferencedFiles,
      totals: {
        uploadCount: items.length,
        referencedCount: items.filter((item) => item.referencedByProjectIds.length > 0).length,
        unreferencedCount: items.filter((item) => item.referencedByProjectIds.length === 0).length,
        missingReferencedCount: missingReferencedFiles.length,
        originalBytes: items.reduce((total, item) => total + item.bytes, 0),
        derivedBytes: items.reduce((total, item) => total + item.derivedBytes, 0),
        totalBytes: items.reduce((total, item) => total + item.totalBytes, 0),
      },
    };
    cachedUploadInventoryExpiresAt = Date.now() + cacheTtlMs;
    return cachedUploadInventory;
  }

  async function pruneUnreferencedUploads({
    olderThanMs = 72 * 60 * 60 * 1000,
    dryRun = true,
    limit = Number.POSITIVE_INFINITY,
    nowMs = Date.parse(now()) || Date.now(),
  } = {}) {
    const inventory = await collectUploadInventory({ nowMs });
    const candidates = inventory.items
      .filter((item) => item.referencedByProjectIds.length === 0 && item.ageMs >= olderThanMs)
      .slice(0, limit);

    if (!dryRun) {
      await Promise.all(candidates.map((item) => assetVariantService.removeUploadArtifacts(item.filename)));
      invalidateUploadInventoryCache();
    }

    return {
      dryRun,
      scannedCount: inventory.items.length,
      deletedCount: dryRun ? 0 : candidates.length,
      candidates,
      missingReferencedFiles: inventory.missingReferencedFiles,
      totals: inventory.totals,
    };
  }

  function createStoredUpload(file, metadata) {
    validateUploadFile(file);

    return {
      id: `upload-${idFactory(9)}`,
      name: path.basename(decodeMultipartFilename(file.originalname), path.extname(decodeMultipartFilename(file.originalname))) || 'Untitled upload',
      src: `/uploads/${file.filename}`,
      note: '',
      mimeType: typeof file.mimetype === 'string' ? file.mimetype : undefined,
      ...normalizeAssetDimensions(metadata?.width, metadata?.height),
    };
  }

  return {
    dataRoot,
    projectsDir,
    uploadsDir,
    limits: {
      maxPageCount,
      maxAssetCount,
    },
    ensureDataDirectories,
    readProjectRecord,
    writeProjectRecord,
    createProjectRecord,
    updateProjectRecord,
    patchProjectRecord,
    updateProjectShareRecord,
    listProjectRecords,
    deleteProjectRecord,
    readProjectRecordByShareId,
    collectUploadInventory,
    pruneUnreferencedUploads,
    hydrateStoredUploadAsset,
    sanitizeProjectState: (payload) => sanitizeProjectState(payload, { maxPageCount, maxAssetCount }),
    validateUploadFile,
    createStoredUpload,
    getUploadArtifacts,
    removeUploadArtifacts: async (filename) => {
      await assetVariantService.removeUploadArtifacts(filename);
      if (objectStorageStore) {
        await objectStorageStore.removeRemoteUpload(filename);
      }
    },
    invalidateStoreCaches,
  };
}

export function createApp({
  port = Number(process.env.PORT ?? DEFAULT_PORT),
  dataRoot = process.env.FINALFOLIO_DATA_ROOT ?? DEFAULT_DATA_ROOT,
  distDir = defaultDistDir,
  maxUploadCount = Number(process.env.FINALFOLIO_MAX_UPLOAD_COUNT ?? DEFAULT_MAX_UPLOAD_COUNT),
  maxUploadSizeBytes = Number(process.env.FINALFOLIO_MAX_UPLOAD_SIZE_BYTES ?? DEFAULT_MAX_UPLOAD_SIZE_BYTES),
  maxPageCount = Number(process.env.FINALFOLIO_MAX_PAGE_COUNT ?? DEFAULT_MAX_PAGE_COUNT),
  maxAssetCount = Number(process.env.FINALFOLIO_MAX_ASSET_COUNT ?? DEFAULT_MAX_ASSET_COUNT),
  mailServiceFactory = () => createMailService(),
  securityStoreFactory = (options) => createSecurityStore(options),
} = {}) {
  const securityStore = securityStoreFactory({ dataRoot });
  const objectStorageStore = createObjectStorageStore({ dataRoot, securityStore });
  const store = createProjectStore({
    dataRoot,
    maxPageCount,
    maxAssetCount,
    objectStorageStore,
  });
  const assetStore = createAssetStore({ dataRoot });
  const authStore = createAuthStore({ dataRoot });
  const opsStore = createOpsStore({ dataRoot });
  const siteStore = createSiteStore({ dataRoot });
  const aiStore = createAiStore({ dataRoot });
  const unalbumStore = createUnalbumStore({ dataRoot });
  // Listing a page already carries the variant URLs, so previews can be served
  // without one UnAlbum API call per thumbnail.
  const unalbumThumbCache = new Map();
  const UNALBUM_THUMB_TTL_MS = 10 * 60 * 1000;
  const rememberUnalbumThumbs = (userId, photos) => {
    const expiresAt = Date.now() + UNALBUM_THUMB_TTL_MS;
    photos.forEach((photo) => {
      const url = photo.variants?.thumb?.url || photo.variants?.preview?.url || photo.variants?.original?.url;
      if (photo.id && url) {
        unalbumThumbCache.set(`${userId}:${photo.id}`, { url, expiresAt });
      }
    });
    if (unalbumThumbCache.size > 3000) {
      const now = Date.now();
      for (const [key, value] of unalbumThumbCache) {
        if (value.expiresAt < now) {
          unalbumThumbCache.delete(key);
        }
      }
    }
  };
  const accountPreferencesStore = createAccountPreferencesStore({
    dataRoot,
    allowedPageThemes,
  });
  const userTemplateStore = createUserTemplateStore({
    dataRoot,
    idFactory: createId,
    maxPageCount,
    templateSlots,
    allowedPageThemes,
    textLimits: defaultTextLimits,
    frameRadiusRange: {
      min: MIN_FRAME_RADIUS,
      max: MAX_FRAME_RADIUS,
      defaultValue: DEFAULT_FRAME_RADIUS,
    },
  });
  const indexFile = path.join(distDir, 'index.html');
  const app = express();
  app.set('trust proxy', true);
  let mailService;

  function requireAuthenticated(request) {
    const user = request.auth?.user;
    if (!user) {
      const error = new Error('Sign in first.');
      error.statusCode = 401;
      throw error;
    }

    if (user.status !== 'active') {
      const error = new Error('This account is disabled.');
      error.statusCode = 403;
      throw error;
    }

    if (!hasAcceptedCurrentTerms(user) && request.path !== '/api/legal/terms/accept') {
      const error = new Error('Accept the Terms of Service to continue.');
      error.statusCode = 403;
      error.code = 'terms_required';
      error.termsVersion = CURRENT_TOS_VERSION;
      throw error;
    }

    return user;
  }

  function queueObjectStorageUploadSync(userId, syncCandidates) {
    if (!objectStorageStore || !Array.isArray(syncCandidates) || syncCandidates.length === 0) {
      return;
    }

    void (async () => {
      const failures = [];
      for (const candidate of syncCandidates) {
        const { filename, artifacts } = candidate;
        if (!artifacts?.resources?.original) {
          continue;
        }

        try {
          await objectStorageStore.syncLocalUpload(filename, artifacts);
        } catch (error) {
          failures.push({
            filename,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
      store.invalidateStoreCaches();

      if (failures.length === 0) {
        return;
      }

      console.error('Object storage sync failed for uploads:', failures);

      await opsStore.recordEvent({
        type: 'upload',
        status: 'error',
        userId,
        detail: {
          action: 'object-storage-sync',
          failedCount: failures.length,
          failures: failures.map(({ filename, message }) => ({
            filename,
            message,
          })),
        },
      });
    })().catch((error) => {
      console.error('Unexpected object storage sync queue failure.', error);
    });
  }

  function requireAdmin(request) {
    const user = requireAuthenticated(request);
    if (user.role !== 'admin') {
      const error = new Error('Admin access required.');
      error.statusCode = 403;
      throw error;
    }

    return user;
  }

  function getMailService() {
    mailService ??= mailServiceFactory();
    return mailService;
  }

  function collectPlacedAssetIds(project) {
    const placedAssetIds = new Set();
    project.pages.forEach((page) => {
      Object.values(page.slots).forEach((assetId) => {
        if (typeof assetId === 'string') {
          placedAssetIds.add(assetId);
        }
      });
    });
    return placedAssetIds;
  }

  function requireOwnedProjectAccess(request, record) {
    const user = requireAuthenticated(request);
    if (user.role !== 'admin' && user.id !== record.ownerUserId) {
      throw createForbidden('This project belongs to another account.');
    }

    return user;
  }

  function requireProjectReadAccess(request, record) {
    if (!record.ownerUserId) {
      return request.auth?.user ?? null;
    }

    return requireOwnedProjectAccess(request, record);
  }

  function requireProjectMutationAccess(request, record) {
    if (!record.ownerUserId) {
      const user = requireAuthenticated(request);
      if (user.role === 'admin') {
        return user;
      }

      throw createForbidden('This legacy project is read-only. Duplicate it into your account before editing.');
    }

    return requireOwnedProjectAccess(request, record);
  }

  function requireProjectDuplicateAccess(request, record) {
    const user = requireAuthenticated(request);
    if (!record.ownerUserId) {
      return user;
    }

    if (user.role !== 'admin' && user.id !== record.ownerUserId) {
      throw createForbidden('This project belongs to another account.');
    }

    return user;
  }

  function requireAssetOwner(request, assetRecord) {
    const user = requireAuthenticated(request);
    if (!assetRecord.ownerUserId) {
      if (user.role === 'admin') {
        return user;
      }

      const error = new Error('Only admins can manage unowned legacy assets.');
      error.statusCode = 403;
      throw error;
    }

    if (user.role !== 'admin' && user.id !== assetRecord.ownerUserId) {
      const error = new Error('This upload belongs to another account.');
      error.statusCode = 403;
      throw error;
    }

    return user;
  }

  function requireTemplateOwner(request, templateRecord) {
    const user = requireAuthenticated(request);
    if (!templateRecord.ownerUserId) {
      if (user.role === 'admin') {
        return user;
      }

      const error = new Error('This template is missing an owner.');
      error.statusCode = 403;
      throw error;
    }

    if (user.role !== 'admin' && user.id !== templateRecord.ownerUserId) {
      const error = new Error('This template belongs to another account.');
      error.statusCode = 403;
      throw error;
    }

    return user;
  }

  function serializeUserTemplateRecord(record) {
    return {
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ownerUserId: record.ownerUserId ?? null,
      name: record.name,
      description: record.description,
      kind: record.kind ?? 'project',
      sourceProjectId: record.sourceProjectId ?? null,
      includesCopy: record.includesCopy === true,
      preserveCopy: record.includesCopy === true,
      previewPageIndex: typeof record.previewPageIndex === 'number' ? record.previewPageIndex : 0,
      templatePayload: record.templatePayload,
    };
  }

  async function collectAssetProjectReferences(assetId) {
    const projects = await store.listProjectRecords();
    return projects
      .map((record) => {
        const inLibrary = record.project.assets.some((asset) => asset.id === assetId);
        const slotReferences = [];

        record.project.pages.forEach((page, pageIndex) => {
          Object.entries(page.slots).forEach(([slot, currentAssetId]) => {
            if (currentAssetId === assetId) {
              slotReferences.push({
                pageId: page.id,
                pageIndex,
                pageTitle: page.title,
                slot,
              });
            }
          });
        });

        return inLibrary || slotReferences.length > 0
          ? {
              projectId: record.id,
              projectTitle: record.project.title,
              issue: record.project.issue,
              inLibrary,
              slotReferences,
            }
          : null;
      })
      .filter((entry) => entry !== null);
  }

  function buildUploadDetailIndex(projects) {
    const referencesByFilename = new Map();

    projects.forEach((record) => {
      const assetById = Object.fromEntries(record.project.assets.map((asset) => [asset.id, asset]));

      record.project.pages.forEach((page, pageIndex) => {
        Object.entries(page.slots).forEach(([slot, currentAssetId]) => {
          if (typeof currentAssetId !== 'string') {
            return;
          }

          const asset = assetById[currentAssetId];
          const filename = getUploadFilenameFromPath(asset?.src ?? null);
          if (!filename) {
            return;
          }

          if (!referencesByFilename.has(filename)) {
            referencesByFilename.set(filename, []);
          }

          referencesByFilename.get(filename).push({
            projectId: record.id,
            projectTitle: record.project.title,
            issue: record.project.issue,
            pageId: page.id,
            pageIndex,
            pageTitle: page.title,
            slot,
            assetId: currentAssetId,
          });
        });
      });
    });

    return referencesByFilename;
  }

  function buildUploadReferenceSummary(projects) {
    const referencesByFilename = new Map();

    projects.forEach((record) => {
      const assetById = Object.fromEntries(record.project.assets.map((asset) => [asset.id, asset]));

      record.project.pages.forEach((page) => {
        Object.entries(page.slots).forEach(([, currentAssetId]) => {
          if (typeof currentAssetId !== 'string') {
            return;
          }

          const asset = assetById[currentAssetId];
          const filename = getUploadFilenameFromPath(asset?.src ?? null);
          if (!filename) {
            return;
          }

          const currentSummary = referencesByFilename.get(filename) ?? {
            referencedProjectIds: new Set(),
            pageCount: 0,
          };
          currentSummary.referencedProjectIds.add(record.id);
          currentSummary.pageCount += 1;
          referencesByFilename.set(filename, currentSummary);
        });
      });
    });

    return referencesByFilename;
  }

  function buildAssetReferenceSummary(projects) {
    const referencesByAssetId = new Map();

    projects.forEach((record) => {
      record.project.assets.forEach((asset) => {
        if (!referencesByAssetId.has(asset.id)) {
          referencesByAssetId.set(asset.id, {
            projectIds: new Set(),
            projectTitles: new Set(),
            pageCount: 0,
          });
        }
      });

      record.project.pages.forEach((page) => {
        Object.values(page.slots).forEach((currentAssetId) => {
          if (typeof currentAssetId !== 'string') {
            return;
          }

          const summary = referencesByAssetId.get(currentAssetId) ?? {
            projectIds: new Set(),
            projectTitles: new Set(),
            pageCount: 0,
          };
          summary.projectIds.add(record.id);
          summary.projectTitles.add(record.project.title);
          summary.pageCount += 1;
          referencesByAssetId.set(currentAssetId, summary);
        });
      });
    });

    return referencesByAssetId;
  }

  function summarizeActivityLabel(event) {
    const action = typeof event?.detail?.action === 'string' ? event.detail.action : '';
    switch (event.type) {
      case 'project':
        switch (action) {
          case 'create':
            return 'Created a project';
          case 'update':
            return 'Updated a project';
          case 'rename':
            return 'Renamed a project';
          case 'autosave':
            return 'Auto-saved a project';
          case 'create-from-template':
            return 'Created a project from a template';
          case 'duplicate':
            return 'Duplicated a project';
          case 'archive':
            return 'Archived a project';
          case 'unarchive':
            return 'Restored a project';
          case 'delete':
            return 'Deleted a project';
          default:
            return 'Changed a project';
        }
      case 'template':
        switch (action) {
          case 'create':
            return 'Saved a template';
          case 'update':
            return 'Updated a template';
          case 'duplicate':
            return 'Duplicated a template';
          case 'delete':
            return 'Deleted a template';
          default:
            return 'Changed a template';
        }
      case 'upload':
        if (action === 'delete') {
          return 'Deleted an uploaded asset';
        }
        if (action === 'retry-object-storage-sync') {
          return 'Retried remote asset sync';
        }
        return 'Uploaded assets';
      case 'export':
        if (event.status === 'error') {
          return 'Export failed';
        }
        if (event.status === 'requested') {
          return 'Requested PDF export';
        }
        return 'Exported a project';
      case 'share':
        switch (action) {
          case 'enable':
            return 'Enabled public sharing';
          case 'disable':
            return 'Disabled public sharing';
          case 'regenerate':
            return 'Regenerated a share link';
          default:
            return 'Updated sharing';
        }
      case 'auth':
        switch (action) {
          case 'login':
            return 'Signed in';
          case 'logout':
            return 'Signed out';
          case 'register':
            return 'Created an account';
          case 'verify-email':
            return 'Verified email';
          case 'password-reset':
            return 'Reset password';
          case 'accept-terms':
            return 'Accepted terms';
          case 'update-profile':
            return 'Updated account profile';
          case 'update-preferences':
            return 'Updated account preferences';
          case 'change-password':
            return 'Changed password';
          default:
            return 'Updated account settings';
        }
      default:
        return 'Updated workspace';
    }
  }

  function serializeAccountActivity(event) {
    const status = event.status === 'error' ? 'error' : event.status === 'requested' ? 'requested' : 'ok';
    return {
      id: event.id,
      type: event.type,
      action: typeof event?.detail?.action === 'string' ? event.detail.action : 'view',
      label: summarizeActivityLabel(event),
      status,
      createdAt: event.createdAt,
      projectId: typeof event.projectId === 'string' ? event.projectId : null,
      detail: event.detail && typeof event.detail === 'object' ? event.detail : null,
    };
  }

  function collectPageAssetIds(page) {
    return Array.from(new Set(Object.values(page?.slots ?? {}).filter((assetId) => typeof assetId === 'string')));
  }

  function collectProjectAssetIds(pages) {
    return new Set(
      pages.flatMap((page) => Object.values(page?.slots ?? {}).filter((assetId) => typeof assetId === 'string')),
    );
  }

  async function hydrateAssets(assets, { ensureVariants = false } = {}) {
    return Promise.all(assets.map((asset) => store.hydrateStoredUploadAsset(asset, { ensureVariants })));
  }

  async function buildProjectPreview(record, { ensureVariants = false } = {}) {
    const pages = record.project.pages;
    if (pages.length === 0) {
      return {
        pages: [],
        assets: [],
      };
    }

    const previewAssetIds = collectProjectAssetIds(pages);
    const previewAssets = await hydrateAssets(
      record.project.assets.filter((asset) => previewAssetIds.has(asset.id)),
      { ensureVariants },
    );

    return {
      pages,
      assets: previewAssets,
    };
  }

  async function buildPublicIssuePayload(record) {
    const share = serializeProjectShare(record.share);
    if (!share.enabled || !share.id) {
      const notFound = new Error('Shared folio not available.');
      notFound.statusCode = 404;
      throw notFound;
    }

    const usedAssetIds = collectProjectAssetIds(record.project.pages);
    const assets = await hydrateAssets(record.project.assets.filter((asset) => usedAssetIds.has(asset.id)));

    return {
      shareId: share.id,
      projectId: record.id,
      sharedAt: share.sharedAt,
      updatedAt: record.updatedAt,
      title: record.project.title,
      subtitle: record.project.subtitle,
      issue: record.project.issue,
      frameRadius: record.project.frameRadius,
      pages: record.project.pages,
      assets,
    };
  }

  function buildProjectMetrics(record) {
    const assetById = Object.fromEntries(record.project.assets.map((asset) => [asset.id, asset]));
    const usedAssetIds = new Set();
    const missingAssetIds = new Set();
    const templateUsage = {};
    let blankPages = 0;

    record.project.pages.forEach((page) => {
      templateUsage[page.template] = (templateUsage[page.template] ?? 0) + 1;
      const assignedAssetIds = Object.values(page.slots).filter((assetId) => typeof assetId === 'string');
      if (assignedAssetIds.length === 0) {
        blankPages += 1;
      }

      assignedAssetIds.forEach((assetId) => {
        usedAssetIds.add(assetId);
        if (!assetById[assetId]) {
          missingAssetIds.add(assetId);
        }
      });
    });

    return {
      pageCount: record.project.pages.length,
      assetCount: record.project.assets.length,
      placedAssetCount: usedAssetIds.size,
      unusedAssetCount: record.project.assets.filter((asset) => !usedAssetIds.has(asset.id)).length,
      blankPages,
      missingAssetCount: missingAssetIds.size,
      templateUsage,
    };
  }

  function getProjectHealth(metrics) {
    if (metrics.missingAssetCount > 0) {
      return `${metrics.missingAssetCount} missing`;
    }

    if (metrics.blankPages > 0) {
      return `${metrics.blankPages} blank`;
    }

    if (metrics.unusedAssetCount > 0) {
      return `${metrics.unusedAssetCount} unused`;
    }

    return 'healthy';
  }

  function selectHomepagePreviewPages(record, featuredIssue) {
    const pageIds = Array.isArray(featuredIssue?.pageIds) ? featuredIssue.pageIds : [];
    if (pageIds.length > 0) {
      const pageById = Object.fromEntries(record.project.pages.map((page) => [page.id, page]));
      const selectedPages = pageIds.map((pageId) => pageById[pageId]).filter(Boolean);
      if (selectedPages.length > 0) {
        return selectedPages.slice(0, 5);
      }
    }

    return record.project.pages.slice(0, 5);
  }

  function selectHomepagePreviewAssets(pages, assets) {
    const usedAssetIds = new Set();
    pages.forEach((page) => {
      Object.values(page.slots).forEach((assetId) => {
        if (typeof assetId === 'string') {
          usedAssetIds.add(assetId);
        }
      });
    });

    return assets.filter((asset) => usedAssetIds.has(asset.id));
  }

  async function buildHomepagePreviewPayload(siteContent) {
    const projectId = siteContent?.featuredIssue?.projectId;
    if (!projectId) {
      return null;
    }

    try {
      const record = await store.readProjectRecord(projectId);
      const pages = selectHomepagePreviewPages(record, siteContent.featuredIssue);
      if (pages.length === 0) {
        return null;
      }

      return {
        source: 'project',
        projectId: record.id,
        sharePath: createSharePath(record.id),
        issue: record.project.issue,
        title: record.project.title,
        subtitle: record.project.subtitle,
        frameRadius: record.project.frameRadius,
        assets: await hydrateAssets(selectHomepagePreviewAssets(pages, record.project.assets)),
        pages,
        updatedAt: record.updatedAt,
      };
    } catch {
      return null;
    }
  }

  async function syncHistoricalUploadsToObjectStorage({ force = false, limit = Number.POSITIVE_INFINITY } = {}) {
    const config = await objectStorageStore.readConfig();
    if (!config.enabled) {
      throw createBadRequest('Enable object storage before syncing historical uploads.');
    }

    const inventory = await store.collectUploadInventory();
    const targets = inventory.items.slice(0, limit);
    const result = {
      scanned: targets.length,
      synced: 0,
      skipped: 0,
      failed: [],
    };

    for (const item of targets) {
      try {
        const existingSyncEntry = await objectStorageStore.readSyncEntry(item.filename);
        if (existingSyncEntry && !force) {
          result.skipped += 1;
          continue;
        }

        const artifacts = await store.getUploadArtifacts(item.filename, {
          ensureVariants: true,
          originalWidth: item.original?.width,
          originalHeight: item.original?.height,
        });
        if (!artifacts?.resources) {
          throw new Error('Local upload artifacts are missing.');
        }

        await objectStorageStore.syncLocalUpload(item.filename, artifacts);
        result.synced += 1;
      } catch (error) {
        result.failed.push({
          filename: item.filename,
          message: error instanceof Error ? error.message : 'Unknown sync failure.',
        });
      }
    }

    store.invalidateStoreCaches();
    return result;
  }

  async function restoreRemoteUploadsToLocal({ detach = true, limit = Number.POSITIVE_INFINITY } = {}) {
    const syncIndex = await objectStorageStore.readSyncIndex();
    const filenames = Object.keys(syncIndex.uploads).sort().slice(0, limit);
    const result = {
      scanned: filenames.length,
      restoredFiles: 0,
      detachedUploads: 0,
      failed: [],
    };

    for (const filename of filenames) {
      try {
        const artifacts = await store.getUploadArtifacts(filename);
        const restoreResult = await objectStorageStore.restoreRemoteUploadToLocal(filename, artifacts, { detach });
        result.restoredFiles += restoreResult.restoredFiles;
        result.detachedUploads += restoreResult.detached ? 1 : 0;
        await store.hydrateStoredUploadAsset(
          {
            id: `restore-${filename}`,
            name: filename,
            src: `/uploads/${filename}`,
            note: '',
          },
          { ensureVariants: true },
        );
      } catch (error) {
        result.failed.push({
          filename,
          message: error instanceof Error ? error.message : 'Unknown restore failure.',
        });
      }
    }

    store.invalidateStoreCaches();
    return result;
  }

  async function cleanupAssetIfUnused(assetId, assetSrc = null) {
    const remainingReferences = await collectAssetProjectReferences(assetId);
    if (remainingReferences.length > 0) {
      return false;
    }

    let nextAssetSrc = assetSrc;
    try {
      const assetRecord = await assetStore.readAssetRecord(assetId);
      nextAssetSrc = assetRecord.src;
      await assetStore.markAssetDeleted(assetId);
    } catch {
      nextAssetSrc = assetSrc;
    }

    const filename = getUploadFilenameFromPath(nextAssetSrc);
    if (filename) {
      await store.removeUploadArtifacts(filename);
      store.invalidateStoreCaches();
    }

    return true;
  }
  // Uploads are account-level assets. Project mutations must not physically delete
  // upload records or files just because a project reference changed.
  async function updateProjectRecordPreservingAssets(projectId, payload) {
    const nextRecord = await store.updateProjectRecord(projectId, payload);
    await assetStore.touchAssetUsage(collectPlacedAssetIds(nextRecord.project));
    return nextRecord;
  }

  async function patchProjectRecordPreservingAssets(projectId, patch) {
    const nextRecord = await store.patchProjectRecord(projectId, patch);
    await assetStore.touchAssetUsage(collectPlacedAssetIds(nextRecord.project));
    return nextRecord;
  }

  async function deleteProjectRecordPreservingAssets(record) {
    await store.deleteProjectRecord(record.id);
  }

  // Deleting a folio should also remove the photos that no longer belong to any folio.
  // Shared library assets stay, because other projects may still reference them.
  async function cleanupUnreferencedAssetsFromProject(record) {
    const candidateIds = Array.from(
      new Set((record?.project?.assets ?? []).map((asset) => (typeof asset?.id === 'string' ? asset.id : null)).filter(Boolean)),
    );

    for (const assetId of candidateIds) {
      try {
        const assetRecord = await assetStore.readAssetRecord(assetId);
        if (!assetRecord || assetRecord.deletedAt) {
          continue;
        }

        if (record.ownerUserId && assetRecord.ownerUserId !== record.ownerUserId) {
          continue;
        }

        const references = await collectAssetProjectReferences(assetId);
        if (references.length === 0) {
          await cleanupAssetIfUnused(assetId, assetRecord.src);
        }
      } catch {
        // Asset cleanup is best-effort; the project deletion has already succeeded.
      }
    }

    store.invalidateStoreCaches();
  }

  async function deleteTemplatesOwnedByUser(userId) {
    const templates = (await userTemplateStore.listTemplateRecords()).filter((record) => record.ownerUserId === userId);
    await Promise.all(templates.map((record) => userTemplateStore.deleteTemplateRecord(record.id)));
    return templates.length;
  }

  async function deleteOwnedContentForUser(userId) {
    const ownedProjects = (await store.listProjectRecords()).filter((record) => record.ownerUserId === userId);
    const ownedUploadCount = (await assetStore.listAssetRecords({ includeDeleted: false })).filter(
      (record) => record.ownerUserId === userId && !record.deletedAt,
    ).length;

    for (const record of ownedProjects) {
      await deleteProjectRecordPreservingAssets(record);
    }

    const deletedTemplateCount = await deleteTemplatesOwnedByUser(userId);
    const remainingOwnedAssets = (await assetStore.listAssetRecords({ includeDeleted: false })).filter(
      (record) => record.ownerUserId === userId && !record.deletedAt,
    );

    for (const record of remainingOwnedAssets) {
      await cleanupAssetIfUnused(record.id, record.src);
    }

    const retainedUploadCount = (await assetStore.listAssetRecords({ includeDeleted: false })).filter(
      (record) => record.ownerUserId === userId && !record.deletedAt,
    ).length;

    await accountPreferencesStore.deletePreferences(userId);

    return {
      deletedProjectCount: ownedProjects.length,
      deletedTemplateCount,
      deletedUploadCount: Math.max(0, ownedUploadCount - retainedUploadCount),
      retainedUploadCount,
    };
  }

  app.disable('x-powered-by');
  app.use(async (_, response, next) => {
    try {
      const remoteImageOrigins = new Set();
      if (objectStorageStore) {
        const configured = await objectStorageStore.readConfig().catch(() => null);
        const candidateUrls = [objectStorageStore.defaults.publicBaseUrl, configured?.publicBaseUrl].filter(
          (value) => typeof value === 'string' && value.trim(),
        );

        for (const candidateUrl of candidateUrls) {
          try {
            remoteImageOrigins.add(new URL(candidateUrl).origin);
          } catch {
            continue;
          }
        }
      }

      const remoteConnectOrigins = new Set(remoteImageOrigins);

      response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "font-src 'self' data:",
          `img-src 'self' data: blob:${remoteImageOrigins.size ? ` ${Array.from(remoteImageOrigins).join(' ')}` : ''}`,
          "script-src 'self' https://static.cloudflareinsights.com",
          `connect-src 'self' https://cloudflareinsights.com${remoteConnectOrigins.size ? ` ${Array.from(remoteConnectOrigins).join(' ')}` : ''}`,
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
        ].join('; '),
      );
      next();
    } catch (error) {
      next(error);
    }
  });
  app.use(express.json({ limit: '8mb' }));
  app.use(async (request, _response, next) => {
    const cookies = parseCookies(request.headers.cookie ?? '');
    const sessionId = cookies[SESSION_COOKIE_NAME] ?? null;
    request.auth = null;

    if (!sessionId) {
      return next();
    }

    try {
      request.auth = await authStore.resolveSessionUser(sessionId);
      if (request.auth) {
        void authStore.touchSessionUser(request.auth.session.id, request.auth.user.id).catch((error) => {
          console.error('Failed to touch auth activity.', error);
        });
      }
    } catch (error) {
      if (error?.statusCode === 401 || error?.statusCode === 404) {
        request.auth = null;
        _response.setHeader('Set-Cookie', serializeClearedSessionCookie());
        return next();
      }

      return next(error);
    }

    next();
  });

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_request, _file, callback) => callback(null, store.uploadsDir),
      filename: (_request, file, callback) => callback(null, createUploadFilename(file.originalname)),
    }),
    limits: {
      files: maxUploadCount,
      fileSize: maxUploadSizeBytes,
    },
    fileFilter: (_request, file, callback) => {
      try {
        store.validateUploadFile(file);
        callback(null, true);
      } catch (error) {
        callback(error);
      }
    },
  });

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.get('/api/site-content', async (_request, response, next) => {
    try {
      const siteContent = await siteStore.readSiteContent();
      const homepagePreview = await buildHomepagePreviewPayload(siteContent);
      response.setHeader('Cache-Control', 'no-store');
      response.json({
        siteContent,
        homepagePreview,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/template-governance', async (_request, response, next) => {
    try {
      response.setHeader('Cache-Control', 'no-store');
      response.json({
        templateGovernance: await siteStore.readTemplateGovernance(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/auth/session', (request, response) => {
    response.json({
      user: request.auth?.user ? authStore.serializeUserRecord(request.auth.user) : null,
    });
  });

  app.get('/api/auth/bootstrap-status', async (_request, response, next) => {
    try {
      const users = await authStore.listUsers();
      response.json({
        hasUsers: users.length > 0,
        requiresBootstrap: users.length === 0,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/auth/captcha', async (request, response, next) => {
    try {
      const purpose = typeof request.query.purpose === 'string' ? request.query.purpose : 'register';
      const clientIp = resolveClientIp(request);
      const challenge = await securityStore.issueCaptcha({
        ip: clientIp,
        purpose,
      });
      response.setHeader('Cache-Control', 'no-store');
      response.json({
        id: challenge.id,
        purpose: challenge.purpose,
        prompt: challenge.prompt,
        imageDataUrl: challenge.imageDataUrl,
        expiresAt: challenge.expiresAt,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/register', async (request, response, next) => {
    try {
      const clientIp = resolveClientIp(request);
      if (request.body?.acceptTerms !== true) {
        throw createBadRequest('You must agree to the Terms of Service before creating an account.');
      }
      await securityStore.verifyCaptcha({
        id: request.body?.captchaId,
        answer: request.body?.captchaAnswer,
        ip: clientIp,
        purpose: 'register',
      });
      await securityStore.consumeRateLimit({
        ...REGISTER_IP_RATE_LIMIT,
        key: clientIp,
      });
      const user = await authStore.createUser(request.body ?? {}, {
        acceptCurrentTerms: true,
        requireUsername: true,
        termsAcceptedLanguage: request.body?.termsLanguage,
      });
      try {
        const token = await authStore.issueVerificationToken(user.id);
        const origin = resolvePublicOrigin(request);
        const verificationUrl = new URL(`/auth?verify=${encodeURIComponent(token.id)}`, origin).toString();
        await getMailService().sendVerificationEmail({
          to: user.email,
          actionUrl: verificationUrl,
        });
      } catch (error) {
        await authStore.deleteUser(user.id);
        throw error;
      }
      await opsStore.recordEvent({
        type: 'auth',
        status: 'ok',
        userId: user.id,
        detail: { action: 'register', verification: 'sent' },
      });
      response.status(201).json({
        user: authStore.serializeUserRecord(user),
        verificationRequired: true,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/legal/terms/accept', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      const acceptedUser = await authStore.acceptTerms(user.id, {
        language: request.body?.language,
      });
      await opsStore.recordEvent({
        type: 'auth',
        status: 'ok',
        userId: user.id,
        detail: {
          action: 'accept-terms',
          version: CURRENT_TOS_VERSION,
          language: acceptedUser.termsAcceptedLanguage,
        },
      });
      response.json({
        user: authStore.serializeUserRecord(acceptedUser),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/login', async (request, response, next) => {
    try {
      const clientIp = resolveClientIp(request);
      const identifierKey =
        String(request.body?.identifier ?? request.body?.email ?? '')
          .trim()
          .toLowerCase()
          .slice(0, 160) || 'unknown';
      await securityStore.consumeRateLimit({ ...LOGIN_IP_RATE_LIMIT, key: clientIp });
      await securityStore.consumeRateLimit({ ...LOGIN_IDENTIFIER_RATE_LIMIT, key: identifierKey });

      const user = await authStore.authenticateUser(request.body ?? {});
      const session = await authStore.createSession(user.id);
      response.setHeader('Set-Cookie', serializeSessionCookie(session.id));
      await opsStore.recordEvent({
        type: 'auth',
        status: 'ok',
        userId: user.id,
        detail: { action: 'login' },
      });
      response.json({ user: authStore.serializeUserRecord(user) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/verification/resend', async (request, response, next) => {
    try {
      const clientIp = resolveClientIp(request);
      await securityStore.consumeRateLimit({
        ...VERIFICATION_RESEND_IP_RATE_LIMIT,
        key: clientIp,
      });
      const email = typeof request.body?.email === 'string' ? request.body.email : '';
      const user = await authStore.findUserByEmail(email);
      if (user && !user.emailVerifiedAt) {
        const token = await authStore.issueVerificationToken(user.id);
        const origin = resolvePublicOrigin(request);
        const verificationUrl = new URL(`/auth?verify=${encodeURIComponent(token.id)}`, origin).toString();
        await getMailService().sendVerificationEmail({
          to: user.email,
          actionUrl: verificationUrl,
        });
      }

      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/verify', async (request, response, next) => {
    try {
      const token = typeof request.body?.token === 'string' ? request.body.token.trim() : '';
      const user = await authStore.verifyUserWithToken(token);
      const session = await authStore.createSession(user.id);
      response.setHeader('Set-Cookie', serializeSessionCookie(session.id));
      await opsStore.recordEvent({
        type: 'auth',
        status: 'ok',
        userId: user.id,
        detail: { action: 'verify-email' },
      });
      response.json({ user: authStore.serializeUserRecord(user) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/password-reset/request', async (request, response, next) => {
    try {
      const clientIp = resolveClientIp(request);
      await securityStore.consumeRateLimit({
        ...PASSWORD_RESET_IP_RATE_LIMIT,
        key: clientIp,
      });
      const email = typeof request.body?.email === 'string' ? request.body.email : '';
      const issued = await authStore.issuePasswordResetToken(email);
      if (issued) {
        const origin = resolvePublicOrigin(request);
        const resetUrl = new URL(`/auth?reset=${encodeURIComponent(issued.token.id)}`, origin).toString();
        await getMailService().sendPasswordResetEmail({
          to: issued.user.email,
          actionUrl: resetUrl,
        });
      }

      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/password-reset/confirm', async (request, response, next) => {
    try {
      const token = typeof request.body?.token === 'string' ? request.body.token.trim() : '';
      const password = typeof request.body?.password === 'string' ? request.body.password : '';
      const user = await authStore.resetPasswordWithToken(token, password);
      const session = await authStore.createSession(user.id);
      response.setHeader('Set-Cookie', serializeSessionCookie(session.id));
      await opsStore.recordEvent({
        type: 'auth',
        status: 'ok',
        userId: user.id,
        detail: { action: 'password-reset' },
      });
      response.json({ user: authStore.serializeUserRecord(user) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/logout', async (request, response, next) => {
    try {
      const cookies = parseCookies(request.headers.cookie ?? '');
      await authStore.deleteSession(cookies[SESSION_COOKIE_NAME]);
      response.setHeader('Set-Cookie', serializeClearedSessionCookie());
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/account/summary', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      const [projects, assetRecords] = await Promise.all([store.listProjectRecords(), assetStore.listAssetRecords({ includeDeleted: false })]);
      const ownedProjects = projects.filter((record) => record.ownerUserId === user.id);
      const activeOwnedProjects = ownedProjects.filter((record) => !record.archivedAt);
      const ownedAssetRecords = assetRecords.filter((record) => record.ownerUserId === user.id && !record.deletedAt);
      const assetReferenceSummary = buildAssetReferenceSummary(projects);

      response.json({
        account: authStore.serializeUserRecord(user),
        counts: {
          projects: activeOwnedProjects.length,
          archivedProjects: ownedProjects.length - activeOwnedProjects.length,
          uploads: ownedAssetRecords.length,
          referencedUploads: ownedAssetRecords.filter((record) => (assetReferenceSummary.get(record.id)?.projectIds.size ?? 0) > 0).length,
          unusedUploads: ownedAssetRecords.filter((record) => (assetReferenceSummary.get(record.id)?.projectIds.size ?? 0) === 0).length,
        },
        recentProjects: ownedProjects.slice(0, 6).map((record) => ({
          id: record.id,
          sharePath: createSharePath(record.id),
          title: record.project.title,
          issue: record.project.issue,
          updatedAt: record.updatedAt,
          archivedAt: record.archivedAt ?? null,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/account/uploads', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      const search = typeof request.query.search === 'string' ? request.query.search.trim().toLowerCase() : '';
      const [projects, assetRecords] = await Promise.all([store.listProjectRecords(), assetStore.listAssetRecords({ includeDeleted: false })]);
      const ownedRecords = assetRecords.filter((record) => record.ownerUserId === user.id && !record.deletedAt);
      const assetReferenceSummary = buildAssetReferenceSummary(projects);
      const uploads = await Promise.all(
        ownedRecords.map(async (record) => {
          const hydrated = await store.hydrateStoredUploadAsset(record);
          const filename = getUploadFilenameFromPath(record.src) ?? record.src;
          const referenceSummary = assetReferenceSummary.get(record.id) ?? {
            projectIds: new Set(),
            projectTitles: new Set(),
            pageCount: 0,
          };

          return {
            assetId: record.id,
            filename,
            name: record.name,
            src: record.src,
            delivery: hydrated.delivery ?? { state: 'local', canRetry: false },
            original: hydrated.variants?.original ?? null,
            preview: hydrated.variants?.preview ?? null,
            thumb: hydrated.variants?.thumb ?? null,
            bytes: hydrated.bytes ?? 0,
            width: hydrated.width ?? null,
            height: hydrated.height ?? null,
            note: record.note,
            analysis: hydrated.analysis ?? record.analysis ?? null,
            unalbumId: record.unalbumId ?? null,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            lastUsedAt: record.lastUsedAt ?? null,
            referencedProjectCount: referenceSummary.projectIds.size,
            referencedPageCount: referenceSummary.pageCount,
            referencedProjectTitles: Array.from(referenceSummary.projectTitles).sort(),
          };
        }),
      );

      response.json({
        uploads: uploads.filter((upload) => {
          if (!search) {
            return true;
          }

          return (
            upload.filename.toLowerCase().includes(search) ||
            upload.name.toLowerCase().includes(search) ||
            upload.referencedProjectTitles.some((title) => title.toLowerCase().includes(search))
          );
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/account/preferences', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      response.json({
        preferences: await accountPreferencesStore.readPreferences(user.id),
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/account/preferences', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      const preferences = await accountPreferencesStore.updatePreferences(user.id, request.body ?? {});
      await opsStore.recordEvent({
        type: 'auth',
        status: 'ok',
        userId: user.id,
        detail: {
          action: 'update-preferences',
        },
      });
      response.json({ preferences });
    } catch (error) {
      next(error);
    }
  });

  // ---------------------------------------------------------------------
  // UnAlbum bridge. FinalFolio never sees an UnAlbum password: the account is
  // linked with OAuth 2.1 + PKCE, and photo bytes are proxied by this server
  // so the browser never needs an UnAlbum token. Everything stays dark until
  // FINALFOLIO_UNALBUM_BASE_URL and FINALFOLIO_UNALBUM_CLIENT_ID are set.
  // ---------------------------------------------------------------------
  function unalbumOrigins() {
    const config = unalbumStore.config();
    const allowedOrigins = new Set();
    let authOrigin = '';
    try {
      authOrigin = new URL(config.baseUrl).origin;
      allowedOrigins.add(authOrigin);
    } catch {
      // Configuration is validated by `configured`; an empty base leaves no origins.
    }
    config.storageOrigins.forEach((origin) => {
      try {
        allowedOrigins.add(new URL(origin).origin);
      } catch {
        // Ignore malformed extra origins instead of failing every import.
      }
    });
    return { allowedOrigins, authOrigin };
  }

  function unalbumAccountSummary(binding) {
    return {
      id: binding.account.id,
      username: binding.account.username ?? '',
      displayName: binding.account.displayName ?? '',
      avatarUrl: binding.account.avatarUrl ?? '',
      boundAt: binding.boundAt ?? null,
    };
  }

  app.get('/api/unalbum/status', async (request, response, next) => {
    try {
      const config = unalbumStore.config();
      const user = request.auth?.user ?? null;
      const binding = user && config.configured ? await unalbumStore.readBinding(user.id) : null;
      response.json({
        configured: config.configured,
        bound: Boolean(binding),
        account: binding ? unalbumAccountSummary(binding) : null,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/unalbum/authorize', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      await securityStore.consumeRateLimit({
        ...UNALBUM_START_IP_RATE_LIMIT,
        key: resolveClientIp(request),
      });
      const { authorizeUrl } = await unalbumStore.startAuthorization({
        intent: 'bind',
        userId: user.id,
        publicOrigin: resolvePublicOrigin(request),
      });
      response.json({ authorizeUrl });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/unalbum/login', async (request, response, next) => {
    try {
      await securityStore.consumeRateLimit({
        ...UNALBUM_START_IP_RATE_LIMIT,
        key: resolveClientIp(request),
      });
      const nextPath = typeof request.body?.next === 'string' ? request.body.next : '';
      const safeNext = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath.slice(0, 300) : '/editor';
      const { authorizeUrl } = await unalbumStore.startAuthorization({
        intent: 'login',
        publicOrigin: resolvePublicOrigin(request),
        returnTo: safeNext,
      });
      response.json({ authorizeUrl });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/unalbum/callback', async (request, response) => {
    const origin = resolvePublicOrigin(request);
    // A failed login belongs on the auth page (there is no signed-in account
    // page to show); a failed binding belongs on the account panel that owns
    // the UnAlbum card.
    let record = null;
    const fail = (reason) => {
      const target =
        record?.intent === 'bind'
          ? `/account?section=settings&unalbum=error&reason=${encodeURIComponent(reason)}`
          : `/auth?unalbum=error&reason=${encodeURIComponent(reason)}`;
      response.redirect(302, `${origin}${target}`);
    };
    try {
      const state = typeof request.query.state === 'string' ? request.query.state : '';
      record = await unalbumStore.consumeState(state);
      if (!record) {
        response.redirect(302, `${origin}/auth?unalbum=error&reason=state`);
        return;
      }
      const code = typeof request.query.code === 'string' ? request.query.code : '';
      if (!code) {
        fail('denied');
        return;
      }

      const tokens = await unalbumStore.exchangeCode({
        code,
        verifier: record.verifier,
        redirectUri: record.redirectUri,
      });
      const profileResult = await unalbumStore.fetchProfile({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      });
      const binding = {
        account: profileResult.profile,
        accessToken: profileResult.binding.accessToken,
        refreshToken: profileResult.binding.refreshToken,
        scope: tokens.scope,
        expiresAt: profileResult.binding.expiresAt,
      };

      if (record.intent === 'login') {
        const email = profileResult.profile.email;
        if (!email) {
          response.redirect(302, `${origin}/auth?unalbum=error&reason=no-email`);
          return;
        }

        let user = await authStore.findUserByEmail(email);
        if (!user) {
          // OAuth accounts get a random local password they never need to know;
          // sign-in keeps working through UnAlbum.
          const randomPassword = crypto.randomBytes(24).toString('base64url');
          try {
            user = await authStore.createUser(
              { email, password: randomPassword, username: profileResult.profile.username },
              { role: 'user', markEmailVerified: true },
            );
          } catch {
            user = await authStore.createUser({ email, password: randomPassword }, { role: 'user', markEmailVerified: true });
          }
        }
        if (user.status !== 'active') {
          response.redirect(302, `${origin}/auth?unalbum=error&reason=disabled`);
          return;
        }

        await unalbumStore.writeBinding(user.id, binding);
        const session = await authStore.createSession(user.id);
        response.setHeader('Set-Cookie', serializeSessionCookie(session.id));
        await opsStore.recordEvent({
          type: 'auth',
          status: 'ok',
          userId: user.id,
          detail: { action: 'unalbum-login' },
        });
        const target = record.returnTo && record.returnTo.startsWith('/') ? record.returnTo : '/editor';
        response.redirect(302, `${origin}${target}`);
        return;
      }

      if (!record.userId) {
        fail('session');
        return;
      }
      await unalbumStore.writeBinding(record.userId, binding);
      await opsStore.recordEvent({
        type: 'unalbum',
        status: 'ok',
        userId: record.userId,
        detail: { action: 'bind' },
      });
      response.redirect(302, `${origin}/account?section=settings&unalbum=connected`);
    } catch (error) {
      // OAuth callbacks are browser navigations; a JSON error page would strand
      // the user, so report through the app instead. Keep the stage in the
      // reason so the page can explain what happened.
      const cause = error?.cause?.code || error?.name || 'error';
      console.error('UnAlbum callback failed.', {
        message: error instanceof Error ? error.message : String(error),
        cause,
        code: error?.code ?? null,
      });
      const isNetwork =
        (error instanceof TypeError && error?.cause) ||
        error?.name === 'TimeoutError' ||
        error?.name === 'AbortError';
      fail(isNetwork ? 'network' : error?.code === 'unalbum_reconnect' ? 'reconnect' : 'failed');
    }
  });

  app.post('/api/unalbum/unbind', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      await unalbumStore.deleteBinding(user.id);
      await opsStore.recordEvent({
        type: 'unalbum',
        status: 'ok',
        userId: user.id,
        detail: { action: 'unbind' },
      });
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Streams a preview from UnAlbum through FinalFolio. Browser-direct loading
   * depends on the CDN's hotlink allowlist, and a relative or protected URL
   * would silently break every tile; this endpoint uses the same normalized
   * URL as the import path and is cached by the server.
   */
  app.get('/api/unalbum/thumb/:photoId', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      await securityStore.consumeRateLimit({ ...UNALBUM_THUMB_RATE_LIMIT, key: user.id });
      const photoId = String(request.params.photoId ?? '').slice(0, 120);
      if (!photoId) {
        throw createBadRequest('Unknown UnAlbum photo.');
      }

      let binding = null;
      let entry = unalbumThumbCache.get(`${user.id}:${photoId}`);
      if (!entry || entry.expiresAt < Date.now()) {
        const result = await unalbumStore.getPhotoForUser(user.id, photoId);
        binding = result.binding;
        rememberUnalbumThumbs(user.id, [result.photo]);
        entry = unalbumThumbCache.get(`${user.id}:${photoId}`);
      }
      if (!entry) {
        throw createNotFound('This UnAlbum photo has no preview.');
      }

      const { allowedOrigins, authOrigin } = unalbumOrigins();
      const sourceUrl = new URL(entry.url);
      if (!allowedOrigins.has(sourceUrl.origin)) {
        throw createBadRequest('UnAlbum returned an image URL outside its storage origins.');
      }
      const headers = { accept: 'image/jpeg,image/png,image/webp,image/*;q=0.8' };
      if (authOrigin && sourceUrl.origin === authOrigin) {
        binding = binding ?? (await unalbumStore.readBinding(user.id));
        if (!binding) {
          throw createNotFound('Connect your UnAlbum account first.');
        }
        headers.authorization = `Bearer ${binding.accessToken}`;
      }

      const upstream = await fetch(sourceUrl, {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(20_000),
      });
      if (!upstream.ok) {
        throw createNotFound('This UnAlbum preview could not be loaded.');
      }
      const contentType = String(upstream.headers.get('content-type') ?? '');
      if (!/^image\//i.test(contentType)) {
        throw createBadRequest('UnAlbum returned a non-image preview.');
      }
      const buffer = Buffer.from(await upstream.arrayBuffer());
      if (!buffer.length || buffer.length > 12 * 1024 * 1024) {
        throw createBadRequest('This UnAlbum preview is too large.');
      }

      response.setHeader('Content-Type', contentType);
      response.setHeader('Cache-Control', 'private, max-age=600');
      response.send(buffer);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/unalbum/photos', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      await securityStore.consumeRateLimit({ ...UNALBUM_USER_RATE_LIMIT, key: `photos:${user.id}` });
      const result = await unalbumStore.listPhotosForUser(user.id, {
        cursor: typeof request.query.cursor === 'string' ? request.query.cursor.slice(0, 500) : '',
        query: typeof request.query.q === 'string' ? request.query.q.slice(0, 120) : '',
        limit: request.query.limit,
      });
      rememberUnalbumThumbs(user.id, result.photos);
      response.json({
        photos: result.photos,
        nextCursor: result.nextCursor,
        account: unalbumAccountSummary(result.binding),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/unalbum/import', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      await securityStore.consumeRateLimit({ ...UNALBUM_USER_RATE_LIMIT, key: `import:${user.id}` });
      const ids = Array.isArray(request.body?.ids)
        ? request.body.ids.filter((id) => typeof id === 'string').slice(0, 30)
        : [];
      if (!ids.length) {
        throw createBadRequest('Choose at least one UnAlbum photo.');
      }
      if (!(await unalbumStore.readBinding(user.id))) {
        response.status(409).json({ error: 'Connect your UnAlbum account first.', code: 'unalbum_not_bound' });
        return;
      }

      const { allowedOrigins, authOrigin } = unalbumOrigins();
      const createdAssets = [];
      const existingRecords = await assetStore.listAssetRecords({ includeDeleted: false });
      const importedByUnalbumId = new Map(
        existingRecords
          .filter((record) => record.ownerUserId === user.id && typeof record.unalbumId === 'string' && record.unalbumId)
          .map((record) => [record.unalbumId, record]),
      );
      for (const id of ids) {
        // Clicking a photo twice must not create two copies.
        const alreadyImported = importedByUnalbumId.get(id);
        if (alreadyImported) {
          createdAssets.push(await store.hydrateStoredUploadAsset(alreadyImported));
          continue;
        }

        const { photo } = await unalbumStore.getPhotoForUser(user.id, id);
        rememberUnalbumThumbs(user.id, [photo]);

        // UnAlbum keeps the original even when it exceeds our upload ceiling and
        // derives a 2048px WebP preview for those photos. Prefer whichever copy
        // actually fits instead of failing on a 30 MB original.
        const original = photo.variants?.original;
        const preview = photo.variants?.preview;
        const thumb = photo.variants?.thumb;
        const originalFits = !original?.bytes || original.bytes <= maxUploadSizeBytes;
        const variants = (originalFits ? [original, preview, thumb] : [preview, original, thumb]).filter(
          (variant) => variant && typeof variant.url === 'string' && variant.url,
        );
        if (!variants.length) {
          throw createBadRequest('This UnAlbum photo has no downloadable file.');
        }

        let downloaded = null;
        let lastError = null;
        for (const variant of variants) {
          try {
            downloaded = await downloadUnalbumImage(variant.url, {
              accessToken: binding.accessToken,
              authOrigin,
              allowedOrigins,
              maxBytes: maxUploadSizeBytes,
              uploadsDir: store.uploadsDir,
              suggestedName: photo.filename || photo.name,
              idFactory: createId,
            });
            break;
          } catch (error) {
            lastError = error;
          }
        }
        if (!downloaded) {
          throw lastError ?? createBadRequest('This UnAlbum photo could not be downloaded.');
        }

        await assertReadableImageFile(downloaded.file);
        const baseAsset = store.createStoredUpload(downloaded.file, {
          width: photo.width ?? undefined,
          height: photo.height ?? undefined,
        });
        let asset = await store.hydrateStoredUploadAsset(baseAsset, { ensureVariants: true });
        asset = { ...asset, unalbumId: photo.id };
        const analysis = sanitizeAssetAnalysis(photo.analysis);
        if (analysis) {
          asset = { ...asset, analysis: { ...analysis, source: 'unalbum' } };
        }
        const displayName = (photo.name || photo.filename || '').trim();
        if (displayName) {
          asset = { ...asset, name: displayName.slice(0, defaultTextLimits.assetName) };
        }

        await assetStore.createAssetRecord(asset, { ownerUserId: user.id });
        createdAssets.push(asset);

        const artifacts = await store.getUploadArtifacts(downloaded.file.filename, {
          originalWidth: asset.width,
          originalHeight: asset.height,
        });
        queueObjectStorageUploadSync(user.id, [{ filename: downloaded.file.filename, artifacts }]);
      }

      store.invalidateStoreCaches();
      await opsStore.recordEvent({
        type: 'unalbum',
        status: 'ok',
        userId: user.id,
        detail: { action: 'import', count: createdAssets.length },
      });
      response.status(201).json({ assets: createdAssets });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/ai/status', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      response.json(await aiStore.getUserStatus(user.id));
    } catch (error) {
      next(error);
    }
  });

  // Long AI generations outlive proxy timeouts (Cloudflare returns 524 at ~100s),
  // so the POST only starts a job and returns immediately; the client polls.
  const aiPlanJobs = new Map();
  const AI_PLAN_JOB_TTL_MS = 15 * 60 * 1000;
  const sweepAiPlanJobs = () => {
    const cutoff = Date.now() - AI_PLAN_JOB_TTL_MS;
    for (const [jobId, job] of aiPlanJobs) {
      if (job.createdAt < cutoff) {
        aiPlanJobs.delete(jobId);
      }
    }
  };

  app.post('/api/ai/plans', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      await securityStore.consumeRateLimit({ ...AI_PLAN_RATE_LIMIT, key: user.id });
      sweepAiPlanJobs();
      const jobId = `aijob-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
      const job = {
        id: jobId,
        userId: user.id,
        status: 'pending',
        createdAt: Date.now(),
        startedAt: Date.now(),
        finishedAt: null,
        result: null,
        error: null,
        code: null,
      };
      aiPlanJobs.set(jobId, job);
      response.status(202).json({ jobId });

      void aiStore
        .generatePlans({
          userId: user.id,
          images: request.body?.images,
          prompt: request.body?.prompt,
        })
        .then(async (result) => {
          job.status = 'succeeded';
          job.result = result;
          job.finishedAt = Date.now();
          await opsStore
            .recordEvent({
              type: 'ai',
              status: 'ok',
              userId: user.id,
              detail: {
                action: 'generate-ai-plans',
                provider: result.providerName ?? null,
                imageCount: Array.isArray(request.body?.images) ? request.body.images.length : 0,
                planCount: Array.isArray(result.plans) ? result.plans.length : 0,
              },
            })
            .catch(() => null);
        })
        .catch((error) => {
          job.status = 'failed';
          job.error = error instanceof Error ? error.message : 'AI arrangement failed.';
          job.code = error?.code ?? null;
          job.finishedAt = Date.now();
        });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/ai/plans/:jobId', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      const job = aiPlanJobs.get(String(request.params.jobId ?? ''));
      if (!job) {
        response.status(404).json({ error: 'This AI job is no longer available. Start a new generation.' });
        return;
      }
      if (job.userId !== user.id && user.role !== 'admin') {
        response.status(403).json({ error: 'This AI job belongs to another account.' });
        return;
      }
      response.json({
        status: job.status,
        result: job.result ?? undefined,
        error: job.error ?? undefined,
        code: job.code ?? undefined,
        elapsedMs: (job.finishedAt ?? Date.now()) - job.startedAt,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/account/activity', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      const events = await opsStore.listEvents();
      response.json({
        activity: events
          .filter((event) => event.userId === user.id)
          .filter((event) => ['project', 'template', 'upload', 'export', 'share', 'auth'].includes(event.type))
          .slice(-24)
          .reverse()
          .map(serializeAccountActivity),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/account/templates', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      const search = typeof request.query.search === 'string' ? request.query.search.trim().toLowerCase() : '';
      const templates = (await userTemplateStore.listTemplateRecords())
        .filter((record) => record.ownerUserId === user.id)
        .filter((record) => {
          if (!search) {
            return true;
          }

          return (
            record.id.toLowerCase().includes(search) ||
            record.name.toLowerCase().includes(search) ||
            record.description.toLowerCase().includes(search) ||
            (record.sourceProjectId ?? '').toLowerCase().includes(search)
          );
        });

      response.json({
        templates: templates.map(serializeUserTemplateRecord),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/account/templates', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      const template = await userTemplateStore.createTemplateRecord(request.body ?? {}, {
        ownerUserId: user.id,
      });
      await opsStore.recordEvent({
        type: 'template',
        status: 'ok',
        userId: user.id,
        detail: {
          action: 'create',
          templateId: template.id,
          sourceProjectId: template.sourceProjectId ?? null,
        },
      });
      response.status(201).json({ template: serializeUserTemplateRecord(template) });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/account/templates/:templateId', async (request, response, next) => {
    try {
      const template = await userTemplateStore.readTemplateRecord(request.params.templateId);
      const user = requireTemplateOwner(request, template);
      const updatedTemplate = await userTemplateStore.updateTemplateRecord(request.params.templateId, request.body ?? {});
      await opsStore.recordEvent({
        type: 'template',
        status: 'ok',
        userId: user.id,
        detail: {
          action: 'update',
          templateId: updatedTemplate.id,
        },
      });
      response.json({ template: serializeUserTemplateRecord(updatedTemplate) });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/account/templates/:templateId', async (request, response, next) => {
    try {
      const template = await userTemplateStore.readTemplateRecord(request.params.templateId);
      const user = requireTemplateOwner(request, template);
      await userTemplateStore.deleteTemplateRecord(request.params.templateId);
      await opsStore.recordEvent({
        type: 'template',
        status: 'ok',
        userId: user.id,
        detail: {
          action: 'delete',
          templateId: template.id,
        },
      });
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/account/templates/:templateId/duplicate', async (request, response, next) => {
    try {
      const template = await userTemplateStore.readTemplateRecord(request.params.templateId);
      const user = requireTemplateOwner(request, template);
      const duplicatedTemplate = await userTemplateStore.duplicateTemplateRecord(request.params.templateId, {
        ownerUserId: user.id,
      });
      await opsStore.recordEvent({
        type: 'template',
        status: 'ok',
        userId: user.id,
        detail: {
          action: 'duplicate',
          templateId: duplicatedTemplate.id,
          sourceTemplateId: template.id,
        },
      });
      response.status(201).json({ template: serializeUserTemplateRecord(duplicatedTemplate) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/account/templates/:templateId/projects', async (request, response, next) => {
    try {
      const template = await userTemplateStore.readTemplateRecord(request.params.templateId);
      const user = requireTemplateOwner(request, template);
      const record = await store.createProjectRecord(
        {
          project: userTemplateStore.materializeTemplateProject(template.templatePayload),
        },
        {
          ownerUserId: user.id,
        },
      );
      await opsStore.recordEvent({
        type: 'project',
        status: 'ok',
        userId: user.id,
        projectId: record.id,
        detail: {
          action: 'create-from-template',
          templateId: template.id,
        },
      });
      response.status(201).json(serializeProjectRecord(record));
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/account/profile', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      const updatedUser = await authStore.updateUserProfile(user.id, request.body ?? {});
      await opsStore.recordEvent({
        type: 'auth',
        status: 'ok',
        userId: updatedUser.id,
        detail: { action: 'update-profile' },
      });
      response.json({ user: authStore.serializeUserRecord(updatedUser) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/account/password', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      const updatedUser = await authStore.changePassword(user.id, request.body?.currentPassword, request.body?.newPassword);
      const session = await authStore.createSession(updatedUser.id);
      response.setHeader('Set-Cookie', serializeSessionCookie(session.id));
      await opsStore.recordEvent({
        type: 'auth',
        status: 'ok',
        userId: updatedUser.id,
        detail: { action: 'change-password' },
      });
      response.json({ user: authStore.serializeUserRecord(updatedUser) });
    } catch (error) {
      next(error);
    }
  });

  app.post(
    '/api/uploads',
    (request, _response, next) => {
      try {
        requireAuthenticated(request);
        next();
      } catch (error) {
        next(error);
      }
    },
    upload.array('files', maxUploadCount),
    async (request, response, next) => {
      try {
        const user = requireAuthenticated(request);
        const files = Array.isArray(request.files) ? request.files : [];
        if (files.length === 0) {
          throw createBadRequest('Choose at least one JPG, PNG, WebP, GIF, or AVIF image.');
        }

        let uploadMetadata = [];
        if (typeof request.body?.assetMeta === 'string') {
          try {
            const parsed = JSON.parse(request.body.assetMeta);
            if (Array.isArray(parsed)) {
              uploadMetadata = parsed;
            }
          } catch {
            uploadMetadata = [];
          }
        }

        const createdAssets = [];
        const cleanupUploadedFiles = async () => {
          await Promise.all(
            files.map(async (file) => {
              await store.removeUploadArtifacts(file.filename).catch(() => null);
              if (objectStorageStore) {
                await objectStorageStore.clearSyncEntry(file.filename).catch(() => null);
              }
            }),
          );
        };

        try {
          await Promise.all(files.map((file) => assertReadableImageFile(file)));

          // Process every file in parallel: variant generation is CPU-bound and
          // the previous serial loop made multi-photo uploads crawl.
          await Promise.all(
            files.map(async (file, index) => {
              const baseAsset = store.createStoredUpload(file, uploadMetadata[index]);
              createdAssets[index] = await store.hydrateStoredUploadAsset(baseAsset, {
                ensureVariants: true,
              });
            }),
          );
        } catch (error) {
          await cleanupUploadedFiles();
          throw mapImageProcessingError(error);
        }

        try {
          await Promise.all(
            createdAssets.map((asset) =>
              assetStore.createAssetRecord(asset, {
                ownerUserId: user.id,
              }),
            ),
          );
        } catch (error) {
          await cleanupUploadedFiles();
          throw error;
        }
        store.invalidateStoreCaches();

        response.status(201).json({
          assets: createdAssets,
        });
        await opsStore.recordEvent({
          type: 'upload',
          status: 'ok',
          userId: user.id,
          detail: { count: files.length },
        });

        // Mirror to object storage in the background. The upload is already
        // usable from local disk; hydration picks up the remote URLs once the
        // sync index flips to "remote". A failed mirror no longer rolls the
        // whole upload back.
        if (objectStorageStore) {
          void (async () => {
            let completed = 0;
            await Promise.all(
              files.map(async (file, index) => {
                const asset = createdAssets[index];
                if (!asset) {
                  return;
                }
                try {
                  const artifacts = await store.getUploadArtifacts(file.filename, {
                    originalWidth: asset.width,
                    originalHeight: asset.height,
                  });
                  if (artifacts?.resources?.original) {
                    await objectStorageStore.syncLocalUpload(file.filename, artifacts);
                    completed += 1;
                  }
                } catch {
                  // Delivery stays "failed" in the sync index and the gallery
                  // offers a retry action.
                }
              }),
            );
            store.invalidateStoreCaches();
            await opsStore
              .recordEvent({
                type: 'upload',
                status: 'ok',
                userId: user.id,
                detail: { action: 'mirror', count: completed },
              })
              .catch(() => null);
          })();
        }
      } catch (error) {
        next(error);
      }
    },
  );

  app.post('/api/uploads/presign', async (request, response, next) => {
    try {
      requireAuthenticated(request);
      if (!objectStorageStore) {
        response.json({ enabled: false });
        return;
      }
      const config = await objectStorageStore.readConfig().catch(() => null);
      if (!config?.enabled) {
        response.json({ enabled: false });
        return;
      }
      const contentType = typeof request.body?.contentType === 'string' ? request.body.contentType : '';
      if (!/^image\/(?:jpeg|png|webp|avif|gif)$/i.test(contentType)) {
        throw createBadRequest('Upload JPG, PNG, WebP, GIF, or AVIF images only.');
      }
      const size = Number(request.body?.size);
      if (!Number.isFinite(size) || size <= 0 || size > maxUploadSizeBytes) {
        throw createBadRequest('The file is too large.');
      }
      const filename = createUploadFilename(
        typeof request.body?.filename === 'string' ? request.body.filename : 'photo.jpg',
      );
      const presigned = await objectStorageStore.createPresignedUpload({ filename, contentType });
      if (!presigned) {
        response.json({ enabled: false });
        return;
      }
      response.json({ enabled: true, filename, contentType, ...presigned });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/uploads/complete', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      if (!objectStorageStore) {
        throw createBadRequest('Direct upload is not available.');
      }
      const filename = String(request.body?.filename ?? '');
      const key = String(request.body?.key ?? '');
      if (!/^[A-Za-z0-9._-]+$/.test(filename)) {
        throw createBadRequest('Invalid upload filename.');
      }
      if (!(key === `uploads/${filename}` || key.endsWith(`/uploads/${filename}`))) {
        throw createBadRequest('Invalid upload key.');
      }
      const head = await objectStorageStore.statObject(key);
      if (!head) {
        throw createBadRequest('The uploaded file was not found.');
      }
      const size = Number(head.ContentLength);
      if (!Number.isFinite(size) || size <= 0 || size > maxUploadSizeBytes) {
        throw createBadRequest('The file is too large.');
      }
      const contentType = typeof head.ContentType === 'string' && head.ContentType ? head.ContentType : 'image/jpeg';
      if (!/^image\//i.test(contentType)) {
        throw createBadRequest('Upload JPG, PNG, WebP, GIF, or AVIF images only.');
      }

      const destination = path.join(store.uploadsDir, filename);
      await objectStorageStore.downloadObjectToFile(key, destination);
      const baseAsset = store.createStoredUpload(
        {
          originalname:
            typeof request.body?.originalName === 'string' && request.body.originalName
              ? request.body.originalName
              : filename,
          filename,
          mimetype: contentType,
          size,
        },
        { width: request.body?.width, height: request.body?.height },
      );
      const asset = await store.hydrateStoredUploadAsset(baseAsset, { ensureVariants: true });
      await assetStore.createAssetRecord(asset, { ownerUserId: user.id });
      store.invalidateStoreCaches();

      response.status(201).json({ assets: [asset] });
      await opsStore.recordEvent({
        type: 'upload',
        status: 'ok',
        userId: user.id,
        detail: { action: 'direct', filename },
      });

      // Variants still need the bucket; the original is already there.
      void (async () => {
        try {
          const artifacts = await store.getUploadArtifacts(filename, {
            originalWidth: asset.width,
            originalHeight: asset.height,
          });
          if (artifacts?.resources?.original) {
            await objectStorageStore.syncLocalUpload(filename, artifacts);
            store.invalidateStoreCaches();
          }
        } catch {
          // Delivery stays failed in the sync index; the gallery offers a retry.
        }
      })();
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/uploads/from-url', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      const rawUrl = typeof request.body?.url === 'string' ? request.body.url.trim() : '';
      if (!rawUrl || rawUrl.length > 2048) {
        throw createBadRequest('Provide a valid image URL.');
      }

      const maxBytes = maxUploadSizeBytes;
      const downloaded = await downloadImageFromUrl(rawUrl, {
        maxBytes,
        uploadsDir: store.uploadsDir,
        idFactory: createId,
      });

      const createdAssets = [];
      try {
        await assertReadableImageFile(downloaded.file);
        const baseAsset = store.createStoredUpload(downloaded.file, {
          width: undefined,
          height: undefined,
        });
        let asset = await store.hydrateStoredUploadAsset(baseAsset, { ensureVariants: true });
        const artifacts = await store.getUploadArtifacts(downloaded.file.filename, {
          originalWidth: asset.width,
          originalHeight: asset.height,
        });

        if (artifacts?.resources?.original && objectStorageStore) {
          try {
            await objectStorageStore.syncLocalUpload(downloaded.file.filename, artifacts);
          } catch (error) {
            const failure = new Error(
              `Remote delivery did not complete. Upload was rolled back. ${error instanceof Error ? error.message : String(error)}`,
            );
            failure.statusCode = 424;
            throw failure;
          }
          asset = await store.hydrateStoredUploadAsset(baseAsset, { ensureVariants: true });
        }
        createdAssets.push(asset);

        await assetStore.createAssetRecord(asset, { ownerUserId: user.id });
        store.invalidateStoreCaches();
      } catch (error) {
        await store.removeUploadArtifacts(downloaded.file.filename).catch(() => null);
        if (objectStorageStore) {
          await objectStorageStore.clearSyncEntry(downloaded.file.filename).catch(() => null);
        }
        throw mapImageProcessingError(error);
      }

      response.status(201).json({
        assets: createdAssets,
      });
      await opsStore.recordEvent({
        type: 'upload',
        status: 'ok',
        userId: user.id,
        detail: { action: 'import-url', count: 1 },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/issues/:shareId', async (request, response, next) => {
    try {
      const record = await store.readProjectRecordByShareId(request.params.shareId);
      response.json(await buildPublicIssuePayload(record));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/projects', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      const search = typeof request.query.search === 'string' ? request.query.search.trim().toLowerCase() : '';
      const visibility = typeof request.query.visibility === 'string' ? request.query.visibility : 'all';
      const projects = (await store.listProjectRecords())
        .filter((record) => record.ownerUserId === user.id)
        .filter((record) => {
          if (visibility === 'active') {
            return !record.archivedAt;
          }
          if (visibility === 'archived') {
            return Boolean(record.archivedAt);
          }
          return true;
        })
        .filter((record) => {
          if (!search) {
            return true;
          }

          return (
            record.id.toLowerCase().includes(search) ||
            record.project.title.toLowerCase().includes(search) ||
            record.project.issue.toLowerCase().includes(search)
          );
        });

      response.json({
        projects: projects.map((record) => serializeProjectRecord(record)),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/projects', async (request, response, next) => {
    try {
      const user = requireAuthenticated(request);
      const record = await store.createProjectRecord(request.body, {
        ownerUserId: user.id,
      });
      await assetStore.touchAssetUsage(collectPlacedAssetIds(record.project));
      await opsStore.recordEvent({
        type: 'project',
        status: 'ok',
        userId: user.id,
        projectId: record.id,
        detail: { action: 'create' },
      });
      response.status(201).json(serializeProjectRecord(record));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/projects/:projectId/duplicate', async (request, response, next) => {
    try {
      const existingRecord = await store.readProjectRecord(request.params.projectId);
      const user = requireProjectDuplicateAccess(request, existingRecord);
      const clonedProject = {
        ...existingRecord.project,
        title: `${existingRecord.project.title} Copy`.slice(0, defaultTextLimits.projectTitle),
      };
      const duplicatedRecord = await store.createProjectRecord(
        {
          project: clonedProject,
        },
        {
          ownerUserId: user.id,
        },
      );
      await assetStore.touchAssetUsage(collectPlacedAssetIds(duplicatedRecord.project));
      await opsStore.recordEvent({
        type: 'project',
        status: 'ok',
        userId: user.id,
        projectId: duplicatedRecord.id,
        detail: {
          action: 'duplicate',
          sourceProjectId: existingRecord.id,
        },
      });
      response.status(201).json(serializeProjectRecord(duplicatedRecord));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/projects/:projectId', async (request, response, next) => {
    try {
      const projectId = sanitizeProjectId(request.params.projectId);
      const record = await store.readProjectRecord(projectId);
      requireProjectReadAccess(request, record);
      response.json({
        ...serializeProjectRecord(record),
        project: {
          ...record.project,
          assets: await hydrateAssets(record.project.assets),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/projects/:projectId/share', async (request, response, next) => {
    try {
      const record = await store.readProjectRecord(request.params.projectId);
      const user = requireProjectMutationAccess(request, record);
      const sharedRecord = await store.updateProjectShareRecord(request.params.projectId, {
        enable: true,
        rotate: request.body?.rotate === true,
      });
      await opsStore.recordEvent({
        type: 'share',
        status: 'ok',
        userId: user.id,
        projectId: sharedRecord.id,
        detail: {
          action: request.body?.rotate === true ? 'regenerate' : 'enable',
          shareId: sharedRecord.share?.shareId ?? null,
        },
      });
      response.json(serializeProjectRecord(sharedRecord));
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/projects/:projectId/share', async (request, response, next) => {
    try {
      const record = await store.readProjectRecord(request.params.projectId);
      const user = requireProjectMutationAccess(request, record);
      const sharedRecord = await store.updateProjectShareRecord(request.params.projectId, {
        enable: false,
      });
      await opsStore.recordEvent({
        type: 'share',
        status: 'ok',
        userId: user.id,
        projectId: sharedRecord.id,
        detail: {
          action: 'disable',
          shareId: sharedRecord.share?.shareId ?? null,
        },
      });
      response.json(serializeProjectRecord(sharedRecord));
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/projects/:projectId', async (request, response, next) => {
    try {
      const existingRecord = await store.readProjectRecord(request.params.projectId);
      const user = requireProjectMutationAccess(request, existingRecord);
      const expectedRev = Number(request.body?.expectedRev);
      if (Number.isInteger(expectedRev) && expectedRev !== existingRecord.rev) {
        const error = new Error(
          'This folio was updated in another tab or on another device. Reload it to see the latest version before saving.',
        );
        error.statusCode = 409;
        error.code = 'revision_conflict';
        error.details = { rev: existingRecord.rev };
        throw error;
      }
      const record = await updateProjectRecordPreservingAssets(request.params.projectId, request.body);
      const isAutosave = request.body?.autosave === true;
      await opsStore.recordEvent({
        type: 'project',
        status: 'ok',
        userId: user.id,
        projectId: record.id,
        detail: { action: isAutosave ? 'autosave' : 'update' },
        dedupeKey: isAutosave ? `project-autosave:${record.id}` : null,
        dedupeWindowMs: isAutosave ? 10 * 60 * 1000 : 0,
      });
      response.json({
        ...serializeProjectRecord(record),
        project: {
          ...record.project,
          assets: await hydrateAssets(record.project.assets),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/projects/:projectId', async (request, response, next) => {
    try {
      const existingRecord = await store.readProjectRecord(request.params.projectId);
      const user = requireProjectMutationAccess(request, existingRecord);
      const nextArchivedAt =
        request.body?.archive === true ? new Date().toISOString() : request.body?.unarchive === true ? null : undefined;
      const record = await patchProjectRecordPreservingAssets(request.params.projectId, {
        archivedAt: nextArchivedAt,
        project: request.body?.project ?? {},
      });
      const action =
        nextArchivedAt === undefined
          ? 'rename'
          : nextArchivedAt
            ? 'archive'
            : 'unarchive';
      await opsStore.recordEvent({
        type: 'project',
        status: 'ok',
        userId: user.id,
        projectId: record.id,
        detail: { action },
      });
      response.json(serializeProjectRecord(record));
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/projects/:projectId', async (request, response, next) => {
    try {
      const projectId = sanitizeProjectId(request.params.projectId);
      const record = await store.readProjectRecord(projectId);
      const user = requireProjectMutationAccess(request, record);
      await deleteProjectRecordPreservingAssets(record);
      await cleanupUnreferencedAssetsFromProject(record);
      await opsStore.recordEvent({
        type: 'project',
        status: 'ok',
        userId: user.id,
        projectId,
        detail: { action: 'delete' },
      });
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/assets/:assetId', async (request, response, next) => {
    try {
      const assetId = String(request.params.assetId ?? '').trim();
      const assetRecord = await assetStore.readAssetRecord(assetId);
      const user = requireAssetOwner(request, assetRecord);
      const references = await collectAssetProjectReferences(assetId);
      // Deleting a library photo also strips it from every folio its owner
      // keeps, clearing the frames it filled. Foreign or legacy ownerless
      // folios still block the deletion, matching mutation governance.
      const foreignReferences = [];
      for (const reference of references) {
        const record = await store.readProjectRecord(reference.projectId);
        if (!record) {
          continue;
        }
        if (record.ownerUserId !== user.id) {
          foreignReferences.push(reference);
        }
      }
      if (foreignReferences.length > 0) {
        const error = new Error('Asset is still referenced by one or more projects.');
        error.statusCode = 409;
        error.details = foreignReferences;
        throw error;
      }

      for (const reference of references) {
        const record = await store.readProjectRecord(reference.projectId).catch(() => null);
        if (!record) {
          continue;
        }
        const nextProject = {
          ...record.project,
          assets: record.project.assets.filter((entry) => entry.id !== assetId),
          pages: record.project.pages.map((page) => {
            let changed = false;
            const nextSlots = Object.fromEntries(
              Object.entries(page.slots).map(([slot, currentAssetId]) => {
                if (currentAssetId !== assetId) {
                  return [slot, currentAssetId];
                }
                changed = true;
                return [slot, null];
              }),
            );
            return changed ? { ...page, slots: nextSlots } : page;
          }),
        };
        await updateProjectRecordPreservingAssets(record.id, { project: nextProject });
        await opsStore.recordEvent({
          type: 'project',
          status: 'ok',
          userId: user.id,
          projectId: record.id,
          detail: { action: 'delete-asset', assetId },
        });
      }

      await cleanupAssetIfUnused(assetId, assetRecord.src);
      await opsStore.recordEvent({
        type: 'upload',
        status: 'ok',
        userId: user.id,
        detail: { action: 'delete', assetId },
      });
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/assets/:assetId/object-storage/retry', async (request, response, next) => {
    try {
      const assetId = String(request.params.assetId ?? '').trim();
      const assetRecord = await assetStore.readAssetRecord(assetId);
      const user = requireAssetOwner(request, assetRecord);
      const filename = getUploadFilenameFromPath(assetRecord.src);
      if (!filename) {
        throw createBadRequest('This asset does not map to a stored upload file.');
      }

      const objectStorageConfig = await objectStorageStore.readConfig();
      if (!objectStorageConfig.enabled) {
        throw createBadRequest('Enable remote delivery before retrying upload mirroring.');
      }

      const artifacts = await store.getUploadArtifacts(filename, {
        ensureVariants: true,
        originalWidth: assetRecord.width ?? undefined,
        originalHeight: assetRecord.height ?? undefined,
      });
      if (!artifacts?.resources?.original) {
        throw createBadRequest('Upload artifacts are incomplete for object storage sync.');
      }

      await objectStorageStore.markUploadPending(filename);
      queueObjectStorageUploadSync(user.id, [{ filename, artifacts }]);
      store.invalidateStoreCaches();
      await opsStore.recordEvent({
        type: 'upload',
        status: 'ok',
        userId: user.id,
        detail: {
          action: 'retry-object-storage-sync',
          assetId,
          filename,
        },
      });
      response.status(202).json({
        asset: await store.hydrateStoredUploadAsset(assetRecord, { ensureVariants: true }),
      });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/projects/:projectId/assets/:assetId', async (request, response, next) => {
    try {
      const projectId = sanitizeProjectId(request.params.projectId);
      const assetId = String(request.params.assetId ?? '').trim();
      const record = await store.readProjectRecord(projectId);
      const user = requireProjectMutationAccess(request, record);
      const asset = record.project.assets.find((entry) => entry.id === assetId);
      if (!asset) {
        const error = new Error('Asset not found in this project.');
        error.statusCode = 404;
        throw error;
      }

      const slotReferences = [];
      record.project.pages.forEach((page, pageIndex) => {
        Object.entries(page.slots).forEach(([slot, currentAssetId]) => {
          if (currentAssetId === assetId) {
            slotReferences.push({
              pageId: page.id,
              pageIndex,
              pageTitle: page.title,
              slot,
            });
          }
        });
      });

      if (slotReferences.length > 0) {
        const error = new Error('Asset is still placed on one or more pages.');
        error.statusCode = 409;
        error.details = slotReferences;
        throw error;
      }

      const nextProject = {
        ...record.project,
        assets: record.project.assets.filter((entry) => entry.id !== assetId),
      };
      const updatedRecord = await updateProjectRecordPreservingAssets(projectId, { project: nextProject });
      await opsStore.recordEvent({
        type: 'project',
        status: 'ok',
        userId: user.id,
        projectId,
        detail: { action: 'delete-asset', assetId },
      });
      response.json(serializeProjectRecord(updatedRecord));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/exports', async (request, response, next) => {
    try {
      await securityStore.consumeRateLimit({
        ...EXPORT_EVENT_IP_RATE_LIMIT,
        key: resolveClientIp(request),
      });
      const trimmedText = (value, maxLength) =>
        typeof value === 'string' ? value.trim().slice(0, maxLength) : null;
      const status =
        request.body?.status === 'error'
          ? 'error'
          : request.body?.status === 'requested'
            ? 'requested'
            : 'ok';
      await opsStore.recordEvent({
        type: 'export',
        status,
        userId: request.auth?.user?.id ?? null,
        projectId: typeof request.body?.projectId === 'string' ? request.body.projectId.slice(0, 80) : null,
        detail: {
          reason: trimmedText(request.body?.reason, 200),
          format: trimmedText(request.body?.format, 32),
          pageSize: trimmedText(request.body?.pageSize, 32),
          quality: trimmedText(request.body?.quality, 32),
          fileSizePreference: trimmedText(request.body?.fileSizePreference, 32),
        },
      });
      response.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/product-config', async (request, response, next) => {
    try {
      requireAdmin(request);
      const [siteContent, templateGovernance, uploadInventory, aiConfig] = await Promise.all([
        siteStore.readSiteContent(),
        siteStore.readTemplateGovernance(),
        store.collectUploadInventory(),
        aiStore.readAdminConfig(),
      ]);
      const objectStorage = await objectStorageStore.readAdminConfig(uploadInventory);
      const homepagePreview = await buildHomepagePreviewPayload(siteContent);
      response.json({
        siteContent,
        templateGovernance,
        ai: aiConfig,
        homepagePreview,
        objectStorage: {
          ...objectStorage,
          syncStats: {
            mirroredUploads: objectStorage.syncStats.mirroredUploads,
            pendingUploads: objectStorage.syncStats.pendingUploads,
            failedUploads: objectStorage.syncStats.failedUploads,
            localOnlyUploads: objectStorage.syncStats.localOnlyUploads,
            latestSyncAt: objectStorage.syncStats.latestSyncAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/admin/product-config/site-content', async (request, response, next) => {
    try {
      const user = requireAdmin(request);
      const draft = request.body?.siteContent ?? request.body;
      if (draft?.featuredIssue?.projectId) {
        await store.readProjectRecord(draft.featuredIssue.projectId);
      }
      const siteContent = await siteStore.updateSiteContent(draft);
      await opsStore.recordEvent({
        type: 'admin',
        status: 'ok',
        userId: user.id,
        detail: { action: 'update-site-content' },
      });
      response.json({ siteContent });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/admin/product-config/template-governance', async (request, response, next) => {
    try {
      const user = requireAdmin(request);
      const templateGovernance = await siteStore.updateTemplateGovernance(request.body?.templateGovernance ?? request.body);
      await opsStore.recordEvent({
        type: 'admin',
        status: 'ok',
        userId: user.id,
        detail: { action: 'update-template-governance' },
      });
      response.json({ templateGovernance });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/admin/product-config/ai', async (request, response, next) => {
    try {
      const user = requireAdmin(request);
      const ai = await aiStore.updateConfig(request.body?.ai ?? request.body);
      await opsStore.recordEvent({
        type: 'admin',
        status: 'ok',
        userId: user.id,
        detail: { action: 'update-ai-config' },
      });
      response.json({ ai });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/product-config/ai/usage', async (request, response, next) => {
    try {
      requireAdmin(request);
      const [users, usage] = await Promise.all([authStore.listUsers(), aiStore.readUsageForAdmin()]);
      response.json({
        users: users
          .map((user) => ({
            userId: user.id,
            email: user.email,
            username: user.username ?? null,
            role: user.role,
            status: user.status,
            usage: usage[user.id] ?? { total: 0, daily: 0, day: null, updatedAt: null },
          }))
          .sort((a, b) => b.usage.total - a.usage.total || String(a.email).localeCompare(String(b.email))),
      });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/admin/product-config/ai/usage/:userId', async (request, response, next) => {
    try {
      const adminUser = requireAdmin(request);
      const targetUser = await authStore.readUser(request.params.userId);
      const usage = await aiStore.setUserUsage(targetUser.id, request.body ?? {});
      await opsStore.recordEvent({
        type: 'admin',
        status: 'ok',
        userId: adminUser.id,
        detail: {
          action: 'update-ai-usage',
          targetUserId: targetUser.id,
          total: usage?.total ?? null,
          daily: usage?.daily ?? null,
        },
      });
      response.json({ userId: targetUser.id, usage });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/product-config/ai/test', async (request, response, next) => {
    try {
      const user = requireAdmin(request);
      const result = await aiStore.testProvider({
        providerId: request.body?.providerId,
        provider: request.body?.provider,
      });
      await opsStore.recordEvent({
        type: 'admin',
        status: 'ok',
        userId: user.id,
        detail: { action: 'test-ai-provider', providerId: request.body?.providerId ?? null },
      });
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/product-config/object-storage/test', async (request, response, next) => {
    try {
      const user = requireAdmin(request);
      const result = await objectStorageStore.testConfig(request.body?.objectStorage ?? request.body);
      await opsStore.recordEvent({
        type: 'admin',
        status: 'ok',
        userId: user.id,
        detail: { action: 'test-object-storage' },
      });
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/admin/product-config/object-storage', async (request, response, next) => {
    try {
      const user = requireAdmin(request);
      await objectStorageStore.updateConfig(request.body?.objectStorage ?? request.body, {
        userId: user.id,
        confirmed: request.body?.confirmed === true,
      });
      const uploadInventory = await store.collectUploadInventory();
      const objectStorage = await objectStorageStore.readAdminConfig(uploadInventory);
      await opsStore.recordEvent({
        type: 'admin',
        status: 'ok',
        userId: user.id,
        detail: { action: 'update-object-storage' },
      });
      response.json({ objectStorage });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/product-config/object-storage/sync', async (request, response, next) => {
    try {
      const user = requireAdmin(request);
      const result = await syncHistoricalUploadsToObjectStorage({
        force: request.body?.force === true,
      });
      await opsStore.recordEvent({
        type: 'admin',
        status: result.failed.length ? 'error' : 'ok',
        userId: user.id,
        detail: {
          action: 'sync-object-storage',
          synced: result.synced,
          failed: result.failed.length,
        },
      });
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/product-config/object-storage/restore', async (request, response, next) => {
    try {
      const user = requireAdmin(request);
      const result = await restoreRemoteUploadsToLocal({
        detach: request.body?.detach !== false,
      });
      await opsStore.recordEvent({
        type: 'admin',
        status: result.failed.length ? 'error' : 'ok',
        userId: user.id,
        detail: {
          action: 'restore-object-storage-local',
          restoredFiles: result.restoredFiles,
          detachedUploads: result.detachedUploads,
          failed: result.failed.length,
        },
      });
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/summary', async (request, response, next) => {
    try {
      requireAdmin(request);
      const [users, projects, uploadInventory, eventSummary] = await Promise.all([
        authStore.listUsers(),
        store.listProjectRecords(),
        store.collectUploadInventory(),
        opsStore.summarizeEvents(),
      ]);

      response.json({
        counts: {
          users: users.length,
          projects: projects.length,
          uploads: uploadInventory.totals.uploadCount,
          exports: eventSummary.exportCount,
        },
        storage: {
          uploadBytes: uploadInventory.totals.totalBytes,
          originalBytes: uploadInventory.totals.originalBytes,
          derivedBytes: uploadInventory.totals.derivedBytes,
          totalBytes: uploadInventory.totals.totalBytes,
        },
        failureCounts: eventSummary.failureCounts,
        eventTypeBreakdown: eventSummary.typeBreakdown,
        recentActivity: users
          .filter((user) => user.lastActiveAt)
          .sort((left, right) => String(right.lastActiveAt).localeCompare(String(left.lastActiveAt)))
          .slice(0, 10)
          .map((user) => authStore.serializeUserRecord(user)),
        failures: eventSummary.recentFailures,
        events: eventSummary.recentEvents,
        trends: eventSummary.trends,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/users', async (request, response, next) => {
    try {
      requireAdmin(request);
      const search = typeof request.query.search === 'string' ? request.query.search.trim().toLowerCase() : '';
      const users = await authStore.listUsers();
      const filteredUsers = search
        ? users.filter((user) => user.email.includes(search) || user.id.includes(search) || (user.username ?? '').includes(search))
        : users;
      response.json({
        users: filteredUsers.map((user) => authStore.serializeUserRecord(user)),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/users', async (request, response, next) => {
    try {
      const adminUser = requireAdmin(request);
      const user = await authStore.createManagedUser(request.body ?? {});
      await opsStore.recordEvent({
        type: 'admin',
        status: 'ok',
        userId: adminUser.id,
        detail: {
          action: 'create-user',
          createdUserId: user.id,
          createdUserRole: user.role,
        },
      });
      response.status(201).json({ user: authStore.serializeUserRecord(user) });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/admin/users/:userId', async (request, response, next) => {
    try {
      const adminUser = requireAdmin(request);
      const targetUser = await authStore.readUser(request.params.userId);
      const nextStatus = request.body?.status;

      if (adminUser.id === targetUser.id && nextStatus === 'disabled') {
        throw createBadRequest('The current administrator cannot disable the active session account.');
      }

      if (targetUser.role === 'admin' && targetUser.status === 'active' && nextStatus === 'disabled') {
        const users = await authStore.listUsers();
        const activeAdminCount = users.filter((user) => user.role === 'admin' && user.status === 'active').length;
        if (activeAdminCount <= 1) {
          throw createBadRequest('At least one active administrator must remain enabled.');
        }
      }

      const user = await authStore.updateUserStatus(request.params.userId, nextStatus);
      await opsStore.recordEvent({
        type: 'admin',
        status: 'ok',
        userId: adminUser.id,
        detail: {
          action: 'update-user-status',
          targetUserId: user.id,
          status: user.status,
        },
      });
      response.json({ user: authStore.serializeUserRecord(user) });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/admin/users/:userId', async (request, response, next) => {
    try {
      const adminUser = requireAdmin(request);
      const targetUser = await authStore.readUser(request.params.userId);

      if (adminUser.id === targetUser.id) {
        throw createBadRequest('The current administrator cannot delete the active session account.');
      }

      if (targetUser.role === 'admin' && targetUser.status === 'active') {
        const users = await authStore.listUsers();
        const remainingActiveAdminCount = users.filter(
          (user) => user.role === 'admin' && user.status === 'active' && user.id !== targetUser.id,
        ).length;
        if (remainingActiveAdminCount < 1) {
          throw createBadRequest('At least one active administrator must remain enabled.');
        }
      }

      const summary = await deleteOwnedContentForUser(targetUser.id);
      await authStore.deleteUser(targetUser.id);
      await opsStore.recordEvent({
        type: 'admin',
        status: 'ok',
        userId: adminUser.id,
        detail: {
          action: 'delete-user',
          targetUserId: targetUser.id,
          deletedProjectCount: summary.deletedProjectCount,
          deletedTemplateCount: summary.deletedTemplateCount,
          deletedUploadCount: summary.deletedUploadCount,
          retainedUploadCount: summary.retainedUploadCount,
        },
      });
      response.json({ deleted: true, summary });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/projects', async (request, response, next) => {
    try {
      requireAdmin(request);
      const search = typeof request.query.search === 'string' ? request.query.search.trim().toLowerCase() : '';
      const [projects, users] = await Promise.all([store.listProjectRecords(), authStore.listUsers()]);
      const usersById = Object.fromEntries(users.map((user) => [user.id, user]));
      const userEmailById = Object.fromEntries(users.map((user) => [user.id, user.email]));
      const userDisplayById = Object.fromEntries(users.map((user) => [user.id, getUserDisplayIdentity(user)]));
      const userUsernameById = Object.fromEntries(users.map((user) => [user.id, user.username ?? null]));
      const filteredProjects = search
        ? projects.filter((record) => {
            const ownerEmail = record.ownerUserId ? userEmailById[record.ownerUserId] ?? '' : '';
            const ownerDisplay = record.ownerUserId ? userDisplayById[record.ownerUserId] ?? '' : '';
            return (
              record.id.toLowerCase().includes(search) ||
              record.project.title.toLowerCase().includes(search) ||
              record.project.issue.toLowerCase().includes(search) ||
              ownerEmail.toLowerCase().includes(search) ||
              ownerDisplay.toLowerCase().includes(search)
            );
          })
        : projects;

      response.json({
        projects: filteredProjects.map((record) => {
          const metrics = buildProjectMetrics(record);
          const share = serializeProjectShare(record.share);
          const ownerUser = record.ownerUserId ? usersById[record.ownerUserId] ?? null : null;
          return {
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            sharePath: createSharePath(record.id),
            publicSharePath: share.path,
            title: record.project.title,
            issue: record.project.issue,
            ownerEmail: record.ownerUserId ? userEmailById[record.ownerUserId] ?? null : null,
            ownerUsername: record.ownerUserId ? userUsernameById[record.ownerUserId] ?? null : null,
            ownerDisplay: ownerUser ? getUserDisplayIdentity(ownerUser) : null,
            ownerUserId: record.ownerUserId ?? null,
            health: getProjectHealth(metrics),
            metrics,
          };
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/projects/:projectId', async (request, response, next) => {
    try {
      requireAdmin(request);
      const projectId = sanitizeProjectId(request.params.projectId);
      const [record, users, eventSummary] = await Promise.all([
        store.readProjectRecord(projectId),
        authStore.listUsers(),
        opsStore.summarizeEvents(),
      ]);
      const usersById = Object.fromEntries(users.map((user) => [user.id, user]));
      const userEmailById = Object.fromEntries(users.map((user) => [user.id, user.email]));
      const userUsernameById = Object.fromEntries(users.map((user) => [user.id, user.username ?? null]));
      const metrics = buildProjectMetrics(record);
      const preview = await buildProjectPreview(record);
      const share = serializeProjectShare(record.share);
      const ownerUser = record.ownerUserId ? usersById[record.ownerUserId] ?? null : null;

      response.json({
        project: {
          id: record.id,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          sharePath: createSharePath(record.id),
          publicSharePath: share.path,
          title: record.project.title,
          subtitle: record.project.subtitle,
          issue: record.project.issue,
          frameRadius: record.project.frameRadius,
          ownerEmail: record.ownerUserId ? userEmailById[record.ownerUserId] ?? null : null,
          ownerUsername: record.ownerUserId ? userUsernameById[record.ownerUserId] ?? null : null,
          ownerDisplay: ownerUser ? getUserDisplayIdentity(ownerUser) : null,
          ownerUserId: record.ownerUserId ?? null,
          health: getProjectHealth(metrics),
          metrics,
          preview,
          recentEvents: eventSummary.recentEvents.filter((event) => event.projectId === record.id).slice(0, 6),
          recentFailures: eventSummary.recentFailures.filter((failure) => failure.projectId === record.id).slice(0, 4),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/admin/projects/:projectId', async (request, response, next) => {
    try {
      const user = requireAdmin(request);
      const projectId = sanitizeProjectId(request.params.projectId);
      const record = await store.readProjectRecord(projectId);
      await deleteProjectRecordPreservingAssets(record);
      await cleanupUnreferencedAssetsFromProject(record);
      await opsStore.recordEvent({
        type: 'project',
        status: 'ok',
        userId: user.id,
        projectId,
        detail: { action: 'admin-delete' },
      });
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/uploads', async (request, response, next) => {
    try {
      requireAdmin(request);
      const search = typeof request.query.search === 'string' ? request.query.search.trim().toLowerCase() : '';
      const [inventory, projects, assetRecords, users] = await Promise.all([
        store.collectUploadInventory(),
        store.listProjectRecords(),
        assetStore.listAssetRecords({ includeDeleted: true }),
        authStore.listUsers(),
      ]);
      const projectById = Object.fromEntries(
        projects.map((record) => [
          record.id,
          {
            id: record.id,
            title: record.project.title,
            issue: record.project.issue,
            ownerUserId: record.ownerUserId,
          },
        ]),
      );
      const uploadReferenceSummary = buildUploadReferenceSummary(projects);
      const userEmailById = Object.fromEntries(users.map((user) => [user.id, user.email]));
      const userDisplayById = Object.fromEntries(users.map((user) => [user.id, getUserDisplayIdentity(user)]));
      const assetRecordsByFilename = assetRecords.reduce((records, record) => {
        const filename = getUploadFilenameFromPath(record.src);
        if (!filename) {
          return records;
        }

        if (!records[filename]) {
          records[filename] = [];
        }
        records[filename].push(record);
        return records;
      }, {});
      const items = inventory.items
        .map((item) => {
          const relatedRecords = assetRecordsByFilename[item.filename] ?? [];
          const relatedOwners = Array.from(
            new Set(relatedRecords.map((record) => record.ownerUserId).filter((value) => typeof value === 'string')),
          );
          const firstSizedRecord = relatedRecords.find((record) => typeof record.width === 'number' && typeof record.height === 'number') ?? null;
          const referenceSummary = uploadReferenceSummary.get(item.filename) ?? {
            referencedProjectIds: new Set(item.referencedByProjectIds),
            pageCount: 0,
          };
          const referencedProjectTitles = item.referencedByProjectIds.map((projectId) => projectById[projectId]?.title ?? projectId);

          return {
            filename: item.filename,
            src: item.src,
            original: item.original,
            preview: item.preview,
            thumb: item.thumb,
            delivery: item.delivery,
            bytes: item.bytes,
            width: firstSizedRecord?.width ?? item.original?.width ?? null,
            height: firstSizedRecord?.height ?? item.original?.height ?? null,
            ownerEmails: relatedOwners.map((userId) => userEmailById[userId] ?? userId),
            ownerDisplayNames: relatedOwners.map((userId) => userDisplayById[userId] ?? userEmailById[userId] ?? userId),
            referencedProjectCount: item.referencedByProjectIds.length,
            referencedProjectTitles,
          };
        })
        .filter((item) => {
          if (!search) {
            return true;
          }

          return (
            item.filename.toLowerCase().includes(search) ||
            item.src.toLowerCase().includes(search) ||
            item.ownerEmails.some((email) => email.toLowerCase().includes(search)) ||
            item.ownerDisplayNames.some((identity) => identity.toLowerCase().includes(search)) ||
            item.referencedProjectTitles.some((title) => title.toLowerCase().includes(search))
          );
        });

      response.json({
        uploads: items,
        totals: inventory.totals,
        missingReferencedFiles: inventory.missingReferencedFiles,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/uploads/:filename', async (request, response, next) => {
    try {
      requireAdmin(request);
      const filename = path.basename(request.params.filename);
      const [inventory, projects, assetRecords, users] = await Promise.all([
        store.collectUploadInventory(),
        store.listProjectRecords(),
        assetStore.listAssetRecords({ includeDeleted: true }),
        authStore.listUsers(),
      ]);
      const item = inventory.items.find((entry) => entry.filename === filename);
      if (!item) {
        const error = new Error('Upload not found.');
        error.statusCode = 404;
        throw error;
      }

      const projectById = Object.fromEntries(
        projects.map((record) => [
          record.id,
          {
            id: record.id,
            title: record.project.title,
            issue: record.project.issue,
            ownerUserId: record.ownerUserId,
          },
        ]),
      );
      const uploadDetailIndex = buildUploadDetailIndex(projects);
      const userEmailById = Object.fromEntries(users.map((user) => [user.id, user.email]));
      const userDisplayById = Object.fromEntries(users.map((user) => [user.id, getUserDisplayIdentity(user)]));
      const relatedRecords = assetRecords.filter((record) => getUploadFilenameFromPath(record.src) === filename);
      const relatedOwners = Array.from(
        new Set(relatedRecords.map((record) => record.ownerUserId).filter((value) => typeof value === 'string')),
      );
      const referencedPages = uploadDetailIndex.get(filename) ?? [];
      const firstSizedRecord = relatedRecords.find((record) => typeof record.width === 'number' && typeof record.height === 'number') ?? null;

      response.json({
        upload: {
          filename: item.filename,
          src: item.src,
          original: item.original,
          preview: item.preview,
          thumb: item.thumb,
          delivery: item.delivery,
          bytes: item.bytes,
          derivedBytes: item.derivedBytes,
          totalBytes: item.totalBytes,
          uploadedAt: item.uploadedAt,
          ageHours: item.ageHours,
          ageMs: item.ageMs,
          width: firstSizedRecord?.width ?? item.original?.width ?? null,
          height: firstSizedRecord?.height ?? item.original?.height ?? null,
          assetIds: relatedRecords.map((record) => record.id),
          assetRecordCount: relatedRecords.length,
          ownerUserIds: relatedOwners,
          ownerEmails: relatedOwners.map((userId) => userEmailById[userId] ?? userId),
          ownerDisplayNames: relatedOwners.map((userId) => userDisplayById[userId] ?? userEmailById[userId] ?? userId),
          referencedProjectIds: item.referencedByProjectIds,
          referencedProjectCount: item.referencedByProjectIds.length,
          referencedProjects: item.referencedByProjectIds.map((projectId) => projectById[projectId] ?? { id: projectId }),
          referencedPages,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/uploads/:filename/object-storage/retry', async (request, response, next) => {
    try {
      const user = requireAdmin(request);
      const filename = path.basename(request.params.filename);
      const objectStorageConfig = await objectStorageStore.readConfig();
      if (!objectStorageConfig.enabled) {
        throw createBadRequest('Enable remote delivery before retrying upload mirroring.');
      }

      const inventory = await store.collectUploadInventory();
      const item = inventory.items.find((entry) => entry.filename === filename);
      if (!item) {
        const error = new Error('Upload not found.');
        error.statusCode = 404;
        throw error;
      }

      const artifacts = await store.getUploadArtifacts(filename, {
        ensureVariants: true,
        originalWidth: item.original?.width ?? undefined,
        originalHeight: item.original?.height ?? undefined,
      });
      if (!artifacts?.resources?.original) {
        throw createBadRequest('Upload artifacts are incomplete for object storage sync.');
      }

      await objectStorageStore.markUploadPending(filename);
      queueObjectStorageUploadSync(user.id, [{ filename, artifacts }]);
      store.invalidateStoreCaches();
      await opsStore.recordEvent({
        type: 'upload',
        status: 'ok',
        userId: user.id,
        detail: {
          action: 'admin-retry-object-storage-sync',
          filename,
        },
      });
      response.status(202).json({ queued: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/admin/uploads/:filename', async (request, response, next) => {
    try {
      requireAdmin(request);
      const filename = path.basename(request.params.filename);
      const inventory = await store.collectUploadInventory();
      const item = inventory.items.find((entry) => entry.filename === filename);
      if (!item) {
        const error = new Error('Upload not found.');
        error.statusCode = 404;
        throw error;
      }

      if (item.referencedByProjectIds.length > 0) {
        const error = new Error('Upload is still referenced by one or more projects.');
        error.statusCode = 409;
        throw error;
      }

      const assetRecords = await assetStore.listAssetRecords({ includeDeleted: true });
      await Promise.all(
        assetRecords
          .filter((record) => getUploadFilenameFromPath(record.src) === filename)
          .map((record) => assetStore.markAssetDeleted(record.id).catch(() => null)),
      );
      await store.removeUploadArtifacts(filename);
      store.invalidateStoreCaches();
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', (request, response) => {
    response.status(404).json({ error: 'Not found.' });
  });

  app.use(
    '/uploads',
    express.static(store.uploadsDir, {
      fallthrough: false,
      immutable: true,
      maxAge: '30d',
    }),
  );

  app.use(
    express.static(distDir, {
      index: false,
      setHeaders: (response, filePath) => {
        if (
          filePath.endsWith('.html') ||
          filePath.endsWith('favicon.svg') ||
          filePath.endsWith('apple-touch-icon.png') ||
          filePath.endsWith('site.webmanifest') ||
          filePath.endsWith('icon-192.png') ||
          filePath.endsWith('icon-512.png') ||
          filePath.endsWith('app-icon-192.png') ||
          filePath.endsWith('app-icon-512.png') ||
          filePath.endsWith('app-icon.svg')
        ) {
          response.setHeader('Cache-Control', 'no-cache');
          return;
        }

        response.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      },
    }),
  );

  app.use(async (request, response, next) => {
    if (!['GET', 'HEAD'].includes(request.method) || request.path.startsWith('/api/') || request.path.startsWith('/uploads/')) {
      return next();
    }

    try {
      await fs.access(indexFile);
      const indexHtml = await fs.readFile(indexFile, 'utf8');
      // The HTML changes on every build (asset hashes), so its hash doubles as a
      // deploy id. The client renders it so a stale tab can be spotted at a glance.
      const buildId = crypto.createHash('sha256').update(indexHtml).digest('hex').slice(0, 12);
      const taggedHtml = indexHtml.includes('name="ff-build"')
        ? indexHtml
        : indexHtml.replace('</head>', `<meta name="ff-build" content="${buildId}">\n</head>`);
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader('Cache-Control', 'public, max-age=0');
      response.send(taggedHtml);
    } catch (error) {
      next(error);
    }
  });

  app.use((error, request, response, _next) => {
    if (error instanceof multer.MulterError) {
      response.status(400).json({ error: error.message });
      void opsStore.recordEvent({
        type: 'upload',
        status: 'error',
        userId: request.auth?.user?.id ?? null,
        detail: { path: request.path, message: error.message },
      });
      return;
    }

    if (error instanceof SyntaxError && error && typeof error === 'object' && 'body' in error) {
      response.status(400).json({ error: 'Request body must be valid JSON.' });
      return;
    }

    const isMissingFile = error?.code === 'ENOENT';
    const explicitStatus =
      typeof error?.statusCode === 'number'
        ? error.statusCode
        : typeof error?.status === 'number'
          ? error.status
          : null;
    const statusCode = explicitStatus ?? (isMissingFile ? 404 : 500);
    const message =
      statusCode >= 500 && !error?.expose
        ? 'Internal server error.'
        : isMissingFile
          ? 'Not found.'
          : error.message;
    if (typeof error?.retryAfterSeconds === 'number' && Number.isFinite(error.retryAfterSeconds) && error.retryAfterSeconds > 0) {
      response.setHeader('Retry-After', String(Math.ceil(error.retryAfterSeconds)));
    }
    if (statusCode >= 500) {
      console.error(error);
    }
    const isNoisyNotFound = statusCode === 404 && !request.path.startsWith('/api/');
    if (
      statusCode >= 400 &&
      error?.code !== 'revision_conflict' &&
      error?.code !== 'rate_limited' &&
      !isNoisyNotFound
    ) {
      const failureType = request.path.startsWith('/api/uploads')
        ? 'upload'
        : request.path.startsWith('/api/auth')
          ? 'auth'
          : request.path.startsWith('/api/exports')
            ? 'export'
            : request.path.startsWith('/api/projects')
              ? 'project'
              : 'request';
      void opsStore.recordEvent({
        type: failureType,
        status: 'error',
        userId: request.auth?.user?.id ?? null,
        detail: { path: request.path, message: error.message },
      });
    }
    response.status(statusCode).json({
      error: message,
      ...(typeof error?.code === 'string' && !isMissingFile && statusCode < 500 ? { code: error.code } : {}),
      ...(typeof error?.termsVersion === 'string' ? { termsVersion: error.termsVersion } : {}),
      ...(error?.details && typeof error.details === 'object' ? { details: error.details } : {}),
    });
  });

  async function start() {
    await store.ensureDataDirectories();
    await assetStore.ensureAssetDirectory();
    await authStore.ensureAuthDirectories();
    await opsStore.ensureOpsDirectory();
    await securityStore.ensureSecurityDirectories();
    await opsStore.pruneOldEvents({ days: Number(process.env.FINALFOLIO_EVENT_RETENTION_DAYS ?? 30) }).catch(() => null);

    return await new Promise((resolve, reject) => {
      const server = app.listen(port, () => {
        console.log(`FinalFolio server listening on ${port}`);
        resolve(server);
      });

      server.once('error', reject);
    });
  }

  return {
    app,
    distDir,
    port,
    start,
    store,
    assetStore,
    authStore,
    opsStore,
    securityStore,
    objectStorageStore,
    siteStore,
  };
}
