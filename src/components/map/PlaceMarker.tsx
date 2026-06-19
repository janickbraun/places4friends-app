import { Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import type { MapPin } from '@/lib/map';

/**
 * Avatar/initials marker rendered inside a react-native-maps <Marker>. Uses the
 * per-user color; Must-See places get an amber ring + star badge (web parity).
 */
export function PlaceMarker({ pin }: { pin: MapPin }) {
  return (
    <View className="items-center justify-center">
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{
          backgroundColor: pin.userColor,
          borderWidth: 2.5,
          borderColor: pin.isMustSee ? '#f59e0b' : '#ffffff',
          boxShadow: '0px 1px 3px rgba(0,0,0,0.3)',
        }}
      >
        <Text className="text-xs font-bold text-white">{pin.userInitials}</Text>
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
