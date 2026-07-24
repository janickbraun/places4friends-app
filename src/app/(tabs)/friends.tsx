import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import type { RealtimeChannel, User } from '@supabase/supabase-js';
import {
  Ban,
  BookUser,
  Check,
  Clock,
  Copy,
  Link2,
  Search,
  Share2,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react-native';
import AuthGate from '@/components/auth/AuthGate';
import VerificationBanner from '@/components/VerificationBanner';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { PopoverMenu } from '@/components/ui/PopoverMenu';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { PersonRowSkeletonList } from '@/components/skeletons/PersonRowSkeleton';
import { supabase } from '@/lib/supabase';
import {
  acceptFriendRequest,
  createFriendInviteLink,
  deleteFriendship,
  fetchFriendships,
  searchProfiles,
  sendFriendRequest,
  type FriendProfile,
  type RawFriendship,
  type SearchProfile,
} from '@/lib/friends';
import {
  fetchFriendSuggestions,
  mergeSuggestions,
  type FriendSuggestion,
} from '@/lib/friendSuggestions';
import { syncContacts } from '@/lib/contacts';
import {
  markContactSyncRun,
  setContactSyncEnabled,
  shouldResyncContacts,
  useContactSync,
} from '@/lib/contactSync';
import { blockUser } from '@/lib/blocks';

type Tab = 'friends' | 'requests';

function PersonRow({
  id,
  name,
  username,
  subtitle,
  avatarUrl,
  trailing,
  onPress,
}: {
  id?: string;
  name: string;
  username: string | null;
  /** Replaces the @username line — used by suggestions to show why we suggest them. */
  subtitle?: string;
  avatarUrl: string | null;
  trailing: ReactNode;
  onPress?: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between py-3">
      <Pressable
        className="flex-1 flex-row items-center gap-3"
        disabled={!onPress}
        onPress={onPress}
      >
        <Avatar url={avatarUrl} name={name} id={id} size={36} />
        <View className="flex-1">
          <Text className="text-xs font-bold text-slate-900">{name}</Text>
          {subtitle ? (
            <Text className="mt-0.5 text-[10px] font-semibold text-brand-green-700">{subtitle}</Text>
          ) : username ? (
            <Text className="mt-0.5 text-[10px] text-slate-400">@{username}</Text>
          ) : null}
        </View>
      </Pressable>
      <View className="flex-row items-center gap-2">{trailing}</View>
    </View>
  );
}

type Relationship = { id: string; status: 'pending' | 'accepted'; isSender: boolean } | null;

/** Why this person is being suggested — shown under their name. */
function suggestionReason(s: FriendSuggestion): string {
  if (s.source === 'contact') {
    return s.mutualCount > 0
      ? `Aus deinen Kontakten · ${s.mutualCount} gemeinsame${s.mutualCount === 1 ? 'r Freund' : ' Freunde'}`
      : 'Aus deinen Kontakten';
  }
  return s.mutualCount === 1 ? '1 gemeinsamer Freund' : `${s.mutualCount} gemeinsame Freunde`;
}

/**
 * Trailing control for a person you are not yet friends with: add, pending,
 * accept, or the "Befreundet" pill — shared by the suggestion list and the
 * search results so both stay in step.
 */
function RelationshipAction({
  rel,
  busy,
  onSend,
  onAccept,
}: {
  rel: Relationship;
  busy: boolean;
  onSend: () => void;
  onAccept: (friendshipId: string) => void;
}) {
  if (busy) return <ActivityIndicator size="small" color="#94a3b8" />;

  if (!rel) {
    return (
      <Pressable
        onPress={onSend}
        className="flex-row items-center gap-1 rounded-lg bg-brand-green-50 px-2.5 py-1.5"
      >
        <UserPlus size={14} color="#226622" />
        <Text className="text-[11px] font-bold text-brand-green-700">Hinzufügen</Text>
      </Pressable>
    );
  }

  if (rel.status === 'accepted') {
    return (
      <View className="rounded-md bg-brand-green-50 px-2 py-1">
        <Text className="text-[10px] font-bold text-brand-green-700">Befreundet</Text>
      </View>
    );
  }

  if (rel.isSender) {
    return (
      <View className="flex-row items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5">
        <Clock size={14} color="#64748b" />
        <Text className="text-[11px] font-bold text-slate-500">Ausstehend</Text>
      </View>
    );
  }

  return (
    <Pressable onPress={() => onAccept(rel.id)} className="rounded-lg bg-brand-green-700 px-2.5 py-1.5">
      <Text className="text-[11px] font-bold text-white">Annehmen</Text>
    </Pressable>
  );
}

function FriendsContent({ user }: { user: User }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [incoming, setIncoming] = useState<FriendProfile[]>([]);
  const [outgoing, setOutgoing] = useState<FriendProfile[]>([]);
  const [raw, setRaw] = useState<RawFriendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [contactMatches, setContactMatches] = useState<FriendSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const contactSync = useContactSync();
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  // Suggestions we already sent a request to. The RPC stops returning them
  // immediately, but keeping them on screen for the session is the feedback
  // that the tap worked — they render as "Ausstehend" until the tab remounts.
  const requested = useRef(new Set<string>());

  const mounted = useRef(true);

  const load = useCallback(async () => {
    const data = await fetchFriendships(user.id);
    if (!mounted.current) return;
    setFriends(data.friends);
    setIncoming(data.incoming);
    setOutgoing(data.outgoing);
    setRaw(data.raw);
    setLoading(false);
  }, [user.id]);

  const loadSuggestions = useCallback(async () => {
    const fresh = await fetchFriendSuggestions();
    if (!mounted.current) return;
    setSuggestions((prev) =>
      mergeSuggestions(
        prev.filter((s) => requested.current.has(s.id)),
        fresh,
      ),
    );
    setSuggestionsLoading(false);
  }, []);

  /**
   * Read the address book and match it server-side. Only ever called from the
   * opt-in card or from the daily re-sync — never unprompted, since the first
   * call triggers the OS permission dialog.
   */
  const runContactSync = useCallback(async () => {
    setContactBusy(true);
    setContactError(null);
    const result = await syncContacts();
    if (!mounted.current) return;
    if (result.ok) {
      setContactMatches(result.matches);
      markContactSyncRun();
      if (result.matches.length === 0) {
        setContactError(
          result.limited
            ? 'Keine Treffer unter den freigegebenen Kontakten. Du kannst in den iOS-Einstellungen weitere Kontakte freigeben.'
            : 'Aus deinen Kontakten ist noch niemand bei places4friends.',
        );
      }
    } else if (result.reason === 'denied') {
      setContactSyncEnabled(false);
      setContactError(
        'Ohne Zugriff auf deine Kontakte können wir keine Freunde vorschlagen. Du kannst den Zugriff in den Einstellungen erlauben.',
      );
    } else if (result.reason === 'unavailable') {
      setContactSyncEnabled(false);
      setContactError('Kontakt-Abgleich ist in dieser Version der App nicht verfügbar.');
    } else {
      setContactError('Der Kontakt-Abgleich hat nicht geklappt. Bitte versuche es später erneut.');
    }
    setContactBusy(false);
  }, []);

  const enableContactSync = useCallback(async () => {
    setContactSyncEnabled(true);
    await runContactSync();
  }, [runContactSync]);

  const disableContactSync = useCallback(() => {
    setContactSyncEnabled(false);
    setContactMatches([]);
    setContactError(null);
  }, []);

  // Re-scan at most once a day while the opt-in is on. The ref caps it at one
  // automatic attempt per mount: a failed sync doesn't record a timestamp, so
  // without it the effect would re-fire the moment `contactBusy` cleared and
  // spin on the RPC. Manual retry stays available on the error card.
  const autoSynced = useRef(false);
  useEffect(() => {
    if (autoSynced.current || contactBusy || !shouldResyncContacts(contactSync)) return;
    autoSynced.current = true;
    void runContactSync();
  }, [contactSync, contactBusy, runContactSync]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), loadSuggestions()]);
    if (mounted.current) setRefreshing(false);
  }, [load, loadSuggestions]);

  useEffect(() => {
    mounted.current = true;
    void load();
    void loadSuggestions();
    const suffix = Math.random().toString(36).slice(2);
    const channel: RealtimeChannel = supabase
      .channel(`friends:${suffix}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => load())
      .subscribe();
    return () => {
      mounted.current = false;
      void supabase.removeChannel(channel);
    };
  }, [load, loadSuggestions]);

  // Debounced profile search.
  useEffect(() => {
    if (!searchOpen) return;
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const r = await searchProfiles(query, user.id);
      setResults(r);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query, searchOpen, user.id]);

  const withBusy = async (id: string, fn: () => PromiseLike<unknown>) => {
    setBusy((p) => ({ ...p, [id]: true }));
    await fn();
    await load();
    if (mounted.current) setBusy((p) => ({ ...p, [id]: false }));
  };

  const onAccept = (f: FriendProfile) =>
    withBusy(f.id, () => acceptFriendRequest(f.friendshipId));
  const onDelete = (f: FriendProfile) => withBusy(f.id, () => deleteFriendship(f.friendshipId));
  const onSend = (id: string) => {
    requested.current.add(id);
    return withBusy(id, () => sendFriendRequest(user.id, id));
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
    setResults([]);
  };

  const openProfile = (id: string) => {
    closeSearch();
    // Let the modal dismiss before navigating to avoid a transition race.
    setTimeout(() => router.push(`/profile/${id}`), 0);
  };

  const confirmRemove = (f: FriendProfile) => {
    Alert.alert('Freund entfernen?', `${f.fullName ?? 'Diesen Freund'} wirklich entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Entfernen', style: 'destructive', onPress: () => void onDelete(f) },
    ]);
  };

  const confirmBlock = (f: FriendProfile) => {
    Alert.alert(
      'Nutzer blockieren?',
      `${f.fullName ?? 'Dieser Nutzer'} wird blockiert und aus deinen Freunden entfernt. Ihr könnt euch dann nicht mehr finden, anschreiben oder eure Kommentare sehen.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Blockieren',
          style: 'destructive',
          onPress: () => void withBusy(f.id, () => blockUser(f.id)),
        },
      ],
    );
  };

  const shareUrl = (url: string) =>
    Share.share({
      message: `Lass uns auf places4friends befreundet sein, um unsere Lieblingsorte auf einer gemeinsamen Karte zu sehen! ${url}`,
      url,
    });

  // Create the invite link, reveal it (with copy/share), and open the share sheet instantly.
  const createInvite = async () => {
    if (creatingInvite) return;
    setCreatingInvite(true);
    try {
      const url = await createFriendInviteLink(user.id);
      if (!mounted.current) return;
      setInviteUrl(url);
      setCopied(false);
      await shareUrl(url);
    } catch {
      Alert.alert('Fehler', 'Einladungslink konnte nicht erstellt werden.');
    } finally {
      if (mounted.current) setCreatingInvite(false);
    }
  };

  const copyInvite = async () => {
    if (!inviteUrl) return;
    await Clipboard.setStringAsync(inviteUrl);
    setCopied(true);
    setTimeout(() => mounted.current && setCopied(false), 1800);
  };

  // Contact matches first (the stronger signal), then friends-of-friends. Drop
  // dismissed rows and anyone who has meanwhile become a friend (e.g. they
  // accepted, or the request came in from their side).
  const visibleSuggestions = mergeSuggestions(contactMatches, suggestions).filter(
    (s) => !dismissed.includes(s.id) && !friends.some((f) => f.id === s.id),
  );

  const relationshipFor = (profileId: string) => {
    const rel = raw.find(
      (f) =>
        (f.senderId === user.id && f.receiverId === profileId) ||
        (f.receiverId === user.id && f.senderId === profileId),
    );
    if (!rel) return null;
    return { id: rel.id, status: rel.status, isSender: rel.senderId === user.id };
  };

  const Header = <ScreenHeader title="Freunde & Anfragen" />;

  const Tabs = (
    <View className="flex-row border-b border-slate-100 bg-white">
      {(['friends', 'requests'] as Tab[]).map((t) => {
        const active = tab === t;
        const count = t === 'friends' ? friends.length : incoming.length;
        return (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            className="flex-1 flex-row items-center justify-center gap-1.5 py-3"
            style={active ? { borderBottomWidth: 2, borderBottomColor: '#226622' } : undefined}
          >
            <Text
              className={`text-xs font-bold ${active ? 'text-brand-green-700' : 'text-slate-400'}`}
            >
              {t === 'friends' ? 'Freunde' : 'Anfragen'}
            </Text>
            {count > 0 ? (
              <View className="rounded-full bg-slate-100 px-1.5 py-0.5">
                <Text className="text-[10px] font-bold text-slate-600">{count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-slate-50">
        {Header}
        {Tabs}
        <View className="p-4">
          <PersonRowSkeletonList count={6} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      {Header}
      <VerificationBanner />
      {Tabs}
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#226622"
            colors={['#226622']}
          />
        }
      >
        {tab === 'friends' ? (
          <>
            {/* Invite card */}
            <View className="gap-3 rounded-2xl border border-brand-green-100 bg-brand-green-50 p-4">
              <View>
                <Text className="text-xs font-bold text-slate-900">Freunde per Link einladen</Text>
                <Text className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Link teilen – wer ihn öffnet, ist sofort mit dir befreundet.
                </Text>
              </View>

              {inviteUrl ? (
                <>
                  {/* Link box with copy button */}
                  <View className="flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 pl-3">
                    <Text numberOfLines={1} className="flex-1 text-[11px] text-slate-600">
                      {inviteUrl}
                    </Text>
                    <Pressable
                      onPress={copyInvite}
                      className="flex-row items-center gap-1 rounded-lg bg-brand-green-700 px-3 py-2"
                    >
                      {copied ? (
                        <Check size={13} color="#ffffff" />
                      ) : (
                        <Copy size={13} color="#ffffff" />
                      )}
                      <Text className="text-[11px] font-bold text-white">
                        {copied ? 'Kopiert' : 'Kopieren'}
                      </Text>
                    </Pressable>
                  </View>
                  {/* Share button */}
                  <Pressable
                    onPress={() => void shareUrl(inviteUrl)}
                    className="flex-row items-center gap-1.5 self-start rounded-xl bg-white px-4 py-2"
                  >
                    <Share2 size={14} color="#475569" />
                    <Text className="text-[11px] font-bold text-slate-600">Teilen</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={createInvite}
                  disabled={creatingInvite}
                  className={`flex-row items-center justify-center gap-1.5 self-start rounded-xl bg-brand-green-700 px-4 py-2 ${
                    creatingInvite ? 'opacity-60' : ''
                  }`}
                >
                  {creatingInvite ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Link2 size={14} color="#ffffff" />
                  )}
                  <Text className="text-[11px] font-bold text-white">Einladungslink erstellen</Text>
                </Pressable>
              )}
            </View>

            <Button label="Freunde suchen & hinzufügen" icon={UserPlus} onPress={() => setSearchOpen(true)} />

            {/* Address-book matching. Strictly opt-in — tapping is what triggers
                the OS permission dialog — and only hashed e-mail addresses are
                ever sent, never the contacts themselves. */}
            {/* The error card wins over both other states: `denied` and
                `unavailable` also switch the opt-in back off, so keying this on
                `enabled` would swap straight back to the offer and leave the
                reason unread. */}
            {contactError ? (
              <View className="gap-2 rounded-2xl border border-slate-200 bg-white p-4">
                <Text className="text-[11px] leading-relaxed text-slate-500">{contactError}</Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => void runContactSync()}
                    disabled={contactBusy}
                    className={`rounded-xl bg-slate-100 px-3 py-2 ${contactBusy ? 'opacity-60' : ''}`}
                  >
                    <Text className="text-[11px] font-bold text-slate-600">Erneut versuchen</Text>
                  </Pressable>
                  <Pressable onPress={disableContactSync} className="rounded-xl px-3 py-2">
                    <Text className="text-[11px] font-bold text-slate-400">Ausblenden</Text>
                  </Pressable>
                </View>
              </View>
            ) : contactSync.enabled ? null : (
              <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <View className="flex-row items-start gap-3">
                  <View className="h-8 w-8 items-center justify-center rounded-xl bg-slate-100">
                    <BookUser size={16} color="#475569" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-slate-900">
                      Freunde aus deinen Kontakten finden
                    </Text>
                    <Text className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      Wir prüfen, wer aus deinem Adressbuch schon dabei ist. Deine Kontakte
                      verlassen dein Gerät nicht – gesendet werden nur unlesbare Prüfsummen.
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => void enableContactSync()}
                  disabled={contactBusy}
                  className={`flex-row items-center justify-center gap-1.5 self-start rounded-xl bg-brand-green-700 px-4 py-2 ${
                    contactBusy ? 'opacity-60' : ''
                  }`}
                >
                  {contactBusy ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <BookUser size={14} color="#ffffff" />
                  )}
                  <Text className="text-[11px] font-bold text-white">Kontakte abgleichen</Text>
                </Pressable>
              </View>
            )}

            {/* Suggestions: friends of your friends, plus address-book matches
                once contact sync is on. Hidden entirely when there is nothing to
                show, so a brand-new account isn't left staring at an empty box. */}
            {suggestionsLoading || visibleSuggestions.length > 0 ? (
              <>
                <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Vorschläge für dich
                </Text>
                {suggestionsLoading ? (
                  <View className="rounded-2xl border border-slate-100 bg-white px-3 py-1">
                    <PersonRowSkeletonList count={3} />
                  </View>
                ) : (
                  <View className="rounded-2xl border border-slate-100 bg-white px-3">
                    {visibleSuggestions.map((s) => (
                      <PersonRow
                        key={s.id}
                        id={s.id}
                        onPress={() => router.push(`/profile/${s.id}`)}
                        name={s.fullName ?? s.username ?? 'User'}
                        username={s.username}
                        subtitle={suggestionReason(s)}
                        avatarUrl={s.avatarUrl}
                        trailing={
                          <>
                            <RelationshipAction
                              rel={relationshipFor(s.id)}
                              busy={!!busy[s.id]}
                              onSend={() => onSend(s.id)}
                              onAccept={(friendshipId) =>
                                void acceptFriendRequest(friendshipId).then(() => load())
                              }
                            />
                            {relationshipFor(s.id) ? null : (
                              <Pressable
                                onPress={() => setDismissed((prev) => [...prev, s.id])}
                                hitSlop={8}
                                accessibilityLabel="Vorschlag ausblenden"
                                className="h-7 w-7 items-center justify-center rounded-lg"
                              >
                                <X size={14} color="#cbd5e1" />
                              </Pressable>
                            )}
                          </>
                        }
                      />
                    ))}
                  </View>
                )}
              </>
            ) : null}

            <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Befreundete User
            </Text>
            {friends.length > 0 ? (
              <View className="rounded-2xl border border-slate-100 bg-white px-3">
                {friends.map((f) => (
                  <PersonRow
                    key={f.id}
                    id={f.id}
                    onPress={() => router.push(`/profile/${f.id}`)}
                    name={f.fullName ?? 'User'}
                    username={f.username}
                    avatarUrl={f.avatarUrl}
                    trailing={
                      busy[f.id] ? (
                        <ActivityIndicator size="small" color="#94a3b8" />
                      ) : (
                        <PopoverMenu
                          items={[
                            {
                              label: 'Freund entfernen',
                              icon: UserMinus,
                              onPress: () => confirmRemove(f),
                            },
                            {
                              label: 'Blockieren',
                              icon: Ban,
                              destructive: true,
                              onPress: () => confirmBlock(f),
                            },
                          ]}
                        />
                      )
                    }
                  />
                ))}
              </View>
            ) : (
              <View className="items-center rounded-2xl border border-dashed border-slate-200 bg-white py-12 px-6">
                <Text className="text-xs font-bold text-slate-700">Noch keine Freunde</Text>
                <Text className="mt-1 text-center text-[11px] leading-relaxed text-slate-400">
                  Suche nach anderen Usern, um ihre Empfehlungen auf deiner Karte freizuschalten.
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Eingehende Anfragen
            </Text>
            {incoming.length > 0 ? (
              <View className="rounded-2xl border border-slate-100 bg-white px-3">
                {incoming.map((f) => (
                  <PersonRow
                    key={f.id}
                    id={f.id}
                    onPress={() => router.push(`/profile/${f.id}`)}
                    name={f.fullName ?? 'User'}
                    username={f.username}
                    avatarUrl={f.avatarUrl}
                    trailing={
                      busy[f.id] ? (
                        <ActivityIndicator size="small" color="#94a3b8" />
                      ) : (
                        <>
                          <Pressable
                            onPress={() => onAccept(f)}
                            className="h-8 w-8 items-center justify-center rounded-lg bg-brand-green-50"
                          >
                            <Check size={16} color="#226622" />
                          </Pressable>
                          <Pressable
                            onPress={() => onDelete(f)}
                            className="h-8 w-8 items-center justify-center rounded-lg bg-slate-100"
                          >
                            <X size={16} color="#64748b" />
                          </Pressable>
                        </>
                      )
                    }
                  />
                ))}
              </View>
            ) : (
              <View className="items-center rounded-2xl border border-dashed border-slate-200 bg-white py-8">
                <Clock size={24} color="#cbd5e1" />
                <Text className="mt-2 text-xs font-medium text-slate-500">
                  Keine eingehenden Anfragen
                </Text>
              </View>
            )}

            <Text className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Ausgehende Anfragen
            </Text>
            {outgoing.length > 0 ? (
              <View className="rounded-2xl border border-slate-100 bg-white px-3">
                {outgoing.map((f) => (
                  <PersonRow
                    key={f.id}
                    id={f.id}
                    onPress={() => router.push(`/profile/${f.id}`)}
                    name={f.fullName ?? 'User'}
                    username={f.username}
                    avatarUrl={f.avatarUrl}
                    trailing={
                      busy[f.id] ? (
                        <ActivityIndicator size="small" color="#94a3b8" />
                      ) : (
                        <Pressable
                          onPress={() => onDelete(f)}
                          className="flex-row items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5"
                        >
                          <X size={14} color="#64748b" />
                          <Text className="text-[10px] font-bold text-slate-500">Zurückziehen</Text>
                        </Pressable>
                      )
                    }
                  />
                ))}
              </View>
            ) : (
              <View className="items-center rounded-2xl border border-dashed border-slate-200 bg-white py-8">
                <Clock size={24} color="#cbd5e1" />
                <Text className="mt-2 text-xs font-medium text-slate-500">
                  Keine ausgehenden Anfragen
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Search modal */}
      <Modal visible={searchOpen} animationType="slide" onRequestClose={closeSearch}>
        <SafeAreaProvider>
          <SafeAreaView edges={['top']} className="flex-1 bg-white">
          <View className="h-14 flex-row items-center justify-between border-b border-slate-100 px-4">
            <Text className="text-sm font-bold text-slate-900">Freunde suchen</Text>
            <Pressable onPress={closeSearch} hitSlop={8}>
              <X size={20} color="#64748b" />
            </Pressable>
          </View>
          <View className="px-4 py-4">
            <View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
              <Search size={16} color="#94a3b8" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Username oder Name suchen..."
                placeholderTextColor="#94a3b8"
                autoFocus
                maxLength={100}
                className="ml-2.5 flex-1 text-sm text-slate-800"
              />
            </View>
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {searching ? (
              <PersonRowSkeletonList count={4} />
            ) : results.length > 0 ? (
              <View className="rounded-2xl border border-slate-100 bg-white px-3">
                {results.map((p) => (
                  <PersonRow
                    key={p.id}
                    id={p.id}
                    onPress={() => openProfile(p.id)}
                    name={p.fullName ?? 'User'}
                    username={p.username}
                    avatarUrl={p.avatarUrl}
                    trailing={
                      <RelationshipAction
                        rel={relationshipFor(p.id)}
                        busy={!!busy[p.id]}
                        onSend={() => onSend(p.id)}
                        onAccept={(friendshipId) =>
                          void acceptFriendRequest(friendshipId).then(() => load())
                        }
                      />
                    }
                  />
                ))}
              </View>
            ) : query.trim() !== '' ? (
              <View className="items-center py-16">
                <Text className="text-xs font-medium text-slate-400">Keine Profile gefunden</Text>
              </View>
            ) : (
              <View className="items-center py-16">
                <Search size={28} color="#cbd5e1" />
                <Text className="mt-3 max-w-[220px] text-center text-xs text-slate-400">
                  Finde deine Freunde über ihren Namen oder Username
                </Text>
              </View>
            )}
          </ScrollView>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

export default function FriendsScreen() {
  return (
    <AuthGate context="friends" headerTitle="Freunde">
      {(user) => <FriendsContent user={user} />}
    </AuthGate>
  );
}
