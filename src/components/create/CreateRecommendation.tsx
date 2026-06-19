import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import MapView, { Marker, type MapPressEvent, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import type { User } from '@supabase/supabase-js';
import {
  ChevronDown,
  Crosshair,
  ImagePlus,
  MapPin,
  Search,
  Sparkles,
  X,
} from 'lucide-react-native';
import { DEFAULT_REGION } from '@/lib/map';
import { PLACE_CATEGORIES } from '@/lib/categories';
import { reverseGeocode, searchPlaces, type PlaceSuggestion } from '@/lib/places';
import { createRecommendation, uploadActivityImages } from '@/lib/createRecommendation';

type Coord = { latitude: number; longitude: number };
const MAX_IMAGES = 3;

/** Map-first create flow (full-screen map + search + tap-to-add sheet). Lazy-loaded. */
export default function CreateRecommendation({ user }: { user: User }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const [region] = useState<Region>(DEFAULT_REGION);
  const [pin, setPin] = useState<Coord | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Search
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Form
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [isMustSee, setIsMustSee] = useState(false);
  const [description, setDescription] = useState('');
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Center on the user's location once on mount.
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion(
        {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        },
        400,
      );
    })();
  }, []);

  // Debounced search.
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const results = await searchPlaces(query, pin ?? region);
      setSuggestions(results);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, pin, region]);

  const openSheetAt = (coord: Coord) => {
    setPin(coord);
    setSheetOpen(true);
    mapRef.current?.animateToRegion(
      { ...coord, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      500,
    );
  };

  const handleMapPress = async (e: MapPressEvent) => {
    const coord = e.nativeEvent.coordinate;
    setPlaceName('');
    setPlaceAddress('');
    openSheetAt(coord);
    const place = await reverseGeocode(coord.latitude, coord.longitude);
    if (place) {
      if (place.name) setPlaceName(place.name);
      setPlaceAddress(place.address);
    }
  };

  const handleSelectSuggestion = (s: PlaceSuggestion) => {
    setQuery(s.name);
    setShowSuggestions(false);
    setSuggestions([]);
    setPlaceName(s.name);
    setPlaceAddress(s.address);
    if (s.latitude !== null && s.longitude !== null) {
      openSheetAt({ latitude: s.latitude, longitude: s.longitude });
    }
  };

  const locate = async () => {
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
      400,
    );
  };

  const toggleCategory = (category: string) => {
    setCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Zugriff auf Fotos wird benötigt.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled) {
      setAssets((prev) => [...prev, ...result.assets].slice(0, MAX_IMAGES));
    }
  };

  const resetForm = () => {
    setPin(null);
    setSheetOpen(false);
    setQuery('');
    setSuggestions([]);
    setPlaceName('');
    setPlaceAddress('');
    setCategories([]);
    setIsMustSee(false);
    setDescription('');
    setAssets([]);
  };

  const save = async () => {
    setError(null);
    if (!placeName.trim()) {
      setError('Bitte gib einen Namen für den Ort ein.');
      return;
    }
    setSaving(true);
    try {
      const imageUrls = assets.length > 0 ? await uploadActivityImages(user.id, assets) : [];
      const { error: insertError } = await createRecommendation({
        userId: user.id,
        placeName: placeName.trim(),
        placeAddress: placeAddress.trim() || null,
        latitude: pin?.latitude ?? null,
        longitude: pin?.longitude ?? null,
        isSuperlike: isMustSee,
        description: description.trim(),
        categories,
        imageUrls,
      });
      if (insertError) throw insertError;
      resetForm();
      router.replace('/');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Empfehlung konnte nicht gespeichert werden.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={region}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {pin ? <Marker coordinate={pin} pinColor="#226622" /> : null}
      </MapView>

      {/* Search bar */}
      {!sheetOpen ? (
        <View className="absolute left-4 right-4" style={{ top: insets.top + 8 }}>
          <View
            className="flex-row items-center rounded-2xl bg-white/95 px-4 py-3"
            style={{ boxShadow: '0px 8px 30px rgba(0,0,0,0.10)' }}
          >
            <Search size={16} color="#94a3b8" />
            <TextInput
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Ort suchen oder auf Karte tippen..."
              placeholderTextColor="#94a3b8"
              className="ml-3 flex-1 text-sm font-medium text-slate-800"
              maxLength={100}
            />
            {searching ? (
              <ActivityIndicator size="small" color="#226622" />
            ) : query ? (
              <Pressable
                onPress={() => {
                  setQuery('');
                  setSuggestions([]);
                }}
                hitSlop={8}
              >
                <X size={16} color="#94a3b8" />
              </Pressable>
            ) : null}
          </View>

          {showSuggestions && suggestions.length > 0 ? (
            <View
              className="mt-2 overflow-hidden rounded-2xl bg-white"
              style={{ maxHeight: 280, boxShadow: '0px 12px 40px rgba(0,0,0,0.10)' }}
            >
              <ScrollView keyboardShouldPersistTaps="handled">
                {suggestions.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => handleSelectSuggestion(s)}
                    className="flex-row items-start gap-3 border-b border-slate-50 px-4 py-3"
                  >
                    <View className="mt-0.5 rounded-full bg-slate-50 p-1.5">
                      <MapPin size={14} color="#94a3b8" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-slate-800" numberOfLines={1}>
                        {s.name}
                      </Text>
                      {s.address ? (
                        <Text className="mt-0.5 text-[10px] text-slate-400" numberOfLines={1}>
                          {s.address}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Locate */}
      {!sheetOpen ? (
        <Pressable
          onPress={locate}
          accessibilityLabel="Meinen Standort"
          className="absolute right-4 h-10 w-10 items-center justify-center rounded-full bg-white"
          style={{ bottom: insets.bottom + 84, boxShadow: '0px 2px 8px rgba(0,0,0,0.15)' }}
        >
          <Crosshair size={20} color="#226622" />
        </Pressable>
      ) : null}

      {/* Bottom-sheet form */}
      {sheetOpen ? (
        <View className="absolute inset-0" style={{ justifyContent: 'flex-end' }}>
          <Pressable className="flex-1" onPress={() => setSheetOpen(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View
              className="rounded-t-3xl bg-white"
              style={{ maxHeight: 560, boxShadow: '0px -8px 40px rgba(0,0,0,0.12)' }}
            >
              {/* Handle */}
              <View className="flex-row items-center justify-between border-b border-slate-100 px-5 pb-3 pt-4">
                <View className="flex-row items-center gap-2">
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-green-50">
                    <MapPin size={14} color="#226622" />
                  </View>
                  <Text className="text-sm font-bold text-slate-900">Ort empfehlen</Text>
                </View>
                <Pressable
                  onPress={() => setSheetOpen(false)}
                  className="h-7 w-7 items-center justify-center rounded-full bg-slate-100"
                >
                  <ChevronDown size={16} color="#475569" />
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 16 }}
                keyboardShouldPersistTaps="handled"
              >
                {/* Name */}
                <View className="gap-1.5">
                  <Text className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Name des Ortes
                  </Text>
                  <View className="flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                    <MapPin size={16} color="#94a3b8" />
                    <TextInput
                      value={placeName}
                      onChangeText={setPlaceName}
                      placeholder="Name des Ortes eingeben"
                      placeholderTextColor="#94a3b8"
                      maxLength={100}
                      className="ml-2.5 flex-1 text-sm font-semibold text-slate-800"
                    />
                  </View>
                </View>

                {/* Address */}
                <View className="gap-1.5">
                  <Text className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Adresse / Straße (optional)
                  </Text>
                  <View className="flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                    <Search size={16} color="#94a3b8" />
                    <TextInput
                      value={placeAddress}
                      onChangeText={setPlaceAddress}
                      placeholder="Straße, Hausnummer, Ort"
                      placeholderTextColor="#94a3b8"
                      maxLength={250}
                      className="ml-2.5 flex-1 text-sm text-slate-800"
                    />
                  </View>
                  {pin ? (
                    <Text className="pl-1 text-[10px] text-slate-400">
                      Pin: {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
                    </Text>
                  ) : null}
                </View>

                {/* Categories */}
                <View className="gap-1.5">
                  <Text className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Kategorien
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {PLACE_CATEGORIES.map((category) => {
                      const selected = categories.includes(category);
                      return (
                        <Pressable
                          key={category}
                          onPress={() => toggleCategory(category)}
                          className={`rounded-full border px-3 py-1.5 ${
                            selected
                              ? 'border-brand-green-600 bg-brand-green-50'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              selected ? 'text-brand-green-800' : 'text-slate-600'
                            }`}
                          >
                            {category}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Must See */}
                <View className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <View className="flex-row items-center gap-2.5">
                    <Sparkles size={18} color="#f59e0b" fill="#fbbf24" />
                    <Text className="text-sm font-bold text-slate-700">Must See</Text>
                  </View>
                  <Switch
                    value={isMustSee}
                    onValueChange={setIsMustSee}
                    trackColor={{ true: '#226622', false: '#cbd5e1' }}
                  />
                </View>

                {/* Description */}
                <View className="gap-1.5">
                  <Text className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Beschreibung (optional)
                  </Text>
                  <View className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Was macht diesen Ort besonders?"
                      placeholderTextColor="#94a3b8"
                      multiline
                      maxLength={2000}
                      style={{ minHeight: 72, textAlignVertical: 'top' }}
                      className="text-sm text-slate-800"
                    />
                  </View>
                </View>

                {/* Images */}
                <View className="gap-1.5">
                  <Text className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Bilder (optional, max. {MAX_IMAGES})
                  </Text>
                  <View className="flex-row flex-wrap gap-3">
                    {assets.map((asset) => (
                      <View key={asset.assetId ?? asset.uri} style={{ width: 80, height: 80 }}>
                        <Image
                          source={{ uri: asset.uri }}
                          style={{ width: 80, height: 80, borderRadius: 12 }}
                          contentFit="cover"
                        />
                        <Pressable
                          onPress={() => setAssets((prev) => prev.filter((a) => a.uri !== asset.uri))}
                          className="absolute -right-1.5 -top-1.5 h-5 w-5 items-center justify-center rounded-full bg-slate-900"
                        >
                          <X size={12} color="#ffffff" />
                        </Pressable>
                      </View>
                    ))}
                    {assets.length < MAX_IMAGES ? (
                      <Pressable
                        onPress={pickImages}
                        className="items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50"
                        style={{ width: 80, height: 80 }}
                      >
                        <ImagePlus size={22} color="#94a3b8" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                {error ? (
                  <View className="rounded-lg border border-red-100 bg-red-50 px-4 py-2.5">
                    <Text className="text-xs font-medium text-red-700">{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={save}
                  disabled={saving || placeName.trim().length === 0}
                  className={`w-full flex-row items-center justify-center gap-2 rounded-xl bg-brand-green-700 py-3.5 ${
                    saving || placeName.trim().length === 0 ? 'opacity-60' : ''
                  }`}
                  style={{ boxShadow: '0px 8px 16px rgba(34,102,34,0.10)' }}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <MapPin size={16} color="#ffffff" />
                      <Text className="text-sm font-semibold text-white">Empfehlung speichern</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      ) : null}
    </View>
  );
}
