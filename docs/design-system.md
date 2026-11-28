# FinalFolio design system

FinalFolio is a dense editorial tool with a warm paper tone. Consistency comes
from tokens and shared primitives, not per-screen overrides. New UI must consume
these rules before adding CSS.

Non-negotiables:

- Warm paper background, soft skeuomorphic controls, no hover lift.
- UI chrome uses `--font-ui`; the editorial serif only renders inside
  `.magazine-page`.
- Delete is always a trash icon; destructive confirmation uses the shared dialog.
- One primary action per view; secondary actions recede.
- The reader shadow/turn model is documented in `reader-and-mobile.md` and must
  not be changed casually.

## 1. Control heights

| Token | Height | Use |
| --- | --- | --- |
| `--control-height-xs` | 24px | Gallery corner actions, page-chip actions, collapse chevrons |
| `--control-height-sm` | 36px | Dense editor/admin rows, `button--small`, inline fields |
| `--control-height` | 40px | Default buttons and fields |
| `--touch-target` | 44px | Coarse-pointer targets (and mobile reader controls) |

- Controls in one row use the same tier.
- Dense contexts re-scope `--control-height` instead of hardcoding heights.
- Icon-only controls on touch are 44×44.
- Disabled controls do not move; pressed controls translate 1px down.

## 2. Radius and spacing

Radius tokens: `--radius-xs` 4, `--radius-sm` 8, `--radius-md` 12,
`--radius-lg` 20, `--radius-xl` 28, `--radius-pill` 999.
Literal radii are only acceptable for circles, 1–2px schematic art, or the
user-controlled page frame radius.

Spacing tokens: `--space-1..10` (4–48px). Component tokens:
`--panel-pad`, `--card-pad`, `--row-gap`, `--grid-gap`, `--page-gutter`,
`--section-gap`.

- Toolbar gap: 6–8px between icon buttons.
- Mixed text-button rows: 10–12px.
- Panel padding: 14px (loose panels 16–22px).
- Keep 4mm between an image frame and its caption.
- Gallery corner controls sit 13px from the tile edge.

## 3. Typography

- UI: `--font-ui`.
- Mono: zoom input, elapsed time, page numbers, captcha.
- Display: `--font-display` / project fonts, only inside the folio page.
- Every page text node carries a role class (`magazine-text--title`,
  `--deck`, `--caption`, `--body`) so the four project fonts reach it.
- CJK headings use looser leading than Latin; test both locales.
- English copy is written as product copy, not implementation notes. Chinese is
  written as Chinese, not a literal translation.

## 4. Buttons and actions

- Shared material: warm gradient, 1px inset highlight, soft shadow, 4px radius.
- Primary: dark ink material. Ghost: warm translucent. Danger: danger glyph/tone.
  Filled danger buttons use light text (`#fff7f7`) on the red surface; danger
  ghost keeps the red text on a light surface.
- Transient notices show only the action message. Do not prefix them with a
  generic page label such as "Account update" / "Admin update".
- No `translateY` lift on hover; press moves 1px down.
- Text buttons keep readable labels; icon-only actions require `aria-label` and
  `title`.
- Every destructive row action uses `DeleteIconButton` and the shared confirm
  dialog.
- No one-off button heights. Status/tab/toolbar buttons compose existing sizes.

## 5. Selected states

Selection is communicated by the check control, not by framing the photo.

- Gallery tiles: the checkbox/check badge is the only selected marker. No ink
  border, no inset white/black double ring, no dimming.
- The tile must not change size when selected.
- Bulk actions replace the library's upload/import row for the duration of the
  selection. The row keeps the same height, so the grid never moves; the count
  reads `selected/total` (plus `+n` when selected photos are outside the current
  search), and search plus the unused-clear action stay in their own utility row.
- With focus inside the media library, `Ctrl/Cmd+A` selects the visible photos
  and `Escape` clears the selection. The “All” button selects the visible result
  set and carries a full accessible label.
- Keyboard focus uses the shared focus ring; it is separate from selection.
- Row selection may use a quiet background + the row's own selection state, but
  must not swallow the row's buttons.

## 6. Panels, headers and forms

- `Panel`: one header row (eyebrow/title/meta/actions), one body grid.
- The collapse chevron is absolutely positioned in the panel's top-right
  corner, independent of heading length; headers reserve right padding when the
  chevron is present.
