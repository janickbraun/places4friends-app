import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    if (password.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    if (password !== confirm) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }
    setLoading(true);
    // Requires an active recovery session, established by opening the reset link
    // (deep-link handling is wired in the deep-linking task).
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message || 'Das Passwort konnte nicht aktualisiert werden.');
      return;
    }
    setSuccess('Dein Passwort wurde aktualisiert.');
    setTimeout(() => router.replace('/'), 800);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="flex-1 justify-center px-6 py-8">
            <Text className="text-2xl font-bold text-slate-900">Neues Passwort</Text>
            <Text className="mt-1 text-sm text-slate-500">
              Lege ein neues Passwort für dein Konto fest.
            </Text>

            <View className="mt-8 gap-4">
              <TextField
                label="Neues Passwort"
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
                value={confirm}
                onChangeText={setConfirm}
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
                <View className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-2.5">
                  <Text className="text-xs font-medium text-emerald-700">{success}</Text>
                </View>
              ) : null}

              <Button label="Passwort speichern" trailingArrow loading={loading} onPress={handleSubmit} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
