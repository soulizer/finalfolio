import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_EXPORT_FORMAT = 'pdf';
const DEFAULT_EXPORT_QUALITY = 'standard';
const DEFAULT_PAGE_SIZE = 'a4';

function createBadRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function sanitizeExportFormat(value) {
  return value === 'project' || value === 'jpg' ? value : DEFAULT_EXPORT_FORMAT;
}

function sanitizeExportQuality(value) {
  return value === 'draft' || value === 'print' ? value : DEFAULT_EXPORT_QUALITY;
}

function sanitizePageSize(value) {
  if (value === 'a3' || value === 'a4' || value === 'a5') {
    return value;
  }

  if (value === 'current' || value === 'letter') {
    return 'a4';
  }

  return DEFAULT_PAGE_SIZE;
}

function sanitizeUserId(userId) {
  if (typeof userId !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/i.test(userId.trim())) {
    throw createBadRequest('User identifier is invalid.');
  }

  return userId.trim();
}

function sanitizePageTheme(value, allowedPageThemes) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string' || !allowedPageThemes.has(value)) {
    throw createBadRequest('Default page theme is invalid.');
  }

  return value;
}

function sanitizePreferences(record, allowedPageThemes) {
  if (!record || typeof record !== 'object') {
    return {
      defaultExportFormat: DEFAULT_EXPORT_FORMAT,
      defaultExportQuality: DEFAULT_EXPORT_QUALITY,
      defaultPageSize: DEFAULT_PAGE_SIZE,
      defaultPageTheme: null,
      preserveCopyWhenSavingTemplate: true,
    };
  }

  return {
    defaultExportFormat: sanitizeExportFormat(record.defaultExportFormat),
    defaultExportQuality: sanitizeExportQuality(record.defaultExportQuality),
    defaultPageSize: sanitizePageSize(record.defaultPageSize),
    defaultPageTheme: sanitizePageTheme(record.defaultPageTheme, allowedPageThemes),
    preserveCopyWhenSavingTemplate: record.preserveCopyWhenSavingTemplate !== false,
  };
}

export function createAccountPreferencesStore({
  dataRoot,
  allowedPageThemes,
} = {}) {
  const preferencesDir = path.join(dataRoot, 'account-preferences');

  function preferencePath(userId) {
    return path.join(preferencesDir, `${sanitizeUserId(userId)}.json`);
  }

  async function ensurePreferencesDirectory() {
    await fs.mkdir(preferencesDir, { recursive: true });
  }

  async function readPreferences(userId) {
    await ensurePreferencesDirectory();

    try {
      const payload = JSON.parse(await fs.readFile(preferencePath(userId), 'utf8'));
      return sanitizePreferences(payload, allowedPageThemes);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return sanitizePreferences(null, allowedPageThemes);
      }

      throw error;
    }
  }

  async function updatePreferences(userId, patch) {
    const current = await readPreferences(userId);
    const next = sanitizePreferences(
      {
        ...current,
        ...(patch && typeof patch === 'object' ? patch : {}),
      },
      allowedPageThemes,
    );
    const filename = preferencePath(userId);
    const tempFile = `${filename}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(next, null, 2), 'utf8');
    await fs.rename(tempFile, filename);
    return next;
  }

  async function deletePreferences(userId) {
    await ensurePreferencesDirectory();
    await fs.rm(preferencePath(userId), { force: true });
  }

  return {
    preferencesDir,
    ensurePreferencesDirectory,
    readPreferences,
    updatePreferences,
    deletePreferences,
  };
}
