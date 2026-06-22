import { Suspense, lazy } from 'react';
import { Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { isExpoGo } from '@/lib/runtime';
import { MapLoadingSkeleton } from '@/components/skeletons/MapLoadingSkeleton';

// Lazy so react-native-maps (a native module) is never imported in Expo Go.
const MapCanvas = lazy(() => import('@/components/map/MapCanvas'));

export default function MapScreen() {
  if (isExpoGo) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-8">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-brand-green-100">
          <MapPin size={32} color="#226622" />
        </View>
        <Text className="text-center text-base font-bold text-slate-900">
          Karte im Development Build
        </Text>
        <Text className="mt-2 text-center text-sm leading-relaxed text-slate-500">
          Die interaktive Karte ist in Expo Go nicht verfügbar. Erstelle einen Development Build,
          um sie zu sehen.
        </Text>
      </View>
    );
  }

  return (
    <Suspense fallback={<MapLoadingSkeleton />}>
      <MapCanvas />
    </Suspense>
  );
}
