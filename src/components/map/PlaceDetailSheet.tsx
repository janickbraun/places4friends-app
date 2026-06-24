import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Navigation, Sparkles, X } from 'lucide-react-native';
import type { MapPin, MapPlaceDetails } from '@/lib/map';
import { openDirections } from '@/lib/navigation';
import { ReportMenu } from '@/components/ReportMenu';
import { CommentsThread } from '@/components/activities/CommentsThread';
import { PlaceDetailSkeleton } from '@/components/skeletons/PlaceDetailSkeleton';

type Props = {
  pin: MapPin | null;
  details: MapPlaceDetails | null;
  loading: boolean;
  currentUserId: string | null;
  onClose: () => void;
};

export function PlaceDetailSheet({ pin, details, loading, currentUserId, onClose }: Props) {
  const router = useRouter();
  const visible = pin !== null;

  const openInMaps = () => {
    if (!pin) return;
    openDirections({ name: pin.name, latitude: pin.latitude, longitude: pin.longitude });
  };

  const openProfile = () => {
    if (!pin) return;
    onClose();
    router.push(`/profile/${pin.userId}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/30" onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Stop propagation: tapping the card should not close. */}
          <Pressable
            className="rounded-t-3xl bg-white px-5 pb-8 pt-3"
            onPress={(e) => e.stopPropagation()}
            style={{ boxShadow: '0px -4px 24px rgba(0,0,0,0.12)' }}
          >
            <View className="mb-3 h-1.5 w-10 self-center rounded-full bg-slate-200" />

            {pin ? (
              <>
                <View className="flex-row items-center justify-between">
                  <Pressable onPress={openProfile} className="flex-1 flex-row items-center gap-2.5">
                    <View
                      className="h-9 w-9 items-center justify-center overflow-hidden rounded-full"
                      style={{ backgroundColor: pin.userColor }}
                    >
                      {pin.userAvatarUrl ? (
                        <Image
                          source={{ uri: pin.userAvatarUrl }}
                          style={{ width: 36, height: 36 }}
                          contentFit="cover"
                        />
                      ) : (
                        <Text className="text-xs font-bold text-white">{pin.userInitials}</Text>
                      )}
                    </View>
                    <Text className="text-sm font-semibold text-slate-700">{pin.userName}</Text>
                  </Pressable>
                  <View className="flex-row items-center gap-1">
                    {currentUserId && pin.userId !== currentUserId ? (
                      <ReportMenu activityId={pin.id} reporterId={currentUserId} iconColor="#334155" />
                    ) : null}
                    <Pressable
                      onPress={onClose}
                      accessibilityRole="button"
                      className="h-8 w-8 items-center justify-center rounded-full bg-slate-100"
                    >
                      <X size={18} color="#334155" />
                    </Pressable>
                  </View>
                </View>

                <View className="mt-3 flex-row items-center gap-2">
                  <Text className="flex-1 text-xl font-bold text-slate-900">{pin.name}</Text>
                  {pin.isMustSee ? (
                    <View className="flex-row items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1">
                      <Sparkles size={12} color="#d97706" />
                      <Text className="text-[11px] font-bold text-amber-700">Must See</Text>
                    </View>
                  ) : null}
                </View>

                {loading ? (
                  <PlaceDetailSkeleton />
                ) : (
                  <ScrollView
                    style={{ maxHeight: 420 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {details?.review ? (
                      <Text className="mt-3 text-sm leading-relaxed text-slate-600">
                        {details.review}
                      </Text>
                    ) : null}

                    {details && details.categories.length > 0 ? (
                      <View className="mt-3 flex-row flex-wrap gap-2">
                        {details.categories.map((c) => (
                          <View key={c} className="rounded-full bg-slate-100 px-3 py-1">
                            <Text className="text-xs font-medium text-slate-600">{c}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {details && details.imageUrls.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4 -mx-1">
                        {details.imageUrls.map((url) => (
                          <Image
                            key={url}
                            source={{ uri: url }}
                            style={{ width: 140, height: 140, borderRadius: 16, marginHorizontal: 4 }}
                            contentFit="cover"
                            transition={150}
                          />
                        ))}
                      </ScrollView>
                    ) : null}

                    <Pressable
                      onPress={openInMaps}
                      accessibilityRole="button"
                      className="mt-5 w-full flex-row items-center justify-center gap-2 rounded-xl bg-brand-green-700 py-3.5"
                    >
                      <Navigation size={16} color="#ffffff" />
                      <Text className="text-sm font-semibold text-white">Route</Text>
                    </Pressable>

                    <CommentsThread activityId={pin.id} currentUserId={currentUserId} />
                  </ScrollView>
                )}
              </>
            ) : null}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
