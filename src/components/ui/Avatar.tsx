import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { getInitials } from '@/lib/format';

export function Avatar({
  url,
  name,
  size = 36,
}: {
  url?: string | null;
  name?: string | null;
  size?: number;
}) {
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full bg-slate-200"
      style={{ width: size, height: size }}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text className="font-bold text-slate-600" style={{ fontSize: Math.round(size * 0.36) }}>
          {getInitials(name ?? '?')}
        </Text>
      )}
    </View>
  );
}
