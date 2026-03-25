import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';

const PORT = Number(process.env.PORT ?? 3000);
const DATA_ROOT = process.env.CRAZYALBUM_DATA_ROOT ?? '/data';
const PROJECTS_DIR = path.join(DATA_ROOT, 'projects');
const UPLOADS_DIR = path.join(DATA_ROOT, 'uploads');
const MAX_UPLOAD_COUNT = Number(process.env.CRAZYALBUM_MAX_UPLOAD_COUNT ?? 24);
const MAX_UPLOAD_SIZE_BYTES = Number(process.env.CRAZYALBUM_MAX_UPLOAD_SIZE_BYTES ?? 25 * 1024 * 1024);

const dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(dirname, '..', 'dist');
const indexFile = path.join(distDir, 'index.html');
const projectIdPattern = /^[a-z0-9_-]{8,40}$/;

const app = express();

app.disable('x-powered-by');
app.use((_, response, next) => {
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(express.json({ limit: '5mb' }));

function createId(bytes = 9) {
  return crypto.randomBytes(bytes).toString('base64url').replace(/[-_]/g, '').toLowerCase();
}

function createSharePath(projectId) {
  return `/editor/${projectId}`;
}

function createProjectFilePath(projectId) {
  return path.join(PROJECTS_DIR, `${projectId}.json`);
}

function sanitizeProjectId(projectId) {
  if (!projectIdPattern.test(projectId)) {
    const error = new Error('Invalid project identifier.');
    error.statusCode = 400;
    throw error;
  }

  return projectId;
}

function sanitizeAsset(asset) {
  if (!asset || typeof asset !== 'object') {
    throwInvalidProject();
  }

  if (
    typeof asset.id !== 'string' ||
    typeof asset.name !== 'string' ||
    typeof asset.src !== 'string' ||
    typeof asset.note !== 'string'
  ) {
    throwInvalidProject();
  }

  return {
    id: asset.id,
    name: asset.name,
    src: asset.src,
    note: asset.note,
    builtIn: asset.builtIn === true,
  };
}

function sanitizeCropSettings(crops) {
  if (!crops || typeof crops !== 'object') {
    throwInvalidProject();
  }

  return Object.fromEntries(
    Object.entries(crops).map(([slot, crop]) => {
      if (
        !crop ||
        typeof crop !== 'object' ||
        typeof crop.x !== 'number' ||
        typeof crop.y !== 'number' ||
        typeof crop.scale !== 'number'
      ) {
        throwInvalidProject();
      }

      return [slot, { x: crop.x, y: crop.y, scale: crop.scale }];
    }),
  );
}

function sanitizeSlots(slots) {
  if (!slots || typeof slots !== 'object') {
    throwInvalidProject();
  }

  return Object.fromEntries(
    Object.entries(slots).map(([slot, assetId]) => {
      if (assetId !== null && typeof assetId !== 'string') {
        throwInvalidProject();
      }

      return [slot, assetId];
    }),
  );
}

function sanitizePage(page) {
  if (!page || typeof page !== 'object') {
    throwInvalidProject();
  }

  const templateOptions = new Set(['cover', 'essay', 'grid', 'diptych']);
  if (
    typeof page.id !== 'string' ||
    typeof page.template !== 'string' ||
    !templateOptions.has(page.template) ||
    typeof page.kicker !== 'string' ||
    typeof page.title !== 'string' ||
    typeof page.deck !== 'string' ||
    typeof page.body !== 'string' ||
    typeof page.caption !== 'string'
  ) {
    throwInvalidProject();
  }

  return {
    id: page.id,
    template: page.template,
    kicker: page.kicker,
    title: page.title,
    deck: page.deck,
    body: page.body,
    caption: page.caption,
    slots: sanitizeSlots(page.slots),
    crops: sanitizeCropSettings(page.crops),
  };
}

function throwInvalidProject() {
  const error = new Error('Project payload is invalid.');
  error.statusCode = 400;
  throw error;
}

function sanitizeProjectState(payload) {
  const project = payload?.project ?? payload;
  if (!project || typeof project !== 'object') {
    throwInvalidProject();
  }

  if (
    typeof project.title !== 'string' ||
    typeof project.subtitle !== 'string' ||
    typeof project.issue !== 'string' ||
    !Array.isArray(project.assets) ||
    !Array.isArray(project.pages) ||
    project.pages.length === 0
  ) {
    throwInvalidProject();
  }

  return {
    title: project.title,
    subtitle: project.subtitle,
    issue: project.issue,
    assets: project.assets.map(sanitizeAsset),
    pages: project.pages.map(sanitizePage),
  };
}

function serializeProjectRecord(record) {
  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    sharePath: createSharePath(record.id),
    project: record.project,
  };
}

function createUploadFilename(originalName = '') {
  const extension = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, '');
  const safeExtension = extension.length > 1 ? extension : '.jpg';
  return `${Date.now()}-${createId(6)}${safeExtension}`;
}

async function ensureDataDirectories() {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
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
      project: sanitizeProjectState(record.project),
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

const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, UPLOADS_DIR),
    filename: (_request, file, callback) => callback(null, createUploadFilename(file.originalname)),
  }),
  limits: {
    files: MAX_UPLOAD_COUNT,
    fileSize: MAX_UPLOAD_SIZE_BYTES,
  },
  fileFilter: (_request, file, callback) => {
    callback(null, file.mimetype.startsWith('image/'));
  },
});

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.post('/api/uploads', upload.array('files', MAX_UPLOAD_COUNT), (request, response) => {
  const files = Array.isArray(request.files) ? request.files : [];

  response.status(201).json({
    assets: files.map((file) => ({
      id: `upload-${createId(9)}`,
      name: path.basename(file.originalname, path.extname(file.originalname)) || 'Untitled upload',
      src: `/uploads/${file.filename}`,
      note: 'Stored on the CrazyAlbum server.',
    })),
  });
});

app.post('/api/projects', async (request, response, next) => {
  try {
    const project = sanitizeProjectState(request.body);
    const timestamp = new Date().toISOString();
    const record = {
      id: createId(9),
      createdAt: timestamp,
      updatedAt: timestamp,
      project,
    };

    await writeProjectRecord(record);
    response.status(201).json(serializeProjectRecord(record));
  } catch (error) {
    next(error);
  }
});

app.get('/api/projects/:projectId', async (request, response, next) => {
  try {
    const projectId = sanitizeProjectId(request.params.projectId);
    const record = await readProjectRecord(projectId);
    response.json(serializeProjectRecord(record));
  } catch (error) {
    next(error);
  }
});

app.put('/api/projects/:projectId', async (request, response, next) => {
  try {
    const projectId = sanitizeProjectId(request.params.projectId);
    const existingRecord = await readProjectRecord(projectId);
    const project = sanitizeProjectState(request.body);

    const nextRecord = {
      ...existingRecord,
      updatedAt: new Date().toISOString(),
      project,
    };

    await writeProjectRecord(nextRecord);
    response.json(serializeProjectRecord(nextRecord));
  } catch (error) {
    next(error);
  }
});

app.use(
  '/uploads',
  express.static(UPLOADS_DIR, {
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

  if (error instanceof SyntaxError && 'body' in error) {
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

await ensureDataDirectories();

app.listen(PORT, () => {
  console.log(`CrazyAlbum server listening on ${PORT}`);
});
