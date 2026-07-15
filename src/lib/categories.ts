// Place categories — mostly mirrors the web RecommendView, with local tweaks
// (no Bildung/Event; added Skate-Spot).
export const PLACE_CATEGORIES = [
  'Cafe',
  'Restaurant',
  'Freizeitpark',
  'Bar',
  'Museum',
  'Kino',
  'Park',
  'Natur',
  'Sehenswürdigkeit',
  'Date',
  'Freizeit',
  'Piss-Spot',
  'Einkaufen',
  'Sport',
  'Skate-Spot',
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];
