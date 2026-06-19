// Place categories — same set/order as the web RecommendView.
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
  'Bildung',
  'Einkaufen',
  'Sport',
  'Event',
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];
