# Uploads and object-storage delivery

FinalFolio has two upload paths. The browser picks the direct path when the
server offers a presigned ticket, and falls back to the proxied multipart path
otherwise. Both end in the same asset record, so the rest of the app does not
care which path was used.

## Direct path (object storage enabled)

1. `POST /api/uploads/presign` with `{ filename, contentType, size }`.
   - Requires a session.
   - Rejects anything that is not JPEG/PNG/WebP/AVIF/GIF or larger than the
     configured upload limit.
   - Returns `{ enabled: false }` when object storage is disabled, which makes
     the client fall back.
   - Otherwise returns `{ enabled: true, filename, key, url, publicUrl }`, where
     `url` is a 15-minute presigned `PUT`.
2. The browser PUTs the file straight to the bucket with `XMLHttpRequest`, so
   the progress bar reflects the real bytes, not a proxy.
3. `POST /api/uploads/complete` with `{ filename, key, originalName, width,
   height, bytes }`.
   - Re-validates the session, filename, and key shape
     (`.../uploads/<filename>`).
   - `HeadObject`s the object, checks its size and content type.
   - Downloads the original to `data/uploads`, generates variants, creates the
     asset record, and mirrors the variants to the bucket in the background.
   - A failed mirror leaves the local asset usable and the sync index marks the
     delivery as failed so the gallery can retry.

Bucket CORS must allow `PUT` from the site origin. The production bucket
(`s3.bitiful.net`) returns `Access-Control-Allow-Origin: *` and
`Access-Control-Allow-Methods: *`, verified with an `OPTIONS` preflight.

## Proxy path (object storage disabled)

`POST /api/uploads` keeps working: files are processed in parallel, the response
is sent as soon as local variants exist, and mirroring runs in the background.
Sync failures never roll the upload back.

## Verification

- `presign → PUT → HEAD → public GET` against the production bucket: all 200.
- Browser-side presign → PUT → complete: `presign 200`, `PUT 200`,
  `complete 201`, local file created.
- Playwright upload suites pass on the proxy fallback.
