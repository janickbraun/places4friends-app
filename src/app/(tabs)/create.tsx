import { Suspense, lazy } from 'react';
import { Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import AuthGate from '@/components/auth/AuthGate';
import { isExpoGo } from '@/lib/runtime';
import { MapLoadingSkeleton } from '@/components/skeletons/MapLoadingSkeleton';

// Lazy so react-native-maps (native) is never imported in Expo Go.
const CreateRecommendation = lazy(() => import('@/components/create/CreateRecommendation'));

export default function CreateScreen() {
  return (
    <AuthGate context="create" headerTitle="Empfehlen">
      {(user) =>
        isExpoGo ? (
          <View className="flex-1 items-center justify-center bg-slate-50 px-8">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-brand-green-100">
              <Plus size={32} color="#226622" />
            </View>
            <Text className="text-center text-base font-bold text-slate-900">
              Empfehlen im Development Build
            </Text>
            <Text className="mt-2 text-center text-sm leading-relaxed text-slate-500">
              Das Empfehlen nutzt die interaktive Karte und ist in Expo Go nicht verfügbar.
              Erstelle einen Development Build.
            </Text>
          </View>
        ) : (
          <Suspense fallback={<MapLoadingSkeleton />}>
            <CreateRecommendation user={user} />
          </Suspense>
        )
      }
    </AuthGate>
  );
}
