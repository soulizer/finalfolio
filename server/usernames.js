const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{1,38}[a-z0-9])?$/;

const RESERVED_USERNAME_TERMS = [
  // System and administrative identities
  'admin',
  'administrator',
  'root',
  'superadmin',
  'superuser',
  'sysadmin',
  'system',
  'operator',
  'ops',
  'webmaster',
  'hostmaster',
  'postmaster',
  'daemon',
  'service',
  'server',
  'console',
  'shell',
  'ssh',
  'ftp',
  'sudo',
  'master',
  'owneradmin',
  'siteadmin',
  'control',
  'controller',
  // Official identities and staff roles
  'official',
  'officialteam',
  'staff',
  'team',
  'support',
  'help',
  'helpdesk',
  'customer',
  'customerservice',
  'servicecenter',
  'mod',
  'moderator',
  'owner',
  'founder',
  'ceo',
  'cto',
  'coo',
  'office',
  'maintainer',
  'manager',
  'management',
  'security',
  'securityteam',
  'abuse',
  'report',
  'reviewer',
  'audit',
  'auditor',
  'compliance',
  'legal',
  'finance',
  'billing',
  'payment',
  'payments',
  'cashier',
  'hr',
  'recruiter',
  'operation',
  'operations',
  'concierge',
  // Product routes and built-in system pages
  'api',
  'www',
  'web',
  'app',
  'mobile',
  'dev',
  'test',
  'qa',
  'uat',
  'beta',
  'alpha',
  'demo',
  'stage',
  'staging',
  'prod',
  'production',
  'static',
  'assets',
  'asset',
  'public',
  'private',
  'cdn',
  'img',
  'image',
  'images',
  'file',
  'files',
  'upload',
  'uploads',
  'download',
  'downloads',
  'media',
  'mail',
  'email',
  'smtp',
  'imap',
  'pop',
  'mx',
  'dns',
  'localhost',
  'local',
  'login',
  'logout',
  'signup',
  'signin',
  'register',
  'registration',
  'auth',
  'oauth',
  'sso',
  'session',
  'sessions',
  'callback',
  'webhook',
  'account',
  'accounts',
  'user',
  'users',
  'member',
  'members',
  'profile',
  'settings',
  'config',
  'dashboard',
  'home',
  'index',
  'panel',
  'search',
  'explore',
  'discover',
  'feed',
  'timeline',
  'tag',
  'tags',
  'category',
  'categories',
  'post',
  'posts',
  'article',
  'articles',
  'page',
  'pages',
  'message',
  'messages',
  'inbox',
  'outbox',
  'notification',
  'notifications',
  'notice',
  'notices',
  'status',
  'health',
  'metrics',
  'project',
  'projects',
  'editor',
  'photos',
  // Roles and trust-signaling identities
  'guest',
  'anonymous',
  'anon',
  'vip',
  'svip',
  'premium',
  'plus',
  'pro',
  'professional',
  'verified',
  'verifier',
  'author',
  'contributor',
  'publisher',
  'creator',
  'creatorcenter',
  'partner',
  'ambassador',
  'affiliate',
  'sponsor',
  'agent',
  'bot',
  'robot',
  'ai',
  'assistant',
  'certified',
  'trusted',
  'trust',
  'expert',
  'advisor',
  'mentor',
  'teacher',
  'coach',
  'host',
  'seller',
  'vendor',
  'merchant',
  'adminuser',
  // Security, recovery, and notification flows
  'verify',
  'verification',
  'password',
  'passwd',
  'pwd',
  'reset',
  'passwordreset',
  'recovery',
  'recover',
  'unlock',
  'secure',
  'safe',
  'safety',
  'notify',
  'noreply',
  'donotreply',
  'mailer',
  'mailrobot',
  'sender',
  'verifycode',
  'otp',
  'code',
  'token',
  'secret',
  'secrets',
  'key',
  'keys',
  'alert',
  'alerts',
  'warning',
  'incident',
  'incidents',
  'risk',
  'antifraud',
  'fraud',
  // Brand-specific reservations
  'finalfolio',
  'finalfolios',
  'finalfolioapp',
  'finalfolioofficial',
  'finalfolioadmin',
  'finalfoliosupport',
  'finalfolioteam',
  'openeditor',
  'openaccount',
  // High-risk external brands and institutions
  'google',
  'apple',
  'microsoft',
  'github',
  'gitlab',
  'telegram',
  'discord',
  'paypal',
  'stripe',
  'visa',
  'mastercard',
  'bank',
  'government',
  'court',
  'tax',
  'facebook',
  'instagram',
  'youtube',
  'amazon',
  'aws',
  'cloudflare',
];

const LOOKALIKE_CHARACTER_MAP = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '5': 's',
  '@': 'a',
};

function normalizeReservationInput(value) {
  return value.normalize('NFKC').trim().toLowerCase();
}

function stripUsernameSeparators(value) {
  return value.replace(/[\s._-]+/g, '');
}

function replaceLookalikeCharacters(value) {
  return value.replace(/[0135@]/g, (character) => LOOKALIKE_CHARACTER_MAP[character] ?? character);
}

function removeTrailingDigits(value) {
  return value.replace(/\d+$/g, '');
}

function buildReservationCandidates(value) {
  const collapsedValue = stripUsernameSeparators(normalizeReservationInput(value));
  const lookalikeValue = replaceLookalikeCharacters(collapsedValue);

  return Array.from(
    new Set([collapsedValue, removeTrailingDigits(collapsedValue), lookalikeValue, removeTrailingDigits(lookalikeValue)].filter(Boolean)),
  );
}

const RESERVED_USERNAME_CANONICALS = new Set(RESERVED_USERNAME_TERMS.flatMap((term) => buildReservationCandidates(term)));

export function normalizeUsername(username, { allowEmpty = true } = {}) {
  if (username === null || username === undefined || username === '') {
    if (allowEmpty) {
      return null;
    }

    throw createBadRequest('Username is required.');
  }

  if (typeof username !== 'string') {
    throw createBadRequest('Username is invalid.');
  }

  const nextUsername = normalizeReservationInput(username);
  if (!USERNAME_PATTERN.test(nextUsername)) {
    throw createBadRequest('Username must be 3-40 characters using letters, numbers, hyphen, or underscore.');
  }

  return nextUsername;
}

export function findReservedUsernameMatch(username) {
  const normalizedUsername = normalizeUsername(username, { allowEmpty: false });
  return buildReservationCandidates(normalizedUsername).find((candidate) => RESERVED_USERNAME_CANONICALS.has(candidate)) ?? null;
}

function createBadRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}
