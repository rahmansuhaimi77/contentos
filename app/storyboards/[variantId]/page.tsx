'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type Scene = { scene: number; duration: string; visual: string; on_screen_text: string; voiceover: string; image_prompt: string };
type Frame = {
  id: string;
  storyboard_id: string;
  scene_number: number;
  duration: string | null;
  visual: string;
  on_screen_text: string | null;
  voiceover: string | null;
  image_prompt: string;
  status: string;
  asset_path: string | null;
  preview_url?: string | null;
};
type Storyboard = { id: string; variant_id: string; brand_id: string; status: string; aspect_ratio: string };

type Pack = { hook?: string; storyboard?: Scene[] };

export default function StoryboardWorkspacePage() {
  const params = useParams<{ variantId: string }>();
  const variantId = params.variantId;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [brandName, setBrandName] = useState('Brand');
  const [hook, setHook] = useState('Storyboard');
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [generatingScene, setGeneratingScene] = useState<number | null>(null);
  const [uploadingScene, setUploadingScene] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void init();
  }, [variantId]);

  async function init() {
    setLoading(true); setError('');
    const { data: authData } = await supabase.auth.getUser();
    setUser(authData.user ?? null);
    if (!authData.user) { setLoading(false); return; }

    const { data: variant, error: variantError } = await supabase
      .from('contentos_content_variants')
      .select('id,campaign_id,hook,production_pack')
      .eq('id', variantId)
      .single();
    if (variantError || !variant) { setError(variantError?.message || 'Creative not found.'); setLoading(false); return; }

    const pack = (variant.production_pack || {}) as Pack;
    setHook(pack.hook || variant.hook || 'Storyboard');

    const { data: campaign, error: campaignError } = await supabase
      .from('contentos_campaigns')
      .select('brand_id')
      .eq('id', variant.campaign_id)
      .single();
    if (campaignError || !campaign) { setError(campaignError?.message || 'Campaign not found.'); setLoading(false); return; }

    const { data: brand } = await supabase.from('contentos_brands').select('name').eq('id', campaign.brand_id).single();
    if (brand?.name) setBrandName(brand.name);

    let { data: board } = await supabase
      .from('contentos_storyboards')
      .select('id,variant_id,brand_id,status,aspect_ratio')
      .eq('variant_id', variantId)
      .maybeSingle();

    if (!board) {
      const { data: created, error: createError } = await supabase
        .from('contentos_storyboards')
        .insert({ variant_id: variantId, brand_id: campaign.brand_id, created_by: authData.user.id, status: 'prompt_ready', aspect_ratio: '9:16' })
        .select('id,variant_id,brand_id,status,aspect_ratio')
        .single();
      if (createError || !created) { setError(createError?.message || 'Unable to create storyboard.'); setLoading(false); return; }
      board = created;
    }
    setStoryboard(board as Storyboard);

    let { data: frameRows, error: frameError } = await supabase
      .from('contentos_storyboard_frames')
      .select('id,storyboard_id,scene_number,duration,visual,on_screen_text,voiceover,image_prompt,status,asset_path')
      .eq('storyboard_id', board.id)
      .order('scene_number');

    if (frameError) { setError(frameError.message); setLoading(false); return; }

    if ((!frameRows || frameRows.length === 0) && pack.storyboard?.length) {
      const rows = pack.storyboard.map((scene) => ({
        storyboard_id: board.id,
        scene_number: scene.scene,
        duration: scene.duration,
        visual: scene.visual,
        on_screen_text: scene.on_screen_text,
        voiceover: scene.voiceover,
        image_prompt: scene.image_prompt || scene.visual,
        status: 'prompt_ready',
      }));
      const { data: inserted, error: insertError } = await supabase
        .from('contentos_storyboard_frames')
        .insert(rows)
        .select('id,storyboard_id,scene_number,duration,visual,on_screen_text,voiceover,image_prompt,status,asset_path');
      if (insertError) { setError(insertError.message); setLoading(false); return; }
      frameRows = inserted;
    }

    setFrames(await withSignedPreviews((frameRows || []) as Frame[]));

    try {
      const provider = await fetch('/api/storyboards/provider').then((res) => res.json());
      setProviderConfigured(Boolean(provider.configured));
    } catch {
      setProviderConfigured(false);
    }
    setLoading(false);
  }

  async function withSignedPreviews(rows: Frame[]) {
    return Promise.all(rows.map(async (frame) => {
      if (!frame.asset_path) return { ...frame, preview_url: null };
      const { data } = await supabase.storage.from('contentos-storyboards').createSignedUrl(frame.asset_path, 3600);
      return { ...frame, preview_url: data?.signedUrl || null };
    }));
  }

  async function copyPrompt(frame: Frame) {
    await navigator.clipboard.writeText(frame.image_prompt);
    setMessage(`Scene ${frame.scene_number} prompt copied.`);
  }

  async function generateFrame(frame: Frame) {
    setGeneratingScene(frame.scene_number); setError(''); setMessage('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session expired. Please sign in again.');
      const response = await fetch('/api/storyboards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ frameId: frame.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to generate image.');
      setFrames((current) => current.map((item) => item.id === frame.id ? { ...item, status: 'generated', preview_url: result.previewUrl } : item));
      setMessage(`Scene ${frame.scene_number} generated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate image.');
    } finally {
      setGeneratingScene(null);
    }
  }

  async function uploadFrame(frame: Frame, file: File | null) {
    if (!file || !storyboard) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type)) { setError('Use PNG, JPG or WEBP for storyboard frames.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Storyboard image must be 10 MB or smaller.'); return; }
    setUploadingScene(frame.scene_number); setError(''); setMessage('');
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${storyboard.brand_id}/${storyboard.id}/scene-${frame.scene_number}-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('contentos-storyboards').upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.from('contentos_storyboard_frames').update({ asset_path: path, status: 'uploaded', provider: 'manual', updated_at: new Date().toISOString() }).eq('id', frame.id);
      if (updateError) throw updateError;
      const { data } = await supabase.storage.from('contentos-storyboards').createSignedUrl(path, 3600);
      setFrames((current) => current.map((item) => item.id === frame.id ? { ...item, asset_path: path, status: 'uploaded', preview_url: data?.signedUrl || null } : item));
      setMessage(`Scene ${frame.scene_number} uploaded.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload frame.');
    } finally {
      setUploadingScene(null);
    }
  }

  async function markFrame(frame: Frame, status: 'approved' | 'rejected') {
    const { error: updateError } = await supabase.from('contentos_storyboard_frames').update({ status, updated_at: new Date().toISOString() }).eq('id', frame.id);
    if (updateError) { setError(updateError.message); return; }
    setFrames((current) => current.map((item) => item.id === frame.id ? { ...item, status } : item));
  }

  if (loading) return <main className="toolShell"><div className="toolCard">Loading storyboard…</div></main>;
  if (!user) return <main className="toolShell"><div className="toolCard"><h1>Sign in first</h1><p>Open ContentOS Studio, sign in, then return here.</p><a className="toolPrimaryLink" href="/">Open Studio</a></div></main>;

  return (
    <main className="toolShell">
      <header className="toolHeader">
        <div><span className="eyebrow">CONTENTOS · STORYBOARD VISUALS</span><h1>{hook}</h1><p>{brandName} · {storyboard?.aspect_ratio || '9:16'} · Turn each production scene into an approved visual frame.</p></div>
        <nav className="toolNav"><a href="/planner">Planner</a><a href="/assets">Brand Assets</a><a href="/">Studio</a></nav>
      </header>

      {message && <div className="notice">{message}</div>}
      {error && <div className="error globalError">{error}</div>}

      <section className="storyboardProvider panel">
        <div><span className="eyebrow">VISUAL PIPELINE</span><h2>{providerConfigured ? 'AI generation connected' : 'RM0 mode is active'}</h2><p>{providerConfigured ? 'Generate one frame at a time, then approve or replace it.' : 'Copy each scene prompt and upload the finished frame manually. AI generation stays disabled until an API key is connected, so there is no accidental spend.'}</p></div>
        <a className="toolPrimaryLink" href="/assets">Review Brand Assets</a>
      </section>

      <section className="storyboardFrames">
        {frames.map((frame) => <article className="storyboardFrame" key={frame.id}>
          <div className="storyboardImageBox">
            {frame.preview_url ? <img src={frame.preview_url} alt={`Scene ${frame.scene_number}`} /> : <div className="storyboardPlaceholder"><span>SCENE {String(frame.scene_number).padStart(2,'0')}</span><b>{frame.duration}</b><small>Visual not generated yet</small></div>}
          </div>
          <div className="storyboardFrameBody">
            <div className="planMeta"><span>Scene {frame.scene_number}</span><span>{frame.duration}</span><span>{frame.status}</span></div>
            <h3>{frame.on_screen_text || `Scene ${frame.scene_number}`}</h3>
            <p>{frame.visual}</p>
            {frame.voiceover && <div className="frameVoice"><b>VO</b><span>{frame.voiceover}</span></div>}
            <details className="framePrompt"><summary>Scene generation prompt</summary><p>{frame.image_prompt}</p></details>
            <div className="frameActions">
              <button onClick={() => copyPrompt(frame)}>Copy prompt</button>
              <label className="frameUpload">{uploadingScene === frame.scene_number ? 'Uploading…' : 'Upload frame'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => uploadFrame(frame, e.target.files?.[0] || null)} disabled={uploadingScene === frame.scene_number} /></label>
              <button className="generateFrameButton" disabled={!providerConfigured || generatingScene === frame.scene_number} onClick={() => generateFrame(frame)}>{generatingScene === frame.scene_number ? 'Generating…' : '✦ Generate image'}</button>
              {frame.preview_url && <button className={frame.status === 'approved' ? 'activeState' : ''} onClick={() => markFrame(frame, 'approved')}>Approve</button>}
              {frame.preview_url && <button onClick={() => markFrame(frame, 'rejected')}>Reject</button>}
            </div>
          </div>
        </article>)}
      </section>
    </main>
  );
}
