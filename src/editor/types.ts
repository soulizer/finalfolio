export type BuiltInTemplateId = 'cover' | 'essay' | 'folio' | 'grid' | 'diptych' | 'panorama' | 'mosaic' | 'triptych';
export type TemplateId = BuiltInTemplateId | 'custom';
export type UserTemplateKind = 'page' | 'project';
export type PageThemeId =
  | 'warm-beige'
  | 'butter-cream'
  | 'pale-blue'
  | 'sea-glass'
  | 'pure-white'
  | 'light-gray'
  | 'sandstone'
  | 'sage-mist'
  | 'dusty-rose'
  | 'pearl-blush';

export type ImageFit = 'cover' | 'contain';
export type AssetVariantKind = 'original' | 'preview' | 'thumb';
export type AssetDeliveryState = 'local' | 'pending' | 'remote' | 'failed';
export type AssetOrientation = 'landscape' | 'portrait' | 'square' | 'unknown';
export type ExportFormat = 'pdf' | 'project' | 'jpg';
export type ExportQuality = 'draft' | 'standard' | 'print';
export type ExportPageSize = 'a5' | 'a4' | 'a3';
export type JpgExportMode = 'separate' | 'combined';

export interface AssetDelivery {
  state: AssetDeliveryState;
  canRetry?: boolean;
  queuedAt?: string | null;
  lastAttemptAt?: string | null;
  syncedAt?: string | null;
  error?: string | null;
  attempts?: number;
}

export interface AssetVariant {
  src: string;
  width?: number;
  height?: number;
  bytes?: number;
  mimeType?: string;
}

export interface AssetVariants {
  original?: AssetVariant;
  preview?: AssetVariant | null;
  thumb?: AssetVariant | null;
}

export interface AssetAnalysis {
  description: string;
  tags: string[];
  /** Where the analysis came from, for example `unalbum`. */
  source?: string;
  analyzedAt?: string;
}

export interface Asset {
  id: string;
  name: string;
  src: string;
  note: string;
  builtIn?: boolean;
  width?: number;
  height?: number;
  bytes?: number;
  mimeType?: string;
  variants?: AssetVariants;
  delivery?: AssetDelivery;
  lastUsedAt?: string | null;
  /** Tags and description produced by an upstream AI; reused instead of re-reading pixels. */
  analysis?: AssetAnalysis;
  /** UnAlbum photo id, set when the asset came through the UnAlbum bridge. */
  unalbumId?: string;
  /** Client-only: a preview shown while the real copy is being written. */
  pending?: boolean;

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

export interface ProjectFonts {
  title: string;
  deck: string;
  caption: string;
  body: string;
}

export interface ProjectState {
  title: string;
  subtitle: string;
  issue: string;
  frameRadius: number;
  fonts?: ProjectFonts;
  assets: Asset[];
  pages: PageData[];
}

export interface ProjectShareMeta {
  id: string | null;
  enabled: boolean;
  path: string | null;
  sharedAt: string | null;
  version: number;
}

export interface ProjectRecord {
  id: string;
  rev?: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  ownerUserId?: string | null;
  sharePath: string;
  share: ProjectShareMeta;
  project: ProjectState;
}

export interface UserTemplatePage {
  template: TemplateId;
  theme: PageThemeId;
  kicker: string;
  title: string;
  deck: string;
  body: string;
  caption: string;
  customTemplate: CustomTemplateDefinition | null;
}

export interface UserTemplatePayload {
  title: string;
  subtitle: string;
  issue: string;
  frameRadius: number;
  pages: UserTemplatePage[];
}

export interface UserTemplateRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  ownerUserId?: string | null;
  name: string;
  description: string;
  kind: UserTemplateKind;
  sourceProjectId?: string | null;
  includesCopy: boolean;
  preserveCopy?: boolean;
  previewPageIndex?: number | null;
  templatePayload: UserTemplatePayload;
}

export interface ExportSettings {
  format: ExportFormat;
  pageSize: ExportPageSize;
  quality: ExportQuality;
  jpgMode: JpgExportMode;
}

export interface ExportPreflightIssue {
  code:
    | 'missing-image'
    | 'uncovered-frame'
    | 'low-resolution'
    | 'empty-page'
    | 'odd-page-count'
    | 'tight-gutter';
  severity: 'warning';
  pageId: string;
  pageIndex: number;
  pageTitle: string;
  slot?: string;
  message: string;
}

export interface AccountPreferences {
  defaultExportFormat: ExportFormat;
  defaultExportQuality: ExportQuality;
  defaultPageSize: ExportPageSize;
  defaultPageTheme: PageThemeId | null;
  preserveCopyWhenSavingTemplate: boolean;
}

export interface AccountActivityItem {
  id: string;
  type: 'project' | 'export' | 'template' | 'upload' | 'share' | 'auth';
  action: string;
  label: string;
  status: 'ok' | 'error' | 'requested';
  createdAt: string;
  projectId: string | null;
  detail: Record<string, unknown> | null;
}

export interface PublicIssuePayload {
  shareId: string;
  projectId: string;
  sharedAt: string | null;
  updatedAt: string;
  title: string;
  subtitle: string;
  issue: string;
  ownerDisplay?: string | null;
  frameRadius: number;
  fonts?: ProjectFonts;
  pages: PageData[];
  assets: Asset[];
}
