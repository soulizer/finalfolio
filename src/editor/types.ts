export type BuiltInTemplateId = 'cover' | 'essay' | 'folio' | 'grid' | 'diptych' | 'panorama' | 'mosaic' | 'triptych';
export type TemplateId = BuiltInTemplateId | 'custom';
export type PageThemeId = 'warm-beige' | 'pale-blue' | 'pure-white' | 'light-gray';

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

export interface LayoutArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CustomTemplateFrame extends LayoutArea {
  slot: string;
  label: string;
}

export interface CustomTemplateDefinition {
  name: string;
  text: LayoutArea;
  frames: ReadonlyArray<CustomTemplateFrame>;
}

export interface PageData {
  id: string;
  template: TemplateId;
  theme: PageThemeId;
  kicker: string;
  title: string;
  deck: string;
  body: string;
  caption: string;
  customTemplate: CustomTemplateDefinition | null;
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
