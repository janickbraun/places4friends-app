import { isExpoGo } from '@/lib/runtime';
import {
  CONTACT_HASH_BATCH_SIZE,
  matchContacts,
  type FriendSuggestion,
} from '@/lib/friendSuggestions';

/**
 * Address-book matching: find the people already on places4friends among the
 * user's contacts.
 *
 * **Only hashes leave the device.** E-mail addresses are normalized and SHA-256
 * hashed locally; the `find_contacts_on_p4f` RPC compares those hashes against
 * a private server-side table. Raw contacts are never uploaded, never cached and
 * never written to storage — they exist only for the duration of one call.
 *
 * `expo-contacts` and `expo-crypto` are loaded lazily behind an `isExpoGo`
 * guard, like Google Sign-In and `expo-notifications`: importing a native module
 * that isn't in the binary throws at module evaluation, and this file is
 * imported by the Freunde tab.
 */

export type ContactSyncResult =
  | { ok: true; matches: FriendSuggestion[]; scanned: number; limited: boolean }
  | { ok: false; reason: 'unavailable' | 'denied' | 'failed' };

type ContactsModule = typeof import('expo-contacts');

async function loadContacts(): Promise<ContactsModule | null> {
  if (isExpoGo) return null;
  try {
    return await import('expo-contacts');
  } catch (err) {
    if (__DEV__) console.warn('expo-contacts unavailable; contact sync disabled:', err);
    return null;
  }
}

/**
 * Whether an error means the native module simply isn't in this binary.
 *
 * Unlike `expo-notifications`, importing `expo-contacts` succeeds even when the
 * native side is missing — the JS wrapper loads fine and only throws on the
 * first native call. So the import guard above can't catch this case on its own,
 * and without this check a dev build made before the package was added reports
 * "sync failed" (suggesting a retry that can never work) instead of "not
 * available in this version of the app".
 */
function isMissingNativeModule(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /cannot find native module|unavailabilityerror|is not available|doesn't exist in this environment/i.test(
    message,
  );
}

/** Lowercased, trimmed e-mail — must match the server's `email_hash()` exactly. */
function normalizeEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  return value.includes('@') ? value : null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Whether the OS contacts permission is already granted (never prompts). */
export async function hasContactsPermission(): Promise<boolean> {
  const Contacts = await loadContacts();
  if (!Contacts) return false;
  try {
    const { status } = await Contacts.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Prompt for contacts access (first time only), hash every e-mail address found
 * and ask the server which of them belong to registered users.
 *
 * On iOS 18+ the user can grant access to a subset of their contacts; that
 * returns fewer matches rather than failing, flagged as `limited` so the UI can
 * explain a thin result.
 */
export async function syncContacts(): Promise<ContactSyncResult> {
  const Contacts = await loadContacts();
  if (!Contacts) return { ok: false, reason: 'unavailable' };

  let limited = false;
  try {
    const existing = await Contacts.getPermissionsAsync();
    let granted = existing.status === 'granted';
    let privileges = existing.accessPrivileges;
    if (!granted) {
      const requested = await Contacts.requestPermissionsAsync();
      granted = requested.status === 'granted';
      privileges = requested.accessPrivileges;
    }
    if (!granted) return { ok: false, reason: 'denied' };
    limited = privileges === 'limited';
  } catch (err) {
    if (__DEV__) console.warn('Contacts permission check failed:', err);
    return { ok: false, reason: isMissingNativeModule(err) ? 'unavailable' : 'failed' };
  }

  try {
    // SDK 56 API. The older `getContactsAsync` / `Contacts.Fields` still type-
    // check (they are exported as deprecated stubs) but throw at runtime.
    // `getAllDetails` also avoids building full Contact instances for a bulk read.
    const contacts = await Contacts.Contact.getAllDetails([Contacts.ContactField.EMAILS] as const);

    const emails = new Set<string>();
    for (const contact of contacts) {
      for (const entry of contact.emails ?? []) {
        const normalized = entry.address ? normalizeEmail(entry.address) : null;
        if (normalized) emails.add(normalized);
      }
    }
    if (emails.size === 0) return { ok: true, matches: [], scanned: 0, limited };

    // Lowercase hex, to match Postgres' `encode(digest(...), 'hex')` exactly —
    // spelled out rather than relying on the default, because a mismatch here
    // would look like "nobody you know uses the app" instead of an error.
    const Crypto = await import('expo-crypto');
    const hashes = await Promise.all(
      [...emails].map(async (email) =>
        (
          await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, email, {
            encoding: Crypto.CryptoEncoding.HEX,
          })
        ).toLowerCase(),
      ),
    );

    // The RPC caps each call, so send the hashes in batches and flatten.
    const batches = await Promise.all(
      chunk(hashes, CONTACT_HASH_BATCH_SIZE).map((batch) => matchContacts(batch)),
    );
    const merged = new Map<string, FriendSuggestion>();
    for (const match of batches.flat()) merged.set(match.id, match);

    return { ok: true, matches: [...merged.values()], scanned: emails.size, limited };
  } catch (err) {
    if (__DEV__) console.warn('Contact sync failed:', err);
    return { ok: false, reason: isMissingNativeModule(err) ? 'unavailable' : 'failed' };
  }
}
