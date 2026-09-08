import { createHash } from 'node:crypto';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

function safeRelativePath(path: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(path)) return false;
  if (path.startsWith('/') || path.includes('..') || path.includes('\\') || path.includes('//')) return false;
  return path.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

export const ReleaseFileSchema = z.object({
  path: z.string().min(1).max(180).refine(safeRelativePath, 'Unsafe artifact path.'),
  content: z.string(),
});

const StaticV1ReleaseSchema = z.object({
  format: z.literal('static_v1'),
  files: z.array(ReleaseFileSchema).length(3),
  pending_asset_count: z.number().int().min(0).default(0),
}).passthrough();

const StaticBundleV2ReleaseSchema = z.object({
  format: z.literal('static_bundle_v2'),
  files: z.array(ReleaseFileSchema).min(1).max(64),
  pending_asset_count: z.number().int().min(0).default(0),
}).passthrough();

export const ReleaseSnapshotSchema = z.union([StaticV1ReleaseSchema, StaticBundleV2ReleaseSchema]).superRefine((snapshot, ctx) => {
  const paths = new Set<string>();
  let totalBytes = 0;
  for (const file of snapshot.files) {
    if (paths.has(file.path)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate artifact path: ${file.path}` });
    paths.add(file.path);
    const size = Buffer.byteLength(file.content, 'utf8');
    if (size > 350_000) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${file.path} exceeds the per-file release limit.` });
    totalBytes += size;
  }
  if (!paths.has('index.html')) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Artifact must contain root index.html.' });
  if (totalBytes > 2_500_000) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Artifact exceeds the total release size limit.' });
  if (snapshot.format === 'static_v1') {
    for (const required of ['index.html', 'styles.css', 'script.js']) {
      if (!paths.has(required)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Legacy artifact is missing ${required}.` });
    }
  }
});

export type ReleaseSnapshot = z.infer<typeof ReleaseSnapshotSchema>;

export async function getWebsiteReleaseAuth(req: Request) {
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

export function websiteProjectName(slug: string) {
  const cleaned = `ws-${slug}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
  return cleaned || 'website-studio-preview';
}

export function snapshotFingerprint(snapshot: ReleaseSnapshot) {
  const canonical = [...snapshot.files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((file) => `${file.path}\n${file.content}`)
    .join('\n---website-studio-file---\n');
  return createHash('sha256').update(`${snapshot.format}\n${canonical}`, 'utf8').digest('hex');
}

export function fileHash(content: string) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export async function vercelApi(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await response.text();
  let payload: any = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }
  return { response, payload };
}

export function normalizeUrl(raw: string) {
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export function productionAliases(payload: any, projectName: string): string[] {
  const values: unknown[] = Array.isArray(payload?.alias) ? payload.alias : [];
  const aliases: string[] = values
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map((value) => normalizeUrl(value));
  const defaultUrl = `https://${projectName}.vercel.app`;
  if (!aliases.includes(defaultUrl)) aliases.unshift(defaultUrl);
  return Array.from(new Set<string>(aliases));
}

export async function verifyLiveSnapshot(baseUrl: string, snapshot: ReleaseSnapshot) {
  const expected = new Map(snapshot.files.map((file) => [file.path, fileHash(file.content)]));
  const results: Array<{ path: string; ok: boolean; status: number; expected_hash: string; actual_hash: string; error?: string }> = [];

  for (const file of snapshot.files) {
    const path = file.path === 'index.html' ? '/' : `/${file.path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(new URL(path, baseUrl), {
        cache: 'no-store',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'ContentOS-Website-Studio-Smoke/2.0' },
      });
      const body = await response.text();
      const actual = fileHash(body);
      const expectedHash = expected.get(file.path) || '';
      results.push({ path: file.path, ok: response.ok && actual === expectedHash, status: response.status, expected_hash: expectedHash, actual_hash: actual });
    } catch (error) {
      results.push({ path: file.path, ok: false, status: 0, expected_hash: expected.get(file.path) || '', actual_hash: '', error: error instanceof Error ? error.message : 'Fetch failed' });
    } finally {
      clearTimeout(timeout);
    }
  }

  return { pass: results.every((row) => row.ok), files: results, format: snapshot.format, file_count: snapshot.files.length };
}

export async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
