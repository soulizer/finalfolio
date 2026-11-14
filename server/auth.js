import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { CURRENT_TOS_VERSION, hasAcceptedCurrentTerms, normalizeTermsLanguage } from './legal.js';
import { findReservedUsernameMatch, normalizeUsername } from './usernames.js';

const USER_ID_BYTES = 9;
const SESSION_ID_BYTES = 24;
const ACTION_TOKEN_BYTES = 24;
const USER_STATUS_VALUES = new Set(['active', 'disabled']);
const USER_ROLE_VALUES = new Set(['admin', 'user']);
const ACTION_TOKEN_TYPES = new Set(['verification', 'password-reset']);
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const VERIFICATION_TOKEN_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const ACTIVITY_TOUCH_INTERVAL_MS = 60 * 1000;
function createId(bytes) {
  return crypto.randomBytes(bytes).toString('base64url').replace(/[-_]/g, '').toLowerCase();
}

function createBadRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function createUnauthorized(message = 'Authentication required.') {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
}

function createForbidden(message = 'Forbidden.') {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}

function createNotFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function normalizeEmail(email) {
  if (typeof email !== 'string') {
    throw createBadRequest('Email is required.');
  }

  const nextEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail) || nextEmail.length > 160) {
    throw createBadRequest('Email is invalid.');
  }

  return nextEmail;
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 160) {
    throw createBadRequest('Password must be 8-160 characters.');
  }

  return password;
}

function sanitizeUserStatus(status) {
  if (!USER_STATUS_VALUES.has(status)) {
    throw createBadRequest('User status is invalid.');
  }

  return status;
}

function sanitizeUserRole(role) {
  if (!USER_ROLE_VALUES.has(role)) {
    throw createBadRequest('User role is invalid.');
  }

  return role;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return {
    passwordSalt: salt,
    passwordHash: crypto.scryptSync(password, salt, 64).toString('hex'),
  };
}

function verifyPassword(password, passwordHash, passwordSalt) {
  const candidate = Buffer.from(crypto.scryptSync(password, passwordSalt, 64).toString('hex'), 'hex');
  const stored = Buffer.from(passwordHash, 'hex');
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}

function sanitizeUserRecord(record) {
  if (!record || typeof record !== 'object') {
    throw createBadRequest('User record is invalid.');
  }

  const normalizedEmail = normalizeEmail(record.email);
  const status = sanitizeUserStatus(record.status);
  const role = USER_ROLE_VALUES.has(record.role) ? record.role : 'user';

  if (
    typeof record.id !== 'string' ||
    typeof record.passwordHash !== 'string' ||
    typeof record.passwordSalt !== 'string' ||
    typeof record.createdAt !== 'string' ||
    typeof record.updatedAt !== 'string'
  ) {
    throw createBadRequest('User record is invalid.');
  }

  return {
    id: record.id,
    email: normalizedEmail,
    username: normalizeUsername(record.username, { allowEmpty: true }),
    passwordHash: record.passwordHash,
    passwordSalt: record.passwordSalt,
    role,
    status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastActiveAt: typeof record.lastActiveAt === 'string' ? record.lastActiveAt : null,
    emailVerifiedAt: typeof record.emailVerifiedAt === 'string' ? record.emailVerifiedAt : null,
    verificationSentAt: typeof record.verificationSentAt === 'string' ? record.verificationSentAt : null,
    passwordResetRequestedAt: typeof record.passwordResetRequestedAt === 'string' ? record.passwordResetRequestedAt : null,
    termsAcceptedAt: typeof record.termsAcceptedAt === 'string' ? record.termsAcceptedAt : null,
    termsAcceptedVersion: typeof record.termsAcceptedVersion === 'string' ? record.termsAcceptedVersion : null,
    termsAcceptedLanguage: typeof record.termsAcceptedLanguage === 'string' ? normalizeTermsLanguage(record.termsAcceptedLanguage) : null,
  };
}

