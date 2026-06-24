import type { ConfigContext, ExpoConfig } from 'expo/config';

// Extends the static app.json with values that depend on env vars / runtime:
// location permission strings and the Android Google Maps key for react-native-maps.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'places4friends-mobile-app',
  slug: config.slug ?? 'places4friends-mobile-app',
  ios: {
    ...config.ios,
    infoPlist: {
      ...(config.ios?.infoPlist ?? {}),
      NSLocationWhenInUseUsageDescription:
        'Wir verwenden deinen Standort, um Orte in deiner Nähe auf der Karte anzuzeigen.',
      NSPhotoLibraryUsageDescription:
        'Wir verwenden deine Fotos, um sie zu deinen Ortsempfehlungen hinzuzufügen.',
      // Lets Linking.canOpenURL detect Google Maps so we can offer it alongside
      // Apple Karten in the navigation chooser (see src/lib/navigation.ts).
      LSApplicationQueriesSchemes: [
        ...((config.ios?.infoPlist?.LSApplicationQueriesSchemes as string[] | undefined) ?? []),
        'comgooglemaps',
      ],
    },
  },
  android: {
    ...config.android,
    permissions: [
      ...(config.android?.permissions ?? []),
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
    ],
    config: {
      ...(config.android?.config ?? {}),
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY ?? '',
      },
    },
  },
});
