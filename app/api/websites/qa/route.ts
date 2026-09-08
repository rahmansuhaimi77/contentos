import OpenAI from 'openai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 120;

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

const InputSchema = z.object({ websiteId: z.string().uuid(), versionId: z.string().uuid() });
const FindingSchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'blocker']),
  checkpoint: z.string().min(1),
  notes: z.string().min(1),
  device: z.enum(['all', 'mobile', 'desktop']),
});
const CategorySchema = z.object({
  score: z.number().min(0).max(100),
  status: z.enum(['pass', 'warn', 'fail']),
  notes: z.string(),
  findings: z.array(FindingSchema).max(12),
});
const VisualQaSchema = z.object({
  summary: z.string(),
  categories: z.object({
    visual_hierarchy: CategorySchema,
    composition_spacing: CategorySchema,
    crop_overflow: CategorySchema,
    typography_readability: CategorySchema,
    brand_specificity: CategorySchema,
    copy_authenticity: CategorySchema,
    conversion_clarity: CategorySchema,
    mobile_quality: CategorySchema,
  }),
});

type VisualQa = z.infer<typeof VisualQaSchema>;

type PsiRun = {
  strategy: 'mobile' | 'desktop';
  scores: { performance: number; accessibility: number; seo: number; best_practices: number };
  screenshot: string;
  audits: Record<string, any>;
  fetchTime: string | null;
};

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

function extractJson(text: string) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Visual QA model did not return JSON.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function score100(category: any) {
  const score = category?.score;
  return typeof score === 'number' ? Math.round(score * 100) : 0;
}

async function runPageSpeed(url: string, strategy: 'mobile' | 'desktop'): Promise<PsiRun> {
  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('strategy', strategy);
  for (const category of ['performance', 'accessibility', 'seo', 'best-practices']) endpoint.searchParams.append('category', category);
  if (process.env.PAGESPEED_API_KEY) endpoint.searchParams.set('key', process.env.PAGESPEED_API_KEY);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch(endpoint, { signal: controller.signal, cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || `PageSpeed ${strategy} run failed (${response.status}).`);
    if (payload?.lighthouseResult?.runtimeError?.code) {
      throw new Error(`Lighthouse ${strategy} render failed: ${payload.lighthouseResult.runtimeError.message || payload.lighthouseResult.runtimeError.code}`);
    }

    const lighthouse = payload?.lighthouseResult;
    const screenshot = lighthouse?.audits?.['final-screenshot']?.details?.data;
    if (!lighthouse || typeof screenshot !== 'string' || !screenshot.startsWith('data:image/')) {
      throw new Error(`PageSpeed ${strategy} run returned no rendered screenshot evidence.`);
    }

    return {
      strategy,
      scores: {
        performance: score100(lighthouse.categories?.performance),
        accessibility: score100(lighthouse.categories?.accessibility),
        seo: score100(lighthouse.categories?.seo),
        best_practices: score100(lighthouse.categories?.['best-practices']),
      },
      screenshot,
      audits: lighthouse.audits || {},
      fetchTime: payload?.analysisUTCTimestamp || lighthouse?.fetchTime || null,
    };
  } finally {
    clearTimeout(timer);
  }
}

function previewUrlIsAllowed(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'vercel.app' || url.hostname.endsWith('.vercel.app'));
  } catch {
    return false;
  }
}

function visibleText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 14_000);
}

async function fetchRenderedHtml(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store', redirect: 'follow' });
    if (!response.ok) throw new Error(`Preview returned HTTP ${response.status}.`);
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html')) throw new Error('Preview URL did not return HTML.');
    const html = (await response.text()).slice(0, 300_000);
    return { html, text: visibleText(html) };
  } finally {
    clearTimeout(timer);
  }
}

