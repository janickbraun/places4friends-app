import { ActionSheetIOS, Linking, Platform } from 'react-native';

/**
 * A navigation target. The maps query is built from `name` + `address` together
 * (not the name alone): the name lets the maps app resolve the actual venue —
 * so a café/restaurant opens its real page with photos — while the address (and
 * the coordinate bias) anchors it to the right location, so a place that happens
 * to be named like a city ("München") doesn't open that city when the pin is
 * elsewhere. Coordinates are always passed as the search location.
 */
export type MapsDestination = {
  name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const hasCoords = (
  d: MapsDestination,
): d is MapsDestination & { latitude: number; longitude: number } =>
  d.latitude != null && d.longitude != null;

/**
 * The query string handed to the maps app. Prefers `"name, address"` (specific
 * enough to resolve the exact place while the address anchors the location),
 * then whichever of name/address exists, then the raw coordinates.
 */
function searchQuery(d: MapsDestination): string {
  const parts = [d.name, d.address]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p && p.length > 0);
  if (parts.length > 0) return parts.join(', ');
  if (hasCoords(d)) return `${d.latitude},${d.longitude}`;
  return '';
}

/**
 * Apple Maps universal link.
 *
 * Apple treats `q` as a plain *label* (not a search) as soon as `ll`/`address`
 * is present — so `q=<name>&ll=<coords>` just drops a pin at the raw coordinates
 * and never resolves the real venue (no place page / photos). To open the actual
 * café/restaurant/mall we therefore pass `q=<name, address>` WITHOUT `ll` and let
 * Apple search; the address inside the query anchors it to the right location.
 * Only when we have nothing but coordinates do we drop a pin via `ll`.
 */
function appleMapsUrl(d: MapsDestination): string {
  const q = searchQuery(d);
  if (q && (d.name || d.address)) {
    return `http://maps.apple.com/?q=${encodeURIComponent(q)}`;
  }
  if (hasCoords(d)) {
    return `http://maps.apple.com/?ll=${d.latitude},${d.longitude}`;
  }
  return 'http://maps.apple.com/';
}

/** Google Maps app (`comgooglemaps://`) deep link. */
function googleMapsAppUrl(d: MapsDestination): string {
  let url = `comgooglemaps://?q=${encodeURIComponent(searchQuery(d))}`;
  if (hasCoords(d)) url += `&center=${d.latitude},${d.longitude}`;
  return url;
}

/** Google Maps universal web URL — resolves to the app when it is installed (Android). */
function googleMapsWebUrl(d: MapsDestination): string {
  const params = [`query=${encodeURIComponent(searchQuery(d))}`];
  // Bias the search to the pin's location so a same-named place elsewhere
  // doesn't win.
  if (hasCoords(d)) params.push(`center=${d.latitude},${d.longitude}`);
  return `https://www.google.com/maps/search/?api=1&${params.join('&')}`;
}

const open = (url: string) => Linking.openURL(url).catch(() => {});

/**
 * Open place navigation for a destination.
 *
 * - **iOS**: if Google Maps is installed, present a chooser between Apple Karten
 *   and Google Maps; otherwise open Apple Maps directly.
 * - **Android** (and web): open Google Maps.
 *
 * Requires `comgooglemaps` in `LSApplicationQueriesSchemes` (app.config.ts) for
 * the iOS install check to return `true`.
 */
export async function openDirections(d: MapsDestination): Promise<void> {
  if (Platform.OS === 'ios') {
    const googleInstalled = await Linking.canOpenURL('comgooglemaps://').catch(() => false);
    if (!googleInstalled) {
      open(appleMapsUrl(d));
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: d.name ?? undefined,
        options: ['Apple Karten', 'Google Maps', 'Abbrechen'],
        cancelButtonIndex: 2,
      },
      (index) => {
        if (index === 0) open(appleMapsUrl(d));
        else if (index === 1) open(googleMapsAppUrl(d));
      },
    );
    return;
  }
  open(googleMapsWebUrl(d));
}
