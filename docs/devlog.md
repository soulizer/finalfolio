# CrazyAlbum Devlog

## 2026-03-26 Full-Height Editor Shell Pass

### What changed

- Rebuilt `/editor` so the desktop shell is now a true three-column workspace: page sequence/navigation moved into the left rail, the center column is reserved for the live page surface, and the former top/project bars now live inside the right-side controls instead of burning viewport height above the preview.
- Increased the usable live-page area by widening the overall editor shell, trimming desktop padding/gaps, and letting the main layout run at practical viewport height. The A4 preview scale still measures real canvas padding, so the existing fit logic remains intact while the center stage gets materially closer to full-screen use.
- Retuned sidebar behavior around the new layout. The left rail now presents the page strip as a vertical navigation list on desktop, while the right rail stacks project actions and page controls in a narrower panel format without reintroducing horizontal spill.
- Extended `validate:mvp` with source assertions for the new navigation/stage/control rail structure because this sandbox still cannot render a browser proof of the final shell.

### Validation

- `npm run typecheck`
- `npm run build`
- `npm run validate:mvp`

### Remaining limits

- This sandbox still cannot produce a browser-rendered proof of the new fullscreen-oriented shell, so final sign-off should still include one real desktop browser pass covering page navigation, edit controls, crop controls, and Print / PDF from the revised rail layout.
- The source assertions protect the intended shell structure, but they do not replace checking actual perceived balance on large monitors and smaller laptops with real project content.

## 2026-03-26 Acceptance Fix Pass

### What changed

- Rebuilt the large-screen editor shell around a fixed-height center stage so the live A4 page stays visually anchored and materially larger. The left and right rails now own the desktop scrolling behavior, the stage header is compact, and the page strip has been reduced to a smaller horizontal sequence rail instead of stealing a full block of vertical space.
- Added persistent per-page paper themes across draft state, server saves, reopen flows, and print output. Editors can now choose `Warm beige`, `Pale blue`, `Pure white`, or `Light gray`, and the selected theme applies to the live preview surface, image frame treatment, and printed page background together.
- Simplified print pagination so exported sheets break before each subsequent page instead of forcing `break-after` on every page wrapper. This removes the trailing blank page path while keeping the same A4 preview/print component tree.
- Fixed class-name drift between the preview markup and stylesheet for `mosaic`, `triptych`, and `custom` pages while doing the acceptance pass. That keeps the template-pack and custom-template work coherent instead of letting the new layout/theme changes sit on top of already-misaligned page CSS.
- New pages created after the current page now inherit the current page theme so a themed issue can be extended without reapplying the same surface choice page by page.

### Validation

- `npm run validate:mvp`

### Remaining limits

- This sandbox still cannot produce a browser-rendered print proof, so the blank-last-page fix and the revised large-screen preview balance still need one manual browser pass in a socket-enabled environment.
- The acceptance fix preserved the existing template-pack and custom-template data flow, but those paths should still be included in that manual pass because their final sign-off depends on rendered layout rather than store/state validation alone.

## 2026-03-26 Editor Layout Balance Pass

### What changed

- Rebalanced the large-screen editor shell around a practical `1 / 2 / 1` column split so the Live page gets roughly half of the working width while the asset and controls sidebars each keep about a quarter.
- Reduced the maximum editor shell width at desktop scale so the center preview no longer balloons back into the old over-wide state on very large monitors even with the restored emphasis.
- Tightened sidebar resilience instead of undoing recent template work. The template chooser and custom-template coordinate grids now fit the right rail more predictably, and key editor headers/cards can wrap instead of forcing horizontal spill.
- Updated live preview scaling to measure the editor canvas using its real padding rather than a hardcoded inset, which keeps the A4 page fit correct after layout spacing changes.

### Validation

- `npm run typecheck`
- `npm run build`
- `npm run validate:mvp`

### Remaining limits

- This sandbox still cannot produce a browser-rendered proof of the revised large-screen balance, so final visual sign-off should still include one manual desktop pass in a real browser.
- The right sidebar is now materially less spill-prone, but the custom-template builder remains dense by design and should still be sanity-checked with unusually long frame labels or issue copy during that browser pass.

## 2026-03-26 Hardening Follow-up

### What changed

- Made the live editor page less wasteful by scaling the sheet against both the available width and the available height in the stage, not width alone. The page now stays inside a predictable editing frame instead of expanding until it steals more room from the rest of the workflow.
- Strengthened uploaded asset handling in the editor itself. The asset panel now exposes placed vs unused counts, lets editors remove unused uploads from the current issue without touching the server file, and keeps the saved project cleaner so later server-side pruning can work safely.
- Added placement-aware asset operations around the selected frame. Editors can now see every page/slot where the current image is used, jump directly to those placements, and clear the same image from all pages in one action when a mistaken upload or repeated placement needs to be unwound quickly.
- Extended source-level validation so the hardened asset controls are part of the guarded MVP surface, rather than an untracked UI tweak.

### Validation

- `npm run typecheck`
- `npm run build`
- `npm run validate:mvp`
- `npm run uploads:manage -- list --data-root /tmp/crazyalbum-upload-audit-empty`

### Still blocking final acceptance

- Final acceptance still needs one browser-run pass with real uploaded images covering editor preview, preset switching, fit/crop changes, save/reopen, and Print / PDF output. This sandbox can build and validate, but it cannot produce the final rendered browser proof.
- There is still no authenticated in-app operations surface for upload inventory or pruning. The safe path exists as an admin CLI, which is materially better than no path, but final product completeness would ideally expose the same operational visibility behind real admin controls.
- Preview/export parity is materially closer because both use the same fixed sheet geometry, but final sign-off still depends on checking at least one real browser PDF against the editor preview with mixed aspect ratios and dense copy.

