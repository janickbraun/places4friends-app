import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Supercluster from 'supercluster';
import {
  Crosshair,
  Minus,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from 'lucide-react-native';
import {
  DEFAULT_REGION,
  expandBounds,
  fetchPlaceDetails,
  fetchViewportPins,
  regionToBounds,
  regionToZoom,
  type MapPin,
  type MapPinFilters,
  type MapPlaceDetails,
} from '@/lib/map';
import { searchPlaces, type PlaceSuggestion } from '@/lib/places';
import { fetchFriendships, type FriendProfile } from '@/lib/friends';
import { PLACE_CATEGORIES } from '@/lib/categories';
import { getUserColor } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { PlaceMapMarker } from '@/components/map/PlaceMarker';
import { ClusterMarker } from '@/components/map/ClusterMarker';
import { PlaceDetailSheet } from '@/components/map/PlaceDetailSheet';
import { Avatar } from '@/components/ui/Avatar';

const REGION_KEY = 'p4f_map_region';
type PinProps = { cluster: false; pin: MapPin };

export default function MapCanvas() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
  const [details, setDetails] = useState<MapPlaceDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

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

  // Re-fetch when filters change.
  useEffect(() => {
    void loadPins();
  }, [selectedUserId, mustSee, selectedCategories, loadPins]);

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

  const zoom = (factor: number) => {
    const r = regionRef.current;
    mapRef.current?.animateToRegion(
      {
        latitude: r.latitude,
        longitude: r.longitude,
        latitudeDelta: Math.max(0.0008, Math.min(120, r.latitudeDelta * factor)),
        longitudeDelta: Math.max(0.0008, Math.min(120, r.longitudeDelta * factor)),
      },
      250,
    );
  };

  const onSelectSuggestion = (s: PlaceSuggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setQuery(s.name);
    if (s.latitude != null && s.longitude != null) {
      mapRef.current?.animateToRegion(
        { latitude: s.latitude, longitude: s.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        600,
      );
    }
  };

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
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
            className="mt-2"
            contentContainerStyle={{ gap: 8 }}
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
                  <View
                    className="h-6 w-6 items-center justify-center overflow-hidden rounded-full"
                    style={{ backgroundColor: getUserColor(friend.id) }}
                  >
                    <Avatar url={friend.avatarUrl} name={friend.fullName} size={24} />
                  </View>
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

      {/* Zoom + locate controls */}
      <View className="absolute right-4 gap-2" style={{ bottom: insets.bottom + 84 }}>
        <View className="overflow-hidden rounded-full bg-white" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.15)' }}>
          <Pressable onPress={() => zoom(0.5)} className="h-10 w-10 items-center justify-center">
            <Plus size={20} color="#334155" />
          </Pressable>
          <View className="h-px bg-slate-100" />
          <Pressable onPress={() => zoom(2)} className="h-10 w-10 items-center justify-center">
            <Minus size={20} color="#334155" />
          </Pressable>
        </View>
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
