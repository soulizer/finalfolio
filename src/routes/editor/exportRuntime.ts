export function waitForRenderFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

export function waitForImageElement(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0) {
    if (typeof image.decode === 'function') {
      return image.decode().catch(() => undefined);
    }

    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const finish = () => {
      image.removeEventListener('load', finish);
      image.removeEventListener('error', finish);
      resolve();
    };

    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', finish, { once: true });
  });
}

export async function waitForSettledPrintFrames(root: HTMLElement, attempts = 30) {
  let lastFingerprint = '';
  let stablePasses = 0;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const assetFrames = Array.from(root.querySelectorAll<HTMLElement>('.asset-frame[data-has-asset="true"]'));
    const pendingFrames = assetFrames.filter((frame) => frame.dataset.frameReady !== 'true' || frame.dataset.geometryReady !== 'true');
    const fingerprint = assetFrames
      .map((frame) => {
        const rect = frame.getBoundingClientRect();
        return `${frame.dataset.frameReady}:${frame.dataset.geometryReady}:${Math.round(rect.width * 100) / 100}x${
          Math.round(rect.height * 100) / 100
        }`;
      })
      .join('|');

    if (!pendingFrames.length && fingerprint === lastFingerprint) {
      stablePasses += 1;
    } else {
      stablePasses = 0;
    }

    if (!pendingFrames.length && stablePasses >= 2) {
      return;
    }

    lastFingerprint = fingerprint;
    await waitForRenderFrame();
  }

  throw new Error('Export preview is still settling. Please try again.');
}

export function createExportDocumentTitle(title: string, issue: string) {
  const rawBase = (title.trim() || issue.trim() || 'Project').normalize('NFKC');
  const safeBase = rawBase
    .replace(/[\/:*?"<>|]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return `${safeBase || 'Project'}_FinalFolio`;
}
