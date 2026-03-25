export type TemplateId = 'cover' | 'essay' | 'grid' | 'diptych';

export interface Asset {
  id: string;
  name: string;
  src: string;
  note: string;
  builtIn?: boolean;
}

export interface CropSettings {
  x: number;
  y: number;
  scale: number;
}

export interface PageData {
  id: string;
  template: TemplateId;
  kicker: string;
  title: string;
  deck: string;
  body: string;
  caption: string;
  slots: Record<string, string | null>;
  crops: Record<string, CropSettings>;
}

export interface ProjectState {
  title: string;
  subtitle: string;
  issue: string;
  assets: Asset[];
  pages: PageData[];
}