function serializeUserRecord(record) {
  return {
    id: record.id,
    email: record.email,
    username: record.username,
    role: record.role,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastActiveAt: record.lastActiveAt,
    emailVerifiedAt: record.emailVerifiedAt,
    verificationSentAt: record.verificationSentAt,
    passwordResetRequestedAt: record.passwordResetRequestedAt,
    termsAcceptedAt: record.termsAcceptedAt,
    termsAcceptedVersion: record.termsAcceptedVersion,
    termsAcceptedLanguage: record.termsAcceptedLanguage,
    needsTermsAcceptance: !hasAcceptedCurrentTerms(record),
  };
}

function sanitizeSessionRecord(record) {
  if (
    !record ||
    typeof record !== 'object' ||
    typeof record.id !== 'string' ||
    typeof record.userId !== 'string' ||
    typeof record.createdAt !== 'string' ||
    typeof record.updatedAt !== 'string' ||
    typeof record.expiresAt !== 'string'
  ) {
    throw createBadRequest('Session record is invalid.');
  }

  return {
    id: record.id,
    userId: record.userId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    expiresAt: record.expiresAt,
  };
}

function sanitizeActionTokenRecord(record) {
  if (
    !record ||
    typeof record !== 'object' ||
    typeof record.id !== 'string' ||
    typeof record.userId !== 'string' ||
    typeof record.type !== 'string' ||
    typeof record.createdAt !== 'string' ||
    typeof record.expiresAt !== 'string'
  ) {
    throw createBadRequest('Token record is invalid.');
  }

  if (!ACTION_TOKEN_TYPES.has(record.type)) {
    throw createBadRequest('Token record is invalid.');
  }

  return {
    id: record.id,
    userId: record.userId,
    type: record.type,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    consumedAt: typeof record.consumedAt === 'string' ? record.consumedAt : null,
  };
}

