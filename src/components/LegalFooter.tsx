import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

/** Centered legal links — mirrors the web LegalFooter. */
export default function LegalFooter() {
  const router = useRouter();
  const Item = ({ label, doc }: { label: string; doc: string }) => (
    <Pressable onPress={() => router.push(`/legal/${doc}`)} hitSlop={6}>
      <Text className="text-[11px] text-slate-400">{label}</Text>
    </Pressable>
  );
  return (
    <View className="mt-8 flex-row flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-6">
      <Item label="Impressum" doc="impressum" />
      <Text className="text-[11px] text-slate-300">•</Text>
      <Item label="Datenschutz" doc="datenschutz" />
      <Text className="text-[11px] text-slate-300">•</Text>
      <Item label="AGB" doc="agb" />
    </View>
  );
}
