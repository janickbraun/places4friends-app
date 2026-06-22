import { useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, Text, View } from 'react-native';
import { Check, Layers } from 'lucide-react-native';

export type MapLayer = 'standard' | 'satellite' | 'hybrid';

const OPTIONS: { value: MapLayer; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'satellite', label: 'Satellit' },
  { value: 'hybrid', label: 'Hybrid' },
];

const MENU_WIDTH = 170;
const MENU_HEIGHT = OPTIONS.length * 45 + 2;

/**
 * Round map control that opens a small popover to switch the base map layer
 * (Standard / Satellit / Hybrid). Used on both the map tab and the create map.
 */
export function MapLayerControl({
  value,
  onChange,
}: {
  value: MapLayer;
  onChange: (value: MapLayer) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<View>(null);

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const screen = Dimensions.get('window');
      const left = Math.max(8, Math.min(x + width - MENU_WIDTH, screen.width - MENU_WIDTH - 8));
      // Anchor above the button (it sits near the bottom of the map).
      const above = y - MENU_HEIGHT - 8;
      const top = above < 24 ? y + height + 8 : above;
      setPos({ top, left });
      setOpen(true);
    });
  };

  return (
    <View ref={triggerRef} collapsable={false}>
      <Pressable
        onPress={openMenu}
        accessibilityLabel="Kartenebene ändern"
        className="h-10 w-10 items-center justify-center rounded-full bg-white"
        style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.15)' }}
      >
        <Layers size={20} color="#334155" />
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
            {OPTIONS.map((option, i) => {
              const active = value === option.value;
              return (
                <View key={option.value}>
                  {i > 0 ? <View className="h-px bg-slate-100" /> : null}
                  <Pressable
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className="flex-row items-center justify-between px-4 py-3 active:bg-slate-50"
                  >
                    <Text
                      className={`text-sm font-medium ${
                        active ? 'text-brand-green-700' : 'text-slate-700'
                      }`}
                    >
                      {option.label}
                    </Text>
                    {active ? <Check size={16} color="#226622" /> : null}
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
