# FinalFolio

Production site and editor for `finalfolio.com`.

## Stack

- React + TypeScript + Vite
- Static delivery through Nginx
- Docker Compose deployment on the existing `frontend-net` used by Caddy Docker Proxy

## Local Commands

```bash
npm install
npm run build
npm run validate:mvp
npm run uploads:manage -- list
```

## Production Deployment

The live deployment is designed to run as a separate compose project so it does not modify the Seatable stack:

```bash
rsync -a --delete --exclude data --exclude node_modules --exclude dist /opt/finalfolio/app/ /opt/finalfolio/app/  # adjust source
cd /opt/finalfolio/app
cp deploy/.env.example deploy/.env   # fill in SMTP credentials once, never commit it
sudo chown -R 1000:1000 data         # the container runs as the unprivileged node user
docker compose -f deploy/docker-compose.yml up -d --build
```

Secrets (SMTP password, public origin, cookie flags) come from `deploy/.env`, which is
git-ignored. The container runs as UID 1000; `/data` must be writable by that user.

Existing deployments created before the 2026-11 hardening pass keep their old file modes
until touched. Tighten them once when upgrading, and rotate any credential that was
previously committed or exposed through `docker inspect`:

```bash
sudo chown -R 1000:1000 data
sudo chmod -R go-rwx data
```

## Data and privacy

- Session cookies and emailed action tokens are stored as SHA-256 hashes, never in plain text.
- Uploaded files and account records are created with `0600` permissions under `0700` directories.
- Deleting a folio also deletes photos that no other folio references. Shared library assets are kept.
- Event logs are capped per record and pruned after `FINALFOLIO_EVENT_RETENTION_DAYS` (default 30).

## Verification

```bash
docker ps --filter name=finalfolio-web
curl -I https://finalfolio.com
curl -I https://www.finalfolio.com
curl -I https://hyphenless.com
curl -I https://sometable.com
```

## Notes

- `/` is the editorial homepage.
- `Export Center → PDF` downloads a real PDF rendered from the same page components as the editor. `Print instead` opens the browser print dialog when a paper proof is needed.
- `/editor` is the live editor with uploads, fixed page geometry, preset templates, fit + crop controls, server saves, and print-to-PDF output.
- New drafts persist locally until you create a stable editor URL on the server.
- `npm run validate:mvp` rebuilds the app and runs the in-process MVP validation checks used for this cleanup pass.
- `npm run uploads:manage -- list --data-root /data` lists uploaded files, references, and stale candidates without deleting anything.
- `npm run uploads:manage -- prune --older-than-hours 168 --delete --data-root /data` removes unreferenced uploads older than the chosen threshold after an explicit admin review pass.
