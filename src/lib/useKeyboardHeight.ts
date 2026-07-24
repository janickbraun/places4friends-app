import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Height of the on-screen keyboard in dp, or `0` while it is closed.
 *
 * **Android only — always 0 on iOS**, by design. The app runs edge-to-edge
 * (`edgeToEdgeEnabled=true` in `android/gradle.properties`, the Expo default),
 * and under edge-to-edge the window is no longer resized for the IME: the
 * `adjustResize` soft-input mode in the manifest has no effect, so the keyboard
 * simply draws on top of whatever is at the bottom of the screen. That is why
 * the comment composer is unreachable on Android but fine on iOS, where the OS
 * lifts the focused input by itself.
 *
 * Add the returned value as bottom padding to a scroll container so its content
 * can be scrolled clear of the keyboard. Returning 0 on iOS keeps callers a
 * no-op there instead of double-padding what iOS already handled.
 *
 * `keyboardDidShow`/`keyboardDidHide` keep firing under edge-to-edge (they come
 * from the IME, not from a window resize), so they stay a reliable source.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      setHeight(event.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
