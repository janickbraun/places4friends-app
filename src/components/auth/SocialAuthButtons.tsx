import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { isExpoGo } from '@/lib/runtime';
import { GoogleIcon } from '@/components/ui/GoogleIcon';
import { AppleIcon } from '@/components/ui/AppleIcon';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

type Props = {
  mode: 'login' | 'register';
  onError: (message: string) => void;
  /** Return false to block sign-in (e.g. consent not yet accepted on register). */
  guard?: () => boolean;
  /** Show the "oder" divider above the buttons (default true; off in the register chooser). */
  showDivider?: boolean;
};

/**
 * Google + Apple sign-in buttons matching the web's "oder" divider + provider
 * buttons. Google uses native sign-in -> supabase.signInWithIdToken (the module
 * is loaded lazily so the screen still renders in Expo Go). Apple is a
 * placeholder for now (real expo-apple-authentication flow to follow).
 */
export function SocialAuthButtons({ mode, onError, guard, showDivider = true }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<null | 'google' | 'apple'>(null);
  const verb = mode === 'register' ? 'registrieren' : 'anmelden';

  const handleGoogle = async () => {
    if (guard && !guard()) return;
    if (isExpoGo) {
      onError('Google-Anmeldung benötigt einen Development Build (nicht in Expo Go verfügbar).');
      return;
    }
    if (!GOOGLE_WEB_CLIENT_ID) {
      onError('Google-Anmeldung ist noch nicht konfiguriert.');
      return;
    }
    try {
      setLoading('google');
      // Loaded lazily: importing this module touches a native module that only
      // exists in a development build.
      const { GoogleSignin, isSuccessResponse } = await import(
        '@react-native-google-signin/google-signin'
      );
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iosClientId: GOOGLE_IOS_CLIENT_ID,
        scopes: ['profile', 'email'],
      });
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return; // user cancelled
      const idToken = response.data.idToken;
      if (!idToken) throw new Error('Kein ID-Token von Google erhalten.');
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error) throw error;
      router.replace('/');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Google-Anmeldung fehlgeschlagen.');
    } finally {
      setLoading(null);
    }
  };

  const handleApple = async () => {
    if (guard && !guard()) return;
    if (isExpoGo) {
      onError('Apple-Anmeldung benötigt einen Development Build (nicht in Expo Go verfügbar).');
      return;
    }
    try {
      setLoading('apple');
      // Loaded lazily: importing this module touches a native module that only
      // exists in a build with the Sign-in-with-Apple entitlement.
      const AppleAuthentication = await import('expo-apple-authentication');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('Kein Identity-Token von Apple erhalten.');
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
      // Apple only returns the name on the very first authorization, and it never
      // appears in the identity token — so persist it to the profile here. Guarded
      // by `full_name IS NULL` so we never overwrite a name the user later edits.
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (fullName && data.user) {
        await supabase
          .from('profiles')
          .update({ full_name: fullName })
          .eq('id', data.user.id)
          .is('full_name', null);
      }
      router.replace('/');
    } catch (e) {
      // User-cancelled the native sheet -> stay silent.
      if (e instanceof Error && 'code' in e && (e as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      onError(e instanceof Error ? e.message : 'Apple-Anmeldung fehlgeschlagen.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <View className="gap-3">
      {showDivider ? (
        <View className="my-2 flex-row items-center">
          <View className="h-px flex-1 bg-slate-200" />
          <Text className="mx-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            oder
          </Text>
          <View className="h-px flex-1 bg-slate-200" />
        </View>
      ) : null}

      {/* Sign in with Apple is iOS-only (App Store-required there) and, per Apple's
          guidelines, sits above the other providers; hidden on Android. */}
      {Platform.OS === 'ios' ? (
        <Pressable
          onPress={handleApple}
          disabled={loading !== null}
          accessibilityRole="button"
          className={`w-full flex-row items-center justify-center gap-2.5 rounded-xl bg-black py-3.5 ${
            loading !== null ? 'opacity-60' : ''
          }`}
        >
          {loading === 'apple' ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <AppleIcon size={18} />
              <Text className="text-sm font-semibold text-white">Mit Apple {verb}</Text>
            </>
          )}
        </Pressable>
      ) : null}

      <Pressable
        onPress={handleGoogle}
        disabled={loading !== null}
        accessibilityRole="button"
        className={`w-full flex-row items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white py-3.5 ${
          loading !== null ? 'opacity-60' : ''
        }`}
        style={{ boxShadow: '0px 1px 2px rgba(0,0,0,0.05)' }}
      >
        {loading === 'google' ? (
          <ActivityIndicator color="#334155" />
        ) : (
          <>
            <GoogleIcon size={20} />
            <Text className="text-sm font-semibold text-slate-700">Mit Google {verb}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
