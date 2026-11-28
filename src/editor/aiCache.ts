import type { Asset, AssetAnalysis } from './types';

/**
 * Local cache for the AI arrangement dialog.
 *
 * Thumbnails are expensive to rebuild (decode the full photo, draw a canvas,
 * encode JPEG) and the same asset is prepared again every time the dialog is
 * reopened or a generation is retried. Analysis produced by an earlier plan is
 * also useful context for later runs. Both live in IndexedDB so they survive a
 * reload and are shared across projects on this device.
 *
 * The pixels stay authoritative: the layout request still sends the thumbnail.
 * Cached analysis only replaces the unreliable "imported analysis" context.
 */
const DB_NAME = 'finalfolio-ai-cache';
const DB_VERSION = 1;
const THUMBNAIL_STORE = 'thumbnails';
const ANALYSIS_STORE = 'analysis';
const MAX_THUMBNAILS = 400;
const MAX_ANALYSES = 800;

interface CachedThumbnail {
  key: string;
  thumbnail: string;
  width: number;
  height: number;
  updatedAt: number;
}

interface CachedAnalysis extends AssetAnalysis {
  key: string;
  updatedAt: number;
}

let databasePromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (databasePromise) {
    return databasePromise;
  }
  databasePromise = new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(THUMBNAIL_STORE)) {
        database.createObjectStore(THUMBNAIL_STORE, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(ANALYSIS_STORE)) {
        database.createObjectStore(ANALYSIS_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return databasePromise;
}

function readStore<T>(storeName: string, key: string): Promise<T | null> {
  return openDatabase().then(
    (database) =>
      new Promise<T | null>((resolve) => {
        if (!database) {
          resolve(null);
          return;
        }
        try {
          const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(key);
          request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

function writeStore(storeName: string, value: unknown): Promise<void> {
  return openDatabase().then(
    (database) =>
      new Promise<void>((resolve) => {
        if (!database) {
          resolve();
          return;
        }
        try {
          const transaction = database.transaction(storeName, 'readwrite');
          transaction.objectStore(storeName).put(value);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => resolve();
          transaction.onabort = () => resolve();
        } catch {
          resolve();
        }
      }),
  );
}

function pruneStore(storeName: string, limit: number) {
  void openDatabase().then((database) => {
    if (!database) {
      return;
    }
    try {
      const transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => {
        const rows = (request.result ?? []) as Array<{ key: string; updatedAt?: number }>;
        if (rows.length <= limit) {
          return;
        }
        rows
          .sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0))
          .slice(0, rows.length - limit)
          .forEach((row) => store.delete(row.key));
      };
    } catch {
      // Cache pruning is opportunistic; never break the dialog for it.
    }
  });
}

export function assetCacheKey(
  asset: Pick<Asset, 'id'> & Partial<Pick<Asset, 'src' | 'bytes' | 'width' | 'height'>>,
) {
  // Signed preview URLs can rotate; identify the content by the stable asset id
  // plus size/dimensions instead of the URL.
  const fingerprint = asset.bytes ?? `${asset.width ?? '?'}x${asset.height ?? '?'}`;
  return `asset:${asset.id}:${fingerprint}`;
}

export function fileCacheKey(file: Pick<File, 'name' | 'size' | 'lastModified'>) {
  return `file:${file.name}:${file.size}:${file.lastModified}`;
}

export async function readCachedThumbnail(key: string) {
  const row = await readStore<CachedThumbnail>(THUMBNAIL_STORE, key);
  if (!row || typeof row.thumbnail !== 'string' || !row.thumbnail.startsWith('data:image/')) {
    return null;
  }
  return row;
}

export function writeCachedThumbnail(key: string, thumbnail: { thumbnail: string; width: number; height: number }) {
  const row: CachedThumbnail = {
    key,
    thumbnail: thumbnail.thumbnail,
    width: thumbnail.width,
    height: thumbnail.height,
    updatedAt: Date.now(),
  };
  void writeStore(THUMBNAIL_STORE, row).then(() => pruneStore(THUMBNAIL_STORE, MAX_THUMBNAILS));
}

export async function readCachedAnalysis(key: string) {
  const row = await readStore<CachedAnalysis>(ANALYSIS_STORE, key);
  if (!row || (!row.description?.trim() && !row.tags?.length)) {
    return null;
  }
  return {
    description: row.description,
    tags: Array.isArray(row.tags) ? row.tags : [],
    source: row.source,
    analyzedAt: row.analyzedAt,
  } satisfies AssetAnalysis;
}

export function writeCachedAnalysis(key: string, analysis: AssetAnalysis) {
  const row: CachedAnalysis = {
    key,
    description: analysis.description.slice(0, 800),
    tags: analysis.tags.slice(0, 24),
    source: analysis.source,
    analyzedAt: analysis.analyzedAt,
    updatedAt: Date.now(),
  };
  void writeStore(ANALYSIS_STORE, row).then(() => pruneStore(ANALYSIS_STORE, MAX_ANALYSES));
}
