import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { ActivityIndicator, View } from 'react-native';
import AuthPrompt, { type AuthContext } from '@/components/AuthPrompt';
import { useAuth } from '@/components/auth/AuthProvider';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

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
    <View className="flex-1 bg-slate-50">
      <ScreenHeader title={headerTitle} titleClassName="text-lg font-bold text-slate-900" />
      {content}
    </View>
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
