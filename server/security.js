import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createBadRequest } from './lib/httpErrors.js';

const CAPTCHA_ID_BYTES = 18;
const CAPTCHA_TTL_MS = 10 * 60 * 1000;
const CAPTCHA_MAX_ATTEMPTS = 5;
const CAPTCHA_LENGTH = 5;
const CAPTCHA_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CONFIG_SECRET_KEY_BYTES = 32;
const CONFIG_SECRET_IV_BYTES = 12;

function createId(bytes = 12) {
  return crypto.randomBytes(bytes).toString('base64url').replace(/[-_]/g, '').toLowerCase();
}


function createTooManyRequests(message, retryAfterSeconds) {
  const error = new Error(message);
  error.statusCode = 429;
  error.code = 'rate_limited';
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    error.retryAfterSeconds = retryAfterSeconds;
  }
  return error;
}

function normalizeIp(ip) {
  const value = String(ip ?? '').trim();
  if (!value) {
    return 'unknown';
  }

  return value.startsWith('::ffff:') ? value.slice(7) : value;
}

function normalizeCaptchaPurpose(purpose) {
  const value = String(purpose ?? '').trim().toLowerCase();
  return value === 'register' ? 'register' : 'register';
}

function normalizeCaptchaAnswer(answer) {
  const value = String(answer ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (!value) {
    throw createBadRequest('Captcha answer is required.');
  }

  return value;
}

function hashCaptchaAnswer(captchaId, answer) {
  return crypto.createHash('sha256').update(`${captchaId}:${answer}`).digest('hex');
}

function createCaptchaAnswer(randomBytes) {
  let answer = '';

  while (answer.length < CAPTCHA_LENGTH) {
    const randomIndex = randomBytes(1)[0] % CAPTCHA_ALPHABET.length;
    answer += CAPTCHA_ALPHABET[randomIndex];
  }

  return answer;
}

function createCaptchaSvg(answer, randomBytes) {
  const characters = answer.split('');
  const colors = ['#1b1916', '#6b5f50', '#9c7a3b', '#3b5f54'];
  const textFragments = characters
    .map((character, index) => {
      const x = 26 + index * 34 + (randomBytes(1)[0] % 7);
      const y = 53 + (randomBytes(1)[0] % 13) - 6;
      const rotate = (randomBytes(1)[0] % 17) - 8;
      const fill = colors[randomBytes(1)[0] % colors.length];
      return `<text x="${x}" y="${y}" fill="${fill}" transform="rotate(${rotate} ${x} ${y})">${character}</text>`;
    })
    .join('');

  const lineFragments = Array.from({ length: 7 }, (_, index) => {
    const x1 = 10 + (randomBytes(1)[0] % 180);
    const y1 = 12 + (randomBytes(1)[0] % 56);
    const x2 = 10 + (randomBytes(1)[0] % 180);
    const y2 = 12 + (randomBytes(1)[0] % 56);
    const opacity = 0.16 + ((index % 3) * 0.08);
    return `<path d="M${x1} ${y1} C ${(x1 + x2) / 2} ${(y1 + y2) / 2 - 10}, ${(x1 + x2) / 2} ${(y1 + y2) / 2 + 10}, ${x2} ${y2}" stroke="#544b40" stroke-opacity="${opacity.toFixed(
      2,
    )}" stroke-width="1.6" fill="none"/>`;
  }).join('');

  const dotFragments = Array.from({ length: 18 }, () => {
    const cx = 10 + (randomBytes(1)[0] % 180);
    const cy = 10 + (randomBytes(1)[0] % 56);
    const radius = 0.9 + (randomBytes(1)[0] % 10) / 10;
    return `<circle cx="${cx}" cy="${cy}" r="${radius.toFixed(1)}" fill="#857865" fill-opacity="0.18" />`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="78" viewBox="0 0 200 78" role="img" aria-label="Security verification code">
  <defs>
    <linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
      <stop offset="0%" stop-color="#fff8ef"/>
      <stop offset="100%" stop-color="#efe6d9"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="198" height="76" rx="16" fill="url(#bg)" stroke="#d4c5b2" />
  <g>${lineFragments}</g>
  <g>${dotFragments}</g>
  <g font-family="Arial, sans-serif" font-size="32" font-weight="700" letter-spacing="7">${textFragments}</g>
</svg>`;
}

function toDataUrl(svgMarkup) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
}

function sanitizeCaptchaRecord(record) {
  if (
    !record ||
    typeof record !== 'object' ||
    typeof record.id !== 'string' ||
    typeof record.ip !== 'string' ||
    typeof record.purpose !== 'string' ||
    typeof record.answerHash !== 'string' ||
    typeof record.createdAt !== 'string' ||
    typeof record.expiresAt !== 'string'
  ) {
    throw createBadRequest('Captcha record is invalid.');
  }

  return {
    id: record.id,
    ip: normalizeIp(record.ip),
    purpose: normalizeCaptchaPurpose(record.purpose),
    answerHash: record.answerHash,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    consumedAt: typeof record.consumedAt === 'string' ? record.consumedAt : null,
    attemptCount: Number.isFinite(record.attemptCount) ? Number(record.attemptCount) : 0,
  };
}

function sanitizeRateLimitRecord(record, fallbackKey) {
  if (
    !record ||
    typeof record !== 'object' ||
    typeof record.id !== 'string' ||
    typeof record.scope !== 'string' ||
    typeof record.key !== 'string' ||
    !Array.isArray(record.events)
  ) {
    throw createBadRequest('Rate limit record is invalid.');
  }

  return {
    id: record.id,
    scope: record.scope,
    key: record.key || fallbackKey,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : null,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
    events: record.events.filter((value) => typeof value === 'number' && Number.isFinite(value)),
  };
}

export function createSecurityStore({
  dataRoot,
  now = () => new Date().toISOString(),
  randomBytes = crypto.randomBytes,
} = {}) {
  const securityRoot = path.join(dataRoot, 'security');
  const captchasDir = path.join(securityRoot, 'captchas');
  const rateLimitsDir = path.join(securityRoot, 'rate-limits');
  const configSecretKeyFile = path.join(securityRoot, 'config-secret.key');
  const recordQueues = new Map();

  function captchaPath(captchaId) {
    return path.join(captchasDir, `${captchaId}.json`);
  }

  function rateLimitId(scope, key) {
    const suffix = crypto.createHash('sha256').update(`${scope}:${key}`).digest('hex').slice(0, 24);
    return `ratelimit-${scope}-${suffix}`;
  }

  function rateLimitPath(scope, key) {
    return path.join(rateLimitsDir, `${rateLimitId(scope, key)}.json`);
  }

  async function ensureSecurityDirectories() {
    await fs.mkdir(captchasDir, { recursive: true, mode: 0o700 });
    await fs.mkdir(rateLimitsDir, { recursive: true, mode: 0o700 });
  }

  async function ensureConfigSecretKey() {
    await ensureSecurityDirectories();

    try {
      const value = (await fs.readFile(configSecretKeyFile, 'utf8')).trim();
      if (/^[a-f0-9]{64}$/i.test(value)) {
        return Buffer.from(value, 'hex');
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }

    const nextKey = randomBytes(CONFIG_SECRET_KEY_BYTES).toString('hex');
    await fs.writeFile(configSecretKeyFile, `${nextKey}\n`, { mode: 0o600 });
    return Buffer.from(nextKey, 'hex');
  }

  async function encryptConfigSecret(secret) {
    if (typeof secret !== 'string' || secret.length === 0) {
      return null;
    }

    const key = await ensureConfigSecretKey();
    const iv = randomBytes(CONFIG_SECRET_IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  }

  async function decryptConfigSecret(payload) {
    if (
      !payload ||
      typeof payload !== 'object' ||
      payload.algorithm !== 'aes-256-gcm' ||
      typeof payload.iv !== 'string' ||
      typeof payload.tag !== 'string' ||
      typeof payload.ciphertext !== 'string'
    ) {
      return null;
    }

    const key = await ensureConfigSecretKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final(),
    ]);

    return plaintext.toString('utf8');
  }

  async function writeJsonRecord(filename, record) {
    const tempFile = `${filename}.${process.pid}.${createId(6)}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(record, null, 2), { encoding: 'utf8', mode: 0o600 });
    await fs.rename(tempFile, filename);
  }

  async function queueRecordTask(recordKey, task) {
    const previousTask = recordQueues.get(recordKey) ?? Promise.resolve();
    const nextTask = previousTask.catch(() => undefined).then(task);
    recordQueues.set(recordKey, nextTask);

    try {
      return await nextTask;
    } finally {
      if (recordQueues.get(recordKey) === nextTask) {
        recordQueues.delete(recordKey);
      }
    }
  }

  async function readCaptchaRecord(captchaId) {
    try {
      const payload = JSON.parse(await fs.readFile(captchaPath(captchaId), 'utf8'));
      return sanitizeCaptchaRecord(payload);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw createBadRequest('Captcha expired. Refresh and try again.');
      }

      throw error;
    }
  }

  async function readRateLimitRecord(scope, key) {
    try {
      const payload = JSON.parse(await fs.readFile(rateLimitPath(scope, key), 'utf8'));
      return sanitizeRateLimitRecord(payload, key);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  async function issueCaptcha({ ip, purpose = 'register' } = {}) {
    await ensureSecurityDirectories();
    const normalizedIp = normalizeIp(ip);
    const normalizedPurpose = normalizeCaptchaPurpose(purpose);
    const timestamp = now();
    const captchaId = `captcha-${createId(CAPTCHA_ID_BYTES)}`;
    const answer = createCaptchaAnswer(randomBytes);
    const record = {
      id: captchaId,
      ip: normalizedIp,
      purpose: normalizedPurpose,
      answerHash: hashCaptchaAnswer(captchaId, answer),
      createdAt: timestamp,
      expiresAt: new Date(Date.parse(timestamp) + CAPTCHA_TTL_MS).toISOString(),
      consumedAt: null,
      attemptCount: 0,
    };

    await writeJsonRecord(captchaPath(captchaId), record);

    return {
      id: captchaId,
      purpose: normalizedPurpose,
      prompt: 'Enter the five characters shown',
      imageDataUrl: toDataUrl(createCaptchaSvg(answer, randomBytes)),
      expiresAt: record.expiresAt,
      answer,
    };
  }

  async function verifyCaptcha({ id, answer, ip, purpose = 'register' } = {}) {
    const captchaId = String(id ?? '').trim();
    if (!captchaId) {
      throw createBadRequest('Captcha expired. Refresh and try again.');
    }

    const normalizedIp = normalizeIp(ip);
    const normalizedPurpose = normalizeCaptchaPurpose(purpose);
    const normalizedAnswer = normalizeCaptchaAnswer(answer);
    const filename = captchaPath(captchaId);

    return await queueRecordTask(filename, async () => {
      const record = await readCaptchaRecord(captchaId);
      const expiresAtMs = Date.parse(record.expiresAt);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now() || record.consumedAt) {
        await fs.rm(filename, { force: true });
        throw createBadRequest('Captcha expired. Refresh and try again.');
      }

      if (record.ip !== normalizedIp || record.purpose !== normalizedPurpose) {
        throw createBadRequest('Captcha is invalid. Refresh and try again.');
      }

      const expectedHash = hashCaptchaAnswer(captchaId, normalizedAnswer);
      if (record.answerHash !== expectedHash) {
        const nextAttemptCount = record.attemptCount + 1;
        if (nextAttemptCount >= CAPTCHA_MAX_ATTEMPTS) {
          await fs.rm(filename, { force: true });
        } else {
          await writeJsonRecord(filename, {
            ...record,
            attemptCount: nextAttemptCount,
          });
        }

        throw createBadRequest('Captcha answer is incorrect.');
      }

      await fs.rm(filename, { force: true });
      return true;
    });
  }

  async function consumeRateLimit({ scope, key, limit, windowMs, message } = {}) {
    const normalizedScope = String(scope ?? '').trim().toLowerCase();
    const normalizedKey = String(key ?? '').trim();
    if (!normalizedScope || !normalizedKey) {
      throw createBadRequest('Rate limit key is invalid.');
    }

    if (!Number.isFinite(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1000) {
      throw createBadRequest('Rate limit configuration is invalid.');
    }

    await ensureSecurityDirectories();
    const filename = rateLimitPath(normalizedScope, normalizedKey);

    return await queueRecordTask(filename, async () => {
      const timestamp = now();
      const nowMs = Date.parse(timestamp);
      const record =
        (await readRateLimitRecord(normalizedScope, normalizedKey)) ?? {
          id: rateLimitId(normalizedScope, normalizedKey),
          scope: normalizedScope,
          key: normalizedKey,
          createdAt: timestamp,
          updatedAt: timestamp,
          events: [],
        };

      const recentEvents = record.events.filter((eventMs) => nowMs - eventMs < windowMs);
      if (recentEvents.length >= limit) {
        const retryAfterMs = Math.max(1000, windowMs - (nowMs - recentEvents[0]));
        const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
        await writeJsonRecord(filename, {
          ...record,
          updatedAt: timestamp,
          events: recentEvents,
        });
        throw createTooManyRequests(message ?? 'Too many requests. Try again later.', retryAfterSeconds);
      }

      recentEvents.push(nowMs);
      await writeJsonRecord(filename, {
        ...record,
        updatedAt: timestamp,
        events: recentEvents,
      });

      return {
        limit,
        remaining: Math.max(0, limit - recentEvents.length),
        resetAt: new Date(recentEvents[0] + windowMs).toISOString(),
      };
    });
  }

  return {
    captchasDir,
    rateLimitsDir,
    ensureSecurityDirectories,
    ensureConfigSecretKey,
    encryptConfigSecret,
    decryptConfigSecret,
    issueCaptcha,
    verifyCaptcha,
    consumeRateLimit,
  };
}
