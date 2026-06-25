import { supabase } from '@/lib/supabase';

export interface AccountSettings {
  fullName: string;
  username: string;
  notificationsEnabled: boolean;
}

/** Load the editable account/profile settings for the current user. */
export async function fetchAccountSettings(userId: string): Promise<AccountSettings> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, username, notifications_enabled')
    .eq('id', userId)
    .maybeSingle();
  return {
    fullName: data?.full_name ?? '',
    username: data?.username ?? '',
    notificationsEnabled: data?.notifications_enabled ?? true,
  };
}

export interface SaveProfileInput {
  userId: string;
  fullName: string;
  username: string;
  email: string;
  currentEmail: string;
  notificationsEnabled: boolean;
  baseNotifications: boolean;
  baseFullName: string;
  baseUsername: string;
}

export interface SaveProfileResult {
  ok: boolean;
  emailChanged: boolean;
  error?: string;
}

/**
 * Persist profile + auth changes, mirroring the web SettingsView: upsert the
 * profiles row, then update auth user metadata (and email if changed).
 */
export async function saveProfileSettings(input: SaveProfileInput): Promise<SaveProfileResult> {
  const fullName = input.fullName.trim() || null;
  const username = input.username.trim() || null;
  const email = input.email.trim();

  const shouldUpdateProfile =
    fullName !== (input.baseFullName.trim() || null) ||
    username !== (input.baseUsername.trim() || null) ||
    input.notificationsEnabled !== input.baseNotifications;
  const shouldUpdateEmail = email !== input.currentEmail.trim();

  if (shouldUpdateProfile) {
    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: input.userId,
          full_name: fullName,
          username,
          notifications_enabled: input.notificationsEnabled,
        },
        { onConflict: 'id' },
      );
    if (error) return { ok: false, emailChanged: false, error: 'Profil konnte nicht gespeichert werden.' };
  }

  if (shouldUpdateProfile || shouldUpdateEmail) {
    const { error } = await supabase.auth.updateUser({
      email: shouldUpdateEmail ? email : undefined,
      data: {
        full_name: fullName ?? undefined,
        username: username ?? undefined,
      },
    });
    if (error) return { ok: false, emailChanged: false, error: 'Login-Daten konnten nicht aktualisiert werden.' };
  }

  return { ok: true, emailChanged: shouldUpdateEmail };
}

/** Change password by re-authenticating with the old one, then updating. */
export async function changePassword(params: {
  email: string;
  oldPassword: string;
  newPassword: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { error: reAuthError } = await supabase.auth.signInWithPassword({
    email: params.email,
    password: params.oldPassword,
  });
  if (reAuthError) return { ok: false, error: 'Das alte Passwort ist nicht korrekt.' };

  const { error } = await supabase.auth.updateUser({ password: params.newPassword });
  if (error) return { ok: false, error: error.message || 'Das Passwort konnte nicht aktualisiert werden.' };
  return { ok: true };
}

function publicStorageUrl(bucket: string, value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith('http')) return value;
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/${bucket}/${value}` : null;
}

/** Build the full data-export JSON (own rows only — RLS-scoped), matching web. */
export async function buildExportJson(account: {
  id: string;
  email: string | null;
  createdAt: string | null;
}): Promise<string> {
  const userId = account.id;
  const [profile, activities, comments, friendships, wishlist, inviteLinks] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('activities').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('activity_comments').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase
      .from('friendships')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false }),
    supabase.from('wishlist').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase
      .from('friend_invite_links')
      .select('*')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  const profileRow = profile.data as { avatar_url?: string | null } | null;
  const payload = {
    exportedAt: new Date().toISOString(),
    account,
    profile: profileRow
      ? {
          ...profileRow,
          avatarFile: profileRow.avatar_url
            ? { path: profileRow.avatar_url, publicUrl: publicStorageUrl('avatars', profileRow.avatar_url) }
            : null,
        }
      : null,
    activities: (activities.data ?? []).map((a: { image_urls?: string[] | null }) => ({
      ...a,
      imageFiles: (Array.isArray(a.image_urls) ? a.image_urls : []).map((p) => ({
        path: p,
        publicUrl: publicStorageUrl('activity-images', p),
      })),
    })),
    comments: comments.data ?? [],
    friendships: friendships.data ?? [],
    wishlist: wishlist.data ?? [],
    friendInviteLinks: inviteLinks.data ?? [],
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Export the user's data to a JSON file and open the OS share sheet — the native
 * equivalent of the web's file download. Uses expo-file-system + expo-sharing
 * (lazy-imported so the rest of settings works before the native rebuild).
 */
export async function exportUserData(account: {
  id: string;
  email: string | null;
  createdAt: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const json = await buildExportJson(account);
    const filename = `places4friends-export-${new Date().toISOString().slice(0, 10)}.json`;

    const { File, Paths } = await import('expo-file-system');
    const Sharing = await import('expo-sharing');

    const file = new File(Paths.cache, filename);
    if (file.exists) file.delete();
    file.create();
    file.write(json);

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, error: 'Teilen ist auf diesem Gerät nicht verfügbar.' };
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle: 'Daten exportieren',
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Export fehlgeschlagen.' };
  }
}

/** Permanently delete the account (cascades all data) via SECURITY DEFINER RPC. */
export async function deleteOwnAccount(): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('delete_own_user');
  if (error) return { ok: false, error: 'Konto konnte nicht gelöscht werden.' };
  return { ok: true };
}
