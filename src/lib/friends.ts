import { supabase } from '@/lib/supabase';
import { notifyPush } from '@/lib/notifications';
import { getAvatarUrl } from '@/lib/format';
import { SITE_URL } from '@/lib/site';

export interface FriendProfile {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  friendshipId: string;
}

export interface SearchProfile {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface RawFriendship {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted';
}

export interface FriendshipsData {
  friends: FriendProfile[];
  incoming: FriendProfile[];
  outgoing: FriendProfile[];
  raw: RawFriendship[];
}

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export async function fetchFriendships(userId: string): Promise<FriendshipsData> {
  const friends: FriendProfile[] = [];
  const incoming: FriendProfile[] = [];
  const outgoing: FriendProfile[] = [];
  const raw: RawFriendship[] = [];

  const { data, error } = await supabase
    .from('friendships')
    .select(
      `id, sender_id, receiver_id, status,
       sender:profiles!friendships_sender_id_fkey(id, username, full_name, avatar_url),
       receiver:profiles!friendships_receiver_id_fkey(id, username, full_name, avatar_url)`,
    )
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

  if (error || !data) return { friends, incoming, outgoing, raw };

  type Row = {
    id: string;
    sender_id: string;
    receiver_id: string;
    status: 'pending' | 'accepted';
    sender: ProfileRow | null;
    receiver: ProfileRow | null;
  };

  for (const row of data as unknown as Row[]) {
    raw.push({
      id: row.id,
      senderId: row.sender_id,
      receiverId: row.receiver_id,
      status: row.status,
    });
    const other = row.sender_id === userId ? row.receiver : row.sender;
    if (!other) continue;
    const entry: FriendProfile = {
      id: other.id,
      username: other.username,
      fullName: other.full_name,
      avatarUrl: getAvatarUrl(other.avatar_url, true),
      friendshipId: row.id,
    };
    if (row.status === 'accepted') friends.push(entry);
    else if (row.receiver_id === userId) incoming.push(entry);
    else outgoing.push(entry);
  }

  return { friends, incoming, outgoing, raw };
}

export async function searchProfiles(query: string, userId: string): Promise<SearchProfile[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length > 100) return [];
  const q = `%${trimmed}%`;
  const { data } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .or(`username.ilike.${q},full_name.ilike.${q}`)
    .neq('id', userId)
    .limit(15);
  return (data ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    fullName: p.full_name,
    avatarUrl: getAvatarUrl(p.avatar_url, true),
  }));
}

export async function sendFriendRequest(userId: string, targetId: string) {
  const result = await supabase
    .from('friendships')
    .insert({ sender_id: userId, receiver_id: targetId, status: 'pending' });
  if (!result.error) void notifyPush({ event: 'friend_request', targetUserId: targetId });
  return result;
}

export async function acceptFriendRequest(friendshipId: string) {
  const result = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId);
  if (!result.error) void notifyPush({ event: 'friend_accept', friendshipId });
  return result;
}

export function deleteFriendship(friendshipId: string) {
  return supabase.from('friendships').delete().eq('id', friendshipId);
}

const INVITE_MAX_USES = 10;
const INVITE_VALIDITY_DAYS = 30;

/**
 * Create a friend invite link (RLS allows the creator to insert).
 *
 * The link points at `/invite/<token>` rather than the profile URL because that
 * is the only path the app claims as a universal / app link — claiming
 * `/profile/*` would also swallow the web app's `/profile/settings` and
 * `/profile/friends` pages. Both the app and the website resolve the token to
 * the creator's profile from there. Links issued in the older
 * `/profile/<id>?invite=<token>` shape keep working on both.
 */
export async function createFriendInviteLink(userId: string): Promise<string> {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}`;
  const expiresAt = new Date(Date.now() + INVITE_VALIDITY_DAYS * 86400000).toISOString();
  const { error } = await supabase.from('friend_invite_links').insert({
    creator_id: userId,
    token,
    max_uses: INVITE_MAX_USES,
    expires_at: expiresAt,
  });
  if (error) throw error;
  return `${SITE_URL}/invite/${token}`;
}

export type InviteValidationError = 'not_found' | 'expired' | 'max_uses';

export interface InviteValidation {
  valid: boolean;
  creatorId: string | null;
  error: InviteValidationError | null;
}

/** Validate an invite token (read-only; does not consume a use). */
export async function validateInviteLink(token: string): Promise<InviteValidation> {
  const { data, error } = await supabase.rpc('validate_friend_invite_link', { p_token: token });
  if (error || !data) return { valid: false, creatorId: null, error: 'not_found' };
  const r = data as { valid?: boolean; creator_id?: string; error?: string };
  return {
    valid: !!r.valid,
    creatorId: r.creator_id ?? null,
    error: (r.error as InviteValidationError) ?? null,
  };
}

export type RedeemError = InviteValidationError | 'mismatch' | 'self' | 'failed';

export interface RedeemResult {
  success: boolean;
  error?: RedeemError;
}

/**
 * Redeem an invite: validate the token, create/accept the friendship with the
 * link creator, and consume one use — all atomically server-side via the
 * `accept_friend_invite` SECURITY DEFINER RPC. The friendships write policies
 * intentionally forbid a client from inserting/self-accepting an `accepted` row
 * (so nobody can unilaterally friend a stranger); the token-gated RPC is the only
 * sanctioned path that creates the accepted friendship on the caller's behalf.
 */
export async function redeemInviteLink(params: {
  token: string;
  profileId: string;
  currentUserId: string;
}): Promise<RedeemResult> {
  const { token, profileId, currentUserId } = params;
  if (profileId === currentUserId) return { success: false, error: 'self' };

  const { data, error } = await supabase.rpc('accept_friend_invite', { p_token: token });
  if (error || !data) return { success: false, error: 'failed' };

  const r = data as { ok?: boolean; error?: string; creator_id?: string };
  if (!r.ok) {
    const e = r.error;
    if (e === 'not_found' || e === 'expired' || e === 'max_uses' || e === 'self') {
      return { success: false, error: e };
    }
    return { success: false, error: 'failed' };
  }
  // Guard against a token that belongs to a different profile than the one opened.
  if (r.creator_id && r.creator_id !== profileId) return { success: false, error: 'mismatch' };

  // Notify the link creator that someone joined via their invite.
  void notifyPush({ event: 'friend_accept', targetUserId: r.creator_id ?? profileId });

  return { success: true };
}
