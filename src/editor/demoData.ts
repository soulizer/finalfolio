import architecture from '../assets/architecture.svg';
import landscape from '../assets/landscape.svg';
import portrait from '../assets/portrait.svg';
import stillLife from '../assets/still-life.svg';
import studio from '../assets/studio.svg';
import { Asset, CropSettings, ProjectState, TemplateId } from './types';

const defaultCrop = (): CropSettings => ({ x: 50, y: 50, scale: 1 });

export const templateMeta: Record<TemplateId, { label: string; description: string; slots: string[] }> = {
  cover: {
    label: 'Cover',
    description: 'Single-image cover with issue metadata and restrained text.',
    slots: ['hero'],
  },
  essay: {
    label: 'Essay',
    description: 'One dominant frame with a text column for story and captions.',
    slots: ['hero'],
  },
  grid: {
    label: 'Grid',
    description: 'A quiet four-frame contact sheet for sequencing smaller moments.',
    slots: ['a', 'b', 'c', 'd'],
  },
  diptych: {
    label: 'Diptych',
    description: 'Two balanced images for before/after or paired scenes.',
    slots: ['left', 'right'],
  },
};

export const builtInAssets: Asset[] = [
  { id: 'architecture', name: 'Architecture', src: architecture, note: 'Steel, windows, and late shadows.', builtIn: true },
  { id: 'landscape', name: 'Landscape', src: landscape, note: 'A restrained horizon for open spreads.', builtIn: true },
  { id: 'portrait', name: 'Portrait', src: portrait, note: 'Soft portrait study with negative space.', builtIn: true },
  { id: 'still-life', name: 'Still life', src: stillLife, note: 'Tabletop composition with quiet contrast.', builtIn: true },
  { id: 'studio', name: 'Studio', src: studio, note: 'Interior frame with shelving and daylight.', builtIn: true },
];

export function createDefaultProject(): ProjectState {
  return {
    title: 'Quiet Streets',
    subtitle: 'A magazine assembled from one camera roll and a long walk home.',
    issue: 'Issue 01',
    assets: builtInAssets,
    pages: [
      {
        id: 'page-cover',
        template: 'cover',
        kicker: 'CrazyAlbum prototype',
        title: 'Quiet Streets',
        deck: 'Issue 01',
        body: '',
        caption: 'A live, page-accurate cover preview.',
        slots: {
          hero: 'architecture',
        },
        crops: {
          hero: { x: 50, y: 42, scale: 1.08 },
        },
      },
      {
        id: 'page-essay',
        template: 'essay',
        kicker: 'Opening note',
        title: 'Late light settles the sequence.',
        deck: 'Place one image, write a caption, and the page behaves like the final issue.',
        body:
          'The goal is not another gallery. It is pacing, contrast, and room for text to breathe. The editor keeps the sheet visible while you arrange images, swap templates, and tune crop positions.',
        caption: 'Every field on the right updates the page immediately.',
        slots: {
          hero: 'studio',
        },
        crops: {
          hero: { x: 52, y: 48, scale: 1.02 },
        },
      },
      {
        id: 'page-grid',
        template: 'grid',
        kicker: 'Contact sheet',
        title: 'Twelve frames become four deliberate beats.',
        deck: 'Drag photographs onto frames to shape rhythm without leaving the page.',
        body: '',
        caption: 'Grid layouts hold smaller details without turning noisy.',
        slots: {
          a: 'portrait',
          b: 'still-life',
          c: 'landscape',
          d: 'architecture',
        },
        crops: {
          a: defaultCrop(),
          b: defaultCrop(),
          c: { x: 50, y: 40, scale: 1.1 },
          d: { x: 50, y: 50, scale: 1.08 },
        },
      },
      {
        id: 'page-diptych',
        template: 'diptych',
        kicker: 'Pairing',
        title: 'Place two moments on one spread.',
        deck: 'Diptychs are useful for comparison, sequence breaks, or a calmer ending.',
        body: '',
        caption: 'Print to PDF straight from the browser when the issue is ready.',
        slots: {
          left: 'landscape',
          right: 'portrait',
        },
        crops: {
          left: { x: 50, y: 44, scale: 1.06 },
          right: { x: 50, y: 46, scale: 1.12 },
        },
      },
    ],
  };
}

