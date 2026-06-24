# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Expo SDK 56 / React Native 0.85 / React 19.** APIs have changed across recent
> SDKs — confirm against the versioned docs (https://docs.expo.dev/versions/v56.0.0/)
> before writing native or Expo code rather than relying on memory of older SDKs.

## What this is

A native (iOS/Android) port of the existing **places4friends.com** Next.js web app:
a social map where friends recommend places (restaurants, bars, cafés, activities).
The UI is **German**. Almost every module is written for **web parity** — design
tokens, timestamp/initials/color formatting, map zoom levels, and Supabase query
shapes are deliberately mirrored from the web app so the two stay pixel- and
behaviour-compatible. When changing anything user-visible, preserve that parity;
comments throughout cite the web source being mirrored.

## Commands

```bash
npm start          # expo start (dev server; press i/a to open a build)
npm run ios        # expo run:ios     — build & run native iOS
npm run android    # expo run:android — build & run native Android
npm run web        # expo start --web
npm run lint       # expo lint (ESLint via eslint-config-expo)
```

There is **no test framework** configured — do not assume `npm test` exists.
There is no typecheck script either; run `npx tsc --noEmit` to check types (strict mode is on).

**Requires a development build, not Expo Go.** The app depends on native modules
(`react-native-maps`, Google Sign-In) absent from Expo Go. `src/lib/runtime.ts`
exposes `isExpoGo` — use it to render graceful fallbacks rather than crashing.

## Environment

All secrets are `EXPO_PUBLIC_*` (client-exposed by design; Supabase **RLS is the
security boundary**). Copy `.env.example` → `.env`. Required: Supabase URL + anon
key, Google web/iOS OAuth client IDs, Mapbox public token, web `SITE_URL` (for
invite links), and the Google Maps Android SDK key. `app.config.ts` injects the
Android Maps key and iOS permission strings on top of the static `app.json`.

## Architecture

**Routing** — `expo-router` file-based routing under `src/app/`. `typedRoutes`
and `reactCompiler` experiments are enabled. The provider stack in
[src/app/_layout.tsx](src/app/_layout.tsx) is
`GestureHandlerRootView → SafeAreaProvider → QueryClientProvider → AuthProvider`,
then the `(tabs)` group. The five tabs (`index` = the map/"Karte", `activities`,
`create`, `friends`, `profile`) render a custom [BottomNav](src/components/BottomNav.tsx)
instead of the default tab bar. Auth screens (`login`, `register`, `reset-password`)
and `profile/[id]` live outside the tab group.

**Auth** — [AuthProvider](src/components/auth/AuthProvider.tsx) holds `{ user,
loading, emailVerified }` in context; the session persists in AsyncStorage and
auto-refreshes while the app is foregrounded (wired in
[src/lib/supabase.ts](src/lib/supabase.ts)). Protected screens wrap their content
in [AuthGate](src/components/auth/AuthGate.tsx) (render-prop that yields the
authenticated `user`, or shows an `AuthPrompt` when signed out). Google Sign-In is
native (`@react-native-google-signin`); email/password and OAuth both go through
the same Supabase client.

**Data layer** — one **shared** Supabase client (`@/lib/supabase`), unlike the web
app's per-request clients. Data access is organized one file per domain under
`src/lib/` (`activities`, `friends`, `map`, `places`, `createRecommendation`,
`profile`); UI components never call Supabase directly. **RLS scopes reads to the
user + accepted friends**, so queries deliberately omit manual network filtering
(e.g. `fetchViewportPins` just filters by bounds). TanStack Query handles caching.
Generated DB types live in [src/types/database.types.ts](src/types/database.types.ts) —
regenerate after schema changes, don't hand-edit.

**Friend invites (security-sensitive)** — clients are forbidden by RLS from
inserting or self-accepting an `accepted` friendship. The only sanctioned path to
become friends via a link is the `SECURITY DEFINER` RPCs `validate_friend_invite_link`
and `accept_friend_invite`, called from [src/lib/friends.ts](src/lib/friends.ts).
Don't add a client-side shortcut that bypasses them.

**Maps** — `react-native-maps` with `supercluster` clustering.
[src/lib/map.ts](src/lib/map.ts) converts between RN-maps `Region`, lat/lng bounds,
and web tile zoom levels so search-result zoom matches the web's `getZoomLevelForType`.
`DEFAULT_REGION` is the centre of Germany. Tapping the active Karte tab fires a
`DeviceEventEmitter` event (`MAP_RESET_ZOOM_EVENT`) to clear search/selection and
zoom out, mirroring the web's `reset-map-zoom` window event.

**Place search** — `searchPlaces` calls the `places-search` Edge Function, which
prefers Google Places (when `GOOGLE_PLACES_API_KEY` is set as a function secret)
and otherwise falls back to Mapbox using the public token passed in the request
body. If the function itself is unreachable, the client falls back to a direct
Mapbox request, so search degrades gracefully.

**Supabase Edge Functions** (`supabase/functions/`, Deno runtime, excluded from the
app `tsconfig`): `places-search`, `send-verification-email`, `verify-email`. Deploy
with the Supabase CLI; they are not part of the Metro bundle.

## Conventions

- **Styling**: NativeWind v4 (`className=` Tailwind on RN). Design tokens in
  [tailwind.config.js](tailwind.config.js) are ported from the web `globals.css`;
  brand green is `#226622`. Global CSS is imported at the top of the root layout.
- **DB naming quirk**: the `is_superlike` column is surfaced in the UI as
  "must-see" (`isMustSee`). `categories` is a Postgres `text[]`; `categories.ts`
  holds the canonical (German) category list, order-matched to the web.
- **Storage**: public buckets `avatars` and `activity-images`; `getAvatarUrl`
  resolves storage paths to public URLs (with optional cache-busting).
- **Path aliases**: `@/* → ./src/*`, `@/assets/* → ./assets/*`.
- **Imports**: VS Code is configured to auto-organize/sort imports and run
  `fixAll` on save; keep imports tidy to avoid lint churn.
- **Builds**: EAS profiles (`development`/`preview`/`production`) in `eas.json`.
