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
type Routing = {
  copy_engine: 'openai' | 'claude';
  visual_engine: 'openai_image' | 'claude_openai_image' | 'manual';
  video_engine: 'veo_api' | 'flow_handoff' | 'manual';
  review_engine: 'none' | 'openai' | 'claude';
};

type ContentTypeOption = {
  id: ContentType;
  icon: string;
  label: string;
  description: string;
  platform: string;
  format: string;
};

const contentTypes: ContentTypeOption[] = [
  { id: 'write', icon: '✎', label: 'Write only', description: 'Caption, copy or script. No visual needed.', platform: 'Multi-platform', format: 'Long-form post' },
  { id: 'poster', icon: '▣', label: 'Make poster', description: 'One static visual + supporting copy.', platform: 'Multi-platform', format: 'Static ad' },
  { id: 'carousel', icon: '▦', label: 'Make carousel', description: 'Multi-slide visual content + caption.', platform: 'Instagram carousel', format: 'Carousel' },
  { id: 'video', icon: '▶', label: 'Make video', description: 'Hook, script, storyboard + video handoff.', platform: 'TikTok / Reels', format: '15-30 second short-form video' },
  { id: 'pack', icon: '✣', label: 'Make post pack', description: 'Adapt the same idea for several channels.', platform: 'Multi-platform', format: 'Long-form post' },
];

const platformOptions = ['Instagram carousel', 'TikTok / Reels', 'Threads', 'Facebook', 'WhatsApp', 'Multi-platform'];
const formatOptions = ['Carousel', '15-30 second short-form video', 'UGC / POV video', 'Static ad', 'Threads text post', 'Long-form post'];
const phaseOptions = ['Pre-Launch', 'Launch Week', 'Early Growth', 'Evergreen'];
const defaultRouting: Routing = { copy_engine: 'openai', visual_engine: 'openai_image', video_engine: 'flow_handoff', review_engine: 'none' };

const installTutorialPreset = {
  helper: 'Create a public how-to showing students how to install KampusRide on Android and iPhone, then enable notifications.',
  idea: 'Create a public 6-slide step-by-step tutorial titled “How to Install KampusRide + Enable Notifications”. Slide 1: How to Install KampusRide. Slide 2: Android — open KampusRide in Google Chrome. Slide 3: Android — tap the three-dot menu → Install app → Install. Slide 4: iPhone — open KampusRide in Safari → Share → Add to Home Screen → Open as Web App → Add. Slide 5: Enable Notifications — open KampusRide and tap Allow when the notification permission appears. Slide 6: Done — show the approved KR app icon on the Home Screen with “From Campus, For You.” Keep it simple, highly visual and student-friendly. Do not turn this into a general app introduction or Telegram comparison.',
  objective: 'Product education / onboarding — make installation and notification setup easy to understand and complete.',
  phase: 'Pre-Launch',
  platform: 'Instagram carousel',
  format: 'Carousel',
  language: 'Bahasa Melayu / natural Manglish, simple student-friendly instructions',
};

function routingNames(routing: Routing) {
  return {
    copy: routing.copy_engine === 'claude' ? 'Claude' : 'ChatGPT',
    visual: routing.visual_engine === 'manual' ? 'Manual upload' : routing.visual_engine === 'claude_openai_image' ? 'Claude planning → ChatGPT Image' : 'ChatGPT Image',
    video: routing.video_engine === 'veo_api' ? 'Veo API' : routing.video_engine === 'manual' ? 'Manual upload' : 'Veo / Flow handoff',
    review: routing.review_engine === 'claude' ? 'Claude review' : routing.review_engine === 'openai' ? 'ChatGPT review' : '',
  };
}

