'use client';

import Link from 'next/link';
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
  source_snapshot: { pending_asset_count?: number; format?: string; build_summary?: string; mode?: string; template_key?: string } | null;
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

type TemplateSelection = {
  id: string;
  template_id: string;
  status: 'candidate' | 'approved' | 'rejected' | 'imported';
  fit_score: number | null;
  rationale: string;
  adaptation_notes: string;
  source_snapshot: Record<string, unknown> | null;
};

type Template = {
  id: string;
  template_key: string;
  name: string;
  source_kind: string;
  source_repo_url: string | null;
  live_demo_url: string | null;
  license_name: string;
  license_verified: boolean;
  preview_url: string | null;
  technology: string[];
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
  const [selection, setSelection] = useState<TemplateSelection | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { void load(); }, [websiteId]);

  async function load() {
    if (!websiteId) return;
    setLoading(true);
    const [versionRes, deploymentRes, assetRes, selectionRes] = await Promise.all([
      supabase.from('growth_website_versions').select('id,version_no,label,status,preview_url,change_summary,created_at,source_snapshot').eq('website_id', websiteId).order('version_no', { ascending: false }).limit(8),
      supabase.from('growth_website_deployments').select('id,version_id,environment,deployment_id,url,status,created_at').eq('website_id', websiteId).order('created_at', { ascending: false }).limit(12),
      supabase.from('growth_website_assets').select('id,asset_type,source_type,source_url,alt_text,generation_prompt,status').eq('website_id', websiteId).order('created_at'),
      supabase.from('growth_website_template_selections').select('id,template_id,status,fit_score,rationale,adaptation_notes,source_snapshot').eq('website_id', websiteId).in('status', ['approved','imported']).limit(1).maybeSingle(),
    ]);
    const firstError = versionRes.error || deploymentRes.error || assetRes.error || selectionRes.error;
    if (firstError) setError(firstError.message);
    setVersions((versionRes.data ?? []) as Version[]);
    setDeployments((deploymentRes.data ?? []) as Deployment[]);
    setAssets((assetRes.data ?? []) as Asset[]);
    const nextSelection = (selectionRes.data || null) as TemplateSelection | null;
    setSelection(nextSelection);
    if (nextSelection) {
      const { data, error: templateError } = await supabase.from('growth_website_templates').select('id,template_key,name,source_kind,source_repo_url,live_demo_url,license_name,license_verified,preview_url,technology').eq('id', nextSelection.template_id).maybeSingle();
      if (templateError) setError(templateError.message);
      setTemplate((data || null) as Template | null);
    } else setTemplate(null);
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

  async function generateLegacyBuild() {
    if (!window.confirm('Use the legacy blank-canvas generator? This should only be used when no suitable verified template exists.')) return;
    const payload = await post('/api/websites/build', { websiteId, legacyMode: true }, 'legacy-build');
    if (!payload) return;
    setNotice(payload.pending_asset_count > 0
      ? `Legacy source v${payload.version.version_no} generated with ${payload.pending_asset_count} visual requirement${payload.pending_asset_count === 1 ? '' : 's'} pending.`
      : `Legacy source v${payload.version.version_no} generated. Template-first remains the preferred workflow.`);
  }

  async function deployPreview(version: Version) {
    const payload = await post('/api/websites/deploy-preview', { websiteId, versionId: version.id }, `deploy-${version.id}`);
    if (!payload) return;
    setNotice(payload.message || 'Preview deployment created.');
  }

  const latest = versions[0] ?? null;
  const pendingAssets = assets.filter((asset) => !['selected', 'approved'].includes(asset.status) || !asset.source_url);
  const selectedAssets = assets.length - pendingAssets.length;
  const templateMode = Boolean(selection && template);
  const imported = selection?.status === 'imported';

  if (loading) return <div className={styles.loading}>Loading adaptation workspace…</div>;

  return (
    <section className={styles.shell}>
      {notice && <div className={styles.notice}>{notice}</div>}
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.gates}>
        <article className={templateMode ? styles.done : styles.warn}><span>APPROVED TEMPLATE</span><b>{template?.name || '—'}</b><small>{templateMode ? `${template?.license_name || 'License'}${template?.license_verified ? ' verified' : ''}` : 'Choose a verified template first'}</small></article>
        <article className={imported || latest?.source_snapshot?.mode === 'template_adaptation' ? styles.done : ''}><span>ADAPTED ARTIFACT</span><b>{imported ? 'Imported' : latest ? `v${latest.version_no}` : '—'}</b><small>{imported ? 'Template source has an implementation record' : 'Adapt approved code before QA'}</small></article>
        <article className={latest?.preview_url ? styles.done : ''}><span>PREVIEW</span><b>{latest?.preview_url ? 'Created' : '—'}</b><small>{latest?.preview_url ? 'Rendered QA comes next' : 'Preview the exact adapted artifact'}</small></article>
      </div>

      {templateMode ? (
        <div className={styles.actionsCard}>
          <div><span>01 · TEMPLATE ADAPTATION</span><h3>{template?.name}</h3><p>{imported
            ? 'This project already has an imported template implementation. Preserve the approved visual DNA, adapt the business content and functionality, then create immutable versions for preview and QA. Blank-canvas generation is disabled for this project.'
            : 'The template is approved. The next step is to import its licensed source and adapt it to the verified brief. Website Studio will not replace it with an AI-generated blank-canvas design.'}</p></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {template?.live_demo_url && <a href={template.live_demo_url} target="_blank" rel="noreferrer" style={{ color: '#d6e7de', fontSize: 11, fontWeight: 800, textDecoration: 'none' }}>Original demo ↗</a>}
            {template?.preview_url && <a href={template.preview_url} target="_blank" rel="noreferrer" style={{ color: '#d6e7de', fontSize: 11, fontWeight: 800, textDecoration: 'none' }}>Current adaptation ↗</a>}
            <Link href="/websites/templates" style={{ color: '#233229', background: '#cce56e', borderRadius: 11, padding: '11px 14px', fontSize: 11, fontWeight: 850, textDecoration: 'none' }}>{imported ? 'Template record' : 'Template Library'}</Link>
          </div>
        </div>
      ) : (
        <div className={styles.actionsCard}>
          <div><span>01 · CHOOSE A TEMPLATE</span><h3>Template-first is the default.</h3><p>Select a real, license-verified template before any build work. Blank-canvas generation remains available only as an explicit legacy fallback when no suitable template exists.</p></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/websites/templates" style={{ color: '#233229', background: '#cce56e', borderRadius: 11, padding: '11px 14px', fontSize: 11, fontWeight: 850, textDecoration: 'none' }}>Choose template</Link>
            <button disabled={Boolean(working)} onClick={() => void generateLegacyBuild()}>{working === 'legacy-build' ? 'Generating legacy source…' : 'Legacy fallback'}</button>
          </div>
        </div>
      )}

      {templateMode && template && <section className={styles.assetPanel}>
        <div className={styles.sectionHead}><div><span>TEMPLATE PROVENANCE</span><h3>Keep the commercial-use record with the project.</h3></div><small>{template.license_verified ? 'License verified' : 'Review required'}</small></div>
        <div className={styles.assetGrid}>
          <article><div><span>SOURCE</span><em>{template.source_kind}</em></div><b>{template.name}</b><p>{template.source_repo_url || 'Internal adapted source'}</p>{template.source_repo_url && <a href={template.source_repo_url} target="_blank" rel="noreferrer" style={{ fontSize: 9, fontWeight: 800, color: '#456055' }}>Open repository ↗</a>}</article>
          <article><div><span>LICENSE</span><em>{template.license_verified ? 'verified' : 'unverified'}</em></div><b>{template.license_name || 'Not recorded'}</b><p>Third-party branding, proprietary product media and unsupported claims must still be removed during adaptation.</p></article>
          <article><div><span>TECHNOLOGY</span><em>starting point</em></div><b>{(template.technology || []).join(' · ') || 'See source'}</b><p>The adapted implementation may simplify or replace dependencies where needed without lowering the approved visual quality.</p></article>
        </div>
      </section>}

      {!templateMode && pendingAssets.length > 0 && <section className={styles.assetPanel}>
        <div className={styles.sectionHead}><div><span>LEGACY VISUAL DEBT</span><h3>Assets still required by the old blank-canvas plan</h3></div><small>{pendingAssets.length} pending</small></div>
        <div className={styles.assetGrid}>{pendingAssets.map((asset) => <article key={asset.id}><div><span>{pretty(asset.asset_type)}</span><em>{pretty(asset.source_type)}</em></div><b>{asset.alt_text || 'Visual asset'}</b><p>{asset.generation_prompt || 'No generation prompt stored.'}</p><small>Status: {pretty(asset.status)}</small></article>)}</div>
      </section>}

      <section className={styles.versionPanel}>
        <div className={styles.sectionHead}><div><span>02 · VERSION HISTORY</span><h3>Every adapted release stays immutable and auditable.</h3></div><small>{versions.length} recent</small></div>
        {versions.length === 0 ? <p className={styles.empty}>No immutable versions recorded yet. For template-first projects, create a version only after the approved source has actually been imported and adapted.</p> : <div className={styles.versionList}>{versions.map((version) => {
          const pending = Number(version.source_snapshot?.pending_asset_count || 0);
          return <article key={version.id} className={version.preview_url ? styles.versionPreview : ''}>
            <div className={styles.versionTop}><span>v{version.version_no}</span><div><b>{version.label}</b><small>{pretty(version.status)} · {new Date(version.created_at).toLocaleString('en-MY')}</small></div></div>
            <p>{version.change_summary || version.source_snapshot?.build_summary || 'No build summary recorded.'}</p>
            <div className={styles.versionMeta}><span>{version.source_snapshot?.mode ? pretty(version.source_snapshot.mode) : pending ? `${pending} visual assets pending` : 'Source snapshot'}</span><span>{version.source_snapshot?.format || 'artifact'}</span></div>
            <div className={styles.versionActions}>
              {version.preview_url && <a href={version.preview_url} target="_blank" rel="noreferrer">Open preview ↗</a>}
              <button disabled={Boolean(working)} onClick={() => void deployPreview(version)}>{working === `deploy-${version.id}` ? 'Deploying…' : version.preview_url ? 'Deploy fresh preview' : 'Deploy preview'}</button>
            </div>
          </article>;
        })}</div>}
      </section>

      <section className={styles.deployPanel}>
        <div className={styles.sectionHead}><div><span>03 · DEPLOYMENT LOG</span><h3>Preview the exact artifact before release.</h3></div><small>Production remains separately gated</small></div>
        {deployments.length === 0 ? <p className={styles.empty}>No preview deployments recorded yet.</p> : <div className={styles.deployList}>{deployments.map((deployment) => <article key={deployment.id}><span>{pretty(deployment.environment)}</span><div><b>{pretty(deployment.status)}</b><small>{new Date(deployment.created_at).toLocaleString('en-MY')}</small></div><a href={deployment.url} target="_blank" rel="noreferrer">Open ↗</a></article>)}</div>}
      </section>
    </section>
  );
}
