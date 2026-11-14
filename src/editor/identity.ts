import { UserSession } from './api';

type UserIdentityLike = Pick<UserSession, 'email' | 'username'> | null | undefined;

function readUsername(user: UserIdentityLike) {
  const username = typeof user?.username === 'string' ? user.username.trim() : '';
  return username || null;
}

export function getUserPrimaryIdentity(user: UserIdentityLike, fallback = 'Unknown account') {
  const username = readUsername(user);
  if (username) {
    return username;
  }

  const email = typeof user?.email === 'string' ? user.email.trim() : '';
  return email || fallback;
}

export function getUserSecondaryIdentity(user: UserIdentityLike) {
  return readUsername(user) ? user?.email ?? null : null;
}

export function getUserIdentitySummary(user: UserIdentityLike, fallback = 'Unknown account') {
  const primary = getUserPrimaryIdentity(user, fallback);
  const secondary = getUserSecondaryIdentity(user);
  return secondary ? `${primary} · ${secondary}` : primary;
}
