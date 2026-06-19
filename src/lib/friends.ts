import { supabase } from '@/lib/supabase';
import { getAvatarUrl } from '@/lib/format';

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

export function sendFriendRequest(userId: string, targetId: string) {
  return supabase
    .from('friendships')
    .insert({ sender_id: userId, receiver_id: targetId, status: 'pending' });
}

export function acceptFriendRequest(friendshipId: string) {
  return supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
}

export function deleteFriendship(friendshipId: string) {
  return supabase.from('friendships').delete().eq('id', friendshipId);
}

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://places4friends.com';
const INVITE_MAX_USES = 10;
const INVITE_VALIDITY_DAYS = 30;

/** Create a friend invite link (RLS allows the creator to insert). */
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
  return `${SITE_URL}/profile/${userId}?invite=${token}`;
}
