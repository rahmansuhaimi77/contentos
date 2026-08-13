'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import styles from '@/components/workflow.module.css';

type Context = {
  planId: string;
  dayNumber: number;
  brandId: string;
  brandName: string;
  plannedDate: string | null;
  platform: string;
  format: string;
  objective: string;
  pillar: string;
  hook: string;
  concept: string;
  cta: string;
};

type Pack = { hook: string; script: string; caption: string; cta: string; creative_prompt: string };
type Result = { pack: Pack; variantId: string; campaignId: string };

export default function CreatePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function initialise() {
      const { data: authData } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(authData.user ?? null);
      if (!authData.user) { setLoading(false); return; }

      const params = new URLSearchParams(window.location.search);
      const planId = params.get('planId');
      const day = Number(params.get('day'));

      // The Create tab is Quick Create by default. Calendar links provide a planned brief here.
      if (!planId || !day) {
        window.location.replace('/quick-create');
        return;
      }

      const { data: plan, error: planError } = await supabase
        .from('contentos_content_plans')
        .select('id,brand_id,contentos_brands(name)')
        .eq('id', planId)
        .single();
      if (planError || !plan) { setError(planError?.message || 'Calendar item not found.'); setLoading(false); return; }

      const { data: item, error: itemError } = await supabase
        .from('contentos_plan_items')
        .select('day_number,planned_date,platform,format,objective,pillar,hook,concept,cta')
        .eq('plan_id', planId)
        .eq('day_number', day)
        .single();
      if (itemError || !item) { setError(itemError?.message || 'Calendar item not found.'); setLoading(false); return; }

      const brandName = (plan as any).contentos_brands?.name || 'Brand';
      const next: Context = {
        planId,
        dayNumber: item.day_number,
        brandId: plan.brand_id,
        brandName,
        plannedDate: item.planned_date,
        platform: item.platform,
        format: item.format,
        objective: item.objective,
        pillar: item.pillar,
        hook: item.hook,
        concept: item.concept,
        cta: item.cta,
      };
      setContext(next);
      window.localStorage.setItem('contentos:selectedBrandId', plan.brand_id);
      window.dispatchEvent(new CustomEvent('contentos:brand-change', { detail: { brandId: plan.brand_id } }));
      setLoading(false);
    }
    void initialise();
    return () => { mounted = false; };
  }, [supabase]);

  async function createContent() {
    if (!context) return;
    setCreating(true); setError(''); setResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your session expired. Please sign in again.');
      const response = await fetch('/api/produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId: context.planId, dayNumber: context.dayNumber }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to create content.');
      setResult({ pack: data.pack, variantId: data.variantId, campaignId: data.campaignId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create content.');
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <section className={styles.page}><div className={styles.empty}>Opening Create…</div></section>;
  if (!user) return <section className={styles.page}><div className={styles.empty}>Please sign in first.</div></section>;
  if (!context) return <section className={styles.page}><div className={styles.empty}>{error || 'Unable to open this Calendar item.'}<br /><br /><Link href="/calendar">Back to Calendar</Link></div></section>;

  return <section className={styles.page}>
    <header className={styles.hero}><div><span className={styles.eyebrow}>CREATE · FROM CALENDAR</span><h1>{context.hook}</h1><p>{context.brandName} · {context.platform} · {context.format}</p></div><Link className={styles.secondary} href="/calendar">← Back to Calendar</Link></header>
    {error && <div className={styles.error}>{error}</div>}

    <section className={styles.panel}>
      <div className={styles.context}>
        <div className={styles.contextMain}><span className={styles.contextLabel}>PLANNED BRIEF</span><h2>{context.hook}</h2><p>{context.concept}</p></div>
        <div className={styles.contextBox}><strong>Objective</strong><p>{context.objective}</p></div>
        <div className={styles.contextBox}><strong>CTA</strong><p>{context.cta}</p></div>
        <div className={styles.contextBox}><strong>Pillar</strong><p>{context.pillar}</p></div>
        <div className={styles.contextBox}><strong>Timing</strong><p>{context.plannedDate || 'Unscheduled'} · {context.platform}</p></div>
      </div>
    </section>

    {!result && <section className={styles.panel}><div className={styles.createBar}><p>The Calendar already carries the strategy and timing. Create turns this brief into the copy and creative pack.</p><button onClick={createContent} disabled={creating}>{creating ? 'Creating…' : '✦ Create content'}</button></div></section>}

    {result && <section className={styles.result}>
      <span className={styles.eyebrow}>CREATED · SENT TO REVIEW</span><h2>{result.pack.hook}</h2>
      <div className={styles.resultGrid}>
        <article className={styles.resultCard}><span>CONTENT / SCRIPT</span><p>{result.pack.script}</p></article>
        <article className={styles.resultCard}><span>PUBLISH COPY</span><p>{result.pack.caption}</p></article>
        <article className={`${styles.resultCard} ${styles.wide}`}><span>CTA</span><p>{result.pack.cta}</p></article>
        <article className={`${styles.resultCard} ${styles.wide}`}><span>CREATIVE DIRECTION</span><p>{result.pack.creative_prompt}</p></article>
      </div>
      <div className={styles.resultActions}><Link href="/review">Review & approve →</Link><Link href={`/creative/${result.variantId}`}>Open creative workspace</Link><Link href="/calendar">Back to Calendar</Link></div>
    </section>}
  </section>;
}
