import AsyncStorage from '@react-native-async-storage/async-storage';

// Mirrors the web's localStorage flag for the first-run tour.
export const ONBOARDING_ACTIVE_KEY = 'p4f_onboarding_active';

const listeners = new Set<() => void>();

/** Subscribe to "start tour" requests (returns an unsubscribe fn). */
export function subscribeOnboarding(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Mark the tour active and notify the mounted overlay to show immediately. */
export async function startOnboarding(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_ACTIVE_KEY, 'true');
  listeners.forEach((l) => l());
}

export async function isOnboardingActive(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_ACTIVE_KEY)) === 'true';
}

/** Clear the active flag once the tour is finished or skipped. */
export async function finishOnboarding(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_ACTIVE_KEY, 'false');
}
