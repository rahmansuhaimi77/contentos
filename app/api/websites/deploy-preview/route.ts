import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const runtime = 'nodejs';

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

const InputSchema = z.object({ websiteId: z.string().uuid(), versionId: z.string().uuid() });
const FileSchema = z.object({ path: z.string().min(1).max(180), content: z.string().min(1) });
const StaticV1Schema = z.object({
  format: z.literal('static_v1'),
  files: z.array(FileSchema).length(3),
  pending_asset_count: z.number().int().min(0).default(0),
}).passthrough();
const StaticBundleV2Schema = z.object({
  format: z.literal('static_bundle_v2'),
  files: z.array(FileSchema).min(1).max(64),
  pending_asset_count: z.number().int().min(0).default(0),
}).passthrough();

type PreviewFile = z.infer<typeof FileSchema>;

type PreviewSnapshot = {
  format: 'static_v1' | 'static_bundle_v2';
  files: PreviewFile[];
  pending_asset_count: number;
  [key: string]: unknown;
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

function safeRelativePath(path: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(path)) return false;
  if (path.startsWith('/') || path.includes('..') || path.includes('\\') || path.includes('//')) return false;
  return path.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

function normalizeSnapshot(value: unknown): PreviewSnapshot {
  const format = (value as any)?.format;
  const parsed = format === 'static_bundle_v2' ? StaticBundleV2Schema.parse(value) : StaticV1Schema.parse(value);
  const paths = new Set<string>();
  let totalBytes = 0;
  for (const file of parsed.files) {
    if (!safeRelativePath(file.path)) throw new Error(`Unsafe preview file path: ${file.path}`);
    if (paths.has(file.path)) throw new Error(`Duplicate preview file path: ${file.path}`);
    paths.add(file.path);
    const bytes = Buffer.byteLength(file.content, 'utf8');
    if (bytes > 350_000) throw new Error(`${file.path} exceeded the per-file preview size limit.`);
    totalBytes += bytes;
  }
  if (!paths.has('index.html')) throw new Error('Preview artifact must contain a root index.html.');
  if (totalBytes > 2_500_000) throw new Error('Preview artifact exceeded the total source size limit.');
  if (parsed.format === 'static_v1') {
    const required = new Set(['index.html', 'styles.css', 'script.js']);
    if (paths.size !== 3 || [...required].some((path) => !paths.has(path))) throw new Error('Legacy static_v1 preview is incomplete.');
  }
  return parsed as PreviewSnapshot;
}

function projectName(slug: string) {
  const cleaned = `ws-${slug}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
  return cleaned || 'website-studio-preview';
}

async function vercelRequest(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const text = await response.text();
  let payload: any = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }
  return { response, payload };
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedClient(req);
    if (!auth) return Response.json({ error: 'Please sign in before deploying a website preview.' }, { status: 401 });
    const supabase = auth.supabase;

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });

    const vercelToken = process.env.VERCEL_TOKEN;
    const teamId = process.env.VERCEL_TEAM_ID;
    if (!vercelToken || !teamId) {
      return Response.json({
        error: 'Preview deployment is not connected yet. Configure VERCEL_TOKEN and VERCEL_TEAM_ID in the ContentOS server environment. No deployment was attempted.',
        code: 'vercel_not_configured',
      }, { status: 503 });
    }

    const { websiteId, versionId } = parsed.data;
    const [siteRes, versionRes] = await Promise.all([
      supabase.from('growth_websites').select('id,business_name,slug').eq('id', websiteId).maybeSingle(),
      supabase.from('growth_website_versions').select('id,website_id,version_no,label,source_snapshot,status,preview_url').eq('id', versionId).eq('website_id', websiteId).maybeSingle(),
    ]);
    const firstError = siteRes.error || versionRes.error;
    if (firstError) throw new Error(firstError.message);
    if (!siteRes.data || !versionRes.data) return Response.json({ error: 'Website or source version not found.' }, { status: 404 });
    if (['approved', 'production', 'released'].includes(versionRes.data.status)) return Response.json({ error: 'Approved/production versions cannot be redeployed through the preview-only runner.' }, { status: 409 });

    const snapshot = normalizeSnapshot(versionRes.data.source_snapshot);
    const name = projectName(siteRes.data.slug);
    const teamQuery = `teamId=${encodeURIComponent(teamId)}`;

    const projectLookup = await vercelRequest(`/v9/projects/${encodeURIComponent(name)}?${teamQuery}`, vercelToken);
    if (projectLookup.response.status === 404) {
      const created = await vercelRequest(`/v11/projects?${teamQuery}`, vercelToken, {
        method: 'POST',
        body: JSON.stringify({
          name,
          framework: null,
          enablePreviewFeedback: true,
          previewDeploymentsDisabled: false,
        }),
      });
      if (!created.response.ok) {
        throw new Error(created.payload?.error?.message || `Vercel project creation failed (${created.response.status}).`);
      }
    } else if (!projectLookup.response.ok) {
      throw new Error(projectLookup.payload?.error?.message || `Vercel project lookup failed (${projectLookup.response.status}).`);
    }

    const deployment = await vercelRequest(`/v13/deployments?${teamQuery}`, vercelToken, {
      method: 'POST',
      body: JSON.stringify({
        name,
        project: name,
        files: snapshot.files.map((file) => ({ file: file.path, data: file.content })),
        meta: {
          source: 'contentos-website-studio',
          website_id: websiteId,
          version_id: versionId,
          version_no: String(versionRes.data.version_no),
          artifact_format: snapshot.format,
          file_count: String(snapshot.files.length),
          pending_asset_count: String(snapshot.pending_asset_count),
        },
      }),
    });

    if (!deployment.response.ok) {
      throw new Error(deployment.payload?.error?.message || `Vercel preview deployment failed (${deployment.response.status}).`);
    }

    const deploymentId = deployment.payload?.id || deployment.payload?.uid || null;
    const rawUrl = deployment.payload?.url || deployment.payload?.alias?.[0] || '';
    if (!rawUrl) throw new Error('Vercel created a deployment but did not return a preview URL.');
    const previewUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const deploymentStatus = String(deployment.payload?.readyState || deployment.payload?.state || deployment.payload?.status || 'created').toLowerCase();

    const { error: deploymentRecordError } = await supabase.from('growth_website_deployments').insert({
      website_id: websiteId,
      version_id: versionId,
      provider: 'vercel',
      environment: 'preview',
      deployment_id: deploymentId,
      url: previewUrl,
      status: deploymentStatus,
    });
    if (deploymentRecordError) throw new Error(`Preview deployed but deployment record failed: ${deploymentRecordError.message}`);

    const { error: versionUpdateError } = await supabase.from('growth_website_versions').update({
      preview_url: previewUrl,
      status: snapshot.pending_asset_count > 0 ? 'preview_incomplete' : 'preview',
    }).eq('id', versionId);
    if (versionUpdateError) throw new Error(`Preview deployed but version update failed: ${versionUpdateError.message}`);

    return Response.json({
      deployment_id: deploymentId,
      preview_url: previewUrl,
      status: deploymentStatus,
      project_name: name,
      artifact_format: snapshot.format,
      file_count: snapshot.files.length,
      pending_asset_count: snapshot.pending_asset_count,
      release_eligible: false,
      message: snapshot.pending_asset_count > 0
        ? 'Preview deployed. Visual assets are still pending, so this version is not release-eligible.'
        : 'Preview deployed from the exact immutable artifact. It still requires rendered QA and explicit release approval before production.',
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : 'Preview deployment failed.' }, { status: 500 });
  }
}
