import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xqlfytlknhazusowiiug.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

export async function GET(req: Request) {
  const authorization = req.headers.get('authorization');
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!authorization || !token) return Response.json({ error: 'Please sign in first.' }, { status: 401 });

  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return Response.json({ error: 'Please sign in first.' }, { status: 401 });

  const url = new URL(req.url);
  const requestedBrand = url.searchParams.get('brandId');
  const { data: brands } = requestedBrand
    ? await supabase.from('contentos_brands').select('id').eq('id', requestedBrand).limit(1)
    : await supabase.from('contentos_brands').select('id').order('updated_at', { ascending: false });

  const aggregate = {
    openai: { configured: false, capabilities: ['copy', 'static_image'] },
    claude: { configured: false, capabilities: ['copy', 'creative_review', 'visual_planning'] },
    google: { configured: false, capabilities: ['video'] },
  };

  for (const brand of brands || []) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/contentos-ai/status?brand_id=${encodeURIComponent(brand.id)}`, {
      headers: { Authorization: authorization },
    });
    if (!response.ok) continue;
    const payload = await response.json();
    if (payload?.providers?.openai?.configured) aggregate.openai.configured = true;
    if (payload?.providers?.claude?.configured) aggregate.claude.configured = true;
    if (payload?.providers?.google?.configured) aggregate.google.configured = true;
    if (requestedBrand) break;
  }

  return Response.json({ providers: aggregate });
}
