import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Activity, MapPin, Plus, User, Users, type LucideIcon } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';

const ACTIVE = '#226622'; // brand-green-600
const INACTIVE = '#94a3b8'; // slate-400

// Minimal structural shape of the props expo-router's <Tabs tabBar> renderer
// passes. Declaring only what we use avoids the dual-package type conflict
// between expo-router's vendored @react-navigation/bottom-tabs and the
// standalone copy.
type BottomNavProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

type TabConfig = { name: string; label: string; icon: LucideIcon };

const TABS: TabConfig[] = [
  { name: 'index', label: 'Karte', icon: MapPin },
  { name: 'activities', label: 'Aktivitäten', icon: Activity },
  { name: 'create', label: 'Empfehlen', icon: Plus },
  { name: 'friends', label: 'Freunde', icon: Users },
  { name: 'profile', label: 'Profil', icon: User },
];

/**
 * Custom bottom tab bar that mirrors the web app's floating nav exactly:
 * brand-green active state, German labels, scale on active, and live badges
 * (pending friend requests, unseen friend activities, unverified-email dot).
 */
export default function BottomNav({ state, navigation }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  const { user, emailVerified } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [unseenActivitiesCount, setUnseenActivitiesCount] = useState(0);

  const activeRouteName = state.routes[state.index]?.name;

  // Latest values the realtime handlers need, without forcing a re-subscribe.
  const friendIdsRef = useRef<string[]>([]);
  const lastSeenRef = useRef<string | null>(null);
  const onActivitiesRef = useRef(false);
  onActivitiesRef.current = activeRouteName === 'activities';

  const fetchPending = useCallback(async (uid: string) => {
    const { count, error } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', uid)
      .eq('status', 'pending');
    if (!error && count !== null) setPendingCount(count);
  }, []);

  const fetchFriendIds = useCallback(async (uid: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from('friendships')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      .eq('status', 'accepted');
    if (error || !data) return [];
    return data.map((f) => (f.sender_id === uid ? f.receiver_id : f.sender_id));
  }, []);

  const markActivitiesSeen = useCallback(async () => {
    const seenAt = new Date().toISOString();
    const { error } = await supabase.auth.updateUser({
      data: { last_activities_seen_at: seenAt },
    });
    if (!error) {
      lastSeenRef.current = seenAt;
      setUnseenActivitiesCount(0);
    }
  }, []);

  const fetchUnseen = useCallback(async (ids: string[]) => {
    if (ids.length === 0 || onActivitiesRef.current) {
      setUnseenActivitiesCount(0);
      return;
    }
    let query = supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .in('user_id', ids);
    if (lastSeenRef.current) query = query.gt('created_at', lastSeenRef.current);
    const { count, error } = await query;
    if (!error && count !== null) setUnseenActivitiesCount(count);
  }, []);

  // Subscribe to realtime ONCE per user (not on every tab change) so we never
  // attach `.on()` to an already-subscribed channel. Unique channel names guard
  // against Fast Refresh double-invocation.
  useEffect(() => {
    if (!user) {
      setPendingCount(0);
      setUnseenActivitiesCount(0);
      friendIdsRef.current = [];
      lastSeenRef.current = null;
      return;
    }

    const uid = user.id;
    lastSeenRef.current =
      typeof user.user_metadata?.last_activities_seen_at === 'string'
        ? (user.user_metadata.last_activities_seen_at as string)
        : null;
    let mounted = true;
    const suffix = Math.random().toString(36).slice(2);

    const refresh = async () => {
      await fetchPending(uid);
      const ids = await fetchFriendIds(uid);
      if (!mounted) return;
      friendIdsRef.current = ids;
      if (onActivitiesRef.current) await markActivitiesSeen();
      else await fetchUnseen(ids);
    };
    void refresh();

    const friendshipsChannel = supabase
      .channel(`pending-friendships:${suffix}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        void refresh();
      })
      .subscribe();

    const activitiesChannel = supabase
      .channel(`friend-activities:${suffix}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activities' },
        (payload) => {
          const newUid = (payload.new as { user_id?: string })?.user_id;
          if (!newUid || !friendIdsRef.current.includes(newUid)) return;
          if (onActivitiesRef.current) void markActivitiesSeen();
          else void fetchUnseen(friendIdsRef.current);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(friendshipsChannel);
      void supabase.removeChannel(activitiesChannel);
    };
  }, [user, fetchPending, fetchFriendIds, markActivitiesSeen, fetchUnseen]);

  // React to tab changes: mark activities seen when entering that tab, else
  // refresh the unseen count.
  useEffect(() => {
    if (!user) return;
    if (activeRouteName === 'activities') void markActivitiesSeen();
    else void fetchUnseen(friendIdsRef.current);
  }, [user, activeRouteName, markActivitiesSeen, fetchUnseen]);

  const badgeFor = (name: string): number => {
    if (name === 'activities') return unseenActivitiesCount;
    if (name === 'friends') return pendingCount;
    if (name === 'profile') return emailVerified ? 0 : 1;
    return 0;
  };

  return (
    <View
      className="absolute bottom-0 left-0 right-0 z-50 w-full border-t border-slate-100 bg-white/90"
      style={{ paddingBottom: insets.bottom, boxShadow: '0px -4px 24px rgba(0,0,0,0.04)' }}
    >
      <View className="h-16 flex-row items-center justify-around px-2">
        {TABS.map((tab) => {
          const isActive = activeRouteName === tab.name;
          const Icon = tab.icon;
          const badge = badgeFor(tab.name);
          return (
            <Pressable
              key={tab.name}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => {
                if (isActive) return;
                navigation.navigate(tab.name);
              }}
              className="w-16 items-center justify-center gap-1 rounded-xl py-2"
              style={{ transform: [{ scale: isActive ? 1.05 : 1 }] }}
            >
              <View className="relative">
                <Icon
                  size={20}
                  color={isActive ? ACTIVE : INACTIVE}
                  strokeWidth={isActive ? 2.6 : 2}
                />
                {badge > 0 && (
                  <View
                    className="absolute -right-1.5 -top-1.5 h-4 w-4 items-center justify-center rounded-full bg-brand-green-600"
                    style={{ borderWidth: 2, borderColor: '#ffffff' }}
                  >
                    <Text className="text-[8px] font-extrabold text-white">{badge}</Text>
                  </View>
                )}
              </View>
              <Text
                className={`text-[10px] tracking-wide ${
                  isActive ? 'font-bold text-brand-green-600' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
