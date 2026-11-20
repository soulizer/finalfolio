import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const STATE_TTL_MS = 10 * 60 * 1000;
const TOKEN_REFRESH_MARGIN_MS = 90 * 1000;
const DEFAULT_SCOPES = 'profile email photos.read';
const MAX_PHOTO_PAGE = 60;

function base64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest();
}

function sanitizeUrl(value, { allowEmpty = false } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    if (allowEmpty) {
      return '';
    }
    throw new Error('UnAlbum URL is not configured.');
  }
  const parsed = new URL(raw);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('UnAlbum URL must use http or https.');
  }
  return parsed.toString().replace(/\/+$/, '');
}

function readEnv(name) {
  return String(process.env[name] ?? '').trim();
}

/**
 * Reads the UnAlbum integration configuration once per call. The feature is
 * entirely opt-in: without a client id the whole surface stays hidden and every
 * endpoint answers "not configured" instead of failing halfway through a flow.
 */
export function readUnalbumConfig() {
  const baseUrl = readEnv('FINALFOLIO_UNALBUM_BASE_URL');
  const clientId = readEnv('FINALFOLIO_UNALBUM_CLIENT_ID');
  const clientSecret = readEnv('FINALFOLIO_UNALBUM_CLIENT_SECRET');
  const scopes = (readEnv('FINALFOLIO_UNALBUM_SCOPES') || DEFAULT_SCOPES)
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  const redirectUri = readEnv('FINALFOLIO_UNALBUM_REDIRECT_URI');
  const storageOrigins = (readEnv('FINALFOLIO_UNALBUM_STORAGE_ORIGINS') || '')
    .split(/[\s,]+/)
    .map((origin) => origin.trim())
    .filter(Boolean);

  let normalizedBase = '';
  try {
    normalizedBase = baseUrl ? sanitizeUrl(baseUrl) : '';
  } catch {
    normalizedBase = '';
  }

  return {
    baseUrl: normalizedBase,
    clientId,
    clientSecret,
    scopes,
    redirectUri,
    storageOrigins,
    configured: Boolean(normalizedBase && clientId),
  };
}

function normalizeTokenPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('UnAlbum returned an invalid token response.');
  }
  const accessToken = typeof payload.access_token === 'string' ? payload.access_token : '';
  if (!accessToken) {
    throw new Error('UnAlbum did not return an access token.');
  }
  const expiresIn = Number(payload.expires_in);
  return {
    accessToken,
    refreshToken: typeof payload.refresh_token === 'string' ? payload.refresh_token : null,
    scope: typeof payload.scope === 'string' ? payload.scope : null,
    tokenType: typeof payload.token_type === 'string' ? payload.token_type : 'Bearer',
    expiresAt:
      Number.isFinite(expiresIn) && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
  };
}

function sanitizeProfile(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('UnAlbum returned an invalid profile.');
  }
  const id = payload.id === undefined || payload.id === null ? '' : String(payload.id);
  if (!id) {
    throw new Error('UnAlbum profile has no account id.');
  }
  return {
    id,
    username: typeof payload.username === 'string' ? payload.username.slice(0, 64) : '',
    displayName:
      typeof payload.displayName === 'string'
        ? payload.displayName.slice(0, 120)
        : typeof payload.name === 'string'
          ? payload.name.slice(0, 120)
          : '',
    email: typeof payload.email === 'string' ? payload.email.slice(0, 200) : '',
    avatarUrl: typeof payload.avatarUrl === 'string' ? payload.avatarUrl.slice(0, 2048) : '',
  };
}

