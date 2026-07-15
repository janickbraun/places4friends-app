import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { supabase } from '@/lib/supabase';
import { isExpoGo } from '@/lib/runtime';

/**
 * Push notifications for the five major social events. Registration happens on
 * login; each mutation fires `notifyPush` (fire-and-forget) which calls the
 * `send-push` Edge Function. The Edge Function resolves recipients server-side,
 * so the client only needs to name the event and the relevant id.
 *
 * `expo-notifications` pulls in native modules (e.g. `ExpoPushTokenManager`)
 * that are ABSENT in Expo Go, on the iOS Simulator, and in any dev build made
 * before the package was added. Importing it eagerly there throws at module
 * evaluation — and because this file loads at startup (AuthProvider → BottomNav
 * → _layout), that used to take the whole app down. We therefore load it lazily
 * behind a guard so push cleanly degrades to a no-op when unavailable, per the
 * `isExpoGo` graceful-degradation convention. All `expo-notifications` access in
 * the app funnels through this module for the same reason.
 */

export type PushEvent = 'new_place' | 'comment' | 'save' | 'friend_request' | 'friend_accept';

export interface NotifyPushPayload {
  event: PushEvent;
  activityId?: string;
  friendshipId?: string;
  targetUserId?: string;
}

type NotificationsModule = typeof import('expo-notifications');

// `undefined` = not yet attempted, `null` = attempted and unavailable.
let notificationsModule: NotificationsModule | null | undefined;

/**
 * Lazily load `expo-notifications`. Returns `null` (never throws) when the
 * native module isn't in the binary, so callers can guard with a simple
 * null-check instead of risking a crash.
 */
function getNotifications(): NotificationsModule | null {
  if (notificationsModule !== undefined) return notificationsModule;
  if (isExpoGo) {
    notificationsModule = null;
    return null;
  }
  try {
    // Dynamic require so a missing native module is a catchable error rather
    // than an uncatchable module-eval crash.
    const mod = require('expo-notifications') as NotificationsModule;
    // Show the banner + play a sound even when the app is in the foreground.
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    notificationsModule = mod;
  } catch (err) {
    if (__DEV__) console.warn('expo-notifications unavailable; push disabled:', err);
    notificationsModule = null;
  }
  return notificationsModule;
}

// Remember this device's token so we can delete exactly it on sign-out.
let cachedToken: string | null = null;

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId
  );
}

/**
 * Request notification permission, obtain the Expo push token and store it in
 * `push_tokens`. Returns the token, or `null` when push is unavailable (Expo Go,
 * simulator, permission denied, missing project id, missing native module).
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  const Notifications = getNotifications();
  if (!Notifications || isExpoGo || !Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Standard',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#226622',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  const projectId = getProjectId();
  if (!projectId) return null;

  let token: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    token = result.data;
  } catch (err) {
    if (__DEV__) console.warn('Failed to obtain Expo push token:', err);
    return null;
  }

  cachedToken = token;
  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  );
  if (error && __DEV__) console.warn('Failed to store push token:', error.message);
  return token;
}

/** Returns whether the OS notification permission is currently granted. */
export async function hasNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications || isExpoGo || !Device.isDevice) return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/** Remove this device's push token (call on sign-out). */
export async function removeCurrentPushToken(): Promise<void> {
  if (!cachedToken) return;
  const token = cachedToken;
  cachedToken = null;
  await supabase.from('push_tokens').delete().eq('token', token);
}

/**
 * Ask the `send-push` Edge Function to deliver a notification for an event the
 * current user just performed. Best-effort: never throws into the calling
 * mutation, so a push failure can't break the underlying action. Also drives
 * the in-app notification feed (the Edge Function persists a row per recipient).
 */
export async function notifyPush(payload: NotifyPushPayload): Promise<void> {
  try {
    await supabase.functions.invoke('send-push', { body: payload });
  } catch (err) {
    if (__DEV__) console.warn('notifyPush failed:', err);
  }
}

/**
 * The `event` from the notification that cold-started the app (a push the user
 * tapped while the app was closed), consuming it so a later launch doesn't
 * re-navigate. Returns `null` when push is unavailable or there was none.
 */
export async function consumeInitialNotificationEvent(): Promise<string | null> {
  const Notifications = getNotifications();
  if (!Notifications) return null;
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return null;
    Notifications.clearLastNotificationResponseAsync();
    const data = response.notification.request.content.data as { event?: string } | undefined;
    return data?.event ?? null;
  } catch {
    return null;
  }
}

/**
 * Subscribe to notification taps that happen while the app is running. `handler`
 * receives the event name. Returns an unsubscribe fn (a no-op when push is
 * unavailable), so callers can always `return remove` from an effect.
 */
export function addNotificationEventListener(handler: (event: string) => void): () => void {
  const Notifications = getNotifications();
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { event?: string } | undefined;
    if (data?.event) handler(data.event);
  });
  return () => sub.remove();
}
