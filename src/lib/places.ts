import { supabase } from '@/lib/supabase';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const SEARCHBOX = 'https://api.mapbox.com/search/searchbox/v1';

export interface PlaceSuggestion {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

type EdgePlaceResult = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

type MapboxFeature = {
  id?: string;
  bbox?: number[];
  properties?: {
    mapbox_id?: string;
    name?: string;
    place_name?: string;
    full_address?: string;
    address?: string;
    place_formatted?: string;
    bbox?: number[];
  };
  geometry?: { coordinates?: number[] };
};

function toSuggestion(f: MapboxFeature): PlaceSuggestion {
  const coords = f.geometry?.coordinates ?? [];
  return {
    id: f.properties?.mapbox_id ?? f.id ?? Math.random().toString(36).slice(2),
    name: f.properties?.name ?? f.properties?.place_name ?? 'Unbekannter Ort',
    address:
      f.properties?.full_address ??
      f.properties?.address ??
      f.properties?.place_formatted ??
      '',
    latitude: coords[1] ?? null,
    longitude: coords[0] ?? null,
  };
}

/**
 * Forward place search. Routes through the `places-search` Edge Function, which
 * uses Google Places when GOOGLE_PLACES_API_KEY is configured server-side and
 * otherwise falls back to Mapbox (via the public token we pass along). If the
 * function call fails entirely, we fall back to a direct Mapbox request so search
 * keeps working offline of the edge function. Matches the web's Google→Mapbox order.
 */
export async function searchPlaces(
  query: string,
  proximity?: { latitude: number; longitude: number },
): Promise<PlaceSuggestion[]> {
  if (!query.trim()) return [];

  try {
    const { data, error } = await supabase.functions.invoke<{ results?: EdgePlaceResult[] }>(
      'places-search',
      {
        body: {
          query,
          lat: proximity?.latitude ?? null,
          lng: proximity?.longitude ?? null,
          mapboxToken: MAPBOX_TOKEN ?? null,
        },
      },
    );
    if (!error && data?.results) {
      return data.results.map((r) => ({
        id: r.id,
        name: r.name || 'Unbekannter Ort',
        address: r.address ?? '',
        latitude: r.latitude,
        longitude: r.longitude,
      }));
    }
  } catch {
    // fall through to the direct Mapbox request below
  }

  return searchPlacesViaMapbox(query, proximity);
}

/** Direct Mapbox Search Box request — fallback when the Edge Function is unreachable. */
async function searchPlacesViaMapbox(
  query: string,
  proximity?: { latitude: number; longitude: number },
): Promise<PlaceSuggestion[]> {
  if (!MAPBOX_TOKEN) return [];
  const url = new URL(`${SEARCHBOX}/forward`);
  url.searchParams.set('q', query);
  url.searchParams.set('access_token', MAPBOX_TOKEN);
  url.searchParams.set('limit', '8');
  url.searchParams.set('language', 'de');
  if (proximity) {
    url.searchParams.set('proximity', `${proximity.longitude},${proximity.latitude}`);
  }
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: MapboxFeature[] };
    return (data.features ?? []).map(toSuggestion);
  } catch {
    return [];
  }
}

/** Max distance from a tapped point to a POI's anchor to treat the tap as "on" it. */
const POI_MATCH_RADIUS_M = 150;

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** True when the point sits inside the feature's bounding box (covers area POIs like parks). */
function withinBbox(lat: number, lng: number, bbox?: number[]): boolean {
  if (!bbox || bbox.length < 4) return false;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

async function reverseFeature(
  latitude: number,
  longitude: number,
  types?: string,
): Promise<MapboxFeature | null> {
  const url = new URL(`${SEARCHBOX}/reverse`);
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('access_token', MAPBOX_TOKEN!);
  url.searchParams.set('language', 'de');
  url.searchParams.set('limit', '1');
  if (types) url.searchParams.set('types', types);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: MapboxFeature[] };
    return (data.features ?? [])[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Reverse geocode tapped coordinates to prefill the place name/address. Prefers
 * the name of a nearby POI (so tapping a labelled place like "Englischer Garten"
 * fills its name) — matched by bounding box for areas or proximity for points —
 * and falls back to the nearest address for the address field.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<{ name: string; address: string } | null> {
  if (!MAPBOX_TOKEN) return null;

  const [poi, general] = await Promise.all([
    reverseFeature(latitude, longitude, 'poi'),
    reverseFeature(latitude, longitude),
  ]);
  if (!poi && !general) return null;

  let name = '';
  if (poi) {
    const coords = poi.geometry?.coordinates ?? [];
    const bbox = poi.bbox ?? poi.properties?.bbox;
    const onPoi =
      withinBbox(latitude, longitude, bbox) ||
      (coords.length === 2 &&
        distanceMeters(latitude, longitude, coords[1]!, coords[0]!) <= POI_MATCH_RADIUS_M);
    if (onPoi) name = poi.properties?.name ?? '';
  }

  const address =
    general?.properties?.full_address ??
    general?.properties?.place_formatted ??
    poi?.properties?.full_address ??
    poi?.properties?.place_formatted ??
    '';

  return { name, address };
}
