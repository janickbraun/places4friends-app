import { supabase } from '@/lib/supabase';

/**
 * Report a post (activity) for review. A user can only report a given post once —
 * the `(activity_id, reporter_id)` unique constraint makes a repeat report a no-op
 * (ignoreDuplicates), so the caller never sees a conflict error.
 */
export function reportActivity(activityId: string, reporterId: string) {
  return supabase
    .from('reports')
    .upsert(
      { activity_id: activityId, reporter_id: reporterId },
      { onConflict: 'activity_id,reporter_id', ignoreDuplicates: true },
    );
}
