import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Base map layer: `standard` (vector map) or `hybrid` (satellite + labels, UI "Satellit"). */
export type MapLayer = 'standard' | 'hybrid';

const STORAGE_KEY = 'p4f.mapLayer';
const DEFAULT_LAYER: MapLayer = 'standard';

// Module-level store so every screen shares the same value live, backed by
// AsyncStorage so the choice survives app restarts.
let current: MapLayer = DEFAULT_LAYER;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

// Load the persisted value once, the first time anything subscribes.
async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if ((raw === 'standard' || raw === 'hybrid') && raw !== current) {
      current = raw;
      emit();
    }
  } catch {
    // keep the default
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  void hydrate();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): MapLayer {
  return current;
}

export function setMapLayer(value: MapLayer): void {
  if (value === current) return;
  current = value;
  emit();
  AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {});
}

/**
 * Locally-persisted base map layer (Standard vs Satellit), shared and kept in
 * sync across every screen that uses it (the Karte tab and the Empfehlen tab).
 */
export function useMapLayer(): [MapLayer, (value: MapLayer) => void] {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return [value, setMapLayer];
}
