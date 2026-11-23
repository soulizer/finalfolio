# Remediation report — 2026-11-22

## Reader book surface: per-page shadow only

**Reported:** the global background shadow flickered, darkened on a press,
vanished during a drag, and could reappear before a cancelled page had settled.
After several attempts to drive it from the lift state, the user accepted the
fallback: remove the global background shadow and keep each page's own shadow.

**Decision.** There is no global background/contact shadow. Every page wrapper
carries its own drop-shadow filter, so a page has a shadow whether it is closed,
open, turning, or flat, and the shadow follows it through the air. Because the
shadow is a static CSS filter on the page, it cannot flicker, disappear, or
appear early.

**Implementation:**

- Removed the two half-layers (`.issue-viewer__turnjs::before/::after`) and all
  code that toggled them (`shadowLeft`/`shadowRight`, `data-lift-side`, the
  per-frame lift loop, pointer-drag tracking).
- `.issue-viewer__turnjs .page-wrapper` has a `drop-shadow` filter. Turn.js
  transforms the page content, so the shadow follows the moving sheet.
- `.clip` stays `backface-visibility: visible` and transparent. `.inner-page`
  (the visible page box) carries the paper-coloured back face, and
  `.magazine-page` keeps content front-only. The drop-shadow therefore has a
  page-sized surface to cast from after 90°, without a board larger than the
  page.
- `.magazine-page img` gets `transform: translateZ(0)`, promoting images to
  their own compositor layers so the wrapper filter does not re-rasterize them
  every frame. This removes the slight image jitter.
- Turn.js `gradients` is off and its `inner-gradient`/`outer-gradient` layers are
  hidden, so there is no direction-dependent spine band.
- The page's own `.magazine-page` box-shadow remains as a subtle surface edge.

**Measured / verified:**

| State | Global background shadow | Per-page shadow |
| --- | --- | --- |
| Cover (closed) | none | cover page |
| Cover opening, mid-flight | none | moving sheet (`p1`/`p2`) |
| Spread | none | both pages |
| Closing / last page, mid-flight | none | moving sheet and flat pages |
| Drag, cancelled | none | unchanged |
| Press / hover | none | unchanged |

**States verified visually** (evidence in `docs/evidence/`):

| State | Evidence |
| --- | --- |
| Cover opening, sheet shadow only | `2026-11-22-reader-opening.png` |
| Forward turn, page shadows only | `2026-11-22-reader-turning.png` |
| Backward turn, page shadows only | `2026-11-22-reader-backturn.png` |
| Closing, page shadows only | `2026-11-22-reader-closing.png` |
| Last page in the air, page shadows only | `2026-11-22-reader-last-turn.png` |
| Resting spread | `2026-11-22-reader-spread.png` |
| Last page (paper left) | `2026-11-22-reader-last.png` |
| Hover peel (folded corner) | `2026-11-22-reader-peel.png` |
| Dragged fold | `2026-11-22-reader-peel-drag.png` |
| Mobile single page | `2026-11-22-reader-mobile.png` |
| Fullscreen | `2026-11-22-reader-fullscreen.png` |

**Regression guard:** `tests/e2e/reader-turn.spec.ts` asserts that visible page
wrappers carry a `drop-shadow` filter in every state (cover, spread, last page,
mid-turn, press, mobile, auto-slide), that `.clip`/`.inner-page` keep a visible
page-sized paper back while `.magazine-page` stays front-only, that images have
their own compositor layer, and that the book has no `::before`/`::after`
background layer.

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
- Playwright 61/61 (reader spec 6/6, repeated 3× and mobile 8/8).
- Global detail pass from the previous entry still holds (no overflow, broken
  images, unnamed controls, or console errors across public/editor/account/admin
  in zh/en, desktop and mobile).
