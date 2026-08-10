'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type Brand = {
  id: string;
  name: string;
  product: string;
  audience: string;
  positioning: string;
  voice: string;
  offer: string;
  proof: string;
  preferred_cta: string;
  avoid: string;
};

export default function BrandPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [assetCount, setAssetCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data.user ?? null);
      if (!data.user) { setLoading(false); return; }
      const saved = window.localStorage.getItem('contentos:selectedBrandId') || '';
      await load(saved);
      setLoading(false);
    }
    async function onBrandChange(event: Event) {
      await load((event as CustomEvent<{ brandId: string }>).detail.brandId);
    }
    init();
    window.addEventListener('contentos:brand-change', onBrandChange);
    return () => { mounted = false; window.removeEventListener('contentos:brand-change', onBrandChange); };
  }, [supabase]);

  async function load(brandId: string) {
    if (!brandId) { setBrand(null); return; }
    const [brandRes, knowledgeRes, assetsRes] = await Promise.all([
      supabase.from('contentos_brands').select('id,name,product,audience,positioning,voice,offer,proof,preferred_cta,avoid').eq('id', brandId).maybeSingle(),
      supabase.from('contentos_knowledge_items').select('id', { count: 'exact', head: true }).eq('brand_id', brandId),
      supabase.from('contentos_brand_assets').select('id', { count: 'exact', head: true }).eq('brand_id', brandId),
    ]);
    setBrand((brandRes.data as Brand | null) ?? null);
    setKnowledgeCount(knowledgeRes.count ?? 0);
    setAssetCount(assetsRes.count ?? 0);
  }

  if (loading) return <section className="unifiedPage"><div className="dashboardSkeleton">Loading brand…</div></section>;
  if (!user) return <section className="unifiedPage"><div className="dashboardEmpty"><h1>Sign in first</h1><p>Open Create and sign in to access your brand workspace.</p></div></section>;

  return (
    <section className="unifiedPage">
      <header className="pageHero compactHero"><div><span className="eyebrow">BRAND</span><h1>{brand?.name || 'Brand workspace'}</h1><p>Profile, knowledge and creative assets that power every plan and campaign.</p></div></header>

      {!brand ? <div className="dashboardEmpty"><h2>No brand selected.</h2><p>Select a brand from the global switcher.</p></div> : <>
        <div className="brandHubGrid">
          <section className="dashboardPanel brandProfileCard">
            <div className="dashboardPanelHead"><div><span className="eyebrow">PROFILE</span><h2>Brand Brain</h2></div><Link href="/create">Open editor →</Link></div>
            <dl className="brandFacts">
              <div><dt>Product</dt><dd>{brand.product || 'Not set'}</dd></div>
              <div><dt>Audience</dt><dd>{brand.audience || 'Not set'}</dd></div>
              <div><dt>Positioning</dt><dd>{brand.positioning || 'Not set'}</dd></div>
              <div><dt>Voice</dt><dd>{brand.voice || 'Not set'}</dd></div>
              <div><dt>Preferred CTA</dt><dd>{brand.preferred_cta || 'Not set'}</dd></div>
              <div><dt>Avoid</dt><dd>{brand.avoid || 'Not set'}</dd></div>
            </dl>
          </section>

          <div className="brandResourceStack">
            <Link href="/knowledge" className="resourceCard"><span>KNOWLEDGE</span><strong>{knowledgeCount}</strong><h3>Knowledge Base</h3><p>Product facts, guidelines, FAQs, strategy and verified context.</p><em>Open Knowledge →</em></Link>
            <Link href="/assets" className="resourceCard"><span>ASSETS</span><strong>{assetCount}</strong><h3>Brand Assets</h3><p>Logos, visual profile and approved source materials.</p><em>Open Assets →</em></Link>
          </div>
        </div>
      </>}
    </section>
  );
}
