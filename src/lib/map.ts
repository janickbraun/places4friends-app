import type { Region } from 'react-native-maps';
import { supabase } from '@/lib/supabase';
import { getAvatarUrl, getInitials, getUserColor } from '@/lib/format';

export const MAP_PIN_LIMIT = 400;

/** Emitted (via DeviceEventEmitter) when the Karte tab is tapped while already
 *  active — tells the map to clear search/selection and zoom back out to the
 *  overview, mirroring the web's `reset-map-zoom` window event. */
export const MAP_RESET_ZOOM_EVENT = 'p4f:reset-map-zoom';

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
  saveCount: number;
  commentCount: number;
  isSaved: boolean;
}

export interface MapPinFilters {
  userId?: string | null;
  mustSee?: boolean;
  categories?: string[];
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

/** Web-tile zoom level -> a react-native-maps region delta (inverse of regionToZoom). */
export function zoomToDelta(zoom: number): number {
  return 360 / 2 ** zoom;
}

/**
 * Target zoom for a search result, by granularity — mirrors the web
 * `getZoomLevelForType` so picking a city vs. a POI zooms appropriately.
 */
export function getZoomLevelForType(type?: string): number {
  switch (type) {
    case 'country':
      return 4.5;
    case 'region':
      return 7.5;
    case 'city':
      return 11.5;
    case 'neighborhood':
      return 14.5;
    case 'address':
      return 16;
    case 'poi':
    default:
      return 17;
  }
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

interface ActivityRow {
  id: string;
  user_id: string;
  place_name: string;
  latitude: number | null;
  longitude: number | null;
  is_superlike: boolean;
}

/** Hydrates raw activity rows into MapPins, joining in each author's profile. */
async function rowsToPins(rows: ActivityRow[]): Promise<MapPin[]> {
  const valid = rows.filter(
    (r): r is ActivityRow & { latitude: number; longitude: number } =>
      r.latitude !== null && r.longitude !== null,
  );
  const userIds = Array.from(new Set(valid.map((r) => r.user_id)));
  const profiles = await loadProfiles(userIds);

  return valid.map((r) => {
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
  return rowsToPins(rows);
}

/**
 * Fetch pins for the whole overview (no viewport constraint), honoring the
 * active filters. Used to fit the map to everything relevant — when selecting a
 * friend chip, or when resetting the map zoom — mirroring the web, whose auto-fit
 * works off the full overview set rather than only what's currently on screen.
 */
export async function fetchOverviewPins(filters: MapPinFilters = {}): Promise<MapPin[]> {
  let query = supabase
    .from('activities')
    .select('id, user_id, place_name, latitude, longitude, is_superlike')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (filters.userId) query = query.eq('user_id', filters.userId);
  if (filters.mustSee) query = query.eq('is_superlike', true);
  if (filters.categories && filters.categories.length > 0) {
    query = query.overlaps('categories', filters.categories);
  }

  const { data: rows, error } = await query.limit(MAP_PIN_LIMIT);
  if (error || !rows) return [];
  return rowsToPins(rows);
}

/** All of a single user's pins (overview, unbounded) — the friend-chip auto-fit. */
export async function fetchUserPins(
  userId: string,
  filters: Omit<MapPinFilters, 'userId'> = {},
): Promise<MapPin[]> {
  return fetchOverviewPins({ ...filters, userId });
}

export async function fetchPlaceDetails(
  id: string,
  currentUserId: string | null = null,
): Promise<MapPlaceDetails | null> {
  const [{ data, error }, { count: commentCount }, { count: saveCount }, savedRes] =
    await Promise.all([
      supabase
        .from('activities')
        .select('description, categories, image_urls, created_at')
        .eq('id', id)
        .single(),
      supabase
        .from('activity_comments')
        .select('id', { count: 'exact', head: true })
        .eq('activity_id', id),
      supabase.from('wishlist').select('id', { count: 'exact', head: true }).eq('activity_id', id),
      currentUserId
        ? supabase
            .from('wishlist')
            .select('id', { count: 'exact', head: true })
            .eq('activity_id', id)
            .eq('user_id', currentUserId)
        : Promise.resolve({ count: 0 as number | null }),
    ]);
  if (error || !data) return null;
  return {
    review: data.description ?? '',
    categories: Array.isArray(data.categories) ? data.categories : [],
    imageUrls: Array.isArray(data.image_urls) ? data.image_urls : [],
    createdAt: data.created_at,
    commentCount: commentCount ?? 0,
    saveCount: saveCount ?? 0,
    isSaved: (savedRes.count ?? 0) > 0,
  };
}
