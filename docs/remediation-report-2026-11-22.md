# Remediation report — 2026-11-22

## Reader book surface: per-page shadow only

**Reported:** the global background shadow flickered, darkened on a press,
vanished during a drag, and could reappear before a cancelled page had settled.
After several attempts to drive it from the lift state, the user accepted the
fallback: remove the global background shadow and keep each page's own shadow.

**Decision.** There is no global background/contact shadow. Each page's `.clip`
carries the same shadow values the page wrapper used to produce with a
`drop-shadow` filter, so the look is unchanged. A `box-shadow` does not
composite the page content, so images are not re-rasterized and do not jitter;
the shadow is static CSS, so it cannot flicker or mutate abruptly. `.clip` is
transformed by turn.js, so the shadow follows the page.

**Implementation:**

- Removed the two half-layers (`.issue-viewer__turnjs::before/::after`) and all
  code that toggled them (`shadowLeft`/`shadowRight`, `data-lift-side`, the
  per-frame lift loop, pointer-drag tracking).
- `.issue-viewer__turnjs .clip` has a static `box-shadow` with the same values
  the wrapper's drop-shadow used. Turn.js transforms `.clip`, so the shadow
  follows the moving page. `.clip` has `backface-visibility: visible` so the
  shadow survives the whole turn; `.inner-page` keeps `hidden` so content still
  only shows on the front. `.page-wrapper` is `overflow: visible` so the shadow
  can leave the wrapper. There is no `filter` on the wrapper or on any image
  ancestor.
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

**Regression guard:** `tests/e2e/reader-turn.spec.ts` asserts that visible pages
carry a `.clip` box-shadow in every state (cover, spread, last page, mid-turn,
press, mobile, auto-slide), that no page wrapper or image ancestor has a filter,
and that the book has no `::before`/`::after` background layer.

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
