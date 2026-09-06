'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import BuildPanel from '../build-panel';

type Site = {
  id: string;
  business_name: string;
  slug: string;
  brand_id: string | null;
  brief_status: string;
  approved_direction_count: number;
  approved_reference_count: number;
  section_count: number;
};

export default function WebsiteBuildPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [activeId, setActiveId] = useState('');
  const [loading, setLoading] = useState(true);
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

  async function loadSites() {
    const [siteRes, briefRes, directionRes, referenceRes, sectionRes] = await Promise.all([
      supabase.from('growth_websites').select('id,business_name,slug,template_version').eq('template_version', 'production_v2').order('created_at', { ascending: false }),
      supabase.from('growth_website_briefs').select('website_id,brand_id,status'),
      supabase.from('growth_website_directions').select('website_id,status').eq('status', 'approved'),
      supabase.from('growth_website_references').select('website_id,approved').eq('approved', true),
      supabase.from('growth_website_sections').select('website_id,id'),
    ]);
    const firstError = siteRes.error || briefRes.error || directionRes.error || referenceRes.error || sectionRes.error;
    if (firstError) { setError(firstError.message); return; }
    const briefs = new Map((briefRes.data ?? []).map((brief) => [brief.website_id, brief]));
    const directionCounts = new Map<string, number>();
    const referenceCounts = new Map<string, number>();
    const sectionCounts = new Map<string, number>();
    for (const row of directionRes.data ?? []) directionCounts.set(row.website_id, (directionCounts.get(row.website_id) || 0) + 1);
    for (const row of referenceRes.data ?? []) referenceCounts.set(row.website_id, (referenceCounts.get(row.website_id) || 0) + 1);
    for (const row of sectionRes.data ?? []) sectionCounts.set(row.website_id, (sectionCounts.get(row.website_id) || 0) + 1);
    const next = (siteRes.data ?? []).map((site) => {
      const brief = briefs.get(site.id);
      return {
        id: site.id,
        business_name: site.business_name,
        slug: site.slug,
        brand_id: brief?.brand_id ?? null,
        brief_status: brief?.status ?? 'missing',
        approved_direction_count: directionCounts.get(site.id) || 0,
        approved_reference_count: referenceCounts.get(site.id) || 0,
        section_count: sectionCounts.get(site.id) || 0,
      } as Site;
    });
    const activeBrandId = window.localStorage.getItem('contentos:selectedBrandId');
    const visible = next.filter((site) => site.brand_id === activeBrandId);
    setSites(visible);
    const preferred = visible[0]?.id || '';
    setActiveId((current) => visible.some((site) => site.id === current) ? current : preferred);
  }

  const activeSite = sites.find((site) => site.id === activeId) ?? null;
  const buildReady = Boolean(activeSite && ['verified', 'approved'].includes(activeSite.brief_status) && activeSite.approved_direction_count === 1 && activeSite.approved_reference_count >= 3 && activeSite.section_count >= 5);

  if (loading) return <section><div className="dashboardSkeleton">Loading build workspace…</div></section>;
  if (!user) return <section><div className="dashboardEmpty"><h1>Sign in first</h1><p>Website builds are available inside your authenticated ContentOS workspace.</p></div></section>;

  return (
    <section>
      <header className="pageHero compactHero">
        <div><span className="eyebrow">WEBSITE STUDIO · V2.2</span><h1>Build + preview runner</h1><p>Approved plan → versioned source snapshot → isolated Vercel preview. Production promotion is intentionally not available here.</p></div>
        <label style={{ display: 'grid', gap: 6, minWidth: 240, fontSize: 10, fontWeight: 800, color: '#6b6f68' }}>
          WEBSITE PROJECT
          <select value={activeId} onChange={(event) => setActiveId(event.target.value)} style={{ border: '1px solid #d9d6ce', background: '#fffdf8', borderRadius: 10, padding: '10px 11px', fontSize: 12 }}>
            {sites.length === 0 && <option value="">No production v2 projects</option>}
            {sites.map((site) => <option value={site.id} key={site.id}>{site.business_name} · {site.slug}</option>)}
          </select>
        </label>
      </header>

      {error && <div className="error globalError">{error}</div>}
      {!activeSite ? <div className="dashboardEmpty"><h2>Create a production v2 website first.</h2><p>Complete the brief, research and production-plan stages before building.</p></div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8, marginBottom: 14 }}>
            <Gate label="Brief" value={activeSite.brief_status} pass={['verified', 'approved'].includes(activeSite.brief_status)} />
            <Gate label="References" value={`${activeSite.approved_reference_count} approved`} pass={activeSite.approved_reference_count >= 3} />
            <Gate label="Direction" value={activeSite.approved_direction_count === 1 ? 'Approved' : 'Missing'} pass={activeSite.approved_direction_count === 1} />
            <Gate label="Sections" value={`${activeSite.section_count} planned`} pass={activeSite.section_count >= 5} />
          </div>
          {!buildReady && <div className="notice">Build remains locked until the brief is verified, at least 3 references are approved, exactly 1 direction is approved, and the production plan contains at least 5 sections.</div>}
          {buildReady && <BuildPanel websiteId={activeSite.id} onChanged={() => void loadSites()} />}
        </>
      )}
    </section>
  );
}

function Gate({ label, value, pass }: { label: string; value: string; pass: boolean }) {
  return <article style={{ background: pass ? '#ecf3ed' : '#fffdf8', border: `1px solid ${pass ? '#d5e3d8' : '#e0ddd5'}`, borderRadius: 13, padding: 13, display: 'grid', gap: 4 }}><span style={{ fontSize: 8, letterSpacing: '.12em', fontWeight: 850, color: '#777b74' }}>{label.toUpperCase()}</span><b style={{ fontSize: 12 }}>{value}</b></article>;
}
