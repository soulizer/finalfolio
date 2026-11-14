import { CustomLayoutMap } from './CustomLayoutMap';
import { customLayoutPresets, defaultCustomLayoutPresetId } from '../editor/demoData';
import { BuiltInTemplateId, CustomTemplateDefinition, TemplateId } from '../editor/types';

const builtinPreviewLayouts: Record<BuiltInTemplateId, CustomTemplateDefinition> = {
  cover: {
    name: 'Cover',
    text: { x: 8, y: 60, width: 52, height: 24 },
    frames: [{ slot: 'hero', label: 'Hero', x: 0, y: 0, width: 100, height: 100 }],
  },
  essay: {
    name: 'Essay',
    text: { x: 58, y: 8, width: 34, height: 84 },
    frames: [{ slot: 'hero', label: 'Hero', x: 0, y: 0, width: 52, height: 100 }],
  },
  folio: {
    name: 'Folio',
    text: { x: 0, y: 0, width: 100, height: 18 },
    frames: [{ slot: 'hero', label: 'Hero', x: 0, y: 24, width: 100, height: 62 }],
  },
  grid: {
    name: 'Grid',
    text: { x: 0, y: 0, width: 42, height: 16 },
    frames: [
      { slot: 'a', label: 'A', x: 0, y: 22, width: 48, height: 32 },
      { slot: 'b', label: 'B', x: 52, y: 22, width: 48, height: 32 },
      { slot: 'c', label: 'C', x: 0, y: 58, width: 48, height: 32 },
      { slot: 'd', label: 'D', x: 52, y: 58, width: 48, height: 32 },
    ],
  },
  diptych: {
    name: 'Diptych',
    text: { x: 0, y: 0, width: 100, height: 18 },
    frames: [
      { slot: 'left', label: 'Left', x: 0, y: 24, width: 48, height: 60 },
      { slot: 'right', label: 'Right', x: 52, y: 24, width: 48, height: 60 },
    ],
  },
  panorama: {
    name: 'Panorama',
    text: { x: 0, y: 0, width: 100, height: 18 },
    frames: [
      { slot: 'top', label: 'Top', x: 0, y: 24, width: 100, height: 26 },
      { slot: 'bottom', label: 'Bottom', x: 0, y: 56, width: 100, height: 26 },
    ],
  },
  mosaic: {
    name: 'Mosaic',
    text: { x: 0, y: 74, width: 54, height: 20 },
    frames: [
      { slot: 'lead', label: 'Lead', x: 0, y: 0, width: 60, height: 68 },
      { slot: 'top', label: 'Top', x: 64, y: 0, width: 36, height: 32 },
      { slot: 'bottom', label: 'Bottom', x: 64, y: 36, width: 36, height: 32 },
    ],
  },
  triptych: {
    name: 'Triptych',
    text: { x: 0, y: 76, width: 64, height: 18 },
    frames: [
      { slot: 'a', label: 'A', x: 0, y: 0, width: 31, height: 70 },
      { slot: 'b', label: 'B', x: 34.5, y: 0, width: 31, height: 70 },
      { slot: 'c', label: 'C', x: 69, y: 0, width: 31, height: 70 },
    ],
  },
};

function getTemplatePreviewLayout(templateId: TemplateId, customTemplate?: CustomTemplateDefinition | null) {
  if (templateId === 'custom') {
    return customTemplate ?? customLayoutPresets.find((preset) => preset.id === defaultCustomLayoutPresetId)?.template ?? customLayoutPresets[0].template;
  }

  return builtinPreviewLayouts[templateId];
}

interface TemplateLayoutPreviewProps {
  templateId: TemplateId;
  customTemplate?: CustomTemplateDefinition | null;
  className?: string;
}

export function TemplateLayoutPreview({ templateId, customTemplate, className }: TemplateLayoutPreviewProps) {
  return <CustomLayoutMap template={getTemplatePreviewLayout(templateId, customTemplate)} className={className} />;
}
