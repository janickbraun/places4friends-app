import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { User } from '@supabase/supabase-js';
import { LogOut, MapPin, MessageCircle, Pencil, Settings, Trash2 } from 'lucide-react-native';
import AuthGate from '@/components/auth/AuthGate';
import ActivityCard from '@/components/ActivityCard';
import { CommentsThread } from '@/components/activities/CommentsThread';
import { PopoverMenu } from '@/components/ui/PopoverMenu';
import VerificationBanner from '@/components/VerificationBanner';
import LegalFooter from '@/components/LegalFooter';
import EditRecommendationSheet from '@/components/EditRecommendationSheet';
import { supabase } from '@/lib/supabase';
import { getInitials, getUserColor } from '@/lib/format';
import type { FeedActivity } from '@/lib/activities';
import {
  deleteActivity,
  fetchProfileInfo,
  fetchProfileStats,
  fetchUserActivities,
  fetchWishlistActivities,
  uploadAvatar,
  type ProfileInfo,
  type ProfileStats,
} from '@/lib/profile';

type Tab = 'recs' | 'saved';

function ProfileContent({ user }: { user: User }) {
  const router = useRouter();
  const [info, setInfo] = useState<ProfileInfo | null>(null);
  const [stats, setStats] = useState<ProfileStats>({ recommendations: 0, friends: 0, saves: 0 });
  const [recs, setRecs] = useState<FeedActivity[]>([]);
  const [saved, setSaved] = useState<FeedActivity[]>([]);
  const [tab, setTab] = useState<Tab>('recs');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FeedActivity | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
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
    const counts: Record<string, number> = {};
    for (const a of [...recsRes, ...savedRes]) counts[a.id] = a.commentCount;
    setCommentCounts(counts);
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

  const pickAvatar = async () => {
    if (uploadingAvatar) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Zugriff erforderlich',
        'Bitte erlaube den Zugriff auf deine Fotos, um ein Profilbild auszuwählen.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.92,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      await uploadAvatar(user.id, result.assets[0]);
      await load();
    } catch {
      Alert.alert('Fehler', 'Das Profilbild konnte nicht aktualisiert werden.');
    } finally {
      if (mounted.current) setUploadingAvatar(false);
    }
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
        <Pressable onPress={pickAvatar} disabled={uploadingAvatar} accessibilityLabel="Profilbild ändern">
          <View
            className="h-24 w-24 items-center justify-center overflow-hidden rounded-full"
            style={{ backgroundColor: getUserColor(user.id) }}
          >
            {info?.avatarUrl ? (
              <Image source={{ uri: info.avatarUrl }} style={{ width: 96, height: 96 }} contentFit="cover" />
            ) : (
              <Text className="text-3xl font-bold text-white">{getInitials(name)}</Text>
            )}
            {uploadingAvatar ? (
              <View className="absolute inset-0 items-center justify-center bg-black/40">
                <ActivityIndicator color="#ffffff" />
              </View>
            ) : null}
          </View>
          <View className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full border-2 border-slate-50 bg-slate-900">
            <Pencil size={15} color="#ffffff" />
          </View>
        </Pressable>
        <Text className="mt-4 text-2xl font-bold text-slate-900">{name}</Text>
        {info?.username ? (
          <Text className="mt-1 text-base font-semibold text-brand-green-700">@{info.username}</Text>
        ) : null}
        <Pressable onPress={() => router.push('/friends')} hitSlop={6} className="mt-2">
          <Text className="text-sm font-medium text-slate-500">
            {stats.friends} {stats.friends === 1 ? 'Freund' : 'Freunde'}
          </Text>
        </Pressable>
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
      <VerificationBanner />
      <View className="h-14 flex-row items-center justify-center border-b border-slate-100 bg-white">
        <Text className="text-sm font-bold text-slate-900">Profil</Text>
        <Pressable
          onPress={confirmSignOut}
          accessibilityLabel="Abmelden"
          className="absolute left-3 h-9 w-9 items-center justify-center rounded-full"
          hitSlop={6}
        >
          <LogOut size={18} color="#64748b" />
        </Pressable>
        <Pressable
          onPress={() => router.push('/profile/settings')}
          accessibilityLabel="Einstellungen"
          className="absolute right-3 h-9 w-9 items-center justify-center rounded-full"
          hitSlop={6}
        >
          <Settings size={18} color="#64748b" />
        </Pressable>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={<LegalFooter />}
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
        renderItem={({ item }) => {
          const commentCount = commentCounts[item.id] ?? item.commentCount;
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
              friend={tab === 'saved' ? item.friend : undefined}
              onPressFriend={tab === 'saved' ? (id) => router.push(`/profile/${id}`) : undefined}
              imageUrls={item.imageUrls}
              headerAction={
                tab === 'recs' ? (
                  <PopoverMenu
                    items={[
                      { label: 'Bearbeiten', icon: Pencil, onPress: () => setEditing(item) },
                      {
                        label: 'Löschen',
                        icon: Trash2,
                        destructive: true,
                        onPress: () => confirmDelete(item),
                      },
                    ]}
                  />
                ) : undefined
              }
              bottomLeftActions={
                <Pressable
                  onPress={() => setActiveId((prev) => (prev === item.id ? null : item.id))}
                  className="flex-row items-center gap-1.5 p-1"
                  hitSlop={6}
                >
                  <MessageCircle size={18} color="#64748b" />
                  {commentCount > 0 ? (
                    <Text className="text-[11px] font-semibold text-slate-500">{commentCount}</Text>
                  ) : null}
                </Pressable>
              }
            >
              {activeId === item.id ? (
                <CommentsThread
                  activityId={item.id}
                  currentUserId={user.id}
                  onCountChange={(n) => setCommentCounts((prev) => ({ ...prev, [item.id]: n }))}
                />
              ) : null}
            </ActivityCard>
          );
        }}
      />

      <EditRecommendationSheet
        activity={editing}
        userId={user.id}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
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
