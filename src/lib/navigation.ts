import { ActionSheetIOS, Linking, Platform } from 'react-native';

/**
 * A navigation target. When `name` is set, the maps app opens the actual named
 * place (searched near its coordinates) instead of dropping an unlabeled pin at
 * raw coordinates.
 */
export type MapsDestination = {
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const hasCoords = (
  d: MapsDestination,
): d is MapsDestination & { latitude: number; longitude: number } =>
  d.latitude != null && d.longitude != null;

/** `name` (preferred) or `lat,lng` for query-style URLs. */
function query(d: MapsDestination): string {
  if (d.name) return encodeURIComponent(d.name);
  if (hasCoords(d)) return `${d.latitude},${d.longitude}`;
  return '';
}

/** Apple Maps universal link: searches the name near the coordinates. */
function appleMapsUrl(d: MapsDestination): string {
  const params: string[] = [];
  if (d.name) params.push(`q=${encodeURIComponent(d.name)}`);
  if (hasCoords(d)) params.push(`ll=${d.latitude},${d.longitude}`);
  return params.length ? `http://maps.apple.com/?${params.join('&')}` : 'http://maps.apple.com/';
}

/** Google Maps app (`comgooglemaps://`) deep link. */
function googleMapsAppUrl(d: MapsDestination): string {
  let url = `comgooglemaps://?q=${query(d)}`;
  if (hasCoords(d)) url += `&center=${d.latitude},${d.longitude}`;
  return url;
}

/** Google Maps universal web URL — resolves to the app when it is installed (Android). */
function googleMapsWebUrl(d: MapsDestination): string {
  return `https://www.google.com/maps/search/?api=1&query=${query(d)}`;
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
