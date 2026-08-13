'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type ReviewItem = {
  id: string;
  hook: string;
  caption: string;
  script: string;
  cta: string;
  creative_prompt: string;
  status: string;
  campaign: { brand_id: string; platform: string; format: string } | null;
};

function pretty(value: string) {
  if (value === 'approved') return 'Ready';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ReviewPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [brandId, setBrandId] = useState('');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [tab, setTab] = useState<'in_review' | 'approved' | 'rejected'>('in_review');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data.user ?? null);
      if (!data.user) { setLoading(false); return; }
      const saved = window.localStorage.getItem('contentos:selectedBrandId') || '';
      setBrandId(saved);
      await load(saved);
      setLoading(false);
    }
    async function onBrandChange(event: Event) {
      const next = (event as CustomEvent<{ brandId: string }>).detail.brandId;
      setBrandId(next);
      await load(next);
    }
    void init();
    window.addEventListener('contentos:brand-change', onBrandChange);
    return () => { mounted = false; window.removeEventListener('contentos:brand-change', onBrandChange); };
  }, [supabase, tab]);

  async function load(targetBrandId: string) {
    setError('');
    const { data: campaigns, error: campaignError } = await supabase
      .from('contentos_campaigns')
      .select('id,brand_id,platform,format')
      .eq('brand_id', targetBrandId || '00000000-0000-0000-0000-000000000000')
      .order('created_at', { ascending: false })
      .limit(100);
    if (campaignError) { setError(campaignError.message); return; }

    const campaignMap = new Map((campaigns ?? []).map((campaign) => [campaign.id, campaign]));
    const ids = [...campaignMap.keys()];
    if (!ids.length) { setItems([]); return; }

    const { data, error: itemError } = await supabase
      .from('contentos_content_variants')
      .select('id,campaign_id,hook,caption,script,cta,creative_prompt,status,created_at')
      .in('campaign_id', ids)
      .eq('status', tab)
      .order('created_at', { ascending: false });
    if (itemError) { setError(itemError.message); return; }

    setItems((data ?? []).map((row) => ({
      id: row.id,
      hook: row.hook,
      caption: row.caption,
      script: row.script,
      cta: row.cta,
      creative_prompt: row.creative_prompt,
      status: row.status,
      campaign: campaignMap.get(row.campaign_id) ?? null,
    })) as ReviewItem[]);
  }

  async function setStatus(id: string, status: 'approved' | 'rejected' | 'in_review') {
    const { error: updateError } = await supabase.from('contentos_content_variants').update({ status }).eq('id', id);
    if (updateError) { setError(updateError.message); return; }
    setMessage(status === 'approved' ? 'Content is ready. Keep it here until the right publishing time.' : `Content marked ${pretty(status)}.`);
    await load(brandId);
  }

  if (loading) return <section className="unifiedPage"><div className="dashboardSkeleton">Loading content library…</div></section>;
  if (!user) return <section className="unifiedPage"><div className="dashboardEmpty"><h1>Sign in first</h1><Link className="appPrimary" href="/login">Sign in</Link></div></section>;

  return (
    <section className="unifiedPage">
      <header className="pageHero compactHero"><div><span className="eyebrow">REVIEW · LIBRARY</span><h1>Review it now. Use it when the timing is right.</h1><p>Everything you create lands here. Approve strong material as Ready, keep it for later, or send Threads content to Publish when needed.</p></div><Link className="appPrimary" href="/quick-create">✦ Quick Create</Link></header>
      {message && <div className="notice">{message}</div>}
      {error && <div className="error globalError">{error}</div>}

      <div className="reviewTabs">
        {(['in_review','approved','rejected'] as const).map((value) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{pretty(value)}</button>)}
      </div>

      <div className="reviewQueue">
        {items.length === 0 && <div className="dashboardEmpty small"><h2>Nothing here.</h2><p>No content is currently {pretty(tab).toLowerCase()} for this brand.</p></div>}
        {items.map((item) => {
          const threads = /threads/i.test(item.campaign?.platform || '');
          return <article className="reviewItem" key={item.id}>
            <div className="reviewItemMeta"><span>{item.campaign?.platform || 'Content'} · {item.campaign?.format || 'Creative'}</span><b className={`statusPill status-${item.status}`}>{pretty(item.status)}</b></div>
            <h2>{item.hook}</h2>
            <div className="reviewCopy"><label>CONTENT</label><p>{item.caption || item.script}</p></div>
            {item.cta && <div className="reviewCopy"><label>CTA</label><p>{item.cta}</p></div>}
            {item.creative_prompt && <div className="reviewCopy"><label>CREATIVE DIRECTION</label><p>{item.creative_prompt}</p></div>}
            <div className="reviewActions">
              <Link href={`/creative/${item.id}`}>Open creative</Link>
              {tab !== 'approved' && <button className="approve" onClick={() => setStatus(item.id, 'approved')}>✓ Mark Ready</button>}
              {tab !== 'in_review' && <button onClick={() => setStatus(item.id, 'in_review')}>Return to review</button>}
              {tab !== 'rejected' && <button className="reject" onClick={() => setStatus(item.id, 'rejected')}>Reject</button>}
              {tab === 'approved' && threads && <Link href={`/publishing?variant=${item.id}`}>Publish / schedule →</Link>}
            </div>
          </article>;
        })}
      </div>
    </section>
  );
}
