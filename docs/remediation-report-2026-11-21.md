# Remediation report — 2026-11-21

Scope: UnAlbum usability, thumbnail delivery, and the first live sign-in.

## 1. UnAlbum photos are part of the library, not a second workflow

**Before:** 媒体库 → “从 UnAlbum 添加” → 弹窗 → 勾选 → 导入 → 再回到图库使用。
Four steps and a modal for one photo.

**After:** the signed-in user's published UnAlbum photos are appended to the
media grid itself. One click imports the photo server-side (with its upstream
AI tags) and, when a frame is selected, places it there. The button, the modal,
and the modal's "UnAlbum" pill are gone. The AI dialog shows the same photos
inline; selecting one imports it and adds it to the plan. “加载更多” is the only
extra control, only when UnAlbum has another page.

Evidence: `docs/evidence/2026-11-21-gallery-unalbum.png`,
`docs/evidence/2026-11-21-ai-unalbum-selected.png`.

## 2. Selection is a thin outline, not a black frame

The modal's selected tile used a 4 px ink/white/ink ring plus a dimmed photo.
That style is removed with the modal, and the shared AI-grid selection is now a
single 1 px ink outline plus the check badge (image at 96% brightness).
Evidence: `2026-11-21-ai-unalbum-selected.png`.

## 3. Thumbnails no longer depend on the CDN's browser policy

All previews now load through `GET /api/unalbum/thumb/:photoId`:

- the server resolves the variant URL, normalizing relative paths against the
  API origin;
- variant URLs are cached for ten minutes per user when the photo list or an
  import is fetched, so a page of previews does not spend one API call each;
- only allow-listed origins are fetched; bytes are capped at 12 MB and served
  with a private 10-minute cache.

This works whether the CDN allows `finalfolio.com` as a referrer or not; the
allowlist the operator added is no longer required for previews but remains
useful for the import path.

## 4. First sign-in: cold connection to unalbum.com

The live callback failed once with `DOMException [TimeoutError]` inside the
token exchange. Measured from the production container: the first TLS
connection stalls past undici's 10 s connect timeout, the second completes in
~2.6 s, and pooled requests answer in ~110 ms. Token and API calls now retry
connection failures and timeouts (3 attempts, 25 s each). Callback failures are
reported by stage (`state`, `denied`, `network`, `no-email`, `disabled`) instead
of a generic error.

## 5. Idempotent imports

Imported assets carry `unalbumId`. The gallery hides photos that are already in
the library, and the import route returns the existing asset instead of a copy,
so double clicks and re-imports cannot duplicate a photo.

## 6. Follow-up fixes from the first live use

- **UnAlbum import returned 500.** The route had been refactored to fetch the
  photo through the user-scoped wrapper but still referenced the removed
  `binding` variable, so every click ended at "导入中" with no result. It now
  uses the binding returned by that call. `validate:mvp` starts a fake UnAlbum
  server and asserts a real import, the stored analysis, idempotent re-import
  and the preview proxy.
- **Gallery hover turned the tile border white.** Hover now only darkens the
  border; the lifting shadow is gone.
- **Empty white thumbnails.** Gallery and AI tiles use a shared `PhotoThumb`
  with a "加载中…" placeholder and an "图片无法显示" error state.

## 7. Verification

- `tsc --noEmit`, `vite build`, `npm run validate:mvp` pass (validation now
  covers PKCE, state, refresh rotation, connect-timeout retry, and relative
  variant URL resolution).
- Playwright: UnAlbum spec rewritten for the inline flow (hidden when
  unconfigured, gallery import, AI import, auth entry) — green; full suite
  49/49.
- Production: `/api/unalbum/status` reports configured; login entry generates an
  authorize URL that UnAlbum accepts.

## 8. Instant placement (option A)

Clicking an UnAlbum photo now fills the selected frame immediately with the
cached preview and a small “正在放入…” badge; the real copy is written in the
background and swapped in without another user action. The preview is a
client-only asset (never part of the project), so it cannot be saved, shared or
exported; export is blocked with a clear message until the copy finishes. If the
copy fails, the frame reverts to its previous state and the error is shown.

The AI dialog still copies on click (there is no frame to preview), but the
metadata cache makes it a single CDN download and failures are surfaced in the
dialog.

## 9. Residual

- The inline grid shows the first UnAlbum page; “加载更多” pulls the next one.
  There is no search across the remote collection yet.
- Remote tiles cannot be dragged; a click imports them (one request per photo).
- Import still copies original bytes into FinalFolio; there is no background
  sync of later UnAlbum edits.
