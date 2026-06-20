import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Marker } from 'react-native-maps';
import { Star } from 'lucide-react-native';
import type { MapPin } from '@/lib/map';

type Coord = { latitude: number; longitude: number };

/**
 * Visual body of a place marker: avatar photo (falling back to initials) on the
 * per-user color, with an amber ring + star badge for Must-See places (web parity).
 */
function MarkerBody({ pin, onAvatarLoad }: { pin: MapPin; onAvatarLoad?: () => void }) {
  return (
    <View className="items-center justify-center">
      <View
        className="h-10 w-10 items-center justify-center overflow-hidden rounded-full"
        style={{
          backgroundColor: pin.userColor,
          borderWidth: 2.5,
          borderColor: pin.isMustSee ? '#f59e0b' : '#ffffff',
          boxShadow: '0px 1px 3px rgba(0,0,0,0.3)',
        }}
      >
        {pin.userAvatarUrl ? (
          <Image
            source={{ uri: pin.userAvatarUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
            onLoad={onAvatarLoad}
          />
        ) : (
          <Text className="text-xs font-bold text-white">{pin.userInitials}</Text>
        )}
      </View>
      {pin.isMustSee ? (
        <View
          className="absolute -right-1 -top-1 h-4 w-4 items-center justify-center rounded-full bg-amber-500"
          style={{ borderWidth: 1.5, borderColor: '#ffffff' }}
        >
          <Star size={9} color="#ffffff" fill="#ffffff" />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Self-contained <Marker> for a place. Keeps `tracksViewChanges` on only until
 * the avatar image has loaded — otherwise react-native-maps renders image-backed
 * markers blank on iOS. Initials-only markers never track (best performance).
 */
export function PlaceMapMarker({
  pin,
  coordinate,
  onPress,
}: {
  pin: MapPin;
  coordinate: Coord;
  onPress: () => void;
}) {
  const hasAvatar = !!pin.userAvatarUrl;
  const [tracks, setTracks] = useState(hasAvatar);

  // Safety: stop tracking even if the image never reports onLoad.
  useEffect(() => {
    if (!hasAvatar) return;
    const t = setTimeout(() => setTracks(false), 1500);
    return () => clearTimeout(t);
  }, [hasAvatar]);

  return (
    <Marker coordinate={coordinate} onPress={onPress} tracksViewChanges={tracks}>
      <MarkerBody pin={pin} onAvatarLoad={() => setTracks(false)} />
    </Marker>
  );
}

/** Standalone body (used outside a Marker context if ever needed). */
export function PlaceMarker({ pin }: { pin: MapPin }) {
  return <MarkerBody pin={pin} />;
}
