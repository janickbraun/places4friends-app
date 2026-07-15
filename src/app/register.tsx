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
import LegalFooter from '@/components/LegalFooter';

function Checkbox({
  checked,
  onToggle,
  error = false,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  /** After a failed sign-up attempt, outline this (still unticked) box in red. */
  error?: boolean;
  children: ReactNode;
}) {
  const boxClass = checked
    ? 'border border-brand-green-700 bg-brand-green-700'
    : error
      ? 'border-2 border-red-500 bg-white'
      : 'border border-slate-300 bg-white';
  return (
    <Pressable onPress={onToggle} className="flex-row items-start gap-2.5">
      <View className={`mt-0.5 h-5 w-5 items-center justify-center rounded ${boxClass}`}>
        {checked ? <Check size={14} color="#ffffff" /> : null}
      </View>
      <View className="flex-1">{children}</View>
    </Pressable>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  // Set once the user taps a sign-up method without having accepted both boxes.
  const [consentError, setConsentError] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  /** Guard shared by all three sign-up methods (Apple, Google, E-Mail). On a
      failed attempt it surfaces the red hint + red-outlines the unticked box(es). */
  const ensureConsent = () => {
    if (!acceptedPrivacy || !acceptedTerms) {
      setConsentError(true);
      return false;
    }
    return true;
  };

  const togglePrivacy = () => {
    setAcceptedPrivacy((v) => !v);
    setConsentError(false);
    if (error) setError('');
  };

  const toggleTerms = () => {
    setAcceptedTerms((v) => !v);
    setConsentError(false);
    if (error) setError('');
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
              {/* Consent — required before any sign-up method. On a failed attempt
                  the unticked box(es) are outlined red + a red hint appears. */}
              <View className="gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <Checkbox
                  checked={acceptedPrivacy}
                  onToggle={togglePrivacy}
                  error={consentError}
                >
                  <Text className="text-xs leading-relaxed text-slate-600">
                    Ich habe die{' '}
                    <Text className="font-semibold text-brand-green-700">
                      Datenschutzerklärung
                    </Text>{' '}
                    zur Kenntnis genommen.
                  </Text>
                </Checkbox>
                <Checkbox checked={acceptedTerms} onToggle={toggleTerms} error={consentError}>
                  <Text className="text-xs leading-relaxed text-slate-600">
                    Ich akzeptiere die{' '}
                    <Text className="font-semibold text-brand-green-700">
                      Nutzungsbedingungen
                    </Text>
                    .
                  </Text>
                </Checkbox>
              </View>

              {consentError ? (
                <Text className="-mt-1 text-xs font-medium text-red-600">
                  Bitte akzeptiere die Datenschutzerklärung und Nutzungsbedingungen, um
                  fortzufahren.
                </Text>
              ) : null}

              {error ? (
                <View className="rounded-lg border border-red-100 bg-red-50 px-4 py-2.5">
                  <Text className="text-xs font-medium text-red-700">{error}</Text>
                </View>
              ) : null}

              {showEmailForm ? (
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

                  {success ? (
                    <View className="rounded-lg border border-brand-green-200 bg-brand-green-50 px-4 py-3">
                      <Text className="text-xs font-medium leading-relaxed text-brand-green-800">
                        {success}
                      </Text>
                    </View>
                  ) : null}

                  <Button
                    label="Konto erstellen"
                    trailingArrow
                    loading={loading}
                    onPress={handleSubmit}
                  />

                  <Pressable
                    onPress={() => {
                      setShowEmailForm(false);
                      setError('');
                      setSuccess('');
                    }}
                    className="items-center py-1"
                  >
                    <Text className="text-sm font-medium text-slate-500">
                      Andere Methode wählen
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  {/* Apple (iOS) + Google, no "oder" divider — they're siblings of
                      the e-mail button in the method chooser. */}
                  <SocialAuthButtons
                    mode="register"
                    onError={setError}
                    guard={ensureConsent}
                    showDivider={false}
                  />

                  <Button
                    label="Mit E-Mail registrieren"
                    icon={Mail}
                    onPress={() => {
                      if (!ensureConsent()) return;
                      setError('');
                      setShowEmailForm(true);
                    }}
                  />
                </>
              )}

              <View className="mt-2 flex-row items-center justify-center">
                <Text className="text-sm text-slate-500">Bereits ein Konto? </Text>
                <Pressable onPress={() => router.replace('/login')}>
                  <Text className="text-sm font-semibold text-brand-green-700">Anmelden</Text>
                </Pressable>
              </View>
            </View>
          </View>
          <LegalFooter />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
