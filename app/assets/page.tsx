'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type Brand = { id: string; name: string };
type AssetKind = 'logo' | 'screenshot' | 'vehicle' | 'visual_reference' | 'other';
type Asset = {
  id: string;
  brand_id: string;
  kind: AssetKind;
  title: string;
  storage_path: string;
  mime_type: string | null;
  notes: string | null;
  created_at: string;
  preview_url?: string;
};
type VisualProfile = {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_notes: string;
  visual_style: string;
  image_rules: string;
};

const assetKinds: Array<{ value: AssetKind; label: string }> = [
  { value: 'logo', label: 'Logo / brand mark' },
  { value: 'screenshot', label: 'App / website / WhatsApp screenshot' },
  { value: 'vehicle', label: 'Vehicle / product photo' },
  { value: 'visual_reference', label: 'Visual style reference' },
  { value: 'other', label: 'Other' },
];

const emptyVisual: VisualProfile = {
  primary_color: '',
  secondary_color: '',
  accent_color: '',
  font_notes: '',
  visual_style: '',
  image_rules: '',
};

export default function AssetsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [visual, setVisual] = useState<VisualProfile>(emptyVisual);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [kind, setKind] = useState<AssetKind>('logo');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [savingVisual, setSavingVisual] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
      if (!data.user) { setLoading(false); return; }

      const { data: rows, error: brandError } = await supabase
        .from('contentos_brands')
        .select('id,name')
        .order('updated_at', { ascending: false });
      if (brandError) setError(brandError.message);
      const next = (rows ?? []) as Brand[];
      setBrands(next);
      if (next[0]) setBrandId(next[0].id);
      setLoading(false);
    }
    init();
  }, [supabase]);

  useEffect(() => {
    if (brandId) void loadBrandAssets(brandId);
  }, [brandId]);

  async function loadBrandAssets(id: string) {
    setError('');
    const [visualResult, assetResult] = await Promise.all([
      supabase
        .from('contentos_brand_visuals')
        .select('primary_color,secondary_color,accent_color,font_notes,visual_style,image_rules')
        .eq('brand_id', id)
        .maybeSingle(),
      supabase
        .from('contentos_brand_assets')
        .select('id,brand_id,kind,title,storage_path,mime_type,notes,created_at')
        .eq('brand_id', id)
        .order('created_at', { ascending: false }),
    ]);

    if (visualResult.error) setError(visualResult.error.message);
    setVisual((visualResult.data as VisualProfile | null) ?? emptyVisual);

    if (assetResult.error) { setError(assetResult.error.message); return; }
    const rows = (assetResult.data ?? []) as Asset[];
    const withUrls = await Promise.all(rows.map(async (asset) => {
      const { data } = await supabase.storage.from('contentos-assets').createSignedUrl(asset.storage_path, 3600);
      return { ...asset, preview_url: data?.signedUrl };
    }));
    setAssets(withUrls);
  }

  async function saveVisual(e: FormEvent) {
    e.preventDefault();
    if (!brandId) return;
    setSavingVisual(true); setError(''); setMessage('');
    const { error: saveError } = await supabase
      .from('contentos_brand_visuals')
      .upsert({ brand_id: brandId, ...visual, updated_at: new Date().toISOString() }, { onConflict: 'brand_id' });
    setSavingVisual(false);
    if (saveError) { setError(saveError.message); return; }
    setMessage('Visual profile saved. Future production prompts can now use these brand rules.');
  }

  async function uploadAsset(e: FormEvent) {
    e.preventDefault();
    if (!brandId || !file || !title.trim()) return;
    if (file.size > 5 * 1024 * 1024) { setError('File is larger than 5 MB.'); return; }
    if (!['image/png','image/jpeg','image/webp','image/svg+xml'].includes(file.type)) { setError('Use PNG, JPG, WEBP or SVG only.'); return; }

    setUploading(true); setError(''); setMessage('');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const storagePath = `${brandId}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('contentos-assets')
      .upload(storagePath, file, { cacheControl: '3600', upsert: false, contentType: file.type });

    if (uploadError) { setUploading(false); setError(uploadError.message); return; }

    const { error: rowError } = await supabase
      .from('contentos_brand_assets')
      .insert({
        brand_id: brandId,
        kind,
        title: title.trim(),
        storage_path: storagePath,
        mime_type: file.type,
        notes: notes.trim() || null,
      });

    if (rowError) {
      await supabase.storage.from('contentos-assets').remove([storagePath]);
      setUploading(false); setError(rowError.message); return;
    }

    setTitle(''); setNotes(''); setFile(null); setKind('logo');
    const input = document.getElementById('asset-file') as HTMLInputElement | null;
    if (input) input.value = '';
    await loadBrandAssets(brandId);
    setUploading(false);
    setMessage('Brand asset uploaded securely.');
  }

  async function removeAsset(asset: Asset) {
    if (!confirm(`Delete “${asset.title}”?`)) return;
    setError('');
    const { error: storageError } = await supabase.storage.from('contentos-assets').remove([asset.storage_path]);
    if (storageError) { setError(storageError.message); return; }
    const { error: rowError } = await supabase.from('contentos_brand_assets').delete().eq('id', asset.id);
    if (rowError) { setError(rowError.message); return; }
    await loadBrandAssets(brandId);
  }

  if (loading) return <main className="toolShell"><div className="toolCard">Loading Brand Assets…</div></main>;
  if (!user) return <main className="toolShell"><div className="toolCard"><h1>Sign in first</h1><p>Open ContentOS Studio, sign in, then return here.</p><a className="toolPrimaryLink" href="/">Open Studio</a></div></main>;

  return (
    <main className="toolShell">
      <header className="toolHeader">
        <div><span className="eyebrow">CONTENTOS · BRAND ASSETS</span><h1>Give the creative engine the real brand.</h1><p>Store the approved logo, visual rules, screenshots and reference images before generating storyboard visuals.</p></div>
        <nav className="toolNav"><a href="/">Campaign Studio</a><a href="/knowledge">Knowledge Base</a><a className="active" href="/assets">Brand Assets</a><a href="/planner">30-Day Planner</a></nav>
      </header>

      {message && <div className="notice">{message}</div>}
      {error && <div className="error globalError">{error}</div>}

      <div className="assetIntro panel">
        <div><span className="eyebrow">START HERE</span><h2>For SewaPro, upload the real references first.</h2><p>Best first set: transparent logo, website or WhatsApp screenshots, 3–5 representative vehicle photos, and 2–3 visual references you actually like. ContentOS will treat these as approved references, not invent replacements.</p></div>
      </div>

      <section className="toolGrid assetToolGrid">
        <div className="assetForms">
          <form className="panel" onSubmit={saveVisual}>
            <div className="panelHead"><span>01</span><div><h3>Visual profile</h3><p>Define the visual system without inventing brand details.</p></div></div>
            <label className="field"><span>Brand</span><select value={brandId} onChange={(e) => setBrandId(e.target.value)}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
            <div className="colorFieldGrid">
              <label className="field"><span>Primary colour</span><input value={visual.primary_color} onChange={(e) => setVisual({ ...visual, primary_color: e.target.value })} placeholder="#123456 or description" /></label>
              <label className="field"><span>Secondary colour</span><input value={visual.secondary_color} onChange={(e) => setVisual({ ...visual, secondary_color: e.target.value })} placeholder="#F2F2F2" /></label>
              <label className="field"><span>Accent colour</span><input value={visual.accent_color} onChange={(e) => setVisual({ ...visual, accent_color: e.target.value })} placeholder="#00AA88" /></label>
            </div>
            <label className="field"><span>Fonts / typography notes</span><textarea rows={3} value={visual.font_notes} onChange={(e) => setVisual({ ...visual, font_notes: e.target.value })} placeholder="e.g. Use Inter/Sans, bold hooks, sentence case, large mobile subtitles." /></label>
            <label className="field"><span>Visual style</span><textarea rows={4} value={visual.visual_style} onChange={(e) => setVisual({ ...visual, visual_style: e.target.value })} placeholder="e.g. Authentic Malaysian UGC, natural light, realistic phones, clean overlays, not glossy stock footage." /></label>
            <label className="field"><span>Image rules / never do</span><textarea rows={4} value={visual.image_rules} onChange={(e) => setVisual({ ...visual, image_rules: e.target.value })} placeholder="e.g. Never invent the logo, fake car plates, fake pricing, fake customer reviews or impossible UI screens." /></label>
            <button className="generate" disabled={savingVisual || !brandId}>{savingVisual ? 'Saving…' : 'Save Visual Profile'}</button>
          </form>

          <form className="panel" onSubmit={uploadAsset}>
            <div className="panelHead"><span>02</span><div><h3>Upload approved asset</h3><p>Private files. Maximum 5 MB each.</p></div></div>
            <label className="field"><span>Asset type</span><select value={kind} onChange={(e) => setKind(e.target.value as AssetKind)}>{assetKinds.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="field"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Primary SewaPro logo" /></label>
            <label className="field"><span>File</span><input id="asset-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
            <label className="field"><span>Notes (optional)</span><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How should ContentOS use this reference?" /></label>
            <button className="generate" disabled={uploading || !file || !title.trim()}>{uploading ? 'Uploading…' : '+ Upload Brand Asset'}</button>
          </form>
        </div>

        <section className="panel">
          <div className="panelHead"><span>{assets.length}</span><div><h3>Approved reference library</h3><p>Files ContentOS can use as the visual source of truth.</p></div></div>
          {assets.length === 0 && <div className="emptyState">No brand assets yet. Upload the real logo first.</div>}
          <div className="assetGrid">
            {assets.map((asset) => <article className="assetCard" key={asset.id}>
              <div className="assetPreview">{asset.preview_url ? <img src={asset.preview_url} alt={asset.title} /> : <span>Preview unavailable</span>}</div>
              <div className="assetCardBody">
                <div className="knowledgeMeta"><span>{assetKinds.find((item) => item.value === asset.kind)?.label || asset.kind}</span><small>{new Date(asset.created_at).toLocaleDateString()}</small></div>
                <h4>{asset.title}</h4>
                {asset.notes && <p>{asset.notes}</p>}
                <button className="assetDelete" onClick={() => removeAsset(asset)}>Delete</button>
              </div>
            </article>)}
          </div>
        </section>
      </section>
    </main>
  );
}
