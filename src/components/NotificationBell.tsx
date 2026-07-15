import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useUnreadNotificationCount } from '@/lib/notificationFeed';

/**
 * Bell button for the profile header. Shows a live unread badge (same style as
 * the BottomNav badges) and opens the notifications screen, which marks
 * everything read — clearing the badge.
 */
export function NotificationBell({ userId }: { userId: string }) {
  const { count } = useUnreadNotificationCount(userId);
  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      accessibilityLabel="Benachrichtigungen"
      className="h-9 w-9 items-center justify-center rounded-full"
      hitSlop={6}
    >
      <View className="relative">
        <Bell size={18} color="#64748b" />
        {count > 0 && (
          <View
            className="absolute -right-1.5 -top-1.5 h-4 min-w-4 items-center justify-center rounded-full bg-brand-green-600 px-0.5"
            style={{ borderWidth: 2, borderColor: '#ffffff' }}
          >
            <Text className="text-[8px] font-extrabold text-white">{count > 9 ? '9+' : count}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
