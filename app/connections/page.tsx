'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type Brand = { id: string; name: string; workspace_id: string };
type AppConfig = { client_id: string; redirect_uri: string; status: string } | null;
type Connection = { id: string; username: string | null; display_name: string | null; status: string; token_expires_at: string | null } | null;

const FUNCTION_BASE = 'https://xqlfytlknhazusowiiug.supabase.co/functions/v1/contentos-social';
const DEFAULT_CALLBACK = `${FUNCTION_BASE}/callback/threads`;

export default function ConnectionsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [appConfig, setAppConfig] = useState<AppConfig>(null);
  const [connection, setConnection] = useState<Connection>(null);
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [saving, setSaving] = useState(false);
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
      if (initial) { setBrandId(initial.id); await loadConnection(initial); }
      if (params.get('threads') === 'connected') setMessage('Threads connected successfully.');
      if (params.get('threads') === 'error') setError(params.get('message') || 'Threads connection failed.');
      setLoading(false);
    }
    async function onBrandChange(event: Event) {
      const nextId = (event as CustomEvent<{ brandId: string }>).detail.brandId;
      const nextBrand = brands.find((item) => item.id === nextId);
      setBrandId(nextId); setMessage(''); setError('');
      if (nextBrand) await loadConnection(nextBrand);
    }
    void init();
    window.addEventListener('contentos:brand-change', onBrandChange);
    return () => { mounted = false; window.removeEventListener('contentos:brand-change', onBrandChange); };
  }, [supabase, brands.length]);

  async function loadConnection(current: Brand) {
    const [appResult, connectionResult] = await Promise.all([
      supabase.from('contentos_social_apps').select('client_id,redirect_uri,status').eq('workspace_id', current.workspace_id).eq('platform', 'threads').maybeSingle(),
      supabase.from('contentos_social_connections').select('id,username,display_name,status,token_expires_at').eq('brand_id', current.id).eq('platform', 'threads').maybeSingle(),
    ]);
    if (appResult.error) setError(appResult.error.message);
    if (connectionResult.error) setError(connectionResult.error.message);
    const config = (appResult.data as AppConfig) ?? null;
    setAppConfig(config); setAppId(config?.client_id || ''); setAppSecret(''); setConnection((connectionResult.data as Connection) ?? null);
  }

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Your session expired. Please sign in again.');
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  async function saveThreadsSetup(e: FormEvent) {
    e.preventDefault();
    if (!brand || !appId.trim() || !appSecret.trim()) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch(`${FUNCTION_BASE}/config/threads`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ workspace_id: brand.workspace_id, client_id: appId.trim(), client_secret: appSecret.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save Threads app setup.');
      setAppSecret(''); setMessage('Threads developer app setup saved securely.'); await loadConnection(brand);
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

  if (loading) return <section className="unifiedPage"><div className="dashboardSkeleton">Loading Settings…</div></section>;
  if (!user) return <section className="unifiedPage"><div className="dashboardEmpty"><h1>Sign in first</h1><Link className="appPrimary" href="/login">Sign in</Link></div></section>;

  return <section className="unifiedPage">
    <header className="pageHero compactHero"><div><span className="eyebrow">SETTINGS · CHANNELS</span><h1>Connect where approved content can publish.</h1><p>{brand?.name || 'Active brand'} · Connections are kept separate by brand to avoid accidental cross-posting.</p></div><Link className="appPrimary" href="/publishing">Open Publish</Link></header>
    {message && <div className="notice">{message}</div>}
    {error && <div className="error globalError">{error}</div>}

    <section className="connectionGrid">
      <article className="panel connectionCard primaryConnection">
        <div className="connectionHead"><div className="platformIcon">@</div><div><span className="eyebrow">DIRECT</span><h2>Threads</h2></div><span className={`connectionStatus ${connection?.status === 'connected' ? 'isConnected' : ''}`}>{connection?.status === 'connected' ? 'CONNECTED' : appConfig?.status === 'configured' ? 'READY TO CONNECT' : 'SETUP NEEDED'}</span></div>
        {connection?.status === 'connected' ? <div className="connectedAccount"><div><strong>@{connection.username || connection.display_name || 'Threads account'}</strong><span>{connection.display_name || 'Connected Threads profile'}</span></div><div><small>Connection</small><b>Managed by ContentOS</b></div></div> : <>
          <div className="setupSteps"><b>One-time Meta setup</b><span>Configure the Threads developer app and callback once, then connect this brand's Threads account.</span></div>
          <div className="callbackBox"><small>OAuth callback URL</small><code>{appConfig?.redirect_uri || DEFAULT_CALLBACK}</code><button type="button" onClick={copyCallback}>Copy</button></div>
          <form onSubmit={saveThreadsSetup} className="connectionSetupForm"><label className="field"><span>Threads App ID</span><input value={appId} onChange={(e) => setAppId(e.target.value)} /></label><label className="field"><span>Threads App Secret</span><input type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder={appConfig?.status === 'configured' ? 'Enter only when replacing the saved secret' : 'Stored securely in Supabase Vault'} /></label><button className="generate" disabled={saving || !appId.trim() || !appSecret.trim()}>{saving ? 'Saving securely…' : appConfig?.status === 'configured' ? 'Replace app setup' : 'Save app setup'}</button></form>
        </>}
        {connection?.status !== 'connected' && <button className="connectButton" disabled={connecting || appConfig?.status !== 'configured'} onClick={connectThreads}>{connecting ? 'Opening Threads…' : 'Connect Threads account'}</button>}
        <p className="connectionNote">Content is never posted from Create. It must be approved in Review and explicitly sent or scheduled in Publish.</p>
      </article>

      <article className="panel connectionCard"><div className="connectionHead"><div className="platformIcon">♪</div><div><span className="eyebrow">EXPORT</span><h2>TikTok / Reels</h2></div><span className="connectionStatus">EXPORT FIRST</span></div><p>ContentOS prepares the production pack. Direct posting can be added later without changing the Create → Review → Publish workflow.</p></article>
      <article className="panel connectionCard"><div className="connectionHead"><div className="platformIcon">▶</div><div><span className="eyebrow">CREATIVE</span><h2>Google Flow</h2></div><span className="connectionStatus">PROMPT HANDOFF</span></div><p>ContentOS prepares scene prompts and brand rules; Google Flow remains the external generation studio.</p></article>
    </section>
  </section>;
}
