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

  await runCheck('server-backed project persistence works with uploaded assets', async () => {
    const uploadFilename = 'validation-image.png';
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
          kicker: 'Cover',
          title: 'Validation Issue',
          deck: 'Issue 07',
          body: '',
          caption: 'Print-only opening artwork.',
          slots: {
            hero: uploadedAsset.id,
          },
          crops: {
            hero: { x: 50, y: 46, scale: 1.08 },
          },
        },
        {
          id: 'page-essay',
          template: 'essay',
          kicker: 'Editorial note',
          title: 'The cleaned MVP keeps the issue on the page.',
          deck: 'One image, one column, and the saved URL stay aligned.',
          body: 'This record confirms project creation, page persistence, and asset-backed composition.',
          caption: 'The issue should reopen with the same sequence.',
          slots: {
            hero: uploadedAsset.id,
          },
          crops: {
            hero: { x: 44, y: 40, scale: 1.12 },
          },
        },
      ],
    };

    createdRecord = await store.createProjectRecord({ project });
    assert.equal(createdRecord.id, 'projectval01');
    assert.equal(createdRecord.project.assets[0].src, '/uploads/validation-image.png');
    assert.equal(createSharePath(createdRecord.id), '/editor/projectval01');

    const writtenRecord = await readProjectFile(store.projectsDir, createdRecord.id);
    assert.equal(writtenRecord.project.pages.length, 2);
    assert.equal(writtenRecord.project.pages[0].template, 'cover');
  });

  await runCheck('page order updates and survives reloads', async () => {
    const nextProject = {
      ...createdRecord.project,
      pages: [
        createdRecord.project.pages[1],
        {
          id: 'page-grid',
          template: 'grid',
          kicker: 'Sequence',
          title: 'Interior pacing',
          deck: 'Flexible image ordering stays intact before export.',
          body: '',
          caption: 'Grid layouts should preserve image order and page order.',
          slots: {
            a: uploadedAsset.id,
            b: uploadedAsset.id,
            c: null,
            d: null,
          },
          crops: {
            a: { x: 52, y: 48, scale: 1.03 },
            b: { x: 48, y: 44, scale: 1.1 },
            c: { x: 50, y: 50, scale: 1 },
            d: { x: 50, y: 50, scale: 1 },
          },
        },
        createdRecord.project.pages[0],
      ],
    };

    updatedRecord = await store.updateProjectRecord(createdRecord.id, { project: nextProject });
    assert.equal(updatedRecord.updatedAt, '2026-03-26T10:05:00.000Z');
    assert.deepEqual(
      updatedRecord.project.pages.map((page) => page.id),
      ['page-essay', 'page-grid', 'page-cover'],
    );

    const reloadedRecord = await store.readProjectRecord(createdRecord.id);
    assert.deepEqual(
      reloadedRecord.project.pages.map((page) => page.id),
      ['page-essay', 'page-grid', 'page-cover'],
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
                slots: { hero: 'missing-asset' },
              },
              ...updatedRecord.project.pages.slice(1),
            ],
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
              hero: { x: 50, y: 50, scale: 1 },
            },
          },
        ],
      },
    });

    assert.equal(legacyProject.assets[0].src, '/uploads/legacy-issue-cover.svg');
  });

  await runCheck('print-only output and editorial layout hooks remain in source', async () => {
    const styles = await fs.readFile(path.join(rootDir, 'src/styles.css'), 'utf8');
    const editorPage = await fs.readFile(path.join(rootDir, 'src/routes/EditorPage.tsx'), 'utf8');
    const preview = await fs.readFile(path.join(rootDir, 'src/components/MagazinePreview.tsx'), 'utf8');
    const defaults = await fs.readFile(path.join(rootDir, 'src/editor/demoData.ts'), 'utf8');
    const distIndex = await fs.readFile(path.join(rootDir, 'dist/index.html'), 'utf8');

    assert.match(styles, /@media print/);
    assert.match(styles, /\.editor-shell > :not\(\.editor-print-stack\)/);
    assert.match(styles, /size: A4 portrait;/);
    assert.match(styles, /width: var\(--sheet-width\);/);
    assert.match(styles, /\.asset-frame__placeholder\s*\{\s*display: none;/);
    assert.match(editorPage, /window\.print\(\)/);
    assert.match(editorPage, /Move earlier/);
    assert.match(editorPage, /Move later/);
    assert.match(editorPage, /pageNumber=\{index \+ 1\}/);
    assert.match(preview, /if \(!interactive\) \{/);
    assert.match(preview, /Page \$\{String\(pageNumber\)\.padStart\(2, '0'\)\}/);
    assert.match(preview, /\) : interactive \? \(/);
    assert.match(defaults, /assets: \[\]/);
    assert.match(defaults, /createPageDraft\('cover', 'page-cover'\)/);
    assert.match(distIndex, /CrazyAlbum/);
  });

  console.log('validate:mvp passed');
  results.forEach((label) => {
    console.log(`- ${label}`);
  });
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
