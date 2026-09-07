/**
 * Async lifecycle of "Mis gustos": shared state between consumers, identity
 * switches, out-of-order promises and honest failure reporting.
 *
 * Uses deferred promises so every ordering is exercised deterministically.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { useEffect } from 'react';

vi.mock('./service', () => ({
  fetchRemoteInterests: vi.fn(),
  saveRemoteInterests: vi.fn(),
  insertRemoteInterestsIfAbsent: vi.fn(),
}));

let currentUserId: string | null = null;
vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({
    user: currentUserId ? { id: currentUserId } : null,
    isLoading: false,
    isAuthenticated: !!currentUserId,
  }),
}));

import * as service from './service';
import { useInterests } from './useInterests';
import { resetStoreForTests, guestIdentity, getState } from './store';
import { guestStorageKey, userStorageKey } from './storage';

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const Consumer = ({ label, onReady }: { label: string; onReady?: (api: ReturnType<typeof useInterests>) => void }) => {
  const api = useInterests();
  useEffect(() => {
    onReady?.(api);
  });
  return (
    <div>
      <span data-testid={`${label}-ids`}>{api.interests.join(',')}</span>
      <span data-testid={`${label}-status`}>{api.status}</span>
      <span data-testid={`${label}-remoteFailed`}>{String(api.remoteFailed)}</span>
      <span data-testid={`${label}-blocked`}>{String(api.storageBlocked)}</span>
      <span data-testid={`${label}-conflict`}>{String(api.importConflict)}</span>
      <span data-testid={`${label}-pending`}>{api.pendingImport?.join(',') ?? ''}</span>
    </div>
  );
};

describe('interests shared state and async lifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
    currentUserId = null;
    resetStoreForTests();
    vi.mocked(service.fetchRemoteInterests).mockReset();
    vi.mocked(service.saveRemoteInterests).mockReset();
    vi.mocked(service.insertRemoteInterestsIfAbsent).mockReset();
  });

  afterEach(() => {
    resetStoreForTests();
  });

  it('two mounted consumers see a guest save immediately', async () => {
    let apiA: ReturnType<typeof useInterests> | null = null;
    render(
      <>
        <Consumer label="a" onReady={(api) => (apiA = api)} />
        <Consumer label="b" />
      </>,
    );

    await act(async () => {
      await apiA!.save(['music', 'theatre']);
    });

    expect(screen.getByTestId('a-ids').textContent).toBe('music,theatre');
    expect(screen.getByTestId('b-ids').textContent).toBe('music,theatre');
    expect(screen.getByTestId('b-status').textContent).toBe('saved');
  });

  it('persists the guest selection across a remount (device reload)', async () => {
    let api: ReturnType<typeof useInterests> | null = null;
    const first = render(<Consumer label="a" onReady={(a) => (api = a)} />);
    await act(async () => {
      await api!.save(['cinema']);
    });
    first.unmount();
    resetStoreForTests(); // fresh app session, same device

    render(<Consumer label="c" />);
    await waitFor(() => expect(screen.getByTestId('c-ids').textContent).toBe('cinema'));
  });

  it('a late save from account A cannot change the view of account B', async () => {
    currentUserId = 'user-a';
    const fetchA = deferred<{ exists: boolean; interestIds: string[] }>();
    const saveA = deferred<string[]>();
    vi.mocked(service.fetchRemoteInterests).mockReturnValue(fetchA.promise);
    vi.mocked(service.saveRemoteInterests).mockReturnValue(saveA.promise);

    let api: ReturnType<typeof useInterests> | null = null;
    const view = render(<Consumer label="a" onReady={(a) => (api = a)} />);
    await act(async () => {
      fetchA.resolve({ exists: true, interestIds: ['music'] });
    });

    let savePromise: Promise<boolean>;
    act(() => {
      savePromise = api!.save(['flamenco']);
    });

    // Identity switches to B before A's save settles.
    currentUserId = 'user-b';
    const fetchB = deferred<{ exists: boolean; interestIds: string[] }>();
    vi.mocked(service.fetchRemoteInterests).mockReturnValue(fetchB.promise);
    view.rerender(<Consumer label="a" onReady={(a) => (api = a)} />);
    await act(async () => {
      fetchB.resolve({ exists: true, interestIds: ['basketball'] });
    });
    expect(screen.getByTestId('a-ids').textContent).toBe('basketball');

    await act(async () => {
      saveA.resolve(['flamenco']);
      await savePromise!;
    });

    // B still shows its own data; A's row was updated in its own slot.
    expect(screen.getByTestId('a-ids').textContent).toBe('basketball');
    expect(localStorage.getItem(userStorageKey('user-a'))).toContain('flamenco');
  });

  it('never shows the previous account data while the new identity loads', async () => {
    currentUserId = 'user-a';
    vi.mocked(service.fetchRemoteInterests).mockResolvedValue({ exists: true, interestIds: ['music'] });
    let api: ReturnType<typeof useInterests> | null = null;
    const view = render(<Consumer label="a" onReady={(a) => (api = a)} />);
    await waitFor(() => expect(screen.getByTestId('a-ids').textContent).toBe('music'));

    currentUserId = 'user-b';
    const fetchB = deferred<{ exists: boolean; interestIds: string[] }>();
    vi.mocked(service.fetchRemoteInterests).mockReturnValue(fetchB.promise);
    view.rerender(<Consumer label="a" onReady={(a) => (api = a)} />);

    // No flash of user A's ids on the very first render for B.
    expect(screen.getByTestId('a-ids').textContent).toBe('');
    await act(async () => {
      fetchB.resolve({ exists: false, interestIds: [] });
    });
    expect(screen.getByTestId('a-ids').textContent).toBe('');
  });

  it('an initial load resolving after a newer save does not overwrite it', async () => {
    currentUserId = 'user-a';
    const fetch = deferred<{ exists: boolean; interestIds: string[] }>();
    vi.mocked(service.fetchRemoteInterests).mockReturnValue(fetch.promise);
    vi.mocked(service.saveRemoteInterests).mockImplementation(async (_u, ids) => ids as string[]);

    let api: ReturnType<typeof useInterests> | null = null;
    render(<Consumer label="a" onReady={(a) => (api = a)} />);

    await act(async () => {
      await api!.save(['jazz']);
    });
    expect(screen.getByTestId('a-ids').textContent).toBe('jazz');

    await act(async () => {
      fetch.resolve({ exists: true, interestIds: ['music'] });
    });
    expect(screen.getByTestId('a-ids').textContent).toBe('jazz');
  });

  it('reports failure when device storage refuses the write, keeping the stored selection', async () => {
    let api: ReturnType<typeof useInterests> | null = null;
    render(<Consumer label="a" onReady={(a) => (api = a)} />);
    await act(async () => {
      await api!.save(['music']);
    });

    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    let ok = true;
    await act(async () => {
      ok = await api!.save(['cinema']);
    });
    expect(ok).toBe(false);
    expect(screen.getByTestId('a-status').textContent).toBe('error');
    expect(screen.getByTestId('a-blocked').textContent).toBe('true');
    expect(screen.getByTestId('a-ids').textContent).toBe('music');
    setItem.mockRestore();
  });

  it('reports failure when a guest reset cannot be persisted', async () => {
    let api: ReturnType<typeof useInterests> | null = null;
    render(<Consumer label="a" onReady={(a) => (api = a)} />);
    await act(async () => {
      await api!.save(['music']);
    });

    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    let ok = true;
    await act(async () => {
      ok = await api!.reset();
    });
    expect(ok).toBe(false);
    expect(screen.getByTestId('a-status').textContent).toBe('error');
    expect(screen.getByTestId('a-ids').textContent).toBe('music');
    removeItem.mockRestore();
  });

  it('a failed account read never claims the selection is synced', async () => {
    currentUserId = 'user-a';
    vi.mocked(service.fetchRemoteInterests).mockRejectedValue(new Error('network'));
    render(<Consumer label="a" />);
    await waitFor(() => expect(screen.getByTestId('a-remoteFailed').textContent).toBe('true'));
    expect(screen.getByTestId('a-status').textContent).toBe('error');
  });

  it('explicit import leaves an account row created meanwhile intact', async () => {
    localStorage.setItem(
      guestStorageKey(),
      JSON.stringify({ version: 1, interestIds: ['music'], updatedAt: new Date().toISOString() }),
    );
    currentUserId = 'user-a';
    vi.mocked(service.fetchRemoteInterests).mockResolvedValue({ exists: false, interestIds: [] });
    vi.mocked(service.insertRemoteInterestsIfAbsent).mockResolvedValue({
      inserted: false,
      interestIds: ['basketball'],
    });

    let api: ReturnType<typeof useInterests> | null = null;
    render(<Consumer label="a" onReady={(a) => (api = a)} />);
    await waitFor(() => expect(screen.getByTestId('a-pending').textContent).toBe('music'));

    let ok = true;
    await act(async () => {
      ok = await api!.acceptImport();
    });
    expect(ok).toBe(false);
    expect(screen.getByTestId('a-conflict').textContent).toBe('true');
    expect(screen.getByTestId('a-ids').textContent).toBe('basketball');
    expect(vi.mocked(service.saveRemoteInterests)).not.toHaveBeenCalled();
  });

  it('import is never implicit: nothing is written without accepting', async () => {
    localStorage.setItem(
      guestStorageKey(),
      JSON.stringify({ version: 1, interestIds: ['music'], updatedAt: new Date().toISOString() }),
    );
    currentUserId = 'user-a';
    vi.mocked(service.fetchRemoteInterests).mockResolvedValue({ exists: false, interestIds: [] });
    render(<Consumer label="a" />);
    await waitFor(() => expect(screen.getByTestId('a-pending').textContent).toBe('music'));
    expect(vi.mocked(service.insertRemoteInterestsIfAbsent)).not.toHaveBeenCalled();
    expect(vi.mocked(service.saveRemoteInterests)).not.toHaveBeenCalled();
    expect(getState(guestIdentity()).interests).toEqual([]);
  });
});
