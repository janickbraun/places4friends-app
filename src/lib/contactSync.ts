import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether the user opted into address-book matching, and when it last ran.
 * A device preference, so it follows the module-level `useSyncExternalStore` +
 * AsyncStorage pattern of `mapLayer.ts` rather than Query or context.
 *
 * Opt-in is explicit and sticky: we never prompt for contacts on our own, and
 * once enabled we re-scan at most once a day.
 */

const ENABLED_KEY = 'p4f.contactSync.enabled';
const LAST_SYNC_KEY = 'p4f.contactSync.lastSync';

const RESYNC_INTERVAL_MS = 86400000; // once a day

interface ContactSyncState {
  enabled: boolean;
  lastSyncAt: number | null;
}

let current: ContactSyncState = { enabled: false, lastSyncAt: null };
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function set(next: ContactSyncState) {
  current = next;
  emit();
}

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const [enabled, lastSync] = await AsyncStorage.multiGet([ENABLED_KEY, LAST_SYNC_KEY]);
    const parsed = Number(lastSync[1]);
    set({
      enabled: enabled[1] === 'true',
      lastSyncAt: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
    });
  } catch {
    // keep the defaults (off)
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  void hydrate();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ContactSyncState {
  return current;
}

/** Turn address-book matching on or off. Turning it off also forgets the timestamp. */
export function setContactSyncEnabled(enabled: boolean): void {
  set({ enabled, lastSyncAt: enabled ? current.lastSyncAt : null });
  AsyncStorage.setItem(ENABLED_KEY, String(enabled)).catch(() => {});
  if (!enabled) AsyncStorage.removeItem(LAST_SYNC_KEY).catch(() => {});
}

export function markContactSyncRun(): void {
  const now = Date.now();
  set({ ...current, lastSyncAt: now });
  AsyncStorage.setItem(LAST_SYNC_KEY, String(now)).catch(() => {});
}

/** True when sync is on and the last run is old enough to repeat. */
export function shouldResyncContacts(state: ContactSyncState): boolean {
  if (!state.enabled) return false;
  return state.lastSyncAt === null || Date.now() - state.lastSyncAt > RESYNC_INTERVAL_MS;
}

export function useContactSync(): ContactSyncState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
