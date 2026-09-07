/**
 * Device-local persistence for "Mis gustos".
 *
 * Versioned schema, per-identity keys (guest vs each signed-in uid) so a
 * session change can never leak one account's preferences into another, and
 * total tolerance for blocked / corrupt storage (private mode, quota, garbage).
 */

import { sanitizeInterestIds, INTEREST_CATALOG_VERSION } from './catalog';

const PREFIX = 'mc.interests';

export const guestStorageKey = () => `${PREFIX}.v${INTEREST_CATALOG_VERSION}.guest`;
export const userStorageKey = (userId: string) =>
  `${PREFIX}.v${INTEREST_CATALOG_VERSION}.user.${userId}`;

interface StoredPayload {
  version: number;
  interestIds: string[];
  updatedAt: string;
}

const safeStorage = (): Storage | null => {
  try {
    const s = window.localStorage;
    const probe = `${PREFIX}.probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
};

export const readInterests = (key: string): string[] => {
  const store = safeStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredPayload>;
    if (!parsed || typeof parsed !== 'object') return [];
    if (parsed.version !== INTEREST_CATALOG_VERSION) return [];
    return sanitizeInterestIds(parsed.interestIds);
  } catch {
    // Corrupt entry: drop it instead of throwing on every render.
    try {
      store.removeItem(key);
    } catch {
      /* ignore */
    }
    return [];
  }
};

export const writeInterests = (key: string, interestIds: string[]): boolean => {
  const store = safeStorage();
  if (!store) return false;
  const payload: StoredPayload = {
    version: INTEREST_CATALOG_VERSION,
    interestIds: sanitizeInterestIds(interestIds),
    updatedAt: new Date().toISOString(),
  };
  try {
    store.setItem(key, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
};

/** Returns false when the device refused the delete: never claim a fake success. */
export const clearInterests = (key: string): boolean => {
  const store = safeStorage();
  if (!store) return false;
  try {
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

export const hasStoredInterests = (key: string): boolean => readInterests(key).length > 0;
