import { supabase } from '@/lib/supabase';
import { getAvatarUrl } from '@/lib/format';

export interface BlockedUser {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

/**
 * Block a user. The `block_user` RPC (SECURITY DEFINER) removes any friendship/
 * request between the two in either direction and records the block atomically.
 * Once blocked, the other user can't find this user's profile or send requests,
 * and the two no longer see each other's comments under mutual friends' posts
 * (enforced by RLS).
 */
export function blockUser(targetId: string) {
  return supabase.rpc('block_user', { p_target: targetId });
}

export function unblockUser(targetId: string) {
  return supabase.rpc('unblock_user', { p_target: targetId });
}

/** The users the given user has blocked (newest first), for the settings list. */
export async function fetchBlockedUsers(userId: string): Promise<BlockedUser[]> {
  const { data, error } = await supabase
    .from('user_blocks')
    .select(
      'created_at, blocked:profiles!user_blocks_blocked_id_fkey(id, username, full_name, avatar_url)',
    )
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  type Row = {
    blocked: {
      id: string;
      username: string | null;
      full_name: string | null;
      avatar_url: string | null;
    } | null;
  };

  return (data as unknown as Row[])
    .map((r) => r.blocked)
    .filter((b): b is NonNullable<Row['blocked']> => !!b)
    .map((b) => ({
      id: b.id,
      username: b.username,
      fullName: b.full_name,
      avatarUrl: getAvatarUrl(b.avatar_url, true),
    }));
}
