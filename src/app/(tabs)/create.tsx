import { Suspense, lazy, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import type { User } from '@supabase/supabase-js';
import { ImagePlus, MapPin, Sparkles, X } from 'lucide-react-native';
import AuthGate from '@/components/auth/AuthGate';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { isExpoGo } from '@/lib/runtime';
import { PLACE_CATEGORIES } from '@/lib/categories';
import { createRecommendation, uploadActivityImages } from '@/lib/createRecommendation';

const LocationPickerMap = lazy(() => import('@/components/create/LocationPickerMap'));

type Coord = { latitude: number; longitude: number };
const MAX_IMAGES = 4;

function CreateForm({ user }: { user: User }) {
  const router = useRouter();
  const [placeName, setPlaceName] = useState('');
  const [coord, setCoord] = useState<Coord | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [isMustSee, setIsMustSee] = useState(false);
  const [description, setDescription] = useState('');
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (category: string) => {
    setCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  };

  const useCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setError('Standortberechtigung wird benötigt.');
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    setCoord({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
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

  const submit = async () => {
    setError(null);
    if (!placeName.trim()) {
      setError('Bitte gib einen Namen für den Ort ein.');
      return;
    }
    setSubmitting(true);
    try {
      const imageUrls = assets.length > 0 ? await uploadActivityImages(user.id, assets) : [];
      const { error: insertError } = await createRecommendation({
        userId: user.id,
        placeName: placeName.trim(),
        latitude: coord?.latitude ?? null,
        longitude: coord?.longitude ?? null,
        isSuperlike: isMustSee,
        description: description.trim(),
        categories,
        imageUrls,
      });
      if (insertError) throw insertError;
      setPlaceName('');
      setCoord(null);
      setCategories([]);
      setIsMustSee(false);
      setDescription('');
      setAssets([]);
      router.replace('/');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Empfehlung konnte nicht gespeichert werden.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      <View className="h-14 items-center justify-center border-b border-slate-100 bg-white">
        <Text className="text-sm font-bold text-slate-900">Empfehlen</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Location */}
          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Standort
            </Text>
            {isExpoGo ? (
              <View className="gap-2">
                <Button
                  label="Aktuellen Standort verwenden"
                  variant="secondary"
                  icon={MapPin}
                  onPress={useCurrentLocation}
                />
              </View>
            ) : (
              <Suspense
                fallback={
                  <View
                    className="items-center justify-center rounded-xl border border-slate-200 bg-slate-100"
                    style={{ height: 200 }}
                  >
                    <ActivityIndicator color="#226622" />
                  </View>
                }
              >
                <LocationPickerMap value={coord} onChange={setCoord} />
              </Suspense>
            )}
            <Text className="text-[11px] text-slate-400">
              {coord
                ? `Ausgewählt: ${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`
                : isExpoGo
                  ? 'Standort optional.'
                  : 'Tippe auf die Karte, um den Ort zu setzen.'}
            </Text>
          </View>

          {/* Name */}
          <TextField
            label="Name des Ortes"
            icon={MapPin}
            value={placeName}
            onChangeText={setPlaceName}
            placeholder="z. B. Café Central"
            maxLength={120}
          />

          {/* Categories */}
          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">
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
                        ? 'border-brand-green-700 bg-brand-green-700'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${selected ? 'text-white' : 'text-slate-600'}`}
                    >
                      {category}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Must See */}
          <View className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-3">
            <View className="flex-row items-center gap-2">
              <Sparkles size={16} color="#f59e0b" fill="#fbbf24" />
              <Text className="text-sm font-semibold text-slate-700">Must See</Text>
            </View>
            <Switch
              value={isMustSee}
              onValueChange={setIsMustSee}
              trackColor={{ true: '#226622', false: '#cbd5e1' }}
            />
          </View>

          {/* Review */}
          <View className="gap-1.5">
            <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Deine Bewertung
            </Text>
            <View className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Was macht diesen Ort besonders?"
                placeholderTextColor="#94a3b8"
                multiline
                maxLength={1000}
                style={{ minHeight: 80, textAlignVertical: 'top' }}
                className="text-sm text-slate-800"
              />
            </View>
          </View>

          {/* Images */}
          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Fotos
            </Text>
            <View className="flex-row flex-wrap gap-2">
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
                  className="items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white"
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

          <Button
            label="Empfehlung teilen"
            trailingArrow
            loading={submitting}
            onPress={submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function CreateScreen() {
  return (
    <AuthGate context="create" headerTitle="Empfehlen">
      {(user) => <CreateForm user={user} />}
    </AuthGate>
  );
}
