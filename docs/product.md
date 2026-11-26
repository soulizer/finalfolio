# FinalFolio product and architecture

## 1. What FinalFolio is

FinalFolio turns a set of photos into a multi-page folio that can be edited,
saved, shared as a read-only turn.js book, and exported as PDF or JPG.

Public surfaces:

- `/` — editorial homepage with a live folio preview.
- `/auth` — sign in, sign up, verification, password reset, terms gate.
- `/editor/:projectId?` — the live folio editor.
- `/account` — self-service projects, uploads, templates, preferences, settings.
- `/admin` — operations console (users, projects, uploads, events, storage, AI).
- `/project/:shareId` — public reader.
- `/terms`, `/privacy` — legal pages.

## 2. Roles and auth

- Anonymous users can open the editor, but saving/sharing requires an account.
- The first verified account becomes the initial administrator.
- Sessions use a hashed session ID in an HttpOnly cookie; the server stores only
  hashes of session and email action tokens.
- Login is rate-limited per IP and per identifier. Password reset and email
  verification use single-use tokens.
- Admin accounts can manage users, projects, uploads, object storage, site copy,
  templates and AI providers.

## 3. Editor and project model

A project (`ProjectState`) contains:

- `title`, `subtitle`, `issue`, `frameRadius`, optional `fonts`
- `assets` (library items) and ordered `pages`
- a share record (`enabled`, `id`, `path`, timestamps)

Each page is a template (`cover`, `essay`, `folio`, `grid`, `diptych`,
`panorama`, `mosaic`, `triptych`, or a saved custom layout) plus theme, copy,
slot assignments and crops.

Editing rules:

- Photos are uploaded to the library, then assigned to page slots.
- Text is edited directly on the page; crop/fit is adjusted on the canvas.
- Custom layouts are created from a page's current geometry and can be renamed,
  duplicated and deleted.
- Drafts autosave; `rev` + `409` prevents silent overwrite from a second tab.
- Export and screen preview share `MagazinePreview`, so pages look consistent.
- The public reader, account strip and admin strip use the same renderer and the
  same project fonts.

Limits (server-configurable): 48 pages, 64 assets, 24 files per upload, 25 MB
per file.

## 4. Sharing and export

- Share links are read-only and can be enabled/disabled per project.
- Public payload includes the folio, its assets, frame radius, fonts and the
  owner's username (never the owner's email).
- PDF export uses pdf-lib and the print renderer; JPG export supports a page ZIP
  or a stitched image (guarded against canvas limits).
- Export Center runs preflight checks (page count, binding margin) before output.
- `PublicIssuePayload` intentionally excludes account and storage internals.

## 5. Uploads and object storage

Two upload paths end in the same asset record:

1. **Direct** when object storage is enabled:
   `POST /api/uploads/presign` → browser `PUT` → `POST /api/uploads/complete`.
   The server verifies size/content type, downloads the original, creates local
   variants, then mirrors them to the bucket in the background.
2. **Proxy fallback** when object storage is disabled:
   `POST /api/uploads` stores the file locally; variant generation is concurrency
   capped; mirroring (if configured later) never rolls the upload back.

Delivery state is tracked in a sync index. Failed mirrors can be retried from
the gallery. Object-storage config/secrets and the sync index are memoised in
process with explicit invalidation on writes.

Upload validation: JPEG/PNG/WebP/AVIF/GIF magic bytes, size limits, generated
preview/thumb variants. URL import additionally re-checks redirects and blocks
private origins.

## 6. AI arrangement (experimental)

Entry points are marked **Experimental / 实验功能**.

- Signed-in users select up to 50 photos (library, device upload, URL import,
  UnAlbum) and receive three folio plans.
- Admin owns the provider pool, ordering, connection tests, default prompt,
  global switch, per-user total/daily limits and per-request photo cap.
- Generation is a background job (`202` + `jobId`, polling) so long requests do
  not hit proxy timeouts.
- Providers stream; first-content 90 s, idle 60 s, total budget configurable
  (default 180 s, hard cap 280 s).
- Hedged retries move through the enabled pool; invalid output triggers one
  self-correction retry on the same provider.
- Only small JPEG thumbnails are sent. Photos with existing analysis (for
  example UnAlbum imports) send text only.
- Plans are validated against built-in templates/themes and clamped to the
  selected assets. Nothing changes in the editor until the user applies a plan.
- API keys are stored server-side in `data/ai/config.json` (`0600`); admin
  responses expose only `hasApiKey` and a masked hint.

Residual risks: keys are not encrypted at rest yet; output quality still needs a
human review; quotas have no recharge flow.

## 7. UnAlbum integration

Hidden until configured. FinalFolio implements OAuth 2.1 authorization code +
PKCE (S256), single-use state, token refresh, per-user bindings and idempotent
imports (`unalbumId`).

Endpoints:

- `GET /api/unalbum/status`
- `POST /api/unalbum/authorize` (bind an existing account)
- `POST /api/unalbum/login` (sign in with UnAlbum)
- `GET /api/unalbum/callback`
- `POST /api/unalbum/unbind`
- `GET /api/unalbum/photos`
- `POST /api/unalbum/import`
- `GET /api/unalbum/thumb/:photoId` (server-side preview proxy)

Published UnAlbum photos appear inline in the media library; one click imports
the photo, keeps upstream AI analysis and (when a frame is selected) places it
immediately. Imports are de-duplicated by `unalbumId`.

Configuration:

```env
FINALFOLIO_UNALBUM_BASE_URL=https://unalbum.com
FINALFOLIO_UNALBUM_CLIENT_ID=<client id>
FINALFOLIO_UNALBUM_CLIENT_SECRET=<optional for a public PKCE client>
FINALFOLIO_UNALBUM_SCOPES=profile email photos.read
FINALFOLIO_UNALBUM_REDIRECT_URI=https://finalfolio.com/api/unalbum/callback
FINALFOLIO_UNALBUM_STORAGE_ORIGINS=https://storage.unalbum.com
```

## 8. Data and privacy

- Data root defaults to `/data` in Docker.
- JSON records: users, sessions, projects, uploads, events, preferences,
  templates, site config, AI config/usage, UnAlbum bindings.
- File permissions: `0600` records, `0700` directories; the container runs as
  UID 1000.
- Deleting a folio deletes photos no other folio references; shared-library
  assets remain.
- Event logs are capped and pruned after the retention window (default 30 days).
- Object-storage and AI secrets live in server-side config files, never in the
  client bundle.
- Public payloads expose only what the reader needs (including owner username,
  not email).

## 9. Stack

- React 19 + TypeScript + Vite; lazy routes; plain CSS.
- Express 5 API; JSON file store; multer uploads; sharp/ffmpeg-style variant
  service; optional AWS SDK for S3-compatible storage.
- turn.js + jQuery only on the public reader.
- Playwright for end-to-end; `validate:mvp` for source/build/API assertions.
- Docker Compose behind Caddy Docker Proxy.
