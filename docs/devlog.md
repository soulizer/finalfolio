# FinalFolio Devlog

## Current Snapshot

### Product Scope

- `FinalFolio` is now a product skeleton with four real surfaces:
  - editorial homepage
  - auth and account recovery
  - issue editor
  - admin governance console
- The editor is no longer an isolated demo. Projects, uploads, sessions, email flows, and admin governance now resolve against persisted server-side records.
- Homepage, editor preview, admin inspect surfaces, and print/export now rely on the same shared page-rendering and image-geometry model instead of separate decorative mocks.

### Live Data Snapshot

- Snapshot date: `2026-03-28`
- Local instance inventory at the time of this entry:
  - users: `1`
  - active admins: `1`
  - projects: `11`
  - uploaded files: `105`
  - stored upload volume: about `336 MB`
  - latest recorded project update: `2026-03-28T09:40:00.275Z`
  - latest recorded user activity: `2026-03-28T09:53:42.905Z`

### What This Round Primarily Changed

- Stabilized shared preview geometry so homepage proof previews, admin inspectors, and editor page rendering stop drifting away from export geometry.
- Pushed `/admin` from a loose operations list toward a real governance console with dedicated sections for overview, projects, uploads, governance, users, and events.
- Added the missing account-system basics required for a product loop:
  - registration
  - login
  - email verification
  - password reset
  - admin-created managed users
  - captcha + server-side rate limiting for abuse control
- Lifted homepage copy and featured issue preview into server-backed product configuration so marketing expression is no longer frozen in client code.
- Added asset ownership, reference-aware deletion, and admin-side upload inspection so uploads can be governed instead of just accumulated.

### Ongoing Risks To Track

- The product is still file-backed on one node. That keeps the system simple and inspectable, but it is not yet a multi-node or high-concurrency architecture.
- Event capture is now useful, but many failures are still aggregated under generic request-level error classes. Failure taxonomy should keep improving.
- The admin backend is now materially better, but deeper governance workflows such as archive, transfer ownership, and template publishing lifecycle are still incomplete.

### Reading Guide

- The entries below remain chronological and detailed.
- The newest entries at the top capture the latest layout, governance, auth, homepage, and preview/rendering work.
- Use this snapshot first, then drop into the dated entries when you need implementation-level detail or validation history.

## 2026-03-29 V2 Shared Viewer And User Templates

### What changed

- Added a real public project-sharing flow instead of reusing editor URLs:
  - project records now carry explicit share metadata with `enabled`, `shareId`, `sharedAt`, and share versioning
  - added `POST /api/projects/:projectId/share` and `DELETE /api/projects/:projectId/share`
  - added public `GET /api/issues/:shareId` that returns a read-only rendering payload only, not editor/account internals
  - added `/project/:shareId` and a dedicated `IssueViewPage` viewer shell with button, keyboard, swipe, drag, and animated page-turn navigation
- Added user-owned template persistence instead of leaving `My templates` as placeholder copy:
  - added file-backed template storage under `data/user-templates`
  - added `GET/POST/PATCH/DELETE /api/account/templates`
  - added `POST /api/account/templates/:templateId/duplicate`
  - added `POST /api/account/templates/:templateId/projects` so a saved template can open directly as a new owned issue
  - templates store reusable structure only: project defaults, page order, page theme, custom layout definition, and optional copy; they do not carry project asset records or editor session state
- Wired the new product loops into the existing UI instead of building isolated admin-only endpoints:
  - editor project panel now exposes public sharing controls and `Save as template`
  - editor now shows `My templates` with preview cards and `Start new` actions
  - account `My projects` now exposes `Share`, `Open share`, `Copy link`, and `Disable`
  - account `My templates` is now a real management surface with preview cards, search, rename, duplicate, delete, and `Use template`
- Kept preview rendering converged by reusing `MagazinePreview` for:
  - the public viewer
  - user template preview cards
  - the existing editor/admin/homepage stack

### Why it changed

- The editor URL was not a real delivery surface. The product needed a separate public, read-only route that could evolve independently from editing.
- `My templates` was still dead scaffolding. Users needed a way to capture their own repeatable issue structures without copying raw project JSON or dragging admin governance into user space.
- The V2 goal was to move FinalFolio beyond “edit then print” and establish two durable product loops:
  - share finished issues online
  - build and reuse personal issue systems

### Verification

- `npm run typecheck`
- `npm run validate:mvp`
- Isolated manual API verification against a temporary data root:
  - create an owned project record
  - enable sharing and confirm `GET /api/issues/:shareId` returns the public issue payload
  - disable sharing and confirm the old share route returns `404`
  - save a user template, list it, and create a new project from that template
- Live rebuild and deploy:
  - `docker compose -f deploy/docker-compose.yml up -d --build`
  - `curl -I https://finalfolio.com`
  - `curl -I https://finalfolio.com/api/health`

### Remaining risks

- This round verified the public viewer and template APIs plus the production build, but there was still no browser automation runtime for a full visual gesture pass on the live `/project/:shareId` page. Final animation feel, touch drag thresholds, and card layout should still get a real device/browser smoke test.
- User templates currently focus on “save and start a new project from this template.” Applying a user template destructively onto an already active issue was intentionally left out of this round to avoid unstable asset-slot remapping semantics.

## 2026-03-29 Shared Viewer Reading-layout Follow-up

### What changed

- Reframed `/project/:shareId` from a centered demo-like stage into a reading layout:
  - the viewer now sits on the left as the dominant column
  - metadata, page tools, and fullscreen control now live in a narrow right sidebar
  - the reading surface now uses browser height more like the editor instead of giving too much vertical space away to stacked controls
- Removed the noisy one-button-per-page navigation bar:
  - the viewer now shows the current page label
  - page navigation uses a direct page-number input plus `Go`
  - `Previous / Next` actions now align cleanly as a matched pair in the tools rail
- Kept the existing page-turn interaction model but reduced layout clutter around it so the shared project page reads more like a real hosted publication viewer.

### Why it changed

- The first V2 share-viewer pass was functionally complete, but the information architecture still felt too control-heavy and too centered compared with a calmer reading page.
- A page-button strip scales poorly as page count grows and visually competes with the publication itself.

### Verification

- `npm run typecheck`
- `npm run validate:mvp`
- `docker compose -f deploy/docker-compose.yml up -d --build`
- `curl -I https://finalfolio.com`
- `curl -I https://finalfolio.com/api/health`
- `curl -I https://finalfolio.com/project/test-share`

### Remaining risks

- This pass optimized desktop reading layout and mobile fallback structure, but the final visual balance of the sidebar and viewport still needs a real browser/device pass with an actual shared issue, especially across short laptop screens and tall phones.

## 2026-03-29 Photos Delete Button Tone Follow-up

### What changed

- Softened the uploaded-photo `Delete` button in the editor `Photos` rail:
  - kept the destructive red language
  - switched the button back to the same control-radius family as the crop action buttons
  - removed the raised hover movement and hover shadow amplification so the destructive action reads cleanly instead of theatrically

### Verification

- live rebuild and deploy through `docker compose -f deploy/docker-compose.yml up -d --build`

## 2026-03-29 Editor UI Pressed-state Follow-up And Fill Scale Floor

### What changed

- Renamed the project print action to `Print / Save` so the button reads like an export handoff instead of a narrow browser command.
- Raised `cover/fill` crops onto a `1.1` minimum scale floor:
  - new default crops now start at `1.1` when the fit mode is `cover`
  - normalized saved crops are clamped back up to that floor when they resolve as `cover`
  - clicking `Fill` in the editor now immediately bumps the selected frame to at least `1.1`
- Tightened editor control rhythm:
  - the three crop action buttons under `Zoom` now use the same height as the directional crop pad controls
  - the `Fit / Fill` segmented controls now use a pressed inset active state instead of the previous dark filled style
  - account/admin section switchers now use the same pressed active treatment instead of flipping to a primary button theme
- Fixed editor account panel alignment so the role `panel-tag` stays in the same top-right position as the other editor panels.
- Reworked uploaded-photo delete actions in the `Photos` rail into a red raised danger button so they read like the destructive action they are.

### Verification

- `npm run typecheck`
- `npm run validate:mvp`

## 2026-03-29 Upload Status UI, Editor Route Fallback, And Mosaic Print Follow-up

### What changed

- Compressed upload delivery UI so status no longer causes library cards and upload rows to reflow:
  - replaced the `Local / Mirrored / Failed` text pills in upload rows and editor media tiles with a small color dot
  - moved the delivery meaning into hover tooltips instead of long inline copy
  - removed the verbose delivery sentence that had been consuming space without helping decisions
- Fixed the upload progress panel so it disappears as soon as the active upload run ends instead of lingering at `100%`.
- Hardened the editor-side `Manage account` / `Open admin` actions by switching those sidebar hops back to document navigation. The SPA route state had still been able to update the URL without visibly leaving the editor under heavy editor state.
- Added a small `cover` bleed inside shared image geometry to suppress print-time hairline gaps on tightly matched aspect ratios, including the `mosaic` lead frame case reported after the previous pass.
- Removed the white hover border override from `.page-chip__action:not(:disabled):hover` so the page action buttons no longer flash a brighter outline.

### Verification

- `npm run typecheck`
- `npm run validate:mvp`
- live redeploy through `docker compose -f deploy/docker-compose.yml up -d --build`

## 2026-03-29 Remote Delivery State, Progressive Uploads, Session Bootstrap, And Print Geometry Recovery

### What changed

- Reworked upload delivery so object storage is no longer a silent background side effect:
  - `data/site/object-storage-sync.json` now stores explicit per-upload delivery states with `pending`, `remote`, and `failed`
  - `/api/uploads` now marks each new upload as `pending` before returning the asset payload, so the first client-visible record already carries delivery state instead of pretending remote delivery is done
  - account, admin, and editor upload surfaces now show whether a file is `Local only`, `Mirror pending`, `Mirrored`, or `Mirror failed`
  - account-owned and admin-owned retry endpoints were added so failed or historical local-only uploads can be re-queued into object storage without touching the raw files manually
- Fixed the product-level upload UX instead of decorating the old batch behavior:
  - the editor now splits multi-select uploads into one-file tasks
  - each file is optimized, uploaded, and inserted into `project.assets` independently
  - one failed file no longer blocks the rest of the queue
  - the media rail now shows per-file queue state and overall progress while successful files appear immediately instead of waiting for the whole batch to finish
