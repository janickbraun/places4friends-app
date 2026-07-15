import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, json } from '../_shared/cors.ts';

// Sends Expo push notifications for the five major social events AND persists an
// in-app notification row per recipient (the bell feed). Called by the mobile
// app (verify_jwt = true) as a fire-and-forget step right after the underlying
// mutation succeeds. The authenticated caller is the *actor*; the function
// resolves recipients with the service role, validates each event against real
// rows so a client can't spam arbitrary pushes, persists the in-app feed rows
// for every recipient, then delivers a push to those who have it enabled and
// have a device token. In-app persistence is independent of the push toggle so
// the bell still shows events for users who declined OS push permission.

type PushEvent = 'new_place' | 'comment' | 'save' | 'friend_request' | 'friend_accept';

interface PushRequest {
  event: PushEvent;
  activityId?: string;
  friendshipId?: string;
  targetUserId?: string;
}

interface NotificationContent {
  title: string;
  body: string;
  data: Record<string, unknown>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoMessage {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data: Record<string, unknown>;
}

async function displayName(admin: SupabaseClient, userId: string): Promise<string> {
  const { data } = await admin
    .from('profiles')
    .select('full_name, username')
    .eq('id', userId)
    .maybeSingle();
  return data?.full_name?.trim() || data?.username?.trim() || 'Ein Freund';
}

/** Accepted friends of `userId` (the "other" side of each accepted friendship). */
async function acceptedFriendIds(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await admin
    .from('friendships')
    .select('sender_id, receiver_id')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'accepted');
  return (data ?? []).map((f) => (f.sender_id === userId ? f.receiver_id : f.sender_id));
}

/**
 * Deliver `content` to every device token of the given recipients, after
 * filtering out the actor and anyone who has push notifications disabled.
 * Prunes tokens Expo reports as no longer registered.
 */
async function deliver(
  admin: SupabaseClient,
  recipientIds: string[],
  actorId: string,
  content: NotificationContent,
): Promise<number> {
  const recipients = [...new Set(recipientIds)].filter((id) => id && id !== actorId);
  if (recipients.length === 0) return 0;

  const { data: enabledProfiles } = await admin
    .from('profiles')
    .select('id')
    .in('id', recipients)
    .eq('notifications_enabled', true);
  const enabledIds = (enabledProfiles ?? []).map((p) => p.id);
  if (enabledIds.length === 0) return 0;

  const { data: tokenRows } = await admin
    .from('push_tokens')
    .select('token')
    .in('user_id', enabledIds);
  const tokens = (tokenRows ?? []).map((t) => t.token).filter(Boolean);
  if (tokens.length === 0) return 0;

  const messages: ExpoMessage[] = tokens.map((to) => ({
    to,
    sound: 'default',
    title: content.title,
    body: content.body,
    data: content.data,
  }));

  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const chunkTokens = tokens.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });
      const result = await res.json().catch(() => null);
      const tickets = result?.data;
      if (Array.isArray(tickets)) {
        const dead: string[] = [];
        tickets.forEach((ticket: { status?: string; details?: { error?: string } }, idx: number) => {
          if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
            dead.push(chunkTokens[idx]);
          }
        });
        if (dead.length > 0) {
          await admin.from('push_tokens').delete().in('token', dead);
        }
      }
    } catch (err) {
      console.error('Expo push send failed:', err);
    }
  }

  return tokens.length;
}

/**
 * Persist an in-app notification row for each recipient (deduped, actor
 * excluded). Independent of the push toggle and device tokens so the bell feed
 * populates even when the recipient has push disabled. Best-effort: a failure
 * here never blocks the push delivery below.
 */