export function createUnalbumStore({ dataRoot, now = () => new Date().toISOString(), fetchImpl = fetch } = {}) {
  const stateDir = path.join(dataRoot, 'unalbum', 'states');
  const bindingDir = path.join(dataRoot, 'unalbum', 'bindings');

  async function ensureDirectories() {
    await fs.mkdir(stateDir, { recursive: true, mode: 0o700 });
    await fs.mkdir(bindingDir, { recursive: true, mode: 0o700 });
  }

  function statePath(state) {
    return path.join(stateDir, `${base64url(sha256(state))}.json`);
  }

  function bindingPath(userId) {
    return path.join(bindingDir, `${base64url(sha256(userId))}.json`);
  }

  async function writeJson(filename, value) {
    const tempFile = `${filename}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
    await fs.rename(tempFile, filename);
  }

  async function readJson(filename) {
    try {
      return JSON.parse(await fs.readFile(filename, 'utf8'));
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  function buildRedirectUri(publicOrigin) {
    const config = readUnalbumConfig();
    if (config.redirectUri) {
      return config.redirectUri;
    }
    return `${publicOrigin.replace(/\/+$/, '')}/api/unalbum/callback`;
  }

  async function readBinding(userId) {
    if (!userId) {
      return null;
    }
    const payload = await readJson(bindingPath(userId));
    if (!payload || typeof payload.accessToken !== 'string' || !payload.account?.id) {
      return null;
    }
    return payload;
  }

  async function writeBinding(userId, binding) {
    await ensureDirectories();
    const previous = await readBinding(userId);
    const timestamp = now();
    await writeJson(bindingPath(userId), {
      ...binding,
      boundAt: previous?.boundAt ?? timestamp,
      updatedAt: timestamp,
    });
  }

  async function deleteBinding(userId) {
    await fs.rm(bindingPath(userId), { force: true });
  }

  /**
   * Starts an OAuth 2.1 authorization-code flow with PKCE (S256). The state
   * record is single-use, expires in ten minutes, and carries the FinalFolio
   * user that started a *binding* flow so the callback never trusts a cookie
   * alone.
   */
  async function startAuthorization({ intent, userId = null, publicOrigin, returnTo = '' }) {
    const config = readUnalbumConfig();
    if (!config.configured) {
      throw Object.assign(new Error('UnAlbum is not configured.'), { statusCode: 503, code: 'unalbum_not_configured' });
    }

    const state = base64url(crypto.randomBytes(32));
    const verifier = base64url(crypto.randomBytes(48));
    const challenge = base64url(sha256(verifier));
    const redirectUri = buildRedirectUri(publicOrigin);

    await ensureDirectories();
    await writeJson(statePath(state), {
      intent,
      userId,
      verifier,
      redirectUri,
      returnTo: typeof returnTo === 'string' ? returnTo.slice(0, 500) : '',
      createdAt: now(),
      expiresAt: new Date(Date.now() + STATE_TTL_MS).toISOString(),
    });

    const authorizeUrl = new URL(`${config.baseUrl}/oauth/authorize`);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', config.clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('scope', config.scopes.join(' '));
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('code_challenge', challenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    return { authorizeUrl: authorizeUrl.toString(), state, redirectUri };
  }

  /** Returns the state record exactly once; expired or unknown states are rejected. */
  async function consumeState(state) {
    const value = typeof state === 'string' ? state.trim() : '';
    if (!value || value.length > 200) {
      return null;
    }
    const filename = statePath(value);
    const record = await readJson(filename);
    await fs.rm(filename, { force: true });
    if (!record) {
      return null;
    }
    const expiresAt = Date.parse(record.expiresAt ?? '') || 0;
    if (!expiresAt || expiresAt < Date.now()) {
      return null;
    }
    return record;
  }

  async function requestToken(params) {
    const config = readUnalbumConfig();
    const body = new URLSearchParams(params);
    if (config.clientSecret) {
      body.set('client_id', config.clientId);
      body.set('client_secret', config.clientSecret);
    } else {
      body.set('client_id', config.clientId);
    }
    const response = await fetchImpl(`${config.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`UnAlbum token exchange failed (${response.status}).${detail ? ` ${detail.slice(0, 200)}` : ''}`);
    }
    return normalizeTokenPayload(await response.json());
  }

  async function exchangeCode({ code, verifier, redirectUri }) {
    return requestToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });
  }

  async function refreshAccessToken(binding) {
    if (!binding?.refreshToken) {
      throw new Error('The UnAlbum authorization expired. Reconnect your account.');
    }
    const refreshed = await requestToken({
      grant_type: 'refresh_token',
      refresh_token: binding.refreshToken,
    });
    return {
      ...binding,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? binding.refreshToken,
      scope: refreshed.scope ?? binding.scope,
      expiresAt: refreshed.expiresAt,
    };
  }

  async function apiRequest(binding, pathname, { method = 'GET', searchParams } = {}) {
    const config = readUnalbumConfig();
    let current = binding;
    if (current.expiresAt) {
      const expiresAt = Date.parse(current.expiresAt) || 0;
      if (expiresAt && expiresAt - Date.now() < TOKEN_REFRESH_MARGIN_MS) {
        current = await refreshAccessToken(current);
      }
    }

    const url = new URL(`${config.baseUrl}${pathname}`);
    if (searchParams) {
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const send = async (token) => {
      const response = await fetchImpl(url.toString(), {
        method,
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
        signal: AbortSignal.timeout(25_000),
      });
      return response;
    };

    let response = await send(current.accessToken);
    if (response.status === 401 && current.refreshToken) {
      current = await refreshAccessToken(current);
      response = await send(current.accessToken);
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const error = new Error(`UnAlbum request failed (${response.status}).${detail ? ` ${detail.slice(0, 200)}` : ''}`);
      error.statusCode = response.status === 401 ? 401 : 502;
      throw error;
    }
    return { payload: await response.json(), binding: current };
  }

  async function fetchProfile(binding) {
    const { payload, binding: current } = await apiRequest(binding, '/api/v1/me');
    return { profile: sanitizeProfile(payload?.user ?? payload), binding: current };
  }

  function normalizePhoto(photo) {
    return {
      id: photo?.id === undefined || photo?.id === null ? '' : String(photo.id).slice(0, 120),
      filename: typeof photo?.filename === 'string' ? photo.filename.slice(0, 200) : '',
      name: typeof photo?.name === 'string' ? photo.name.slice(0, 200) : '',
      width: Number.isFinite(photo?.width) ? Math.round(photo.width) : null,
      height: Number.isFinite(photo?.height) ? Math.round(photo.height) : null,
      bytes: Number.isFinite(photo?.bytes) ? Math.round(photo.bytes) : null,
      createdAt: typeof photo?.createdAt === 'string' ? photo.createdAt : null,
      analysis: photo?.analysis && typeof photo.analysis === 'object' ? photo.analysis : null,
      variants: photo?.variants && typeof photo.variants === 'object' ? photo.variants : {},
    };
  }

  /** One photo with its variants and analysis, used by the import step. */
  async function getPhoto(binding, photoId) {
    const idPart = String(photoId ?? '').trim();
    if (!idPart || idPart.length > 120) {
      throw Object.assign(new Error('Unknown UnAlbum photo.'), { statusCode: 400 });
    }
    const { payload, binding: current } = await apiRequest(binding, `/api/v1/me/photos/${encodeURIComponent(idPart)}`);
    const photo = normalizePhoto(payload?.photo ?? payload);
    if (!photo.id) {
      throw Object.assign(new Error('Unknown UnAlbum photo.'), { statusCode: 404 });
    }
    return { photo, binding: current };
  }

  async function listPhotos(binding, { cursor = '', query = '', limit = MAX_PHOTO_PAGE } = {}) {
    const boundedLimit = Math.max(1, Math.min(MAX_PHOTO_PAGE, Number(limit) || MAX_PHOTO_PAGE));
    const { payload, binding: current } = await apiRequest(binding, '/api/v1/me/photos', {
      searchParams: { limit: boundedLimit, cursor, q: query },
    });
    const photos = Array.isArray(payload?.photos) ? payload.photos : [];
    return {
      binding: current,
      photos: photos.map(normalizePhoto).filter((photo) => photo.id),
      nextCursor: typeof payload?.nextCursor === 'string' && payload.nextCursor ? payload.nextCursor : null,
    };
  }

  return {
    config: readUnalbumConfig,
    readBinding,
    writeBinding,
    deleteBinding,
    startAuthorization,
    consumeState,
    exchangeCode,
    refreshAccessToken,
    fetchProfile,
    listPhotos,
    getPhoto,
  };
}
