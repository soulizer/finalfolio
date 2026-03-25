# CrazyAlbum

Minimal production site and editor prototype for `crazyalbum.com`.

## Stack

- React + TypeScript + Vite
- Static delivery through Nginx
- Docker Compose deployment on the existing `frontend-net` used by Caddy Docker Proxy

## Local Commands

```bash
npm install
npm run build
```

## Production Deployment

The live deployment is designed to run as a separate compose project so it does not modify the Seatable stack:

```bash
rsync -a --delete --exclude node_modules --exclude dist /tmp/crazyalbum-codex/ /opt/crazyalbum/app/
cd /opt/crazyalbum/app
docker compose -f deploy/docker-compose.yml up -d --build
```

## Verification

```bash
docker ps --filter name=crazyalbum-web
curl -I https://crazyalbum.com
curl -I https://www.crazyalbum.com
curl -I https://hyphenless.com
curl -I https://sometable.com
```

## Notes

- `/` is the editorial homepage.
- `/editor` is the interactive browser prototype with uploads, page templates, crop controls, and print-to-PDF output.
- The editor persists the current issue in browser `localStorage`.
