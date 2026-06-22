import { View } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';

/** Placeholder for the place detail sheet body (review, categories, images, route). */
export function PlaceDetailSkeleton() {
  return (
    <View className="pt-3">
      {/* Review lines */}
      <View className="gap-2">
        <Skeleton width="100%" height={13} />
        <Skeleton width="92%" height={13} />
        <Skeleton width="60%" height={13} />
      </View>

      {/* Category pills */}
      <View className="mt-4 flex-row gap-2">
        <Skeleton width={64} height={24} radius={12} />
        <Skeleton width={48} height={24} radius={12} />
      </View>

      {/* Image strip */}
      <View className="mt-4 flex-row gap-2">
        <Skeleton width={140} height={140} radius={16} />
        <Skeleton width={140} height={140} radius={16} />
      </View>

      {/* Route button */}
      <Skeleton width="100%" height={48} radius={12} style={{ marginTop: 20 }} />
    </View>
  );
}
