import { promises as fs } from 'node:fs';
import { createAuthStore } from '../../server/auth.js';

const dataRoot = process.env.FINALFOLIO_DATA_ROOT;
if (!dataRoot) {
  throw new Error('FINALFOLIO_DATA_ROOT is required for Playwright setup.');
}

await fs.rm(dataRoot, { recursive: true, force: true });
const authStore = createAuthStore({ dataRoot });
await authStore.ensureAuthDirectories();
await authStore.createUser(
  {
    email: 'e2e-user@example.com',
    password: 'Password123!',
    username: 'e2euser',
  },
  {
    role: 'user',
    markEmailVerified: true,
    acceptCurrentTerms: true,
    termsAcceptedLanguage: 'en',
  },
);
await authStore.createUser(
  {
    email: 'e2e-admin@example.com',
    password: 'Password123!',
    username: 'e2eadmin',
  },
  {
    role: 'admin',
    markEmailVerified: true,
    acceptCurrentTerms: true,
    termsAcceptedLanguage: 'en',
  },
);
console.log(`Seeded Playwright data root at ${dataRoot}`);
