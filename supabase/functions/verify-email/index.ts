import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Public (verify_jwt = false): the user opens this URL from the verification
// email in a browser, so there is no JWT. Validates the token, flips
// `profiles.email_verified`, deletes the token, then REDIRECTS to the result
// page on the web app (the mobile app picks the flag up on its next refresh).
//
// Why a redirect instead of rendering the page here: Supabase Edge Functions
// cannot serve HTML — the platform rewrites `text/html` responses to
// `text/plain` (see https://supabase.com/docs/guides/functions/http-methods),
// so a rendered page would show up as raw source with broken umlauts. Only the
// token check needs the service role; the presentation belongs on the website.

type Status = 'success' | 'invalid' | 'expired' | 'error';

// Must point at a PUBLIC page (not behind the web app's auth middleware).
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://places4friends.com').replace(/\/+$/, '');

function redirect(status: Status): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `${SITE_URL}/verify-email?status=${status}` },
  });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) return redirect('invalid');

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: verification, error: lookupError } = await admin
    .from('email_verifications')
    .select('user_id, expires_at')
    .eq('token', token)
    .single();

  if (lookupError || !verification) return redirect('invalid');

  if (new Date(verification.expires_at) < new Date()) {
    await admin.from('email_verifications').delete().eq('token', token);
    return redirect('expired');
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update({ email_verified: true })
    .eq('id', verification.user_id);

  if (updateError) {
    console.error('Error updating profile verification status:', updateError);
    return redirect('error');
  }

  await admin.from('email_verifications').delete().eq('token', token);

  return redirect('success');
});
