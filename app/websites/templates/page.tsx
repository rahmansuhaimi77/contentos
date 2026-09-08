'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type Brand = { id: string; name: string };
type Website = { id: string; business_name: string; slug: string; created_at: string };
type Template = {
  id: string; template_key: string; name: string; source_kind: string; source_repo_url: string | null; live_demo_url: string | null;
  license_name: string; license_verified: boolean; technology: string[]; tags: string[]; business_types: string[];
  visual_summary: string; motion_summary: string; adaptation_notes: string; preview_url: string | null; quality_score: number | null;
};
type Selection = { id: string; website_id: string; template_id: string; status: string; fit_score: number | null; rationale: string; approved_at: string | null };

type BriefMap = Record<string, { brand_id: string | null }>;

export default function WebsiteTemplatesPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [brandId, setBrandId] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [websiteId, setWebsiteId] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function load(targetBrandId?: string) {
    setLoading(true); setError('');
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) { setLoading(false); return; }
    const [{ data: brandRows, error: brandError }, { data: websiteRows, error: siteError }, { data: briefRows, error: briefError }, { data: templateRows, error: templateError }] = await Promise.all([
      supabase.from('contentos_brands').select('id,name').order('updated_at', { ascending: false }),
      supabase.from('growth_websites').select('id,business_name,slug,created_at').order('created_at', { ascending: false }),
      supabase.from('growth_website_briefs').select('website_id,brand_id'),
      supabase.from('growth_website_templates').select('*').eq('status', 'active').order('quality_score', { ascending: false }),
    ]);
    const firstError = brandError || siteError || briefError || templateError;
    if (firstError) { setError(firstError.message); setLoading(false); return; }
    const nextBrands = (brandRows || []) as Brand[];
    setBrands(nextBrands);
    const saved = targetBrandId || window.localStorage.getItem('contentos:selectedBrandId') || '';
    const resolvedBrand = nextBrands.some((item) => item.id === saved) ? saved : nextBrands[0]?.id || '';
    setBrandId(resolvedBrand);
    const briefMap: BriefMap = {};
    for (const row of briefRows || []) briefMap[row.website_id] = { brand_id: row.brand_id };
    const nextSites = ((websiteRows || []) as Website[]).filter((site) => briefMap[site.id]?.brand_id === resolvedBrand);
    setWebsites(nextSites);
    const nextWebsiteId = nextSites.some((site) => site.id === websiteId) ? websiteId : nextSites[0]?.id || '';
    setWebsiteId(nextWebsiteId);
    setTemplates((templateRows || []) as Template[]);
    if (nextWebsiteId) {
      const { data: selectionRows, error: selectionError } = await supabase.from('growth_website_template_selections').select('id,website_id,template_id,status,fit_score,rationale,approved_at').eq('website_id', nextWebsiteId).order('updated_at', { ascending: false });
      if (selectionError) setError(selectionError.message);
      setSelections((selectionRows || []) as Selection[]);
    } else setSelections([]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const onBrandChange = (event: Event) => { const custom = event as CustomEvent<{ brandId: string }>; void load(custom.detail.brandId); };
    window.addEventListener('contentos:brand-change', onBrandChange);
    return () => window.removeEventListener('contentos:brand-change', onBrandChange);
  }, []);

  async function changeWebsite(nextId: string) {
    setWebsiteId(nextId); setNotice(''); setError('');
    const { data, error: selectionError } = await supabase.from('growth_website_template_selections').select('id,website_id,template_id,status,fit_score,rationale,approved_at').eq('website_id', nextId).order('updated_at', { ascending: false });
    if (selectionError) setError(selectionError.message);
    setSelections((data || []) as Selection[]);
  }

  async function approveTemplate(template: Template) {
    if (!websiteId || working) return;
    if (!template.license_verified) { setError('This template cannot be approved until its code license is verified.'); return; }
    const current = selections.find((item) => ['approved','imported'].includes(item.status));
    if (current?.template_id === template.id) { setNotice(`${template.name} is already the approved template.`); return; }
    if (current && !window.confirm('Replace the currently approved template for this website? Existing source versions and QA history will remain intact.')) return;
    setWorking(true); setError(''); setNotice('');
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) { setError('Sign in again.'); setWorking(false); return; }
    if (current) {
      const { error: rejectError } = await supabase.from('growth_website_template_selections').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', current.id);
      if (rejectError) { setError(rejectError.message); setWorking(false); return; }
    }
    const existing = selections.find((item) => item.template_id === template.id);
    const payload = {
      owner_id: authData.user.id, website_id: websiteId, template_id: template.id, status: 'approved',
      rationale: 'Approved from the verified Template Library. Adapt the design system and code structure to the business brief without copying third-party branding, proprietary media or unverified claims.',
      approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    const result = existing
      ? await supabase.from('growth_website_template_selections').update(payload).eq('id', existing.id)
      : await supabase.from('growth_website_template_selections').insert(payload);
    if (result.error) setError(result.error.message);
    else setNotice(`${template.name} approved. The next stage is Adapt + Build.`);
    setWorking(false);
    await changeWebsite(websiteId);
  }

  if (loading) return <div style={{ padding: 28 }}>Loading Template Library…</div>;
  const activeBrand = brands.find((item) => item.id === brandId);
  const activeSite = websites.find((item) => item.id === websiteId);
  const approved = selections.find((item) => ['approved','imported'].includes(item.status));

  return <div className="templatePage">
    <header className="templateHead"><div><span>WEBSITE STUDIO / TEMPLATE-FIRST</span><h1>Choose a proven visual baseline.</h1><p>Start from legally reusable professional code, approve the real design first, then adapt it to the client instead of inventing the visual system from a blank canvas.</p></div><div className="context"><small>ACTIVE BRAND</small><strong>{activeBrand?.name || 'No brand'}</strong>{websites.length > 1 ? <select value={websiteId} onChange={(e) => changeWebsite(e.target.value)}>{websites.map((site) => <option key={site.id} value={site.id}>{site.business_name}</option>)}</select> : <span>{activeSite?.business_name || 'Create a website project first'}</span>}</div></header>
    {notice && <div className="notice good">{notice}</div>}{error && <div className="notice bad">{error}</div>}

    <section className="rules"><div><b>1</b><span><strong>Verified license</strong><small>No code approval when permission is ambiguous.</small></span></div><div><b>2</b><span><strong>Approve a real demo</strong><small>Design quality is visible before adaptation begins.</small></span></div><div><b>3</b><span><strong>Adapt, don't relabel</strong><small>Replace brand, assets, content and business logic while preserving the quality DNA.</small></span></div><div><b>4</b><span><strong>QA against the source</strong><small>The adaptation must not become cheaper than the approved baseline.</small></span></div></section>

    {!websiteId ? <div className="empty">Create or select a Website Studio project for this Brand Brain first.</div> : <div className="library">{templates.map((template) => {
      const selection = selections.find((item) => item.template_id === template.id);
      const inUse = approved?.template_id === template.id;
      return <article className={inUse ? 'templateCard selected' : 'templateCard'} key={template.id}>
        <div className="cardTop"><span>{template.source_kind === 'internal_adapted' ? 'PROVEN ADAPTATION' : 'OPEN-SOURCE TEMPLATE'}</span><b>{template.quality_score ? `${Number(template.quality_score).toFixed(1)}/5` : '—'}</b></div>
        <div className="preview"><strong>{template.name}</strong><p>{template.visual_summary}</p><div className="tags">{(template.tags || []).slice(0,6).map((tag) => <span key={tag}>{tag}</span>)}</div></div>
        <div className="facts"><div><small>LICENSE</small><strong className={template.license_verified ? 'verified' : ''}>{template.license_name || 'Unverified'} {template.license_verified ? '✓' : ''}</strong></div><div><small>TECH</small><strong>{(template.technology || []).join(' · ') || 'See source'}</strong></div><div><small>MOTION</small><strong>{template.motion_summary || 'Not specified'}</strong></div></div>
        <p className="adapt">{template.adaptation_notes}</p>
        <div className="actions">{template.live_demo_url && <a href={template.live_demo_url} target="_blank" rel="noreferrer">Live demo ↗</a>}{template.preview_url && <a href={template.preview_url} target="_blank" rel="noreferrer">Our adaptation ↗</a>}{template.source_repo_url && <a href={template.source_repo_url} target="_blank" rel="noreferrer">Source ↗</a>}<button disabled={working || inUse || !template.license_verified} onClick={() => approveTemplate(template)}>{inUse ? (selection?.status === 'imported' ? 'In use ✓' : 'Approved ✓') : 'Approve template'}</button></div>
        {selection?.rationale && inUse && <div className="selectionNote"><small>WHY THIS WAS SELECTED</small><p>{selection.rationale}</p></div>}
      </article>;
    })}</div>}

    <section className="discovery"><span>DISCOVERY RULE</span><h2>Library first. Internet second.</h2><p>For each new business, Website Studio should first rank this verified library. If nothing is strong enough, the discovery agent searches externally and adds candidates only after checking the live demo, source repository and actual license.</p></section>

    <style jsx>{`
      .templatePage{max-width:1180px;margin:0 auto;padding:8px 0 80px;color:#20231f}.templateHead{display:flex;justify-content:space-between;align-items:end;gap:30px;margin-bottom:20px}.templateHead>div:first-child>span,.discovery>span{font-size:10px;letter-spacing:.16em;font-weight:900;color:#8b6a43}.templateHead h1{font-size:clamp(40px,5.8vw,72px);line-height:.92;letter-spacing:-.06em;margin:8px 0 14px;max-width:760px}.templateHead p{max-width:720px;color:#676a64;font-size:15px}.context{min-width:220px;background:#fff;border:1px solid #dedbd4;border-radius:20px;padding:16px;display:grid;gap:5px}.context small{font-size:9px;letter-spacing:.12em;color:#8b6a43;font-weight:900}.context strong{font-size:19px}.context span{font-size:12px;color:#777}.context select{border:1px solid #ddd8cf;border-radius:10px;padding:8px;background:#faf9f6}.notice{padding:13px 16px;border-radius:14px;margin-bottom:16px}.notice.good{background:#eaf5ec;border:1px solid #bcd8c2}.notice.bad{background:#fff0ee;border:1px solid #efc1bb;color:#7d322b}.rules{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0 22px}.rules>div{background:#f4f1ea;border-radius:17px;padding:15px;display:flex;gap:10px}.rules b{color:#8b6a43}.rules span{display:grid;gap:4px}.rules small{color:#74736d;line-height:1.35}.library{display:grid;grid-template-columns:1fr 1fr;gap:16px}.templateCard{background:#fff;border:1px solid #ddd9d1;border-radius:25px;padding:21px;display:grid;gap:16px;box-shadow:0 14px 40px rgba(50,45,35,.045)}.templateCard.selected{border-color:#8a7254;box-shadow:0 0 0 2px rgba(138,114,84,.12),0 14px 40px rgba(50,45,35,.06)}.cardTop{display:flex;justify-content:space-between}.cardTop span{font-size:9px;letter-spacing:.13em;font-weight:900;color:#8b6a43}.cardTop b{font-size:12px}.preview strong{font-size:28px;letter-spacing:-.04em}.preview p,.adapt,.selectionNote p{color:#686861;line-height:1.55}.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.tags span{background:#f1eee8;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:800;text-transform:uppercase}.facts{display:grid;grid-template-columns:1fr 1.1fr 1.5fr;gap:10px;padding:14px 0;border-top:1px solid #eeeae3;border-bottom:1px solid #eeeae3}.facts div{display:grid;gap:5px}.facts small,.selectionNote small{font-size:8px;letter-spacing:.12em;color:#8c8378;font-weight:900}.facts strong{font-size:11px;line-height:1.4}.facts .verified{color:#315d42}.actions{display:flex;gap:7px;flex-wrap:wrap}.actions a,.actions button{border:1px solid #d8d3ca;background:#fff;color:#242722;border-radius:999px;padding:9px 12px;text-decoration:none;font-size:11px;font-weight:850;cursor:pointer}.actions button{margin-left:auto;background:#20342d;color:#fff;border-color:#20342d}.actions button:disabled{opacity:.55;cursor:default}.selectionNote{background:#f5f1e9;border-radius:14px;padding:13px}.selectionNote p{margin:5px 0 0;font-size:12px}.discovery{margin-top:20px;padding:26px;background:#1d2e29;color:#f6f1e8;border-radius:25px}.discovery h2{font-size:32px;letter-spacing:-.04em;margin:7px 0}.discovery p{max-width:780px;color:#cbd2cf;line-height:1.55}.empty{padding:34px;border:1px dashed #cfc8bd;border-radius:20px;text-align:center;color:#777}@media(max-width:900px){.templateHead{display:block}.context{margin-top:16px}.rules{grid-template-columns:1fr 1fr}.library{grid-template-columns:1fr}}@media(max-width:560px){.templatePage{padding-top:0}.templateHead h1{font-size:44px}.rules{grid-template-columns:1fr}.facts{grid-template-columns:1fr}.actions button{margin-left:0;width:100%}}
    `}</style>
  </div>;
}
