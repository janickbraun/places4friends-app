import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

type Coord = { latitude: number; longitude: number };

/** Cluster bubble showing how many pins are grouped at this point. */
export function ClusterMarker({ count }: { count: number }) {
  const size = count < 10 ? 38 : count < 100 ? 46 : 54;
  return (
    <View
      className="items-center justify-center rounded-full bg-brand-green-700"
      style={{
        width: size,
        height: size,
        borderWidth: 3,
        borderColor: '#ffffff',
        boxShadow: '0px 2px 6px rgba(0,0,0,0.3)',
      }}
    >
      <Text className="font-bold text-white" style={{ fontSize: count < 100 ? 14 : 12 }}>
        {count}
      </Text>
    </View>
  );
}

/**
 * <Marker> wrapper for a cluster bubble. On Android a marker renders its view into
 * a bitmap snapshot; with `tracksViewChanges` off from the first frame that snapshot
 * is taken before the count `Text` has painted, leaving an empty circle (the count
 * "not showing" on stacked pins). So we track view changes briefly — re-armed
 * whenever the count changes — then stop for performance. iOS doesn't need this but
 * the behaviour is identical there.
 */
export function ClusterMapMarker({
  count,
  coordinate,
  onPress,
}: {
  count: number;
  coordinate: Coord;
  onPress: () => void;
}) {
  const [tracks, setTracks] = useState(true);
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
  }, []);

  useEffect(() => {
    setTracks(true);
    const t = setTimeout(() => {
      if (mounted.current) setTracks(false);
    }, 500);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <Marker coordinate={coordinate} onPress={onPress} tracksViewChanges={tracks}>
      <ClusterMarker count={count} />
    </Marker>
  );
}