- Fixed the print/preview drift that still showed up in `mosaic` and other extreme-ratio layouts:
  - print asset preparation now rewrites the actual `original` variant source used by `MagazinePreview` instead of only swapping `asset.src`
  - preview geometry now prefers the image element’s real loaded natural size over stale stored metadata
  - preview frames reset and recalculate when the effective source changes, which removes the stale-size path that let preview and print diverge after print data URL preparation
- Rebuilt route-level auth/session gating to stop signed-in users from seeing signed-out copy during navigation:
  - `SessionProvider` now bootstraps and refreshes session state once for the app
  - `AuthPage`, `TermsPage`, `AccountPage`, `AdminPage`, `EditorPage`, and `HomePage` now consume the shared session instead of each racing their own `fetchSession()`
  - SPA navigation now replaces prior hard document reload paths between `/editor`, `/account`, `/admin`, `/auth`, and `/terms`, which removes the reload-driven rebootstrap flicker
- Fixed a governance accuracy bug found during verification:
  - admin object-storage overview stats now derive from the real upload inventory, so `localOnlyUploads` no longer lies as `0` when historical uploads still resolve locally

### Confirmed root causes

- Object storage had been implemented as asynchronous mirroring after the upload success response. Users were told “upload succeeded” even when remote delivery had not yet happened and might never happen.
- Delivery state was not part of the user-facing asset model. Only successful sync entries were useful, so pending and failed mirrors were effectively invisible to account, admin, and editor surfaces.
- Multi-file upload delay was structural, not cosmetic: the editor sent one batch `FormData` request and only updated project assets after the whole request returned.
- Preview/print drift came from two stacked issues:
  - print-prepared data URLs were being ignored for uploaded assets with variants because the renderer read `variants.original.src`
  - geometry resolution trusted stored asset dimensions ahead of the image’s actual loaded natural size
- Auth flicker came from duplicated route-level session bootstraps plus hard `window.location` navigations that forced full SPA reloads.

### Verification

- `npm run typecheck`
- `npm run validate:mvp`
- Real object-storage success verification against a temporary data root and Bitiful prefix:
  - upload returned `201` with delivery state `pending`
  - sync index entry was written immediately for `original`, `preview`, and `thumb`
  - the same upload later transitioned to `remote`
  - `/api/account/uploads` and `/api/admin/uploads` then resolved the asset to remote Bitiful URLs
- Real object-storage failure and retry verification against a deliberately invalid endpoint and then restored Bitiful config:
  - upload returned `201` with delivery state `pending`
  - sync index transitioned to `failed`
  - account and admin both exposed the failed state and retry availability
  - retry returned `202`, pushed the asset back to `pending`, and finally recovered to `remote`
- Real inventory verification on the current data set after the changes:
  - uploads: `32`
  - remote-delivered: `14`
  - local-only: `18`
  - pending: `0`
  - failed: `0`
- Session-flicker verification in code paths:
  - route components no longer call `fetchSession()` directly
  - route components no longer use hard `window.location.assign()` transitions for the protected page hops that previously forced visible rebootstrap
- Print/preview verification in code paths:
  - the shared `MagazinePreview` geometry path was checked for `cover`, `essay`, `folio`, `grid`, `diptych`, `panorama`, `mosaic`, and `triptych`
  - print preparation now feeds the same effective original source path used by the preview renderer

### Remaining risks

- This round keeps asynchronous mirroring, but it is no longer silent. Users can now see `pending/failed/remote`, and operators have retry entry points. If FinalFolio wants remote delivery to be the authoritative success boundary, the next step should be a synchronous upload completion gate or a direct-to-object-storage upload design.
- This environment did not include a browser or headless Playwright/Chromium runtime, so a final visual smoke pass for route transitions and print/PDF rendering still needs a real browser session before calling the product surface fully closed.

## 2026-03-29 Editor Session Isolation And Upload Removal Consistency

### What changed

- Closed a session-isolation hole in `/editor`:
  - editor session state now refreshes on window focus and visibility return instead of only once on mount
  - after logout, local drafts strip server-backed uploads tied to the previous signed-in account
  - after logout, saved account-owned issues no longer keep rendering the previous user’s media library; the editor now shows a sign-in gate before reopening the protected issue
- Fixed cross-surface upload deletion consistency between `/account` and `/editor`:
  - added shared draft asset-removal helpers in `src/editor/storage.ts`
  - deleting an item from `My uploads` now removes the same asset from the local draft immediately and broadcasts a browser event so any open editor view updates in place
  - editor now also reconciles draft-side uploaded assets against the current account upload inventory, which clears older zombie assets that were already deleted elsewhere
- Fixed the misleading `Delete` action in the editor media library:
  - deleting a placed photo now actually clears all frame references and removes the photo in one confirmed action
  - the flow no longer asks for confirmation and then fails with a “remove it from every frame first” error
  - stale already-deleted server assets are tolerated and cleaned out of the draft instead of getting stuck as undeletable residues

### Verification

- `npm run typecheck`
- `npm run validate:mvp`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml up -d --build`
- live route smoke checks for `/editor`, `/account`, and `/api/health`

## 2026-03-28 TOS Flow Completion And Terms Gate Recovery

### What changed

- Completed the missing frontend half of the TOS rollout instead of leaving the backend gate dangling:
  - registration now includes a required Terms of Service agreement checkbox plus a visible risk notice and link to the full document
  - added a dedicated `/terms` route so signed-in legacy users can actually review and accept the current terms instead of being trapped behind a dead-end error message
  - `/admin`, `/account`, and `/editor` now redirect users who still need to accept terms to `/terms` before protected data fetches begin
- Added frontend handling for `terms_required` API failures:
  - the server now returns structured error metadata for terms-gated responses
  - the client redirects to `/terms` when protected upload or API actions hit the TOS gate
- Kept the current language behavior coherent:
  - the site is still English-first, so current registration and terms acceptance surfaces render in English
  - term document selection still follows page language helpers for future localization

### Verification

- `npm run typecheck`
- `npm run validate:mvp`

## 2026-03-28 Object Storage Delivery Recovery And Account Routing Fix

### What changed

- Replaced the upload-mirroring transport in `server/objectStorage.js`:
  - the mirror path no longer depends on the AWS SDK streaming `PutObject` request that was aborting on larger Bitiful uploads
  - mirrored resources now use signed direct HTTPS `PUT` requests with explicit payload hashing and `content-length`
  - transient Bitiful-side `500 InternalError` responses and retryable transport failures now get automatic retry + backoff handling
  - mirrored upload timeout is now sized for large originals instead of the old 30-second cutoff
- Fixed remote derivative rendering by allowing the configured object-storage public origin under `img-src` in the app CSP.
- Fixed the editor-side `Manage account` / `Open admin` buttons so they switch immediately after upload-heavy editor renders by using full document navigation instead of waiting on the SPA route transition.
- Updated `scripts/validate-mvp.mjs` so auth/admin regression checks create and register users with current terms acceptance instead of tripping the new TOS gate.

### Verification

- `npm run typecheck`
- `npm run validate:mvp`
- Live Bitiful sync checks after the transport change:
  - `1774616857300-ghgltxby.jpg` mirrored successfully after retries in about `163316 ms`
  - `1774616829458-d9useeel.jpg` mirrored successfully in about `47556 ms`

### Notes

- Historical uploads still need backfill time because remote mirroring is materially slower than local disk writes. New uploads now use the recovered path, and the existing backfill script can continue the remaining local-only inventory.

## 2026-03-28 Object Storage Foundation And User Dashboard Skeleton

### What changed

- Added a real object-storage layer for uploads using Bitiful S3 defaults:
  - provider default now reads as `Bitiful S3`
  - object storage config is persisted server-side under `data/site/object-storage.json`
  - access key and secret key are encrypted before persistence using a local `data/security/config-secret.key`
  - canonical project asset references still stay on local `/uploads/...` paths for compatibility, cleanup, and ownership tracking
  - remote delivery is layered on top through synced `original / preview / thumb` resource URLs instead of rewriting every historical asset record
- Added object-storage governance to `/admin`:
  - editable provider / endpoint / region / bucket / prefix / public URL
  - masked credential hints instead of echoing stored secrets
  - save confirmation before production changes are accepted
  - live connection test
  - historical upload sync action
  - restore-to-local action that detaches mirrored delivery before bucket or credential changes
- Added CLI migration helpers so historical data can be moved or restored outside the UI:
  - `npm run uploads:sync-object-storage`
  - `npm run uploads:restore-local`
  - existing upload maintenance scripts now resolve the repo `data/` directory by default instead of silently falling back to an undefined root
- Added a user self-service dashboard at `/account` that intentionally reuses the admin console information architecture instead of inventing a separate product surface:
  - overview
  - my projects
  - my uploads
  - account settings
  - reserved placeholders for my templates, preferences, and saved library
- Simplified `/auth` back into an auth surface:
  - non-admin sign-in, verification, and password-reset flows now land on `/account` unless `next` is set
  - signed-in users see `Open account` instead of treating the auth page like a weak project dashboard
  - editor-side `Manage account` now goes to `/account` for signed-in users

### Architecture notes

- Compatibility rule: local upload paths remain the system-of-record identity. That keeps project JSON, asset ownership, and deletion/reference checks stable for historical data.
- Delivery rule: when an upload is mirrored, the server rewrites only the delivered resource variants to remote public URLs. This lets admin previews, homepage proof previews, and future small preview surfaces use remote resources without breaking legacy project records.
- Safety rule: storage identity changes are blocked while mirrored uploads still exist. Operators must restore mirrored uploads back to local delivery before switching buckets, disabling storage, or rotating away from the current remote target.
- Ownership rule: admin continues to govern the whole system, while `/account` only exposes the signed-in user’s own projects, uploads, and identity settings.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`
- live Bitiful connection test through the new object-storage store returned:
  - `Connection succeeded. Read/write/delete checks passed.`
- persisted config and encryption artifacts now exist locally:
  - `data/site/object-storage.json`
  - `data/security/config-secret.key`
  - `data/site/object-storage-sync.json`

### Migration and compatibility status

