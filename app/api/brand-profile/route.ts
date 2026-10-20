import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { BrandProfileSchema } from '@/lib/engine/profile';
import { loadBrandRow, resolveProfile } from '@/lib/engine/load';
import { listStarterPacks, starterPackBySlug } from '@/lib/engine/packs';
import { aiConfigured } from '@/lib/engine/ai';

export const runtime = 'nodejs';

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

async function getAuthenticatedClient(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } },
  ) as any;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return supabase;
}

async function profileColumnReady(supabase: any) {
  const { error } = await supabase.from('contentos_brands').select('profile').limit(1);
  return !error;
}

function aiStatus() {
  if (process.env.GEMINI_API_KEY) return { configured: true, provider: 'gemini', model: process.env.GEMINI_MODEL || 'auto' };
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL) return { configured: true, provider: 'openai', model: process.env.OPENAI_MODEL };
  return { configured: aiConfigured(), provider: null, model: null };
}

export async function GET(req: Request) {
  const supabase = await getAuthenticatedClient(req);
  if (!supabase) return Response.json({ error: 'Please sign in first.' }, { status: 401 });
  const brandId = new URL(req.url).searchParams.get('brandId') || '';
  if (!z.string().uuid().safeParse(brandId).success) return Response.json({ error: 'brandId is required.' }, { status: 400 });

  const brand = await loadBrandRow(supabase, brandId);
  if (!brand) return Response.json({ error: 'Brand not found.' }, { status: 404 });
  const { profile, source } = resolveProfile(brand);
  return Response.json({
    profile,
    source,
    columnReady: await profileColumnReady(supabase),
    starterPacks: listStarterPacks(),
    ai: aiStatus(),
  });
}

const PutSchema = z.object({
  brandId: z.string().uuid(),
  profile: z.unknown().optional(),
  starterPack: z.string().optional(),
}).refine((v) => v.profile !== undefined || v.starterPack, { message: 'Send a profile or a starterPack slug.' });

export async function PUT(req: Request) {
  const supabase = await getAuthenticatedClient(req);
  if (!supabase) return Response.json({ error: 'Please sign in first.' }, { status: 401 });
  const parsed = PutSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || 'Invalid request.' }, { status: 400 });

  const candidate = parsed.data.starterPack ? starterPackBySlug(parsed.data.starterPack) : parsed.data.profile;
  if (!candidate) return Response.json({ error: 'Unknown starter pack.' }, { status: 404 });
  const profile = BrandProfileSchema.safeParse(candidate);
  if (!profile.success) {
    const issue = profile.error.issues[0];
    return Response.json({ error: `Profile is invalid at "${issue?.path.join('.') || 'root'}": ${issue?.message}` }, { status: 400 });
  }

  if (!(await profileColumnReady(supabase))) {
    return Response.json({ error: 'Run supabase/migrations/011_brand_profile.sql in the Supabase SQL editor first. Until then ContentOS uses the bundled starter pack.' }, { status: 409 });
  }

  const { error } = await supabase
    .from('contentos_brands')
    .update({ profile: profile.data, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.brandId);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true, profile: profile.data, source: 'stored' });
}
