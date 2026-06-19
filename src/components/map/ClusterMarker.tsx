import { Text, View } from 'react-native';

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
