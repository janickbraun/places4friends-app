import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { ArrowLeft } from 'lucide-react-native';
import { SITE_URL } from '@/lib/site';

const DOCS: Record<string, { path: string; title: string }> = {
  impressum: { path: '/impressum', title: 'Impressum' },
  datenschutz: { path: '/datenschutz', title: 'Datenschutz' },
  agb: { path: '/agb', title: 'Nutzungsbedingungen' },
};

// Hide the web page's own sticky header so only our native header shows.
// Injected before content loads (and again after) so the header never flashes.
const HIDE_WEB_CHROME = `
  (function () {
    var css = 'header{display:none!important;} body{padding-top:0!important;}';
    var existing = document.getElementById('p4f-hide');
    var s = existing || document.createElement('style');
    s.id = 'p4f-hide';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  })();
  true;
`;

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const entry = DOCS[doc ?? ''] ?? DOCS.impressum;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
      <View className="h-14 flex-row items-center justify-between border-b border-slate-100 bg-white px-4">
        <Pressable onPress={() => router.back()} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-lg">
          <ArrowLeft size={20} color="#64748b" />
        </Pressable>
        <Text className="text-sm font-bold text-slate-900">{entry.title}</Text>
        <View className="w-8" />
      </View>

      <View className="flex-1">
        <WebView
          source={{ uri: `${SITE_URL}${entry.path}` }}
          injectedJavaScriptBeforeContentLoaded={HIDE_WEB_CHROME}
          injectedJavaScript={HIDE_WEB_CHROME}
          onLoadEnd={() => setLoading(false)}
          startInLoadingState={false}
          originWhitelist={['https://*', 'http://*']}
        />
        {loading ? (
          <View className="absolute inset-0 items-center justify-center bg-white">
            <ActivityIndicator color="#226622" />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
