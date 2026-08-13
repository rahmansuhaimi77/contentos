'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import styles from '@/components/workflow.module.css';

const FLOW_URL = 'https://labs.google/fx/tools/flow';

type Scene = {
  scene: number;
  duration: string;
  visual: string;
  on_screen_text: string;
  voiceover: string;
  image_prompt: string;
};

type ProductionPack = {
  strategy: string;
  hook: string;
  angle: string;
  script: string;
  caption: string;
  cta: string;
  creative_prompt: string;
  storyboard: Scene[];
  qa_notes: string[];
};

type Variant = {
  id: string;
  campaign_id: string;
  hook: string;
  status: string;
  production_pack: ProductionPack | null;
};

type Campaign = { brand_id: string; platform: string; format: string };

export default function CreativeWorkspacePage() {
  const params = useParams<{ variantId: string }>();
  const variantId = params.variantId;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [variant, setVariant] = useState<Variant | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [brandName, setBrandName] = useState('Brand');
  const [pack, setPack] = useState<ProductionPack | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { void initialise(); }, [variantId]);

  async function initialise() {
    setLoading(true);
    setError('');
    const { data: authData } = await supabase.auth.getUser();
    setUser(authData.user ?? null);
    if (!authData.user) { setLoading(false); return; }

    const { data: variantRow, error: variantError } = await supabase
      .from('contentos_content_variants')
      .select('id,campaign_id,hook,status,production_pack')
      .eq('id', variantId)
      .single();
    if (variantError || !variantRow) {
      setError(variantError?.message || 'Creative not found.');
      setLoading(false);
      return;
    }

    const nextVariant = variantRow as Variant;
    setVariant(nextVariant);
    setPack((nextVariant.production_pack as ProductionPack | null) ?? null);

    const { data: campaignRow, error: campaignError } = await supabase
      .from('contentos_campaigns')
      .select('brand_id,platform,format')
      .eq('id', nextVariant.campaign_id)
      .single();
    if (campaignError || !campaignRow) {
      setError(campaignError?.message || 'Campaign not found.');
      setLoading(false);
      return;
    }
    setCampaign(campaignRow as Campaign);

    const { data: brandRow } = await supabase.from('contentos_brands').select('name').eq('id', campaignRow.brand_id).maybeSingle();
    if (brandRow?.name) setBrandName(brandRow.name);
    setLoading(false);
  }

  async function preparePack() {
    if (!variant) return;
    setPreparing(true);
    setError('');
    setMessage('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session expired. Please sign in again.');
      const response = await fetch('/api/produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variantId: variant.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to prepare creative pack.');
      setPack(result.pack as ProductionPack);
      setMessage('Creative pack prepared.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to prepare creative pack.');
    } finally {
      setPreparing(false);
    }
  }

  function scenePrompt(scene: Scene) {
    return [
      `Brand: ${brandName}`,
      `Platform: ${campaign?.platform || 'Content'}`,
      `Format: ${campaign?.format || 'Creative'}`,
      `Campaign: ${pack?.hook || variant?.hook || 'Content'}`,
      '',
      `Scene / slide ${scene.scene}: ${scene.duration}`,
      `Visual: ${scene.visual}`,
      `On-screen text: ${scene.on_screen_text || 'None'}`,
      `Voiceover: ${scene.voiceover || 'None'}`,
      '',
      scene.image_prompt,
      '',
      'Use only approved brand assets and verified UI references. Do not invent logos, unsupported app screens, official endorsements, prices, availability, ratings or safety guarantees.',
    ].join('\n');
  }

  async function copyScene(scene: Scene) {
    await navigator.clipboard.writeText(scenePrompt(scene));
    setMessage(`Scene ${scene.scene} prompt copied.`);
  }

  async function copyAll() {
    if (!pack?.storyboard?.length) return;
    await navigator.clipboard.writeText(pack.storyboard.map(scenePrompt).join('\n\n====================\n\n'));
    setMessage('All creative prompts copied.');
  }

  if (loading) return <section className={styles.page}><div className={styles.empty}>Loading creative workspace…</div></section>;
  if (!user) return <section className={styles.page}><div className={styles.empty}>Please sign in first.</div></section>;

  return <section className={styles.page}>
    <header className={styles.hero}>
      <div><span className={styles.eyebrow}>CREATIVE WORKSPACE</span><h1>{pack?.hook || variant?.hook || 'Creative'}</h1><p>{brandName} · {campaign?.platform || 'Content'} · {campaign?.format || 'Creative'}. Keep the production brief simple, then make the visuals in the tool you prefer.</p></div>
      <div className={styles.toolbar}><Link className={styles.secondary} href="/review">← Review</Link><a className={styles.primary} href={FLOW_URL} target="_blank" rel="noreferrer">Open Google Flow ↗</a></div>
    </header>

    {message && <div className={styles.notice}>{message}</div>}
    {error && <div className={styles.error}>{error}</div>}

    {!pack ? <section className={styles.panel}>
      <div className={styles.createBar}><p>The copy exists, but this item does not have a production pack yet.</p><button onClick={preparePack} disabled={preparing}>{preparing ? 'Preparing…' : 'Prepare creative pack'}</button></div>
    </section> : <>
      <section className={styles.panel}>
        <div className={styles.context}>
          <div className={styles.contextMain}><span className={styles.contextLabel}>CREATIVE DIRECTION</span><h2>{pack.angle}</h2><p>{pack.creative_prompt}</p></div>
          <div className={styles.contextBox}><strong>CTA</strong><p>{pack.cta}</p></div>
          <div className={styles.contextBox}><strong>Status</strong><p>{variant?.status?.replaceAll('_', ' ') || 'in review'}</p></div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.summary}><div><strong>{pack.storyboard?.length || 0} scenes / slides</strong><span>Copy prompts into Google Flow, ChatGPT or your preferred design tool. No model or credit assumptions are forced by ContentOS.</span></div><button className={styles.primary} onClick={copyAll} disabled={!pack.storyboard?.length}>Copy all prompts</button></div>
      </section>

      {!pack.storyboard?.length ? <div className={styles.empty}>No storyboard was generated for this content.</div> : <div className={styles.list}>
        {pack.storyboard.map((scene) => <article className={styles.item} key={scene.scene}>
          <div className={styles.date}><strong>{scene.scene}</strong><span>{scene.duration}</span></div>
          <div className={styles.body}>
            <div className={styles.meta}><span>Scene / Slide {scene.scene}</span></div>
            <h3>{scene.on_screen_text || `Scene ${scene.scene}`}</h3>
            <p>{scene.visual}</p>
            {scene.voiceover && <p><strong>VO:</strong> {scene.voiceover}</p>}
          </div>
          <div className={styles.actions}><button onClick={() => copyScene(scene)}>Copy prompt</button></div>
        </article>)}
      </div>}

      {pack.qa_notes?.length > 0 && <section className={styles.panel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>QA</span><h2>Before approval</h2></div></div><ul>{pack.qa_notes.map((note) => <li key={note}>{note}</li>)}</ul></section>}
    </>}
  </section>;
}
