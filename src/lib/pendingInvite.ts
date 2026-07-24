import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Href } from 'expo-router';

/**
 * An invite link opened while signed out. The invite screens stash the token
 * here before handing over to the AuthPrompt; the auth screens replay it once
 * the user is signed in, so registering through an invite still lands on the
 * inviter's profile instead of the map.
 *
 * Not a `useSyncExternalStore` store like `mapLayer`/`onboarding`: nothing
 * renders from it, it is written once and read once.
 */

const STORAGE_KEY = 'p4f.pendingInvite';

/** Drop invites nobody came back for, so a stale token can't hijack a later login. */
const MAX_AGE_MS = 7 * 86400000;

interface PendingInvite {
  token: string;
  /** The link creator, when already known — saves a validation round trip. */
  profileId?: string;
  savedAt: number;
}

export async function setPendingInvite(invite: {
  token: string;
  profileId?: string;
}): Promise<void> {
  const value: PendingInvite = { ...invite, savedAt: Date.now() };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Best-effort: losing the invite is bad but must never break sign-up.
  }
}

export async function clearPendingInvite(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function readPendingInvite(): Promise<PendingInvite | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingInvite>;
    if (typeof parsed?.token !== 'string' || !parsed.token) return null;
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      await clearPendingInvite();
      return null;
    }
    return parsed as PendingInvite;
  } catch {
    return null;
  }
}

/**
 * The route to send the user to right after signing in, consuming the stored
 * invite. Returns `null` when there is none, so callers can fall back to their
 * normal destination:
 *
 * ```ts
 * router.replace((await consumePendingInviteRoute()) ?? '/friends');
 * ```
 *
 * Prefers the inviter's profile (which renders the "Einladung annehmen" card)
 * and falls back to the invite screen, which resolves the creator itself.
 */
export async function consumePendingInviteRoute(): Promise<Href | null> {
  const invite = await readPendingInvite();
  if (!invite) return null;
  await clearPendingInvite();
  return invite.profileId
    ? { pathname: '/profile/[id]', params: { id: invite.profileId, invite: invite.token } }
    : { pathname: '/invite/[token]', params: { token: invite.token } };
}
