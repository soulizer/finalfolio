import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';

const DEFAULT_PORT = 3000;
const DEFAULT_DATA_ROOT = '/data';
const DEFAULT_MAX_UPLOAD_COUNT = 24;
const DEFAULT_MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_PAGE_COUNT = 48;
const DEFAULT_MAX_ASSET_COUNT = 64;
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
};
export const templateSlots = {
  cover: ['hero'],
  essay: ['hero'],
  grid: ['a', 'b', 'c', 'd'],
  diptych: ['left', 'right'],
};

const allowedUploadTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const allowedUploadExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

function createId(bytes = 9) {
  return crypto.randomBytes(bytes).toString('base64url').replace(/[-_]/g, '').toLowerCase();
}

export function createSharePath(projectId) {
  return `/editor/${projectId}`;
}

export function createBadRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
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

function normalizeTemplate(template) {
  const nextValue = sanitizeText(template, 'Template', 32, { allowEmpty: false, trim: true });
  if (!(nextValue in templateSlots)) {
    throwInvalidProject();
  }

  return nextValue;
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
  };
}

function sanitizeCropSettings(template, crops) {
  if (!crops || typeof crops !== 'object') {
    throwInvalidProject();
  }

  const expectedSlots = templateSlots[template];
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
        crop.scale > 2
      ) {
        throwInvalidProject();
      }

      return [slot, { x: crop.x, y: crop.y, scale: crop.scale }];
    }),
  );
}

function sanitizeSlots(template, slots, assetIds) {
  if (!slots || typeof slots !== 'object') {
    throwInvalidProject();
  }

  const expectedSlots = templateSlots[template];
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
  const pageId = validateIdentifier(page.id, 'Page identifier', defaultTextLimits.pageId);
  if (pageIds.has(pageId)) {
    throw createBadRequest('Page identifiers must be unique.');
  }
  pageIds.add(pageId);

  return {
    id: pageId,
    template,
    kicker: sanitizeText(page.kicker, 'Page kicker', defaultTextLimits.pageKicker, { trim: true }),
    title: sanitizeText(page.title, 'Page title', defaultTextLimits.pageTitle, { allowEmpty: false, trim: true }),
    deck: sanitizeText(page.deck, 'Page deck', defaultTextLimits.pageDeck, { trim: true }),
    body: sanitizeText(page.body, 'Page body', defaultTextLimits.pageBody, { trim: true }),
    caption: sanitizeText(page.caption, 'Page caption', defaultTextLimits.pageCaption, { trim: true }),
    slots: sanitizeSlots(template, page.slots, assetIds),
    crops: sanitizeCropSettings(template, page.crops),
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
    throw createBadRequest('Too many assets in one issue.');
  }

  if (project.pages.length > maxPageCount) {
    throw createBadRequest('Too many pages in one issue.');
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
    issue: sanitizeText(project.issue, 'Issue mark', defaultTextLimits.projectIssue, { allowEmpty: false, trim: true }),
    assets,
    pages: project.pages.map((page) => sanitizePage(page, assetIds, pageIds)),
  };
}

export function serializeProjectRecord(record) {
  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    sharePath: createSharePath(record.id),
    project: record.project,
  };
}

export function createUploadFilename(originalName = '', { idFactory = createId } = {}) {
  const extension = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, '');
  const safeExtension = extension.length > 1 ? extension : '.png';
  return `${Date.now()}-${idFactory(6)}${safeExtension}`;
}

export function validateUploadFile(file) {
  const extension = path.extname(file?.originalname ?? '').toLowerCase();
  if (!allowedUploadTypes.has(file?.mimetype) || !allowedUploadExtensions.has(extension)) {
    throw createBadRequest('Upload JPG, PNG, WebP, GIF, or AVIF images only.');
  }
}

