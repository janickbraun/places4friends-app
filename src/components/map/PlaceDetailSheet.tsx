import { useEffect, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bookmark, MessageCircle, Navigation, Sparkles, X } from 'lucide-react-native';
import type { MapPin, MapPlaceDetails } from '@/lib/map';
import { openDirections } from '@/lib/navigation';
import { addToWishlist, removeFromWishlist } from '@/lib/activities';
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
  const insets = useSafeAreaInsets();
  const visible = pin !== null;

  // Comments stay collapsed until the user taps the comment action — matching
  // the feed's ActivityCard, which only mounts the thread on demand.
  const [showComments, setShowComments] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [savingWishlist, setSavingWishlist] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Collapse comments + close the lightbox whenever a different place opens.
  useEffect(() => {
    setShowComments(false);
    setLightboxUrl(null);
  }, [pin?.id]);

  // Sync the action counts/state once the details for this place load.
  useEffect(() => {
    setSaved(details?.isSaved ?? false);
    setSaveCount(details?.saveCount ?? 0);
    setCommentCount(details?.commentCount ?? 0);
  }, [details]);

  const openInMaps = () => {
    if (!pin) return;
    openDirections({
      name: pin.name,
      address: details?.address ?? null,
      latitude: pin.latitude,
      longitude: pin.longitude,
    });
  };

  const openProfile = () => {
    if (!pin) return;
    onClose();
    router.push(`/profile/${pin.userId}`);
  };

  const toggleSave = async () => {
    if (!pin || !currentUserId || savingWishlist) return;
    const next = !saved;
    setSaved(next);
    setSaveCount((c) => Math.max(0, c + (next ? 1 : -1)));
    setSavingWishlist(true);
    const { error } = next
      ? await addToWishlist(currentUserId, pin.id)
      : await removeFromWishlist(currentUserId, pin.id);
    if (error) {
      // Revert the optimistic update on failure.
      setSaved(!next);
      setSaveCount((c) => Math.max(0, c + (next ? -1 : 1)));
    }
    setSavingWishlist(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/30" onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Stop propagation: tapping the card should not close. */}
          <Pressable
            className="rounded-t-3xl bg-white px-5 pt-3"
            onPress={(e) => e.stopPropagation()}
            style={{ boxShadow: '0px -4px 24px rgba(0,0,0,0.12)', paddingBottom: insets.bottom + 20 }}
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
                      hitSlop={8}
                      className="h-8 w-8 items-center justify-center"
                    >
                      <X size={20} color="#334155" />
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
                    style={{ maxHeight: 440 }}
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
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        className="mt-4 -mx-1"
                      >
                        {details.imageUrls.map((url) => (
                          <Pressable key={url} onPress={() => setLightboxUrl(url)}>
                            <Image
                              source={{ uri: url }}
                              style={{
                                width: 180,
                                height: 180,
                                borderRadius: 16,
                                marginHorizontal: 4,
                              }}
                              contentFit="cover"
                              transition={150}
                            />
                          </Pressable>
                        ))}
                      </ScrollView>
                    ) : null}

                    {/* Bottom actions: save + comment (with counts), and a compact
                        Route button — same layout as the feed's ActivityCard. */}
                    <View className="mt-4 flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3">
                        {currentUserId ? (
                          <Pressable
                            onPress={toggleSave}
                            className="flex-row items-center gap-2 p-1.5"
                            hitSlop={6}
                          >
                            <Bookmark
                              size={24}
                              color={saved ? '#226622' : '#64748b'}
                              fill={saved ? '#226622' : 'transparent'}
                            />
                            {saveCount > 0 ? (
                              <Text
                                className={`text-sm font-semibold ${
                                  saved ? 'text-brand-green-700' : 'text-slate-500'
                                }`}
                              >
                                {saveCount}
                              </Text>
                            ) : null}
                          </Pressable>
                        ) : null}
                        <Pressable
                          onPress={() => setShowComments((v) => !v)}
                          className="flex-row items-center gap-2 p-1.5"
                          hitSlop={6}
                        >
                          <MessageCircle size={22} color={showComments ? '#226622' : '#64748b'} />
                          {commentCount > 0 ? (
                            <Text
                              className={`text-sm font-semibold ${
                                showComments ? 'text-brand-green-700' : 'text-slate-500'
                              }`}
                            >
                              {commentCount}
                            </Text>
                          ) : null}
                        </Pressable>
                      </View>
                      <Pressable
                        onPress={openInMaps}
                        accessibilityRole="button"
                        className="flex-row items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5"
                      >
                        <Navigation size={16} color="#334155" />
                        <Text className="text-sm font-bold text-slate-700">Route</Text>
                      </Pressable>
                    </View>

                    {showComments ? (
                      <CommentsThread
                        activityId={pin.id}
                        currentUserId={currentUserId}
                        onCountChange={setCommentCount}
                      />
                    ) : null}
                  </ScrollView>
                )}
              </>
            ) : null}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>

      {/* Fullscreen image viewer */}
      <Modal
        visible={lightboxUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxUrl(null)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/90"
          onPress={() => setLightboxUrl(null)}
        >
          {lightboxUrl ? (
            <Image source={{ uri: lightboxUrl }} style={{ width: '92%', height: '80%' }} contentFit="contain" />
          ) : null}
          <Pressable
            onPress={() => setLightboxUrl(null)}
            className="absolute right-5 top-14 h-9 w-9 items-center justify-center rounded-full bg-black/60"
          >
            <X size={20} color="#ffffff" />
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}
