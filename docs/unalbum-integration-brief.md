# UnAlbum × FinalFolio integration brief

Status: FinalFolio side is implemented and shipped behind configuration. UnAlbum
needs to expose the small API described here; everything below is what to hand
to UnAlbum's engineering/AI.

## 1. What we verified about UnAlbum today

We have read-only S3 credentials for the `unalbum` bucket
(`https://s3.bitiful.net`, region `cn-east-1`) and confirmed:

- Originals live at `photos/<userId>/<storageName>`, for example
  `photos/1/cc39c676321df43c-P1216392.jpg` (~4 MB).
- Thumbnails live in a **flat** prefix at
  `thumbnails/<storageName-without-extension>.webp`, for example
  `thumbnails/cc39c676321df43c-P1216392.webp` (~98 KB).
- Other prefixes: `avatars/`, `backgrounds/`, `watermarks/`,
  `watermark-assets/`, `watermark-staging/`, `watermark-system/`,
  `contest-entries/`, `tmp-font-measure/`.
- There are **no JSON sidecars** in the bucket. AI descriptions/tags therefore
  live in UnAlbum's database, not in object storage.
- `https://storage.unalbum.com/<key>` serves the objects publicly (we fetched
  both the original and the thumbnail with HTTP 200).

Consequences:

1. FinalFolio can read photo bytes directly, but **cannot verify ownership** of
   `photos/<userId>/` from the bucket alone (a numeric id is not a credential),
   so the account link still needs an authorization grant from UnAlbum.
2. The AI tags/description need an API; they cannot be discovered from storage.

## 2. What FinalFolio already implements

All of this is live in `server/unalbum.js`, `server/app.js` and the editor UI,
and stays hidden until configured:

| FinalFolio endpoint | Purpose |
| --- | --- |
| `GET /api/unalbum/status` | `{ configured, bound, account }` for the signed-in user (no auth required) |
| `POST /api/unalbum/authorize` | Starts the account **binding** flow, returns `{ authorizeUrl }` |
| `POST /api/unalbum/login` | Starts **"Sign in with UnAlbum"**, returns `{ authorizeUrl }` |
| `GET /api/unalbum/callback` | OAuth redirect target: exchanges the code, binds or signs in, then redirects to the app |
| `POST /api/unalbum/unbind` | Revokes the local link (already-imported photos stay) |
| `GET /api/unalbum/photos?cursor=&q=` | Proxies `/api/v1/me/photos` for the picker |
| `POST /api/unalbum/import` `{ ids: string[] }` | Downloads variants server-side, stores FinalFolio assets with the upstream `analysis` attached |

Configuration (server environment):

```
FINALFOLIO_UNALBUM_BASE_URL=https://unalbum.com
FINALFOLIO_UNALBUM_CLIENT_ID=<client id issued by UnAlbum>
FINALFOLIO_UNALBUM_CLIENT_SECRET=<optional; omit for a public PKCE client>
FINALFOLIO_UNALBUM_SCOPES=profile email photos.read
# optional, defaults to ${publicOrigin}/api/unalbum/callback
FINALFOLIO_UNALBUM_REDIRECT_URI=https://finalfolio.com/api/unalbum/callback
# optional extra origins allowed to serve previews/originals
FINALFOLIO_UNALBUM_STORAGE_ORIGINS=https://storage.unalbum.com
```

Already implemented on the FinalFolio side: OAuth 2.1 authorization-code flow
with PKCE S256, single-use `state` (10 min TTL, hashed on disk), token refresh
with a 90 s margin, per-user binding records under `data/unalbum/bindings/`,
account creation from UnAlbum email (random local password, email marked
verified, normal Terms-of-Service gate still applies), photo picker in the
gallery ("从 UnAlbum 添加"), the same picker in the AI arrangement dialog
("使用 UnAlbum 作品", placed before local upload / URL import), account-page
binding with disconnect, and server-side import that keeps Upstream AI tags so
the planner is not charged for re-analysing the same pixels.

## 3. What UnAlbum must add

### 3.1 OAuth 2.1 (authorization code + PKCE)

