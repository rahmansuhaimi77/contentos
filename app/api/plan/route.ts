import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { buildThirtyDayPlan, type PlanKnowledgeItem } from '@/lib/plan-generator';
import { buildKampusRideThirtyDayPlan, isKampusRide } from '@/lib/kampusride-strategy';
import { buildKampusRideLaunchAwarePlan } from '@/lib/kampusride-launch-context';

export const runtime = 'nodejs';

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

const InputSchema = z.object({
  brandId: z.string().uuid(),
  objective: z.string().min(1),
  platforms: z.array(z.string().min(1)).min(1).max(5),
  language: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function malaysiaToday() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDaysIso(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function kampusRideAcademicContext(date: string) {
  if (date < '2026-09-28') {
    return 'Pre-semester / return-to-campus preparation. Official Semester 1 lectures begin 28 September 2026. Keep KampusRide pre-launch unless the founder has separately confirmed launch.';
  }
  if (date <= '2026-11-13') {
    return 'Semester 1 first lecture block (28 Sep–13 Nov 2026). Prioritise real campus routines, class movement, rain, LRT Gombak, app how-to and practical adoption content.';
  }
  if (date <= '2026-11-22') {
    return 'Mid-semester break (14–22 Nov 2026). Prioritise balik kampung, luggage, airport/LRT movement, lighter campus demand and useful travel-prep content.';
  }
  if (date <= '2027-01-08') {
    return 'Semester 1 second lecture block (23 Nov 2026–8 Jan 2027). Return to regular campus routine and utility-led ride content.';
  }
  if (date <= '2027-01-13') {
    return 'Revision period (9–13 Jan 2027). Keep content concise and utility-first; use study/revision movement context rather than heavy promotion.';
  }
  if (date <= '2027-02-05') {
    return 'Examination period (14 Jan–5 Feb 2027). Prioritise low-friction logistics and exam mobility; avoid noisy hard-sell content.';
  }
  if (date <= '2027-02-21') {
    return 'Inter-semester vacation (6–21 Feb 2027). Use lighter feedback, retention, community stories and product-improvement content.';
  }
  return 'Outside the currently verified Semester 1 2026/27 academic window. Use the newest verified IIUM calendar/event context from the Knowledge Base and do not invent dates.';
}

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
    const { data: brandRow, error: brandError } = await auth.supabase
      .from('contentos_brands')
      .select('id,name,preferred_cta')
      .eq('id', brandId)
      .single();

    if (brandError || !brandRow) return Response.json({ error: 'Brand not found or unavailable.' }, { status: 404 });

    const { data: knowledgeRows, error: knowledgeError } = await auth.supabase
      .from('contentos_knowledge_items')
      .select('kind,title,content')
      .eq('brand_id', brandId)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (knowledgeError) throw knowledgeError;

    const plannerInput = {
      brandName: brandRow.name,
      objective,
      platforms,
      language,
      cta: brandRow.preferred_cta || undefined,
    };
    const knowledge = (knowledgeRows ?? []) as PlanKnowledgeItem[];
    const baseItems = isKampusRide(brandRow.name)
      ? buildKampusRideLaunchAwarePlan(
          plannerInput,
          knowledge,
          buildKampusRideThirtyDayPlan(plannerInput, knowledge),
        )
      : buildThirtyDayPlan(plannerInput, knowledge);

    const datedItems = baseItems.map((item) => {
      const plannedDate = addDaysIso(startDate, item.day_number - 1);
      if (!isKampusRide(brandRow.name)) return { ...item, planned_date: plannedDate };
      return {
        ...item,
        planned_date: plannedDate,
        concept: `${item.concept} TIMING GUARDRAIL (${plannedDate}): ${kampusRideAcademicContext(plannedDate)}`,
      };
    });

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

    return Response.json({ plan, brand: brandRow.name, items: datedItems, mode: 'zero-cost' });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : 'Planner failed.' }, { status: 500 });
  }
}
