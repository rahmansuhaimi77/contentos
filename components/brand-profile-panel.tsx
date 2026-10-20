'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BrandProfile } from '@/lib/engine/profile';

type ProfileResponse = {
  profile: BrandProfile;
  source: 'stored' | 'starter_pack' | 'brand_brain';
  columnReady: boolean;
  starterPacks: Array<{ slug: string; summary: string }>;
  ai: { configured: boolean; provider: string | null; model: string | null };
  error?: string;
};

const SOURCE_LABEL: Record<ProfileResponse['source'], string> = {
  stored: 'Saved profile',
  starter_pack: 'Bundled starter pack (not saved yet)',
  brand_brain: 'Built from the Brand Brain only',
};

export default function BrandProfilePanel({ supabase, brandId }: { supabase: SupabaseClient; brandId: string }) {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [draft, setDraft] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const authHeader = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error('Your session expired. Please sign in again.');
    return { Authorization: `Bearer ${token}` };
  }, [supabase]);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(`/api/brand-profile?brandId=${brandId}`, { headers: await authHeader() });
      const body = await res.json() as ProfileResponse;
      if (!res.ok) throw new Error(body.error || 'Could not load the brand profile.');
      setData(body);
      setDraft(JSON.stringify(body.profile, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the brand profile.');
    }
  }, [authHeader, brandId]);

  useEffect(() => { void load(); }, [load]);

  async function save(payload: { profile?: unknown; starterPack?: string }) {
    setBusy(true); setError(''); setMessage('');
    try {
      const res = await fetch('/api/brand-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ brandId, ...payload }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Save failed.');
      setMessage('Brand profile saved. New plans and content use it immediately.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally { setBusy(false); }
  }

  async function setPhase(key: string) {
    if (!data) return;
    await save({ profile: { ...data.profile, phase: { ...data.profile.phase, current: key } } });
  }

  function saveJson() {
    try {
      void save({ profile: JSON.parse(draft) });
    } catch {
      setError('That is not valid JSON. Check for a missing comma or quote.');
    }
  }

  if (!data) {
    return <section className="dashboardPanel"><div className="dashboardPanelHead"><div><span className="eyebrow">CONTENT ENGINE</span><h2>Brand profile</h2></div></div>{error ? <div className="error">{error}</div> : <p>Loading…</p>}</section>;
  }

  const p = data.profile;
  const phase = p.phase.options.find((o) => o.key === p.phase.current);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
  const nextMoments = p.calendar.filter((w) => w.end >= today).slice(0, 3);

  return (
    <section className="dashboardPanel">
      <div className="dashboardPanelHead"><div><span className="eyebrow">CONTENT ENGINE</span><h2>Brand profile</h2></div></div>
      {message && <div className="notice">{message}</div>}
      {error && <div className="error">{error}</div>}

      <p><strong>Source:</strong> {SOURCE_LABEL[data.source]}</p>
      <p><strong>AI writing:</strong> {data.ai.configured
        ? `On (${data.ai.provider}${data.ai.model ? ` · ${data.ai.model}` : ''})`
        : 'Off: drafts come from the profile’s idea bank. Add GEMINI_API_KEY in Vercel for fresh AI writing (free tier).'}</p>
      <p>{p.pillars.length} pillars · {p.exemplars.length} example ideas · {p.channels.length} channels · {p.calendar.length} calendar windows · {p.modes.length} special modes</p>

      <label className="field"><span>Current phase</span>
        <select value={p.phase.current} disabled={busy || !data.columnReady} onChange={(e) => void setPhase(e.target.value)}>
          {p.phase.options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </label>
      {phase?.guidance && <p className="muted">{phase.guidance}</p>}

      {nextMoments.length > 0 && <div><strong>Calendar now / next</strong><ul>{nextMoments.map((w) => <li key={`${w.start}-${w.label}`}>{w.start} → {w.end}: {w.label}</li>)}</ul></div>}

      {!data.columnReady && <div className="notice">To save changes, run <code>supabase/migrations/011_brand_profile.sql</code> once in the Supabase SQL editor. Generation already works from the bundled pack.</div>}

      <div className="buttonRow">
        {data.source !== 'stored' && data.starterPacks.some((s) => s.slug === p.slug) && (
          <button className="generate" disabled={busy || !data.columnReady} onClick={() => void save({ starterPack: p.slug })}>Save starter pack as this brand&apos;s profile</button>
        )}
        <button type="button" onClick={() => setShowJson(!showJson)}>{showJson ? 'Hide' : 'Edit'} full profile (JSON)</button>
      </div>

      {showJson && <>
        <textarea rows={22} spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} style={{ width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
        <button className="generate" disabled={busy || !data.columnReady} onClick={saveJson}>{busy ? 'Saving…' : 'Save profile'}</button>
      </>}
    </section>
  );
}
