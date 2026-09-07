import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  ensureLoaded,
  getState,
  guestIdentity,
  refreshGuestFromStorage,
  subscribe,
  userIdentity,
  save as storeSave,
  reset as storeReset,
  acceptImport as storeAcceptImport,
  dismissImport as storeDismissImport,
  type SaveStatus,
} from './store';

export type { SaveStatus };

export interface UseInterestsResult {
  interests: string[];
  isLoading: boolean;
  /** True while the user has no account: preferences live on this device only. */
  isGuest: boolean;
  status: SaveStatus;
  /** Guest selection found while signed in with no saved row yet. */
  pendingImport: string[] | null;
  /** The account copy could not be read or written: do not claim it is synced. */
  remoteFailed: boolean;
  /** Device storage refused the write (private mode, quota…). */
  storageBlocked: boolean;
  /** The import was refused because the account already had a saved selection. */
  importConflict: boolean;
  save: (ids: string[]) => Promise<boolean>;
  reset: () => Promise<boolean>;
  acceptImport: () => Promise<boolean>;
  dismissImport: () => void;
}

/**
 * Single source of truth for the user's interests, shared by every consumer
 * mounted at the same time (see `store.ts`).
 */
export function useInterests(): UseInterestsResult {
  const { user, isLoading: authLoading } = useAuthContext();
  const userId = user?.id ?? null;
  const identity = userId ? userIdentity(userId) : guestIdentity();

  const state = useSyncExternalStore(
    subscribe,
    () => getState(identity),
    () => getState(identity),
  );

  useEffect(() => {
    if (authLoading) return;
    ensureLoaded(identity);
  }, [identity, authLoading]);

  // Another tab edited the device-only selection.
  useEffect(() => {
    if (userId) return;
    const onStorage = () => refreshGuestFromStorage();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [userId]);

  const save = useCallback((ids: string[]) => storeSave(identity, ids), [identity]);
  const reset = useCallback(() => storeReset(identity), [identity]);
  const acceptImport = useCallback(() => storeAcceptImport(identity), [identity]);
  const dismissImport = useCallback(() => storeDismissImport(identity), [identity]);

  return {
    interests: state.interests,
    isLoading: authLoading || state.isLoading,
    isGuest: !userId,
    status: state.status,
    pendingImport: state.pendingImport,
    remoteFailed: state.remoteFailed,
    storageBlocked: state.storageBlocked,
    importConflict: state.importConflict,
    save,
    reset,
    acceptImport,
    dismissImport,
  };
}
