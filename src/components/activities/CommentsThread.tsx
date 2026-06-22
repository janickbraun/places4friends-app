import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Pencil, Trash2 } from 'lucide-react-native';
import {
  addComment,
  deleteComment,
  fetchComments,
  updateComment,
  type ActivityComment,
} from '@/lib/activities';
import { formatTimestamp } from '@/lib/format';
import { PopoverMenu } from '@/components/ui/PopoverMenu';

type Props = {
  activityId: string;
  currentUserId: string | null;
  onCountChange?: (count: number) => void;
};

/** Inline comment thread for an activity (matches the web's expandable comments). */
export function CommentsThread({ activityId, currentUserId, onCountChange }: Props) {
  const [comments, setComments] = useState<ActivityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingInput, setEditingInput] = useState('');

  // Keep the latest onCountChange in a ref so `load` (and its effect) only
  // re-run when the activity changes — parents pass a new inline callback every
  // render, which would otherwise cause an infinite fetch/flicker loop.
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const load = useCallback(async () => {
    const list = await fetchComments(activityId);
    setComments(list);
    onCountChangeRef.current?.(list.length);
    setLoading(false);
  }, [activityId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const handleAdd = async () => {
    const content = input.trim();
    if (!content || !currentUserId) return;
    setSaving(true);
    setError(null);
    const { error: e } = await addComment(activityId, currentUserId, content);
    if (e) setError('Kommentar konnte nicht gespeichert werden.');
    else {
      setInput('');
      await load();
    }
    setSaving(false);
  };

  const handleUpdate = async (id: string) => {
    const content = editingInput.trim();
    if (!content) return;
    setSaving(true);
    setError(null);
    const { error: e } = await updateComment(id, content);
    if (e) setError('Kommentar konnte nicht gespeichert werden.');
    else {
      setEditingId(null);
      setEditingInput('');
      await load();
    }
    setSaving(false);
  };

  const confirmDelete = (id: string) => {
    Alert.alert(
      'Kommentar löschen?',
      'Möchtest du diesen Kommentar wirklich löschen? Dieser Schritt kann nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            const { error: e } = await deleteComment(id);
            if (e) setError('Kommentar konnte nicht gelöscht werden.');
            else await load();
          },
        },
      ],
    );
  };

  return (
    <View className="mt-4 border-t border-slate-100 pt-3">
      <Text className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Kommentare
      </Text>

      {error ? (
        <View className="mt-2 rounded-lg border border-red-100 bg-red-50 px-2.5 py-2">
          <Text className="text-[10px] text-red-700">{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View className="mt-3 flex-row items-center gap-2">
          <ActivityIndicator size="small" color="#94a3b8" />
          <Text className="text-[11px] text-slate-400">Kommentare werden geladen...</Text>
        </View>
      ) : comments.length === 0 ? (
        <Text className="mt-2 text-[11px] text-slate-500">Noch keine Kommentare.</Text>
      ) : (
        <View className="mt-3 gap-3">
          {comments.map((comment) => {
            const isOwn = currentUserId === comment.userId;
            const isEditing = editingId === comment.id;
            return (
              <View key={comment.id} className="flex-row gap-2">
                <View
                  className="h-6 w-6 items-center justify-center overflow-hidden rounded-full"
                  style={{ backgroundColor: comment.userColor }}
                >
                  {comment.userAvatarUrl ? (
                    <Image
                      source={{ uri: comment.userAvatarUrl }}
                      style={{ width: 24, height: 24 }}
                      contentFit="cover"
                    />
                  ) : (
                    <Text className="text-[9px] font-bold text-white">
                      {comment.userInitials}
                    </Text>
                  )}
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[11px] font-semibold text-slate-700">
                      {comment.userName}
                    </Text>
                    <Text className="text-[9px] text-slate-400">
                      {formatTimestamp(comment.createdAt)}
                    </Text>
                    {isOwn && !isEditing ? (
                      <View className="ml-auto">
                        <PopoverMenu
                          iconSize={15}
                          items={[
                            {
                              label: 'Bearbeiten',
                              icon: Pencil,
                              onPress: () => {
                                setEditingId(comment.id);
                                setEditingInput(comment.content);
                              },
                            },
                            {
                              label: 'Löschen',
                              icon: Trash2,
                              destructive: true,
                              onPress: () => confirmDelete(comment.id),
                            },
                          ]}
                        />
                      </View>
                    ) : null}
                  </View>

                  {isEditing ? (
                    <View className="mt-1 flex-row items-center gap-2">
                      <TextInput
                        value={editingInput}
                        onChangeText={setEditingInput}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700"
                        placeholderTextColor="#94a3b8"
                      />
                      <Pressable
                        onPress={() => handleUpdate(comment.id)}
                        disabled={saving || editingInput.trim().length === 0}
                        className="rounded-lg bg-brand-green-700 px-2 py-1"
                      >
                        <Text className="text-[9px] font-semibold text-white">OK</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setEditingId(null);
                          setEditingInput('');
                        }}
                        className="rounded-lg border border-slate-200 px-2 py-1"
                      >
                        <Text className="text-[9px] font-semibold text-slate-500">X</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text className="text-[11px] leading-snug text-slate-600">
                      {comment.content}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {currentUserId ? (
        <View className="mt-3 flex-row gap-2">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Kommentar schreiben"
            placeholderTextColor="#94a3b8"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-700"
          />
          <Pressable
            onPress={handleAdd}
            disabled={saving || input.trim().length === 0}
            className={`items-center justify-center rounded-lg bg-brand-green-700 px-3 ${
              saving || input.trim().length === 0 ? 'opacity-60' : ''
            }`}
          >
            <Text className="text-[10px] font-semibold text-white">Senden</Text>
          </Pressable>
        </View>
      ) : (
        <Text className="mt-3 text-[10px] text-slate-500">
          Melde dich an, um zu kommentieren.
        </Text>
      )}
    </View>
  );
}
