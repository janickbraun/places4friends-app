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

export interface NewRecommendation {
  userId: string;
  placeName: string;
  latitude: number | null;
  longitude: number | null;
  isSuperlike: boolean;
  description: string;
  categories: string[];
  imageUrls: string[];
}

export function createRecommendation(rec: NewRecommendation) {
  return supabase.from('activities').insert({
    user_id: rec.userId,
    place_name: rec.placeName,
    latitude: rec.latitude,
    longitude: rec.longitude,
    is_superlike: rec.isSuperlike,
    description: rec.description || null,
    categories: rec.categories,
    image_urls: rec.imageUrls,
  });
}
