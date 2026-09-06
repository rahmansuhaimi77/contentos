import OpenAI from 'openai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const runtime = 'nodejs';

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

const InputSchema = z.object({ websiteId: z.string().uuid() });

const ResearchSchema = z.object({
  research_brief: z.object({
    decision_context: z.string(),
    reference_queries: z.array(z.string()).min(3).max(10),
    visual_opportunities: z.array(z.string()).max(10),
    conversion_priorities: z.array(z.string()).max(10),
    content_risks: z.array(z.string()).max(10),
  }),
  references: z.array(z.object({
    source_url: z.string().url(),
    title: z.string(),
    inspiration_role: z.string(),
    notes: z.string(),
    inspiration_tags: z.array(z.string()).max(12),
  })).max(10),
  directions: z.array(z.object({
    recipe_key: z.string(),
    style_name: z.string(),
    creative_concept: z.string(),
    rationale: z.string(),
    mood: z.string(),
    palette: z.record(z.string()),
    typography: z.record(z.unknown()),
    visual_language: z.record(z.unknown()),
    motion_language: z.record(z.unknown()),
    composition_rules: z.record(z.unknown()),
    anti_patterns: z.array(z.string()),
  })).min(3).max(3),
});

type ResearchResult = z.infer<typeof ResearchSchema>;
type Recipe = {
  id: string;
  recipe_key: string;
  name: string;
  best_for: string[];
  avoid_for: string[];
  personality: string;
  layout_rules: Record<string, unknown>;
  typography_rules: Record<string, unknown>;
  visual_rules: Record<string, unknown>;
  motion_rules: Record<string, unknown>;
  conversion_rules: Record<string, unknown>;
};

function extractJson(text: string) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Research model did not return JSON.');
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

function recipeScore(recipe: Recipe, context: string) {
  const haystack = context.toLowerCase();
  let score = 0;
  for (const term of recipe.best_for ?? []) if (term && haystack.includes(String(term).toLowerCase())) score += 3;
  for (const term of recipe.avoid_for ?? []) if (term && haystack.includes(String(term).toLowerCase())) score -= 4;
  return score;
}

function buildPlanningOnlyResult(siteName: string, brief: any, recipes: Recipe[]): ResearchResult {
  const context = `${siteName} ${brief.business_summary} ${brief.audience} ${brief.offer}`;
  const chosen = [...recipes].sort((a, b) => recipeScore(b, context) - recipeScore(a, context)).slice(0, 3);
  return {
    research_brief: {
      decision_context: `Find design references that make ${siteName} feel specific to its market, credible and conversion-focused without borrowing a competitor's identity.`,
      reference_queries: [
        `${siteName} ${brief.business_summary} premium website design`,
        `${brief.audience} service website strong conversion design`,
        `${brief.offer || brief.business_summary} editorial web design inspiration`,
        `award winning local service website mobile UX`,
      ],
      visual_opportunities: ['Use business-specific visual evidence', 'Give the hero a clear visual idea, not decorative filler', 'Vary section composition instead of repeating card grids'],
      conversion_priorities: [brief.primary_goal || 'Make the next action obvious', 'Keep primary CTA persistent on mobile', 'Place proof close to decision points'],
      content_risks: ['Generic AI wording', 'Invented proof or claims', 'Stock imagery that could fit unrelated businesses', 'A fixed template skeleton'],
    },
    references: [],
    directions: chosen.map((recipe) => ({
      recipe_key: recipe.recipe_key,
      style_name: recipe.name,
      creative_concept: `${recipe.name} interpreted specifically for ${siteName}`,
      rationale: 'Preliminary direction only. Live references are still required before creative approval.',
      mood: recipe.personality,
      palette: {},
      typography: recipe.typography_rules,
      visual_language: recipe.visual_rules,
      motion_language: recipe.motion_rules,
      composition_rules: recipe.layout_rules,
      anti_patterns: ['Generic gradient hero', 'Three-card default grid', 'Invented claims', 'Decorative stock photography', 'Direct generation-to-production publishing'],
    })),
  };
}

function collectSourceUrls(value: unknown, urls = new Set<string>()) {
  if (!value) return urls;
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) urls.add(value);
    return urls;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSourceUrls(item, urls);
    return urls;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if ((key === 'url' || key === 'source_url') && typeof item === 'string' && /^https?:\/\//i.test(item)) urls.add(item);
      else collectSourceUrls(item, urls);
    }
  }
  return urls;
}