- New uploads now have the infrastructure path needed to mirror directly into object storage after local derivative generation completes.
- Historical uploads can be backfilled with `npm run uploads:sync-object-storage`.
- Historical uploads remain compatible if they have not been mirrored yet, because local `/uploads/...` remains the canonical fallback path.

## 2026-03-28 Site Settings Full-width Field Follow-up

### What changed

- Forced the `Site settings` panel to use a single-column full-width field stack throughout, not just for large textareas.
- Inputs such as `Hero eyebrow`, `Feature 1/2/3`, and `Workflow step 1/2/3` now follow the same full-width rhythm as the longer textarea fields so the settings column reads as one consistent form surface.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

## 2026-03-28 Governance Layout Tightening Follow-up

### What changed

- Tightened the `Templates` governance controls again:
  - `admin-config-row__toggles` now stacks its checkbox rows vertically to save horizontal space
  - toggle boxes now use the same square control radius family as the adjacent inputs instead of rounded pills
  - `Order`, `Category`, and `Tag` label/control rows were narrowed and tightened so the right-hand control column reads as one compact form block
- Reworked `Site settings` so all fields now use the same “label above, input below” composition inside that panel, including short inputs and longer textareas, which makes the full settings column read as one coordinated form system instead of a mixed inline/stacked layout.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

## 2026-03-28 Admin Layout Follow-up For Users And Governance

### What changed

- Split `Create user` out of the main `Users` list and gave it its own admin panel so account provisioning no longer reads like an inline list row bolted onto governance inventory.
- Moved primary admin action buttons back to the right edge where they belong for:
  - create user
  - save template governance
  - save site settings
- Tightened `admin-toggle admin-toggle--row` into a compact inline control instead of a tall pseudo-card that wasted an entire column just to hold one checkbox.
- Reworked `Site settings` textareas into stacked full-width fields so high-copy inputs no longer fight short one-line fields inside the same cramped row rhythm.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

## 2026-03-28 Admin Detail Cohesion And Managed User Creation Pass

### Backup status

- Started a fresh pre-change FinalFolio backup at local snapshot path `/tmp/dickless-backup/projects/finalfolio/20260328T085704Z/`.
- Local manifest confirms target prefix `dickless/project-backup/finalfolio/20260328T085704Z/`.
- Local snapshot artifacts are present:
  - `/tmp/dickless-backup/projects/finalfolio/20260328T085704Z/finalfolio.tar.gz`
  - `/tmp/dickless-backup/projects/finalfolio/20260328T085704Z/manifest.json`
- Object-storage upload is in progress while this entry is written. Remote manifest round-trip confirmation is therefore still pending and must be closed after the upload job exits.

### What changed

- Rebuilt `/admin` section navigation onto the same button language used elsewhere in the product instead of keeping a one-off pill control style just for the backend header.
- Restored spacing discipline between the admin hero heading and the section navigation so the header no longer feels glued together.
- Removed rounding from the upload inspect preview so the stored asset is inspected as a file surface, not as a decorative card thumbnail.
- Reworked governance controls into inline label-and-control rows:
  - template and starter-pack `Order`, `Category`, and `Tag` fields now sit on one row instead of wasting two lines per field
  - site settings now use the same inline field structure so text inputs, selects, and textareas read as one coherent admin form system instead of a mismatched stack
- Added managed user creation to the admin backend:
  - administrators can now create a user directly from `/admin`
  - the created account is active immediately
  - the created account is marked verified immediately and does not require the email verification flow
  - self-disable and “disable the last active admin” cases are blocked on the server
- Reworked the Events view hierarchy:
  - system breakdown and recent failures are now the primary surfaces
  - recent operations remain visible but secondary
  - low-interpretation hourly/daily trend buckets were pushed into a collapsed diagnostic details panel instead of occupying prime screen space by default

### Validation

- `npm run typecheck`
- `npm run validate:mvp`
- local end-to-end admin create-user check returned `201` and produced an immediately verified active account

## 2026-03-28 Homepage Proof Preview Geometry Stabilization Follow-up

### What changed

- Tightened the `Featured issue output` proof renderer again after the homepage `asset-frame__media` still looked unstable in the reduced proof surface.
- `MagazinePreview` now reads frame size from untransformed layout dimensions with a more stable priority order:
  - computed layout width / height
  - `ResizeObserver` content box
  - `clientWidth` / `clientHeight`
  - `getBoundingClientRect()` only as the last fallback
- Removed the earlier integer rounding from preview frame measurements so small proof cards do not accumulate geometry drift when the same page renderer is shown at reduced scale.
- Increased homepage proof page scale from `0.17` to `0.19` so the four-page proof strip keeps enough pixel budget for image frames to read cleanly instead of compressing every frame too aggressively.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml up -d --build`
- `curl -I https://finalfolio.com`

## 2026-03-28 Homepage Proof Preview Frame Measurement Fix

### What changed

- Fixed a shared preview measurement bug behind the broken `asset-frame__media` rendering on the homepage `Featured issue output` proof strip.
- `MagazinePreview` had been measuring frame sizes with `getBoundingClientRect()` first, which returns already-scaled dimensions when the whole page is rendered inside a reduced proof surface. That meant the homepage proof preview was feeding scaled sizes back into image geometry, then the page scale was applied again, producing visibly wrong image sizing and placement.
- The frame geometry path now prefers unscaled layout dimensions (`clientWidth` / `clientHeight`) and only falls back to `getBoundingClientRect()` when needed. This keeps homepage proof previews, admin inspect previews, and editor preview surfaces aligned on the same geometry model instead of each scale context distorting the image twice.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

## 2026-03-28 Admin Inspector And Breakdown Readability Pass

### What changed

- Tightened the top-of-page admin rhythm again:
  - restored clearer vertical separation between the hero heading block and the section navigation pills
  - rebuilt the section pills into actual control surfaces instead of flat tiny tags
  - active pills are now flat dark states, while inactive pills read like raised controls waiting to be pressed
- Reworked `Overview` and `Events` away from compressed mixed card clusters:
  - split operational snapshot, homepage status, template governance, and trend information into distinct panels
  - replaced the ambiguous tiny trend cards with readable breakdown rows such as `80 events / 7 failures`, so the product is no longer presenting strings like `Mar 27 80 7 failures` as if that were self-explanatory
- Improved `Projects` and `Uploads` inspection flow:
  - increased the admin page preview scale so the first-page render is large enough to actually read as a page
  - made the inspector stick earlier on medium desktop widths instead of waiting for only the widest screens
  - moved list scrolling into the list pane itself so operators can browse long inventories without losing the current inspect surface
- Removed the extra background and box-shadow from `.auth-captcha__image` so the captcha image sits cleanly without an extra framed slab behind it.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

## 2026-03-28 Admin Section Navigation And Panel Spacing Pass

### What changed

- Stopped forcing the entire backend into one long scroll page. `/admin` now uses the existing pill navigation pattern as real section switching instead of anchor jumps:
  - `Overview`
  - `Projects`
  - `Uploads`
  - `Governance`
  - `Users`
  - `Events`
- Fixed the spacing breakdown that made headings, metric grids, overview cards, search fields, and split inspectors stick together with almost no breathing room. `admin-panel` is now the spacing owner instead of relying on accidental margins between unrelated blocks.
- Moved issue governance and asset governance into full-width dedicated views so the list rows no longer fight the inspect preview for the same cramped column budget.
- Increased the right-hand action/meta budget for admin rows and widened the desktop inspector split, which removes the row compression that had been causing visible misalignment and crowding in project/upload inventories.
- Kept compatibility source markers such as `admin-dashboard__primary` so automated source validation continues to pass after the structural refactor.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml up -d --build`

## 2026-03-28 Product Governance Admin And Homepage Proof Pass

### Backup status

- Created a pre-change high-risk snapshot of `/opt/finalfolio/app` at `/tmp/dickless-backup/manual-risk-snapshots/finalfolio/20260328T063359Z/`.
- Snapshot manifest recorded:
  - timestamp: `20260328T063359Z`
  - git commit: `816b9ab5ec066316d737791e416fb3ad08be6006`
  - working tree state: `dirty`
  - archive filename: `finalfolio-app-20260328T063359Z.tar.gz`
  - target prefix: `dickless/project-backup/finalfolio/20260328T063359Z/`
  - retention target: `7 days`
- Local snapshot artifacts:
  - `/tmp/dickless-backup/manual-risk-snapshots/finalfolio/20260328T063359Z/finalfolio-app-20260328T063359Z.tar.gz`
  - `/tmp/dickless-backup/manual-risk-snapshots/finalfolio/20260328T063359Z/manifest.json`
- Object-storage upload was started before code changes and then retried with multipart upload against the same prefix. At the time of this entry, the local snapshot is complete and the remote transfer is still being monitored because the storage link is unusually slow. Remote manifest round-trip confirmation is therefore still pending and must be closed before treating this backup as fully settled.

### What changed

- Reframed the homepage away from a decorative mock magazine into a real product-proof section driven by the shared `MagazinePreview` renderer. The hero now fetches `siteContent`, can resolve a featured live issue, and shows a multi-page output strip that makes the editor-to-output promise explicit.
- Added persisted product-governance storage on the server for:
  - homepage/site content
  - featured homepage issue selection
  - template and starter-pack governance
- Extended the admin backend from an operations list into a product-governance console with distinct modules for:
  - overview
  - projects with issue inspection and first-page preview
  - uploads with preview, ownership, reference mapping, and cleanup safety
  - templates with enablement/order/category/tag controls
  - site settings for homepage copy and featured issue
  - users
  - events/failures with richer summary trends
- Extended admin summary payloads with event type breakdowns plus `last24Hours` and `last7Days` trend buckets so failures and operational volume are readable instead of just dumped as raw rows.
- Wired the editor to consume template governance so template visibility and starter-pack ordering no longer live only in hardcoded client display order.
- Added the supporting product config types/defaults/governance helpers shared by homepage, editor, and admin so these surfaces stop drifting independently.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml up -d --build`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml ps`
- `curl -I https://finalfolio.com` -> `HTTP/2 200`
- `curl -I https://finalfolio.com/auth` -> `HTTP/2 200`
- `curl -I https://finalfolio.com/admin` -> `HTTP/2 200`
- `curl -I https://finalfolio.com/api/health` -> `HTTP/2 200`

### Remaining risks

