import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/components/auth/AuthProvider';
import { finishOnboarding, isOnboardingActive, subscribeOnboarding } from '@/lib/onboarding';

type Step = { id: string; title: string; description: string; bullets?: string[] };

const STEPS: Step[] = [
  {
    id: 'welcome',
    title: 'Willkommen bei places4friends',
    description:
      'Hier kannst du besondere Orte mit deinen Freunden teilen und ihre Empfehlungen erkunden. Auf einer gemeinsamen Karte behaltet ihr alle Orte im Überblick.',
  },
  {
    id: 'map',
    title: 'Die Karte verstehen',
    description:
      'Die Karte ist dein Radar. Filtere Empfehlungen, entdecke Highlights und öffne Details direkt am Pin.',
    bullets: [
      'Filtere nach Kategorien oder Freunden.',
      'Springe direkt zu deinem Standort.',
      'Klicke auf Pins, um Details und Kommentare zu sehen.',
    ],
  },
  {
    id: 'activities',
    title: 'Aktivitäten verstehen',
    description: 'Hier siehst du die neusten Empfehlungen deiner Freunde.',
    bullets: [
      'Klicke auf das Bookmark Symbol, um die Aktivität deiner Wishlist hinzuzufügen.',
      'Klicke auf das Kommentar Symbol, um einen Kommentar zu hinterlassen.',
      'Klicke auf den Navigations Button, um die Route zu öffnen.',
    ],
  },
  {
    id: 'recommendations',
    title: 'Empfehlungen abgeben',
    description: 'Hier kannst du neue Empfehlungen hinzufügen.',
    bullets: [
      'Drücke auf die Karte, um einen Pin zu setzen.',
      'Alternativ kannst du auch in der Suchleiste nach einem Ort suchen und diesen auswählen.',
      'Füge dann weitere Details zu deiner Empfehlung hinzu.',
      'Füge bis zu 3 Bilder hinzu, um die besten Eindrücke zu teilen.',
      'Mit Klick auf Speichern erscheint deine Empfehlung in der Karte.',
    ],
  },
  {
    id: 'friends',
    title: 'Freunde hinzufügen',
    description:
      'Folge Freunden, damit ihre Empfehlungen auf deiner Karte und im Aktivitäten-Feed auftauchen.',
    bullets: [
      'Suche nach Namen oder Benutzernamen.',
      'Freundschaftsanfragen findest du im Freunde-Tab.',
      'Teile einen Freundeslink, um dich direkt mit Freunden zu verbinden.',
    ],
  },
  {
    id: 'profile',
    title: 'Profil bearbeiten',
    description: 'Hier kannst du deine Daten und deine Empfehlungen verwalten.',
    bullets: [
      'Über das Zahnrad oben rechts öffnest du die Einstellungen.',
      'Bei "Empfehlungen" kannst du deine Orte bearbeiten oder löschen.',
      'Unter "Gespeichert" siehst du deine vorgemerkten Empfehlungen.',
      'Setze ein Profilbild, damit Freunde dich leichter erkennen.',
    ],
  },
];

export default function OnboardingOverlay() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    let active = true;
    void isOnboardingActive().then((on) => {
      if (active && on) {
        setStepIndex(0);
        setVisible(true);
      }
    });
    const unsub = subscribeOnboarding(() => {
      setStepIndex(0);
      setVisible(true);
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  if (!user || !visible) return null;

  const step = STEPS[stepIndex] ?? STEPS[0];
  const isLast = stepIndex >= STEPS.length - 1;

  const complete = () => {
    void finishOnboarding();
    setVisible(false);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={complete}>
      <View className="flex-1 items-center justify-center bg-slate-950/50 px-5">
        <View className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6" style={{ maxHeight: '80%' }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-semibold text-slate-400">
              Schritt {stepIndex + 1} von {STEPS.length}
            </Text>
            <Pressable onPress={complete} hitSlop={6} className="rounded-full px-3 py-1">
              <Text className="text-xs font-semibold text-slate-500">Überspringen</Text>
            </Pressable>
          </View>

          <Text className="mt-3 text-xl font-bold text-slate-900">{step.title}</Text>

          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingBottom: 4 }}>
            <Text className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</Text>
            {step.bullets ? (
              <View className="mt-4 gap-2">
                {step.bullets.map((b) => (
                  <View key={b} className="flex-row items-start gap-2">
                    <View className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-green-600" />
                    <Text className="flex-1 text-sm leading-relaxed text-slate-600">{b}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <View className="mt-6 flex-row items-center gap-3">
            <Pressable
              onPress={() => setStepIndex((p) => Math.max(0, p - 1))}
              disabled={stepIndex === 0}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5"
              style={{ opacity: stepIndex === 0 ? 0.5 : 1 }}
            >
              <Text className="text-center text-sm font-semibold text-slate-600">Zurück</Text>
            </Pressable>
            <Pressable
              onPress={() => (isLast ? complete() : setStepIndex((p) => Math.min(STEPS.length - 1, p + 1)))}
              className="flex-1 rounded-xl bg-brand-green-700 py-2.5"
            >
              <Text className="text-center text-sm font-semibold text-white">
                {isLast ? "Los geht's" : 'Weiter'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
