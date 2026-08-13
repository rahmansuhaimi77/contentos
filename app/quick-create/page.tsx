'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import styles from '@/components/workflow.module.css';

type BrandBrain = {
  id: string; name: string; product: string; audience: string; positioning: string;
  voice: string; offer: string; proof: string; cta: string; avoid: string;
};

type GeneratedVariant = {
  id?: string; hook: string; angle: string; script: string; caption: string; cta: string; creative_prompt: string;
};

type GenerationResult = { strategy: string; variants: GeneratedVariant[]; mode?: 'ai' | 'demo' };

type AssistantFill = {
  idea: string; objective: string; phase: 'Pre-Launch' | 'Launch Week' | 'Early Growth' | 'Evergreen';
  platform: string; format: string; language: string; mode?: 'ai' | 'smart'; error?: string;
};

type ContentType = 'write' | 'poster' | 'carousel' | 'video' | 'pack';

type ContentTypeOption = {
  id: ContentType; icon: string; label: string; description: string; platform: string; format: string;
};

const contentTypes: ContentTypeOption[] = [
  { id: 'write', icon: '✎', label: 'Write only', description: 'Caption, copy or script', platform: 'Multi-platform', format: 'Long-form post' },
  { id: 'poster', icon: '▣', label: 'Make poster', description: 'One static visual + caption', platform: 'Instagram carousel', format: 'Static ad' },
  { id: 'carousel', icon: '▦', label: 'Make carousel', description: 'Multi-slide visual content', platform: 'Instagram carousel', format: 'Carousel' },
  { id: 'video', icon: '▶', label: 'Make video', description: 'Short-form video + caption', platform: 'TikTok / Reels', format: '15-30 second short-form video' },
  { id: 'pack', icon: '✦', label: 'Make post pack', description: 'Adapt copy for several channels', platform: 'Multi-platform', format: 'Long-form post' },
];

const platformOptions = ['Instagram carousel', 'TikTok / Reels', 'Threads', 'Facebook', 'WhatsApp', 'Multi-platform'];
const formatOptions = ['Carousel', '15-30 second short-form video', 'UGC / POV video', 'Static ad', 'Threads text post', 'Long-form post'];
const phaseOptions = ['Pre-Launch', 'Launch Week', 'Early Growth', 'Evergreen'];

const installTutorialPreset = {
  helper: 'Create a public how-to showing students how to install KampusRide on Android and iPhone, then enable notifications.',
  idea: 'Create a public 6-slide step-by-step tutorial titled “How to Install KampusRide + Enable Notifications”. Slide 1: How to Install KampusRide. Slide 2: Android — open KampusRide in Google Chrome. Slide 3: Android — tap the three-dot menu → Install app → Install. Slide 4: iPhone — open KampusRide in Safari → Share → Add to Home Screen → Open as Web App → Add. Slide 5: Enable Notifications — open KampusRide and tap Allow when the notification permission appears. Slide 6: Done — show the approved KR app icon on the Home Screen with “From Campus, For You.” Keep it simple, highly visual and student-friendly. Do not turn this into a general app introduction or Telegram comparison.',
  objective: 'Product education / onboarding — make installation and notification setup easy to understand and complete.',
  phase: 'Pre-Launch',
  platform: 'Instagram carousel',
  format: 'Carousel',
  language: 'Bahasa Melayu / natural Manglish, simple student-friendly instructions',
};

