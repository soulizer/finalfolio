import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjectStore, createSharePath } from '../server/app.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crazyalbum-mvp-validate-'));

const issuedIds = ['assetval01', 'projectval01', 'assetval02'];
const issuedTimestamps = ['2026-03-26T10:00:00.000Z', '2026-03-26T10:05:00.000Z'];
const results = [];

function nextId() {
  return issuedIds.shift() ?? `fallback${Date.now()}`;
}

function nextTimestamp() {
  return issuedTimestamps.shift() ?? '2026-03-26T10:10:00.000Z';
}

async function readProjectFile(projectsDir, projectId) {
  const payload = await fs.readFile(path.join(projectsDir, `${projectId}.json`), 'utf8');
  return JSON.parse(payload);
}

async function runCheck(label, check) {
  await check();
  results.push(label);
}

try {
  const store = createProjectStore({
    dataRoot: tempDir,
    idFactory: nextId,
    now: nextTimestamp,
  });

  await store.ensureDataDirectories();

  let uploadedAsset;
  let createdRecord;
  let updatedRecord;

  await runCheck('server-backed project persistence works with uploaded assets and fit settings', async () => {
    const uploadFilename = '1760000000000-validation-image.png';
    const uploadFile = {
      filename: uploadFilename,
      mimetype: 'image/png',
      originalname: 'validation-image.png',
    };

    store.validateUploadFile(uploadFile);
    await fs.writeFile(path.join(store.uploadsDir, uploadFilename), 'png-fixture', 'utf8');
    uploadedAsset = store.createStoredUpload(uploadFile);

    const project = {
      title: 'Validation Issue',
      subtitle: 'Server-backed editorial validation',
      issue: 'Issue 07',
      assets: [uploadedAsset],
      pages: [
        {
          id: 'page-cover',
          template: 'cover',
          theme: 'pale-blue',
          kicker: 'Cover',
          title: 'Validation Issue',
          deck: 'Issue 07',
          body: '',
          caption: 'Print-only opening artwork.',
          slots: {
            hero: uploadedAsset.id,
          },
          crops: {
            hero: { x: 50, y: 46, scale: 1.08, fit: 'cover' },
          },
        },
        {
          id: 'page-panorama',
          template: 'panorama',
          kicker: 'Editorial note',
          title: 'The hardened editor keeps the page stable.',
          deck: 'Wide frames stay fixed while crops and fit move independently.',
          body: '',
          caption: 'The issue should reopen with the same sequence and slot behavior.',
          slots: {
            top: uploadedAsset.id,
            bottom: null,
          },
          crops: {
            top: { x: 44, y: 40, scale: 1.12, fit: 'contain' },
            bottom: { x: 50, y: 50, scale: 1, fit: 'cover' },
          },
        },
      ],
    };

    createdRecord = await store.createProjectRecord({ project });
    assert.equal(createdRecord.id, 'projectval01');
    assert.equal(createdRecord.project.assets[0].src, '/uploads/1760000000000-validation-image.png');
    assert.equal(createdRecord.project.pages[0].theme, 'pale-blue');
    assert.equal(createdRecord.project.pages[1].theme, 'warm-beige');
    assert.equal(createdRecord.project.pages[1].crops.top.fit, 'contain');
    assert.equal(createSharePath(createdRecord.id), '/editor/projectval01');

    const writtenRecord = await readProjectFile(store.projectsDir, createdRecord.id);
    assert.equal(writtenRecord.project.pages.length, 2);
    assert.equal(writtenRecord.project.pages[1].template, 'panorama');
  });

  await runCheck('page order updates and survives reloads', async () => {
    const nextProject = {
      ...createdRecord.project,
      pages: [
        createdRecord.project.pages[1],
        {
          id: 'page-mosaic',
          template: 'mosaic',
          theme: 'light-gray',
          kicker: 'Sequence',
          title: 'Interior pacing',
          deck: 'Template variety stays intact before export.',
          body: '',
          caption: 'Mosaic layouts preserve slot assignments and page order.',
          slots: {
            lead: uploadedAsset.id,
            top: uploadedAsset.id,
            bottom: null,
          },
          crops: {
            lead: { x: 52, y: 48, scale: 1.03, fit: 'cover' },
            top: { x: 48, y: 44, scale: 1.1, fit: 'contain' },
            bottom: { x: 50, y: 50, scale: 1, fit: 'cover' },
          },
        },
        createdRecord.project.pages[0],
      ],
    };

    updatedRecord = await store.updateProjectRecord(createdRecord.id, { project: nextProject });
    assert.equal(updatedRecord.updatedAt, '2026-03-26T10:05:00.000Z');
    assert.deepEqual(
      updatedRecord.project.pages.map((page) => page.id),
      ['page-panorama', 'page-mosaic', 'page-cover'],
    );

    const reloadedRecord = await store.readProjectRecord(createdRecord.id);
    assert.deepEqual(
      reloadedRecord.project.pages.map((page) => page.id),
      ['page-panorama', 'page-mosaic', 'page-cover'],
    );
  });

  await runCheck('invalid project payloads are rejected', async () => {
    assert.throws(
      () =>
        store.sanitizeProjectState({
          project: {
            ...updatedRecord.project,
            pages: [
              updatedRecord.project.pages[0],
              { ...updatedRecord.project.pages[1], id: updatedRecord.project.pages[0].id },
            ],
          },
        }),
      /Page identifiers must be unique\./,
    );

    assert.throws(
      () =>
        store.sanitizeProjectState({
          project: {
            ...updatedRecord.project,
            pages: [
              {
                ...updatedRecord.project.pages[0],
                slots: { top: 'missing-asset', bottom: null },
              },
              ...updatedRecord.project.pages.slice(1),
            ],
          },
        }),
      /Project payload is invalid\./,
    );

    assert.throws(
      () =>
        store.sanitizeProjectState({
          project: {
            ...updatedRecord.project,
            pages: updatedRecord.project.pages.map((page, index) =>
              index === 0
                ? {
                    ...page,
                    crops: {
                      ...page.crops,
                      top: { ...page.crops.top, fit: 'stretch' },
                    },
                  }
                : page,
            ),
          },
        }),
      /Project payload is invalid\./,
    );

    assert.throws(
      () =>
        store.sanitizeProjectState({
          project: {
            ...updatedRecord.project,
            pages: updatedRecord.project.pages.map((page, index) =>
              index === 0
                ? {
                    ...page,
                    theme: 'sunset-peach',
                  }
                : page,
            ),
          },
        }),
      /Project payload is invalid\./,
    );
  });

  await runCheck('invalid upload types are rejected', async () => {
    assert.throws(
      () =>
        store.validateUploadFile({
          filename: 'vector.svg',
          mimetype: 'image/svg+xml',
          originalname: 'vector.svg',
        }),
      /Upload JPG, PNG, WebP, GIF, or AVIF images only\./,
    );
  });

  await runCheck('legacy upload paths still reopen while new SVG uploads stay blocked', async () => {
    const legacyProject = store.sanitizeProjectState({
      project: {
        title: 'Legacy upload issue',
        subtitle: '',
        issue: 'Issue 03',
        assets: [
          {
            id: 'legacyupload01',
            name: 'Legacy SVG upload',
            src: '/uploads/legacy-issue-cover.svg',
            note: 'Stored before raster-only upload validation.',
          },
        ],
        pages: [
          {
            id: 'page-cover',
            template: 'cover',
            kicker: 'Cover',
            title: 'Legacy upload issue',
            deck: 'Issue 03',
            body: '',
            caption: 'Existing upload-backed issues must still reopen.',
            slots: {
              hero: 'legacyupload01',
            },
            crops: {
              hero: { x: 50, y: 50, scale: 1, fit: 'cover' },
            },
          },
        ],
      },
    });

    assert.equal(legacyProject.assets[0].src, '/uploads/legacy-issue-cover.svg');
    assert.equal(legacyProject.pages[0].crops.hero.fit, 'cover');
  });

  await runCheck('upload inventory lists referenced files and prunes old unreferenced uploads safely', async () => {
    const orphanFilename = '1700000000000-unused-shot.webp';
    const orphanFile = {
      filename: orphanFilename,
      mimetype: 'image/webp',
      originalname: 'unused-shot.webp',
    };

    store.validateUploadFile(orphanFile);
    await fs.writeFile(path.join(store.uploadsDir, orphanFilename), 'webp-fixture', 'utf8');
    store.createStoredUpload(orphanFile);

    const inventory = await store.collectUploadInventory({
      nowMs: Date.parse('2026-03-27T12:00:00.000Z'),
    });
    assert.equal(inventory.totals.uploadCount, 2);
    assert.equal(inventory.totals.referencedCount, 1);
    assert.equal(inventory.totals.unreferencedCount, 1);
    assert.deepEqual(
      inventory.items.find((item) => item.filename === orphanFilename)?.referencedByProjectIds,
      [],
    );
    assert.deepEqual(
      inventory.items.find((item) => item.filename === '1760000000000-validation-image.png')?.referencedByProjectIds,
      ['projectval01'],
    );

    const dryRun = await store.pruneUnreferencedUploads({
      olderThanMs: 24 * 60 * 60 * 1000,
      dryRun: true,
      nowMs: Date.parse('2026-03-27T12:00:00.000Z'),
    });
    assert.equal(dryRun.deletedCount, 0);
    assert.equal(dryRun.candidates.length, 1);
    assert.equal(dryRun.candidates[0].filename, orphanFilename);

    const pruned = await store.pruneUnreferencedUploads({
      olderThanMs: 24 * 60 * 60 * 1000,
      dryRun: false,
      nowMs: Date.parse('2026-03-27T12:00:00.000Z'),
    });
    assert.equal(pruned.deletedCount, 1);
    await assert.rejects(fs.access(path.join(store.uploadsDir, orphanFilename)));
  });

  await runCheck('print, template workflow, and admin cleanup hooks remain in source', async () => {
    const styles = await fs.readFile(path.join(rootDir, 'src/styles.css'), 'utf8');
    const editorPage = await fs.readFile(path.join(rootDir, 'src/routes/EditorPage.tsx'), 'utf8');
    const preview = await fs.readFile(path.join(rootDir, 'src/components/MagazinePreview.tsx'), 'utf8');
    const defaults = await fs.readFile(path.join(rootDir, 'src/editor/demoData.ts'), 'utf8');
    const readme = await fs.readFile(path.join(rootDir, 'README.md'), 'utf8');
    const manageUploads = await fs.readFile(path.join(rootDir, 'scripts/manage-uploads.mjs'), 'utf8');
    const distIndex = await fs.readFile(path.join(rootDir, 'dist/index.html'), 'utf8');

    assert.match(styles, /@media print/);
    assert.match(styles, /\.magazine-sheet--editor/);
    assert.match(styles, /\.magazine-sheet--print/);
    assert.match(styles, /\.magazine-page--theme-pale-blue/);
    assert.match(styles, /\.theme-card__swatch--light-gray/);
    assert.match(styles, /\.asset-frame__media/);
    assert.match(styles, /\.placement-chip/);
    assert.match(styles, /\.segmented-control/);
    assert.match(styles, /\.editor-sidebar--navigation \.page-strip/);
    assert.match(styles, /\.editor-sidebar--controls \.editor-project-bar__actions/);
    assert.match(styles, /height: calc\(100vh - 16px\)/);
    assert.match(editorPage, /Apply to page/);
    assert.match(editorPage, /Add after current/);
    assert.match(editorPage, /Clear from all pages/);
    assert.match(editorPage, /Page surface/);
    assert.match(editorPage, /Page theme/);
    assert.match(editorPage, /Remove .* unused/);
    assert.match(editorPage, /editor-sidebar editor-sidebar--navigation/);
    assert.match(editorPage, /aria-label="Live page editor"/);
    assert.match(editorPage, /editor-sidebar editor-sidebar--controls/);
    assert.match(editorPage, /window\.print\(\)/);
    assert.match(editorPage, /Keep full image/);
    assert.match(preview, /objectFit: crop\?\.fit \?\? 'cover'/);
    assert.match(preview, /page\.template === 'panorama'/);
    assert.match(preview, /page\.template === 'mosaic'/);
    assert.match(preview, /page\.template === 'triptych'/);
    assert.match(defaults, /folio/);
    assert.match(defaults, /panorama/);
    assert.match(defaults, /triptych/);
    assert.match(readme, /uploads:manage/);
    assert.match(manageUploads, /Dry run only\./);
    assert.match(distIndex, /CrazyAlbum/);
  });

  console.log('validate:mvp passed');
  results.forEach((label) => {
    console.log(`- ${label}`);
  });
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
