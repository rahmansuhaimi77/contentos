import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { sanitizeGenerationResultForAudience } from '@/lib/audience-copy-safety';
import { findBrandIdByName, loadBrandEngine, resolveProfile, type BrandEngineContext } from '@/lib/engine/load';
import { generateCampaign } from '@/lib/engine/campaign';

export const runtime = 'nodejs';
export const maxDuration = 60;

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

const InputSchema = z.object({
  brand: z.object({
    name: z.string().min(1),
    product: z.string().min(1),
    audience: z.string().min(1),
    positioning: z.string(),
    voice: z.string(),
    offer: z.string(),
    proof: z.string(),
    cta: z.string(),
    avoid: z.string(),
  }),
  brief: z.object({
    objective: z.string().min(1),
    platform: z.string().min(1),
    format: z.string().min(1),
    language: z.string().min(1),
    count: z.number().int().min(1).max(10),
    extra: z.string(),
  }),
});

async function getAuthenticatedClient(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return supabase;
}

export async function POST(req: Request) {
  try {
    const supabase = await getAuthenticatedClient(req);
    if (!supabase) {
      return Response.json({ error: 'Please sign in before generating content.' }, { status: 401 });
    }

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const { brand, brief } = parsed.data;
    const brandId = await findBrandIdByName(supabase, brand.name);
    const loaded = brandId ? await loadBrandEngine(supabase, brandId) : null;
    // A brand that has not been saved yet still works from what the user typed in the form.
    const ctx: BrandEngineContext = loaded ?? (() => {
      const row = { id: '', name: brand.name, product: brand.product, audience: brand.audience, positioning: brand.positioning, voice: brand.voice, offer: brand.offer, proof: brand.proof, preferred_cta: brand.cta, avoid: brand.avoid };
      const { profile, source } = resolveProfile(row);
      return { brand: row, profile, profileSource: source, knowledge: [], growthProfile: null, growthCalendar: [], recentHooks: [] };
    })();

    const generated = await generateCampaign(ctx, brief);
    return Response.json(sanitizeGenerationResultForAudience(generated, brand, brief));
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Generation failed.' },
      { status: 500 },
    );
  }
}
