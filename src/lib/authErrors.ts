// Ported verbatim from the web app (src/lib/authErrors.ts) so error copy matches.
interface AuthErrorLike {
  message?: string;
  code?: string;
}

export function getLoginErrorMessage(error: AuthErrorLike): string {
  const message = error.message ?? '';
  const code = error.code ?? '';

  if (
    code === 'invalid_credentials' ||
    message.toLowerCase().includes('invalid login credentials')
  ) {
    return 'E-Mail oder Passwort ist falsch. Bitte prüfe deine Eingabe.';
  }

  if (
    code === 'email_not_confirmed' ||
    message.toLowerCase().includes('email not confirmed')
  ) {
    return 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link in deinem Postfach.';
  }

  if (message.toLowerCase().includes('rate limit')) {
    return 'Zu viele Anmeldeversuche. Bitte warte einen Moment und versuche es erneut.';
  }

  if (
    message.toLowerCase().includes('fetch') ||
    message.toLowerCase().includes('network')
  ) {
    return 'Verbindung zum Server fehlgeschlagen. Bitte prüfe deine Internetverbindung.';
  }

  return 'Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.';
}

export function getSignupErrorMessage(error: AuthErrorLike): string {
  const message = error.message ?? '';
  const code = error.code ?? '';

  if (
    code === 'user_already_exists' ||
    message.toLowerCase().includes('already registered') ||
    message.toLowerCase().includes('already been registered')
  ) {
    return 'Diese E-Mail ist bereits registriert. Bitte melde dich an.';
  }

  if (code === 'weak_password') {
    return 'Das Passwort erfüllt nicht die Anforderungen. Bitte wähle ein stärkeres Passwort.';
  }

  if (message.toLowerCase().includes('invalid email')) {
    return 'Bitte gib eine gültige E-Mail-Adresse ein.';
  }

  if (message.toLowerCase().includes('rate limit')) {
    return 'Zu viele Versuche. Bitte warte einen Moment und versuche es erneut.';
  }

  if (
    message.toLowerCase().includes('fetch') ||
    message.toLowerCase().includes('network')
  ) {
    return 'Verbindung zum Server fehlgeschlagen. Bitte prüfe deine Internetverbindung.';
  }

  return message || 'Registrierung fehlgeschlagen. Bitte versuche es erneut.';
}
