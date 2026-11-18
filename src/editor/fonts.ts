import type { ProjectFonts } from './types';

export interface FontOption {
  id: string;
  label: string;
  stack: string;
  /** True when the stack renders Chinese text with a CJK-first face. */
  chinese: boolean;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'inherit',
    label: '跟随正文（默认）',
    stack: 'inherit',
    chinese: true,
  },
  {
    id: 'default-display',
    label: '编辑体（默认）',
    stack: 'var(--font-display)',
    chinese: true,
  },
  {
    id: 'default-ui',
    label: '界面体（默认）',
    stack: 'var(--font-ui)',
    chinese: true,
  },
  {
    id: 'serif-cn',
    label: '宋体',
    stack: '"FF Serif SC", "Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", "SimSun", serif',
    chinese: true,
  },
  {
    id: 'sans-cn',
    label: '黑体',
    stack: '"FF Sans SC", "Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
    chinese: true,
  },
  {
    id: 'kai-cn',
    label: '楷体',
    stack: '"Kaiti SC", "KaiTi", "STKaiti", "LXGW WenKai Display", serif',
    chinese: true,
  },
  {
    id: 'wenkai',
    label: '霞鹜文楷',
    stack: '"LXGW WenKai Display", "Kaiti SC", "Songti SC", serif',
    chinese: true,
  },
  {
    id: 'newsreader',
    label: 'Newsreader',
    stack: '"Newsreader", Georgia, "Times New Roman", serif',
    chinese: false,
  },
  {
    id: 'inter',
    label: 'Inter',
    stack: '"Inter", "Helvetica Neue", Arial, sans-serif',
    chinese: false,
  },
];

export const DEFAULT_PROJECT_FONTS: ProjectFonts = {
  title: 'default-display',
  deck: 'inherit',
  caption: 'inherit',
};

export const PROJECT_FONT_ROLES = ['title', 'deck', 'caption'] as const;

export function getFontOption(id: string | null | undefined) {
  return FONT_OPTIONS.find((font) => font.id === id) ?? FONT_OPTIONS[0];
}

export function normalizeProjectFonts(fonts: Partial<ProjectFonts> | null | undefined): ProjectFonts {
  const pick = (value: string | undefined, fallback: string) =>
    FONT_OPTIONS.some((font) => font.id === value) ? (value as string) : fallback;
  return {
    title: pick(fonts?.title, DEFAULT_PROJECT_FONTS.title),
    deck: pick(fonts?.deck, DEFAULT_PROJECT_FONTS.deck),
    caption: pick(fonts?.caption, DEFAULT_PROJECT_FONTS.caption),
  };
}

/** CSS custom properties consumed by the magazine page styles. */
export function buildProjectFontVars(fonts: Partial<ProjectFonts> | null | undefined) {
  const normalized = normalizeProjectFonts(fonts);
  return {
    '--page-font-title': getFontOption(normalized.title).stack,
    '--page-font-deck': getFontOption(normalized.deck).stack,
    '--page-font-caption': getFontOption(normalized.caption).stack,
  } as Record<string, string>;
}
