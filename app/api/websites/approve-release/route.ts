import { z } from 'zod';
import { getWebsiteReleaseAuth, ReleaseSnapshotSchema, snapshotFingerprint } from '@/lib/website-release';

export const runtime = 'nodejs';

const InputSchema = z.object({
  websiteId: z.string().uuid(),
  versionId: z.string().uuid(),
  approvalNote: z.string().max(600).optional().default(''),
});

export async function POST(req: Request) {
  try {
    const auth = await getWebsiteReleaseAuth(req);
    if (!auth) return Response.json({ error: 'Please sign in before approving a website release.' }, { status: 401 });
    const supabase = auth.supabase;

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    const { websiteId, versionId, approvalNote } = parsed.data;

    const [versionRes, blockersRes, existingCandidateRes] = await Promise.all([
      supabase.from('growth_website_versions')
        .select('id,website_id,version_no,label,status,qa_status,qa_score,qa_completed_at,preview_url,source_snapshot,approved_at')
        .eq('id', versionId).eq('website_id', websiteId).maybeSingle(),
      supabase.from('growth_website_qa_checks')
        .select('id,severity,status')
        .eq('version_id', versionId).eq('status', 'fail').in('severity', ['high', 'blocker']),
      supabase.from('growth_website_releases')
        .select('id,status,version_id')
        .eq('website_id', websiteId).in('status', ['approved', 'promoting', 'smoke_failed']).limit(1).maybeSingle(),
    ]);
    const firstError = versionRes.error || blockersRes.error || existingCandidateRes.error;
    if (firstError) throw new Error(firstError.message);
    if (!versionRes.data) return Response.json({ error: 'Source version not found.' }, { status: 404 });
    if (existingCandidateRes.data && existingCandidateRes.data.version_id !== versionId) {
      return Response.json({ error: 'Another release candidate is already open for this website. Finish, roll back, or supersede it before approving a new one.' }, { status: 409 });
    }

    const version = versionRes.data;
    const snapshot = ReleaseSnapshotSchema.parse(version.source_snapshot);
    if (version.qa_status !== 'pass' || Number(version.qa_score || 0) < 85 || !version.qa_completed_at) {
      return Response.json({ error: 'Rendered QA must pass at 85/100 or higher before human approval.' }, { status: 409 });
    }
    if ((blockersRes.data ?? []).length) return Response.json({ error: 'High or blocker QA findings remain open.' }, { status: 409 });
    if (snapshot.pending_asset_count > 0) return Response.json({ error: 'Visual assets are still pending.' }, { status: 409 });
    if (!version.preview_url) return Response.json({ error: 'This version has no recorded preview deployment.' }, { status: 409 });

    const { data: preview, error: previewError } = await supabase.from('growth_website_deployments')
      .select('id,deployment_id,url,status,created_at')
      .eq('website_id', websiteId)
      .eq('version_id', versionId)
      .eq('environment', 'preview')
      .eq('url', version.preview_url)
      .not('deployment_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previewError) throw new Error(previewError.message);
    if (!preview?.deployment_id) return Response.json({ error: 'The exact QA-tested preview deployment record could not be resolved.' }, { status: 409 });

    const approvedAt = new Date().toISOString();
    if (version.status !== 'approved') {
      const { error: approvalError } = await supabase.from('growth_website_versions').update({ status: 'approved', approved_at: approvedAt }).eq('id', versionId);
      if (approvalError) throw new Error(approvalError.message);
    }

    if (existingCandidateRes.data?.version_id === versionId) {
      const { data: existingRelease } = await supabase.from('growth_website_releases')
        .select('id,status,source_fingerprint,preview_deployment_id,approved_at')
        .eq('id', existingCandidateRes.data.id).single();
      return Response.json({ release: existingRelease, already_approved: true });
    }

    const fingerprint = snapshotFingerprint(snapshot);
    const { data: release, error: releaseError } = await supabase.from('growth_website_releases').insert({
      website_id: websiteId,
      version_id: versionId,
      preview_deployment_id: preview.deployment_id,
      source_fingerprint: fingerprint,
      status: 'approved',
      approval_note: approvalNote.trim(),
      smoke_status: 'pending',
      approved_at: approvedAt,
    }).select('id,website_id,version_id,preview_deployment_id,source_fingerprint,status,approval_note,approved_at').single();
    if (releaseError) throw new Error(releaseError.message);

    return Response.json({ release, already_approved: false, message: 'Release approved. Production still requires a separate explicit promotion action.' });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : 'Release approval failed.' }, { status: 500 });
  }
}
