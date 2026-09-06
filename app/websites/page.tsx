'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import styles from './websites.module.css';

type Brand = {
  id: string;
  name: string;
  product: string;
  audience: string;
  positioning: string;
  voice: string;
  offer: string;
  proof: string;
  preferred_cta: string;
  avoid: string;
};

type Website = {
  id: string;
  business_name: string;
  slug: string;
  status: string;
  template_version: string;
  live_url: string | null;
  created_at: string;
};

type Brief = {
  id: string;
  brand_id: string | null;
  status: 'draft' | 'verified' | 'approved';
  primary_goal: string;
  audience: string;
  offer: string;
  proof: string;
  voice: string;
  avoid: string;
};

type Recipe = {
  id: string;
  recipe_key: string;
  name: string;
  best_for: string[];
  avoid_for: string[];
  personality: string;
  layout_rules: Record<string, unknown>;
  typography_rules: Record<string, unknown>;
  visual_rules: Record<string, unknown>;
  motion_rules: Record<string, unknown>;
  conversion_rules: Record<string, unknown>;
};

type Direction = {
  id: string;
  style_name: string;
  status: string;
  recipe_id: string | null;
};

type SiteDetail = {
  brief: Brief | null;
  references: { total: number; approved: number };
  directions: Direction[];
  sections: { total: number; ready: number };
  assets: { total: number; ready: number };
  latestVersion: { id: string; version_no: number; status: string; preview_url: string | null } | null;
  qa: { total: number; passed: number; blockers: number };
  latestDeployment: { environment: string; status: string; url: string } | null;
};

