'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import styles from '@/components/workflow.module.css';

type Brand = { id: string; name: string };
type Plan = { id: string; name: string; start_date: string | null; objective: string; platforms: string[]; language: string; created_at: string };
type Item = { id: string; day_number: number; planned_date: string | null; pillar: string; objective: string; platform: string; format: string; hook: string; concept: string; cta: string; status: string; production_status: string };

const platformOptions = ['TikTok / Reels', 'Threads', 'Facebook', 'Instagram', 'WhatsApp'];

function malaysiaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function formatDate(value: string | null, dayNumber: number) {
  if (!value) return { top: `Day ${dayNumber}`, bottom: 'Unscheduled' };
  const date = new Date(`${value}T00:00:00`);
  return {
    top: date.toLocaleDateString('en-MY', { day: '2-digit', month: 'short' }),
    bottom: date.toLocaleDateString('en-MY', { weekday: 'short' }),
  };
}

export default function CalendarPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerator, setShowGenerator] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [objective, setObjective] = useState('Build awareness and move the current product phase forward');
  const [platforms, setPlatforms] = useState<string[]>(['Threads', 'WhatsApp']);
  const [language, setLanguage] = useState('Bahasa Melayu / natural Manglish where appropriate');
  const [startDate, setStartDate] = useState(malaysiaToday());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function initialise() {
      const { data: authData } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(authData.user ?? null);
      if (!authData.user) { setLoading(false); return; }

      const { data } = await supabase.from('contentos_brands').select('id,name').order('updated_at', { ascending: false });
      const nextBrands = (data ?? []) as Brand[];
      setBrands(nextBrands);
      const saved = window.localStorage.getItem('contentos:selectedBrandId');
      const selected = nextBrands.some((brand) => brand.id === saved) ? saved! : nextBrands[0]?.id || '';
      setBrandId(selected);
      if (selected) await loadCalendar(selected);
      setLoading(false);
    }

    async function onBrandChange(event: Event) {
      const custom = event as CustomEvent<{ brandId: string }>;
      setBrandId(custom.detail.brandId);
      await loadCalendar(custom.detail.brandId);
    }

    initialise();
    window.addEventListener('contentos:brand-change', onBrandChange);
    return () => { mounted = false; window.removeEventListener('contentos:brand-change', onBrandChange); };
  }, [supabase]);

  async function loadCalendar(targetBrandId: string) {
    setError('');
    const { data: plans, error: planError } = await supabase
      .from('contentos_content_plans')
      .select('id,name,start_date,objective,platforms,language,created_at')
      .eq('brand_id', targetBrandId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (planError) { setError(planError.message); return; }

    const latest = (plans ?? [])[0] as Plan | undefined;
    if (!latest) { setPlan(null); setItems([]); return; }
    setPlan(latest);
    setObjective(latest.objective || objective);
    setPlatforms(latest.platforms?.length ? latest.platforms : platforms);
    setLanguage(latest.language || language);
    setStartDate(latest.start_date || malaysiaToday());

    const { data: rows, error: itemError } = await supabase
      .from('contentos_plan_items')
      .select('id,day_number,planned_date,pillar,objective,platform,format,hook,concept,cta,status,production_status')
      .eq('plan_id', latest.id)
      .order('planned_date', { ascending: true })
      .order('day_number', { ascending: true });
    if (itemError) { setError(itemError.message); return; }
    setItems((rows ?? []) as Item[]);
  }

  function togglePlatform(platform: string) {
    setPlatforms((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform]);
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!brandId || platforms.length === 0) return;
    setGenerating(true); setMessage(''); setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your session expired. Please sign in again.');
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brandId, objective, platforms, language, startDate }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to generate calendar.');
      setMessage('New 30-day calendar created. Review the dates, then create content from any item.');
      setShowGenerator(false);
      await loadCalendar(brandId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate calendar.');
    } finally {
      setGenerating(false);
    }
  }

  const selectedBrand = brands.find((brand) => brand.id === brandId);

  if (loading) return <section className={styles.page}><div className={styles.empty}>Loading Calendar…</div></section>;
  if (!user) return <section className={styles.page}><div className={styles.empty}>Please sign in first.</div></section>;

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div><span className={styles.eyebrow}>CALENDAR</span><h1>Decide what to post — and when.</h1><p>Calendar is the planning layer. Pick the right message, platform and date first. Then send the item to Create to make the actual asset.</p></div>
        <button className={styles.primary} onClick={() => setShowGenerator((value) => !value)}>{showGenerator ? 'Close generator' : '+ Generate calendar'}</button>
      </header>

      {message && <div className={styles.notice}>{message}</div>}
      {error && <div className={styles.error}>{error}</div>}

      {showGenerator && <form className={styles.panel} onSubmit={generate}>
        <div className={styles.panelHead}><div><span className={styles.eyebrow}>GENERATE</span><h2>Build a 30-day calendar</h2><p>Strategy and verified brand knowledge guide the plan. This is an execution calendar, not the strategy itself.</p></div></div>
        <div className={styles.formGrid}>
          <label className={styles.field}><span>Start date</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
          <label className={styles.field}><span>Language</span><input value={language} onChange={(e) => setLanguage(e.target.value)} /></label>
          <label className={`${styles.field} ${styles.wide}`}><span>Main objective</span><textarea value={objective} onChange={(e) => setObjective(e.target.value)} /></label>
          <div className={styles.platforms}><span>Platforms</span><div className={styles.platformButtons}>{platformOptions.map((platform) => <button type="button" key={platform} className={platforms.includes(platform) ? styles.selected : ''} onClick={() => togglePlatform(platform)}>{platform}</button>)}</div></div>
          <div className={styles.generateRow}><button disabled={generating || !brandId || platforms.length === 0}>{generating ? 'Building calendar…' : 'Generate & save calendar'}</button></div>
        </div>
      </form>}

      <section className={styles.panel}>
        <div className={styles.summary}>
          <div><strong>{plan?.name || `${selectedBrand?.name || 'Brand'} Content Calendar`}</strong><span>{items.length ? `${items.length} planned content items · choose one to create` : 'No calendar yet for this brand.'}</span></div>
          <div className={styles.toolbar}><Link className={styles.secondary} href="/growth-calendar">Strategy</Link><Link className={styles.secondary} href="/quick-create">Quick Create</Link></div>
        </div>
      </section>

      {items.length === 0 ? <div className={styles.empty}>No planned content yet. Generate a calendar when you are ready.</div> : <div className={styles.list}>
        {items.map((item) => {
          const date = formatDate(item.planned_date, item.day_number);
          return <article className={styles.item} key={item.id}>
            <div className={styles.date}><strong>{date.top}</strong><span>{date.bottom}</span></div>
            <div className={styles.body}>
              <div className={styles.meta}><span>{item.platform}</span><span>{item.format}</span><span>{item.pillar}</span><span>{item.status}</span></div>
              <h3>{item.hook}</h3><p>{item.concept}</p>
            </div>
            <div className={styles.actions}>
              <Link href={`/create?planId=${encodeURIComponent(plan!.id)}&day=${item.day_number}`}>Create content →</Link>
              <button onClick={() => navigator.clipboard.writeText(`${item.hook}\n\n${item.concept}\n\nCTA: ${item.cta}`)}>Copy brief</button>
            </div>
          </article>;
        })}
      </div>}
    </section>
  );
}
