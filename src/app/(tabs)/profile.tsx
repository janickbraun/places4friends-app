import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import type { User } from '@supabase/supabase-js';
import { LogOut, MapPin, Trash2 } from 'lucide-react-native';
import AuthGate from '@/components/auth/AuthGate';
import ActivityCard from '@/components/ActivityCard';
import { supabase } from '@/lib/supabase';
import { getInitials, getUserColor } from '@/lib/format';
import type { FeedActivity } from '@/lib/activities';
import {
  deleteActivity,
  fetchProfileInfo,
  fetchProfileStats,
  fetchUserActivities,
  fetchWishlistActivities,
  type ProfileInfo,
  type ProfileStats,
} from '@/lib/profile';

type Tab = 'recs' | 'saved';

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="items-center">
      <Text className="text-lg font-bold text-slate-900">{value}</Text>
      <Text className="text-[11px] text-slate-500">{label}</Text>
    </View>
  );
}

function ProfileContent({ user }: { user: User }) {
  const [info, setInfo] = useState<ProfileInfo | null>(null);
  const [stats, setStats] = useState<ProfileStats>({ recommendations: 0, friends: 0, saves: 0 });
  const [recs, setRecs] = useState<FeedActivity[]>([]);
  const [saved, setSaved] = useState<FeedActivity[]>([]);
  const [tab, setTab] = useState<Tab>('recs');
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const [infoRes, statsRes, recsRes, savedRes] = await Promise.all([
      fetchProfileInfo(user.id),
      fetchProfileStats(user.id),
      fetchUserActivities(user.id),
      fetchWishlistActivities(user.id),
    ]);
    if (!mounted.current) return;
    setInfo(infoRes);
    setStats(statsRes);
    setRecs(recsRes);
    setSaved(savedRes);
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const confirmSignOut = () => {
    Alert.alert('Abmelden?', 'Möchtest du dich wirklich abmelden?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Abmelden', style: 'destructive', onPress: () => void supabase.auth.signOut() },
    ]);
  };

  const confirmDelete = (activity: FeedActivity) => {
    Alert.alert('Empfehlung löschen?', `"${activity.placeName}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          await deleteActivity(activity.id, activity.imageUrls);
          await load();
        },
      },
    ]);
  };

  const name = info?.fullName ?? info?.username ?? 'Profil';
  const data = tab === 'recs' ? recs : saved;

  const ListHeader = (
    <View>
      {/* Identity */}
      <View className="items-center pt-6">
        <View
          className="h-20 w-20 items-center justify-center overflow-hidden rounded-full"
          style={{ backgroundColor: getUserColor(user.id) }}
        >
          {info?.avatarUrl ? (
            <Image source={{ uri: info.avatarUrl }} style={{ width: 80, height: 80 }} contentFit="cover" />
          ) : (
            <Text className="text-2xl font-bold text-white">{getInitials(name)}</Text>
          )}
        </View>
        <Text className="mt-3 text-lg font-bold text-slate-900">{name}</Text>
        {info?.username ? (
          <Text className="text-sm text-slate-500">@{info.username}</Text>
        ) : null}
        {user.email ? <Text className="mt-0.5 text-xs text-slate-400">{user.email}</Text> : null}
      </View>

      {/* Stats */}
      <View className="mt-6 flex-row justify-around rounded-2xl border border-slate-100 bg-white py-4">
        <Stat value={stats.recommendations} label="Empfehlungen" />
        <Stat value={stats.friends} label="Freunde" />
        <Stat value={stats.saves} label="Gespeichert" />
      </View>

      {/* Tabs */}
      <View className="mt-6 flex-row border-b border-slate-200">
        {(['recs', 'saved'] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              className="flex-1 items-center pb-3"
              style={active ? { borderBottomWidth: 2, borderBottomColor: '#226622' } : undefined}
            >
              <Text
                className={`text-sm font-semibold ${active ? 'text-brand-green-700' : 'text-slate-400'}`}
              >
                {t === 'recs' ? 'Empfehlungen' : 'Gespeichert'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
        <View className="h-14 flex-row items-center justify-center border-b border-slate-100 bg-white">
          <Text className="text-sm font-bold text-slate-900">Profil</Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#226622" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      <View className="h-14 flex-row items-center justify-center border-b border-slate-100 bg-white">
        <Text className="text-sm font-bold text-slate-900">Profil</Text>
        <Pressable
          onPress={confirmSignOut}
          accessibilityLabel="Abmelden"
          className="absolute right-3 h-9 w-9 items-center justify-center rounded-full"
          hitSlop={6}
        >
          <LogOut size={18} color="#64748b" />
        </Pressable>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 16 }}
        ListEmptyComponent={
          <View className="mt-10 items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12">
            <MapPin size={32} color="#cbd5e1" />
            <Text className="mt-3 text-center text-xs leading-relaxed text-slate-500">
              {tab === 'recs'
                ? 'Du hast noch keine Orte empfohlen.'
                : 'Du hast noch keine Orte gespeichert.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ActivityCard
            id={item.id}
            placeName={item.placeName}
            latitude={item.latitude}
            longitude={item.longitude}
            isMustSee={item.isMustSee}
            description={item.description}
            categories={item.categories}
            timestamp={item.timestamp}
            friend={tab === 'saved' ? item.friend : undefined}
            imageUrls={item.imageUrls}
            bottomLeftActions={
              tab === 'recs' ? (
                <Pressable
                  onPress={() => confirmDelete(item)}
                  className="flex-row items-center gap-1.5 p-1"
                  hitSlop={6}
                >
                  <Trash2 size={18} color="#f43f5e" />
                </Pressable>
              ) : undefined
            }
          />
        )}
      />
    </SafeAreaView>
  );
}

export default function ProfileScreen() {
  return (
    <AuthGate context="profile" headerTitle="Profil">
      {(user) => <ProfileContent user={user} />}
    </AuthGate>
  );
}
