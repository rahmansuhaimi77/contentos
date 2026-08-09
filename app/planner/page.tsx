'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type Brand = { id: string; name: string };
type PlanItem = {
  id?: string;
  day_number: number;
  pillar: string;
  objective: string;
  platform: string;
  format: string;
  hook: string;
  concept: string;
  cta: string;
  status?: string;
  production_status?: string;
};
type PlanResult = { plan: { id: string; name: string; created_at: string }; brand: string; items: PlanItem[]; mode: string };
type StoryboardScene = { scene: number; duration: string; visual: string; on_screen_text: string; voiceover: string };
type ProductionPack = {
  strategy: string;
  hook: string;
  angle: string;
  script: string;
  caption: string;
  cta: string;
  creative_prompt: string;
  storyboard: StoryboardScene[];
  qa_notes: string[];
};
type ProductionResult = { dayNumber: number; pack: ProductionPack; variantId: string; campaignId: string; mode: string };

const platformOptions = ['TikTok / Reels', 'Facebook', 'Instagram', 'WhatsApp'];

export default function PlannerPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [objective, setObjective] = useState('Generate qualified WhatsApp leads while building trust and awareness');
  const [platforms, setPlatforms] = useState<string[]>(['TikTok / Reels', 'Facebook']);
  const [language, setLanguage] = useState('Bahasa Melayu / natural Manglish where appropriate');
  const [result, setResult] = useState<PlanResult | null>(null);
  const [production, setProduction] = useState<ProductionResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [producingDay, setProducingDay] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
      if (!data.user) { setLoading(false); return; }

      const { data: brandRows, error: brandError } = await supabase
        .from('contentos_brands')
        .select('id,name')
        .order('updated_at', { ascending: false });
      if (brandError) setError(brandError.message);
      const nextBrands = (brandRows ?? []) as Brand[];
      setBrands(nextBrands);
      if (nextBrands[0]) setBrandId(nextBrands[0].id);

      const { data: latestPlans, error: latestPlanError } = await supabase
        .from('contentos_content_plans')
        .select('id,name,created_at,brand_id,objective,platforms,language')
        .order('created_at', { ascending: false })
        .limit(1);

      if (latestPlanError) {
        setError(latestPlanError.message);
      } else {
        const latestPlan = (latestPlans as any[] | null)?.[0];
        if (latestPlan) {
          const { data: itemRows, error: itemError } = await supabase
            .from('contentos_plan_items')
            .select('id,day_number,pillar,objective,platform,format,hook,concept,cta,status,production_status')
            .eq('plan_id', latestPlan.id)
            .order('day_number', { ascending: true });

          if (itemError) {
            setError(itemError.message);
          } else {
            const planBrand = nextBrands.find((brand) => brand.id === latestPlan.brand_id);
            setBrandId(latestPlan.brand_id);
            setObjective(latestPlan.objective);
            setPlatforms(latestPlan.platforms?.length ? latestPlan.platforms : ['TikTok / Reels']);
            setLanguage(latestPlan.language);
            setResult({
              plan: { id: latestPlan.id, name: latestPlan.name, created_at: latestPlan.created_at },
              brand: planBrand?.name || 'Brand',
              items: (itemRows ?? []) as PlanItem[],
              mode: 'saved',
            });
          }
        }
      }
      setLoading(false);
    }
    init();
  }, [supabase]);

  function togglePlatform(platform: string) {
    setPlatforms((current) => current.includes(platform)
      ? current.filter((item) => item !== platform)
      : [...current, platform]);
  }

  async function generate(e: FormEvent) {
    e.preventDefault();
    if (!brandId || platforms.length === 0) return;
    setGenerating(true); setError(''); setMessage(''); setResult(null); setProduction(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your session expired. Please sign in again.');
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brandId, objective, platforms, language }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to generate plan.');
      setResult({ ...data, items: data.items.map((item: PlanItem) => ({ ...item, status: 'planned', production_status: 'not_started' })) });
      setMessage('30-day content plan created and saved to Supabase.');
      window.setTimeout(() => document.getElementById('plan-results')?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate plan.');
    } finally {
      setGenerating(false);
    }
  }

  async function produce(item: PlanItem) {
    if (!result?.plan.id) return;
    setProducingDay(item.day_number); setError(''); setMessage('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your session expired. Please sign in again.');
      const response = await fetch('/api/produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId: result.plan.id, dayNumber: item.day_number }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to produce content.');
      setProduction({ dayNumber: item.day_number, pack: data.pack, variantId: data.variantId, campaignId: data.campaignId, mode: data.mode });
      setResult({ ...result, items: result.items.map((row) => row.day_number === item.day_number ? { ...row, production_status: 'produced' } : row) });
      setMessage(`Day ${item.day_number} production pack created and sent to Approval Queue.`);
      window.setTimeout(() => document.getElementById('production-pack')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to produce content.');
    } finally {
      setProducingDay(null);
    }
  }

  async function markStatus(item: PlanItem, status: 'ready' | 'published' | 'skipped') {
    if (!result?.plan.id) return;
    const { error: updateError } = await supabase
      .from('contentos_plan_items')
      .update({ status })
      .eq('plan_id', result.plan.id)
      .eq('day_number', item.day_number);
    if (updateError) { setError(updateError.message); return; }
    setResult({ ...result, items: result.items.map((row) => row.day_number === item.day_number ? { ...row, status } : row) });
  }

  async function copyPack(pack: ProductionPack) {
    const storyboard = pack.storyboard.map((scene) => `Scene ${scene.scene} (${scene.duration})\nVisual: ${scene.visual}\nText: ${scene.on_screen_text}\nVO: ${scene.voiceover}`).join('\n\n');
    await navigator.clipboard.writeText(`HOOK\n${pack.hook}\n\nSCRIPT\n${pack.script}\n\nCAPTION\n${pack.caption}\n\nSTORYBOARD\n${storyboard}\n\nPRODUCTION PROMPT\n${pack.creative_prompt}`);
    setMessage('Full production pack copied.');
  }

  if (loading) return <main className="toolShell"><div className="toolCard">Loading planner…</div></main>;
  if (!user) return <main className="toolShell"><div className="toolCard"><h1>Sign in first</h1><p>Open ContentOS Studio, sign in, then return here.</p><a className="toolPrimaryLink" href="/">Open Studio</a></div></main>;

  return (
    <main className="toolShell">
      <header className="toolHeader">
        <div><span className="eyebrow">CONTENTOS · 30-DAY PLANNER</span><h1>Turn the Brand Brain into a month of content.</h1><p>Plan the month, then turn any day into a production-ready script, storyboard and creative prompt.</p></div>
        <nav className="toolNav"><a href="/">Campaign Studio</a><a href="/knowledge">Knowledge Base</a><a className="active" href="/planner">30-Day Planner</a></nav>
      </header>

      {message && <div className="notice">{message}</div>}
      {error && <div className="error globalError">{error}</div>}

      <form className="panel plannerBrief" onSubmit={generate}>
        <div className="panelHead"><span>30</span><div><h3>Plan brief</h3><p>Choose the brand, business goal and channels. ContentOS handles the rotation.</p></div></div>
        <div className="plannerFields">
          <label className="field"><span>Brand</span><select value={brandId} onChange={(e) => setBrandId(e.target.value)}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
          <label className="field"><span>Language</span><input value={language} onChange={(e) => setLanguage(e.target.value)} /></label>
          <label className="field plannerObjective"><span>Main objective</span><textarea rows={3} value={objective} onChange={(e) => setObjective(e.target.value)} /></label>
        </div>
        <div className="platformPicker"><span>Platforms</span><div>{platformOptions.map((platform) => <button type="button" key={platform} className={platforms.includes(platform) ? 'selected' : ''} onClick={() => togglePlatform(platform)}>{platform}</button>)}</div></div>
        <button className="generate" disabled={generating || !brandId || platforms.length === 0}>{generating ? 'Building 30-day plan…' : '✦ Generate & Save 30-Day Plan'}</button>
        <p className="hint">Still RM0: planning and production packs use the zero-cost SewaPro framework and your saved Knowledge Base.</p>
      </form>

      {production && <section id="production-pack" className="productionPack">
        <div className="productionHead">
          <div><span className="eyebrow">DAY {String(production.dayNumber).padStart(2, '0')} · PRODUCTION PACK</span><h2>{production.pack.hook}</h2><p>Automatically saved as a creative in the Approval Queue.</p></div>
          <button className="toolPrimaryLink productionCopy" onClick={() => copyPack(production.pack)}>Copy full pack</button>
        </div>
        <div className="agentFlow"><span>Strategist</span><b>→</b><span>Copywriter</span><b>→</b><span>Creative Director</span><b>→</b><span>QA</span></div>
        <div className="productionGrid">
          <article className="productionSection"><span>SCRIPT</span><p>{production.pack.script}</p></article>
          <article className="productionSection"><span>CAPTION</span><p>{production.pack.caption}</p></article>
          <article className="productionSection wide"><span>STORYBOARD</span><div className="storyboardList">{production.pack.storyboard.map((scene) => <div className="storyScene" key={scene.scene}><b>Scene {scene.scene} · {scene.duration}</b><p>{scene.visual}</p><small>TEXT: {scene.on_screen_text}</small>{scene.voiceover && <small>VO: {scene.voiceover}</small>}</div>)}</div></article>
          <article className="productionSection wide"><span>VIDEO / IMAGE PROMPT</span><p>{production.pack.creative_prompt}</p></article>
          <article className="productionSection wide"><span>QA RULES</span><ul>{production.pack.qa_notes.map((note) => <li key={note}>{note}</li>)}</ul></article>
        </div>
        <div className="productionFooter"><span>✓ Creative sent to Approval Queue</span><a href="/">Open ContentOS Studio</a></div>
      </section>}

      {result && <section id="plan-results" className="plannerResults">
        <div className="plannerResultsHead"><div><span className="eyebrow">{result.mode.toUpperCase()} PLAN</span><h2>{result.plan.name}</h2><p>{result.brand} · {result.items.length} planned content pieces</p></div><a className="toolPrimaryLink" href="/knowledge">Improve Knowledge Base</a></div>
        <div className="planList">
          {result.items.map((item) => <article className="planCard" key={item.day_number}>
            <div className="dayBadge">DAY<br/><strong>{String(item.day_number).padStart(2, '0')}</strong></div>
            <div className="planContent">
              <div className="planMeta"><span>{item.pillar}</span><span>{item.platform}</span><span>{item.format}</span>{item.production_status === 'produced' && <span className="producedPill">PRODUCED</span>}</div>
              <h3>{item.hook}</h3>
              <p>{item.concept}</p>
              <div className="planCta"><b>CTA</b><span>{item.cta}</span></div>
              <div className="planActions">
                <button className="produceButton" disabled={producingDay === item.day_number} onClick={() => produce(item)}>{producingDay === item.day_number ? 'Producing…' : item.production_status === 'produced' ? '↻ Regenerate pack' : '✦ Produce content'}</button>
                <button onClick={() => navigator.clipboard.writeText(`${item.hook}\n\n${item.concept}\n\nCTA: ${item.cta}`)}>Copy brief</button>
                <button className={item.status === 'ready' ? 'activeState' : ''} onClick={() => markStatus(item, 'ready')}>Ready</button>
                <button className={item.status === 'published' ? 'activeState' : ''} onClick={() => markStatus(item, 'published')}>Published</button>
                <button onClick={() => markStatus(item, 'skipped')}>Skip</button>
              </div>
            </div>
          </article>)}
        </div>
      </section>}
    </main>
  );
}
