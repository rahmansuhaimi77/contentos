'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type Brand = {
  id: string;
  workspace_id: string;
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

const emptyBrand: Brand = {
  id: '',
  workspace_id: '',
  name: '',
  product: '',
  audience: '',
  positioning: '',
  voice: 'Conversational, confident, useful, natural. No corporate jargon.',
  offer: '',
  proof: '',
  preferred_cta: '',
  avoid: 'Fake urgency, exaggerated claims, generic AI wording.',
};

export default function BrandPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [workspaceId, setWorkspaceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [assetCount, setAssetCount] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data.user ?? null);
      if (!data.user) { setLoading(false); return; }

      const { data: workspaces } = await supabase.from('contentos_workspaces').select('id').order('created_at').limit(1);
      const workspace = workspaces?.[0]?.id || '';
      setWorkspaceId(workspace);

      const saved = window.localStorage.getItem('contentos:selectedBrandId') || '';
      await load(saved);
      setLoading(false);
    }
    async function onBrandChange(event: Event) {
      setMessage(''); setError('');
      await load((event as CustomEvent<{ brandId: string }>).detail.brandId);
    }
    void init();
    window.addEventListener('contentos:brand-change', onBrandChange);
    return () => { mounted = false; window.removeEventListener('contentos:brand-change', onBrandChange); };
  }, [supabase]);

  async function load(brandId: string) {
    if (!brandId) { setBrand(null); setKnowledgeCount(0); setAssetCount(0); return; }
    const [brandRes, knowledgeRes, assetsRes] = await Promise.all([
      supabase.from('contentos_brands').select('id,workspace_id,name,product,audience,positioning,voice,offer,proof,preferred_cta,avoid').eq('id', brandId).maybeSingle(),
      supabase.from('contentos_knowledge_items').select('id', { count: 'exact', head: true }).eq('brand_id', brandId),
      supabase.from('contentos_brand_assets').select('id', { count: 'exact', head: true }).eq('brand_id', brandId),
    ]);
    if (brandRes.error) setError(brandRes.error.message);
    setBrand((brandRes.data as Brand | null) ?? null);
    setKnowledgeCount(knowledgeRes.count ?? 0);
    setAssetCount(assetsRes.count ?? 0);
  }

  function startNewBrand() {
    setBrand({ ...emptyBrand, workspace_id: workspaceId });
    setKnowledgeCount(0); setAssetCount(0); setMessage('New Brand Brain started.'); setError('');
  }

  async function saveBrand() {
    if (!user || !brand || !brand.name.trim() || !brand.product.trim() || !brand.audience.trim()) {
      setError('Brand name, product/service and audience are required.');
      return;
    }
    setSaving(true); setError(''); setMessage('');
    const payload = {
      workspace_id: brand.workspace_id || workspaceId,
      name: brand.name.trim(),
      product: brand.product,
      audience: brand.audience,
      positioning: brand.positioning,
      voice: brand.voice,
      offer: brand.offer,
      proof: brand.proof,
      preferred_cta: brand.preferred_cta,
      avoid: brand.avoid,
      updated_at: new Date().toISOString(),
    };

    if (brand.id) {
      const { error: saveError } = await supabase.from('contentos_brands').update(payload).eq('id', brand.id);
      if (saveError) setError(saveError.message);
      else setMessage('Brand Brain saved. New content will use the updated brand profile.');
      setSaving(false);
      return;
    }

    const { data, error: saveError } = await supabase.from('contentos_brands').insert(payload).select('id').single();
    if (saveError) { setError(saveError.message); setSaving(false); return; }
    window.localStorage.setItem('contentos:selectedBrandId', data.id);
    setMessage('Brand created. Reloading the workspace…');
    window.location.href = '/brand';
  }

  if (loading) return <section className="unifiedPage"><div className="dashboardSkeleton">Loading brand…</div></section>;
  if (!user) return <section className="unifiedPage"><div className="dashboardEmpty"><h1>Sign in first</h1><Link className="appPrimary" href="/login">Sign in</Link></div></section>;

  return (
    <section className="unifiedPage">
      <header className="pageHero compactHero">
        <div><span className="eyebrow">BRAND</span><h1>{brand?.name || 'Brand Brain'}</h1><p>The single source of truth for positioning, voice, knowledge and approved creative assets.</p></div>
        <button className="appPrimary" onClick={startNewBrand}>+ New brand</button>
      </header>

      {message && <div className="notice">{message}</div>}
      {error && <div className="error globalError">{error}</div>}

      {!brand ? <div className="dashboardEmpty"><h2>No brand selected.</h2><p>Select a brand from the global switcher or create a new one.</p></div> : <div className="brandHubGrid">
        <section className="dashboardPanel brandProfileCard">
          <div className="dashboardPanelHead"><div><span className="eyebrow">PROFILE</span><h2>Brand Brain</h2></div></div>
          <label className="field"><span>Brand name</span><input value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })} /></label>
          <label className="field"><span>Product / service</span><textarea rows={3} value={brand.product} onChange={(e) => setBrand({ ...brand, product: e.target.value })} /></label>
          <label className="field"><span>Audience</span><textarea rows={3} value={brand.audience} onChange={(e) => setBrand({ ...brand, audience: e.target.value })} /></label>
          <label className="field"><span>Positioning</span><textarea rows={3} value={brand.positioning} onChange={(e) => setBrand({ ...brand, positioning: e.target.value })} /></label>
          <label className="field"><span>Voice</span><textarea rows={3} value={brand.voice} onChange={(e) => setBrand({ ...brand, voice: e.target.value })} /></label>
          <label className="field"><span>Current offer / context</span><textarea rows={2} value={brand.offer} onChange={(e) => setBrand({ ...brand, offer: e.target.value })} /></label>
          <label className="field"><span>Proof / trust</span><textarea rows={3} value={brand.proof} onChange={(e) => setBrand({ ...brand, proof: e.target.value })} /></label>
          <label className="field"><span>Preferred CTA</span><input value={brand.preferred_cta} onChange={(e) => setBrand({ ...brand, preferred_cta: e.target.value })} /></label>
          <label className="field"><span>Never do / say</span><textarea rows={3} value={brand.avoid} onChange={(e) => setBrand({ ...brand, avoid: e.target.value })} /></label>
          <button className="generate" disabled={saving} onClick={saveBrand}>{saving ? 'Saving…' : 'Save Brand Brain'}</button>
        </section>

        <div className="brandResourceStack">
          <Link href="/knowledge" className="resourceCard"><span>KNOWLEDGE</span><strong>{knowledgeCount}</strong><h3>Knowledge Base</h3><p>Product facts, guidelines, FAQs, strategy and verified context.</p><em>Open Knowledge →</em></Link>
          <Link href="/assets" className="resourceCard"><span>ASSETS</span><strong>{assetCount}</strong><h3>Brand Assets</h3><p>Logos, visual profile, screenshots and approved source materials.</p><em>Open Assets →</em></Link>
        </div>
      </div>}
    </section>
  );
}
