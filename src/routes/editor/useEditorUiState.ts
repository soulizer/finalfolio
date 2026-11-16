import { ChangeEvent, FocusEvent, RefObject, useCallback, useEffect, useState } from 'react';
import { DEFAULT_FILL_SCALE } from '../../editor/demoData';
import { cropValueToPixelOffset, pixelOffsetToCropValue } from '../../editor/imageGeometry';
import type { CropSettings, TemplateId } from '../../editor/types';

const TEMPLATE_HOVER_PREVIEW_WIDTH = 214;
const TEMPLATE_HOVER_PREVIEW_HEIGHT = 180;
const TEMPLATE_HOVER_PREVIEW_GAP = 16;
const CUSTOM_LAYOUT_PREVIEW_WIDTH = 236;

export type CropMetrics = {
  maxOffsetX: number;
  maxOffsetY: number;
};

export type TemplateHoverPreview = {
  templateId: TemplateId;
  left: number;
  top: number;
};

export type FloatingPreviewPosition = {
  left: number;
  top: number;
};

type UseEditorUiStateOptions = {
  selectedPageId?: string;
  selectedSlot: string | null;
  currentCrop?: CropSettings;
  templatePickerOpen: boolean;
  templateChoice: TemplateId;
  customLayoutBuilderRef: RefObject<HTMLDivElement | null>;
  editorStageRef: RefObject<HTMLElement | null>;
  updateSelectedCrop: (updater: (crop: CropSettings) => CropSettings) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function useEditorUiState({
  selectedPageId,
  selectedSlot,
  currentCrop,
  templatePickerOpen,
  templateChoice,
  customLayoutBuilderRef,
  editorStageRef,
  updateSelectedCrop,
}: UseEditorUiStateOptions) {
  const [zoomInputValue, setZoomInputValue] = useState('1.00');
  const [cropMetricsBySlot, setCropMetricsBySlot] = useState<Record<string, CropMetrics>>({});
  const [templateHoverPreview, setTemplateHoverPreview] = useState<TemplateHoverPreview | null>(null);
  const [customLayoutPreviewHover, setCustomLayoutPreviewHover] = useState(false);
  const [customLayoutPreviewFocus, setCustomLayoutPreviewFocus] = useState(false);
  const [pinnedCustomLayoutPreview, setPinnedCustomLayoutPreview] = useState<FloatingPreviewPosition | null>(null);

  const selectedCropMetrics = selectedSlot ? cropMetricsBySlot[selectedSlot] ?? null : null;
  const customLayoutPreviewActive =
    templatePickerOpen && templateChoice === 'custom' && (customLayoutPreviewHover || customLayoutPreviewFocus);

  useEffect(() => {
    setCropMetricsBySlot({});
  }, [selectedPageId]);

  useEffect(() => {
    if (!currentCrop) {
      setZoomInputValue('1.00');
      return;
    }

    setZoomInputValue((current) => {
      const parsed = Number.parseFloat(current);
      return Number.isFinite(parsed) && Math.abs(parsed - currentCrop.scale) < 0.005 ? current : currentCrop.scale.toFixed(2);
    });
  }, [currentCrop, selectedPageId, selectedSlot]);

  useEffect(() => {
    if (!templatePickerOpen && templateHoverPreview) {
      setTemplateHoverPreview(null);
    }
  }, [templateHoverPreview, templatePickerOpen]);

  useEffect(() => {
    if (!customLayoutPreviewActive) {
      setPinnedCustomLayoutPreview(null);
      return;
    }

    const updatePinnedPreviewPosition = () => {
      if (!customLayoutBuilderRef.current || !editorStageRef.current || window.innerWidth <= 1100) {
        setPinnedCustomLayoutPreview(null);
        return;
      }

      const builderBounds = customLayoutBuilderRef.current.getBoundingClientRect();
      const stageBounds = editorStageRef.current.getBoundingClientRect();
      const viewportPadding = 8;
      const preferredLeft = builderBounds.right + TEMPLATE_HOVER_PREVIEW_GAP;
      const left =
        preferredLeft + CUSTOM_LAYOUT_PREVIEW_WIDTH > window.innerWidth - viewportPadding
          ? Math.max(viewportPadding, builderBounds.left - CUSTOM_LAYOUT_PREVIEW_WIDTH - TEMPLATE_HOVER_PREVIEW_GAP)
          : preferredLeft;
      const maxTop = Math.max(viewportPadding, window.innerHeight - TEMPLATE_HOVER_PREVIEW_HEIGHT - viewportPadding);
      const top =
        stageBounds.top >= viewportPadding && stageBounds.top <= maxTop
          ? stageBounds.top
          : clamp(stageBounds.bottom - TEMPLATE_HOVER_PREVIEW_HEIGHT, viewportPadding, maxTop);

      setPinnedCustomLayoutPreview({ left, top });
    };

    const frame = window.requestAnimationFrame(updatePinnedPreviewPosition);
    window.addEventListener('resize', updatePinnedPreviewPosition);
    window.addEventListener('scroll', updatePinnedPreviewPosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePinnedPreviewPosition);
      window.removeEventListener('scroll', updatePinnedPreviewPosition, true);
    };
  }, [customLayoutBuilderRef, customLayoutPreviewActive, editorStageRef]);

  useEffect(() => {
    if (templatePickerOpen && templateChoice === 'custom') {
      return;
    }

    setCustomLayoutPreviewHover(false);
    setCustomLayoutPreviewFocus(false);
  }, [templateChoice, templatePickerOpen]);

  useEffect(() => {
    if (!templateHoverPreview) {
      return;
    }

    const dismissPreview = () => {
      setTemplateHoverPreview(null);
    };

    window.addEventListener('resize', dismissPreview);
    window.addEventListener('scroll', dismissPreview, true);

    return () => {
      window.removeEventListener('resize', dismissPreview);
      window.removeEventListener('scroll', dismissPreview, true);
    };
  }, [templateHoverPreview]);

  function openTemplateHoverPreview(templateId: TemplateId, element: HTMLElement, point?: { x: number; y: number }) {
    const bounds = element.getBoundingClientRect();
    const viewportPadding = 16;
    const anchorX = point?.x ?? bounds.left + bounds.width / 2;
    const anchorY = point?.y ?? bounds.top + bounds.height / 2;
    // Follow the pointer, flipping to the other side when the preview would
    // leave the viewport.
    const preferredLeft = anchorX + TEMPLATE_HOVER_PREVIEW_GAP;
    const left =
      preferredLeft + TEMPLATE_HOVER_PREVIEW_WIDTH > window.innerWidth - viewportPadding
        ? Math.max(viewportPadding, anchorX - TEMPLATE_HOVER_PREVIEW_WIDTH - TEMPLATE_HOVER_PREVIEW_GAP)
        : preferredLeft;
    const maxTop = Math.max(viewportPadding, window.innerHeight - TEMPLATE_HOVER_PREVIEW_HEIGHT - viewportPadding);
    const top = clamp(anchorY + TEMPLATE_HOVER_PREVIEW_GAP, viewportPadding, maxTop);

    setTemplateHoverPreview({
      templateId,
      left,
      top,
    });
  }

  function clearTemplateHoverPreview() {
    setTemplateHoverPreview(null);
  }

  function activateCustomLayoutPreview() {
    setCustomLayoutPreviewHover(true);
  }

  function deactivateCustomLayoutPreview() {
    setCustomLayoutPreviewHover(false);
  }

  function handleCustomLayoutPreviewFocus() {
    setCustomLayoutPreviewFocus(true);
  }

  function handleCustomLayoutPreviewBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setCustomLayoutPreviewFocus(false);
  }

  // Stable identity is required: MagazinePreview includes this callback in an effect
  // dependency list, so a fresh function on every render would re-trigger the effect and
  // feed a render loop back through setCropMetricsBySlot.
  const handleCropMetricsChange = useCallback((slot: string, metrics: CropMetrics | null) => {
    setCropMetricsBySlot((current) => {
      if (!metrics) {
        if (!(slot in current)) {
          return current;
        }

        const nextState = { ...current };
        delete nextState[slot];
        return nextState;
      }

      const currentMetrics = current[slot];
      if (currentMetrics?.maxOffsetX === metrics.maxOffsetX && currentMetrics?.maxOffsetY === metrics.maxOffsetY) {
        return current;
      }

      return {
        ...current,
        [slot]: metrics,
      };
    });
  }, []);

  function nudgeSelectedCrop(axis: 'x' | 'y', deltaPixels: number) {
    const maxOffset = axis === 'x' ? (selectedCropMetrics?.maxOffsetX ?? 0) : (selectedCropMetrics?.maxOffsetY ?? 0);
    if (maxOffset <= 0) {
      return;
    }

    updateSelectedCrop((crop) => ({
      ...crop,
      [axis]: pixelOffsetToCropValue(
        clamp(cropValueToPixelOffset(crop[axis], maxOffset) + deltaPixels, -maxOffset, maxOffset),
        maxOffset,
      ),
    }));
  }

  function setSelectedScale(value: number) {
    updateSelectedCrop((crop) => ({
      ...crop,
      scale: clamp(value, crop.fit === 'contain' ? 1 : DEFAULT_FILL_SCALE, 2.2),
    }));
  }

  function nudgeSelectedScale(delta: number) {
    updateSelectedCrop((crop) => ({
      ...crop,
      scale: clamp(crop.scale + delta, crop.fit === 'contain' ? 1 : DEFAULT_FILL_SCALE, 2.2),
    }));
  }

  function handleZoomInputChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value;
    setZoomInputValue(nextValue);
    const parsed = Number.parseFloat(nextValue);
    if (Number.isFinite(parsed)) {
      setSelectedScale(parsed);
    }
  }

  function commitZoomInputValue(rawValue: string) {
    if (!currentCrop) {
      setZoomInputValue('1.00');
      return;
    }

    const parsed = Number.parseFloat(rawValue);
    if (!Number.isFinite(parsed)) {
      setZoomInputValue(currentCrop.scale.toFixed(2));
      return;
    }

    const nextValue = clamp(parsed, currentCrop.fit === 'contain' ? 1 : DEFAULT_FILL_SCALE, 2.2);
    setSelectedScale(nextValue);
    setZoomInputValue(nextValue.toFixed(2));
  }

  function resetZoomInputValue() {
    setZoomInputValue(currentCrop ? currentCrop.scale.toFixed(2) : '1.00');
  }

  return {
    activateCustomLayoutPreview,
    clearTemplateHoverPreview,
    commitZoomInputValue,
    customLayoutPreviewActive,
    deactivateCustomLayoutPreview,
    handleCropMetricsChange,
    handleCustomLayoutPreviewBlur,
    handleCustomLayoutPreviewFocus,
    handleZoomInputChange,
    nudgeSelectedCrop,
    nudgeSelectedScale,
    openTemplateHoverPreview,
    pinnedCustomLayoutPreview,
    resetZoomInputValue,
    selectedCropMetrics,
    templateHoverPreview,
    zoomInputValue,
  };
}
