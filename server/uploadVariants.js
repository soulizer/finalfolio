import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const derivativeDirname = 'variants';
const derivativeMimeType = 'image/webp';
const derivativeSpecs = {
  preview: {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 72,
  },
  thumb: {
    maxWidth: 480,
    maxHeight: 480,
    quality: 62,
  },
};

const derivativeKinds = Object.keys(derivativeSpecs);
const derivativeSupportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const mimeTypeByExtension = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function normalizeDimensionValue(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function filePathExists(filePath) {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}

function createVariantPublicPath(filename, kind) {
  return `/uploads/${derivativeDirname}/${filename}/${kind}.webp`;
}

function scaleDimensions(width, height, maxWidth, maxHeight) {
  const safeWidth = normalizeDimensionValue(width);
  const safeHeight = normalizeDimensionValue(height);
  if (!safeWidth || !safeHeight) {
    return null;
  }

  const ratio = Math.min(maxWidth / safeWidth, maxHeight / safeHeight, 1);
  return {
    width: Math.max(1, Math.round(safeWidth * ratio)),
    height: Math.max(1, Math.round(safeHeight * ratio)),
  };
}

function createResource(src, mimeType, dimensions, bytes) {
  return {
    src,
    mimeType,
    ...(dimensions?.width ? { width: dimensions.width } : {}),
    ...(dimensions?.height ? { height: dimensions.height } : {}),
    ...(typeof bytes === 'number' && Number.isFinite(bytes) && bytes >= 0 ? { bytes } : {}),
  };
}

export function getUploadFilenameFromPath(assetPath) {
  if (typeof assetPath !== 'string' || !assetPath.startsWith('/uploads/')) {
    return null;
  }

  const relativePath = decodeURIComponent(assetPath.slice('/uploads/'.length));
  if (!relativePath || relativePath.startsWith(`${derivativeDirname}/`) || relativePath.includes('/')) {
    return null;
  }

  return relativePath;
}

export function isDerivativeCompatibleFilename(filename) {
  return derivativeSupportedExtensions.has(path.extname(filename).toLowerCase());
}

export function createAssetVariantService({ uploadsDir }) {
  function originalPath(filename) {
    return path.join(uploadsDir, filename);
  }

  function derivativeDirectory(filename) {
    return path.join(uploadsDir, derivativeDirname, filename);
  }

  function derivativePath(filename, kind) {
    return path.join(derivativeDirectory(filename), `${kind}.webp`);
  }

  async function readFileBytes(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return null;
    }
  }

  async function probeImageDimensions(filePath) {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height',
        '-of',
        'json',
        filePath,
      ]);
      const payload = JSON.parse(stdout);
      const stream = Array.isArray(payload?.streams) ? payload.streams[0] : null;
      const width = normalizeDimensionValue(stream?.width);
      const height = normalizeDimensionValue(stream?.height);
      return width && height ? { width, height } : null;
    } catch {
      return null;
    }
  }

  async function generateDerivative(filename, kind) {
    const spec = derivativeSpecs[kind];
    const inputPath = originalPath(filename);
    const outputPath = derivativePath(filename, kind);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await execFileAsync('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-i',
      inputPath,
      '-vf',
      `scale=w=${spec.maxWidth}:h=${spec.maxHeight}:force_original_aspect_ratio=decrease`,
      '-frames:v',
      '1',
      '-compression_level',
      '6',
      '-q:v',
      String(spec.quality),
      outputPath,
    ]);

    return outputPath;
  }

  async function ensureUploadVariants(filename, { force = false } = {}) {
    if (!isDerivativeCompatibleFilename(filename)) {
      return { created: [], skipped: derivativeKinds };
    }

    const created = [];
    const skipped = [];

    for (const kind of derivativeKinds) {
      const outputPath = derivativePath(filename, kind);
      if (!force && (await filePathExists(outputPath))) {
        skipped.push(kind);
        continue;
      }

      await generateDerivative(filename, kind);
      created.push(kind);
    }

    return { created, skipped };
  }

  async function readUploadResources(filename, { originalWidth, originalHeight } = {}) {
    const inputPath = originalPath(filename);
    if (!(await filePathExists(inputPath))) {
      return null;
    }

    const safeWidth = normalizeDimensionValue(originalWidth);
    const safeHeight = normalizeDimensionValue(originalHeight);
    const originalBytes = await readFileBytes(inputPath);
    const originalResource = createResource(
      `/uploads/${filename}`,
      mimeTypeByExtension[path.extname(filename).toLowerCase()] ?? 'application/octet-stream',
      safeWidth && safeHeight ? { width: safeWidth, height: safeHeight } : null,
      originalBytes,
    );

    const previewPath = derivativePath(filename, 'preview');
    const thumbPath = derivativePath(filename, 'thumb');
    const previewExists = await filePathExists(previewPath);
    const thumbExists = await filePathExists(thumbPath);

    const previewDimensions = previewExists ? scaleDimensions(safeWidth, safeHeight, derivativeSpecs.preview.maxWidth, derivativeSpecs.preview.maxHeight) : null;
    const thumbDimensions = thumbExists ? scaleDimensions(safeWidth, safeHeight, derivativeSpecs.thumb.maxWidth, derivativeSpecs.thumb.maxHeight) : null;

    return {
      original: originalResource,
      preview: previewExists
        ? createResource(
            createVariantPublicPath(filename, 'preview'),
            derivativeMimeType,
            previewDimensions,
            await readFileBytes(previewPath),
          )
        : null,
      thumb: thumbExists
        ? createResource(createVariantPublicPath(filename, 'thumb'), derivativeMimeType, thumbDimensions, await readFileBytes(thumbPath))
        : null,
    };
  }

  async function removeUploadArtifacts(filename) {
    await fs.rm(originalPath(filename), { force: true });
    await fs.rm(derivativeDirectory(filename), { force: true, recursive: true });
  }

  return {
    derivativeSpecs,
    probeImageDimensions,
    ensureUploadVariants,
    readUploadResources,
    removeUploadArtifacts,
  };
}
