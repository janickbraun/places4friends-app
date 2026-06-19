import { ActivityIndicator, Pressable, Text } from 'react-native';
import { ArrowRight, type LucideIcon } from 'lucide-react-native';

type Variant = 'primary' | 'secondary';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  icon?: LucideIcon;
  trailingArrow?: boolean;
};

/**
 * Primary (brand-green filled) / secondary (white bordered) button matching the
 * web app, with a loading spinner and optional leading icon or trailing arrow.
 */
export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon: Icon,
  trailingArrow = false,
}: Props) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;
  const fg = isPrimary ? '#ffffff' : '#334155'; // white / slate-700

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      className={`w-full flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${
        isPrimary ? 'bg-brand-green-700' : 'border border-slate-200 bg-white'
      } ${isDisabled ? 'opacity-60' : ''}`}
      style={
        isPrimary
          ? { boxShadow: '0px 8px 16px rgba(34,102,34,0.10)' }
          : { boxShadow: '0px 1px 2px rgba(0,0,0,0.05)' }
      }
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {Icon ? <Icon size={16} color={fg} /> : null}
          <Text className={`text-sm font-semibold ${isPrimary ? 'text-white' : 'text-slate-700'}`}>
            {label}
          </Text>
          {trailingArrow ? <ArrowRight size={16} color={fg} /> : null}
        </>
      )}
    </Pressable>
  );
}
