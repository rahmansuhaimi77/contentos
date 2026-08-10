'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type Brand = { id: string; name: string };
type Profile = {
  id?: string;
  current_phase: string;
  marketplace_need: string;
  target_launch_start: string | null;
  target_launch_end: string | null;
  notes: string;
};
type CalendarItem = {
  id: string;
  start_date: string;
  end_date: string;
  phase: string;
  academic_phase: string;
  title: string;
  objective: string;
  audience_focus: string;
  marketplace_need: string;
  content_mix: unknown;
  ops_priorities: unknown;
  success_gates: unknown;
  status: string;
  sort_order: number;
};

const phaseLabels: Record<string, string> = {
  controlled_beta: 'Controlled Beta',
  beta_driver_onboarding: 'Beta + Driver Onboarding',
  pre_launch: 'Pre-Launch',
  stabilisation: 'Stabilisation',
  driver_activation_sprint: 'Driver Activation Sprint',
  public_launch: 'Public Launch',
  launch_week: 'Launch Week',
  early_growth: 'Early Growth',
  growth_optimisation: 'Growth Optimisation',
  retention: 'Retention',
};

const needLabels: Record<string, string> = {
  product_stability: 'Product stability',
  driver_supply: 'Driver supply',
  passenger_demand: 'Passenger demand',
  balanced: 'Balanced marketplace',
};

const phaseOptions = Object.keys(phaseLabels);
const needOptions = Object.keys(needLabels);

