'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

const AI_FUNCTION_BASE = 'https://xqlfytlknhazusowiiug.supabase.co/functions/v1/contentos-ai';

type Brand = { id: string; name: string };

export default function OpenAIConnectionPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { void initialise(); }, []);

  async function token() {
    const { data } = await supabase.auth.getSession();
    const value = data.session?.access_token;
    if (!value) throw new Error('Your session expired. Please sign in again.');
    return value;
  }

  async function loadStatus(nextBrandId: string) {
    if (!nextBrandId) return;
    try {
      const response = await fetch(`${AI_FUNCTION_BASE}/status?brand_id=${encodeURIComponent(nextBrandId)}`, {
        headers: { Authorization: `Bearer ${await token()}` },
      });
      const data = await response.json();
      setConfigured(Boolean(response.ok && data?.providers?.openai?.configured));
    } catch {
      setConfigured(false);
    }
  }

  async function initialise() {
    const { data } = await supabase.auth.getUser();
    setUser(data.user ?? null);
    if (!data.user) { setLoading(false); return; }

    const { data: rows, error: brandError } = await supabase.from('contentos_brands').select('id,name').order('updated_at', { ascending: false });
    if (brandError) { setError(brandError.message); setLoading(false); return; }
    const next = (rows ?? []) as Brand[];
    setBrands(next);
    const saved = window.localStorage.getItem('contentos:selectedBrandId');
    const initial = next.find((item) => item.id === saved) || next[0];
    if (initial) {
      setBrandId(initial.id);
      await loadStatus(initial.id);
    }
    setLoading(false);
  }

  async function connect(e: FormEvent) {
    e.preventDefault();
    if (!brandId || !apiKey.trim()) return;
    setSaving(true); setMessage(''); setError('');
    try {
      const response = await fetch(`${AI_FUNCTION_BASE}/config/openai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ brand_id: brandId, api_key: apiKey.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to connect OpenAI.');
      setApiKey('');
      setConfigured(true);
      setMessage('OpenAI connected. The key is stored securely in Supabase Vault and can now be used for static visual generation.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect OpenAI.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="unifiedPage"><div className="dashboardSkeleton">Loading OpenAI setup…</div></section>;
  if (!user) return <section className="unifiedPage"><div className="dashboardEmpty"><h1>Sign in first</h1><Link className="appPrimary" href="/login">Sign in</Link></div></section>;

  const brandName = brands.find((item) => item.id === brandId)?.name || 'Active brand';

  return <section className="unifiedPage">
    <header className="pageHero compactHero">
      <div><span className="eyebrow">SETTINGS · OPENAI</span><h1>Connect OpenAI once.</h1><p>{brandName} · Used for ChatGPT copy and static poster/image generation inside ContentOS.</p></div>
      <Link className="appPrimary" href="/connections">← AI & Channels</Link>
    </header>

    {message && <div className="notice">{message}</div>}
    {error && <div className="error globalError">{error}</div>}

    <section className="panel" style={{ maxWidth: 720 }}>
      <div className="dashboardPanelHead"><div><span className="eyebrow">CONNECTION</span><h2>{configured ? 'OpenAI is connected' : 'Add your OpenAI API key'}</h2><p>The key is validated first, then stored in Supabase Vault. ContentOS never displays the saved key again.</p></div><span className={`connectionStatus ${configured ? 'isConnected' : ''}`}>{configured ? 'CONNECTED' : 'NOT CONNECTED'}</span></div>

      <form onSubmit={connect} className="connectionSetupForm">
        {brands.length > 1 && <label className="field"><span>Brand</span><select value={brandId} onChange={async (e) => { const next = e.target.value; setBrandId(next); setMessage(''); setError(''); await loadStatus(next); }}>{brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <label className="field"><span>{configured ? 'Replace OpenAI API key' : 'OpenAI API key'}</span><input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-…" /></label>
        <button className="generate" disabled={saving || !apiKey.trim()}>{saving ? 'Validating & saving…' : configured ? 'Replace key securely' : 'Connect OpenAI securely'}</button>
      </form>

      <div className="setupSteps" style={{ marginTop: 16 }}><b>What happens next</b><span>Return to the static poster workspace and tap Generate visual. The image request will use this vaulted key and save the generated poster back into ContentOS.</span></div>
      <p className="connectionNote">OpenAI API usage is billed separately from a ChatGPT subscription. ContentOS only calls image generation when you explicitly generate or regenerate a visual.</p>
    </section>
  </section>;
}
