'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type Brand = { id: string; name: string; workspace_id: string };
type AppConfig = { client_id: string; redirect_uri: string; status: string } | null;
type Connection = { id: string; username: string | null; display_name: string | null; status: string; token_expires_at: string | null } | null;
type Provider = { configured: boolean; capabilities: string[] };
type ProviderStatus = { openai: Provider; claude: Provider; google: Provider };
type Routing = {
  copy_engine: 'openai' | 'claude';
  visual_engine: 'openai_image' | 'claude_openai_image' | 'manual';
  video_engine: 'veo_api' | 'flow_handoff' | 'manual';
  review_engine: 'none' | 'openai' | 'claude';
};

const FUNCTION_BASE = 'https://xqlfytlknhazusowiiug.supabase.co/functions/v1/contentos-social';
const DEFAULT_CALLBACK = `${FUNCTION_BASE}/callback/threads`;
const defaultRouting: Routing = { copy_engine: 'openai', visual_engine: 'openai_image', video_engine: 'flow_handoff', review_engine: 'none' };

export default function ConnectionsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [appConfig, setAppConfig] = useState<AppConfig>(null);
  const [connection, setConnection] = useState<Connection>(null);
  const [providers, setProviders] = useState<ProviderStatus>({
    openai: { configured: false, capabilities: [] },
    claude: { configured: false, capabilities: [] },
    google: { configured: false, capabilities: [] },
  });
  const [routing, setRouting] = useState<Routing>(defaultRouting);
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingRouting, setSavingRouting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const brand = brands.find((item) => item.id === brandId);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data.user ?? null);
      if (!data.user) { setLoading(false); return; }

      const { data: brandRows, error: brandError } = await supabase.from('contentos_brands').select('id,name,workspace_id').order('updated_at', { ascending: false });
      if (!mounted) return;
      if (brandError) setError(brandError.message);
      const next = (brandRows ?? []) as Brand[];
      setBrands(next);
      const params = new URLSearchParams(window.location.search);
      const requestedBrand = params.get('brand');
      const saved = window.localStorage.getItem('contentos:selectedBrandId');
      const initial = next.find((item) => item.id === requestedBrand) || next.find((item) => item.id === saved) || next[0];
      if (initial) { setBrandId(initial.id); await loadBrandSettings(initial); }
      await loadProviderStatus();
      if (params.get('threads') === 'connected') setMessage('Threads connected successfully.');
      if (params.get('threads') === 'error') setError(params.get('message') || 'Threads connection failed.');
      setLoading(false);
    }

    async function onBrandChange(event: Event) {
      const nextId = (event as CustomEvent<{ brandId: string }>).detail.brandId;
      setBrandId(nextId); setMessage(''); setError('');
      const { data } = await supabase.from('contentos_brands').select('id,name,workspace_id').eq('id', nextId).single();
      if (data) await loadBrandSettings(data as Brand);
    }

    void init();
    window.addEventListener('contentos:brand-change', onBrandChange);
    return () => { mounted = false; window.removeEventListener('contentos:brand-change', onBrandChange); };
  }, [supabase]);

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Your session expired. Please sign in again.');
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  async function loadProviderStatus() {
    try {
      const response = await fetch('/api/providers/status', { headers: await authHeaders() });
      const data = await response.json();
      if (response.ok && data.providers) setProviders(data.providers as ProviderStatus);
    } catch {
      // Provider status is informative only; the rest of Settings should still load.
    }
  }

  async function loadBrandSettings(current: Brand) {
    const [appResult, connectionResult, routingResult] = await Promise.all([
      supabase.from('contentos_social_apps').select('client_id,redirect_uri,status').eq('workspace_id', current.workspace_id).eq('platform', 'threads').maybeSingle(),
      supabase.from('contentos_social_connections').select('id,username,display_name,status,token_expires_at').eq('brand_id', current.id).eq('platform', 'threads').maybeSingle(),
      supabase.from('contentos_ai_routing').select('copy_engine,visual_engine,video_engine,review_engine').eq('brand_id', current.id).maybeSingle(),
    ]);
    if (appResult.error) setError(appResult.error.message);
    if (connectionResult.error) setError(connectionResult.error.message);
    if (routingResult.error) setError(routingResult.error.message);
    const config = (appResult.data as AppConfig) ?? null;
    setAppConfig(config);
    setAppId(config?.client_id || '');
    setAppSecret('');
    setConnection((connectionResult.data as Connection) ?? null);
    setRouting((routingResult.data as Routing | null) ?? defaultRouting);
  }

  async function saveRouting() {
    if (!user || !brandId) return;
    setSavingRouting(true); setMessage(''); setError('');
    const { error: saveError } = await supabase.from('contentos_ai_routing').upsert({
      brand_id: brandId,
      ...routing,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'brand_id' });
    if (saveError) setError(saveError.message);
    else setMessage('Default AI routing saved. Create will use these preferences automatically.');
    setSavingRouting(false);
  }

  async function saveThreadsSetup(e: FormEvent) {
    e.preventDefault();
    if (!brand || !appId.trim() || !appSecret.trim()) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch(`${FUNCTION_BASE}/config/threads`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ workspace_id: brand.workspace_id, client_id: appId.trim(), client_secret: appSecret.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save Threads app setup.');
      setAppSecret(''); setMessage('Threads developer app setup saved securely.'); await loadBrandSettings(brand);
    } catch (err) { setError(err instanceof Error ? err.message : 'Setup failed.'); }
    finally { setSaving(false); }
  }

  async function connectThreads() {
    if (!brand) return;
    setConnecting(true); setError(''); setMessage('');
    try {
      const response = await fetch(`${FUNCTION_BASE}/connect/threads`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ brand_id: brand.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to start Threads connection.');
      window.location.href = data.url;
    } catch (err) { setError(err instanceof Error ? err.message : 'Connection failed.'); setConnecting(false); }
  }

  async function copyCallback() { await navigator.clipboard.writeText(appConfig?.redirect_uri || DEFAULT_CALLBACK); setMessage('Callback URL copied.'); }

  function providerBadge(configured: boolean) { return configured ? 'CONNECTED' : 'NOT CONFIGURED'; }

  if (loading) return <section className="unifiedPage"><div className="dashboardSkeleton">Loading Settings…</div></section>;
  if (!user) return <section className="unifiedPage"><div className="dashboardEmpty"><h1>Sign in first</h1><Link className="appPrimary" href="/login">Sign in</Link></div></section>;

  return <section className="unifiedPage">
    <header className="pageHero compactHero"><div><span className="eyebrow">SETTINGS · AI & CHANNELS</span><h1>Choose the defaults once. ContentOS handles the routing.</h1><p>{brand?.name || 'Active brand'} · Normal Create stays simple. Provider and channel details live here.</p></div><Link className="appPrimary" href="/quick-create">Open Create</Link></header>
    {message && <div className="notice">{message}</div>}
    {error && <div className="error globalError">{error}</div>}

    <section className="panel" style={{ marginBottom: 14 }}>
      <div className="dashboardPanelHead"><div><span className="eyebrow">AI PROVIDERS</span><h2>Generation engines</h2><p>API credentials remain server-side. This screen only shows whether ContentOS can use them.</p></div></div>
      <div className="connectionGrid">
        <article className="connectionCard"><div className="connectionHead"><div className="platformIcon">AI</div><div><span className="eyebrow">COPY + IMAGE</span><h2>ChatGPT / OpenAI</h2></div><span className={`connectionStatus ${providers.openai.configured ? 'isConnected' : ''}`}>{providerBadge(providers.openai.configured)}</span></div><p>Default for copy, captions, scripts and static visual generation when connected.</p></article>
        <article className="connectionCard"><div className="connectionHead"><div className="platformIcon">C</div><div><span className="eyebrow">OPTIONAL SUPPORT</span><h2>Claude</h2></div><span className={`connectionStatus ${providers.claude.configured ? 'isConnected' : ''}`}>{providerBadge(providers.claude.configured)}</span></div><p>Optional copy, creative planning and review. For final images, ContentOS still routes to an image renderer.</p></article>
        <article className="connectionCard"><div className="connectionHead"><div className="platformIcon">▶</div><div><span className="eyebrow">VIDEO</span><h2>Google Veo</h2></div><span className={`connectionStatus ${providers.google.configured ? 'isConnected' : ''}`}>{providerBadge(providers.google.configured)}</span></div><p>Programmatic video route when connected. Flow handoff remains available without an API connection.</p></article>
      </div>
    </section>

    <section className="panel" style={{ marginBottom: 14 }}>
      <div className="dashboardPanelHead"><div><span className="eyebrow">SMART ROUTING</span><h2>Default route for {brand?.name || 'this brand'}</h2><p>These defaults are automatic. You do not need to choose engines every time you create content.</p></div></div>
      <div className="connectionSetupForm">
        <label className="field"><span>Writing / captions</span><select value={routing.copy_engine} onChange={(e) => setRouting({ ...routing, copy_engine: e.target.value as Routing['copy_engine'] })}><option value="openai">ChatGPT</option><option value="claude" disabled={!providers.claude.configured}>Claude{!providers.claude.configured ? ' · not connected' : ''}</option></select></label>
        <label className="field"><span>Poster / carousel visuals</span><select value={routing.visual_engine} onChange={(e) => setRouting({ ...routing, visual_engine: e.target.value as Routing['visual_engine'] })}><option value="openai_image">ChatGPT Image</option><option value="claude_openai_image" disabled={!providers.claude.configured || !providers.openai.configured}>Claude plans → ChatGPT Image{!providers.claude.configured ? ' · Claude not connected' : ''}</option><option value="manual">Manual upload</option></select></label>
        <label className="field"><span>Video</span><select value={routing.video_engine} onChange={(e) => setRouting({ ...routing, video_engine: e.target.value as Routing['video_engine'] })}><option value="flow_handoff">Veo / Flow handoff</option><option value="veo_api" disabled={!providers.google.configured}>Veo API{!providers.google.configured ? ' · not connected' : ''}</option><option value="manual">Manual upload</option></select></label>
        <label className="field"><span>Optional AI review</span><select value={routing.review_engine} onChange={(e) => setRouting({ ...routing, review_engine: e.target.value as Routing['review_engine'] })}><option value="none">Off</option><option value="openai" disabled={!providers.openai.configured}>ChatGPT{!providers.openai.configured ? ' · not connected' : ''}</option><option value="claude" disabled={!providers.claude.configured}>Claude{!providers.claude.configured ? ' · not connected' : ''}</option></select></label>
        <button className="generate" type="button" disabled={savingRouting} onClick={saveRouting}>{savingRouting ? 'Saving…' : 'Save smart routing'}</button>
      </div>
      <p className="connectionNote">Create remains output-based: Write skips visuals, Poster/Carousel use the visual route, Video uses the video route, and Post Pack stays copy-first.</p>
    </section>

    <section className="panel">
      <div className="dashboardPanelHead"><div><span className="eyebrow">PUBLISHING CHANNELS</span><h2>Where approved content can go</h2><p>Publishing remains behind Review. Nothing posts automatically from Create.</p></div><Link href="/publishing">Open Publish →</Link></div>
      <div className="connectionGrid">
        <article className="connectionCard primaryConnection">
          <div className="connectionHead"><div className="platformIcon">@</div><div><span className="eyebrow">DIRECT</span><h2>Threads</h2></div><span className={`connectionStatus ${connection?.status === 'connected' ? 'isConnected' : ''}`}>{connection?.status === 'connected' ? 'CONNECTED' : appConfig?.status === 'configured' ? 'READY TO CONNECT' : 'SETUP NEEDED'}</span></div>
          {connection?.status === 'connected' ? <div className="connectedAccount"><div><strong>@{connection.username || connection.display_name || 'Threads account'}</strong><span>{connection.display_name || 'Connected Threads profile'}</span></div><div><small>Connection</small><b>Managed by ContentOS</b></div></div> : <>
            <div className="setupSteps"><b>One-time Meta setup</b><span>Configure the Threads developer app and callback once, then connect this brand's Threads account.</span></div>
            <div className="callbackBox"><small>OAuth callback URL</small><code>{appConfig?.redirect_uri || DEFAULT_CALLBACK}</code><button type="button" onClick={copyCallback}>Copy</button></div>
            <form onSubmit={saveThreadsSetup} className="connectionSetupForm"><label className="field"><span>Threads App ID</span><input value={appId} onChange={(e) => setAppId(e.target.value)} /></label><label className="field"><span>Threads App Secret</span><input type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder={appConfig?.status === 'configured' ? 'Enter only when replacing the saved secret' : 'Stored securely in Supabase Vault'} /></label><button className="generate" disabled={saving || !appId.trim() || !appSecret.trim()}>{saving ? 'Saving securely…' : appConfig?.status === 'configured' ? 'Replace app setup' : 'Save app setup'}</button></form>
          </>}
          {connection?.status !== 'connected' && <button className="connectButton" disabled={connecting || appConfig?.status !== 'configured'} onClick={connectThreads}>{connecting ? 'Opening Threads…' : 'Connect Threads account'}</button>}
        </article>

        <article className="connectionCard"><div className="connectionHead"><div className="platformIcon">T</div><div><span className="eyebrow">NEXT</span><h2>Telegram</h2></div><span className="connectionStatus">NOT CONNECTED</span></div><p>Next publishing connector: approved text, images, carousel albums and video to your chosen chat/channel.</p></article>
        <article className="connectionCard"><div className="connectionHead"><div className="platformIcon">W</div><div><span className="eyebrow">LATER</span><h2>WhatsApp</h2></div><span className="connectionStatus">NOT CONNECTED</span></div><p>Planned for approved campaign messages and media. Messaging rules and recipient controls will remain explicit.</p></article>
        <article className="connectionCard"><div className="connectionHead"><div className="platformIcon">♪</div><div><span className="eyebrow">EXPORT</span><h2>TikTok / Reels</h2></div><span className="connectionStatus">EXPORT FIRST</span></div><p>ContentOS can prepare the production package now; direct platform posting is a later connector.</p></article>
      </div>
      <p className="connectionNote">Approval gate: Create → Review → Ready → Schedule / Publish.</p>
    </section>
  </section>;
}