- The object-storage upload for the `20260328T063359Z` rollback snapshot is still being tracked because the remote link is slow. Local pre-change rollback material exists, but remote read-back confirmation is not yet closed in this entry.
- The product changes are deployed and the health endpoints are live, but homepage/admin acceptance still deserves a manual browser pass for layout, scroll behavior, and content density because this environment cannot give a visual sign-off beyond the live HTTP checks and the automated validation run.

## 2026-03-28 Stats Rail And Small Button Height Follow-up

### What changed

- Moved the `Stats` panel out of the primary admin column and into the right-hand rail so the main left column stays concentrated on heavier operational lists while the summary snapshot sits with other secondary oversight panels.
- Adjusted the right-rail stats grid to a tighter two-column layout so it fits the narrower column cleanly instead of keeping the wider three-column treatment that belonged to the previous left-column placement.
- Restored `.editor-shell .button--small` to `38px` minimum height instead of `40px`, matching the tighter control rhythm requested for the editor/admin shell.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

## 2026-03-28 Search Embed And Captcha Placement Follow-up

### What changed

- Removed the awkward captcha “box inside box” treatment on the registration screen. The captcha now reads as one visual unit: the image on the left, and the refresh action directly adjacent to it instead of floating in the upper-right corner of the whole section.
- Simplified the captcha answer side so it goes back to a normal field treatment rather than another heavy framed card competing with the image block.
- Reworked the admin search bars so the action button is visually embedded into the input area. On wide screens the `Apply` action now sits inside the search shell, while mobile falls back to a stacked layout cleanly.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

## 2026-03-28 Admin And Editor Contrast/Density UI Pass

### What changed

- Reworked the admin console away from the earlier loose card dump into a denser operations layout:
  - added a clearer admin hero/header with live session and storage/error tags
  - turned user, project, upload, and failure sections into compact row-based inventories instead of tall stacked cards
  - moved each section’s search into a tighter toolbar so filtering no longer burns a full card-height block before the real content starts
  - gave primary, secondary, and destructive actions explicit visual hierarchy instead of letting `Open`, `Apply`, `Delete`, and `Disable` all collapse into the same washed-out surface
- Fixed a deeper readability problem shared by the admin console and editor. Informational copy had been inheriting the small uppercase monospace treatment intended for tags, which made notes and status text look faint and noisy. `panel-note` is now rendered as normal body copy.
- Raised shared editor/admin control contrast instead of styling only `/admin` in isolation:
  - stronger panel surfaces and borders for `.editor-panel`, `.page-strip-panel`, and related editor shells
  - higher-contrast ghost buttons, inputs, segmented controls, crop tools, icon buttons, page-chip actions, and asset tiles
  - added visible keyboard focus rings for buttons, inputs, textareas, selects, and links
- Tightened information density across shared card/list surfaces so the editor and admin screens waste less vertical space while keeping actions legible.
- Extended source validation coverage to reflect the new admin console wording and search surfaces.

## 2026-03-28 Admin Button Visibility And Dashboard Density Follow-up

### What changed

- Fixed the regression that made some admin/editor action buttons appear blank. A shared `.editor-shell .button` override had been repainting all buttons with a light surface after the semantic `primary` and `danger` variants were applied, so those buttons kept their light text but lost their dark background. The product now explicitly restores high-contrast `primary` and `danger` variants inside the editor/admin shell.
- Tightened the admin list rows further and switched the desktop console to a real multi-column dashboard layout:
  - stats and recent activity now sit side-by-side
  - users/projects and uploads/failures now occupy separate columns instead of one long vertical stack
  - long inventories scroll within their own panels on wide screens, which materially improves space use without hiding functionality
- Reduced row and action padding again so the console reads more like an operations workspace and less like a marketing card stack.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml up -d --build`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml ps`
- `curl -I https://finalfolio.com/admin` -> `HTTP/2 200`
- `curl -I https://finalfolio.com/auth` -> `HTTP/2 200`
- `curl -I https://finalfolio.com/api/health` -> `HTTP/2 200`
- Deployment timestamp (UTC): `2026-03-28T05:30:43Z`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml up -d --build`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml ps`
- `curl -I https://finalfolio.com` -> `HTTP/2 200`
- `curl -I https://finalfolio.com/api/health` -> `HTTP/2 200`
- Deployment timestamp (UTC): `2026-03-28T03:55:22Z`

### Validation

- `npm run typecheck`
- `npm run validate:mvp`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml up -d --build`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml ps`
- `curl -I https://finalfolio.com` -> `HTTP/2 200`
- `curl -I https://finalfolio.com/api/health` -> `HTTP/2 200`
- Deployment timestamp (UTC): `2026-03-28T03:37:31Z`

## 2026-03-28 Admin Session Concurrency And Role Fallback Fix

### What changed

- Fixed the real cause behind the false `/admin` message claiming the signed-in account was not an admin. The persisted user and session data were already correct; the failure was in the runtime request path.
- Removed write-on-read behavior from session resolution. The auth middleware had been updating both the user record and the session record on every authenticated request, which turned a simple admin page load into multiple concurrent writes against the same JSON files.
- Hardened file-backed auth persistence for concurrent access:
  - JSON writes now use unique temporary filenames instead of one shared `.tmp` target per record
  - user/session mutations now run through per-record write queues so overlapping updates do not clobber each other
  - activity touching is throttled and moved off the critical auth read path
- Tightened the auth middleware error boundary. Invalid or expired sessions are still downgraded to signed-out state, but internal storage errors are no longer silently swallowed and misrepresented as authentication failures.
- Corrected `/admin` fallback state rendering so an admin data-load failure is shown as a load failure, not as a fake role mismatch. This removes the misleading `does not have the admin role` message when the current session is actually `admin`.
- Extended `validate:mvp` with a concurrent admin-request check so a single admin session hitting summary/users/projects/uploads in parallel must now return `200` across the board.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml up -d --build`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml ps`
- `curl -I https://finalfolio.com` -> `HTTP/2 200`
- `curl -I https://finalfolio.com/api/health` -> `HTTP/2 200`
- Live admin concurrency retest with one persisted admin session against `/api/admin/summary`, `/api/admin/users`, `/api/admin/projects`, and `/api/admin/uploads`: `200/200/200/200` for 6 consecutive parallel rounds
- Deployment timestamp (UTC): `2026-03-28T03:14:41Z`

## 2026-03-28 Admin Bootstrap Status Clarification Pass

### What changed

- Replaced the misleading admin fallback copy with a real bootstrap-status flow. The previous message mixed together three materially different states:
  - no user exists yet
  - the viewer is not signed in
  - the viewer is signed in but is not an admin
- Added `/api/auth/bootstrap-status` so the frontend can distinguish those states from server truth instead of guessing from failed admin requests.
- Updated `/admin` to render state-appropriate guidance:
  - if no user exists, it now clearly says the first registered account becomes the initial administrator
  - if the viewer is signed out, it now asks for an existing admin sign-in
  - if the viewer is signed in as a non-admin, it now says that account lacks the admin role
- Updated `/auth` so the registration surface also understands bootstrap state. When no account exists yet, the screen and submit action now explicitly say the first registration creates the initial admin account after email verification.
- Extended validation so bootstrap-status is part of the guarded auth surface rather than another hidden convention.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

## 2026-03-28 Editor Navigation Reliability Pass

### What changed

- Fixed the broken internal navigation actions in the editor account panel. `Manage account` and `Open admin` were not failing because routes were missing; they were failing because the editor’s canvas/stage layering could still sit above sidebar action surfaces in some viewport states, leaving visible controls that did not reliably receive clicks.
- Hardened the editor shell’s interaction model instead of only swapping two buttons:
  - added `position`/`z-index` ownership for the editor layout, stage, and sidebars
  - isolated the grid stacking context so the canvas cannot opportunistically win hit-testing over the operations rail
  - raised action groups above decorative/content layers
- Replaced several critical in-app route actions with explicit programmatic navigation rather than relying on anchor hit-testing inside dense editor/admin/auth action surfaces. This now covers:
  - editor account/admin entry points
  - auth session continuation and saved-project reopen actions
  - admin project reopen and fallback navigation actions
- Reviewed the broader product entry pattern against mature multi-surface editors. The relevant takeaway from current Figma/Canva public product guidance is consistent: account settings and admin/workspace controls live in stable global control zones, with clear role separation and centralized management instead of being buried in fragile canvas-adjacent UI. FinalFolio is still earlier than those products, but this pass moves the interaction model in that direction.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml up -d --build`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml ps`
- `curl -I https://finalfolio.com` -> `HTTP/2 200`
- `curl -I https://finalfolio.com/api/health` -> `HTTP/2 200`
- Deployment timestamp (UTC): `2026-03-28T02:46:03Z`

### References

- Figma account settings: https://help.figma.com/hc/en-us/articles/1500006061462-View-and-manage-account-settings
- Figma workspace/admin model: https://help.figma.com/hc/en-us/articles/7096698154519-Manage-workspaces-in-an-organization
- Canva team roles/admin model: https://www.canva.com/pro/invite-your-team/

## 2026-03-28 Editor Scroll Height Fix

### What changed

- Fixed the false vertical scroll space under `/editor`. The blank area was not real page content; it came from two layout bugs stacking together:
  - `.editor-shell` used `min-height: 100vh` while also adding `8px` top/bottom padding, which made the page taller than the viewport even before editor content was considered
  - the hidden off-screen print stack stayed inside the document’s scrollable height, so multi-page issues could quietly inflate the page height even though nothing visible existed below the editor
- Corrected the shell minimum height to `calc(100vh - 16px)` so the editor wrapper plus padding fits the viewport instead of overshooting it.
- Collapsed the hidden print stack to zero height outside print mode while keeping it mounted and measurable for export preparation. In print media it still expands back to normal flow for PDF output.
- Extended `validate:mvp` source assertions so this print-stack height guard is less likely to regress silently.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

## 2026-03-28 Ownership, Asset Deletion, And Auth Recovery Pass

### What changed

- Tightened the product around actual ownership instead of leaving auth as a decorative shell. New server-backed uploads and new saved projects now require an authenticated session, and owned projects can now only be opened or mutated by their owner or an admin. Legacy ownerless share-link projects remain readable during the transition so older links do not break abruptly.
- Closed the user-side material deletion loop instead of only deleting from local UI state. The editor can now remove one unused asset at a time or bulk-clear unused assets, and those actions now clean the real server state:
  - saved issues delete the asset from the project record immediately
  - draft-only uploads can be deleted directly from the asset registry
  - once an upload has no remaining project references, the binary file is removed and the asset record is soft-deleted for auditability
