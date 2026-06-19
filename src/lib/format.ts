import { supabase } from '@/lib/supabase';

// Hex equivalents of the web app's per-user Tailwind colors (mapNetwork.ts).
const USER_COLORS = [
  '#059669', // emerald-600
  '#f43f5e', // rose-500
  '#d97706', // amber-600
  '#2563eb', // blue-600
  '#4f46e5', // indigo-600
  '#7c3aed', // violet-600
  '#c026d3', // fuchsia-600
  '#0891b2', // cyan-600
];

export function getUserColor(userId: string): string {
  let sum = 0;
  for (let i = 0; i < userId.length; i++) sum += userId.charCodeAt(i);
  return USER_COLORS[sum % USER_COLORS.length];
}

export function getInitials(name: string): string {
  return (
    name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

export function getAvatarUrl(
  path: string | null | undefined,
  cacheBust = false,
): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  if (!data?.publicUrl) return null;
  return cacheBust ? `${data.publicUrl}?t=${Date.now()}` : data.publicUrl;
}

/** Relative German timestamp matching the web app (lib/auth/placeFormatting.ts). */
export function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `vor ${Math.max(1, diffMins)} Min.`;
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  if (diffDays === 1) return 'gestern';
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function buildActivityCountMap(
  rows: { activity_id: string }[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of rows) map[row.activity_id] = (map[row.activity_id] || 0) + 1;
  return map;
}
