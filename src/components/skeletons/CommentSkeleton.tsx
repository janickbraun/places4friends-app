import { View } from 'react-native';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';

/** Placeholder mirroring a CommentsThread row. */
export function CommentSkeleton() {
  return (
    <View className="flex-row gap-2">
      <SkeletonCircle size={24} />
      <View className="flex-1 gap-1.5">
        <Skeleton width={100} height={10} />
        <Skeleton width="70%" height={11} />
      </View>
    </View>
  );
}

/** N comment rows with the thread's spacing. */
export function CommentSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View className="mt-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <CommentSkeleton key={i} />
      ))}
    </View>
  );
}
