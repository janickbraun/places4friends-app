import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { getInitials, getUserColor } from '@/lib/format';

export function Avatar({
  url,
  name,
  id,
  size = 36,
}: {
  url?: string | null;
  name?: string | null;
  /** Stable key (user id) for a consistent fallback color. Falls back to name. */
  id?: string | null;
  size?: number;
}) {
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size, backgroundColor: getUserColor(id ?? name ?? '?') }}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text className="font-bold text-white" style={{ fontSize: Math.round(size * 0.36) }}>
          {getInitials(name ?? '?')}
        </Text>
      )}
    </View>
  );
}