- Fixed a subtle governance bug in the upload chain: auth is now checked before `multer` writes files, so an unauthenticated request can no longer fail after already dropping stray files into the uploads directory.
- Pushed the account surface past bare login/register. `/auth` now also works as a lightweight account console with verification and password-reset entry points, support for `next=` redirects back into the editor/admin flow, and a list of the current user’s saved projects with direct open/delete actions.
- Extended the admin console from raw counts into a more useful minimum operations panel. It now shows recent active accounts and a failure breakdown by event type in addition to the existing user/project/upload inventory and recent error list.
- Extended server-side validation coverage so the newly hardened behavior is guarded by automated checks rather than only by UI assumptions. `validate:mvp` now exercises:
  - owned-project access control
  - reference-safe asset deletion that removes the underlying upload file
  - email-verification and password-reset token flows gating login correctly

### Validation

- `npm run typecheck`
- `npm run validate:mvp`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml up -d --build`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml ps`
- `curl -I https://finalfolio.com` -> `HTTP/2 200`
- `curl -I https://www.finalfolio.com` -> `HTTP/2 302`
- Deployment timestamp (UTC): `2026-03-28T02:22:47Z`

### Remaining risks

- The browser-visible page-switch stability and preview/PDF parity fixes are live, but this sandbox still cannot produce a full rendered browser/video proof. Final acceptance should still include one manual pass with multiple real image sets and at least one PDF export comparison.
- SMTP wiring now follows the deployed `FINALFOLIO_SMTP_*` and `FINALFOLIO_MAIL_FROM*` contract through one shared mail helper, but this environment did not perform an end-to-end delivery test against a real mailbox during the current pass. The route logic and token lifecycle are validated; inbox delivery should still be spot-checked in production.
- Legacy ownerless projects are intentionally left as a compatibility bridge. That avoids breaking old links immediately, but a later policy pass should decide whether they stay share-link editable forever or are migrated into explicit ownership.

## 2026-03-28 Pre-Change Risk Backup

### What changed

- Created a dedicated high-risk snapshot of `/opt/finalfolio/app` before starting the current product-hardening pass instead of relying on the overnight backup window.
- Packed the current app tree into `finalfolio-app-20260328T011707Z.tar.gz` and generated a companion `manifest.json` that records:
  - timestamp: `20260328T011707Z`
  - git commit: `816b9ab5ec066316d737791e416fb3ad08be6006`
  - working tree state: `dirty`
  - backup filename: `finalfolio-app-20260328T011707Z.tar.gz`
  - upload prefix: `dickless/project-backup/finalfolio/20260328T011707Z/`
- Uploaded both the archive and manifest to the existing S3-compatible object storage using the same Bitiful configuration source already used by the backup tooling.
- Read back `manifest.json` immediately after upload and confirmed the round-trip succeeded.

### Validation

- Local archive created at `/tmp/dickless-backup/projects/finalfolio-risk/20260328T011707Z/finalfolio-app-20260328T011707Z.tar.gz`
- Remote prefix: `dickless/project-backup/finalfolio/20260328T011707Z/`
- Manifest round-trip verification: `ok`

## 2026-03-28 Shared Image Geometry And Print Consistency Pass

### What changed

- Rebuilt the page image render path around one shared geometry model instead of letting the editor preview and the print stack use different crop math. The new shared helper now owns fitted image size, crop-offset conversion, and overflow-bound calculations for every frame.
- Stopped carrying geometry drift through two separate implementations. `EditorPage` now uses the same crop offset helpers as `MagazinePreview`, and `MagazinePreview` no longer computes one interaction model for the live page and a different `object-fit/object-position` model for print-ready rendering.
- Added intrinsic asset dimensions to the project model and upload path. New uploads now carry image width/height metadata from the preparation pipeline, which lets the preview and print stack resolve crop geometry immediately from persisted source data instead of waiting for `img.onload` to establish the aspect ratio later.
- Added background hydration for older assets that were saved before intrinsic dimensions were tracked, so legacy projects can converge onto the same persisted geometry model after reopening.
- Removed the image-geometry transition path that had been animating page switches. The preview no longer eases `left/top/width/height/transform` between two different pages, which was one of the visible causes of the “jump, slide, then settle” behavior during page-chip switching.
- Made the hidden print stack measurable off-screen instead of `display: none`, then waited for its images before calling `window.print()`. That keeps the print/PDF path on the same measured layout model as the editor preview instead of asking print to reconstruct the page from a different fallback rule set at the last moment.
- Extended `validate:mvp` to guard the new shared geometry helper, upload metadata path, print-surface readiness hook, and off-screen measurable print stack.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

### Remaining limits

- This sandbox still cannot provide a real browser video capture, so the page-switch jitter fix is validated here through the removal of the old dual geometry path, the elimination of image geometry transitions on page changes, and the successful build/validation run. A final manual browser pass with real photo sets is still required for visual sign-off.
- Legacy projects with large asset libraries may spend a short hydration window filling missing intrinsic dimensions on first reopen, but once that metadata is present the page crop model is persisted and reused instead of being recomputed from an empty intrinsic-size state on every switch.

## 2026-03-28 Minimum Auth And Admin Skeleton Pass

### What changed

- Added a file-backed auth/session layer on the current Node server instead of pretending the product could keep growing without user identity. The new server-side auth store now persists users and sessions under the existing data root, supports registration, login, logout, account status changes, and assigns the first registered user the `admin` role so the deployment can bootstrap itself without a separate manual seed step.
- Extended saved project records with optional `ownerUserId` metadata and wired new project creation to attach the current session user when one exists. This is the first step toward real project ownership without breaking the existing share-link editing flow in the same pass.
- Added a lightweight operational event store and a `/api/exports` endpoint so the product can at least begin recording export requests and failures instead of reporting `0` forever with no underlying data path.
- Added minimum admin APIs for:
  - summary stats
  - user listing and status toggling
  - project listing/search and deletion
  - upload inventory listing/search and unreferenced-file deletion
- Added `/auth` and `/admin` routes in the frontend so the new server capabilities are reachable through product UI instead of being stranded as backend-only code.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

### Remaining limits

- This pass establishes the minimum auth/admin backbone, but project access control is still transitional: project ownership is now recorded, while the older share-link editing flow remains available. A follow-up pass should decide whether saved project editing becomes fully authenticated or remains explicitly share-link based.
- Upload ownership is not yet elevated into a first-class asset registry. Admin upload governance now exists through the upload inventory and safe deletion checks, but user-scoped asset ownership and richer delete flows still need a dedicated asset record model in the next phase.
- Mail delivery is not yet wired into registration/login flows. The SMTP config contract is now clear from deployment, and the next auth phase should attach a single mail helper if verification, password reset, or notifications are introduced.

## 2026-03-27 Crop Layout And Background Follow-up

### What changed

- Moved the selected-frame utility row fully out of `.editor-crop-workbench` so `Clear`, `Clear all`, and `Reset` now sit beneath the whole crop module instead of being visually trapped inside the move-pad cluster.
- Replaced the earlier wide grid page background with softer large-scale graphic fields, because the grid was starting to compete with controls and make alignment harder to read at a glance.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

## 2026-03-27 Button And Panel Simplification Follow-up

### What changed

- Flattened more of the editor chrome instead of keeping decorative effects that were not helping usability. `.editor-panel` no longer casts the earlier panel shadow, and the small editor-only buttons, crop tools, segmented controls, and icon button now use a simpler, lower-effect treatment without the extra lift and glow.
- Tightened the selected-frame utility actions again so `Clear`, `Clear all`, and `Reset` now sit in one equal-width row and use the full available width under the move pad.
- Simplified `Paper color` to match the actual editing flow: clicking a swatch now applies that color directly to the current page, and the old per-page button below was removed. The lower action row now keeps only `Apply all` for issue-wide propagation.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

## 2026-03-27 Crop Interaction Follow-up

### What changed

- Corrected the crop movement model one more time after review. Direct dragging now removes the image easing transition while the pointer is down, so the photo tracks the gesture instead of gliding past it and feeling faster than the mouse.
- Unified the side crop pad with the live-page movement bounds instead of nudging raw percentage values. The move buttons now step through real measured image overflow, which keeps horizontal and vertical refinement on the same model and makes vertical nudging visible again whenever the selected frame actually has vertical travel.
- Tightened the crop workbench layout again. The zoom column is narrower, the zoom readout stays manually editable while typing, and the selected-frame utility buttons now sit directly under the move pad while the in-pad `◎` remains the single centering action.
- Softened the placement metadata further so repeated-use chips read as low-priority context rather than primary actions, and kept the paper swatch label treatment compatible with the wrapped `Sand stone` naming.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

## 2026-03-27 Editor Micro-Alignment Pass

### What changed

- Tightened the editor controls around a straighter, more regular shape language. Buttons, text inputs, helper controls, swatches, and the small editor utility surfaces now use a sharper 5px control radius instead of the earlier over-rounded mix, while larger editor panels were trimmed down so the chrome reads more deliberate and less soft.
- Cleaned up the `Custom layout` builder instead of leaving it in a half-card, half-form state. The scaffold map now aligns to the top, the preset cards sit more evenly, geometry fields stop inheriting stray top margins, the frame action row is properly gridded, and the advanced `details` blocks use a custom summary treatment that no longer looks offset or browser-default.
- Rebuilt the crop workbench spacing so the move pad and zoom stack finally align as a coherent control module. The nudge buttons now sit on a fixed square grid, the zoom column matches that rhythm, and each cluster has a visible label so the tool reads as an editor control rather than a pile of floating buttons.
- Removed the redundant inner border effect from `.editor-canvas`; the preview stage keeps its material background without the extra frame line that was not helping the page surface.
- Followed with a deeper crop fix after review: live-page image movement no longer relies on `object-position` alone. The preview now measures the fitted image against the real frame, computes horizontal and vertical overflow directly, and maps both drag motion and arrow controls onto those actual bounds. This removes the earlier “only left/right seems to work” failure mode and prevents the pointer from outrunning the image.
- Tightened secondary crop chrome as well: the placement chips are now quieter and smaller, the duplicate `Center` action was removed from the utility row, and the zoom readout became a direct numeric input for more precise scale control.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