const emptyDetail: SiteDetail = {
  brief: null,
  references: { total: 0, approved: 0 },
  directions: [],
  sections: { total: 0, ready: 0 },
  assets: { total: 0, ready: 0 },
  latestVersion: null,
  qa: { total: 0, passed: 0, blockers: 0 },
  latestDeployment: null,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function pretty(value?: string | null) {
  if (!value) return 'Not set';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function WebsiteStudioPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [websites, setWebsites] = useState<Website[]>([]);
  const [briefs, setBriefs] = useState<Record<string, Brief>>({});
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [activeWebsiteId, setActiveWebsiteId] = useState('');
  const [detail, setDetail] = useState<SiteDetail>(emptyDetail);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function initialise() {
      const { data: authData } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(authData.user ?? null);
      if (!authData.user) {
        setLoading(false);
        return;
      }

      const { data: brandRows, error: brandError } = await supabase
        .from('contentos_brands')
        .select('id,name,product,audience,positioning,voice,offer,proof,preferred_cta,avoid')
        .order('updated_at', { ascending: false });

      if (brandError) {
        setError(brandError.message);
        setLoading(false);
        return;
      }

      const nextBrands = (brandRows ?? []) as Brand[];
      setBrands(nextBrands);
      const saved = window.localStorage.getItem('contentos:selectedBrandId');
      const selected = nextBrands.some((brand) => brand.id === saved) ? saved! : nextBrands[0]?.id || '';
      setBrandId(selected);
      await loadWorkspace(selected);
      if (mounted) setLoading(false);
    }

    async function onBrandChange(event: Event) {
      const custom = event as CustomEvent<{ brandId: string }>;
      setBrandId(custom.detail.brandId);
      setNotice('');
      setError('');
      await loadWorkspace(custom.detail.brandId);
    }

    void initialise();
    window.addEventListener('contentos:brand-change', onBrandChange);
    return () => {
      mounted = false;
      window.removeEventListener('contentos:brand-change', onBrandChange);
    };
  }, [supabase]);

  useEffect(() => {
    if (!activeWebsiteId) {
      setDetail(emptyDetail);
      return;
    }
    void loadSiteDetail(activeWebsiteId);
  }, [activeWebsiteId]);

  useEffect(() => {
    const activeBrand = brands.find((brand) => brand.id === brandId);
    if (!activeBrand) {
      setBusinessName('');
      setSlug('');
      return;
    }
    setBusinessName(activeBrand.name);
    setSlug(slugify(activeBrand.name));
  }, [brandId, brands]);

  async function loadWorkspace(targetBrandId: string) {
    const [websiteRes, briefRes, recipeRes] = await Promise.all([
      supabase.from('growth_websites').select('id,business_name,slug,status,template_version,live_url,created_at').order('created_at', { ascending: false }),
      supabase.from('growth_website_briefs').select('id,website_id,brand_id,status,primary_goal,audience,offer,proof,voice,avoid'),
      supabase.from('growth_design_recipes').select('id,recipe_key,name,best_for,avoid_for,personality,layout_rules,typography_rules,visual_rules,motion_rules,conversion_rules').eq('is_active', true).order('name'),
    ]);

    const firstError = websiteRes.error || briefRes.error || recipeRes.error;
    if (firstError) {
      setError(firstError.message);
      return;
    }

    const allWebsites = (websiteRes.data ?? []) as Website[];
    const nextBriefs: Record<string, Brief> = {};
    for (const row of briefRes.data ?? []) {
      nextBriefs[row.website_id] = {
        id: row.id,
        brand_id: row.brand_id,
        status: row.status,
        primary_goal: row.primary_goal,
        audience: row.audience,
        offer: row.offer,
        proof: row.proof,
        voice: row.voice,
        avoid: row.avoid,
      } as Brief;
    }

    const nextWebsites = allWebsites.filter((site) => nextBriefs[site.id]?.brand_id === targetBrandId);
    setWebsites(nextWebsites);
    setBriefs(nextBriefs);
    setRecipes((recipeRes.data ?? []) as Recipe[]);

    const preferred = nextWebsites[0]?.id || '';
    setActiveWebsiteId((current) => nextWebsites.some((site) => site.id === current) ? current : preferred);
  }

  async function loadSiteDetail(websiteId: string) {
    setDetailLoading(true);
    const [briefRes, referenceRes, directionRes, sectionRes, assetRes, versionRes, qaRes, deploymentRes] = await Promise.all([
      supabase.from('growth_website_briefs').select('id,brand_id,status,primary_goal,audience,offer,proof,voice,avoid').eq('website_id', websiteId).maybeSingle(),
      supabase.from('growth_website_references').select('id,approved').eq('website_id', websiteId),
      supabase.from('growth_website_directions').select('id,style_name,status,recipe_id').eq('website_id', websiteId).order('created_at', { ascending: false }),
      supabase.from('growth_website_sections').select('id,status').eq('website_id', websiteId),
      supabase.from('growth_website_assets').select('id,status').eq('website_id', websiteId),
      supabase.from('growth_website_versions').select('id,version_no,status,preview_url').eq('website_id', websiteId).order('version_no', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('growth_website_qa_checks').select('id,status,severity').eq('website_id', websiteId),
      supabase.from('growth_website_deployments').select('environment,status,url').eq('website_id', websiteId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const results = [briefRes, referenceRes, directionRes, sectionRes, assetRes, versionRes, qaRes, deploymentRes];
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) {
      setError(firstError.message);
      setDetailLoading(false);
      return;
    }

    const referenceRows = referenceRes.data ?? [];
    const sectionRows = sectionRes.data ?? [];
    const assetRows = assetRes.data ?? [];
    const qaRows = qaRes.data ?? [];

    setDetail({
      brief: (briefRes.data as Brief | null) ?? null,
      references: { total: referenceRows.length, approved: referenceRows.filter((row) => row.approved).length },
      directions: (directionRes.data ?? []) as Direction[],
      sections: { total: sectionRows.length, ready: sectionRows.filter((row) => ['approved', 'built'].includes(row.status)).length },
      assets: { total: assetRows.length, ready: assetRows.filter((row) => ['selected', 'approved'].includes(row.status)).length },
      latestVersion: versionRes.data ?? null,
      qa: {
        total: qaRows.length,
        passed: qaRows.filter((row) => row.status === 'pass').length,
        blockers: qaRows.filter((row) => row.status === 'fail' && ['high', 'blocker'].includes(row.severity)).length,
      },
      latestDeployment: deploymentRes.data ?? null,
    });
    setDetailLoading(false);
  }

  async function createWebsite() {
    const brand = brands.find((item) => item.id === brandId);
    if (!brand) {
      setError('Select a Brand Brain first.');
      return;
    }

    const cleanName = businessName.trim();
    const cleanSlug = slugify(slug || businessName);
    if (!cleanName || !cleanSlug) {
      setError('Business name and a valid slug are required.');
      return;
    }

    setCreating(true);
    setError('');
    setNotice('');

    const { data: created, error: websiteError } = await supabase
      .from('growth_websites')
      .insert({
        business_name: cleanName,
        slug: cleanSlug,
        status: 'draft',
        template_version: 'production_v2',
        brand_id: brand.id,
        config: { businessName: cleanName, slug: cleanSlug, brandId: brand.id },
      })
      .select('id,business_name,slug,status,template_version,live_url,created_at')
      .single();

    if (websiteError || !created) {
      setError(websiteError?.message || 'Could not create the website record.');
      setCreating(false);
      return;
    }

    const { error: briefError } = await supabase.from('growth_website_briefs').insert({
      website_id: created.id,
      brand_id: brand.id,
      business_summary: brand.positioning || brand.product || brand.name,
      primary_goal: 'Turn qualified visits into a clear next action.',
      audience: brand.audience || '',
      offer: brand.offer || '',
      proof: brand.proof || '',
      voice: brand.voice || '',
      avoid: brand.avoid || '',
      verified_facts: {
        business_name: cleanName,
        product: brand.product || '',
        preferred_cta: brand.preferred_cta || '',
      },
      constraints: {
        rule: 'Do not invent claims. Verify operational facts before production.',
      },
      status: 'draft',
    });

    if (briefError) {
      await supabase.from('growth_websites').delete().eq('id', created.id);
      setError(`Website shell created but brief creation failed, so the shell was rolled back: ${briefError.message}`);
      setCreating(false);
      return;
    }

    setBusinessName('');
    setSlug('');
    setNotice('Website project created from the active Brand Brain. Verify the brief before approving a creative direction.');
    await loadWorkspace(brand.id);
    setActiveWebsiteId(created.id);
    setCreating(false);
  }

  async function setBriefStatus(status: 'verified' | 'approved') {
    if (!detail.brief) return;
    setWorking(true);
    setError('');
    const { error: updateError } = await supabase
      .from('growth_website_briefs')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', detail.brief.id);
    if (updateError) setError(updateError.message);
    else {
      setNotice(status === 'verified' ? 'Brief marked verified. You can now propose a creative direction.' : 'Brief approved.');
      await loadSiteDetail(activeWebsiteId);
      await loadWorkspace(brandId);
    }
    setWorking(false);
  }

  async function proposeDirection(recipe: Recipe) {
    if (!activeWebsiteId || detail.brief?.status === 'draft' || !detail.brief) {
      setError('Verify the business brief before proposing a design direction.');
      return;
    }

    const activeSite = websites.find((site) => site.id === activeWebsiteId);
    if (!activeSite) return;

    setWorking(true);
    setError('');
    setNotice('');

    await supabase
      .from('growth_website_directions')
      .update({ status: 'superseded', updated_at: new Date().toISOString() })
      .eq('website_id', activeWebsiteId)
      .eq('status', 'proposed');

    const { error: directionError } = await supabase.from('growth_website_directions').insert({
      website_id: activeWebsiteId,
      recipe_id: recipe.id,
      style_name: recipe.name,
      creative_concept: `${recipe.name} direction for ${activeSite.business_name}`,
      rationale: 'Use this recipe as a design system starting point. References and business context must refine the final composition; do not copy a reference site or reuse a fixed page template.',
      mood: recipe.personality,
      typography: recipe.typography_rules,
      visual_language: recipe.visual_rules,
      motion_language: recipe.motion_rules,
      composition_rules: recipe.layout_rules,
      anti_patterns: [
        'Generic AI template composition',
        'Repeated card grids as the default section pattern',
        'Unverified claims or invented proof',
        'Decorative imagery without a conversion or storytelling role',
        'Direct generation-to-production publishing',
      ],
      status: 'proposed',
    });

    if (directionError) setError(directionError.message);
    else {
      setNotice(`${recipe.name} proposed. Add references and review the direction before approval.`);
      await loadSiteDetail(activeWebsiteId);
    }
    setWorking(false);
  }

  async function approveDirection(directionId: string) {
    if (!activeWebsiteId) return;
    setWorking(true);
    setError('');

    const { error: supersedeError } = await supabase
      .from('growth_website_directions')
      .update({ status: 'superseded', updated_at: new Date().toISOString() })
      .eq('website_id', activeWebsiteId)
      .neq('id', directionId)
      .in('status', ['proposed', 'approved']);

    if (supersedeError) {
      setError(supersedeError.message);
      setWorking(false);
      return;
    }

    const { error: approveError } = await supabase
      .from('growth_website_directions')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', directionId);

    if (approveError) setError(approveError.message);
    else {
      setNotice('Creative direction approved. The next step is reference-backed section planning and visual production.');
      await loadSiteDetail(activeWebsiteId);
    }
    setWorking(false);
  }

  const activeSite = websites.find((site) => site.id === activeWebsiteId) ?? null;
  const selectedBrand = brands.find((brand) => brand.id === brandId) ?? null;
  const linkedSites = websites.filter((site) => briefs[site.id]?.brand_id === brandId).length;
  const approvedDirection = detail.directions.find((direction) => direction.status === 'approved');
  const proposedDirection = detail.directions.find((direction) => direction.status === 'proposed');

  if (loading) return <section className={styles.page}><div className={styles.loading}>Loading Website Studio…</div></section>;
  if (!user) return <section className={styles.page}><div className={styles.loading}>Sign in to open Website Studio.</div></section>;

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>WEBSITE STUDIO · PRODUCTION V2</span>
          <h1>Reference-led websites, <em>not</em> template generation.</h1>
          <p>Brand Brain → verified brief → references → creative direction → section composition → assets → preview → rendered QA → approval → production.</p>
        </div>
        <div className={styles.heroBadge}><b>Human gates</b><span>Direction + release</span></div>
      </header>

      {notice && <div className={styles.notice}>{notice}</div>}
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.metrics}>
        <article><span>ACTIVE BRAND</span><b>{selectedBrand?.name || 'No Brand Brain'}</b><small>{linkedSites} linked website project{linkedSites === 1 ? '' : 's'}</small></article>
        <article><span>DESIGN SYSTEMS</span><b>{recipes.length}</b><small>Reusable art directions, not fixed templates</small></article>
        <article><span>ACTIVE BRAND PROJECTS</span><b>{websites.length}</b><small>Only projects linked to this Brand Brain</small></article>
        <article className={detail.qa.blockers ? styles.metricRisk : styles.metricGood}><span>ACTIVE BLOCKERS</span><b>{activeSite ? detail.qa.blockers : '—'}</b><small>{detail.qa.blockers ? 'Release must remain blocked' : 'No high/blocker QA failures recorded'}</small></article>
      </div>

      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <div className={styles.panelHead}>
            <div><span className={styles.eyebrow}>PROJECTS</span><h2>Website pipeline</h2></div>
          </div>

          <div className={styles.siteList}>
            {websites.length === 0 && <p className={styles.empty}>No website projects yet.</p>}
            {websites.map((site) => {
              const brief = briefs[site.id];
              const linked = brief?.brand_id === brandId;
              return (
                <button key={site.id} className={`${styles.siteButton} ${activeWebsiteId === site.id ? styles.siteActive : ''}`} onClick={() => setActiveWebsiteId(site.id)}>
                  <span><b>{site.business_name}</b><small>{site.slug}</small></span>
                  <em>{site.template_version === 'production_v2' ? 'V2' : linked ? 'Linked' : 'Legacy'}</em>
                </button>
              );
            })}
          </div>

          <div className={styles.newSite}>
            <span className={styles.eyebrow}>NEW PROJECT</span>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#355246' }}>Creating website for: {selectedBrand?.name || 'Select a Brand Brain'}</div>
            <label>Business name<input value={businessName} readOnly aria-readonly="true" placeholder="Select a Brand Brain first" /></label>
            <label>Slug<input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} placeholder="abc-aircond" /></label>
            <button disabled={creating || !selectedBrand} onClick={() => void createWebsite()}>{creating ? 'Creating…' : `Create under ${selectedBrand?.name || 'Brand Brain'}`}</button>
            <small>Projects are brand-isolated. To build for another business, create or select that business's Brand Brain first. Nothing is published.</small>
          </div>
        </aside>

        <main className={styles.main}>
          {!activeSite ? (
            <div className={styles.blank}><span>01</span><h2>Create a website project</h2><p>The system will pull the active Brand Brain into a production brief, then keep creative work versioned and reviewable.</p></div>
          ) : (
            <>
              <div className={styles.projectHeader}>
                <div><span className={styles.eyebrow}>ACTIVE WEBSITE</span><h2>{activeSite.business_name}</h2><p>{activeSite.slug} · {pretty(activeSite.status)} · {activeSite.template_version}</p></div>
                <div className={styles.links}>
                  {detail.latestVersion?.preview_url && <a href={detail.latestVersion.preview_url} target="_blank" rel="noreferrer">Preview ↗</a>}
                  {activeSite.live_url && <a href={activeSite.live_url} target="_blank" rel="noreferrer">Live ↗</a>}
                </div>
              </div>

              {detailLoading ? <div className={styles.loading}>Loading production state…</div> : (
                <>
                  <section className={styles.pipeline}>
                    <PipelineStep index="01" title="Verified brief" value={detail.brief ? pretty(detail.brief.status) : 'Missing'} state={detail.brief?.status === 'approved' ? 'done' : detail.brief?.status === 'verified' ? 'active' : 'pending'} />
                    <PipelineStep index="02" title="References" value={`${detail.references.approved}/${detail.references.total} approved`} state={detail.references.approved >= 3 ? 'done' : detail.references.total ? 'active' : 'pending'} />
                    <PipelineStep index="03" title="Direction" value={approvedDirection?.style_name || proposedDirection?.style_name || 'Not selected'} state={approvedDirection ? 'done' : proposedDirection ? 'active' : 'pending'} />
                    <PipelineStep index="04" title="Sections" value={`${detail.sections.ready}/${detail.sections.total} ready`} state={detail.sections.total && detail.sections.ready === detail.sections.total ? 'done' : detail.sections.total ? 'active' : 'pending'} />
                    <PipelineStep index="05" title="Assets" value={`${detail.assets.ready}/${detail.assets.total} selected`} state={detail.assets.total && detail.assets.ready === detail.assets.total ? 'done' : detail.assets.total ? 'active' : 'pending'} />
                    <PipelineStep index="06" title="QA + release" value={detail.qa.total ? `${detail.qa.passed}/${detail.qa.total} pass` : 'Not started'} state={detail.qa.blockers ? 'blocked' : detail.qa.total && detail.qa.passed === detail.qa.total ? 'done' : detail.qa.total ? 'active' : 'pending'} />
                  </section>

                  <div className={styles.twoCol}>
                    <section className={styles.card}>
                      <div className={styles.cardHead}><div><span className={styles.eyebrow}>BRIEF GATE</span><h3>Business truth before design</h3></div><StatusPill value={detail.brief?.status || 'missing'} /></div>
                      {!detail.brief ? <p className={styles.muted}>This is a legacy website record without a v2 production brief.</p> : (
                        <>
                          <dl className={styles.briefGrid}>
                            <div><dt>Goal</dt><dd>{detail.brief.primary_goal || 'Not set'}</dd></div>
                            <div><dt>Audience</dt><dd>{detail.brief.audience || 'Not set'}</dd></div>
                            <div><dt>Offer</dt><dd>{detail.brief.offer || 'Not set'}</dd></div>
                            <div><dt>Proof</dt><dd>{detail.brief.proof || 'Not set'}</dd></div>
                            <div><dt>Voice</dt><dd>{detail.brief.voice || 'Not set'}</dd></div>
                            <div><dt>Avoid</dt><dd>{detail.brief.avoid || 'Not set'}</dd></div>
                          </dl>
                          <div className={styles.actions}>
                            {detail.brief.status === 'draft' && <button disabled={working} onClick={() => void setBriefStatus('verified')}>Mark facts verified</button>}
                            {detail.brief.status === 'verified' && <button disabled={working} onClick={() => void setBriefStatus('approved')}>Approve brief</button>}
                          </div>
                        </>
                      )}
                    </section>

                    <section className={styles.card}>
                      <div className={styles.cardHead}><div><span className={styles.eyebrow}>AUTOMATION BOUNDARY</span><h3>What the system should automate</h3></div></div>
                      <div className={styles.boundaries}>
                        <div><b>Automatic</b><span>Brand Brain pull, production state, recipes, versions, QA records, deployment history.</span></div>
                        <div><b>Agent-assisted</b><span>Reference research, copy, composition, visual prompts, coding and rendered inspection.</span></div>
                        <div><b>Human gate</b><span>Creative direction approval and production release while quality is being validated.</span></div>
                      </div>
                    </section>
                  </div>

                  <section className={styles.recipeSection}>
                    <div className={styles.sectionHead}>
                      <div><span className={styles.eyebrow}>ART DIRECTION LIBRARY</span><h3>Choose a visual system, then refine it with references.</h3></div>
                      <p>These are ingredients and rules—not page templates. A recipe should shape the design language without fixing the section order.</p>
                    </div>
                    <div className={styles.recipeGrid}>
                      {recipes.map((recipe) => {
                        const current = detail.directions.find((direction) => direction.recipe_id === recipe.id && ['proposed', 'approved'].includes(direction.status));
                        return (
                          <article className={`${styles.recipe} ${current?.status === 'approved' ? styles.recipeApproved : ''}`} key={recipe.id}>
                            <div><span>{recipe.recipe_key.replaceAll('_', ' ')}</span>{current && <StatusPill value={current.status} />}</div>
                            <h4>{recipe.name}</h4>
                            <p>{recipe.personality}</p>
                            <small>Best for: {recipe.best_for.slice(0, 4).join(' · ') || 'context-dependent'}</small>
                            <div className={styles.recipeActions}>
                              {!current && <button disabled={working || !detail.brief || detail.brief.status === 'draft'} onClick={() => void proposeDirection(recipe)}>Propose direction</button>}
                              {current?.status === 'proposed' && <button disabled={working} onClick={() => void approveDirection(current.id)}>Approve direction</button>}
                              {current?.status === 'approved' && <b>Approved system</b>}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>

                  <section className={styles.releaseCard}>
                    <div>
                      <span className={styles.eyebrow}>RELEASE RULE</span>
                      <h3>Generation never goes straight to production.</h3>
                      <p>The approved path is build → versioned preview → rendered mobile/desktop QA → resolve blockers → human approval → promote the exact preview. Keep the previous production version for rollback.</p>
                    </div>
                    <div className={styles.releaseStats}>
                      <div><span>Latest version</span><b>{detail.latestVersion ? `v${detail.latestVersion.version_no}` : '—'}</b><small>{detail.latestVersion ? pretty(detail.latestVersion.status) : 'No preview yet'}</small></div>
                      <div><span>QA blockers</span><b>{detail.qa.blockers}</b><small>{detail.qa.blockers ? 'Release blocked' : 'Clear'}</small></div>
                      <div><span>Deployment</span><b>{detail.latestDeployment ? pretty(detail.latestDeployment.environment) : '—'}</b><small>{detail.latestDeployment ? pretty(detail.latestDeployment.status) : 'Not deployed'}</small></div>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </section>
  );
}

function PipelineStep({ index, title, value, state }: { index: string; title: string; value: string; state: 'pending' | 'active' | 'done' | 'blocked' }) {
  return <article className={`${styles.pipelineStep} ${styles[`step_${state}`]}`}><span>{index}</span><div><b>{title}</b><small>{value}</small></div></article>;
}

function StatusPill({ value }: { value: string }) {
  return <span className={`${styles.pill} ${styles[`pill_${value}`] || ''}`}>{pretty(value)}</span>;
}
