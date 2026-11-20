# AI Arrangement

## Overview

AI arrangement is an optional, admin-governed editor assistant. A signed-in user
selects up to 50 photos, reviews the default prompt, and asks the configured AI
pool for three folio plans. The editor only changes after the user selects a plan
and presses **Apply this plan**.

## Admin configuration

Admin → **AI**:

- Global on/off switch.
- Per-user total uses and daily uses (`0` means unlimited).
- Maximum photos per request (capped at 50).
- Generation budget (**Provider timeout**, 15–300 s, default 180 s): the ceiling
  for one whole generation across the pool.
- Default prompt (shown to users; users may edit a temporary copy).
- Interface pool: name, model, Base URL, API key, enabled flag and priority.
- **Test connection** for any provider from the focused edit dialog.
- **AI usage** lists every account with editable total and daily used counts, plus
  a reset action. Global limits still apply.
- Plans are asked to use 4/6/8/10 pages; odd provider responses are padded to an
  even count so spreads turn naturally.
- Saved interfaces render as compact summary rows. Click **Edit interface** to
  open the form; adding an interface also opens a focused dialog, so typing is
  never interrupted by the list collapsing.
- The default prompt is read-only until **Edit prompt** is pressed.
- Up/down ordering; the editor tries enabled providers in order and only reports
  an error after every provider fails.

Base URL should be the OpenAI-compatible root, for example
`https://api.openai.com/v1`; the server calls `/chat/completions` under it.

API keys are stored server-side in `data/ai/config.json` with `0600`
permissions inside a `0700` directory. Admin API responses only expose
`hasApiKey` and a masked hint. Leaving the key field blank while saving keeps the
existing key.

Usage is stored in `data/ai/usage.json` and counted only after a successful
generation. The current model is ready for a future credit/recharge flow.

## User flow

1. Click **Arrange with AI** in the page sequence panel.
2. Guests are redirected to sign-in and returned to the editor.
3. Choose photos from three sources:
   - **Upload photos** — local files upload as soon as they are selected, so
     applying a plan does not repeat the upload.
   - **Choose from library** — reuse photos already in the project without
     uploading them again.
   - **URL import** — import a public image URL into the library and select it.
   Up to 50 photos (or the admin-configured limit) across all sources.
4. Existing photos are shown immediately. **Upload from device** and
   **Import from URL** are additive actions, not mutually exclusive tabs.
   Choose a style preset and optionally add notes; the server prompt is never
   shown or editable in the editor.
5. Generate three plans. The prompt sent to the provider appends the chosen
   style and the user's notes to the admin-owned base prompt. The waiting screen
   shows elapsed time and explains that the pool switches interfaces and retries
   on its own.
6. Compare plan name, style, page count, used photo count, themes and page
   sequence.
7. Apply one plan. Photos selected from the library or URL import are already
   assets; local files were uploaded during selection. Only a file whose earlier
   upload failed is retried here, so applying is normally near-instant. The plan
   replaces the page sequence and folio title/subtitle, issue and frame radius.

The AI response is normalised client-side. Only the built-in page templates are
accepted (`cover`, `essay`, `folio`, `grid`, `diptych`, `panorama`, `mosaic`,
`triptych`), themes are validated, asset indexes are clamped to the selected
photo set, and text is trimmed by the existing page limits.

## Request lifecycle (streaming, hedging, self-correction)

- `POST /api/ai/plans` returns `202` with a `jobId` immediately; the dialog polls
  `GET /api/ai/plans/:jobId` every 1.2 s for up to five minutes. Long
  generations therefore never hit the Cloudflare ~100 s gateway timeout (524)
  that used to kill them while the model was still writing.
- Providers are called with `stream: true`. Three separate budgets replace the
  old single 90 s wall-clock kill switch:
  - **first content — 90 s** from request start until the first token. This must
    cover a whole buffered generation, because a provider that ignores `stream`
    only sends headers together with the finished body (observed healthy runs
    finish in 50–82 s).
  - **idle — 60 s** maximum gap between tokens once streaming has started.
  - **total — the configured budget, capped at 280 s** for the whole generation.
  A stall reports its own reason (`sent no content for 90s`, `stopped sending
  for 60s`, `did not finish within Ns`) instead of a generic timeout.
- Hedged race: the next enabled provider starts as soon as the previous one
  fails, or in parallel once the fastest healthy latency in
  `data/ai/provider-stats.json` is exceeded (about half of the total budget),
  whichever comes first. The first complete answer wins and the rest abort.
- Self-correction: when a provider answers but the answer is unusable (invalid
  JSON, no `plans`, unknown `template`/`theme`, page without `assetIndexes`),
  the error plus the provider's own answer is sent back to the *same* provider
  for one corrected retry before it counts as a failure. Successful corrections
  are counted as `corrections` in `provider-stats.json`.
- Provider statistics (`successes`, `failures`, `totalLatencyMs`, `lastOk`,
  `corrections`) feed provider ordering, so a slow or failing relay sinks to the
  back of the pool automatically.

## Reusing upstream analysis (faster, cheaper)

Photos that already carry AI tags and a description — for example photos
imported from UnAlbum — are not re-analysed. The client sends
`analysis: { description, tags }` and leaves `dataUrl` empty; the server skips
the image payload for those photos and states in the prompt that they are
pre-analysed and must be trusted. Mixed selections work: analysed photos travel
as text, the rest keep their 320 px JPEG thumbnails.

Measured effect on the request: one analysed photo saves roughly 20–40 KB of
base64 payload and one vision tile of provider-side prefill. Selection is also
faster because `readAssetPhoto` uses the stored width/height and never decodes
or re-encodes an image for an analysed asset. Wall-clock generation time is
still dominated by output tokens (three full plans) plus provider latency, so
this is a cost/latency improvement rather than an order-of-magnitude change.

## Privacy and failure behaviour

- Only small JPEG thumbnails (320 px long edge) are sent to the AI provider.
- Photos with existing analysis send text only (description + tags).
- Imported analysis is bounded on the server (800-char description, 24 tags) so
  a hostile or bloated upstream field cannot inflate the prompt.
- Provider errors are aggregated; API keys and full provider responses are never
  returned to the client.
- The endpoint is authenticated and rate-limited per user.
- If every provider fails, the editor keeps the current folio unchanged.
- If some uploads fail during apply, the affected frames stay empty and the
  status message reports how many photos failed.

## Verification

- `tests/e2e/multi-select.spec.ts` covers Shift/Ctrl/rubber-band selection and
  that a drag never leaves a stray click behind.
- `tests/e2e/ai-arrange.spec.ts` covers guest gating, prompt read-only/edit,
  three-plan selection, apply, and the admin provider save flow.
- `npm run validate:mvp` checks the server store, routes and UI wiring.

## Residual risks

- AI providers receive small thumbnails; this is disclosed in the dialog and
  should be covered by the site privacy policy if a third-party provider is used.
- Provider API keys are stored server-side in a `0600` file, but not encrypted at
  rest yet. Encrypting them with the existing security secret store is a sensible
  next hardening step.
- AI output quality depends on the configured vision model. Plans are validated,
  but the copy and image-to-page choices still need a human review.
- Quotas are per-user total/daily counts. There is no recharge or per-user
  override UI yet; the usage file is structured so a credit flow can be added.
- A generation runs as a background job for up to the configured budget (180 s
  by default, 280 s hard cap) while the dialog polls; it shows elapsed time and
  allows cancellation, which aborts the job's provider calls.