export function createAuthStore({
  dataRoot,
  now = () => new Date().toISOString(),
} = {}) {
  const usersDir = path.join(dataRoot, 'users');
  const sessionsDir = path.join(dataRoot, 'sessions');
  const tokensDir = path.join(dataRoot, 'tokens');
  const recordQueues = new Map();

  function userPath(userId) {
    return path.join(usersDir, `${userId}.json`);
  }

  function sessionPath(sessionId) {
    return path.join(sessionsDir, `${sessionId}.json`);
  }

  function tokenPath(tokenId) {
    return path.join(tokensDir, `${tokenId}.json`);
  }

  async function ensureAuthDirectories() {
    await fs.mkdir(usersDir, { recursive: true });
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.mkdir(tokensDir, { recursive: true });
  }

  async function writeJsonRecord(filename, record) {
    const tempFile = `${filename}.${process.pid}.${createId(6)}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(record, null, 2), 'utf8');
    await fs.rename(tempFile, filename);
  }

  async function queueRecordTask(recordKey, task) {
    const previousTask = recordQueues.get(recordKey) ?? Promise.resolve();
    const nextTask = previousTask.catch(() => undefined).then(task);
    recordQueues.set(recordKey, nextTask);

    try {
      return await nextTask;
    } finally {
      if (recordQueues.get(recordKey) === nextTask) {
        recordQueues.delete(recordKey);
      }
    }
  }

  async function listUsers() {
    await ensureAuthDirectories();
    const entries = await fs.readdir(usersDir, { withFileTypes: true });
    const users = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map(async (entry) => {
          const payload = JSON.parse(await fs.readFile(path.join(usersDir, entry.name), 'utf8'));
          return sanitizeUserRecord(payload);
        }),
    );

    return users.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async function readUser(userId) {
    try {
      const payload = JSON.parse(await fs.readFile(userPath(userId), 'utf8'));
      return sanitizeUserRecord(payload);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw createNotFound('User not found.');
      }

      throw error;
    }
  }

  async function findUserByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    const users = await listUsers();
    return users.find((user) => user.email === normalizedEmail) ?? null;
  }

  async function findUserByUsername(username) {
    const normalizedUsername = normalizeUsername(username, { allowEmpty: false });
    const users = await listUsers();
    return users.find((user) => user.username === normalizedUsername) ?? null;
  }

  async function updateUser(userId, updater) {
    return await queueRecordTask(userPath(userId), async () => {
      const currentUser = await readUser(userId);
      const nextPatch = await updater(currentUser);
      if (!nextPatch || typeof nextPatch !== 'object' || Object.keys(nextPatch).length === 0) {
        return currentUser;
      }

      const nextUser = sanitizeUserRecord({
        ...currentUser,
        ...nextPatch,
        updatedAt: now(),
      });

      await writeJsonRecord(userPath(userId), nextUser);
      return nextUser;
    });
  }

  async function updateSession(sessionId, updater) {
    return await queueRecordTask(sessionPath(sessionId), async () => {
      const currentSession = await readSession(sessionId);
      const nextPatch = await updater(currentSession);
      if (!nextPatch || typeof nextPatch !== 'object' || Object.keys(nextPatch).length === 0) {
        return currentSession;
      }

      const nextSession = sanitizeSessionRecord({
        ...currentSession,
        ...nextPatch,
      });
      await writeJsonRecord(sessionPath(sessionId), nextSession);
      return nextSession;
    });
  }

  async function createUser({ email, password, username }, options = {}) {
    const normalizedEmail = normalizeEmail(email);
    const nextPassword = validatePassword(password);
    const nextUsername = normalizeUsername(username ?? options.username, { allowEmpty: options.requireUsername !== true });
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw createBadRequest('Email is already registered.');
    }

    if (nextUsername) {
      if (findReservedUsernameMatch(nextUsername)) {
        throw createBadRequest('This username is reserved. Choose another one.');
      }

      const existingUsernameUser = await findUserByUsername(nextUsername);
      if (existingUsernameUser) {
        throw createBadRequest('Username is already taken.');
      }
    }

    const users = await listUsers();
    const timestamp = now();
    const role = options.role ? sanitizeUserRole(options.role) : users.length === 0 ? 'admin' : 'user';
    const status = options.status ? sanitizeUserStatus(options.status) : 'active';
    const emailVerifiedAt = options.markEmailVerified ? timestamp : null;
    const acceptedTermsLanguage = options.acceptCurrentTerms ? normalizeTermsLanguage(options.termsAcceptedLanguage) : null;
    const record = {
      id: `user-${createId(USER_ID_BYTES)}`,
      email: normalizedEmail,
      username: nextUsername,
      ...hashPassword(nextPassword),
      role,
      status,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastActiveAt: null,
      emailVerifiedAt,
      verificationSentAt: null,
      passwordResetRequestedAt: null,
      termsAcceptedAt: options.acceptCurrentTerms ? timestamp : null,
      termsAcceptedVersion: options.acceptCurrentTerms ? CURRENT_TOS_VERSION : null,
      termsAcceptedLanguage: acceptedTermsLanguage,
    };

    await writeJsonRecord(userPath(record.id), record);
    return sanitizeUserRecord(record);
  }

  async function createManagedUser({ email, password, role = 'user', username }) {
    return await createUser(
      {
        email,
        password,
      },
      {
        role,
        username,
        status: 'active',
        markEmailVerified: true,
      },
    );
  }

  async function authenticateUser({ identifier, email, password }) {
    const rawIdentifier =
      typeof identifier === 'string' && identifier.trim()
        ? identifier
        : typeof email === 'string' && email.trim()
          ? email
          : null;
    if (!rawIdentifier) {
      throw createBadRequest('Email or username is required.');
    }

    const nextPassword = validatePassword(password);
    const trimmedIdentifier = rawIdentifier.trim();
    let user = null;

    if (trimmedIdentifier.includes('@')) {
      try {
        user = await findUserByEmail(trimmedIdentifier);
      } catch {
        user = null;
      }
    } else {
      try {
        user = await findUserByUsername(trimmedIdentifier);
      } catch {
        user = null;
      }
    }

    if (!user || !verifyPassword(nextPassword, user.passwordHash, user.passwordSalt)) {
      throw createUnauthorized('Email, username, or password is incorrect.');
    }

    if (user.status !== 'active') {
      throw createForbidden('This account is disabled.');
    }

    if (!user.emailVerifiedAt) {
      throw createForbidden('Verify your email before signing in.');
    }

    return await updateUser(user.id, () => ({
      lastActiveAt: now(),
    }));
  }

  async function createSession(userId) {
    const user = await readUser(userId);
    if (user.status !== 'active') {
      throw createForbidden('This account is disabled.');
    }

    const timestamp = now();
    const session = {
      id: `session-${createId(SESSION_ID_BYTES)}`,
      userId: user.id,
      createdAt: timestamp,
      updatedAt: timestamp,
      expiresAt: new Date(Date.parse(timestamp) + SESSION_MAX_AGE_MS).toISOString(),
    };

    await writeJsonRecord(sessionPath(session.id), session);
    return sanitizeSessionRecord(session);
  }

  async function readSession(sessionId) {
    try {
      const payload = JSON.parse(await fs.readFile(sessionPath(sessionId), 'utf8'));
      const session = sanitizeSessionRecord(payload);
      if (Date.parse(session.expiresAt) <= Date.now()) {
        await fs.rm(sessionPath(session.id), { force: true });
        throw createUnauthorized('Session expired.');
      }

      return session;
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw createUnauthorized('Session not found.');
      }

      throw error;
    }
  }

  async function deleteSession(sessionId) {
    if (!sessionId) {
      return;
    }

    await fs.rm(sessionPath(sessionId), { force: true });
  }

  async function deleteSessionsForUser(userId) {
    await ensureAuthDirectories();
    const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map(async (entry) => {
          const session = sanitizeSessionRecord(JSON.parse(await fs.readFile(path.join(sessionsDir, entry.name), 'utf8')));
          if (session.userId === userId) {
            await fs.rm(path.join(sessionsDir, entry.name), { force: true });
          }
        }),
    );
  }

  async function deleteUser(userId) {
    await deleteSessionsForUser(userId);
    await fs.rm(userPath(userId), { force: true });
    await ensureAuthDirectories();
    const entries = await fs.readdir(tokensDir, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map(async (entry) => {
          const token = sanitizeActionTokenRecord(JSON.parse(await fs.readFile(path.join(tokensDir, entry.name), 'utf8')));
          if (token.userId === userId) {
            await fs.rm(path.join(tokensDir, entry.name), { force: true });
          }
        }),
    );
  }

  async function resolveSessionUser(sessionId) {
    if (!sessionId) {
      return null;
    }

    const session = await readSession(sessionId);
    const user = await readUser(session.userId);
    return {
      session,
      user,
    };
  }

  async function touchSessionUser(sessionId, userId) {
    const thresholdMs = Date.now() - ACTIVITY_TOUCH_INTERVAL_MS;
    const timestamp = now();

    await Promise.all([
      updateUser(userId, (currentUser) => {
        const lastActiveMs = currentUser.lastActiveAt ? Date.parse(currentUser.lastActiveAt) : 0;
        if (Number.isFinite(lastActiveMs) && lastActiveMs >= thresholdMs) {
          return null;
        }

        return {
          lastActiveAt: timestamp,
        };
      }),
      updateSession(sessionId, (currentSession) => {
        const updatedAtMs = Date.parse(currentSession.updatedAt);
        if (Number.isFinite(updatedAtMs) && updatedAtMs >= thresholdMs) {
          return null;
        }

        return {
          updatedAt: timestamp,
        };
      }),
    ]);
  }

  async function updateUserStatus(userId, status) {
    const nextStatus = sanitizeUserStatus(status);
    return await updateUser(userId, () => ({
      status: nextStatus,
    }));
  }

  async function updateUserProfile(userId, { username } = {}) {
    const nextUsername = normalizeUsername(username, { allowEmpty: true });
    if (nextUsername) {
      if (findReservedUsernameMatch(nextUsername)) {
        throw createBadRequest('This username is reserved. Choose another one.');
      }

      const existingUser = await findUserByUsername(nextUsername);
      if (existingUser && existingUser.id !== userId) {
        throw createBadRequest('Username is already taken.');
      }
    }

    return await updateUser(userId, () => ({
      username: nextUsername,
    }));
  }

  async function acceptTerms(userId, { language } = {}) {
    const acceptedLanguage = normalizeTermsLanguage(language);
    return await updateUser(userId, () => ({
      termsAcceptedAt: now(),
      termsAcceptedVersion: CURRENT_TOS_VERSION,
      termsAcceptedLanguage: acceptedLanguage,
    }));
  }

  async function changePassword(userId, currentPassword, nextPassword) {
    const safeCurrentPassword = validatePassword(currentPassword);
    const safeNextPassword = validatePassword(nextPassword);
    const user = await readUser(userId);

    if (!verifyPassword(safeCurrentPassword, user.passwordHash, user.passwordSalt)) {
      throw createUnauthorized('Current password is incorrect.');
    }

    const updatedUser = await updateUser(userId, () => ({
      ...hashPassword(safeNextPassword),
      passwordResetRequestedAt: null,
    }));
    await deleteSessionsForUser(userId);
    return updatedUser;
  }

  async function createActionToken(userId, type) {
    if (!ACTION_TOKEN_TYPES.has(type)) {
      throw createBadRequest('Token type is invalid.');
    }

    const user = await readUser(userId);
    const timestamp = now();
    const token = {
      id: `token-${createId(ACTION_TOKEN_BYTES)}`,
      userId: user.id,
      type,
      createdAt: timestamp,
      expiresAt: new Date(
        Date.parse(timestamp) + (type === 'verification' ? VERIFICATION_TOKEN_MAX_AGE_MS : PASSWORD_RESET_TOKEN_MAX_AGE_MS),
      ).toISOString(),
      consumedAt: null,
    };

    await writeJsonRecord(tokenPath(token.id), token);
    return sanitizeActionTokenRecord(token);
  }

  async function readActionToken(tokenId) {
    try {
      const payload = JSON.parse(await fs.readFile(tokenPath(tokenId), 'utf8'));
      return sanitizeActionTokenRecord(payload);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw createUnauthorized('Token not found.');
      }

      throw error;
    }
  }

  async function consumeActionToken(tokenId, expectedType) {
    const token = await readActionToken(tokenId);
    if (token.type !== expectedType) {
      throw createBadRequest('Token type does not match this action.');
    }

    if (token.consumedAt) {
      throw createUnauthorized('Token already used.');
    }

    if (Date.parse(token.expiresAt) <= Date.now()) {
      throw createUnauthorized('Token expired.');
    }

    const consumedRecord = {
      ...token,
      consumedAt: now(),
    };
    await writeJsonRecord(tokenPath(token.id), consumedRecord);
    return consumedRecord;
  }

  async function issueVerificationToken(userId) {
    const token = await createActionToken(userId, 'verification');
    await updateUser(userId, () => ({
      verificationSentAt: now(),
    }));
    return token;
  }

  async function issuePasswordResetToken(email) {
    const user = await findUserByEmail(email);
    if (!user) {
      return null;
    }

    const token = await createActionToken(user.id, 'password-reset');
    await updateUser(user.id, () => ({
      passwordResetRequestedAt: now(),
    }));
    return {
      token,
      user,
    };
  }

  async function verifyUserWithToken(tokenId) {
    const token = await consumeActionToken(tokenId, 'verification');
    const user = await updateUser(token.userId, () => ({
      emailVerifiedAt: now(),
    }));
    return user;
  }

  async function resetPasswordWithToken(tokenId, password) {
    const nextPassword = validatePassword(password);
    const token = await consumeActionToken(tokenId, 'password-reset');
    const user = await updateUser(token.userId, () => ({
      ...hashPassword(nextPassword),
      passwordResetRequestedAt: null,
    }));
    await deleteSessionsForUser(user.id);
    return user;
  }

  return {
    usersDir,
    sessionsDir,
    tokensDir,
    ensureAuthDirectories,
    listUsers,
    readUser,
    findUserByEmail,
    findUserByUsername,
    createUser,
    createManagedUser,
    authenticateUser,
    createSession,
    readSession,
    deleteSession,
    deleteSessionsForUser,
    deleteUser,
    resolveSessionUser,
    touchSessionUser,
    updateUserStatus,
    updateUserProfile,
    acceptTerms,
    changePassword,
    issueVerificationToken,
    issuePasswordResetToken,
    verifyUserWithToken,
    resetPasswordWithToken,
    serializeUserRecord,
  };
}
