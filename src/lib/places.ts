const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const SEARCHBOX = 'https://api.mapbox.com/search/searchbox/v1';

export interface PlaceSuggestion {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

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

/** Forward place search via the Mapbox Search Box API (matches the web's fallback). */
export async function searchPlaces(
  query: string,
  proximity?: { latitude: number; longitude: number },
): Promise<PlaceSuggestion[]> {
  if (!MAPBOX_TOKEN || !query.trim()) return [];
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
