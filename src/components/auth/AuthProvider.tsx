import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  registerForPushNotificationsAsync,
  removeCurrentPushToken,
} from '@/lib/notifications';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  emailVerified: boolean;
  refreshVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  emailVerified: true,
  refreshVerification: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [emailVerified, setEmailVerified] = useState(true);
  const [loading, setLoading] = useState(true);

  const checkVerification = useCallback(async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email_verified')
      .eq('id', userId)
      .single();

    if (profile) {
      setEmailVerified(profile.email_verified ?? false);
    }
  }, []);

  const refreshVerification = useCallback(async () => {
    if (user) {
      await checkVerification(user.id);
    }
  }, [user, checkVerification]);

  // Fetch email verification status whenever the user changes.
  useEffect(() => {
    if (!user) {
      setEmailVerified(true);
      return;
    }

    const userId = user.id;
    let mounted = true;
    (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email_verified')
        .eq('id', userId)
        .single();
      if (mounted && profile) {
        setEmailVerified(profile.email_verified ?? false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user]);

  // Register this device for push notifications once a user is signed in. The
  // call is idempotent (upserts the token) and only prompts for the OS
  // permission the first time.
  useEffect(() => {
    if (!user) return;
    void registerForPushNotificationsAsync(user.id);
  }, [user?.id]);

  // Load the initial session (from AsyncStorage) and subscribe to auth changes.
  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (mounted) {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        if (event === 'SIGNED_OUT') {
          removeCurrentPushToken();
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, emailVerified, refreshVerification }}>
      {children}
    </AuthContext.Provider>
  );
}
