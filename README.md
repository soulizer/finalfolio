# FinalFolio

Production site and editor for `finalfolio.com`.

## Stack

- React 19 + TypeScript + Vite frontend (SPA, lazy routes)
- Node.js + Express API, JSON file store, local uploads with object-storage mirroring
- Docker Compose behind Caddy Docker Proxy (`frontend-net`)
- Playwright end-to-end tests, in-process MVP validation script

## Local Commands

```bash
npm install
npm run dev            # Vite dev server
npm run build          # typecheck + production build
npm run start          # Express server serving dist/
npm run validate:mvp   # build + in-process product checks
npm run validate:e2e   # Playwright suite
npm run uploads:manage -- list
```

## Editor Overview

- `/editor` is the live editor: upload photos, drag pages to reorder, choose a
  layout, edit text directly on the page, crop/fit photos, then save, export PDF,
  or publish a read-only share link.
- The rendered page, the exported PDF/JPG files and the public viewer all use the
  same `MagazinePreview` page renderer.
- Drafts stay local until you save; guest uploads can be recovered and attached
  after sign-in.
- Chinese and English are both supported. The language toggle is in the header;
  the choice is stored in `localStorage` and drives `<html lang>`.

## Production Deployment

```bash
# from the repository root, sync the app (keep data/ and secrets in place)
sudo rsync -a --delete \
  --exclude data --exclude node_modules --exclude dist --exclude .git \
  --exclude tests --exclude deploy/.env \
  ./ /opt/finalfolio/app/

cd /opt/finalfolio/app
cp deploy/.env.example deploy/.env   # fill in SMTP credentials once, never commit it
sudo chown -R 1000:1000 data         # the container runs as the unprivileged node user
sudo docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d --build
```

Secrets (SMTP password, public origin, cookie flags) come from `deploy/.env`,
which is git-ignored. The container runs as UID 1000; `/data` must be writable by
that user. Existing deployments created before the 2026-11 hardening pass keep
their old file modes until touched; tighten them once when upgrading and rotate
any credential that was previously committed or exposed through `docker inspect`:

```bash
sudo chown -R 1000:1000 data
sudo chmod -R go-rwx data
```

### Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `FINALFOLIO_DATA_ROOT` | `/data` in Docker | Project, account, upload and event storage |
| `FINALFOLIO_PUBLIC_ORIGIN` | request origin | Canonical origin used in emails and links |
| `FINALFOLIO_COOKIE_SECURE` | on in production | Adds `Secure` to session cookies |
| `FINALFOLIO_EVENT_RETENTION_DAYS` | `30` | Admin event retention window |
| `FINALFOLIO_MAX_UPLOAD_SIZE_BYTES` | `26214400` | Per-file upload cap (also used by URL import) |
| `FINALFOLIO_MAX_UPLOAD_COUNT` | `24` | Files per upload request |
| `FINALFOLIO_MAX_PAGE_COUNT` | `48` | Pages per folio |
| `FINALFOLIO_MAX_ASSET_COUNT` | `64` | Assets per folio |
| `FINALFOLIO_LOGIN_IP_LIMIT` | `30` | Sign-in attempts per IP per 15 min |
| `FINALFOLIO_LOGIN_IDENTIFIER_LIMIT` | `10` | Sign-in attempts per account per 15 min |
| `FINALFOLIO_SMTP_*` / `FINALFOLIO_MAIL_FROM*` | — | Verification and password-reset mail |

## Data and Privacy

- Session cookies and emailed action tokens are stored as SHA-256 hashes, never in plain text.
- Uploaded files and account records are created with `0600` permissions under `0700` directories.
- Deleting a folio also deletes photos that no other folio references. Shared library assets are kept.
- Event logs are capped per record and pruned after `FINALFOLIO_EVENT_RETENTION_DAYS` (default 30).
- URL imports only fetch public http/https origins, re-check every redirect, cap the
  response size and validate image magic bytes before entering the upload pipeline.

## Verification

```bash
npm run validate:mvp
npm run validate:e2e
docker ps --filter name=finalfolio-web
curl -I https://finalfolio.com
curl -I https://www.finalfolio.com
```

- `/` is the editorial homepage.
- `Export Center → PDF` downloads a real PDF rendered from the same page components as the editor. `Print instead` opens the browser print dialog when a paper proof is needed.
- `npm run uploads:manage -- list --data-root /data` lists uploaded files, references, and stale candidates without deleting anything.
- `npm run uploads:manage -- prune --older-than-hours 168 --delete --data-root /data` removes unreferenced uploads older than the chosen threshold after an explicit admin review pass.

## Operational Notes

- Rotate the SMTP password if it was ever committed or visible via `docker inspect`.
- Verify a restore from the latest `/opt/finalfolio/backups` archive before relying on it.
- Backups live outside the repository; do not commit `deploy/.env` or `data/`.
