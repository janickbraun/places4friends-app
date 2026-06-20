import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
import * as ImagePicker from 'expo-image-picker';
import { ChevronDown, ImagePlus, MapPin, Sparkles, X } from 'lucide-react-native';
import { PLACE_CATEGORIES } from '@/lib/categories';
import { updateRecommendation, uploadActivityImages } from '@/lib/createRecommendation';
import type { FeedActivity } from '@/lib/activities';

const MAX_IMAGES = 3;

/** Edit an own recommendation — review, categories, must-see, images. */
export default function EditRecommendationSheet({
  activity,
  userId,
  onClose,
  onSaved,
}: {
  activity: FeedActivity | null;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [placeName, setPlaceName] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [isMustSee, setIsMustSee] = useState(false);
  const [description, setDescription] = useState('');
  const [keptUrls, setKeptUrls] = useState<string[]>([]);
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activity) return;
    setPlaceName(activity.placeName);
    setCategories(activity.categories ?? []);
    setIsMustSee(activity.isMustSee ?? false);
    setDescription(activity.description ?? '');
    setKeptUrls(activity.imageUrls ?? []);
    setAssets([]);
    setError(null);
  }, [activity]);

  const totalImages = keptUrls.length + assets.length;

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
      selectionLimit: MAX_IMAGES - totalImages,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled) {
      setAssets((prev) => [...prev, ...result.assets].slice(0, MAX_IMAGES - keptUrls.length));
    }
  };

  const save = async () => {
    if (!activity) return;
    setError(null);
    if (!placeName.trim()) {
      setError('Bitte gib einen Namen für den Ort ein.');
      return;
    }
    setSaving(true);
    try {
      const uploaded = assets.length > 0 ? await uploadActivityImages(userId, assets) : [];
      const imageUrls = [...keptUrls, ...uploaded].slice(0, MAX_IMAGES);
      const { error: updateError } = await updateRecommendation({
        id: activity.id,
        userId,
        placeName: placeName.trim(),
        isSuperlike: isMustSee,
        description: description.trim(),
        categories,
        imageUrls,
      });
      if (updateError) throw updateError;
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Empfehlung konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={activity !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="rounded-t-3xl bg-white" style={{ maxHeight: 620 }}>
            <View className="flex-row items-center justify-between border-b border-slate-100 px-5 pb-3 pt-4">
              <View className="flex-row items-center gap-2">
                <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-green-50">
                  <MapPin size={14} color="#226622" />
                </View>
                <Text className="text-sm font-bold text-slate-900">Empfehlung bearbeiten</Text>
              </View>
              <Pressable onPress={onClose} className="h-7 w-7 items-center justify-center rounded-full bg-slate-100">
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
                    placeholder="Name des Ortes"
                    placeholderTextColor="#94a3b8"
                    maxLength={100}
                    className="ml-2.5 flex-1 text-sm font-semibold text-slate-800"
                  />
                </View>
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
                          selected ? 'border-brand-green-600 bg-brand-green-50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <Text className={`text-xs font-semibold ${selected ? 'text-brand-green-800' : 'text-slate-600'}`}>
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
                <Switch value={isMustSee} onValueChange={setIsMustSee} trackColor={{ true: '#226622', false: '#cbd5e1' }} />
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
                  {keptUrls.map((url) => (
                    <View key={url} style={{ width: 80, height: 80 }}>
                      <Image source={{ uri: url }} style={{ width: 80, height: 80, borderRadius: 12 }} contentFit="cover" />
                      <Pressable
                        onPress={() => setKeptUrls((prev) => prev.filter((u) => u !== url))}
                        className="absolute -right-1.5 -top-1.5 h-5 w-5 items-center justify-center rounded-full bg-slate-900"
                      >
                        <X size={12} color="#ffffff" />
                      </Pressable>
                    </View>
                  ))}
                  {assets.map((asset) => (
                    <View key={asset.assetId ?? asset.uri} style={{ width: 80, height: 80 }}>
                      <Image source={{ uri: asset.uri }} style={{ width: 80, height: 80, borderRadius: 12 }} contentFit="cover" />
                      <Pressable
                        onPress={() => setAssets((prev) => prev.filter((a) => a.uri !== asset.uri))}
                        className="absolute -right-1.5 -top-1.5 h-5 w-5 items-center justify-center rounded-full bg-slate-900"
                      >
                        <X size={12} color="#ffffff" />
                      </Pressable>
                    </View>
                  ))}
                  {totalImages < MAX_IMAGES ? (
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
                className="w-full flex-row items-center justify-center gap-2 rounded-xl bg-brand-green-700 py-3.5"
                style={{ opacity: saving || placeName.trim().length === 0 ? 0.6 : 1 }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-sm font-semibold text-white">Änderungen speichern</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
