import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';

type PhotoThumbProps = {
  src: string;
  alt: string;
  className?: string;
  /** Fill an absolutely positioned parent (AI grid tiles) instead of flowing. */
  fill?: boolean;
  loading?: 'lazy' | 'eager';
};

/**
 * One image tile with an explicit loading/error state. Empty white boxes read
 * as "broken"; a short label plus a soft placeholder tells the user the photo
 * is still coming (large originals, UnAlbum previews, slow networks).
 */
export function PhotoThumb({ src, alt, className = '', fill = false, loading = 'lazy' }: PhotoThumbProps) {
  const t = useT();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setState('loading');
    const image = imageRef.current;
    if (!image) {
      return undefined;
    }
    // A cached image can finish before React attaches onLoad; check once and
    // again shortly after mount.
    const check = () => {
      if (!image.complete) {
        return;
      }
      setState(image.naturalWidth > 0 ? 'ready' : 'error');
    };
    check();
    const timer = window.setTimeout(check, 1200);
    return () => window.clearTimeout(timer);
  }, [src]);

  return (
    <span className={`photo-thumb ${fill ? 'photo-thumb--fill' : ''} ${className}`.trim()}>
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        className={state === 'ready' ? undefined : 'is-pending'}
        onLoad={() => setState('ready')}
        onError={() => setState('error')}
      />
      {state !== 'ready' ? (
        <span
          className={`photo-thumb__state ${state === 'error' ? 'is-error' : ''}`.trim()}
          role={state === 'error' ? 'status' : undefined}
        >
          {state === 'error' ? t('Image unavailable') : t('Loading…')}
        </span>
      ) : null}
    </span>
  );
}
