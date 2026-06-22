import { useEffect } from 'react';
import type { DimensionValue, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const BASE_COLOR = '#e2e8f0'; // slate-200

type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: ViewStyle;
};

/** A single pulsing placeholder block. Pulse uses Reanimated (no extra deps). */
export function Skeleton({ width, height, radius = 6, style }: SkeletonProps) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const base: ViewStyle = { backgroundColor: BASE_COLOR, borderRadius: radius };
  if (width !== undefined) base.width = width;
  if (height !== undefined) base.height = height;

  return <Animated.View style={[base, style, animatedStyle]} />;
}

/** Circular skeleton (avatars). */
export function SkeletonCircle({ size, style }: { size: number; style?: ViewStyle }) {
  return <Skeleton width={size} height={size} radius={size / 2} style={style} />;
}