- `GET /oauth/authorize`
  - Query: `response_type=code`, `client_id`, `redirect_uri`, `scope`,
    `state`, `code_challenge`, `code_challenge_method=S256`.
  - Requires the user to be signed in to UnAlbum; show a consent screen that
    names FinalFolio and the requested scopes.
  - Redirects to `redirect_uri` with `?code=<code>&state=<state>`; on denial
    `?error=access_denied&state=<state>`.
  - `redirect_uri` must match a pre-registered value **exactly**.

- `POST /oauth/token` (`application/x-www-form-urlencoded`)
  - `grant_type=authorization_code`: `code`, `redirect_uri`, `code_verifier`,
    `client_id`, optional `client_secret`.
  - `grant_type=refresh_token`: `refresh_token`, `client_id`, optional
    `client_secret`.
  - Success (200):
    ```json
    {
      "access_token": "…",
      "token_type": "Bearer",
      "expires_in": 3600,
      "refresh_token": "…",
      "scope": "profile email photos.read"
    }
    ```
  - Rotate `refresh_token` on every refresh and invalidate the old one.
  - Errors use HTTP 400 with `{ "error": "invalid_grant" }` (OAuth error codes).

- `POST /oauth/revoke` (recommended): accepts `token` (access or refresh) and
  returns 200 so FinalFolio can revoke when a user disconnects.

- Scopes: `profile`, `email`, `photos.read` (minimum). A user may grant fewer —
  FinalFolio re-checks what came back.

### 3.2 Profile

`GET /api/v1/me` with `Authorization: Bearer <access_token>`

```json
{
  "user": {
    "id": "42",
    "username": "lumen",
    "displayName": "Lumen Studio",
    "email": "lumen@example.com",
    "avatarUrl": "https://storage.unalbum.com/avatars/42/....jpg"
  }
}
```

- `email` is required for "通过 UnAlbum 登录" (FinalFolio matches or creates the
  account by email). Without it, binding still works but sign-in is rejected.
- `id` must be stable and URL-safe (the same value used in `photos/<id>/` is
  ideal).

### 3.3 Photos

`GET /api/v1/me/photos?limit=60&cursor=<opaque>&q=<search>`

```json
{
  "photos": [
    {
      "id": "photo-1234",
      "filename": "cc39c676321df43c-P1216392.jpg",
      "name": "清晨的山谷",
      "width": 6000,
      "height": 4000,
      "bytes": 4060812,
      "createdAt": "2026-11-18T09:41:03.000Z",
      "storage": { "key": "photos/42/cc39c676321df43c-P1216392.jpg" },
      "analysis": {
        "status": "ready",
        "description": "晨雾中的山谷，远处有一排松树，色调偏冷。",
        "tags": ["山谷", "晨雾", "松树", "冷色调"],
        "source": "unalbum",
        "analyzedAt": "2026-11-18T09:46:20.000Z",
        "model": "…"
      },
      "variants": {
        "original": {
          "url": "https://storage.unalbum.com/photos/42/cc39c676321df43c-P1216392.jpg",
          "width": 6000, "height": 4000, "bytes": 4060812, "mimeType": "image/jpeg"
        },
        "preview": {
          "url": "https://storage.unalbum.com/previews/….webp",
          "width": 2048, "height": 1365, "bytes": 320000, "mimeType": "image/webp"
        },
        "thumb": {
          "url": "https://storage.unalbum.com/thumbnails/cc39c676321df43c-P1216392.webp",
          "width": 480, "height": 320, "bytes": 97834, "mimeType": "image/webp"
        }
      }
    }
  ],
  "nextCursor": "eyJvZmZzZXQiOjYwfQ=="
}
```

- Only photos owned by the authenticated user. Never accept a user id parameter.
- `limit` default 30, max 100; `cursor` opaque; `nextCursor: null` at the end.
- `q` is optional and should match name/filename/tags/description.
- `analysis` may be `null` or `{ "status": "pending" }` immediately after an
  upload. UnAlbum analyses asynchronously, so the field must appear **without**
  the user re-uploading anything: FinalFolio simply re-reads the list later.
  Recommended statuses: `pending`, `ready`, `failed`.
