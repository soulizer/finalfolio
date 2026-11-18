import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Hash } from '@smithy/hash-node';
import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createBadRequest } from './lib/httpErrors.js';

const DEFAULT_OBJECT_STORAGE_CONFIG = {
  enabled: false,
  provider: 'Bitiful S3',
  endpoint: 's3.bitiful.net',
  region: 'cn-east-1',
  bucket: 'gallery',
  prefix: 'finalfolio',
  publicBaseUrl: 'https://gallery.s3.bitiful.net/finalfolio',
};
const OBJECT_STORAGE_SYNC_INDEX_VERSION = 2;
const OBJECT_STORAGE_REQUEST_TIMEOUT_MS = 30_000;
const OBJECT_STORAGE_UPLOAD_TIMEOUT_MS = 20 * 60 * 1000;
const OBJECT_STORAGE_UPLOAD_RETRY_LIMIT = 4;
const OBJECT_STORAGE_UPLOAD_RETRY_DELAY_MS = 1_500;
const successfulUploadStatusCodes = new Set([200, 201, 204]);
const allowedSyncStatuses = new Set(['pending', 'remote', 'failed']);


function normalizeBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeRequiredText(value, fieldName, maxLength) {
  if (typeof value !== 'string') {
    throw createBadRequest(`${fieldName} is invalid.`);
  }

  const nextValue = value.trim();
  if (!nextValue || nextValue.length > maxLength) {
    throw createBadRequest(`${fieldName} is invalid.`);
  }

  return nextValue;
}

