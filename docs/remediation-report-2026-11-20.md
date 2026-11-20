# Remediation report — 2026-11-20

Scope of this round: photo selection (gallery and AI arrangement), the cost and
latency of AI arrangement, and the UnAlbum integration that was previously
blocked on a contract.

## 1. Gallery: selection is a property of a photo, not a mode

**Root cause.** Bulk delete was built as a global "批量选择 / 完成" mode. Inside
the mode a plain click could not assign a photo to a frame, and the only way to
delete several photos was to enter the mode, tick each one, then leave it.

**Fix.** The mode is gone. Every tile carries a pick control at the top-left
that appears on hover/focus (always visible on touch), Shift adds a range from
the last pick, Ctrl/⌘ toggles one tile, and a plain click keeps assigning the
photo to the selected frame. The action bar (count / 全选 / 清除 / trash) only
exists while something is picked. Picks are pruned against the whole library,
so the count always equals what a click would delete; the search filter only
changes what is visible.

Evidence: `docs/evidence/2026-11-20-gallery-picks.png` (3 picked tiles, action
bar visible, no mode control).

## 2. AI arrangement: real multi-select

**Root cause.** The dialog only had a one-tile toggle, so 20 photos meant 20
clicks.

**Fix.** Additive selection: Shift adds a range, Ctrl/⌘ toggles one tile, and a
reusable `MarqueeGrid` (`src/ui/MarqueeGrid.tsx`) draws a rubber band on mouse
drag. It is mouse-only (touch keeps scrolling), needs a 5 px threshold before
it becomes a selection, suppresses the click that follows a drag, and cancels
native image dragging.

**A real bug found while measuring.** Dragging across thumbnails used to start
the browser's native image drag, which fired `pointercancel` and killed the
gesture — the same drag selected 1 tile instead of the 18 it covered. The grid
root now calls `preventDefault()` on `dragstart`; the same drag selects 18.
Evidence: `docs/evidence/2026-11-20-ai-marquee.png` (rectangle over the grid,
3/50 counter mid-gesture).

Also fixed: a Shift range could exceed the 50-photo ceiling because the check
read the previous render's `photos`; `addAssetPhotos` now tracks the ceiling
locally and the single-photo path delegates to it.

## 3. AI arrangement: reuse upstream analysis instead of re-uploading photos

**Root cause.** The planner only accepted thumbnails, so a photo that already
had AI tags and a description (UnAlbum, or a future import) was decoded,
re-encoded, base64-encoded and sent as pixels again.

**Fix.**
- `Asset.analysis` (`src/editor/types.ts`) and a shared server sanitizer
  (`server/lib/assetAnalysis.js`) used by project assets, asset records and the
  AI request (800-char description, 24 tags upstream of the prompt).
- Analysed photos are sent as `{ description, tags }` with an empty `dataUrl`;
  the server attaches `image_url` only for the remaining photos and tells the
  model which ones are pre-analysed.
- The dialog marks such tiles with an "已分析" badge and shows a hint; selecting
  one does not decode or encode an image at all.

**Measured** (real 480 px photo thumbnail, one photo):

| Request | JSON body | Pixel payload | `image_url` parts |
| --- | --- | --- | --- |
| Without analysis | 10,349 B | 10,091 B | 1 |
| With analysis | 371 B | 0 B | 0 |

−96% request size for that photo, and one fewer vision tile per photo at the
provider. Output tokens (three complete plans) still dominate wall-clock time;
this round removes avoidable input cost and selection latency, not the model's
generation time.

## 4. UnAlbum integration (implemented, dark by default)

- Server: `server/unalbum.js` — OAuth 2.1 authorization code + PKCE (S256),
  single-use hashed state (10 min), token refresh with a 90 s margin, per-user
  bindings under `data/unalbum/bindings/`, scope handling, photo list and
  single-photo fetch.
- Routes: `status`, `authorize`, `login`, `callback`, `unbind`, `photos`,
  `import`. Import downloads the best available variant server-side, enforces
  the upload size limit and magic bytes, allow-lists UnAlbum/storage origins,
  and stores the upstream analysis on the new asset.
- Login: "通过 UnAlbum 登录" on the auth page; the account is matched or created
  by email (random local password, email marked verified, the normal Terms gate
  still applies). Binding and login share the same state machine.
- UI: account-page bind/disconnect, picker used by both the gallery
  ("从 UnAlbum 添加") and the AI dialog ("使用 UnAlbum 作品", before local upload
  and URL import), analysis badge, search, pagination, marquee selection.
- Configuration is required for any of it to appear
  (`FINALFOLIO_UNALBUM_BASE_URL`, `_CLIENT_ID`, optional `_CLIENT_SECRET`,
  `_SCOPES`, `_REDIRECT_URI`, `_STORAGE_ORIGINS`).

Evidence: `docs/evidence/2026-11-20-unalbum-picker.png`,
`2026-11-20-account-binding.png`, `2026-11-20-auth-unalbum.png`.

The contract for UnAlbum's server (with the bucket facts we verified: originals
at `photos/<userId>/…`, flat `thumbnails/<name>.webp`, public
`storage.unalbum.com`, no AI metadata in storage) is
`docs/unalbum-integration-brief.md`.

## 5. Two defects found while testing the new flows

| Defect | Root cause | Fix |
| --- | --- | --- |
| Non-ASCII photo names rendered as mojibake (`æ™¨é›¾…`) | multipart filenames are UTF-8 bytes but multer/busboy decodes the header as latin1 | `decodeMultipartFilename()` recovers the UTF-8 reading when it round-trips cleanly, in `createStoredUpload`; covered by an e2e upload of `晨雾中的山谷.png` |
| New selection e2e failed only in the full suite | the account library refreshes after the dialog opens and reorders the grid; Playwright had already resolved `nth(0)` against the old order | tests wait for the library to settle and scope the gallery case to its own uploads via search; `multi-select.spec.ts` passed 3 consecutive runs |

## 6. Verification

| Check | Result |
| --- | --- |
| `tsc --noEmit` | clean |
| `vite build` | clean |
| `npm run validate:mvp` | all checks pass |
| Playwright (full) | 48/48 pass |
| Multi-select spec repeated | 3/3 pass |
| UnAlbum status with no configuration | `{"configured":false,"bound":false,"account":null}`; `authorize` and `photos` answer 401 without a session |
| UnAlbum mocked flows | 3/3 pass (hidden when unconfigured, gallery import, auth button) |

## 7. Residual risks

- The planner's wall-clock time is dominated by output tokens; the next real
  lever is asking for fewer/shorter plans or streaming a single plan first.
- UnAlbum import keeps one copy per photo in FinalFolio; there is no dedupe by
  UnAlbum photo id yet (a `sourceId` field would make re-import idempotent).
- UnAlbum previews depend on browser-readable variant URLs (public or signed);
  if UnAlbum only issues token-protected URLs, thumbnails need a proxy route.
- The UnAlbum feature cannot be exercised end-to-end until UnAlbum issues a
  client registration and the API in the brief.
