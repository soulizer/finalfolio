import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjectStore } from '../server/app.js';
import { createObjectStorageStore } from '../server/objectStorage.js';
import { createSecurityStore } from '../server/security.js';

function readOption(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) {
    return fallback;
  }

  return args[index + 1];
}

const args = process.argv.slice(2);
const defaultDataRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const dataRoot = readOption(args, '--data-root', process.env.FINALFOLIO_DATA_ROOT ?? defaultDataRoot);
const limit = Math.max(0, Number(readOption(args, '--limit', '0')) || 0);
const force = args.includes('--force');

const securityStore = createSecurityStore({
  ...(dataRoot ? { dataRoot } : {}),
});
const objectStorageStore = createObjectStorageStore({
  ...(dataRoot ? { dataRoot } : {}),
  securityStore,
});
const store = createProjectStore({
  ...(dataRoot ? { dataRoot } : {}),
  objectStorageStore,
});

await store.ensureDataDirectories();

const config = await objectStorageStore.readConfig();
if (!config.enabled) {
  throw new Error('Object storage is disabled. Save and enable object storage config before syncing uploads.');
}

const inventory = await store.collectUploadInventory();
const targets = (limit > 0 ? inventory.items.slice(0, limit) : inventory.items).sort((left, right) =>
  left.filename.localeCompare(right.filename),
);

const result = {
  scanned: targets.length,
  synced: 0,
  skipped: 0,
  failed: [],
};

for (const item of targets) {
  try {
    const existingSyncEntry = await objectStorageStore.readSyncEntry(item.filename);
    if (existingSyncEntry && !force) {
      result.skipped += 1;
      continue;
    }

    const artifacts = await store.getUploadArtifacts(item.filename, {
      ensureVariants: true,
      originalWidth: item.original?.width,
      originalHeight: item.original?.height,
    });
    if (!artifacts?.resources) {
      throw new Error('Local upload artifacts are missing.');
    }

    await objectStorageStore.syncLocalUpload(item.filename, artifacts);
    result.synced += 1;
  } catch (error) {
    result.failed.push({
      filename: item.filename,
      message: error instanceof Error ? error.message : 'Unknown sync failure.',
    });
  }
}

store.invalidateStoreCaches();
console.log(JSON.stringify(result, null, 2));
