import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Self-contained CORS helpers (the mobile client invokes this via
// supabase.functions.invoke; permissive CORS keeps it curl-/browser-testable).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
function handleOptions(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null;
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Generates a static map snapshot for a place and stores it in the public
// `activity-images` bucket, returning its public URL. Runs server-side so the
// Geoapify key stays a function SECRET (never shipped in the app bundle).
//
// We use Geoapify (OpenStreetMap / ODbL data) on purpose: unlike Mapbox/Google,
// its terms permit storing & redistributing the rendered image, so caching it in
// our own storage is legal. Attribution "© OpenStreetMap contributors" is shown
// in the app next to the image.
//
// Called once at recommendation-creation time, so the Maps API is hit ~once per
// post (not per render) — well within the free tier.

// "klokantech-basic" = the OpenMapTiles "basic" style (same lineage as MapTiler
// Basic): a clean light basemap with soft beige land, green parks and blue water.
const STYLE = 'klokantech-basic';
const BRAND_GREEN = '%23226622'; // url-encoded #226622

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const geoapifyKey = Deno.env.get('GEOAPIFY_API_KEY');

  if (!geoapifyKey) {
    return json({ error: 'Kartendienst ist nicht konfiguriert.' }, 500);
  }

  // Identify the caller from their JWT; the snapshot is stored under their id.
  const authHeader = req.headers.get('Authorization') ?? '';
  const authedClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await authedClient.auth.getUser();
  if (!user) return json({ error: 'Nicht angemeldet.' }, 401);

  let body: { latitude?: number; longitude?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Ungültige Anfrage.' }, 400);
  }
  const { latitude, longitude } = body;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return json({ error: 'Koordinaten fehlen.' }, 400);
  }

  // Build the Geoapify static map URL: a clean light map centred on the place
  // with a single brand-green pin.
  const marker = `lonlat:${longitude},${latitude};type:material;color:${BRAND_GREEN};size:48`;
  const geoapifyUrl =
    `https://maps.geoapify.com/v1/staticmap?style=${STYLE}` +
    `&width=800&height=600&format=png&zoom=15` +
    `&center=lonlat:${longitude},${latitude}` +
    `&marker=${marker}` +
    `&apiKey=${geoapifyKey}`;

  let imageBytes: ArrayBuffer;
  try {
    const res = await fetch(geoapifyUrl);
    if (!res.ok) {
      console.error('Geoapify error', res.status, await res.text());
      return json({ error: 'Kartenbild konnte nicht erstellt werden.' }, 502);
    }
    imageBytes = await res.arrayBuffer();
  } catch (e) {
    console.error('Geoapify fetch failed', e);
    return json({ error: 'Kartenbild konnte nicht erstellt werden.' }, 502);
  }

  // Store it (service role bypasses RLS; bucket is public).
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const path = `${user.id}/snapshot-${Date.now()}.png`;
  const { error: uploadError } = await admin.storage
    .from('activity-images')
    .upload(path, new Uint8Array(imageBytes), { contentType: 'image/png' });
  if (uploadError) {
    console.error('Snapshot upload failed', uploadError);
    return json({ error: 'Kartenbild konnte nicht gespeichert werden.' }, 500);
  }

  const { data } = admin.storage.from('activity-images').getPublicUrl(path);
  return json({ url: data.publicUrl });
});
