import { View } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';

function MenuRowSkeleton() {
  return (
    <View className="flex-row items-center justify-between p-4">
      <View className="flex-1 flex-row items-center gap-3">
        <Skeleton width={40} height={40} radius={16} />
        <View className="flex-1 gap-1.5">
          <Skeleton width="45%" height={13} />
          <Skeleton width="70%" height={11} />
        </View>
      </View>
      <Skeleton width={16} height={16} radius={8} />
    </View>
  );
}

function Group({ rows }: { rows: number }) {
  return (
    <View className="gap-1.5">
      <Skeleton width={140} height={10} style={{ marginLeft: 12 }} />
      <View className="overflow-hidden rounded-3xl border border-slate-100 bg-white">
        {Array.from({ length: rows }).map((_, i) => (
          <View key={i}>
            {i > 0 ? <View className="h-px bg-slate-50" /> : null}
            <MenuRowSkeleton />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Placeholder mirroring the grouped settings menu. */
export function SettingsSkeleton() {
  return (
    <View className="gap-6 p-4">
      <Group rows={2} />
      <Group rows={2} />
      <Group rows={1} />
      <Skeleton width="100%" height={52} radius={24} />
    </View>
  );
}
