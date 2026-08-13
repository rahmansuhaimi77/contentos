import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

async function authenticated(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.auth.getUser(token);
  return !error && Boolean(data.user);
}

export async function GET(req: Request) {
  if (!(await authenticated(req))) return Response.json({ error: 'Please sign in first.' }, { status: 401 });

  const openai = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
  const claude = Boolean(process.env.ANTHROPIC_API_KEY);
  const google = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

  return Response.json({
    providers: {
      openai: { configured: openai, capabilities: ['copy', 'static_image'] },
      claude: { configured: claude, capabilities: ['copy', 'creative_review', 'visual_planning'] },
      google: { configured: google, capabilities: ['video'] },
    },
  });
}