function malaysiaToday() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00+08:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export default function GrowthCalendarPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const today = malaysiaToday();

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
      if (!data.user) { setLoading(false); return; }
      const { data: brandRows, error: brandError } = await supabase.from('contentos_brands').select('id,name').order('updated_at', { ascending: false });
      if (brandError) setError(brandError.message);
      const next = (brandRows ?? []) as Brand[];
      setBrands(next);
      const kampusRide = next.find((brand) => /kampusride/i.test(brand.name));
      if (kampusRide) setBrandId(kampusRide.id);
      else if (next[0]) setBrandId(next[0].id);
      setLoading(false);
    }
    void init();
  }, [supabase]);

  useEffect(() => {
    if (brandId) void loadGrowth(brandId);
  }, [brandId]);

  async function loadGrowth(id: string) {
    setError('');
    const [profileResult, calendarResult] = await Promise.all([
      supabase.from('contentos_growth_profiles').select('id,current_phase,marketplace_need,target_launch_start,target_launch_end,notes').eq('brand_id', id).maybeSingle(),
      supabase.from('contentos_growth_calendar_items').select('*').eq('brand_id', id).order('sort_order', { ascending: true }),
    ]);
    if (profileResult.error) setError(profileResult.error.message);
    if (calendarResult.error) setError(calendarResult.error.message);
    setProfile((profileResult.data as Profile | null) ?? null);
    setItems((calendarResult.data ?? []) as CalendarItem[]);
  }

  async function saveProfile() {
    if (!user || !brandId || !profile) return;
    setSaving(true); setMessage(''); setError('');
    const payload = {
      brand_id: brandId,
      created_by: user.id,
      current_phase: profile.current_phase,
      marketplace_need: profile.marketplace_need,
      target_launch_start: profile.target_launch_start || null,
      target_launch_end: profile.target_launch_end || null,
      notes: profile.notes || '',
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = await supabase.from('contentos_growth_profiles').upsert(payload, { onConflict: 'brand_id' });
    if (saveError) setError(saveError.message);
    else {
      setMessage('Growth state saved. Future KampusRide plans will use this manual product phase plus the dated roadmap.');
      await loadGrowth(brandId);
    }
    setSaving(false);
  }

  const activeItem = items.find((item) => today >= item.start_date && today <= item.end_date) || null;
  const selectedBrand = brands.find((brand) => brand.id === brandId);
  const launchGate = items.find((item) => item.phase === 'stabilisation');

  if (loading) return <main className="growthShell"><div className="growthPanel">Loading Growth Calendar…</div></main>;
  if (!user) return <main className="growthShell"><div className="growthPanel"><h1>Sign in first</h1><p>Open ContentOS Studio, sign in, then return here.</p><a className="growthButton" href="/">Open Studio</a></div></main>;

  return (
    <main className="growthShell">
      <header className="growthHeader">
        <div>
          <span className="growthEyebrow">CONTENTOS · GROWTH CALENDAR</span>
          <h1>Phase first. Calendar second. Content follows strategy.</h1>
          <p>Product phase is manual truth. IIUM timing and marketplace needs then decide what ContentOS should prioritise.</p>
        </div>
        <nav className="growthNav"><a href="/">Studio</a><a href="/planner">30-Day Planner</a><a href="/publishing">Publishing</a><a href="/connections">Connections</a></nav>
      </header>

      {message && <div className="growthNotice">{message}</div>}
      {error && <div className="growthError">{error}</div>}

      <section className="growthControlGrid">
        <div className="growthPanel growthControl">
          <div className="growthPanelHead"><span>LIVE STATE</span><h2>{selectedBrand?.name || 'Brand'}</h2></div>
          <label><span>Brand</span><select value={brandId} onChange={(e) => setBrandId(e.target.value)}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
          {profile ? <>
            <label><span>Manual product phase</span><select value={profile.current_phase} onChange={(e) => setProfile({ ...profile, current_phase: e.target.value })}>{phaseOptions.map((phase) => <option key={phase} value={phase}>{phaseLabels[phase]}</option>)}</select></label>
            <label><span>Marketplace priority now</span><select value={profile.marketplace_need} onChange={(e) => setProfile({ ...profile, marketplace_need: e.target.value })}>{needOptions.map((need) => <option key={need} value={need}>{needLabels[need]}</option>)}</select></label>
            <div className="growthDatePair">
              <label><span>Target launch from</span><input type="date" value={profile.target_launch_start || ''} onChange={(e) => setProfile({ ...profile, target_launch_start: e.target.value })} /></label>
              <label><span>Target launch to</span><input type="date" value={profile.target_launch_end || ''} onChange={(e) => setProfile({ ...profile, target_launch_end: e.target.value })} /></label>
            </div>
            <label><span>Strategy note</span><textarea rows={3} value={profile.notes} onChange={(e) => setProfile({ ...profile, notes: e.target.value })} /></label>
            <button className="growthButton" onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save growth state'}</button>
          </> : <div className="growthEmpty">No Growth Profile for this brand yet.</div>}
        </div>

        <div className="growthPanel growthNow">
          <span className="growthEyebrow">TODAY · {formatDate(today)}</span>
          {activeItem ? <>
            <div className="growthPhasePill">{phaseLabels[activeItem.phase] || activeItem.phase}</div>
            <h2>{activeItem.title}</h2>
            <p>{activeItem.objective}</p>
            <div className="growthSignal"><small>ACADEMIC CONTEXT</small><strong>{activeItem.academic_phase}</strong></div>
            <div className="growthSignal"><small>ROADMAP MARKETPLACE NEED</small><strong>{needLabels[activeItem.marketplace_need] || activeItem.marketplace_need}</strong></div>
            {profile && profile.marketplace_need !== activeItem.marketplace_need && <div className="growthMismatch">Manual marketplace priority currently overrides the roadmap suggestion: <b>{needLabels[profile.marketplace_need]}</b>.</div>}
          </> : <><h2>No roadmap window today.</h2><p>Extend the roadmap before relying on automated timing decisions.</p></>}
        </div>
      </section>

      {launchGate && <section className="growthPanel growthGate">
        <div><span className="growthEyebrow">GO / NO-GO GATE</span><h2>Calendar never forces launch.</h2><p>Before advancing the manual Product Phase to Public Launch, these stabilisation gates should pass.</p></div>
        <ul>{list(launchGate.success_gates).map((gate) => <li key={gate}>✓ {gate}</li>)}</ul>
      </section>}

      <section className="growthRoadmap">
        <div className="growthRoadmapHead"><div><span className="growthEyebrow">10 AUG → 13 NOV 2026</span><h2>KampusRide rollout roadmap</h2></div><a className="growthSecondary" href="/planner">Generate phase-aware content →</a></div>
        {items.length === 0 && <div className="growthPanel growthEmpty">No roadmap has been configured for this brand.</div>}
        <div className="growthTimeline">
          {items.map((item) => {
            const active = today >= item.start_date && today <= item.end_date;
            return <article className={`growthPhaseCard ${active ? 'active' : ''}`} key={item.id}>
              <div className="growthPhaseDate"><b>{formatDate(item.start_date)}</b><span>→</span><b>{formatDate(item.end_date)}</b></div>
              <div className="growthPhaseMain">
                <div className="growthPhaseMeta"><span>{phaseLabels[item.phase] || item.phase}</span><span>{needLabels[item.marketplace_need] || item.marketplace_need}</span>{active && <span className="growthActiveTag">NOW</span>}</div>
                <h3>{item.title}</h3>
                <p>{item.objective}</p>
                <div className="growthAcademic"><b>Academic:</b> {item.academic_phase}</div>
                <div className="growthAudience"><b>Audience:</b> {item.audience_focus}</div>
                <div className="growthColumns">
                  <div><h4>Content direction</h4><ul>{list(item.content_mix).map((entry) => <li key={entry}>{entry}</li>)}</ul></div>
                  <div><h4>Product / Ops</h4><ul>{list(item.ops_priorities).map((entry) => <li key={entry}>{entry}</li>)}</ul></div>
                  <div><h4>Exit gates</h4><ul>{list(item.success_gates).map((entry) => <li key={entry}>{entry}</li>)}</ul></div>
                </div>
              </div>
            </article>;
          })}
        </div>
      </section>

      <footer className="growthFooter"><span>Growth Calendar = strategy layer</span><span>30-Day Planner = execution layer</span><span>Publishing = distribution layer</span></footer>
    </main>
  );
}
