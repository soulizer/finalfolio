
import { createDefaultCrop, createPageDraft } from '../editor/demoData';
import { Asset } from '../editor/types';
import { HomepagePreviewPayload, SiteContent } from './types';

const demoAssets: Asset[] = [
  {
    id: 'builtin-architecture',
    name: 'Architecture',
    src: '/builtins/architecture-stock.jpg',
    note: '',
    builtIn: true,
    width: 1200,
    height: 1600,
  },
  {
    id: 'builtin-landscape',
    name: 'Landscape',
    src: '/builtins/landscape-lowangle-v2.jpg',
    note: '',
    builtIn: true,
    width: 1600,
    height: 1200,
  },
  {
    id: 'builtin-portrait',
    name: 'Portrait',
    src: '/builtins/portrait-male-glasses-v3.jpg',
    note: '',
    builtIn: true,
    width: 1200,
    height: 1600,
  },
  {
    id: 'builtin-still-life',
    name: 'Still life',
    src: '/builtins/still-life-stock.jpg',
    note: '',
    builtIn: true,
    width: 1200,
    height: 1600,
  },
  {
    id: 'builtin-studio',
    name: 'Studio',
    src: '/builtins/studio-stock.jpg',
    note: '',
    builtIn: true,
    width: 1200,
    height: 1600,
  },
  {
    id: 'builtin-atelier',
    name: 'Atelier portrait',
    src: '/builtins/atelier-portrait-v2.jpg',
    note: '',
    builtIn: true,
    width: 1200,
    height: 1600,
  },
  {
    id: 'builtin-coastline',
    name: 'Coastline',
    src: '/builtins/coastline-lowangle-v2.jpg',
    note: '',
    builtIn: true,
    width: 1600,
    height: 1200,
  },
  {
    id: 'builtin-interior',
    name: 'Interior',
    src: '/builtins/interior-stock.jpg',
    note: '',
    builtIn: true,
    width: 1600,
    height: 1200,
  },
  {
    id: 'builtin-night-window',
    name: 'Night window',
    src: '/builtins/night-window-stock.jpg',
    note: '',
    builtIn: true,
    width: 1600,
    height: 1200,
  },
  {
    id: 'builtin-still-life-vase',
    name: 'Still life vase',
    src: '/builtins/still-life-vase-stock.jpg',
    note: '',
    builtIn: true,
    width: 1200,
    height: 1600,
  },
  {
    id: 'builtin-seated-portrait',
    name: 'Seated portrait',
    src: '/builtins/portrait-male-white-shirt-v3.jpg',
    note: '',
    builtIn: true,
    width: 1200,
    height: 1600,
  },
  {
    id: 'builtin-window-portrait',
    name: 'Window portrait',
    src: '/builtins/window-portrait-v2.jpg',
    note: '',
    builtIn: true,
    width: 1200,
    height: 1600,
  },
];

export const defaultSiteContent: SiteContent = {
  hero: {
    eyebrow: 'Folios, not endless galleries',
    title: 'Turn your photographs into a paced folio.',
    lede:
      'FinalFolio gives photographers, studios, and brand teams a calmer workflow to upload, sequence, write, crop, and export polished pages that still hold up as a PDF.',
    primaryCtaLabel: 'Start a folio',
    secondaryCtaLabel: 'Sign in',
    tertiaryCtaLabel: 'See the workflow',
  },
  editorialNote: {
    body:
      'Designed for teams that want editorial restraint, multi-page pacing, and a calmer publishing flow before committing to heavyweight desktop layout software.',
  },
  features: [
    {
      id: 'issue-composition',
      title: 'Folio composition, not asset dumping',
      copy:
        'Build a paced sequence of pages with cover, essay, grid, panorama, diptych, and triptych rhythms instead of dropping images into an endless strip.',
    },
    {
      id: 'preview-to-pdf',
      title: 'Preview that stays close to export',
      copy:
        'Crop, fit, copy, and page geometry stay grounded in the same page model the product uses when you print or export to PDF.',
    },
    {
      id: 'governed-projects',
      title: 'Projects that belong to a product',
      copy:
        'Accounts, uploads, projects, exports, and failures stay attached to users and can be reviewed from the admin backend instead of disappearing into a demo sandbox.',
    },
  ],
  workflow: {
    eyebrow: 'Workflow',
    title: 'From upload to folio, without jumping into desktop publishing too early.',
    body:
      'Start from a starter pack, shape the story page by page, refine crop and fit in place, and export a calmer PDF without losing sight of the final form.',
    steps: [
      'Upload photographs and keep them attached to a real project on the server.',
      'Sequence cover, essay, grid, panorama, and custom pages while the folio stays visible.',
      'Save the project at a stable URL, then print or export the finished folio.',
    ],
  },
  positioning: {
    eyebrow: 'Positioning',
    title: 'Closer to a lightweight editorial studio than a generic photo SaaS.',
    body:
      'FinalFolio is built around pacing, page rhythm, and printable output. The editor handles creation, the homepage proves the product, and the admin backend governs the system.',
  },
  cta: {
    eyebrow: 'Editor',
    title: 'Start shaping a folio now.',
    body:
      'Upload a real set of photographs, compose the sequence page by page, and keep the final export model visible while you work.',
    primaryLabel: 'Open Editor',
    secondaryLabel: 'Open sign in',
  },
  featuredIssue: {
    eyebrow: 'Featured folio output',
    title: 'What the system actually renders',
    body:
      'The homepage preview uses the same page renderer as the editor. Admin can pin a live folio here, or the product falls back to a built-in demonstration sequence.',
    projectId: null,
    pageIds: [],
  },
};

