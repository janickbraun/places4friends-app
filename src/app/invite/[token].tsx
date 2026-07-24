import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Link2Off } from 'lucide-react-native';
import AuthPrompt from '@/components/AuthPrompt';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { validateInviteLink, type InviteValidationError } from '@/lib/friends';
import { setPendingInvite } from '@/lib/pendingInvite';

/**
 * Landing screen for `https://places4friends.com/invite/<token>` (universal /
 * app link) — the target of every invite link the app hands out.
 *
 * It only resolves the token to its creator and forwards to that profile, where
 * the existing "Einladung annehmen" card does the actual redeeming. Signed-out
 * visitors get an invite-flavoured AuthPrompt, and the token is parked in
 * `pendingInvite` so registering brings them straight back here.
 */

type State = 'resolving' | 'signed_out' | InviteValidationError;

const MESSAGES: Record<InviteValidationError, string> = {
  expired: 'Dieser Einladungslink ist abgelaufen. Bitte deinen Freund um einen neuen Link.',
  max_uses:
    'Dieser Einladungslink wurde bereits zu oft verwendet. Bitte deinen Freund um einen neuen Link.',
  not_found: 'Dieser Einladungslink ist ungültig.',
};

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [state, setState] = useState<State>('resolving');

  useEffect(() => {
    if (loading) return;

    if (!token) {
      setState('not_found');
      return;
    }

    // Signed out: park the token so it survives login/registration, then let
    // the AuthPrompt take over.
    if (!user) {
      setState('signed_out');
      void setPendingInvite({ token });
      return;
    }

    let active = true;
    void validateInviteLink(token).then((result) => {
      if (!active) return;
      if (result.valid && result.creatorId) {
        router.replace({
          pathname: '/profile/[id]',
          params: { id: result.creatorId, invite: token },
        });
        return;
      }
      setState(result.error ?? 'not_found');
    });
    return () => {
      active = false;
    };
  }, [token, user, loading, router]);

  const header = <ScreenHeader title="Einladung" titleClassName="text-lg font-bold text-slate-900" />;

  if (state === 'signed_out') {
    return (
      <View className="flex-1 bg-slate-50">
        {header}
        <AuthPrompt context="invite" />
      </View>
    );
  }

  if (state === 'resolving') {
    return (
      <View className="flex-1 bg-slate-50">
        {header}
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator color="#226622" />
          <Text className="mt-3 text-xs font-medium text-slate-400">
            Einladung wird geprüft...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      {header}
      <View className="flex-1 items-center justify-center px-6">
        <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
          <Link2Off size={30} color="#b45309" />
        </View>
        <Text className="text-sm font-bold text-slate-900">Einladung nicht mehr gültig</Text>
        <Text className="mt-2 max-w-[280px] text-center text-xs leading-relaxed text-slate-500">
          {MESSAGES[state]}
        </Text>
        <View className="mt-8 w-full max-w-[280px]">
          <Button label="Zu den Freunden" onPress={() => router.replace('/friends')} />
        </View>
      </View>
    </View>
  );
}
