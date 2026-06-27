import { View } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';

/** Placeholder for the place detail sheet body (review, categories, images,
 *  and the save/comment/route action row). Comments start collapsed, so no
 *  comment placeholders are shown. */
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
        <Skeleton width={180} height={180} radius={16} />
        <Skeleton width={180} height={180} radius={16} />
      </View>

      {/* Bottom actions: save + comment on the left, compact route pill on the right */}
      <View className="mt-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <Skeleton width={28} height={20} radius={6} />
          <Skeleton width={28} height={20} radius={6} />
        </View>
        <Skeleton width={86} height={30} radius={8} />
      </View>
    </View>
  );
}
