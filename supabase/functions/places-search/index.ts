import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { handleOptions, json } from '../_shared/cors.ts';

// Ports the web `/api/places/search` route. Prefers Google Places when
// GOOGLE_PLACES_API_KEY is set as a function secret; otherwise falls back to
// the Mapbox Search Box API using the public `pk.` token the client supplies
// in the request body (the same token the web exposes via NEXT_PUBLIC_MAPBOX_TOKEN).
// This keeps search working out of the box (Mapbox) and auto-upgrades to Google
// the moment the secret is configured in the dashboard.

interface PlaceResult {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  source: 'google' | 'mapbox';
  type: string;
}

const GOOGLE_PLACES_ENDPOINT = 'https://maps.googleapis.com/maps/api/place';
const MAPBOX_SEARCHBOX = 'https://api.mapbox.com/search/searchbox/v1/forward';

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function mapGoogleType(types: string[]): string {
  if (!types || types.length === 0) return 'poi';
  if (types.includes('country')) return 'country';
  if (types.includes('administrative_area_level_1') || types.includes('administrative_area_level_2'))
    return 'region';
  if (types.includes('locality')) return 'city';
  if (types.includes('sublocality') || types.includes('neighborhood')) return 'neighborhood';
  if (types.includes('route') || types.includes('street_address') || types.includes('postal_code'))
    return 'address';
  return 'poi';
}

function mapMapboxType(featureType: string): string {
  if (!featureType) return 'poi';
  if (featureType === 'country') return 'country';
  if (featureType === 'region' || featureType === 'district') return 'region';
  if (featureType === 'place' || featureType === 'locality' || featureType === 'city') return 'city';
  if (featureType === 'neighborhood') return 'neighborhood';
  if (featureType === 'address' || featureType === 'postcode' || featureType === 'street')
    return 'address';
  return 'poi';
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  // Accept params from either a JSON body (functions.invoke) or query string.
  let body: Record<string, unknown> = {};
  if (req.method === 'POST') {
    body = await req.json().catch(() => ({}));
  }
  const url = new URL(req.url);
  const pick = (key: string) => body[key] ?? url.searchParams.get(key);

  let query = String(pick('query') ?? '').trim();
  if (query.length > 200) query = query.substring(0, 200);
  const lat = num(pick('lat'));
  const lng = num(pick('lng'));
  const mode = String(pick('mode') ?? 'anywhere');
  const radius = Math.min(Math.max(Number.parseInt(String(pick('radius') ?? '3000'), 10), 500), 50000);
  const mapboxToken = (pick('mapboxToken') as string | null) ?? null;

  if (lat !== null && (lat < -90 || lat > 90)) {
    return json({ error: 'Ungültige geographische Breite.' }, 400);
  }
  if (lng !== null && (lng < -180 || lng > 180)) {
    return json({ error: 'Ungültige geographische Länge.' }, 400);
  }

  const googleKey = Deno.env.get('GOOGLE_PLACES_API_KEY');

  // --- Google Places (preferred when a key is configured) ---
  if (googleKey) {
    if (!query && (lat === null || lng === null)) {
      return json({ results: [] });
    }
    const endpoint = new URL(
      query || mode === 'nearby'
        ? `${GOOGLE_PLACES_ENDPOINT}/${query ? 'textsearch' : 'nearbysearch'}/json`
        : `${GOOGLE_PLACES_ENDPOINT}/textsearch/json`,
    );
    endpoint.searchParams.set('key', googleKey);
    if (query) endpoint.searchParams.set('query', query);
    if (lat !== null && lng !== null) {
      endpoint.searchParams.set('location', `${lat},${lng}`);
      endpoint.searchParams.set('radius', String(radius));
    }

    const response = await fetch(endpoint.toString(), { headers: { Accept: 'application/json' } });
    const data = await response.json();
    if (!response.ok || data.status === 'REQUEST_DENIED') {
      return json({ error: data.error_message ?? 'Places API Fehler.' }, 502);
    }
    const results: PlaceResult[] = (data.results ?? []).map((place: Record<string, any>) => ({
      id: place.place_id,
      name: place.name,
      address: place.formatted_address ?? null,
      latitude: place.geometry?.location?.lat ?? null,
      longitude: place.geometry?.location?.lng ?? null,
      source: 'google',
      type: mapGoogleType(place.types ?? []),
    }));
    return json({ results });
  }

  // --- Mapbox fallback (uses the public token provided by the client) ---
  if (!mapboxToken) {
    return json({ error: 'Kein Places API Token konfiguriert.' }, 500);
  }
  if (!query) return json({ results: [] });

  const endpoint = new URL(MAPBOX_SEARCHBOX);
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('access_token', mapboxToken);
  endpoint.searchParams.set('limit', '8');
  endpoint.searchParams.set('language', 'de');
  if (lat !== null && lng !== null) {
    endpoint.searchParams.set('proximity', `${lng},${lat}`);
  }

  const response = await fetch(endpoint.toString(), { headers: { Accept: 'application/json' } });
  const data = await response.json();
  if (!response.ok) {
    return json({ error: 'Mapbox Suche fehlgeschlagen.' }, 502);
  }
  const results: PlaceResult[] = (data.features ?? []).map((feature: Record<string, any>) => ({
    id: feature.properties?.mapbox_id ?? feature.id ?? Math.random().toString(),
    name: feature.properties?.name ?? feature.properties?.place_name ?? 'Unbekannter Ort',
    address:
      feature.properties?.full_address ??
      feature.properties?.address ??
      feature.properties?.place_formatted ??
      null,
    latitude: feature.geometry?.coordinates?.[1] ?? null,
    longitude: feature.geometry?.coordinates?.[0] ?? null,
    source: 'mapbox',
    type: mapMapboxType(feature.properties?.feature_type),
  }));
  return json({ results });
});
