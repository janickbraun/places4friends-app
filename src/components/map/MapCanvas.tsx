import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Supercluster from 'supercluster';
import {
  Crosshair,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from 'lucide-react-native';
import {
  DEFAULT_REGION,
  expandBounds,
  fetchOverviewPins,
  fetchPlaceDetails,
  fetchUserPins,
  fetchViewportPins,
  getZoomLevelForType,
  MAP_RESET_ZOOM_EVENT,
  regionToBounds,
  regionToZoom,
  zoomToDelta,
  type MapPin,
  type MapPinFilters,
  type MapPlaceDetails,
} from '@/lib/map';
import { searchPlaces, type PlaceSuggestion } from '@/lib/places';
import { fetchFriendships, type FriendProfile } from '@/lib/friends';
import { PLACE_CATEGORIES } from '@/lib/categories';
import { supabase } from '@/lib/supabase';
import { PlaceMapMarker } from '@/components/map/PlaceMarker';
import { ClusterMarker } from '@/components/map/ClusterMarker';
import { PlaceDetailSheet } from '@/components/map/PlaceDetailSheet';
import { MapLayerControl, type MapLayer } from '@/components/map/MapLayerControl';
import { Avatar } from '@/components/ui/Avatar';

const REGION_KEY = 'p4f_map_region';
type PinProps = { cluster: false; pin: MapPin };

// Street-level detail zoom (web ZOOM_DETAIL = 15), as a region delta.
const DETAIL_DELTA = zoomToDelta(15);
// Below this lat/lng span a cluster's pins are effectively stacked — fitting to
// them would slam the camera to max zoom, so we fall back to a fixed zoom-in.
const COINCIDENT_SPAN = 0.0008;

export default function MapCanvas() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
  const [details, setDetails] = useState<MapPlaceDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [mapLayer, setMapLayer] = useState<MapLayer>('standard');

  // Search + filters
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [mustSee, setMustSee] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const regionRef = useRef(region);
  const filtersRef = useRef<MapPinFilters>({});
  filtersRef.current = {
    userId: selectedUserId,
    mustSee,
    categories: selectedCategories,
  };
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveFilters = mustSee || selectedCategories.length > 0;

  const loadPins = useCallback(async () => {
    const bounds = expandBounds(regionToBounds(regionRef.current));
    setPins(await fetchViewportPins(bounds, filtersRef.current));
  }, []);

  /**
   * Animate the camera to contain a set of pins (web `fitMapToUnclusteredPlaces`).
   * A single pin zooms straight to detail level; multiple pins fit their bounds
   * with padding that clears the floating search bar/chips and the map controls.
   */
  const fitToPins = useCallback(
    (pinsToFit: MapPin[]) => {
      if (pinsToFit.length === 0) return;
      if (pinsToFit.length === 1) {
        const p = pinsToFit[0];
        mapRef.current?.animateToRegion(
          {
            latitude: p.latitude,
            longitude: p.longitude,
            latitudeDelta: DETAIL_DELTA,
            longitudeDelta: DETAIL_DELTA,
          },
          500,
        );
        return;
      }
      mapRef.current?.fitToCoordinates(
        pinsToFit.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
        {
          edgePadding: {
            top: insets.top + 140,
            right: 56,
            bottom: insets.bottom + 110,
            left: 56,
          },
          animated: true,
        },
      );
    },
    [insets.top, insets.bottom],
  );

  /**
   * Clear search/selection and zoom back out to fit the whole (filtered) overview
   * — the web's `reset-map-zoom` behavior, fired by re-tapping the active Karte tab.
   */
  const resetToOverview = useCallback(async () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setFilterOpen(false);
    setSelectedPin(null);
    const overview = await fetchOverviewPins(filtersRef.current);
    setPins(overview);
    if (overview.length === 0) {
      mapRef.current?.animateToRegion(DEFAULT_REGION, 500);
      return;
    }
    fitToPins(overview);
  }, [fitToPins]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(MAP_RESET_ZOOM_EVENT, () => {
      void resetToOverview();
    });
    return () => sub.remove();
  }, [resetToOverview]);

  // Restore viewport + load friends (for the filter chips) on mount.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(REGION_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Region;
          regionRef.current = saved;
          setRegion(saved);
          mapRef.current?.animateToRegion(saved, 0);
        }
      } catch {
        // ignore
      }
      await loadPins();
    })();
    void supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
      if (data.user) fetchFriendships(data.user.id).then((f) => setFriends(f.friends));
    });
  }, [loadPins]);

  // Re-fetch when filters change. Selecting a friend additionally zooms the map
  // to fit all of their recommendations (fetched globally, not just the current
  // viewport) — matching the web's auto-fit on filter.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (selectedUserId) {
        const friendPins = await fetchUserPins(selectedUserId, {
          mustSee,
          categories: selectedCategories,
        });
        if (cancelled) return;
        setPins(friendPins);
        setSelectedPin(null);
        fitToPins(friendPins);
      } else {
        await loadPins();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedUserId, mustSee, selectedCategories, loadPins, fitToPins]);

  // Debounced place search.
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      setSuggestions(await searchPlaces(query, regionRef.current));
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const onRegionChangeComplete = useCallback(
    (r: Region) => {
      regionRef.current = r;
      setRegion(r);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        AsyncStorage.setItem(REGION_KEY, JSON.stringify(r)).catch(() => {});
      }, 500);
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(() => void loadPins(), 300);
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
    // Center the pin in the upper area and zoom in to detail (keeping the current
    // zoom if already closer) so it sits clearly above the bottom detail sheet.
    const targetDelta = Math.min(regionRef.current.latitudeDelta, DETAIL_DELTA);
    mapRef.current?.animateToRegion(
      {
        latitude: pin.latitude - targetDelta * 0.25,
        longitude: pin.longitude,
        latitudeDelta: targetDelta,
        longitudeDelta: targetDelta,
      },
      450,
    );
    setSelectedPin(pin);
    setDetails(null);
    setDetailsLoading(true);
    setDetails(await fetchPlaceDetails(pin.id));
    setDetailsLoading(false);
  }, []);

  const handleClusterPress = useCallback(
    (clusterId: number, lng: number, lat: number) => {
      // Fit the camera to the cluster's actual members (web `handleClusterExpand`)
      // rather than a fixed expansion delta, so the group spreads out edge-to-edge.
      const leaves = supercluster.getLeaves(clusterId, Infinity);
      const coords = leaves.map((l) => ({
        latitude: l.geometry.coordinates[1],
        longitude: l.geometry.coordinates[0],
      }));
      const lats = coords.map((c) => c.latitude);
      const lngs = coords.map((c) => c.longitude);
      const span = Math.max(
        Math.max(...lats) - Math.min(...lats),
        Math.max(...lngs) - Math.min(...lngs),
      );

      if (coords.length < 2 || span < COINCIDENT_SPAN) {
        const zoom = Math.min(supercluster.getClusterExpansionZoom(clusterId), 17);
        const delta = zoomToDelta(zoom);
        mapRef.current?.animateToRegion(
          { latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta },
          350,
        );
        return;
      }

      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: {
          top: insets.top + 140,
          right: 56,
          bottom: insets.bottom + 110,
          left: 56,
        },
        animated: true,
      });
    },
    [supercluster, insets.top, insets.bottom],
  );

  const locate = async () => {
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
  };

  const onSelectSuggestion = (s: PlaceSuggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setQuery(s.name);
    if (s.latitude != null && s.longitude != null) {
      // Zoom depth depends on the result's granularity (city vs. POI etc.) —
      // mirrors the web's getZoomLevelForType.
      const delta = zoomToDelta(getZoomLevelForType(s.type));
      mapRef.current?.animateToRegion(
        { latitude: s.latitude, longitude: s.longitude, latitudeDelta: delta, longitudeDelta: delta },
        600,
      );
    }
  };

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        mapType={mapLayer}
        initialRegion={DEFAULT_REGION}
        onRegionChangeComplete={onRegionChangeComplete}
        onPress={() => {
          setShowSuggestions(false);
          setFilterOpen(false);
        }}
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
            <PlaceMapMarker
              key={pin.id}
              pin={pin}
              coordinate={{ latitude: lat, longitude: lng }}
              onPress={() => handlePinPress(pin)}
            />
          );
        })}
      </MapView>

      {/* Search + filter */}
      <View className="absolute left-4 right-4" style={{ top: insets.top + 8 }}>
        <View
          className="flex-row items-center rounded-2xl bg-white/95 px-4 py-3"
          style={{ boxShadow: '0px 8px 30px rgba(0,0,0,0.08)' }}
        >
          <Search size={16} color="#94a3b8" />
          <TextInput
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Ort suchen..."
            placeholderTextColor="#94a3b8"
            className="ml-3 flex-1 text-sm font-medium text-slate-800"
            maxLength={100}
          />
          {searching ? <ActivityIndicator size="small" color="#226622" /> : null}
          <Pressable
            onPress={() => setFilterOpen((v) => !v)}
            hitSlop={6}
            className="ml-2 h-7 w-7 items-center justify-center rounded-full border border-slate-100"
          >
            <SlidersHorizontal size={14} color={filterOpen ? '#226622' : '#64748b'} />
            {hasActiveFilters ? (
              <View
                className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand-green-700"
                style={{ borderWidth: 1, borderColor: '#ffffff' }}
              />
            ) : null}
          </Pressable>
          {query ? (
            <Pressable
              onPress={() => {
                setQuery('');
                setSuggestions([]);
              }}
              hitSlop={6}
              className="ml-1"
            >
              <X size={16} color="#94a3b8" />
            </Pressable>
          ) : null}
        </View>

        {/* Suggestions */}
        {showSuggestions && suggestions.length > 0 ? (
          <View
            className="mt-2 overflow-hidden rounded-2xl bg-white"
            style={{ maxHeight: 260, boxShadow: '0px 12px 40px rgba(0,0,0,0.08)' }}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              {suggestions.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => onSelectSuggestion(s)}
                  className="border-b border-slate-50 px-4 py-3"
                >
                  <Text className="text-xs font-bold text-slate-800" numberOfLines={1}>
                    {s.name}
                  </Text>
                  {s.address ? (
                    <Text className="mt-0.5 text-[10px] text-slate-400" numberOfLines={1}>
                      {s.address}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Filter menu */}
        {filterOpen ? (
          <View
            className="mt-2 rounded-2xl bg-white p-3"
            style={{ boxShadow: '0px 12px 40px rgba(0,0,0,0.10)' }}
          >
            <Text className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Empfehlungen
            </Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setMustSee(false)}
                className={`flex-1 items-center rounded-xl py-2 ${
                  !mustSee ? 'bg-slate-900' : 'bg-slate-50'
                }`}
              >
                <Text className={`text-xs font-semibold ${!mustSee ? 'text-white' : 'text-slate-700'}`}>
                  Alle
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMustSee(true)}
                className={`flex-1 flex-row items-center justify-center gap-1 rounded-xl py-2 ${
                  mustSee ? 'bg-amber-500' : 'bg-slate-50'
                }`}
              >
                <Sparkles size={13} color={mustSee ? '#ffffff' : '#64748b'} />
                <Text className={`text-xs font-semibold ${mustSee ? 'text-white' : 'text-slate-700'}`}>
                  Must See
                </Text>
              </Pressable>
            </View>

            <Text className="px-1 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Kategorien
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {PLACE_CATEGORIES.map((category) => {
                const active = selectedCategories.includes(category);
                return (
                  <Pressable
                    key={category}
                    onPress={() =>
                      setSelectedCategories((prev) =>
                        prev.includes(category)
                          ? prev.filter((c) => c !== category)
                          : [...prev, category],
                      )
                    }
                    className={`rounded-full border px-2.5 py-1 ${
                      active
                        ? 'border-brand-green-600 bg-brand-green-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-semibold ${
                        active ? 'text-brand-green-800' : 'text-slate-600'
                      }`}
                    >
                      {category}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Friend filter chips */}
        {friends.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-2 -mx-4"
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              onPress={() => setSelectedUserId(null)}
              className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${
                selectedUserId === null
                  ? 'border-brand-green-800 bg-brand-green-800'
                  : 'border-slate-100 bg-white/95'
              }`}
            >
              <Users size={13} color={selectedUserId === null ? '#ffffff' : '#334155'} />
              <Text
                className={`text-xs font-semibold ${
                  selectedUserId === null ? 'text-white' : 'text-slate-700'
                }`}
              >
                Alle
              </Text>
            </Pressable>
            {friends.map((friend) => {
              const active = selectedUserId === friend.id;
              return (
                <Pressable
                  key={friend.id}
                  onPress={() => setSelectedUserId((prev) => (prev === friend.id ? null : friend.id))}
                  className={`flex-row items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 ${
                    active ? 'border-brand-green-800 bg-brand-green-800' : 'border-slate-100 bg-white/95'
                  }`}
                >
                  <Avatar url={friend.avatarUrl} name={friend.fullName} id={friend.id} size={24} />
                  <Text
                    className={`text-xs font-semibold ${active ? 'text-white' : 'text-slate-700'}`}
                  >
                    {friend.fullName ?? friend.username ?? 'Freund'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {/* Layer + locate controls */}
      <View className="absolute right-4 gap-2" style={{ bottom: insets.bottom + 84 }}>
        <MapLayerControl value={mapLayer} onChange={setMapLayer} />
        <Pressable
          onPress={locate}
          accessibilityLabel="Meinen Standort"
          className="h-10 w-10 items-center justify-center rounded-full bg-white"
          style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.15)' }}
        >
          <Crosshair size={20} color="#226622" />
        </Pressable>
      </View>

      <PlaceDetailSheet
        pin={selectedPin}
        details={details}
        loading={detailsLoading}
        currentUserId={currentUserId}
        onClose={() => setSelectedPin(null)}
      />
    </View>
  );
}
