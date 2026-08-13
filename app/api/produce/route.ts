import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  buildProductionPack,
  type ProductionKnowledgeItem,
  type ProductionVisualContext,
} from '@/lib/production-pack-generator';
import { buildThreadsProductionPack } from '@/lib/threads-production-pack';
import { buildKampusRideProductionPack, isKampusRide } from '@/lib/kampusride-strategy';
import { enforceKampusRidePreLaunchProduction } from '@/lib/kampusride-launch-context';
import { buildQuickCreateProductionPack } from '@/lib/quick-create-production';

export const runtime = 'nodejs';

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

const InputSchema = z.union([
  z.object({ planId: z.string().uuid(), dayNumber: z.number().int().min(1).max(30) }),
  z.object({ variantId: z.string().uuid() }),
]);

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

async function loadProductionContext(supabase: any, brandId: string) {
  const [knowledgeResult, visualResult, assetsResult] = await Promise.all([
    supabase
      .from('contentos_knowledge_items')
      .select('kind,title,content')
      .eq('brand_id', brandId)
      .order('updated_at', { ascending: false })
      .limit(100),
    supabase
      .from('contentos_brand_visuals')
      .select('primary_color,secondary_color,accent_color,font_notes,visual_style,image_rules')
      .eq('brand_id', brandId)
      .maybeSingle(),
    supabase
      .from('contentos_brand_assets')
      .select('kind,title')
      .eq('brand_id', brandId)
      .limit(50),
  ]);

  if (knowledgeResult.error) throw knowledgeResult.error;
  if (visualResult.error) throw visualResult.error;
  if (assetsResult.error) throw assetsResult.error;

  const assetRows = (assetsResult.data ?? []) as Array<{ kind: string; title: string }>;
  const visualContext: ProductionVisualContext = {
    ...(visualResult.data ?? {}),
    asset_kinds: [...new Set(assetRows.map((row) => row.kind))],
    asset_titles: assetRows.map((row) => row.title),
  };

  return {
    knowledgeItems: (knowledgeResult.data ?? []) as ProductionKnowledgeItem[],
    visualContext,
    assetRows,
  };
}

function extractQuickCreateRequest(brief: any) {
  const direct = typeof brief?.assistant_request === 'string' ? brief.assistant_request.trim() : '';
  if (direct) return direct;
  const extra = typeof brief?.extra === 'string' ? brief.extra : '';
  const match = extra.match(/CONTENT REQUEST:\s*([\s\S]*)$/i);
  return match?.[1]?.trim() || extra.trim();
}

async function produceQuickCreate(auth: { supabase: any; user: any }, variantId: string) {
  const { data: variant, error: variantError } = await auth.supabase
    .from('contentos_content_variants')
    .select('id,campaign_id,hook,script,caption,cta,creative_prompt,status')
    .eq('id', variantId)
    .single();
  if (variantError || !variant) return Response.json({ error: 'Creative not found.' }, { status: 404 });

  const { data: campaign, error: campaignError } = await auth.supabase
    .from('contentos_campaigns')
    .select('id,brand_id,objective,platform,format,language,brief')
    .eq('id', variant.campaign_id)
    .single();
  if (campaignError || !campaign) return Response.json({ error: 'Campaign not found.' }, { status: 404 });

  const brief = (campaign.brief ?? {}) as any;
  if (!brief.quick_create) {
    return Response.json({ error: 'This creative is not a Quick Create item.' }, { status: 400 });
  }

  const { data: brand, error: brandError } = await auth.supabase
    .from('contentos_brands')
    .select('id,name')
    .eq('id', campaign.brand_id)
    .single();
  if (brandError || !brand) return Response.json({ error: 'Brand not found.' }, { status: 404 });

  const { knowledgeItems, visualContext, assetRows } = await loadProductionContext(auth.supabase, brand.id);
  const pack = buildQuickCreateProductionPack({
    brandName: brand.name,
    platform: campaign.platform,
    format: campaign.format,
    language: campaign.language,
    objective: campaign.objective,
    hook: variant.hook,
    script: variant.script,
    caption: variant.caption,
    cta: variant.cta,
    creativePrompt: variant.creative_prompt,
    request: extractQuickCreateRequest(brief),
    targetPhase: typeof brief.target_phase === 'string' ? brief.target_phase : 'Unscheduled',
  }, knowledgeItems, visualContext);

  const { error: saveError } = await auth.supabase
    .from('contentos_content_variants')
    .update({
      production_pack: pack,
      creative_prompt: pack.creative_prompt,
      status: 'in_review',
      updated_at: new Date().toISOString(),
    })
    .eq('id', variant.id);
  if (saveError) throw saveError;

  return Response.json({
    pack,
    campaignId: campaign.id,
    variantId: variant.id,
    mode: 'zero-cost',
    productionStatus: 'produced',
    visualAssets: { count: assetRows.length, kinds: visualContext.asset_kinds ?? [] },
  });
}

async function produceCalendarItem(auth: { supabase: any; user: any }, planId: string, dayNumber: number) {
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

  const { knowledgeItems, visualContext, assetRows } = await loadProductionContext(auth.supabase, brand.id);
  const productionInput = {
    brandName: brand.name,
    platform: item.platform,
    format: item.format,
    language: plan.language,
    pillar: item.pillar,
    objective: item.objective,
    hook: item.hook,
    concept: item.concept,
    cta: item.cta || brand.preferred_cta || '',
  };

  let pack = isKampusRide(brand.name)
    ? buildKampusRideProductionPack(productionInput, knowledgeItems, visualContext)
    : /threads/i.test(item.platform)
      ? buildThreadsProductionPack(productionInput, knowledgeItems, visualContext)
      : buildProductionPack(productionInput, knowledgeItems, visualContext);

  if (isKampusRide(brand.name)) pack = enforceKampusRidePreLaunchProduction(pack, knowledgeItems);

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
        brief: { source: 'calendar', plan_id: planId, plan_item_id: item.id, day_number: dayNumber, pillar: item.pillar },
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
    const { error: variantError } = await auth.supabase.from('contentos_content_variants').update(variantPayload).eq('id', variantId);
    if (variantError) throw variantError;
  } else {
    const { data: variant, error: variantError } = await auth.supabase.from('contentos_content_variants').insert(variantPayload).select('id').single();
    if (variantError) throw variantError;
    variantId = variant.id;
  }

  const { error: planItemError } = await auth.supabase
    .from('contentos_plan_items')
    .update({ production_status: 'produced' })
    .eq('id', item.id);
  if (planItemError) throw planItemError;

  return Response.json({
    pack,
    campaignId,
    variantId,
    mode: 'zero-cost',
    productionStatus: 'produced',
    visualAssets: { count: assetRows.length, kinds: visualContext.asset_kinds ?? [] },
  });
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedClient(req);
    if (!auth) return Response.json({ error: 'Please sign in first.' }, { status: 401 });

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Invalid production request.' }, { status: 400 });

    if ('variantId' in parsed.data) return await produceQuickCreate(auth, parsed.data.variantId);
    return await produceCalendarItem(auth, parsed.data.planId, parsed.data.dayNumber);
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : 'Production failed.' }, { status: 500 });
  }
}
