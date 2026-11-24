# FinalFolio UI / code overhaul plan — 2026-11-24

## Goal

Keep the existing warm paper tone, but make the UI system consistent: same-type
elements share one primitive, spacing/height/radius/shadow come from tokens,
alignment is structural, important actions win, secondary actions recede, and
the reader/editor stay smooth on desktop and mobile.

AI arrangement is explicitly experimental and badged as such.

## Non-negotiables

- No new heavy UI framework. Keep React + plain CSS + Vite. No Tailwind migration.
- No global tone change: warm paper background, serif only inside folio pages,
  sans-serif functional UI, soft skeuomorphic controls.
- Existing public behaviour and e2e tests must keep passing. Each phase ships
  with targeted tests and a full suite run.
- Do not fix one panel by introducing another one-off class. New work consumes a
  shared primitive/token.

## References studied (patterns, not visual copies)

- GrapesJS (`github.com/GrapesJS/grapesjs`) — separation of panels, block/asset
  managers, one toolbar/action primitive, style manager as tokens.
- shadcn/ui + Radix (`github.com/shadcn-ui/ui`) — composable primitives,
  data-attribute variants, accessible dialog/disclosure, shared class merging.
- Tremor (`github.com/tremorlabs/tremor`) — dashboard layout hierarchy: card,
  grid, section title, primary/secondary action emphasis.
- StPageFlip / react-pageflip (`github.com/Nodlik/StPageFlip`,
  `github.com/Nodlik/react-pageflip`) — page-turn engine separate from chrome;
  reader controls are an overlay/sidebar around a self-contained book.
- Immich (`github.com/immich-app/immich`) — responsive photo grid, hover/focus
  selection affordance, one selection model, progressive image loading.

## Target primitives

`src/ui/` should own the shared surface:

- `Button` variants: primary, ghost, danger-ghost, micro, icon; sizes sm/icon/micro.
- `DeleteIconButton` (already exists; becomes the only row delete).
- `InlineField` (replaces duplicate account/admin inline fields).
- `Tag` / `Chip` (meta pill vs interactive filter chip).
- `Panel` / `PanelHeader` / `PanelActions` (heading + meta + collapse).
- `RowActions` (one alignment/height/gap recipe for account/admin rows).
- `EmptyState`, `Modal`/`Dialog`, `Disclosure`, `ExperimentalBadge`.
- `Spinner` / `LoadingStack` remains.

Layout helpers stay CSS-only: `stack`, `grid`, `row`, `cluster`, plus the
existing shell classes. Container queries replace magic breakpoint toggles where
a panel's own width matters.

## Token set (additive first, then migrate)

Heights/touch: `--control-height-lg: 44px` (coarse), existing sm/xs/default.
Spacing: extend to `--space-7..10`; add component tokens `--panel-pad`,
`--card-pad`, `--row-gap`.
Text: `--text-2xs..--text-3xl`; alias current values during migration.
Color/state: `--line-1/2/3`, `--success`, `--warning`, `--danger`,
`--danger-ink`, `--surface-border-white`.
Z: `--z-sticky/popover/modal/confirm/skip`.
Radius: reuse `--radius-xs..xl`; add `--card-radius`.

## Order of work

0. **Baseline** — audits, full suite, current production known-good. (done)
1. **AI experimental** — shared badge on editor entry, AI dialog, admin AI
   panels. (done, pending deploy)
2. **Token + cascade cleanup (pure win)** — add tokens; delete dead/duplicated
   blocks that silently override newer rules; fix KPI stat card and compact
   upload button cascade. No component churn.
3. **Row/action primitive** — account/admin projects/uploads/templates/users
   use one `RowActions`; keyboard-accessible selection; shared preview scale.
4. **Dialog/disclosure primitive** — confirm, export, AI arrange, layout editor,
   admin AI provider, mobile sheet share one backdrop/panel/focus recipe.
5. **Editor panel + chip migration** — page strip, filters, asset tiles, library
   cards consume `Tag`/`Chip`/`PanelHeader`; remove one-off boxes.
6. **Layout/alignment pass** — replace fixed heights/min-heights that add dead
   space; align header action gutters; mobile reader chrome offsets derived from
   real control heights.
7. **Performance pass** — code-split heavy exports, lazy images, remove
   per-frame DOM writes, memoize expensive editor/reader trees, server payload
   trimming. Verify bundle and interaction timings.
8. **Visual regression + polish** — desktop/mobile screenshots at key states,
   contrast/focus checks, reduced-motion, then final deploy.

## Dependencies

No new runtime dependency is required. Optional micro-helper `clsx` may be added
only if class composition becomes repetitive; plain template strings are fine
today. Do not add Radix/Tailwind merely to copy shadcn markup.

## Verification per phase

- `tsc --noEmit`, `vite build`, `npm run validate:mvp`, full Playwright.
- New e2e assertions for each unified primitive (delete icon, row height, modal
  focus, empty state, experimental badge).
- Desktop + coarse-pointer/mobile viewport checks for reader and admin.
- Bundle size / chunk list before and after the performance phase.
