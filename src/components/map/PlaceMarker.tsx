import { useEffect, useRef, useState } from 'react';
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
 * Self-contained <Marker> for a place. On Android a marker renders into a bitmap
 * snapshot; if `tracksViewChanges` is off when that snapshot is taken the pin is
 * captured before its avatar/initials have painted, so it shows blank until a later
 * redraw (why pins/avatars appeared to load slowly). We track view changes through
 * the initial paint — re-armed when the pin's identity or avatar changes — and stop
 * once the content is on screen for performance.
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
  const [tracks, setTracks] = useState(true);
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
  }, []);

  // Re-arm tracking on identity/avatar change; cap it so a never-firing onLoad
  // (or initials-only markers, which paint synchronously) still settles to false.
  useEffect(() => {
    setTracks(true);
    const cap = setTimeout(() => {
      if (mounted.current) setTracks(false);
    }, hasAvatar ? 1500 : 300);
    return () => clearTimeout(cap);
  }, [pin.id, pin.userAvatarUrl, pin.isMustSee, hasAvatar]);

  // Defer one frame after the image loads so the decoded avatar is painted into the
  // view before the final snapshot — without this Android captures it empty.
  const handleAvatarLoad = () => {
    requestAnimationFrame(() => {
      if (mounted.current) setTracks(false);
    });
  };

  return (
    <Marker coordinate={coordinate} onPress={onPress} tracksViewChanges={tracks}>
      <MarkerBody pin={pin} onAvatarLoad={handleAvatarLoad} />
    </Marker>
  );
}

/** Standalone body (used outside a Marker context if ever needed). */
export function PlaceMarker({ pin }: { pin: MapPin }) {
  return <MarkerBody pin={pin} />;
}
