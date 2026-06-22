import { useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, View, Text } from 'react-native';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react-native';

type Props = {
  onEdit: () => void;
  onDelete: () => void;
  iconSize?: number;
  iconColor?: string;
  editLabel?: string;
  deleteLabel?: string;
};

const MENU_WIDTH = 180;
const MENU_HEIGHT = 98;

/**
 * A "⋮" trigger that opens a small anchored popover with Bearbeiten / Löschen.
 * Used for own activity cards and own comments.
 */
export function EditDeleteMenu({
  onEdit,
  onDelete,
  iconSize = 18,
  iconColor = '#94a3b8',
  editLabel = 'Bearbeiten',
  deleteLabel = 'Löschen',
}: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<View>(null);

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const screen = Dimensions.get('window');
      const left = Math.max(8, Math.min(x + width - MENU_WIDTH, screen.width - MENU_WIDTH - 8));
      // Flip above the trigger if it would overflow the bottom edge.
      const below = y + height + 4;
      const top = below + MENU_HEIGHT > screen.height - 24 ? y - MENU_HEIGHT - 4 : below;
      setPos({ top, left });
      setOpen(true);
    });
  };

  // Defer the action so the popover fully closes before any follow-up modal/alert opens.
  const select = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 0);
  };

  return (
    <View ref={triggerRef} collapsable={false}>
      <Pressable
        onPress={openMenu}
        accessibilityLabel="Optionen"
        hitSlop={8}
        className="h-7 w-7 items-center justify-center rounded-full"
      >
        <MoreVertical size={iconSize} color={iconColor} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1" onPress={() => setOpen(false)}>
          <View
            style={{
              position: 'absolute',
              top: pos.top,
              left: pos.left,
              width: MENU_WIDTH,
              boxShadow: '0px 8px 30px rgba(0,0,0,0.14)',
            }}
            className="overflow-hidden rounded-2xl border border-slate-100 bg-white"
          >
            <Pressable
              onPress={() => select(onEdit)}
              className="flex-row items-center gap-3 px-4 py-3 active:bg-slate-50"
            >
              <Pencil size={16} color="#64748b" />
              <Text className="text-sm font-medium text-slate-700">{editLabel}</Text>
            </Pressable>
            <View className="h-px bg-slate-100" />
            <Pressable
              onPress={() => select(onDelete)}
              className="flex-row items-center gap-3 px-4 py-3 active:bg-red-50"
            >
              <Trash2 size={16} color="#ef4444" />
              <Text className="text-sm font-medium text-red-500">{deleteLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
