import OpenAI from 'openai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const runtime = 'nodejs';

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

const InputSchema = z.object({ websiteId: z.string().uuid() });

const PlanSchema = z.object({
  strategy: z.object({
    narrative_arc: z.string(),
    conversion_logic: z.string(),
    mobile_priority: z.string(),
    originality_test: z.string(),
  }),
  sections: z.array(z.object({
    section_key: z.string().regex(/^[a-z0-9_]+$/),
    section_type: z.string(),
    objective: z.string(),
    conversion_role: z.string(),
    copy: z.object({
      eyebrow: z.string(),
      headline: z.string(),
      body: z.string(),
      cta_label: z.string(),
      support: z.array(z.string()).max(8),
    }),
    layout: z.object({
      composition: z.string(),
      desktop: z.string(),
      mobile: z.string(),
      reference_principle: z.string(),
    }),
    visual_brief: z.object({
      asset_type: z.string(),
      purpose: z.string(),
      subject: z.string(),
      art_direction: z.string(),
      prompt: z.string(),
      avoid: z.array(z.string()),
      crop_behavior: z.string(),
    }),
    motion: z.object({
      intent: z.string(),
      behavior: z.string(),
      reduced_motion: z.string(),
    }),
  })).min(5).max(12),
});

type PlanResult = z.infer<typeof PlanSchema>;

