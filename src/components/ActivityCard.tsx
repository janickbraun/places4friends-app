import { type ReactNode, useState } from 'react';
import { Linking, Modal, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { MapPin, Navigation, Sparkles, X } from 'lucide-react-native';
import type { FeedFriend } from '@/lib/activities';

type Props = {
  id: string;
  placeName: string;
  latitude?: number | null;
  longitude?: number | null;
  isMustSee?: boolean;
  description?: string;
  categories?: string[];
  timestamp?: string;
  friend?: FeedFriend;
  onPressFriend?: (friendId: string) => void;
  imageUrls?: string[];
  bottomLeftActions?: ReactNode;
  headerAction?: ReactNode;
  children?: ReactNode;
};

/** Place recommendation card — mirrors the web ActivityCard layout. */
export default function ActivityCard({
  placeName,
  latitude,
  longitude,
  isMustSee = false,
  description,
  categories = [],
  timestamp,
  friend,
  onPressFriend,
  imageUrls = [],
  bottomLeftActions,
  headerAction,
  children,
}: Props) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const hasCoords = latitude != null && longitude != null;
  const single = imageUrls.length === 1;

  const openMaps = () => {
    const url = hasCoords
      ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View
      className="rounded-2xl border border-slate-100 bg-white p-4"
      style={{ boxShadow: '0px 8px 30px rgba(0,0,0,0.02)' }}
    >
      {/* Top: place name + must-see + timestamp */}
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-1.5">
          <MapPin size={16} color="#226622" />
          <Text className="flex-1 text-base font-bold text-slate-900">{placeName}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          {isMustSee ? (
            <View className="flex-row items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5">
              <Sparkles size={12} color="#f59e0b" fill="#fbbf24" />
              <Text className="text-[10px] font-bold text-amber-700">Must See</Text>
            </View>
          ) : null}
          {timestamp ? (
            <Text className="text-[10px] font-medium text-slate-400">{timestamp}</Text>
          ) : null}
          {headerAction}
        </View>
      </View>

      {/* Images */}
      {imageUrls.length > 0 ? (
        <View className="flex-row flex-wrap gap-2 pt-3">
          {imageUrls.map((url) => (
            <Pressable
              key={url}
              onPress={() => setLightboxUrl(url)}
              style={{ width: single ? '100%' : '48%' }}
            >
              <Image
                source={{ uri: url }}
                style={{ width: '100%', aspectRatio: single ? 16 / 10 : 1, borderRadius: 12 }}
                contentFit="cover"
                transition={150}
              />
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Description */}
      {description && description.trim() !== '' ? (
        <Text className="pt-3 text-sm leading-relaxed text-slate-600">{description}</Text>
      ) : null}

      {/* Categories */}
      {categories.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5 pt-3">
          {categories.map((category) => (
            <View
              key={category}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5"
            >
              <Text className="text-[10px] font-semibold text-slate-600">{category}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Friend header */}
      {friend ? (
        <Pressable
          className="flex-row items-center gap-2 pt-3"
          disabled={!onPressFriend}
          onPress={() => onPressFriend?.(friend.id)}
          hitSlop={4}
        >
          <View
            className="h-6 w-6 items-center justify-center overflow-hidden rounded-full"
            style={{ backgroundColor: friend.color }}
          >
            {friend.avatarUrl ? (
              <Image source={{ uri: friend.avatarUrl }} style={{ width: 24, height: 24 }} contentFit="cover" />
            ) : (
              <Text className="text-[9px] font-bold text-white">{friend.initials}</Text>
            )}
          </View>
          <Text className="text-[11px] font-bold text-slate-700">{friend.name}</Text>
        </Pressable>
      ) : null}

      {/* Bottom actions */}
      <View className="mt-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">{bottomLeftActions}</View>
        <Pressable
          onPress={openMaps}
          accessibilityRole="button"
          className="flex-row items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5"
        >
          <Navigation size={14} color="#334155" />
          <Text className="text-[11px] font-bold text-slate-700">Navigation</Text>
        </Pressable>
      </View>

      {children}

      {/* Lightbox */}
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
            <Image
              source={{ uri: lightboxUrl }}
              style={{ width: '92%', height: '80%' }}
              contentFit="contain"
            />
          ) : null}
          <Pressable
            onPress={() => setLightboxUrl(null)}
            className="absolute right-5 top-14 h-9 w-9 items-center justify-center rounded-full bg-black/60"
          >
            <X size={20} color="#ffffff" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
