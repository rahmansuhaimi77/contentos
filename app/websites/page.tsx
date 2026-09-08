'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

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
  brand_id: string | null;
  created_at: string;
};

type Brief = {
  id: string;
  website_id: string;
  brand_id: string | null;
  status: 'draft' | 'verified' | 'approved';
  primary_goal: string;
  audience: string;
  offer: string;
  proof: string;
  voice: string;
  avoid: string;
};

type Selection = {
  id: string;
  template_id: string;
  status: 'candidate' | 'approved' | 'rejected' | 'imported';
  fit_score: number | null;
  source_snapshot: Record<string, unknown> | null;
};

type Template = {
  id: string;
  name: string;
  template_key: string;
  license_name: string;
  license_verified: boolean;
  preview_url: string | null;
  live_demo_url: string | null;
};

type Version = {
  id: string;
  version_no: number;
  label: string;
  status: string;
  preview_url: string | null;
  qa_status: string | null;
  qa_score: number | null;
  source_snapshot: Record<string, unknown> | null;
};

type Detail = {
  brief: Brief | null;
  selection: Selection | null;
  template: Template | null;
  latestVersion: Version | null;
  qaBlockers: number;
  qaTotal: number;
  releaseStatus: string | null;
};

const emptyDetail: Detail = { brief: null, selection: null, template: null, latestVersion: null, qaBlockers: 0, qaTotal: 0, releaseStatus: null };

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

