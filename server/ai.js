import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createBadRequest } from './lib/httpErrors.js';
import { sanitizeAssetAnalysis } from './lib/assetAnalysis.js';

const AI_CONFIG_VERSION = 1;
const MAX_PROVIDERS = 20;
const MAX_IMAGES = 50;
const MAX_THUMBNAIL_CHARS = 160_000;
const MAX_TOTAL_THUMBNAIL_CHARS = 4_000_000;
// Streaming budgets. A healthy generation streams tokens continuously, so a
// single wall-clock timeout cannot tell "still working" from "connection
// dead". Separate budgets can:
//  - first content: request start until the first token arrives. Providers
//    that ignore `stream` only send headers with the finished body, so this
//    budget must cover a whole buffered generation (observed healthy runs
//    finish in 50-82s), not just a TCP connect.
//  - idle: max gap between tokens once streaming has started.
const AI_FIRST_CONTENT_TIMEOUT_MS = 90_000;
const AI_IDLE_TIMEOUT_MS = 60_000;
// If a provider is still running past every healthy latency in the stats,
// start the next one in parallel instead of waiting out its full timeout.
const AI_SLOW_PROVIDER_HEDGE_MS = 100_000;
// Hard ceiling for one whole generation (client polls for 5 minutes).
const AI_TOTAL_BUDGET_MS = 280_000;
const AI_PAGE_TEMPLATES = new Set(['cover', 'essay', 'folio', 'grid', 'diptych', 'panorama', 'mosaic', 'triptych']);
const AI_PAGE_THEMES = new Set([
  'warm-beige', 'butter-cream', 'pale-blue', 'sea-glass', 'pure-white',
  'light-gray', 'sandstone', 'sage-mist', 'dusty-rose', 'pearl-blush',
]);

export const DEFAULT_AI_PROMPT = `你是一位资深摄影画册编辑与图片编辑。你会收到一组照片缩略图（按上传顺序编号，从 0 开始）以及每张照片的名称和尺寸。请分析照片的内容、主次关系、色调、横竖构图和叙事节奏，并设计 3 套完整、可执行的画册方案。

输出必须是严格 JSON，不要 Markdown，不要解释文字。JSON 结构：
{
  "folioTitle": "作品集标题",
  "folioSubtitle": "一句副标题",
  "issue": "作品集标识：4-10字，取自作品主题或系列名，例如「山影 · 春」「夜行笔记」；不要用 AI 01 这类编号",
  "frameRadius": 14,
  "plans": [
    {
      "id": "editorial",
      "name": "方案名称（4-8个汉字）",
      "style": "一句话风格说明",
      "summary": "30-60字，说明为什么这样编排",
      "folioTitle": "这套方案自己的作品集标题",
      "folioSubtitle": "这套方案自己的一句副标题",
      "issue": "这套方案自己的作品集标识：4-10字，来自作品主题，例如「雾中路径」",
      "frameRadius": 14,
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
2. 每套方案必须是偶数页：4 或 6 页；第一页用 cover 或 folio 开场，最后一页安静收束。
3. 页数必须是偶数，方便双页翻页；不要输出奇数页方案。
4. 每个页面只使用上面列出的 template。每个 template 的图片数量必须匹配：
   cover=1, essay=1, folio=1, grid=4, diptych=2, panorama=2, mosaic=3, triptych=3。
5. assetIndexes 使用上传顺序的编号，不能越界；尽量让每张照片至少出现一次，但不要为了用完而重复堆砌。
6. 主图放在 cover、folio、mosaic 的 lead 或大幅页面；次图、细节图放在 grid、diptych、triptych、panorama。
7. 每页只填写该版式需要的文字；没有导语或正文时用空字符串。文字使用中文，简洁、有编辑感，不要空泛营销语。每一页的 title 必须是针对该页照片、版式和叙事位置写的具体短标题，不能为空，也不能复用模板默认句（例如「构建内页节奏」「给一张图整页」）。
8. theme 必须从列表中选择，同一套方案可以有 1-3 个主色，不要每页都换色。
9. frameRadius 为 0-24 的整数，整套方案统一。
10. 每套方案都要给出自己的 folioTitle、folioSubtitle、issue、frameRadius，三者要互相契合；切换方案时作品集标识也应随之变化。
11. 不要输出任何 JSON 之外的字符。`;

/**
 * Structural knowledge appended to every generation prompt in code, so a saved
 * admin prompt written before this guide existed still gets accurate layout and
 * capacity constraints.
 */
