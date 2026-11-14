import { Asset, PageData } from '../editor/types';

export interface SiteFeatureCard {
  id: string;
  title: string;
  copy: string;
}

export interface SiteContent {
  hero: {
    eyebrow: string;
    title: string;
    lede: string;
    primaryCtaLabel: string;
    secondaryCtaLabel: string;
    tertiaryCtaLabel: string;
  };
  editorialNote: {
    body: string;
  };
  features: SiteFeatureCard[];
  workflow: {
    eyebrow: string;
    title: string;
    body: string;
    steps: string[];
  };
  positioning: {
    eyebrow: string;
    title: string;
    body: string;
  };
  cta: {
    eyebrow: string;
    title: string;
    body: string;
    primaryLabel: string;
    secondaryLabel: string;
  };
  featuredIssue: {
    eyebrow: string;
    title: string;
    body: string;
    projectId: string | null;
    pageIds: string[];
  };
}

export interface TemplateGovernanceEntry {
  enabled: boolean;
  order: number;
  category: string;
  tag: string;
  featured?: boolean;
}

export interface TemplateGovernance {
  templates: Record<string, TemplateGovernanceEntry>;
  packs: Record<string, TemplateGovernanceEntry>;
}

export interface HomepagePreviewPayload {
  source: 'project' | 'demo';
  projectId: string | null;
  sharePath: string | null;
  issue: string;
  title: string;
  subtitle: string;
  frameRadius: number;
  assets: Asset[];
  pages: PageData[];
  updatedAt: string | null;
}
