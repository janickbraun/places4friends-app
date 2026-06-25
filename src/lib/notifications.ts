import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { isExpoGo } from '@/lib/runtime';

/**
 * Push notifications for the five major social events. Registration happens on
 * login; each mutation fires `notifyPush` (fire-and-forget) which calls the
 * `send-push` Edge Function. The Edge Function resolves recipients server-side,
 * so the client only needs to name the event and the relevant id.
 */

export type PushEvent = 'new_place' | 'comment' | 'save' | 'friend_request' | 'friend_accept';

export interface NotifyPushPayload {
  event: PushEvent;
  activityId?: string;
  friendshipId?: string;
  targetUserId?: string;
}

// Show the banner + play a sound even when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
 * simulator, permission denied, missing project id).
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  if (isExpoGo || !Device.isDevice) return null;

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
  if (isExpoGo || !Device.isDevice) return false;
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
 * mutation, so a push failure can't break the underlying action.
 */
export async function notifyPush(payload: NotifyPushPayload): Promise<void> {
  try {
    await supabase.functions.invoke('send-push', { body: payload });
  } catch (err) {
    if (__DEV__) console.warn('notifyPush failed:', err);
  }
}
