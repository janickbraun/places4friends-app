import { useEffect } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bell,
  Bookmark,
  MapPin,
  MessageCircle,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from 'lucide-react-native';
import type { User } from '@supabase/supabase-js';
import AuthGate from '@/components/auth/AuthGate';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { formatTimestamp } from '@/lib/format';
import {
  fetchNotifications,
  markAllNotificationsRead,
  type AppNotification,
  type NotificationType,
} from '@/lib/notificationFeed';

const ICON_FOR: Record<NotificationType, LucideIcon> = {
  new_place: MapPin,
  comment: MessageCircle,
  save: Bookmark,
  friend_request: UserPlus,
  friend_accept: UserCheck,
};

// Friend events open the Freunde tab; post events open the feed — mirrors the
// push-tap routing in _layout.tsx.
function routeForType(type: NotificationType): '/friends' | '/activities' {
  return type === 'friend_request' || type === 'friend_accept' ? '/friends' : '/activities';
}

function NotificationRow({ item }: { item: AppNotification }) {
  const Icon = ICON_FOR[item.type] ?? Bell;
  const unread = item.readAt === null;
  return (
    <Pressable
      onPress={() => router.push(routeForType(item.type))}
      className={`flex-row items-start gap-3 px-4 py-3 ${unread ? 'bg-brand-green-50' : 'bg-white'}`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-green-600">
        <Icon size={18} color="#ffffff" strokeWidth={2.2} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900">{item.title}</Text>
        <Text className="mt-0.5 text-sm text-slate-600">{item.body}</Text>
        <Text className="mt-1 text-xs text-slate-400">{formatTimestamp(item.createdAt)}</Text>
      </View>
      {unread && <View className="mt-1.5 h-2 w-2 rounded-full bg-brand-green-600" />}
    </Pressable>
  );
}

function NotificationsList({ user }: { user: User }) {
  const {
    data: notifications = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['notifications', user.id],
    queryFn: () => fetchNotifications(user.id),
  });

  // Opening the screen marks everything seen, so the bell badge clears.
  useEffect(() => {
    void markAllNotificationsRead(user.id);
  }, [user.id]);

  return (
    <View className="flex-1 bg-slate-50">
      <ScreenHeader
        title="Benachrichtigungen"
        titleClassName="text-lg font-bold text-slate-900"
        left={
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="Zurück"
            className="h-8 w-8 items-center justify-center rounded-lg"
          >
            <ArrowLeft size={20} color="#64748b" />
          </Pressable>
        }
      />
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <NotificationRow item={item} />}
        ItemSeparatorComponent={() => <View className="h-px bg-slate-100" />}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              void refetch();
            }}
            tintColor="#226622"
            colors={['#226622']}
          />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View className="items-center px-8 py-24">
              <Bell size={40} color="#cbd5e1" />
              <Text className="mt-4 text-center text-sm text-slate-400">
                Noch keine Benachrichtigungen.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

export default function NotificationsScreen() {
  return (
    <AuthGate context="profile" headerTitle="Benachrichtigungen">
      {(user) => <NotificationsList user={user} />}
    </AuthGate>
  );
}