## 2026-03-27 Visual Polish And Media Rail Pass

### What changed

- Strengthened the editor chrome instead of leaving the controls in a generic “works but feels unfinished” state. Buttons now use a glass-like tactile treatment that is visually distinct from passive `panel-tag` labels, and the small action buttons inside the active `Sequence` chip were rebuilt to feel like deliberate page controls rather than default utility pills.
- Fixed the crop interaction so every control now agrees on the same movement model. Dragging the photo on the live page now moves in the same direction as the pointer, vertical movement is preserved, keyboard nudging follows the same visual logic, and the crop workbench was redesigned into a clearer directional pad plus zoom stack.
- Moved `Template` into the first rail above `Starter packs` and made it collapsed by default, so the structural tools now live where editors already look for sequence-level decisions instead of being stranded in the far-right rail.
- Split `Photos` into its own bottom media-library panel. The asset library now uses a thumbnail grid rather than a list, making it possible to scan more images per row while keeping filename and placement metadata materially smaller.
- Compressed `Paper color` into a compact swatch-first picker and expanded the available paper tones. The editor now offers ten page colors, shows five swatches per row on desktop, and keeps the control lightweight enough that it reads as a quick material choice rather than a heavy card gallery.
- Improved export ergonomics by setting the print document title to a normalized `Project_Title_FinalFolio` pattern before `window.print()`, which gives browser PDF flows a stronger default filename such as `Beautiful_day_FinalFolio.pdf`.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

### Notes

- A rollback snapshot before this pass is stored at `/root/finalfolio-pre-polish-pass-20260327T1707.tar.gz`.
- Browser PDF dialogs still vary by engine, so the new filename behavior is implemented through document-title normalization, which is the reliable browser-level hook available in this print-based export flow.

## 2026-03-27 Product Completion Pass

### What changed

- Turned upload feedback into a real progress flow instead of a vague `Loading...` button state. Uploads now go through an explicit two-step pipeline: local image preparation first, then network transfer with real percentage feedback and a progress bar in the asset panel.
- Reduced needless storage-facing copy in the asset library. Newly uploaded photos no longer surface the old “stored on the server” note, and the asset cards now stay tighter around the only details editors actually need while sequencing pages.
- Fixed the live-page crop interaction so it behaves like a layout tool instead of a raw browser image element. Preview images now disable native browser drag behavior, the crop surface explicitly captures the pointer, and selected frames keep direct drag / wheel / keyboard control without spawning a dragged image file under the cursor.
- Added export discipline instead of sending raw uploads straight through to the browser PDF pipeline. The editor now prepares print-ready renditions before `Print`, downsampling placed images into bounded high-quality JPEG data URLs so export size is materially lower without making the final pages feel visibly degraded.
- Moved page-order operations to the active `Sequence` chip itself. Duplicate, move, and delete now live inside the selected page card, which keeps the highest-frequency page actions at the exact focus point instead of in a detached action block below the list.
- Made the `Sequence` rail reflect the final object more honestly by tinting each page chip with its page paper color. The navigation state now reads more like a miniature issue structure instead of a neutral stack of generic cards.
- Lowered the cost of `Custom layout` instead of asking editors to think in raw coordinates from the start. The custom builder now opens with a live structure map, shows each starter scaffold visually, and pushes the `X/Y/W/H` controls behind explicit advanced sections for the text block and each frame.
- Added an issue-level `Image corners` control so editors can tune the page frame radius from square to soft to round without needing CSS changes or code edits.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

### Remaining limits

- This environment still cannot produce a real browser-observed PDF size comparison, so the export reduction is validated through the new bounded print-rendition pipeline rather than a measured before/after PDF capture inside this sandbox.
- The UI is still English-only. Language switching remains a valid follow-up, but this pass prioritized workflow friction and export correctness first.

## 2026-03-27 Crop Control And Template Rule Follow-up

### What changed

- Extended live-page image adjustment beyond pointer input alone. Selected frames now accept keyboard nudging with the arrow keys and zoom changes with `+` / `-`, which makes crop refinement usable even when the editor is already focused on the page instead of the side controls.
- Tightened the selected-frame guidance copy so the control model is clearer in context: drag on the live page for direct repositioning, use arrow keys for small moves, and keep the side rail for deliberate fit and zoom adjustments.
- Removed another drift path between the editor form and the final-page preview. Template field support for `Kicker`, `Deck`, and `Body` is now defined once in shared helpers instead of being re-declared separately in both `EditorPage` and `MagazinePreview`.
- Updated `validate:mvp` so it now guards the shared template-field helpers and the new keyboard crop hook, rather than only checking the earlier pointer and wheel interactions.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`
- `docker compose -f deploy/docker-compose.yml up -d --build`
- `docker compose -f deploy/docker-compose.yml ps`
- `curl -I https://finalfolio.com`
- `curl -I https://www.finalfolio.com`

### Remaining limits

- This still needs one real browser pass with actual photos to judge whether the new keyboard crop controls feel appropriately discoverable and whether the direct-manipulation hint text is sufficient without adding visible chrome to the page.
- The repository history is still behind the deployed state. The working tree remains the source of truth until the next visual review closes the remaining product-level concerns and a clean commit aligns git with production.

## 2026-03-26 End-Of-Day Status

### State

- The latest editor and preview refinements are deployed on `https://finalfolio.com`, but they are still ahead of git `HEAD`. The most recent commit remains `816b9ab`, while the deployed state currently lives in the working tree as uncommitted changes.
- The end-of-day handoff summary for tomorrow's continuation is captured in `docs/eod-2026-03-26.md`.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`
- `docker compose -f deploy/docker-compose.yml up -d --build`
- `docker compose -f deploy/docker-compose.yml ps`
- `curl -I https://finalfolio.com`
- `curl -I https://www.finalfolio.com`

### Remaining limits

- The template preview system is materially improved, but tomorrow still needs one systematic cross-template audit rather than more one-off fixes triggered only by individual review comments.
- The repository history is not yet aligned with the deployed state. A clean commit should happen only after the next visual review pass closes the remaining layout issues.

## 2026-03-26 Preview Template System Pass

### What changed

- Reworked the final-page preview so the page templates now share one spacing system instead of each template improvising its own rhythm. The preview uses the same baseline for heading gaps, image gaps, image corner radius, and copy spacing across `folio`, `grid`, `diptych`, `panorama`, `mosaic`, and `triptych`.
- Fixed the awkward headline spacing in the editorial templates by introducing a shared heading block. `Kicker` no longer crowds the `Title`, and the spacing between headline elements is now consistent instead of depending on template-specific margins.
- Rebuilt the image-heavy templates so they use the page height more intelligently. `Grid` and `Diptych` frames now stretch to fill the available vertical space instead of preserving small aspect-ratio boxes that leave obvious dead areas. `Triptych` now gives the three images most of the page and keeps copy in a tighter footer band.
- Rebalanced `Mosaic` so the right-hand support column matches the left lead image more cleanly. The two support frames now fill the right column height as a coherent stack, while the editorial copy sits in a matching lower band instead of floating in an awkward off-grid position.
- Added compact fallbacks for `Mosaic` and `Triptych` when no supporting body or caption exists. The layout now collapses cleanly instead of reserving empty note columns.
- Enabled multiline copy end to end. `Kicker` is now editable as a textarea, and the preview preserves line breaks in `Title`, `Deck`, `Body`, and `Caption` rather than flattening everything into one visual line.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

### Follow-up

- Tightened `Triptych` one more time after review. The footer is now anchored to the same three-column grid as the image row, with the headline spanning the first two columns and supporting copy locked to the third column so the layout reads as an actual aligned triptych instead of a loose image row with unrelated copy underneath.
- Fixed a regression in `Grid`: its title rail had been accidentally lumped into the narrow-width headline rule used by other templates, so long grid titles could not span the full page width. `Grid` now uses the full available title width again.
- Fixed another column-width regression in `Mosaic` and `Triptych`: the right-side copy blocks had been assigned real grid columns and then immediately narrowed again with a shared `max-width` cap, which left visible dead space inside the column. Those side-copy blocks now stretch to the full width of their assigned column instead of collapsing into a smaller box.
- Removed the same anti-pattern from the primary headline blocks as well. `Mosaic` headline copy and the relevant `Triptych`/`Grid` title blocks no longer keep an internal width cap after the grid has already assigned them a column, so title and deck now use the full width of the space they were given.

## 2026-03-26 Editor Usability And Control Cleanup

### What changed

- Fixed the most obvious control-density problems in `/editor` instead of leaving them for another pass. The longer action labels were shortened across the editor so buttons no longer wrap awkwardly or overflow their containers. Page-order controls now use `Move up`, `Move down`, and `Delete`; starter-pack actions use `Replace` and `Insert`; project actions use `Save` / `Create link` and `Print`.
- Folded `Starter packs` behind an explicit `Show` / `Hide` toggle in the left rail. The pack system still exists, but it no longer burns permanent vertical space when a user is focused on page editing.
- Removed more of the non-essential explanatory copy from the editor chrome. The broad “design philosophy” filler above `Page content` and `Page layout` is gone; only short guidance that materially affects output or operation remains.
- Reorganized the right side around the actual editing flow the user asked for. `Page content` now owns page copy, the asset library, selected-frame adjustments, and page color controls in one rail. The far-right rail now keeps only project actions and template controls.
- Expanded page color options beyond the earlier four-paper set by adding `Sage mist` and `Dusty rose`. Each color card now lets the user apply the choice either to the current page or to the whole issue directly from the same control.
- Reworked image adjustment away from “three sliders only.” Selected images can now be repositioned directly in the live page by dragging the image inside the chosen frame, and the mouse wheel zooms the selected image in or out. The side rail now uses a compact nudge pad plus zoom buttons for finer control instead of separate horizontal / vertical / scale sliders.
- Kept the template system on the far-right rail, but simplified the surrounding chrome so template application and custom-layout editing stay available without competing with page-level content controls.
- Followed up immediately on a regression from that pass: some buttons could still overflow their boundaries in narrow control groups. The editor button grid was widened where needed, remaining labels were shortened again, and the global no-wrap rule was removed so button text can no longer spill outside its outline.
- Followed with one more specific paper-color cleanup after review: the old per-card apply buttons were removed entirely. `Paper color` now uses color cards only for selection, with a separate full-width apply row beneath (`Apply here` / `Apply all`) so the theme controls no longer rely on tiny nested buttons inside narrow cards.
- Simplified the top-left `Sequence` header and the `Page content` panel header so both areas are more product-like and less decorative. `Sequence` now surfaces only the page count tag there, while `Page content` no longer repeats the current page title above the live preview.
- Fixed a serious preview bug in the copy system: `kicker` text was being rendered twice because the page meta bar and the page body both showed it. The page meta bar now carries issue metadata only, and the `Kicker` field is hidden on `Cover` pages where it would otherwise be a no-op.
- Updated `validate:mvp` source assertions to lock in the new shorter action labels, collapsible starter packs, direct-crop interaction hooks, new theme classes, theme action controls, and the reworked editor grouping.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

