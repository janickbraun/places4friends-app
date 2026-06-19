import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { ArrowLeft, Lock, Mail } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { getLoginErrorMessage } from '@/lib/authErrors';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';

type ForgotStatus = 'idle' | 'sending' | 'success' | 'error';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [isForgot, setIsForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<ForgotStatus>('idle');
  const [forgotMessage, setForgotMessage] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    const mail = email.trim();
    if (!mail || !password) {
      setError('Bitte E-Mail und Passwort eingeben.');
      setLoading(false);
      return;
    }
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: mail,
      password,
    });
    if (authError) {
      setError(getLoginErrorMessage(authError));
      setLoading(false);
      return;
    }
    router.replace('/');
  };

  const handleForgot = async () => {
    setForgotStatus('sending');
    setForgotMessage('');
    const mail = forgotEmail.trim();
    if (!mail) {
      setForgotStatus('error');
      setForgotMessage('Bitte gib deine E-Mail-Adresse ein.');
      return;
    }
    // Deep link back into the app; link handling is wired in the deep-linking task.
    const redirectTo = Linking.createURL('/reset-password');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(mail, {
      redirectTo,
    });
    if (resetError) {
      setForgotStatus('error');
      setForgotMessage(resetError.message || 'Es gab ein Problem beim Senden der E-Mail.');
    } else {
      setForgotStatus('success');
      setForgotMessage(
        'Eine E-Mail zum Zurücksetzen deines Passworts wurde gesendet. Bitte überprüfe deinen Posteingang.',
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 py-8">
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              className="mb-6 h-9 w-9 items-center justify-center rounded-full bg-white"
              style={{ boxShadow: '0px 1px 2px rgba(0,0,0,0.05)' }}
            >
              <ArrowLeft size={20} color="#334155" />
            </Pressable>

            <Text className="text-2xl font-bold text-slate-900">
              {isForgot ? 'Passwort zurücksetzen' : 'Willkommen zurück'}
            </Text>
            <Text className="mt-1 text-sm text-slate-500">
              {isForgot
                ? 'Wir senden dir einen Link zum Zurücksetzen.'
                : 'Melde dich an, um fortzufahren.'}
            </Text>

            <View className="mt-8 gap-4">
              {isForgot ? (
                <>
                  <TextField
                    label="E-Mail-Adresse"
                    icon={Mail}
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    placeholder="name@beispiel.de"
                    maxLength={100}
                  />
                  {forgotMessage ? (
                    <View
                      className={`rounded-lg border px-4 py-2.5 ${
                        forgotStatus === 'error'
                          ? 'border-red-100 bg-red-50'
                          : 'border-emerald-100 bg-emerald-50'
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          forgotStatus === 'error' ? 'text-red-700' : 'text-emerald-700'
                        }`}
                      >
                        {forgotMessage}
                      </Text>
                    </View>
                  ) : null}
                  <Button
                    label="Link anfordern"
                    trailingArrow
                    loading={forgotStatus === 'sending'}
                    onPress={handleForgot}
                  />
                  <Button
                    label="Zurück zum Login"
                    icon={ArrowLeft}
                    variant="secondary"
                    onPress={() => {
                      setIsForgot(false);
                      setForgotStatus('idle');
                      setForgotMessage('');
                      setError('');
                    }}
                  />
                </>
              ) : (
                <>
                  <TextField
                    label="E-Mail"
                    icon={Mail}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    placeholder="name@beispiel.de"
                    maxLength={100}
                  />

                  <View className="gap-1.5">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Passwort
                      </Text>
                      <Pressable
                        onPress={() => {
                          setIsForgot(true);
                          setError('');
                        }}
                      >
                        <Text className="text-xs font-semibold text-brand-green-700">
                          Passwort vergessen?
                        </Text>
                      </Pressable>
                    </View>
                    <TextField
                      icon={Lock}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoComplete="current-password"
                      placeholder="Dein Passwort"
                      maxLength={100}
                    />
                  </View>

                  {error ? (
                    <View className="rounded-lg border border-red-100 bg-red-50 px-4 py-2.5">
                      <Text className="text-xs font-medium text-red-700">{error}</Text>
                    </View>
                  ) : null}

                  <Button
                    label="Anmelden"
                    trailingArrow
                    loading={loading}
                    onPress={handleLogin}
                  />

                  <SocialAuthButtons mode="login" onError={setError} />

                  <View className="mt-2 flex-row items-center justify-center">
                    <Text className="text-sm text-slate-500">Noch kein Konto? </Text>
                    <Pressable onPress={() => router.replace('/register')}>
                      <Text className="text-sm font-semibold text-brand-green-700">
                        Konto erstellen
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
