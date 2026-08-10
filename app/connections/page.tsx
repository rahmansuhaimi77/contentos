'use client';

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
    async function init() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
      if (!data.user) { setLoading(false); return; }
      const { data: brandRows, error: brandError } = await supabase.from('contentos_brands').select('id,name,workspace_id').order('updated_at', { ascending: false });
      if (brandError) setError(brandError.message);
      const next = (brandRows ?? []) as Brand[];
      setBrands(next);
      const params = new URLSearchParams(window.location.search);
      const requestedBrand = params.get('brand');
      const initial = next.find((item) => item.id === requestedBrand) || next[0];
      if (initial) setBrandId(initial.id);
      if (params.get('threads') === 'connected') setMessage('Threads connected successfully. ContentOS can now publish for this brand.');
      if (params.get('threads') === 'error') setError(params.get('message') || 'Threads connection failed.');
      setLoading(false);
    }
    void init();
  }, [supabase]);

  useEffect(() => {
    if (brand) void loadConnection(brand);
  }, [brandId, brands]);

  async function loadConnection(current: Brand) {
    setError('');
    const [appResult, connectionResult] = await Promise.all([
      supabase.from('contentos_social_apps').select('client_id,redirect_uri,status').eq('workspace_id', current.workspace_id).eq('platform', 'threads').maybeSingle(),
      supabase.from('contentos_social_connections').select('id,username,display_name,status,token_expires_at').eq('brand_id', current.id).eq('platform', 'threads').maybeSingle(),
    ]);
    if (appResult.error) setError(appResult.error.message);
    if (connectionResult.error) setError(connectionResult.error.message);
    const config = (appResult.data as AppConfig) ?? null;
    setAppConfig(config);
    setAppId(config?.client_id || '');
    setAppSecret('');
    setConnection((connectionResult.data as Connection) ?? null);
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
      const response = await fetch(`${FUNCTION_BASE}/config/threads`, {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ workspace_id: brand.workspace_id, client_id: appId.trim(), client_secret: appSecret.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save Threads app setup.');
      setAppSecret('');
      setMessage('Threads developer app configured securely. App Secret is stored in Supabase Vault.');
      await loadConnection(brand);
    } catch (err) { setError(err instanceof Error ? err.message : 'Setup failed.'); }
    finally { setSaving(false); }
  }

  async function connectThreads() {
    if (!brand) return;
    setConnecting(true); setError(''); setMessage('');
    try {
      const response = await fetch(`${FUNCTION_BASE}/connect/threads`, {
        method: 'POST', headers: await authHeaders(), body: JSON.stringify({ brand_id: brand.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to start Threads connection.');
      window.location.href = data.url;
    } catch (err) { setError(err instanceof Error ? err.message : 'Connection failed.'); setConnecting(false); }
  }

  async function copyCallback() {
    await navigator.clipboard.writeText(appConfig?.redirect_uri || DEFAULT_CALLBACK);
    setMessage('Callback URL copied.');
  }

  if (loading) return <main className="toolShell"><div className="toolCard">Loading Connections…</div></main>;
  if (!user) return <main className="toolShell"><div className="toolCard"><h1>Sign in first</h1><p>Open ContentOS Studio, sign in, then return here.</p><a className="toolPrimaryLink" href="/">Open Studio</a></div></main>;

  return (
    <main className="toolShell">
      <header className="toolHeader">
        <div><span className="eyebrow">CONTENTOS · CONNECTIONS</span><h1>Connect the channels ContentOS can publish to.</h1><p>Each brand keeps its own social account connection. Tokens stay server-side in Supabase Vault.</p></div>
        <nav className="toolNav"><a href="/">Studio</a><a href="/planner">Planner</a><a href="/assets">Assets</a><a className="active" href="/connections">Connections</a><a href="/publishing">Publishing</a></nav>
      </header>

      {message && <div className="notice">{message}</div>}
      {error && <div className="error globalError">{error}</div>}

      <section className="panel connectionBrandBar">
        <label className="field"><span>Brand</span><select value={brandId} onChange={(e) => setBrandId(e.target.value)}>{brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div><span className="eyebrow">PUBLISHING IDENTITY</span><strong>{brand?.name || 'Select brand'}</strong><small>Connections are isolated by brand to prevent accidental cross-posting.</small></div>
      </section>

      <section className="connectionGrid">
        <article className="panel connectionCard primaryConnection">
          <div className="connectionHead"><div className="platformIcon">@</div><div><span className="eyebrow">PHASE 1 · DIRECT</span><h2>Threads</h2></div><span className={`connectionStatus ${connection?.status === 'connected' ? 'isConnected' : ''}`}>{connection?.status === 'connected' ? 'CONNECTED' : appConfig?.status === 'configured' ? 'READY TO CONNECT' : 'SETUP NEEDED'}</span></div>

          {connection?.status === 'connected' ? (
            <div className="connectedAccount">
              <div><strong>@{connection.username || connection.display_name || 'Threads account'}</strong><span>{connection.display_name || 'Connected Threads profile'}</span></div>
              <div><small>Token refresh target</small><b>{connection.token_expires_at ? new Date(connection.token_expires_at).toLocaleDateString() : 'Managed by ContentOS'}</b></div>
            </div>
          ) : (
            <>
              <div className="setupSteps"><b>One-time Meta setup</b><span>1. Create a Meta developer app with the Threads use case.</span><span>2. Add this exact callback URL in the Threads API settings.</span><span>3. Paste the Threads App ID + App Secret below.</span><span>4. Then click Connect Threads and approve access.</span></div>
              <div className="callbackBox"><small>OAuth callback URL</small><code>{appConfig?.redirect_uri || DEFAULT_CALLBACK}</code><button type="button" onClick={copyCallback}>Copy</button></div>
              <form onSubmit={saveThreadsSetup} className="connectionSetupForm">
                <label className="field"><span>Threads App ID</span><input value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="Meta Threads App ID" /></label>
                <label className="field"><span>Threads App Secret</span><input type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder={appConfig?.status === 'configured' ? 'Enter only when replacing the saved secret' : 'Stored securely in Supabase Vault'} /></label>
                <button className="generate" disabled={saving || !appId.trim() || !appSecret.trim()}>{saving ? 'Saving securely…' : appConfig?.status === 'configured' ? 'Replace Threads App Setup' : 'Save Threads App Setup'}</button>
              </form>
            </>
          )}

          {connection?.status !== 'connected' && <button className="connectButton" disabled={connecting || appConfig?.status !== 'configured'} onClick={connectThreads}>{connecting ? 'Opening Threads…' : 'Connect Threads account'}</button>}
          <p className="connectionNote">Direct publishing is text-first in Phase 1. ContentOS keeps the human approval gate before anything is posted.</p>
        </article>

        <article className="panel connectionCard">
          <div className="connectionHead"><div className="platformIcon">♪</div><div><span className="eyebrow">PHASE 1 · EXPORT</span><h2>TikTok</h2></div><span className="connectionStatus">EXPORT FIRST</span></div>
          <p>ContentOS will prepare the final video, caption and posting pack first. Direct TikTok posting comes after the developer app / Content Posting API approval flow.</p>
          <a className="toolPrimaryLink" href="/storyboards">Open video production</a>
        </article>

        <article className="panel connectionCard">
          <div className="connectionHead"><div className="platformIcon">▶</div><div><span className="eyebrow">PRODUCTION</span><h2>Google Flow</h2></div><span className="connectionStatus">FLOW PACK</span></div>
          <p>Flow stays the creative studio: ContentOS prepares prompts, you generate the visual/video, then bring the approved result back for publishing.</p>
          <a className="toolPrimaryLink" href="/storyboards">Open Flow workspace</a>
        </article>
      </section>
    </main>
  );
}