export default function QuickCreatePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [brand, setBrand] = useState<BrandBrain | null>(null);
  const [routing, setRouting] = useState<Routing>(defaultRouting);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filling, setFilling] = useState(false);
  const [contentType, setContentType] = useState<ContentType>('write');
  const [helperRequest, setHelperRequest] = useState('');
  const [idea, setIdea] = useState('');
  const [objective, setObjective] = useState('Create a useful, platform-ready marketing asset.');
  const [platform, setPlatform] = useState('Multi-platform');
  const [format, setFormat] = useState('Long-form post');
  const [phase, setPhase] = useState('Pre-Launch');
  const [language, setLanguage] = useState('Bahasa Melayu / natural Manglish where appropriate');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const selectedType = contentTypes.find((item) => item.id === contentType)!;
  const needsCreative = contentType === 'poster' || contentType === 'carousel' || contentType === 'video';
  const routeNames = routingNames(routing);
  const routeSummary = contentType === 'write' || contentType === 'pack'
    ? `${routeNames.copy}${routeNames.review ? ` → ${routeNames.review}` : ''} · visuals skipped`
    : contentType === 'video'
      ? `${routeNames.copy} → ${routeNames.video}${routeNames.review ? ` → ${routeNames.review}` : ''}`
      : `${routeNames.copy} → ${routeNames.visual}${routeNames.review ? ` → ${routeNames.review}` : ''}`;

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
      if (!row) { setBrand(null); setRouting(defaultRouting); return; }
      setBrand({ id: row.id, name: row.name, product: row.product, audience: row.audience, positioning: row.positioning, voice: row.voice, offer: row.offer, proof: row.proof, cta: row.preferred_cta, avoid: row.avoid });
      const { data: routingRow } = await supabase.from('contentos_ai_routing').select('copy_engine,visual_engine,video_engine,review_engine').eq('brand_id', row.id).maybeSingle();
      if (mounted) setRouting((routingRow as Routing | null) ?? defaultRouting);
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
    const preset = contentTypes.find((item) => item.id === next)!;
    setContentType(next);
    setPlatform(preset.platform);
    setFormat(preset.format);
    setResult(null);
    setError('');
    if (helperRequest.trim() || idea.trim()) {
      setIdea('');
      setNotice(`Output changed to ${preset.label}. Tap “Help me fill” to refresh the brief.`);
    } else {
      setNotice('');
    }
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
      setNotice(`Ready. ContentOS filled the ${selectedType.label.toLowerCase()} brief. Create now, or open Advanced if you want to edit.`);
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

      const brief = {
        objective, platform, format, language, count: 1,
        extra: `SELECTED OUTPUT TYPE: ${contentType}. TARGET CONTENT PHASE: ${phase}. This asset is being created now for future use and should be publish-ready for that phase; do not assume it must be posted today. CONTENT REQUEST: ${idea.trim()}`,
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
        brief: { ...brief, target_phase: phase, quick_create: true, content_type: contentType, assistant_request: helperRequest.trim() || null, engine_routing: routing },
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

      if (variantId && needsCreative) {
        const productionResponse = await fetch('/api/produce', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ variantId }) });
        await productionResponse.json();
        if (!productionResponse.ok) setNotice('Content is in Review. The visual/video production pack can be prepared again later.');
        else setNotice(`Created and sent to Review. ${contentType === 'video' ? 'Video' : 'Visual'} production is ready; nothing will publish until you approve it.`);
      } else {
        setNotice('Created and sent to Review. No visual production was requested for this output type.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create content.');
    } finally { setCreating(false); }
  }

  if (loading) return <section className={styles.page}><div className={styles.empty}>Loading Create…</div></section>;
  if (!user) return <section className={styles.page}><div className={styles.empty}>Please sign in first.</div></section>;

  return <section className={styles.page}>
    <header className={styles.hero}>
      <div><span className={styles.eyebrow}>CREATE</span><h1>Pick the output. Tell me the idea.</h1><p>ContentOS fills the rest. Only the content you choose gets produced — no unnecessary poster, carousel or video.</p></div>
      <Link href="/calendar" className={styles.secondary}>Create from Calendar</Link>
    </header>

    {notice && <div className={styles.notice}>{notice}</div>}
    {error && <div className={styles.error}>{error}</div>}

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span className={styles.eyebrow}>1 · OUTPUT</span><h2>What do you want to make?</h2><p>Pick one. ContentOS handles the production route automatically.</p></div></div>
      <div className={styles.typeGrid}>
        {contentTypes.map((item) => <button type="button" key={item.id} className={`${styles.typeCard} ${contentType === item.id ? styles.typeCardActive : ''}`} onClick={() => chooseType(item.id)}>
          <span className={styles.typeIcon}>{item.icon}</span><strong>{item.label}</strong><small>{item.description}</small>
        </button>)}
      </div>
      <div className={styles.routeNote}><b>Smart route:</b> {routeSummary} <Link href="/connections">Change in Settings</Link></div>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span className={styles.eyebrow}>2 · IDEA</span><h2>What is it about?</h2><p>One sentence is enough. ContentOS uses {brand?.name || 'the active brand'} knowledge and current phase.</p></div></div>
      <div className={styles.formGrid}>
        <label className={`${styles.field} ${styles.wide}`}><span>Your idea</span><textarea value={helperRequest} onChange={(event) => setHelperRequest(event.target.value)} placeholder="Example: Teach students how to install KampusRide on Android and iPhone and enable notifications." rows={3} /></label>
        <div className={styles.generateRow}><button type="button" disabled={filling || !brand || helperRequest.trim().length < 3} onClick={fillForMe}>{filling ? 'Filling…' : '✦ Help me fill'}</button></div>
      </div>
    </section>

    <form className={styles.panel} onSubmit={submit}>
      <div className={styles.panelHead}><div><span className={styles.eyebrow}>3 · READY</span><h2>{idea ? 'Ready to create' : 'Fill the brief first'}</h2><p>{idea ? 'Create now. Open Advanced only if you want to change the details.' : 'Tap “Help me fill” above, or open Advanced to write the brief manually.'}</p></div></div>

      {idea && <div className={styles.briefSummary}>
        <div><span>Output</span><strong>{selectedType.label}</strong></div>
        <div><span>Use during</span><strong>{phase}</strong></div>
        <div><span>Platform</span><strong>{platform}</strong></div>
        <div><span>Smart route</span><strong>{routeSummary}</strong></div>
      </div>}

      <details className={styles.advanced}>
        <summary>Advanced · review or edit the brief</summary>
        <div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.wide}`}><span>Detailed content brief</span><textarea value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Tap Help me fill above, or write your own brief." rows={6} /></label>
          <label className={styles.field}><span>Objective</span><input value={objective} onChange={(event) => setObjective(event.target.value)} /></label>
          <label className={styles.field}><span>Use during</span><select value={phase} onChange={(event) => setPhase(event.target.value)}>{phaseOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className={styles.field}><span>Platform</span><select value={platform} onChange={(event) => setPlatform(event.target.value)}>{platformOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className={styles.field}><span>Format</span><select value={format} onChange={(event) => setFormat(event.target.value)}>{formatOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className={`${styles.field} ${styles.wide}`}><span>Language / tone</span><input value={language} onChange={(event) => setLanguage(event.target.value)} /></label>
        </div>
        <small>AI/provider defaults are managed in Settings → AI & Channels, so this screen stays simple.</small>
      </details>

      <div className={styles.generateRow}><button disabled={creating || !brand || !idea.trim()}>{creating ? 'Creating…' : `✦ Create ${selectedType.label.toLowerCase()}`}</button></div>
    </form>

    {result && result.variants[0] && <section className={styles.result}>
      <span className={styles.eyebrow}>CREATED · SENT TO REVIEW</span>
      <h2>{result.variants[0].hook}</h2>
      <div className={styles.resultGrid}>
        <article className={styles.resultCard}><span>CONTENT / SCRIPT</span><p>{result.variants[0].script}</p></article>
        <article className={styles.resultCard}><span>PUBLISH COPY</span><p>{result.variants[0].caption}</p></article>
        <article className={`${styles.resultCard} ${styles.wide}`}><span>CTA</span><p>{result.variants[0].cta}</p></article>
        {needsCreative && <article className={`${styles.resultCard} ${styles.wide}`}><span>CREATIVE DIRECTION</span><p>{result.variants[0].creative_prompt}</p></article>}
      </div>
      <div className={styles.resultActions}>
        <Link href="/review">Review & approve →</Link>
        {needsCreative && result.variants[0].id && <Link href={`/storyboards/${result.variants[0].id}`}>{contentType === 'video' ? 'Open video workspace' : 'Open visual workspace'}</Link>}
        <Link href="/quick-create">Create another</Link>
      </div>
    </section>}
  </section>;
}
