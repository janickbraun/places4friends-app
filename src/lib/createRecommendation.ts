import { decode } from 'base64-arraybuffer';
import type { ImagePickerAsset } from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

/**
 * Upload picked images to the public `activity-images` bucket and return their
 * public URLs (stored on the activity, like the web app).
 */
export async function uploadActivityImages(
  userId: string,
  assets: ImagePickerAsset[],
): Promise<string[]> {
  const urls: string[] = [];
  for (const asset of assets) {
    if (!asset.base64) continue;
    const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase().split('?')[0];
    const contentType = asset.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from('activity-images')
      .upload(path, decode(asset.base64), { contentType });
    if (error) throw error;
    const { data } = supabase.storage.from('activity-images').getPublicUrl(path);
    if (data?.publicUrl) urls.push(data.publicUrl);
  }
  return urls;
}

/**
 * Generate a cached static map snapshot for a place via the `generate-map-snapshot`
 * Edge Function (Geoapify, server-side). Returns the stored public URL, or `null`
 * if generation fails — the post is still created, just falling back to a live
 * map tile. Best-effort, so callers never block post creation on it.
 */
export async function generateMapSnapshot(
  latitude: number | null,
  longitude: number | null,
): Promise<string | null> {
  if (latitude == null || longitude == null) return null;
  try {
    const { data, error } = await supabase.functions.invoke('generate-map-snapshot', {
      body: { latitude, longitude },
    });
    if (error) return null;
    return (data as { url?: string } | null)?.url ?? null;
  } catch {
    return null;
  }
}

export interface NewRecommendation {
  userId: string;
  placeName: string;
  placeAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  isSuperlike: boolean;
  description: string;
  categories: string[];
  imageUrls: string[];
  mapSnapshotUrl: string | null;
}

export function createRecommendation(rec: NewRecommendation) {
  return supabase.from('activities').insert({
    user_id: rec.userId,
    place_name: rec.placeName,
    place_address: rec.placeAddress,
    latitude: rec.latitude,
    longitude: rec.longitude,
    is_superlike: rec.isSuperlike,
    description: rec.description || null,
    categories: rec.categories,
    image_urls: rec.imageUrls,
    map_snapshot_url: rec.mapSnapshotUrl,
  });
}

export interface UpdateRecommendation {
  id: string;
  userId: string;
  placeName: string;
  isSuperlike: boolean;
  description: string;
  categories: string[];
  imageUrls: string[];
}

/** Update an own recommendation (RLS scopes to user_id) — mirrors web PATCH. */
export function updateRecommendation(rec: UpdateRecommendation) {
  return supabase
    .from('activities')
    .update({
      place_name: rec.placeName,
      description: rec.description || null,
      is_superlike: rec.isSuperlike,
      categories: rec.categories,
      image_urls: rec.imageUrls,
    })
    .eq('id', rec.id)
    .eq('user_id', rec.userId);
}