export default function QuickCreatePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [brand, setBrand] = useState<BrandBrain | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filling, setFilling] = useState(false);
  const [contentType, setContentType] = useState<ContentType>('carousel');
  const [helperRequest, setHelperRequest] = useState('');
  const [idea, setIdea] = useState('');
  const [objective, setObjective] = useState('Product education / awareness');
  const [platform, setPlatform] = useState('Instagram carousel');
  const [format, setFormat] = useState('Carousel');
  const [phase, setPhase] = useState('Pre-Launch');
  const [language, setLanguage] = useState('Bahasa Melayu / natural Manglish where appropriate');
  const [copyEngine, setCopyEngine] = useState('ChatGPT');
  const [visualEngine, setVisualEngine] = useState('ChatGPT');
  const [videoEngine, setVideoEngine] = useState('Veo / Flow');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadBrand(targetBrandId?: string | null) {
      const query = supabase.from('contentos_brands')
        .select('id,name,product,audience,positioning,voice,offer,proof,preferred_cta,avoid')
        .order('updated_at', { ascending: false });
      const { data, error: brandError } = targetBrandId ? await query.eq('id', targetBrandId).limit(1) : await query.limit(1);
      if (!mounted) return;
      if (brandError) { setError(brandError.message); return; }
      const row = data?.[0];
      if (!row) { setBrand(null); return; }
      setBrand({ id: row.id, name: row.name, product: row.product, audience: row.audience, positioning: row.positioning, voice: row.voice, offer: row.offer, proof: row.proof, cta: row.preferred_cta, avoid: row.avoid });
    }

    async function initialise() {
      const { data: authData } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(authData.user ?? null);
      if (!authData.user) { setLoading(false); return; }

      const params = new URLSearchParams(window.location.search);
      if (params.get('preset') === 'install') {
        setContentType('carousel');
        setHelperRequest(installTutorialPreset.helper);
        setIdea(installTutorialPreset.idea);
        setObjective(installTutorialPreset.objective);
        setPhase(installTutorialPreset.phase);
        setPlatform(installTutorialPreset.platform);
        setFormat(installTutorialPreset.format);
        setLanguage(installTutorialPreset.language);
      }

      const selected = window.localStorage.getItem('contentos:selectedBrandId');
      await loadBrand(selected);
      setLoading(false);
    }

    async function onBrandChange(event: Event) {
      const custom = event as CustomEvent<{ brandId: string }>;
      setResult(null); setNotice(''); setError('');
      await loadBrand(custom.detail.brandId);
    }

    void initialise();
    window.addEventListener('contentos:brand-change', onBrandChange);
    return () => { mounted = false; window.removeEventListener('contentos:brand-change', onBrandChange); };
  }, [supabase]);

  function chooseType(next: ContentType) {
    setContentType(next);
    const preset = contentTypes.find((item) => item.id === next)!;
    setPlatform(preset.platform);
    setFormat(preset.format);
    setResult(null);
    setNotice('');
  }

  async function fillForMe() {
    if (!brand || !helperRequest.trim()) return;
    setFilling(true); setError(''); setNotice(''); setResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your session expired. Please sign in again.');
      const response = await fetch('/api/assist-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brandId: brand.id, request: helperRequest.trim(), contentType }),
      });
      const filled: AssistantFill = await response.json();
      if (!response.ok) throw new Error(filled.error || 'Unable to fill the fields.');
      setIdea(filled.idea); setObjective(filled.objective); setPhase(filled.phase); setPlatform(filled.platform); setFormat(filled.format); setLanguage(filled.language);
      setNotice('Done. Review anything below if you want, then tap Create content.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fill the fields.');
    } finally { setFilling(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user || !brand || !idea.trim()) return;
    setCreating(true); setError(''); setNotice(''); setResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your session expired. Please sign in again.');

      const engineRouting = {
        copy: copyEngine,
        visual: ['poster', 'carousel'].includes(contentType) ? visualEngine : null,
        video: contentType === 'video' ? videoEngine : null,
      };
      const brief = {
        objective, platform, format, language, count: 1,
        extra: `TARGET CONTENT PHASE: ${phase}. This asset is being created now for future use and should be publish-ready for that phase; do not assume it must be posted today. CONTENT TYPE: ${contentType}. CONTENT REQUEST: ${idea.trim()}`,
      };

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brand: { name: brand.name, product: brand.product, audience: brand.audience, positioning: brand.positioning, voice: brand.voice, offer: brand.offer, proof: brand.proof, cta: brand.cta, avoid: brand.avoid }, brief }),
      });
      const generated: GenerationResult & { error?: string } = await response.json();
      if (!response.ok) throw new Error(generated.error || 'Unable to create content.');

      const { data: campaign, error: campaignError } = await supabase.from('contentos_campaigns').insert({
        brand_id: brand.id,
        created_by: user.id,
        objective,
        platform,
        format,
        language,
        brief: { ...brief, target_phase: phase, quick_create: true, content_type: contentType, assistant_request: helperRequest.trim() || null, engine_routing: engineRouting },
        strategy: generated.strategy,
        status: 'generated',
      }).select('id').single();
      if (campaignError) throw campaignError;

      const { data: savedVariants, error: variantsError } = await supabase.from('contentos_content_variants').insert(generated.variants.map((variant) => ({
        campaign_id: campaign.id, hook: variant.hook, angle: variant.angle, script: variant.script, caption: variant.caption, cta: variant.cta, creative_prompt: variant.creative_prompt, status: 'in_review',
      }))).select('id,hook,angle,script,caption,cta,creative_prompt');
      if (variantsError) throw variantsError;

      const saved = (savedVariants ?? generated.variants) as GeneratedVariant[];
      setResult({ ...generated, variants: saved });
      const variantId = saved[0]?.id;
      if (variantId) {
        const productionResponse = await fetch('/api/produce', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ variantId }) });
        if (!productionResponse.ok) setNotice('Content is in Review. The creative workspace can be prepared again later if needed.');
        else setNotice('Created and sent to Review. Nothing will publish until you approve it.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create content.');
    } finally { setCreating(false); }
  }

  if (loading) return <section className={styles.page}><div className={styles.empty}>Loading Create…</div></section>;
  if (!user) return <section className={styles.page}><div className={styles.empty}>Please sign in first.</div></section>;

  const selectedType = contentTypes.find((item) => item.id === contentType)!;

  return <section className={styles.page}>
    <header className={styles.hero}>
      <div><span className={styles.eyebrow}>CREATE</span><h1>What do you want to make?</h1><p>Pick the output, tell ContentOS the idea in one sentence, then let it fill the rest.</p></div>
      <Link href="/calendar" className={styles.secondary}>Create from Calendar</Link>
    </header>

    {notice && <div className={styles.notice}>{notice}</div>}
    {error && <div className={styles.error}>{error}</div>}

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span className={styles.eyebrow}>1 · OUTPUT</span><h2>Choose what you need</h2><p>Only the selected type is created. You can create other versions later if the campaign needs them.</p></div></div>
      <div className={styles.typeGrid}>
        {contentTypes.map((item) => <button type="button" key={item.id} className={`${styles.typeCard} ${contentType === item.id ? styles.typeCardActive : ''}`} onClick={() => chooseType(item.id)}>
          <span className={styles.typeIcon}>{item.icon}</span><strong>{item.label}</strong><small>{item.description}</small>
        </button>)}
      </div>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span className={styles.eyebrow}>2 · IDEA</span><h2>Tell me what it’s about</h2><p>One sentence is enough. ContentOS will use {brand?.name || 'the active brand'} knowledge and current phase.</p></div></div>
      <div className={styles.formGrid}>
        <label className={`${styles.field} ${styles.wide}`}><span>Your idea</span><textarea value={helperRequest} onChange={(event) => setHelperRequest(event.target.value)} placeholder="Example: Teach students how to install KampusRide on Android and iPhone and enable notifications." rows={3} /></label>
        <div className={styles.generateRow}><button type="button" disabled={filling || !brand || helperRequest.trim().length < 3} onClick={fillForMe}>{filling ? 'Filling…' : '✦ Help me fill'}</button></div>
      </div>
    </section>

    <form className={styles.panel} onSubmit={submit}>
      <div className={styles.panelHead}><div><span className={styles.eyebrow}>3 · REVIEW</span><h2>{selectedType.label} · {brand?.name || 'Active brand'}</h2><p>ContentOS filled the production brief. Edit only if you want to.</p></div></div>
      <div className={styles.formGrid}>
        <label className={`${styles.field} ${styles.wide}`}><span>Content brief</span><textarea value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Tap Help me fill above, or write your own brief." rows={6} /></label>
        <label className={styles.field}><span>Objective</span><input value={objective} onChange={(event) => setObjective(event.target.value)} /></label>
        <label className={styles.field}><span>Use during</span><select value={phase} onChange={(event) => setPhase(event.target.value)}>{phaseOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className={styles.field}><span>Platform</span><select value={platform} onChange={(event) => setPlatform(event.target.value)}>{platformOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className={styles.field}><span>Format</span><select value={format} onChange={(event) => setFormat(event.target.value)}>{formatOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className={`${styles.field} ${styles.wide}`}><span>Language / tone</span><input value={language} onChange={(event) => setLanguage(event.target.value)} /></label>

        <details className={`${styles.advanced} ${styles.wide}`}>
          <summary>Advanced · AI engines</summary>
          <p>Defaults are recommended. Change these only when you have a reason.</p>
          <div className={styles.engineGrid}>
            <label className={styles.field}><span>Copy</span><select value={copyEngine} onChange={(e) => setCopyEngine(e.target.value)}><option>ChatGPT</option><option>Claude</option></select></label>
            {['poster','carousel'].includes(contentType) && <label className={styles.field}><span>Visual</span><select value={visualEngine} onChange={(e) => setVisualEngine(e.target.value)}><option>ChatGPT</option><option>Claude</option></select></label>}
            {contentType === 'video' && <label className={styles.field}><span>Video</span><select value={videoEngine} onChange={(e) => setVideoEngine(e.target.value)}><option>Veo / Flow</option></select></label>}
          </div>
          <small>Engine choices are saved with the campaign. Automatic Claude/Veo rendering connectors will use these preferences when connected.</small>
        </details>

        <div className={styles.generateRow}><button disabled={creating || !brand || !idea.trim()}>{creating ? 'Creating…' : `✦ Create ${selectedType.label.toLowerCase()}`}</button></div>
      </div>
    </form>

    {result && result.variants[0] && <section className={styles.result}>
      <span className={styles.eyebrow}>CREATED · SENT TO REVIEW</span>
      <h2>{result.variants[0].hook}</h2>
      <div className={styles.resultGrid}>
        <article className={styles.resultCard}><span>CONTENT / SCRIPT</span><p>{result.variants[0].script}</p></article>
        <article className={styles.resultCard}><span>PUBLISH COPY</span><p>{result.variants[0].caption}</p></article>
        <article className={`${styles.resultCard} ${styles.wide}`}><span>CTA</span><p>{result.variants[0].cta}</p></article>
        <article className={`${styles.resultCard} ${styles.wide}`}><span>CREATIVE DIRECTION</span><p>{result.variants[0].creative_prompt}</p></article>
      </div>
      <div className={styles.resultActions}>
        <Link href="/review">Review & approve →</Link>
        {result.variants[0].id && <Link href={`/storyboards/${result.variants[0].id}`}>Open creative workspace</Link>}
        <Link href="/quick-create">Create another</Link>
      </div>
    </section>}
  </section>;
}