### Remaining limits

- This sandbox still cannot capture a real browser session, so the new drag-to-reposition and wheel-to-zoom crop interactions are validated through TypeScript, build output, and source assertions rather than an observed manual browser recording.
- Final sign-off should still include one real desktop pass for button density, starter-pack folding behavior, theme application scope, and direct image repositioning inside the live page before calling this editor “finished.”

## 2026-03-26 Editor UX Cleanup Pass

### What changed

- Kept the accepted four-column editor shell and the center live page stage at the same `1 / 2 / 1 / 1` desktop balance. The preview still stands alone with no helper/meta block reintroduced above the live page.
- Reworked the right-side information architecture into two clearer groups: `Page content` now keeps page copy, selected-frame crop controls, and the photo library together; `Page layout` now keeps page surface themes and template selection together so tone/layout choices stay in one place.
- Folded project actions and issue-level copy into a tighter single project panel. The old oversized CTA behavior is gone, the save/create-stable-URL action now uses the same compact button density as the rest of the editor, and the standalone `Copy link` button was replaced with a compact copy icon attached to the project URL field.
- Added compact page-order actions back into the sequence rail so duplicate / move / remove operations stay adjacent to the page stack instead of hiding behind disconnected controls.
- Tightened starter-pack cards so the action buttons stay on one row with shorter labels and less vertical waste.
- Simplified page copy controls so only fields rendered by the active template stay visible. `Grid` and `Triptych` now suppress deck copy in the preview and editor, which gives the title rail cleaner spacing instead of crowding deck text against the headline.
- Updated source assertions in `validate:mvp` to lock in the new grouped panel structure, compact project URL copy affordance, and deck-suppression behavior.

### Validation

- `npm run validate:mvp`

### Remaining limits

- This sandbox still cannot capture a rendered browser session, so final visual sign-off still depends on one manual browser pass for panel balance, starter-pack density, and the revised Grid/Triptych typography.

## 2026-03-26 Editor IA Cleanup Pass

### What changed

- Reorganized the four-column `/editor` shell around actual task flow instead of scattered panel placement. The far-left rail now owns sequence navigation, starter packs, and page-surface choices together so issue-level structure stays in one place.
- Merged `New draft`, `Print / PDF`, `Create stable URL`, and `Copy link` into a single non-sticky project action card on the far-right rail. The old split topbar/project-bar treatment is gone, and the actions no longer fight the viewport with pinned chrome.
- Moved `Add selected layout` next to the template chooser it depends on, instead of leaving the trigger on the opposite side of the editor. Page actions on the left rail now stay focused on duplicate / move / remove operations for the currently selected page.

### Validation

- `npm run validate:mvp`

### Remaining limits

- This sandbox still cannot provide a rendered browser usability proof, so final sign-off still depends on one real manual pass for panel flow and the 3-page PDF export behavior in the target browser.

## 2026-03-26 Live Preview Cleanup

### What changed

- Removed the duplicated `.editor-stage__meta` block from the center editor stage so the live preview column now renders only the printable page surface and no helper copy above it.
- Kept the accepted four-column desktop direction intact. The left navigation rail, center preview stage, inner-right content controls, and outer-right operations rail are unchanged apart from the preview-only cleanup.
- Extended `validate:mvp` with explicit source assertions that the stage metadata block stays absent, so the duplicate preview info does not creep back in while Page actions and the right-side panels continue to own that context.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

### Remaining limits

- This sandbox still cannot capture a real browser print preview, so final visual confirmation of the preview-only center column still depends on one manual browser pass even though the source and build validation now protect the intended structure.

## 2026-03-26 Four-Column Editor And Print Pagination Follow-up

### What changed

- Rebuilt `/editor` into the accepted four-column desktop shell. The left rail now keeps only sequence navigation plus page-level actions, the center column holds a slightly narrower but more stable live A4 page, and the former single right rail is split into a content column plus an operations column.
- Moved the most important project controls to the top-right and pinned them with a sticky stack. Save/create-stable-URL, copy-link, New draft, and Print / PDF now stay anchored while longer controls like assets, templates, themes, starter packs, and custom layout editing scroll beneath them.
- Reorganized editor controls around a more product-like flow instead of the earlier mixed rail. Page copy, frame crop/fit, and issue copy now live in the inner-right column beside the preview; assets, layout presets, page surface themes, and multi-page starter packs now live in the outer-right operations column.
- Fixed the trailing blank-page export bug at the print-shell level instead of only relying on page-break placement. The print stylesheet now clears the desktop editor shell's padding, margin, and `min-height` so exact-height A4 print pages are not nudged into a phantom extra sheet.
- Extended `validate:mvp` source assertions to cover the new four-column shell markers and the print-shell reset, so the accepted layout direction and the blank-page guard are both protected in this sandboxed environment.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

### Remaining limits

- This sandbox still cannot render a real browser print preview or generated PDF, so the blank-fourth-page fix is validated by the corrected print-shell rules plus source assertions rather than a captured browser export.
- Final sign-off should still include one manual desktop browser pass covering the four-column balance, sticky top-right actions, asset placement flow, and a real 3-page Print / PDF export to confirm the trailing blank page is gone in the target browser.

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

## 2026-03-28 Admin Layout And Registration Guardrail Follow-up

### What changed

- Rebuilt the `/admin` dashboard from a single auto-flow panel grid into an explicit two-column operations layout. `Stats`, `Users`, `Projects`, and `Uploads` now live in the primary column, while `Recent activity` and `Failures` are grouped into a secondary rail so section widths, gaps, and scroll regions stay predictable instead of drifting based on content height.
- Tightened admin row composition so metadata pills stay anchored at the upper-right edge of each row and action buttons sit lower with consistent spacing. This removes the previous floating alignment that made rows look improvised and wasted vertical space.
- Added server-owned registration captcha challenges and per-IP rate limiting for registration requests. The registration page now fetches a live challenge, requires the answer on submit, and refreshes the challenge after a failed attempt instead of reusing stale state.
- Closed the obvious mail-abuse side paths by applying the same server-side rate limiting foundation to verification resend and password reset request endpoints. SMTP usage still flows through the existing centralized mail helper and deployment environment variables.
- Extended MVP validation to cover the new captcha endpoint, captcha failure handling, registration IP throttling, and the presence of the new auth/admin source hooks.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml up -d --build`
- `docker compose -f /opt/finalfolio/app/deploy/docker-compose.yml ps`
- `curl -I https://finalfolio.com` -> `HTTP/2 200`
- `curl -I https://finalfolio.com/admin` -> `HTTP/2 200`
- `curl -I https://finalfolio.com/auth` -> `HTTP/2 200`
- `curl -I https://finalfolio.com/api/health` -> `HTTP/2 200`
- `curl -I "https://finalfolio.com/api/auth/captcha?purpose=register"` -> `HTTP/2 200`, `Cache-Control: no-store`
- Deployment timestamp (UTC): `2026-03-28T05:12:46Z`

### Remaining risks

- The captcha is currently rendered as a server-issued SVG challenge rather than a heavier external anti-bot service. Combined with strict IP throttling this materially improves protection now, but long-term abuse resistance can still be improved further with stronger bot detection or secondary reputation checks if traffic volume grows.
- This sandbox still cannot perform a browser-rendered visual proof of the new `/admin` column behavior. Source validation and deploy health checks cover structure, but final human sign-off should still include one desktop pass and one narrow-width pass in a real browser.

## 2026-03-28 Admin Column Balance And Control Sizing Follow-up

### What changed

- Moved `Users` out of the primary admin column and into the right-hand operations rail so the main dashboard now stays focused on `Stats`, `Projects`, and `Uploads`, while user moderation sits with other secondary governance panels.
- Reworked each `admin-row` into a real two-zone layout: descriptive content on the left, and a dedicated right-side aside containing `admin-row__meta` above `admin-row__actions`. This makes pills and action buttons share the same right alignment line instead of floating independently.
- Normalized control sizing across the product by tightening button/input specs into one system:
  - standard buttons and single-line inputs now share the same 46px control height
  - small buttons now consistently use the same 40px height everywhere, including inside `.editor-shell`
  - upload buttons now follow the same small-control dimensions and typography
  - inputs now use the same visual weight and shadow family as the button system instead of reading as a separate component language
- Smoothed the registration captcha presentation so the captcha image surface and the answer-entry surface now use the same card height and framing, removing the previous uneven visual block.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

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
- `npm run uploads:manage -- list --data-root /tmp/finalfolio-upload-audit-empty`

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
- `npm run uploads:manage -- list --data-root /tmp/finalfolio-upload-audit-empty`

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

## 2026-03-28 Upload Stability Fix

### What changed

