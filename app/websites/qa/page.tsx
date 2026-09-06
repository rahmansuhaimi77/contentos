'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import styles from './qa.module.css';

type Site = { id: string; business_name: string; slug: string; brand_id: string | null };
type Version = {
  id: string;
  website_id: string;
  version_no: number;
  label: string;
  preview_url: string | null;
  status: string;
  qa_score: number | null;
  qa_status: string | null;
  qa_summary: any;
  qa_completed_at: string | null;
  source_snapshot: any;
};
type Check = {
  id: string;
  category: string;
  checkpoint: string;
  device: string;
  severity: string;
  status: string;
  score: number | null;
  notes: string;
  evidence_url: string | null;
  details: any;
};

function pretty(value?: string | null) {
  if (!value) return 'Not set';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function WebsiteQaPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [activeSiteId, setActiveSiteId] = useState('');
  const [activeVersionId, setActiveVersionId] = useState('');
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

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
    if (!activeSiteId) { setVersions([]); setActiveVersionId(''); setChecks([]); return; }
    void loadVersions(activeSiteId);
  }, [activeSiteId]);

  useEffect(() => {
    if (!activeVersionId) { setChecks([]); return; }
    void loadChecks(activeVersionId);
  }, [activeVersionId]);

  async function loadSites() {
    const [siteRes, briefRes] = await Promise.all([
      supabase.from('growth_websites').select('id,business_name,slug,template_version').eq('template_version', 'production_v2').order('created_at', { ascending: false }),
      supabase.from('growth_website_briefs').select('website_id,brand_id'),
    ]);
    const firstError = siteRes.error || briefRes.error;
    if (firstError) { setError(firstError.message); return; }
    const brandBySite = new Map((briefRes.data ?? []).map((row) => [row.website_id, row.brand_id]));
    const next = (siteRes.data ?? []).map((site) => ({ id: site.id, business_name: site.business_name, slug: site.slug, brand_id: brandBySite.get(site.id) ?? null } as Site));
    const activeBrandId = window.localStorage.getItem('contentos:selectedBrandId');
    const visible = next.filter((site) => site.brand_id === activeBrandId);
    setSites(visible);
    const preferred = visible[0]?.id || '';
    setActiveSiteId((current) => visible.some((site) => site.id === current) ? current : preferred);
  }

  async function loadVersions(websiteId: string) {
    const { data, error: versionError } = await supabase
      .from('growth_website_versions')
      .select('id,website_id,version_no,label,preview_url,status,qa_score,qa_status,qa_summary,qa_completed_at,source_snapshot')
      .eq('website_id', websiteId)
      .order('version_no', { ascending: false });
    if (versionError) { setError(versionError.message); return; }
    const next = (data ?? []) as Version[];
    setVersions(next);
    const preferred = next.find((version) => version.preview_url)?.id || next[0]?.id || '';
    setActiveVersionId((current) => next.some((version) => version.id === current) ? current : preferred);
  }

  async function loadChecks(versionId: string) {
    const { data, error: checkError } = await supabase
      .from('growth_website_qa_checks')
      .select('id,category,checkpoint,device,severity,status,score,notes,evidence_url,details')
      .eq('version_id', versionId)
      .order('created_at');
    if (checkError) setError(checkError.message);
    setChecks((data ?? []) as Check[]);
  }

  async function authToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }

  async function runQa() {
    if (!activeVersion || !activeSite) return;
    if (!activeVersion.preview_url) {
      setError('Deploy this exact version to a Vercel preview before rendered QA.');
      return;
    }
    const token = await authToken();
    if (!token) { setError('Your session expired. Sign in again.'); return; }
    setWorking(true);
    setNotice('');
    setError('');
    try {
      const response = await fetch('/api/websites/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ websiteId: activeSite.id, versionId: activeVersion.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Rendered QA failed.');
      setNotice(payload.status === 'pass'
        ? `Rendered QA passed at ${payload.overall_score}/100. This still requires explicit human release approval.`
        : `Rendered QA completed at ${payload.overall_score}/100. Fix the recorded defects before release.`);
      await loadVersions(activeSite.id);
      await loadChecks(activeVersion.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Rendered QA failed.');
    } finally {
      setWorking(false);
    }
  }

  const activeSite = sites.find((site) => site.id === activeSiteId) ?? null;
  const activeVersion = versions.find((version) => version.id === activeVersionId) ?? null;
  const summary = activeVersion?.qa_summary || {};
  const visualChecks = checks.filter((check) => check.category === 'visual');
  const lighthouseChecks = checks.filter((check) => check.category === 'lighthouse');
  const findings = checks.filter((check) => ['visual_finding', 'technical_finding', 'release_gate'].includes(check.category) && check.status === 'fail');
  const blockers = findings.filter((check) => ['high', 'blocker'].includes(check.severity)).length;
  const pendingAssets = Number(activeVersion?.source_snapshot?.pending_asset_count || summary.pending_asset_count || 0);

  if (loading) return <section><div className="dashboardSkeleton">Loading rendered QA…</div></section>;
  if (!user) return <section><div className="dashboardEmpty"><h1>Sign in first</h1><p>Rendered QA is available inside your authenticated ContentOS workspace.</p></div></section>;

  return (
    <section className={styles.page}>
      <header className="pageHero compactHero">
        <div><span className="eyebrow">WEBSITE STUDIO · V2.3</span><h1>Rendered visual QA</h1><p>Real mobile + desktop render evidence → visual review → Lighthouse → defects → score → release decision.</p></div>
      </header>

      <div className={styles.picker}>
        <label>WEBSITE PROJECT<select value={activeSiteId} onChange={(event) => setActiveSiteId(event.target.value)}>{sites.length === 0 && <option value="">No production v2 projects</option>}{sites.map((site) => <option value={site.id} key={site.id}>{site.business_name} · {site.slug}</option>)}</select></label>
        <label>SOURCE VERSION<select value={activeVersionId} onChange={(event) => setActiveVersionId(event.target.value)}>{versions.length === 0 && <option value="">No builds yet</option>}{versions.map((version) => <option value={version.id} key={version.id}>v{version.version_no} · {version.label || pretty(version.status)}</option>)}</select></label>
      </div>

      {notice && <div className={styles.notice}>{notice}</div>}
      {error && <div className={styles.error}>{error}</div>}

      {!activeVersion ? <div className={styles.empty}>Build a version first, then deploy it to a Vercel preview before rendered QA can run.</div> : (
        <>
          <div className={styles.summary}>
            <article><span>QA STATUS</span><b>{activeVersion.qa_status ? pretty(activeVersion.qa_status) : 'Not run'}</b><small>{activeVersion.qa_completed_at ? new Date(activeVersion.qa_completed_at).toLocaleString() : 'No rendered evidence recorded yet'}</small></article>
            <article className={activeVersion.qa_status === 'pass' ? styles.pass : activeVersion.qa_status ? styles.fail : ''}><span>OVERALL</span><b>{activeVersion.qa_score ?? '—'}</b><small>Pass threshold: 85/100</small></article>
            <article><span>VISUAL</span><b>{summary.visual_score ?? '—'}</b><small>Hierarchy · composition · crop · type · specificity · mobile</small></article>
            <article><span>COPY + CTA</span><b>{summary.content_conversion_score ?? '—'}</b><small>Authenticity and conversion clarity</small></article>
            <article className={blockers ? styles.fail : ''}><span>HIGH/BLOCKERS</span><b>{blockers || 0}</b><small>{blockers ? 'Release remains blocked' : 'None recorded'}</small></article>
          </div>

          <div className={styles.actions}>
            <div><b>Evidence source: {activeVersion.preview_url ? 'Vercel preview' : 'Missing preview'}</b><span>{activeVersion.preview_url ? 'PageSpeed/Lighthouse renders the exact saved preview on mobile and desktop, then visual QA reviews those screenshots.' : 'QA will not run against plans, source code or a guessed URL.'}</span></div>
            <button disabled={working || !activeVersion.preview_url} onClick={() => void runQa()}>{working ? 'Rendering + reviewing…' : activeVersion.qa_completed_at ? 'Re-run rendered QA' : 'Run rendered QA'}</button>
          </div>

          {activeVersion.preview_url && <div style={{ fontSize: 10 }}><a href={activeVersion.preview_url} target="_blank" rel="noreferrer" style={{ color: '#355246', fontWeight: 850, textDecoration: 'none' }}>Open exact preview ↗</a></div>}

          <div className={styles.grid}>
            <section className={styles.card}>
              <div className={styles.cardHead}><div><span>VISUAL REVIEW</span><h3>Designed quality</h3></div></div>
              <div className={styles.visualList}>
                {visualChecks.length === 0 && <div className={styles.empty}>Run rendered QA to score hierarchy, composition, crop safety, typography, brand specificity, copy, CTA clarity and mobile quality.</div>}
                {visualChecks.map((check) => <article className={styles.visualItem} key={check.id}><div><b>{pretty(check.checkpoint)}</b><strong>{check.score ?? '—'}</strong></div><p>{check.notes}</p></article>)}
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHead}><div><span>LIGHTHOUSE</span><h3>Technical render health</h3></div></div>
              <div className={styles.lighthouse}>
                {(['mobile', 'desktop'] as const).map((device) => <div className={styles.device} key={device}><span>{device.toUpperCase()}</span>{['performance', 'accessibility', 'seo', 'best_practices'].map((metric) => { const row = lighthouseChecks.find((check) => check.device === device && check.checkpoint === metric); return <div className={styles.metric} key={metric}><span>{pretty(metric)}</span><b>{row?.score ?? '—'}</b></div>; })}</div>)}
              </div>
            </section>
          </div>

          <section className={styles.card}>
            <div className={styles.cardHead}><div><span>DEFECT REGISTER</span><h3>What must be fixed</h3></div><small>{findings.length} open finding{findings.length === 1 ? '' : 's'}</small></div>
            <div className={styles.findings}>
              {findings.length === 0 && <div className={styles.empty}>{activeVersion.qa_completed_at ? 'No failed findings are recorded for this QA run.' : 'Findings will appear here after rendered QA.'}</div>}
              {findings.map((finding) => <article className={`${styles.finding} ${styles[`sev_${finding.severity}`] || ''}`} key={finding.id}><div className={styles.findingTop}><b>{finding.checkpoint}</b><span>{finding.severity.toUpperCase()} · {pretty(finding.device)}</span></div><p>{finding.notes}</p><small>{pretty(finding.category)}</small></article>)}
            </div>
          </section>

          <section className={styles.release}>
            <div><span>RELEASE BOUNDARY</span><h3>{activeVersion.qa_status === 'pass' && pendingAssets === 0 ? 'QA passed — human release gate is next.' : 'Production remains locked.'}</h3><p>{activeVersion.qa_status === 'pass' && pendingAssets === 0 ? 'This version has passed the automated rendered gate, but v2.3 does not promote anything to production. The next stage will approve and promote this exact preview artifact without rebuilding it.' : `This version cannot proceed while QA needs fixes${pendingAssets ? ` or ${pendingAssets} visual asset${pendingAssets === 1 ? '' : 's'} remain pending` : ''}.`}</p></div>
            <div className={styles.badge}><b>{activeVersion.qa_score ?? '—'}/100</b><small>{activeVersion.qa_status ? pretty(activeVersion.qa_status) : 'QA not run'}</small></div>
          </section>
        </>
      )}
    </section>
  );
}
