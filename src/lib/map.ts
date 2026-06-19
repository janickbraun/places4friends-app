import type { Region } from 'react-native-maps';
import { supabase } from '@/lib/supabase';

export const MAP_PIN_LIMIT = 400;

// Center of Germany — the web app's fallback viewport.
export const DEFAULT_REGION: Region = {
  latitude: 51.1657,
  longitude: 10.4515,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapPin {
  id: string;
  userId: string;
  userName: string;
  userInitials: string;
  userColor: string;
  userAvatarUrl: string | null;
  name: string;
  latitude: number;
  longitude: number;
  isMustSee: boolean;
}

export interface MapPlaceDetails {
  review: string;
  categories: string[];
  imageUrls: string[];
  createdAt: string;
}

export interface MapPinFilters {
  userId?: string | null;
  mustSee?: boolean;
  categories?: string[];
}

// Hex equivalents of the web app's per-user Tailwind colors (mapNetwork.ts).
const USER_COLORS = [
  '#059669', // emerald-600
  '#f43f5e', // rose-500
  '#d97706', // amber-600
  '#2563eb', // blue-600
  '#4f46e5', // indigo-600
  '#7c3aed', // violet-600
  '#c026d3', // fuchsia-600
  '#0891b2', // cyan-600
];

export function getUserColor(userId: string): string {
  let sum = 0;
  for (let i = 0; i < userId.length; i++) sum += userId.charCodeAt(i);
  return USER_COLORS[sum % USER_COLORS.length];
}

export function getInitials(name: string): string {
  return (
    name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

export function getAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export function regionToBounds(region: Region): MapBounds {
  return {
    north: region.latitude + region.latitudeDelta / 2,
    south: region.latitude - region.latitudeDelta / 2,
    east: region.longitude + region.longitudeDelta / 2,
    west: region.longitude - region.longitudeDelta / 2,
  };
}

export function regionToZoom(region: Region): number {
  return Math.round(Math.log2(360 / Math.max(region.longitudeDelta, 1e-6)));
}

/** Expands bounds so panning does not immediately drop edge pins (web parity). */
export function expandBounds(bounds: MapBounds, paddingRatio = 0.25): MapBounds {
  const latSpan = bounds.north - bounds.south;
  const lngSpan = bounds.east - bounds.west;
  const centerLat = (bounds.north + bounds.south) / 2;
  const cosLatSafe = Math.max(0.2, Math.abs(Math.cos((centerLat * Math.PI) / 180)));
  const minLatPad = 8 / 111.32;
  const minLngPad = 8 / (111.32 * cosLatSafe);
  const latPad = Math.max(latSpan * paddingRatio, minLatPad);
  const lngPad = Math.max(lngSpan * paddingRatio, minLngPad);
  return {
    north: Math.min(90, bounds.north + latPad),
    south: Math.max(-90, bounds.south - latPad),
    east: bounds.east + lngPad,
    west: bounds.west - lngPad,
  };
}

interface ProfileInfo {
  name: string;
  initials: string;
  color: string;
  avatarUrl: string | null;
}

async function loadProfiles(userIds: string[]): Promise<Map<string, ProfileInfo>> {
  const map = new Map<string, ProfileInfo>();
  if (userIds.length === 0) return map;
  const { data } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', userIds);
  for (const p of data ?? []) {
    const name = p.full_name ?? p.username ?? 'Unbekannt';
    map.set(p.id, {
      name,
      initials: getInitials(name),
      color: getUserColor(p.id),
      avatarUrl: getAvatarUrl(p.avatar_url),
    });
  }
  return map;
}

/**
 * Fetch place pins inside the given bounds. RLS already scopes `activities` to
 * the current user + accepted friends, so no explicit network filter is needed.
 */
export async function fetchViewportPins(
  bounds: MapBounds,
  filters: MapPinFilters = {},
): Promise<MapPin[]> {
  let query = supabase
    .from('activities')
    .select('id, user_id, place_name, latitude, longitude, is_superlike')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .gte('latitude', bounds.south)
    .lte('latitude', bounds.north)
    .gte('longitude', bounds.west)
    .lte('longitude', bounds.east);

  if (filters.userId) query = query.eq('user_id', filters.userId);
  if (filters.mustSee) query = query.eq('is_superlike', true);
  if (filters.categories && filters.categories.length > 0) {
    query = query.overlaps('categories', filters.categories);
  }

  const { data: rows, error } = await query.limit(MAP_PIN_LIMIT);
  if (error || !rows) return [];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const profiles = await loadProfiles(userIds);

  return rows
    .filter((r): r is typeof r & { latitude: number; longitude: number } =>
      r.latitude !== null && r.longitude !== null,
    )
    .map((r) => {
      const profile = profiles.get(r.user_id);
      return {
        id: r.id,
        userId: r.user_id,
        userName: profile?.name ?? 'Unbekannt',
        userInitials: profile?.initials ?? '?',
        userColor: profile?.color ?? '#64748b',
        userAvatarUrl: profile?.avatarUrl ?? null,
        name: r.place_name,
        latitude: r.latitude,
        longitude: r.longitude,
        isMustSee: r.is_superlike,
      };
    });
}

export async function fetchPlaceDetails(id: string): Promise<MapPlaceDetails | null> {
  const { data, error } = await supabase
    .from('activities')
    .select('description, categories, image_urls, created_at')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return {
    review: data.description ?? '',
    categories: Array.isArray(data.categories) ? data.categories : [],
    imageUrls: Array.isArray(data.image_urls) ? data.image_urls : [],
    createdAt: data.created_at,
  };
}
