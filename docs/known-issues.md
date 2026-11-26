# Known issues and residual risks

Last reviewed: 2026-11-26

This replaces the old issue register. It lists only issues that are still
relevant; completed work lives in git history and the regression suites below.

## Current limitations

### Reader

- **Cover back-face limitation.** turn.js has one DOM face per sheet in this
  integration, so opening the cover can show page 2 on the curling back face.
  A correct fix requires pairing pages into front/back paper sheets, not a CSS
  mirror. Do not attempt a CSS-only hack again.
- Reader controls are intentionally minimal on mobile; the top bar and prev/next
  stay in layout flow so they never cover the paper.

### Export

- JPG “single stitched image” is guarded against browser canvas limits and fails
  with a clear message instead of producing a partial image. Tiling a very tall
  folio is still future work.
- PDF export is single-page output; imposition/fold-sheet planning is not
  implemented. Preflight only covers odd page counts and binding margins.
- Print-stack image waiting times out after 20s instead of hanging forever.

### AI

- Provider API keys are stored with `0600` permissions but are not encrypted at
  rest yet.
- AI output is validated but still needs human review; quality depends on the
  configured vision model.
- Quotas are per-user total/daily counts; there is no recharge or per-user
  override UI beyond the usage counters.
- AI arrangement is experimental and labelled as such.

### UnAlbum

- The integration stays hidden until the environment variables are configured.
- UnAlbum must expose the agreed OAuth/profile/photos contract; FinalFolio's
  side is complete and idempotent.
- Imported photos keep upstream analysis; upstream errors/limits are reported
  through the normal error surface.

### Platform / code quality

- `EditorPage.tsx` and several state hooks remain large; splitting the layout
  picker, project metadata and stage editing is still desirable.
- CSS is a single stylesheet; route-splitting or critical CSS is future work.
- No ESLint/Prettier gate in CI yet.
- JSON file store remains the source of truth; no database migration is planned
  in the current scope.
- Custom layouts live in browser `localStorage`, not on the account.
- Font subsets cover common characters; rare CJK glyphs fall back to system
  fonts.
- Old drafts/templates keep their original language; only system copy and new
  pages are localised.
- SMTP password rotation after the historical exposure is an operational task,
  not a code change.
- URL import resolves DNS and re-checks redirects; pinning the resolved IP would
  close the remaining DNS-rebinding window.

## Regression invariants

These are the rules most likely to be broken by future UI work:

1. Reader: every page has its own shadow; no global background shadow; shadows
   survive drag/turn; mobile and fullscreen included.
2. Reader: mobile chrome never overlaps the paper; page 1/last page do not slide
   the camera after turning; 3 → 4 shows page 4, not page 5.
3. Reader: project fonts reach public, homepage, account and admin previews.
4. Gallery: selection is the check control only; no extra ink frame/double ring.
5. Actions: delete is a trash icon; destructive actions confirm; one primary
   button per view.
6. Uploads: direct and proxy paths produce the same asset record; failed mirrors
   never roll back a usable local asset.
7. Save: autosave never loses edits; second-tab overwrite returns 409.
8. Legal/auth: language follows the active locale, including email/legal links.

## Verification map

| Area | Check |
| --- | --- |
| Reader | `tests/e2e/reader-turn.spec.ts` |
| Gallery / multi-select | `tests/e2e/multi-select.spec.ts` |
| Editor flows | `tests/e2e/editor-*.spec.ts`, `consistency.spec.ts` |
| Account/admin/AI/UnAlbum | `tests/e2e/unalbum.spec.ts`, `ai-arrange.spec.ts`, `design-rules.spec.ts` |
| Save races | `tests/e2e/save-race.spec.ts` |
| Build/API/source | `npm run validate:mvp` |
