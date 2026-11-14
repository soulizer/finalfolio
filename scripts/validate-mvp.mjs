import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp, createProjectStore, createSharePath } from '../server/app.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'finalfolio-mvp-validate-'));

const issuedIds = ['assetval01', 'projectval01', 'assetval02'];
const issuedTimestamps = ['2026-03-26T10:00:00.000Z', '2026-03-26T10:05:00.000Z'];
const results = [];
let validationServer;

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
      frameRadius: 22,
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
    assert.equal(createdRecord.project.frameRadius, 22);
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

    assert.throws(
      () =>
        store.sanitizeProjectState({
          project: {
            ...updatedRecord.project,
            frameRadius: 'soft',
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

  await runCheck('owned project saves stay non-destructive and explicit upload deletion stays reference-safe', async () => {
    const apiApp = createApp({
      dataRoot: tempDir,
      distDir: path.join(rootDir, 'dist'),
      port: 0,
    });
    validationServer = await apiApp.start();
    const address = validationServer.address();
    assert.ok(address && typeof address === 'object' && typeof address.port === 'number');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const user = await apiApp.authStore.createUser({
      email: 'owner@example.com',
      password: 'Password123!',
    }, {
      acceptCurrentTerms: true,
      termsAcceptedLanguage: 'en',
    });
    const verificationToken = await apiApp.authStore.issueVerificationToken(user.id);
    await apiApp.authStore.verifyUserWithToken(verificationToken.id);
    const session = await apiApp.authStore.createSession(user.id);
    const cookie = `finalfolio_session=${session.id}`;

    const uploadFilename = '1760000001000-owner-delete.png';
    const uploadPath = path.join(apiApp.store.uploadsDir, uploadFilename);
    const uploadFile = {
      filename: uploadFilename,
      mimetype: 'image/png',
      originalname: 'owner-delete.png',
    };

    await fs.writeFile(uploadPath, 'png-fixture', 'utf8');
    const storedAsset = apiApp.store.createStoredUpload(uploadFile, { width: 1200, height: 800 });
    await apiApp.assetStore.createAssetRecord(storedAsset, { ownerUserId: user.id });
    const ownedProject = await apiApp.store.createProjectRecord(
      {
        project: {
          title: 'Owned issue',
          subtitle: '',
          issue: 'Issue 09',
          frameRadius: 18,
          assets: [storedAsset],
          pages: [
            {
              id: 'page-owned-cover',
              template: 'cover',
              theme: 'warm-beige',
              kicker: '',
              title: 'Owned issue',
              deck: '',
              body: '',
              caption: '',
              slots: {
                hero: storedAsset.id,
              },
              crops: {
                hero: { x: 50, y: 50, scale: 1, fit: 'cover' },
              },
            },
          ],
        },
      },
      { ownerUserId: user.id },
    );

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const adminResponses = await Promise.all(
        ['/api/admin/summary', '/api/admin/users', '/api/admin/projects', '/api/admin/uploads'].map((pathname) =>
          fetch(`${baseUrl}${pathname}`, {
            headers: {
              cookie,
            },
          }),
        ),
      );
      assert.deepEqual(
        adminResponses.map((response) => response.status),
        [200, 200, 200, 200],
      );
      await Promise.all(adminResponses.map((response) => response.arrayBuffer()));
    }

    const unauthorizedResponse = await fetch(`${baseUrl}/api/projects/${ownedProject.id}`);
    assert.equal(unauthorizedResponse.status, 401);

    const updateResponse = await fetch(`${baseUrl}/api/projects/${ownedProject.id}`, {
      method: 'PUT',
      headers: {
        cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project: {
          ...ownedProject.project,
          assets: [],
          pages: ownedProject.project.pages.map((page) => ({
            ...page,
            slots: Object.fromEntries(Object.keys(page.slots).map((slot) => [slot, null])),
          })),
        },
      }),
    });
    assert.equal(updateResponse.status, 200);
    const updatePayload = await updateResponse.json();
    assert.equal(updatePayload.project.assets.length, 0);
    await fs.access(uploadPath);
    const retainedAssetRecord = await apiApp.assetStore.readAssetRecord(storedAsset.id);
    assert.ok(!retainedAssetRecord.deletedAt);

    const deleteAssetResponse = await fetch(`${baseUrl}/api/assets/${storedAsset.id}`, {
      method: 'DELETE',
      headers: {
        cookie,
      },
    });
    assert.equal(deleteAssetResponse.status, 204);
    await assert.rejects(fs.access(uploadPath));
    const deletedAssetRecord = await apiApp.assetStore.readAssetRecord(storedAsset.id);
    assert.ok(deletedAssetRecord.deletedAt);

    const retainedUploadFilename = '1760000001001-owner-retain.png';
    const retainedUploadPath = path.join(apiApp.store.uploadsDir, retainedUploadFilename);
    const retainedUploadFile = {
      filename: retainedUploadFilename,
      mimetype: 'image/png',
      originalname: 'owner-retain.png',
    };

    await fs.writeFile(retainedUploadPath, 'png-fixture-2', 'utf8');
    const retainedAsset = apiApp.store.createStoredUpload(retainedUploadFile, { width: 1200, height: 800 });
    await apiApp.assetStore.createAssetRecord(retainedAsset, { ownerUserId: user.id });
    const retainedProject = await apiApp.store.createProjectRecord(
      {
        project: {
          title: 'Retained project',
          subtitle: '',
          issue: 'Issue 10',
          frameRadius: 18,
          assets: [retainedAsset],
          pages: [
            {
              id: 'page-retained-cover',
              template: 'cover',
              theme: 'warm-beige',
              kicker: '',
              title: 'Retained project',
              deck: '',
              body: '',
              caption: '',
              slots: {
                hero: retainedAsset.id,
              },
              crops: {
                hero: { x: 50, y: 50, scale: 1, fit: 'cover' },
              },
            },
          ],
        },
      },
      { ownerUserId: user.id },
    );

    const deleteProjectResponse = await fetch(`${baseUrl}/api/projects/${retainedProject.id}`, {
      method: 'DELETE',
      headers: {
        cookie,
      },
    });
    assert.equal(deleteProjectResponse.status, 204);
    await fs.access(retainedUploadPath);
    const retainedAfterProjectDelete = await apiApp.assetStore.readAssetRecord(retainedAsset.id);
    assert.ok(!retainedAfterProjectDelete.deletedAt);
  });

  await runCheck('legacy ownerless projects remain readable while mutations require duplication or admin access', async () => {
    const legacyTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'finalfolio-legacy-project-validate-'));
    const apiApp = createApp({
      dataRoot: legacyTempDir,
      distDir: path.join(rootDir, 'dist'),
      port: 0,
    });
    const apiServer = await apiApp.start();

    try {
      const address = apiServer.address();
      assert.ok(address && typeof address === 'object' && typeof address.port === 'number');
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const member = await apiApp.authStore.createUser(
        {
          email: 'legacy-member@example.com',
          password: 'Password123!',
        },
        {
          role: 'user',
          acceptCurrentTerms: true,
          termsAcceptedLanguage: 'en',
        },
      );
      const memberVerification = await apiApp.authStore.issueVerificationToken(member.id);
      await apiApp.authStore.verifyUserWithToken(memberVerification.id);
      const memberSession = await apiApp.authStore.createSession(member.id);
      const memberCookie = `finalfolio_session=${memberSession.id}`;

      const admin = await apiApp.authStore.createUser(
        {
          email: 'legacy-admin@example.com',
          password: 'Password123!',
        },
        {
          role: 'admin',
          acceptCurrentTerms: true,
          termsAcceptedLanguage: 'en',
        },
      );
      const adminVerification = await apiApp.authStore.issueVerificationToken(admin.id);
      await apiApp.authStore.verifyUserWithToken(adminVerification.id);
      const adminSession = await apiApp.authStore.createSession(admin.id);
      const adminCookie = `finalfolio_session=${adminSession.id}`;

      const legacyRecord = await apiApp.store.createProjectRecord({
        project: {
          title: 'Legacy bridge issue',
          subtitle: 'Ownerless compatibility record',
          issue: 'Issue 12',
          frameRadius: 18,
          assets: [],
          pages: [
            {
              id: 'page-legacy-cover',
              template: 'cover',
              theme: 'warm-beige',
              kicker: 'Legacy',
              title: 'Compatibility bridge',
              deck: 'Read-only until duplicated',
              body: '',
              caption: '',
              slots: {
                hero: null,
              },
              crops: {
                hero: { x: 50, y: 50, scale: 1, fit: 'cover' },
              },
            },
          ],
        },
      });

      const publicReadResponse = await fetch(`${baseUrl}/api/projects/${legacyRecord.id}`);
      assert.equal(publicReadResponse.status, 200);
      const publicReadPayload = await publicReadResponse.json();
      assert.equal(publicReadPayload.id, legacyRecord.id);

      const unauthorizedDuplicate = await fetch(`${baseUrl}/api/projects/${legacyRecord.id}/duplicate`, {
        method: 'POST',
      });
      assert.equal(unauthorizedDuplicate.status, 401);

      const forbiddenUpdate = await fetch(`${baseUrl}/api/projects/${legacyRecord.id}`, {
        method: 'PUT',
        headers: {
          cookie: memberCookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project: {
            ...legacyRecord.project,
            title: 'Should not save',
          },
        }),
      });
      assert.equal(forbiddenUpdate.status, 403);

      const forbiddenShare = await fetch(`${baseUrl}/api/projects/${legacyRecord.id}/share`, {
        method: 'POST',
        headers: {
          cookie: memberCookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      assert.equal(forbiddenShare.status, 403);

      const duplicateResponse = await fetch(`${baseUrl}/api/projects/${legacyRecord.id}/duplicate`, {
        method: 'POST',
        headers: {
          cookie: memberCookie,
        },
      });
      assert.equal(duplicateResponse.status, 201);
      const duplicatePayload = await duplicateResponse.json();
      assert.equal(duplicatePayload.ownerUserId, member.id);
      assert.notEqual(duplicatePayload.id, legacyRecord.id);

      const adminShareResponse = await fetch(`${baseUrl}/api/projects/${legacyRecord.id}/share`, {
        method: 'POST',
        headers: {
          cookie: adminCookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      assert.equal(adminShareResponse.status, 200);
    } finally {
      await new Promise((resolve, reject) => {
        apiServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      await fs.rm(legacyTempDir, { recursive: true, force: true });
    }
  });

  await runCheck('uploads wait for remote delivery before reporting success when object storage is enabled', async () => {
    const uploadTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'finalfolio-upload-boundary-validate-'));
    const apiApp = createApp({
      dataRoot: uploadTempDir,
      distDir: path.join(rootDir, 'dist'),
      port: 0,
    });
    const apiServer = await apiApp.start();

    try {
      const address = apiServer.address();
      assert.ok(address && typeof address === 'object' && typeof address.port === 'number');
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const user = await apiApp.authStore.createUser(
        {
          email: 'upload-boundary@example.com',
          password: 'Password123!',
        },
        {
          acceptCurrentTerms: true,
          termsAcceptedLanguage: 'en',
        },
      );
      const verificationToken = await apiApp.authStore.issueVerificationToken(user.id);
      await apiApp.authStore.verifyUserWithToken(verificationToken.id);
      const session = await apiApp.authStore.createSession(user.id);
      const cookie = `finalfolio_session=${session.id}`;

      const uploadFixture = await fs.readFile(path.join(rootDir, 'public', 'icon-192.png'));
      const pendingSync = {};
      pendingSync.promise = new Promise((resolve) => {
        pendingSync.resolve = resolve;
      });
      let syncStarted = false;

      apiApp.objectStorageStore.readConfig = async () => ({
        enabled: true,
      });
      apiApp.objectStorageStore.syncLocalUpload = async () => {
        syncStarted = true;
        await pendingSync.promise;
        return { status: 'remote' };
      };

      const formData = new FormData();
      formData.append('files', new Blob([uploadFixture], { type: 'image/png' }), 'boundary-proof.png');
      formData.append('assetMeta', JSON.stringify([{ width: 192, height: 192 }]));

      const uploadPromise = fetch(`${baseUrl}/api/uploads`, {
        method: 'POST',
        headers: {
          cookie,
        },
        body: formData,
      });

      for (let attempt = 0; attempt < 40 && !syncStarted; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      assert.equal(syncStarted, true);
      const pendingState = await Promise.race([
        uploadPromise.then(() => 'resolved'),
        new Promise((resolve) => setTimeout(() => resolve('pending'), 50)),
      ]);
      assert.equal(pendingState, 'pending');

      pendingSync.resolve();
      const uploadResponse = await uploadPromise;
      assert.equal(uploadResponse.status, 201);
      const uploadPayload = await uploadResponse.json();
      assert.equal(uploadPayload.assets.length, 1);
      const uploadsAfterSuccess = (await fs.readdir(apiApp.store.uploadsDir)).sort();

      apiApp.objectStorageStore.syncLocalUpload = async () => {
        throw new Error('Mirror unavailable.');
      };

      const failedFormData = new FormData();
      failedFormData.append('files', new Blob([uploadFixture], { type: 'image/png' }), 'boundary-fail.png');
      failedFormData.append('assetMeta', JSON.stringify([{ width: 192, height: 192 }]));
      const failedUploadResponse = await fetch(`${baseUrl}/api/uploads`, {
        method: 'POST',
        headers: {
          cookie,
        },
        body: failedFormData,
      });
      assert.equal(failedUploadResponse.status, 424);
      const failedUploadPayload = await failedUploadResponse.json();
      assert.match(failedUploadPayload.error, /Remote delivery did not complete\. Upload was rolled back\./);
      assert.deepEqual((await fs.readdir(apiApp.store.uploadsDir)).sort(), uploadsAfterSuccess);
    } finally {
      await new Promise((resolve, reject) => {
        apiServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      await fs.rm(uploadTempDir, { recursive: true, force: true });
    }
  });

  await runCheck('email verification and password reset tokens gate sign-in correctly', async () => {
    const apiApp = createApp({
      dataRoot: tempDir,
      distDir: path.join(rootDir, 'dist'),
      port: 0,
    });

    const user = await apiApp.authStore.createUser({
      email: 'editor@example.com',
      password: 'Password123!',
    }, {
      acceptCurrentTerms: true,
      termsAcceptedLanguage: 'en',
    });

    await assert.rejects(
      apiApp.authStore.authenticateUser({
        email: user.email,
        password: 'Password123!',
      }),
      /Verify your email before signing in\./,
    );

    const verificationToken = await apiApp.authStore.issueVerificationToken(user.id);
    await apiApp.authStore.verifyUserWithToken(verificationToken.id);

    const resetIssue = await apiApp.authStore.issuePasswordResetToken(user.email);
    assert.ok(resetIssue?.token.id);
    await apiApp.authStore.resetPasswordWithToken(resetIssue.token.id, 'FreshPassword123!');

    await assert.rejects(
      apiApp.authStore.authenticateUser({
        email: user.email,
        password: 'Password123!',
      }),
      /incorrect/i,
    );

    const authenticatedUser = await apiApp.authStore.authenticateUser({
      email: user.email,
      password: 'FreshPassword123!',
    });
    assert.equal(authenticatedUser.id, user.id);

    const bootstrapTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'finalfolio-bootstrap-validate-'));
    const bootstrapApp = createApp({
      dataRoot: bootstrapTempDir,
      distDir: path.join(rootDir, 'dist'),
      port: 0,
    });
    const bootstrapServer = await bootstrapApp.start();
    try {
      const address = bootstrapServer.address();
      assert.ok(address && typeof address === 'object' && typeof address.port === 'number');
      const bootstrapResponse = await fetch(`http://127.0.0.1:${address.port}/api/auth/bootstrap-status`);
      assert.equal(bootstrapResponse.status, 200);
      const bootstrapPayload = await bootstrapResponse.json();
      assert.equal(bootstrapPayload.requiresBootstrap, true);
      assert.equal(bootstrapPayload.hasUsers, false);
    } finally {
      await new Promise((resolve, reject) => {
        bootstrapServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      await fs.rm(bootstrapTempDir, { recursive: true, force: true });
    }
  });

  await runCheck('registration captcha and per-IP throttles protect auth mail entry points', async () => {
    const registrationTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'finalfolio-register-validate-'));
    const sentVerificationEmails = [];
    const sentPasswordResetEmails = [];
    const apiApp = createApp({
      dataRoot: registrationTempDir,
      distDir: path.join(rootDir, 'dist'),
      port: 0,
      mailServiceFactory: () => ({
        async sendVerificationEmail(payload) {
          sentVerificationEmails.push(payload);
        },
        async sendPasswordResetEmail(payload) {
          sentPasswordResetEmails.push(payload);
        },
      }),
    });
    const apiServer = await apiApp.start();

    try {
      const address = apiServer.address();
      assert.ok(address && typeof address === 'object' && typeof address.port === 'number');
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const captchaResponse = await fetch(`${baseUrl}/api/auth/captcha?purpose=register`);
      assert.equal(captchaResponse.status, 200);
      assert.equal(captchaResponse.headers.get('cache-control'), 'no-store');
      const captchaPayload = await captchaResponse.json();
      assert.ok(typeof captchaPayload.id === 'string' && captchaPayload.id.startsWith('captcha-'));
      assert.match(captchaPayload.imageDataUrl, /^data:image\/svg\+xml/);

      const wrongCaptcha = await apiApp.securityStore.issueCaptcha({
        ip: '127.0.0.1',
        purpose: 'register',
      });
      const wrongCaptchaResponse = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'wrong-captcha@example.com',
          username: 'wrongcaptcha',
          password: 'Password123!',
          captchaId: wrongCaptcha.id,
          captchaAnswer: 'WRONG1',
          acceptTerms: true,
          termsLanguage: 'en',
        }),
      });
      assert.equal(wrongCaptchaResponse.status, 400);
      const wrongCaptchaPayload = await wrongCaptchaResponse.json();
      assert.match(wrongCaptchaPayload.error, /Captcha answer is incorrect\./);

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const challenge = await apiApp.securityStore.issueCaptcha({
          ip: '127.0.0.1',
          purpose: 'register',
        });
        const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: `reader${attempt}@example.com`,
            username: `reader${attempt}`,
            password: 'Password123!',
            captchaId: challenge.id,
            captchaAnswer: challenge.answer,
            acceptTerms: true,
            termsLanguage: 'en',
          }),
        });
        assert.equal(registerResponse.status, 201);
      }

      assert.equal(sentVerificationEmails.length, 3);

      const rateLimitedChallenge = await apiApp.securityStore.issueCaptcha({
        ip: '127.0.0.1',
        purpose: 'register',
      });
      const rateLimitedResponse = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'reader-rate-limit@example.com',
          username: 'readerratelimit',
          password: 'Password123!',
          captchaId: rateLimitedChallenge.id,
          captchaAnswer: rateLimitedChallenge.answer,
          acceptTerms: true,
          termsLanguage: 'en',
        }),
      });
      assert.equal(rateLimitedResponse.status, 429);
      assert.ok(rateLimitedResponse.headers.get('retry-after'));
      const rateLimitedPayload = await rateLimitedResponse.json();
      assert.match(rateLimitedPayload.error, /Too many registration attempts from this IP\./);

      const resendResponse = await fetch(`${baseUrl}/api/auth/verification/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'reader0@example.com',
        }),
      });
      assert.equal(resendResponse.status, 204);
      assert.equal(sentVerificationEmails.length, 4);

      const passwordResetResponse = await fetch(`${baseUrl}/api/auth/password-reset/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'reader1@example.com',
        }),
      });
      assert.equal(passwordResetResponse.status, 204);
      assert.equal(sentPasswordResetEmails.length, 1);
    } finally {
      await new Promise((resolve, reject) => {
        apiServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      await fs.rm(registrationTempDir, { recursive: true, force: true });
    }
  });

  await runCheck('share routes rotate cleanly and export events stay observable', async () => {
    const shareTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'finalfolio-share-validate-'));
    const apiApp = createApp({
      dataRoot: shareTempDir,
      distDir: path.join(rootDir, 'dist'),
      port: 0,
    });
    const apiServer = await apiApp.start();

    try {
      const address = apiServer.address();
      assert.ok(address && typeof address === 'object' && typeof address.port === 'number');
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const user = await apiApp.authStore.createUser(
        {
          email: 'share-owner@example.com',
          password: 'Password123!',
        },
        {
          acceptCurrentTerms: true,
          termsAcceptedLanguage: 'en',
        },
      );
      const verificationToken = await apiApp.authStore.issueVerificationToken(user.id);
      await apiApp.authStore.verifyUserWithToken(verificationToken.id);
      const session = await apiApp.authStore.createSession(user.id);
      const cookie = `finalfolio_session=${session.id}`;

      const projectRecord = await apiApp.store.createProjectRecord(
        {
          project: {
            title: 'Shared issue',
            subtitle: 'Public route validation',
            issue: 'Issue 11',
            frameRadius: 18,
            assets: [],
            pages: [
              {
                id: 'page-share-cover',
                template: 'cover',
                theme: 'warm-beige',
                kicker: 'Share',
                title: 'Shared issue',
                deck: 'Public link lifecycle',
                body: '',
                caption: '',
                slots: {
                  hero: null,
                },
                crops: {
                  hero: { x: 50, y: 50, scale: 1, fit: 'cover' },
                },
              },
            ],
          },
        },
        { ownerUserId: user.id },
      );

      const enableResponse = await fetch(`${baseUrl}/api/projects/${projectRecord.id}/share`, {
        method: 'POST',
        headers: {
          cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      assert.equal(enableResponse.status, 200);
      const enabledPayload = await enableResponse.json();
      assert.equal(enabledPayload.share.enabled, true);
      assert.ok(typeof enabledPayload.share.id === 'string' && enabledPayload.share.id.length > 0);
      const firstShareId = enabledPayload.share.id;

      const firstPublicResponse = await fetch(`${baseUrl}/api/issues/${firstShareId}`);
      assert.equal(firstPublicResponse.status, 200);
      const publicPayload = await firstPublicResponse.json();
      assert.equal(publicPayload.projectId, projectRecord.id);
      assert.equal(publicPayload.title, 'Shared issue');
      assert.equal(publicPayload.pages.length, 1);
      assert.equal('ownerUserId' in publicPayload, false);

      const rotateResponse = await fetch(`${baseUrl}/api/projects/${projectRecord.id}/share`, {
        method: 'POST',
        headers: {
          cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rotate: true }),
      });
      assert.equal(rotateResponse.status, 200);
      const rotatedPayload = await rotateResponse.json();
      assert.ok(rotatedPayload.share.id);
      assert.notEqual(rotatedPayload.share.id, firstShareId);
      const rotatedShareId = rotatedPayload.share.id;

      const oldShareResponse = await fetch(`${baseUrl}/api/issues/${firstShareId}`);
      assert.equal(oldShareResponse.status, 404);
      const rotatedPublicResponse = await fetch(`${baseUrl}/api/issues/${rotatedShareId}`);
      assert.equal(rotatedPublicResponse.status, 200);

      const exportResponse = await fetch(`${baseUrl}/api/exports`, {
        method: 'POST',
        headers: {
          cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: projectRecord.id,
          status: 'requested',
          format: 'pdf',
          pageSize: 'a4',
          quality: 'standard',
        }),
      });
      assert.equal(exportResponse.status, 201);

      const activityResponse = await fetch(`${baseUrl}/api/account/activity`, {
        headers: {
          cookie,
        },
      });
      assert.equal(activityResponse.status, 200);
      const activityPayload = await activityResponse.json();
      assert.ok(
        activityPayload.activity.some(
          (item) => item.type === 'export' && item.status === 'requested' && item.label === 'Requested PDF export',
        ),
      );

      const disableResponse = await fetch(`${baseUrl}/api/projects/${projectRecord.id}/share`, {
        method: 'DELETE',
        headers: {
          cookie,
        },
      });
      assert.equal(disableResponse.status, 200);
      const disabledShareResponse = await fetch(`${baseUrl}/api/issues/${rotatedShareId}`);
      assert.equal(disabledShareResponse.status, 404);

      const events = await apiApp.opsStore.listEvents();
      assert.ok(events.some((event) => event.type === 'share' && event.projectId === projectRecord.id && event.detail?.action === 'enable'));
      assert.ok(events.some((event) => event.type === 'share' && event.projectId === projectRecord.id && event.detail?.action === 'regenerate'));
      assert.ok(events.some((event) => event.type === 'share' && event.projectId === projectRecord.id && event.detail?.action === 'disable'));
      assert.ok(
        events.some(
          (event) =>
            event.type === 'export' &&
            event.projectId === projectRecord.id &&
            event.status === 'requested' &&
            event.detail?.format === 'pdf',
        ),
      );
    } finally {
      await new Promise((resolve, reject) => {
        apiServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      await fs.rm(shareTempDir, { recursive: true, force: true });
    }
  });

  await runCheck('login, logout, and password reset HTTP flows issue and clear sessions', async () => {
    const authTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'finalfolio-auth-http-validate-'));
    const apiApp = createApp({
      dataRoot: authTempDir,
      distDir: path.join(rootDir, 'dist'),
      port: 0,
    });
    const apiServer = await apiApp.start();

    try {
      const address = apiServer.address();
      assert.ok(address && typeof address === 'object' && typeof address.port === 'number');
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const user = await apiApp.authStore.createUser(
        {
          email: 'http-auth@example.com',
          password: 'Password123!',
        },
        {
          acceptCurrentTerms: true,
          termsAcceptedLanguage: 'en',
        },
      );
      const verificationToken = await apiApp.authStore.issueVerificationToken(user.id);
      await apiApp.authStore.verifyUserWithToken(verificationToken.id);

      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: user.email,
          password: 'Password123!',
        }),
      });
      assert.equal(loginResponse.status, 200);
      const loginCookie = loginResponse.headers.get('set-cookie');
      assert.ok(loginCookie?.includes('finalfolio_session='));
      const sessionCookie = loginCookie.split(';', 1)[0];

      const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
        headers: {
          cookie: sessionCookie,
        },
      });
      assert.equal(sessionResponse.status, 200);
      const sessionPayload = await sessionResponse.json();
      assert.equal(sessionPayload.user.id, user.id);

      const resetIssue = await apiApp.authStore.issuePasswordResetToken(user.email);
      assert.ok(resetIssue?.token.id);
      const resetResponse = await fetch(`${baseUrl}/api/auth/password-reset/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: resetIssue.token.id,
          password: 'FreshPassword123!',
        }),
      });
      assert.equal(resetResponse.status, 200);

      const oldPasswordLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: user.email,
          password: 'Password123!',
        }),
      });
      assert.equal(oldPasswordLoginResponse.status, 401);

      const freshLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: user.email,
          password: 'FreshPassword123!',
        }),
      });
      assert.equal(freshLoginResponse.status, 200);
      const freshLoginCookie = freshLoginResponse.headers.get('set-cookie');
      assert.ok(freshLoginCookie?.includes('finalfolio_session='));
      const freshSessionCookie = freshLoginCookie.split(';', 1)[0];

      const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          cookie: freshSessionCookie,
        },
      });
      assert.equal(logoutResponse.status, 204);

      const loggedOutSessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
        headers: {
          cookie: freshSessionCookie,
        },
      });
      assert.equal(loggedOutSessionResponse.status, 200);
      const loggedOutSessionPayload = await loggedOutSessionResponse.json();
      assert.equal(loggedOutSessionPayload.user, null);
    } finally {
      await new Promise((resolve, reject) => {
        apiServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      await fs.rm(authTempDir, { recursive: true, force: true });
    }
  });

  await runCheck('print, template workflow, and admin cleanup hooks remain in source', async () => {
    const styles = await fs.readFile(path.join(rootDir, 'src/styles.css'), 'utf8');
    const appRoutes = await fs.readFile(path.join(rootDir, 'src/App.tsx'), 'utf8');
    const authPage = await fs.readFile(path.join(rootDir, 'src/routes/AuthPage.tsx'), 'utf8');
    const accountPage = await fs.readFile(path.join(rootDir, 'src/routes/AccountPage.tsx'), 'utf8');
    const adminPage = await fs.readFile(path.join(rootDir, 'src/routes/AdminPage.tsx'), 'utf8');
    const issueViewPage = await fs.readFile(path.join(rootDir, 'src/routes/IssueViewPage.tsx'), 'utf8');
    const issueViewPageTurnJs = await fs.readFile(path.join(rootDir, 'src/routes/IssueViewPageTurnJs.tsx'), 'utf8');
    const issueTurnJsBook = await fs.readFile(path.join(rootDir, 'src/routes/IssueTurnJsBook.tsx'), 'utf8');
    const useIssueTurnJsRuntime = await fs.readFile(path.join(rootDir, 'src/routes/useIssueTurnJsRuntime.ts'), 'utf8');
    const issueViewReaderState = await fs.readFile(path.join(rootDir, 'src/routes/issueViewReaderState.ts'), 'utf8');
    const useIssueViewLayout = await fs.readFile(path.join(rootDir, 'src/routes/useIssueViewLayout.ts'), 'utf8');
    const useIssueViewNavigation = await fs.readFile(path.join(rootDir, 'src/routes/useIssueViewNavigation.ts'), 'utf8');
    const useIssueViewShareState = await fs.readFile(path.join(rootDir, 'src/routes/useIssueViewShareState.ts'), 'utf8');
    const useIssueViewChromeState = await fs.readFile(path.join(rootDir, 'src/routes/useIssueViewChromeState.ts'), 'utf8');
    const issueViewChrome = await fs.readFile(path.join(rootDir, 'src/routes/IssueViewChrome.tsx'), 'utf8');
    const issueViewShellStates = await fs.readFile(path.join(rootDir, 'src/routes/IssueViewShellStates.tsx'), 'utf8');
    const issueViewTurnJsMarkup = await fs.readFile(path.join(rootDir, 'src/routes/issueViewTurnJsMarkup.tsx'), 'utf8');
    const editorPage = await fs.readFile(path.join(rootDir, 'src/routes/EditorPage.tsx'), 'utf8');
    const preview = await fs.readFile(path.join(rootDir, 'src/components/MagazinePreview.tsx'), 'utf8');
    const defaults = await fs.readFile(path.join(rootDir, 'src/editor/demoData.ts'), 'utf8');
    const geometry = await fs.readFile(path.join(rootDir, 'src/editor/imageGeometry.ts'), 'utf8');
    const api = await fs.readFile(path.join(rootDir, 'src/editor/api.ts'), 'utf8');
    const imageOptimization = await fs.readFile(path.join(rootDir, 'src/editor/imageOptimization.ts'), 'utf8');
    const serverApp = await fs.readFile(path.join(rootDir, 'server/app.js'), 'utf8');
    const security = await fs.readFile(path.join(rootDir, 'server/security.js'), 'utf8');
    const readme = await fs.readFile(path.join(rootDir, 'README.md'), 'utf8');
    const viteConfig = await fs.readFile(path.join(rootDir, 'vite.config.ts'), 'utf8');
    const packageManifest = await fs.readFile(path.join(rootDir, 'package.json'), 'utf8');
    const packageLock = await fs.readFile(path.join(rootDir, 'package-lock.json'), 'utf8');
    const manageUploads = await fs.readFile(path.join(rootDir, 'scripts/manage-uploads.mjs'), 'utf8');
    const distIndex = await fs.readFile(path.join(rootDir, 'dist/index.html'), 'utf8');
    const editorProjectLifecycle = await fs.readFile(path.join(rootDir, 'src/routes/editor/projectLifecycle.ts'), 'utf8');
    const editorProjectPersistence = await fs.readFile(path.join(rootDir, 'src/routes/editor/projectPersistence.ts'), 'utf8');
    const editorAssetOperations = await fs.readFile(path.join(rootDir, 'src/routes/editor/assetOperations.ts'), 'utf8');
    const editorAssetActions = await fs.readFile(path.join(rootDir, 'src/routes/editor/assetActions.ts'), 'utf8');
    const editorUploadOperations = await fs.readFile(path.join(rootDir, 'src/routes/editor/uploadOperations.ts'), 'utf8');
    const editorTemplateOperations = await fs.readFile(path.join(rootDir, 'src/routes/editor/templateOperations.ts'), 'utf8');
    const editorExportFlow = await fs.readFile(path.join(rootDir, 'src/routes/editor/exportFlow.ts'), 'utf8');
    const editorProjectActions = await fs.readFile(path.join(rootDir, 'src/routes/editor/projectActions.ts'), 'utf8');
    const editorPageOperations = await fs.readFile(path.join(rootDir, 'src/routes/editor/pageOperations.ts'), 'utf8');
    const editorPageActions = await fs.readFile(path.join(rootDir, 'src/routes/editor/pageActions.ts'), 'utf8');
    const editorDesignActions = await fs.readFile(path.join(rootDir, 'src/routes/editor/designActions.ts'), 'utf8');
    const editorUseEditorExportState = await fs.readFile(path.join(rootDir, 'src/routes/editor/useEditorExportState.ts'), 'utf8');
    const editorUseEditorProjectLifecycle = await fs.readFile(path.join(rootDir, 'src/routes/editor/useEditorProjectLifecycle.ts'), 'utf8');
    const editorUseEditorProjectState = await fs.readFile(path.join(rootDir, 'src/routes/editor/useEditorProjectState.ts'), 'utf8');
    const editorUseEditorTemplateState = await fs.readFile(path.join(rootDir, 'src/routes/editor/useEditorTemplateState.ts'), 'utf8');
    const editorUseEditorAssetLifecycle = await fs.readFile(path.join(rootDir, 'src/routes/editor/useEditorAssetLifecycle.ts'), 'utf8');
    const editorUseEditorPreviewScale = await fs.readFile(path.join(rootDir, 'src/routes/editor/useEditorPreviewScale.ts'), 'utf8');
    const editorUseEditorUiState = await fs.readFile(path.join(rootDir, 'src/routes/editor/useEditorUiState.ts'), 'utf8');
    const editorContentSidebar = await fs.readFile(path.join(rootDir, 'src/routes/editor/EditorContentSidebar.tsx'), 'utf8');
    const editorOperationsSidebar = await fs.readFile(path.join(rootDir, 'src/routes/editor/EditorOperationsSidebar.tsx'), 'utf8');
    const editorExportCenter = await fs.readFile(path.join(rootDir, 'src/routes/editor/EditorExportCenter.tsx'), 'utf8');
    const editorShellStates = await fs.readFile(path.join(rootDir, 'src/routes/editor/EditorShellStates.tsx'), 'utf8');
    const accountConsoleHeader = await fs.readFile(path.join(rootDir, 'src/routes/account/AccountConsoleHeader.tsx'), 'utf8');
    const accountOverviewPanel = await fs.readFile(path.join(rootDir, 'src/routes/account/AccountOverviewPanel.tsx'), 'utf8');
    const accountProjectsPanel = await fs.readFile(path.join(rootDir, 'src/routes/account/AccountProjectsPanel.tsx'), 'utf8');
    const accountUploadsPanel = await fs.readFile(path.join(rootDir, 'src/routes/account/AccountUploadsPanel.tsx'), 'utf8');
    const accountSettingsPanel = await fs.readFile(path.join(rootDir, 'src/routes/account/AccountSettingsPanel.tsx'), 'utf8');
    const accountTemplatesPanel = await fs.readFile(path.join(rootDir, 'src/routes/account/AccountTemplatesPanel.tsx'), 'utf8');
    const accountPreferencesPanel = await fs.readFile(path.join(rootDir, 'src/routes/account/AccountPreferencesPanel.tsx'), 'utf8');
    const accountFormFields = await fs.readFile(path.join(rootDir, 'src/routes/account/AccountFormFields.tsx'), 'utf8');
    const accountFormatting = await fs.readFile(path.join(rootDir, 'src/routes/account/accountFormatting.ts'), 'utf8');
    const accountSections = await fs.readFile(path.join(rootDir, 'src/routes/account/accountSections.ts'), 'utf8');
    const accountUseAccountWorkspace = await fs.readFile(path.join(rootDir, 'src/routes/account/useAccountWorkspace.ts'), 'utf8');
    const adminUseAdminWorkspace = await fs.readFile(path.join(rootDir, 'src/routes/admin/useAdminWorkspace.ts'), 'utf8');
    const adminUseAdminConfigState = await fs.readFile(path.join(rootDir, 'src/routes/admin/useAdminConfigState.ts'), 'utf8');
    const adminUseAdminUserManagement = await fs.readFile(path.join(rootDir, 'src/routes/admin/useAdminUserManagement.ts'), 'utf8');
    const adminUseAdminAssetGovernanceActions = await fs.readFile(path.join(rootDir, 'src/routes/admin/useAdminAssetGovernanceActions.ts'), 'utf8');
    const adminUseAdminShellState = await fs.readFile(path.join(rootDir, 'src/routes/admin/useAdminShellState.ts'), 'utf8');
    const adminConsoleHeader = await fs.readFile(path.join(rootDir, 'src/routes/admin/AdminConsoleHeader.tsx'), 'utf8');
    const adminFormFields = await fs.readFile(path.join(rootDir, 'src/routes/admin/AdminFormFields.tsx'), 'utf8');
    const adminGovernancePanel = await fs.readFile(path.join(rootDir, 'src/routes/admin/AdminGovernancePanel.tsx'), 'utf8');
    const adminOverviewPanel = await fs.readFile(path.join(rootDir, 'src/routes/admin/AdminOverviewPanel.tsx'), 'utf8');
    const adminProjectsPanel = await fs.readFile(path.join(rootDir, 'src/routes/admin/AdminProjectsPanel.tsx'), 'utf8');
    const adminUploadsPanel = await fs.readFile(path.join(rootDir, 'src/routes/admin/AdminUploadsPanel.tsx'), 'utf8');
    const adminEventsPanel = await fs.readFile(path.join(rootDir, 'src/routes/admin/AdminEventsPanel.tsx'), 'utf8');
    const adminUsersPanel = await fs.readFile(path.join(rootDir, 'src/routes/admin/AdminUsersPanel.tsx'), 'utf8');
    const adminStoragePanel = await fs.readFile(path.join(rootDir, 'src/routes/admin/AdminStoragePanel.tsx'), 'utf8');
    const adminShellStates = await fs.readFile(path.join(rootDir, 'src/routes/admin/AdminShellStates.tsx'), 'utf8');
    const editorExportRuntime = await fs.readFile(path.join(rootDir, 'src/routes/editor/exportRuntime.ts'), 'utf8');
    const editorUploadState = await fs.readFile(path.join(rootDir, 'src/routes/editor/uploadState.ts'), 'utf8');

    assert.match(styles, /@media print/);
    assert.match(styles, /\.magazine-sheet--editor/);
    assert.match(styles, /\.magazine-sheet--print/);
    assert.match(styles, /\.magazine-page--theme-pale-blue/);
    assert.match(styles, /\.magazine-page--theme-butter-cream/);
    assert.match(styles, /\.magazine-page--theme-sea-glass/);
    assert.match(styles, /\.magazine-page--theme-sage-mist/);
    assert.match(styles, /\.magazine-page--theme-dusty-rose/);
    assert.match(styles, /\.magazine-page--theme-pearl-blush/);
    assert.match(styles, /\.theme-card__swatch--light-gray/);
    assert.match(styles, /\.theme-card__swatch--sandstone/);
    assert.match(styles, /\.theme-card__swatch--sage-mist/);
    assert.match(styles, /\.theme-apply-actions/);
    assert.match(styles, /\.theme-card__meta/);
    assert.match(styles, /\.asset-frame__media/);
    assert.match(styles, /\.asset-frame\.is-draggable/);
    assert.match(styles, /\.placement-chip/);
    assert.match(styles, /\.segmented-control/);
    assert.match(styles, /\.segmented-control--three/);
    assert.match(styles, /\.editor-crop-workbench/);
    assert.match(styles, /\.editor-crop-tool/);
    assert.match(styles, /\.editor-crop-actions/);
    assert.match(styles, /\.editor-zoom-input/);
    assert.match(styles, /\.editor-sidebar--navigation \.page-strip/);
    assert.match(styles, /\.upload-progress/);
    assert.match(styles, /\.page-chip__actions/);
    assert.match(styles, /\.page-chip--theme-warm-beige/);
    assert.match(styles, /\.page-chip--theme-butter-cream/);
    assert.match(styles, /\.editor-collapsible-meta/);
    assert.match(styles, /\.editor-project-url/);
    assert.match(styles, /\.editor-icon-button/);
    assert.match(styles, /\.editor-panel__section/);
    assert.match(styles, /\.field-note/);
    assert.match(styles, /\.auth-captcha/);
    assert.match(styles, /\.admin-dashboard/);
    assert.match(styles, /\.editor-panel__heading--compact/);
    assert.match(styles, /\.template-pack-card__actions/);
    assert.match(styles, /\.asset-rail--gallery/);
    assert.match(styles, /--page-heading-gap:/);
    assert.match(styles, /white-space: pre-line;/);
    assert.match(styles, /\.magazine-mosaic__band--compact/);
    assert.match(styles, /\.magazine-triptych__footer--compact/);
    assert.match(styles, /\.magazine-triptych__aside/);
    assert.match(styles, /\.custom-layout-map/);
    assert.match(styles, /\.custom-layout-details/);
    assert.match(styles, /\.magazine-mosaic__headline,\s*\.magazine-grid__copy,\s*\.magazine-triptych__copy \{\s+width: 100%;\s+max-width: none;/);
    assert.match(styles, /\.magazine-mosaic__notes,\s*\.magazine-triptych__aside \{\s+width: 100%;\s+max-width: none;/);
    assert.match(styles, /height: calc\(100vh - 16px\)/);
    assert.match(styles, /isolation: isolate;/);
    assert.match(styles, /\.editor-sidebar \{[\s\S]*z-index: 2;/);
    assert.match(styles, /\.editor-stage \{[\s\S]*z-index: 1;/);
    assert.match(styles, /min-height: auto !important;/);
    assert.match(styles, /margin: 0 !important;/);
    assert.match(styles, /\.editor-print-stack \{\s+position: absolute;/);
    assert.match(styles, /\.editor-print-stack \{[\s\S]*height: 0;/);
    assert.match(styles, /\.editor-print-page \{\s+display: block;/);
    assert.match(viteConfig, /manualChunks/);
    assert.match(viteConfig, /src\/session\.tsx/);
    assert.doesNotMatch(packageManifest, /react-pageflip/);
    assert.doesNotMatch(packageManifest, /page-flip/);
    assert.doesNotMatch(packageLock, /node_modules\/react-pageflip/);
    assert.doesNotMatch(packageLock, /node_modules\/page-flip/);
    assert.match(appRoutes, /const HomePage = lazy\(\(\) => import\('\.\/routes\/HomePage'\)/);
    assert.match(appRoutes, /const IssueViewPage = lazy\(\(\) => import\('\.\/routes\/IssueViewPage'\)/);
    assert.match(appRoutes, /const AccountPage = lazy\(\(\) => import\('\.\/routes\/AccountPage'\)/);
    assert.match(appRoutes, /const EditorPage = lazy\(\(\) => import\('\.\/routes\/EditorPage'\)/);
    assert.match(appRoutes, /useDeferredValue/);
    assert.match(appRoutes, /<Suspense fallback=\{null\}>/);
    assert.match(appRoutes, /<Routes location=\{deferredLocation\}>/);
    assert.doesNotMatch(appRoutes, /import \{ HomePage \} from '\.\/routes\/HomePage'/);
    assert.match(appRoutes, /path="\/auth"/);
    assert.match(appRoutes, /path="\/terms"/);
    assert.match(appRoutes, /path="\/admin"/);
    assert.match(authPage, /Sign in to FinalFolio/);
    assert.match(authPage, /Register/);
    assert.match(authPage, /Human check/);
    assert.match(authPage, /getTermsDocument/);
    assert.match(authPage, /termsDocument\.agreementLabel/);
    assert.match(authPage, /Terms of Service/);
    assert.match(authPage, /Privacy Policy/);
    assert.match(authPage, /Registration sends email and is rate-limited per IP/);
    assert.match(authPage, /Create the first admin account/);
    assert.match(accountPage, /from '\.\/account\/AccountConsoleHeader'/);
    assert.match(accountPage, /from '\.\/account\/AccountOverviewPanel'/);
    assert.match(accountPage, /from '\.\/account\/AccountProjectsPanel'/);
    assert.match(accountPage, /from '\.\/account\/AccountUploadsPanel'/);
    assert.match(accountPage, /from '\.\/account\/AccountSettingsPanel'/);
    assert.match(accountPage, /from '\.\/account\/AccountTemplatesPanel'/);
    assert.match(accountPage, /from '\.\/account\/AccountPreferencesPanel'/);
    assert.match(accountPage, /from '\.\/account\/accountFormatting'/);
    assert.match(accountPage, /from '\.\/account\/accountSections'/);
    assert.match(accountPage, /from '\.\/account\/useAccountWorkspace'/);
    assert.match(accountPage, /useAccountWorkspace\(/);
    assert.match(accountPage, /await refreshAll\(\);/);
    assert.match(accountPage, /<AccountConsoleHeader/);
    assert.match(accountPage, /<AccountOverviewPanel/);
    assert.match(accountPage, /<AccountProjectsPanel/);
    assert.match(accountPage, /<AccountUploadsPanel/);
    assert.match(accountPage, /<AccountSettingsPanel/);
    assert.match(accountPage, /<AccountTemplatesPanel/);
    assert.match(accountPage, /<AccountPreferencesPanel/);
    assert.doesNotMatch(accountPage, /async function loadWorkspace/);
    assert.doesNotMatch(accountPage, /const filteredProjects = useMemo/);
    assert.doesNotMatch(accountPage, /function replaceTemplateRecord/);
    assert.doesNotMatch(accountPage, /function formatTimestamp/);
    assert.doesNotMatch(accountPage, /function formatBytes/);
    assert.doesNotMatch(accountPage, /function formatDimensions/);
    assert.doesNotMatch(accountPage, /function buildAbsoluteUrl/);
    assert.doesNotMatch(accountPage, /function AccountInlineField/);
    assert.doesNotMatch(accountPage, /const ACCOUNT_SECTIONS/);
    assert.doesNotMatch(accountPage, /function normalizeAccountSection/);
    assert.doesNotMatch(accountPage, /Manage your own projects, uploads, and identity\./);
    assert.doesNotMatch(accountPage, /Search projects/);
    assert.doesNotMatch(accountPage, /Search uploads/);
    assert.doesNotMatch(accountPage, /My templates/);
    assert.doesNotMatch(accountPage, /Identity settings/);
    assert.doesNotMatch(accountPage, /Editor defaults/);
    assert.doesNotMatch(accountPage, /MagazinePreview/);
    assert.doesNotMatch(accountPage, /TemplateIssuePreview/);
    assert.doesNotMatch(accountPage, /getAssetDeliveryLabel/);
    assert.doesNotMatch(accountPage, /getUserPrimaryIdentity/);
    assert.doesNotMatch(accountPage, /fetchAccountSummary/);
    assert.match(adminPage, /from '\.\/admin\/useAdminWorkspace'/);
    assert.match(adminPage, /from '\.\/admin\/useAdminConfigState'/);
    assert.match(adminPage, /from '\.\/admin\/useAdminUserManagement'/);
    assert.match(adminPage, /from '\.\/admin\/useAdminAssetGovernanceActions'/);
    assert.match(adminPage, /from '\.\/admin\/useAdminShellState'/);
    assert.match(adminPage, /from '\.\/admin\/AdminOverviewPanel'/);
    assert.match(adminPage, /from '\.\/admin\/AdminConsoleHeader'/);
    assert.match(adminPage, /from '\.\/admin\/AdminEventsPanel'/);
    assert.match(adminPage, /from '\.\/admin\/AdminGovernancePanel'/);
    assert.match(adminPage, /from '\.\/admin\/AdminProjectsPanel'/);
    assert.match(adminPage, /from '\.\/admin\/AdminUploadsPanel'/);
    assert.match(adminPage, /from '\.\/admin\/AdminUsersPanel'/);
    assert.match(adminPage, /from '\.\/admin\/AdminStoragePanel'/);
    assert.match(adminPage, /from '\.\/admin\/AdminShellStates'/);
    assert.doesNotMatch(adminPage, /from '\.\/admin\/adminFormatting'/);
    assert.match(adminPage, /useAdminWorkspace\(/);
    assert.match(adminPage, /useAdminConfigState\(/);
    assert.match(adminPage, /useAdminUserManagement\(/);
    assert.match(adminPage, /useAdminAssetGovernanceActions\(/);
    assert.match(adminPage, /useAdminShellState\(/);
    assert.match(adminPage, /<AdminConsoleHeader/);
    assert.match(adminPage, /<AdminOverviewPanel/);
    assert.match(adminPage, /<AdminEventsPanel/);
    assert.match(adminPage, /<AdminGovernancePanel/);
    assert.match(adminPage, /<AdminProjectsPanel/);
    assert.match(adminPage, /<AdminUploadsPanel/);
    assert.match(adminPage, /<AdminUsersPanel/);
    assert.match(adminPage, /<AdminStoragePanel/);
    assert.match(adminPage, /<AdminLoadingState/);
    assert.match(adminPage, /<AdminUnavailableState/);
    assert.doesNotMatch(adminPage, /Operations console/);
    assert.doesNotMatch(adminPage, /async function loadAdminData/);
    assert.doesNotMatch(adminPage, /const filteredProjects = useMemo/);
    assert.doesNotMatch(adminPage, /fetchAdminSummary/);
    assert.doesNotMatch(adminPage, /async function handleSaveSiteContent/);
    assert.doesNotMatch(adminPage, /function updateSiteHero/);
    assert.doesNotMatch(adminPage, /function updateTemplateSetting/);
    assert.doesNotMatch(adminPage, /function updateObjectStorageDraftField/);
    assert.doesNotMatch(adminPage, /async function handleCreateUser/);
    assert.doesNotMatch(adminPage, /async function handleToggleUser/);
    assert.doesNotMatch(adminPage, /async function handleDeleteUser/);
    assert.doesNotMatch(adminPage, /const \[createUsername, setCreateUsername\] = useState/);
    assert.doesNotMatch(adminPage, /async function handleDeleteProject/);
    assert.doesNotMatch(adminPage, /async function handleDeleteUpload/);
    assert.doesNotMatch(adminPage, /async function handleRetryUpload/);
    assert.doesNotMatch(adminPage, /getConfirmationMessage/);
    assert.doesNotMatch(adminPage, /useNavigate/);
    assert.doesNotMatch(adminPage, /useSearchParams/);
    assert.doesNotMatch(adminPage, /useEffect\(/);
    assert.doesNotMatch(adminPage, /useDelayedVisibility/);
    assert.doesNotMatch(adminPage, /async function refreshAll/);
    assert.doesNotMatch(adminPage, /async function handleLogout/);
    assert.doesNotMatch(adminPage, /function selectSection/);
    assert.doesNotMatch(adminPage, /buildTermsPath/);
    assert.doesNotMatch(adminPage, /logoutUser/);
    assert.doesNotMatch(adminPage, /function normalizeAdminSection/);
    assert.doesNotMatch(adminPage, /LoadingStack/);
    assert.doesNotMatch(adminPage, /Operational snapshot/);
    assert.doesNotMatch(adminPage, /Featured folio on landing page/);
    assert.doesNotMatch(adminPage, /Recent activity/);
    assert.doesNotMatch(adminPage, /Error pressure/);
    assert.doesNotMatch(adminPage, /Live counts, failures, and governance controls will load in place\./);
    assert.doesNotMatch(adminPage, /editor-empty-state/);
    assert.doesNotMatch(adminPage, /Recent errors and activity/);
    assert.doesNotMatch(adminPage, /function formatDetailSummary/);
    assert.doesNotMatch(adminPage, /function buildEventContext/);
    assert.doesNotMatch(adminPage, /const EVENT_TYPE_LABELS/);
    assert.doesNotMatch(adminPage, /admin-section-nav/);
    assert.doesNotMatch(adminPage, /admin-hero/);
    assert.doesNotMatch(adminPage, /function formatBytes/);
    assert.doesNotMatch(adminPage, /function formatTimestamp/);
    assert.doesNotMatch(adminPage, /formatDimensions=\{/);
    assert.doesNotMatch(adminPage, /from '\.\/admin\/AdminFormFields'/);
    assert.doesNotMatch(adminPage, /function AdminInlineField/);
    assert.doesNotMatch(adminPage, /function AdminToggleField/);
    assert.doesNotMatch(adminPage, /Govern page types and starter packs/);
    assert.doesNotMatch(adminPage, /Homepage content and featured folio/);
    assert.doesNotMatch(adminPage, /Save template governance/);
    assert.doesNotMatch(adminPage, /Save site settings/);
    assert.doesNotMatch(adminPage, /Folio governance/);
    assert.doesNotMatch(adminPage, /Search projects/);
    assert.doesNotMatch(adminPage, /Template distribution/);
    assert.doesNotMatch(adminPage, /Recent project events/);
    assert.doesNotMatch(adminPage, /Select a project/);
    assert.doesNotMatch(adminPage, /Asset governance/);
    assert.doesNotMatch(adminPage, /Search uploads/);
    assert.doesNotMatch(adminPage, /Select an upload/);
    assert.doesNotMatch(adminPage, /Referenced projects/);
    assert.doesNotMatch(adminPage, /Placed on pages/);
    assert.doesNotMatch(adminPage, /Open original/);
    assert.doesNotMatch(adminPage, /Provision an active account/);
    assert.doesNotMatch(adminPage, /Search users/);
    assert.doesNotMatch(adminPage, /Bitiful S3 delivery and upload mirroring/);
    assert.doesNotMatch(adminPage, /Enable remote delivery/);
    assert.doesNotMatch(adminPage, /Save object storage/);
    assert.match(issueViewPage, /export \{ IssueViewPage \} from '\.\/IssueViewPageTurnJs';/);
    assert.doesNotMatch(issueViewPage, /react-pageflip/);
    assert.match(issueViewPageTurnJs, /from '\.\/IssueTurnJsBook'/);
    assert.match(issueViewPageTurnJs, /from '\.\/issueViewReaderState'/);
    assert.match(issueViewPageTurnJs, /from '\.\/useIssueViewLayout'/);
    assert.match(issueViewPageTurnJs, /from '\.\/useIssueViewNavigation'/);
    assert.match(issueViewPageTurnJs, /from '\.\/useIssueViewShareState'/);
    assert.match(issueViewPageTurnJs, /from '\.\/useIssueViewChromeState'/);
    assert.match(issueViewPageTurnJs, /useIssueViewViewportLayout\(/);
    assert.match(issueViewPageTurnJs, /useIssueViewSidebarOffset\(/);
    assert.match(issueViewPageTurnJs, /useIssueViewNavigation\(/);
    assert.match(issueViewPageTurnJs, /useIssueViewShareState\(/);
    assert.match(issueViewPageTurnJs, /useIssueViewReaderMode\(/);
    assert.match(issueViewPageTurnJs, /useIssueViewMobilePanelState\(/);
    assert.match(issueViewPageTurnJs, /<IssueTurnJsBook/);
    assert.match(issueViewPageTurnJs, /<IssueViewReaderChrome/);
    assert.match(issueViewPageTurnJs, /<IssueViewSidebar/);
    assert.match(issueViewPageTurnJs, /<IssueViewLoadingState/);
    assert.match(issueViewPageTurnJs, /<IssueViewUnavailableState/);
    assert.doesNotMatch(issueViewPageTurnJs, /await Promise\.all\(\[/);
    assert.doesNotMatch(issueViewPageTurnJs, /import\('\.\.\/turnjs'\)/);
    assert.doesNotMatch(issueViewPageTurnJs, /import\('\.\/issueViewTurnJsMarkup'\)/);
    assert.doesNotMatch(issueViewPageTurnJs, /forwardRef\(function TurnJsBook/);
    assert.doesNotMatch(issueViewPageTurnJs, /function buildRenderedViewerPages/);
    assert.doesNotMatch(issueViewPageTurnJs, /function describeVisibleView/);
    assert.doesNotMatch(issueViewPageTurnJs, /function describeSinglePageView/);
    assert.doesNotMatch(issueViewPageTurnJs, /normalizeVisibleTurnView\(/);
    assert.doesNotMatch(issueViewPageTurnJs, /function readSheetMetrics/);
    assert.doesNotMatch(issueViewPageTurnJs, /function getFullscreenElement/);
    assert.doesNotMatch(issueViewPageTurnJs, /async function requestElementFullscreen/);
    assert.doesNotMatch(issueViewPageTurnJs, /async function exitDocumentFullscreen/);
    assert.doesNotMatch(issueViewPageTurnJs, /function clearQueuedLayoutRefresh/);
    assert.doesNotMatch(issueViewPageTurnJs, /function queueLayoutRefresh/);
    assert.doesNotMatch(issueViewPageTurnJs, /new ResizeObserver/);
    assert.doesNotMatch(issueViewPageTurnJs, /fullscreenchange/);
    assert.doesNotMatch(issueViewPageTurnJs, /function requestMobileTurn/);
    assert.doesNotMatch(issueViewPageTurnJs, /function handleAdvanceToNextPage/);
    assert.doesNotMatch(issueViewPageTurnJs, /function handleAdvanceToPreviousPage/);
    assert.doesNotMatch(issueViewPageTurnJs, /function handleJumpToFirstPage/);
    assert.doesNotMatch(issueViewPageTurnJs, /function handleJumpToLastPage/);
    assert.doesNotMatch(issueViewPageTurnJs, /function handleMobileTouchStart/);
    assert.doesNotMatch(issueViewPageTurnJs, /function handleMobileTouchEnd/);
    assert.doesNotMatch(issueViewPageTurnJs, /fetchPublicIssue/);
    assert.doesNotMatch(issueViewPageTurnJs, /useDelayedVisibility/);
    assert.doesNotMatch(issueViewPageTurnJs, /MOBILE_SINGLE_PAGE_MEDIA_QUERY/);
    assert.doesNotMatch(issueViewPageTurnJs, /window\.matchMedia/);
    assert.doesNotMatch(issueViewPageTurnJs, /event\.key === 'Escape'/);
    assert.doesNotMatch(issueViewPageTurnJs, /document\.title =/);
    assert.doesNotMatch(issueViewPageTurnJs, /className="issue-view-mobile-controls"/);
    assert.doesNotMatch(issueViewPageTurnJs, /className="issue-view-fullscreen-controls"/);
    assert.doesNotMatch(issueViewPageTurnJs, /className="issue-view-sidebar"/);
    assert.doesNotMatch(issueViewPageTurnJs, /<p className="eyebrow">Current view<\/p>/);
    assert.doesNotMatch(issueViewPageTurnJs, /<p className="eyebrow">Shared folio<\/p>/);
    assert.doesNotMatch(issueViewPageTurnJs, /issue-view-layout--loading/);
    assert.doesNotMatch(issueViewPageTurnJs, /issue-viewer__placeholder-page/);
    assert.doesNotMatch(issueViewPageTurnJs, /Shared folio not available\./);
    assert.match(issueTurnJsBook, /export const IssueTurnJsBook/);
    assert.match(issueTurnJsBook, /export type TurnJsBookHandle/);
    assert.match(issueTurnJsBook, /useIssueTurnJsRuntime/);
    assert.match(useIssueTurnJsRuntime, /await Promise\.all\(\[/);
    assert.match(useIssueTurnJsRuntime, /import\('\.\.\/turnjs'\)/);
    assert.match(useIssueTurnJsRuntime, /import\('\.\/issueViewTurnJsMarkup'\)/);
    assert.match(useIssueTurnJsRuntime, /renderTurnJsPageMarkup/);
    assert.match(useIssueTurnJsRuntime, /issue-viewer__turnjs--ready/);
    assert.match(issueViewReaderState, /export const MOBILE_SINGLE_PAGE_MEDIA_QUERY/);
    assert.match(issueViewReaderState, /export function buildRenderedViewerPages/);
    assert.match(issueViewReaderState, /export function describeVisibleView/);
    assert.match(issueViewReaderState, /export function describeSinglePageView/);
    assert.match(issueViewReaderState, /export function normalizeVisibleTurnView/);
    assert.match(issueViewReaderState, /export function readSheetMetrics/);
    assert.match(useIssueViewLayout, /export function useIssueViewViewportLayout/);
    assert.match(useIssueViewLayout, /export function useIssueViewSidebarOffset/);
    assert.match(useIssueViewLayout, /function getFullscreenElement/);
    assert.match(useIssueViewLayout, /async function requestElementFullscreen/);
    assert.match(useIssueViewLayout, /async function exitDocumentFullscreen/);
    assert.match(useIssueViewLayout, /function clearQueuedLayoutRefresh/);
    assert.match(useIssueViewLayout, /new ResizeObserver/);
    assert.match(useIssueViewLayout, /fullscreenchange/);
    assert.match(useIssueViewLayout, /issue-view-shell--mobile-portrait/);
    assert.match(useIssueViewLayout, /setSidebarTopOffset/);
    assert.match(useIssueViewNavigation, /export function useIssueViewNavigation/);
    assert.match(useIssueViewNavigation, /function requestMobileTurn/);
    assert.match(useIssueViewNavigation, /function handleAdvanceToNextPage/);
    assert.match(useIssueViewNavigation, /function handleAdvanceToPreviousPage/);
    assert.match(useIssueViewNavigation, /function handleJumpToFirstPage/);
    assert.match(useIssueViewNavigation, /function handleJumpToLastPage/);
    assert.match(useIssueViewNavigation, /function handleBookViewChange/);
    assert.match(useIssueViewNavigation, /function handleMobileTouchStart/);
    assert.match(useIssueViewNavigation, /function handleMobileTouchEnd/);
    assert.match(useIssueViewNavigation, /window\.addEventListener\('keydown', handleKeyDown\)/);
    assert.match(useIssueViewNavigation, /getLeadingVisiblePage/);
    assert.match(useIssueViewShareState, /export function useIssueViewShareState/);
    assert.match(useIssueViewShareState, /fetchPublicIssue\(shareId\)/);
    assert.match(useIssueViewShareState, /useDelayedVisibility/);
    assert.match(useIssueViewShareState, /document\.title =/);
    assert.match(useIssueViewChromeState, /export function useIssueViewReaderMode/);
    assert.match(useIssueViewChromeState, /export function useIssueViewMobilePanelState/);
    assert.match(useIssueViewChromeState, /MOBILE_SINGLE_PAGE_MEDIA_QUERY/);
    assert.match(useIssueViewChromeState, /window\.matchMedia/);
    assert.match(useIssueViewChromeState, /event\.key === 'Escape'/);
    assert.match(useIssueViewChromeState, /setMobilePanelOpen\(false\)/);
    assert.match(issueViewChrome, /export function IssueViewReaderChrome/);
    assert.match(issueViewChrome, /export function IssueViewSidebar/);
    assert.match(issueViewChrome, /issue-view-mobile-controls/);
    assert.match(issueViewChrome, /issue-view-fullscreen-controls/);
    assert.match(issueViewChrome, /issue-view-sidebar/);
    assert.match(issueViewChrome, /Current view/);
    assert.match(issueViewChrome, /Shared folio/);
    assert.match(issueViewShellStates, /export function IssueViewLoadingState/);
    assert.match(issueViewShellStates, /export function IssueViewUnavailableState/);
    assert.match(issueViewShellStates, /issue-view-layout--loading/);
    assert.match(issueViewShellStates, /issue-viewer__placeholder-page/);
    assert.match(issueViewShellStates, /Shared folio not available\./);
    assert.match(issueViewTurnJsMarkup, /export function renderTurnJsPageMarkup/);
    assert.match(issueViewTurnJsMarkup, /createRoot/);
    assert.match(issueViewTurnJsMarkup, /flushSync/);
    assert.doesNotMatch(issueViewTurnJsMarkup, /react-dom\/server/);
    assert.match(issueViewTurnJsMarkup, /MagazinePreview/);
    assert.match(editorPage, /Apply/);
    assert.match(editorPage, /Add page/);
    assert.match(editorPage, /editor-panel--layout/);
    assert.match(editorPage, /Page style/);
    assert.match(editorPage, /Apply all/);
    assert.match(editorPage, /editor-collapsible-meta/);
    assert.match(editorPage, /zoomInputValue/);
    assert.match(editorPage, /handleCropMetricsChange/);
    assert.match(editorPage, /useEditorAssetLifecycle/);
    assert.match(editorPage, /useEditorPreviewScale/);
    assert.match(editorPage, /ref=\{printStackRef\}/);
    assert.match(editorPage, /templatePickerOpen/);
    assert.match(editorPage, /uploadProgressLabel/);
    assert.match(editorPage, /createEditorExportActions/);
    assert.match(editorPage, /frameRadius/);
    assert.match(editorPage, /createEditorProjectShellActions/);
    assert.match(editorPage, /CustomLayoutMap/);
    assert.match(editorPage, /templateUsesDeck/);
    assert.match(editorPage, /templateUsesBody/);
    assert.match(editorPageOperations, /Replaced the page stack with the \$\{pack\.label\} pack/);
    assert.match(editorPage, /Move page up/);
    assert.match(editorPage, /Delete page/);
    assert.match(editorPage, /Text block geometry/);
    assert.match(editorPage, /Advanced frame geometry/);
    assert.match(editorPage, /editor-sidebar editor-sidebar--navigation/);
    assert.match(editorPage, /aria-label="Live page editor"/);
    assert.match(editorPage, /Create link/);
    assert.match(editorPage, /<EditorContentSidebar/);
    assert.match(editorPage, /<EditorOperationsSidebar/);
    assert.match(editorPage, /<EditorExportCenter/);
    assert.match(editorPage, /<EditorLoadingState/);
    assert.match(editorPage, /<EditorUnavailableState/);
    assert.match(editorPage, /<EditorLockedState/);
    assert.match(editorContentSidebar, /export function EditorContentSidebar/);
    assert.match(editorContentSidebar, /editor-panel--content-work/);
    assert.match(editorContentSidebar, /editor-panel--photos/);
    assert.match(editorContentSidebar, /Fields/);
    assert.match(editorContentSidebar, /Small label above the main headline\./);
    assert.match(editorContentSidebar, /Line breaks stay visible in the preview\./);
    assert.match(editorContentSidebar, /Clear all/);
    assert.match(editorContentSidebar, /Clear .* unused/);
    assert.match(editorContentSidebar, /editor-crop-workbench/);
    assert.match(editorContentSidebar, /asset-rail asset-rail--gallery/);
    assert.match(editorContentSidebar, /Arrow keys nudge/);
    assert.match(editorOperationsSidebar, /export function EditorOperationsSidebar/);
    assert.match(editorOperationsSidebar, /editor-panel--project-actions/);
    assert.match(editorOperationsSidebar, /editor-project-url/);
    assert.match(editorOperationsSidebar, /editor-icon-button/);
    assert.match(editorOperationsSidebar, /Share project/);
    assert.match(editorOperationsSidebar, /Public viewer/);
    assert.match(editorOperationsSidebar, /Save as template/);
    assert.match(editorOperationsSidebar, /Folio details/);
    assert.match(editorOperationsSidebar, /Image corners/);
    assert.match(editorOperationsSidebar, /Square/);
    assert.match(editorOperationsSidebar, /Round/);
    assert.match(editorExportCenter, /export function EditorExportCenter/);
    assert.match(editorExportCenter, /Export Center/);
    assert.match(editorExportCenter, /Preflight and output/);
    assert.match(editorExportCenter, /JPG output mode/);
    assert.match(editorExportCenter, /No high-confidence issues detected/);
    assert.match(editorShellStates, /export function EditorLoadingState/);
    assert.match(editorShellStates, /Preparing fields/);
    assert.match(editorShellStates, /export function EditorUnavailableState/);
    assert.match(editorShellStates, /Project not available\./);
    assert.match(editorShellStates, /export function EditorLockedState/);
    assert.match(editorShellStates, /Sign in to reopen this folio\./);
    assert.match(editorUploadOperations, /prepared\.items/);
    assert.match(editorUseEditorProjectLifecycle, /buildDraftProjectHydration/);
    assert.match(editorUseEditorProjectLifecycle, /buildServerProjectHydration/);
    assert.match(editorUseEditorProjectLifecycle, /createDraftLoadMessage/);
    assert.match(editorUseEditorProjectLifecycle, /STABLE_EDITOR_URL_MESSAGE/);
    assert.match(editorPage, /from '\.\/editor\/projectPersistence'/);
    assert.match(editorPage, /from '\.\/editor\/assetActions'/);
    assert.match(editorPage, /from '\.\/editor\/uploadOperations'/);
    assert.match(editorPage, /from '\.\/editor\/templateOperations'/);
    assert.match(editorPage, /from '\.\/editor\/exportFlow'/);
    assert.match(editorPage, /from '\.\/editor\/projectActions'/);
    assert.match(editorPage, /from '\.\/editor\/pageActions'/);
    assert.match(editorPage, /from '\.\/editor\/designActions'/);
    assert.match(editorPage, /from '\.\/editor\/useEditorExportState'/);
    assert.match(editorPage, /from '\.\/editor\/useEditorProjectLifecycle'/);
    assert.match(editorPage, /from '\.\/editor\/useEditorProjectState'/);
    assert.match(editorPage, /from '\.\/editor\/useEditorTemplateState'/);
    assert.match(editorPage, /from '\.\/editor\/useEditorAssetLifecycle'/);
    assert.match(editorPage, /from '\.\/editor\/useEditorPreviewScale'/);
    assert.match(editorPage, /from '\.\/editor\/useEditorUiState'/);
    assert.match(editorPage, /from '\.\/editor\/EditorContentSidebar'/);
    assert.match(editorPage, /from '\.\/editor\/EditorOperationsSidebar'/);
    assert.match(editorPage, /from '\.\/editor\/EditorExportCenter'/);
    assert.match(editorPage, /from '\.\/editor\/EditorShellStates'/);
    assert.match(styles, /\.loading-tab \{\s+display: block;\s+flex: none;\s+height: 0\.42rem;/);
    assert.match(styles, /\.loading-field \{\s+display: flex;\s+align-items: center;\s+min-height: 0;/);
    assert.match(styles, /\.issue-viewer__placeholder-page \{\s+min-height: clamp\(280px, 48vh, 520px\);\s+border-radius: 18px;/);
    assert.match(editorProjectLifecycle, /export function buildDraftProjectHydration/);
    assert.match(editorProjectLifecycle, /export function normalizeEditorProjectRecord/);
    assert.match(editorProjectPersistence, /export function applyServerProjectRecordState/);
    assert.match(editorProjectPersistence, /export function createEditorProjectPersistenceActions/);
    assert.match(editorProjectPersistence, /export async function saveProjectRecord/);
    assert.match(editorProjectPersistence, /normalizeEditorProjectRecord/);
    assert.match(editorAssetOperations, /export function assignAssetToProject/);
    assert.match(editorAssetOperations, /export async function removeUnusedAssetsFromProject/);
    assert.match(editorAssetActions, /export function createEditorAssetActions/);
    assert.match(editorAssetActions, /function handleDeleteAsset/);
    assert.match(editorAssetActions, /function removeUnusedAssetsFromIssue/);
    assert.match(editorUploadOperations, /export async function uploadFilesIntoProject/);
    assert.match(editorUploadOperations, /export async function promoteGuestDraftUploads/);
    assert.match(editorUploadOperations, /export function createEditorUploadActions/);
    assert.match(editorUploadOperations, /function handleUploadFiles/);
    assert.match(editorUploadOperations, /function reconcileDraftOwnedUploads/);
    assert.match(editorUploadOperations, /export function reconcileDraftOwnedUploadState/);
    assert.match(editorTemplateOperations, /export function createEditorTemplateActions/);
    assert.match(editorTemplateOperations, /export async function refreshUserTemplateLibrary/);
    assert.match(editorTemplateOperations, /export async function saveProjectAsTemplate/);
    assert.match(editorTemplateOperations, /export async function openUserTemplateProject/);
    assert.match(editorExportFlow, /export function createEditorExportActions/);
    assert.match(editorExportFlow, /export async function preparePrintAssetsForExport/);
    assert.match(editorExportFlow, /export async function waitForPrintSurfaceReady/);
    assert.match(editorExportFlow, /createExportDocumentTitle/);
    assert.match(editorExportFlow, /document\.title = nextTitle/);
    assert.match(editorExportFlow, /window\.print\(\)/);
    assert.match(editorExportFlow, /createProjectExportBlob/);
    assert.match(editorProjectActions, /export function createEditorProjectShellActions/);
    assert.match(editorProjectActions, /export async function duplicateProjectRecord/);
    assert.match(editorProjectActions, /export async function toggleProjectArchiveState/);
    assert.match(editorProjectActions, /function handleCopyLink/);
    assert.match(editorProjectActions, /duplicateProject\(/);
    assert.match(editorProjectActions, /patchProject\(/);
    assert.match(editorPageOperations, /export function addPageToProject/);
    assert.match(editorPageOperations, /export function duplicateProjectPage/);
    assert.match(editorPageOperations, /export function applyTemplatePackToProject/);
    assert.match(editorPageOperations, /export function applyTemplateChoiceToPage/);
    assert.match(editorPageOperations, /createPagesFromTemplatePack/);
    assert.match(editorPageOperations, /remapPageToTemplate/);
    assert.match(editorPageActions, /export function createEditorPageActions/);
    assert.match(editorPageActions, /function applyTemplatePack/);
    assert.match(editorPageActions, /function applyTemplateChoice/);
    assert.match(editorDesignActions, /export function createEditorDesignActions/);
    assert.match(editorDesignActions, /function clampLayoutArea/);
    assert.match(editorDesignActions, /function loadCustomLayoutPreset/);
    assert.match(editorDesignActions, /function updateFrameRadius/);
    assert.match(editorUseEditorExportState, /export function useEditorExportState/);
    assert.match(editorUseEditorExportState, /function updateExportSettings/);
    assert.match(editorUseEditorExportState, /function applyAccountExportSettings/);
    assert.match(editorUseEditorExportState, /runExportPreflight/);
    assert.match(editorUseEditorProjectLifecycle, /export function useEditorProjectLifecycle/);
    assert.match(editorUseEditorProjectLifecycle, /async function loadServerProject/);
    assert.match(editorUseEditorProjectLifecycle, /restoreDraftProjectUploads/);
    assert.match(editorUseEditorProjectLifecycle, /fetchProject\(projectId\)/);
    assert.match(editorUseEditorProjectLifecycle, /writeDraftProject\(project\)/);
    assert.match(editorUseEditorProjectLifecycle, /saveProject\(\{ manual: false \}\)/);
    assert.match(editorUseEditorProjectState, /export function useEditorProjectState/);
    assert.match(editorUseEditorProjectState, /function updateSelectedCrop/);
    assert.match(editorUseEditorProjectState, /function selectPage/);
    assert.match(editorUseEditorTemplateState, /export function useEditorTemplateState/);
    assert.match(editorUseEditorTemplateState, /function createExportSettingsFromPreferences/);
    assert.match(editorUseEditorTemplateState, /fetchTemplateGovernance/);
    assert.match(editorUseEditorAssetLifecycle, /export function useEditorAssetLifecycle/);
    assert.match(editorUseEditorAssetLifecycle, /subscribeToDraftAssetRemoval/);
    assert.match(editorUseEditorAssetLifecycle, /promoteGuestDraftUploads/);
    assert.match(editorUseEditorAssetLifecycle, /fetchAccountUploads\(\)/);
    assert.match(editorUseEditorAssetLifecycle, /readImageIntrinsicSize/);
    assert.match(editorUseEditorPreviewScale, /export function useEditorPreviewScale/);
    assert.match(editorUseEditorPreviewScale, /new ResizeObserver/);
    assert.match(editorUseEditorPreviewScale, /getBoundingClientRect/);
    assert.match(editorUseEditorTemplateState, /function toggleTemplateComposer/);
    assert.match(editorUseEditorTemplateState, /refreshUserTemplateLibrary/);
    assert.match(editorUseEditorTemplateState, /fetchAccountPreferences/);
    assert.match(editorUseEditorUiState, /export function useEditorUiState/);
    assert.match(editorUseEditorUiState, /openTemplateHoverPreview/);
    assert.match(editorUseEditorUiState, /commitZoomInputValue/);
    assert.match(editorUseEditorUiState, /setPinnedCustomLayoutPreview/);
    assert.match(accountConsoleHeader, /export function AccountConsoleHeader/);
    assert.match(accountConsoleHeader, /Manage your own projects, uploads, and identity\./);
    assert.match(accountConsoleHeader, /admin-section-nav/);
    assert.match(accountConsoleHeader, /getUserPrimaryIdentity/);
    assert.match(accountOverviewPanel, /export function AccountOverviewPanel/);
    assert.match(accountOverviewPanel, /Your working set/);
    assert.match(accountOverviewPanel, /Continue editing/);
    assert.match(accountOverviewPanel, /Latest account actions/);
    assert.match(accountProjectsPanel, /export function AccountProjectsPanel/);
    assert.match(accountProjectsPanel, /Search projects/);
    assert.match(accountProjectsPanel, /Select a project/);
    assert.match(accountProjectsPanel, /MagazinePreview/);
    assert.match(accountProjectsPanel, /getTemplateLabel/);
    assert.match(accountUploadsPanel, /export function AccountUploadsPanel/);
    assert.match(accountUploadsPanel, /Search uploads/);
    assert.match(accountUploadsPanel, /Select an upload/);
    assert.match(accountUploadsPanel, /Referenced projects/);
    assert.match(accountUploadsPanel, /getAssetDeliveryLabel/);
    assert.match(accountSettingsPanel, /export function AccountSettingsPanel/);
    assert.match(accountSettingsPanel, /Identity settings/);
    assert.match(accountSettingsPanel, /Change password/);
    assert.match(accountSettingsPanel, /AccountInlineField/);
    assert.match(accountTemplatesPanel, /export function AccountTemplatesPanel/);
    assert.match(accountTemplatesPanel, /My templates/);
    assert.match(accountTemplatesPanel, /Use template/);
    assert.match(accountTemplatesPanel, /TemplateIssuePreview/);
    assert.match(accountPreferencesPanel, /export function AccountPreferencesPanel/);
    assert.match(accountPreferencesPanel, /Editor defaults/);
    assert.match(accountPreferencesPanel, /Save preferences/);
    assert.match(accountPreferencesPanel, /AccountInlineField/);
    assert.match(accountFormFields, /export function AccountInlineField/);
    assert.match(accountFormatting, /export function formatTimestamp/);
    assert.match(accountFormatting, /export function formatBytes/);
    assert.match(accountFormatting, /export function formatDimensions/);
    assert.match(accountFormatting, /export function buildAbsoluteUrl/);
    assert.match(accountSections, /export const ACCOUNT_SECTIONS/);
    assert.match(accountSections, /export function normalizeAccountSection/);
    assert.match(accountUseAccountWorkspace, /export function useAccountWorkspace/);
    assert.match(accountUseAccountWorkspace, /fetchAccountSummary\(\)/);
    assert.match(accountUseAccountWorkspace, /fetchOwnedProjects\('', 'all'\)/);
    assert.match(accountUseAccountWorkspace, /const filteredProjects = useMemo/);
    assert.match(accountUseAccountWorkspace, /const replaceProjectRecord = useCallback/);
    assert.match(adminUseAdminWorkspace, /export function createAdminObjectStorageDraft/);
    assert.match(adminUseAdminWorkspace, /export function useAdminWorkspace/);
    assert.match(adminUseAdminWorkspace, /fetchAdminSummary\(\)/);
    assert.match(adminUseAdminWorkspace, /fetchAdminProject\(selectedProject\.id\)/);
    assert.match(adminUseAdminWorkspace, /const filteredProjects = useMemo/);
    assert.match(adminUseAdminWorkspace, /const rankedEventBreakdown = useMemo/);
    assert.match(adminUseAdminConfigState, /export function useAdminConfigState/);
    assert.match(adminUseAdminConfigState, /async function handleSaveSiteContent/);
    assert.match(adminUseAdminConfigState, /async function handleSaveObjectStorage/);
    assert.match(adminUseAdminConfigState, /function updateSiteHero/);
    assert.match(adminUseAdminConfigState, /function updateTemplateSetting/);
    assert.match(adminUseAdminConfigState, /getConfirmationMessage/);
    assert.match(adminUseAdminUserManagement, /export function useAdminUserManagement/);
    assert.match(adminUseAdminUserManagement, /async function handleCreateUser/);
    assert.match(adminUseAdminUserManagement, /async function handleToggleUser/);
    assert.match(adminUseAdminUserManagement, /async function handleDeleteUser/);
    assert.match(adminUseAdminUserManagement, /updateAdminUserStatus/);
    assert.match(adminUseAdminUserManagement, /deleteAdminUser/);
    assert.match(adminUseAdminUserManagement, /createAdminUser/);
    assert.match(adminUseAdminAssetGovernanceActions, /export function useAdminAssetGovernanceActions/);
    assert.match(adminUseAdminAssetGovernanceActions, /async function handleDeleteProject/);
    assert.match(adminUseAdminAssetGovernanceActions, /async function handleDeleteUpload/);
    assert.match(adminUseAdminAssetGovernanceActions, /async function handleRetryUpload/);
    assert.match(adminUseAdminAssetGovernanceActions, /deleteAdminProject/);
    assert.match(adminUseAdminAssetGovernanceActions, /deleteAdminUpload/);
    assert.match(adminUseAdminAssetGovernanceActions, /retryAdminUploadObjectStorageSync/);
    assert.match(adminUseAdminAssetGovernanceActions, /getConfirmationMessage/);
    assert.match(adminUseAdminShellState, /export function useAdminShellState/);
    assert.match(adminUseAdminShellState, /function normalizeAdminSection/);
    assert.match(adminUseAdminShellState, /useNavigate/);
    assert.match(adminUseAdminShellState, /useSearchParams/);
    assert.match(adminUseAdminShellState, /useEffect\(/);
    assert.match(adminUseAdminShellState, /useDelayedVisibility/);
    assert.match(adminUseAdminShellState, /async function refreshAll/);
    assert.match(adminUseAdminShellState, /async function handleLogout/);
    assert.match(adminUseAdminShellState, /function selectSection/);
    assert.match(adminUseAdminShellState, /buildTermsPath/);
    assert.match(adminUseAdminShellState, /logoutUser/);
    assert.match(adminUseAdminShellState, /getUserPrimaryIdentity/);
    assert.match(adminUseAdminShellState, /Create the first admin account/);
    assert.match(adminUseAdminShellState, /Sign in with an admin account/);
    assert.match(adminUseAdminShellState, /Loading admin backend/);
    assert.match(adminConsoleHeader, /export function AdminConsoleHeader/);
    assert.match(adminConsoleHeader, /Operations console for product governance/);
    assert.match(adminConsoleHeader, /admin-section-nav/);
    assert.match(adminConsoleHeader, /admin-hero/);
    assert.match(adminConsoleHeader, /getUserPrimaryIdentity/);
    assert.match(adminConsoleHeader, /from '\.\/adminFormatting'/);
    assert.match(adminFormFields, /export function AdminInlineField/);
    assert.match(adminFormFields, /export function AdminToggleField/);
    assert.match(adminGovernancePanel, /export function AdminGovernancePanel/);
    assert.match(adminGovernancePanel, /Govern page types and starter packs/);
    assert.match(adminGovernancePanel, /Homepage content and featured folio/);
    assert.match(adminGovernancePanel, /Save template governance/);
    assert.match(adminGovernancePanel, /Save site settings/);
    assert.match(adminGovernancePanel, /templatePacks/);
    assert.match(adminGovernancePanel, /templateMeta/);
    assert.match(adminOverviewPanel, /export function AdminOverviewPanel/);
    assert.match(adminProjectsPanel, /export function AdminProjectsPanel/);
    assert.match(adminProjectsPanel, /Folio governance/);
    assert.match(adminProjectsPanel, /Search projects/);
    assert.match(adminProjectsPanel, /Template distribution/);
    assert.match(adminProjectsPanel, /Recent project events/);
    assert.match(adminProjectsPanel, /Select a project/);
    assert.match(adminProjectsPanel, /MagazinePreview/);
    assert.match(adminProjectsPanel, /getTemplateLabel/);
    assert.match(adminUploadsPanel, /export function AdminUploadsPanel/);
    assert.match(adminUploadsPanel, /Asset governance/);
    assert.match(adminUploadsPanel, /Search uploads/);
    assert.match(adminUploadsPanel, /Select an upload/);
    assert.match(adminUploadsPanel, /Referenced projects/);
    assert.match(adminUploadsPanel, /Placed on pages/);
    assert.match(adminUploadsPanel, /Open original/);
    assert.match(adminUploadsPanel, /getAssetDeliveryLabel/);
    assert.match(adminUploadsPanel, /getAssetDeliveryTone/);
    assert.match(adminOverviewPanel, /Operational snapshot/);
    assert.match(adminOverviewPanel, /Featured folio on landing page/);
    assert.match(adminOverviewPanel, /Recent activity/);
    assert.match(adminOverviewPanel, /Error pressure/);
    assert.match(adminOverviewPanel, /admin-dashboard__primary/);
    assert.match(adminOverviewPanel, /admin-dashboard__secondary/);
    assert.match(adminOverviewPanel, /from '\.\/adminFormatting'/);
    assert.match(adminEventsPanel, /export function AdminEventsPanel/);
    assert.match(adminEventsPanel, /Recent errors and activity/);
    assert.match(adminEventsPanel, /Recent failures/);
    assert.match(adminEventsPanel, /Recent operations/);
    assert.match(adminEventsPanel, /Trend details/);
    assert.match(adminEventsPanel, /function formatDetailSummary/);
    assert.match(adminEventsPanel, /function buildEventContext/);
    assert.match(adminEventsPanel, /from '\.\/adminFormatting'/);
    assert.match(adminUsersPanel, /export function AdminUsersPanel/);
    assert.match(adminUsersPanel, /Provision an active account/);
    assert.match(adminUsersPanel, /Admin-created accounts are activated immediately/);
    assert.match(adminUsersPanel, /Search users/);
    assert.match(adminUsersPanel, /Create active user/);
    assert.match(adminUsersPanel, /Current admin/);
    assert.match(adminUsersPanel, /from '\.\/adminFormatting'/);
    assert.match(adminStoragePanel, /export function AdminStoragePanel/);
    assert.match(adminStoragePanel, /Bitiful S3 delivery and upload mirroring/);
    assert.match(adminStoragePanel, /Enable remote delivery/);
    assert.match(adminStoragePanel, /Save object storage/);
    assert.match(adminStoragePanel, /Sync existing uploads/);
    assert.match(adminStoragePanel, /Restore to local/);
    assert.match(adminStoragePanel, /AdminInlineField/);
    assert.match(adminStoragePanel, /AdminToggleField/);
    assert.match(adminStoragePanel, /from '\.\/adminFormatting'/);
    assert.match(adminProjectsPanel, /from '\.\/adminFormatting'/);
    assert.match(adminUploadsPanel, /from '\.\/adminFormatting'/);
    assert.match(adminShellStates, /export function AdminLoadingState/);
    assert.match(adminShellStates, /export function AdminUnavailableState/);
    assert.match(adminShellStates, /LoadingStack/);
    assert.match(adminShellStates, /Live counts, failures, and governance controls will load in place\./);
    assert.match(adminShellStates, /Unavailable/);
    assert.match(adminShellStates, /Back to editor/);
    assert.match(editorExportRuntime, /export async function waitForSettledPrintFrames/);
    assert.match(editorUploadState, /export function createIdleUploadState/);
    assert.doesNotMatch(editorPage, /function createPersistableProjectSnapshot/);
    assert.doesNotMatch(editorPage, /function hydrateOwnedUploadAsset/);
    assert.doesNotMatch(editorPage, /function applyServerProjectRecord/);
    assert.doesNotMatch(editorPage, /async function saveProject/);
    assert.doesNotMatch(editorPage, /async function handleEnableProjectShare/);
    assert.doesNotMatch(editorPage, /async function handleDisableProjectShare/);
    assert.doesNotMatch(editorPage, /async function handleCopyPublicShareLink/);
    assert.doesNotMatch(editorPage, /async function handleSaveCurrentProjectAsTemplate/);
    assert.doesNotMatch(editorPage, /subscribeToDraftAssetRemoval/);
    assert.doesNotMatch(editorPage, /promoteGuestDraftUploads/);
    assert.doesNotMatch(editorPage, /fetchTemplateGovernance/);
    assert.doesNotMatch(editorPage, /runExportPreflight/);
    assert.doesNotMatch(editorPage, /fetchAccountUploads/);
    assert.doesNotMatch(editorPage, /ResizeObserver/);
    assert.doesNotMatch(editorPage, /readImageIntrinsicSize/);
    assert.doesNotMatch(editorPage, /ephemeralAssetUrlsRef/);
    assert.doesNotMatch(editorPage, /guestUploadPromotionFingerprintRef/);
    assert.doesNotMatch(editorPage, /async function handleOpenUserTemplate/);
    assert.doesNotMatch(editorPage, /function startNewDraft/);
    assert.doesNotMatch(editorPage, /async function preparePrintAssetsIfNeeded/);
    assert.doesNotMatch(editorPage, /async function handlePrint/);
    assert.doesNotMatch(editorPage, /async function captureJpgPages/);
    assert.doesNotMatch(editorPage, /async function handleRunExport/);
    assert.doesNotMatch(editorPage, /async function handleDuplicateCurrentProject/);
    assert.doesNotMatch(editorPage, /async function handleArchiveToggle/);
    assert.doesNotMatch(editorPage, /function openAccountPage/);
    assert.doesNotMatch(editorPage, /function openAdminPage/);
    assert.doesNotMatch(editorPage, /async function handleCopyLink/);
    assert.doesNotMatch(editorPage, /function updateExportSettings/);
    assert.doesNotMatch(editorPage, /function setExportDialogMessage/);
    assert.doesNotMatch(editorPage, /function createExportSettingsFromPreferences/);
    assert.doesNotMatch(editorPage, /fetchAccountPreferences/);
    assert.doesNotMatch(editorPage, /refreshUserTemplateLibrary/);
    assert.doesNotMatch(editorPage, /buildDraftProjectHydration/);
    assert.doesNotMatch(editorPage, /buildServerProjectHydration/);
    assert.doesNotMatch(editorPage, /async function loadServerProject/);
    assert.doesNotMatch(editorPage, /writeDraftProject\(project\)/);
    assert.doesNotMatch(editorPage, /syncPersistedDraftUploads\(project\)/);
    assert.doesNotMatch(editorPage, /fetchProject\(projectId\)/);
    assert.doesNotMatch(editorPage, /function updateProject/);
    assert.doesNotMatch(editorPage, /function updateSelectedPage/);
    assert.doesNotMatch(editorPage, /function updateSelectedCrop/);
    assert.doesNotMatch(editorPage, /function updateSlotCrop/);
    assert.doesNotMatch(editorPage, /function selectPage/);
    assert.doesNotMatch(editorPage, /function assignAsset/);
    assert.doesNotMatch(editorPage, /function focusAssetPlacement/);
    assert.doesNotMatch(editorPage, /function clearAssetPlacements/);
    assert.doesNotMatch(editorPage, /function clearSelectedSlot/);
    assert.doesNotMatch(editorPage, /function handleDeleteAsset/);
    assert.doesNotMatch(editorPage, /function handleRetryAssetMirror/);
    assert.doesNotMatch(editorPage, /function removeUnusedAssetsFromIssue/);
    assert.doesNotMatch(editorPage, /function reconcileDraftOwnedUploads/);
    assert.doesNotMatch(editorPage, /async function handleUpload/);
    assert.doesNotMatch(editorPage, /function createAssetFromOwnedUpload/);
    assert.doesNotMatch(editorPage, /function readGuestDraftUploadFile/);
    assert.doesNotMatch(editorPage, /optimizeUploadFiles\(/);
    assert.doesNotMatch(editorPage, /fetchOwnedTemplates/);
    assert.doesNotMatch(editorPage, /createUserTemplate\(/);
    assert.doesNotMatch(editorPage, /createProjectFromUserTemplate\(/);
    assert.doesNotMatch(editorPage, /function templateUsesDeck/);
    assert.doesNotMatch(editorPage, /function templateUsesKicker/);
    assert.doesNotMatch(editorPage, /function templateUsesBody/);
    assert.doesNotMatch(editorPage, /window\.print\(\)/);
    assert.doesNotMatch(editorPage, /document\.title = nextTitle/);
    assert.doesNotMatch(editorPage, /createProjectExportBlob/);
    assert.doesNotMatch(editorPage, /duplicateProject\(/);
    assert.doesNotMatch(editorPage, /patchProject\(/);
    assert.doesNotMatch(editorPage, /function getErrorMessage/);
    assert.doesNotMatch(editorPage, /function clonePage/);
    assert.doesNotMatch(editorPage, /function moveItem</);
    assert.doesNotMatch(editorPage, /function createPageFromTemplate/);
    assert.doesNotMatch(editorPage, /function applyTemplatePack/);
    assert.doesNotMatch(editorPage, /function addPage\(/);
    assert.doesNotMatch(editorPage, /function duplicatePage/);
    assert.doesNotMatch(editorPage, /function moveSelectedPage/);
    assert.doesNotMatch(editorPage, /function removeSelectedPage/);
    assert.doesNotMatch(editorPage, /function applyTemplateChoice/);
    assert.doesNotMatch(editorPage, /createPageDraft\(/);
    assert.doesNotMatch(editorPage, /createPagesFromTemplatePack\(/);
    assert.doesNotMatch(editorPage, /remapPageToTemplate\(/);
    assert.doesNotMatch(editorPage, /function openTemplateHoverPreview/);
    assert.doesNotMatch(editorPage, /function handleCustomLayoutPreviewBlur/);
    assert.doesNotMatch(editorPage, /function nudgeSelectedCrop/);
    assert.doesNotMatch(editorPage, /function nudgeSelectedScale/);
    assert.doesNotMatch(editorPage, /function commitZoomInputValue/);
    assert.doesNotMatch(editorPage, /function clampLayoutArea/);
    assert.doesNotMatch(editorPage, /function updateCustomTemplateDraft/);
    assert.doesNotMatch(editorPage, /function updateCustomArea/);
    assert.doesNotMatch(editorPage, /function updateCustomFrameArea/);
    assert.doesNotMatch(editorPage, /function loadCustomLayoutPreset/);
    assert.doesNotMatch(editorPage, /function addCustomFrame/);
    assert.doesNotMatch(editorPage, /function removeCustomFrame/);
    assert.doesNotMatch(editorPage, /function applyTheme/);
    assert.doesNotMatch(editorPage, /function updateFrameRadius/);
    assert.doesNotMatch(editorPage, /setPinnedCustomLayoutPreview/);
    assert.doesNotMatch(editorPage, /Apply here/);
    assert.doesNotMatch(editorPage, /On this page/);
    assert.doesNotMatch(editorPage, />\s*Copy link\s*<\/button>/);
    assert.doesNotMatch(editorPage, /Replace issue/);
    assert.doesNotMatch(editorPage, /Move earlier/);
    assert.doesNotMatch(editorPage, /Move later/);
    assert.doesNotMatch(editorPage, /editor-panel--project-actions/);
    assert.doesNotMatch(editorPage, /editor-panel--photos/);
    assert.doesNotMatch(editorPage, /editor-panel--content-work/);
    assert.doesNotMatch(editorPage, /<h3>Fields<\/h3>/);
    assert.doesNotMatch(editorPage, /Small label above the main headline\./);
    assert.doesNotMatch(editorPage, /Clear all/);
    assert.doesNotMatch(editorPage, /Clear .* unused/);
    assert.doesNotMatch(editorPage, /editor-project-url/);
    assert.doesNotMatch(editorPage, /editor-icon-button/);
    assert.doesNotMatch(editorPage, /editor-crop-workbench/);
    assert.doesNotMatch(editorPage, /Arrow keys nudge/);
    assert.doesNotMatch(editorPage, /editor-sidebar editor-sidebar--content/);
    assert.doesNotMatch(editorPage, /editor-sidebar editor-sidebar--operations/);
    assert.doesNotMatch(editorPage, /Project not available\./);
    assert.doesNotMatch(editorPage, /Sign in to reopen this folio\./);
    assert.doesNotMatch(styles, /\.editor-stage__meta/);
    assert.doesNotMatch(editorPage, /editor-stage__meta/);
    assert.match(preview, /calculateImageRenderGeometry/);
    assert.match(preview, /resolveAssetIntrinsicSize/);
    assert.match(preview, /useLayoutEffect/);
    assert.match(preview, /const hasKicker = templateUsesKicker\(page\.template\) && Boolean\(page\.kicker\.trim\(\)\);/);
    assert.match(preview, /const hasDeck = templateUsesDeck\(page\.template\) && Boolean\(page\.deck\.trim\(\)\);/);
    assert.match(preview, /const hasBody = templateUsesBody\(page\.template(?:, page\.customTemplate)?\) && Boolean\(page\.body\.trim\(\)\);/);
    assert.match(preview, /const hasTriptychAside = hasDeck \|\| hasBody \|\| hasCaption;/);
    assert.doesNotMatch(preview, /<span>\{page\.kicker\}<\/span>/);
    assert.match(preview, /onPointerDown=\{startCropInteraction\}/);
    assert.match(preview, /onKeyDown=\{handleKeyDown\}/);
    assert.match(preview, /draggable=\{false\}/);
    assert.match(preview, /Drag to move the photo naturally\. Arrow keys nudge\. Use the wheel or \+\/- to zoom\./);
    assert.match(preview, /pixelOffsetToCropValue/);
    assert.match(preview, /nudgeCropByPixels/);
    assert.match(preview, /onCropMetricsChange/);
    assert.match(preview, /key=\{`\$\{page\.id\}:\$\{slot\}`\}/);
    assert.match(preview, /page\.template === 'panorama'/);
    assert.match(preview, /page\.template === 'mosaic'/);
    assert.match(preview, /page\.template === 'triptych'/);
    assert.match(preview, /magazine-mosaic__band--compact/);
    assert.match(preview, /magazine-triptych__footer--compact/);
    assert.match(preview, /magazine-triptych__deck/);
    assert.match(preview, /magazine-triptych__aside/);
    assert.match(defaults, /folio/);
    assert.match(defaults, /panorama/);
    assert.match(defaults, /triptych/);
    assert.match(defaults, /butter-cream/);
    assert.match(defaults, /sea-glass/);
    assert.match(defaults, /sandstone/);
    assert.match(defaults, /Sand stone/);
    assert.match(defaults, /pearl-blush/);
    assert.match(defaults, /sage-mist/);
    assert.match(defaults, /export function templateUsesKicker/);
    assert.match(defaults, /export function templateUsesDeck/);
    assert.match(defaults, /export function templateUsesBody/);
    assert.match(defaults, /frameRadius/);
    assert.match(geometry, /export function calculateImageRenderGeometry/);
    assert.match(geometry, /export function cropValueToPixelOffset/);
    assert.match(geometry, /export function pixelOffsetToCropValue/);
    assert.match(api, /assetMeta/);
    assert.match(api, /fetchAuthCaptcha/);
    assert.match(api, /captchaAnswer/);
    assert.match(api, /fetchAdminSummary/);
    assert.match(api, /recordExportEvent/);
    assert.match(authPage, /function openRoute\(path: string\)/);
    assert.match(adminUseAdminShellState, /function openRoute\(path: string\)/);
    assert.match(imageOptimization, /PreparedUploadItem/);
    assert.match(imageOptimization, /readImageIntrinsicSize/);
    assert.match(serverApp, /normalizeAssetDimensions/);
    assert.match(serverApp, /request\.body\?\.assetMeta/);
    assert.match(serverApp, /\/api\/auth\/captcha/);
    assert.match(serverApp, /Retry-After/);
    assert.match(serverApp, /verifyCaptcha/);
    assert.match(serverApp, /consumeRateLimit/);
    assert.match(serverApp, /\/api\/auth\/register/);
    assert.match(serverApp, /\/api\/auth\/bootstrap-status/);
    assert.match(serverApp, /\/api\/admin\/summary/);
    assert.match(serverApp, /\/api\/exports/);
    assert.match(security, /issueCaptcha/);
    assert.match(security, /consumeRateLimit/);
    assert.match(security, /Captcha answer is incorrect\./);
    assert.match(readme, /uploads:manage/);
    assert.match(manageUploads, /Dry run only\./);
    assert.match(distIndex, /FinalFolio/);
  });

  console.log('validate:mvp passed');
  results.forEach((label) => {
    console.log(`- ${label}`);
  });
} finally {
  if (validationServer) {
    await new Promise((resolve, reject) => {
      validationServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
  await fs.rm(tempDir, { recursive: true, force: true });
}
