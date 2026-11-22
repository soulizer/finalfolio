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
- The layer is split into left/right halves and follows **paper that is still
  lying flat**, not the destination view:
  - opening from the cover keeps the right shadow while the cover is in the air
    and adds the left shadow only at `turned`, when page 2 lands;
  - closing a spread removes the left shadow at the first frame of the turn,
    because that page has left the table; the right stack keeps its shadow;
  - a spread-to-spread turn keeps both halves for the whole turn, because the
    stacks under the moving leaf do not move;
  - the spread-to-last-page turn keeps both halves while pages 4 and 5 are still
    flat, then drops the right one when the last page lands and the right half
    becomes the empty back cover.
- The in-flight state is cleared after `turned` publishes the new view. Clearing
  it first made React render the old spread with no target for one frame, which
  flashed the lifted page's shadow back in exactly at landing.
- A separate `.issue-turnjs__hinge` overlay draws the spine crease above the page
  surfaces, because the body layers sit behind the pages. It is shown only in
  the `spread` mode, so both forward and backward turns have the same center
  shading, a closing page keeps the hinge while it is in the air, and a cover or
  last page with an empty half has no crease over the empty paper.
- Transitions are short (120ms) and only start after the class changes, so a
  shadow cannot appear before its page has landed or linger while the page is
  already off the table.
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
| Cover opening, left half still empty | `2026-11-22-reader-opening.png` |
| Spread turn, matching gutter on both pages | `2026-11-22-reader-turning.png` |
| Closing, left body shadow already gone | `2026-11-22-reader-closing.png` |
| Turn finished / next spread | `2026-11-22-reader-spread.png` |
| Last page (paper left) | `2026-11-22-reader-last.png` |
| Last page in the air, body stays under pages 4–5 | `2026-11-22-reader-last-turn.png` |
| Hover peel (folded corner) | `2026-11-22-reader-peel.png` |
| Dragged fold | `2026-11-22-reader-peel-drag.png` |
| Mobile single page | `2026-11-22-reader-mobile.png` |
| Fullscreen | `2026-11-22-reader-fullscreen.png` |

**Regression guard:** `tests/e2e/reader-turn.spec.ts` asserts the rest-state
geometry, then records the turn classes and computed opacities frame by frame.
It verifies that an opening adds no left shadow before landing, a closing removes
it immediately, a spread keeps both halves and the centered crease in either
direction, the last page keeps the body under the flat pages until it lands, and
the mobile auto-slide keeps the shadow on the centered page.

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
- Playwright 61/61.
- Global detail pass from the previous entry still holds (no overflow, broken
  images, unnamed controls, or console errors across public/editor/account/admin
  in zh/en, desktop and mobile).
