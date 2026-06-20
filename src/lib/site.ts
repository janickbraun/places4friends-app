// Normalized web origin. EXPO_PUBLIC_SITE_URL may be configured without a
// scheme (e.g. "places4friends.com"); ensure it always has https:// so it works
// as a WebView source and in shareable invite links.
const raw = process.env.EXPO_PUBLIC_SITE_URL?.trim() || 'places4friends.com';
export const SITE_URL = /^https?:\/\//.test(raw)
  ? raw.replace(/\/+$/, '')
  : `https://${raw.replace(/\/+$/, '')}`;
