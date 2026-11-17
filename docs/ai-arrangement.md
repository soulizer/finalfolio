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
- Provider timeout.
- Default prompt (shown to users; users may edit a temporary copy).
- Interface pool: name, model, Base URL, API key, enabled flag and priority.
- **Test connection** for any provider from the focused edit dialog.
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
4. Review the prompt; **Edit prompt** unlocks a temporary copy.
5. Generate three plans. The waiting screen shows elapsed time and explains that
   the pool tries interfaces in order.
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

## Privacy and failure behaviour

- Only small JPEG thumbnails (320 px long edge) are sent to the AI provider.
- Provider errors are aggregated; API keys and full provider responses are never
  returned to the client.
- The endpoint is authenticated and rate-limited per user.
- If every provider fails, the editor keeps the current folio unchanged.
- If some uploads fail during apply, the affected frames stay empty and the
  status message reports how many photos failed.

## Verification

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
- Requests are synchronous and can take up to the configured timeout (120s by
  default). The dialog shows elapsed time and allows cancellation.
