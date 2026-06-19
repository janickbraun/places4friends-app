import { useState, type ReactNode } from 'react';
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
import { ArrowLeft, AtSign, Check, Lock, Mail, User } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { getSignupErrorMessage } from '@/lib/authErrors';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';

function Checkbox({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable onPress={onToggle} className="flex-row items-start gap-2.5">
      <View
        className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
          checked ? 'border-brand-green-700 bg-brand-green-700' : 'border-slate-300 bg-white'
        }`}
      >
        {checked ? <Check size={14} color="#ffffff" /> : null}
      </View>
      <View className="flex-1">{children}</View>
    </Pressable>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const ensureConsent = () => {
    if (!acceptedPrivacy || !acceptedTerms) {
      setError(
        'Bitte akzeptiere die Datenschutzerklärung und Nutzungsbedingungen, um fortzufahren.',
      );
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (!ensureConsent()) return;

    const mail = email.trim();
    const name = fullName.trim();
    const user = username.trim();

    if (!mail || !password) {
      setError('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    if (mail.length > 100) {
      setError('Die E-Mail-Adresse darf maximal 100 Zeichen lang sein.');
      return;
    }
    if (name && name.length > 50) {
      setError('Der vollständige Name darf maximal 50 Zeichen lang sein.');
      return;
    }
    if (user) {
      if (user.length > 30) {
        setError('Der Benutzername darf maximal 30 Zeichen lang sein.');
        return;
      }
      if (!/^[a-zA-Z0-9_.]+$/.test(user)) {
        setError(
          'Der Benutzername darf nur Buchstaben, Zahlen, Unterstriche und Punkte enthalten.',
        );
        return;
      }
    }
    if (password.length > 100) {
      setError('Das Passwort darf maximal 100 Zeichen lang sein.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }
    if (password.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    setLoading(true);
    const { data, error: authError } = await supabase.auth.signUp({
      email: mail,
      password,
      options: {
        data: {
          full_name: name || undefined,
          username: user || undefined,
        },
      },
    });

    if (authError) {
      setError(getSignupErrorMessage(authError));
      setLoading(false);
      return;
    }

    // TODO (edge functions task): trigger the custom Resend verification email
    // via the `send-verification-email` Edge Function.

    if (!data.session) {
      setSuccess(
        'Konto erstellt! Bitte prüfe dein E-Mail-Postfach und bestätige deine Adresse.',
      );
      setLoading(false);
      return;
    }

    router.replace('/');
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="flex-1 px-6 py-8">
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              className="mb-6 h-9 w-9 items-center justify-center rounded-full bg-white"
              style={{ boxShadow: '0px 1px 2px rgba(0,0,0,0.05)' }}
            >
              <ArrowLeft size={20} color="#334155" />
            </Pressable>

            <Text className="text-2xl font-bold text-slate-900">Konto erstellen</Text>
            <Text className="mt-1 text-sm text-slate-500">
              Teile deine Lieblingsorte mit Freunden.
            </Text>

            <View className="mt-8 gap-4">
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
              <TextField
                label="Vollständiger Name"
                icon={User}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Max Mustermann"
                maxLength={50}
              />
              <TextField
                label="Benutzername"
                icon={AtSign}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholder="maxmuster"
                maxLength={30}
              />
              <TextField
                label="Passwort"
                icon={Lock}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Mind. 6 Zeichen"
                maxLength={100}
              />
              <TextField
                label="Passwort wiederholen"
                icon={Lock}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="Passwort erneut eingeben"
                maxLength={100}
              />

              {error ? (
                <View className="rounded-lg border border-red-100 bg-red-50 px-4 py-2.5">
                  <Text className="text-xs font-medium text-red-700">{error}</Text>
                </View>
              ) : null}
              {success ? (
                <View className="rounded-lg border border-brand-green-200 bg-brand-green-50 px-4 py-3">
                  <Text className="text-xs font-medium leading-relaxed text-brand-green-800">
                    {success}
                  </Text>
                </View>
              ) : null}

              <View className="gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <Checkbox
                  checked={acceptedPrivacy}
                  onToggle={() => setAcceptedPrivacy((v) => !v)}
                >
                  <Text className="text-xs leading-relaxed text-slate-600">
                    Ich habe die{' '}
                    <Text className="font-semibold text-brand-green-700">
                      Datenschutzerklärung
                    </Text>{' '}
                    zur Kenntnis genommen.
                  </Text>
                </Checkbox>
                <Checkbox checked={acceptedTerms} onToggle={() => setAcceptedTerms((v) => !v)}>
                  <Text className="text-xs leading-relaxed text-slate-600">
                    Ich akzeptiere die{' '}
                    <Text className="font-semibold text-brand-green-700">
                      Nutzungsbedingungen
                    </Text>
                    .
                  </Text>
                </Checkbox>
              </View>

              <Button
                label="Konto erstellen"
                trailingArrow
                loading={loading}
                onPress={handleSubmit}
              />

              <SocialAuthButtons mode="register" onError={setError} guard={ensureConsent} />

              <View className="mt-2 flex-row items-center justify-center">
                <Text className="text-sm text-slate-500">Bereits ein Konto? </Text>
                <Pressable onPress={() => router.replace('/login')}>
                  <Text className="text-sm font-semibold text-brand-green-700">Anmelden</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
