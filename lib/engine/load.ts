import { parseProfile, profileFromBrandBrain, type BrandProfile } from './profile';
import { starterPackFor } from './packs';
import type { KnowledgeItem } from './context';

export type BrandRow = {
  id: string;
  name: string;
  product: string;
  audience: string;
  positioning: string;
  voice: string;
  offer: string;
  proof: string;
  preferred_cta: string;
  avoid: string;
  profile?: unknown;
};

export type GrowthProfileRow = { current_phase: string; marketplace_need: string; target_launch_start: string | null; target_launch_end: string | null };
export type GrowthWindowRow = {
  start_date: string; end_date: string; phase: string; academic_phase: string; title: string; objective: string;
  audience_focus: string; marketplace_need: string; content_mix: string[]; ops_priorities: string[]; success_gates: string[];
};

export type ProfileSource = 'stored' | 'starter_pack' | 'brand_brain';

export type BrandEngineContext = {
  brand: BrandRow;
  profile: BrandProfile;
  profileSource: ProfileSource;
  knowledge: KnowledgeItem[];
  growthProfile: GrowthProfileRow | null;
  growthCalendar: GrowthWindowRow[];
  recentHooks: string[];
};

const BRAND_COLUMNS = 'id,name,product,audience,positioning,voice,offer,proof,preferred_cta,avoid';

/** Reads the brand row, tolerating databases where migration 011 (profile column) is not applied yet. */
export async function loadBrandRow(supabase: any, brandId: string): Promise<BrandRow | null> {
  const withProfile = await supabase.from('contentos_brands').select(`${BRAND_COLUMNS},profile`).eq('id', brandId).maybeSingle();
  if (!withProfile.error) return withProfile.data as BrandRow | null;
  const plain = await supabase.from('contentos_brands').select(BRAND_COLUMNS).eq('id', brandId).maybeSingle();
  if (plain.error) throw plain.error;
  return plain.data as BrandRow | null;
}

export async function findBrandIdByName(supabase: any, name: string): Promise<string | null> {
  const { data } = await supabase.from('contentos_brands').select('id').ilike('name', name).order('updated_at', { ascending: false }).limit(1);
  return (data as Array<{ id: string }> | null)?.[0]?.id ?? null;
}

export function resolveProfile(brand: BrandRow): { profile: BrandProfile; source: ProfileSource } {
  const stored = parseProfile(brand.profile);
  if (stored) return { profile: stored, source: 'stored' };
  const pack = starterPackFor(brand.name);
  if (pack) return { profile: pack, source: 'starter_pack' };
  return { profile: profileFromBrandBrain(brand), source: 'brand_brain' };
}

async function optional<T>(query: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> {
  try {
    const { data, error } = await query;
    return error || data == null ? fallback : data;
  } catch {
    return fallback;
  }
}

export async function loadBrandEngine(supabase: any, brandId: string): Promise<BrandEngineContext | null> {
  const brand = await loadBrandRow(supabase, brandId);
  if (!brand) return null;
  const { profile, source } = resolveProfile(brand);

  const [knowledge, growthProfile, growthCalendar, recentVariants, recentPlanItems] = await Promise.all([
    optional<KnowledgeItem[]>(supabase.from('contentos_knowledge_items').select('kind,title,content').eq('brand_id', brandId).order('updated_at', { ascending: false }).limit(100), []),
    optional<GrowthProfileRow | null>(supabase.from('contentos_growth_profiles').select('current_phase,marketplace_need,target_launch_start,target_launch_end').eq('brand_id', brandId).maybeSingle(), null),
    optional<GrowthWindowRow[]>(supabase.from('contentos_growth_calendar_items').select('start_date,end_date,phase,academic_phase,title,objective,audience_focus,marketplace_need,content_mix,ops_priorities,success_gates').eq('brand_id', brandId).order('sort_order', { ascending: true }), []),
    optional<Array<{ hook: string }>>(supabase.from('contentos_content_variants').select('hook,contentos_campaigns!inner(brand_id)').eq('contentos_campaigns.brand_id', brandId).order('created_at', { ascending: false }).limit(60), []),
    optional<Array<{ hook: string }>>(supabase.from('contentos_plan_items').select('hook,contentos_content_plans!inner(brand_id)').eq('contentos_content_plans.brand_id', brandId).order('created_at', { ascending: false }).limit(60), []),
  ]);

  const recentHooks = [...new Set([...recentVariants, ...recentPlanItems].map((r) => r.hook).filter(Boolean))];
  return { brand, profile, profileSource: source, knowledge, growthProfile, growthCalendar, recentHooks };
}

/** The phase key in force: the manual product phase on the growth profile beats the profile default. */
export function phaseKeyFor(ctx: Pick<BrandEngineContext, 'profile' | 'growthProfile'>) {
  const manual = ctx.growthProfile?.current_phase;
  if (manual && ctx.profile.phase.options.some((p) => p.key === manual)) return manual;
  return ctx.profile.phase.current;
}

export function growthWindowFor(calendar: GrowthWindowRow[], date: string) {
  return calendar.find((row) => date >= row.start_date && date <= row.end_date) ?? null;
}
