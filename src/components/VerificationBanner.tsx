import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AlertCircle, CheckCircle, Mail } from 'lucide-react-native';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

/**
 * Amber strip shown when the signed-in user's email is not yet verified.
 * Mirrors the web VerificationBanner. "Erneut senden" invokes the
 * send-verification-email Edge Function (deployed in the edge-functions
 * milestone); failures surface as a retry state.
 */
export default function VerificationBanner() {
  const { user, loading, emailVerified } = useAuth();
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  if (loading || !user || emailVerified) return null;

  const startCountdown = (seconds: number) => {
    setCountdown(seconds);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timer.current) clearInterval(timer.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (sending || countdown > 0) return;
    setSending(true);
    setError(false);
    setSuccess(false);
    const { error: fnError } = await supabase.functions.invoke('send-verification-email', {
      body: {},
    });
    if (fnError) {
      setError(true);
    } else {
      setSuccess(true);
      startCountdown(60);
    }
    setSending(false);
  };

  return (
    <View className="w-full flex-row items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
      <View className="flex-1 flex-row items-center gap-2">
        <AlertCircle size={16} color="#d97706" />
        <Text className="flex-1 text-[11px] font-medium leading-relaxed text-amber-800">
          Deine E-Mail-Adresse ist noch nicht bestätigt. Bitte verifiziere sie, um dein Konto zu
          sichern.
        </Text>
      </View>

      {success ? (
        <View className="flex-row items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1">
          <CheckCircle size={14} color="#047857" />
          <Text className="text-[11px] font-semibold text-emerald-700">Gesendet</Text>
        </View>
      ) : (
        <Pressable
          onPress={handleResend}
          disabled={sending || countdown > 0}
          className="flex-row items-center gap-1.5 rounded-lg px-3 py-1.5"
          style={{ backgroundColor: sending || countdown > 0 ? 'rgba(180,83,9,0.4)' : '#b45309' }}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Mail size={12} color="#ffffff" />
          )}
          <Text className="text-[11px] font-bold text-white">
            {countdown > 0
              ? `Warte ${countdown}s`
              : error
                ? 'Erneut versuchen'
                : 'Erneut senden'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
