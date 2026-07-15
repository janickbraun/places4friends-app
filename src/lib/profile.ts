import { decode } from 'base64-arraybuffer';
import type { ImagePickerAsset } from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import {
  buildActivityCountMap,
  formatTimestamp,
  getAvatarUrl,
  getInitials,
  getUserColor,
} from '@/lib/format';
import type { FeedActivity, FeedFriend } from '@/lib/activities';

/**
 * Upload a cropped avatar to the public `avatars` bucket and point the user's
 * profile at it. Each upload uses a UNIQUE filename (`${userId}/avatar-<ts>.jpg`)
 * and the old file is removed afterwards. A fixed path overwritten in place kept
 * the public URL byte-identical across changes, so any consumer that renders the
 * URL without a cache-buster — notably the map markers ([map.ts](src/lib/map.ts))
 * — showed the cached old picture forever. A fresh path guarantees a new URL on
 * every change, which invalidates image caches everywhere without re-downloading
 * on each fetch the way a `?t=Date.now()` query param would.
 */
export async function uploadAvatar(userId: string, asset: ImagePickerAsset): Promise<void> {
  if (!asset.base64) throw new Error('Kein Bild ausgewählt.');

  // Remember the current file so we can delete it after the swap succeeds.
  const { data: existing } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', userId)
    .maybeSingle();
  const previousPath = existing?.avatar_url ?? null;

  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, decode(asset.base64), { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: path })
    .eq('id', userId);
  if (updateError) throw updateError;

  // Best-effort cleanup of the previous storage object so old avatars don't pile
  // up. Skip external URLs (e.g. a Google OAuth avatar) — those aren't ours to
  // delete. A cleanup failure must not fail the update.
  if (previousPath && previousPath !== path && !/^https?:\/\//.test(previousPath)) {
    await supabase.storage.from('avatars').remove([previousPath]);
  }
}

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
  place_address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_superlike: boolean;
  description: string | null;
  created_at: string;
  categories: string[];
  image_urls: string[] | null;
  map_snapshot_url: string | null;
};

const ACTIVITY_COLUMNS =
  'id, user_id, place_name, place_address, latitude, longitude, is_superlike, description, created_at, categories, image_urls, map_snapshot_url';

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
    address: r.place_address ?? null,
    latitude: r.latitude,
    longitude: r.longitude,
    isMustSee: r.is_superlike,
    description: r.description ?? '',
    categories: Array.isArray(r.categories) ? r.categories : [],
    imageUrls: Array.isArray(r.image_urls) ? r.image_urls : [],
    mapSnapshotUrl: r.map_snapshot_url ?? null,
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
  // Order by when the user saved each item — newest save first — not by the
  // underlying post's date.
  const { data: wl } = await supabase
    .from('wishlist')
    .select('activity_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  const orderedIds = (wl ?? []).map((w) => w.activity_id);
  if (orderedIds.length === 0) return [];

  const { data } = await supabase.from('activities').select(ACTIVITY_COLUMNS).in('id', orderedIds);
  const rows = data ?? [];

  // `.in()` returns rows in arbitrary order; restore the saved-date order above.
  const rank = new Map(orderedIds.map((id, i) => [id, i] as const));
  rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));

  const ownerIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', ownerIds);
  const map = new Map<string, ProfileRow>();
  for (const p of profiles ?? []) map.set(p.id, p);

  return decorate(rows, (uid) => profileToFriend(map.get(uid) ?? null, uid));
}

export interface PublicFriendship {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted';
}

export interface PublicProfileData {
  profile: ProfileInfo;
  friendsCount: number;
  friendship: PublicFriendship | null;
  places: FeedActivity[];
  wishlistedIds: string[];
}

/**
 * Load a public profile: its info, accepted-friend count, the viewer's
 * relationship to it, and (only when befriended) its recommendations — matching
 * the web PublicProfileView privacy gate. RLS returns no activities for
 * non-friends anyway, so gating the fetch is purely an optimisation.
 */
export async function fetchPublicProfile(
  profileId: string,
  currentUserId: string,
): Promise<PublicProfileData | null> {
  const profile = await fetchProfileInfo(profileId);
  if (!profile) return null;

  const [countRes, friendshipRes, wishlistRes] = await Promise.all([
    supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .or(`sender_id.eq.${profileId},receiver_id.eq.${profileId}`)
      .eq('status', 'accepted'),
    supabase
      .from('friendships')
      .select('id, sender_id, receiver_id, status')
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${profileId}),and(sender_id.eq.${profileId},receiver_id.eq.${currentUserId})`,
      )
      .limit(1),
    supabase.from('wishlist').select('activity_id').eq('user_id', currentUserId),
  ]);

  const rel = friendshipRes.data?.[0];
  const friendship: PublicFriendship | null = rel
    ? {
        id: rel.id,
        senderId: rel.sender_id,
        receiverId: rel.receiver_id,
        status: rel.status as 'pending' | 'accepted',
      }
    : null;

  const places = friendship?.status === 'accepted' ? await fetchUserActivities(profileId) : [];

  return {
    profile,
    friendsCount: countRes.count ?? 0,
    friendship,
    places,
    wishlistedIds: (wishlistRes.data ?? []).map((w) => w.activity_id),
  };
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