- `tags` is an array of short strings; `description` is one paragraph (≤ 800
  characters). Extra fields are ignored, so `model`/`confidence` are welcome.
- `variants.thumb.url` must be loadable by a browser `<img>` (public or
  time-limited signed URL, ≥ 1 hour). It is used only for previews.
- `variants.original.url` / `preview.url` are fetched **server-side** by
  FinalFolio with the bearer token when the host is the API origin, or without
  the token for `storage.unalbum.com` (allow-listed). Either public or signed
  URLs are fine. Keep originals ≤ 20 MB.
- A single-photo endpoint is required for import:
  `GET /api/v1/me/photos/{id}` → `{ "photo": { …same shape… } }`.
  FinalFolio calls it right before downloading, so tags that had been pending
  can be picked up at import time.

### 3.4 Errors, limits, headers

- JSON errors: `{ "error": { "code": "invalid_token", "message": "…" } }`.
- 401 for a missing/expired token (include `WWW-Authenticate: Bearer`), 403 for
  insufficient scope, 404 for an unknown/foreign photo id, 429 with
  `Retry-After` when throttled.
- Suggested limits: 60 requests/minute per token for `/me/photos`, 10 imports
  per minute is enough for FinalFolio (it imports at most 30 photos per call).
- CORS is **not** needed for the API: all calls are server-to-server. Previews
  are loaded as plain images.

## 4. What FinalFolio needs from UnAlbum to switch the feature on

1. A client registration:
   - Client name: `FinalFolio`
   - Type: public client using PKCE (a secret is optional)
   - Redirect URI: `https://finalfolio.com/api/unalbum/callback`
     (plus a staging/dev URI if you want a test environment)
   - Scopes: `profile email photos.read`
   - Issued `client_id` (and `client_secret` if it is a confidential client).
2. The three API surfaces above (`/oauth/authorize`, `/oauth/token`,
   `/api/v1/me`, `/api/v1/me/photos`, `/api/v1/me/photos/{id}`).
3. Confirmation of the AI analysis storage model (table/columns) and whether an
   existing internal endpoint already returns `description` + `tags` per photo;
   reusing it is cheaper than building a new one.
4. Whether `analysis` can be exposed for photos the user has not opened in the
   UI (i.e. analysis runs for every upload, not lazily on view).

## 5. Acceptance checks UnAlbum can run itself

Replace `$TOKEN` with an access token obtained through the flow.

```bash
curl -s -H "Authorization: Bearer $TOKEN" https://unalbum.com/api/v1/me
curl -s -H "Authorization: Bearer $TOKEN" "https://unalbum.com/api/v1/me/photos?limit=5"
curl -s -H "Authorization: Bearer $TOKEN" "https://unalbum.com/api/v1/me/photos/<id>"
curl -s -o /dev/null -w '%{http_code}\n' "https://unalbum.com/api/v1/me/photos?limit=5"   # expect 401
```

Then, with FinalFolio configured against the deployment:

```bash
curl -s https://finalfolio.com/api/unalbum/status          # {"configured":true,...}
# sign in, open 账户 → UnAlbum 账号 → 连接 UnAlbum, approve consent
# open the editor → 媒体库 → 从 UnAlbum 添加
```

Success criteria:

- The binding survives a server restart and a token refresh.
- The picker shows thumbnails, and tiles whose analysis is ready carry the
  "已分析" badge.
- Importing a photo adds it to the library with its tags; using "AI 排版" with
  that photo sends text, not an image, for it (server logs no `image_url` for
  analysed photos).
- "解除绑定" revokes access; reconnecting issues a fresh token.

## 6. Copy-paste prompt for UnAlbum's AI