## 2026-03-26 Release Hardening

### Problem analysis

- The editor shell spent too much of the viewport on chrome, verbose spacing, and fragmented controls, which reduced the actual page area while editing.
- Page geometry was not isolated from uploaded image behavior. Different intrinsic image ratios could push slot heights around, and the crop model had no explicit fit mode.
- Preview and print were rendered from the same component tree but with materially different page sizing, padding, and responsive rules, so exported PDF output could diverge from the live editor page.
- Template workflow was too thin for a production editor. Only a small preset set existed, and switching templates did not provide a safe image-carryover path.
- Uploaded images had no admin cleanup path. Server-stored test uploads could accumulate indefinitely if they were never referenced by a saved project.

### Solutions

- Tightened the editor shell by reducing panel chrome, shrinking gutters, moving template actions into a compact preset panel, surfacing asset placement counts, and giving the live page more room in the center column.
- Made page geometry stable by turning image frames into fixed clipping surfaces with absolute-positioned media, adding explicit `cover` / `contain` fit state to crops, and resetting crop placement predictably when a new image is assigned.
- Reworked preview/print parity so the editor now shows the same A4 page surface that print uses, scaled down in-place rather than redrawn with separate responsive page rules. The print stack now uses the same sheet geometry and page content classes.
- Added useful preset templates beyond the original four: `folio`, `panorama`, `mosaic`, and `triptych`. Applying a template now preserves matching slots first and then carries remaining assigned images forward in slot order.
- Implemented the first product-safe upload management path: `store.collectUploadInventory()` and `store.pruneUnreferencedUploads()` on the server plus `npm run uploads:manage` as an admin CLI. The cleanup flow is dry-run by default and only deletes explicitly requested unreferenced uploads older than a chosen threshold.

### Validation

- `npm run typecheck`
- `npm run build`
- `npm run validate:mvp`
- `npm run uploads:manage -- list --data-root /tmp/crazyalbum-upload-audit-empty`

### Remaining risks

- This sandbox still cannot run a live browser/server session, so PDF parity is validated through build output, server tests, and source assertions rather than a rendered browser print capture.
- Fixed geometry now wins over content expansion. That is the correct tradeoff for layout stability, but unusually dense page copy can still become cramped and should be checked in a browser with real content.
- Upload cleanup is intentionally admin-triggered, not automatic. That keeps it product-safe, but teams need an operational habit or scheduled job to actually prune old unreferenced uploads.
- Very old unsaved local drafts can still lose uploaded files if an admin intentionally prunes old unreferenced assets past the configured age threshold. That is safer than silent accumulation, but it should be documented operationally.

### Next steps

- Run one browser-level pass in a socket-enabled environment covering upload, preset switching, image fit/crop changes, save/reopen, and Print / PDF export against at least one real image set with mixed aspect ratios.
- Add a browser E2E path for the same sequence so preview/export parity stops depending on manual inspection.
- If product operations need an in-app control later, build it on top of the new inventory/prune store helpers with real admin authentication rather than exposing cleanup actions anonymously.

## 2026-03-26 MVP Cleanup

### What changed

- Kept the server-backed MVP path and tightened it instead of reverting to a local-only editor.
- Hardened the server project validator so issue saves now enforce identifier uniqueness, slot/template shape matching, crop bounds, asset path constraints, and per-field text limits.
- Locked uploads to raster image formats that the editor and print flow can handle predictably: JPG, PNG, WebP, GIF, and AVIF.
- Shifted the default editor draft to an empty uploaded-photo workflow instead of shipping sample assets inside every new issue.
- Expanded the editor sequence controls so pages can be added after the current page, duplicated in place, moved earlier or later, and removed while preserving print order.
- Kept print and PDF output as artwork-only pages by rendering non-interactive preview frames for the print stack, hiding the editor shell in `@media print`, and suppressing empty-frame placeholder copy in the print path.
- Added page numbering in the live preview and print stack so export order is visible without adding editor chrome to the printed page.
- Split the server into a reusable `createApp()` / `createProjectStore()` module so MVP validation can exercise persistence and sanitization in-process even though this sandbox cannot open a listening socket.

### Validation

- `npm run build`
- `npm run validate:mvp`
- `validate:mvp` rebuilds the app, exercises the server-backed project store against a temporary data root, verifies upload file validation, confirms page-order persistence, checks that legacy `/uploads/*.svg` records can still reopen, and asserts the print-only CSS/editor hooks that protect PDF output.

### Validation environment

- The sandbox denies opening a listening socket (`listen EPERM`), so validation cannot use a live localhost server in this environment.
- To keep validation real instead of skipping it, the server logic was split into `server/app.js` so the project store and validation rules can be exercised in-process.

### Risks

- Print styling is validated through source assertions and production build output, not through a browser-rendered PDF capture, so final paper geometry should still be checked once the app is run in an environment that permits `listen()`.
- Unsaved local drafts can upload images to the server before a stable issue URL is created, which means abandoned drafts can still leave orphaned upload files behind on disk.

### Remaining limitations

- There is still no automated browser-level E2E pass for upload, reopen-by-URL, reorder, and PDF export; the current validation is strong for model/state integrity but not for browser rendering.
- Existing uploads already stored as SVG files remain readable because saved project assets only validate by local path prefix. New uploads now reject SVG intentionally, but one manual reopen/export pass against an old SVG-backed issue is still advisable.
- The editor assumes a single-user last-write-wins workflow. Stable URLs make reopening reliable, but there is no collaboration locking or conflict resolution yet.

### Next steps

- Run the built app in a socket-enabled environment and do one manual browser pass covering upload, save, reopen by stable URL, page reorder, and Print / PDF output.
- If that pass is clean, add a browser E2E harness for the same sequence so print-shell regressions stop depending on manual review.