function normalizeOptionalSecret(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEndpoint(value) {
  const nextValue = normalizeRequiredText(value, 'Object storage endpoint', 240);
  return nextValue.replace(/^https?:\/\//i, '').replace(/\/+$/g, '');
}

function normalizePrefix(value) {
  if (typeof value !== 'string') {
    throw createBadRequest('Object storage prefix is invalid.');
  }

  return value
    .trim()
    .replace(/^\/+/g, '')
    .replace(/\/+$/g, '')
    .replace(/\/{2,}/g, '/');
}

function normalizePublicBaseUrl(value) {
  const nextValue = normalizeRequiredText(value, 'Object storage public URL', 400);
  try {
    const url = new URL(nextValue);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('invalid protocol');
    }
    return url.toString().replace(/\/+$/g, '');
  } catch {
    throw createBadRequest('Object storage public URL is invalid.');
  }
}

function maskSecret(value) {
  if (!value) {
    return null;
  }

  if (value.length <= 6) {
    return `${value.slice(0, 1)}***${value.slice(-1)}`;
  }

  return `${value.slice(0, 4)}…${value.slice(-2)}`;
}

function createS3EndpointUrl(endpoint) {
  return endpoint.startsWith('http://') || endpoint.startsWith('https://') ? endpoint : `https://${endpoint}`;
}

function createObjectStorageHost(config) {
  return `${config.bucket}.${config.endpoint}`;
}

function joinObjectStorageKey(prefix, relativePath) {
  const normalizedPrefix = normalizePrefix(prefix);
  return normalizedPrefix ? `${normalizedPrefix}/${relativePath}` : relativePath;
}

function buildPublicUrl(baseUrl, relativePath) {
  return `${baseUrl.replace(/\/+$/g, '')}/${relativePath.replace(/^\/+/g, '')}`;
}

function encodeObjectStoragePath(key) {
  return `/${key
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createUploadError(message, { retryable = false } = {}) {
  const error = new Error(message);
  error.retryable = retryable;
  return error;
}

function isRetryableUploadFailure(error) {
  return Boolean(
    error?.retryable ||
      (typeof error?.code === 'string' && ['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ECONNREFUSED', 'EAI_AGAIN'].includes(error.code)),
  );
}

function createUploadRelativePaths(filename) {
  return {
    original: `uploads/${filename}`,
    preview: `uploads/variants/${filename}/preview.webp`,
    thumb: `uploads/variants/${filename}/thumb.webp`,
  };
}

function createRemoteVariantTargets(config, relativePaths) {
  return {
    original: {
      key: joinObjectStorageKey(config.prefix, relativePaths.original),
      publicUrl: buildPublicUrl(config.publicBaseUrl, relativePaths.original),
    },
    preview: {
      key: joinObjectStorageKey(config.prefix, relativePaths.preview),
      publicUrl: buildPublicUrl(config.publicBaseUrl, relativePaths.preview),
    },
    thumb: {
      key: joinObjectStorageKey(config.prefix, relativePaths.thumb),
      publicUrl: buildPublicUrl(config.publicBaseUrl, relativePaths.thumb),
    },
  };
}

function sanitizeEncryptedSecret(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    value.algorithm !== 'aes-256-gcm' ||
    typeof value.iv !== 'string' ||
    typeof value.tag !== 'string' ||
    typeof value.ciphertext !== 'string'
  ) {
    return null;
  }

  return {
    algorithm: value.algorithm,
    iv: value.iv,
    tag: value.tag,
    ciphertext: value.ciphertext,
  };
}

function sanitizeRemoteVariantRecord(value) {
  if (!value || typeof value !== 'object' || typeof value.key !== 'string' || typeof value.publicUrl !== 'string') {
    return null;
  }

  return {
    key: value.key,
    publicUrl: value.publicUrl,
  };
}

function sanitizeOptionalTimestamp(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function sanitizeOptionalText(value, maxLength = 1000) {
  if (typeof value !== 'string') {
    return null;
  }

  const nextValue = value.trim();
  return nextValue ? nextValue.slice(0, maxLength) : null;
}

function normalizeAttemptCount(value) {
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

function sanitizeSyncEntry(value) {
  const oldOriginal = sanitizeRemoteVariantRecord(value?.original);
  if (
    value &&
    typeof value === 'object' &&
    typeof value.provider === 'string' &&
    typeof value.endpoint === 'string' &&
    typeof value.region === 'string' &&
    typeof value.bucket === 'string' &&
    typeof value.publicBaseUrl === 'string' &&
    typeof value.syncedAt === 'string' &&
    oldOriginal &&
    !allowedSyncStatuses.has(value.status)
  ) {
    return {
      status: 'remote',
      provider: value.provider,
      endpoint: value.endpoint,
      region: value.region,
      bucket: value.bucket,
      publicBaseUrl: value.publicBaseUrl,
      queuedAt: value.syncedAt,
      lastAttemptAt: value.syncedAt,
      syncedAt: value.syncedAt,
      attemptCount: Math.max(1, normalizeAttemptCount(value.attemptCount) || 1),
      lastError: null,
      original: oldOriginal,
      preview: value.preview === null ? null : sanitizeRemoteVariantRecord(value.preview),
      thumb: value.thumb === null ? null : sanitizeRemoteVariantRecord(value.thumb),
    };
  }

  if (
    !value ||
    typeof value !== 'object' ||
    !allowedSyncStatuses.has(value.status) ||
    typeof value.provider !== 'string' ||
    typeof value.endpoint !== 'string' ||
    typeof value.region !== 'string' ||
    typeof value.bucket !== 'string' ||
    typeof value.publicBaseUrl !== 'string'
  ) {
    return null;
  }

  const original = value.original === null ? null : sanitizeRemoteVariantRecord(value.original);
  if (value.status === 'remote' && !original) {
    return null;
  }

  return {
    status: value.status,
    provider: value.provider,
    endpoint: value.endpoint,
    region: value.region,
    bucket: value.bucket,
    publicBaseUrl: value.publicBaseUrl,
    queuedAt: sanitizeOptionalTimestamp(value.queuedAt) ?? sanitizeOptionalTimestamp(value.syncedAt),
    lastAttemptAt: sanitizeOptionalTimestamp(value.lastAttemptAt) ?? sanitizeOptionalTimestamp(value.syncedAt),
    syncedAt: sanitizeOptionalTimestamp(value.syncedAt),
    attemptCount: value.status === 'remote' ? Math.max(1, normalizeAttemptCount(value.attemptCount) || 1) : normalizeAttemptCount(value.attemptCount),
    lastError: sanitizeOptionalText(value.lastError),
    original,
    preview: value.preview === null ? null : sanitizeRemoteVariantRecord(value.preview),
    thumb: value.thumb === null ? null : sanitizeRemoteVariantRecord(value.thumb),
  };
}

function sanitizeSyncIndex(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    ![1, OBJECT_STORAGE_SYNC_INDEX_VERSION].includes(value.version) ||
    !value.uploads ||
    typeof value.uploads !== 'object'
  ) {
    return { version: OBJECT_STORAGE_SYNC_INDEX_VERSION, uploads: {} };
  }

  return {
    version: OBJECT_STORAGE_SYNC_INDEX_VERSION,
    uploads: Object.fromEntries(
      Object.entries(value.uploads)
        .map(([filename, entry]) => [filename, sanitizeSyncEntry(entry)])
        .filter(([, entry]) => entry !== null),
    ),
  };
}

export function createObjectStorageStore({
  dataRoot,
  securityStore,
  now = () => new Date().toISOString(),
} = {}) {
  const objectStorageDir = path.join(dataRoot, 'site');
  const configFile = path.join(objectStorageDir, 'object-storage.json');
  const syncIndexFile = path.join(objectStorageDir, 'object-storage-sync.json');
  const signedUploadAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 6,
  });

  function createS3Client(config, credentials) {
    return new S3Client({
      endpoint: createS3EndpointUrl(config.endpoint),
      region: config.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
      forcePathStyle: false,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async function sendS3Command(client, command) {
    return await client.send(command, {
      abortSignal: AbortSignal.timeout(OBJECT_STORAGE_REQUEST_TIMEOUT_MS),
    });
  }

  function createRequestSigner(config, credentials) {
    return new SignatureV4({
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
      region: config.region,
      service: 's3',
      sha256: Hash.bind(null, 'sha256'),
    });
  }

  async function uploadObjectViaSignedRequest({ config, signer, localPath, key, mimeType }) {
    const body = await fs.readFile(localPath);
    const host = createObjectStorageHost(config);
    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');
    const signedRequest = await signer.sign(
      new HttpRequest({
        protocol: 'https:',
        hostname: host,
        method: 'PUT',
        path: encodeObjectStoragePath(key),
        headers: {
          host,
          'content-type': mimeType,
          'content-length': String(body.byteLength),
          'x-amz-content-sha256': payloadHash,
        },
        body,
      }),
    );

    await new Promise((resolve, reject) => {
      const request = https.request(
        {
          protocol: 'https:',
          hostname: signedRequest.hostname,
          method: signedRequest.method,
          path: signedRequest.path,
          headers: signedRequest.headers,
          agent: signedUploadAgent,
        },
        (response) => {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          response.on('end', () => {
            const statusCode = response.statusCode ?? 0;
            if (successfulUploadStatusCodes.has(statusCode)) {
              resolve();
              return;
            }

            const responseText = Buffer.concat(chunks).toString('utf8').trim();
            reject(
              createUploadError(
                responseText
                  ? `Object storage upload failed with status ${statusCode}: ${responseText}`
                  : `Object storage upload failed with status ${statusCode}.`,
                { retryable: statusCode >= 500 || statusCode === 429 },
              ),
            );
          });
        },
      );

      request.on('error', (error) => {
        reject(
          createUploadError(error instanceof Error && error.message ? error.message : 'Object storage upload failed.', {
            retryable: true,
          }),
        );
      });
      request.setTimeout(OBJECT_STORAGE_UPLOAD_TIMEOUT_MS, () => {
        request.destroy(
          createUploadError('Object storage upload timed out.', {
            retryable: true,
          }),
        );
      });
      request.end(body);
    });
  }

  async function uploadObjectWithRetries(target) {
    let lastError = null;

    for (let attempt = 1; attempt <= OBJECT_STORAGE_UPLOAD_RETRY_LIMIT; attempt += 1) {
      try {
        await uploadObjectViaSignedRequest(target);
        return;
      } catch (error) {
        lastError = error;
        if (!isRetryableUploadFailure(error) || attempt === OBJECT_STORAGE_UPLOAD_RETRY_LIMIT) {
          throw error;
        }

        await delay(OBJECT_STORAGE_UPLOAD_RETRY_DELAY_MS * attempt);
      }
    }

    throw lastError ?? createUploadError('Object storage upload failed.');
  }

  async function ensureDirectory() {
    await fs.mkdir(objectStorageDir, { recursive: true });
  }

  async function writeJsonRecord(filename, record) {
    const tempFile = `${filename}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(record, null, 2), 'utf8');
    await fs.rename(tempFile, filename);
  }

  async function readStoredRecord(filename) {
    await ensureDirectory();

    try {
      return JSON.parse(await fs.readFile(filename, 'utf8'));
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  async function readSyncIndex() {
    return sanitizeSyncIndex((await readStoredRecord(syncIndexFile)) ?? { version: OBJECT_STORAGE_SYNC_INDEX_VERSION, uploads: {} });
  }

  async function writeSyncIndex(syncIndex) {
    await ensureDirectory();
    await writeJsonRecord(syncIndexFile, sanitizeSyncIndex(syncIndex));
  }

  async function readConfig() {
    const stored = (await readStoredRecord(configFile)) ?? {};
    const storedConfig = stored.config && typeof stored.config === 'object' ? stored.config : {};
    const merged = {
      enabled: normalizeBoolean(storedConfig.enabled, DEFAULT_OBJECT_STORAGE_CONFIG.enabled),
      provider: normalizeRequiredText(storedConfig.provider ?? DEFAULT_OBJECT_STORAGE_CONFIG.provider, 'Object storage provider', 80),
      endpoint: normalizeEndpoint(storedConfig.endpoint ?? DEFAULT_OBJECT_STORAGE_CONFIG.endpoint),
      region: normalizeRequiredText(storedConfig.region ?? DEFAULT_OBJECT_STORAGE_CONFIG.region, 'Object storage region', 80),
      bucket: normalizeRequiredText(storedConfig.bucket ?? DEFAULT_OBJECT_STORAGE_CONFIG.bucket, 'Object storage bucket', 120),
      prefix: normalizePrefix(storedConfig.prefix ?? DEFAULT_OBJECT_STORAGE_CONFIG.prefix),
      publicBaseUrl: normalizePublicBaseUrl(storedConfig.publicBaseUrl ?? DEFAULT_OBJECT_STORAGE_CONFIG.publicBaseUrl),
    };

    const accessKeyId =
      (await securityStore.decryptConfigSecret(sanitizeEncryptedSecret(stored.accessKeyIdEncrypted))) ??
      process.env.FINALFOLIO_OBJECT_STORAGE_ACCESS_KEY_ID ??
      process.env.FINALFOLIO_OBJECT_STORAGE_ACCESS_KEY ??
      '';
    const secretAccessKey =
      (await securityStore.decryptConfigSecret(sanitizeEncryptedSecret(stored.secretAccessKeyEncrypted))) ??
      process.env.FINALFOLIO_OBJECT_STORAGE_SECRET_ACCESS_KEY ??
      process.env.FINALFOLIO_OBJECT_STORAGE_SECRET_KEY ??
      '';

    return {
      ...merged,
      credentials: {
        accessKeyId: accessKeyId.trim(),
        secretAccessKey: secretAccessKey.trim(),
      },
      metadata: {
        updatedAt: typeof stored.updatedAt === 'string' ? stored.updatedAt : null,
        updatedByUserId: typeof stored.updatedByUserId === 'string' ? stored.updatedByUserId : null,
        lastValidatedAt: typeof stored.lastValidatedAt === 'string' ? stored.lastValidatedAt : null,
        lastValidationOk: typeof stored.lastValidationOk === 'boolean' ? stored.lastValidationOk : null,
      },
    };
  }

  async function readAdminConfig(uploadInventory = null) {
    const config = await readConfig();
    const syncIndex = await readSyncIndex();
    const syncEntries = Object.values(syncIndex.uploads);
    const mirroredEntries = syncEntries.filter((entry) => entry.status === 'remote');
    const pendingEntries = syncEntries.filter((entry) => entry.status === 'pending');
    const failedEntries = syncEntries.filter((entry) => entry.status === 'failed');
    const latestSyncAt = mirroredEntries
      .map((entry) => entry.syncedAt)
      .filter(Boolean)
      .sort((left, right) => right.localeCompare(left))[0] ?? null;

    const uploadItems = Array.isArray(uploadInventory?.items) ? uploadInventory.items : [];
    const mirroredUploads = uploadItems.length ? uploadItems.filter((item) => item.delivery?.state === 'remote').length : mirroredEntries.length;
    const pendingUploads = uploadItems.length ? uploadItems.filter((item) => item.delivery?.state === 'pending').length : pendingEntries.length;
    const failedUploads = uploadItems.length ? uploadItems.filter((item) => item.delivery?.state === 'failed').length : failedEntries.length;
    const localOnlyUploads = uploadItems.length ? uploadItems.filter((item) => item.delivery?.state === 'local').length : 0;

    return {
      enabled: config.enabled,
      provider: config.provider,
      endpoint: config.endpoint,
      region: config.region,
      bucket: config.bucket,
      prefix: config.prefix,
      publicBaseUrl: config.publicBaseUrl,
      hasAccessKey: Boolean(config.credentials.accessKeyId),
      hasSecretKey: Boolean(config.credentials.secretAccessKey),
      accessKeyHint: maskSecret(config.credentials.accessKeyId),
      secretKeyHint: maskSecret(config.credentials.secretAccessKey),
      updatedAt: config.metadata.updatedAt,
      updatedByUserId: config.metadata.updatedByUserId,
      lastValidatedAt: config.metadata.lastValidatedAt,
      lastValidationOk: config.metadata.lastValidationOk,
      syncStats: {
        mirroredUploads,
        pendingUploads,
        failedUploads,
        localOnlyUploads,
        latestSyncAt,
      },
    };
  }

  function normalizeDraftConfig(payload, currentConfig, { preserveSecrets = true } = {}) {
    const draft = payload && typeof payload === 'object' ? payload : {};

    const accessKeyIdInput = normalizeOptionalSecret(draft.accessKeyId);
    const secretAccessKeyInput = normalizeOptionalSecret(draft.secretAccessKey);
    const nextConfig = {
      enabled: normalizeBoolean(draft.enabled, currentConfig.enabled),
      provider: normalizeRequiredText(draft.provider ?? currentConfig.provider, 'Object storage provider', 80),
      endpoint: normalizeEndpoint(draft.endpoint ?? currentConfig.endpoint),
      region: normalizeRequiredText(draft.region ?? currentConfig.region, 'Object storage region', 80),
      bucket: normalizeRequiredText(draft.bucket ?? currentConfig.bucket, 'Object storage bucket', 120),
      prefix: normalizePrefix(draft.prefix ?? currentConfig.prefix),
      publicBaseUrl: normalizePublicBaseUrl(draft.publicBaseUrl ?? currentConfig.publicBaseUrl),
      credentials: {
        accessKeyId: accessKeyIdInput || (preserveSecrets ? currentConfig.credentials.accessKeyId : ''),
        secretAccessKey: secretAccessKeyInput || (preserveSecrets ? currentConfig.credentials.secretAccessKey : ''),
      },
    };

    if (nextConfig.enabled && (!nextConfig.credentials.accessKeyId || !nextConfig.credentials.secretAccessKey)) {
      throw createBadRequest('Object storage credentials are required before enabling remote delivery.');
    }

    return nextConfig;
  }

  function configIdentityChanged(currentConfig, nextConfig) {
    return (
      currentConfig.enabled !== nextConfig.enabled ||
      currentConfig.provider !== nextConfig.provider ||
      currentConfig.endpoint !== nextConfig.endpoint ||
      currentConfig.region !== nextConfig.region ||
      currentConfig.bucket !== nextConfig.bucket ||
      currentConfig.prefix !== nextConfig.prefix ||
      currentConfig.publicBaseUrl !== nextConfig.publicBaseUrl
    );
  }

  async function updateConfig(payload, { userId = null, confirmed = false } = {}) {
    if (!confirmed) {
      throw createBadRequest('Confirm the production object storage change before saving it.');
    }

    const currentConfig = await readConfig();
    const nextConfig = normalizeDraftConfig(payload, currentConfig);
    const syncIndex = await readSyncIndex();
    if (configIdentityChanged(currentConfig, nextConfig) && Object.values(syncIndex.uploads).some((entry) => entry.status === 'remote')) {
      throw createBadRequest('Restore remote-delivered uploads back to the local store before changing or disabling object storage.');
    }

    const timestamp = now();
    const existingAdminConfig = await readAdminConfig();
    const record = {
      config: {
        enabled: nextConfig.enabled,
        provider: nextConfig.provider,
        endpoint: nextConfig.endpoint,
        region: nextConfig.region,
        bucket: nextConfig.bucket,
        prefix: nextConfig.prefix,
        publicBaseUrl: nextConfig.publicBaseUrl,
      },
      accessKeyIdEncrypted: await securityStore.encryptConfigSecret(nextConfig.credentials.accessKeyId),
      secretAccessKeyEncrypted: await securityStore.encryptConfigSecret(nextConfig.credentials.secretAccessKey),
      updatedAt: timestamp,
      updatedByUserId: typeof userId === 'string' ? userId : null,
      lastValidatedAt: existingAdminConfig.lastValidatedAt,
      lastValidationOk: existingAdminConfig.lastValidationOk,
    };

    await ensureDirectory();
    await writeJsonRecord(configFile, record);
    return await readAdminConfig();
  }

  async function writeValidationMetadata({ ok }) {
    const stored = (await readStoredRecord(configFile)) ?? {};
    const timestamp = now();
    const nextRecord = {
      ...stored,
      lastValidatedAt: timestamp,
      lastValidationOk: Boolean(ok),
    };
    await ensureDirectory();
    await writeJsonRecord(configFile, nextRecord);
  }

  async function testConfig(payload) {
    const currentConfig = await readConfig();
    const candidate = normalizeDraftConfig(payload, currentConfig);
    const client = createS3Client(candidate, candidate.credentials);
    const probeId = `healthchecks/object-storage-${Date.now()}.txt`;
    const key = joinObjectStorageKey(candidate.prefix, probeId);
    const body = Buffer.from(`finalfolio object storage probe ${now()}`, 'utf8');

    try {
      await sendS3Command(client, new HeadBucketCommand({ Bucket: candidate.bucket }));
      await sendS3Command(
        client,
        new PutObjectCommand({
          Bucket: candidate.bucket,
          Key: key,
          Body: body,
          ContentLength: body.byteLength,
          ContentType: 'text/plain; charset=utf-8',
        }),
      );
      await sendS3Command(client, new HeadObjectCommand({ Bucket: candidate.bucket, Key: key }));
      await sendS3Command(client, new DeleteObjectCommand({ Bucket: candidate.bucket, Key: key }));
      await writeValidationMetadata({ ok: true });

      return {
        ok: true,
        message: 'Connection succeeded. Read/write/delete checks passed.',
        publicProbeUrl: buildPublicUrl(candidate.publicBaseUrl, probeId),
      };
    } catch (error) {
      await writeValidationMetadata({ ok: false });
      const message = error instanceof Error && error.message ? error.message : 'Connection test failed.';
      throw createBadRequest(`Object storage connection test failed: ${message}`);
    }
  }

  async function readSyncEntry(filename) {
    const syncIndex = await readSyncIndex();
    return syncIndex.uploads[filename] ?? null;
  }

  async function upsertSyncEntry(filename, entry) {
    const syncIndex = await readSyncIndex();
    syncIndex.uploads[filename] = sanitizeSyncEntry(entry);
    await writeSyncIndex(syncIndex);
    return syncIndex.uploads[filename];
  }

  async function clearSyncEntry(filename) {
    const syncIndex = await readSyncIndex();
    delete syncIndex.uploads[filename];
    await writeSyncIndex(syncIndex);
  }

  async function markUploadPending(filename) {
    const config = await readConfig();
    if (!config.enabled) {
      return null;
    }

    const existing = await readSyncEntry(filename);
    const remoteTargets = createRemoteVariantTargets(config, createUploadRelativePaths(filename));
    return await upsertSyncEntry(filename, {
      status: 'pending',
      provider: config.provider,
      endpoint: config.endpoint,
      region: config.region,
      bucket: config.bucket,
      publicBaseUrl: config.publicBaseUrl,
      queuedAt: existing?.queuedAt ?? now(),
      lastAttemptAt: existing?.lastAttemptAt ?? null,
      syncedAt: existing?.status === 'remote' ? existing.syncedAt : null,
      attemptCount: existing?.attemptCount ?? 0,
      lastError: null,
      original: remoteTargets.original,
      preview: remoteTargets.preview,
      thumb: remoteTargets.thumb,
    });
  }

  function buildDeliveryStatus(syncEntry, { enabled = false } = {}) {
    const state = allowedSyncStatuses.has(syncEntry?.status) ? syncEntry.status : 'local';

    return {
      state,
      canRetry: enabled && state !== 'remote' && state !== 'pending',
      queuedAt: syncEntry?.queuedAt ?? null,
      lastAttemptAt: syncEntry?.lastAttemptAt ?? null,
      syncedAt: syncEntry?.syncedAt ?? null,
      error: syncEntry?.lastError ?? null,
      attempts: syncEntry?.attemptCount ?? 0,
    };
  }

  async function syncLocalUpload(filename, artifacts) {
    const config = await readConfig();
    if (!config.enabled) {
      return null;
    }

    const { originalPath, previewPath, thumbPath, resources } = artifacts ?? {};
    if (!originalPath || !resources?.original) {
      throw createBadRequest('Upload artifacts are incomplete for object storage sync.');
    }

    if (!config.credentials.accessKeyId || !config.credentials.secretAccessKey) {
      throw createBadRequest('Object storage credentials are required before mirroring uploads.');
    }

    const relativePaths = createUploadRelativePaths(filename);
    const remoteTargets = createRemoteVariantTargets(config, relativePaths);
    const currentEntry = (await readSyncEntry(filename)) ?? (await markUploadPending(filename));
    const attemptStartedAt = now();
    const attemptCount = (currentEntry?.attemptCount ?? 0) + 1;
    const uploadTargets = [
      {
        localPath: originalPath,
        key: remoteTargets.original.key,
        mimeType: resources.original.mimeType ?? 'application/octet-stream',
      },
      ...(resources.preview && previewPath
        ? [
            {
              localPath: previewPath,
              key: remoteTargets.preview.key,
              mimeType: resources.preview.mimeType ?? 'image/webp',
            },
          ]
        : []),
      ...(resources.thumb && thumbPath
        ? [
            {
              localPath: thumbPath,
              key: remoteTargets.thumb.key,
              mimeType: resources.thumb.mimeType ?? 'image/webp',
            },
          ]
        : []),
    ];

    const client = createS3Client(config, config.credentials);
    const signer = createRequestSigner(config, config.credentials);

    try {
      for (const target of uploadTargets) {
        await uploadObjectWithRetries({
          config,
          signer,
          localPath: target.localPath,
          key: target.key,
          mimeType: target.mimeType,
        });
        await sendS3Command(client, new HeadObjectCommand({ Bucket: config.bucket, Key: target.key }));
      }

      return await upsertSyncEntry(filename, {
        status: 'remote',
        provider: config.provider,
        endpoint: config.endpoint,
        region: config.region,
        bucket: config.bucket,
        publicBaseUrl: config.publicBaseUrl,
        queuedAt: currentEntry?.queuedAt ?? attemptStartedAt,
        lastAttemptAt: attemptStartedAt,
        syncedAt: now(),
        attemptCount,
        lastError: null,
        original: remoteTargets.original,
        preview: resources.preview ? remoteTargets.preview : null,
        thumb: resources.thumb ? remoteTargets.thumb : null,
      });
    } catch (error) {
      const failureMessage = error instanceof Error && error.message ? error.message : 'Object storage upload failed.';
      await upsertSyncEntry(filename, {
        status: 'failed',
        provider: config.provider,
        endpoint: config.endpoint,
        region: config.region,
        bucket: config.bucket,
        publicBaseUrl: config.publicBaseUrl,
        queuedAt: currentEntry?.queuedAt ?? attemptStartedAt,
        lastAttemptAt: attemptStartedAt,
        syncedAt: currentEntry?.status === 'remote' ? currentEntry.syncedAt : null,
        attemptCount,
        lastError: failureMessage,
        original: remoteTargets.original,
        preview: resources.preview ? remoteTargets.preview : null,
        thumb: resources.thumb ? remoteTargets.thumb : null,
      });
      throw error;
    }
  }

  async function removeRemoteUpload(filename) {
    const entry = await readSyncEntry(filename);
    if (!entry) {
      return { removed: false };
    }

    if (entry.status !== 'remote') {
      await clearSyncEntry(filename);
      return { removed: false, skipped: true, detached: true };
    }

    const config = await readConfig();
    if (!config.credentials.accessKeyId || !config.credentials.secretAccessKey) {
      await clearSyncEntry(filename);
      return { removed: false, skipped: true };
    }

    const client = createS3Client(
      {
        endpoint: entry.endpoint,
        region: entry.region,
      },
      config.credentials,
    );
    const keys = [entry.original.key, entry.preview?.key, entry.thumb?.key].filter(Boolean);
    await Promise.all(keys.map((key) => sendS3Command(client, new DeleteObjectCommand({ Bucket: entry.bucket, Key: key }))));
    await clearSyncEntry(filename);
    return { removed: true, deletedKeys: keys };
  }

  async function downloadToLocal(client, bucket, key, localPath) {
    const response = await sendS3Command(client, new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = response.Body;
    if (!body || typeof body.transformToByteArray !== 'function') {
      throw createBadRequest('Object storage response body is unreadable.');
    }

    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, Buffer.from(await body.transformToByteArray()));
  }

  async function restoreRemoteUploadToLocal(filename, artifacts, { detach = true } = {}) {
    const entry = await readSyncEntry(filename);
    if (!entry) {
      return { restoredFiles: 0, detached: false };
    }

    if (entry.status !== 'remote') {
      if (detach) {
        await clearSyncEntry(filename);
      }

      return { restoredFiles: 0, detached: detach };
    }

    const config = await readConfig();
    if (!config.credentials.accessKeyId || !config.credentials.secretAccessKey) {
      throw createBadRequest('Object storage credentials are required to restore files back to the local store.');
    }

    const client = createS3Client(
      {
        endpoint: entry.endpoint,
        region: entry.region,
      },
      config.credentials,
    );
    let restoredFiles = 0;
    const targets = [
      [entry.original, artifacts.originalPath],
      [entry.preview, artifacts.previewPath],
      [entry.thumb, artifacts.thumbPath],
    ];

    for (const [remote, localPath] of targets) {
      if (!remote || !localPath) {
        continue;
      }

      try {
        await fs.access(localPath);
      } catch {
        await downloadToLocal(client, entry.bucket, remote.key, localPath);
        restoredFiles += 1;
      }
    }

    if (detach) {
      await clearSyncEntry(filename);
    }

    return {
      restoredFiles,
      detached: detach,
    };
  }

  function buildRemoteResources(syncEntry, localResources) {
    if (!syncEntry || syncEntry.status !== 'remote' || !localResources?.original) {
      return localResources;
    }

    return {
      original: {
        ...localResources.original,
        src: syncEntry.original.publicUrl,
      },
      preview:
        localResources.preview && syncEntry.preview
          ? {
              ...localResources.preview,
              src: syncEntry.preview.publicUrl,
            }
          : localResources.preview,
      thumb:
        localResources.thumb && syncEntry.thumb
          ? {
              ...localResources.thumb,
              src: syncEntry.thumb.publicUrl,
            }
          : localResources.thumb,
    };
  }

  async function countMirroredUploads() {
    const syncIndex = await readSyncIndex();
    return Object.values(syncIndex.uploads).filter((entry) => entry.status === 'remote').length;
  }

  async function createPresignedUpload({ filename, contentType, expiresIn = 900 }) {
    const config = await readConfig();
    if (!config.enabled) {
      return null;
    }
    if (!config.credentials.accessKeyId || !config.credentials.secretAccessKey) {
      throw createBadRequest('Object storage credentials are required before direct uploads.');
    }
    const relativePaths = createUploadRelativePaths(filename);
    const target = createRemoteVariantTargets(config, relativePaths).original;
    const client = createS3Client(config, config.credentials);
    const url = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: target.key,
        ContentType: contentType || 'application/octet-stream',
      }),
      { expiresIn },
    );
    return { key: target.key, url, publicUrl: target.publicUrl, expiresIn };
  }

  async function statObject(key) {
    const config = await readConfig();
    if (!config.enabled) {
      return null;
    }
    const client = createS3Client(config, config.credentials);
    return await sendS3Command(client, new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
  }

  async function downloadObjectToFile(key, destinationPath) {
    const config = await readConfig();
    if (!config.enabled) {
      throw createBadRequest('Object storage is disabled.');
    }
    const client = createS3Client(config, config.credentials);
    const result = await sendS3Command(client, new GetObjectCommand({ Bucket: config.bucket, Key: key }));
    const chunks = [];
    for await (const chunk of result.Body) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.writeFile(destinationPath, buffer);
    return { bytes: buffer.length, contentType: result.ContentType ?? null };
  }

  return {
    defaults: { ...DEFAULT_OBJECT_STORAGE_CONFIG },
    readConfig,
    readAdminConfig,
    updateConfig,
    testConfig,
    readSyncIndex,
    readSyncEntry,
    countMirroredUploads,
    markUploadPending,
    syncLocalUpload,
    clearSyncEntry,
    removeRemoteUpload,
    restoreRemoteUploadToLocal,
    buildRemoteResources,
    buildDeliveryStatus,
    createPresignedUpload,
    statObject,
    downloadObjectToFile,
  };
}
