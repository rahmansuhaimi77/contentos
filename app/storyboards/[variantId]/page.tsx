'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

const FLOW_URL = 'https://labs.google/fx/tools/flow';

type FlowModel = 'Veo 3.1 - Lite' | 'Veo 3.1 - Fast' | 'Veo 3.1 - Quality';
type FlowPreset = 'economy' | 'balanced' | 'premium';
type Scene = { scene: number; duration: string; visual: string; on_screen_text: string; voiceover: string; image_prompt: string };
type FrameMetadata = { flow_model?: FlowModel; flow_duration?: '4s' | '6s' | '8s'; flow_status?: string; flow_last_copied_at?: string };
type Frame = {
  id: string; storyboard_id: string; scene_number: number; duration: string | null; visual: string;
  on_screen_text: string | null; voiceover: string | null; image_prompt: string; status: string;
  asset_path: string | null; provider?: string | null; generation_metadata?: FrameMetadata; preview_url?: string | null;
};
type Storyboard = { id: string; variant_id: string; brand_id: string; status: string; aspect_ratio: string };
type Pack = { hook?: string; storyboard?: Scene[] };
type VisualProfile = { primary_color?: string | null; secondary_color?: string | null; accent_color?: string | null; font_notes?: string | null; visual_style?: string | null; image_rules?: string | null };
type BrandAsset = { kind: string; title: string; notes: string | null };
type FlowProfile = { daily_credits: number; monthly_credits: number; lite_cost: number; fast_cost: number; quality_cost: number; preferred_preset: FlowPreset };

const defaultFlowProfile: FlowProfile = { daily_credits: 50, monthly_credits: 200, lite_cost: 10, fast_cost: 20, quality_cost: 100, preferred_preset: 'economy' };

