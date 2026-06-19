import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthPrompt, { type AuthContext } from '@/components/AuthPrompt';
import { useAuth } from '@/components/auth/AuthProvider';

interface AuthGateProps {
  context: AuthContext;
  headerTitle: string;
  children: (user: User) => ReactNode;
}

/**
 * Wraps a protected screen: shows a spinner while auth loads, an AuthPrompt when
 * signed out, otherwise renders children with the authenticated user. Mirrors the
 * web app's AuthGate (render-prop) behaviour.
 */
export default function AuthGate({ context, headerTitle, children }: AuthGateProps) {
  const { user, loading } = useAuth();

  const shell = (content: ReactNode) => (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      <View className="h-14 items-center justify-center border-b border-slate-100 bg-white px-4">
        <Text className="text-lg font-bold text-slate-900">{headerTitle}</Text>
      </View>
      {content}
    </SafeAreaView>
  );

  if (loading) {
    return shell(
      <View className="flex-1 items-center justify-center py-16">
        <ActivityIndicator color="#226622" />
      </View>,
    );
  }

  if (!user) {
    return shell(<AuthPrompt context={context} />);
  }

  return <>{children(user)}</>;
}
