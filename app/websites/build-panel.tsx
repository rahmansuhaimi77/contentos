'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import styles from './build-panel.module.css';

type Version = {
  id: string;
  version_no: number;
  label: string;
  status: string;
  preview_url: string | null;
  change_summary: string;
  created_at: string;
  source_snapshot: { pending_asset_count?: number; format?: string; build_summary?: string } | null;
};

type Deployment = {
  id: string;
  version_id: string | null;
  environment: string;
  deployment_id: string | null;
  url: string;
  status: string;
  created_at: string;
};

type Asset = {
  id: string;
  asset_type: string;
  source_type: string;
  source_url: string | null;
  alt_text: string;
  generation_prompt: string;
  status: string;
};

function pretty(value?: string | null) {
  if (!value) return 'Not set';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function BuildPanel({ websiteId, onChanged }: { websiteId: string; onChanged: () => void }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [versions, setVersions] = useState<Version[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { void load(); }, [websiteId]);

  async function load() {
    if (!websiteId) return;
    setLoading(true);
    const [versionRes, deploymentRes, assetRes] = await Promise.all([
      supabase.from('growth_website_versions').select('id,version_no,label,status,preview_url,change_summary,created_at,source_snapshot').eq('website_id', websiteId).order('version_no', { ascending: false }).limit(8),
      supabase.from('growth_website_deployments').select('id,version_id,environment,deployment_id,url,status,created_at').eq('website_id', websiteId).order('created_at', { ascending: false }).limit(12),
      supabase.from('growth_website_assets').select('id,asset_type,source_type,source_url,alt_text,generation_prompt,status').eq('website_id', websiteId).order('created_at'),
    ]);
    const firstError = versionRes.error || deploymentRes.error || assetRes.error;
    if (firstError) setError(firstError.message);
    setVersions((versionRes.data ?? []) as Version[]);
    setDeployments((deploymentRes.data ?? []) as Deployment[]);
    setAssets((assetRes.data ?? []) as Asset[]);
    setLoading(false);
  }

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }

  async function post(path: string, body: Record<string, unknown>, action: string) {
    const accessToken = await token();
    if (!accessToken) { setError('Your session has expired. Sign in again.'); return null; }
    setWorking(action);
    setError('');
    setNotice('');
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        const thrown: any = new Error(payload.error || `${action} failed.`);
        thrown.code = payload.code;
        throw thrown;
      }
      await load();
      onChanged();
      return payload;
    } catch (caught: any) {
      setError(caught instanceof Error ? caught.message : `${action} failed.`);
      return null;
    } finally {
      setWorking('');
    }
  }

  async function generateBuild() {
    const payload = await post('/api/websites/build', { websiteId }, 'build');
    if (!payload) return;
    setNotice(payload.pending_asset_count > 0
      ? `Source v${payload.version.version_no} generated. ${payload.pending_asset_count} visual asset requirement${payload.pending_asset_count === 1 ? '' : 's'} are still pending, so treat it as a layout/copy preview only.`
      : `Source v${payload.version.version_no} generated with no pending visual assets. It is ready for preview deployment.`);
  }

  async function deployPreview(version: Version) {
    const payload = await post('/api/websites/deploy-preview', { websiteId, versionId: version.id }, `deploy-${version.id}`);
    if (!payload) return;
    setNotice(payload.message || 'Preview deployment created.');
  }

  const latest = versions[0] ?? null;
  const pendingAssets = assets.filter((asset) => !['selected', 'approved'].includes(asset.status) || !asset.source_url);
  const selectedAssets = assets.length - pendingAssets.length;

  if (loading) return <div className={styles.loading}>Loading build workspace…</div>;

  return (
    <section className={styles.shell}>
      {notice && <div className={styles.notice}>{notice}</div>}
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.gates}>
        <article className={assets.length === 0 || pendingAssets.length === 0 ? styles.done : styles.warn}><span>VISUAL ASSETS</span><b>{selectedAssets}/{assets.length}</b><small>{pendingAssets.length ? `${pendingAssets.length} pending · preview allowed, release later blocked` : 'No pending assets'}</small></article>
        <article className={latest ? styles.done : ''}><span>SOURCE VERSION</span><b>{latest ? `v${latest.version_no}` : '—'}</b><small>{latest ? pretty(latest.status) : 'Generate a source snapshot'}</small></article>
        <article className={latest?.preview_url ? styles.done : ''}><span>VERCEL PREVIEW</span><b>{latest?.preview_url ? 'Created' : '—'}</b><small>{latest?.preview_url ? 'Rendered QA comes next' : 'Preview connection/deploy pending'}</small></article>
      </div>

      <div className={styles.actionsCard}>
        <div><span>01 · SOURCE BUILD</span><h3>Create an immutable preview artifact.</h3><p>The build agent translates the approved direction and production plan into a static HTML/CSS/JS source snapshot. It may use explicit visual placeholders when assets are still pending, but those versions are never considered release-ready.</p></div>
        <button disabled={Boolean(working)} onClick={() => void generateBuild()}>{working === 'build' ? 'Building source…' : latest ? 'Generate new source version' : 'Generate source version'}</button>
      </div>

      {pendingAssets.length > 0 && <section className={styles.assetPanel}>
        <div className={styles.sectionHead}><div><span>VISUAL DEBT</span><h3>Assets still required for final-quality QA</h3></div><small>{pendingAssets.length} pending</small></div>
        <div className={styles.assetGrid}>{pendingAssets.map((asset) => <article key={asset.id}><div><span>{pretty(asset.asset_type)}</span><em>{pretty(asset.source_type)}</em></div><b>{asset.alt_text || 'Visual asset'}</b><p>{asset.generation_prompt || 'No generation prompt stored.'}</p><small>Status: {pretty(asset.status)}</small></article>)}</div>
      </section>}

      <section className={styles.versionPanel}>
        <div className={styles.sectionHead}><div><span>02 · VERSION HISTORY</span><h3>Builds are immutable; previews point to one exact version.</h3></div><small>{versions.length} recent</small></div>
        {versions.length === 0 ? <p className={styles.empty}>No source builds yet.</p> : <div className={styles.versionList}>{versions.map((version) => {
          const pending = Number(version.source_snapshot?.pending_asset_count || 0);
          return <article key={version.id} className={version.preview_url ? styles.versionPreview : ''}>
            <div className={styles.versionTop}><span>v{version.version_no}</span><div><b>{version.label}</b><small>{pretty(version.status)} · {new Date(version.created_at).toLocaleString('en-MY')}</small></div></div>
            <p>{version.change_summary || version.source_snapshot?.build_summary || 'No build summary recorded.'}</p>
            <div className={styles.versionMeta}><span>{pending ? `${pending} visual assets pending` : 'Visual manifest complete'}</span><span>{version.source_snapshot?.format || 'source snapshot'}</span></div>
            <div className={styles.versionActions}>
              {version.preview_url && <a href={version.preview_url} target="_blank" rel="noreferrer">Open preview ↗</a>}
              <button disabled={Boolean(working)} onClick={() => void deployPreview(version)}>{working === `deploy-${version.id}` ? 'Deploying…' : version.preview_url ? 'Deploy fresh preview' : 'Deploy preview'}</button>
            </div>
          </article>;
        })}</div>}
      </section>

      <section className={styles.deployPanel}>
        <div className={styles.sectionHead}><div><span>03 · DEPLOYMENT LOG</span><h3>Preview environment only.</h3></div><small>No production action exists in v2.2</small></div>
        {deployments.length === 0 ? <p className={styles.empty}>No preview deployments recorded yet. If Vercel credentials are not configured, the deploy action stops safely without creating anything.</p> : <div className={styles.deployList}>{deployments.map((deployment) => <article key={deployment.id}><span>{pretty(deployment.environment)}</span><div><b>{pretty(deployment.status)}</b><small>{new Date(deployment.created_at).toLocaleString('en-MY')}</small></div><a href={deployment.url} target="_blank" rel="noreferrer">Open ↗</a></article>)}</div>}
      </section>
    </section>
  );
}
