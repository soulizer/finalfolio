# FinalFolio Design System

The editor and admin are dense tools. Consistency is enforced from a small set
of tokens instead of per-screen fixes. New controls must use these rules before
adding new CSS.

## 1. Control heights

| Tier | Height | Use |
| --- | --- | --- |
| Micro icon | **24px** | Page-chip actions, gallery thumbnail corners |
| Dense editor / admin | **36px** | All normal buttons, icon toolbars, segmented controls, crop tools, account and project actions |
| Public site | **44px** | Marketing and auth calls to action |

A 36px control and a 36px icon button must line up in the same row. Do not give
one text button a 40px height while its neighbours stay at 36px. The AI button,
save button, account button, template button, fill/fit toggles, and crop pad all
use the same 36px tier.

## 2. Spacing

Use the existing 6 / 8 / 10 / 12 / 16 spacing steps.

- Toolbar gap: **6–8px** between icon buttons.
- Mixed button rows: **16px** gap so the optical gap remains around 10px after
  borders and inner padding.
- Panel padding: **12–14px**.
- Page chip padding: **12px 14px**; corner actions sit **14px** inside the card.
- Thumbnail corner actions sit **14px** from the top and right edges.

## 3. Text-first actions

Functional controls use **text labels**, not icon-only buttons. This keeps the
meaning explicit and avoids a second visual language competing with the folio
typography.

- Standard actions sit in equal-width button grids: two or three columns.
- Long actions span the full row instead of truncating or shrinking neighbours.
- Micro actions inside page chips and thumbnails use short text labels such as
  “复制 / 上移 / 下移 / 删除” in a 24px pill.
- Only decorative illustrations inside layout previews may use SVG. They are not
  controls and must not be interactive.

## 4. Buttons and icon buttons

- Text buttons and icon buttons share the 36px height and the same border,
  shadow, and hover treatment.
- Hover changes border, background, colour, or shadow only. **No `translateY`
  lift.**
- Every button keeps a readable text label; `aria-label` is only added when the
  visible label needs a longer explanation.
- Primary actions use the dark filled material. Secondary actions use the warm
  ghost material. Destructive actions use the danger tone only for the glyph.

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

- An outer focus ring.
- A light inner frame or pressed shadow.
- A small high-contrast check for confirmation.
- Selected images may dim slightly so the frame reads clearly.

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
