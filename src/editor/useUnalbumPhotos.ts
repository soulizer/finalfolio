import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchUnalbumPhotos, type UnalbumPhoto } from './api';
import type { Asset } from './types';

/**
 * UnAlbum photos are remote until they are used. This turns one into an Asset
 * shape the grids can render (remote preview URLs, upstream tags), while the
 * `unalbumId` keeps it distinguishable from a local upload.
 */
export function unalbumPhotoToAsset(photo: UnalbumPhoto): Asset {
  // Previews go through FinalFolio: the CDN may apply a hotlink allowlist, and
  // a server-side proxy keeps relative/protected URLs working and cacheable.
  const directThumb = photo.variants.thumb?.url || photo.variants.preview?.url || photo.variants.original?.url || '';
  const thumb = photo.id ? `/api/unalbum/thumb/${encodeURIComponent(photo.id)}` : directThumb;
  const preview = photo.variants.preview?.url || directThumb;
  const original = photo.variants.original?.url || preview;
  const analysis =
    photo.analysis && (photo.analysis.description || photo.analysis.tags?.length)
      ? {
          description: photo.analysis.description ?? '',
          tags: photo.analysis.tags ?? [],
          source: 'unalbum',
          ...(photo.analysis.analyzedAt ? { analyzedAt: photo.analysis.analyzedAt } : {}),
        }
      : undefined;

  return {
    id: `unalbum:${photo.id}`,
    name: photo.name || photo.filename || 'UnAlbum photo',
    src: preview,
    note: '',
    ...(photo.width ? { width: photo.width } : {}),
    ...(photo.height ? { height: photo.height } : {}),
    ...(photo.bytes ? { bytes: photo.bytes } : {}),
    variants: {
      original: original ? { src: original } : undefined,
      preview: preview ? { src: preview } : null,
      thumb: thumb ? { src: thumb } : null,
    },
    ...(analysis ? { analysis } : {}),
    unalbumId: photo.id,
  };
}

/**
 * Loads the signed-in user's UnAlbum photos for the editor grids. Failing to
 * reach UnAlbum must never break the local gallery, so errors are swallowed
 * after the first page; the account page owns the connection state.
 */
export function useUnalbumPhotos(enabled: boolean) {
  const [photos, setPhotos] = useState<UnalbumPhoto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  const load = useCallback(
    async (cursor: string) => {
      if (!enabled) {
        return;
      }
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setLoading(true);
      try {
        const page = await fetchUnalbumPhotos({ cursor });
        if (requestRef.current !== requestId) {
          return;
        }
        setPhotos((current) => (cursor ? [...current, ...page.photos] : page.photos));
        setNextCursor(page.nextCursor);
      } catch {
        if (requestRef.current === requestId) {
          setPhotos((current) => (cursor ? current : []));
          setNextCursor(null);
        }
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [enabled],
  );

  useEffect(() => {
    requestRef.current += 1;
    setPhotos([]);
    setNextCursor(null);
    if (enabled) {
      void load('');
    }
  }, [enabled, load]);

  return {
    photos,
    nextCursor,
    loading,
    loadMore: () => (nextCursor ? load(nextCursor) : Promise.resolve()),
  };
}