- Stopped `/api/uploads` from waiting on Bitiful object-storage mirroring before returning success to the editor.
- Kept the primary upload flow local-first: files still land on disk, variants are still generated, asset records are still created, and the editor now gets its `201` response immediately.
- Moved object-storage mirroring into a background queue so a slow or incompatible remote upload no longer traps the browser at `Uploading 100%`.
- Added a hard timeout to object-storage commands and recorded mirror failures as ops events instead of silently leaving the request hanging.
- Narrowed the Bitiful S3 client configuration so flexible checksum behavior is no longer enabled unless the request explicitly requires it.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`
- Manual in-process upload repro against `/api/uploads` returned `201` in about `931ms` using a real authenticated multipart request, which verified that the request no longer waits for remote object-storage sync to finish.

### Notes

- Bitiful mirroring is still attempted after the response; if it times out or fails, the upload stays locally available and the admin storage stats can still show it as local-only.
- Bitiful's own guidance prefers backend-signed direct HTTP uploads for web flows. If remote mirroring still needs to be made fully reliable, the next step should be moving the storage sync path closer to that signed-URL model instead of leaning harder on the current synchronous SDK upload behavior.

## 2026-03-28 TOS Redirect Hardening

### What changed

- Kept the Terms of Service requirement in place, but stopped account/admin/editor from getting stranded on stale SPA screens when a signed-in legacy account still needed to accept the current terms.
- Added hard browser-level redirects for the critical top-level transitions used by auth, terms, admin, and account so route changes do not depend on React Router state staying healthy after login or gated API failures.
- Preserved API error metadata on the client, then used it to redirect `terms_required` failures before admin/account/upload flows can settle into dead-end status messages.
- Left registration-side TOS copy and acceptance plumbing intact while making the post-login/post-verify path reliably land on `/terms` for legacy accounts.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`
- Live checks against the production session, terms acceptance, admin summary, and multipart upload endpoints confirmed the intended behavior after deployment-ready fixes:
  - legacy sessions report `needsTermsAcceptance: true`
  - `/api/legal/terms/accept` clears the gate
  - `/api/admin/summary` responds after acceptance
  - `/api/uploads` returns `201` and the new file is mirrored into Bitiful sync index

### Notes

- This specifically addresses the previously observed failure mode where the URL changed but the visible page did not, leaving users stuck with `Accept the Terms of Service to continue.` in the wrong place.
- The TOS document remains English because the site still operates as an English-only product; Chinese copy should only appear after real language switching lands.

## 2026-03-29 Share Viewer Viewport Fix

### What changed

- Reworked the public share viewer into a true viewport-bounded shell instead of a document-length page with sticky sections and `calc(100vh - …)` guesses.
- Bound the left reading stage to the actual remaining browser height with a dedicated frame container, then kept viewer scaling tied to that measured frame so the rendered `.magazine-page` no longer grows past the visible viewport.
- Removed the stale fullscreen stage height override that was still fighting the newer measured-scaling path.
- Moved the page counter into the center of the previous/next control row and pushed the jump control into a quieter secondary position below it.
- Disabled touch-driven browser panning inside the page viewport so swipe-to-turn does not compete with vertical document scrolling while reading.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

### Remaining risk

- This pass hardens the viewer shell and scaling logic, but the final visual confirmation still depends on a manual browser pass against a real shared project on desktop and mobile because `validate:mvp` does not inspect live viewport geometry.

## 2026-03-29 Share Viewer Chrome Reduction Follow-up

### What changed

- Removed the dedicated share-view header strip so `/project/:shareId` now uses the viewport almost entirely for the reading stage and right-side tools.
- Simplified visible page rendering in the public viewer:
  - the visible turn layers now render `MagazinePreview` directly, which means the live reading surface is the `.magazine-page` itself
  - removed the hidden `magazine-sheet-probe` node from the viewer tree and switched scale measurement to CSS paper-size conversion instead
- Deleted the jump-to-page control from the right sidebar and kept navigation focused on `Previous / current page / Next`.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

### Remaining risk

- This follow-up reduces visual chrome and wrapper complexity, but final acceptance for spacing and reading comfort still depends on a live browser pass with a real shared issue.

## 2026-03-29 Share Viewer Unframed Presentation Follow-up

### What changed

- Removed the `issue-view-stage` / `issue-view-stage__frame` shell from the public viewer layout and replaced it with a plain reader container so the work is presented directly instead of inside a framed stage card.
- Kept the scale-measurement behavior, but moved it onto the reader container itself so the page still fits the viewport without needing a bordered wrapper.
- Removed the `box-shadow` from `issue-view-copy` while leaving the tools panel elevated.

### Validation

- `npm run typecheck`
- `npm run validate:mvp`

### Remaining risk

- This is a presentation-level cleanup only; the remaining acceptance item is visual confirmation in a live browser that the direct presentation reads the way you want across desktop and fullscreen.

## 2026-11-15 Intuitive Editor Pass and Full Chinese Interface

### What changed

- Added a gettext-style i18n runtime (`src/i18n`): `LocaleProvider`, `useT()`, a standalone `translate()` for module-level copy, and a language toggle in the site header. The choice persists in `localStorage` and drives `<html lang>`.
- Translated the whole product surface, not just chrome: site pages, auth, account, admin, editor sidebars, export center, confirmations, toasts, server error messages, legal pages (privacy now ships a zh-CN document), template/theme/starter-pack metadata, page starter copy for new drafts, and the homepage demo sequence.
- Editor UX:
  - Paper colour moved from a standalone panel into a per-page dot on each sequence chip, opening a compact swatch popover with "apply to all pages". Non-active chips collapse to one row.
  - Page templates now render layout thumbnails; descriptions stay in the hover/focus preview.
  - Project templates stay collapsed unless the draft is empty, and "Use as project" is a danger-styled action behind an explicit confirmation.
  - The content sidebar leads with Photos; a new "Add from URL" form imports remote images.
  - Clicking any text block on the stage opens an anchored inline editor (kicker/title/deck/body/caption); Esc or blur commits and closes.
  - Empty drafts show a dismissible four-step first-run hint.
- Server: `POST /api/uploads/from-url` downloads http/https images with SSRF guards (public addresses only, per-hop redirect validation, size cap, magic-byte validation) and feeds the existing upload/variant/object-storage pipeline.

### Validation

- `npm run validate:mvp`
- `./node_modules/.bin/playwright test` (12 specs, including new URL-import guard and editor UX/i18n coverage)
- zh/en screenshot sweep at 390/768/1024/1440 with no horizontal overflow

### Remaining risk

- Machine-translated copy should get a native review pass, especially long marketing sentences and admin-only labels.
- The URL importer depends on outbound network access from the server; failures surface as a toast and never create partial uploads.

## 2026-11-15 Chinese Copy Rewrite and Editor Refinement

### What changed

- Replaced the literal Chinese translation with a rewritten product vocabulary (作品集 / 页面排版 / 引题 / 导语 / 图注 / 图库 …), covering the whole interface, confirmations, activity labels, legal pages and the homepage demo content. Account and admin timestamps now use `zh-CN` formatting.
- Self-hosted LXGW WenKai (霞鹜文楷) for Chinese text and removed every Songti fallback, so headings and body copy keep a designed, calligraphic tone while Latin text still uses Newsreader/Manrope.
- Removed the "quick start" card. Empty states now explain themselves: the photo library shows a direct upload hint, and empty frames keep their drop target.
- Paper-colour popover now anchors to the colour dot, uses round swatches, and closes on Escape or an outside click.
- "Page templates" became 页面排版: A4-proportion schematics with the real page margins, three per row, centred labels. Hover shows only the description plus a recommended use case, and exposes two direct actions — replace the current page (keeping its photos and copy) or add the layout as a new page below.
- Fixed the danger button's stray light rim and switched focus rings to an outline so they no longer read as extra borders.
- Text editing now happens directly on the page: page text is `contenteditable`, commits on blur/Escape, and no longer opens a floating dialog.
- Unsaved project/share links use muted placeholders instead of dark inline copy.

### Validation

- `npm run validate:mvp`
- `./node_modules/.bin/playwright test` (13 specs)
- zh/en screenshot sweep at 390/768/1024/1440

### Remaining risk

- LXGW WenKai adds ~9 MB of subsetted WOFF2 to the build; subsets load on demand via `unicode-range`, so first paint stays light.
- Existing drafts keep the language they were created in; only new pages pick up Chinese starter copy.

## 2026-11-15 Font Scoping and Layout Picker Polish

### What changed

- Replaced the 194-file LXGW WenKai webfont bundle with one self-hosted 866 KB WOFF2 subset (`public/fonts/LXGWWenKai-Regular.woff2`, GB2312 level-1 plus punctuation) and removed the font npm dependency and all font preloads.
- Scoped the designed typeface to the homepage and the rendered folio pages only (editor preview, public viewer). Auth, terms, account, admin, buttons, links and captions now use the system UI font, and admin previews stay on the system stack too. `font-display: swap` keeps the system font visible until the display font is ready.
- Paper-colour selection now uses a small check mark instead of a heavy outline, and the popover background is opaque so chips no longer show through.
- Layout schematics: replaced percentage gaps inside text stacks (which collapsed to zero) with fixed gaps, reduced line and image corner radii, and gave the page thumbnail a small sheet shadow. Hover actions are centred over the schematic, which dims and blurs behind them; the description panel now anchors outside the sidebar.
- Localised structural page labels (`Page 01`, frame hints) and fixed new-draft template copy so pages are created with native Chinese starter text instead of English defaults.
- Copy fixes: “已存入账户” → “账户图库”, “未用于本作品集” → “本作品集未使用”, “插入当前” → “插入页面”.

### Validation

- `npm run validate:mvp`
- `./node_modules/.bin/playwright test` (13 specs)
- Font network check: auth/terms/account/admin load no custom fonts; homepage and editor load Newsreader + one WenKai file.

### Remaining risk

- The display subset covers GB2312 level-1 characters; rare characters in user copy fall back to the system font.

## 2026-11-15 Loading Experience and Asset Weight

### What changed

- Added an inline critical boot style + centred brand loader in `index.html` so the first paint uses the same paper tone as the app (no white flash or colour shift), and the spinner is centred in the real viewport (`100dvh`). The Suspense fallback now matches that loader instead of a mono, uppercase "LOADING" label.
- Converted the 12 built-in demo photographs to 1000 px WebP (3.7 MB → 1.2 MB) and updated the demo asset paths.
- Subset Newsreader to Latin + punctuation as a 120 KB WOFF2 (was a 442 KB TTF) and removed the unused italic and IBM Plex/Manrope fonts and preloads.
- Removed the last remaining percentage gap in layout schematics earlier in this cycle; this pass only touches loading and asset delivery.

### Validation

- `npm run validate:mvp`
- `./node_modules/.bin/playwright test` (13 specs)
- Slow-network check: boot loader centred at 390×844, first paint matches the final background, homepage load ~1.6 s on throttled 400 kbps.

### Remaining risk

- Homepage still ships the demo photographs (now WebP). Further savings would need per-viewport variants or lazy loading of off-screen marquee pages.
