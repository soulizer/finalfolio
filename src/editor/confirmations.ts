type SiteLocale = 'en' | 'zh-CN';

type ConfirmationMessageKey =
  | 'deleteProject'
  | 'deleteUpload'
  | 'deletePage'
  | 'removeIssueAsset'
  | 'deleteLibraryAsset'
  | 'removeUnusedAssets'
  | 'replaceLayout'
  | 'saveObjectStorageConfig'
  | 'restoreObjectStorageUploads'
  | 'deleteUser';

interface ConfirmationMessageParams {
  assetName?: string;
  filename?: string;
  pageTitle?: string;
  unusedAssetCount?: number;
  userLabel?: string;
}

const confirmationMessages: Record<
  ConfirmationMessageKey,
  Record<SiteLocale, (params: ConfirmationMessageParams) => string>
> = {
  deleteProject: {
    en: () => 'This will delete the current project. Continue?',
    'zh-CN': () => '此操作会删除当前项目，是否继续？',
  },
  deleteUpload: {
    en: ({ filename }) => `This will delete the uploaded file "${filename ?? 'unknown'}". Continue?`,
    'zh-CN': ({ filename }) => `此操作会删除上传文件“${filename ?? '未知文件'}”，是否继续？`,
  },
  deletePage: {
    en: ({ pageTitle }) => `This will delete the page "${pageTitle ?? 'Untitled page'}". Continue?`,
    'zh-CN': ({ pageTitle }) => `此操作会删除页面“${pageTitle ?? '未命名页面'}”，是否继续？`,
  },
  deleteLibraryAsset: {
    en: ({ assetName }) =>
      `This will delete "${assetName ?? 'this photo'}" from your media library and remove it from the current folio. Continue?`,
    'zh-CN': ({ assetName }) =>
      `此操作会从媒体库中删除图片“${assetName ?? '该图片'}”，并从当前作品集中移除，是否继续？`,
  },
  removeIssueAsset: {
    en: ({ assetName }) => `This will remove "${assetName ?? 'this photo'}" from the current folio. Continue?`,
    'zh-CN': ({ assetName }) => `此操作会从当前期刊中移除图片“${assetName ?? '该图片'}”，是否继续？`,
  },
  removeUnusedAssets: {
    en: ({ unusedAssetCount }) =>
      `This will remove ${unusedAssetCount ?? 0} unused photo${unusedAssetCount === 1 ? '' : 's'} from the current folio. Continue?`,
    'zh-CN': ({ unusedAssetCount }) => `此操作会移除 ${unusedAssetCount ?? 0} 张未使用图片，是否继续？`,
  },
  replaceLayout: {
    en: () => 'This will replace the current layout. Continue?',
    'zh-CN': () => '此操作会覆盖现有布局，是否继续？',
  },
  saveObjectStorageConfig: {
    en: () =>
      'This changes production object storage settings. Mistakes can break uploads, previews, and historical asset delivery. Continue?',
    'zh-CN': () => '此操作会修改生产对象存储配置，错误配置可能导致上传、预览或历史资源异常，是否继续？',
  },
  restoreObjectStorageUploads: {
    en: () => 'This restores mirrored uploads back to local delivery and detaches remote delivery links. Continue?',
    'zh-CN': () => '此操作会把镜像上传恢复到本地交付并解除远端交付关联，是否继续？',
  },
  deleteUser: {
    en: ({ userLabel }) =>
      `This will delete the user record for "${userLabel ?? 'this account'}" and permanently remove that user's projects, templates, and uploaded content. Continue?`,
    'zh-CN': ({ userLabel }) => `此操作会删除用户“${userLabel ?? '该账户'}”及其作品、模板和上传内容，是否继续？`,
  },
};

export function resolveSiteLocale(): SiteLocale {
  // The product is currently English-only. When site language settings land,
  // route the active locale through this helper instead of touching each prompt.
  return 'en';
}

export function getConfirmationMessage(key: ConfirmationMessageKey, params: ConfirmationMessageParams = {}) {
  const locale = resolveSiteLocale();
  return confirmationMessages[key][locale](params);
}
