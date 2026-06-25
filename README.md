# 📍 places4friends

**Keep localism alive.** Discover, share, and pin your favorite independent spots with the friends you trust.

---

## 🌟 What is places4friends?

In a world increasingly dominated by global chains and corporate franchises, **local independent shops are losing their visibility**. Finding that authentic, cozy neighborhood café, that unique boutique bookstore, or that family-run pizzeria is becoming harder because advertising budgets and algorithms naturally favor corporate giants.

At **places4friends**, we believe that the best recommendations don't come from paid ads or anonymous online reviews—they come from **the people you actually know and trust**.

We are reclaiming localism by creating a personal, shared space where you and your friends can:
- **Spotlight local gems:** Pin and recommend independent cafés, bars, restaurants, and shops.
- **Ditch the noise:** Get recommendations exclusively from your friends, free from sponsored ads, clutter, or fake reviews.
- **Support local communities:** Direct your attention and spending to independent business owners who keep our neighborhoods unique and vibrant.

---

## 📱 Core Features

- **Interactive Social Map:** See all your friends' recommended spots in one beautiful, clustered map interface.
- **Trusted Circles:** Add friends via secure invite links to build a network of people whose tastes you value.
- **Quick Recommendations:** Save places, mark them as "must-see" (favoriten), add custom comments, and share photos.
- **Seamless Parity:** Fully synchronized with the web platform to ensure you have access to your spots on any device.

---

## 🛠️ The Tech Stack

This project is built using a modern, performant, and type-safe mobile development stack:

- **Frontend:** [React Native](https://reactnative.dev/) & [Expo](https://expo.dev/) (SDK 56) with Expo Router for file-based routing.
- **Styling:** [NativeWind](https://www.nativewind.dev/) (Tailwind CSS) for responsive, utility-first styling.
- **Backend & Auth:** [Supabase](https://supabase.com/) (Postgres DB, Row Level Security (RLS) for privacy, and Deno-powered Edge Functions).
- **Maps:** `react-native-maps` with `supercluster` for smooth marker clustering.
- **State Management:** [TanStack Query](https://tanstack.com/query) for robust data fetching and cache synchronization.

---

## 🚀 Getting Started

### 1. Prerequisites
This application depends on native modules (such as Google Sign-In and Map maps) and therefore requires a **Development Build** (running on iOS Simulator or Android Emulator) rather than the standard Expo Go app.

### 2. Installation
Install dependencies:
```bash
npm install
```

### 3. Environment Setup
Copy the example environment file and fill in your credentials:
```bash
cp .env.example .env
```
Ensure you configure the Supabase URL, anon key, Google OAuth IDs, Mapbox public token, and Google Maps API keys.

### 4. Running the App
Start the Expo development server:
```bash
npm start
```

Use the following commands to build and run the native apps:
```bash
# iOS
npm run ios

# Android
npm run android
```
