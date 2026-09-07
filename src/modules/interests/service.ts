/**
 * Account-level persistence for "Mis gustos" (owner-only row in
 * `public.user_interest_preferences`, protected by RLS).
 */

import { supabase } from '@/integrations/supabase/client';
import { sanitizeInterestIds, INTEREST_CATALOG_VERSION } from './catalog';

export interface RemoteInterests {
  exists: boolean;
  interestIds: string[];
}

export const fetchRemoteInterests = async (userId: string): Promise<RemoteInterests> => {
  const { data, error } = await supabase
    .from('user_interest_preferences')
    .select('interest_ids')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { exists: false, interestIds: [] };
  return { exists: true, interestIds: sanitizeInterestIds(data.interest_ids) };
};

export const saveRemoteInterests = async (
  userId: string,
  interestIds: string[],
): Promise<string[]> => {
  const clean = sanitizeInterestIds(interestIds);
  const { error } = await supabase.from('user_interest_preferences').upsert(
    {
      user_id: userId,
      interest_ids: clean,
      catalog_version: INTEREST_CATALOG_VERSION,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
  return clean;
};

export interface InsertOutcome {
  /** False when a row already existed: the account copy wins, nothing overwritten. */
  inserted: boolean;
  interestIds: string[];
}

/**
 * Insert-if-absent, used only by the explicit guest → account import.
 * If another device created the row between the initial load and the import,
 * the existing row is returned untouched.
 */
export const insertRemoteInterestsIfAbsent = async (
  userId: string,
  interestIds: string[],
): Promise<InsertOutcome> => {
  const clean = sanitizeInterestIds(interestIds);
  const { error } = await supabase.from('user_interest_preferences').insert({
    user_id: userId,
    interest_ids: clean,
    catalog_version: INTEREST_CATALOG_VERSION,
  });

  if (!error) return { inserted: true, interestIds: clean };
  // 23505 = unique violation on the primary key: a row appeared meanwhile.
  if (error.code !== '23505') throw error;

  const existing = await fetchRemoteInterests(userId);
  return { inserted: false, interestIds: existing.interestIds };
};
