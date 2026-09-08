import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const runtime = 'nodejs';

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

const ScoresSchema = z.object({
  visual_hierarchy: z.number().min(0).max(100),
  composition_spacing: z.number().min(0).max(100),
  crop_overflow: z.number().min(0).max(100),
  typography_readability: z.number().min(0).max(100),
  brand_specificity: z.number().min(0).max(100),
  copy_authenticity: z.number().min(0).max(100),
  conversion_clarity: z.number().min(0).max(100),
  mobile_quality: z.number().min(0).max(100),
});

const InputSchema = z.object({
  websiteId: z.string().uuid(),
  versionId: z.string().uuid(),
  scores: ScoresSchema,
  notes: z.string().max(2000).optional().default(''),
  reviewedMobile: z.literal(true),
  reviewedDesktop: z.literal(true),
  noKnownHighBlockers: z.literal(true),
  noUncontrolledCropOrOverflow: z.literal(true),
  copyAndClaimsVerified: z.literal(true),
  primaryCtaTested: z.literal(true),
  confirmation: z.literal('I REVIEWED THIS EXACT PREVIEW'),
});

async function authenticated(req: Request) {
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

function categoryFor(key: string) {
  if (key === 'copy_authenticity') return 'copy';
  if (key === 'conversion_clarity') return 'conversion';
  if (key === 'mobile_quality') return 'responsive';
  return 'visual';
}

function severityFor(score: number) {
  if (score < 60) return 'high';
  if (score < 85) return 'medium';
  return 'low';
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function POST(req: Request) {
  let runId = '';
  let supabase: any = null;
  try {
    const auth = await authenticated(req);
    if (!auth) return Response.json({ error: 'Please sign in before recording manual rendered QA.' }, { status: 401 });
    supabase = auth.supabase;

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Complete every manual QA confirmation and score before submitting.', details: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;

    const [versionRes, deploymentRes] = await Promise.all([
      supabase.from('growth_website_versions')
        .select('id,website_id,version_no,label,status,preview_url,source_snapshot')
        .eq('id', input.versionId).eq('website_id', input.websiteId).maybeSingle(),
      supabase.from('growth_website_deployments')
        .select('id,provider,environment,deployment_id,url,status,created_at')
        .eq('website_id', input.websiteId)
        .eq('version_id', input.versionId)
        .eq('environment', 'preview')
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle(),
    ]);
    const firstError = versionRes.error || deploymentRes.error;
    if (firstError) throw new Error(firstError.message);
    if (!versionRes.data) return Response.json({ error: 'Source version not found.' }, { status: 404 });
    if (!versionRes.data.preview_url || !deploymentRes.data?.deployment_id) {
      return Response.json({ error: 'Deploy this exact version through Website Studio before manual QA.' }, { status: 409 });
    }
    if (deploymentRes.data.provider !== 'vercel' || deploymentRes.data.environment !== 'preview' || deploymentRes.data.url !== versionRes.data.preview_url) {
      return Response.json({ error: 'Manual QA must be tied to the exact recorded Website Studio Vercel preview.' }, { status: 409 });
    }

    const pendingAssets = Number(versionRes.data.source_snapshot?.pending_asset_count || 0);
    const scoreEntries = Object.entries(input.scores) as Array<[string, number]>;
    const overall = Math.round(average(scoreEntries.map(([, score]) => score)));
    const failedScores = scoreEntries.filter(([, score]) => score < 85);
    const qaStatus = overall >= 85 && failedScores.length === 0 && pendingAssets === 0 ? 'pass' : 'needs_fix';
    const now = new Date().toISOString();

    const { data: run, error: runError } = await supabase.from('growth_website_runs').insert({
      website_id: input.websiteId,
      stage: 'manual_rendered_qa',
      provider: 'human',
      model: 'operator-review',
      prompt_version: 'manual_rendered_qa_v1',
      input_json: {
        version_id: input.versionId,
        preview_url: versionRes.data.preview_url,
        preview_deployment_id: deploymentRes.data.deployment_id,
        reviewed_mobile: true,
        reviewed_desktop: true,
        confirmations: {
          no_known_high_blockers: true,
          no_uncontrolled_crop_or_overflow: true,
          copy_and_claims_verified: true,
          primary_cta_tested: true,
        },
        scores: input.scores,
      },
      status: 'started',
    }).select('id').single();
    if (runError) throw new Error(runError.message);
    runId = run.id;

    const checks = scoreEntries.map(([checkpoint, score]) => ({
      website_id: input.websiteId,
      version_id: input.versionId,
      category: categoryFor(checkpoint),
      checkpoint,
      device: checkpoint === 'mobile_quality' ? 'mobile' : 'all',
      severity: severityFor(score),
      status: score >= 85 ? 'pass' : 'fail',
      score,
      notes: `Manual rendered review score: ${score}/100.${input.notes ? ` Operator notes: ${input.notes}` : ''}`,
      evidence_url: versionRes.data.preview_url,
      details: {
        source: 'manual_operator',
        reviewed_by: auth.user.id,
        reviewed_at: now,
        preview_deployment_id: deploymentRes.data.deployment_id,
      },
    }));

    checks.push({
      website_id: input.websiteId,
      version_id: input.versionId,
      category: 'release',
      checkpoint: 'manual_exact_preview_confirmation',
      device: 'all',
      severity: pendingAssets > 0 ? 'blocker' : 'low',
      status: pendingAssets > 0 ? 'fail' : 'pass',
      score: pendingAssets > 0 ? 0 : 100,
      notes: pendingAssets > 0
        ? `${pendingAssets} visual asset requirement${pendingAssets === 1 ? '' : 's'} remain pending.`
        : 'Operator confirmed mobile + desktop review of the exact recorded preview, no known high/blocker issue, crop/overflow safety, verified copy/claims and a tested primary CTA.',
      evidence_url: versionRes.data.preview_url,
      details: {
        source: 'manual_operator',
        reviewed_by: auth.user.id,
        reviewed_at: now,
        confirmation: input.confirmation,
        preview_deployment_id: deploymentRes.data.deployment_id,
      },
    });

    const { error: deleteError } = await supabase.from('growth_website_qa_checks').delete().eq('version_id', input.versionId);
    if (deleteError) throw new Error(deleteError.message);
    const { error: checksError } = await supabase.from('growth_website_qa_checks').insert(checks);
    if (checksError) throw new Error(checksError.message);

    const summary = {
      status: qaStatus,
      overall_score: overall,
      mode: 'manual_operator',
      reviewed_mobile: true,
      reviewed_desktop: true,
      preview_url: versionRes.data.preview_url,
      preview_deployment_id: deploymentRes.data.deployment_id,
      scores: input.scores,
      high_or_blocker_count: pendingAssets > 0 ? 1 : 0,
      pending_asset_count: pendingAssets,
      operator_notes: input.notes,
      reviewed_by: auth.user.id,
      reviewed_at: now,
    };

    const { error: versionUpdateError } = await supabase.from('growth_website_versions').update({
      qa_score: overall,
      qa_status: qaStatus,
      qa_summary: summary,
      qa_completed_at: now,
      status: qaStatus === 'pass' ? 'qa_pass' : 'qa_needs_fix',
    }).eq('id', input.versionId);
    if (versionUpdateError) throw new Error(versionUpdateError.message);

    await supabase.from('growth_website_runs').update({
      status: 'completed',
      output_json: summary,
      completed_at: now,
    }).eq('id', runId);

    return Response.json({
      ...summary,
      checks_created: checks.length,
      release_eligible: false,
      message: qaStatus === 'pass'
        ? 'Manual rendered QA passed. Human release approval is still a separate next gate.'
        : 'Manual rendered QA recorded. Fix any category below 85 or pending assets before release.',
    });
  } catch (error) {
    console.error(error);
    if (supabase && runId) {
      await supabase.from('growth_website_runs').update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Manual rendered QA failed.',
        completed_at: new Date().toISOString(),
      }).eq('id', runId);
    }
    return Response.json({ error: error instanceof Error ? error.message : 'Manual rendered QA failed.' }, { status: 500 });
  }
}
