import { useEffect, useState } from 'react';

type LoadState = 'loading' | 'ready' | 'error';

type UseEditorPreviewScaleOptions = {
  loadState: LoadState;
  canvasRef: { current: HTMLDivElement | null };
  sheetProbeRef: { current: HTMLDivElement | null };
};

export function useEditorPreviewScale({ loadState, canvasRef, sheetProbeRef }: UseEditorPreviewScaleOptions) {
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const container = canvasRef.current;
    const probe = sheetProbeRef.current;
    if (!container || !probe) {
      return;
    }

    function updateScale() {
      if (!container || !probe) {
        return;
      }

      const probeRect = probe.getBoundingClientRect();
      const baseWidth = probeRect.width;
      const baseHeight = probeRect.height;
      if (!baseWidth || !baseHeight) {
        return;
      }

      const containerStyles = window.getComputedStyle(container);
      const horizontalPadding = Number.parseFloat(containerStyles.paddingLeft) + Number.parseFloat(containerStyles.paddingRight);
      const verticalPadding = Number.parseFloat(containerStyles.paddingTop) + Number.parseFloat(containerStyles.paddingBottom);
      const availableWidth = Math.max(container.clientWidth - horizontalPadding, 320);
      const availableHeight = Math.max(container.clientHeight - verticalPadding, 320);
      const nextScale = Math.min(1, availableWidth / baseWidth, availableHeight / baseHeight);
      setPreviewScale((current) => (Math.abs(current - nextScale) < 0.005 ? current : Number(nextScale.toFixed(4))));
    }

    updateScale();

    const observer = new ResizeObserver(() => updateScale());
    observer.observe(container);

    return () => observer.disconnect();
  }, [loadState, canvasRef, sheetProbeRef]);

  return previewScale;
}
