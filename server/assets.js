import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_ASSET_CACHE_TTL_MS = 5_000;

function createBadRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeNumericField(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

function normalizeAssetResourceSrc(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const nextValue = value.trim();
  if (!nextValue) {
    return null;
  }

  if (nextValue.startsWith('/uploads/') || nextValue.startsWith('/builtins/')) {
    return nextValue.includes('..') ? null : nextValue;
  }

  try {
    const url = new URL(nextValue);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function sanitizeAssetVariantResource(resource) {
  if (!resource || typeof resource !== 'object') {
    return null;
  }

  const src = normalizeAssetResourceSrc(resource.src);
  if (!src) {
    return null;
  }

  return {
    src,
    width: normalizeNumericField(resource.width),
    height: normalizeNumericField(resource.height),
    bytes: normalizeNumericField(resource.bytes),
    mimeType: typeof resource.mimeType === 'string' ? resource.mimeType : null,
  };
}

function sanitizeAssetRecord(record) {
  if (
    !record ||
    typeof record !== 'object' ||
    typeof record.id !== 'string' ||
    typeof record.src !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.createdAt !== 'string' ||
    typeof record.updatedAt !== 'string'
  ) {
    throw createBadRequest('Asset record is invalid.');
  }

  return {
    id: record.id,
    src: record.src,
    name: record.name,
    note: typeof record.note === 'string' ? record.note : '',
    width: normalizeNumericField(record.width),
    height: normalizeNumericField(record.height),
    bytes: normalizeNumericField(record.bytes),
    mimeType: typeof record.mimeType === 'string' ? record.mimeType : null,
    variants:
      record.variants && typeof record.variants === 'object'
        ? {
            original: sanitizeAssetVariantResource(record.variants.original),
            preview: record.variants.preview === null ? null : sanitizeAssetVariantResource(record.variants.preview),
            thumb: record.variants.thumb === null ? null : sanitizeAssetVariantResource(record.variants.thumb),
          }
        : null,
    ownerUserId: typeof record.ownerUserId === 'string' ? record.ownerUserId : null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastUsedAt: typeof record.lastUsedAt === 'string' ? record.lastUsedAt : null,
    deletedAt: typeof record.deletedAt === 'string' ? record.deletedAt : null,
  };
}

export function createAssetStore({
  dataRoot,
  now = () => new Date().toISOString(),
  cacheTtlMs = DEFAULT_ASSET_CACHE_TTL_MS,
} = {}) {
  const assetsDir = path.join(dataRoot, 'assets');
  let cachedRecords = null;
  let cachedIncludeDeleted = false;
  let cachedExpiresAt = 0;

  function assetPath(assetId) {
    return path.join(assetsDir, `${assetId}.json`);
  }

  function invalidateListCache() {
    cachedRecords = null;
    cachedIncludeDeleted = false;
    cachedExpiresAt = 0;
  }

  async function ensureAssetDirectory() {
    await fs.mkdir(assetsDir, { recursive: true });
  }

  async function writeAssetRecord(record) {
    const filename = assetPath(record.id);
    const tempFile = `${filename}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(record, null, 2), 'utf8');
    await fs.rename(tempFile, filename);
    invalidateListCache();
  }

  async function createAssetRecord(asset, { ownerUserId = null } = {}) {
    const timestamp = now();
    const record = {
      id: asset.id,
      src: asset.src,
      name: asset.name,
      note: asset.note ?? '',
      width: typeof asset.width === 'number' ? asset.width : null,
      height: typeof asset.height === 'number' ? asset.height : null,
      bytes: typeof asset.bytes === 'number' ? asset.bytes : null,
      mimeType: typeof asset.mimeType === 'string' ? asset.mimeType : null,
      variants: asset.variants ?? null,
      ownerUserId,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastUsedAt: null,
      deletedAt: null,
    };

    await ensureAssetDirectory();
    await writeAssetRecord(record);
    return sanitizeAssetRecord(record);
  }

  async function readAssetRecord(assetId) {
    try {
      const payload = JSON.parse(await fs.readFile(assetPath(assetId), 'utf8'));
      return sanitizeAssetRecord(payload);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        const notFound = new Error('Asset not found.');
        notFound.statusCode = 404;
        throw notFound;
      }

      throw error;
    }
  }

  async function listAssetRecords({ includeDeleted = false } = {}) {
    if (cachedRecords && cachedExpiresAt > Date.now() && (includeDeleted || !cachedIncludeDeleted || cachedIncludeDeleted === includeDeleted)) {
      return includeDeleted ? cachedRecords : cachedRecords.filter((record) => !record.deletedAt);
    }

    await ensureAssetDirectory();
    const entries = await fs.readdir(assetsDir, { withFileTypes: true });
    const records = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map(async (entry) => sanitizeAssetRecord(JSON.parse(await fs.readFile(path.join(assetsDir, entry.name), 'utf8')))),
    );

    const sortedRecords = records
      .filter((record) => includeDeleted || !record.deletedAt)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    cachedRecords = records.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    cachedIncludeDeleted = true;
    cachedExpiresAt = Date.now() + cacheTtlMs;

    return sortedRecords;
  }

  async function markAssetDeleted(assetId) {
    const current = await readAssetRecord(assetId);
    const next = {
      ...current,
      updatedAt: now(),
      deletedAt: current.deletedAt ?? now(),
    };
    await writeAssetRecord(next);
    return sanitizeAssetRecord(next);
  }

  async function touchAssetUsage(assetIds, usedAt = now()) {
    const uniqueAssetIds = Array.from(new Set(Array.from(assetIds).filter((assetId) => typeof assetId === 'string' && assetId.trim())));
    await Promise.all(
      uniqueAssetIds.map(async (assetId) => {
        try {
          const current = await readAssetRecord(assetId);
          const next = {
            ...current,
            updatedAt: current.updatedAt,
            lastUsedAt: usedAt,
          };
          await writeAssetRecord(next);
        } catch (error) {
          if (error?.statusCode === 404) {
            return;
          }
          throw error;
        }
      }),
    );
  }

  return {
    assetsDir,
    ensureAssetDirectory,
    createAssetRecord,
    readAssetRecord,
    listAssetRecords,
    markAssetDeleted,
    touchAssetUsage,
    invalidateListCache,
  };
}
