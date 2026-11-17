import {
  AccountActivityItem,
  AccountPreferences,
  Asset,
  AssetDelivery,
  AssetVariant,
  ExportSettings,
  ProjectRecord,
  ProjectState,
  PublicIssuePayload,
  UserTemplatePayload,
  UserTemplateRecord,
} from './types';
import type { AiPlanBundle } from './aiPlans';
import { HomepagePreviewPayload, SiteContent, TemplateGovernance } from '../product/types';
import { buildTermsPath, redirectToTerms } from '../legal/terms';

export interface UploadRequestProgress {
  loadedBytes: number;
  totalBytes: number;
}

export interface UploadAssetMetadata {
  width: number;
  height: number;
}

export interface UserSession {
  id: string;
  email: string;
  username: string | null;
  role: 'admin' | 'user';
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
  emailVerifiedAt: string | null;
  verificationSentAt: string | null;
  passwordResetRequestedAt: string | null;
  termsAcceptedAt?: string | null;
  termsAcceptedVersion?: string | null;
  termsAcceptedLanguage?: string | null;
  needsTermsAcceptance?: boolean;
}

export interface BootstrapStatus {
  hasUsers: boolean;
  requiresBootstrap: boolean;
}

export interface AuthCaptchaChallenge {
  id: string;
  purpose: 'register';
  prompt: string;
  imageDataUrl: string;
  expiresAt: string;
}

export interface AdminSummary {
  counts: {
    users: number;
    projects: number;
    uploads: number;
    exports: number;
  };
  storage: {
    uploadBytes: number;
    originalBytes: number;
    derivedBytes: number;
    totalBytes: number;
  };
  failureCounts: Record<string, number>;
  eventTypeBreakdown: Record<string, { total: number; failures: number }>;
  recentActivity: UserSession[];
  failures: Array<{
    id: string;
    type: string;
    status: string;
    userId: string | null;
    projectId: string | null;
    detail: { path?: string; message?: string; reason?: string | null } | null;
    createdAt: string;
  }>;
  events: Array<{
    id: string;
    type: string;
    status: string;
    userId: string | null;
    projectId: string | null;
    detail: Record<string, unknown> | null;
    createdAt: string;
  }>;
  trends: {
    last24Hours: Array<{
      label: string;
      start?: string;
      total: number;
      failures: number;
    }>;
    last7Days: Array<{
      label: string;
      start?: string;
      total: number;
      failures: number;
    }>;
  };
}

