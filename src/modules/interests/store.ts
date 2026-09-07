/**
 * Shared, per-identity state for "Mis gustos".
 *
 * Every mounted consumer (Home recommendations, the picker, the profile card)
 * reads the same slot, so a successful save in one of them is visible in the
 * others on the next render — no page reload.
 *
 * Two rules make the async lifecycle safe:
 *  - state is keyed by identity (`guest` or `user:<uid>`), so a request started
 *    for account A can never write into the view of account B;
 *  - each slot keeps a load ticket and a write counter, so a stale initial
 *    fetch that resolves after a newer save is discarded instead of
 *    resurrecting the previous selection.
 */

import { sanitizeInterestIds } from './catalog';
import {
  guestStorageKey,
  userStorageKey,
  readInterests,
  writeInterests,
  clearInterests,
} from './storage';
import {
  fetchRemoteInterests,
  saveRemoteInterests,
  insertRemoteInterestsIfAbsent,
} from './service';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface InterestsState {
  interests: string[];
  isLoading: boolean;
  status: SaveStatus;
  /** Guest selection offered for an account that has no row yet. */
  pendingImport: string[] | null;
  /** Device storage refused the last write (private mode, quota…). */
  storageBlocked: boolean;
  /** True once a remote read or write failed for this identity. */
  remoteFailed: boolean;
  /** Import could not be applied because the account already has a row. */
  importConflict: boolean;
}

interface Slot {
  state: InterestsState;
  /** Increments on every load attempt; only the newest may commit. */
  loadTicket: number;
  /** Increments on every committed write; invalidates in-flight loads. */
  writeSeq: number;
  /** Increments on every save attempt; only the newest may commit. */
  saveTicket: number;
  started: boolean;
}

export type Identity = string;

export const guestIdentity = (): Identity => 'guest';
export const userIdentity = (userId: string): Identity => `user:${userId}`;
const userIdOf = (identity: Identity): string | null =>
  identity.startsWith('user:') ? identity.slice(5) : null;
const storageKeyOf = (identity: Identity): string => {
  const uid = userIdOf(identity);
  return uid ? userStorageKey(uid) : guestStorageKey();
};

const initialState = (): InterestsState => ({
  interests: [],
  isLoading: true,
  status: 'idle',
  pendingImport: null,
  storageBlocked: false,
  remoteFailed: false,
  importConflict: false,
});

const slots = new Map<Identity, Slot>();
const listeners = new Set<() => void>();

const slotOf = (identity: Identity): Slot => {
  let slot = slots.get(identity);
  if (!slot) {
    slot = { state: initialState(), loadTicket: 0, writeSeq: 0, saveTicket: 0, started: false };
    slots.set(identity, slot);
  }
  return slot;
};

const emit = () => listeners.forEach((l) => l());

const patch = (identity: Identity, next: Partial<InterestsState>) => {
  const slot = slotOf(identity);
  slot.state = { ...slot.state, ...next };
  emit();
};

export const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getState = (identity: Identity): InterestsState => slotOf(identity).state;

/** Test helper: drop every cached slot. */
export const resetStoreForTests = () => {
  slots.clear();
  emit();
};

/**
 * Loads an identity once per app session. Re-entrant calls while a load is in
 * flight are ignored; `force` re-reads (used by cross-tab storage events).
 */
export const ensureLoaded = (identity: Identity, force = false): void => {
  const slot = slotOf(identity);
  if (slot.started && !force) return;
  slot.started = true;

  const ticket = ++slot.loadTicket;
  const writeSeqAtStart = slot.writeSeq;
  const uid = userIdOf(identity);

  const stillCurrent = () => {
    const s = slots.get(identity);
    return !!s && s.loadTicket === ticket && s.writeSeq === writeSeqAtStart;
  };

  if (!uid) {
    const local = readInterests(guestStorageKey());
    if (stillCurrent()) patch(identity, { interests: local, isLoading: false });
    return;
  }

  // Optimistic paint from this account's own device cache (never the guest one).
  const cached = readInterests(userStorageKey(uid));
  if (stillCurrent() && cached.length > 0) patch(identity, { interests: cached });
  else if (stillCurrent()) patch(identity, { isLoading: true });

  void (async () => {
    try {
      const remote = await fetchRemoteInterests(uid);
      if (!stillCurrent()) return;
      writeInterests(userStorageKey(uid), remote.interestIds);
      const guest = !remote.exists ? readInterests(guestStorageKey()) : [];
      patch(identity, {
        interests: remote.interestIds,
        isLoading: false,
        remoteFailed: false,
        pendingImport: guest.length > 0 ? guest : null,
      });
    } catch {
      if (!stillCurrent()) return;
      // Keep whatever this account had cached locally, but say plainly that the
      // account copy could not be read: never claim it is synced.
      patch(identity, { isLoading: false, status: 'error', remoteFailed: true });
    }
  })();
};

