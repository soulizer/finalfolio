# FinalFolio UI / performance overhaul — progress report

Date: 2026-11-24
Plan: `docs/ui-overhaul-plan-2026-11-24.md`

## Shipped in this pass

### Design tokens and cascade correctness
- Added spacing (`--space-7..10`), touch target, line, state colour and z-index
  tokens.
- Fixed admin KPI cards losing number size / gap / padding / radius to a later
  `.template-card` rule.
- Kept the compact upload button out of the editor action-grid reset.
- Unified coarse-pointer icon targets on one `--touch-target` token.
- Reader prev/next now use the shared control height.
- Removed duplicated panel toolbar/label and export-dialog geometry rules, and
  deleted verified-dead selector blocks (about 90 lines).

### Shared primitives
- `src/ui/InlineField.tsx` replaces the duplicated account/admin field wrapper.
- `src/ui/rowSelection.ts` gives selectable rows real keyboard support; the
  four account/admin list rows use it and share `PREVIEW_PAGE_SCALE`.
- `src/ui/useModalFocus.ts` is now used by confirm, AI arrange, layout editor,
  export center, admin AI provider and the mobile reader sheet: focus moves in,
  Tab is trapped, focus returns on close.
- Settings no longer inherits the users two-column page grid.

### Runtime performance
- JSZip and html-to-image are imported only when an export runs. The editor
  route chunk dropped from ~310 KB / ~89 KB gzip to ~202 KB / ~57 KB gzip.
- Preview images default to `loading="lazy"`; the editor canvas and print/export
  stack stay eager. Homepage hero previews use the thumbnail derivative and
  render 12 entries instead of 30.
- Session context is memoised and duplicate focus/visibility refreshes share one
  request. Global reveal/panel MutationObservers no longer scan per mutation.
- Reader layout refresh uses one immediate pass plus two settling passes instead
  of five fixed timers; the book owns its current page after mount.
- Reader page markup renders the whole book in one detached React root instead
  of one root per page.
- Server: object-storage config/secrets and the sync index are memoised with
  explicit invalidation; the SPA fallback caches the build id; upload variant
  generation is capped at four concurrent files.
- Export: image wait now times out instead of hanging forever, and stitched JPG
  exports fail clearly before exceeding canvas limits.

### Correctness
- Project typography now reaches the public reader, homepage preview, account
  strip and admin strip (the payload and every renderer thread it through).
- AI arrangement entry points carry the shared experimental badge.
- Modal, disclosure, header-gutter, row truncation and untranslated-label issues
  from the audit were addressed.

## Verification
- `tsc --noEmit`, `vite build`, `npm run validate:mvp`, full Playwright suite
  (64 tests) green before deploy.
- New regression tests: AI experimental badge, reader typography, keyboard row
  selection.
- Deployed commit `d38563c`; `/api/health` returns `{"ok":true}` and the served
  editor chunk no longer contains JSZip/html-to-image (lazy chunks only).

## Mobile reader follow-up

- Removed the bottom page/title status card; the top bar already carries the
  issue title and page range, so the duplicated block is gone.
- Reader chrome (top bar, previous/next) now sits in a grid row above and below
  the page viewport instead of floating over it. The paper can never be covered,
  including on a 320x568 screen.
- Mobile uses turn.js's native single-page display instead of a translated double
  spread. The camera no longer slides after a turn, so 3 -> 4 shows page 4
  directly instead of flashing page 5.
- Page wrappers/content no longer swallow the press event: turn.js receives the
  real page target, so dragging the paper follows the finger on touch and the
  pointer on desktop. Regression tests cover drag-follow and the parity turn.
- Closed mobile details sheets are inert/aria-hidden; page range updates are
  announced politely; arrow-key paging ignores form fields.

## Still open (next pass)
- Collapse the six pill/chip styles into `Tag`/`Chip`.
- One `EmptyState` and one `Disclosure` primitive.
- Shared dialog backdrop/panel tokens and removal of remaining duplicated shells.
- Migrate raw font-size/spacing/radius literals onto the token ramp.
- Lazy-import the AWS SDK on the server; add rate limits for project/upload writes.
- Optional: route-split CSS, tiled combined JPG export, turn.js resize timer
  replacement.

## Guardrails
- Reader shadow behaviour is unchanged: no global background shadow, per-page
  drop-shadow, paper back face, front-only content, image layer promotion.
- No new runtime UI framework; no tone change.