export default function StoryboardWorkspacePage() {
  const params = useParams<{ variantId: string }>();
  const variantId = params.variantId;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [brandName, setBrandName] = useState('Brand');
  const [workspaceId, setWorkspaceId] = useState('');
  const [hook, setHook] = useState('Storyboard');
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [visualProfile, setVisualProfile] = useState<VisualProfile>({});
  const [brandAssets, setBrandAssets] = useState<BrandAsset[]>([]);
  const [flowProfile, setFlowProfile] = useState<FlowProfile>(defaultFlowProfile);
  const [savingFlow, setSavingFlow] = useState(false);
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [generatingScene, setGeneratingScene] = useState<number | null>(null);
  const [uploadingScene, setUploadingScene] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function modelForScene(preset: FlowPreset, sceneNumber: number): FlowModel {
    if (preset === 'economy') return 'Veo 3.1 - Lite';
    if (preset === 'balanced') return sceneNumber === 1 || sceneNumber === 5 ? 'Veo 3.1 - Fast' : 'Veo 3.1 - Lite';
    return sceneNumber === 1 ? 'Veo 3.1 - Quality' : 'Veo 3.1 - Fast';
  }

  function durationForScene(duration: string | null): '4s' | '6s' | '8s' {
    if (!duration) return '4s';
    const matches = duration.match(/(\d+)/g)?.map(Number) || [];
    const span = matches.length >= 2 ? Math.max(1, matches[1] - matches[0]) : matches[0] || 4;
    if (span <= 4) return '4s';
    if (span <= 6) return '6s';
    return '8s';
  }

  function modelCost(model: FlowModel) {
    if (model === 'Veo 3.1 - Fast') return flowProfile.fast_cost;
    if (model === 'Veo 3.1 - Quality') return flowProfile.quality_cost;
    return flowProfile.lite_cost;
  }

  useEffect(() => { void init(); }, [variantId]);

  async function init() {
    setLoading(true); setError('');
    const { data: authData } = await supabase.auth.getUser();
    setUser(authData.user ?? null);
    if (!authData.user) { setLoading(false); return; }

    const { data: variant, error: variantError } = await supabase.from('contentos_content_variants').select('id,campaign_id,hook,production_pack').eq('id', variantId).single();
    if (variantError || !variant) { setError(variantError?.message || 'Creative not found.'); setLoading(false); return; }
    const pack = (variant.production_pack || {}) as Pack;
    setHook(pack.hook || variant.hook || 'Storyboard');

    const { data: campaign, error: campaignError } = await supabase.from('contentos_campaigns').select('brand_id').eq('id', variant.campaign_id).single();
    if (campaignError || !campaign) { setError(campaignError?.message || 'Campaign not found.'); setLoading(false); return; }

    const { data: brand } = await supabase.from('contentos_brands').select('name,workspace_id').eq('id', campaign.brand_id).single();
    if (brand?.name) setBrandName(brand.name);
    if (brand?.workspace_id) setWorkspaceId(brand.workspace_id);

    const [{ data: visual }, { data: assetRows }] = await Promise.all([
      supabase.from('contentos_brand_visuals').select('primary_color,secondary_color,accent_color,font_notes,visual_style,image_rules').eq('brand_id', campaign.brand_id).maybeSingle(),
      supabase.from('contentos_brand_assets').select('kind,title,notes').eq('brand_id', campaign.brand_id).order('created_at', { ascending: true }),
    ]);
    setVisualProfile((visual || {}) as VisualProfile);
    setBrandAssets((assetRows || []) as BrandAsset[]);

    let loadedFlowProfile = defaultFlowProfile;
    if (brand?.workspace_id) {
      const { data: profile } = await supabase.from('contentos_flow_profiles').select('daily_credits,monthly_credits,lite_cost,fast_cost,quality_cost,preferred_preset').eq('workspace_id', brand.workspace_id).maybeSingle();
      if (profile) {
        loadedFlowProfile = { daily_credits: profile.daily_credits, monthly_credits: profile.monthly_credits, lite_cost: profile.lite_cost, fast_cost: profile.fast_cost, quality_cost: profile.quality_cost, preferred_preset: profile.preferred_preset as FlowPreset };
        setFlowProfile(loadedFlowProfile);
      } else {
        await supabase.from('contentos_flow_profiles').insert({ workspace_id: brand.workspace_id, ...defaultFlowProfile });
      }
    }

    let { data: board } = await supabase.from('contentos_storyboards').select('id,variant_id,brand_id,status,aspect_ratio').eq('variant_id', variantId).maybeSingle();
    if (!board) {
      const { data: created, error: createError } = await supabase.from('contentos_storyboards').insert({ variant_id: variantId, brand_id: campaign.brand_id, created_by: authData.user.id, status: 'prompt_ready', aspect_ratio: '9:16' }).select('id,variant_id,brand_id,status,aspect_ratio').single();
      if (createError || !created) { setError(createError?.message || 'Unable to create storyboard.'); setLoading(false); return; }
      board = created;
    }
    setStoryboard(board as Storyboard);

    let { data: frameRows, error: frameError } = await supabase.from('contentos_storyboard_frames').select('id,storyboard_id,scene_number,duration,visual,on_screen_text,voiceover,image_prompt,status,asset_path,provider,generation_metadata').eq('storyboard_id', board.id).order('scene_number');
    if (frameError) { setError(frameError.message); setLoading(false); return; }

    if ((!frameRows || frameRows.length === 0) && pack.storyboard?.length) {
      const rows = pack.storyboard.map((scene) => ({ storyboard_id: board.id, scene_number: scene.scene, duration: scene.duration, visual: scene.visual, on_screen_text: scene.on_screen_text, voiceover: scene.voiceover, image_prompt: scene.image_prompt || scene.visual, status: 'prompt_ready', generation_metadata: { flow_model: modelForScene(loadedFlowProfile.preferred_preset, scene.scene), flow_duration: durationForScene(scene.duration) } }));
      const { data: inserted, error: insertError } = await supabase.from('contentos_storyboard_frames').insert(rows).select('id,storyboard_id,scene_number,duration,visual,on_screen_text,voiceover,image_prompt,status,asset_path,provider,generation_metadata');
      if (insertError) { setError(insertError.message); setLoading(false); return; }
      frameRows = inserted;
    }

    const normalized = ((frameRows || []) as Frame[]).map((frame) => ({ ...frame, generation_metadata: { flow_model: frame.generation_metadata?.flow_model || modelForScene(loadedFlowProfile.preferred_preset, frame.scene_number), flow_duration: frame.generation_metadata?.flow_duration || durationForScene(frame.duration), ...frame.generation_metadata } }));
    setFrames(await withSignedPreviews(normalized));

    try { const provider = await fetch('/api/storyboards/provider').then((res) => res.json()); setProviderConfigured(Boolean(provider.configured)); } catch { setProviderConfigured(false); }
    setLoading(false);
  }

  const estimatedCredits = frames.reduce((sum, frame) => sum + modelCost(frame.generation_metadata?.flow_model || 'Veo 3.1 - Lite'), 0);
  const dailyCoverage = flowProfile.daily_credits > 0 ? Math.min(100, Math.round((flowProfile.daily_credits / Math.max(estimatedCredits, 1)) * 100)) : 0;

  async function withSignedPreviews(rows: Frame[]) {
    return Promise.all(rows.map(async (frame) => {
      if (!frame.asset_path) return { ...frame, preview_url: null };
      const { data } = await supabase.storage.from('contentos-storyboards').createSignedUrl(frame.asset_path, 3600);
      return { ...frame, preview_url: data?.signedUrl || null };
    }));
  }

  async function saveFlowProfile() {
    if (!workspaceId) return;
    setSavingFlow(true); setError(''); setMessage('');
    const { error: saveError } = await supabase.from('contentos_flow_profiles').upsert({ workspace_id: workspaceId, ...flowProfile, updated_at: new Date().toISOString() });
    setSavingFlow(false);
    if (saveError) { setError(saveError.message); return; }
    setMessage('Flow credit profile saved.');
  }

  async function applyPreset(preset: FlowPreset) {
    setFlowProfile((current) => ({ ...current, preferred_preset: preset }));
    const next = frames.map((frame) => ({ ...frame, generation_metadata: { ...(frame.generation_metadata || {}), flow_model: modelForScene(preset, frame.scene_number), flow_duration: frame.generation_metadata?.flow_duration || durationForScene(frame.duration) } }));
    setFrames(next);
    await Promise.all(next.map((frame) => supabase.from('contentos_storyboard_frames').update({ generation_metadata: frame.generation_metadata, updated_at: new Date().toISOString() }).eq('id', frame.id)));
    setMessage(`${preset[0].toUpperCase()}${preset.slice(1)} Flow preset applied.`);
  }

  async function updateFlowSetting(frame: Frame, patch: Partial<FrameMetadata>) {
    const metadata = { ...(frame.generation_metadata || {}), ...patch };
    setFrames((current) => current.map((item) => item.id === frame.id ? { ...item, generation_metadata: metadata } : item));
    const { error: updateError } = await supabase.from('contentos_storyboard_frames').update({ generation_metadata: metadata, updated_at: new Date().toISOString() }).eq('id', frame.id);
    if (updateError) setError(updateError.message);
  }

  function assetChecklist() {
    if (!brandAssets.length) return 'No approved reference assets are currently saved. Do not fabricate a logo or brand asset.';
    return brandAssets.map((asset) => `- ${asset.title} (${asset.kind})${asset.notes ? `: ${asset.notes}` : ''}`).join('\n');
  }

  function flowPrompt(frame: Frame) {
    const model = frame.generation_metadata?.flow_model || 'Veo 3.1 - Lite';
    const duration = frame.generation_metadata?.flow_duration || '4s';
    const colors = [visualProfile.primary_color, visualProfile.secondary_color, visualProfile.accent_color].filter(Boolean).join(', ');
    return `GOOGLE FLOW PRODUCTION PROMPT\n\nPROJECT\nBrand: ${brandName}\nFormat: vertical ${storyboard?.aspect_ratio || '9:16'}\nRecommended model: ${model}\nTarget clip length: ${duration}\nScene: ${frame.scene_number} of ${frames.length}\nCampaign hook: ${hook}\n\nREFERENCE ASSETS TO ADD IN FLOW\n${assetChecklist()}\n\nBRAND CONTINUITY\n${visualProfile.visual_style || 'Authentic Malaysian UGC/POV, realistic phone interaction, natural light, clean mobile-first composition.'}\n${colors ? `Approved brand colours: ${colors}.` : ''}\n${visualProfile.font_notes ? `Typography: ${visualProfile.font_notes}` : ''}\n${visualProfile.image_rules ? `Mandatory image rules: ${visualProfile.image_rules}` : ''}\nKeep the same phone, hand/person, lighting, environment and overall visual identity as the other scenes. Use the supplied SewaPro logo exactly when a logo is needed; never redraw, distort or reinterpret it.\n\nSCENE DIRECTION\n${frame.visual}\n\nON-SCREEN TEXT (Malay; preserve wording)\n${frame.on_screen_text || 'No required on-screen text.'}\n\nVOICEOVER (Malay; natural Malaysian delivery)\n${frame.voiceover || 'No required voiceover.'}\n\nSOURCE VISUAL PROMPT\n${frame.image_prompt}\n\nCAMERA / MOTION\nNatural smartphone-camera motion, believable human pacing, no excessive cinematic movement. Keep the subject readable for a vertical social ad. Reserve safe space for subtitles and UI overlays.\n\nNEGATIVE / SAFETY RULES\nDo not invent prices, discounts, customer reviews, availability, number plates, rental-company names or fake proof. Do not imply SewaPro owns the rental fleet. Do not show a vehicle as confirmed unless the scene explicitly says partner confirmation has happened. Avoid stock-footage polish, warped hands, distorted phones, unreadable UI, fake logos and random text.\n\nOUTPUT\nCreate one coherent ${duration} vertical clip for this scene only. It must be easy to combine with the other SewaPro scenes later.`;
  }

  async function copyFlowPrompt(frame: Frame) {
    await navigator.clipboard.writeText(flowPrompt(frame));
    await updateFlowSetting(frame, { flow_status: 'prompt_copied', flow_last_copied_at: new Date().toISOString() });
    setMessage(`Scene ${frame.scene_number} Flow production prompt copied.`);
  }

  async function copyAllFlowPrompts() {
    await navigator.clipboard.writeText(frames.map((frame) => flowPrompt(frame)).join('\n\n====================\n\n'));
    setMessage('All Flow scene prompts copied as one production pack.');
  }

  async function copyPrompt(frame: Frame) { await navigator.clipboard.writeText(frame.image_prompt); setMessage(`Scene ${frame.scene_number} image prompt copied.`); }

  async function generateFrame(frame: Frame) {
    setGeneratingScene(frame.scene_number); setError(''); setMessage('');
    try {
      const { data } = await supabase.auth.getSession(); const token = data.session?.access_token;
      if (!token) throw new Error('Your session expired. Please sign in again.');
      const response = await fetch('/api/storyboards/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ frameId: frame.id }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Unable to generate image.');
      setFrames((current) => current.map((item) => item.id === frame.id ? { ...item, status: 'generated', preview_url: result.previewUrl } : item));
      setMessage(`Scene ${frame.scene_number} generated.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to generate image.'); } finally { setGeneratingScene(null); }
  }

  async function uploadFrame(frame: Frame, file: File | null) {
    if (!file || !storyboard) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type)) { setError('Use PNG, JPG or WEBP for storyboard frames.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Storyboard image must be 10 MB or smaller.'); return; }
    setUploadingScene(frame.scene_number); setError(''); setMessage('');
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'; const path = `${storyboard.brand_id}/${storyboard.id}/scene-${frame.scene_number}-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('contentos-storyboards').upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' }); if (uploadError) throw uploadError;
      const metadata = { ...(frame.generation_metadata || {}), flow_status: 'result_uploaded' };
      const { error: updateError } = await supabase.from('contentos_storyboard_frames').update({ asset_path: path, status: 'uploaded', provider: 'flow/manual', generation_metadata: metadata, updated_at: new Date().toISOString() }).eq('id', frame.id); if (updateError) throw updateError;
      const { data } = await supabase.storage.from('contentos-storyboards').createSignedUrl(path, 3600);
      setFrames((current) => current.map((item) => item.id === frame.id ? { ...item, asset_path: path, status: 'uploaded', provider: 'flow/manual', generation_metadata: metadata, preview_url: data?.signedUrl || null } : item));
      setMessage(`Scene ${frame.scene_number} result uploaded.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to upload frame.'); } finally { setUploadingScene(null); }
  }

  async function markFrame(frame: Frame, status: 'approved' | 'rejected') {
    const { error: updateError } = await supabase.from('contentos_storyboard_frames').update({ status, updated_at: new Date().toISOString() }).eq('id', frame.id);
    if (updateError) { setError(updateError.message); return; }
    setFrames((current) => current.map((item) => item.id === frame.id ? { ...item, status } : item));
  }

  if (loading) return <main className="toolShell"><div className="toolCard">Loading storyboard…</div></main>;
  if (!user) return <main className="toolShell"><div className="toolCard"><h1>Sign in first</h1><p>Open ContentOS Studio, sign in, then return here.</p><a className="toolPrimaryLink" href="/">Open Studio</a></div></main>;

  return <main className="toolShell">
    <header className="toolHeader"><div><span className="eyebrow">CONTENTOS · FLOW PRODUCTION</span><h1>{hook}</h1><p>{brandName} · {storyboard?.aspect_ratio || '9:16'} · Build each scene in Google Flow, then bring the result back for approval.</p></div><nav className="toolNav"><a href="/planner">Planner</a><a href="/assets">Brand Assets</a><a href="/storyboards">Storyboards</a><a href="/">Studio</a></nav></header>
    {message && <div className="notice">{message}</div>}{error && <div className="error globalError">{error}</div>}

    <section className="flowConsole panel">
      <div className="flowConsoleHead"><div><span className="eyebrow">GOOGLE FLOW · PRIMARY VIDEO ENGINE</span><h2>Plan the credits before you generate.</h2><p>ContentOS prepares the prompt and tracks the budget. Flow does the actual media generation using your existing account credits.</p></div><div className="flowConsoleActions"><button className="toolPrimaryLink" onClick={copyAllFlowPrompts}>Copy all Flow prompts</button><a className="toolPrimaryLink flowOpen" href={FLOW_URL} target="_blank" rel="noreferrer">Open Google Flow ↗</a></div></div>
      <div className="flowStats"><div><small>EST. THIS PASS</small><strong>{estimatedCredits}</strong><span>credits</span></div><div><small>DAILY PROFILE</small><strong>{flowProfile.daily_credits}</strong><span>credits</span></div><div><small>MONTHLY PROFILE</small><strong>{flowProfile.monthly_credits}</strong><span>credits</span></div><div><small>DAILY COVERAGE</small><strong>{dailyCoverage}%</strong><span>of this pass</span></div></div>
      <div className="flowPresetRow"><div><b>Production preset</b><span>Economy = all Lite · Balanced = Fast for hook/CTA · Premium = Quality hero + Fast supporting scenes</span></div><div className="flowPresetButtons">{(['economy','balanced','premium'] as FlowPreset[]).map((preset) => <button key={preset} className={flowProfile.preferred_preset === preset ? 'selected' : ''} onClick={() => applyPreset(preset)}>{preset}</button>)}</div></div>
      <details className="flowCreditSettings"><summary>Credit assumptions & settings</summary><div className="flowCreditGrid"><label><span>Daily credits</span><input type="number" min="0" value={flowProfile.daily_credits} onChange={(e) => setFlowProfile({ ...flowProfile, daily_credits: Number(e.target.value) })}/></label><label><span>Monthly credits</span><input type="number" min="0" value={flowProfile.monthly_credits} onChange={(e) => setFlowProfile({ ...flowProfile, monthly_credits: Number(e.target.value) })}/></label><label><span>Lite / generation</span><input type="number" min="1" value={flowProfile.lite_cost} onChange={(e) => setFlowProfile({ ...flowProfile, lite_cost: Number(e.target.value) })}/></label><label><span>Fast / generation</span><input type="number" min="1" value={flowProfile.fast_cost} onChange={(e) => setFlowProfile({ ...flowProfile, fast_cost: Number(e.target.value) })}/></label><label><span>Quality / generation</span><input type="number" min="1" value={flowProfile.quality_cost} onChange={(e) => setFlowProfile({ ...flowProfile, quality_cost: Number(e.target.value) })}/></label><button onClick={saveFlowProfile} disabled={savingFlow}>{savingFlow ? 'Saving…' : 'Save Flow profile'}</button></div><p className="hint">Costs are estimates only. Flow can create multiple generations from one request and Google may change credit costs. Confirm the active model and charge shown inside Flow before generating.</p></details>
    </section>

    <section className="storyboardProvider panel"><div><span className="eyebrow">SECONDARY IMAGE PATH</span><h2>{providerConfigured ? 'ChatGPT/OpenAI image generation is connected' : 'No paid image API connected'}</h2><p>{providerConfigured ? 'You can still generate static storyboard frames inside ContentOS.' : 'That is intentional. Use Flow with your existing credits, or copy prompts into ChatGPT manually. No separate API spend is required.'}</p></div><a className="toolPrimaryLink" href="/assets">Review Brand Assets</a></section>

    <section className="storyboardFrames">{frames.map((frame) => { const selectedModel = frame.generation_metadata?.flow_model || 'Veo 3.1 - Lite'; const selectedDuration = frame.generation_metadata?.flow_duration || durationForScene(frame.duration); return <article className="storyboardFrame" key={frame.id}><div className="storyboardImageBox">{frame.preview_url ? <img src={frame.preview_url} alt={`Scene ${frame.scene_number}`}/> : <div className="storyboardPlaceholder"><span>SCENE {String(frame.scene_number).padStart(2,'0')}</span><b>{frame.duration}</b><small>Generate in Flow or upload a finished frame</small></div>}</div><div className="storyboardFrameBody"><div className="planMeta"><span>Scene {frame.scene_number}</span><span>{frame.duration}</span><span>{frame.status}</span><span>~{modelCost(selectedModel)} credits</span></div><h3>{frame.on_screen_text || `Scene ${frame.scene_number}`}</h3><p>{frame.visual}</p>{frame.voiceover && <div className="frameVoice"><b>VO</b><span>{frame.voiceover}</span></div>}
      <div className="flowSceneSettings"><label><span>Flow model</span><select value={selectedModel} onChange={(e) => updateFlowSetting(frame, { flow_model: e.target.value as FlowModel })}><option>Veo 3.1 - Lite</option><option>Veo 3.1 - Fast</option><option>Veo 3.1 - Quality</option></select></label><label><span>Clip length</span><select value={selectedDuration} onChange={(e) => updateFlowSetting(frame, { flow_duration: e.target.value as '4s'|'6s'|'8s' })}><option>4s</option><option>6s</option><option>8s</option></select></label></div>
      <details className="framePrompt"><summary>Flow-ready production prompt</summary><pre>{flowPrompt(frame)}</pre></details><details className="framePrompt"><summary>Raw image prompt</summary><p>{frame.image_prompt}</p></details>
      <div className="frameActions"><button className="flowScenePrimary" onClick={() => copyFlowPrompt(frame)}>Copy Flow prompt</button><a className="flowSceneLink" href={FLOW_URL} target="_blank" rel="noreferrer">Open Flow ↗</a><label className="frameUpload">{uploadingScene === frame.scene_number ? 'Uploading…' : 'Upload Flow result'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => uploadFrame(frame, e.target.files?.[0] || null)} disabled={uploadingScene === frame.scene_number}/></label><button onClick={() => copyPrompt(frame)}>Copy image prompt</button><button className="generateFrameButton" disabled={!providerConfigured || generatingScene === frame.scene_number} onClick={() => generateFrame(frame)}>{generatingScene === frame.scene_number ? 'Generating…' : '✦ Generate image'}</button>{frame.preview_url && <button className={frame.status === 'approved' ? 'activeState' : ''} onClick={() => markFrame(frame, 'approved')}>Approve</button>}{frame.preview_url && <button onClick={() => markFrame(frame, 'rejected')}>Reject</button>}</div>
    </div></article>; })}</section>
  </main>;
}
