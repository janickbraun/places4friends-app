import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Activity,
  LogIn,
  MapPin,
  User,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { Button } from '@/components/ui/Button';

export type AuthContext = 'profile' | 'create' | 'activities' | 'friends';

const MESSAGES: Record<AuthContext, { title: string; description: string; icon: LucideIcon }> = {
  profile: {
    title: 'Dein Profil',
    description:
      'Melde dich an oder erstelle ein Konto, um dein Profil zu sehen, Orte zu speichern und mit Freunden zu teilen.',
    icon: User,
  },
  friends: {
    title: 'Freunde',
    description:
      'Melde dich an oder erstelle ein Konto, um deine Freunde zu verwalten, Anfragen zu senden und eure Lieblingsorte auf der Karte zu teilen.',
    icon: Users,
  },
  create: {
    title: 'Ort empfehlen',
    description:
      'Melde dich an oder erstelle ein Konto, um Orte zu empfehlen und auf der Karte mit deinen Freunden zu teilen.',
    icon: MapPin,
  },
  activities: {
    title: 'Feed',
    description:
      'Melde dich an oder erstelle ein Konto, um die neuesten Aktivitäten und Empfehlungen deiner Freunde zu sehen.',
    icon: Activity,
  },
};

export default function AuthPrompt({ context }: { context: AuthContext }) {
  const router = useRouter();
  const { title, description, icon: Icon } = MESSAGES[context];

  return (
    <View className="flex-1 items-center justify-center px-6 py-16">
      <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl bg-brand-green-100">
        <Icon size={32} color="#226622" />
      </View>

      <Text className="text-lg font-bold text-slate-900">{title}</Text>
      <Text className="mt-2 max-w-[280px] text-center text-xs leading-relaxed text-slate-500">
        {description}
      </Text>

      <View className="mt-8 w-full max-w-[280px] gap-3">
        <Button label="Anmelden" icon={LogIn} onPress={() => router.push('/login')} />
        <Button
          label="Konto erstellen"
          icon={UserPlus}
          variant="secondary"
          onPress={() => router.push('/register')}
        />
      </View>
    </View>
  );
}