export const AI_LAYOUT_GUIDE = `【版式与容量手册】（文字按中文字符计；英文可按 1.6 倍；超长会破坏版面，必须遵守）
【标题硬性要求】每一页都必须有具体 title；即使该版式不用导语/正文，也必须写标题。禁止空标题，禁止把模板说明当标题（如「构建内页节奏」「使用双图页」），禁止多页复用同一句。
- cover（1 图，封面开场）：标题 ≤12，导语 ≤34，图注 ≤26；不用引题和正文。
- essay（1 图，图文页）：引题 ≤12，标题 ≤16，导语 ≤46，正文 ≤150，图注 ≤30。
- folio（1 图，整幅主图）：引题 ≤12，标题 ≤16，导语 ≤40，图注 ≤28；不用正文。
- grid（4 图，四格节奏）：引题 ≤10，标题 ≤14，正文 ≤90，图注 ≤22；不用导语。
- diptych（2 图，对页）：引题 ≤12，标题 ≤16，导语 ≤40，正文 ≤80，图注 ≤22。
- panorama（2 图，上下宽幅）：引题 ≤12，标题 ≤16，导语 ≤40，图注 ≤22；不用正文。
- mosaic（3 图，主图+两细节）：引题 ≤10，标题 ≤14，导语 ≤34，正文 ≤70，图注 ≤22。
- triptych（3 图，三联）：引题 ≤10，标题 ≤16，导语 ≤40，正文 ≤80，图注 ≤22。
某一页不使用某字段时，请输出空字符串，不要省略键。

【作品集标识】每套方案必须自带 folioTitle、folioSubtitle、issue、frameRadius；如果顶层也提供了同名键，以方案内的为准。
- issue 是作品集标识，必须来自作品内容（主题词、系列名、地点或时间），4-10 个字，例如「山影 · 春」「夜行笔记」「城南 · 2024」。
- 严禁输出「AI 01」「AI 02」「方案一」这类与作品无关的编号。三套方案的标识都应不同且各自贴合其内容。

【全局职责】
1. 你负责整本作品集，而不只是照片顺序：同时决定 folioTitle、folioSubtitle、issue、frameRadius，以及每页版式、纸色、文字与图片分配。
2. 首页必须是能独立成立的开始（cover 或 folio），建立主题与第一眼视觉重心；尾页必须安静收束（folio 或 diptych），不引入新论点、不堆文字。
3. 节奏要有起承转合：开场 → 展开/对比 → 细节 → 收束；同一种版式不要连续超过两页。
4. 每张照片最多出现 2 次；重要照片可跨页重复形成母题，不要为用满而堆砌。
5. 3 套方案要在结构、节奏与文字语气上明显不同，而不是只换纸色。
6. 所有文字必须能放进对应版式并留有余量；宁可短，不要顶满边界。
7. 必须使用全部选中照片：每一张照片至少出现一次（最多两次）。不要遗漏编号。`;

