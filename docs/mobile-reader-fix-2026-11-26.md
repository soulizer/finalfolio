# Mobile reader fix — 2026-11-26

## Context

The previous attempt switched the mobile reader from turn.js `double` display to
`single`. That fixed the 3 -> 4 parity flash but changed the physical page-turn
look completely (page geometry, spine, shadow stacking), which was unacceptable.
It was rolled back to `35a9f4b` before this rework.

## Implemented approach

### Chrome never covers the paper
- Removed the duplicated bottom page/title card.
- The mobile top bar and prev/next controls are grid rows above and below the
  viewport instead of absolute overlays.
- `grid-template-columns: minmax(0, 1fr)` keeps the viewport at full available
  width; the book now uses ~320px instead of ~211px on an iPhone 13.
- Geometry tests cover 390x844 and 320x568.

### Camera and flip move together
- turn.js stays in `double` display with the original translated single-page
  camera. No changes to page geometry, spine or shadow CSS.
- Navigation now has a leading *camera page* and a committed *visible page*.
- Odd -> even turns set the camera target before `book.page(target)`; the stage
  transition (500 ms, ease-in-out) runs while turn.js flips the leaf.
- Even -> odd remains a 320 ms camera pan across the already-open spread.
- `turned` commits the visible page without a second camera move, so 3 -> 4 no
  longer shows page 5 and then slides back.

### First and last pages
- Entering page 1 or an even last page is a boundary target: the final camera is
  the centred 0 position and is applied during the flip, so there is no extra
  camera slide after `turned`.
- Boundary behaviour is covered by a dedicated test that samples the transform
  right after the page label changes and again after settling.

### Owner attribution in the mobile top bar
- Public issue payloads now include the owner's username only (never email).
- The mobile top bar reads "e2euser 分享的作品集" / "Shared by e2euser" instead of
  the generic "分享的作品集", with a generic fallback for older projects.

### Kept light-touch UX fixes
- Closed mobile details sheet is `inert` / `aria-hidden`.
- Page range is announced with `aria-live="polite"`.
- Mobile prev/next buttons are 44px tall.
- Arrow-key paging ignores form fields.
- Account/admin rows keep whole-row pointer selection without hijacking row
  buttons.

### Gallery selection
- Removed the extra black double border / inset rings from picked asset tiles
  and selected AI library photos. Selection is communicated by the checkbox or
  check badge only; the base tile edge is unchanged.

## Verification
- Reader suite adds: chrome geometry (tall + short), camera movement during the
  3 -> 4 turn, final page 4 without page 5 as the main page, stable transform
  after the turn.
- Gallery suite asserts the picked tile keeps the base border and has no inset
  rings.
- Desktop reader and page-shadow tests remain green.
