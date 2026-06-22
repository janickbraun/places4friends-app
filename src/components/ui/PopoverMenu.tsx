import { useRef, useState, type ComponentType } from 'react';
import { Dimensions, Modal, Pressable, Text, View } from 'react-native';
import { MoreVertical } from 'lucide-react-native';

type IconProps = { size?: number; color?: string };

export type PopoverMenuItem = {
  label: string;
  icon: ComponentType<IconProps>;
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  items: PopoverMenuItem[];
  iconSize?: number;
  iconColor?: string;
};

const MENU_WIDTH = 190;
const ROW_HEIGHT = 49;

/**
 * A "⋮" trigger that opens a small anchored popover listing actions.
 * Used for own activity cards, own comments and removing a friend.
 */
export function PopoverMenu({ items, iconSize = 18, iconColor = '#94a3b8' }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<View>(null);
  const menuHeight = items.length * ROW_HEIGHT;

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const screen = Dimensions.get('window');
      const left = Math.max(8, Math.min(x + width - MENU_WIDTH, screen.width - MENU_WIDTH - 8));
      // Flip above the trigger if it would overflow the bottom edge.
      const below = y + height + 4;
      const top = below + menuHeight > screen.height - 24 ? Math.max(24, y - menuHeight - 4) : below;
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
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <View key={item.label}>
                  {i > 0 ? <View className="h-px bg-slate-100" /> : null}
                  <Pressable
                    onPress={() => select(item.onPress)}
                    className={`flex-row items-center gap-3 px-4 py-3 ${
                      item.destructive ? 'active:bg-red-50' : 'active:bg-slate-50'
                    }`}
                  >
                    <Icon size={16} color={item.destructive ? '#ef4444' : '#64748b'} />
                    <Text
                      className={`text-sm font-medium ${
                        item.destructive ? 'text-red-500' : 'text-slate-700'
                      }`}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
