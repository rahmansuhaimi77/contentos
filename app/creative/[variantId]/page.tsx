'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import styles from '@/components/workflow.module.css';
import creative from './creative.module.css';

const FLOW_URL = 'https://labs.google/fx/tools/flow';
const GENERATED_BUCKET = 'contentos-storyboards';

type Scene = {
  scene: number;
  duration: string;
  visual: string;
  on_screen_text: string;
  voiceover: string;
  image_prompt: string;
};

type GeneratedAsset = {
  id: string;
  kind: 'static_poster' | 'template_poster' | 'ai_background';
  template?: string;
  storage_path: string;
  created_at: string;
  provider: string;
  model: string;
  size: string;
  quality: string;
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
  generated_assets?: GeneratedAsset[];
};

type Variant = {
  id: string;
  campaign_id: string;
  hook: string;
  status: string;
  production_pack: ProductionPack | null;
};

type Campaign = {
  brand_id: string;
  platform: string;
  format: string;
  brief: Record<string, unknown> | null;
};

export default function CreativeWorkspacePage() {
  const params = useParams<{ variantId: string }>();
  const variantId = params.variantId;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [generating, setGenerating] = useState<string | false>(false);
  const [size, setSize] = useState<'feed' | 'story'>('feed');
  const [variant, setVariant] = useState<Variant | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [brandName, setBrandName] = useState('Brand');
  const [pack, setPack] = useState<ProductionPack | null>(null);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const contentType = String(campaign?.brief?.content_type || '').toLowerCase();
  const isStatic = contentType === 'poster' || /static/i.test(campaign?.format || '');
  const isVideo = contentType === 'video' || /video/i.test(campaign?.format || '');
  const generatedAssets = (pack?.generated_assets || []).filter((asset) => asset.kind !== 'ai_background');
  const hasBackground = (pack?.generated_assets || []).some((asset) => asset.kind === 'ai_background');

  useEffect(() => { void initialise(); }, [variantId]);

  async function loadAssetUrls(nextPack: ProductionPack | null) {
    const assets = nextPack?.generated_assets || [];
    if (!assets.length) { setAssetUrls({}); return; }
    const nextUrls: Record<string, string> = {};
    await Promise.all(assets.map(async (asset) => {
      const { data } = await supabase.storage.from(GENERATED_BUCKET).createSignedUrl(asset.storage_path, 3600);
      if (data?.signedUrl) nextUrls[asset.id] = data.signedUrl;
    }));
    setAssetUrls(nextUrls);
  }

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
    const nextPack = (nextVariant.production_pack as ProductionPack | null) ?? null;
    setVariant(nextVariant);
    setPack(nextPack);
    await loadAssetUrls(nextPack);

    const { data: campaignRow, error: campaignError } = await supabase
      .from('contentos_campaigns')
      .select('brand_id,platform,format,brief')
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

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Your session expired. Please sign in again.');
    return token;
  }

  async function preparePack() {
    if (!variant) return;
    setPreparing(true);
    setError('');
    setMessage('');
    try {
      const token = await getToken();
      const response = await fetch('/api/produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variantId: variant.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to prepare creative pack.');
      const nextPack = result.pack as ProductionPack;
      setPack(nextPack);
      await loadAssetUrls(nextPack);
      setMessage('Creative pack prepared.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to prepare creative pack.');
    } finally {
      setPreparing(false);
    }
  }

  async function applyResult(result: { pack?: ProductionPack; asset?: GeneratedAsset; signedUrl?: string | null }) {
    const nextPack = result.pack as ProductionPack;
    setPack(nextPack);
    if (result.asset?.id && result.signedUrl) setAssetUrls((current) => ({ ...current, [result.asset!.id]: result.signedUrl! }));
    else await loadAssetUrls(nextPack);
  }

  /** Free: exact text, real logo, real product photo (or the saved AI scene). */
  async function makePoster(template: 'photo' | 'bold' | 'scene') {
    if (!variant) return;
    setGenerating(template); setError(''); setMessage('');
    try {
      const token = await getToken();
      const response = await fetch('/api/poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variantId: variant.id, template, size }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to make the poster.');
      await applyResult(result);
      setMessage(result.template === 'bold' && template === 'photo'
        ? 'Poster ready. No matching vehicle photo for this post, so it uses the text design (no misleading car).'
        : `Poster ready${result.photo ? ` with your ${result.photo} photo` : ''}. Check it below before approval.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to make the poster.');
    } finally { setGenerating(false); }
  }

  /** Paid (OpenAI image): paints a text-free scene, then ContentOS puts the exact text on it. */
  async function makeAiScenePoster() {
    if (!variant) return;
    setGenerating('ai'); setError(''); setMessage('');
    try {
      const token = await getToken();
      const bg = await fetch('/api/generate-visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variantId: variant.id, mode: 'background' }),
      });
      const bgResult = await bg.json();
      if (!bg.ok) throw new Error(bgResult.error || 'Unable to generate the AI scene.');
      setPack(bgResult.pack as ProductionPack);
      setGenerating('scene');
      const response = await fetch('/api/poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variantId: variant.id, template: 'scene', size }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'AI scene saved, but the poster could not be finished.');
      await applyResult(result);
      setMessage('AI scene poster ready. The text, phone number and logo were added by ContentOS, not the AI.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to make the AI poster.');
    } finally { setGenerating(false); }
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
      <div>
        <span className={styles.eyebrow}>CREATIVE WORKSPACE</span>
        <h1>{pack?.hook || variant?.hook || 'Creative'}</h1>
        <p>{brandName} · {campaign?.platform || 'Content'} · {campaign?.format || 'Creative'}. {isStatic ? 'Generate the actual poster here, then review it before approval.' : isVideo ? 'Use the production pack for the video handoff.' : 'Use the production brief to create the selected asset.'}</p>
      </div>
      <div className={styles.toolbar}>
        <Link className={styles.secondary} href="/review">← Review</Link>
        {isVideo && <a className={styles.primary} href={FLOW_URL} target="_blank" rel="noreferrer">Open Google Flow ↗</a>}
      </div>
    </header>

    {message && <div className={styles.notice}>{message}</div>}
    {error && <div className={styles.error}>{error}</div>}

    {!pack ? <section className={styles.panel}>
      <div className={styles.createBar}><p>The copy exists, but this item does not have a production pack yet.</p><button onClick={preparePack} disabled={preparing}>{preparing ? 'Preparing…' : 'Prepare creative pack'}</button></div>
    </section> : <>
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div><span className={styles.eyebrow}>POSTER</span><h2>{generatedAssets.length ? 'Posters' : 'Make the poster'}</h2><p>Headline, phone number, CTA and logo are placed by ContentOS exactly as written. Only the background can come from AI.</p></div>
        </div>
        <div className={creative.posterControls}>
          <div className={creative.sizeToggle}>
            <button type="button" className={size === 'feed' ? creative.on : ''} onClick={() => setSize('feed')}>Feed 4:5</button>
            <button type="button" className={size === 'story' ? creative.on : ''} onClick={() => setSize('story')}>Story 9:16</button>
          </div>
          <button className={styles.primary} type="button" onClick={() => makePoster('photo')} disabled={!!generating}>{generating === 'photo' ? 'Making…' : 'Free: real car photo'}</button>
          <button className={styles.secondary} type="button" onClick={() => makePoster('bold')} disabled={!!generating}>{generating === 'bold' ? 'Making…' : 'Free: bold text'}</button>
          <button className={styles.secondary} type="button" onClick={makeAiScenePoster} disabled={!!generating}>{generating === 'ai' ? 'AI painting scene…' : generating === 'scene' ? 'Adding text…' : 'AI scene (≈RM0.20)'}</button>
          {hasBackground && <button className={styles.secondary} type="button" onClick={() => makePoster('scene')} disabled={!!generating}>Reuse last AI scene (free)</button>}
        </div>

        {generating === 'ai' && <div className={creative.visualGenerating}><strong>AI is painting the background…</strong><span>About 30–40 seconds. Keep this page open.</span></div>}
        {!generating && generatedAssets.length === 0 && <div className={creative.visualEmpty}>No poster yet. Start with <b>Free: real car photo</b>.</div>}

        <div className={creative.visualPreviewGrid}>
          {generatedAssets.map((asset, index) => <article className={creative.visualPreviewCard} key={asset.id}>
            <div className={creative.visualImageWrap}>
              {assetUrls[asset.id] ? <img src={assetUrls[asset.id]} alt={`${brandName} poster ${index + 1}`} /> : <div className={creative.visualEmpty}>Loading preview…</div>}
              {index === 0 && <span className={creative.latestBadge}>LATEST</span>}
            </div>
            <div className={creative.visualMeta}>
              <div><strong>{asset.kind === 'template_poster' ? (asset.template === 'scene' ? 'AI scene + exact text' : 'Template poster') : 'AI poster (text drawn by AI — check carefully)'}</strong><span>{new Date(asset.created_at).toLocaleString('en-MY')}</span></div>
              <small>{asset.model} · {asset.size}</small>
              {assetUrls[asset.id] && <a href={`${assetUrls[asset.id]}&download=${encodeURIComponent(`${brandName}-${index + 1}.png`)}`}>Download ↓</a>}
            </div>
          </article>)}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.context}>
          <div className={styles.contextMain}><span className={styles.contextLabel}>CREATIVE DIRECTION</span><h2>{pack.angle}</h2><p>{pack.creative_prompt}</p></div>
          <div className={styles.contextBox}><strong>CTA</strong><p>{pack.cta}</p></div>
          <div className={styles.contextBox}><strong>Status</strong><p>{variant?.status?.replaceAll('_', ' ') || 'in review'}</p></div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.summary}><div><strong>{pack.storyboard?.length || 0} scenes / slides</strong><span>{isStatic ? 'The prompt remains available for reference or manual alternatives.' : 'Copy prompts into your preferred production tool when needed.'}</span></div><button className={styles.primary} onClick={copyAll} disabled={!pack.storyboard?.length}>Copy all prompts</button></div>
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