export function createHomepageDemoPreview(): HomepagePreviewPayload {
  return {
    source: 'demo',
    projectId: null,
    sharePath: null,
    issue: 'Folio 01',
    title: 'Quiet Streets',
    subtitle: 'A wider sequence of cover, feature, grid, and panorama pages rendered from the same page engine used inside the editor.',
    frameRadius: 18,
    assets: demoAssets,
    pages: [
      createPageDraft('cover', 'home-cover', {
        title: 'Quiet Streets',
        deck: 'Folio 01',
        caption: 'A restrained opening page with one clear lead image.',
        slots: {
          hero: 'builtin-architecture',
        },
        crops: {
          hero: createDefaultCrop({ x: 52, y: 46, scale: 1.04 }),
        },
      }),
      createPageDraft('essay', 'home-essay', {
        kicker: 'Editor note',
        title: 'Sequence first, then details.',
        theme: 'pale-blue',
        deck: 'Essay pages keep a lead image and the opening note on the same sheet.',
        body:
          'Instead of tuning crop, fit, and text in disconnected panels, FinalFolio keeps the page itself in view while you shape the folio.',
        caption: 'One image, one block of copy, one calm editorial page.',
        slots: {
          hero: 'builtin-atelier',
        },
        crops: {
          hero: createDefaultCrop({ x: 52, y: 42, scale: 1.02 }),
        },
      }),
      createPageDraft('grid', 'home-grid', {
        kicker: 'Interior rhythm',
        title: 'Use smaller frames to pace the folio.',
        theme: 'butter-cream',
        body: 'Grids slow the sequence down and make room for detail, contrast, or supporting images.',
        caption: 'Four frames, one page rhythm.',
        slots: {
          a: 'builtin-still-life-vase',
          b: 'builtin-still-life',
          c: 'builtin-interior',
          d: 'builtin-studio',
        },
        crops: {
          a: createDefaultCrop({ x: 50, y: 48, scale: 1.02 }),
          b: createDefaultCrop({ x: 52, y: 48, scale: 1.04 }),
          c: createDefaultCrop({ x: 52, y: 50, scale: 1 }),
          d: createDefaultCrop({ x: 50, y: 50, scale: 1 }),
        },
      }),
      createPageDraft('panorama', 'home-panorama', {
        kicker: 'Closing spread',
        title: 'Wide frames stay predictable.',
        theme: 'pure-white',
        deck: 'Panorama pages keep horizontal images tied to the same printable geometry.',
        caption: 'Top-and-tail pacing without layout drift.',
        slots: {
          top: 'builtin-coastline',
          bottom: 'builtin-night-window',
        },
        crops: {
          top: createDefaultCrop({ x: 50, y: 50, scale: 1 }),
          bottom: createDefaultCrop({ x: 50, y: 50, scale: 1 }),
        },
      }),
      createPageDraft('folio', 'home-folio', {
        kicker: 'Feature page',
        title: 'Let one page carry the room.',
        theme: 'sage-mist',
        deck: 'Folio pages give a single image enough air before the sequence returns to smaller frames.',
        caption: 'One image, one page, no layout drift.',
        slots: {
          hero: 'builtin-interior',
        },
        crops: {
          hero: createDefaultCrop({ x: 51, y: 50, scale: 1.02 }),
        },
      }),
      createPageDraft('mosaic', 'home-mosaic', {
        kicker: 'Detail cluster',
        title: 'One lead image can hold two quieter details.',
        theme: 'light-gray',
        deck: 'Mosaic pages keep hierarchy visible when a project needs one dominant image and two supporting frames.',
        body: 'Use a lead frame for the anchor image, then tighten the sequence with secondary details without losing the page rhythm.',
        caption: 'A more editorial middle page with clear image hierarchy.',
        slots: {
          lead: 'builtin-portrait',
          top: 'builtin-still-life-vase',
          bottom: 'builtin-night-window',
        },
        crops: {
          lead: createDefaultCrop({ x: 49, y: 44, scale: 1.08 }),
          top: createDefaultCrop({ x: 50, y: 50, scale: 1.02 }),
          bottom: createDefaultCrop({ x: 50, y: 50, scale: 1 }),
        },
      }),
      createPageDraft('diptych', 'home-diptych', {
        kicker: 'Paired frames',
        title: 'Two images can still feel paced.',
        theme: 'sandstone',
        deck: 'Diptych pages hold a cleaner comparison when a spread needs balance without becoming a contact sheet.',
        body: 'Use a diptych when two images belong together but still need enough room to breathe on the page.',
        caption: 'A restrained two-frame transition.',
        slots: {
          left: 'builtin-coastline',
          right: 'builtin-architecture',
        },
        crops: {
          left: createDefaultCrop({ x: 50, y: 50, scale: 1 }),
          right: createDefaultCrop({ x: 50, y: 48, scale: 1.02 }),
        },
      }),

createPageDraft('triptych', 'home-triptych', {
  kicker: 'Portrait run',
  title: 'Repeat a subject without flattening the sequence.',
  theme: 'pearl-blush',
  deck: 'Triptych pages help a folio carry three related images as a set instead of collapsing them into one block.',
  body: 'When the story needs repetition, a three-frame page keeps the comparison readable and the pacing controlled.',
  caption: 'Three related frames, one consistent cadence.',
  slots: {
    a: 'builtin-seated-portrait',
    b: 'builtin-window-portrait',
    c: 'builtin-portrait',
  },
  crops: {
    a: createDefaultCrop({ x: 50, y: 44, scale: 1.03 }),
    b: createDefaultCrop({ x: 52, y: 42, scale: 1.02 }),
    c: createDefaultCrop({ x: 48, y: 44, scale: 1.08 }),
  },
}),
      createPageDraft('essay', 'home-essay-night', {
        kicker: 'After hours',
        title: 'Quiet pages still carry atmosphere.',
        theme: 'sea-glass',
        deck: 'Essay pages can hold context, credits, or a short note without taking the page away from the image.',
        body: 'The same page model can open with a note, shift into quieter documentary material, and stay visually stable all the way through export.',
        caption: 'A darker image still sits on the same calmer paper system.',
        slots: {
          hero: 'builtin-night-window',
        },
        crops: {
          hero: createDefaultCrop({ x: 50, y: 50, scale: 1 }),
        },
      }),
      createPageDraft('grid', 'home-grid-coast', {
        kicker: 'Supporting set',
        title: 'Close details can still feel varied.',
        theme: 'warm-beige',
        body: 'Grid pages can mix room views, textures, still-life details, and wider frames without making the sequence feel repetitive.',
        caption: 'A mixed grid with different image types and steadier pacing.',
        slots: {
          a: 'builtin-interior',
          b: 'builtin-still-life-vase',
          c: 'builtin-coastline',
          d: 'builtin-architecture',
        },
        crops: {
          a: createDefaultCrop({ x: 51, y: 50, scale: 1.01 }),
          b: createDefaultCrop({ x: 50, y: 49, scale: 1.04 }),
          c: createDefaultCrop({ x: 50, y: 50, scale: 1 }),
          d: createDefaultCrop({ x: 50, y: 48, scale: 1.02 }),
        },
      }),
    ],
    updatedAt: null,
  };
}
