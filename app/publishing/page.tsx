'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type Brand = { id: string; name: string };
type Variant = { id: string; hook: string; caption: string; script: string; status: string; source_plan_item_id: string | null; campaign_id: string };
type Connection = { id: string; username: string | null; status: string } | null;
type Publication = {
  id: string; post_text: string; status: string; scheduled_for: string | null; published_at: string | null;
  permalink: string | null; error_message: string | null; retry_count: number; created_at: string;
};

const FUNCTION_BASE = 'https://xqlfytlknhazusowiiug.supabase.co/functions/v1/contentos-social';
const THREADS_TEXT_LIMIT = 500;

export default function PublishingPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantId, setVariantId] = useState('');
  const [postText, setPostText] = useState('');
  const [connection, setConnection] = useState<Connection>(null);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [scheduleAt, setScheduleAt] = useState('');
  const [busy, setBusy] = useState<'publish' | 'schedule' | ''>('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedVariant = variants.find((item) => item.id === variantId);
  const connected = connection?.status === 'connected';
  const overLimit = postText.length > THREADS_TEXT_LIMIT;

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
      if (!data.user) { setLoading(false); return; }
      const { data: brandRows, error: brandError } = await supabase.from('contentos_brands').select('id,name').order('updated_at', { ascending: false });
      if (brandError) setError(brandError.message);
      const next = (brandRows ?? []) as Brand[];
      setBrands(next);
      if (next[0]) setBrandId(next[0].id);
      setLoading(false);
    }
    void init();
  }, [supabase]);

  useEffect(() => {
    if (brandId) void loadBrandPublishing(brandId);
  }, [brandId]);

  useEffect(() => {
    const selected = variants.find((item) => item.id === variantId);
    if (selected) setPostText(selected.caption || selected.script || selected.hook);
  }, [variantId, variants]);

  async function loadBrandPublishing(id: string) {
    setError('');
    const [campaignResult, connectionResult, publicationResult] = await Promise.all([
      supabase.from('contentos_campaigns').select('id').eq('brand_id', id).order('created_at', { ascending: false }).limit(100),
      supabase.from('contentos_social_connections').select('id,username,status').eq('brand_id', id).eq('platform', 'threads').maybeSingle(),
      supabase.from('contentos_publications').select('id,post_text,status,scheduled_for,published_at,permalink,error_message,retry_count,created_at').eq('brand_id', id).eq('platform', 'threads').order('created_at', { ascending: false }).limit(30),
    ]);
    if (campaignResult.error) { setError(campaignResult.error.message); return; }
    if (connectionResult.error) setError(connectionResult.error.message);
    if (publicationResult.error) setError(publicationResult.error.message);
    setConnection((connectionResult.data as Connection) ?? null);
    setPublications((publicationResult.data ?? []) as Publication[]);

    const campaignIds = (campaignResult.data ?? []).map((row: { id: string }) => row.id);
    if (!campaignIds.length) { setVariants([]); setVariantId(''); setPostText(''); return; }
    const { data: variantRows, error: variantError } = await supabase
      .from('contentos_content_variants')
      .select('id,hook,caption,script,status,source_plan_item_id,campaign_id')
      .in('campaign_id', campaignIds)
      .order('created_at', { ascending: false })
      .limit(100);
    if (variantError) { setError(variantError.message); return; }
    const next = (variantRows ?? []) as Variant[];
    setVariants(next);
    const requested = new URLSearchParams(window.location.search).get('variant');
    const initial = next.find((item) => item.id === requested) || next.find((item) => item.status === 'approved' || item.status === 'in_review') || next[0];
    setVariantId(initial?.id || '');
  }

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Your session expired. Please sign in again.');
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  async function createPublication(status: 'approved' | 'scheduled') {
    if (!user || !selectedVariant || !connection || !brandId || !postText.trim()) throw new Error('Select a connected brand and a content item first.');
    if (overLimit) throw new Error(`Threads primary text is over ${THREADS_TEXT_LIMIT} characters. Tighten the copy before publishing.`);
    const scheduledFor = status === 'scheduled' ? new Date(scheduleAt).toISOString() : null;
    const { error: variantError } = await supabase.from('contentos_content_variants').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', selectedVariant.id);
    if (variantError) throw variantError;
    const { data: publication, error: publicationError } = await supabase.from('contentos_publications').insert({
      brand_id: brandId,
      variant_id: selectedVariant.id,
      plan_item_id: selectedVariant.source_plan_item_id,
      connection_id: connection.id,
      created_by: user.id,
      platform: 'threads',
      post_text: postText.trim(),
      status,
      scheduled_for: scheduledFor,
      metadata: { source: 'contentos-publishing-ui' },
    }).select('id').single();
    if (publicationError) throw publicationError;
    return publication.id as string;
  }

  async function publishNow() {
    setBusy('publish'); setError(''); setMessage('');
    try {
      const publicationId = await createPublication('approved');
      const response = await fetch(`${FUNCTION_BASE}/publish`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ publication_id: publicationId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Threads publishing failed.');
      setMessage('Published to Threads successfully.');
      await loadBrandPublishing(brandId);
    } catch (err) { setError(err instanceof Error ? err.message : 'Publishing failed.'); }
    finally { setBusy(''); }
  }

  async function schedulePost() {
    if (!scheduleAt) { setError('Choose a date and time first.'); return; }
    const time = new Date(scheduleAt);
    if (Number.isNaN(time.getTime()) || time.getTime() <= Date.now()) { setError('Choose a future date and time.'); return; }
    setBusy('schedule'); setError(''); setMessage('');
    try {
      await createPublication('scheduled');
      setMessage('Scheduled. The Supabase worker checks the queue every minute and will publish when due.');
      setScheduleAt('');
      await loadBrandPublishing(brandId);
    } catch (err) { setError(err instanceof Error ? err.message : 'Scheduling failed.'); }
    finally { setBusy(''); }
  }

  if (loading) return <main className="toolShell"><div className="toolCard">Loading Publishing…</div></main>;
  if (!user) return <main className="toolShell"><div className="toolCard"><h1>Sign in first</h1><p>Open ContentOS Studio, sign in, then return here.</p><a className="toolPrimaryLink" href="/">Open Studio</a></div></main>;

  return (
    <main className="toolShell">
      <header className="toolHeader">
        <div><span className="eyebrow">CONTENTOS · PUBLISHING</span><h1>Approve once. Publish now or schedule it.</h1><p>Threads is the first direct channel. Every publication is tied to the selected brand and connected account.</p></div>
        <nav className="toolNav"><a href="/">Studio</a><a href="/planner">Planner</a><a href="/connections">Connections</a><a className="active" href="/publishing">Publishing</a></nav>
      </header>

      {message && <div className="notice">{message}</div>}
      {error && <div className="error globalError">{error}</div>}

      <section className="publishingGrid">
        <div className="panel publishComposer">
          <div className="panelHead"><span>01</span><div><h3>Final post</h3><p>Select approved/generated content, make the last edit, then choose when it goes live.</p></div></div>
          <label className="field"><span>Brand</span><select value={brandId} onChange={(e) => setBrandId(e.target.value)}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>

          <div className={`accountStrip ${connected ? 'connected' : ''}`}>
            <div><small>THREADS DESTINATION</small><strong>{connected ? `@${connection?.username || 'connected-account'}` : 'Not connected'}</strong></div>
            {!connected && <a href={`/connections?brand=${brandId}`}>Connect Threads</a>}
            {connected && <span>✓ Connected</span>}
          </div>

          <label className="field"><span>Content item</span><select value={variantId} onChange={(e) => setVariantId(e.target.value)}><option value="">Select content…</option>{variants.map((item) => <option key={item.id} value={item.id}>{item.status.toUpperCase()} · {item.hook.slice(0, 72)}</option>)}</select></label>
          <label className="field publishText"><span>Final Threads copy</span><textarea rows={12} value={postText} onChange={(e) => setPostText(e.target.value)} placeholder="Choose a content item or paste the final Threads post." /></label>
          <div className={`charCount ${overLimit ? 'over' : ''}`}><b>{postText.length}</b> / {THREADS_TEXT_LIMIT} characters {overLimit && <span>· shorten before publishing</span>}</div>

          <div className="publishActions">
            <button className="publishNow" disabled={!connected || !selectedVariant || !postText.trim() || overLimit || !!busy} onClick={publishNow}>{busy === 'publish' ? 'Publishing…' : 'Publish now'}</button>
            <div className="scheduleControls"><input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} /><button disabled={!connected || !selectedVariant || !scheduleAt || overLimit || !!busy} onClick={schedulePost}>{busy === 'schedule' ? 'Scheduling…' : 'Schedule'}</button></div>
          </div>
          <p className="publishGuardrail">Nothing is auto-published from generation. A human still chooses the final copy and explicitly publishes or schedules it.</p>
        </div>

        <section className="panel publishHistory">
          <div className="panelHead"><span>{publications.length}</span><div><h3>Publication history</h3><p>Scheduled, published and failed attempts stay visible here.</p></div></div>
          {publications.length === 0 && <div className="emptyState">No Threads publications for this brand yet.</div>}
          <div className="publicationList">
            {publications.map((item) => <article className="publicationCard" key={item.id}>
              <div className="publicationMeta"><span className={`pubStatus status-${item.status}`}>{item.status}</span><small>{new Date(item.created_at).toLocaleString('en-MY')}</small></div>
              <p>{item.post_text}</p>
              {item.scheduled_for && item.status === 'scheduled' && <div className="pubDetail"><b>Scheduled</b><span>{new Date(item.scheduled_for).toLocaleString('en-MY')}</span></div>}
              {item.published_at && <div className="pubDetail"><b>Published</b><span>{new Date(item.published_at).toLocaleString('en-MY')}</span></div>}
              {item.error_message && <div className="pubError">{item.error_message} {item.retry_count > 0 && <small>Retry count: {item.retry_count}</small>}</div>}
              {item.permalink && <a className="publicationLink" href={item.permalink} target="_blank" rel="noreferrer">View on Threads ↗</a>}
            </article>)}
          </div>
        </section>
      </section>
    </main>
  );
}