function pretty(value?: string | null) {
  if (!value) return 'Not started';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Step({ index, title, value, state }: { index: string; title: string; value: string; state: 'pending' | 'active' | 'done' | 'blocked' }) {
  return <div className={`step ${state}`}><b>{index}</b><span><strong>{title}</strong><small>{value}</small></span></div>;
}

export default function WebsiteStudioPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [websites, setWebsites] = useState<Website[]>([]);
  const [websiteId, setWebsiteId] = useState('');
  const [detail, setDetail] = useState<Detail>(emptyDetail);
  const [creating, setCreating] = useState(false);
  const [working, setWorking] = useState(false);
  const [slug, setSlug] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data: authData } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(authData.user || null);
      if (!authData.user) { setLoading(false); return; }
      const { data, error: brandError } = await supabase.from('contentos_brands').select('id,name,product,audience,positioning,voice,offer,proof,preferred_cta,avoid').order('updated_at', { ascending: false });
      if (brandError) { setError(brandError.message); setLoading(false); return; }
      const nextBrands = (data || []) as Brand[];
      setBrands(nextBrands);
      const saved = window.localStorage.getItem('contentos:selectedBrandId');
      const selected = nextBrands.some((brand) => brand.id === saved) ? saved! : nextBrands[0]?.id || '';
      setBrandId(selected);
      await loadProjects(selected);
      if (mounted) setLoading(false);
    }
    const onBrandChange = (event: Event) => {
      const custom = event as CustomEvent<{ brandId: string }>;
      setBrandId(custom.detail.brandId); setNotice(''); setError(''); void loadProjects(custom.detail.brandId);
    };
    void init();
    window.addEventListener('contentos:brand-change', onBrandChange);
    return () => { mounted = false; window.removeEventListener('contentos:brand-change', onBrandChange); };
  }, [supabase]);

  useEffect(() => {
    const brand = brands.find((item) => item.id === brandId);
    setSlug(brand ? slugify(brand.name) : '');
  }, [brandId, brands]);

  useEffect(() => { if (websiteId) void loadDetail(websiteId); else setDetail(emptyDetail); }, [websiteId]);

  async function loadProjects(targetBrandId: string) {
    if (!targetBrandId) { setWebsites([]); setWebsiteId(''); return; }
    const { data, error: siteError } = await supabase.from('growth_websites').select('id,business_name,slug,status,template_version,live_url,brand_id,created_at').eq('brand_id', targetBrandId).order('created_at', { ascending: false });
    if (siteError) { setError(siteError.message); return; }
    const next = (data || []) as Website[];
    setWebsites(next);
    setWebsiteId((current) => next.some((site) => site.id === current) ? current : next[0]?.id || '');
  }

  async function loadDetail(targetWebsiteId: string) {
    setDetailLoading(true);
    const [briefRes, selectionRes, versionRes, qaRes, releaseRes] = await Promise.all([
      supabase.from('growth_website_briefs').select('id,website_id,brand_id,status,primary_goal,audience,offer,proof,voice,avoid').eq('website_id', targetWebsiteId).maybeSingle(),
      supabase.from('growth_website_template_selections').select('id,template_id,status,fit_score,source_snapshot').eq('website_id', targetWebsiteId).in('status', ['approved','imported']).limit(1).maybeSingle(),
      supabase.from('growth_website_versions').select('id,version_no,label,status,preview_url,qa_status,qa_score,source_snapshot').eq('website_id', targetWebsiteId).order('version_no', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('growth_website_qa_checks').select('id,status,severity').eq('website_id', targetWebsiteId),
      supabase.from('growth_website_releases').select('status').eq('website_id', targetWebsiteId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const firstError = briefRes.error || selectionRes.error || versionRes.error || qaRes.error || releaseRes.error;
    if (firstError) { setError(firstError.message); setDetailLoading(false); return; }
    const selection = (selectionRes.data || null) as Selection | null;
    let template: Template | null = null;
    if (selection) {
      const { data, error: templateError } = await supabase.from('growth_website_templates').select('id,name,template_key,license_name,license_verified,preview_url,live_demo_url').eq('id', selection.template_id).maybeSingle();
      if (templateError) setError(templateError.message);
      template = (data || null) as Template | null;
    }
    const qaRows = qaRes.data || [];
    setDetail({
      brief: (briefRes.data || null) as Brief | null,
      selection,
      template,
      latestVersion: (versionRes.data || null) as Version | null,
      qaBlockers: qaRows.filter((row) => row.status === 'fail' && ['high','blocker'].includes(row.severity)).length,
      qaTotal: qaRows.length,
      releaseStatus: releaseRes.data?.status || null,
    });
    setDetailLoading(false);
  }

  async function createWebsite() {
    const brand = brands.find((item) => item.id === brandId);
    if (!brand || creating) return;
    const cleanSlug = slugify(slug || brand.name);
    if (!cleanSlug) { setError('Enter a valid website slug.'); return; }
    setCreating(true); setError(''); setNotice('');
    const { data: created, error: websiteError } = await supabase.from('growth_websites').insert({
      business_name: brand.name,
      slug: cleanSlug,
      status: 'draft',
      template_version: 'template_first_v1',
      brand_id: brand.id,
      config: { businessName: brand.name, slug: cleanSlug, brandId: brand.id, workflow: 'template_first' },
    }).select('id').single();
    if (websiteError || !created) { setError(websiteError?.message || 'Could not create website project.'); setCreating(false); return; }
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
      verified_facts: { business_name: brand.name, product: brand.product || '', preferred_cta: brand.preferred_cta || '' },
      constraints: { rule: 'Do not invent claims. Verify operational facts before production.' },
      status: 'draft',
    });
    if (briefError) {
      await supabase.from('growth_websites').delete().eq('id', created.id);
      setError(`Project rolled back because its brief could not be created: ${briefError.message}`); setCreating(false); return;
    }
    setNotice('Project created. Verify the business brief, then choose a real template from the verified library.');
    await loadProjects(brand.id); setWebsiteId(created.id); setCreating(false);
  }

  async function updateBrief(status: 'verified' | 'approved') {
    if (!detail.brief || working) return;
    setWorking(true); setError('');
    const { error: updateError } = await supabase.from('growth_website_briefs').update({ status, updated_at: new Date().toISOString() }).eq('id', detail.brief.id);
    if (updateError) setError(updateError.message);
    else { setNotice(status === 'verified' ? 'Facts marked verified. Approve the brief when the business truth is complete.' : 'Brief approved. Choose a verified template next.'); await loadDetail(websiteId); }
    setWorking(false);
  }

  const activeBrand = brands.find((item) => item.id === brandId) || null;
  const activeSite = websites.find((item) => item.id === websiteId) || null;
  const briefDone = detail.brief?.status === 'approved';
  const templateDone = Boolean(detail.selection && detail.template);
  const artifactDone = detail.selection?.status === 'imported' || detail.latestVersion?.source_snapshot?.mode === 'template_adaptation';
  const previewDone = Boolean(detail.latestVersion?.preview_url);
  const qaPassed = detail.latestVersion?.qa_status === 'pass';

  if (loading) return <div className="studioPage"><div className="loading">Loading Website Studio…</div></div>;
  if (!user) return <div className="studioPage"><div className="loading">Sign in to open Website Studio.</div></div>;

  return <div className="studioPage">
    <header className="hero"><div><span>WEBSITE STUDIO / TEMPLATE-FIRST</span><h1>Start with a great website.<br/><em>Then make it yours.</em></h1><p>Brand Brain → verified brief → real template shortlist → approval → licensed source adaptation → immutable preview → rendered QA → release.</p></div><div className="heroRule"><b>DEFAULT</b><strong>Template first</strong><small>Blank-canvas generation is legacy fallback only.</small></div></header>
    {notice && <div className="notice good">{notice}</div>}{error && <div className="notice bad">{error}</div>}

    <section className="metrics"><article><span>ACTIVE BRAND</span><b>{activeBrand?.name || 'None'}</b><small>{websites.length} website project{websites.length === 1 ? '' : 's'}</small></article><article><span>WORKFLOW</span><b>Template-first</b><small>Approve the visual baseline before adapting code</small></article><article><span>APPROVED TEMPLATE</span><b>{detail.template?.name || '—'}</b><small>{detail.template?.license_verified ? `${detail.template.license_name} verified` : 'Select from Template Library'}</small></article><article className={detail.qaBlockers ? 'risk' : 'good'}><span>QA BLOCKERS</span><b>{activeSite ? detail.qaBlockers : '—'}</b><small>{detail.qaBlockers ? 'Release blocked' : 'No high/blocker findings recorded'}</small></article></section>

    <div className="workspace">
      <aside className="side">
        <div className="sideHead"><span>PROJECTS</span><h2>{activeBrand?.name || 'Brand Brain'}</h2></div>
        <div className="projectList">{websites.length === 0 && <p>No website projects yet.</p>}{websites.map((site) => <button key={site.id} className={site.id === websiteId ? 'active' : ''} onClick={() => setWebsiteId(site.id)}><span><b>{site.business_name}</b><small>{site.slug}</small></span><em>{site.template_version.includes('template') ? 'TF' : 'Legacy'}</em></button>)}</div>
        <div className="newProject"><span>NEW PROJECT</span><strong>Creating for: {activeBrand?.name || 'Select Brand Brain'}</strong><label>Slug<input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} /></label><button disabled={!activeBrand || creating} onClick={() => void createWebsite()}>{creating ? 'Creating…' : 'Create website project'}</button><small>Business identity is locked to the active Brand Brain. No site is published automatically.</small></div>
      </aside>

      <main className="main">
        {!activeSite ? <div className="empty"><b>01</b><h2>Create the first project.</h2><p>Website Studio will create the brief from Brand Brain, then move directly into template selection.</p></div> : detailLoading ? <div className="loading">Loading project state…</div> : <>
          <header className="projectHead"><div><span>ACTIVE WEBSITE</span><h2>{activeSite.business_name}</h2><p>{activeSite.slug} · {pretty(activeSite.status)}</p></div><div>{detail.latestVersion?.preview_url && <a href={detail.latestVersion.preview_url} target="_blank" rel="noreferrer">Preview ↗</a>}{activeSite.live_url && <a href={activeSite.live_url} target="_blank" rel="noreferrer">Live ↗</a>}</div></header>

          <section className="pipeline"><Step index="01" title="Business brief" value={detail.brief ? pretty(detail.brief.status) : 'Missing'} state={briefDone ? 'done' : detail.brief?.status === 'verified' ? 'active' : 'pending'} /><Step index="02" title="Approved template" value={detail.template?.name || 'Not selected'} state={templateDone ? 'done' : briefDone ? 'active' : 'pending'} /><Step index="03" title="Adapted artifact" value={artifactDone ? 'Imported' : 'Not frozen'} state={artifactDone ? 'done' : templateDone ? 'active' : 'pending'} /><Step index="04" title="Preview + QA" value={qaPassed ? `Passed ${detail.latestVersion?.qa_score || ''}` : previewDone ? 'Preview created' : 'Not started'} state={qaPassed ? 'done' : detail.qaBlockers ? 'blocked' : previewDone ? 'active' : 'pending'} /><Step index="05" title="Release" value={pretty(detail.releaseStatus)} state={detail.releaseStatus === 'live' ? 'done' : qaPassed ? 'active' : 'pending'} /></section>

          <div className="twoCol">
            <section className="card"><div className="cardHead"><div><span>BUSINESS BRIEF</span><h3>Truth before adaptation</h3></div><i>{pretty(detail.brief?.status)}</i></div>{detail.brief ? <><dl><div><dt>Goal</dt><dd>{detail.brief.primary_goal || 'Not set'}</dd></div><div><dt>Audience</dt><dd>{detail.brief.audience || 'Not set'}</dd></div><div><dt>Offer</dt><dd>{detail.brief.offer || 'Not set'}</dd></div><div><dt>Proof</dt><dd>{detail.brief.proof || 'Not set'}</dd></div><div><dt>Voice</dt><dd>{detail.brief.voice || 'Not set'}</dd></div><div><dt>Avoid</dt><dd>{detail.brief.avoid || 'Not set'}</dd></div></dl><div className="actions">{detail.brief.status === 'draft' && <button disabled={working} onClick={() => void updateBrief('verified')}>Mark facts verified</button>}{detail.brief.status === 'verified' && <button disabled={working} onClick={() => void updateBrief('approved')}>Approve brief</button>}</div></> : <p>Brief missing.</p>}</section>

            <section className="card templateCard"><div className="cardHead"><div><span>TEMPLATE BASELINE</span><h3>{detail.template?.name || 'Choose the real design first'}</h3></div>{detail.template?.license_verified && <i className="green">{detail.template.license_name} ✓</i>}</div>{detail.template ? <><p>The visual and interaction baseline is locked before adaptation. Client branding, assets, copy and business logic are replaced without degrading the quality DNA.</p><div className="templateLinks">{detail.template.live_demo_url && <a href={detail.template.live_demo_url} target="_blank" rel="noreferrer">Original demo ↗</a>}{detail.template.preview_url && <a href={detail.template.preview_url} target="_blank" rel="noreferrer">Current adaptation ↗</a>}</div></> : <p>Only templates with a verified reusable-code license can be approved.</p>}<Link className="primaryLink" href="/websites/templates">{detail.template ? 'Review Template Library' : 'Choose template →'}</Link></section>
          </div>

          <section className="nextCard"><div><span>NEXT ACTION</span><h3>{!briefDone ? 'Finish the business brief.' : !templateDone ? 'Approve a professional template.' : !artifactDone ? 'Adapt and freeze the approved source.' : !previewDone ? 'Deploy the immutable preview.' : !qaPassed ? 'Run rendered QA and fix what fails.' : 'Review the release candidate.'}</h3><p>{!briefDone ? 'Do not start visual work until claims, audience, offer and voice are verified.' : !templateDone ? 'The Template Library is the default creative decision point.' : !artifactDone ? 'Agent/Codex adaptation should preserve the template quality while replacing third-party identity and unsupported content.' : !previewDone ? 'Preview deployment must use the exact frozen artifact.' : !qaPassed ? 'Mobile and desktop quality must pass before human approval.' : 'Production still requires explicit human release confirmation.'}</p></div><Link href={!briefDone ? '/websites' : !templateDone ? '/websites/templates' : !artifactDone ? '/websites/build' : !previewDone ? '/websites/build' : !qaPassed ? '/websites/qa' : '/websites/release'}>Continue →</Link></section>

          <section className="principles"><div><b>Template discovery</b><span>Library first; external search only when no verified option fits.</span></div><div><b>Code permission</b><span>No commercial copy/import when repository licensing is ambiguous.</span></div><div><b>Adaptation</b><span>Preserve quality DNA, not original branding or proprietary media.</span></div><div><b>Versioning</b><span>Freeze the exact adapted Git artifact before preview.</span></div><div><b>Release</b><span>Rendered QA + human approval + exact-artifact promotion.</span></div></section>
        </>}
      </main>
    </div>

    <style jsx>{`
      .studioPage{max-width:1240px;margin:0 auto;padding:6px 0 80px;color:#20231f}.loading{padding:28px;border:1px solid #e1ded6;background:#fffdf8;border-radius:18px;color:#73776f}.hero{display:flex;justify-content:space-between;align-items:end;gap:30px;padding:20px 0 24px}.hero>div:first-child>span,.projectHead span,.sideHead span,.newProject>span,.cardHead span,.nextCard span{font-size:9px;letter-spacing:.15em;font-weight:900;color:#866846}.hero h1{font-size:clamp(46px,6.5vw,82px);line-height:.9;letter-spacing:-.065em;margin:8px 0 14px;max-width:850px}.hero h1 em{font-family:Georgia,serif;font-weight:400}.hero p{max-width:760px;color:#6e716a;line-height:1.55}.heroRule{min-width:220px;background:#1e302b;color:#fff;border-radius:22px;padding:18px;display:grid;gap:5px}.heroRule b{font-size:9px;letter-spacing:.13em;color:#c9de91}.heroRule strong{font-size:20px}.heroRule small{color:#c8d1cd}.notice{padding:12px 15px;border-radius:14px;margin-bottom:15px;font-size:12px}.notice.good{background:#eaf5ec;border:1px solid #c8decf}.notice.bad{background:#fff0ee;border:1px solid #efc1bb;color:#7d322b}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}.metrics article{background:#fff;border:1px solid #dfdcd4;border-radius:17px;padding:15px;display:grid;gap:5px}.metrics span{font-size:8px;letter-spacing:.12em;font-weight:900;color:#7d766d}.metrics b{font-size:17px;letter-spacing:-.02em}.metrics small{font-size:9px;color:#80827d}.metrics .good{background:#edf5ee}.metrics .risk{background:#fff0eb}.workspace{display:grid;grid-template-columns:270px 1fr;gap:14px}.side,.main{background:#f8f6f1;border:1px solid #dfdcd4;border-radius:22px;padding:16px}.side{align-self:start}.sideHead h2{margin:5px 0 13px;font-size:18px}.projectList{display:grid;gap:7px}.projectList>p{font-size:11px;color:#777}.projectList button{border:1px solid #e1ddd5;background:#fff;border-radius:13px;padding:11px;text-align:left;display:flex;justify-content:space-between;gap:8px;cursor:pointer}.projectList button.active{border-color:#8aa295;background:#eef4ef}.projectList span{display:grid;gap:2px}.projectList b{font-size:11px}.projectList small{font-size:8px;color:#85847e}.projectList em{font-style:normal;font-size:8px;font-weight:900;color:#687b70}.newProject{margin-top:16px;border-top:1px solid #e1ddd5;padding-top:15px;display:grid;gap:9px}.newProject>strong{font-size:11px}.newProject label{display:grid;gap:5px;font-size:9px;color:#777}.newProject input{border:1px solid #d9d5cd;border-radius:10px;padding:9px;background:#fff}.newProject button,.actions button{border:0;background:#20372f;color:#fff;border-radius:10px;padding:10px;font-size:10px;font-weight:850;cursor:pointer}.newProject small{font-size:8px;color:#85837d;line-height:1.4}.main{background:#fff}.empty{padding:60px 30px;text-align:center}.empty>b{display:inline-grid;place-items:center;width:36px;height:36px;border-radius:50%;background:#e7eee8;color:#496056}.empty h2{font-size:30px;margin:12px 0 8px}.empty p{color:#777}.projectHead{display:flex;justify-content:space-between;align-items:end;gap:20px;padding:4px 3px 16px;border-bottom:1px solid #ece8e1}.projectHead h2{font-size:28px;letter-spacing:-.04em;margin:5px 0}.projectHead p{font-size:10px;color:#777;margin:0}.projectHead>div:last-child{display:flex;gap:8px}.projectHead a{font-size:10px;font-weight:850;color:#345246;text-decoration:none}.pipeline{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:16px 0}.step{border:1px solid #e5e1d9;border-radius:13px;padding:11px;display:flex;gap:9px;background:#faf9f6}.step>b{font-size:8px;color:#8b806f}.step span{display:grid;gap:3px}.step strong{font-size:9px}.step small{font-size:8px;color:#85837d}.step.done{background:#edf4ee;border-color:#d1dfd4}.step.active{background:#f7f1df;border-color:#e7d9ad}.step.blocked{background:#fbecea;border-color:#ebc5bf}.twoCol{display:grid;grid-template-columns:1fr 1fr;gap:11px}.card{border:1px solid #e2ded6;border-radius:18px;padding:16px}.cardHead{display:flex;justify-content:space-between;gap:14px}.cardHead h3{font-size:18px;margin:5px 0 12px;letter-spacing:-.03em}.cardHead i{font-style:normal;font-size:8px;background:#f0ede7;border-radius:999px;padding:6px 8px;align-self:start}.cardHead i.green{background:#e5f1e7;color:#315b3f}.card dl{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0}.card dl div{background:#f8f6f1;border-radius:11px;padding:10px}.card dt{font-size:8px;text-transform:uppercase;color:#8a8278}.card dd{font-size:10px;margin:5px 0 0;line-height:1.45}.actions{margin-top:12px;display:flex;justify-content:flex-end}.templateCard>p{font-size:11px;line-height:1.55;color:#6f716b}.templateLinks{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:13px}.templateLinks a{font-size:9px;font-weight:850;color:#416153;text-decoration:none}.primaryLink{display:inline-block;background:#20372f;color:#fff;border-radius:10px;padding:10px 12px;font-size:10px;font-weight:850;text-decoration:none}.nextCard{margin-top:11px;border-radius:18px;background:#20352f;color:#fff;padding:18px;display:flex;justify-content:space-between;gap:20px;align-items:center}.nextCard span{color:#b9cf92}.nextCard h3{font-size:21px;margin:5px 0}.nextCard p{font-size:10px;line-height:1.55;color:#cbd6d1;margin:0;max-width:720px}.nextCard>a{background:#cce56e;color:#24332a;border-radius:11px;padding:11px 14px;font-size:10px;font-weight:900;text-decoration:none;white-space:nowrap}.principles{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-top:11px}.principles div{background:#f6f3ed;border-radius:12px;padding:11px;display:grid;gap:4px}.principles b{font-size:9px}.principles span{font-size:8px;line-height:1.4;color:#77736c}@media(max-width:1050px){.metrics{grid-template-columns:1fr 1fr}.workspace{grid-template-columns:230px 1fr}.pipeline{grid-template-columns:1fr 1fr}.principles{grid-template-columns:1fr 1fr}.twoCol{grid-template-columns:1fr}}@media(max-width:760px){.hero{display:block}.heroRule{margin-top:14px}.workspace{grid-template-columns:1fr}.metrics{grid-template-columns:1fr 1fr}.side{position:static}.pipeline{grid-template-columns:1fr}.nextCard{align-items:flex-start;flex-direction:column}.nextCard>a{width:100%;text-align:center}.principles{grid-template-columns:1fr}.card dl{grid-template-columns:1fr}}@media(max-width:480px){.hero h1{font-size:46px}.metrics{grid-template-columns:1fr}.projectHead{display:block}.projectHead>div:last-child{margin-top:10px}}
    `}</style>
  </div>;
}