const commitLocal = (identity: Identity, ids: string[]): boolean => {
  const ok = writeInterests(storageKeyOf(identity), ids);
  const slot = slotOf(identity);
  if (ok) {
    slot.writeSeq += 1;
    patch(identity, {
      interests: ids,
      status: 'saved',
      storageBlocked: false,
      isLoading: false,
    });
  } else {
    // Failed commit: keep the previously persisted selection on screen.
    patch(identity, { status: 'error', storageBlocked: true, isLoading: false });
  }
  return ok;
};

export const save = async (identity: Identity, rawIds: string[]): Promise<boolean> => {
  const ids = sanitizeInterestIds(rawIds);
  const slot = slotOf(identity);
  const ticket = ++slot.saveTicket;
  patch(identity, { status: 'saving' });

  const uid = userIdOf(identity);
  if (!uid) return commitLocal(identity, ids);

  const isCurrent = () => {
    const s = slots.get(identity);
    return !!s && s.saveTicket === ticket;
  };

  try {
    const stored = await saveRemoteInterests(uid, ids);
    if (!isCurrent()) return true;
    slot.writeSeq += 1;
    const localOk = writeInterests(userStorageKey(uid), stored);
    patch(identity, {
      interests: stored,
      status: 'saved',
      isLoading: false,
      remoteFailed: false,
      pendingImport: null,
      importConflict: false,
      storageBlocked: !localOk,
    });
    return true;
  } catch {
    if (!isCurrent()) return false;
    patch(identity, { status: 'error', remoteFailed: true });
    return false;
  }
};

export const reset = async (identity: Identity): Promise<boolean> => {
  const uid = userIdOf(identity);
  if (uid) return save(identity, []);

  patch(identity, { status: 'saving' });
  const ok = clearInterests(guestStorageKey());
  const slot = slotOf(identity);
  if (!ok) {
    patch(identity, { status: 'error', storageBlocked: true });
    return false;
  }
  slot.writeSeq += 1;
  patch(identity, { interests: [], status: 'saved', storageBlocked: false });
  return true;
};

/**
 * Explicit guest → account import. Never overwrites a row created meanwhile on
 * another device: if one exists we reload it and report the conflict.
 */
export const acceptImport = async (identity: Identity): Promise<boolean> => {
  const slot = slotOf(identity);
  const ids = slot.state.pendingImport;
  const uid = userIdOf(identity);
  if (!ids || !uid) return false;

  const ticket = ++slot.saveTicket;
  patch(identity, { status: 'saving', importConflict: false });
  const isCurrent = () => {
    const s = slots.get(identity);
    return !!s && s.saveTicket === ticket;
  };

  try {
    const result = await insertRemoteInterestsIfAbsent(uid, sanitizeInterestIds(ids));
    if (!isCurrent()) return result.inserted;
    slot.writeSeq += 1;
    writeInterests(userStorageKey(uid), result.interestIds);
    patch(identity, {
      interests: result.interestIds,
      isLoading: false,
      pendingImport: null,
      remoteFailed: false,
      status: result.inserted ? 'saved' : 'idle',
      importConflict: !result.inserted,
    });
    return result.inserted;
  } catch {
    if (!isCurrent()) return false;
    patch(identity, { status: 'error', remoteFailed: true });
    return false;
  }
};

export const dismissImport = (identity: Identity): void => {
  patch(identity, { pendingImport: null, importConflict: false });
};

/** Another tab changed the guest selection. */
export const refreshGuestFromStorage = (): void => {
  const identity = guestIdentity();
  if (!slots.has(identity)) return;
  patch(identity, { interests: readInterests(guestStorageKey()), isLoading: false });
};
