import { View } from 'react-native';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';

/** Placeholder mirroring a PersonRow (avatar + name/username + trailing action). */
export function PersonRowSkeleton() {
  return (
    <View className="flex-row items-center justify-between py-3">
      <View className="flex-1 flex-row items-center gap-3">
        <SkeletonCircle size={36} />
        <View className="gap-1.5">
          <Skeleton width={120} height={12} />
          <Skeleton width={72} height={10} />
        </View>
      </View>
      <Skeleton width={32} height={28} radius={8} />
    </View>
  );
}

/** N person rows inside the standard list card. */
export function PersonRowSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View className="rounded-2xl border border-slate-100 bg-white px-3">
      {Array.from({ length: count }).map((_, i) => (
        <PersonRowSkeleton key={i} />
      ))}
    </View>
  );
}
