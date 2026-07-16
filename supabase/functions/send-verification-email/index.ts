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

function buildEmailHtml(verificationUrl: string, recipientName: string): string {
  const name = escapeHtml(recipientName || 'Freund/in');
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>E-Mail-Adresse verifizieren</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background-color:#f8fafc;color:#1e293b;margin:0;padding:0;-webkit-font-smoothing:antialiased;}
      .container{max-width:600px;margin:40px auto;background-color:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.05),0 2px 4px -2px rgb(0 0 0 / 0.05);border:1px solid #e2e8f0;}
      .header{background-color:#0f172a;padding:32px;text-align:center;}
      .logo{color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.025em;}
      .content{padding:40px 32px;line-height:1.6;}
      h1{font-size:20px;font-weight:700;color:#0f172a;margin-top:0;margin-bottom:16px;}
      p{font-size:15px;color:#475569;margin-bottom:24px;}
      .btn-container{margin:32px 0;text-align:center;}
      .btn{display:inline-block;background-color:#15803d;color:#fff !important;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600;box-shadow:0 10px 15px -3px rgba(21,128,61,0.1),0 4px 6px -4px rgba(21,128,61,0.1);}
      .footer{background-color:#f8fafc;padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:13px;color:#94a3b8;}
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><div class="logo">places4friends</div></div>
      <div class="content">
        <h1>Hallo ${name},</h1>
        <p>vielen Dank für deine Registrierung bei places4friends! Um dein Konto vollständig zu verifizieren, bestätige bitte deine E-Mail-Adresse durch Klick auf den folgenden Button.</p>
        <p>Du kannst die App in der Zwischenzeit bereits ganz normal nutzen.</p>
        <div class="btn-container"><a href="${verificationUrl}" class="btn">E-Mail-Adresse bestätigen</a></div>
        <p>Falls der Button oben nicht funktioniert, kannst du auch den folgenden Link kopieren und in deinen Browser einfügen:</p>
        <p style="word-break:break-all;font-size:13px;color:#64748b;">${verificationUrl}</p>
      </div>
      <div class="footer">Diese E-Mail wurde automatisch gesendet. Falls du dich nicht bei places4friends registriert hast, kannst du diese Nachricht ignorieren.</div>
    </div>
  </body>
</html>`;
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
      to: [email],
      subject: 'Bestätige deine E-Mail-Adresse - places4friends',
      html: buildEmailHtml(verificationUrl, profile.full_name || ''),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Resend API error:', errorData);
    return json({ error: errorData.message || 'Fehler beim Senden der Bestätigungs-E-Mail.' }, 502);
  }

  return json({ success: true });
});
