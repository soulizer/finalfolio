# CrazyAlbum Devlog

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
