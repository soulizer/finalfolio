import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createBadRequest } from './lib/httpErrors.js';

const AI_CONFIG_VERSION = 1;
const MAX_PROVIDERS = 20;
const MAX_IMAGES = 50;
const MAX_THUMBNAIL_CHARS = 160_000;
const MAX_TOTAL_THUMBNAIL_CHARS = 4_000_000;

export const DEFAULT_AI_PROMPT = `你是一位资深摄影画册编辑与图片编辑。你会收到一组照片缩略图（按上传顺序编号，从 0 开始）以及每张照片的名称和尺寸。请分析照片的内容、主次关系、色调、横竖构图和叙事节奏，并设计 3 套完整、可执行的画册方案。

输出必须是严格 JSON，不要 Markdown，不要解释文字。JSON 结构：
{
  "folioTitle": "作品集标题",
  "folioSubtitle": "一句副标题",
  "issue": "作品集编号，例如 AI 01",
  "frameRadius": 14,
  "plans": [
    {
      "id": "editorial",
      "name": "方案名称（4-8个汉字）",
      "style": "一句话风格说明",
      "summary": "30-60字，说明为什么这样编排",
      "pages": [
        {
          "template": "cover|essay|folio|grid|diptych|panorama|mosaic|triptych",
          "theme": "warm-beige|butter-cream|pale-blue|sea-glass|pure-white|light-gray|sandstone|sage-mist|dusty-rose|pearl-blush",
          "kicker": "引题",
          "title": "标题",
          "deck": "导语",
          "body": "正文",
          "caption": "图注",
          "assetIndexes": [0, 3, 5]
        }
      ]
    }
  ]
}

硬性规则：
1. 必须给出 3 套方案，风格明显不同（例如：克制编辑感、强烈视觉冲击、安静手记感）。
2. 每套方案必须是偶数页：4、6、8 或 10 页；第一页用 cover 或 folio 开场，最后一页安静收束。
3. 页数必须是偶数，方便双页翻页；不要输出奇数页方案。
4. 每个页面只使用上面列出的 template。每个 template 的图片数量必须匹配：
   cover=1, essay=1, folio=1, grid=4, diptych=2, panorama=2, mosaic=3, triptych=3。
5. assetIndexes 使用上传顺序的编号，不能越界；尽量让每张照片至少出现一次，但不要为了用完而重复堆砌。
6. 主图放在 cover、folio、mosaic 的 lead 或大幅页面；次图、细节图放在 grid、diptych、triptych、panorama。
7. 每页只填写该版式需要的文字；没有导语或正文时用空字符串。文字使用中文，简洁、有编辑感，不要空泛营销语。
8. theme 必须从列表中选择，同一套方案可以有 1-3 个主色，不要每页都换色。
9. frameRadius 为 0-24 的整数，整套方案统一。
10. 不要输出任何 JSON 之外的字符。`;

const DEFAULT_AI_CONFIG = {
  enabled: false,
  userTotalLimit: 10,
  dailyLimit: 3,
  maxImages: MAX_IMAGES,
  requestTimeoutMs: 120_000,
  prompt: DEFAULT_AI_PROMPT,
  providers: [],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createAiError(message, statusCode = 400, code = 'ai_error') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.expose = true;
  return error;
}

function sanitizeText(value, fieldName, maxLength, { allowEmpty = false } = {}) {
  if (typeof value !== 'string') {
    throw createBadRequest(`${fieldName} is invalid.`);
  }

  const nextValue = value.trim();
  if (!allowEmpty && !nextValue) {
    throw createBadRequest(`${fieldName} is required.`);
  }
  if (nextValue.length > maxLength) {
    throw createBadRequest(`${fieldName} is too long.`);
  }

  return nextValue;
}

function sanitizeLimit(value, fallback, max) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > max) {
    throw createBadRequest('AI limit is invalid.');
  }

  return Math.round(number);
}

