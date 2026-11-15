import { expect, test } from '@playwright/test';

const CREDENTIALS = { identifier: 'e2e-user@example.com', password: 'Password123!' };

async function signInCookie(request: import('@playwright/test').APIRequestContext) {
  const response = await request.post('/api/auth/login', { data: CREDENTIALS });
  expect(response.ok()).toBeTruthy();
  const setCookie = response.headersArray().filter((header) => header.name.toLowerCase() === 'set-cookie');
  const session = setCookie.map((header) => header.value.match(/finalfolio_session=[^;]+/)?.[0]).find(Boolean);
  expect(session).toBeTruthy();
  return session as string;
}

test('login attempts are throttled per identifier', async ({ request }) => {
  const identifier = `throttle-${Date.now()}@example.com`;
  const limit = Number(process.env.FINALFOLIO_LOGIN_IDENTIFIER_LIMIT ?? 10);
  const statuses: number[] = [];
  for (let attempt = 0; attempt < limit + 2; attempt += 1) {
    const response = await request.post('/api/auth/login', {
      data: { identifier, password: `wrong-password-${attempt}` },
    });
    statuses.push(response.status());
  }

  expect(statuses.at(-1)).toBe(429);
  expect(statuses).toContain(429);
});

test('stale project revisions are rejected instead of overwriting another tab', async ({ request }) => {
  const cookie = await signInCookie(request);
  const created = await request.post('/api/projects', {
    headers: { cookie },
    data: {
      project: {
        title: 'Conflict folio',
        subtitle: '',
        issue: 'Conflict 1',
        frameRadius: 18,
        assets: [],
        pages: [
          {
            id: 'conflict-cover',
            template: 'cover',
            theme: 'warm-beige',
            kicker: '',
            title: 'Conflict cover',
            deck: '',
            body: '',
            caption: '',
            slots: { hero: null },
            crops: { hero: { x: 50, y: 50, scale: 1, fit: 'cover' } },
            customTemplate: null,
          },
        ],
      },
    },
  });
  expect(created.status()).toBe(201);
  const record = await created.json();

  const conflict = await request.put(`/api/projects/${record.id}`, {
    headers: { cookie },
    data: { project: record.project, expectedRev: (record.rev ?? 0) + 99 },
  });
  expect(conflict.status()).toBe(409);
  expect((await conflict.json()).code).toBe('revision_conflict');

  const accepted = await request.put(`/api/projects/${record.id}`, {
    headers: { cookie },
    data: { project: record.project, expectedRev: record.rev ?? 0 },
  });
  expect(accepted.status()).toBe(200);
});

test('uploads reject non-image bytes and never disclose the data path', async ({ request }) => {
  const cookie = await signInCookie(request);
  const upload = await request.post('/api/uploads', {
    headers: { cookie },
    multipart: {
      files: { name: 'fake.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('definitely not an image') },
      assetMeta: '[{}]',
    },
  });
  expect(upload.status()).toBe(400);
  expect((await upload.json()).error).toMatch(/not a readable/i);

  const missing = await request.get('/uploads/does-not-exist.jpg');
  expect(missing.status()).toBe(404);
  const body = await missing.text();
  expect(body).not.toContain('/data/');
  expect(body).not.toContain('ENOENT');
});

test('unknown API routes return JSON and project ids cannot traverse the data directory', async ({ request }) => {
  const unknown = await request.get('/api/definitely-not-a-route');
  expect(unknown.status()).toBe(404);
  expect(unknown.headers()['content-type']).toContain('application/json');

  const cookie = await signInCookie(request);
  const traversal = await request.post('/api/projects/..%2Fusers%2Fanything/duplicate', { headers: { cookie } });
  expect(traversal.status()).toBe(400);
  expect((await traversal.json()).error).toMatch(/invalid project identifier/i);
});

test('deleting a folio removes photos no other folio references', async ({ request }) => {
  const cookie = await signInCookie(request);
  const fixture = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const upload = await request.post('/api/uploads', {
    headers: { cookie },
    multipart: {
      files: { name: 'cleanup.png', mimeType: 'image/png', buffer: fixture },
      assetMeta: '[{}]',
    },
  });
  expect(upload.status()).toBe(201);
  const asset = (await upload.json()).assets[0];

  const created = await request.post('/api/projects', {
    headers: { cookie },
    data: {
      project: {
        title: 'Cleanup folio',
        subtitle: '',
        issue: 'Cleanup 1',
        frameRadius: 18,
        assets: [asset],
        pages: [
          {
            id: 'cleanup-cover',
            template: 'cover',
            theme: 'warm-beige',
            kicker: '',
            title: 'Cleanup cover',
            deck: '',
            body: '',
            caption: '',
            slots: { hero: asset.id },
            crops: { hero: { x: 50, y: 50, scale: 1, fit: 'cover' } },
            customTemplate: null,
          },
        ],
      },
    },
  });
  expect(created.status()).toBe(201);
  const project = await created.json();

  expect((await request.delete(`/api/projects/${project.id}`, { headers: { cookie } })).status()).toBe(204);

  const uploads = await request.get('/api/account/uploads', { headers: { cookie } });
  const remaining = (await uploads.json()).uploads as Array<{ assetId: string }>;
  expect(remaining.some((entry) => entry.assetId === asset.id)).toBeFalsy();
});

test('url imports reject private, loopback, and non-http targets', async ({ request, playwright }) => {
  const cookie = await signInCookie(request);

  const blockedTargets = [
    'http://127.0.0.1/icon.png',
    'http://localhost/icon.png',
    'http://10.0.0.5/icon.png',
    'http://192.168.1.2/icon.png',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/icon.png',
    'file:///etc/passwd',
    'data:image/png;base64,AAAA',
  ];

  for (const url of blockedTargets) {
    const response = await request.post('/api/uploads/from-url', {
      headers: { cookie },
      data: { url },
    });
    expect(response.status(), url).toBe(400);
  }

  const empty = await request.post('/api/uploads/from-url', {
    headers: { cookie },
    data: { url: '   ' },
  });
  expect(empty.status()).toBe(400);

  // A fresh context has no session cookie, so the endpoint must refuse anonymous callers.
  const anonymousContext = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const anonymous = await anonymousContext.post('/api/uploads/from-url', {
    data: { url: 'https://example.com/photo.jpg' },
  });
  expect(anonymous.status()).toBe(401);
  await anonymousContext.dispose();
});
