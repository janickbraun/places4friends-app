import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Supercluster from 'supercluster';
import { Crosshair } from 'lucide-react-native';
import {
  DEFAULT_REGION,
  expandBounds,
  fetchPlaceDetails,
  fetchViewportPins,
  regionToBounds,
  regionToZoom,
  type MapPin,
  type MapPlaceDetails,
} from '@/lib/map';
import { PlaceMarker } from '@/components/map/PlaceMarker';
import { ClusterMarker } from '@/components/map/ClusterMarker';
import { PlaceDetailSheet } from '@/components/map/PlaceDetailSheet';

const REGION_KEY = 'p4f_map_region';

// Point-feature properties stored in the cluster index.
type PinProps = { cluster: false; pin: MapPin };

/**
 * The interactive map. Imported lazily (react-native-maps is a native module,
 * unavailable in Expo Go) — see app/(tabs)/index.tsx.
 */
export default function MapCanvas() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
  const [details, setDetails] = useState<MapPlaceDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPins = useCallback(async (r: Region) => {
    const bounds = expandBounds(regionToBounds(r));
    setPins(await fetchViewportPins(bounds));
  }, []);

  // Restore the persisted viewport on mount, then load its pins.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(REGION_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Region;
          setRegion(saved);
          mapRef.current?.animateToRegion(saved, 0);
          await loadPins(saved);
          return;
        }
      } catch {
        // ignore and fall back to the default region
      }
      await loadPins(DEFAULT_REGION);
    })();
  }, [loadPins]);

  const onRegionChangeComplete = useCallback(
    (r: Region) => {
      setRegion(r);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        AsyncStorage.setItem(REGION_KEY, JSON.stringify(r)).catch(() => {});
      }, 500);
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(() => {
        void loadPins(r);
      }, 300);
    },
    [loadPins],
  );

  const supercluster = useMemo(() => {
    const sc = new Supercluster<PinProps>({ radius: 48, maxZoom: 20 });
    sc.load(
      pins.map((p) => ({
        type: 'Feature' as const,
        properties: { cluster: false as const, pin: p },
        geometry: { type: 'Point' as const, coordinates: [p.longitude, p.latitude] },
      })),
    );
    return sc;
  }, [pins]);

  const clusters = useMemo(() => {
    const b = regionToBounds(region);
    return supercluster.getClusters([b.west, b.south, b.east, b.north], regionToZoom(region));
  }, [supercluster, region]);

  const handlePinPress = useCallback(async (pin: MapPin) => {
    setSelectedPin(pin);
    setDetails(null);
    setDetailsLoading(true);
    setDetails(await fetchPlaceDetails(pin.id));
    setDetailsLoading(false);
  }, []);

  const handleClusterPress = useCallback(
    (clusterId: number, lng: number, lat: number) => {
      const zoom = supercluster.getClusterExpansionZoom(clusterId);
      const delta = 360 / Math.pow(2, zoom);
      mapRef.current?.animateToRegion(
        { latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta },
        350,
      );
    },
    [supercluster],
  );

  const handleLocate = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({});
    mapRef.current?.animateToRegion(
      {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      350,
    );
  }, []);

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={DEFAULT_REGION}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {clusters.map((c) => {
          const [lng, lat] = c.geometry.coordinates;
          if (c.properties.cluster) {
            const id = c.properties.cluster_id;
            return (
              <Marker
                key={`cluster-${id}`}
                coordinate={{ latitude: lat, longitude: lng }}
                onPress={() => handleClusterPress(id, lng, lat)}
                tracksViewChanges={false}
              >
                <ClusterMarker count={c.properties.point_count} />
              </Marker>
            );
          }
          const { pin } = c.properties;
          return (
            <Marker
              key={pin.id}
              coordinate={{ latitude: lat, longitude: lng }}
              onPress={() => handlePinPress(pin)}
              tracksViewChanges={false}
            >
              <PlaceMarker pin={pin} />
            </Marker>
          );
        })}
      </MapView>

      <Pressable
        onPress={handleLocate}
        accessibilityRole="button"
        accessibilityLabel="Meinen Standort anzeigen"
        className="absolute right-4 h-12 w-12 items-center justify-center rounded-full bg-white"
        style={{ bottom: insets.bottom + 84, boxShadow: '0px 2px 8px rgba(0,0,0,0.15)' }}
      >
        <Crosshair size={22} color="#226622" />
      </Pressable>

      <PlaceDetailSheet
        pin={selectedPin}
        details={details}
        loading={detailsLoading}
        onClose={() => setSelectedPin(null)}
      />
    </View>
  );
}
