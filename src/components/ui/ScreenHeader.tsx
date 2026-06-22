import { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
  titleClassName?: string;
};

/**
 * App header whose white background extends up through the status-bar inset, so
 * the time/battery sit on the header rather than on a separate strip. Title is
 * centered; optional left/right actions are absolutely positioned.
 */
export function ScreenHeader({ title, left, right, titleClassName }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View className="border-b border-slate-100 bg-white" style={{ paddingTop: insets.top }}>
      <View className="h-14 flex-row items-center justify-center px-3">
        {left ? <View className="absolute left-3">{left}</View> : null}
        <Text className={titleClassName ?? 'text-sm font-bold text-slate-900'}>{title}</Text>
        {right ? <View className="absolute right-3">{right}</View> : null}
      </View>
    </View>
  );
}