function sanitizeBaseUrl(value) {
  const nextValue = sanitizeText(value, 'Base URL', 500);
  let url;
  try {
    url = new URL(nextValue);
  } catch {
    throw createBadRequest('Base URL is invalid.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw createBadRequest('Base URL must use http or https.');
  }
  return url.toString().replace(/\/+$/, '');
}

function maskApiKey(apiKey) {
  if (!apiKey) {
    return null;
  }

  const suffix = apiKey.slice(-4);
  return `••••${suffix}`;
}

function sanitizeProvider(value, existing = null) {
  if (!value || typeof value !== 'object') {
    throw createBadRequest('AI provider is invalid.');
  }

  const provider = value;
  const apiKey =
    typeof provider.apiKey === 'string' && provider.apiKey.trim()
      ? provider.apiKey.trim()
      : existing?.apiKey ?? '';
  if (!apiKey) {
    throw createBadRequest('API key is required for a new AI provider.');
  }

  return {
    id: existing?.id ?? sanitizeText(provider.id ?? `ai-${crypto.randomBytes(5).toString('hex')}`, 'Provider ID', 80),
    name: sanitizeText(provider.name, 'Provider name', 80),
    model: sanitizeText(provider.model, 'Model', 120),
    baseUrl: sanitizeBaseUrl(provider.baseUrl),
    apiKey,
    order:
      typeof provider.order === 'number' && Number.isFinite(provider.order) && provider.order >= 0
        ? Math.round(provider.order)
        : existing?.order ?? 10,
    enabled: typeof provider.enabled === 'boolean' ? provider.enabled : existing?.enabled ?? true,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeConfig(payload, fallback = DEFAULT_AI_CONFIG) {
  const next = payload && typeof payload === 'object' ? payload : {};
  const existingProviders = new Map((fallback.providers ?? []).map((provider) => [provider.id, provider]));
  const rawProviders = Array.isArray(next.providers) ? next.providers.slice(0, MAX_PROVIDERS) : fallback.providers;

  return {
    enabled: typeof next.enabled === 'boolean' ? next.enabled : fallback.enabled,
    userTotalLimit: sanitizeLimit(next.userTotalLimit, fallback.userTotalLimit, 100000),
    dailyLimit: sanitizeLimit(next.dailyLimit, fallback.dailyLimit, 10000),
    maxImages: Math.min(MAX_IMAGES, Math.max(1, sanitizeLimit(next.maxImages, fallback.maxImages, MAX_IMAGES))),
    requestTimeoutMs: Math.min(300_000, Math.max(15_000, sanitizeLimit(next.requestTimeoutMs, fallback.requestTimeoutMs, 300_000))),
    prompt: sanitizeText(next.prompt ?? fallback.prompt, 'AI prompt', 12000, { allowEmpty: false }),
    providers: rawProviders.map((provider) => sanitizeProvider(provider, existingProviders.get(provider?.id) ?? null)),
  };
}

function toAdminProvider(provider) {
  return {
    id: provider.id,
    name: provider.name,
    model: provider.model,
    baseUrl: provider.baseUrl,
    order: provider.order,
    enabled: provider.enabled,
    hasApiKey: Boolean(provider.apiKey),
    apiKeyHint: maskApiKey(provider.apiKey),
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

function extractJson(text) {
  const value = String(text ?? '').trim();
  if (!value) {
    throw new Error('The AI provider returned an empty response.');
  }

  const withoutFence = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(withoutFence.slice(start, end + 1));
    }
    throw new Error('The AI provider did not return valid JSON.');
  }
}

async function readJsonFile(filename, fallback) {
  try {
    return JSON.parse(await fs.readFile(filename, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return clone(fallback);
    }
    throw error;
  }
}

async function writeJsonFile(filename, value) {
  const tempFile = `${filename}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(value, null, 2), { mode: 0o600 });
  await fs.chmod(tempFile, 0o600);
  await fs.rename(tempFile, filename);
}

function currentDay() {
  return new Date().toISOString().slice(0, 10);
}

export function createAiStore({ dataRoot } = {}) {
  const aiDir = path.join(dataRoot, 'ai');
  const configFile = path.join(aiDir, 'config.json');
  const usageFile = path.join(aiDir, 'usage.json');
  let usageQueue = Promise.resolve();

  async function ensureAiDirectory() {
    await fs.mkdir(aiDir, { recursive: true, mode: 0o700 });
    await fs.chmod(aiDir, 0o700);
  }

  async function readConfig() {
    await ensureAiDirectory();
    return sanitizeConfig(await readJsonFile(configFile, DEFAULT_AI_CONFIG));
  }

  async function readAdminConfig() {
    const config = await readConfig();
    return {
      enabled: config.enabled,
      userTotalLimit: config.userTotalLimit,
      dailyLimit: config.dailyLimit,
      maxImages: config.maxImages,
      requestTimeoutMs: config.requestTimeoutMs,
      prompt: config.prompt,
      providers: config.providers.map(toAdminProvider),
    };
  }

  async function updateConfig(payload) {
    const current = await readConfig();
    const next = sanitizeConfig(payload, current);
    await ensureAiDirectory();
    await writeJsonFile(configFile, next);
    return readAdminConfig();
  }

  async function readUsage() {
    await ensureAiDirectory();
    return readJsonFile(usageFile, { users: {} });
  }

  function usageFor(usage, userId) {
    const record = usage.users?.[userId] ?? {};
    const day = currentDay();
    return {
      total: Number.isFinite(record.total) ? record.total : 0,
      daily: record.day === day && Number.isFinite(record.daily) ? record.daily : 0,
      day,
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
    };
  }

  async function getUserStatus(userId) {
    const [config, usage] = await Promise.all([readConfig(), readUsage()]);
    const record = usageFor(usage, userId);
    return {
      enabled: config.enabled && config.providers.some((provider) => provider.enabled && provider.apiKey),
      prompt: config.prompt,
      maxImages: config.maxImages,
      userTotalLimit: config.userTotalLimit,
      dailyLimit: config.dailyLimit,
      usage: {
        total: record.total,
        daily: record.daily,
        day: record.day,
      },
      remaining: {
        total: config.userTotalLimit > 0 ? Math.max(0, config.userTotalLimit - record.total) : null,
        daily: config.dailyLimit > 0 ? Math.max(0, config.dailyLimit - record.daily) : null,
      },
    };
  }

  async function readUsageForAdmin() {
    const usage = await readUsage();
    const records = usage.users && typeof usage.users === 'object' ? usage.users : {};
    const result = {};
    for (const userId of Object.keys(records)) {
      const record = usageFor(usage, userId);
      result[userId] = {
        total: record.total,
        daily: record.daily,
        day: record.day,
        updatedAt: record.updatedAt,
      };
    }
    return result;
  }

  async function setUserUsage(userId, payload = {}) {
    if (typeof userId !== 'string' || !userId.trim()) {
      throw createBadRequest('User ID is invalid.');
    }
    const total = sanitizeLimit(payload.total, 0, 100000);
    const daily = sanitizeLimit(payload.daily, 0, 10000);

    usageQueue = usageQueue.catch(() => {}).then(async () => {
      await ensureAiDirectory();
      const usage = await readUsage();
      usage.users = usage.users && typeof usage.users === 'object' ? usage.users : {};
      usage.users[userId] = {
        total,
        daily,
        day: currentDay(),
        updatedAt: new Date().toISOString(),
      };
      await writeJsonFile(usageFile, usage);
    });
    await usageQueue;
    return (await readUsageForAdmin())[userId] ?? null;
  }

  function recordUsage(userId) {
    usageQueue = usageQueue.catch(() => {}).then(async () => {
      await ensureAiDirectory();
      const usage = await readUsage();
      const day = currentDay();
      const previous = usageFor(usage, userId);
      usage.users = usage.users && typeof usage.users === 'object' ? usage.users : {};
      usage.users[userId] = {
        total: previous.total + 1,
        daily: previous.daily + 1,
        day,
        updatedAt: new Date().toISOString(),
      };
      await writeJsonFile(usageFile, usage);
    });
    return usageQueue;
  }

  async function assertQuota(userId) {
    const config = await readConfig();
    if (!config.enabled) {
      throw createAiError('AI arrangement is currently disabled.', 403, 'ai_disabled');
    }
    if (!config.providers.some((provider) => provider.enabled && provider.apiKey)) {
      throw createAiError('No AI provider is configured yet.', 503, 'ai_not_configured');
    }

    const usage = usageFor(await readUsage(), userId);
    if (config.userTotalLimit > 0 && usage.total >= config.userTotalLimit) {
      throw createAiError('You have used all AI arrangement credits for this account.', 429, 'ai_quota_exceeded');
    }
    if (config.dailyLimit > 0 && usage.daily >= config.dailyLimit) {
      throw createAiError('You have reached the daily AI arrangement limit. Try again tomorrow.', 429, 'ai_daily_limit');
    }

    return config;
  }

  function buildChatCompletionsUrl(baseUrl) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    return `${baseUrl}/chat/completions`;
  }
  const path = url.pathname.replace(/\/+$/, '');
  // Bare hosts (no path) follow the OpenAI convention: /v1/chat/completions.
  // Base URLs that already include a path (e.g. /v1, /v4, /api/v1) keep it and
  // only get the endpoint suffix, so existing configurations stay untouched.
  url.pathname = path ? `${path}/chat/completions` : '/v1/chat/completions';
  url.search = '';
  return url.toString();
}

async function callProvider(provider, messages, { timeoutMs, maxTokens = 8000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    try {
      const response = await fetch(buildChatCompletionsUrl(provider.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          temperature: 0.6,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });
      const bodyText = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${bodyText.slice(0, 300)}`);
      }
      let payload;
      try {
        payload = JSON.parse(bodyText);
      } catch {
        throw new Error('The AI provider returned a non-JSON response.');
      }
      if (payload?.choices?.[0]?.finish_reason === 'length') {
        throw new Error('The AI provider cut the response off before it finished.');
      }
      let content = payload?.choices?.[0]?.message?.content;
      if (Array.isArray(content)) {
        // Some relays return Anthropic-style content parts; keep the text parts.
        content = content
          .map((part) => (typeof part?.text === 'string' ? part.text : ''))
          .filter(Boolean)
          .join('');
      }
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('The AI provider returned an empty message.');
      }
      return {
        content,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s.`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function testProvider({ providerId, provider }) {
    const config = await readConfig();
    const existing = providerId ? config.providers.find((entry) => entry.id === providerId) ?? null : null;
    const draft = sanitizeProvider(provider, existing);
    try {
      const result = await callProvider(
        draft,
        [
          { role: 'system', content: 'You are a connection test. Reply with exactly: OK' },
          { role: 'user', content: 'Reply with OK.' },
        ],
        { timeoutMs: Math.min(config.requestTimeoutMs, 45_000), maxTokens: 10 },
      );
      return {
        ok: true,
        message: result.content.trim().slice(0, 120),
        latencyMs: result.latencyMs,
        model: draft.model,
      };
    } catch (error) {
      throw createAiError(
        `AI connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        502,
        'ai_test_failed',
      );
    }
  }

  async function generatePlans({ userId, images, prompt }) {
    const config = await assertQuota(userId);
    if (!Array.isArray(images) || images.length === 0) {
      throw createBadRequest('Select at least one photo.');
    }
    if (images.length > config.maxImages) {
      throw createBadRequest(`Select no more than ${config.maxImages} photos.`);
    }

    let totalChars = 0;
    const normalizedImages = images.map((image, index) => {
      const dataUrl = typeof image?.dataUrl === 'string' ? image.dataUrl : '';
      if (!/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(dataUrl)) {
        throw createBadRequest('Every AI image must be a JPEG, PNG, or WebP thumbnail.');
      }
      if (dataUrl.length > MAX_THUMBNAIL_CHARS) {
        throw createBadRequest('An AI thumbnail is too large.');
      }
      totalChars += dataUrl.length;
      return {
        index,
        name: typeof image?.name === 'string' ? image.name.slice(0, 120) : `Photo ${index + 1}`,
        width: Number.isFinite(image?.width) ? Math.round(image.width) : null,
        height: Number.isFinite(image?.height) ? Math.round(image.height) : null,
        dataUrl,
      };
    });
    if (totalChars > MAX_TOTAL_THUMBNAIL_CHARS) {
      throw createBadRequest('The selected photo thumbnails are too large for one AI request.');
    }

    const userPrompt = sanitizeText(prompt || config.prompt, 'AI prompt', 12000);
    const imageList = normalizedImages
      .map((image) => `${image.index}. ${image.name}${image.width && image.height ? ` (${image.width}×${image.height})` : ''}`)
      .join('\n');
    const messages = [
      { role: 'system', content: userPrompt },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `请分析以下 ${normalizedImages.length} 张照片并按要求返回 JSON。\n\n图片清单：\n${imageList}`,
          },
          ...normalizedImages.map((image) => ({
            type: 'image_url',
            image_url: { url: image.dataUrl },
          })),
        ],
      },
    ];

    const providers = [...config.providers]
      .filter((provider) => provider.enabled && provider.apiKey)
      .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
    if (!providers.length) {
      throw createAiError('No AI provider is configured yet.', 503, 'ai_not_configured');
    }

    const failures = [];
    const deadline = Date.now() + Math.max(30_000, Math.min(config.requestTimeoutMs, 90_000));
    const canRetry = (error) => {
      const message = error instanceof Error ? error.message : '';
      return /Timed out|HTTP (?:429|5\d\d)|fetch failed|ECONNRESET|ENOTFOUND|socket hang up|empty message|did not include any plans/i.test(message);
    };
    for (const provider of providers) {
      let lastError = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const remaining = deadline - Date.now();
        if (remaining < 5_000) {
          break;
        }
        try {
          const result = await callProvider(provider, messages, {
            timeoutMs: Math.min(config.requestTimeoutMs, remaining),
          });
          const parsed = extractJson(result.content);
          if (!parsed || !Array.isArray(parsed.plans) || parsed.plans.length === 0) {
            throw new Error('The AI response did not include any plans.');
          }
          await recordUsage(userId);
          return {
            ...parsed,
            providerName: provider.name,
            prompt: userPrompt,
          };
        } catch (error) {
          lastError = error;
          if (attempt > 0 || !canRetry(error) || deadline - Date.now() < 10_000) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
      }
      failures.push(`${provider.name}: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`);
    }

    throw createAiError(
      `All AI providers failed. ${failures.join(' | ').slice(0, 800)}`,
      502,
      'ai_all_providers_failed',
    );
  }

  return {
    ensureAiDirectory,
    generatePlans,
    getUserStatus,
    readAdminConfig,
    readUsageForAdmin,
    setUserUsage,
    testProvider,
    updateConfig,
  };
}
