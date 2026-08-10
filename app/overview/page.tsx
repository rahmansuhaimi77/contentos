'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type Brand = { id: string; name: string };
type GrowthProfile = { current_phase: string; marketplace_need: string; target_launch_start: string | null; target_launch_end: string | null };
type GrowthItem = { title: string; academic_phase: string; objective: string; start_date: string; end_date: string };
type NextItem = { id: string; planned_date: string | null; hook: string; platform: string; status: string };
type Connection = { platform: string; username: string | null; status: string };

type Dashboard = {
  growth: GrowthProfile | null;
  phase: GrowthItem | null;
  nextItems: NextItem[];
  connection: Connection | null;
  counts: { planned: number; review: number; approved: number; scheduled: number; published: number };
};

const emptyDashboard: Dashboard = {
  growth: null,
  phase: null,
  nextItems: [],
  connection: null,
  counts: { planned: 0, review: 0, approved: 0, scheduled: 0, published: 0 },
};

function pretty(value?: string | null) {
  if (!value) return 'Not set';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function malaysiaDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export default function OverviewPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [dashboard, setDashboard] = useState<Dashboard>(emptyDashboard);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function initialise() {
      const { data: authData } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(authData.user ?? null);
      if (!authData.user) { setLoading(false); return; }

      const { data } = await supabase.from('contentos_brands').select('id,name').order('updated_at', { ascending: false });
      const nextBrands = (data ?? []) as Brand[];
      if (!mounted) return;
      setBrands(nextBrands);
      const saved = window.localStorage.getItem('contentos:selectedBrandId');
      const selected = nextBrands.some((brand) => brand.id === saved) ? saved! : nextBrands[0]?.id || '';
      setBrandId(selected);
      if (selected) await loadDashboard(selected);
      setLoading(false);
    }

    async function onBrandChange(event: Event) {
      const custom = event as CustomEvent<{ brandId: string }>;
      setBrandId(custom.detail.brandId);
      await loadDashboard(custom.detail.brandId);
    }

    initialise();
    window.addEventListener('contentos:brand-change', onBrandChange);
    return () => { mounted = false; window.removeEventListener('contentos:brand-change', onBrandChange); };
  }, [supabase]);

  async function loadDashboard(targetBrandId: string) {
    const today = malaysiaDate();
    const [growthRes, phaseRes, plansRes, campaignsRes, publicationsRes, connectionsRes] = await Promise.all([
      supabase.from('contentos_growth_profiles').select('current_phase,marketplace_need,target_launch_start,target_launch_end').eq('brand_id', targetBrandId).maybeSingle(),
      supabase.from('contentos_growth_calendar_items').select('title,academic_phase,objective,start_date,end_date').eq('brand_id', targetBrandId).lte('start_date', today).gte('end_date', today).order('sort_order').limit(1).maybeSingle(),
      supabase.from('contentos_content_plans').select('id').eq('brand_id', targetBrandId).order('created_at', { ascending: false }).limit(1),
      supabase.from('contentos_campaigns').select('id').eq('brand_id', targetBrandId).order('created_at', { ascending: false }).limit(100),
      supabase.from('contentos_publications').select('status').eq('brand_id', targetBrandId).limit(500),
      supabase.from('contentos_social_connections').select('platform,username,status').eq('brand_id', targetBrandId).eq('status', 'connected').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const latestPlanId = plansRes.data?.[0]?.id;
    let nextItems: NextItem[] = [];
    let planned = 0;
    if (latestPlanId) {
      const { data: items } = await supabase
        .from('contentos_plan_items')
        .select('id,planned_date,hook,platform,status')
        .eq('plan_id', latestPlanId)
        .order('planned_date', { ascending: true });
      const allItems = (items ?? []) as NextItem[];
      planned = allItems.filter((item) => !['published', 'skipped'].includes(item.status)).length;
      nextItems = allItems.filter((item) => !item.planned_date || item.planned_date >= today).slice(0, 3);
    }

    const campaignIds = (campaignsRes.data ?? []).map((row) => row.id);
    let review = 0;
    let approved = 0;
    if (campaignIds.length) {
      const { data: variants } = await supabase.from('contentos_content_variants').select('status').in('campaign_id', campaignIds);
      review = (variants ?? []).filter((item) => item.status === 'in_review').length;
      approved = (variants ?? []).filter((item) => item.status === 'approved').length;
    }

    const publicationStatuses = publicationsRes.data ?? [];
    const scheduled = publicationStatuses.filter((item) => item.status === 'scheduled').length;
    const published = publicationStatuses.filter((item) => item.status === 'published').length;

    setDashboard({
      growth: (growthRes.data as GrowthProfile | null) ?? null,
      phase: (phaseRes.data as GrowthItem | null) ?? null,
      nextItems,
      connection: (connectionsRes.data as Connection | null) ?? null,
      counts: { planned, review, approved, scheduled, published },
    });
  }

  const selectedBrand = brands.find((brand) => brand.id === brandId);
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', hour12: false }).format(new Date()));
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (loading) return <section className="overviewPage"><div className="dashboardSkeleton">Loading overview…</div></section>;
  if (!user) return <section className="overviewPage"><div className="dashboardEmpty"><div className="logo">CO</div><h1>Welcome to ContentOS</h1><p>Sign in through Campaign Studio to open your workspace.</p><Link className="appPrimary" href="/create">Sign in</Link></div></section>;

  return (
    <section className="overviewPage">
      <header className="pageHero">
        <div><span className="eyebrow">OVERVIEW</span><h1>{greeting}. <span>{selectedBrand?.name || 'Your workspace'}</span></h1><p>Strategy, content and publishing — one workflow.</p></div>
        <Link href="/create" className="appPrimary">✦ Create content</Link>
      </header>

      <div className="statusGrid">
        <article className="statusCard featured"><span>PRODUCT PHASE</span><strong>{pretty(dashboard.growth?.current_phase)}</strong><p>{dashboard.phase?.objective || 'Set the current product phase in Strategy so ContentOS can prioritise the right work.'}</p><Link href="/growth-calendar">Open Strategy →</Link></article>
        <article className="statusCard"><span>MARKETPLACE PRIORITY</span><strong>{pretty(dashboard.growth?.marketplace_need)}</strong><p>Use this signal to decide whether content should prioritise product stability, drivers or passenger demand.</p></article>
        <article className="statusCard"><span>CURRENT CONTEXT</span><strong>{dashboard.phase?.academic_phase || 'No active calendar phase'}</strong><p>{dashboard.phase?.title || 'ContentOS will use verified calendar context when available.'}</p></article>
        <article className="statusCard"><span>CHANNEL</span><strong>{dashboard.connection ? `${pretty(dashboard.connection.platform)} · @${dashboard.connection.username || 'connected'}` : 'No channel connected'}</strong><p>{dashboard.connection ? 'Ready for approved publishing.' : 'Connect a publishing channel when you are ready.'}</p><Link href="/connections">Manage channels →</Link></article>
      </div>

      <div className="dashboardGrid">
        <section className="dashboardPanel actionPanel">
          <div className="dashboardPanelHead"><div><span className="eyebrow">NEXT</span><h2>What needs attention</h2></div></div>
          <Link href="/growth-calendar" className="nextAction"><span>01</span><div><b>Confirm current strategy</b><small>Keep product phase and marketplace priority accurate.</small></div><em>→</em></Link>
          <Link href="/planner" className="nextAction"><span>02</span><div><b>Review the content plan</b><small>Make sure upcoming content matches the current phase and campus context.</small></div><em>→</em></Link>
          <Link href={dashboard.counts.review ? '/review' : '/create'} className="nextAction"><span>03</span><div><b>{dashboard.counts.review ? `Review ${dashboard.counts.review} content item${dashboard.counts.review === 1 ? '' : 's'}` : 'Create the next content'}</b><small>{dashboard.counts.review ? 'Human approval remains the publishing gate.' : 'Create from the plan or start a campaign.'}</small></div><em>→</em></Link>
        </section>

        <section className="dashboardPanel pipelinePanel">
          <div className="dashboardPanelHead"><div><span className="eyebrow">PIPELINE</span><h2>Content status</h2></div><Link href="/review">View review</Link></div>
          <div className="pipelineRow"><div><b>{dashboard.counts.planned}</b><span>Planned</span></div><i>→</i><div><b>{dashboard.counts.review}</b><span>Review</span></div><i>→</i><div><b>{dashboard.counts.approved}</b><span>Approved</span></div><i>→</i><div><b>{dashboard.counts.scheduled}</b><span>Scheduled</span></div><i>→</i><div><b>{dashboard.counts.published}</b><span>Published</span></div></div>
        </section>

        <section className="dashboardPanel upcomingPanel">
          <div className="dashboardPanelHead"><div><span className="eyebrow">PLAN</span><h2>Upcoming content</h2></div><Link href="/planner">Open Plan</Link></div>
          {dashboard.nextItems.length === 0 ? <p className="dashboardMuted">No upcoming plan items yet.</p> : dashboard.nextItems.map((item) => (
            <article className="upcomingItem" key={item.id}><time>{item.planned_date ? new Date(`${item.planned_date}T00:00:00`).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' }) : 'Next'}</time><div><b>{item.hook}</b><span>{item.platform} · {pretty(item.status)}</span></div></article>
          ))}
        </section>
      </div>
    </section>
  );
}