export interface AdminAiProviderConfig {
  id: string;
  name: string;
  model: string;
  baseUrl: string;
  order: number;
  enabled: boolean;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAiProviderDraft {
  id?: string;
  name: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  order: number;
  enabled: boolean;
  hasApiKey?: boolean;
  apiKeyHint?: string | null;
}

export interface AdminAiConfig {
  enabled: boolean;
  userTotalLimit: number;
  dailyLimit: number;
  maxImages: number;
  requestTimeoutMs: number;
  prompt: string;
  providers: AdminAiProviderConfig[];
}

export interface AdminAiConfigDraft {
  enabled: boolean;
  userTotalLimit: number;
  dailyLimit: number;
  maxImages: number;
  requestTimeoutMs: number;
  prompt: string;
  providers: AdminAiProviderDraft[];
}

export interface AdminAiUsageUser {
  userId: string;
  email: string;
  username: string | null;
  role: UserSession['role'];
  status: UserSession['status'];
  usage: {
    total: number;
    daily: number;
    day: string | null;
    updatedAt: string | null;
  };
}

export interface AiStatus {
  enabled: boolean;
  prompt: string;
  maxImages: number;
  userTotalLimit: number;
  dailyLimit: number;
  usage: {
    total: number;
    daily: number;
    day: string;
  };
  remaining: {
    total: number | null;
    daily: number | null;
  };
}

export interface AiPlanResponse extends AiPlanBundle {
  providerName?: string;
}

export interface ProductConfigPayload {
  siteContent: SiteContent;
  templateGovernance: TemplateGovernance;
  ai: AdminAiConfig;
  homepagePreview: HomepagePreviewPayload | null;
  objectStorage: AdminObjectStorageConfig;
}

export interface AdminObjectStorageConfig {
  enabled: boolean;
  provider: string;
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string;
  publicBaseUrl: string;
  hasAccessKey: boolean;
  hasSecretKey: boolean;
  accessKeyHint: string | null;
  secretKeyHint: string | null;
  updatedAt: string | null;
  updatedByUserId: string | null;
  lastValidatedAt: string | null;
  lastValidationOk: boolean | null;
  syncStats: {
    mirroredUploads: number;
    pendingUploads: number;
    failedUploads: number;
    localOnlyUploads: number;
    latestSyncAt: string | null;
  };
}

export interface AdminObjectStorageDraft {
  enabled: boolean;
  provider: string;
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string;
  publicBaseUrl: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface AccountSummary {
  account: UserSession;
  counts: {
    projects: number;
    archivedProjects: number;
    uploads: number;
    referencedUploads: number;
    unusedUploads: number;
  };
  recentProjects: Array<{
    id: string;
    sharePath: string;
    title: string;
    issue: string;
    updatedAt: string;
    archivedAt: string | null;
  }>;
}

export interface AccountUploadListItem {
  assetId: string;
  filename: string;
  name: string;
  src: string;
  delivery: AssetDelivery;
  original: AssetVariant | null;
  preview: AssetVariant | null;
  thumb: AssetVariant | null;
  bytes: number;
  width: number | null;
  height: number | null;
  note: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  referencedProjectCount: number;
  referencedPageCount: number;
  referencedProjectTitles: string[];
}

interface ApiErrorPayload {
  error?: string;
  code?: string;
  termsVersion?: string;
}

function createApiError(payload: ApiErrorPayload | null | undefined, fallback: string) {
  const error = new Error(payload?.error ?? fallback) as Error & ApiErrorPayload;
  if (typeof payload?.code === 'string') {
    error.code = payload.code;
  }
  if (typeof payload?.termsVersion === 'string') {
    error.termsVersion = payload.termsVersion;
  }
  return error;
}

function getCurrentBrowserPath() {
  if (typeof window === 'undefined') {
    return '/';
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function redirectToTermsIfNeeded(payload: ApiErrorPayload | null | undefined, nextPath = getCurrentBrowserPath()) {
  if (payload?.code !== 'terms_required' || typeof window === 'undefined') {
    return;
  }

  const target = buildTermsPath(nextPath);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== target) {
    redirectToTerms(nextPath);
  }
}

function fallbackErrorMessage(status: number) {
  if (status === 413) {
    return 'The request is too large. Reduce the number of photos and try again.';
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'The service is temporarily unavailable. Please try again in a moment.';
  }
  return `Request failed (${status}).`;
}

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    throw new Error('Network connection failed. Check your connection and try again.');
  }

