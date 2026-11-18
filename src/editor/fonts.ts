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
    id: 'default',
    label: '默认',
    stack: 'var(--font-display)',
    chinese: true,
  },
  {
    id: 'serif-cn',
    label: '思源宋体',
    stack: '"FF Serif SC", "Noto Serif CJK SC", "Songti SC", SimSun, serif',
    chinese: true,
  },
  {
    id: 'sans-cn',
    label: '思源黑体',
    stack: '"FF Sans SC", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif',
    chinese: true,
  },
  {
    id: 'wenkai',
    label: '霞鹜文楷',
    stack: '"LXGW WenKai Display", "Kaiti SC", serif',
    chinese: true,
  },
  {
    id: 'mashanzheng',
    label: '马善政毛笔楷书',
    stack: '"FF Ma Shan Zheng", "Ma Shan Zheng", cursive',
    chinese: true,
  },
  {
    id: 'zhimangxing',
    label: '志莽行书',
    stack: '"FF Zhi Mang Xing", "Zhi Mang Xing", cursive',
    chinese: true,
  },
  {
    id: 'longcang',
    label: '龙藏体',
    stack: '"FF Long Cang", "Long Cang", cursive',
    chinese: true,
  },
  {
    id: 'smileysans',
    label: '得意黑',
    stack: '"FF Smiley Sans", "Smiley Sans", "PingFang SC", sans-serif',
    chinese: true,
  },
];

export const DEFAULT_PROJECT_FONTS: ProjectFonts = {
  title: 'default',
  deck: 'default',
  caption: 'default',
};

export const PROJECT_FONT_ROLES = ['title', 'deck', 'caption'] as const;

export function getFontOption(id: string | null | undefined) {
  return FONT_OPTIONS.find((font) => font.id === id) ?? FONT_OPTIONS[0];
}

const LEGACY_FONT_IDS: Record<string, string> = {
  'default-display': 'default',
  'default-ui': 'default',
  inherit: 'default',
  editorial: 'serif-cn',
  inter: 'sans-cn',
};

export function normalizeProjectFonts(fonts: Partial<ProjectFonts> | null | undefined): ProjectFonts {
  const pick = (value: string | undefined, fallback: string) => {
    const normalized = value && LEGACY_FONT_IDS[value] ? LEGACY_FONT_IDS[value] : value;
    return FONT_OPTIONS.some((font) => font.id === normalized) ? (normalized as string) : fallback;
  };
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
