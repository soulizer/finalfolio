# Reader and mobile behaviour

The public reader (`/project/:shareId`) is the most fragile visual surface. This
document is the contract for turn.js, shadows, fonts and mobile chrome.

## 1. Rendering model

- The reader uses the same `MagazinePreview` as the editor, account and admin
  previews, so page content and project fonts match everywhere.
- Desktop: turn.js `display: 'double'`, two-page spread.
- Mobile portrait (coarse pointer, ≤900px): the same double spread, with the
  stage translated by half a page to show one page at a time.
- Do **not** switch the mobile reader to turn.js `single`. That was tried and
  rolled back because the page geometry, spine and shadow stacking looked wrong.
- Reader page markup is built in one detached React root for the whole book, then
  handed to turn.js as HTML. Do not go back to one root per page.

## 2. Page shadows

The accepted 2026-11-22 decision:

- No global background/contact shadow.
- Every `.page-wrapper` carries its own `drop-shadow` filter; the shadow exists
  whether the page is closed, open, turning or flat, and follows the leaf.
- `.inner-page` carries a page-sized paper-coloured back face; `.magazine-page`
  content stays front-only, so the back face does not repeat text.
- Images inside turn.js pages use `translateZ(0)` so the wrapper filter does not
  re-rasterize them every frame.
- Do not reintroduce the board/box-shadow or global-shadow approaches. The
  regression suite pins: per-page shadow, no global shadow, during drag/turn,
  mobile and fullscreen.

Known limitation (unchanged): turn.js exposes one DOM face per sheet, so the
cover can show page 2 on the curling back face when opening. A correct fix needs
a paired-sheet page model (front/back per paper), not a CSS mirror. See
`known-issues.md`.

## 3. Mobile chrome

- Top bar, page viewport and prev/next controls are grid rows inside
  `.issue-view-reader`. Chrome sits in flow, not over the paper.
- The duplicated bottom page/title status card was removed; the top bar already
  shows owner, issue, page range and title.
- Grid columns are `minmax(0, 1fr)`; without it the viewport collapsed to the
  clip's max-content width (~211px instead of ~320px on iPhone 13).
- Mobile prev/next are 44px tall.
- Closed details sheet is `inert` + `aria-hidden`; page range is announced with
  `aria-live="polite"`.
- Top bar attribution: owner username only, e.g. `e2euser 分享的作品集` /
  `Shared by e2euser`; fall back to `分享的作品集` / `Shared folio` when the owner
  has no username.

## 4. Camera and page turns

Navigation separates two values:

- **visible page** — committed page used by the top bar and next/prev state.
- **camera page** — half-page the stage should show, which can lead the visible
  page during a turn.

Rules:

- Odd → even: set the camera target before `book.page(target)`. The 500ms
  camera move runs with the flip; 3 → 4 lands on page 4 without flashing page 5.
- Even → odd: the next page is already the other half of the open spread; only a
  320ms camera pan runs, with no flip.
- Boundary targets (page 1 and an even last page) settle at the centred camera
  position during the turn. They must not slide again after `turned`.
- `turned` commits the visible page without starting a second camera animation.
- Keep `reader-turn.spec.ts` green: it covers drag release, loading state,
  typography, per-page shadows, 3 → 4 camera sync, first/last settle and mobile
  chrome geometry.

## 5. Fonts

Public payloads include the project `fonts`; the reader applies them through
`--page-font-title/deck/caption/body` on the sheet. A regression test checks that
a project using 思源宋体 renders `FF Serif SC` in the public reader.

## 6. Touch and keyboard

- The desktop and mobile reader both use turn.js's native gestures; do not
  disable `pointer-events` on the page tree.
- Keyboard: ArrowLeft/Right turn pages, Home/End jump, ignored while typing in an
  input/textarea/contenteditable.
- Swipe and edge drag must not leave a page stuck to the pointer; the vendored
  turn.js includes defensive fixes for this and has a dedicated test.
