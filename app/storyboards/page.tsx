'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type Row = { id: string; hook: string; status: string; created_at: string; campaign_id: string; production_pack: any };
type Project = Row & { brand: string; platform: string; format: string };

export default function StoryboardsIndexPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState('');

  useEffect(() => { void init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    setUser(auth.user ?? null);
    if (!auth.user) { setLoading(false); return; }

    const { data: variants, error: variantError } = await supabase
      .from('contentos_content_variants')
      .select('id,hook,status,created_at,campaign_id,production_pack')
      .not('production_pack', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);
    if (variantError) { setError(variantError.message); setLoading(false); return; }

    const campaignIds = Array.from(new Set((variants ?? []).map((row: any) => row.campaign_id)));
    const { data: campaigns } = campaignIds.length
      ? await supabase.from('contentos_campaigns').select('id,brand_id,platform,format').in('id', campaignIds)
      : { data: [] as any[] };
    const brandIds = Array.from(new Set((campaigns ?? []).map((row: any) => row.brand_id)));
    const { data: brands } = brandIds.length
      ? await supabase.from('contentos_brands').select('id,name').in('id', brandIds)
      : { data: [] as any[] };

    const campaignMap = new Map((campaigns ?? []).map((row: any) => [row.id, row]));
    const brandMap = new Map((brands ?? []).map((row: any) => [row.id, row.name]));
    const next = (variants ?? []).map((variant: any) => {
      const campaign: any = campaignMap.get(variant.campaign_id);
      return {
        ...variant,
        brand: campaign ? (brandMap.get(campaign.brand_id) || 'Brand') : 'Brand',
        platform: campaign?.platform || '',
        format: campaign?.format || '',
      };
    });
    setProjects(next as Project[]);
    setLoading(false);
  }

  if (loading) return <main className="toolShell"><div className="toolCard">Loading storyboard projects…</div></main>;
  if (!user) return <main className="toolShell"><div className="toolCard"><h1>Sign in first</h1><p>Open ContentOS Studio, sign in, then return here.</p><a className="toolPrimaryLink" href="/">Open Studio</a></div></main>;

  return (
    <main className="toolShell">
      <header className="toolHeader">
        <div><span className="eyebrow">CONTENTOS · STORYBOARD VISUALS</span><h1>Turn produced content into visual frames.</h1><p>Open any production pack, build the 5-scene board, then approve frames before video generation.</p></div>
        <nav className="toolNav"><a href="/planner">Planner</a><a href="/assets">Brand Assets</a><a className="active" href="/storyboards">Storyboards</a><a href="/">Studio</a></nav>
      </header>
      {error && <div className="error globalError">{error}</div>}
      <section className="panel">
        <div className="panelHead"><span>{projects.length}</span><div><h3>Produced creatives</h3><p>Only content with a saved production pack appears here.</p></div></div>
        <div className="storyboardProjectList">
          {projects.length === 0 && <div className="emptyState">Produce a day from the 30-Day Planner first.</div>}
          {projects.map((project) => <article className="storyboardProject" key={project.id}>
            <div><div className="planMeta"><span>{project.brand}</span><span>{project.platform}</span><span>{project.format}</span></div><h3>{project.production_pack?.hook || project.hook}</h3><p>{new Date(project.created_at).toLocaleString()}</p></div>
            <a className="toolPrimaryLink" href={`/storyboards/${project.id}`}>Open storyboard</a>
          </article>)}
        </div>
      </section>
    </main>
  );
}
