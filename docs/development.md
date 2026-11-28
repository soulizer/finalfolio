# Development and release

## Commands

```bash
npm install
npm run dev              # Vite dev server
npm run build            # typecheck + production build
npm run start            # Express serving dist/
npm run validate:mvp     # build + in-process product/API/source checks
npm run validate:e2e     # Playwright suite
npm run typecheck
npx playwright test      # direct Playwright run
```

Focused runs:

```bash
npx playwright test tests/e2e/reader-turn.spec.ts
npx playwright test tests/e2e/design-rules.spec.ts
npx playwright test tests/e2e/multi-select.spec.ts
```

## Playwright environment

- Data root: `/tmp/finalfolio-playwright-data` (recreated by
  `tests/e2e/prepare.mjs` on each run).
- Server: `http://127.0.0.1:4173`.
- Accounts:
  - `e2e-user@example.com` / `Password123!` (username `e2euser`)
  - `e2e-admin@example.com` / `Password123!` (username `e2eadmin`)
- Login throttles are lifted for the suite via environment variables.
- Tests must not depend on another spec's uploaded assets; scope searches or
  uploads per test.

## Production deployment

```bash
sudo rsync -a --delete \
  --exclude data --exclude node_modules --exclude dist --exclude .git \
  --exclude tests --exclude deploy/.env \
  /home/ubuntu/finalfolio/ /opt/finalfolio/app/

cd /opt/finalfolio/app
sudo docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d --build
```

`deploy/.env` is git-ignored. The container runs as UID 1000; `/data` must be
writable by that user. After deploy:

```bash
curl -fsS https://finalfolio.com/api/health
```

Do not serve `dist/` from the host copy; the image builds its own client bundle.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `FINALFOLIO_DATA_ROOT` | `/data` in Docker | Persistent JSON/uploads |
| `FINALFOLIO_PUBLIC_ORIGIN` | request origin | Canonical links/email |
| `FINALFOLIO_COOKIE_SECURE` | on in production | Secure session cookie |
| `FINALFOLIO_EVENT_RETENTION_DAYS` | 30 | Admin event retention |
| `FINALFOLIO_MAX_UPLOAD_SIZE_BYTES` | 25 MB | Per-file limit |
| `FINALFOLIO_MAX_UPLOAD_COUNT` | 24 | Files per request |
| `FINALFOLIO_MAX_PAGE_COUNT` | 48 | Pages per folio |
| `FINALFOLIO_MAX_ASSET_COUNT` | 64 | Assets per folio |
| `FINALFOLIO_LOGIN_IP_LIMIT` | 30 / 15 min | Login attempts per IP |
| `FINALFOLIO_LOGIN_IDENTIFIER_LIMIT` | 10 / 15 min | Login attempts per account |
| `FINALFOLIO_SMTP_*` / `FINALFOLIO_MAIL_FROM*` | — | Verification/reset mail |
| `FINALFOLIO_UNALBUM_*` | — | UnAlbum OAuth/API integration |
| Object-storage settings | disabled | Admin → Storage, encrypted credentials |

See `product.md` for UnAlbum endpoints and AI configuration.

## AI providers

FinalFolio calls any OpenAI-compatible `POST {baseUrl}/chat/completions` with
streaming SSE. Every arrangement sends 256px JPEG thumbnails as `image_url`
parts, so the model must accept image input.

| Provider | Base URL | Model | Notes |
| --- | --- | --- | --- |
| OpenCode Console (pay as you go) | `https://opencode.ai/inference/openai/v1` | `deepseek-v4.1-flash` | No extra headers. Uses Console credit. |
| OpenCode Go (subscription) | `https://opencode.ai/inference/go/openai/v1` | `deepseek-v4.1-flash` | Requires `x-opencode-session`; the server adds it for `opencode.ai/inference/go` URLs. |
| Command Code | `https://api.commandcode.ai/provider/v1` | `deepseek/deepseek-v4.1-flash` | Off-peak/peak pricing; standard bearer auth. |

- Use the full base URL shown above. The app appends `/chat/completions`.
- A Go API key is not accepted on the Console endpoint (`unsupported_model`);
  a Console key is not needed on the Go endpoint, but the session header is.
- The admin **Test connection** only sends text. Confirm vision with a real
  multi-photo arrangement.
- Provider routing follows the admin order first; measured latency only breaks
  ties. This keeps the chosen primary ahead of a provider that merely answered
  a quick text ping.
- OpenCode Go requests use `reasoning_effort: low`. Layout planning is
  structured output, and full reasoning effort made 45-50 photo jobs exceed the
  time budget.
- Large selections get a larger page budget (14-20 pages at 37-50 photos).
  The server only rejects a plan that references no selected photo; the client
  appends filler pages for any photo the model leaves out.
- Failed AI jobs are recorded as `ai` events with the provider error, so a
  generic client message can be diagnosed from `data/events`.
- `data/ai/provider-stats.json` is telemetry, not configuration. It is written
  through a per-file queue with unique temp files; a corrupt file is ignored
  and replaced on the next write.

## AI cache and typography

- `src/editor/aiCache.ts` keeps prepared 256px thumbnails and plan-derived
  photo descriptions in IndexedDB, keyed by asset id plus size. Reopening the
  dialog or retrying a generation reuses them. Thumbnails are still sent to
  the provider; cached text is auxiliary context, never a replacement for the
  pixels.
- `normalizeProjectState` must preserve `fonts`. Dropping it here made every
  save, autosave response, hydration and template application reset the folio
  to the default font stack.
- Font files are loaded on demand and can be several megabytes. The typography
  panel shows a loading note while the selected family downloads.

## Performance guardrails

- `jszip` and `html-to-image` are dynamic imports inside the export functions;
  do not add top-level imports back to `src/editor/export.ts`.
- Preview images default to `loading="lazy"`; the editor canvas and the
  print/export stack pass `imageLoading="eager"`.
- Homepage previews use the `thumb` derivative and a small page/copy count.
- Session refresh is memoised/deduped; reveal and panel-collapse observers
  coalesce mutations instead of scanning per record.
- Reader page markup is rendered once per book, not once per page.
- Server memoises object-storage config/secrets and the sync index; invalidate
  them on writes. Upload variant generation is capped at four concurrent files.
- Export image waits time out, and stitched JPG checks canvas limits before
  allocating.

## Release checklist

1. `tsc --noEmit` / `npm run build`.
2. `npm run validate:mvp`.
3. Full `npx playwright test` green.
4. For UI work: check 360/390/768/1024/1440 widths; one primary action; no hover
   lift; gallery selection has no extra frame.
5. For reader work: read `reader-and-mobile.md`; run `reader-turn.spec.ts`.
6. Commit with a clear message, push `fix/comprehensive-review` and `main`.
7. Deploy and verify `/api/health`.
8. Hard-refresh the browser (no service worker; hashed assets change).

## Backup and data

- Backups live outside the repository (`/opt/finalfolio/backups`).
- Never commit `deploy/.env` or `data/`.
- Upload maintenance:
  ```bash
  npm run uploads:manage -- list --data-root /data
  npm run uploads:manage -- prune --older-than-hours 168 --delete --data-root /data
  ```
- Rotate the SMTP password if it was ever exposed; tighten data permissions
  after upgrading from older deployments (`chown -R 1000:1000 data`,
  `chmod -R go-rwx data`).

## Documentation hygiene

- Keep only the five documents listed in `docs/README.md`.
- Dated audits/reports are deleted once their durable conclusions are merged.
- Put a reproducible test next to every invariant worth protecting.