- `PanelCollapseToggle` is the only collapse control; sections that must not
  fold the parent use `EditorSubsection` (`<details>`).
- `Field`: label above input; one height token; focus ring from `--field-border`.
- `FormGrid`: two columns at ≥640px, one below. Settings pages stay single
  column.
- Empty states use one structure: eyebrow + title + optional body + actions.
- Dialogs share one backdrop/panel/focus recipe; no thick inner rings.

## 7. Page shells and layout system

Approved widths/decisions (2026-11-26):

| Surface | Max width | Notes |
| --- | --- | --- |
| Marketing / auth / legal | 1240px | `--site-width` |
| Account / admin console | **1440px** | Approved; console header is compact |
| Editor | 1880px | Full-height tool; canvas first |
| Reader | viewport | Immersive, chrome never covers the paper |

Shared rules:

- Horizontal gutter: `--page-gutter: clamp(16px, 3vw, 32px)`.
- Section rhythm: `--section-gap: clamp(48px, 6vw, 80px)`.
- Grid gap: `--grid-gap: clamp(14px, 1.4vw, 20px)`.
- One compact `PageHeader` for account/admin: eyebrow, title, optional lede,
  meta and actions. No large hero on console pages.
- Console grids:
  - overview: `minmax(0, 1.7fr) minmax(320px, 1fr)`
  - list + inspector: `minmax(320px, .9fr) minmax(420px, 1.4fr)`
  - settings: single column
- Editor:
  - desktop: page strip / library / canvas / inspector / operations
  - narrow: canvas first; library and operations below, or as a drawer and a
    bottom sheet
  - do not force three columns below 1180px
- Homepage sections share gutter, max width and `--section-gap`.

### Layout roadmap

1. Tokens + shells + compact PageHeader (marketing/auth/legal/account/admin).
2. Console grids, list rows and settings.
3. Editor panes, panel headers, gallery/card tiers, narrow-screen drawers.
4. Homepage section rhythm and shared grids.
5. Forms, dialogs, empty states, tags/chips.
6. Responsive/a11y pass (44px targets, keyboard rows, container queries).
7. Visual regression + performance verification.

Each phase: geometry tests at 1440/1024/768/390, one primary action per view, no
horizontal overflow, full Playwright green.

Status (2026-11-26): tokens/shell widths, compact console PageHeader, 1440px
console grid, canvas-first editor below 1180px, homepage section rhythm,
card/field/tag tiers and the shared dialog overlay recipe are implemented.
`layout-system.spec.ts` pins the 1440/1240 widths, compact title size, editor
canvas order and mobile overflow. A shared `EmptyState` component and optional
editor drawers remain future refactors; the current markup already shares
`.editor-empty-state`.

## 8. Copy voice

- Say what the user gets, not how the system works.
- No internal terms such as "governance language" or "one-shot canvas" on
  customer pages.
- Admin copy may be operational but still names the object and action.
- Mobile reader top bar credits the owner: "e2euser 分享的作品集" /
  "Shared by e2euser" (username only, never email).

## 9. Verification

Before shipping UI:

1. `npm run typecheck`, `npm run build`, `npm run validate:mvp`,
   `npx playwright test`.
2. Check 360 / 390 / 768 / 1024 / 1440 widths for overflow.
3. Confirm controls resolve to 24 / 36 / 40 / 44px tiers.
4. Confirm no hover rule adds a lift or a white border.
5. Confirm gallery selection adds no extra frame.
6. For reader changes, run `tests/e2e/reader-turn.spec.ts` and read
   `reader-and-mobile.md`.

## 10. Action menus and editor UX roadmap

### Goal

Reduce visible clutter without hiding the actions people use most. Give images
and page chips one predictable “More” menu, keep frequent actions one click
away, and make every action reachable by pointer, keyboard and touch.

### Shared ActionMenu primitive

One component in `src/ui` used by image tiles, page chips and later other lists:

- Trigger: 24px icon button (36px dense row, 44px touch) with `aria-haspopup="menu"`.
- Content: portal to `document.body`, frosted popover material, viewport-clamped,
  flipped above the trigger when there is no room below.
- One menu open at a time; close on outside pointer-down, Escape, scroll, resize
  and route change.
- Keyboard: ArrowUp/Down/Home/End, Enter/Space, Escape; focus returns to trigger.
- Destructive items use danger text and the shared confirmation dialog; do not
  put a second red filled button inside the menu.
