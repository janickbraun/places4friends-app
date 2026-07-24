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
import LegalFooter from '@/components/LegalFooter';

export type AuthContext = 'profile' | 'create' | 'activities' | 'friends' | 'invite';

const MESSAGES: Record<AuthContext, { title: string; description: string; icon: LucideIcon }> = {
  invite: {
    title: 'Du wurdest eingeladen',
    description:
      'Erstelle ein Konto oder melde dich an, um die Einladung anzunehmen. Danach seht ihr eure Lieblingsorte gegenseitig auf der Karte.',
    icon: UserPlus,
  },
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
  // Someone arriving from an invite link almost never has an account yet, so
  // sign-up is the primary action there; everywhere else logging in is.
  const signUpFirst = context === 'invite';

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
        <Button
          label={signUpFirst ? 'Konto erstellen' : 'Anmelden'}
          icon={signUpFirst ? UserPlus : LogIn}
          onPress={() => router.push(signUpFirst ? '/register' : '/login')}
        />
        <Button
          label={signUpFirst ? 'Anmelden' : 'Konto erstellen'}
          icon={signUpFirst ? LogIn : UserPlus}
          variant="secondary"
          onPress={() => router.push(signUpFirst ? '/login' : '/register')}
        />
      </View>

      <LegalFooter />
    </View>
  );
}
