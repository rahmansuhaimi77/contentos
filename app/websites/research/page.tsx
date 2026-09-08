'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import ResearchPanel from '../research-panel';

type Site = {
  id: string;
  business_name: string;
  slug: string;
  brand_id: string | null;
  brief_status: string;
};

export default function WebsiteResearchPage() {
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
    const [siteRes, briefRes] = await Promise.all([
      supabase.from('growth_websites').select('id,business_name,slug,template_version').eq('template_version', 'production_v2').order('created_at', { ascending: false }),
      supabase.from('growth_website_briefs').select('website_id,brand_id,status'),
    ]);
    const firstError = siteRes.error || briefRes.error;
    if (firstError) { setError(firstError.message); return; }
    const briefByWebsite = new Map((briefRes.data ?? []).map((brief) => [brief.website_id, brief]));
    const next = (siteRes.data ?? []).map((site) => {
      const brief = briefByWebsite.get(site.id);
      return { id: site.id, business_name: site.business_name, slug: site.slug, brand_id: brief?.brand_id ?? null, brief_status: brief?.status ?? 'missing' } as Site;
    });
    const activeBrandId = window.localStorage.getItem('contentos:selectedBrandId');
    const visible = next.filter((site) => site.brand_id === activeBrandId);
    setSites(visible);
    const preferred = visible[0]?.id || '';
    setActiveId((current) => visible.some((site) => site.id === current) ? current : preferred);
  }

  const activeSite = sites.find((site) => site.id === activeId) ?? null;

  if (loading) return <section><div className="dashboardSkeleton">Loading research workspace…</div></section>;
  if (!user) return <section><div className="dashboardEmpty"><h1>Sign in first</h1><p>Website research is available inside your authenticated ContentOS workspace.</p></div></section>;

  return (
    <section>
      <header className="pageHero compactHero">
        <div><span className="eyebrow">WEBSITE STUDIO · V2.1</span><h1>Research + production planning</h1><p>Verified business truth → grounded references → three creative directions → approved direction → Codex-ready section architecture.</p></div>
        <label style={{ display: 'grid', gap: 6, minWidth: 240, fontSize: 10, fontWeight: 800, color: '#6b6f68' }}>
          WEBSITE PROJECT
          <select value={activeId} onChange={(event) => setActiveId(event.target.value)} style={{ border: '1px solid #d9d6ce', background: '#fffdf8', borderRadius: 10, padding: '10px 11px', fontSize: 12 }}>
            {sites.length === 0 && <option value="">No production v2 projects</option>}
            {sites.map((site) => <option value={site.id} key={site.id}>{site.business_name} · {site.slug}</option>)}
          </select>
        </label>
      </header>

      {error && <div className="error globalError">{error}</div>}
      {!activeSite ? <div className="dashboardEmpty"><h2>Create a production v2 website first.</h2><p>Use Website Studio to create a project from the active Brand Brain, verify its facts, then return here for research.</p></div> : (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: 11, color: '#6b6f68' }}><b style={{ color: '#273a32' }}>{activeSite.business_name}</b><span>•</span><span>Brief: {activeSite.brief_status}</span></div>
          <ResearchPanel websiteId={activeSite.id} briefStatus={activeSite.brief_status} onChanged={() => void loadSites()} />
        </>
      )}
    </section>
  );
}
