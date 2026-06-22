import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { RealtimeChannel, User } from '@supabase/supabase-js';
import { Bookmark, Compass, MessageCircle, Users } from 'lucide-react-native';
import AuthGate from '@/components/auth/AuthGate';
import ActivityCard from '@/components/ActivityCard';
import VerificationBanner from '@/components/VerificationBanner';
import { CommentsThread } from '@/components/activities/CommentsThread';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import {
  addToWishlist,
  fetchActivitiesFeed,
  removeFromWishlist,
  type FeedActivity,
} from '@/lib/activities';

function Feed({ user }: { user: User }) {
  const router = useRouter();
  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [saveCounts, setSaveCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      const { activities: list, wishlistedIds } = await fetchActivitiesFeed(user.id);
      if (!mounted.current) return;
      const sc: Record<string, number> = {};
      const cc: Record<string, number> = {};
      list.forEach((a) => {
        sc[a.id] = a.saveCount;
        cc[a.id] = a.commentCount;
      });
      setActivities(list);
      setWishlistIds(wishlistedIds);
      setSaveCounts(sc);
      setCommentCounts(cc);
      setLoading(false);
    },
    [user.id],
  );

  useEffect(() => {
    mounted.current = true;
    void load();
    const suffix = Math.random().toString(36).slice(2);
    const channel: RealtimeChannel = supabase
      .channel(`activities-feed:${suffix}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, () =>
        load({ silent: true }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () =>
        load({ silent: true }),
      )
      .subscribe();
    return () => {
      mounted.current = false;
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const toggleWishlist = async (activityId: string) => {
    const saved = wishlistIds.includes(activityId);
    setWishlistIds((prev) =>
      saved ? prev.filter((id) => id !== activityId) : [...prev, activityId],
    );
    setSaveCounts((prev) => ({
      ...prev,
      [activityId]: Math.max(0, (prev[activityId] ?? 0) + (saved ? -1 : 1)),
    }));
    const { error } = saved
      ? await removeFromWishlist(user.id, activityId)
      : await addToWishlist(user.id, activityId);
    if (error) {
      setWishlistIds((prev) =>
        saved ? [...prev, activityId] : prev.filter((id) => id !== activityId),
      );
      setSaveCounts((prev) => ({
        ...prev,
        [activityId]: Math.max(0, (prev[activityId] ?? 0) + (saved ? 1 : -1)),
      }));
    }
  };

  const Header = (
    <View className="h-14 items-center justify-center border-b border-slate-100 bg-white">
      <Text className="text-sm font-bold text-slate-900">Feed</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
        {Header}
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#226622" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      <VerificationBanner />
      {Header}
      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View className="mt-10 items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14">
            <Compass size={36} color="#cbd5e1" />
            <Text className="mt-3 text-sm font-bold text-slate-800">Noch keine Aktivitäten</Text>
            <Text className="mt-1.5 max-w-[240px] text-center text-xs leading-relaxed text-slate-500">
              Füge Freunde hinzu, um deren Empfehlungen und Aktivitäten hier zu sehen.
            </Text>
            <View className="mt-5 w-48">
              <Button label="Freunde finden" icon={Users} onPress={() => router.push('/friends')} />
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const saved = wishlistIds.includes(item.id);
          const saveCount = saveCounts[item.id] ?? 0;
          const commentCount = commentCounts[item.id] ?? 0;
          return (
            <ActivityCard
              id={item.id}
              placeName={item.placeName}
              latitude={item.latitude}
              longitude={item.longitude}
              isMustSee={item.isMustSee}
              description={item.description}
              categories={item.categories}
              timestamp={item.timestamp}
              friend={item.friend}
              onPressFriend={(id) => router.push(`/profile/${id}`)}
              imageUrls={item.imageUrls}
              bottomLeftActions={
                <>
                  <Pressable
                    onPress={() => toggleWishlist(item.id)}
                    className="flex-row items-center gap-1.5 p-1"
                    hitSlop={6}
                  >
                    <Bookmark
                      size={20}
                      color={saved ? '#226622' : '#64748b'}
                      fill={saved ? '#226622' : 'transparent'}
                    />
                    {saveCount > 0 ? (
                      <Text
                        className={`text-[11px] font-semibold ${
                          saved ? 'text-brand-green-700' : 'text-slate-500'
                        }`}
                      >
                        {saveCount}
                      </Text>
                    ) : null}
                  </Pressable>
                  <Pressable
                    onPress={() => setActiveId((prev) => (prev === item.id ? null : item.id))}
                    className="flex-row items-center gap-1.5 p-1"
                    hitSlop={6}
                  >
                    <MessageCircle size={18} color="#64748b" />
                    {commentCount > 0 ? (
                      <Text className="text-[11px] font-semibold text-slate-500">
                        {commentCount}
                      </Text>
                    ) : null}
                  </Pressable>
                </>
              }
            >
              {activeId === item.id ? (
                <CommentsThread
                  activityId={item.id}
                  currentUserId={user.id}
                  onCountChange={(n) =>
                    setCommentCounts((prev) => ({ ...prev, [item.id]: n }))
                  }
                />
              ) : null}
            </ActivityCard>
          );
        }}
      />
    </SafeAreaView>
  );
}

export default function ActivitiesScreen() {
  return (
    <AuthGate context="activities" headerTitle="Feed">
      {(user) => <Feed user={user} />}
    </AuthGate>
  );
}
