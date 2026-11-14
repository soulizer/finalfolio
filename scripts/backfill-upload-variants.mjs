import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createProjectStore } from '../server/app.js';

function readOption(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) {
    return fallback;
  }

  return args[index + 1];
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

const args = process.argv.slice(2);
const defaultDataRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const dataRoot = readOption(args, '--data-root', process.env.FINALFOLIO_DATA_ROOT ?? defaultDataRoot);
const limit = Math.max(0, Number(readOption(args, '--limit', '0')) || 0);
const force = args.includes('--force');

const store = createProjectStore({
  ...(dataRoot ? { dataRoot } : {}),
});

await store.ensureDataDirectories();
const entries = await fs.readdir(store.uploadsDir, { withFileTypes: true });
const filenames = entries
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort();
const targets = limit > 0 ? filenames.slice(0, limit) : filenames;

const result = {
  scanned: targets.length,
  previewCreated: 0,
  thumbCreated: 0,
  previewAlreadyPresent: 0,
  thumbAlreadyPresent: 0,
  failed: [],
};

for (const filename of targets) {
  const asset = {
    id: `backfill-${filename}`,
    name: filename,
    src: `/uploads/${filename}`,
    note: '',
  };
  const previewPath = path.join(store.uploadsDir, 'variants', filename, 'preview.webp');
  const thumbPath = path.join(store.uploadsDir, 'variants', filename, 'thumb.webp');
  const previewBefore = await fileExists(previewPath);
  const thumbBefore = await fileExists(thumbPath);

  try {
    if (force) {
      await fs.rm(path.join(store.uploadsDir, 'variants', filename), { force: true, recursive: true });
    }

    await store.hydrateStoredUploadAsset(asset, { ensureVariants: true });

    const previewAfter = await fileExists(previewPath);
    const thumbAfter = await fileExists(thumbPath);
    result.previewCreated += previewAfter && !previewBefore ? 1 : 0;
    result.thumbCreated += thumbAfter && !thumbBefore ? 1 : 0;
    result.previewAlreadyPresent += previewBefore ? 1 : 0;
    result.thumbAlreadyPresent += thumbBefore ? 1 : 0;
  } catch (error) {
    result.failed.push({
      filename,
      message: error instanceof Error ? error.message : 'Unknown failure',
    });
  }
}

console.log(JSON.stringify(result, null, 2));
