import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import MapView, { Marker, type MapPressEvent, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Crosshair } from 'lucide-react-native';
import { DEFAULT_REGION } from '@/lib/map';

type Coord = { latitude: number; longitude: number };

type Props = {
  value: Coord | null;
  onChange: (coord: Coord) => void;
};

/** Tap the map to drop a pin (or use the locate button). Lazy-loaded — native map. */
export default function LocationPickerMap({ value, onChange }: Props) {
  const mapRef = useRef<MapView>(null);
  const [region] = useState<Region>(
    value ? { ...value, latitudeDelta: 0.02, longitudeDelta: 0.02 } : DEFAULT_REGION,
  );

  useEffect(() => {
    if (value) return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion(
        {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        300,
      );
    })();
  }, [value]);

  const recenter = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({});
    const coord = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    onChange(coord);
    mapRef.current?.animateToRegion(
      { ...coord, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      300,
    );
  };

  return (
    <View className="overflow-hidden rounded-xl border border-slate-200" style={{ height: 200 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={region}
        onPress={(e: MapPressEvent) => onChange(e.nativeEvent.coordinate)}
      >
        {value ? <Marker coordinate={value} /> : null}
      </MapView>
      <Pressable
        onPress={recenter}
        accessibilityLabel="Aktuellen Standort verwenden"
        className="absolute bottom-2 right-2 h-9 w-9 items-center justify-center rounded-full bg-white"
        style={{ boxShadow: '0px 2px 6px rgba(0,0,0,0.15)' }}
      >
        <Crosshair size={18} color="#226622" />
      </Pressable>
    </View>
  );
}