> 你负责 UnAlbum 服务端。请为 FinalFolio（https://finalfolio.com）实现一个最小但完整的第三方接入，使 FinalFolio 用户可以授权后读取自己在 UnAlbum 的照片，以及这些照片已有的 AI 描述与标签，并把这些照片导入 FinalFolio。只做服务端，不要改管理后台界面。
>
> 背景事实（已核实）：照片原图存于 S3 桶 `unalbum` 的 `photos/<userId>/<storageName>`，缩略图位于扁平前缀 `thumbnails/<storageName 去掉扩展名>.webp`，两者都能通过 `https://storage.unalbum.com/<key>` 公开访问；桶里没有 AI 元数据的 JSON 文件，因此 AI 标签/描述必须由你从数据库读出并通过 API 暴露。图片上传后 AI 分析是异步的，API 必须在分析完成前后都可用。
>
> 需要新增/开放以下接口（HTTPS、JSON、仅允许访问当前登录用户自己的数据）：
>
> 1. OAuth 2.1 授权码 + PKCE(S256)：`GET /oauth/authorize`（参数 response_type、client_id、redirect_uri、scope、state、code_challenge、code_challenge_method），`POST /oauth/token`（authorization_code 与 refresh_token 两种 grant，表单编码），建议再加 `POST /oauth/revoke`。scope 至少 `profile email photos.read`。redirect_uri 必须与注册值精确匹配；state 必须原样回传；refresh token 每次刷新轮换。token 响应：`{access_token, token_type:"Bearer", expires_in, refresh_token, scope}`。
> 2. `GET /api/v1/me` → `{user:{id, username, displayName, email, avatarUrl}}`。email 用于 FinalFolio 的"通过 UnAlbum 登录"，请确保返回。
> 3. `GET /api/v1/me/photos?limit=60&cursor=&q=` → `{photos:[...], nextCursor}`，只返回当前用户照片，limit 默认 30、最大 100，cursor 不透明。每张照片字段：`id, filename, name, width, height, bytes, createdAt, storage:{key}, analysis:{status:"pending"|"ready"|"failed", description, tags:[], source, analyzedAt}, variants:{original:{url,width,height,bytes,mimeType}, preview:{...}, thumb:{url,...}}`。analysis 在未完成时可以是 `{status:"pending"}` 或 null；完成后必须能通过再次调用列表拿到（用户无需重新上传）。`variants.thumb.url` 必须能被浏览器 `<img>` 直接加载（公开或至少 1 小时有效的签名 URL）；original/preview 供服务端带 Bearer 下载，也可以是 storage.unalbum.com 的公开地址，单张不超过 20 MB。
> 4. `GET /api/v1/me/photos/{id}` → `{photo:{...同一结构...}}`，用于导入前最后一次读取（顺便拿到刚生成的标签）。
>
> 错误统一为 `{"error":{"code","message"}}`；401 带 `WWW-Authenticate: Bearer`，403 表示 scope 不足，404 表示照片不存在或不属于该用户，429 时带 `Retry-After`。API 是服务端到服务端调用，不需要 CORS；但缩略图是浏览器直连，请保证可访问。
>
> 另外请为 FinalFolio 注册一个客户端：名称 `FinalFolio`，公共客户端 + PKCE，回调地址 `https://finalfolio.com/api/unalbum/callback`，scope 为 `profile email photos.read`，并把 client_id（如为机密客户端还有 client_secret）发回。
>
> 请先检查现有代码里是否已经存有 AI 的 description/tags（哪张表、哪些列、是否有 analyzed_at），尽量复用现有查询，不要重复跑模型。实现完成后用 curl 验证：带 token 能读到 /me、照片列表、单张照片且 analysis 字段正确；不带 token 返回 401；用一个其他用户的照片 id 返回 404。

## 7. Open questions to send back

- Existing table/column names for AI `description`, `tags`, `analyzed_at`?
- Is analysis run for every upload, or only when a photo page is opened?
- Preferred page size / cursor format, and whether ordering is stable across
  new uploads (FinalFolio treats the list as newest-first but does not depend on
  it).
- Do preview variants (medium size) already exist? If not, thumbnails are
  enough for the picker and originals for import.
- Client registration: public PKCE client or confidential client with secret?
- Staging redirect URI to test before production.
