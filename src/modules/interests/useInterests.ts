import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { sanitizeInterestIds } from './catalog';
import {
  guestStorageKey,
  userStorageKey,
  readInterests,
  writeInterests,
  clearInterests,
} from './storage';
import { fetchRemoteInterests, saveRemoteInterests } from './service';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseInterestsResult {
  interests: string[];
  isLoading: boolean;
  /** True while the user has no account: preferences live on this device only. */
  isGuest: boolean;
  status: SaveStatus;
  /** Guest selection found while signed in with no saved row yet. */
  pendingImport: string[] | null;
  save: (ids: string[]) => Promise<boolean>;
  reset: () => Promise<boolean>;
  acceptImport: () => Promise<boolean>;
  dismissImport: () => void;
  /** Device storage refused the write (private mode, quota…). */
  storageBlocked: boolean;
}

/**
 * Single source of truth for the user's interests.
 *
 * Guests persist on the device under a versioned key. Signed-in users read and
 * write their own row; the guest selection is never copied into an account that
 * already saved something, and importing it is always an explicit action.
 */
export function useInterests(): UseInterestsResult {
  const { user, isLoading: authLoading } = useAuthContext();
  const userId = user?.id ?? null;

  const [interests, setInterests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [pendingImport, setPendingImport] = useState<string[] | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const requestRef = useRef(0);

  // Reload whenever the identity changes. Each identity has its own cache key,
  // so signing out or switching account never shows the previous selection.
  useEffect(() => {
    if (authLoading) return;
    const token = ++requestRef.current;
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setStatus('idle');
      setPendingImport(null);

      if (!userId) {
        const local = readInterests(guestStorageKey());
        if (!cancelled && token === requestRef.current) {
          setInterests(local);
          setIsLoading(false);
        }
        return;
      }

      // Optimistic paint from this user's own device cache.
      const cached = readInterests(userStorageKey(userId));
      if (!cancelled && token === requestRef.current) setInterests(cached);

      try {
        const remote = await fetchRemoteInterests(userId);
        if (cancelled || token !== requestRef.current) return;
        setInterests(remote.interestIds);
        writeInterests(userStorageKey(userId), remote.interestIds);
        if (!remote.exists) {
          const guest = readInterests(guestStorageKey());
          if (guest.length > 0) setPendingImport(guest);
        }
      } catch {
        if (cancelled || token !== requestRef.current) return;
        setStatus('error');
      } finally {
        if (!cancelled && token === requestRef.current) setIsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [userId, authLoading]);

  const save = useCallback(
    async (ids: string[]): Promise<boolean> => {
      const clean = sanitizeInterestIds(ids);
      setStatus('saving');

      if (!userId) {
        const ok = writeInterests(guestStorageKey(), clean);
        setInterests(clean);
        setStorageBlocked(!ok);
        setStatus(ok ? 'saved' : 'error');
        return ok;
      }

      try {
        const stored = await saveRemoteInterests(userId, clean);
        setInterests(stored);
        writeInterests(userStorageKey(userId), stored);
        setStatus('saved');
        setPendingImport(null);
        return true;
      } catch {
        setStatus('error');
        return false;
      }
    },
    [userId],
  );

  const reset = useCallback(async () => {
    if (!userId) {
      clearInterests(guestStorageKey());
      setInterests([]);
      setStatus('saved');
      return true;
    }
    return save([]);
  }, [userId, save]);

  const acceptImport = useCallback(async () => {
    if (!pendingImport) return false;
    const ok = await save(pendingImport);
    if (ok) setPendingImport(null);
    return ok;
  }, [pendingImport, save]);

  const dismissImport = useCallback(() => setPendingImport(null), []);

  return {
    interests,
    isLoading: authLoading || isLoading,
    isGuest: !userId,
    status,
    pendingImport,
    save,
    reset,
    acceptImport,
    dismissImport,
    storageBlocked,
  };
}
