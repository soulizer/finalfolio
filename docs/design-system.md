# FinalFolio Design System

The editor and admin are dense tools. Consistency is enforced from a small set
of tokens instead of per-screen fixes. New controls must use these rules before
adding new CSS.

## 1. Control heights

| Tier | Height | Use |
| --- | --- | --- |
| Micro icon | **24px** | Page-chip actions, gallery thumbnail corners, panel collapse chevrons |
| Dense editor / admin | **36px** | `button--small`, toolbar rows, dialog footers, inline geometry fields |
| Standard | **40px** | Default buttons, panel text inputs, selects |
| Public site | **44px** | Marketing and auth calls to action |

Every control in one row uses the same tier. Inputs never exceed the button
height beside them: a 36px footer button pairs with a 36px name field, and a
40px panel input pairs with 40px buttons. `--control-height` and
`--control-height-sm` are the only sources for these values.

## 2. Spacing

Use the existing 6 / 8 / 10 / 12 / 16 spacing steps.

- Toolbar gap: **6–8px** between icon buttons.
- Mixed button rows: **16px** gap so the optical gap remains around 10px after
  borders and inner padding.
- Panel padding: **12–14px**.
- Page chip padding: **12px 14px**; corner actions sit **14px** inside the card.
- Thumbnail corner actions sit **14px** from the top and right edges.

## 3. Text and icon actions

Panel and dialog actions use **text labels** so their meaning stays explicit.

- Standard actions sit in equal-width button grids: two or three columns.
- Long actions span the full row instead of truncating or shrinking neighbours.
- **Micro actions inside page chips and thumbnail corners use icons only**, with
  `aria-label` and `title` carrying the wording: paper colour, duplicate, move
  up, move down, delete, retry mirror. Icons keep the 24px tier and never widen
  the chip or cover the photo.
- Only decorative illustrations inside layout previews may use SVG. They are not
  controls and must not be interactive.

## 4. Buttons and icon buttons

- Buttons and icon buttons share the tier height and the same material: a warm
  gradient, a 1px inset white top highlight, a soft outer shadow, and a 7px
  radius. Icon-only micro actions inherit the same material at 24px.
- Hover changes border, background, colour, or shadow only. **No `translateY`
  lift.**
- Panel actions keep a readable text label. Micro icon actions carry `aria-label`
  and `title` instead.
- Primary actions use the dark filled material. Secondary actions use the warm
  ghost material. Destructive actions use the danger tone only for the glyph.

## 4b. Typography roles

The project panel sets one font per role: title, deck and caption. The default
role is a single “默认” entry (the designed display face); every other entry is
a real font name. The Chinese UI lists only CJK-capable faces. Faces ship as
subset WOFF2 files under `public/fonts` and load on demand:

| Label | File |
| --- | --- |
| 思源宋体 | `NotoSerifSC-Regular.woff2` |
| 思源黑体 | `NotoSansSC-Regular.woff2` |
| 霞鹜文楷 | `LXGWWenKai-Regular.woff2` |
| 马善政毛笔楷书 | `MaShanZheng-Regular.woff2` |
| 志莽行书 | `ZhiMangXing-Regular.woff2` |
| 龙藏体 | `LongCang-Regular.woff2` |
| 得意黑 | `SmileySans-Regular.woff2` |

Role rules must reach descendants (`.magazine-text--title *`), because the page
renders text inside a nested editable span.

## 5. Dialogs and popovers

- Use `.surface-popover` material for dialogs: one thin outer border, a 1px
  inset white top highlight, a blur backdrop, and a soft large shadow.
- Do **not** add thick multi-pixel inner rings or dark frames around a dialog.
- The delete-confirmation dialog is the reference material. The AI layout dialog
  must match it rather than inventing a heavier shell.
- The AI dialog sizes to its content; it should not reserve a fixed tall body
  when there are only a few photos.

## 6. Selected states

A selected card or photo must be readable without hunting for a tiny check:

- A small high-contrast check for confirmation.
- The selection frame sits on the tile's own border (darker border plus one
  inset line). Never draw a frame floating inside the image or outside the
  tile, and never dim the photo.
- The selection must not change the tile's size, so horizontal and vertical
  grid gaps stay identical.

## 6b. Panel collapse

Every `.editor-panel` on the site (editor sidebars, editor canvas panels,
admin console, account console) is collapsible:

- `PanelCollapseToggle` renders a 22px skeuomorphic chevron in the panel's
  top-right corner; headers keep a 34px right padding so content never
  slides under it.
- Toggling adds `is-collapsed` to the section; CSS hides every direct child
  except the header. The delegated behavior lives in `ui/panelCollapse.ts`,
  and the collapsed state is remembered per route in localStorage.
- Never build a one-off collapse control inside a panel; reuse this one.

## 7. Typography and colour

- All site chrome uses the UI sans-serif stack.
- The display face is reserved for the rendered folio page only.
- Paper, ink, muted, and border colours come from the existing CSS variables.
- Do not introduce new one-off greys when an existing token is close.

## 8. Verification

Before shipping a UI change:

1. Run `npm run typecheck`, `npm run build`, `npm run validate:mvp`, and
   `npx playwright test`.
2. Check 360 / 390 / 768 / 1024 widths for horizontal overflow.
3. Confirm newly added controls use 24px or 36px, not a new height.
4. Confirm no hover rule contains `translateY`.
