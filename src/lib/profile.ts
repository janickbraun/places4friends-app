import { supabase } from '@/lib/supabase';
import {
  buildActivityCountMap,
  formatTimestamp,
  getAvatarUrl,
  getInitials,
  getUserColor,
} from '@/lib/format';
import type { FeedActivity, FeedFriend } from '@/lib/activities';

export interface ProfileInfo {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface ProfileStats {
  recommendations: number;
  friends: number;
  saves: number;
}

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type ActivityRow = {
  id: string;
  user_id: string;
  place_name: string;
  latitude: number | null;
  longitude: number | null;
  is_superlike: boolean;
  description: string | null;
  created_at: string;
  categories: string[];
  image_urls: string[] | null;
};

const ACTIVITY_COLUMNS =
  'id, user_id, place_name, latitude, longitude, is_superlike, description, created_at, categories, image_urls';

function profileToFriend(profile: ProfileRow | null, userId: string): FeedFriend {
  const name = profile?.full_name ?? profile?.username ?? 'Nutzer';
  return {
    id: userId,
    name,
    username: profile?.username ?? '',
    initials: getInitials(name),
    color: getUserColor(userId),
    avatarUrl: getAvatarUrl(profile?.avatar_url, true),
  };
}

async function decorate(
  rows: ActivityRow[],
  friendFor: (userId: string) => FeedFriend,
): Promise<FeedActivity[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [{ data: comments }, { data: saves }] = await Promise.all([
    supabase.from('activity_comments').select('activity_id').in('activity_id', ids),
    supabase.from('wishlist').select('activity_id').in('activity_id', ids),
  ]);
  const commentMap = buildActivityCountMap(comments ?? []);
  const saveMap = buildActivityCountMap(saves ?? []);
  return rows.map((r) => ({
    id: r.id,
    placeName: r.place_name,
    latitude: r.latitude,
    longitude: r.longitude,
    isMustSee: r.is_superlike,
    description: r.description ?? '',
    categories: Array.isArray(r.categories) ? r.categories : [],
    imageUrls: Array.isArray(r.image_urls) ? r.image_urls : [],
    timestamp: formatTimestamp(r.created_at),
    commentCount: commentMap[r.id] ?? 0,
    saveCount: saveMap[r.id] ?? 0,
    friend: friendFor(r.user_id),
  }));
}

export async function fetchProfileInfo(userId: string): Promise<ProfileInfo | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .eq('id', userId)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    username: data.username,
    fullName: data.full_name,
    avatarUrl: getAvatarUrl(data.avatar_url, true),
  };
}

export async function fetchProfileStats(userId: string): Promise<ProfileStats> {
  const [rec, fr, sv] = await Promise.all([
    supabase.from('activities').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq('status', 'accepted'),
    supabase.from('wishlist').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  return {
    recommendations: rec.count ?? 0,
    friends: fr.count ?? 0,
    saves: sv.count ?? 0,
  };
}

export async function fetchUserActivities(userId: string): Promise<FeedActivity[]> {
  const { data } = await supabase
    .from('activities')
    .select(ACTIVITY_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .eq('id', userId)
    .single();
  const friend = profileToFriend(profile, userId);
  return decorate(data ?? [], () => friend);
}

export async function fetchWishlistActivities(userId: string): Promise<FeedActivity[]> {
  const { data: wl } = await supabase
    .from('wishlist')
    .select('activity_id')
    .eq('user_id', userId);
  const activityIds = (wl ?? []).map((w) => w.activity_id);
  if (activityIds.length === 0) return [];

  const { data } = await supabase
    .from('activities')
    .select(ACTIVITY_COLUMNS)
    .in('id', activityIds)
    .order('created_at', { ascending: false });
  const rows = data ?? [];

  const ownerIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', ownerIds);
  const map = new Map<string, ProfileRow>();
  for (const p of profiles ?? []) map.set(p.id, p);

  return decorate(rows, (uid) => profileToFriend(map.get(uid) ?? null, uid));
}

function extractActivityImagePath(url: string): string | null {
  const marker = '/activity-images/';
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

/** Delete an own recommendation + best-effort cleanup of its uploaded images. */
export async function deleteActivity(activityId: string, imageUrls: string[]) {
  const paths = imageUrls
    .map(extractActivityImagePath)
    .filter((p): p is string => p !== null);
  if (paths.length > 0) {
    await supabase.storage.from('activity-images').remove(paths);
  }
  return supabase.from('activities').delete().eq('id', activityId);
}
