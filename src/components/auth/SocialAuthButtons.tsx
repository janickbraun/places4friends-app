import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Apple } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { isExpoGo } from '@/lib/runtime';
import { GoogleIcon } from '@/components/ui/GoogleIcon';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

type Props = {
  mode: 'login' | 'register';
  onError: (message: string) => void;
  /** Return false to block sign-in (e.g. consent not yet accepted on register). */
  guard?: () => boolean;
};

/**
 * Google + Apple sign-in buttons matching the web's "oder" divider + provider
 * buttons. Google uses native sign-in -> supabase.signInWithIdToken (the module
 * is loaded lazily so the screen still renders in Expo Go). Apple is a
 * placeholder for now (real expo-apple-authentication flow to follow).
 */
export function SocialAuthButtons({ mode, onError, guard }: Props) {
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
    // TODO (Apple Sign-In): real flow with expo-apple-authentication ->
    // supabase.auth.signInWithIdToken({ provider: 'apple', token }). Needs the
    // Apple provider configured in Supabase and ios.usesAppleSignIn = true.
    Alert.alert('Apple-Anmeldung', 'Die Apple-Anmeldung wird in Kürze verfügbar sein.');
  };

  return (
    <View className="gap-3">
      <View className="my-2 flex-row items-center">
        <View className="h-px flex-1 bg-slate-200" />
        <Text className="mx-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          oder
        </Text>
        <View className="h-px flex-1 bg-slate-200" />
      </View>

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

      <Pressable
        onPress={handleApple}
        disabled={loading !== null}
        accessibilityRole="button"
        className={`w-full flex-row items-center justify-center gap-2.5 rounded-xl bg-black py-3.5 ${
          loading !== null ? 'opacity-60' : ''
        }`}
      >
        <Apple size={18} color="#ffffff" fill="#ffffff" />
        <Text className="text-sm font-semibold text-white">Mit Apple {verb}</Text>
      </Pressable>
    </View>
  );
}
