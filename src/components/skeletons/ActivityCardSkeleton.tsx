import { View } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';

/** Placeholder mirroring ActivityCard's layout. */
export function ActivityCardSkeleton() {
  return (
    <View
      className="rounded-2xl border border-slate-100 bg-white p-4"
      style={{ boxShadow: '0px 8px 30px rgba(0,0,0,0.02)' }}
    >
      {/* Title + timestamp */}
      <View className="flex-row items-center justify-between">
        <Skeleton width="55%" height={16} />
        <Skeleton width={56} height={12} />
      </View>

      {/* Image */}
      <Skeleton radius={12} style={{ width: '100%', aspectRatio: 16 / 10, marginTop: 12 }} />

      {/* Description lines */}
      <View className="mt-3 gap-2">
        <Skeleton width="100%" height={12} />
        <Skeleton width="80%" height={12} />
      </View>

      {/* Category pills */}
      <View className="mt-3 flex-row gap-1.5">
        <Skeleton width={56} height={18} radius={9} />
        <Skeleton width={44} height={18} radius={9} />
      </View>

      {/* Bottom actions */}
      <View className="mt-3 flex-row items-center justify-between">
        <Skeleton width={28} height={20} />
        <Skeleton width={96} height={28} radius={8} />
      </View>
    </View>
  );
}

/** Convenience: render N card skeletons with the feed's spacing. */
export function ActivityCardSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View className="gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ActivityCardSkeleton key={i} />
      ))}
    </View>
  );
}
