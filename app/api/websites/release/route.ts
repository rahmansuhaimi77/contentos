import { z } from 'zod';
import {
  getWebsiteReleaseAuth,
  normalizeUrl,
  productionAliases,
  ReleaseSnapshotSchema,
  snapshotFingerprint,
  sleep,
  vercelApi,
  verifyLiveSnapshot,
  websiteProjectName,
} from '@/lib/website-release';

export const runtime = 'nodejs';
export const maxDuration = 60;

const InputSchema = z.object({ releaseId: z.string().uuid() });

function deploymentId(row: any) {
  return String(row?.uid || row?.id || '');
}

export async function POST(req: Request) {
  try {
    const auth = await getWebsiteReleaseAuth(req);
    if (!auth) return Response.json({ error: 'Please sign in before releasing a website.' }, { status: 401 });
    const supabase = auth.supabase;

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    const { releaseId } = parsed.data;

    const vercelToken = process.env.VERCEL_TOKEN;
    const teamId = process.env.VERCEL_TEAM_ID;
    if (!vercelToken || !teamId) {
      return Response.json({
        error: 'Production release is not connected yet. Configure VERCEL_TOKEN and VERCEL_TEAM_ID in the ContentOS server environment. Nothing was promoted.',
        code: 'vercel_not_configured',
      }, { status: 503 });
    }

    const { data: release, error: releaseError } = await supabase.from('growth_website_releases')
      .select('id,website_id,version_id,preview_deployment_id,status,source_fingerprint,approval_note,approved_at')
      .eq('id', releaseId).maybeSingle();
    if (releaseError) throw new Error(releaseError.message);
    if (!release) return Response.json({ error: 'Release candidate not found.' }, { status: 404 });
    if (release.status !== 'approved') return Response.json({ error: `Only an approved release candidate can be promoted. Current status: ${release.status}.` }, { status: 409 });

    const [siteRes, versionRes, blockersRes, previewRes] = await Promise.all([
      supabase.from('growth_websites').select('id,business_name,slug').eq('id', release.website_id).maybeSingle(),
      supabase.from('growth_website_versions')
        .select('id,website_id,version_no,status,qa_status,qa_score,qa_completed_at,source_snapshot,preview_url')
        .eq('id', release.version_id).eq('website_id', release.website_id).maybeSingle(),
      supabase.from('growth_website_qa_checks').select('id').eq('version_id', release.version_id).eq('status', 'fail').in('severity', ['high', 'blocker']),
      supabase.from('growth_website_deployments')
        .select('id,deployment_id,url,status,created_at')
        .eq('website_id', release.website_id)
        .eq('version_id', release.version_id)
        .eq('environment', 'preview')
        .eq('deployment_id', release.preview_deployment_id)
        .limit(1).maybeSingle(),
    ]);
    const firstError = siteRes.error || versionRes.error || blockersRes.error || previewRes.error;
    if (firstError) throw new Error(firstError.message);
    if (!siteRes.data || !versionRes.data || !previewRes.data) return Response.json({ error: 'Release prerequisites could not be resolved.' }, { status: 409 });

    const version = versionRes.data;
    const snapshot = ReleaseSnapshotSchema.parse(version.source_snapshot);
    const fingerprint = snapshotFingerprint(snapshot);
    if (fingerprint !== release.source_fingerprint) return Response.json({ error: 'The approved source snapshot changed after approval. Release is blocked.' }, { status: 409 });
    if (version.status !== 'approved' || version.qa_status !== 'pass' || Number(version.qa_score || 0) < 85 || !version.qa_completed_at) {
      return Response.json({ error: 'The source version is no longer release-eligible.' }, { status: 409 });
    }
    if (snapshot.pending_asset_count > 0) return Response.json({ error: 'Visual assets are pending.' }, { status: 409 });
    if ((blockersRes.data ?? []).length) return Response.json({ error: 'High or blocker QA findings remain.' }, { status: 409 });

    const projectName = websiteProjectName(siteRes.data.slug);
    const teamQuery = `teamId=${encodeURIComponent(teamId)}`;
    const projectLookup = await vercelApi(`/v9/projects/${encodeURIComponent(projectName)}?${teamQuery}`, vercelToken);
    if (!projectLookup.response.ok) {
      return Response.json({ error: projectLookup.payload?.error?.message || 'The dedicated Website Studio Vercel project could not be resolved.' }, { status: 409 });
    }
    const projectId = String(projectLookup.payload?.id || '');
    if (!projectId) return Response.json({ error: 'Vercel project ID is missing.' }, { status: 409 });

    const previewDeployment = await vercelApi(`/v13/deployments/${encodeURIComponent(release.preview_deployment_id)}?${teamQuery}`, vercelToken);
    if (!previewDeployment.response.ok) return Response.json({ error: 'The QA-tested Vercel preview deployment no longer exists.' }, { status: 409 });
    const remoteDeploymentId = deploymentId(previewDeployment.payload);
    const readyState = String(previewDeployment.payload?.readyState || previewDeployment.payload?.state || previewDeployment.payload?.status || '').toUpperCase();
    if (remoteDeploymentId !== release.preview_deployment_id) return Response.json({ error: 'Vercel deployment identity mismatch.' }, { status: 409 });
    if (String(previewDeployment.payload?.name || '') !== projectName) return Response.json({ error: 'Preview belongs to a different Vercel project.' }, { status: 409 });
    if (readyState !== 'READY') return Response.json({ error: `Preview deployment is not READY (${readyState || 'unknown'}).` }, { status: 409 });
    const remoteMeta = previewDeployment.payload?.meta || {};
    if (remoteMeta.version_id && String(remoteMeta.version_id) !== release.version_id) return Response.json({ error: 'Vercel preview metadata does not match the approved Website Studio version.' }, { status: 409 });

    let previousProductionDeploymentId: string | null = null;
    const currentProduction = await vercelApi(`/v6/deployments?projectId=${encodeURIComponent(projectId)}&target=production&state=READY&limit=1&${teamQuery}`, vercelToken);
    if (currentProduction.response.ok) {
      const current = Array.isArray(currentProduction.payload?.deployments) ? currentProduction.payload.deployments[0] : null;
      const currentId = deploymentId(current);
      if (currentId && currentId !== release.preview_deployment_id) previousProductionDeploymentId = currentId;
    }

    const { error: promotingError } = await supabase.from('growth_website_releases').update({
      status: 'promoting',
      project_id: projectId,
      project_name: projectName,
      previous_production_deployment_id: previousProductionDeploymentId,
      production_deployment_id: release.preview_deployment_id,
    }).eq('id', release.id);
    if (promotingError) throw new Error(promotingError.message);

    const promote = await vercelApi(`/v10/projects/${encodeURIComponent(projectId)}/promote/${encodeURIComponent(release.preview_deployment_id)}?${teamQuery}`, vercelToken, { method: 'POST', body: '{}' });
    if (!promote.response.ok && promote.response.status !== 201 && promote.response.status !== 202) {
      await supabase.from('growth_website_releases').update({ status: 'failed', smoke_status: 'pending', smoke_details: { stage: 'promotion', error: promote.payload?.error?.message || `Vercel promote failed (${promote.response.status}).` } }).eq('id', release.id);
      return Response.json({ error: promote.payload?.error?.message || `Vercel promote failed (${promote.response.status}).` }, { status: 502 });
    }

    await sleep(1200);
    const promotedDeployment = await vercelApi(`/v13/deployments/${encodeURIComponent(release.preview_deployment_id)}?${teamQuery}`, vercelToken);
    const aliases = productionAliases(promotedDeployment.payload, projectName);
    const defaultProductionUrl = `https://${projectName}.vercel.app`;
    const customAlias = aliases.find((url) => !url.endsWith('.vercel.app'));
    const productionUrl = normalizeUrl(customAlias || defaultProductionUrl);

    const { data: oldLive } = await supabase.from('growth_website_releases')
      .select('id').eq('website_id', release.website_id).eq('status', 'live').neq('id', release.id).limit(1).maybeSingle();
    if (oldLive?.id) await supabase.from('growth_website_releases').update({ status: 'superseded' }).eq('id', oldLive.id);

    const { error: prodRecordError } = await supabase.from('growth_website_deployments').insert({
      website_id: release.website_id,
      version_id: release.version_id,
      provider: 'vercel',
      environment: 'production',
      deployment_id: release.preview_deployment_id,
      url: productionUrl,
      status: 'promoted',
      promoted_at: new Date().toISOString(),
    });
    if (prodRecordError) throw new Error(`Vercel promotion succeeded but the production deployment record failed: ${prodRecordError.message}`);

    let smoke = await verifyLiveSnapshot(productionUrl, snapshot);
    for (let attempt = 0; !smoke.pass && attempt < 2; attempt += 1) {
      await sleep(1800);
      smoke = await verifyLiveSnapshot(productionUrl, snapshot);
    }

    const now = new Date().toISOString();
    if (!smoke.pass) {
      await supabase.from('growth_website_releases').update({
        status: 'smoke_failed',
        production_url: productionUrl,
        production_aliases: aliases,
        promoted_at: now,
        smoke_status: 'fail',
        smoke_details: { exact_source_match: false, files: smoke.files },
        smoke_checked_at: now,
      }).eq('id', release.id);
      await supabase.from('growth_website_deployments').update({ status: 'smoke_failed' })
        .eq('website_id', release.website_id).eq('version_id', release.version_id).eq('environment', 'production').eq('deployment_id', release.preview_deployment_id);
      return Response.json({
        status: 'smoke_failed',
        production_url: productionUrl,
        aliases,
        rollback_available: Boolean(previousProductionDeploymentId),
        previous_production_deployment_id: previousProductionDeploymentId,
        smoke,
        message: 'Vercel promotion completed, but the live files did not match the QA-tested snapshot. Production is flagged and rollback is recommended.',
      }, { status: 409 });
    }

    const { error: liveError } = await supabase.from('growth_website_releases').update({
      status: 'live',
      production_url: productionUrl,
      production_aliases: aliases,
      promoted_at: now,
      smoke_status: 'pass',
      smoke_details: { exact_source_match: true, files: smoke.files },
      smoke_checked_at: now,
    }).eq('id', release.id);
    if (liveError) throw new Error(liveError.message);

    await supabase.from('growth_website_deployments').update({ status: 'live' })
      .eq('website_id', release.website_id).eq('version_id', release.version_id).eq('environment', 'production').eq('deployment_id', release.preview_deployment_id);
    const { error: versionLiveError } = await supabase.from('growth_website_versions').update({ status: 'production' }).eq('id', release.version_id);
    if (versionLiveError) throw new Error(`Production is live but version state update failed: ${versionLiveError.message}`);

    return Response.json({
      status: 'live',
      production_url: productionUrl,
      aliases,
      deployment_id: release.preview_deployment_id,
      source_fingerprint: fingerprint,
      smoke,
      rollback_available: Boolean(previousProductionDeploymentId),
      previous_production_deployment_id: previousProductionDeploymentId,
      message: 'Exact QA-tested preview artifact promoted and verified in production. No rebuild occurred.',
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : 'Production release failed.' }, { status: 500 });
  }
}
