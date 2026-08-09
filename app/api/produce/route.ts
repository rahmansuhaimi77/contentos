import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { buildProductionPack, type ProductionKnowledgeItem } from '@/lib/production-pack-generator';

export const runtime = 'nodejs';

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

const InputSchema = z.object({
  planId: z.string().uuid(),
  dayNumber: z.number().int().min(1).max(30),
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
  ) as any;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedClient(req);
    if (!auth) return Response.json({ error: 'Please sign in first.' }, { status: 401 });

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Invalid production request.' }, { status: 400 });
    const { planId, dayNumber } = parsed.data;

    const { data: item, error: itemError } = await auth.supabase
      .from('contentos_plan_items')
      .select('id,plan_id,day_number,pillar,objective,platform,format,hook,concept,cta,status,production_status')
      .eq('plan_id', planId)
      .eq('day_number', dayNumber)
      .single();
    if (itemError || !item) return Response.json({ error: 'Plan item not found.' }, { status: 404 });

    const { data: plan, error: planError } = await auth.supabase
      .from('contentos_content_plans')
      .select('id,brand_id,language')
      .eq('id', planId)
      .single();
    if (planError || !plan) return Response.json({ error: 'Content plan not found.' }, { status: 404 });

    const { data: brand, error: brandError } = await auth.supabase
      .from('contentos_brands')
      .select('id,name,preferred_cta')
      .eq('id', plan.brand_id)
      .single();
    if (brandError || !brand) return Response.json({ error: 'Brand not found.' }, { status: 404 });

    const { data: knowledgeRows, error: knowledgeError } = await auth.supabase
      .from('contentos_knowledge_items')
      .select('kind,title,content')
      .eq('brand_id', brand.id)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (knowledgeError) throw knowledgeError;

    const pack = buildProductionPack({
      brandName: brand.name,
      platform: item.platform,
      format: item.format,
      language: plan.language,
      pillar: item.pillar,
      objective: item.objective,
      hook: item.hook,
      concept: item.concept,
      cta: item.cta || brand.preferred_cta || '',
    }, (knowledgeRows ?? []) as ProductionKnowledgeItem[]);

    const { data: existingVariants } = await auth.supabase
      .from('contentos_content_variants')
      .select('id,campaign_id')
      .eq('source_plan_item_id', item.id)
      .limit(1);
    const existing = existingVariants?.[0];

    let campaignId = existing?.campaign_id as string | undefined;
    let variantId = existing?.id as string | undefined;

    if (!campaignId) {
      const { data: campaign, error: campaignError } = await auth.supabase
        .from('contentos_campaigns')
        .insert({
          brand_id: brand.id,
          created_by: auth.user.id,
          objective: item.objective,
          platform: item.platform,
          format: item.format,
          language: plan.language,
          brief: { source: '30-day-planner', plan_id: planId, plan_item_id: item.id, day_number: dayNumber, pillar: item.pillar },
          strategy: pack.strategy,
          status: 'generated',
        })
        .select('id')
        .single();
      if (campaignError) throw campaignError;
      campaignId = campaign.id;
    }

    const variantPayload = {
      campaign_id: campaignId,
      hook: pack.hook,
      angle: pack.angle,
      script: pack.script,
      caption: pack.caption,
      cta: pack.cta,
      creative_prompt: pack.creative_prompt,
      production_pack: pack,
      source_plan_item_id: item.id,
      status: 'in_review',
    };

    if (variantId) {
      const { error: variantError } = await auth.supabase
        .from('contentos_content_variants')
        .update(variantPayload)
        .eq('id', variantId);
      if (variantError) throw variantError;
    } else {
      const { data: variant, error: variantError } = await auth.supabase
        .from('contentos_content_variants')
        .insert(variantPayload)
        .select('id')
        .single();
      if (variantError) throw variantError;
      variantId = variant.id;
    }

    const { error: planItemError } = await auth.supabase
      .from('contentos_plan_items')
      .update({ production_status: 'produced' })
      .eq('id', item.id);
    if (planItemError) throw planItemError;

    return Response.json({ pack, campaignId, variantId, mode: 'zero-cost', productionStatus: 'produced' });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : 'Production failed.' }, { status: 500 });
  }
}