function canonical(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`.toLowerCase();
  } catch {
    return url.toLowerCase().replace(/[?#].*$/, '').replace(/\/$/, '');
  }
}

function isGroundedReference(url: string, sources: Set<string>) {
  const target = canonical(url);
  for (const source of sources) {
    const grounded = canonical(source);
    if (target === grounded || target.startsWith(`${grounded}/`) || grounded.startsWith(`${target}/`)) return true;
  }
  return false;
}

function researchPrompt(site: any, brief: any, recipes: Recipe[]) {
  const compactRecipes = recipes.map((recipe) => ({
    recipe_key: recipe.recipe_key,
    name: recipe.name,
    best_for: recipe.best_for,
    avoid_for: recipe.avoid_for,
    personality: recipe.personality,
    layout_rules: recipe.layout_rules,
    typography_rules: recipe.typography_rules,
    visual_rules: recipe.visual_rules,
    motion_rules: recipe.motion_rules,
    conversion_rules: recipe.conversion_rules,
  }));

  return `You are the research and creative-direction agent for a premium website production studio.

BUSINESS
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

AVAILABLE DESIGN SYSTEMS
${JSON.stringify(compactRecipes)}

Use web search to find 5-8 genuinely useful live website references. Do not limit research to direct competitors: include adjacent industries when they demonstrate a better solution for typography, layout, hero composition, visual storytelling, trust, mobile conversion, or motion. Prefer polished real websites. Never copy a whole site or brand identity.

Then recommend exactly 3 materially different creative directions, each mapped to one available recipe_key. The directions must not be cosmetic variants of the same layout.

Quality rules:
- No generic gradient hero + three cards + testimonials + CTA formula.
- No invented business claims, numbers, certifications, pricing, guarantees or testimonials.
- Copy must sound like the business presenting itself, not an agency describing the client.
- Every visual recommendation must have a storytelling, trust or conversion purpose.
- The design should fail the "could this fit ten unrelated businesses?" test: if yes, make it more specific.
- References are inspiration for principles only; do not reproduce their copyrighted copy, images or distinctive composition wholesale.

Return ONLY valid JSON with this shape:
{
  "research_brief": {
    "decision_context": "...",
    "reference_queries": ["..."],
    "visual_opportunities": ["..."],
    "conversion_priorities": ["..."],
    "content_risks": ["..."]
  },
  "references": [
    {"source_url":"https://...","title":"...","inspiration_role":"hero|typography|layout|trust|conversion|motion|visual-storytelling","notes":"specific principle worth learning from","inspiration_tags":["..."]}
  ],
  "directions": [
    {
      "recipe_key":"one exact available recipe_key",
      "style_name":"specific direction name",
      "creative_concept":"...",
      "rationale":"...",
      "mood":"...",
      "palette":{"primary":"...","background":"...","accent":"...","ink":"..."},
      "typography":{"headline":"...","body":"...","rules":["..."]},
      "visual_language":{"principles":["..."]},
      "motion_language":{"principles":["..."]},
      "composition_rules":{"principles":["..."]},
      "anti_patterns":["..."]
    }
  ]
}`;
}

export async function POST(req: Request) {
  let runId = '';
  let supabase: any = null;
  try {
    const auth = await getAuthenticatedClient(req);
    if (!auth) return Response.json({ error: 'Please sign in before running website research.' }, { status: 401 });
    supabase = auth.supabase;

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    const websiteId = parsed.data.websiteId;

    const [siteRes, briefRes, recipeRes, approvedDirectionRes] = await Promise.all([
      supabase.from('growth_websites').select('id,business_name,slug,status').eq('id', websiteId).maybeSingle(),
      supabase.from('growth_website_briefs').select('id,business_summary,primary_goal,audience,offer,proof,voice,avoid,verified_facts,constraints,status').eq('website_id', websiteId).maybeSingle(),
      supabase.from('growth_design_recipes').select('id,recipe_key,name,best_for,avoid_for,personality,layout_rules,typography_rules,visual_rules,motion_rules,conversion_rules').eq('is_active', true),
      supabase.from('growth_website_directions').select('id').eq('website_id', websiteId).eq('status', 'approved').limit(1),
    ]);

    const firstError = siteRes.error || briefRes.error || recipeRes.error || approvedDirectionRes.error;
    if (firstError) throw new Error(firstError.message);
    if (!siteRes.data || !briefRes.data) return Response.json({ error: 'Website or production brief not found.' }, { status: 404 });
    if (briefRes.data.status === 'draft') return Response.json({ error: 'Verify the business brief before running research.' }, { status: 409 });
    if ((approvedDirectionRes.data ?? []).length) return Response.json({ error: 'A creative direction is already approved. Re-open direction selection before re-running research.' }, { status: 409 });

    const recipes = (recipeRes.data ?? []) as Recipe[];
    if (recipes.length < 3) return Response.json({ error: 'At least three active design recipes are required.' }, { status: 409 });

    const hasAi = Boolean(process.env.OPENAI_API_KEY);
    const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
    const { data: run, error: runError } = await supabase.from('growth_website_runs').insert({
      website_id: websiteId,
      stage: 'reference_research',
      provider: hasAi ? 'openai' : 'local',
      model: hasAi ? model : 'planning-only',
      prompt_version: 'website_research_v2_1',
      input_json: { website: siteRes.data, brief: briefRes.data, recipe_keys: recipes.map((recipe) => recipe.recipe_key) },
      status: 'started',
    }).select('id').single();
    if (runError) throw new Error(runError.message);
    runId = run.id;

    let result: ResearchResult;
    let groundedReferences: ResearchResult['references'] = [];
    let discardedReferences = 0;
    let mode: 'live_research' | 'planning_only' = 'planning_only';

    if (!hasAi) {
      result = buildPlanningOnlyResult(siteRes.data.business_name, briefRes.data, recipes);
    } else {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response: any = await client.responses.create({
        model,
        tools: [{ type: 'web_search' }],
        input: researchPrompt(siteRes.data, briefRes.data, recipes),
      });
      result = ResearchSchema.parse(extractJson(response.output_text || ''));
      const sources = collectSourceUrls(response.output);
      groundedReferences = result.references.filter((reference) => isGroundedReference(reference.source_url, sources));
      discardedReferences = result.references.length - groundedReferences.length;
      result = { ...result, references: groundedReferences };
      mode = 'live_research';
    }

    await supabase.from('growth_website_references').delete().eq('website_id', websiteId).eq('source_kind', 'web_research').eq('approved', false);
    if (result.references.length) {
      const { error: referenceError } = await supabase.from('growth_website_references').insert(result.references.map((reference) => ({
        website_id: websiteId,
        source_url: reference.source_url,
        source_kind: 'web_research',
        inspiration_role: reference.inspiration_role,
        title: reference.title,
        notes: reference.notes,
        inspiration_tags: reference.inspiration_tags,
        approved: false,
      })));
      if (referenceError) throw new Error(referenceError.message);
    }

    await supabase.from('growth_website_directions').update({ status: 'superseded', updated_at: new Date().toISOString() }).eq('website_id', websiteId).eq('status', 'proposed');
    const recipeByKey = new Map(recipes.map((recipe) => [recipe.recipe_key, recipe]));
    const directionRows = result.directions.map((direction) => ({
      website_id: websiteId,
      recipe_id: recipeByKey.get(direction.recipe_key)?.id || null,
      style_name: direction.style_name,
      creative_concept: direction.creative_concept,
      rationale: direction.rationale,
      mood: direction.mood,
      palette: direction.palette,
      typography: direction.typography,
      visual_language: direction.visual_language,
      motion_language: direction.motion_language,
      composition_rules: direction.composition_rules,
      anti_patterns: direction.anti_patterns,
      status: 'proposed',
    }));
    const { error: directionError } = await supabase.from('growth_website_directions').insert(directionRows);
    if (directionError) throw new Error(directionError.message);

    await supabase.from('growth_website_runs').update({
      status: 'completed',
      output_json: { ...result, mode, grounded_reference_count: result.references.length, discarded_reference_count: discardedReferences },
      completed_at: new Date().toISOString(),
    }).eq('id', runId);

    return Response.json({ ...result, mode, grounded_reference_count: result.references.length, discarded_reference_count: discardedReferences });
  } catch (error) {
    console.error(error);
    if (supabase && runId) {
      await supabase.from('growth_website_runs').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Research failed.', completed_at: new Date().toISOString() }).eq('id', runId);
    }
    return Response.json({ error: error instanceof Error ? error.message : 'Website research failed.' }, { status: 500 });
  }
}
