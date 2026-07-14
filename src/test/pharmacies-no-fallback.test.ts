import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

/**
 * Regression tests: the app must NEVER manufacture pharmacy guard-duty rotations
 * from the general directory. If `pharmacies_guard` has no official rows for a given
 * date + municipality, `usePharmaciesOnDuty` must return an empty array, and no
 * synthetic identifiers (`fallback-*`) or `source_ref: 'fallback-rotation'` values
 * may appear anywhere.
 */

type Row = Record<string, unknown>;

// Mock the supabase client BEFORE importing the hook.
const guardRows: Row[] = [];
const directoryRows: Row[] = [
  { id: 'dir-1', name: 'Farmacia Uno', address: 'C/ Real 1', municipality: 'Málaga', phone: null, lat: null, lng: null },
  { id: 'dir-2', name: 'Farmacia Dos', address: 'C/ Real 2', municipality: 'Málaga', phone: null, lat: null, lng: null },
  { id: 'dir-3', name: 'Farmacia Tres', address: 'C/ Real 3', municipality: 'Málaga', phone: null, lat: null, lng: null },
];

vi.mock('@/integrations/supabase/client', () => {
  const buildQuery = (rows: Row[]) => {
    const chain: any = {
      _rows: rows,
      select: () => chain,
      eq: () => chain,
      lte: () => chain,
      gte: () => chain,
      order: () => chain,
      range: async () => ({ data: chain._rows, error: null }),
      then: (resolve: (v: { data: Row[]; error: null }) => void) =>
        resolve({ data: chain._rows, error: null }),
    };
    return chain;
  };

  return {
    supabase: {
      from: (table: string) => {
        if (table === 'pharmacies_guard') return buildQuery(guardRows);
        if (table === 'pharmacies_directory') return buildQuery(directoryRows);
        return buildQuery([]);
      },
    },
  };
});

import { usePharmaciesOnDuty } from '@/hooks/usePharmacies';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('usePharmaciesOnDuty — no synthetic rotations', () => {
  beforeEach(() => {
    guardRows.length = 0; // empty official duty data
  });

  it('returns an empty list when there are no official rows for that date + municipality', async () => {
    const { result } = renderHook(
      () => usePharmaciesOnDuty(new Date('2026-07-14T12:00:00Z'), 'Málaga'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data).toHaveLength(0);
  });

  it('never generates fallback ids or source_ref="fallback-rotation" from the directory', async () => {
    const { result } = renderHook(
      () => usePharmaciesOnDuty(new Date('2026-07-14T12:00:00Z'), 'Málaga'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = (result.current.data ?? []) as unknown as Array<Record<string, unknown>>;
    for (const row of data) {
      expect(String(row.id ?? '')).not.toMatch(/^fallback-/);
      expect(row.source_ref).not.toBe('fallback-rotation');
      expect((row as any).__fallback).toBeFalsy();
    }
  });
});
