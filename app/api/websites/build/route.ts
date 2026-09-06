import OpenAI from 'openai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const runtime = 'nodejs';

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

const InputSchema = z.object({ websiteId: z.string().uuid() });
const FileSchema = z.object({
  path: z.enum(['index.html', 'styles.css', 'script.js']),
  content: z.string().min(1),
});
const BuildSchema = z.object({
  build_summary: z.string(),
  files: z.array(FileSchema).length(3),
});

type BuildResult = z.infer<typeof BuildSchema>;

type AssetRow = {
  id: string;
  section_id: string | null;
  asset_type: string;
  source_type: string;
  source_url: string | null;
  generation_prompt: string;
  alt_text: string;
  crop_rules: Record<string, unknown>;
  metadata: Record<string, unknown>;
  status: string;
};

function extractJson(text: string) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Builder did not return JSON.');
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

function validateFiles(result: BuildResult) {
  const paths = new Set(result.files.map((file) => file.path));
  if (paths.size !== 3 || !paths.has('index.html') || !paths.has('styles.css') || !paths.has('script.js')) {
    throw new Error('Builder must return exactly index.html, styles.css and script.js.');
  }

  const limits: Record<string, number> = { 'index.html': 90_000, 'styles.css': 140_000, 'script.js': 35_000 };
  for (const file of result.files) {
    if (file.content.length > limits[file.path]) throw new Error(`${file.path} exceeded the preview source size limit.`);
  }

  const script = result.files.find((file) => file.path === 'script.js')?.content || '';
  const unsafeScript = /\b(fetch|XMLHttpRequest|WebSocket|EventSource|eval|Function)\s*\(|document\.cookie|localStorage|sessionStorage|sendBeacon/i;
  if (unsafeScript.test(script)) throw new Error('Generated script attempted network, storage, cookie or dynamic-code behavior that is not allowed in preview builds.');

  const html = result.files.find((file) => file.path === 'index.html')?.content || '';
  if (/<script[^>]+src=/i.test(html)) throw new Error('External scripts are not allowed in generated preview builds.');
  if (/<form[^>]+action\s*=\s*["']https?:/i.test(html)) throw new Error('External form submission is not allowed until a destination is explicitly verified.');
  if (/data:(?:text\/html|application\/javascript)/i.test(html)) throw new Error('Executable data URLs are not allowed in generated preview builds.');
}

function buildPrompt(site: any, brief: any, direction: any, references: any[], sections: any[], assets: AssetRow[]) {
  const assetManifest = assets.map((asset) => ({
    id: asset.id,
    section_id: asset.section_id,
    type: asset.asset_type,
    source_type: asset.source_type,
    source_url: asset.source_url,
    status: asset.status,
    alt_text: asset.alt_text,
    generation_prompt: asset.generation_prompt,
    crop_rules: asset.crop_rules,
    metadata: asset.metadata,
  }));

  return `You are the build agent for a premium, reference-led website studio. Convert the approved production plan into a polished STATIC preview using exactly three files: index.html, styles.css and script.js.

BUSINESS TRUTH
${JSON.stringify({
    name: site.business_name,
    slug: site.slug,
    summary: brief.business_summary,
    primary_goal: brief.primary_goal,
    audience: brief.audience,
    offer: brief.offer,
    proof: brief.proof,
    voice: brief.voice,
    avoid: brief.avoid,
    verified_facts: brief.verified_facts,
    constraints: brief.constraints,
  })}

APPROVED CREATIVE DIRECTION
${JSON.stringify(direction)}

APPROVED REFERENCES — PRINCIPLES ONLY, NEVER COPY THEIR TEXT/IMAGES/WHOLE COMPOSITION
${JSON.stringify(references)}

APPROVED PRODUCTION PLAN
${JSON.stringify(sections)}

ASSET MANIFEST
${JSON.stringify(assetManifest)}

BUILD RULES
- This is a real visual preview, not a wireframe or admin dashboard.
- Follow the exact narrative intent and section order from the production plan, but interpret each composition with design judgment.
- Do not fall back to a generic hero + three cards + testimonials + CTA skeleton.
- Use client-voice copy from the plan. Do not add unverified claims, fake reviews, fake metrics, fake awards, fake certifications, fake prices or fake guarantees.
- If an asset has a selected/approved source_url, use that URL and obey its alt text/crop behavior.
- If a planned visual asset has no usable source_url, create an intentional CSS/type/shape-based visual placeholder that reflects the approved art direction. Mark it with data-visual-pending="true" and aria-label="Visual asset pending". It must look intentional but must NOT pretend to be a real customer/product image.
- Mobile composition is first class. At 360-430px, preserve hierarchy, CTA access and crop safety instead of merely stacking desktop blocks.
- Use semantic HTML, visible focus states, useful alt text, sufficient contrast and prefers-reduced-motion handling.
- Motion may only use CSS and small vanilla JS interactions. No external JS, no network requests, no local/session storage, no cookies, no analytics, no eval/dynamic code.
- Do not embed remote tracking pixels or scripts.
- CTA links may use only URLs already present in verified facts or approved asset/reference data. If no verified destination exists, use href="#contact" or another on-page anchor rather than guessing a WhatsApp number/domain.
- External reference sites are inspiration only. Do not hotlink their assets.
- The result should fail the "could this page fit ten unrelated businesses?" test.

Return ONLY valid JSON:
{
  "build_summary":"short explanation of how the approved direction was translated",
  "files":[
    {"path":"index.html","content":"..."},
    {"path":"styles.css","content":"..."},
    {"path":"script.js","content":"..."}
  ]
}`;
}

export async function POST(req: Request) {
  let runId = '';
  let supabase: any = null;
  try {
    const auth = await getAuthenticatedClient(req);
    if (!auth) return Response.json({ error: 'Please sign in before building a website preview.' }, { status: 401 });
    supabase = auth.supabase;

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    const websiteId = parsed.data.websiteId;

    const [siteRes, briefRes, directionRes, referenceRes, sectionRes, assetRes, versionRes] = await Promise.all([
      supabase.from('growth_websites').select('id,business_name,slug,status').eq('id', websiteId).maybeSingle(),
      supabase.from('growth_website_briefs').select('id,business_summary,primary_goal,audience,offer,proof,voice,avoid,verified_facts,constraints,status').eq('website_id', websiteId).maybeSingle(),
      supabase.from('growth_website_directions').select('id,style_name,creative_concept,rationale,mood,palette,typography,visual_language,motion_language,composition_rules,anti_patterns,status').eq('website_id', websiteId).eq('status', 'approved').limit(1).maybeSingle(),
      supabase.from('growth_website_references').select('id,source_url,title,inspiration_role,notes,inspiration_tags').eq('website_id', websiteId).eq('approved', true).order('created_at'),
      supabase.from('growth_website_sections').select('id,section_key,section_type,sort_order,objective,copy,layout,visual_brief,motion,conversion_role,status').eq('website_id', websiteId).order('sort_order'),
      supabase.from('growth_website_assets').select('id,section_id,asset_type,source_type,source_url,generation_prompt,alt_text,crop_rules,metadata,status').eq('website_id', websiteId),
      supabase.from('growth_website_versions').select('version_no').eq('website_id', websiteId).order('version_no', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const firstError = siteRes.error || briefRes.error || directionRes.error || referenceRes.error || sectionRes.error || assetRes.error || versionRes.error;
    if (firstError) throw new Error(firstError.message);
    if (!siteRes.data || !briefRes.data) return Response.json({ error: 'Website or production brief not found.' }, { status: 404 });
    if (!['verified', 'approved'].includes(briefRes.data.status)) return Response.json({ error: 'Verify the business brief before building.' }, { status: 409 });
    if (!directionRes.data) return Response.json({ error: 'Approve a creative direction before building.' }, { status: 409 });
    if ((referenceRes.data ?? []).length < 3) return Response.json({ error: 'At least three approved references are required before building.' }, { status: 409 });
    if ((sectionRes.data ?? []).length < 5) return Response.json({ error: 'Generate and review the production plan before building.' }, { status: 409 });
    if (!process.env.OPENAI_API_KEY) return Response.json({ error: 'Build generation requires an OpenAI API connection. A generic local template fallback is intentionally disabled.' }, { status: 503 });

    const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
    const pendingAssets = ((assetRes.data ?? []) as AssetRow[]).filter((asset) => !['selected', 'approved'].includes(asset.status) || !asset.source_url).length;
    const nextVersion = Number(versionRes.data?.version_no || 0) + 1;

    const { data: run, error: runError } = await supabase.from('growth_website_runs').insert({
      website_id: websiteId,
      stage: 'source_build',
      provider: 'openai',
      model,
      prompt_version: 'website_build_v2_2',
      input_json: {
        direction_id: directionRes.data.id,
        reference_ids: (referenceRes.data ?? []).map((row: any) => row.id),
        section_ids: (sectionRes.data ?? []).map((row: any) => row.id),
        asset_ids: (assetRes.data ?? []).map((row: any) => row.id),
      },
      status: 'started',
    }).select('id').single();
    if (runError) throw new Error(runError.message);
    runId = run.id;

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model,
      input: buildPrompt(siteRes.data, briefRes.data, directionRes.data, referenceRes.data ?? [], sectionRes.data ?? [], (assetRes.data ?? []) as AssetRow[]),
    });
    const result = BuildSchema.parse(extractJson(response.output_text || ''));
    validateFiles(result);

    const snapshot = {
      format: 'static_v1',
      build_summary: result.build_summary,
      pending_asset_count: pendingAssets,
      files: result.files,
      source_direction_id: directionRes.data.id,
      source_reference_ids: (referenceRes.data ?? []).map((row: any) => row.id),
      source_section_ids: (sectionRes.data ?? []).map((row: any) => row.id),
      generated_at: new Date().toISOString(),
    };

    const { data: version, error: versionError } = await supabase.from('growth_website_versions').insert({
      website_id: websiteId,
      version_no: nextVersion,
      label: pendingAssets ? `v${nextVersion} layout preview · ${pendingAssets} visual asset${pendingAssets === 1 ? '' : 's'} pending` : `v${nextVersion} complete source preview`,
      source_snapshot: snapshot,
      change_summary: result.build_summary,
      status: pendingAssets ? 'draft_incomplete' : 'draft',
    }).select('id,version_no,label,status').single();
    if (versionError) throw new Error(versionError.message);

    await supabase.from('growth_website_runs').update({
      status: 'completed',
      output_json: { version_id: version.id, version_no: version.version_no, pending_asset_count: pendingAssets, build_summary: result.build_summary },
      completed_at: new Date().toISOString(),
    }).eq('id', runId);

    return Response.json({ version, pending_asset_count: pendingAssets, build_summary: result.build_summary });
  } catch (error) {
    console.error(error);
    if (supabase && runId) {
      await supabase.from('growth_website_runs').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Build failed.', completed_at: new Date().toISOString() }).eq('id', runId);
    }
    return Response.json({ error: error instanceof Error ? error.message : 'Website build failed.' }, { status: 500 });
  }
}
