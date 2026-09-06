import { z } from 'zod';
import { getWebsiteReleaseAuth, ReleaseSnapshotSchema, sleep, vercelApi, verifyLiveSnapshot } from '@/lib/website-release';

export const runtime = 'nodejs';
export const maxDuration = 60;

const InputSchema = z.object({
  releaseId: z.string().uuid(),
  reason: z.string().max(500).optional().default('Website Studio rollback after production release'),
});

export async function POST(req: Request) {
  try {
    const auth = await getWebsiteReleaseAuth(req);
    if (!auth) return Response.json({ error: 'Please sign in before rolling back a website.' }, { status: 401 });
    const supabase = auth.supabase;

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    const { releaseId, reason } = parsed.data;

    const vercelToken = process.env.VERCEL_TOKEN;
    const teamId = process.env.VERCEL_TEAM_ID;
    if (!vercelToken || !teamId) return Response.json({ error: 'Vercel release credentials are not configured. Nothing was rolled back.' }, { status: 503 });

    const { data: release, error: releaseError } = await supabase.from('growth_website_releases')
      .select('id,website_id,version_id,status,project_id,project_name,production_url,production_deployment_id,previous_production_deployment_id')
      .eq('id', releaseId).maybeSingle();
    if (releaseError) throw new Error(releaseError.message);
    if (!release) return Response.json({ error: 'Release not found.' }, { status: 404 });
    if (!['live', 'smoke_failed'].includes(release.status)) return Response.json({ error: `Rollback is not available from status ${release.status}.` }, { status: 409 });
    if (!release.project_id || !release.previous_production_deployment_id) {
      return Response.json({ error: 'No previous production deployment was captured for this release, so automated rollback is unavailable.' }, { status: 409 });
    }

    const { data: previousRelease, error: previousReleaseError } = await supabase.from('growth_website_releases')
      .select('id,version_id,production_deployment_id,production_url,status')
      .eq('website_id', release.website_id)
      .eq('production_deployment_id', release.previous_production_deployment_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previousReleaseError) throw new Error(previousReleaseError.message);
    if (!previousRelease?.version_id) {
      return Response.json({ error: 'The previous Vercel deployment exists, but it predates Website Studio release records. Automated rollback is intentionally blocked because the restored artifact cannot be verified.' }, { status: 409 });
    }

    const { data: previousVersion, error: previousVersionError } = await supabase.from('growth_website_versions')
      .select('id,status,source_snapshot')
      .eq('id', previousRelease.version_id).eq('website_id', release.website_id).maybeSingle();
    if (previousVersionError) throw new Error(previousVersionError.message);
    if (!previousVersion) return Response.json({ error: 'Previous release source snapshot is unavailable.' }, { status: 409 });
    const previousSnapshot = ReleaseSnapshotSchema.parse(previousVersion.source_snapshot);

    const teamQuery = `teamId=${encodeURIComponent(teamId)}`;
    const targetDeployment = await vercelApi(`/v13/deployments/${encodeURIComponent(release.previous_production_deployment_id)}?${teamQuery}`, vercelToken);
    if (!targetDeployment.response.ok) return Response.json({ error: 'Previous Vercel deployment can no longer be resolved.' }, { status: 409 });
    const targetState = String(targetDeployment.payload?.readyState || targetDeployment.payload?.state || targetDeployment.payload?.status || '').toUpperCase();
    if (targetState !== 'READY') return Response.json({ error: `Previous deployment is not READY (${targetState || 'unknown'}).` }, { status: 409 });
    if (release.project_name && String(targetDeployment.payload?.name || '') !== release.project_name) {
      return Response.json({ error: 'Rollback target belongs to a different Vercel project.' }, { status: 409 });
    }

    const rollback = await vercelApi(`/v1/projects/${encodeURIComponent(release.project_id)}/rollback/${encodeURIComponent(release.previous_production_deployment_id)}?description=${encodeURIComponent(reason)}&${teamQuery}`, vercelToken, { method: 'POST', body: '{}' });
    if (!rollback.response.ok && rollback.response.status !== 201) {
      return Response.json({ error: rollback.payload?.error?.message || `Vercel rollback failed (${rollback.response.status}).` }, { status: 502 });
    }

    const productionUrl = release.production_url || previousRelease.production_url || (release.project_name ? `https://${release.project_name}.vercel.app` : '');
    if (!productionUrl) return Response.json({ error: 'Rollback was requested, but no production URL is available for verification.' }, { status: 500 });

    await sleep(1200);
    let smoke = await verifyLiveSnapshot(productionUrl, previousSnapshot);
    for (let attempt = 0; !smoke.pass && attempt < 2; attempt += 1) {
      await sleep(1800);
      smoke = await verifyLiveSnapshot(productionUrl, previousSnapshot);
    }

    const now = new Date().toISOString();
    if (!smoke.pass) {
      await supabase.from('growth_website_releases').update({
        status: 'failed',
        rolled_back_at: now,
        smoke_status: 'fail',
        smoke_details: { stage: 'rollback_verification', target_deployment_id: release.previous_production_deployment_id, files: smoke.files },
      }).eq('id', release.id);
      return Response.json({
        status: 'rollback_verification_failed',
        production_url: productionUrl,
        target_deployment_id: release.previous_production_deployment_id,
        smoke,
        message: 'Vercel accepted the rollback, but the restored production files could not be verified against the previous Website Studio snapshot. Manual inspection is required.',
      }, { status: 409 });
    }

    const { error: currentReleaseError } = await supabase.from('growth_website_releases').update({
      status: 'rolled_back',
      rolled_back_at: now,
      smoke_status: 'pass',
      smoke_details: { stage: 'rollback_verified', target_deployment_id: release.previous_production_deployment_id, files: smoke.files },
    }).eq('id', release.id);
    if (currentReleaseError) throw new Error(currentReleaseError.message);

    const { error: restoreReleaseError } = await supabase.from('growth_website_releases').update({
      status: 'live',
      smoke_status: 'pass',
      production_url: productionUrl,
      smoke_checked_at: now,
    }).eq('id', previousRelease.id);
    if (restoreReleaseError) throw new Error(restoreReleaseError.message);

    await supabase.from('growth_website_versions').update({ status: 'approved' }).eq('id', release.version_id);
    await supabase.from('growth_website_versions').update({ status: 'production' }).eq('id', previousRelease.version_id);
    await supabase.from('growth_website_deployments').update({ status: 'rolled_back' })
      .eq('website_id', release.website_id).eq('version_id', release.version_id).eq('environment', 'production').eq('deployment_id', release.production_deployment_id);
    await supabase.from('growth_website_deployments').update({ status: 'live' })
      .eq('website_id', release.website_id).eq('version_id', previousRelease.version_id).eq('environment', 'production').eq('deployment_id', release.previous_production_deployment_id);

    return Response.json({
      status: 'rolled_back',
      production_url: productionUrl,
      restored_release_id: previousRelease.id,
      restored_version_id: previousRelease.version_id,
      restored_deployment_id: release.previous_production_deployment_id,
      smoke,
      message: 'Rollback completed and the restored live files match the previous Website Studio release snapshot.',
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : 'Rollback failed.' }, { status: 500 });
  }
}