export function createProjectStore({
  dataRoot = process.env.CRAZYALBUM_DATA_ROOT ?? DEFAULT_DATA_ROOT,
  maxPageCount = Number(process.env.CRAZYALBUM_MAX_PAGE_COUNT ?? DEFAULT_MAX_PAGE_COUNT),
  maxAssetCount = Number(process.env.CRAZYALBUM_MAX_ASSET_COUNT ?? DEFAULT_MAX_ASSET_COUNT),
  idFactory = createId,
  now = () => new Date().toISOString(),
} = {}) {
  const projectsDir = path.join(dataRoot, 'projects');
  const uploadsDir = path.join(dataRoot, 'uploads');

  function createProjectFilePath(projectId) {
    return path.join(projectsDir, `${projectId}.json`);
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
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
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

  async function createProjectRecord(payload) {
    const project = sanitizeProjectState(payload, { maxPageCount, maxAssetCount });
    const timestamp = now();
    const record = {
      id: idFactory(9),
      createdAt: timestamp,
      updatedAt: timestamp,
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
      updatedAt: now(),
      project,
    };

    await writeProjectRecord(nextRecord);
    return nextRecord;
  }

  function createStoredUpload(file) {
    validateUploadFile(file);

    return {
      id: `upload-${idFactory(9)}`,
      name: path.basename(file.originalname, path.extname(file.originalname)) || 'Untitled upload',
      src: `/uploads/${file.filename}`,
      note: 'Stored on the CrazyAlbum server.',
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
    sanitizeProjectState: (payload) => sanitizeProjectState(payload, { maxPageCount, maxAssetCount }),
    validateUploadFile,
    createStoredUpload,
  };
}

export function createApp({
  port = Number(process.env.PORT ?? DEFAULT_PORT),
  dataRoot = process.env.CRAZYALBUM_DATA_ROOT ?? DEFAULT_DATA_ROOT,
  distDir = defaultDistDir,
  maxUploadCount = Number(process.env.CRAZYALBUM_MAX_UPLOAD_COUNT ?? DEFAULT_MAX_UPLOAD_COUNT),
  maxUploadSizeBytes = Number(process.env.CRAZYALBUM_MAX_UPLOAD_SIZE_BYTES ?? DEFAULT_MAX_UPLOAD_SIZE_BYTES),
  maxPageCount = Number(process.env.CRAZYALBUM_MAX_PAGE_COUNT ?? DEFAULT_MAX_PAGE_COUNT),
  maxAssetCount = Number(process.env.CRAZYALBUM_MAX_ASSET_COUNT ?? DEFAULT_MAX_ASSET_COUNT),
} = {}) {
  const store = createProjectStore({
    dataRoot,
    maxPageCount,
    maxAssetCount,
  });
  const indexFile = path.join(distDir, 'index.html');
  const app = express();

  app.disable('x-powered-by');
  app.use((_, response, next) => {
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob:",
        "script-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join('; '),
    );
    next();
  });
  app.use(express.json({ limit: '5mb' }));

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

  app.post('/api/uploads', upload.array('files', maxUploadCount), (request, response) => {
    const files = Array.isArray(request.files) ? request.files : [];
    if (files.length === 0) {
      throw createBadRequest('Choose at least one JPG, PNG, WebP, GIF, or AVIF image.');
    }

    response.status(201).json({
      assets: files.map((file) => store.createStoredUpload(file)),
    });
  });

  app.post('/api/projects', async (request, response, next) => {
    try {
      const record = await store.createProjectRecord(request.body);
      response.status(201).json(serializeProjectRecord(record));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/projects/:projectId', async (request, response, next) => {
    try {
      const projectId = sanitizeProjectId(request.params.projectId);
      const record = await store.readProjectRecord(projectId);
      response.json(serializeProjectRecord(record));
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/projects/:projectId', async (request, response, next) => {
    try {
      const record = await store.updateProjectRecord(request.params.projectId, request.body);
      response.json(serializeProjectRecord(record));
    } catch (error) {
      next(error);
    }
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
        if (filePath.endsWith('.html')) {
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
      response.sendFile(indexFile);
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof multer.MulterError) {
      response.status(400).json({ error: error.message });
      return;
    }

    if (error instanceof SyntaxError && error && typeof error === 'object' && 'body' in error) {
      response.status(400).json({ error: 'Request body must be valid JSON.' });
      return;
    }

    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500;
    const message = statusCode >= 500 ? 'Internal server error.' : error.message;
    if (statusCode >= 500) {
      console.error(error);
    }
    response.status(statusCode).json({ error: message });
  });

  async function start() {
    await store.ensureDataDirectories();

    return await new Promise((resolve, reject) => {
      const server = app.listen(port, () => {
        console.log(`CrazyAlbum server listening on ${port}`);
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
  };
}
