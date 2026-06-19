import { Text, View } from 'react-native';
import AuthGate from '@/components/auth/AuthGate';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  return (
    <AuthGate context="profile" headerTitle="Profil">
      {(user) => (
        <View className="flex-1 items-center justify-center bg-slate-50 px-6">
          <Text className="text-sm text-slate-500">Angemeldet als</Text>
          <Text className="mt-1 text-lg font-bold text-slate-900">{user.email}</Text>
          <View className="mt-6 w-full max-w-[280px]">
            <Button
              label="Abmelden"
              variant="secondary"
              onPress={() => supabase.auth.signOut()}
            />
          </View>
        </View>
      )}
    </AuthGate>
  );
}