  const raw = await response.text().catch(() => '');
  let payload: ApiErrorPayload | null = null;
  if (raw) {
    try {
      payload = JSON.parse(raw) as ApiErrorPayload;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    redirectToTermsIfNeeded(payload);
    throw createApiError(payload, fallbackErrorMessage(response.status));
  }

  return (payload ?? ({} as T)) as T;
}

export function createProject(project: ProjectState) {
  return readJson<ProjectRecord>('/api/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ project }),
  });
}

export function fetchOwnedProjects(search = '', visibility: 'all' | 'active' | 'archived' = 'all') {
  return readJson<{ projects: ProjectRecord[] }>(
    `/api/projects?search=${encodeURIComponent(search)}&visibility=${encodeURIComponent(visibility)}`,
  );
}

export function fetchAccountSummary() {
  return readJson<AccountSummary>('/api/account/summary');
}

export function fetchAccountPreferences() {
  return readJson<{ preferences: AccountPreferences }>('/api/account/preferences');
}

export function updateAccountPreferences(payload: Partial<AccountPreferences>) {
  return readJson<{ preferences: AccountPreferences }>('/api/account/preferences', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function fetchAccountActivity() {
  return readJson<{ activity: AccountActivityItem[] }>('/api/account/activity');
}

export function fetchAccountUploads(search = '') {
  return readJson<{ uploads: AccountUploadListItem[] }>(`/api/account/uploads?search=${encodeURIComponent(search)}`);
}

export function fetchOwnedTemplates(search = '') {
  return readJson<{ templates: UserTemplateRecord[] }>(`/api/account/templates?search=${encodeURIComponent(search)}`);
}

export function createUserTemplate(payload: {
  name: string;
  description?: string;
  kind: UserTemplateRecord['kind'];
  includesCopy: boolean;
  sourceProjectId?: string | null;
  previewPageIndex?: number | null;
  templatePayload: UserTemplatePayload;
}) {
  return readJson<{ template: UserTemplateRecord }>('/api/account/templates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function updateUserTemplate(
  templateId: string,
  payload: {
    name?: string;
    description?: string;
    kind?: UserTemplateRecord['kind'];
  },
) {
  return readJson<{ template: UserTemplateRecord }>(`/api/account/templates/${encodeURIComponent(templateId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function deleteUserTemplate(templateId: string) {
  const response = await fetch(`/api/account/templates/${encodeURIComponent(templateId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    redirectToTermsIfNeeded(payload);
    throw createApiError(payload, 'Unable to delete template.');
  }
}

export function duplicateUserTemplate(templateId: string) {
  return readJson<{ template: UserTemplateRecord }>(
    `/api/account/templates/${encodeURIComponent(templateId)}/duplicate`,
    {
      method: 'POST',
    },
  );
}

export function createProjectFromUserTemplate(templateId: string) {
  return readJson<ProjectRecord>(`/api/account/templates/${encodeURIComponent(templateId)}/projects`, {
    method: 'POST',
  });
}

export function fetchProject(projectId: string) {
  return readJson<ProjectRecord>(`/api/projects/${projectId}`);
}

export function updateProject(
  projectId: string,
  project: ProjectState,
  expectedRev?: number,
  options: { autosave?: boolean } = {},
) {
  return readJson<ProjectRecord>(`/api/projects/${projectId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      project,
      ...(typeof expectedRev === 'number' ? { expectedRev } : {}),
      ...(options.autosave === true ? { autosave: true } : {}),
    }),
  });
}

export function patchProject(
  projectId: string,
  payload: {
    project?: Partial<Pick<ProjectState, 'title' | 'subtitle' | 'issue' | 'frameRadius'>>;
    archive?: boolean;
    unarchive?: boolean;
  },
) {
  return readJson<ProjectRecord>(`/api/projects/${projectId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function duplicateProject(projectId: string) {
  return readJson<ProjectRecord>(`/api/projects/${projectId}/duplicate`, {
    method: 'POST',
  });
}

export function enableProjectShare(projectId: string, { rotate = false }: { rotate?: boolean } = {}) {
  return readJson<ProjectRecord>(`/api/projects/${projectId}/share`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rotate }),
  });
}

export function disableProjectShare(projectId: string) {
  return readJson<ProjectRecord>(`/api/projects/${projectId}/share`, {
    method: 'DELETE',
  });
}

export function fetchPublicIssue(shareId: string) {
  return readJson<PublicIssuePayload>(`/api/issues/${encodeURIComponent(shareId)}`);
}

export async function deleteProject(projectId: string) {
  const response = await fetch(`/api/projects/${projectId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    redirectToTermsIfNeeded(payload);
    throw createApiError(payload, 'Unable to delete project.');
  }
}

export function deleteProjectAsset(projectId: string, assetId: string) {
  return readJson<ProjectRecord>(`/api/projects/${projectId}/assets/${assetId}`, {
    method: 'DELETE',
  });
}

export async function deleteOwnedAsset(assetId: string) {
  const response = await fetch(`/api/assets/${assetId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    redirectToTermsIfNeeded(payload);
    throw createApiError(payload, 'Unable to delete upload.');
  }
}

export function fetchSession() {
  return readJson<{ user: UserSession | null }>('/api/auth/session');
}

export function fetchBootstrapStatus() {
  return readJson<BootstrapStatus>('/api/auth/bootstrap-status');
}

export function fetchSiteContent() {
  return readJson<{
    siteContent: SiteContent;
    homepagePreview: HomepagePreviewPayload | null;
  }>('/api/site-content');
}

export function fetchTemplateGovernance() {
  return readJson<{
    templateGovernance: TemplateGovernance;
  }>('/api/template-governance');
}

export function fetchAuthCaptcha(purpose: 'register' = 'register') {
  return readJson<AuthCaptchaChallenge>(`/api/auth/captcha?purpose=${encodeURIComponent(purpose)}`);
}

export function registerUser(
  username: string,
  email: string,
  password: string,
  captchaId: string,
  captchaAnswer: string,
  acceptTerms: boolean,
  termsLanguage: string,
) {
  return readJson<{ user: UserSession; verificationRequired: boolean }>('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, email, password, captchaId, captchaAnswer, acceptTerms, termsLanguage }),
  });
}

export function loginUser(identifier: string, password: string) {
  return readJson<{ user: UserSession }>('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ identifier, password }),
  });
}

export async function logoutUser() {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    redirectToTermsIfNeeded(payload);
    throw createApiError(payload, 'Unable to sign out.');
  }
}

export function updateAccountProfile(payload: { username: string }) {
  return readJson<{ user: UserSession }>('/api/account/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function updateAccountPassword(currentPassword: string, newPassword: string) {
  return readJson<{ user: UserSession }>('/api/account/password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function resendVerificationEmail(email: string) {
  const response = await fetch('/api/auth/verification/resend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    throw createApiError(payload, 'Unable to resend verification email.');
  }
}

export function verifyEmailToken(token: string) {
  return readJson<{ user: UserSession }>('/api/auth/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });
}

export async function requestPasswordReset(email: string) {
  const response = await fetch('/api/auth/password-reset/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    throw createApiError(payload, 'Unable to request password reset.');
  }
}

export function acceptTerms(language: string) {
  return readJson<{ user: UserSession; acceptedVersion: string }>('/api/legal/terms/accept', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ language }),
  });
}

export function confirmPasswordReset(token: string, password: string) {
  return readJson<{ user: UserSession }>('/api/auth/password-reset/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, password }),
  });
}

export function fetchAdminSummary() {
  return readJson<AdminSummary>('/api/admin/summary');
}

export function fetchAdminUsers(search = '') {
  return readJson<{ users: UserSession[] }>(`/api/admin/users?search=${encodeURIComponent(search)}`);
}

export function createAdminUser(payload: { username: string; email: string; password: string; role?: UserSession['role'] }) {
  return readJson<{ user: UserSession }>('/api/admin/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function updateAdminUserStatus(userId: string, status: UserSession['status']) {
  return readJson<{ user: UserSession }>(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
}

export function deleteAdminUser(userId: string) {
  return readJson<{
    deleted: boolean;
    summary: {
      deletedProjectCount: number;
      deletedTemplateCount: number;
      deletedUploadCount: number;
      retainedUploadCount: number;
    };
  }>(`/api/admin/users/${userId}`, {
    method: 'DELETE',
  });
}

export interface AdminProjectMetrics {
  pageCount: number;
  assetCount: number;
  placedAssetCount: number;
  unusedAssetCount: number;
  blankPages: number;
  missingAssetCount: number;
  templateUsage: Record<string, number>;
}

export interface AdminProjectListItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  sharePath: string;
  publicSharePath: string | null;
  title: string;
  issue: string;
  ownerEmail: string | null;
  ownerUsername: string | null;
  ownerDisplay: string | null;
  ownerUserId: string | null;
  health: string;
  metrics: AdminProjectMetrics;
}

export interface AdminProjectDetail extends AdminProjectListItem {
  subtitle: string;
  frameRadius: number;
  preview: {
    pages: ProjectRecord['project']['pages'];
    assets: Asset[];
  };
  recentEvents: AdminSummary['events'];
  recentFailures: AdminSummary['failures'];
}

export function fetchAdminProjects(search = '') {
  return readJson<{
    projects: AdminProjectListItem[];
  }>(`/api/admin/projects?search=${encodeURIComponent(search)}`);
}

export function fetchAdminProject(projectId: string) {
  return readJson<{
    project: AdminProjectDetail;
  }>(`/api/admin/projects/${projectId}`);
}

export function fetchAdminProductConfig() {
  return readJson<ProductConfigPayload>('/api/admin/product-config');
}

export function updateAdminSiteContent(siteContent: SiteContent) {
  return readJson<{ siteContent: SiteContent }>('/api/admin/product-config/site-content', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ siteContent }),
  });
}

export function updateAdminTemplateGovernance(templateGovernance: TemplateGovernance) {
  return readJson<{ templateGovernance: TemplateGovernance }>('/api/admin/product-config/template-governance', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ templateGovernance }),
  });
}

