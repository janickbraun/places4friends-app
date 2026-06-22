import { View } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Full-screen placeholder for the lazy-loaded map / create screens. There is no
 * map content shape to mirror, so we show a muted surface with a search-bar bone.
 */
export function MapLoadingSkeleton() {
  return (
    <View className="flex-1 bg-slate-100">
      <View className="px-4 pt-16">
        <Skeleton width="100%" height={48} radius={16} />
      </View>
    </View>
  );
}
