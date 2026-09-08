import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';
const ARTIFACT_REPOSITORY = 'rahmansuhaimi77/contentos';

const InputSchema = z.object({
  websiteId: z.string().uuid(),
  selectionId: z.string().uuid(),
  commitSha: z.string().regex(/^[a-f0-9]{40}$/i),
  basePath: z.string().min(1).max(180),
  files: z.array(z.string().min(1).max(180)).min(1).max(64),
  label: z.string().max(120).optional(),
  changeSummary: z.string().max(1200).optional(),
  pendingAssetCount: z.number().int().min(0).max(100).optional().default(0),
});

function safeRelativePath(path: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(path)) return false;
  if (path.startsWith('/') || path.includes('..') || path.includes('\\') || path.includes('//')) return false;
  return path.split('/').every((part) => part && part !== '.' && part !== '..');
}

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

async function fetchSource(commitSha: string, basePath: string, filePath: string) {
  const url = `https://raw.githubusercontent.com/${ARTIFACT_REPOSITORY}/${commitSha}/${basePath}/${filePath}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: controller.signal });
    if (!response.ok) throw new Error(`Could not fetch ${filePath} from the approved artifact commit (HTTP ${response.status}).`);
    const content = await response.text();
    if (!content.length) throw new Error(`${filePath} is empty.`);
    if (Buffer.byteLength(content, 'utf8') > 350_000) throw new Error(`${filePath} exceeds the per-file artifact limit.`);
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  let runId = '';
  let supabase: any = null;
  try {
    const auth = await authenticated(req);
    if (!auth) return Response.json({ error: 'Please sign in before importing an adapted template artifact.' }, { status: 401 });
    supabase = auth.supabase;

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Invalid artifact import request.', details: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;
    if (!safeRelativePath(input.basePath) || !input.basePath.startsWith('public/generated/')) {
      return Response.json({ error: 'Template artifacts must come from an approved public/generated/ path in the ContentOS repository.' }, { status: 400 });
    }
    const uniqueFiles = Array.from(new Set(input.files));
    if (uniqueFiles.length !== input.files.length || uniqueFiles.some((path) => !safeRelativePath(path))) {
      return Response.json({ error: 'Artifact file list contains duplicates or unsafe paths.' }, { status: 400 });
    }
    if (!uniqueFiles.includes('index.html')) return Response.json({ error: 'Template artifact must include a root index.html.' }, { status: 400 });

    const [siteRes, selectionRes, versionRes] = await Promise.all([
      supabase.from('growth_websites').select('id,business_name,slug').eq('id', input.websiteId).maybeSingle(),
      supabase.from('growth_website_template_selections').select('id,website_id,template_id,status').eq('id', input.selectionId).eq('website_id', input.websiteId).maybeSingle(),
      supabase.from('growth_website_versions').select('version_no').eq('website_id', input.websiteId).order('version_no', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const firstError = siteRes.error || selectionRes.error || versionRes.error;
    if (firstError) throw new Error(firstError.message);
    if (!siteRes.data || !selectionRes.data) return Response.json({ error: 'Website or approved template selection not found.' }, { status: 404 });
    if (!['approved', 'imported'].includes(selectionRes.data.status)) return Response.json({ error: 'Approve the template before importing its adapted source.' }, { status: 409 });

    const { data: template, error: templateError } = await supabase.from('growth_website_templates')
      .select('id,template_key,name,source_repo_url,license_name,license_verified')
      .eq('id', selectionRes.data.template_id).maybeSingle();
    if (templateError) throw new Error(templateError.message);
    if (!template || !template.license_verified) return Response.json({ error: 'The selected template does not have a verified reusable-code license.' }, { status: 409 });

    const { data: run, error: runError } = await supabase.from('growth_website_runs').insert({
      website_id: input.websiteId,
      stage: 'template_artifact_import',
      provider: 'github',
      model: 'git-artifact',
      prompt_version: 'template_artifact_v1',
      input_json: {
        selection_id: input.selectionId,
        template_id: template.id,
        template_key: template.template_key,
        repository: ARTIFACT_REPOSITORY,
        commit_sha: input.commitSha,
        base_path: input.basePath,
        files: uniqueFiles,
      },
      status: 'started',
    }).select('id').single();
    if (runError) throw new Error(runError.message);
    runId = run.id;

    const fetched = await Promise.all(uniqueFiles.map(async (path) => ({ path, content: await fetchSource(input.commitSha, input.basePath, path) })));
    const totalBytes = fetched.reduce((sum, file) => sum + Buffer.byteLength(file.content, 'utf8'), 0);
    if (totalBytes > 2_500_000) throw new Error('Adapted artifact exceeds the total source size limit.');

    const nextVersion = Number(versionRes.data?.version_no || 0) + 1;
    const summary = input.changeSummary?.trim() || `Imported and froze the adapted ${template.name} source from Git commit ${input.commitSha.slice(0, 8)}.`;
    const snapshot = {
      format: 'static_bundle_v2',
      mode: 'template_adaptation',
      template_id: template.id,
      template_key: template.template_key,
      template_name: template.name,
      template_license: template.license_name,
      template_source_repo: template.source_repo_url,
      adaptation_repository: ARTIFACT_REPOSITORY,
      adaptation_commit_sha: input.commitSha,
      adaptation_base_path: input.basePath,
      pending_asset_count: input.pendingAssetCount,
      file_count: fetched.length,
      files: fetched,
      imported_at: new Date().toISOString(),
    };

    const { data: version, error: versionError } = await supabase.from('growth_website_versions').insert({
      website_id: input.websiteId,
      version_no: nextVersion,
      label: input.label?.trim() || `v${nextVersion} · ${template.name} adaptation`,
      source_snapshot: snapshot,
      change_summary: summary,
      status: input.pendingAssetCount > 0 ? 'draft_incomplete' : 'draft',
    }).select('id,version_no,label,status').single();
    if (versionError) throw new Error(versionError.message);

    const { error: selectionUpdateError } = await supabase.from('growth_website_template_selections').update({
      status: 'imported',
      source_snapshot: {
        repository: ARTIFACT_REPOSITORY,
        commit_sha: input.commitSha,
        base_path: input.basePath,
        files: uniqueFiles,
        version_id: version.id,
        version_no: version.version_no,
      },
      adaptation_notes: summary,
      updated_at: new Date().toISOString(),
    }).eq('id', input.selectionId);
    if (selectionUpdateError) throw new Error(`Version created but template import record failed: ${selectionUpdateError.message}`);

    await supabase.from('growth_website_runs').update({
      status: 'completed',
      output_json: { version_id: version.id, version_no: version.version_no, file_count: fetched.length, total_bytes: totalBytes },
      completed_at: new Date().toISOString(),
    }).eq('id', runId);

    return Response.json({
      version,
      template: { id: template.id, key: template.template_key, name: template.name, license: template.license_name },
      artifact: { repository: ARTIFACT_REPOSITORY, commit_sha: input.commitSha, base_path: input.basePath, file_count: fetched.length, total_bytes: totalBytes },
      pending_asset_count: input.pendingAssetCount,
      message: 'Exact adapted template source frozen as an immutable Website Studio version. Preview deployment comes next.',
    });
  } catch (error) {
    console.error(error);
    if (supabase && runId) {
      await supabase.from('growth_website_runs').update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Template artifact import failed.',
        completed_at: new Date().toISOString(),
      }).eq('id', runId);
    }
    return Response.json({ error: error instanceof Error ? error.message : 'Template artifact import failed.' }, { status: 500 });
  }
}
