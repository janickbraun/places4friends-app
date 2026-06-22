import { View } from 'react-native';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';

/** Placeholder mirroring the profile / public-profile identity header. */
export function ProfileHeaderSkeleton({ avatarSize = 96 }: { avatarSize?: number }) {
  return (
    <View className="items-center pt-6">
      <SkeletonCircle size={avatarSize} />
      <Skeleton width={160} height={20} style={{ marginTop: 16 }} />
      <Skeleton width={96} height={14} style={{ marginTop: 8 }} />
      <Skeleton width={64} height={12} style={{ marginTop: 8 }} />
    </View>
  );
}
