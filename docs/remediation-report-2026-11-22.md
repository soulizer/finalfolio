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
- While a turn is running (`isTurning` from turn.js `turning`/`turned`), the
  layer spans the full spread because the book block is still underneath the
  moving leaf; after the turn lands it contracts to the landed footprint.
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
| Mid-turn (shadow full width) | `2026-11-22-reader-turning.png` |
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

## Verification

- `tsc --noEmit`, `vite build`, `npm run validate:mvp` clean.
- Playwright 56/56.
- Global detail pass from the previous entry still holds (no overflow, broken
  images, unnamed controls, or console errors across public/editor/account/admin
  in zh/en, desktop and mobile).
