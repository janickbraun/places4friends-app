import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RealtimeChannel, User } from '@supabase/supabase-js';
import { Check, Clock, Search, Share2, UserMinus, UserPlus, X } from 'lucide-react-native';
import AuthGate from '@/components/auth/AuthGate';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
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

type Tab = 'friends' | 'requests';

function PersonRow({
  name,
  username,
  avatarUrl,
  trailing,
}: {
  name: string;
  username: string | null;
  avatarUrl: string | null;
  trailing: ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between py-3">
      <View className="flex-1 flex-row items-center gap-3">
        <Avatar url={avatarUrl} name={name} size={36} />
        <View className="flex-1">
          <Text className="text-xs font-bold text-slate-900">{name}</Text>
          {username ? <Text className="mt-0.5 text-[10px] text-slate-400">@{username}</Text> : null}
        </View>
      </View>
      <View className="flex-row items-center gap-2">{trailing}</View>
    </View>
  );
}

function FriendsContent({ user }: { user: User }) {
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [incoming, setIncoming] = useState<FriendProfile[]>([]);
  const [outgoing, setOutgoing] = useState<FriendProfile[]>([]);
  const [raw, setRaw] = useState<RawFriendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [creatingInvite, setCreatingInvite] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchProfile[]>([]);
  const [searching, setSearching] = useState(false);

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

  useEffect(() => {
    mounted.current = true;
    void load();
    const suffix = Math.random().toString(36).slice(2);
    const channel: RealtimeChannel = supabase
      .channel(`friends:${suffix}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => load())
      .subscribe();
    return () => {
      mounted.current = false;
      void supabase.removeChannel(channel);
    };
  }, [load]);

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
  const onSend = (id: string) => withBusy(id, () => sendFriendRequest(user.id, id));

  const confirmRemove = (f: FriendProfile) => {
    Alert.alert('Freund entfernen?', `${f.fullName ?? 'Diesen Freund'} wirklich entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Entfernen', style: 'destructive', onPress: () => void onDelete(f) },
    ]);
  };

  const shareInvite = async () => {
    setCreatingInvite(true);
    try {
      const url = await createFriendInviteLink(user.id);
      await Share.share({
        message: `Lass uns auf places4friends befreundet sein, um unsere Lieblingsorte auf einer gemeinsamen Karte zu sehen! ${url}`,
        url,
      });
    } catch {
      Alert.alert('Fehler', 'Einladungslink konnte nicht erstellt werden.');
    } finally {
      setCreatingInvite(false);
    }
  };

  const relationshipFor = (profileId: string) => {
    const rel = raw.find(
      (f) =>
        (f.senderId === user.id && f.receiverId === profileId) ||
        (f.receiverId === user.id && f.senderId === profileId),
    );
    if (!rel) return null;
    return { id: rel.id, status: rel.status, isSender: rel.senderId === user.id };
  };

  const Header = (
    <View className="h-14 items-center justify-center border-b border-slate-100 bg-white">
      <Text className="text-sm font-bold text-slate-900">Freunde &amp; Anfragen</Text>
    </View>
  );

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
      <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
        {Header}
        {Tabs}
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#226622" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      {Header}
      {Tabs}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }}>
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
              <Pressable
                onPress={shareInvite}
                disabled={creatingInvite}
                className={`flex-row items-center justify-center gap-1.5 self-start rounded-xl bg-brand-green-700 px-4 py-2 ${
                  creatingInvite ? 'opacity-60' : ''
                }`}
              >
                {creatingInvite ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Share2 size={14} color="#ffffff" />
                )}
                <Text className="text-[11px] font-bold text-white">Einladungslink teilen</Text>
              </Pressable>
            </View>

            <Button label="Freunde suchen & hinzufügen" icon={UserPlus} onPress={() => setSearchOpen(true)} />

            <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Befreundete User
            </Text>
            {friends.length > 0 ? (
              <View className="rounded-2xl border border-slate-100 bg-white px-3">
                {friends.map((f) => (
                  <PersonRow
                    key={f.id}
                    name={f.fullName ?? 'User'}
                    username={f.username}
                    avatarUrl={f.avatarUrl}
                    trailing={
                      busy[f.id] ? (
                        <ActivityIndicator size="small" color="#94a3b8" />
                      ) : (
                        <Pressable
                          onPress={() => confirmRemove(f)}
                          hitSlop={6}
                          className="h-8 w-8 items-center justify-center rounded-lg"
                        >
                          <UserMinus size={18} color="#f43f5e" />
                        </Pressable>
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
      <Modal visible={searchOpen} animationType="slide" onRequestClose={() => setSearchOpen(false)}>
        <SafeAreaView edges={['top']} className="flex-1 bg-white">
          <View className="h-14 flex-row items-center justify-between border-b border-slate-100 px-4">
            <Text className="text-sm font-bold text-slate-900">Freunde suchen</Text>
            <Pressable
              onPress={() => {
                setSearchOpen(false);
                setQuery('');
                setResults([]);
              }}
              hitSlop={8}
            >
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
              <View className="py-10">
                <ActivityIndicator color="#94a3b8" />
              </View>
            ) : results.length > 0 ? (
              <View className="rounded-2xl border border-slate-100 bg-white px-3">
                {results.map((p) => {
                  const rel = relationshipFor(p.id);
                  const name = p.fullName ?? 'User';
                  let trailing: ReactNode;
                  if (busy[p.id]) {
                    trailing = <ActivityIndicator size="small" color="#94a3b8" />;
                  } else if (!rel) {
                    trailing = (
                      <Pressable
                        onPress={() => onSend(p.id)}
                        className="flex-row items-center gap-1 rounded-lg bg-brand-green-50 px-2.5 py-1.5"
                      >
                        <UserPlus size={14} color="#226622" />
                        <Text className="text-[11px] font-bold text-brand-green-700">Hinzufügen</Text>
                      </Pressable>
                    );
                  } else if (rel.status === 'accepted') {
                    trailing = (
                      <View className="rounded-md bg-brand-green-50 px-2 py-1">
                        <Text className="text-[10px] font-bold text-brand-green-700">Befreundet</Text>
                      </View>
                    );
                  } else if (rel.isSender) {
                    trailing = (
                      <View className="flex-row items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5">
                        <Clock size={14} color="#64748b" />
                        <Text className="text-[11px] font-bold text-slate-500">Ausstehend</Text>
                      </View>
                    );
                  } else {
                    trailing = (
                      <Pressable
                        onPress={() => rel && void acceptFriendRequest(rel.id).then(() => load())}
                        className="rounded-lg bg-brand-green-700 px-2.5 py-1.5"
                      >
                        <Text className="text-[11px] font-bold text-white">Annehmen</Text>
                      </Pressable>
                    );
                  }
                  return (
                    <PersonRow
                      key={p.id}
                      name={name}
                      username={p.username}
                      avatarUrl={p.avatarUrl}
                      trailing={trailing}
                    />
                  );
                })}
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
      </Modal>
    </SafeAreaView>
  );
}

export default function FriendsScreen() {
  return (
    <AuthGate context="friends" headerTitle="Freunde">
      {(user) => <FriendsContent user={user} />}
    </AuthGate>
  );
}
