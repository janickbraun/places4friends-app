import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { User } from '@supabase/supabase-js';
import {
  ArrowLeft,
  Ban,
  Bookmark,
  Clock,
  MapPin,
  MessageCircle,
  Sparkles,
  UserCheck,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react-native';
import AuthGate from '@/components/auth/AuthGate';
import ActivityCard from '@/components/ActivityCard';
import { ReportMenu } from '@/components/ReportMenu';
import { PopoverMenu, type PopoverMenuItem } from '@/components/ui/PopoverMenu';
import { blockUser } from '@/lib/blocks';
import { CommentsThread } from '@/components/activities/CommentsThread';
import { ProfileHeaderSkeleton } from '@/components/skeletons/ProfileHeaderSkeleton';
import { ActivityCardSkeleton } from '@/components/skeletons/ActivityCardSkeleton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { addToWishlist, removeFromWishlist } from '@/lib/activities';
import {
  fetchPublicProfile,
  type PublicFriendship,
  type PublicProfileData,
} from '@/lib/profile';
import {
  acceptFriendRequest,
  deleteFriendship,
  fetchFriendships,
  redeemInviteLink,
  sendFriendRequest,
  validateInviteLink,
  type FriendProfile,
  type InviteValidationError,
} from '@/lib/friends';
import { getInitials, getUserColor } from '@/lib/format';

type InviteState = 'idle' | 'loading' | 'valid' | InviteValidationError;

const firstName = (name: string | null) => name?.split(' ')[0] ?? 'Freund';

function PublicProfileContent({
  profileId,
  inviteToken,
  user,
}: {
  profileId: string;
  inviteToken: string | null;
  user: User;
}) {
  const router = useRouter();
  const currentUserId = user.id;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [data, setData] = useState<PublicProfileData | null>(null);
  const [friendship, setFriendship] = useState<PublicFriendship | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [saveCounts, setSaveCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  const [inviteState, setInviteState] = useState<InviteState>(inviteToken ? 'loading' : 'idle');
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [friendsModalOpen, setFriendsModalOpen] = useState(false);
  const [friendsList, setFriendsList] = useState<FriendProfile[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Viewing your own public profile -> go to the profile tab.
  useEffect(() => {
    if (profileId === currentUserId) {
      router.replace('/profile');
    }
  }, [profileId, currentUserId, router]);

  const load = useCallback(async () => {
    const result = await fetchPublicProfile(profileId, currentUserId);
    if (!result) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setData(result);
    setFriendship(result.friendship);
    setWishlistIds(result.wishlistedIds);
    const sc: Record<string, number> = {};
    const cc: Record<string, number> = {};
    result.places.forEach((p) => {
      sc[p.id] = p.saveCount;
      cc[p.id] = p.commentCount;
    });
    setSaveCounts(sc);
    setCommentCounts(cc);
    setLoading(false);
  }, [profileId, currentUserId]);

  useEffect(() => {
    if (profileId === currentUserId) return;
    void load();
  }, [load, profileId, currentUserId]);

  // Validate the invite token (read-only) once on mount.
  useEffect(() => {
    if (!inviteToken) return;
    let active = true;
    void validateInviteLink(inviteToken).then((res) => {
      if (!active) return;
      setInviteState(res.valid ? 'valid' : res.error ?? 'not_found');
    });
    return () => {
      active = false;
    };
  }, [inviteToken]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/friends');
  };

  const handleSendRequest = async () => {
    setSubmitting(true);
    const { error } = await sendFriendRequest(currentUserId, profileId);
    if (!error) await load();
    setSubmitting(false);
  };

  const handleAccept = async () => {
    if (!friendship) return;
    setSubmitting(true);
    const { error } = await acceptFriendRequest(friendship.id);
    if (!error) await load();
    setSubmitting(false);
  };

  const handleRemove = async () => {
    if (!friendship) return;
    setSubmitting(true);
    const { error } = await deleteFriendship(friendship.id);
    if (!error) await load();
    setSubmitting(false);
  };

  const handleBlock = async () => {
    setSubmitting(true);
    const { error } = await blockUser(profileId);
    setSubmitting(false);
    if (error) {
      Alert.alert('Fehler', 'Der Nutzer konnte nicht blockiert werden.');
      return;
    }
    // Friendship is gone and the profile's posts are now private — leave the screen.
    goBack();
  };

  const confirmRemove = () => {
    const n = data?.profile.fullName ?? data?.profile.username ?? 'Diesen Freund';
    Alert.alert('Freundschaft entfernen?', `${n} aus deinen Freunden entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Entfernen', style: 'destructive', onPress: () => void handleRemove() },
    ]);
  };

  const confirmBlock = () => {
    const n = data?.profile.fullName ?? data?.profile.username ?? 'Diesen Nutzer';
    Alert.alert(
      'Nutzer blockieren?',
      `${n} wird blockiert und aus deinen Freunden entfernt. Ihr könnt euch dann nicht mehr finden, anschreiben oder eure Kommentare sehen.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Blockieren', style: 'destructive', onPress: () => void handleBlock() },
      ],
    );
  };

  const handleAcceptInvite = async () => {
    if (!inviteToken || inviteState !== 'valid') return;
    setSubmitting(true);
    setInviteError(null);
    const result = await redeemInviteLink({ token: inviteToken, profileId, currentUserId });
    if (result.success) {
      await load();
    } else {
      if (result.error === 'expired' || result.error === 'max_uses' || result.error === 'not_found') {
        setInviteState(result.error);
      }
      setInviteError('Einladung konnte nicht angenommen werden.');
    }
    setSubmitting(false);
  };

  const toggleWishlist = async (activityId: string) => {
    const saved = wishlistIds.includes(activityId);
    setWishlistIds((prev) =>
      saved ? prev.filter((id) => id !== activityId) : [...prev, activityId],
    );
    setSaveCounts((prev) => ({
      ...prev,
      [activityId]: Math.max(0, (prev[activityId] ?? 0) + (saved ? -1 : 1)),
    }));
    const { error } = saved
      ? await removeFromWishlist(currentUserId, activityId)
      : await addToWishlist(currentUserId, activityId);
    if (error) {
      setWishlistIds((prev) =>
        saved ? [...prev, activityId] : prev.filter((id) => id !== activityId),
      );
      setSaveCounts((prev) => ({
        ...prev,
        [activityId]: Math.max(0, (prev[activityId] ?? 0) + (saved ? 1 : -1)),
      }));
    }
  };

  const openFriendsModal = async () => {
    // Only accepted friends may view this profile's friends list.
    if (friendship?.status !== 'accepted') return;
    setFriendsModalOpen(true);
    setLoadingFriends(true);
    const { friends } = await fetchFriendships(profileId);
    setFriendsList(friends);
    setLoadingFriends(false);
  };

  const renderHeader = (right?: ReactNode) => (
    <ScreenHeader
      title="Profil"
      titleClassName="text-lg font-bold text-slate-900"
      left={
        <Pressable
          onPress={goBack}
          hitSlop={8}
          className="h-8 w-8 items-center justify-center rounded-lg"
        >
          <ArrowLeft size={20} color="#64748b" />
        </Pressable>
      }
      right={right}
    />
  );

  if (loading || profileId === currentUserId) {
    return (
      <View className="flex-1 bg-slate-50">
        {renderHeader()}
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <ProfileHeaderSkeleton avatarSize={88} />
          <View className="mt-8 gap-3.5">
            <ActivityCardSkeleton />
            <ActivityCardSkeleton />
          </View>
        </ScrollView>
      </View>
    );
  }

  if (notFound || !data) {
    return (
      <View className="flex-1 bg-slate-50">
        {renderHeader()}
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-sm font-semibold text-slate-900">Profil nicht gefunden</Text>
          <Text className="mt-2 text-center text-xs text-slate-500">
            Dieses Profil existiert nicht oder ist nicht mehr verfügbar.
          </Text>
        </View>
      </View>
    );
  }

  const { profile, friendsCount } = data;
  const name = profile.fullName ?? profile.username ?? 'Freund';
  const accepted = friendship?.status === 'accepted';
  const showInviteAction = !!inviteToken && (!friendship || friendship.status === 'pending');
  const inviteInvalidMessage =
    inviteState === 'expired'
      ? 'Dieser Einladungslink ist abgelaufen. Bitte deinen Freund um einen neuen Link.'
      : inviteState === 'max_uses'
        ? 'Dieser Einladungslink wurde bereits zu oft verwendet. Bitte deinen Freund um einen neuen Link.'
        : inviteState === 'not_found'
          ? 'Dieser Einladungslink ist ungültig.'
          : null;

  // Header "⋮" menu: always offers Blockieren; offers removing the friendship/request
  // when one exists. Friendship management lives here, so the "Befreundet" pill below
  // is just a status indicator.
  const friendshipMenuLabel =
    friendship?.status === 'accepted'
      ? 'Freundschaft entfernen'
      : friendship?.senderId === currentUserId
        ? 'Anfrage zurückziehen'
        : 'Anfrage ablehnen';
  const menuItems: PopoverMenuItem[] = [];
  if (friendship) {
    menuItems.push({ label: friendshipMenuLabel, icon: UserMinus, onPress: confirmRemove });
  }
  menuItems.push({ label: 'Blockieren', icon: Ban, destructive: true, onPress: confirmBlock });

  return (
    <View className="flex-1 bg-slate-50">
      {renderHeader(<PopoverMenu items={menuItems} iconColor="#64748b" />)}
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile card */}
        <View className="items-center pt-2">
          {profile.avatarUrl ? (
            <View className="h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-full bg-slate-100 shadow">
              <Image
                source={{ uri: profile.avatarUrl }}
                style={{ width: 88, height: 88 }}
                contentFit="cover"
              />
            </View>
          ) : (
            <View
              className="h-[88px] w-[88px] items-center justify-center rounded-full shadow"
              style={{ backgroundColor: getUserColor(profile.id) }}
            >
              <Text className="text-2xl font-bold text-white">{getInitials(name)}</Text>
            </View>
          )}

          <Text className="mt-4 text-lg font-bold text-slate-950">{name}</Text>
          {profile.username ? (
            <Text className="mt-0.5 text-xs font-semibold text-brand-green-700">
              @{profile.username}
            </Text>
          ) : null}

          {accepted ? (
            <Pressable onPress={openFriendsModal} className="mt-2" hitSlop={6}>
              <Text className="text-[11px] font-semibold text-slate-500">
                {friendsCount} {friendsCount === 1 ? 'Freund' : 'Freunde'}
              </Text>
            </Pressable>
          ) : null}

          {/* Action area */}
          <View className="mt-4 w-full max-w-sm">
            {showInviteAction ? (
              <View className="rounded-2xl border border-brand-green-100 bg-brand-green-50/60 p-4">
                <View className="flex-row items-start gap-3">
                  <View className="h-8 w-8 items-center justify-center rounded-xl bg-brand-green-100">
                    <Sparkles size={16} color="#226622" fill="#bbf7d0" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-slate-900">
                      Einladung von {firstName(profile.fullName)}
                    </Text>
                    {inviteState === 'loading' ? (
                      <View className="mt-1 flex-row items-center gap-1.5">
                        <ActivityIndicator size="small" color="#64748b" />
                        <Text className="text-[11px] text-slate-500">Einladung wird geprüft...</Text>
                      </View>
                    ) : inviteInvalidMessage ? (
                      <Text className="mt-1 text-[11px] leading-relaxed text-amber-700">
                        {inviteInvalidMessage}
                      </Text>
                    ) : (
                      <Text className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        Verbinde dich direkt, um eure Lieblingsorte gegenseitig auf der Karte zu
                        sehen und Highlights zu teilen.
                      </Text>
                    )}

                    {inviteError ? (
                      <Text className="mt-2 text-[11px] text-red-600">{inviteError}</Text>
                    ) : null}

                    {inviteState === 'valid' ? (
                      <Pressable
                        onPress={handleAcceptInvite}
                        disabled={submitting}
                        className="mt-3.5 flex-row items-center justify-center gap-2 rounded-xl bg-brand-green-700 px-4 py-2"
                        style={{ opacity: submitting ? 0.6 : 1 }}
                      >
                        {submitting ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <UserPlus size={14} color="#ffffff" />
                        )}
                        <Text className="text-xs font-bold text-white">Einladung annehmen</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            ) : (
              <FriendActionButton
                friendship={friendship}
                currentUserId={currentUserId}
                submitting={submitting}
                onSend={handleSendRequest}
                onAccept={handleAccept}
                onRemove={handleRemove}
              />
            )}
          </View>
        </View>

        {/* Recommendations */}
        <View className="mt-8">
          <Text className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
            Empfehlungen von {firstName(profile.fullName)}
          </Text>

          {accepted ? (
            data.places.length > 0 ? (
              <View className="gap-3.5">
                {data.places.map((place) => {
                  const saved = wishlistIds.includes(place.id);
                  const saveCount = saveCounts[place.id] ?? 0;
                  const commentCount = commentCounts[place.id] ?? 0;
                  return (
                    <ActivityCard
                      key={place.id}
                      id={place.id}
                      placeName={place.placeName}
                      latitude={place.latitude}
                      longitude={place.longitude}
                      isMustSee={place.isMustSee}
                      description={place.description}
                      categories={place.categories}
                      timestamp={place.timestamp}
                      imageUrls={place.imageUrls}
                      headerAction={<ReportMenu activityId={place.id} reporterId={currentUserId} />}
                      bottomLeftActions={
                        <>
                          <Pressable
                            onPress={() => toggleWishlist(place.id)}
                            className="flex-row items-center gap-1.5 p-1"
                            hitSlop={6}
                          >
                            <Bookmark
                              size={20}
                              color={saved ? '#226622' : '#64748b'}
                              fill={saved ? '#226622' : 'transparent'}
                            />
                            {saveCount > 0 ? (
                              <Text
                                className={`text-[11px] font-semibold ${
                                  saved ? 'text-brand-green-700' : 'text-slate-500'
                                }`}
                              >
                                {saveCount}
                              </Text>
                            ) : null}
                          </Pressable>
                          <Pressable
                            onPress={() => setActiveId((prev) => (prev === place.id ? null : place.id))}
                            className="flex-row items-center gap-1.5 p-1"
                            hitSlop={6}
                          >
                            <MessageCircle size={18} color="#64748b" />
                            {commentCount > 0 ? (
                              <Text className="text-[11px] font-semibold text-slate-500">
                                {commentCount}
                              </Text>
                            ) : null}
                          </Pressable>
                        </>
                      }
                    >
                      {activeId === place.id ? (
                        <CommentsThread
                          activityId={place.id}
                          currentUserId={currentUserId}
                          onCountChange={(n) =>
                            setCommentCounts((prev) => ({ ...prev, [place.id]: n }))
                          }
                        />
                      ) : null}
                    </ActivityCard>
                  );
                })}
              </View>
            ) : (
              <View className="items-center rounded-2xl border border-dashed border-slate-200 bg-white py-12">
                <MapPin size={32} color="#cbd5e1" />
                <Text className="mt-2 text-xs font-medium text-slate-500">
                  Noch keine Empfehlungen eingetragen
                </Text>
              </View>
            )
          ) : (
            <View className="items-center rounded-2xl border border-slate-100 bg-white px-6 py-12">
              <MapPin size={32} color="#cbd5e1" />
              <Text className="mt-3 text-xs font-bold text-slate-800">Beiträge sind privat</Text>
              <Text className="mt-1 max-w-[240px] text-center text-[11px] leading-relaxed text-slate-400">
                Verbinde dich mit {firstName(profile.fullName)}, um die Empfehlungen zu sehen.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Friends modal */}
      <Modal
        visible={friendsModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFriendsModalOpen(false)}
      >
        <Pressable
          onPress={() => setFriendsModalOpen(false)}
          className="flex-1 items-center justify-center bg-slate-950/40 px-4"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="max-h-[80%] w-full max-w-md overflow-hidden rounded-2xl border border-slate-100 bg-white"
          >
            <View className="flex-row items-center justify-between border-b border-slate-100 px-5 py-4">
              <Text className="text-sm font-bold text-slate-900">
                Freunde von {firstName(profile.fullName)}
              </Text>
              <Pressable onPress={() => setFriendsModalOpen(false)} hitSlop={8}>
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 12 }}>
              {loadingFriends ? (
                <View className="items-center py-16">
                  <ActivityIndicator color="#226622" />
                  <Text className="mt-3 text-xs font-medium text-slate-400">
                    Freunde werden geladen...
                  </Text>
                </View>
              ) : friendsList.length > 0 ? (
                friendsList.map((f) => (
                  <Pressable
                    key={f.id}
                    onPress={() => {
                      setFriendsModalOpen(false);
                      router.push(`/profile/${f.id}`);
                    }}
                    className="flex-row items-center gap-3 p-3"
                  >
                    <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-200">
                      {f.avatarUrl ? (
                        <Image
                          source={{ uri: f.avatarUrl }}
                          style={{ width: 36, height: 36 }}
                          contentFit="cover"
                        />
                      ) : (
                        <Text className="text-xs font-bold text-slate-600">
                          {getInitials(f.fullName ?? f.username ?? '?')}
                        </Text>
                      )}
                    </View>
                    <View>
                      <Text className="text-xs font-bold text-slate-900">
                        {f.fullName ?? 'User'}
                      </Text>
                      {f.username ? (
                        <Text className="mt-0.5 text-[10px] text-slate-400">@{f.username}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))
              ) : (
                <View className="items-center rounded-2xl border border-dashed border-slate-200 py-14">
                  <Text className="text-xs font-medium text-slate-500">Noch keine Freunde</Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function FriendActionButton({
  friendship,
  currentUserId,
  submitting,
  onSend,
  onAccept,
  onRemove,
}: {
  friendship: PublicFriendship | null;
  currentUserId: string;
  submitting: boolean;
  onSend: () => void;
  onAccept: () => void;
  onRemove: () => void;
}) {
  if (submitting) {
    return (
      <View className="flex-row items-center justify-center gap-2 self-center rounded-xl bg-slate-100 px-4 py-2">
        <ActivityIndicator size="small" color="#94a3b8" />
        <Text className="text-xs font-bold text-slate-400">Verarbeiten...</Text>
      </View>
    );
  }

  if (!friendship) {
    return (
      <Pressable
        onPress={onSend}
        className="flex-row items-center justify-center gap-2 self-center rounded-xl bg-brand-green-700 px-4 py-2"
      >
        <UserPlus size={14} color="#ffffff" />
        <Text className="text-xs font-bold text-white">Freund hinzufügen</Text>
      </Pressable>
    );
  }

  if (friendship.status === 'pending' && friendship.senderId === currentUserId) {
    return (
      <Pressable
        onPress={onRemove}
        className="flex-row items-center justify-center gap-2 self-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-2"
      >
        <Clock size={14} color="#94a3b8" />
        <Text className="text-xs font-bold text-slate-500">Anfrage ausstehend</Text>
      </Pressable>
    );
  }

  if (friendship.status === 'pending') {
    return (
      <Pressable
        onPress={onAccept}
        className="flex-row items-center justify-center gap-2 self-center rounded-xl bg-brand-green-700 px-4 py-2"
      >
        <UserCheck size={14} color="#ffffff" />
        <Text className="text-xs font-bold text-white">Anfrage annehmen</Text>
      </Pressable>
    );
  }

  return (
    <View className="flex-row items-center justify-center gap-2 self-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-2">
      <UserCheck size={14} color="#226622" />
      <Text className="text-xs font-bold text-slate-600">Befreundet</Text>
    </View>
  );
}

export default function PublicProfileScreen() {
  const { id, invite } = useLocalSearchParams<{ id: string; invite?: string }>();
  const inviteToken = typeof invite === 'string' && invite.length > 0 ? invite : null;

  return (
    <AuthGate context="profile" headerTitle="Profil">
      {(user) => (
        <PublicProfileContent profileId={id} inviteToken={inviteToken} user={user} />
      )}
    </AuthGate>
  );
}
