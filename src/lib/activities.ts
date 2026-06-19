import { supabase } from '@/lib/supabase';
import {
  buildActivityCountMap,
  formatTimestamp,
  getAvatarUrl,
  getInitials,
  getUserColor,
} from '@/lib/format';

export interface FeedFriend {
  id: string;
  name: string;
  username: string;
  initials: string;
  color: string;
  avatarUrl: string | null;
}

export interface FeedActivity {
  id: string;
  placeName: string;
  latitude: number | null;
  longitude: number | null;
  isMustSee: boolean;
  description: string;
  categories: string[];
  imageUrls: string[];
  timestamp: string;
  commentCount: number;
  saveCount: number;
  friend: FeedFriend;
}

export interface ActivityComment {
  id: string;
  userId: string;
  userName: string;
  userInitials: string;
  userColor: string;
  userAvatarUrl: string | null;
  content: string;
  createdAt: string;
}

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

function toFriend(profile: ProfileRow | null, userId: string): FeedFriend {
  const name = profile?.full_name ?? profile?.username ?? 'Freund';
  return {
    id: userId,
    name,
    username: profile?.username ?? '',
    initials: getInitials(name),
    color: getUserColor(userId),
    avatarUrl: getAvatarUrl(profile?.avatar_url, true),
  };
}

/**
 * Feed of accepted friends' activities (newest first) with comment + save counts,
 * plus the current user's wishlisted activity ids. Mirrors the web
 * ActivitiesPageClient query; RLS scopes everything to the user's network.
 */
export async function fetchActivitiesFeed(
  userId: string,
): Promise<{ activities: FeedActivity[]; wishlistedIds: string[] }> {
  const { data: friendshipsData } = await supabase
    .from('friendships')
    .select(
      `id, sender_id, receiver_id, status,
       sender:profiles!friendships_sender_id_fkey(id, username, full_name, avatar_url),
       receiver:profiles!friendships_receiver_id_fkey(id, username, full_name, avatar_url)`,
    )
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'accepted');

  type FriendshipRow = {
    sender_id: string;
    receiver_id: string;
    sender: ProfileRow | null;
    receiver: ProfileRow | null;
  };

  const friends = ((friendshipsData ?? []) as unknown as FriendshipRow[]).map((f) =>
    f.sender_id === userId
      ? { id: f.receiver_id, profile: f.receiver }
      : { id: f.sender_id, profile: f.sender },
  );
  const friendIds = friends.map((f) => f.id);

  let activities: FeedActivity[] = [];
  if (friendIds.length > 0) {
    const { data } = await supabase
      .from('activities')
      .select(
        'id, user_id, place_name, latitude, longitude, is_superlike, description, created_at, categories, image_urls',
      )
      .in('user_id', friendIds)
      .order('created_at', { ascending: false });

    if (data) {
      const ids = data.map((a) => a.id);
      const [{ data: commentsData }, { data: savesData }] = await Promise.all([
        supabase.from('activity_comments').select('activity_id').in('activity_id', ids),
        supabase.from('wishlist').select('activity_id').in('activity_id', ids),
      ]);
      const commentMap = buildActivityCountMap(commentsData ?? []);
      const saveMap = buildActivityCountMap(savesData ?? []);

      activities = data.map((act) => {
        const match = friends.find((f) => f.id === act.user_id);
        return {
          id: act.id,
          placeName: act.place_name,
          latitude: act.latitude,
          longitude: act.longitude,
          isMustSee: act.is_superlike,
          description: act.description ?? '',
          categories: Array.isArray(act.categories) ? act.categories : [],
          imageUrls: Array.isArray(act.image_urls) ? act.image_urls : [],
          timestamp: formatTimestamp(act.created_at),
          commentCount: commentMap[act.id] ?? 0,
          saveCount: saveMap[act.id] ?? 0,
          friend: toFriend(match?.profile ?? null, act.user_id),
        };
      });
    }
  }

  const { data: wishlistData } = await supabase
    .from('wishlist')
    .select('activity_id')
    .eq('user_id', userId);

  return {
    activities,
    wishlistedIds: (wishlistData ?? []).map((w) => w.activity_id),
  };
}

export function addToWishlist(userId: string, activityId: string) {
  return supabase.from('wishlist').insert({ user_id: userId, activity_id: activityId });
}

export function removeFromWishlist(userId: string, activityId: string) {
  return supabase
    .from('wishlist')
    .delete()
    .eq('user_id', userId)
    .eq('activity_id', activityId);
}

export async function fetchComments(activityId: string): Promise<ActivityComment[]> {
  const { data, error } = await supabase
    .from('activity_comments')
    .select(
      `id, content, created_at, user_id,
       profiles:profiles!activity_comments_user_id_fkey(id, username, full_name, avatar_url)`,
    )
    .eq('activity_id', activityId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  type CommentRow = {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    profiles: ProfileRow | null;
  };

  return (data as unknown as CommentRow[]).map((row) => {
    const name = row.profiles?.full_name ?? row.profiles?.username ?? 'Nutzer';
    return {
      id: row.id,
      userId: row.user_id,
      userName: name,
      userInitials: getInitials(name),
      userColor: getUserColor(row.user_id),
      userAvatarUrl: getAvatarUrl(row.profiles?.avatar_url, true),
      content: row.content,
      createdAt: row.created_at,
    };
  });
}

export function addComment(activityId: string, userId: string, content: string) {
  return supabase
    .from('activity_comments')
    .insert({ activity_id: activityId, user_id: userId, content });
}

export function updateComment(commentId: string, content: string) {
  return supabase.from('activity_comments').update({ content }).eq('id', commentId);
}

export function deleteComment(commentId: string) {
  return supabase.from('activity_comments').delete().eq('id', commentId);
}
