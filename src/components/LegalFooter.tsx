import { Pressable, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { SITE_URL } from '@/lib/site';

const PATHS: Record<string, string> = {
  impressum: '/impressum',
  datenschutz: '/datenschutz',
  agb: '/agb',
};

/** Centered legal links — open the live pages in the external browser. */
export default function LegalFooter() {
  const Item = ({ label, doc }: { label: string; doc: string }) => (
    <Pressable onPress={() => Linking.openURL(`${SITE_URL}${PATHS[doc]}`)} hitSlop={6}>
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