function extractJson(text: string) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Production planner did not return JSON.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function getAuthenticatedClient(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

function buildPrompt(site: any, brief: any, direction: any, references: any[]) {
  return `You are the senior UX designer, conversion strategist and web art director preparing a build specification for Codex.

BUSINESS TRUTH
Name: ${site.business_name}
Summary: ${brief.business_summary}
Primary goal: ${brief.primary_goal}
Audience: ${brief.audience}
Offer: ${brief.offer}
Proof: ${brief.proof}
Voice: ${brief.voice}
Avoid: ${brief.avoid}
Verified facts: ${JSON.stringify(brief.verified_facts)}
Constraints: ${JSON.stringify(brief.constraints)}

APPROVED CREATIVE DIRECTION
Style: ${direction.style_name}
Concept: ${direction.creative_concept}
Rationale: ${direction.rationale}
Mood: ${direction.mood}
Palette: ${JSON.stringify(direction.palette)}
Typography: ${JSON.stringify(direction.typography)}
Visual language: ${JSON.stringify(direction.visual_language)}
Motion language: ${JSON.stringify(direction.motion_language)}
Composition rules: ${JSON.stringify(direction.composition_rules)}
Anti-patterns: ${JSON.stringify(direction.anti_patterns)}

APPROVED REFERENCES (principles only — never copy their text, imagery or distinctive composition wholesale)
${JSON.stringify(references.map((reference) => ({ title: reference.title, url: reference.source_url, role: reference.inspiration_role, notes: reference.notes, tags: reference.inspiration_tags })))}

Create a build-ready one-page website architecture. Choose the number and order of sections based on the business and conversion journey, not a standard template.

Non-negotiable quality rules:
- Do NOT default to hero + three feature cards + testimonials + CTA.
- Every section must earn its place in the conversion narrative.
- Avoid repeated card grids; vary composition intentionally.
- The hero must have a concrete visual idea with a clear relationship to the business.
- Copy must sound like the business speaking to its customer, not an agency promoting the client.
- Use ONLY the supplied verified facts. If proof is absent, do not fabricate it.
- A visual can be a client photo, product/service evidence, illustration, diagram, texture, type-led composition, map/location cue, icon system or generated image. Do not force stock photography.
- Motion must communicate hierarchy or continuity, never exist as decoration.
- Mobile is a first-class composition, not a collapsed desktop page.
- The finished plan must be specific enough that it would look wrong for an unrelated business.
- Primary CTA should be clear and repeated only at natural decision points.

Return ONLY valid JSON:
{
  "strategy": {
    "narrative_arc":"...",
    "conversion_logic":"...",
    "mobile_priority":"...",
    "originality_test":"why this plan cannot be reused for ten unrelated businesses"
  },
  "sections": [
    {
      "section_key":"lower_snake_case_unique_key",
      "section_type":"hero|proof|service_story|process|comparison|faq|location|cta|custom",
      "objective":"...",
      "conversion_role":"...",
      "copy":{"eyebrow":"","headline":"","body":"","cta_label":"","support":["..."]},
      "layout":{"composition":"...","desktop":"...","mobile":"...","reference_principle":"which approved reference principle inspired this, without copying"},
      "visual_brief":{"asset_type":"client_photo|generated_image|illustration|diagram|icon_system|texture|map|type_only|none","purpose":"...","subject":"...","art_direction":"...","prompt":"production-ready prompt or empty if no generated asset","avoid":["..."],"crop_behavior":"..."},
      "motion":{"intent":"...","behavior":"...","reduced_motion":"..."}
    }
  ]
}`;
}

export async function POST(req: Request) {
  let runId = '';
  let supabase: any = null;
  try {
    const auth = await getAuthenticatedClient(req);
    if (!auth) return Response.json({ error: 'Please sign in before planning a website.' }, { status: 401 });
    supabase = auth.supabase;

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    const websiteId = parsed.data.websiteId;

    const [siteRes, briefRes, directionRes, referenceRes, existingSectionsRes] = await Promise.all([
      supabase.from('growth_websites').select('id,business_name,slug,status').eq('id', websiteId).maybeSingle(),
      supabase.from('growth_website_briefs').select('id,business_summary,primary_goal,audience,offer,proof,voice,avoid,verified_facts,constraints,status').eq('website_id', websiteId).maybeSingle(),
      supabase.from('growth_website_directions').select('id,style_name,creative_concept,rationale,mood,palette,typography,visual_language,motion_language,composition_rules,anti_patterns,status').eq('website_id', websiteId).eq('status', 'approved').limit(1).maybeSingle(),
      supabase.from('growth_website_references').select('id,source_url,title,inspiration_role,notes,inspiration_tags').eq('website_id', websiteId).eq('approved', true).order('created_at'),
      supabase.from('growth_website_sections').select('id,status').eq('website_id', websiteId),
    ]);

    const firstError = siteRes.error || briefRes.error || directionRes.error || referenceRes.error || existingSectionsRes.error;
    if (firstError) throw new Error(firstError.message);
    if (!siteRes.data || !briefRes.data) return Response.json({ error: 'Website or production brief not found.' }, { status: 404 });
    if (!['verified', 'approved'].includes(briefRes.data.status)) return Response.json({ error: 'Verify the business brief before production planning.' }, { status: 409 });
    if (!directionRes.data) return Response.json({ error: 'Approve one creative direction before production planning.' }, { status: 409 });
    if ((referenceRes.data ?? []).length < 3) return Response.json({ error: 'Approve at least three research references before production planning.' }, { status: 409 });
    if ((existingSectionsRes.data ?? []).some((section: any) => ['approved', 'built'].includes(section.status))) {
      return Response.json({ error: 'Approved or built sections already exist. Do not overwrite them with a new plan.' }, { status: 409 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: 'Live production planning requires an OpenAI API connection. A generic fallback is intentionally disabled to protect website quality.' }, { status: 503 });
    }

    const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
    const { data: run, error: runError } = await supabase.from('growth_website_runs').insert({
      website_id: websiteId,
      stage: 'production_planning',
      provider: 'openai',
      model,
      prompt_version: 'website_plan_v2_1',
      input_json: { website: siteRes.data, brief: briefRes.data, direction_id: directionRes.data.id, reference_ids: (referenceRes.data ?? []).map((reference: any) => reference.id) },
      status: 'started',
    }).select('id').single();
    if (runError) throw new Error(runError.message);
    runId = run.id;

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({ model, input: buildPrompt(siteRes.data, briefRes.data, directionRes.data, referenceRes.data ?? []) });
    const plan: PlanResult = PlanSchema.parse(extractJson(response.output_text || ''));

    const keys = new Set<string>();
    for (const section of plan.sections) {
      if (keys.has(section.section_key)) throw new Error(`Planner returned duplicate section key: ${section.section_key}`);
      keys.add(section.section_key);
    }

    await supabase.from('growth_website_assets').delete().eq('website_id', websiteId).eq('status', 'planned');
    await supabase.from('growth_website_sections').delete().eq('website_id', websiteId).eq('status', 'planned');

    const { data: insertedSections, error: sectionError } = await supabase.from('growth_website_sections').insert(plan.sections.map((section, index) => ({
      website_id: websiteId,
      section_key: section.section_key,
      section_type: section.section_type,
      sort_order: index,
      objective: section.objective,
      copy: section.copy,
      layout: section.layout,
      visual_brief: section.visual_brief,
      motion: section.motion,
      conversion_role: section.conversion_role,
      status: 'planned',
    }))).select('id,section_key');
    if (sectionError) throw new Error(sectionError.message);

    const sectionIdByKey = new Map((insertedSections ?? []).map((section: any) => [section.section_key, section.id]));
    const assetRows = plan.sections
      .filter((section) => section.visual_brief.asset_type !== 'none' && section.visual_brief.asset_type !== 'type_only')
      .map((section) => ({
        website_id: websiteId,
        section_id: sectionIdByKey.get(section.section_key) || null,
        asset_type: section.visual_brief.asset_type,
        source_type: section.visual_brief.asset_type === 'client_photo' ? 'client_required' : 'generated',
        generation_prompt: section.visual_brief.prompt,
        alt_text: section.visual_brief.subject,
        crop_rules: { behavior: section.visual_brief.crop_behavior },
        metadata: { purpose: section.visual_brief.purpose, art_direction: section.visual_brief.art_direction, avoid: section.visual_brief.avoid },
        status: 'planned',
      }));

    if (assetRows.length) {
      const { error: assetError } = await supabase.from('growth_website_assets').insert(assetRows);
      if (assetError) throw new Error(assetError.message);
    }

    await supabase.from('growth_website_runs').update({
      status: 'completed',
      output_json: plan,
      completed_at: new Date().toISOString(),
    }).eq('id', runId);

    return Response.json({ ...plan, section_count: plan.sections.length, asset_count: assetRows.length });
  } catch (error) {
    console.error(error);
    if (supabase && runId) {
      await supabase.from('growth_website_runs').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Planning failed.', completed_at: new Date().toISOString() }).eq('id', runId);
    }
    return Response.json({ error: error instanceof Error ? error.message : 'Website production planning failed.' }, { status: 500 });
  }
}