async function persistNotifications(
  admin: SupabaseClient,
  recipientIds: string[],
  actorId: string,
  type: PushEvent,
  content: NotificationContent,
  activityId: string | null,
): Promise<void> {
  const recipients = [...new Set(recipientIds)].filter((id) => id && id !== actorId);
  if (recipients.length === 0) return;
  const rows = recipients.map((userId) => ({
    user_id: userId,
    actor_id: actorId,
    type,
    activity_id: activityId,
    title: content.title,
    body: content.body,
    data: content.data,
  }));
  const { error } = await admin.from('notifications').insert(rows);
  if (error) console.error('persist notifications failed:', error.message);
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Identify the actor from the caller's JWT.
  const authHeader = req.headers.get('Authorization') ?? '';
  const authed = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return json({ error: 'Nicht angemeldet.' }, 401);
  const actorId = user.id;

  let payload: PushRequest;
  try {
    payload = (await req.json()) as PushRequest;
  } catch {
    return json({ error: 'Ungültige Anfrage.' }, 400);
  }
  if (!payload?.event) return json({ error: 'Kein Event angegeben.' }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const actorName = await displayName(admin, actorId);

  let recipients: string[] = [];
  let content: NotificationContent | null = null;

  switch (payload.event) {
    case 'new_place': {
      if (!payload.activityId) return json({ error: 'activityId fehlt.' }, 400);
      const { data: activity } = await admin
        .from('activities')
        .select('user_id, place_name')
        .eq('id', payload.activityId)
        .maybeSingle();
      // Only the author may fan a new-place push out to their friends.
      if (!activity || activity.user_id !== actorId) return json({ ok: true, sent: 0 });
      recipients = await acceptedFriendIds(admin, actorId);
      content = {
        title: 'Neue Empfehlung',
        body: `${actorName} empfiehlt ${activity.place_name}`,
        data: { event: 'new_place', activityId: payload.activityId },
      };
      break;
    }
    case 'comment':
    case 'save': {
      if (!payload.activityId) return json({ error: 'activityId fehlt.' }, 400);
      const { data: activity } = await admin
        .from('activities')
        .select('user_id, place_name')
        .eq('id', payload.activityId)
        .maybeSingle();
      if (!activity || activity.user_id === actorId) return json({ ok: true, sent: 0 });

      // Confirm the actor really performed the action before notifying.
      const table = payload.event === 'comment' ? 'activity_comments' : 'wishlist';
      const { count } = await admin
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('activity_id', payload.activityId)
        .eq('user_id', actorId);
      if (!count || count === 0) return json({ ok: true, sent: 0 });

      recipients = [activity.user_id];
      content =
        payload.event === 'comment'
          ? {
              title: 'Neuer Kommentar',
              body: `${actorName} hat deinen Beitrag zu ${activity.place_name} kommentiert`,
              data: { event: 'comment', activityId: payload.activityId },
            }
          : {
              title: 'Beitrag gespeichert',
              body: `${actorName} hat deinen Beitrag zu ${activity.place_name} gespeichert`,
              data: { event: 'save', activityId: payload.activityId },
            };
      break;
    }
    case 'friend_request': {
      if (!payload.targetUserId) return json({ error: 'targetUserId fehlt.' }, 400);
      const { data: friendship } = await admin
        .from('friendships')
        .select('id')
        .eq('sender_id', actorId)
        .eq('receiver_id', payload.targetUserId)
        .eq('status', 'pending')
        .maybeSingle();
      if (!friendship) return json({ ok: true, sent: 0 });
      recipients = [payload.targetUserId];
      content = {
        title: 'Neue Freundschaftsanfrage',
        body: `${actorName} möchte sich mit dir verbinden`,
        data: { event: 'friend_request' },
      };
      break;
    }
    case 'friend_accept': {
      let recipientId: string | null = null;
      if (payload.friendshipId) {
        const { data: friendship } = await admin
          .from('friendships')
          .select('sender_id, receiver_id, status')
          .eq('id', payload.friendshipId)
          .maybeSingle();
        if (!friendship || friendship.status !== 'accepted') return json({ ok: true, sent: 0 });
        if (friendship.sender_id !== actorId && friendship.receiver_id !== actorId) {
          return json({ ok: true, sent: 0 });
        }
        recipientId =
          friendship.sender_id === actorId ? friendship.receiver_id : friendship.sender_id;
      } else if (payload.targetUserId) {
        // Invite-redemption path: verify an accepted friendship links the two.
        const { data: friendship } = await admin
          .from('friendships')
          .select('id')
          .or(
            `and(sender_id.eq.${actorId},receiver_id.eq.${payload.targetUserId}),and(sender_id.eq.${payload.targetUserId},receiver_id.eq.${actorId})`,
          )
          .eq('status', 'accepted')
          .maybeSingle();
        if (!friendship) return json({ ok: true, sent: 0 });
        recipientId = payload.targetUserId;
      } else {
        return json({ error: 'friendshipId oder targetUserId fehlt.' }, 400);
      }
      recipients = recipientId ? [recipientId] : [];
      content = {
        title: 'Neue Freundschaft',
        body: `${actorName} ist jetzt mit dir befreundet`,
        data: { event: 'friend_accept' },
      };
      break;
    }
    default:
      return json({ error: 'Unbekanntes Event.' }, 400);
  }

  if (!content) return json({ ok: true, sent: 0 });
  await persistNotifications(
    admin,
    recipients,
    actorId,
    payload.event,
    content,
    payload.activityId ?? null,
  );
  const sent = await deliver(admin, recipients, actorId, content);
  return json({ ok: true, sent });
});
