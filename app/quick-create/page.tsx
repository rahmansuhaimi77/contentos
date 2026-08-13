'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import styles from '@/components/workflow.module.css';

type BrandBrain = {
  id: string;
  name: string;
  product: string;
  audience: string;
  positioning: string;
  voice: string;
  offer: string;
  proof: string;
  cta: string;
  avoid: string;
};

type GeneratedVariant = {
  id?: string;
  hook: string;
  angle: string;
  script: string;
  caption: string;
  cta: string;
  creative_prompt: string;
};

type GenerationResult = {
  strategy: string;
  variants: GeneratedVariant[];
  mode?: 'ai' | 'demo';
};

const platformOptions = ['Instagram carousel', 'TikTok / Reels', 'Threads', 'Facebook', 'WhatsApp', 'Multi-platform'];
const formatOptions = ['Carousel', '15-30 second short-form video', 'UGC / POV video', 'Static ad', 'Threads text post', 'Long-form post'];
const phaseOptions = ['Pre-Launch', 'Launch Week', 'Early Growth', 'Evergreen'];

export default function QuickCreatePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [brand, setBrand] = useState<BrandBrain | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [idea, setIdea] = useState('');
  const [objective, setObjective] = useState('Public product education / onboarding');
  const [platform, setPlatform] = useState('Instagram carousel');
  const [format, setFormat] = useState('Carousel');
  const [phase, setPhase] = useState('Pre-Launch');
  const [language, setLanguage] = useState('Bahasa Melayu / natural Manglish where appropriate');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadBrand(targetBrandId?: string | null) {
      const query = supabase
        .from('contentos_brands')
        .select('id,name,product,audience,positioning,voice,offer,proof,preferred_cta,avoid')
        .order('updated_at', { ascending: false });

      const { data, error: brandError } = targetBrandId
        ? await query.eq('id', targetBrandId).limit(1)
        : await query.limit(1);

      if (!mounted) return;
      if (brandError) {
        setError(brandError.message);
        return;
      }

      const row = data?.[0];
      if (!row) {
        setBrand(null);
        return;
      }

      setBrand({
        id: row.id,
        name: row.name,
        product: row.product,
        audience: row.audience,
        positioning: row.positioning,
        voice: row.voice,
        offer: row.offer,
        proof: row.proof,
        cta: row.preferred_cta,
        avoid: row.avoid,
      });
    }

    async function initialise() {
      const { data: authData } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(authData.user ?? null);
      if (!authData.user) { setLoading(false); return; }

      const selected = window.localStorage.getItem('contentos:selectedBrandId');
      await loadBrand(selected);
      setLoading(false);
    }

    async function onBrandChange(event: Event) {
      const custom = event as CustomEvent<{ brandId: string }>;
      setResult(null);
      setError('');
      await loadBrand(custom.detail.brandId);
    }

    initialise();
    window.addEventListener('contentos:brand-change', onBrandChange);
    return () => {
      mounted = false;
      window.removeEventListener('contentos:brand-change', onBrandChange);
    };
  }, [supabase]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user || !brand || !idea.trim()) return;

    setCreating(true);
    setError('');
    setResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your session expired. Please sign in again.');

      const brief = {
        objective,
        platform,
        format,
        language,
        count: 1,
        extra: `TARGET CONTENT PHASE: ${phase}. This asset is being created now for future use and should be publish-ready for that phase; do not assume it must be posted today. CONTENT REQUEST: ${idea.trim()}`,
      };

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          brand: {
            name: brand.name,
            product: brand.product,
            audience: brand.audience,
            positioning: brand.positioning,
            voice: brand.voice,
            offer: brand.offer,
            proof: brand.proof,
            cta: brand.cta,
            avoid: brand.avoid,
          },
          brief,
        }),
      });

      const generated: GenerationResult & { error?: string } = await response.json();
      if (!response.ok) throw new Error(generated.error || 'Unable to create content.');

      const { data: campaign, error: campaignError } = await supabase
        .from('contentos_campaigns')
        .insert({
          brand_id: brand.id,
          created_by: user.id,
          objective,
          platform,
          format,
          language,
          brief: { ...brief, target_phase: phase, quick_create: true },
          strategy: generated.strategy,
          status: 'generated',
        })
        .select('id')
        .single();
      if (campaignError) throw campaignError;

      const { data: savedVariants, error: variantsError } = await supabase
        .from('contentos_content_variants')
        .insert(generated.variants.map((variant) => ({
          campaign_id: campaign.id,
          hook: variant.hook,
          angle: variant.angle,
          script: variant.script,
          caption: variant.caption,
          cta: variant.cta,
          creative_prompt: variant.creative_prompt,
          status: 'in_review',
        })))
        .select('id,hook,angle,script,caption,cta,creative_prompt');
      if (variantsError) throw variantsError;

      setResult({ ...generated, variants: (savedVariants ?? generated.variants) as GeneratedVariant[] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create content.');
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <section className={styles.page}><div className={styles.empty}>Loading Quick Create…</div></section>;
  if (!user) return <section className={styles.page}><div className={styles.empty}>Please sign in first.</div></section>;

  return <section className={styles.page}>
    <header className={styles.hero}>
      <div><span className={styles.eyebrow}>QUICK CREATE</span><h1>Create now. Publish at the right time later.</h1><p>Use this for marketing assets you want to prepare now even when they are not yet scheduled in Calendar.</p></div>
      <Link href="/calendar" className={styles.secondary}>Use Calendar instead</Link>
    </header>

    {error && <div className={styles.error}>{error}</div>}

    <form className={styles.panel} onSubmit={submit}>
      <div className={styles.panelHead}><div><span className={styles.eyebrow}>BRIEF</span><h2>{brand?.name || 'Select a brand'}</h2><p>Tell ContentOS what asset you want. It will use the active Brand knowledge automatically.</p></div></div>
      <div className={styles.formGrid}>
        <label className={`${styles.field} ${styles.wide}`}><span>What do you want to create?</span><textarea value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Example: Create a public 6-slide carousel showing how to install KampusRide on Android and iPhone and enable push notifications." rows={5} /></label>
        <label className={styles.field}><span>Objective</span><input value={objective} onChange={(event) => setObjective(event.target.value)} /></label>
        <label className={styles.field}><span>Target phase</span><select value={phase} onChange={(event) => setPhase(event.target.value)}>{phaseOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className={styles.field}><span>Platform</span><select value={platform} onChange={(event) => setPlatform(event.target.value)}>{platformOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className={styles.field}><span>Format</span><select value={format} onChange={(event) => setFormat(event.target.value)}>{formatOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className={`${styles.field} ${styles.wide}`}><span>Language / tone</span><input value={language} onChange={(event) => setLanguage(event.target.value)} /></label>
        <div className={styles.generateRow}><button disabled={creating || !brand || !idea.trim()}>{creating ? 'Creating…' : '✦ Create content'}</button></div>
      </div>
    </form>

    {result && result.variants[0] && <section className={styles.result}>
      <span className={styles.eyebrow}>CREATED · SENT TO REVIEW</span>
      <h2>{result.variants[0].hook}</h2>
      <div className={styles.resultGrid}>
        <article className={styles.resultCard}><span>PRIMARY COPY / SCRIPT</span><p>{result.variants[0].script}</p></article>
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