- Mobile: if the trigger is in a narrow viewport, use the existing bottom-sheet
  pattern instead of a tiny popover.
- Items support icon + label + optional shortcut/description; disabled items
  explain why through title/aria-description.

### Image tile “More” menu

The tile keeps:

- click = assign to the current frame
- drag = drag to a page frame
- top-left checkbox = bulk selection
- drag handle = swap with another frame on the same page

Menu actions:

| Action | Notes |
| --- | --- |
| Place in selected frame | Disabled until a page frame is selected |
| Remove from current page | Only when this asset is placed on the selected page |
| View / open original | Opens the original in a new tab |
| Download | Downloads the original file |
| Retry delivery | Only when mirroring failed |
| Show usage | “Used on N pages” with a jump to the first use |
| Delete from library | Destructive, shared confirmation; disabled while referenced |

Keep the trash shortcut only if it remains visually distinct; otherwise move
delete into the menu to avoid accidental clicks. Do not duplicate the same
action in both places.

### Page chip “More” menu

Keep the page chip’s primary select/drag affordances and paper-colour swatch.
Consolidate secondary actions into the menu:

- Duplicate page
- Move page up / down
- Insert page before / after
- Save page as template
- Delete page (disabled when only one page remains)
- Jump to page (number input or first/last shortcuts, for long folios)

The page chip should keep one visible drag handle separate from the title, so
dragging to reorder never fights clicking to select. Page chips auto-scroll into
view when added, duplicated or reordered.

### Context menu

Right-click / long-press on an image tile or page chip opens the same ActionMenu
at the pointer. This is a convenience layer only; the visible More button remains
the discoverable path. Never rely on right-click alone.

### Other UX opportunities, in priority order

1. **Undo instead of confirmation for reversible actions**
   Reordering, duplicating, moving a page or removing an image from the current
   page should show a short “Undone” toast with Undo. Keep confirmation for
   irreversible delete from the server/library.

2. **Gallery filters that match the editing task**
   Quick filters: All / Used in this folio / Unused / Delivery failed. Combine
   with search; keep the bulk bar selection aware of hidden items (`+n`).

3. **Image usage navigation**
   From the image menu, show which pages use it and jump to the first one. This
   reduces hunting through a 48-page folio.

4. **Page insertion at the point of intent**
   Add “Insert page before/after” to the page menu and a subtle `+` between page
   chips; the current “Add page” at the end stays for quick growth.

5. **Keyboard shortcuts with discoverability**
   `Ctrl/Cmd+Z` / `Shift+Ctrl/Cmd+Z` already exist; add `Delete` on a selected
   page chip (with confirm), `Ctrl/Cmd+D` duplicate page, `Escape` clears
   gallery selection. Surface them in tooltips, not a separate cheat sheet.

6. **Image replacement by drag**
   Dropping a new image onto an occupied frame should replace it without
   changing the frame geometry; dropping onto empty space moves/assigns. Make
   the drop target outline consistent with the new swap handle.

7. **Selection mode clarity**
   The bulk bar should always show `selected/total`, `+n outside search`, and
   what will be deleted. Never delete a hidden selection without saying so in
   the confirmation body.

8. **Mobile action sheet**
   On touch, More opens a bottom sheet with 44px rows; the image library and page
   strip should not show hover-only affordances as the only path.

### Implementation order

1. `ActionMenu` primitive + tests (open/close, keyboard, portal, mobile sheet).
2. Image tile menu; move delete/retry/usage actions; keep click/drag/checkbox.
3. Page chip menu; consolidate duplicate/move/insert/template/delete.
4. Right-click/long-press wiring, sharing the same menu data.
5. Undo toast for reversible actions.
6. Gallery quick filters and usage navigation.
7. Mobile bottom-sheet variant and final a11y pass.

### Acceptance checks

- Opening a menu never moves the gallery or page strip.
- Exactly one menu can be open; Escape/outside click/scroll closes it.
- Every menu action is keyboard reachable and returns focus to its trigger.
- Destructive actions still use the shared confirmation; disabled actions have
  a reason.
- Image click/drag/checkbox/swap behaviour remains unchanged.
- Page drag reorder remains unchanged; page actions work for long folios.
- Full Playwright green; new tests for menu state, image actions, page actions
  and mobile sheet.