function compactAudits(audits: Record<string, any>) {
  const ids = [
    'viewport', 'color-contrast', 'image-alt', 'link-name', 'button-name', 'heading-order',
    'tap-targets', 'font-size', 'uses-responsive-images', 'uses-optimized-images',
    'modern-image-formats', 'largest-contentful-paint', 'cumulative-layout-shift',
    'total-blocking-time', 'speed-index', 'document-title', 'meta-description',
  ];
  return ids.map((id) => {
    const audit = audits[id];
    if (!audit) return null;
    return { id, score: audit.score, displayValue: audit.displayValue || '', title: audit.title || '', explanation: audit.explanation || '' };
  }).filter(Boolean);
}

function qaPrompt(site: any, brief: any, direction: any, text: string, mobile: PsiRun, desktop: PsiRun) {
  return `You are the senior visual QA reviewer for a premium website studio. Judge the ACTUALLY RENDERED preview, not the production plan.

BUSINESS TRUTH
${JSON.stringify({
    name: site.business_name,
    summary: brief.business_summary,
    primary_goal: brief.primary_goal,
    audience: brief.audience,
    offer: brief.offer,
    proof: brief.proof,
    voice: brief.voice,
    avoid: brief.avoid,
    verified_facts: brief.verified_facts,
  })}

APPROVED ART DIRECTION
${JSON.stringify({
    style_name: direction.style_name,
    creative_concept: direction.creative_concept,
    rationale: direction.rationale,
    mood: direction.mood,
    palette: direction.palette,
    typography: direction.typography,
    visual_language: direction.visual_language,
    composition_rules: direction.composition_rules,
    anti_patterns: direction.anti_patterns,
  })}

VISIBLE PAGE TEXT
${text}

LIGHTHOUSE MOBILE
${JSON.stringify({ scores: mobile.scores, selected_audits: compactAudits(mobile.audits) })}

LIGHTHOUSE DESKTOP
${JSON.stringify({ scores: desktop.scores, selected_audits: compactAudits(desktop.audits) })}

You will also receive a MOBILE screenshot followed by a DESKTOP screenshot.

Review rules:
- Be strict. This is a release-quality gate, not encouragement.
- Flag half-cut subjects, uncontrolled cropping, overflow, clipped text, awkward wrapping, broken alignment, inconsistent radii/spacing, weak contrast and illegible text.
- Judge whether the hero communicates the business and CTA within roughly five seconds.
- Detect repeated card-grid/template patterns and generic AI aesthetics. A site that could be relabeled for ten unrelated businesses should score poorly on brand_specificity.
- Detect agency-sounding copy, vague filler, generic claims and wording that does not sound like the business speaking to its customer.
- Do not penalize the design merely for being simple. Penalize lack of intentional hierarchy, specificity, trust or composition.
- Mobile must feel deliberately composed, not merely stacked.
- A BLOCKER means the preview is materially broken, misleading, unusable, or has a severe crop/overflow/readability defect. HIGH means it should not ship without correction.
- Scores are 0-100. 90+ excellent, 85-89 release-quality with minor polish, 75-84 needs revision, below 75 materially weak.

Return ONLY valid JSON:
{
  "summary":"...",
  "categories":{
    "visual_hierarchy":{"score":0,"status":"pass|warn|fail","notes":"...","findings":[]},
    "composition_spacing":{"score":0,"status":"pass|warn|fail","notes":"...","findings":[]},
    "crop_overflow":{"score":0,"status":"pass|warn|fail","notes":"...","findings":[]},
    "typography_readability":{"score":0,"status":"pass|warn|fail","notes":"...","findings":[]},
    "brand_specificity":{"score":0,"status":"pass|warn|fail","notes":"...","findings":[]},
    "copy_authenticity":{"score":0,"status":"pass|warn|fail","notes":"...","findings":[]},
    "conversion_clarity":{"score":0,"status":"pass|warn|fail","notes":"...","findings":[]},
    "mobile_quality":{"score":0,"status":"pass|warn|fail","notes":"...","findings":[]}
  }
}

Every finding must be {"severity":"low|medium|high|blocker","checkpoint":"short defect name","notes":"specific evidence and correction","device":"all|mobile|desktop"}.`;
}

