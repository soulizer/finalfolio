import { clampLayoutArea } from './layoutGeometry';
import type { CustomTemplateDefinition, LayoutArea, TemplateId } from './types';

/**
 * Built-in layouts are code, not data: they have no stored frame geometry.
 * "Edit layout" therefore starts from what the user currently sees. We measure
 * the live page element and turn it into a custom layout, so the copy opens
 * with the same frame placement instead of an unrelated default.
 *
 * Coordinates are percentages of the template canvas (the 1fr row inside
 * .magazine-page), which is exactly the box .magazine-custom__canvas occupies.
 */
const textContainerByTemplate: Partial<Record<TemplateId, string>> = {
  cover: '.magazine-cover__copy',
  essay: '.magazine-essay__copy',
  folio: '.magazine-folio__header',
  grid: '.magazine-grid__copy',
  diptych: '.magazine-diptych__header',
  panorama: '.magazine-panorama__header',
  mosaic: '.magazine-mosaic__band',
  triptych: '.magazine-triptych__footer',
};

function areaFromRect(rect: DOMRect, base: DOMRect): LayoutArea {
  return clampLayoutArea({
    x: ((rect.left - base.left) / base.width) * 100,
    y: ((rect.top - base.top) / base.height) * 100,
    width: (rect.width / base.width) * 100,
    height: (rect.height / base.height) * 100,
  });
}

export function customTemplateFromPageElement({
  canvas,
  templateId,
  name,
  labels,
}: {
  canvas: HTMLElement;
  templateId: TemplateId;
  name: string;
  labels: string[];
}): CustomTemplateDefinition | null {
  const base = canvas.getBoundingClientRect();
  if (!base.width || !base.height) {
    return null;
  }

  const frames = Array.from(canvas.querySelectorAll<HTMLElement>('.asset-frame'))
    .map((frame, index) => {
      const rect = frame.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return null;
      }
      return {
        slot: `frame${index + 1}`,
        label: labels[index] ?? `Frame ${index + 1}`,
        ...areaFromRect(rect, base),
      };
    })
    .filter((frame): frame is NonNullable<typeof frame> => Boolean(frame));

  if (!frames.length) {
    return null;
  }

  const textSelector = textContainerByTemplate[templateId];
  const textElement = textSelector ? canvas.querySelector<HTMLElement>(textSelector) : null;
  const textRect = textElement?.getBoundingClientRect();
  const text =
    textRect && textRect.width > 0 && textRect.height > 0
      ? areaFromRect(textRect, base)
      : // No measured copy block: reserve the top of the page for text so the
        // custom layout still has an editable region.
        clampLayoutArea({ x: 0, y: 0, width: 100, height: 24 });

  return {
    name,
    text,
    frames,
  };
}
