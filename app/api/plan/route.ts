import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { loadBrandEngine } from '@/lib/engine/load';
import { buildPlan } from '@/lib/engine/planner';
import { malaysiaToday } from '@/lib/engine/context';

export const runtime = 'nodejs';
export const maxDuration = 120;

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

const InputSchema = z.object({
  brandId: z.string().uuid(),
  objective: z.string().min(1),
  platforms: z.array(z.string().min(1)).min(1).max(5),
  language: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
  return { supabase: supabase as any, user: data.user };
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedClient(req);
    if (!auth) return Response.json({ error: 'Please sign in first.' }, { status: 401 });

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Invalid planner request.' }, { status: 400 });

    const { brandId, objective, platforms, language } = parsed.data;
    const startDate = parsed.data.startDate || malaysiaToday();
    const ctx = await loadBrandEngine(auth.supabase, brandId);
    if (!ctx) return Response.json({ error: 'Brand not found or unavailable.' }, { status: 404 });

    const result = await buildPlan(ctx, { objective, platforms, language, startDate });
    const datedItems = result.items;
    const brandRow = ctx.brand;

    const { data: plan, error: planError } = await auth.supabase
      .from('contentos_content_plans')
      .insert({
        brand_id: brandId,
        created_by: auth.user.id,
        name: `30-Day Content Plan · ${brandRow.name}`,
        objective,
        platforms,
        language,
        status: 'active',
        start_date: startDate,
      })
      .select('id,name,created_at,start_date')
      .single();

    if (planError) throw planError;

    const { error: itemsError } = await auth.supabase
      .from('contentos_plan_items')
      .insert(datedItems.map((item) => ({ ...item, plan_id: plan.id, status: 'planned' })));

    if (itemsError) throw itemsError;

    return Response.json({
      plan,
      brand: brandRow.name,
      items: datedItems,
      mode: result.mode === 'ai' ? 'ai' : 'zero-cost',
      model: result.model ?? null,
      profileSource: ctx.profileSource,
      growthProfile: ctx.growthProfile,
      growthCalendar: ctx.growthCalendar,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : 'Planner failed.' }, { status: 500 });
  }
}
