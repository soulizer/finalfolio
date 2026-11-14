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
const detach = !args.includes('--keep-remote-link');

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

const syncIndex = await objectStorageStore.readSyncIndex();
const filenames = Object.keys(syncIndex.uploads)
  .sort()
  .slice(0, limit > 0 ? limit : Number.POSITIVE_INFINITY);

const result = {
  scanned: filenames.length,
  restoredFiles: 0,
  detachedUploads: 0,
  failed: [],
};

for (const filename of filenames) {
  try {
    const artifacts = await store.getUploadArtifacts(filename);
    const restoreResult = await objectStorageStore.restoreRemoteUploadToLocal(filename, artifacts, { detach });
    result.restoredFiles += restoreResult.restoredFiles;
    result.detachedUploads += restoreResult.detached ? 1 : 0;
  } catch (error) {
    result.failed.push({
      filename,
      message: error instanceof Error ? error.message : 'Unknown restore failure.',
    });
  }
}

store.invalidateStoreCaches();
console.log(JSON.stringify(result, null, 2));
