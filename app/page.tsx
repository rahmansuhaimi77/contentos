'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import type { BrandBrain, CampaignBrief, GenerationResult, SavedBrand, SavedCampaign } from '@/lib/types';

const initialBrand: BrandBrain = {
  name: '',
  product: '',
  audience: '',
  positioning: '',
  voice: 'Conversational, confident, useful, natural. No corporate jargon.',
  offer: '',
  proof: '',
  cta: '',
  avoid: 'Fake urgency, exaggerated claims, generic AI wording.',
};

const initialBrief: CampaignBrief = {
  objective: 'Generate qualified leads',
  platform: 'TikTok / Reels',
  format: '15-30 second short-form video',
  language: 'Bahasa Melayu / natural Manglish where appropriate',
  count: 3,
  extra: '',
};

type View = 'studio' | 'brands' | 'library' | 'approval';

export default function Home() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState('');
  const [brands, setBrands] = useState<SavedBrand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [brand, setBrand] = useState<BrandBrain>(initialBrand);
  const [brief, setBrief] = useState<CampaignBrief>(initialBrief);
  const [campaigns, setCampaigns] = useState<SavedCampaign[]>([]);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [active, setActive] = useState(0);
  const [view, setView] = useState<View>('studio');

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data.user ?? null);
      if (data.user) await bootstrap(data.user);
      setAuthLoading(false);
    }

    initialize();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) await bootstrap(nextUser);
      else {
        setWorkspaceId('');
        setBrands([]);
        setCampaigns([]);
      }
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const completion = useMemo(() => {
    const required = [brand.name, brand.product, brand.audience, brief.objective, brief.platform];
    return Math.round((required.filter(Boolean).length / required.length) * 100);
  }, [brand, brief]);

  const approvalItems = useMemo(() => campaigns.flatMap((campaign) =>
    campaign.variants
      .filter((variant) => variant.status !== 'published')
      .map((variant) => ({ campaign, variant })),
  ), [campaigns]);

  async function bootstrap(currentUser: User) {
    setError('');

    let { data: workspaces, error: workspaceError } = await supabase
      .from('contentos_workspaces')
      .select('id,name')
      .order('created_at', { ascending: true })
      .limit(1);

    if (workspaceError) {
      setError(workspaceError.message);
      return;
    }

    let workspace = workspaces?.[0];
    if (!workspace) {
      const { data, error: createError } = await supabase
        .from('contentos_workspaces')
        .insert({ name: 'My ContentOS Workspace', owner_id: currentUser.id })
        .select('id,name')
        .single();

      if (createError) {
        setError(createError.message);
        return;
      }
      workspace = data;
    }

    setWorkspaceId(workspace.id);
    await Promise.all([loadBrands(workspace.id), loadCampaigns()]);
  }

  async function loadBrands(targetWorkspaceId = workspaceId) {
    if (!targetWorkspaceId) return;
    const { data, error: loadError } = await supabase
      .from('contentos_brands')
      .select('*')
      .eq('workspace_id', targetWorkspaceId)
      .order('updated_at', { ascending: false });

    if (loadError) {
      setError(loadError.message);
      return;
    }

    const mapped: SavedBrand[] = (data ?? []).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      product: row.product,
      audience: row.audience,
      positioning: row.positioning,
      voice: row.voice,
      offer: row.offer,
      proof: row.proof,
      cta: row.preferred_cta,
      avoid: row.avoid,
    }));

    setBrands(mapped);
    if (!brandId && mapped.length > 0) selectBrand(mapped[0]);
  }

  async function loadCampaigns() {
    const { data, error: loadError } = await supabase
      .from('contentos_campaigns')
      .select(`
        id, brand_id, objective, platform, format, language, strategy, status, created_at,
        contentos_brands(name),
        contentos_content_variants(id,hook,angle,script,caption,cta,creative_prompt,status,review_note,created_at)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    const mapped: SavedCampaign[] = (data ?? []).map((row: any) => ({
      id: row.id,
      brandId: row.brand_id,
      brandName: row.contentos_brands?.name ?? 'Brand',
      objective: row.objective,
      platform: row.platform,
      format: row.format,
      language: row.language,
      strategy: row.strategy ?? '',
      status: row.status,
      createdAt: row.created_at,
      variants: (row.contentos_content_variants ?? []).map((variant: any) => ({
        id: variant.id,
        hook: variant.hook,
        angle: variant.angle,
        script: variant.script,
        caption: variant.caption,
        cta: variant.cta,
        creative_prompt: variant.creative_prompt,
        status: variant.status,
        review_note: variant.review_note,
      })),
    }));

    setCampaigns(mapped);
  }

  function selectBrand(saved: SavedBrand) {
    setBrandId(saved.id);
    setBrand({
      name: saved.name,
      product: saved.product,
      audience: saved.audience,
      positioning: saved.positioning,
      voice: saved.voice,
      offer: saved.offer,
      proof: saved.proof,
      cta: saved.cta,
      avoid: saved.avoid,
    });
  }

  function newBrand() {
    setBrandId('');
    setBrand(initialBrand);
    setNotice('New Brand Brain started. Save it when ready.');
    setView('brands');
  }

  async function persistBrand(): Promise<string | null> {
    if (!user || !workspaceId) return null;
    if (!brand.name.trim() || !brand.product.trim() || !brand.audience.trim()) {
      setError('Brand name, product/service and target customer are required.');
      return null;
    }

    setSavingBrand(true);
    setError('');

    const payload = {
      workspace_id: workspaceId,
      name: brand.name.trim(),
      product: brand.product,
      audience: brand.audience,
      positioning: brand.positioning,
      voice: brand.voice,
      offer: brand.offer,
      proof: brand.proof,
      preferred_cta: brand.cta,
      avoid: brand.avoid,
    };

    try {
      if (brandId) {
        const { error: updateError } = await supabase
          .from('contentos_brands')
          .update(payload)
          .eq('id', brandId);
        if (updateError) throw updateError;
        await loadBrands(workspaceId);
        setNotice('Brand Brain saved.');
        return brandId;
      }

      const { data, error: insertError } = await supabase
        .from('contentos_brands')
        .insert(payload)
        .select('id')
        .single();
      if (insertError) throw insertError;

      setBrandId(data.id);
      await loadBrands(workspaceId);
      setNotice('Brand Brain created.');
      return data.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save brand.');
      return null;
    } finally {
      setSavingBrand(false);
    }
  }

  async function generate(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');
    setNotice('');
    setResult(null);

    try {
      const activeBrandId = brandId || await persistBrand();
      if (!activeBrandId) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your session expired. Please sign in again.');

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ brand, brief }),
      });
      const data: GenerationResult & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      setResult(data);
      setActive(0);

      const { data: campaign, error: campaignError } = await supabase
        .from('contentos_campaigns')
        .insert({
          brand_id: activeBrandId,
          created_by: user.id,
          objective: brief.objective,
          platform: brief.platform,
          format: brief.format,
          language: brief.language,
          brief,
          strategy: data.strategy,
          status: 'generated',
        })
        .select('id')
        .single();
      if (campaignError) throw campaignError;

      const variantsPayload = data.variants.map((variant) => ({
        campaign_id: campaign.id,
        hook: variant.hook,
        angle: variant.angle,
        script: variant.script,
        caption: variant.caption,
        cta: variant.cta,
        creative_prompt: variant.creative_prompt,
        status: 'in_review',
      }));

      const { error: variantsError } = await supabase
        .from('contentos_content_variants')
        .insert(variantsPayload);
      if (variantsError) throw variantsError;

      setNotice(data.mode === 'demo'
        ? 'Campaign saved in zero-cost demo mode. Add an OpenAI API key later for live AI generation.'
        : 'AI campaign generated and saved to the approval queue.');
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  async function updateVariantStatus(id: string | undefined, status: 'approved' | 'rejected' | 'in_review') {
    if (!id) return;
    const { error: updateError } = await supabase
      .from('contentos_content_variants')
      .update({ status })
      .eq('id', id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setNotice(`Creative marked ${status.replace('_', ' ')}.`);
    await loadCampaigns();
  }

  function openCampaign(campaign: SavedCampaign) {
    setResult({ strategy: campaign.strategy, variants: campaign.variants });
    setActive(0);
    setBrief({
      objective: campaign.objective,
      platform: campaign.platform,
      format: campaign.format,
      language: campaign.language,
      count: Math.max(1, campaign.variants.length),
      extra: '',
    });
    const matchingBrand = brands.find((item) => item.id === campaign.brandId);
    if (matchingBrand) selectBrand(matchingBrand);
    setView('studio');
  }

  const variant = result?.variants[active];

  if (authLoading) {
    return <main className="authShell"><div className="authCard"><div className="logo">CO</div><h1>ContentOS</h1><p>Loading your workspace…</p></div></main>;
  }

  if (!user) return <AuthScreen />;

  return (
    <main className="shell">
      <aside className="sidebar">
        <div>
          <div className="logo">CO</div>
          <h1>ContentOS</h1>
          <p>Brand brain → campaign → approval.</p>
        </div>

        <nav>
          <NavButton active={view === 'studio'} onClick={() => setView('studio')}>✦ Campaign Studio</NavButton>
          <NavButton active={view === 'brands'} onClick={() => setView('brands')}>◫ Brand Brain</NavButton>
          <NavButton active={view === 'library'} onClick={() => setView('library')}>▤ Content Library</NavButton>
          <NavButton active={view === 'approval'} onClick={() => setView('approval')}>✓ Approval Queue <b>{approvalItems.filter((item) => item.variant.status === 'in_review').length}</b></NavButton>
        </nav>

        <div>
          <div className="progress">
            <div><span>Brand readiness</span><b>{completion}%</b></div>
            <div className="bar"><i style={{ width: `${completion}%` }} /></div>
          </div>
          <button className="signOut" onClick={() => supabase.auth.signOut()}>Sign out · {user.email}</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">{view === 'studio' ? 'CAMPAIGN STUDIO' : view.toUpperCase()}</span>
            <h2>{view === 'studio' ? 'Turn one brief into a content campaign.' : view === 'brands' ? 'Build the memory behind every campaign.' : view === 'library' ? 'Your saved campaign history.' : 'Review every creative before it goes live.'}</h2>
          </div>
          <div className="topActions">
            <select className="brandSelect" value={brandId} onChange={(e) => {
              const selected = brands.find((item) => item.id === e.target.value);
              if (selected) selectBrand(selected);
            }}>
              <option value="">Select brand…</option>
              {brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <button className="secondaryButton" onClick={newBrand}>+ New brand</button>
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}
        {error && <div className="error globalError">{error}</div>}

        {view === 'studio' && (
          <>
            <form onSubmit={generate} className="grid">
              <BrandPanel brand={brand} setBrand={setBrand} onSave={persistBrand} saving={savingBrand} />
              <section className="panel stickyPanel">
                <div className="panelHead"><span>02</span><div><h3>Campaign Brief</h3><p>Tell the strategist what outcome you want.</p></div></div>
                <Field label="Objective" value={brief.objective} onChange={(v) => setBrief({ ...brief, objective: v })} />
                <Select label="Platform" value={brief.platform} onChange={(v) => setBrief({ ...brief, platform: v })} options={['TikTok / Reels','Facebook','Instagram carousel','WhatsApp','Landing page','Multi-platform']} />
                <Select label="Format" value={brief.format} onChange={(v) => setBrief({ ...brief, format: v })} options={['15-30 second short-form video','UGC / POV video','Static ad','Carousel','Long-form post','Direct-response message']} />
                <Field label="Language" value={brief.language} onChange={(v) => setBrief({ ...brief, language: v })} />
                <label className="field"><span>Variants</span><input type="number" min={1} max={10} value={brief.count} onChange={(e) => setBrief({ ...brief, count: Number(e.target.value) })} /></label>
                <Field label="Extra direction" value={brief.extra} onChange={(v) => setBrief({ ...brief, extra: v })} placeholder="Promo dates, visual style, key message, objections..." multiline />
                <button className="generate" disabled={loading || completion < 100}>{loading ? 'Building campaign…' : '✦ Generate Campaign'}</button>
                <p className="hint">Every campaign is saved automatically. Without an OpenAI key, the system stays in zero-cost demo mode so the full workflow can still be tested.</p>
              </section>
            </form>

            {result && variant && (
              <section className="results">
                <div className="resultTitle"><div><span className="eyebrow">{result.mode === 'demo' ? 'DEMO STRATEGY' : 'AI STRATEGY'}</span><h3>{result.strategy}</h3></div><span>{result.variants.length} variants</span></div>
                <div className="tabs">{result.variants.map((_, i) => <button type="button" key={i} onClick={() => setActive(i)} className={i === active ? 'selected' : ''}>Creative {i + 1}</button>)}</div>
                <div className="resultGrid">
                  <ResultCard title="Hook" text={variant.hook} />
                  <ResultCard title="Angle" text={variant.angle} />
                  <ResultCard title="Script" text={variant.script} wide />
                  <ResultCard title="Caption" text={variant.caption} />
                  <ResultCard title="CTA" text={variant.cta} />
                  <ResultCard title="Image / video production prompt" text={variant.creative_prompt} wide />
                </div>
              </section>
            )}
          </>
        )}

        {view === 'brands' && (
          <div className="singleColumn">
            <BrandPanel brand={brand} setBrand={setBrand} onSave={persistBrand} saving={savingBrand} />
            <section className="panel">
              <div className="panelHead"><span>↺</span><div><h3>Saved Brand Brains</h3><p>Switch between brands without rebuilding context.</p></div></div>
              <div className="cardList">
                {brands.length === 0 && <EmptyState text="No saved brands yet." />}
                {brands.map((item) => (
                  <button className="listCard" key={item.id} onClick={() => selectBrand(item)}>
                    <strong>{item.name}</strong><span>{item.product}</span><small>{item.audience}</small>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {view === 'library' && (
          <section className="panel">
            <div className="panelHead"><span>▤</span><div><h3>Campaign History</h3><p>Every generated campaign is persisted in Supabase.</p></div></div>
            <div className="cardList">
              {campaigns.length === 0 && <EmptyState text="No campaigns yet. Generate your first campaign in Campaign Studio." />}
              {campaigns.map((campaign) => (
                <article className="campaignCard" key={campaign.id}>
                  <div><strong>{campaign.brandName}</strong><span>{campaign.platform} · {campaign.format}</span></div>
                  <p>{campaign.strategy}</p>
                  <div className="campaignMeta"><span>{campaign.variants.length} creatives</span><span>{new Date(campaign.createdAt).toLocaleDateString()}</span><button onClick={() => openCampaign(campaign)}>Open</button></div>
                </article>
              ))}
            </div>
          </section>
        )}

        {view === 'approval' && (
          <section className="panel">
            <div className="panelHead"><span>✓</span><div><h3>Approval Queue</h3><p>Human review remains the gate before publishing.</p></div></div>
            <div className="approvalList">
              {approvalItems.length === 0 && <EmptyState text="Nothing waiting for review." />}
              {approvalItems.map(({ campaign, variant }) => (
                <article className="approvalCard" key={variant.id}>
                  <div className="approvalHead"><div><strong>{campaign.brandName}</strong><span>{campaign.platform}</span></div><StatusPill status={variant.status || 'draft'} /></div>
                  <h4>{variant.hook}</h4>
                  <p>{variant.caption}</p>
                  <div className="approvalActions">
                    <button className="approve" onClick={() => updateVariantStatus(variant.id, 'approved')}>Approve</button>
                    <button onClick={() => updateVariantStatus(variant.id, 'in_review')}>Needs review</button>
                    <button className="reject" onClick={() => updateVariantStatus(variant.id, 'rejected')}>Reject</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function AuthScreen() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setMessage(error.message);
      else if (!data.session) setMessage('Account created. Check your email if confirmation is required, then sign in.');
    }

    setLoading(false);
  }

  return (
    <main className="authShell">
      <form className="authCard" onSubmit={submit}>
        <div className="logo">CO</div>
        <span className="eyebrow">CONTENTOS</span>
        <h1>{mode === 'signin' ? 'Welcome back.' : 'Create your workspace.'}</h1>
        <p>Sign in to save Brand Brains, campaigns and approvals securely in Supabase.</p>
        <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
        <Field label="Password" value={password} onChange={setPassword} placeholder="Minimum 6 characters" type="password" />
        <button className="generate" disabled={loading}>{loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        {message && <div className="authMessage">{message}</div>}
        <button type="button" className="textButton" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}>
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </main>
  );
}

function BrandPanel({ brand, setBrand, onSave, saving }: { brand: BrandBrain; setBrand: (brand: BrandBrain) => void; onSave: () => Promise<string | null>; saving: boolean }) {
  return (
    <section className="panel">
      <div className="panelHead"><span>01</span><div><h3>Brand Brain</h3><p>Teach the system what must stay consistent.</p></div></div>
      <Field label="Brand name" value={brand.name} onChange={(v) => setBrand({ ...brand, name: v })} placeholder="e.g. Your Brand" />
      <Field label="Product / service" value={brand.product} onChange={(v) => setBrand({ ...brand, product: v })} placeholder="What exactly are we selling?" multiline />
      <Field label="Target customer" value={brand.audience} onChange={(v) => setBrand({ ...brand, audience: v })} placeholder="Who, where, situation, pain point" multiline />
      <Field label="Positioning" value={brand.positioning} onChange={(v) => setBrand({ ...brand, positioning: v })} placeholder="Why choose you instead of alternatives?" multiline />
      <Field label="Voice" value={brand.voice} onChange={(v) => setBrand({ ...brand, voice: v })} multiline />
      <Field label="Current offer" value={brand.offer} onChange={(v) => setBrand({ ...brand, offer: v })} placeholder="Price, promo, package, guarantee" />
      <Field label="Proof / trust" value={brand.proof} onChange={(v) => setBrand({ ...brand, proof: v })} placeholder="Reviews, experience, guarantees, data" multiline />
      <Field label="Preferred CTA" value={brand.cta} onChange={(v) => setBrand({ ...brand, cta: v })} placeholder="WhatsApp us / Book now / DM keyword..." />
      <Field label="Never do / say" value={brand.avoid} onChange={(v) => setBrand({ ...brand, avoid: v })} multiline />
      <button type="button" className="saveBrand" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save Brand Brain'}</button>
    </section>
  );
}

function NavButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button className={`nav ${active ? 'active' : ''}`} onClick={onClick}>{children}</button>;
}

function Field({ label, value, onChange, placeholder, multiline = false, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; type?: string }) {
  return <label className="field"><span>{label}</span>{multiline ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} /> : <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />}</label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function ResultCard({ title, text, wide = false }: { title: string; text: string; wide?: boolean }) {
  async function copy() { await navigator.clipboard.writeText(text); }
  return <article className={`resultCard ${wide ? 'wide' : ''}`}><div><span>{title}</span><button onClick={copy}>Copy</button></div><p>{text}</p></article>;
}

function StatusPill({ status }: { status: string }) {
  return <span className={`statusPill status-${status}`}>{status.replace('_', ' ')}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="emptyState">{text}</div>;
}
