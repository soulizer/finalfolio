# FinalFolio Design System

The editor and admin are dense tools. Consistency is enforced from a small set
of tokens instead of per-screen fixes. New controls must use these rules before
adding new CSS.

## 1. Control heights

| Tier | Token | Height | Use |
| --- | --- | --- | --- |
| Micro icon | `--control-height-xs` | **24px** | Page-chip actions, gallery thumbnail corners, panel collapse chevrons, colour swatches |
| Dense editor / admin | `--control-height-sm` | **36px** | `button--small`, sidebar fields, toolbar rows, dialog footers, inline geometry fields |
| Standard | `--control-height` | **40px** | Default buttons, standalone form fields, captcha, panel inputs |
| Public site | `--control-height-sm` + coarse pointer | **44px** | Marketing and auth calls to action on touch (`@media (pointer: coarse)`) |

Every control in one row uses the same tier. Inputs never exceed the button
height beside them: a 36px footer button pairs with a 36px name field, and a
40px panel input pairs with 40px buttons.

The tiers are declared once. A dense surface re-scopes the token instead of
re-declaring heights per field:

```css
.editor-sidebar,
.admin-config-table__cell,
.layout-editor-geometry,
.admin-ai-usage__fields,
.admin-ai-usage__search,
.import-url-form {
  --control-height: var(--control-height-sm);
}
```

A zero-specificity `:where(input[type=…], select)` rule gives every single-line
field the shared default height, including inputs written without an explicit
`type` attribute (they otherwise fall back to the ~19px UA default). Contexts
only override the token, never `min-height`, so one rule stays authoritative.

Panel headers are one 24px row: the label, `.panel-tag`, `.editor-collapsible-meta`
and the collapse chevron all measure 24px inside a 32px toolbar. Never give the
tag a taller box than the chevron; the row then looks ragged even when the
centres match.

## 1b. Radius scale

One scale, referenced by token. A literal radius in a rule is a bug unless it is
`50%` (circles), `1–2px` (miniature schematic art) or a page-content radius that
the user controls (`--page-frame-radius`).

| Token | Value | Use |
| --- | --- | --- |
| `--radius-xs` (`--control-radius`) | 4px | Buttons, inputs, chips, thumbnails |
| `--radius-sm` (`--surface-radius`) | 8px | Sub-panels, popovers, small cards |
| `--radius-md` | 12px | Panels, layout cards, the editor canvas |
| `--radius-lg` (`--radius`) | 20px | Dialogs, topbar, large cards |
| `--radius-xl` | 28px | Marketing cards and feature panels |
| `--radius-pill` | 999px | Tags and pills |

## 2. Spacing

Use the 4px scale: `--space-1` 4, `--space-2` 8, `--space-3` 12, `--space-4` 16,
`--space-5` 20, `--space-6` 24. 6px and 10px remain acceptable for legacy
optical tweaks but new rules should land on the scale.

- Toolbar gap: **6–8px** between icon buttons.
- Mixed button rows: **16px** gap so the optical gap remains around 10px after
  borders and inner padding.
- Panel padding: **12–14px**.
- Page chip padding: **12px**, plus the 1px border, puts the action row **13px**
  from the chip edge.
- Thumbnail corner actions sit **13px** from the top and right edges so their
  optical inset matches the page-chip actions.

## 2b. Type roles

- UI chrome (buttons, labels, tags, eyebrows, tables, hints) always uses
  `--font-ui`. Monospace is reserved for values where digit alignment matters:
  the zoom input, AI elapsed time, page numbers and the captcha code.
- The editorial serif is only used inside `.magazine-page`. Every text node on
  a page must carry a role class so the four project fonts reach it:
  title, deck, caption (kickers and small labels), body.
- The layout name is library metadata. It must never be printed on the page.

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
- Floating popovers render through a portal on `document.body` with fixed,
  viewport-clamped coordinates, following the Radix popover anatomy
  (trigger → portal → content). They must not be absolute children of a
  scrolling strip: the strip's overflow clips them and later panels cover them.
  Close them on outside pointer-down, Escape, scroll and resize.
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

## 6b. Panel collapse and sub-sections

Every `.editor-panel` on the site (editor sidebars, editor canvas panels,
admin console, account console) is collapsible:

- `PanelCollapseToggle` renders a 24px skeuomorphic chevron as the last child
  of the header row (the label's `margin-right: auto` pushes the tag and
  chevron to the right). Headers need no reserved right padding.
- Toggling adds `is-collapsed` to the section; CSS hides every direct child
  except the header. The delegated behavior lives in `ui/panelCollapse.ts`,
  and the collapsed state is remembered per route in localStorage.
- Never build a one-off collapse control inside a panel; reuse this one.

A panel that contains two editing regions (for example Page content = text +
image frame) uses `EditorSubsection` — a native `<details>` styled by
`.editor-subsection` — for the secondary region. The native element cannot
trigger the delegated panel collapse, so folding "Image frame", "Image corners"
or "Folio details" keeps the parent panel open.

## 6c. Copy voice

- Write what the user gets, not how the system is built. No "governance
  language", "one-shot canvas", "the product falls back to…" on customer pages.
- Chinese is written as Chinese, not translated English: short clauses, real
  verbs, no stacked 的/进行/一个. Avoid "有呼吸感"、"所见即所得" as filler.
- Admin copy may be operational, but still names the object and the action.

## 7. Typography and colour

- All site chrome uses the UI sans-serif stack.
- The display face is reserved for the rendered folio page only.
- Paper, ink, muted, and border colours come from the existing CSS variables.
- Every field outline uses `--field-border` / `--field-border-color`
  (`1px solid rgba(17, 17, 17, 0.16)`). Do not paste the rgba literal into a
  rule: it drifts, and a token that references itself silently invalidates the
  whole `var()` chain.
- Do not introduce new one-off greys when an existing token is close.

## 8. Verification

Before shipping a UI change:

1. Run `npm run typecheck`, `npm run build`, `npm run validate:mvp`, and
   `npx playwright test`.
2. Check 360 / 390 / 768 / 1024 widths for horizontal overflow.
3. Confirm newly added controls resolve to 24 / 36 / 40px, not a new height.
   `tests/e2e/editor-ux.spec.ts` pins the sidebar tiers, chevron tier and the
   single field outline; `validate:mvp` rejects new hardcoded field borders.
4. Confirm no hover rule contains `translateY`.
