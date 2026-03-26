import { createProjectStore } from '../server/app.js';

function readOption(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) {
    return fallback;
  }

  return args[index + 1];
}

function formatHours(hours) {
  return `${hours.toFixed(hours >= 24 ? 0 : 1)}h`;
}

const args = process.argv.slice(2);
const mode = args[0] === 'prune' ? 'prune' : 'list';
const dataRoot = readOption(args, '--data-root', process.env.CRAZYALBUM_DATA_ROOT);
const limit = Math.max(1, Number(readOption(args, '--limit', '50')) || 50);
const olderThanHours = Math.max(1, Number(readOption(args, '--older-than-hours', '168')) || 168);
const destructive = args.includes('--delete');

const store = createProjectStore({
  ...(dataRoot ? { dataRoot } : {}),
});

await store.ensureDataDirectories();

if (mode === 'list') {
  const inventory = await store.collectUploadInventory();

  console.log(`Uploads: ${inventory.totals.uploadCount}`);
  console.log(`Referenced: ${inventory.totals.referencedCount}`);
  console.log(`Unreferenced: ${inventory.totals.unreferencedCount}`);
  console.log(`Missing referenced files: ${inventory.totals.missingReferencedCount}`);

  inventory.items.slice(0, limit).forEach((item) => {
    const usage = item.referencedByProjectIds.length ? item.referencedByProjectIds.join(', ') : 'unreferenced';
    console.log(`- ${item.filename} | ${formatHours(item.ageHours)} old | ${usage}`);
  });

  if (inventory.missingReferencedFiles.length) {
    console.log('Missing referenced files:');
    inventory.missingReferencedFiles.forEach((item) => {
      console.log(`- ${item.filename} | referenced by ${item.referencedByProjectIds.join(', ')}`);
    });
  }
}

if (mode === 'prune') {
  const result = await store.pruneUnreferencedUploads({
    olderThanMs: olderThanHours * 60 * 60 * 1000,
    dryRun: !destructive,
    limit,
  });

  console.log(destructive ? 'Prune mode: delete' : 'Prune mode: dry run');
  console.log(`Scanned: ${result.scannedCount}`);
  console.log(`Candidates older than ${olderThanHours}h: ${result.candidates.length}`);
  console.log(`Deleted: ${result.deletedCount}`);

  result.candidates.forEach((item) => {
    console.log(`- ${item.filename} | ${formatHours(item.ageHours)} old`);
  });

  if (result.missingReferencedFiles.length) {
    console.log('Missing referenced files:');
    result.missingReferencedFiles.forEach((item) => {
      console.log(`- ${item.filename} | referenced by ${item.referencedByProjectIds.join(', ')}`);
    });
  }

  if (!destructive) {
    console.log('Dry run only. Re-run with `prune --delete` after reviewing the candidate list.');
  }
}
