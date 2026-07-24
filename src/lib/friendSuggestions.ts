import { supabase } from '@/lib/supabase';
import { getAvatarUrl } from '@/lib/format';

/**
 * People to suggest in the Freunde tab, from two sources:
 *
 * - **`mutual`** — friends of your friends, ranked by how many friends you share.
 * - **`contact`** — address-book matches (see `contacts.ts`; only hashes are sent).
 *
 * Both come from `SECURITY DEFINER` RPCs that resolve the friendship graph
 * server-side. They already exclude yourself, anyone you have a friendship or
 * pending request with in either direction, blocked users and banned accounts —
 * so the client does no filtering of its own, the same way RLS-scoped reads
 * elsewhere in the app do.
 */

export type SuggestionSource = 'mutual' | 'contact';

export interface FriendSuggestion {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  mutualCount: number;
  source: SuggestionSource;
}

interface SuggestionRow {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  mutual_count: number;
}

function mapRow(row: SuggestionRow, source: SuggestionSource): FriendSuggestion {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    avatarUrl: getAvatarUrl(row.avatar_url, true),
    mutualCount: row.mutual_count ?? 0,
    source,
  };
}

/** Friends-of-friends, most mutual friends first. Empty for a user with no friends yet. */
export async function fetchFriendSuggestions(limit = 20): Promise<FriendSuggestion[]> {
  const { data, error } = await supabase.rpc('get_friend_suggestions', { p_limit: limit });
  if (error || !data) return [];
  return (data as SuggestionRow[]).map((row) => mapRow(row, 'mutual'));
}

/**
 * Registered users among the given hashed contact e-mails. Never called with
 * raw addresses — `contacts.ts` hashes on-device and chunks the batches, since
 * the RPC rejects more than `CONTACT_HASH_BATCH_SIZE` per call.
 */
export async function matchContacts(emailHashes: string[]): Promise<FriendSuggestion[]> {
  if (emailHashes.length === 0) return [];
  const { data, error } = await supabase.rpc('find_contacts_on_p4f', {
    p_email_hashes: emailHashes,
  });
  if (error || !data) return [];
  return (data as SuggestionRow[]).map((row) => mapRow(row, 'contact'));
}

/** Server-side cap in `find_contacts_on_p4f`; batches must not exceed it. */
export const CONTACT_HASH_BATCH_SIZE = 1000;

/**
 * Concatenate two suggestion lists, dropping duplicates — entries in `primary`
 * win. Used to put contact matches (the stronger signal) above friends-of-
 * friends, and to keep already-requested rows on screen across a refresh.
 */
export function mergeSuggestions(
  primary: FriendSuggestion[],
  secondary: FriendSuggestion[],
): FriendSuggestion[] {
  const seen = new Set(primary.map((s) => s.id));
  return [...primary, ...secondary.filter((s) => !seen.has(s.id))];
}
