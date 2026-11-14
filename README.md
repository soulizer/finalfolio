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
rsync -a --delete --exclude data --exclude node_modules --exclude dist /tmp/finalfolio-codex/ /opt/finalfolio/app/
cd /opt/finalfolio/app
docker compose -f deploy/docker-compose.yml up -d --build
```

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
- `/editor` is the live editor with uploads, fixed page geometry, preset templates, fit + crop controls, server saves, and print-to-PDF output.
- New drafts persist locally until you create a stable editor URL on the server.
- `npm run validate:mvp` rebuilds the app and runs the in-process MVP validation checks used for this cleanup pass.
- `npm run uploads:manage -- list --data-root /data` lists uploaded files, references, and stale candidates without deleting anything.
- `npm run uploads:manage -- prune --older-than-hours 168 --delete --data-root /data` removes unreferenced uploads older than the chosen threshold after an explicit admin review pass.
