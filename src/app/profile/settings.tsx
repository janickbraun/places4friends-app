import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { User } from '@supabase/supabase-js';
import {
  ArrowLeft,
  AtSign,
  Bell,
  ChevronRight,
  Download,
  Lock,
  LogOut,
  Mail,
  Shield,
  Sparkles,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import AuthGate from '@/components/auth/AuthGate';
import LegalFooter from '@/components/LegalFooter';
import { SettingsSkeleton } from '@/components/skeletons/SettingsSkeleton';
import { supabase } from '@/lib/supabase';
import {
  changePassword,
  deleteOwnAccount,
  exportUserData,
  fetchAccountSettings,
  saveProfileSettings,
} from '@/lib/settings';
import { startOnboarding } from '@/lib/onboarding';

const USERNAME_RE = /^[a-zA-Z0-9_.]+$/;

type MsgKind = 'idle' | 'saving' | 'success' | 'error';

function Field({
  label,
  icon: Icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  maxLength,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address' | 'default';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  maxLength?: number;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-semibold text-slate-600">{label}</Text>
      <View className="flex-row items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <Icon size={16} color="#94a3b8" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
          className="flex-1 text-sm font-medium text-slate-800"
        />
      </View>
    </View>
  );
}

function Banner({ kind, message }: { kind: MsgKind; message: string | null }) {
  if (!message) return null;
  const error = kind === 'error';
  return (
    <View
      className={`rounded-xl border px-3 py-2.5 ${
        error ? 'border-rose-100 bg-rose-50' : 'border-emerald-100 bg-emerald-50'
      }`}
    >
      <Text className={`text-xs font-semibold ${error ? 'text-rose-700' : 'text-emerald-700'}`}>
        {message}
      </Text>
    </View>
  );
}

function MenuRow({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  onPress,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center justify-between p-4">
      <View className="flex-1 flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: iconBg }}>
          <Icon size={20} color={iconColor} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-slate-800">{title}</Text>
          <Text className="text-xs text-slate-500">{subtitle}</Text>
        </View>
      </View>
      <ChevronRight size={20} color="#cbd5e1" />
    </Pressable>
  );
}

function SheetModal({
  open,
  onClose,
  title,
  icon: Icon,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 items-center justify-center bg-slate-950/45 px-4">
        <Pressable onPress={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6">
          <View className="flex-row items-center justify-between border-b border-slate-100 pb-4">
            <View className="flex-row items-center gap-2">
              {Icon ? <Icon size={16} color="#226622" /> : null}
              <Text className="text-base font-bold text-slate-900">{title}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={16} color="#94a3b8" />
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PrimaryButton({
  label,
  icon: Icon,
  onPress,
  disabled,
  busy,
}: {
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3"
      style={{ backgroundColor: disabled || busy ? '#e2e8f0' : '#226622' }}
    >
      {busy ? (
        <ActivityIndicator size="small" color="#94a3b8" />
      ) : (
        <>
          {Icon ? <Icon size={16} color={disabled ? '#94a3b8' : '#ffffff'} /> : null}
          <Text className={`text-xs font-bold ${disabled ? 'text-slate-400' : 'text-white'}`}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-1 rounded-xl border border-slate-200 py-3">
      <Text className="text-center text-xs font-semibold text-slate-600">{label}</Text>
    </Pressable>
  );
}

function SettingsContent({ user }: { user: User }) {
  const router = useRouter();
  const email0 = user.email ?? '';

  const [loading, setLoading] = useState(true);
  const [baseName, setBaseName] = useState('');
  const [baseUsername, setBaseUsername] = useState('');
  const [baseNotifications, setBaseNotifications] = useState(true);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(email0);
  const [notifications, setNotifications] = useState(true);

  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [status, setStatus] = useState<MsgKind>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwStatus, setPwStatus] = useState<MsgKind>('idle');
  const [pwMessage, setPwMessage] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchAccountSettings(user.id).then((s) => {
      if (!active) return;
      setBaseName(s.fullName);
      setBaseUsername(s.username);
      setBaseNotifications(s.notificationsFriendRequests);
      setFullName(s.fullName);
      setUsername(s.username);
      setNotifications(s.notificationsFriendRequests);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [user.id]);

  const resetProfileForm = () => {
    setFullName(baseName);
    setUsername(baseUsername);
    setEmail(email0);
    setStatus('idle');
    setMessage(null);
  };

  const handleSaveProfile = async () => {
    const name = fullName.trim();
    const uname = username.trim();
    const mail = email.trim();
    if (name.length > 50) return showErr('Der Name darf maximal 50 Zeichen lang sein.');
    if (uname && uname.length > 30) return showErr('Der Benutzername darf maximal 30 Zeichen lang sein.');
    if (uname && !USERNAME_RE.test(uname))
      return showErr('Der Benutzername darf nur Buchstaben, Zahlen, Unterstriche und Punkte enthalten.');
    if (mail.length > 100) return showErr('Die E-Mail-Adresse darf maximal 100 Zeichen lang sein.');

    setStatus('saving');
    setMessage(null);
    const res = await saveProfileSettings({
      userId: user.id,
      fullName,
      username,
      email,
      currentEmail: email0,
      notificationsFriendRequests: notifications,
      baseNotifications,
      baseFullName: baseName,
      baseUsername,
    });
    if (!res.ok) return showErr(res.error ?? 'Speichern fehlgeschlagen.');
    setBaseName(name);
    setBaseUsername(uname);
    setStatus('success');
    setMessage(res.emailChanged ? 'Bitte bestätige die neue E-Mail-Adresse in deinem Postfach.' : 'Gespeichert.');
    if (!res.emailChanged) setTimeout(() => setProfileOpen(false), 1200);
  };

  const showErr = (m: string) => {
    setStatus('error');
    setMessage(m);
  };

  const handleSavePassword = async () => {
    const oldP = oldPassword.trim();
    const p = newPassword.trim();
    const c = confirmPassword.trim();
    if (!oldP || !p || !c) return pwErr('Bitte fülle alle Passwort-Felder aus.');
    if (oldP.length > 100 || p.length > 100 || c.length > 100)
      return pwErr('Die Passwörter dürfen maximal 100 Zeichen lang sein.');
    if (p.length < 6) return pwErr('Das neue Passwort muss mindestens 6 Zeichen lang sein.');
    if (p !== c) return pwErr('Die neuen Passwörter stimmen nicht überein.');

    setPwStatus('saving');
    setPwMessage(null);
    const res = await changePassword({ email: email0, oldPassword: oldP, newPassword: p });
    if (!res.ok) return pwErr(res.error ?? 'Fehlgeschlagen.');
    setPwStatus('success');
    setPwMessage('Dein Passwort wurde erfolgreich aktualisiert.');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordOpen(false), 1200);
  };

  const pwErr = (m: string) => {
    setPwStatus('error');
    setPwMessage(m);
  };

  const handleSaveNotifications = async () => {
    setStatus('saving');
    setMessage(null);
    const res = await saveProfileSettings({
      userId: user.id,
      fullName: baseName,
      username: baseUsername,
      email: email0,
      currentEmail: email0,
      notificationsFriendRequests: notifications,
      baseNotifications,
      baseFullName: baseName,
      baseUsername,
    });
    if (!res.ok) return showErr(res.error ?? 'Speichern fehlgeschlagen.');
    setBaseNotifications(notifications);
    setStatus('success');
    setMessage('Gespeichert.');
    setTimeout(() => setNotifOpen(false), 1200);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    const res = await exportUserData({ id: user.id, email: user.email ?? null, createdAt: user.created_at ?? null });
    if (!res.ok && res.error) setExportError(res.error);
    setExporting(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    const res = await deleteOwnAccount();
    if (!res.ok) {
      setDeleteError(res.error ?? 'Konto konnte nicht gelöscht werden.');
      setDeleting(false);
      return;
    }
    await supabase.auth.signOut();
  };

  const startTour = async () => {
    await startOnboarding();
    router.replace('/');
  };

  const confirmSignOut = () => {
    Alert.alert('Abmelden?', 'Möchtest du dich wirklich abmelden?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Abmelden', style: 'destructive', onPress: () => void supabase.auth.signOut() },
    ]);
  };

  const Header = (
    <View className="h-14 flex-row items-center justify-between border-b border-slate-100 bg-white px-4">
      <Pressable onPress={() => router.back()} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-lg">
        <ArrowLeft size={20} color="#64748b" />
      </Pressable>
      <Text className="text-sm font-bold text-slate-900">Einstellungen</Text>
      <View className="w-8" />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
        {Header}
        <SettingsSkeleton />
      </SafeAreaView>
    );
  }

  const profileChanged =
    fullName.trim() !== baseName.trim() ||
    username.trim() !== baseUsername.trim() ||
    email.trim() !== email0.trim();
  const notifChanged = notifications !== baseNotifications;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      {Header}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 24 }}>
        {/* Account & Sicherheit */}
        <View className="gap-1.5">
          <Text className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Account & Sicherheit
          </Text>
          <View className="overflow-hidden rounded-3xl border border-slate-100 bg-white">
            <MenuRow
              icon={UserIcon}
              iconBg="#eaf3ea"
              iconColor="#226622"
              title="Profil & Account"
              subtitle="Name, Benutzername und E-Mail ändern"
              onPress={() => {
                resetProfileForm();
                setProfileOpen(true);
              }}
            />
            <View className="h-px bg-slate-50" />
            <MenuRow
              icon={Lock}
              iconBg="#eaf3ea"
              iconColor="#226622"
              title="Passwort ändern"
              subtitle="Sicherheitseinstellungen deines Kontos"
              onPress={() => {
                setPwStatus('idle');
                setPwMessage(null);
                setPasswordOpen(true);
              }}
            />
          </View>
        </View>

        {/* Präferenzen & Anleitung */}
        <View className="gap-1.5">
          <Text className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Präferenzen & Anleitung
          </Text>
          <View className="overflow-hidden rounded-3xl border border-slate-100 bg-white">
            <MenuRow
              icon={Bell}
              iconBg="#f1f5f9"
              iconColor="#334155"
              title="Benachrichtigungen"
              subtitle="Push-Mitteilungen anpassen"
              onPress={() => {
                setStatus('idle');
                setMessage(null);
                setNotifOpen(true);
              }}
            />
            <View className="h-px bg-slate-50" />
            <MenuRow
              icon={Sparkles}
              iconBg="#f1f5f9"
              iconColor="#334155"
              title="Tour starten"
              subtitle="Interaktive Anleitung durchlaufen"
              onPress={startTour}
            />
          </View>
        </View>

        {/* Daten & Privatsphäre */}
        <View className="gap-1.5">
          <Text className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Daten & Privatsphäre
          </Text>
          <View className="overflow-hidden rounded-3xl border border-slate-100 bg-white">
            <MenuRow
              icon={Shield}
              iconBg="#f1f5f9"
              iconColor="#334155"
              title="Daten & Privatsphäre"
              subtitle="Daten exportieren oder Account löschen"
              onPress={() => {
                setExportError(null);
                setDeleteError(null);
                setDataOpen(true);
              }}
            />
          </View>
        </View>

        {/* Abmelden */}
        <Pressable
          onPress={confirmSignOut}
          className="flex-row items-center justify-center gap-2 rounded-3xl border border-slate-100 bg-white py-3.5 active:bg-slate-50"
        >
          <LogOut size={17} color="#e11d48" />
          <Text className="text-sm font-bold text-rose-600">Abmelden</Text>
        </Pressable>

        <LegalFooter />
      </ScrollView>

      {/* Profile modal */}
      <SheetModal open={profileOpen} onClose={() => setProfileOpen(false)} title="Profil & Account">
        <View className="mt-4 gap-4">
          <Field label="Voller Name" icon={UserIcon} value={fullName} onChangeText={setFullName} placeholder="Dein Name" autoCapitalize="words" maxLength={50} />
          <Field label="Benutzername" icon={AtSign} value={username} onChangeText={setUsername} placeholder="deinname" maxLength={30} />
          <Field label="E-Mail" icon={Mail} value={email} onChangeText={setEmail} placeholder="name@domain.de" keyboardType="email-address" maxLength={100} />
          <Banner kind={status} message={message} />
          <View className="flex-row gap-3 border-t border-slate-100 pt-4">
            <GhostButton label="Abbrechen" onPress={() => setProfileOpen(false)} />
            <PrimaryButton label="Speichern" icon={UserIcon} onPress={handleSaveProfile} disabled={!profileChanged} busy={status === 'saving'} />
          </View>
        </View>
      </SheetModal>

      {/* Password modal */}
      <SheetModal open={passwordOpen} onClose={() => setPasswordOpen(false)} title="Passwort ändern" icon={Lock}>
        <View className="mt-4 gap-4">
          <Field label="Altes Passwort" icon={Lock} value={oldPassword} onChangeText={setOldPassword} placeholder="Dein aktuelles Passwort" secureTextEntry maxLength={100} />
          <Field label="Neues Passwort" icon={Lock} value={newPassword} onChangeText={setNewPassword} placeholder="Mindestens 6 Zeichen" secureTextEntry maxLength={100} />
          <Field label="Neues Passwort bestätigen" icon={Lock} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Passwort wiederholen" secureTextEntry maxLength={100} />
          <Banner kind={pwStatus} message={pwMessage} />
          <View className="flex-row gap-3 border-t border-slate-100 pt-4">
            <GhostButton label="Abbrechen" onPress={() => setPasswordOpen(false)} />
            <PrimaryButton label="Speichern" icon={Lock} onPress={handleSavePassword} disabled={!oldPassword || !newPassword || !confirmPassword} busy={pwStatus === 'saving'} />
          </View>
        </View>
      </SheetModal>

      {/* Notifications modal */}
      <SheetModal open={notifOpen} onClose={() => setNotifOpen(false)} title="Benachrichtigungen" icon={Bell}>
        <View className="mt-4 gap-4">
          <Pressable
            onPress={() => setNotifications((v) => !v)}
            className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
          >
            <View className="flex-1 flex-row items-center gap-3">
              <Bell size={20} color="#94a3b8" />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-slate-800">Freundschaftsanfragen</Text>
                <Text className="text-xs text-slate-500">Push-Benachrichtigung bei neuen Anfragen</Text>
              </View>
            </View>
            <View
              className="h-6 w-11 justify-center rounded-full px-1"
              style={{ backgroundColor: notifications ? '#226622' : '#e2e8f0' }}
            >
              <View
                className="h-4 w-4 rounded-full bg-white"
                style={{ transform: [{ translateX: notifications ? 20 : 0 }] }}
              />
            </View>
          </Pressable>
          <Text className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
            Push-Versand ist vorbereitet, wird aber erst aktiv, sobald wir die Systemberechtigung anfragen.
          </Text>
          <Banner kind={status} message={message} />
          <View className="flex-row gap-3 border-t border-slate-100 pt-4">
            <GhostButton label="Abbrechen" onPress={() => {
              setNotifications(baseNotifications);
              setNotifOpen(false);
            }} />
            <PrimaryButton label="Speichern" icon={Bell} onPress={handleSaveNotifications} disabled={!notifChanged} busy={status === 'saving'} />
          </View>
        </View>
      </SheetModal>

      {/* Data & privacy modal */}
      <SheetModal open={dataOpen} onClose={() => setDataOpen(false)} title="Daten & Datenschutz" icon={Shield}>
        <View className="mt-4 gap-5">
          <View className="gap-2">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-400">Daten herunterladen</Text>
            <Text className="text-xs leading-relaxed text-slate-500">
              Lade eine Kopie aller bei uns gespeicherten Daten als JSON-Datei herunter (Profil,
              Empfehlungen, Kommentare, Freundschaften, Merkliste und Einladungslinks).
            </Text>
            {exportError ? (
              <View className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
                <Text className="text-xs font-semibold text-rose-700">{exportError}</Text>
              </View>
            ) : null}
            <Pressable
              onPress={handleExport}
              disabled={exporting}
              className="flex-row items-center justify-center gap-2 rounded-xl border border-brand-green-200 bg-brand-green-50/50 px-4 py-2.5"
            >
              {exporting ? <ActivityIndicator size="small" color="#226622" /> : <Download size={16} color="#15803d" />}
              <Text className="text-xs font-semibold text-brand-green-800">Daten exportieren</Text>
            </Pressable>
          </View>

          <View className="gap-2 border-t border-slate-100 pt-4">
            <Text className="text-xs font-bold uppercase tracking-wider text-rose-500">Gefahrenzone</Text>
            <Text className="text-xs leading-relaxed text-slate-500">
              Wenn du deinen Account löschst, werden alle deine Daten unwiderruflich gelöscht. Dies kann nicht
              rückgängig gemacht werden.
            </Text>
            <Pressable
              onPress={() => {
                setDataOpen(false);
                setDeleteOpen(true);
              }}
              className="flex-row items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5"
            >
              <Trash2 size={16} color="#e11d48" />
              <Text className="text-xs font-semibold text-rose-600">Konto löschen</Text>
            </Pressable>
          </View>

          <View className="border-t border-slate-100 pt-4">
            <GhostButton label="Schließen" onPress={() => setDataOpen(false)} />
          </View>
        </View>
      </SheetModal>

      {/* Delete confirm modal */}
      <SheetModal open={deleteOpen} onClose={() => (deleting ? null : setDeleteOpen(false))} title="Konto wirklich löschen?" icon={Trash2}>
        <View className="mt-4 gap-4">
          <Text className="text-xs leading-relaxed text-slate-600">
            Bist du sicher, dass du deinen Account unwiderruflich löschen möchtest? Alle deine Empfehlungen,
            Freundschaften und Einstellungen werden dauerhaft entfernt. Dieser Schritt kann nicht rückgängig
            gemacht werden.
          </Text>
          {deleteError ? (
            <View className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
              <Text className="text-xs font-semibold text-rose-700">{deleteError}</Text>
            </View>
          ) : null}
          <View className="flex-row gap-3">
            <GhostButton label="Abbrechen" onPress={() => setDeleteOpen(false)} />
            <Pressable
              onPress={handleDelete}
              disabled={deleting}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3"
              style={{ backgroundColor: '#e11d48', opacity: deleting ? 0.6 : 1 }}
            >
              {deleting ? <ActivityIndicator size="small" color="#ffffff" /> : <Trash2 size={16} color="#ffffff" />}
              <Text className="text-xs font-bold text-white">Löschen</Text>
            </Pressable>
          </View>
        </View>
      </SheetModal>
    </SafeAreaView>
  );
}

export default function SettingsScreen() {
  return (
    <AuthGate context="profile" headerTitle="Einstellungen">
      {(user) => <SettingsContent user={user} />}
    </AuthGate>
  );
}
