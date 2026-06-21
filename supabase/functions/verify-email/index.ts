import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Ports the web `/auth/verify-email` route. Public (verify_jwt = false): the user
// opens this URL from the verification email in a browser, so there is no JWT.
// Validates the token, flips `profiles.email_verified`, deletes the token, and
// renders a branded HTML result page (the mobile app picks up the flag on its
// next refresh). No web-app dependency.

function page(title: string, message: string, ok: boolean): Response {
  const accent = ok ? '#15803d' : '#b91c1c';
  const icon = ok
    ? '<path d="M20 6 9 17l-5-5" />'
    : '<path d="M18 6 6 18" /><path d="m6 6 12 12" />';
  const html = `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} - places4friends</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background-color:#f8fafc;color:#0f172a;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;}
      .card{max-width:420px;margin:24px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:40px 32px;text-align:center;box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.05);}
      .badge{width:64px;height:64px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;background:${ok ? '#dcfce7' : '#fee2e2'};margin-bottom:24px;}
      h1{font-size:20px;font-weight:700;margin:0 0 12px;}
      p{font-size:15px;color:#475569;line-height:1.6;margin:0;}
      .brand{margin-top:28px;font-size:13px;color:#94a3b8;font-weight:600;}
    </style>
  </head>
  <body>
    <div class="card">
      <div class="badge">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
      </div>
      <h1>${title}</h1>
      <p>${message}</p>
      <div class="brand">places4friends</div>
    </div>
  </body>
</html>`;
  return new Response(html, {
    status: ok ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return page('Verifizierung fehlgeschlagen', 'Der Verifizierungstoken fehlt.', false);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: verification, error: lookupError } = await admin
    .from('email_verifications')
    .select('user_id, expires_at')
    .eq('token', token)
    .single();

  if (lookupError || !verification) {
    return page(
      'Link ungültig',
      'Dieser Verifizierungslink ist ungültig oder wurde bereits verwendet.',
      false,
    );
  }

  if (new Date(verification.expires_at) < new Date()) {
    await admin.from('email_verifications').delete().eq('token', token);
    return page(
      'Link abgelaufen',
      'Dieser Verifizierungslink ist abgelaufen. Bitte fordere in der App einen neuen an.',
      false,
    );
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update({ email_verified: true })
    .eq('id', verification.user_id);

  if (updateError) {
    console.error('Error updating profile verification status:', updateError);
    return page(
      'Fehler',
      'Der Verifizierungsstatus konnte nicht aktualisiert werden. Bitte versuche es erneut.',
      false,
    );
  }

  await admin.from('email_verifications').delete().eq('token', token);

  return page(
    'E-Mail bestätigt',
    'Deine E-Mail-Adresse wurde erfolgreich verifiziert. Du kannst jetzt zur App zurückkehren.',
    true,
  );
});
