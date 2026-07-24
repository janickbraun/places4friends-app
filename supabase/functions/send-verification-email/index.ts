import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, json } from '../_shared/cors.ts';

// Ports the web `/api/verify-email/send` route. Requires an authenticated caller
// (verify_jwt = true). Generates a one-time token, throttles to 1/minute, stores
// it in `email_verifications`, and emails a confirmation link via Resend. The
// link targets THIS project's `verify-email` function so verification works
// without depending on the web app.

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Verification mail markup.
 *
 * **Every style is inline and the layout is tables.** A `<style>` block in the
 * `<head>` is not reliable in mail: Gmail drops the whole block if it hits a
 * single declaration it dislikes (modern `rgb(0 0 0 / .05)` colour syntax did
 * exactly that here), which left the mail rendering as unstyled text. Inline
 * attributes are the one thing every client honours — keep it that way, and
 * don't reintroduce a stylesheet, shorthand colour functions, flexbox or grid.
 *
 * Kept in sync with the web app's `src/lib/email.ts`, which sends the same mail
 * for web sign-ups.
 */
function buildEmailHtml(verificationUrl: string, recipientName: string): string {
  const name = escapeHtml(recipientName || 'Freund/in');
  const font =
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const para = `margin:0 0 20px;${font};font-size:15px;line-height:1.6;color:#475569`;
  const footerP = `margin:0 0 10px;${font};font-size:12px;line-height:1.5;color:#94a3b8`;
  const footerA = 'color:#64748b;text-decoration:underline';

  return `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light only">
    <title>E-Mail-Adresse verifizieren</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f8fafc;${font};-webkit-font-smoothing:antialiased;">
    <!-- Preheader: the grey preview line next to the subject in the inbox. -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Nur noch ein Klick, dann ist deine E-Mail-Adresse bestätigt.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;">
            <tr>
              <td align="center" bgcolor="#226622" style="background-color:#226622;padding:32px;border-radius:16px 16px 0 0;">
                <span style="${font};font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">places4friends</span>
              </td>
            </tr>
            <tr>
              <td style="padding:40px 32px;">
                <h1 style="margin:0 0 16px;${font};font-size:20px;font-weight:700;color:#0f172a;">Hallo ${name},</h1>
                <p style="${para}">vielen Dank für deine Registrierung bei places4friends! Um dein Konto vollständig zu verifizieren, bestätige bitte deine E-Mail-Adresse über den folgenden Button.</p>
                <p style="${para}">Du kannst die App in der Zwischenzeit bereits ganz normal nutzen.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:32px auto;">
                  <tr>
                    <td align="center" bgcolor="#226622" style="background-color:#226622;border-radius:12px;">
                      <a href="${verificationUrl}" style="display:inline-block;padding:14px 32px;${font};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">E-Mail-Adresse bestätigen</a>
                    </td>
                  </tr>
                </table>
                <p style="${para}">Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:</p>
                <p style="margin:0;${font};font-size:13px;line-height:1.5;color:#64748b;word-break:break-all;">${verificationUrl}</p>
              </td>
            </tr>
            <tr>
              <td bgcolor="#f8fafc" align="center" style="background-color:#f8fafc;padding:24px 32px;border-top:1px solid #e2e8f0;border-radius:0 0 16px 16px;">
                <p style="${footerP}">Diese E-Mail wurde automatisch versendet, weil mit dieser Adresse ein places4friends-Konto registriert wurde. Falls du dich nicht registriert hast, kannst du diese Nachricht ignorieren &ndash; es werden dir keine weiteren E-Mails gesendet.</p>
                <p style="${footerP}">Anbieter: Janick Braun &middot; Krottenkopfstr. 24a &middot; 82377 Penzberg &middot; Deutschland<br>Kontakt: <a href="mailto:mail@janickbraun.com" style="${footerA}">mail@janickbraun.com</a></p>
                <p style="margin:0;${font};font-size:12px;line-height:1.5;color:#94a3b8;"><a href="https://places4friends.com/impressum" style="${footerA}">Impressum</a> &middot; <a href="https://places4friends.com/datenschutz" style="${footerA}">Datenschutz</a> &middot; <a href="https://places4friends.com/agb" style="${footerA}">AGB</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Plain-text alternative. Sent alongside the HTML: clients that prefer text get
 * something readable instead of a stripped-tag soup, and a multipart mail scores
 * better with spam filters than HTML alone.
 */
function buildEmailText(verificationUrl: string, recipientName: string): string {
  const name = recipientName || 'Freund/in';
  return `Hallo ${name},

vielen Dank für deine Registrierung bei places4friends!

Bestätige deine E-Mail-Adresse über diesen Link:
${verificationUrl}

Du kannst die App in der Zwischenzeit bereits ganz normal nutzen.

---
Diese E-Mail wurde automatisch versendet, weil mit dieser Adresse ein
places4friends-Konto registriert wurde. Falls du dich nicht registriert hast,
kannst du diese Nachricht ignorieren - es werden dir keine weiteren E-Mails
gesendet.

Anbieter: Janick Braun, Krottenkopfstr. 24a, 82377 Penzberg, Deutschland
Kontakt: mail@janickbraun.com

Impressum: https://places4friends.com/impressum
Datenschutz: https://places4friends.com/datenschutz
AGB: https://places4friends.com/agb`;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendKey = Deno.env.get('RESEND_API_KEY');

  // Identify the caller from their JWT.
  const authHeader = req.headers.get('Authorization') ?? '';
  const authedClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await authedClient.auth.getUser();

  if (!user) return json({ error: 'Nicht angemeldet.' }, 401);

  const email = user.email;
  if (!email) return json({ error: 'Keine E-Mail-Adresse mit dem Konto verknüpft.' }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email_verified')
    .eq('id', user.id)
    .single();

  if (!profile) return json({ error: 'Profil nicht gefunden.' }, 404);
  if (profile.email_verified) return json({ success: true, message: 'Bereits verifiziert.' });

  // Throttle: 1 token per minute.
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
  const { data: recentTokens } = await admin
    .from('email_verifications')
    .select('created_at')
    .eq('user_id', user.id)
    .gt('created_at', oneMinuteAgo);

  if (recentTokens && recentTokens.length > 0) {
    return json({ success: true, message: 'Bereits gesendet.' });
  }

  if (!resendKey) {
    return json({ error: 'E-Mail-Dienst ist nicht konfiguriert.' }, 500);
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await admin.from('email_verifications').delete().eq('user_id', user.id);
  const { error: insertError } = await admin
    .from('email_verifications')
    .insert({ user_id: user.id, token, expires_at: expiresAt });

  if (insertError) {
    console.error('Error inserting verification token:', insertError);
    return json({ error: 'Token konnte nicht erstellt werden.' }, 500);
  }

  const verificationUrl = `${supabaseUrl}/functions/v1/verify-email?token=${encodeURIComponent(token)}`;
  // Defaults to our verified Resend domain. (Resend's shared `onboarding@resend.dev`
  // sandbox sender only delivers to the Resend account owner's own address, so it
  // 403s for real users.) Override via the RESEND_FROM secret if the sender changes.
  const fromEmail = Deno.env.get('RESEND_FROM') ?? 'places4friends <noreply@places4friends.com>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      reply_to: 'mail@janickbraun.com',
      to: [email],
      subject: 'Bestätige deine E-Mail-Adresse - places4friends',
      html: buildEmailHtml(verificationUrl, profile.full_name || ''),
      text: buildEmailText(verificationUrl, profile.full_name || ''),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Resend API error:', errorData);
    return json({ error: errorData.message || 'Fehler beim Senden der Bestätigungs-E-Mail.' }, 502);
  }

  return json({ success: true });
});
