# Remediation report — 2026-11-22

## Reader book surface: shadow and edge that follow the paper

**Reported:** in the un-flipped state the shared folio looked like a white sheet
with no background shadow and no outline, so it did not read as a magazine.

**Root cause:** the reader already had a large block of shadow CSS, but no code
ever set its `--shadow-*` state classes; the vendored turn.js shadow element was
also forced to `opacity: 0`. Net effect: no depth at rest and no outline.

**Design.** The book is paper on a table, so the depth effect belongs to the
paper block, not to the viewport:

- `::before` on `.issue-viewer__turnjs` is a non-rotating layer behind every
  page (turn.js wrappers use `z-index >= 1`). It draws a 1px paper edge and two
  soft contact/ambient shadows.
- Geometry follows the actual paper footprint, taken from the reader's existing
  `currentView.mode`:
  - `spread` → both halves;
  - `single-right` (cover) → right half only;
  - `single-left` (last page) → left half only.
  The empty half of a cover/last-page spread never receives a shadow.
- The layer is split into left/right halves. Each half fades with the paper on
  that side over the same 500ms as the leaf: opening the cover fades the left
  shadow in as page 2 is revealed; closing fades the left shadow out as the page
  lifts, so it never lingers under an empty half. The destination view comes
  from turn.js's `turning` event.
- Folding/peeling needs no extra layer: turn.js already paints the fold
  gradients. The body shadow never rotates with a leaf, so it cannot smear
  across a folded corner.
- The layer fades in only after `--ready`, so an empty box is never shadowed.
- `overflow-clip-margin` was raised from 26px to 52px so the soft shadow is not
  cut off; turning pages stay inside this margin.

**States verified visually** (evidence in `docs/evidence/`):

| State | Evidence |
| --- | --- |
| Cover (paper right) | `2026-11-22-reader-cover.png` |
| Open spread (paper both halves) | `2026-11-22-reader-spread.png` |
| Mid-turn (halves fade with their paper) | `2026-11-22-reader-turning.png` |
| Turn finished / next spread | `2026-11-22-reader-spread.png` |
| Last page (paper left) | `2026-11-22-reader-last.png` |
| Hover peel (folded corner) | `2026-11-22-reader-peel.png` |
| Dragged fold | `2026-11-22-reader-peel-drag.png` |
| Mobile single page | `2026-11-22-reader-mobile.png` |
| Fullscreen | `2026-11-22-reader-fullscreen.png` |

**Regression guard:** `tests/e2e/reader-turn.spec.ts` asserts, from computed
pseudo-element geometry, that the cover shadows only the right half, the spread
shadows both halves, and the last page shadows only the left half, and that the
layer is visible only once turn.js is ready.

**No page-level shadows** were added: turn.js clips and 3D-transforms page
wrappers, and per-leaf shadows would double its fold gradients.

### Known limitation found while validating the opening

Turn.js paints a single DOM face per sheet. During a cover opening it shows the
destination page (2) on the back of the curl **and** keeps the cover's front
(page 1) flat on the left. That is why page 2 seems to appear on the left before
the book is fully open, and why the cover front can be visible next to it.

Trying to synthesize the missing back face with CSS (`scaleX(-1)`, hidden
backface, delayed page content) produced worse artefacts (blank or skewed
pages), so those experiments were reverted. A correct fix needs a real
double-sided leaf model: pair each odd front with its even back, render a
separate back face (`rotateY(180deg)`, hidden front), and let turn.js flip the
pair instead of treating every page as a single face. That changes the reader's
page pairing and must be a scoped change with its own state tests. It is not a
shadow or CSS-detail fix.

## Verification

- `tsc --noEmit`, `vite build`, `npm run validate:mvp` clean.
- Playwright 56/56.
- Global detail pass from the previous entry still holds (no overflow, broken
  images, unnamed controls, or console errors across public/editor/account/admin
  in zh/en, desktop and mobile).