const DEFAULT_AI_CONFIG = {
  enabled: false,
  userTotalLimit: 10,
  dailyLimit: 3,
  maxImages: MAX_IMAGES,
  requestTimeoutMs: 180_000,
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

const IMAGE_ANALYSIS_DESCRIPTION_LIMIT = 800;
const IMAGE_ANALYSIS_TAGS_LIMIT = 24;

/**
 * Existing AI analysis (from UnAlbum, or a previous import) is trusted input
 * for the planner prompt, so it is normalised and bounded before it reaches
 * the provider: no markup, no unbounded tags, no empty shell objects.
 */
function sanitizeImageAnalysis(value) {
  return sanitizeAssetAnalysis(value, {
    descriptionLimit: IMAGE_ANALYSIS_DESCRIPTION_LIMIT,
    tagsLimit: IMAGE_ANALYSIS_TAGS_LIMIT,
    tagLength: 40,
  });
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

/**
 * Structural check for a generated bundle. Anything that would silently drop
 * pages or plans in the client normalizer is treated as an invalid answer and
 * sent back to the same provider for one corrected retry.
 * Returns null when valid, otherwise { reason, detail } where `reason` is the
 * user-facing (localizable) English text and `detail` is what the model sees.
 */
function validatePlanBundle(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { reason: 'The AI provider did not return valid JSON.', detail: '回复不是 JSON 对象。' };
  }
  const plans = Array.isArray(parsed.plans) ? parsed.plans : [];
  if (!plans.length) {
    return { reason: 'The AI response did not include any plans.', detail: '缺少 plans 数组或 plans 为空。' };
  }
  try {
  plans.forEach((plan, planIndex) => {
    const pages = Array.isArray(plan?.pages) ? plan.pages : [];
    if (!pages.length) {
      throw new PlanValidationError(
        `Plan ${planIndex + 1} had no usable pages.`,
        `第 ${planIndex + 1} 套方案没有 pages 页面数组。`,
      );
    }
    pages.forEach((page, pageIndex) => {
      const template = typeof page?.template === 'string' ? page.template.toLowerCase() : '';
      if (!AI_PAGE_TEMPLATES.has(template)) {
        throw new PlanValidationError(
          `Plan ${planIndex + 1} used an unknown page template: ${String(page?.template ?? '').slice(0, 20)}.`,
          `第 ${planIndex + 1} 套方案第 ${pageIndex + 1} 页的 template「${String(page?.template ?? '').slice(0, 20)}」不在允许列表 cover|essay|folio|grid|diptych|panorama|mosaic|triptych 内。`,
        );
      }
      const title = typeof page?.title === 'string' ? page.title.trim() : '';
      if (!title) {
        throw new PlanValidationError(
          `Plan ${planIndex + 1} page ${pageIndex + 1} had no specific title.`,
          `第 ${planIndex + 1} 套方案第 ${pageIndex + 1} 页缺少具体标题。每一页都必须写贴合该页内容的 title，不能为空或复用模板默认句。`,
        );
      }
      const theme = typeof page?.theme === 'string' ? page.theme.toLowerCase() : '';
      if (theme && !AI_PAGE_THEMES.has(theme)) {
        throw new PlanValidationError(
          `Plan ${planIndex + 1} used an unknown page colour: ${theme.slice(0, 20)}.`,
          `第 ${planIndex + 1} 套方案第 ${pageIndex + 1} 页的 theme「${theme.slice(0, 20)}」不在允许的纸色列表内。`,
        );
      }
      if (!Array.isArray(page.assetIndexes)) {
        throw new PlanValidationError(
          `Plan ${planIndex + 1} had a page without photo references.`,
          `第 ${planIndex + 1} 套方案第 ${pageIndex + 1} 页缺少 assetIndexes 数组。`,
        );
      }
    });
  });
  } catch (error) {
    if (error instanceof PlanValidationError) {
      return { reason: error.reason, detail: error.detail };
    }
    throw error;
  }
  return null;
}

class PlanValidationError extends Error {
  constructor(reason, detail) {
    super(reason);
    this.reason = reason;
    this.detail = detail;
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
  const providerStatsFile = path.join(aiDir, 'provider-stats.json');
  let usageQueue = Promise.resolve();

  async function ensureAiDirectory() {
    await fs.mkdir(aiDir, { recursive: true, mode: 0o700 });
    await fs.chmod(aiDir, 0o700);
  }

function providerScore(stats) {
  if (!stats) {
    // Never measured: neutral, so measured-fast providers go first and
    // measured-failing ones go last.
    return 60_000;
  }
  if (stats.successes > 0) {
    const average = stats.totalLatencyMs / stats.successes;
    // A provider whose last attempt failed goes behind a healthy one with a
    // similar latency; one success restores it to the front.
    return average + (stats.lastOk === false ? 30_000 : 0);
  }
  if (stats.failures > 0) {
    return 120_000;
  }
  return 60_000;
}

async function readProviderStats() {
  await ensureAiDirectory();
  const parsed = await readJsonFile(providerStatsFile, { providers: {} });
  return parsed && typeof parsed === 'object' ? parsed : { providers: {} };
}

async function recordProviderStat(providerId, { latencyMs = null, ok, corrected = false }) {
  if (!providerId) {
    return;
  }
  const stats = await readProviderStats();
  const providers = stats.providers ?? {};
  const entry = providers[providerId] ?? { successes: 0, failures: 0, totalLatencyMs: 0, corrections: 0 };
  if (ok) {
    entry.successes += 1;
    if (corrected) {
      entry.corrections = (entry.corrections ?? 0) + 1;
    }
    if (typeof latencyMs === 'number' && Number.isFinite(latencyMs)) {
      entry.totalLatencyMs += latencyMs;
      entry.lastLatencyMs = latencyMs;
    }
  } else {
    entry.failures += 1;
  }
  entry.lastOk = ok;
  entry.updatedAt = new Date().toISOString();
  providers[providerId] = entry;
  stats.providers = providers;
  await writeJsonFile(providerStatsFile, stats);
}

async function selectProviders(config) {
  const stats = await readProviderStats().catch(() => ({ providers: {} }));
  const known = stats.providers ?? {};
  return [...config.providers]
    .filter((provider) => provider.enabled && provider.apiKey)
    .map((provider) => {
      const entry = known[provider.id];
      const avgLatencyMs =
        entry && entry.successes > 0 ? entry.totalLatencyMs / entry.successes : null;
      return { provider, score: providerScore(entry), avgLatencyMs };
    })
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.provider.order - b.provider.order ||
        a.provider.createdAt.localeCompare(b.provider.createdAt),
    );
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

async function callProvider(provider, messages, { timeoutMs = AI_TOTAL_BUDGET_MS, maxTokens = 8000, signal: externalSignal } = {}) {
  const controller = new AbortController();
  const startedAt = Date.now();
  const budgetMs = Math.max(15_000, timeoutMs);
  const firstContentMs = Math.min(AI_FIRST_CONTENT_TIMEOUT_MS, budgetMs);
  let phase = 'connecting';
  let receivedContent = false;
  let lastActivityAt = startedAt;
  let abortCause = null;

  const abortWith = (cause) => {
    abortCause = cause;
    controller.abort();
  };
  const hardStop = setTimeout(() => abortWith('budget'), budgetMs);
  const stallCheck = setInterval(() => {
    const idleFor = Date.now() - lastActivityAt;
    if (receivedContent ? idleFor > AI_IDLE_TIMEOUT_MS : idleFor > firstContentMs) {
      abortWith(receivedContent ? 'idle' : 'first-content');
    }
  }, 1_000);
  const forwardAbort = () => abortWith('caller');
  if (externalSignal) {
    if (externalSignal.aborted) {
      abortWith('caller');
    } else {
      externalSignal.addEventListener('abort', forwardAbort, { once: true });
    }
  }

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
        stream: true,
      }),
      signal: controller.signal,
    });
    phase = 'receiving';
    lastActivityAt = Date.now();
    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(`HTTP ${response.status}: ${bodyText.slice(0, 300)}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      // Provider ignored `stream` and answered in one shot.
      const bodyText = await response.text();
      lastActivityAt = Date.now();
      const content = readChatContent(JSON.parse(bodyText));
      if (!content.trim()) {
        throw new Error('The AI provider returned an empty message.');
      }
      return { content, latencyMs: Date.now() - startedAt };
    }
    if (!response.body) {
      throw new Error('The AI provider returned an empty response.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let raw = '';
    let content = '';
    let finishReason = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      lastActivityAt = Date.now();
      receivedContent = true;
      const piece = decoder.decode(value, { stream: true });
      raw += piece;
      buffer += piece;
      let newlineAt = buffer.indexOf('\n');
      while (newlineAt >= 0) {
        const line = buffer.slice(0, newlineAt).trim();
        buffer = buffer.slice(newlineAt + 1);
        newlineAt = buffer.indexOf('\n');
        if (!line || line.startsWith(':') || !line.startsWith('data:')) {
          continue;
        }
        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          buffer = '';
          break;
        }
        let chunk;
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }
        const choice = chunk?.choices?.[0];
        if (typeof choice?.delta?.content === 'string') {
          content += choice.delta.content;
        }
        if (typeof choice?.message?.content === 'string' && !content) {
          content = choice.message.content;
        }
        if (choice?.finish_reason) {
          finishReason = choice.finish_reason;
        }
      }
    }
    if (!content.trim()) {
      // Some relays label the stream as text/event-stream but write a plain
      // JSON body; recover it before giving up on the answer.
      const recovered = recoverChatContent(raw);
      content = recovered ?? '';
    }
    if (!content.trim()) {
      throw new Error(
        finishReason === 'length'
          ? `The provider stopped at the ${maxTokens} token limit before finishing the JSON.`
          : 'The AI provider returned an empty message.',
      );
    }
    return { content, latencyMs: Date.now() - startedAt };
  } catch (error) {
    if (error?.name === 'AbortError') {
      if (abortCause === 'caller') {
        throw error;
      }
      if (abortCause === 'first-content') {
        throw new Error(
          phase === 'receiving'
            ? `The provider accepted the request but sent no content for ${Math.round(firstContentMs / 1000)}s.`
            : `Timed out after ${Math.round(firstContentMs / 1000)}s.`,
        );
      }
      if (abortCause === 'idle') {
        throw new Error(`The provider stopped sending for ${Math.round(AI_IDLE_TIMEOUT_MS / 1000)}s.`);
      }
      throw new Error(`The provider did not finish within ${Math.round(budgetMs / 1000)}s.`);
    }
    throw error;
  } finally {
    clearTimeout(hardStop);
    clearInterval(stallCheck);
    externalSignal?.removeEventListener('abort', forwardAbort);
  }
}

/** Pull the assistant text out of a non-streaming chat completion payload. */
function readChatContent(payload) {
  const choice = payload?.choices?.[0];
  if (typeof choice?.message?.content === 'string') {
    return choice.message.content;
  }
  if (typeof payload?.content === 'string') {
    return payload.content;
  }
  return '';
}

/** Last-resort parse for providers that answer `stream` with a JSON body. */
function recoverChatContent(raw) {
  const value = String(raw ?? '').trim();
  if (!value || !value.includes('{')) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    const content = readChatContent(parsed);
    return content.trim() ? content : null;
  } catch {
    const start = value.indexOf('{');
    const end = value.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const content = readChatContent(JSON.parse(value.slice(start, end + 1)));
        return content.trim() ? content : null;
      } catch {
        return null;
      }
    }
    return null;
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
      await recordProviderStat(draft.id, { latencyMs: result.latencyMs, ok: true });
      return {
        ok: true,
        message: result.content.trim().slice(0, 120),
        latencyMs: result.latencyMs,
        model: draft.model,
      };
    } catch (error) {
      await recordProviderStat(draft.id, { ok: false }).catch(() => {});
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
      // Photos that already carry AI analysis (for example an UnAlbum import)
      // are described in text instead of being re-uploaded as pixels: the
      // request gets smaller, faster and cheaper without losing information.
      const analysis = sanitizeImageAnalysis(image?.analysis);
      const dataUrl = analysis ? '' : typeof image?.dataUrl === 'string' ? image.dataUrl : '';
      if (!analysis && !/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(dataUrl)) {
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
        analysis,
      };
    });
    if (totalChars > MAX_TOTAL_THUMBNAIL_CHARS) {
      throw createBadRequest('The selected photo thumbnails are too large for one AI request.');
    }

    const userPrompt = sanitizeText(prompt || config.prompt, 'AI prompt', 12000);
    const imageList = normalizedImages
      .map((image) => {
        const dimensions = image.width && image.height ? ` (${image.width}×${image.height})` : '';
        if (!image.analysis) {
          return `${image.index}. ${image.name}${dimensions} — 附缩略图`;
        }
        const parts = [`${image.index}. ${image.name}${dimensions} — 已有分析`];
        if (image.analysis.description) {
          parts.push(`描述：${image.analysis.description}`);
        }
        if (image.analysis.tags.length) {
          parts.push(`标签：${image.analysis.tags.join('、')}`);
        }
        return parts.join('；');
      })
      .join('\n');
    const attachedImages = normalizedImages.filter((image) => image.dataUrl);
    const analyzedCount = normalizedImages.length - attachedImages.length;
    const listIntro = analyzedCount
      ? `请根据以下 ${normalizedImages.length} 张照片设计画册。其中 ${attachedImages.length} 张附有缩略图，${analyzedCount} 张只有既有的图片分析文字（已由原相册完成分析，直接采信，不要重新分析）。`
      : `请分析以下 ${normalizedImages.length} 张照片并按要求返回 JSON。`;
    const messages = [
      { role: 'system', content: `${userPrompt}\n\n${AI_LAYOUT_GUIDE}` },
      {
        role: 'user',
        content: [
          { type: 'text', text: `${listIntro}\n\n图片清单：\n${imageList}` },
          ...attachedImages.map((image) => ({
            type: 'image_url',
            image_url: { url: image.dataUrl },
          })),
        ],
      },
    ];

    // Try the providers that have answered fastest first. The admin connection
    // tests and earlier generations both feed this ordering, so a slow relay
    // sinks to the back instead of blocking the pool.
    const providers = await selectProviders(config);
    if (!providers.length) {
      throw createAiError('No AI provider is configured yet.', 503, 'ai_not_configured');
    }

    const failures = [];
    // Hedged race: the next provider starts on a timer (or immediately when the
    // previous one fails); the first complete answer wins and the rest abort.
    // One wall-clock budget bounds the whole generation (the client polls for
    // five minutes); inside it every provider streams with its own stall
    // budgets, so "still generating" is never mistaken for "connection dead".
    const totalBudgetMs = Math.max(
      60_000,
      Math.min(config.requestTimeoutMs || AI_TOTAL_BUDGET_MS, AI_TOTAL_BUDGET_MS),
    );
    const hedgeMs = Math.max(30_000, Math.min(AI_SLOW_PROVIDER_HEDGE_MS, Math.floor(totalBudgetMs / 2)));
    const deadlineAt = Date.now() + totalBudgetMs;
    const remainingBudgetMs = () => Math.max(15_000, deadlineAt - Date.now());

    // One self-correction round: a transport-level success with an unusable
    // answer (bad JSON, no plans, unknown template) is worth one short retry
    // against the same provider with the error and its own answer attached,
    // instead of throwing away a generation that already cost 60-90 seconds.
    const attemptAnswer = async (provider, result, providerController) => {
      let parsed = null;
      let invalid = null;
      try {
        parsed = extractJson(result.content);
      } catch (error) {
        invalid = {
          reason: error instanceof Error ? error.message : 'The AI provider did not return valid JSON.',
          detail: '回复不是合法 JSON，可能被截断或混入了解释文字。',
        };
      }
      if (!invalid) {
        invalid = validatePlanBundle(parsed);
      }
      let corrected = false;
      if (invalid) {
        const fixed = await callProvider(
          provider,
          [
            ...messages,
            { role: 'assistant', content: result.content.slice(0, 8_000) },
            {
              role: 'user',
              content:
                `你上一条回复无法使用：${invalid.detail}\n` +
                '请重新输出一份完整、严格符合系统要求的 JSON：必须包含非空 plans 数组，' +
                '每页 template 只能在 cover|essay|folio|grid|diptych|panorama|mosaic|triptych 中选择，' +
                'theme 只能使用给定纸色，assetIndexes 必须是数组。只输出 JSON 本身，不要 Markdown，不要解释。',
            },
          ],
          { timeoutMs: remainingBudgetMs(), maxTokens: 32_000, signal: providerController.signal },
        );
        parsed = extractJson(fixed.content);
        const stillInvalid = validatePlanBundle(parsed);
        if (stillInvalid) {
          throw new Error(stillInvalid.reason);
        }
        corrected = true;
      }
      await recordProviderStat(provider.id, {
        latencyMs: result.latencyMs,
        ok: true,
        corrected,
      }).catch(() => null);
      return { provider, parsed };
    };

    const winner = await new Promise((resolve) => {
      let settled = false;
      let nextToStart = 0;
      let finishedCount = 0;
      const controllers = [];
      const timers = [];
      const finish = (value) => {
        if (settled) {
          return;
        }
        settled = true;
        timers.forEach((timer) => clearTimeout(timer));
        controllers.forEach((controller) => controller.abort());
        resolve(value);
      };
      const launchNext = () => {
        if (settled || nextToStart >= providers.length) {
          return;
        }
        const index = nextToStart;
        nextToStart += 1;
        const { provider } = providers[index];
        const controller = new AbortController();
        controllers.push(controller);
        callProvider(provider, messages, {
          timeoutMs: remainingBudgetMs(),
          maxTokens: 32_000,
          signal: controller.signal,
        })
          .then((result) => attemptAnswer(provider, result, controller))
          .then((value) => finish(value))
          .catch(async (error) => {
            finishedCount += 1;
            if (!settled && !controller.signal.aborted) {
              await recordProviderStat(provider.id, { ok: false }).catch(() => null);
              failures.push(
                `${provider.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              );
            }
            if (settled) {
              return;
            }
            if (finishedCount >= providers.length) {
              finish(null);
              return;
            }
            launchNext();
          });
      };
      launchNext();
      // Slow-provider hedge: past the fastest healthy latency in the stats the
      // next interface runs in parallel rather than waiting out a stall.
      providers.forEach((_provider, index) => {
        if (index === 0) {
          return;
        }
        timers.push(
          setTimeout(() => {
            if (nextToStart <= index) {
              nextToStart = index;
              launchNext();
            }
          }, Math.min(index * hedgeMs, Math.max(hedgeMs, totalBudgetMs - 45_000))),
        );
      });
      timers.push(setTimeout(() => finish(null), totalBudgetMs));
    });

    if (winner) {
      await recordUsage(userId);
      return {
        ...winner.parsed,
        providerName: winner.provider.name,
        prompt: userPrompt,
      };
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
