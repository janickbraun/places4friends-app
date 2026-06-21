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
  properties?: {
    mapbox_id?: string;
    name?: string;
    place_name?: string;
    full_address?: string;
    address?: string;
    place_formatted?: string;
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

/** Reverse geocode tapped coordinates to prefill the place name/address. */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<{ name: string; address: string } | null> {
  if (!MAPBOX_TOKEN) return null;
  const url = new URL(`${SEARCHBOX}/reverse`);
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('access_token', MAPBOX_TOKEN);
  url.searchParams.set('language', 'de');
  url.searchParams.set('limit', '1');
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: MapboxFeature[] };
    const feature = (data.features ?? [])[0];
    if (!feature) return null;
    return {
      name: feature.properties?.name ?? '',
      address:
        feature.properties?.full_address ?? feature.properties?.place_formatted ?? '',
    };
  } catch {
    return null;
  }
}