function severityForScore(score: number, category: string) {
  if (category === 'accessibility' && score < 70) return 'high';
  if (score < 60) return 'high';
  if (score < 80) return 'medium';
  if (score < 90) return 'low';
  return 'low';
}

function statusForScore(score: number, threshold = 85) {
  return score >= threshold ? 'pass' : 'fail';
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export async function POST(req: Request) {
  let runId = '';
  let supabase: any = null;
  try {
    const auth = await getAuthenticatedClient(req);
    if (!auth) return Response.json({ error: 'Please sign in before running rendered QA.' }, { status: 401 });
    supabase = auth.supabase;

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    const { websiteId, versionId } = parsed.data;

    const [siteRes, briefRes, directionRes, versionRes, assetRes, deploymentRes] = await Promise.all([
      supabase.from('growth_websites').select('id,business_name,slug').eq('id', websiteId).maybeSingle(),
      supabase.from('growth_website_briefs').select('business_summary,primary_goal,audience,offer,proof,voice,avoid,verified_facts,status').eq('website_id', websiteId).maybeSingle(),
      supabase.from('growth_website_directions').select('style_name,creative_concept,rationale,mood,palette,typography,visual_language,composition_rules,anti_patterns').eq('website_id', websiteId).eq('status', 'approved').limit(1).maybeSingle(),
      supabase.from('growth_website_versions').select('id,website_id,version_no,label,source_snapshot,preview_url,status').eq('id', versionId).eq('website_id', websiteId).maybeSingle(),
      supabase.from('growth_website_assets').select('id,status,source_url').eq('website_id', websiteId),
      supabase.from('growth_website_deployments').select('id,provider,environment,url,status').eq('website_id', websiteId).eq('version_id', versionId).eq('environment', 'preview').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const firstError = siteRes.error || briefRes.error || directionRes.error || versionRes.error || assetRes.error || deploymentRes.error;
    if (firstError) throw new Error(firstError.message);
    if (!siteRes.data || !briefRes.data || !directionRes.data || !versionRes.data) return Response.json({ error: 'Website production state is incomplete.' }, { status: 404 });
    if (!versionRes.data.preview_url || !deploymentRes.data) return Response.json({ error: 'Deploy this exact version to a Vercel preview before rendered QA.' }, { status: 409 });
    if (deploymentRes.data.provider !== 'vercel' || deploymentRes.data.environment !== 'preview' || deploymentRes.data.url !== versionRes.data.preview_url) {
      return Response.json({ error: 'QA requires the recorded Vercel preview for this exact version.' }, { status: 409 });
    }
    if (!previewUrlIsAllowed(versionRes.data.preview_url)) return Response.json({ error: 'Rendered QA only accepts Website Studio Vercel preview URLs.' }, { status: 409 });
    if (!process.env.OPENAI_API_KEY) return Response.json({ error: 'Rendered visual QA requires an OpenAI API connection.' }, { status: 503 });

    const pendingAssets = (assetRes.data ?? []).filter((asset: any) => !['selected', 'approved'].includes(asset.status) || !asset.source_url).length;
    const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6-luna';

    const { data: run, error: runError } = await supabase.from('growth_website_runs').insert({
      website_id: websiteId,
      stage: 'rendered_qa',
      provider: 'pagespeed+openai',
      model,
      prompt_version: 'website_rendered_qa_v2_3',
      input_json: { version_id: versionId, preview_url: versionRes.data.preview_url, pending_asset_count: pendingAssets },
      status: 'started',
    }).select('id').single();
    if (runError) throw new Error(runError.message);
    runId = run.id;

    const [mobile, desktop, page] = await Promise.all([
      runPageSpeed(versionRes.data.preview_url, 'mobile'),
      runPageSpeed(versionRes.data.preview_url, 'desktop'),
      fetchRenderedHtml(versionRes.data.preview_url),
    ]);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: qaPrompt(siteRes.data, briefRes.data, directionRes.data, page.text, mobile, desktop) },
          { type: 'input_text', text: 'MOBILE RENDERED SCREENSHOT' },
          { type: 'input_image', image_url: mobile.screenshot },
          { type: 'input_text', text: 'DESKTOP RENDERED SCREENSHOT' },
          { type: 'input_image', image_url: desktop.screenshot },
        ],
      }] as any,
    });

    const visual: VisualQa = VisualQaSchema.parse(extractJson(response.output_text || ''));
    const categoryEntries = Object.entries(visual.categories) as Array<[keyof VisualQa['categories'], z.infer<typeof CategorySchema>]>;

    const visualAverage = average([
      visual.categories.visual_hierarchy.score,
      visual.categories.composition_spacing.score,
      visual.categories.crop_overflow.score,
      visual.categories.typography_readability.score,
      visual.categories.brand_specificity.score,
      visual.categories.mobile_quality.score,
    ]);
    const contentAverage = average([visual.categories.copy_authenticity.score, visual.categories.conversion_clarity.score]);
    const accessibilityScore = Math.min(mobile.scores.accessibility, desktop.scores.accessibility);
    const performanceScore = Math.min(mobile.scores.performance, desktop.scores.performance);
    const seoScore = Math.min(mobile.scores.seo, desktop.scores.seo);
    const bestPracticesScore = Math.min(mobile.scores.best_practices, desktop.scores.best_practices);
    const overall = Math.round(
      visualAverage * 0.55 +
      contentAverage * 0.15 +
      accessibilityScore * 0.12 +
      performanceScore * 0.08 +
      seoScore * 0.05 +
      bestPracticesScore * 0.05,
    );

    const checks: any[] = [];
    for (const [category, result] of categoryEntries) {
      checks.push({
        website_id: websiteId,
        version_id: versionId,
        category: 'visual',
        checkpoint: category,
        device: category === 'mobile_quality' ? 'mobile' : 'all',
        severity: result.status === 'fail' ? (result.score < 70 ? 'high' : 'medium') : 'low',
        status: result.status === 'pass' ? 'pass' : 'fail',
        score: result.score,
        notes: result.notes,
        evidence_url: versionRes.data.preview_url,
        details: { source: 'vision', findings: result.findings },
      });
      for (const finding of result.findings) {
        checks.push({
          website_id: websiteId,
          version_id: versionId,
          category: 'visual_finding',
          checkpoint: finding.checkpoint,
          device: finding.device,
          severity: finding.severity,
          status: 'fail',
          score: null,
          notes: finding.notes,
          evidence_url: versionRes.data.preview_url,
          details: { parent_category: category, source: 'vision' },
        });
      }
    }

    for (const run of [mobile, desktop]) {
      for (const [category, score] of Object.entries(run.scores)) {
        checks.push({
          website_id: websiteId,
          version_id: versionId,
          category: 'lighthouse',
          checkpoint: category,
          device: run.strategy,
          severity: severityForScore(score, category),
          status: statusForScore(score, category === 'performance' ? 70 : 85),
          score,
          notes: `${prettyMetric(category)} Lighthouse score: ${score}/100.`,
          evidence_url: versionRes.data.preview_url,
          details: { source: 'pagespeed', fetch_time: run.fetchTime },
        });
      }
    }

    const criticalAuditIds = ['viewport', 'color-contrast', 'image-alt', 'link-name', 'button-name', 'heading-order', 'tap-targets', 'document-title', 'meta-description'];
    for (const run of [mobile, desktop]) {
      for (const auditId of criticalAuditIds) {
        const audit = run.audits[auditId];
        if (!audit || audit.score === null || audit.score === 1 || audit.scoreDisplayMode === 'notApplicable') continue;
        const severe = ['viewport', 'color-contrast', 'image-alt', 'link-name', 'button-name'].includes(auditId);
        checks.push({
          website_id: websiteId,
          version_id: versionId,
          category: 'technical_finding',
          checkpoint: auditId,
          device: run.strategy,
          severity: severe ? 'high' : 'medium',
          status: 'fail',
          score: typeof audit.score === 'number' ? Math.round(audit.score * 100) : null,
          notes: `${audit.title || auditId}${audit.displayValue ? ` — ${audit.displayValue}` : ''}`,
          evidence_url: versionRes.data.preview_url,
          details: { source: 'pagespeed', explanation: audit.explanation || '', description: audit.description || '' },
        });
      }
    }

    if (pendingAssets > 0 || /data-visual-pending=["']true["']/i.test(page.html)) {
      checks.push({
        website_id: websiteId,
        version_id: versionId,
        category: 'release_gate',
        checkpoint: 'pending_visual_assets',
        device: 'all',
        severity: 'blocker',
        status: 'fail',
        score: 0,
        notes: `${pendingAssets || 'One or more'} planned visual asset${pendingAssets === 1 ? '' : 's'} are still pending. Layout QA may continue, but this version cannot be released.`,
        evidence_url: versionRes.data.preview_url,
        details: { pending_asset_count: pendingAssets },
      });
    }

    const highOrBlocker = checks.filter((check) => check.status === 'fail' && ['high', 'blocker'].includes(check.severity)).length;
    const qaStatus = overall >= 85 && highOrBlocker === 0 && pendingAssets === 0 ? 'pass' : 'needs_fix';

    checks.push({
      website_id: websiteId,
      version_id: versionId,
      category: 'release_gate',
      checkpoint: 'overall_quality',
      device: 'all',
      severity: qaStatus === 'pass' ? 'low' : 'high',
      status: qaStatus === 'pass' ? 'pass' : 'fail',
      score: overall,
      notes: qaStatus === 'pass'
        ? `Rendered QA passed at ${overall}/100 with no high/blocker findings. Human release approval is still required.`
        : `Rendered QA scored ${overall}/100 with ${highOrBlocker} high/blocker finding${highOrBlocker === 1 ? '' : 's'}. Fix and regenerate before release.`,
      evidence_url: versionRes.data.preview_url,
      details: { threshold: 85, high_or_blocker_count: highOrBlocker },
    });

    const { error: deleteError } = await supabase.from('growth_website_qa_checks').delete().eq('version_id', versionId);
    if (deleteError) throw new Error(deleteError.message);
    const { error: checkError } = await supabase.from('growth_website_qa_checks').insert(checks);
    if (checkError) throw new Error(checkError.message);

    const summary = {
      overall_score: overall,
      status: qaStatus,
      visual_score: Math.round(visualAverage),
      content_conversion_score: Math.round(contentAverage),
      lighthouse: { mobile: mobile.scores, desktop: desktop.scores },
      high_or_blocker_count: highOrBlocker,
      pending_asset_count: pendingAssets,
      visual_summary: visual.summary,
    };

    const { error: versionUpdateError } = await supabase.from('growth_website_versions').update({
      qa_score: overall,
      qa_status: qaStatus,
      qa_summary: summary,
      qa_completed_at: new Date().toISOString(),
      status: qaStatus === 'pass' ? 'qa_pass' : 'qa_needs_fix',
    }).eq('id', versionId);
    if (versionUpdateError) throw new Error(versionUpdateError.message);

    await supabase.from('growth_website_runs').update({
      status: 'completed',
      output_json: summary,
      completed_at: new Date().toISOString(),
    }).eq('id', runId);

    return Response.json({ ...summary, checks_created: checks.length, release_eligible: false });
  } catch (error) {
    console.error(error);
    if (supabase && runId) {
      await supabase.from('growth_website_runs').update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Rendered QA failed.',
        completed_at: new Date().toISOString(),
      }).eq('id', runId);
    }
    return Response.json({ error: error instanceof Error ? error.message : 'Rendered QA failed.' }, { status: 500 });
  }
}

function prettyMetric(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
