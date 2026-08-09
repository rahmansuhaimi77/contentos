'use client';

import { FormEvent, useMemo, useState } from 'react';
import type { BrandBrain, CampaignBrief, GenerationResult } from '@/lib/types';

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

export default function Home() {
  const [brand, setBrand] = useState(initialBrand);
  const [brief, setBrief] = useState(initialBrief);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);

  const completion = useMemo(() => {
    const required = [brand.name, brand.product, brand.audience, brief.objective, brief.platform];
    return Math.round((required.filter(Boolean).length / required.length) * 100);
  }, [brand, brief]);

  async function generate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, brief }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setResult(data);
      setActive(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  const variant = result?.variants[active];

  return (
    <main className="shell">
      <aside className="sidebar">
        <div>
          <div className="logo">CO</div>
          <h1>ContentOS</h1>
          <p>Brand brain → campaign → creative.</p>
        </div>
        <nav>
          <span className="nav active">✦ Campaign Studio</span>
          <span className="nav">◫ Brand Brain</span>
          <span className="nav">▤ Content Library</span>
          <span className="nav">✓ Approval Queue</span>
          <span className="nav">↗ Analytics</span>
        </nav>
        <div className="progress">
          <div><span>Brand readiness</span><b>{completion}%</b></div>
          <div className="bar"><i style={{ width: `${completion}%` }} /></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">CAMPAIGN STUDIO</span>
            <h2>Turn one brief into a content campaign.</h2>
          </div>
          <div className="badge">MVP · Human approval first</div>
        </header>

        <form onSubmit={generate} className="grid">
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
          </section>

          <section className="panel stickyPanel">
            <div className="panelHead"><span>02</span><div><h3>Campaign Brief</h3><p>Tell the strategist what outcome you want.</p></div></div>
            <Field label="Objective" value={brief.objective} onChange={(v) => setBrief({ ...brief, objective: v })} />
            <Select label="Platform" value={brief.platform} onChange={(v) => setBrief({ ...brief, platform: v })} options={['TikTok / Reels','Facebook','Instagram carousel','WhatsApp','Landing page','Multi-platform']} />
            <Select label="Format" value={brief.format} onChange={(v) => setBrief({ ...brief, format: v })} options={['15-30 second short-form video','UGC / POV video','Static ad','Carousel','Long-form post','Direct-response message']} />
            <Field label="Language" value={brief.language} onChange={(v) => setBrief({ ...brief, language: v })} />
            <label className="field"><span>Variants</span><input type="number" min={1} max={10} value={brief.count} onChange={(e) => setBrief({ ...brief, count: Number(e.target.value) })} /></label>
            <Field label="Extra direction" value={brief.extra} onChange={(v) => setBrief({ ...brief, extra: v })} placeholder="Promo dates, visual style, key message, objections..." multiline />
            <button className="generate" disabled={loading || completion < 100}>{loading ? 'Building campaign…' : '✦ Generate Campaign'}</button>
            <p className="hint">The MVP generates strategy, hooks, scripts, captions, CTA and production prompts. Publishing stays manual until the approval workflow is connected.</p>
            {error && <div className="error">{error}</div>}
          </section>
        </form>

        {result && variant && (
          <section className="results">
            <div className="resultTitle"><div><span className="eyebrow">AI STRATEGY</span><h3>{result.strategy}</h3></div><span>{result.variants.length} variants</span></div>
            <div className="tabs">{result.variants.map((_, i) => <button key={i} onClick={() => setActive(i)} className={i === active ? 'selected' : ''}>Creative {i + 1}</button>)}</div>
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
      </section>
    </main>
  );
}

function Field({ label, value, onChange, placeholder, multiline = false }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  return <label className="field"><span>{label}</span>{multiline ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} /> : <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />}</label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select></label>;
}

function ResultCard({ title, text, wide = false }: { title: string; text: string; wide?: boolean }) {
  async function copy() { await navigator.clipboard.writeText(text); }
  return <article className={`resultCard ${wide ? 'wide' : ''}`}><div><span>{title}</span><button onClick={copy}>Copy</button></div><p>{text}</p></article>;
}
