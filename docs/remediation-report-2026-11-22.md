# Remediation report — 2026-11-22

## Reader book surface: shadow and edge that follow the paper

**Reported:** in the un-flipped state the shared folio looked like a white sheet
with no background shadow and no outline. Later rounds reported that the
background shadow stayed under a lifted page, and that the spine shading differed
between forward and backward turns.

**Rule (from the user):** the desk shadow belongs to the paper that is still
lying flat. The side the moving sheet belongs to drops out while it is in the
air; the other side keeps its shadow. The spine has either the same shading in
both turn directions or none at all.

**Root causes found by frame-by-frame measurement:**

1. The desk shadow was driven by React state that only changed at the landing, so
   it stayed at full strength while a page was in the air.
2. Turn.js paints fold gradients (`inner-gradient` / `outer-gradient`) on whichever
   page is moving or being revealed, even with `gradients: false`, and only in the
   flipping direction. This was the direction-dependent spine shading.
3. Turn.js's `.shadow` element is an empty div and paints nothing; it is not a
   source.

**Implementation:**

- **Per-side lift detection every frame.** A `requestAnimationFrame` loop reads
  turn.js's own state and the rotated page wrappers. The moving sheet's side is
  derived from `pageMv` (even page = left, odd = right). The book carries
  `data-lift-side`, and CSS sets only that side's desk layer to opacity 0 with no
  transition. The other side keeps its shadow, so a turn never blanks the whole
  desk and a press cannot make the background flicker. The attribute is set
  imperatively, so React re-renders cannot clear it. A bare press or hover does
  not count: the desk reacts only once the pointer has actually dragged the page
  or turn.js is in `turning`/`moving`. That removes the press-time fold flicker
  while keeping the sheet's own shadow.
- **Commit gate.** The lift side is held until React has committed the page
  turn.js is on (`committedTurnPage`), so the first resting frame never shows the
  previous view. A cancelled drag releases at once; a 60-frame limit guards
  against a stuck state.
- **Desk layers.** Two half-layers under the paper, one per side, sized by the
  landed mode: `spread` → both; `single-right` (cover) → right; `single-left` (last
  page) → left. The moving side is removed immediately; the other side is
  untouched.
- **Spine.** Turn.js's `gradients` option is off and its gradient layers are hidden
  in CSS. No spine shading is painted in either direction, at rest or in flight.
- **The moving sheet keeps its own shadow.** A per-frame pass marks the page
  wrappers whose `.inner-page` is actually rotated (the front and back faces of
  the sheet in the air). Those wrappers get a drop-shadow filter; it travels with
  the paper and is removed when the sheet is flat again. This is the correct
  shadow that must survive a turn, and it exists in both directions.
- **Mobile.** Turns lift the desk like desktop. The horizontal auto-slide does not
  lift any page; the shadow stays under the page that is now centred.

**Measured (1200ms turns, every animation frame):**

| Transition | Moving side visible while lifted | Stationary side kept | Painted spine gradients | Sheet shadow present |
| --- | --- | --- | --- | --- |
| Cover → spread | 0 | n/a (left empty) | 0 | yes (`p1`/`p2`) |
| Spread → spread (forward) | 0 | yes (left) | 0 | yes (`p3`/`p4`) |
| Spread → cover (closing) | 0 | yes (right) | 0 | yes (`p1`/`p2`) |
| Spread → last page | 0 | yes (left) | 0 | yes (`p5`/`p6`) |
| Last page → spread (backward) | 0 | yes (right) | 0 | yes (`p3`/`p4`) |
| Drag, cancelled | 0 | yes | 0 | yes |
| Drag, backward to cover | 0 | yes | 0 | yes |
| Drag, forward to spread | 0 | yes | 0 | yes |

After each landing: cover `right=1, left=0`; spread `both=1`; last page `left=1,
right=0`.

**States verified visually** (evidence in `docs/evidence/`):

| State | Evidence |
| --- | --- |
| Cover opening: moving side off, sheet shadow stays | `2026-11-22-reader-opening.png` |
| Forward turn: right off, left desk stays | `2026-11-22-reader-turning.png` |
| Backward turn: left off, right desk stays | `2026-11-22-reader-backturn.png` |
| Closing: left off, right desk stays | `2026-11-22-reader-closing.png` |
| Last page: right off, left desk stays | `2026-11-22-reader-last-turn.png` |
| Resting spread, desk back after landing | `2026-11-22-reader-spread.png` |
| Last page (paper left) | `2026-11-22-reader-last.png` |
| Hover peel (folded corner) | `2026-11-22-reader-peel.png` |
| Dragged fold | `2026-11-22-reader-peel-drag.png` |
| Mobile single page | `2026-11-22-reader-mobile.png` |
| Fullscreen | `2026-11-22-reader-fullscreen.png` |

**Regression guard:** `tests/e2e/reader-turn.spec.ts` records every animation frame
of each transition. It asserts that the moving side's desk opacity is zero while
the stationary side keeps its shadow, that no frame paints a turn.js gradient,
that a lifted frame keeps a drop-shadow on the rotated sheet while resting pages
have none, and that the first resting frame already shows the landed state. A
dedicated test holds the mouse on a spread and asserts the desk is never blanked
on both sides. It also covers rest states, a cancelled
drag, and the mobile slide-versus-turn distinction.

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
