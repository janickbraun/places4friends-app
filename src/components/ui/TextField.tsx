import { forwardRef, useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

type Props = TextInputProps & {
  label?: string;
  icon?: LucideIcon;
};

/**
 * Styled text input matching the web app's fields: rounded-xl, slate border,
 * leading icon, and a brand-green border on focus (the web focus ring).
 */
export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, icon: Icon, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View className="gap-1.5">
      {label ? (
        <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </Text>
      ) : null}
      <View
        className={`flex-row items-center rounded-xl border bg-white px-3.5 py-3 ${
          focused ? 'border-brand-green-500' : 'border-slate-200'
        }`}
        style={{ boxShadow: '0px 1px 2px rgba(0,0,0,0.05)' }}
      >
        {Icon ? <Icon size={18} color="#94a3b8" style={{ marginRight: 10 }} /> : null}
        <TextInput
          ref={ref}
          className="flex-1 text-sm text-slate-800"
          placeholderTextColor="#94a3b8"
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
        />
      </View>
    </View>
  );
});
