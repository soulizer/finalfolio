export type TemplateId = 'cover' | 'essay' | 'folio' | 'grid' | 'diptych' | 'panorama' | 'mosaic' | 'triptych';

export type ImageFit = 'cover' | 'contain';

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
  fit: ImageFit;
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

export interface ProjectRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  sharePath: string;
  project: ProjectState;
}
