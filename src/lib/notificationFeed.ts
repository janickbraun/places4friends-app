import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * In-app notification feed (the bell). Reads the `notifications` table that the
 * `send-push` Edge Function populates server-side. Deliberately free of any
 * `expo-notifications` dependency so the bell keeps working even on a build
 * where the native push module is unavailable.
 */

export type NotificationType = 'new_place' | 'comment' | 'save' | 'friend_request' | 'friend_accept';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  activityId: string | null;
  actorId: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  activity_id: string | null;
  actor_id: string | null;
  read_at: string | null;
  created_at: string;
}

function mapRow(r: NotificationRow): AppNotification {
  return {
    id: r.id,
    type: r.type as NotificationType,
    title: r.title,
    body: r.body,
    activityId: r.activity_id,
    actorId: r.actor_id,
    readAt: r.read_at,
    createdAt: r.created_at,
  };
}

/** Newest 50 notifications for the given user. RLS scopes this to the caller. */
export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, activity_id, actor_id, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return (data as NotificationRow[]).map(mapRow);
}

/** Count of not-yet-read notifications, for the bell badge. */
export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  return error || count === null ? 0 : count;
}

/** Mark every unread notification read (clears the badge). */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
}

/**
 * Live unread count for the bell badge: fetches once, then refetches on any
 * change to this user's notifications (a new row from the Edge Function, or a
 * mark-read from the notifications screen). Mirrors BottomNav's realtime badges.
 */
export function useUnreadNotificationCount(userId: string | undefined): {
  count: number;
  refresh: () => void;
} {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    void fetchUnreadNotificationCount(userId).then(setCount);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    refresh();
    // Unique channel name guards against Fast Refresh double-subscription.
    const suffix = Math.random().toString(36).slice(2);
    const channel = supabase
      .channel(`notifications-badge:${suffix}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  return { count, refresh };
}
