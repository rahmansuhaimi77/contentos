'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import styles from './release.module.css';

type Site = { id: string; business_name: string; slug: string; brand_id: string | null };
type Version = {
  id: string;
  website_id: string;
  version_no: number;
  label: string;
  status: string;
  preview_url: string | null;
  qa_status: string | null;
  qa_score: number | null;
  qa_completed_at: string | null;
  approved_at: string | null;
  source_snapshot: any;
};
type Release = {
  id: string;
  website_id: string;
  version_id: string;
  preview_deployment_id: string;
  project_id: string | null;
  project_name: string | null;
  previous_production_deployment_id: string | null;
  production_deployment_id: string | null;
  production_url: string | null;
  production_aliases: string[];
  source_fingerprint: string;
  status: string;
  approval_note: string;
  smoke_status: string;
  smoke_details: any;
  approved_at: string;
  promoted_at: string | null;
  smoke_checked_at: string | null;
  rolled_back_at: string | null;
  created_at: string;
};

function pretty(value?: string | null) {
  if (!value) return 'Not set';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function WebsiteReleasePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [activeSiteId, setActiveSiteId] = useState('');
  const [activeVersionId, setActiveVersionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [releaseConfirm, setReleaseConfirm] = useState('');
  const [rollbackConfirm, setRollbackConfirm] = useState('');

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data.user ?? null);
      if (!data.user) { setLoading(false); return; }
      await loadSites();
      if (mounted) setLoading(false);
    }
    async function onBrandChange() { await loadSites(); }
    void init();
    window.addEventListener('contentos:brand-change', onBrandChange);
    return () => { mounted = false; window.removeEventListener('contentos:brand-change', onBrandChange); };
  }, [supabase]);

  useEffect(() => {
    if (!activeSiteId) { setVersions([]); setReleases([]); setActiveVersionId(''); return; }
    void loadSiteState(activeSiteId);
  }, [activeSiteId]);

  async function loadSites() {
    const [siteRes, briefRes] = await Promise.all([
      supabase.from('growth_websites').select('id,business_name,slug,template_version').eq('template_version', 'production_v2').order('created_at', { ascending: false }),
      supabase.from('growth_website_briefs').select('website_id,brand_id'),
    ]);
    const firstError = siteRes.error || briefRes.error;
    if (firstError) { setError(firstError.message); return; }
    const brandBySite = new Map((briefRes.data ?? []).map((row) => [row.website_id, row.brand_id]));
    const next = (siteRes.data ?? []).map((site) => ({ id: site.id, business_name: site.business_name, slug: site.slug, brand_id: brandBySite.get(site.id) ?? null } as Site));
    setSites(next);
    const activeBrandId = window.localStorage.getItem('contentos:selectedBrandId');
    const preferred = next.find((site) => site.brand_id === activeBrandId)?.id || next[0]?.id || '';
    setActiveSiteId((current) => next.some((site) => site.id === current) ? current : preferred);
  }

  async function loadSiteState(websiteId: string) {
    const [versionRes, releaseRes] = await Promise.all([
      supabase.from('growth_website_versions')
        .select('id,website_id,version_no,label,status,preview_url,qa_status,qa_score,qa_completed_at,approved_at,source_snapshot')
        .eq('website_id', websiteId).order('version_no', { ascending: false }),
      supabase.from('growth_website_releases')
        .select('id,website_id,version_id,preview_deployment_id,project_id,project_name,previous_production_deployment_id,production_deployment_id,production_url,production_aliases,source_fingerprint,status,approval_note,smoke_status,smoke_details,approved_at,promoted_at,smoke_checked_at,rolled_back_at,created_at')
        .eq('website_id', websiteId).order('created_at', { ascending: false }),
    ]);
    const firstError = versionRes.error || releaseRes.error;
    if (firstError) { setError(firstError.message); return; }
    const nextVersions = (versionRes.data ?? []) as Version[];
    setVersions(nextVersions);
    setReleases((releaseRes.data ?? []) as Release[]);
    const preferred = nextVersions.find((version) => version.qa_status === 'pass' && Number(version.qa_score || 0) >= 85 && Number(version.source_snapshot?.pending_asset_count || 0) === 0)?.id || nextVersions[0]?.id || '';
    setActiveVersionId((current) => nextVersions.some((version) => version.id === current) ? current : preferred);
  }

  async function authToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }

  async function post(path: string, body: Record<string, unknown>, action: string) {
    const token = await authToken();
    if (!token) { setError('Your session expired. Sign in again.'); return null; }
    setWorking(action);
    setError('');
    setNotice('');
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `${action} failed.`);
      return payload;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `${action} failed.`);
      return null;
    } finally {
      setWorking('');
    }
  }

  async function approveRelease() {
    if (!activeSite || !activeVersion) return;
    const payload = await post('/api/websites/approve-release', { websiteId: activeSite.id, versionId: activeVersion.id, approvalNote }, 'approval');
    if (!payload) return;
    setNotice(payload.already_approved ? 'This exact version is already approved as the current release candidate.' : 'Release candidate approved. Production has not changed.');
    setApprovalNote('');
    await loadSiteState(activeSite.id);
  }

  async function releaseProduction() {
    if (!candidate || releaseConfirm !== 'RELEASE') return;
    const payload = await post('/api/websites/release', { releaseId: candidate.id }, 'release');
    if (!payload) return;
    setReleaseConfirm('');
    setNotice(payload.status === 'live'
      ? `Production release verified. ${payload.production_url}`
      : payload.message || 'Production promotion completed with a smoke-test warning.');
    await loadSiteState(candidate.website_id);
  }

  async function rollbackProduction() {
    if (!rollbackTarget || rollbackConfirm !== 'ROLLBACK') return;
    const payload = await post('/api/websites/rollback', { releaseId: rollbackTarget.id, reason: 'Manual rollback from Website Studio v2.4' }, 'rollback');
    if (!payload) return;
    setRollbackConfirm('');
    setNotice(payload.message || 'Rollback completed.');
    await loadSiteState(rollbackTarget.website_id);
  }

  const activeSite = sites.find((site) => site.id === activeSiteId) ?? null;
  const activeVersion = versions.find((version) => version.id === activeVersionId) ?? null;
  const candidate = releases.find((release) => ['approved', 'promoting', 'smoke_failed'].includes(release.status)) ?? null;
  const liveRelease = releases.find((release) => release.status === 'live') ?? null;
  const rollbackTarget = candidate?.status === 'smoke_failed' ? candidate : liveRelease;
  const candidateVersion = candidate ? versions.find((version) => version.id === candidate.version_id) ?? null : null;
  const liveVersion = liveRelease ? versions.find((version) => version.id === liveRelease.version_id) ?? null : null;
  const pendingAssets = Number(activeVersion?.source_snapshot?.pending_asset_count || 0);
  const releaseReady = Boolean(activeVersion && activeVersion.qa_status === 'pass' && Number(activeVersion.qa_score || 0) >= 85 && activeVersion.qa_completed_at && activeVersion.preview_url && pendingAssets === 0 && activeVersion.status !== 'production');

  if (loading) return <section><div className="dashboardSkeleton">Loading release control…</div></section>;
  if (!user) return <section><div className="dashboardEmpty"><h1>Sign in first</h1><p>Production release control is available inside your authenticated ContentOS workspace.</p></div></section>;

  return (
    <section className={styles.page}>
      <header className="pageHero compactHero">
        <div><span className="eyebrow">WEBSITE STUDIO · V2.4</span><h1>Human approval + production release</h1><p>Approve the QA-tested version → promote that exact Vercel preview → verify live source hashes → keep a recorded rollback target.</p></div>
      </header>

      <div className={styles.picker}>
        <label>WEBSITE PROJECT<select value={activeSiteId} onChange={(event) => setActiveSiteId(event.target.value)}>{sites.length === 0 && <option value="">No production v2 projects</option>}{sites.map((site) => <option value={site.id} key={site.id}>{site.business_name} · {site.slug}</option>)}</select></label>
        <label>VERSION TO REVIEW<select value={activeVersionId} onChange={(event) => setActiveVersionId(event.target.value)}>{versions.length === 0 && <option value="">No builds yet</option>}{versions.map((version) => <option value={version.id} key={version.id}>v{version.version_no} · {version.label || pretty(version.status)}</option>)}</select></label>
      </div>

      {notice && <div className={styles.notice}>{notice}</div>}
      {error && <div className={styles.error}>{error}</div>}

      {!activeVersion ? <div className={styles.empty}>No Website Studio source version is available yet.</div> : <>
        <div className={styles.summary}>
          <article className={activeVersion.qa_status === 'pass' ? styles.pass : styles.fail}><span>QA</span><b>{activeVersion.qa_score ?? '—'}/100</b><small>{activeVersion.qa_status ? pretty(activeVersion.qa_status) : 'Not run'}</small></article>
          <article className={pendingAssets ? styles.fail : styles.pass}><span>VISUAL ASSETS</span><b>{pendingAssets}</b><small>{pendingAssets ? 'Still pending' : 'Complete'}</small></article>
          <article><span>VERSION STATE</span><b>{pretty(activeVersion.status)}</b><small>v{activeVersion.version_no}</small></article>
          <article className={candidate ? '' : styles.pass}><span>RELEASE CANDIDATE</span><b>{candidate ? `v${candidateVersion?.version_no ?? '?'}` : 'None'}</b><small>{candidate ? pretty(candidate.status) : 'Slot available'}</small></article>
          <article className={liveRelease ? styles.pass : ''}><span>LIVE</span><b>{liveRelease ? `v${liveVersion?.version_no ?? '?'}` : 'None'}</b><small>{liveRelease ? 'Smoke verified' : 'No Website Studio production release yet'}</small></article>
        </div>

        <div className={styles.grid}>
          <section className={styles.card}>
            <div className={styles.cardHead}><div><span>STEP 1</span><h3>Human release approval</h3></div><small>Does not publish</small></div>
            <div className={styles.releaseState}>
              <article><span>Exact preview</span><b>{activeVersion.preview_url || 'Missing'}</b></article>
              <article><span>Rendered QA</span><b>{activeVersion.qa_completed_at ? `${activeVersion.qa_score}/100 · ${new Date(activeVersion.qa_completed_at).toLocaleString()}` : 'Not completed'}</b></article>
              <article><span>Eligibility</span><b>{releaseReady ? 'Ready for human approval' : activeVersion.status === 'production' ? 'Already live' : 'Blocked'}</b></article>
            </div>
            <div className={styles.approval}>
              <span>OPTIONAL APPROVAL NOTE</span>
              <textarea value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} placeholder="What did you review before approving this version?" />
              <button disabled={Boolean(working) || !releaseReady || Boolean(candidate && candidate.version_id !== activeVersion.id)} onClick={() => void approveRelease()}>{working === 'approval' ? 'Approving…' : candidate?.version_id === activeVersion.id ? 'Already approved as candidate' : `Approve v${activeVersion.version_no} for release`}</button>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}><div><span>STEP 2</span><h3>Promote exact preview</h3></div><small>No rebuild</small></div>
            {!candidate ? <div className={styles.empty}>Approve a QA-passed version first. Production promotion is unavailable without a release candidate.</div> : <>
              <div className={styles.releaseState}>
                <article><span>Candidate</span><b>v{candidateVersion?.version_no ?? '?'} · {pretty(candidate.status)}</b></article>
                <article><span>Preview deployment</span><b>{candidate.preview_deployment_id}</b></article>
                <article><span>Source fingerprint</span><b className={styles.fingerprint}>{candidate.source_fingerprint}</b></article>
                <article><span>Previous production</span><b>{candidate.previous_production_deployment_id || 'Captured at promotion time'}</b></article>
              </div>
              {candidate.status === 'approved' && <div className={styles.confirm}>
                <span>PRODUCTION CONFIRMATION</span>
                <h4>Type RELEASE to promote this exact preview.</h4>
                <p>Vercel will point production traffic to the QA-tested deployment ID. Website Studio will then fetch all three live files and compare their SHA-256 hashes with the approved snapshot.</p>
                <input value={releaseConfirm} onChange={(event) => setReleaseConfirm(event.target.value.toUpperCase())} placeholder="RELEASE" />
                <button disabled={Boolean(working) || releaseConfirm !== 'RELEASE'} onClick={() => void releaseProduction()}>{working === 'release' ? 'Promoting + verifying…' : 'Release to production'}</button>
              </div>}
              {candidate.status === 'smoke_failed' && <div className={styles.error}>Production promotion occurred, but exact-source smoke verification failed. Roll back rather than treating this version as live.</div>}
            </>}
          </section>
        </div>

        {liveRelease && <section className={styles.card}>
          <div className={styles.cardHead}><div><span>LIVE RELEASE</span><h3>Verified production state</h3></div><small>{liveRelease.promoted_at ? new Date(liveRelease.promoted_at).toLocaleString() : ''}</small></div>
          <div className={styles.releaseState}>
            <article><span>Production URL</span><b>{liveRelease.production_url || 'Not recorded'}</b></article>
            <article><span>Deployment ID</span><b>{liveRelease.production_deployment_id || liveRelease.preview_deployment_id}</b></article>
            <article><span>Smoke test</span><b>{pretty(liveRelease.smoke_status)} · exact source match</b></article>
            <article><span>Rollback target</span><b>{liveRelease.previous_production_deployment_id || 'None — first Website Studio release'}</b></article>
          </div>
          {liveRelease.production_url && <a href={liveRelease.production_url} target="_blank" rel="noreferrer" style={{ color: '#355246', fontSize: 10, fontWeight: 850, textDecoration: 'none' }}>Open production ↗</a>}
        </section>}

        {rollbackTarget?.previous_production_deployment_id && <section className={styles.rollback}>
          <h4>Rollback control</h4>
          <p>Rollback will target the recorded previous deployment ID only. Website Studio will verify the restored live files against the previous release snapshot before declaring success.</p>
          <input value={rollbackConfirm} onChange={(event) => setRollbackConfirm(event.target.value.toUpperCase())} placeholder="Type ROLLBACK" />
          <button disabled={Boolean(working) || rollbackConfirm !== 'ROLLBACK'} onClick={() => void rollbackProduction()}>{working === 'rollback' ? 'Rolling back + verifying…' : 'Rollback production'}</button>
        </section>}
      </>}

      <section className={styles.history}>
        <span>RELEASE HISTORY</span>
        <div className={styles.historyList}>
          {releases.length === 0 && <div className={styles.empty}>No human-approved Website Studio releases have been recorded yet.</div>}
          {releases.map((release) => {
            const version = versions.find((row) => row.id === release.version_id);
            return <article key={release.id}><span>v{version?.version_no ?? '?'}</span><div><b>{pretty(release.status)} · smoke {pretty(release.smoke_status)}</b><p>{release.production_url || release.preview_deployment_id}</p></div><em>{new Date(release.created_at).toLocaleString()}</em>{release.production_url ? <a href={release.production_url} target="_blank" rel="noreferrer">Open ↗</a> : <span />}</article>;
          })}
        </div>
      </section>
    </section>
  );
}