export function updateAdminAiConfig(ai: AdminAiConfigDraft) {
  return readJson<{ ai: AdminAiConfig }>('/api/admin/product-config/ai', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ai }),
  });
}

export function fetchAdminAiUsage() {
  return readJson<{ users: AdminAiUsageUser[] }>('/api/admin/product-config/ai/usage');
}

export function updateAdminAiUsage(userId: string, usage: { total: number; daily: number }) {
  return readJson<{ userId: string; usage: AdminAiUsageUser['usage'] | null }>(
    `/api/admin/product-config/ai/usage/${encodeURIComponent(userId)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(usage),
    },
  );
}

export function testAdminAiProvider(payload: { providerId?: string; provider: AdminAiProviderDraft }) {
  return readJson<{
    ok: boolean;
    message: string;
    latencyMs: number;
    model: string;
  }>('/api/admin/product-config/ai/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function fetchAiStatus() {
  return readJson<AiStatus>('/api/ai/status');
}

export function generateAiPlans(
  payload: {
    images: Array<{
      name: string;
      width: number | null;
      height: number | null;
      dataUrl: string;
    }>;
    prompt?: string;
  },
  signal?: AbortSignal,
) {
  return readJson<AiPlanResponse>('/api/ai/plans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });
}

export function testAdminObjectStorage(objectStorage: AdminObjectStorageDraft) {
  return readJson<{
    ok: boolean;
    message: string;
    publicProbeUrl: string;
  }>('/api/admin/product-config/object-storage/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ objectStorage }),
  });
}

export function updateAdminObjectStorage(objectStorage: AdminObjectStorageDraft, confirmed = true) {
  return readJson<{ objectStorage: AdminObjectStorageConfig }>('/api/admin/product-config/object-storage', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ objectStorage, confirmed }),
  });
}

export function syncAdminObjectStorageUploads(force = false) {
  return readJson<{
    scanned: number;
    synced: number;
    skipped: number;
    failed: Array<{ filename: string; message: string }>;
  }>('/api/admin/product-config/object-storage/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ force }),
  });
}

export function restoreAdminObjectStorageUploads(detach = true) {
  return readJson<{
    scanned: number;
    restoredFiles: number;
    detachedUploads: number;
    failed: Array<{ filename: string; message: string }>;
  }>('/api/admin/product-config/object-storage/restore', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ detach }),
  });
}

export async function deleteAdminProject(projectId: string) {
  const response = await fetch(`/api/admin/projects/${projectId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    redirectToTermsIfNeeded(payload);
    throw createApiError(payload, 'Unable to delete project.');
  }
}

export interface AdminUploadListItem {
  filename: string;
  src: string;
  original: AssetVariant | null;
  preview: AssetVariant | null;
  thumb: AssetVariant | null;
  delivery: AssetDelivery;
  bytes: number;
  width: number | null;
  height: number | null;
  ownerEmails: string[];
  ownerDisplayNames: string[];
  referencedProjectCount: number;
  referencedProjectTitles: string[];
}

export interface AdminUploadDetail extends AdminUploadListItem {
  derivedBytes: number;
  totalBytes: number;
  uploadedAt: string;
  ageHours: number;
  ageMs: number;
  assetIds: string[];
  assetRecordCount: number;
  ownerUserIds: string[];
  referencedProjectIds: string[];
  referencedPageCount: number;
  referencedProjects: Array<{
    id: string;
    title?: string;
    issue?: string;
    ownerUserId?: string | null;
  }>;
  referencedPages: Array<{
    projectId: string;
    projectTitle: string;
    issue: string;
    pageId: string;
    pageIndex: number;
    pageTitle: string;
    slot: string;
    assetId: string;
  }>;
}

export function fetchAdminUploads(search = '') {
  return readJson<{
    uploads: AdminUploadListItem[];
    totals: {
      uploadCount: number;
      referencedCount: number;
      unreferencedCount: number;
      missingReferencedCount: number;
      originalBytes: number;
      derivedBytes: number;
      totalBytes: number;
    };
    missingReferencedFiles: Array<{
      filename: string;
      referencedByProjectIds: string[];
    }>;
  }>(`/api/admin/uploads?search=${encodeURIComponent(search)}`);
}

export function fetchAdminUpload(filename: string) {
  return readJson<{
    upload: AdminUploadDetail;
  }>(`/api/admin/uploads/${encodeURIComponent(filename)}`);
}

export async function deleteAdminUpload(filename: string) {
  const response = await fetch(`/api/admin/uploads/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    redirectToTermsIfNeeded(payload);
    throw createApiError(payload, 'Unable to delete upload.');
  }
}

export function retryOwnedAssetObjectStorageSync(assetId: string) {
  return readJson<{ asset: Asset }>(`/api/assets/${encodeURIComponent(assetId)}/object-storage/retry`, {
    method: 'POST',
  });
}

export async function retryAdminUploadObjectStorageSync(filename: string) {
  const response = await fetch(`/api/admin/uploads/${encodeURIComponent(filename)}/object-storage/retry`, {
    method: 'POST',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    redirectToTermsIfNeeded(payload);
    throw createApiError(payload, 'Unable to retry object storage delivery.');
  }
}

export async function recordExportEvent(
  projectId?: string,
  status: 'ok' | 'error' | 'requested' = 'ok',
  reason?: string,
  settings?: Partial<ExportSettings>,
) {
  await readJson<{ ok: true }>('/api/exports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ projectId, status, reason, ...settings }),
  });
}

export async function importAssetFromUrl(url: string): Promise<Asset> {
  const payload = await readJson<{ assets: Asset[] }>('/api/uploads/from-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  const asset = Array.isArray(payload?.assets) ? payload.assets[0] : null;
  if (!asset) {
    throw new Error('The import completed without returning an asset record.');
  }

  return asset;
}

export function uploadAssets(
  files: File[],
  metadata: UploadAssetMetadata[],
  onProgress?: (progress: UploadRequestProgress) => void,
) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  formData.append('assetMeta', JSON.stringify(metadata));

  return new Promise<Asset[]>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', '/api/uploads');
    request.responseType = 'json';

    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) {
        return;
      }

      onProgress?.({
        loadedBytes: event.loaded,
        totalBytes: event.total,
      });
    });

    request.addEventListener('load', () => {
      const payload =
        request.response && typeof request.response === 'object'
          ? (request.response as { assets?: Asset[]; error?: string; code?: string; termsVersion?: string })
          : ((JSON.parse(request.responseText || 'null') as {
              assets?: Asset[];
              error?: string;
              code?: string;
              termsVersion?: string;
            } | null) ?? null);

      if (request.status >= 200 && request.status < 300 && Array.isArray(payload?.assets)) {
        resolve(payload.assets);
        return;
      }

      redirectToTermsIfNeeded(payload ?? null);
      reject(createApiError(payload ?? null, 'Upload failed.'));
    });

    request.addEventListener('error', () => {
      reject(new Error('Upload failed.'));
    });

    request.send(formData);
  });
}
