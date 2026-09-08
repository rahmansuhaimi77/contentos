'use client';

import Link from 'next/link';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type Brand = { id: string; workspace_id: string; name: string };
type Product = {
  id: string; slug: string; brand: string; model: string; storage: string | null; colour: string | null;
  condition_label: string | null; battery_health: number | null; price: number | null; warranty: string | null;
  accessories: string | null; description: string | null; image_urls: string[]; stock_status: string;
  featured: boolean; is_published: boolean; sort_order: number; created_at: string; updated_at: string;
};
type Ops = { product_id: string; supplier_name: string | null; supplier_reference: string | null; supplier_cost: number | null; internal_notes: string | null };
type EventRow = { product_id: string | null; event_type: 'catalog_view' | 'product_view' | 'whatsapp_click' | 'generic_enquiry_open'; created_at: string };

type CsvRow = Record<string, string>;

const HEADERS = [
  'brand','model','storage','colour','condition_label','battery_health','price','warranty','accessories','description','image_urls',
  'stock_status','featured','is_published','sort_order','supplier_name','supplier_reference','supplier_cost','internal_notes',
];
const VALID_STATUS = new Set(['available','reserved','sold','unavailable']);

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}
function bool(value: string) {
  return ['1','true','yes','y'].includes(value.trim().toLowerCase());
}
function nullableNumber(value: string) {
  if (!value.trim()) return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}
function csvEscape(value: unknown) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift()!.map((item) => item.trim().toLowerCase());
  return rows.filter((cells) => cells.some((cell) => cell.trim())).map((cells) => {
    const out: CsvRow = {};
    headers.forEach((header, index) => { out[header] = cells[index] ?? ''; });
    return out;
  });
}
function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

export default function TechRilexToolsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [ops, setOps] = useState<Record<string, Ops>>({});
  const [events, setEvents] = useState<EventRow[]>([]);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) { setAuthRequired(true); setLoading(false); return; }
    setAuthRequired(false);
    const { data: brandData, error: brandError } = await supabase.from('contentos_brands').select('id,workspace_id,name').eq('name', 'Tech Rilex').limit(1).maybeSingle();
    if (brandError || !brandData) { setMessage(brandError?.message || 'Tech Rilex Brand Brain not found.'); setLoading(false); return; }
    const nextBrand = brandData as Brand;
    setBrand(nextBrand);
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [{ data: productData, error: productError }, { data: opsData }, { data: eventData, error: eventError }] = await Promise.all([
      supabase.from('tech_rilex_products').select('*').eq('brand_id', nextBrand.id).order('created_at', { ascending: false }),
      supabase.from('tech_rilex_inventory_ops').select('*').eq('workspace_id', nextBrand.workspace_id),
      supabase.from('tech_rilex_events').select('product_id,event_type,created_at').eq('brand_id', nextBrand.id).gte('created_at', since).order('created_at', { ascending: false }),
    ]);
    if (productError) setMessage(productError.message);
    else if (eventError) setMessage(eventError.message);
    setProducts((productData || []) as Product[]);
    const map: Record<string, Ops> = {};
    ((opsData || []) as Ops[]).forEach((item) => { map[item.product_id] = item; });
    setOps(map);
    setEvents((eventData || []) as EventRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function exportInventory() {
    const lines = [HEADERS.join(',')];
    for (const product of products) {
      const internal = ops[product.id];
      const values = [
        product.brand, product.model, product.storage, product.colour, product.condition_label, product.battery_health, product.price,
        product.warranty, product.accessories, product.description, (product.image_urls || []).join('|'), product.stock_status,
        product.featured, product.is_published, product.sort_order, internal?.supplier_name, internal?.supplier_reference,
        internal?.supplier_cost, internal?.internal_notes,
      ];
      lines.push(values.map(csvEscape).join(','));
    }
    download(`tech-rilex-inventory-${new Date().toISOString().slice(0,10)}.csv`, lines.join('\n'));
  }

  function downloadTemplate() {
    download('tech-rilex-inventory-template.csv', HEADERS.join(',') + '\n');
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !brand) return;
    const rows = parseCsv(await file.text());
    if (!rows.length) { setMessage('CSV contains no inventory rows.'); return; }
    if (!('brand' in rows[0]) || !('model' in rows[0])) { setMessage('CSV must contain brand and model columns.'); return; }
    if (!window.confirm(`Import ${rows.length} row${rows.length === 1 ? '' : 's'}? Existing supplier references will be updated; new references will create new units.`)) return;

    setBusy(true); setMessage('');
    const refToProduct = new Map<string, string>();
    Object.values(ops).forEach((item) => { if (item.supplier_reference?.trim()) refToProduct.set(item.supplier_reference.trim(), item.product_id); });
    const productById = new Map(products.map((item) => [item.id, item]));
    let created = 0, updated = 0, failed = 0;
    const failures: string[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNo = index + 2;
      const itemBrand = (row.brand || '').trim();
      const model = (row.model || '').trim();
      if (!itemBrand || !model) { failed += 1; failures.push(`row ${rowNo}: brand/model missing`); continue; }
      const battery = nullableNumber(row.battery_health || '');
      if (battery != null && (battery < 0 || battery > 100)) { failed += 1; failures.push(`row ${rowNo}: battery_health must be 0-100`); continue; }
      const status = VALID_STATUS.has((row.stock_status || '').trim().toLowerCase()) ? row.stock_status.trim().toLowerCase() : 'available';
      const supplierRef = (row.supplier_reference || '').trim();
      const existingId = supplierRef ? refToProduct.get(supplierRef) || '' : '';
      const existingProduct = existingId ? productById.get(existingId) : undefined;
      const baseSlug = slugify([itemBrand, model, row.storage, row.colour].filter(Boolean).join('-')) || 'phone';
      const payload = {
        workspace_id: brand.workspace_id,
        brand_id: brand.id,
        slug: existingProduct?.slug || `${baseSlug}-${Date.now().toString(36).slice(-5)}-${index}`,
        brand: itemBrand,
        model,
        storage: (row.storage || '').trim() || null,
        colour: (row.colour || '').trim() || null,
        condition_label: (row.condition_label || '').trim() || null,
        battery_health: battery,
        price: nullableNumber(row.price || ''),
        warranty: (row.warranty || '').trim() || null,
        accessories: (row.accessories || '').trim() || null,
        description: (row.description || '').trim() || null,
        image_urls: (row.image_urls || '').split('|').map((item) => item.trim()).filter(Boolean),
        stock_status: status,
        featured: bool(row.featured || ''),
        is_published: bool(row.is_published || ''),
        sort_order: nullableNumber(row.sort_order || '') || 0,
        updated_at: new Date().toISOString(),
      };
      let productId = existingId;
      if (existingId) {
        const { error } = await supabase.from('tech_rilex_products').update(payload).eq('id', existingId);
        if (error) { failed += 1; failures.push(`row ${rowNo}: ${error.message}`); continue; }
        updated += 1;
      } else {
        const { data, error } = await supabase.from('tech_rilex_products').insert(payload).select('id').single();
        if (error || !data) { failed += 1; failures.push(`row ${rowNo}: ${error?.message || 'create failed'}`); continue; }
        productId = data.id; created += 1;
        if (supplierRef) refToProduct.set(supplierRef, productId);
      }
      const opsPayload = {
        product_id: productId,
        workspace_id: brand.workspace_id,
        supplier_name: (row.supplier_name || '').trim() || null,
        supplier_reference: supplierRef || null,
        supplier_cost: nullableNumber(row.supplier_cost || ''),
        internal_notes: (row.internal_notes || '').trim() || null,
        updated_at: new Date().toISOString(),
      };
      const { error: opsError } = await supabase.from('tech_rilex_inventory_ops').upsert(opsPayload, { onConflict: 'product_id' });
      if (opsError) { failed += 1; failures.push(`row ${rowNo} ops: ${opsError.message}`); }
    }
    setBusy(false);
    setMessage(`Import complete: ${created} created, ${updated} updated, ${failed} failed.${failures.length ? ` ${failures.slice(0,3).join(' · ')}` : ''}`);
    await load();
  }

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 86400000;
  const count = (type: EventRow['event_type'], days = 30) => events.filter((event) => event.event_type === type && (days === 30 || new Date(event.created_at).getTime() >= sevenDaysAgo)).length;
  const interest = new Map<string, { views: number; whatsapp: number }>();
  for (const event of events) {
    if (!event.product_id) continue;
    const current = interest.get(event.product_id) || { views: 0, whatsapp: 0 };
    if (event.event_type === 'product_view') current.views += 1;
    if (event.event_type === 'whatsapp_click') current.whatsapp += 1;
    interest.set(event.product_id, current);
  }
  const topProducts = [...interest.entries()].map(([id, stats]) => ({ product: products.find((item) => item.id === id), ...stats })).filter((item) => item.product).sort((a,b) => (b.whatsapp * 5 + b.views) - (a.whatsapp * 5 + a.views)).slice(0,5);

  if (loading) return <div style={{ padding: 32 }}>Loading Tech Rilex operations…</div>;
  if (authRequired) return <div style={{ padding: 32 }}><h1>Tech Rilex Operations</h1><p>Sign in first.</p><Link href="/login">Sign in</Link></div>;

  return <div className="trTools">
    <header className="toolsHead"><div><span>TECH RILEX / OPERATIONS</span><h1>Inventory tools & analytics</h1><p>Bulk supplier-stock handling and conversion signals, without storing customer messages or personal data.</p></div><div className="headLinks"><Link href="/tech-rilex-admin">Inventory</Link><a href="/tech-rilex" target="_blank" rel="noreferrer">Storefront ↗</a></div></header>
    {message && <div className="notice">{message}</div>}

    <section className="panel"><div className="sectionHead"><div><span>BULK INVENTORY</span><h2>CSV import & backup</h2></div><p>Use supplier_reference when available. The same reference updates the existing unit instead of creating a duplicate.</p></div><div className="actions"><button onClick={downloadTemplate}>Download CSV template</button><label className={busy ? 'disabled' : ''}>Import CSV<input type="file" accept=".csv,text/csv" onChange={importCsv} disabled={busy} /></label><button onClick={exportInventory} disabled={!products.length}>Export current inventory</button></div><small>Images can still be supplied as HTTPS URLs separated by | in the image_urls column. Imported rows remain drafts unless is_published is explicitly true/yes/1.</small></section>

    <section className="panel"><div className="sectionHead"><div><span>CONVERSION SIGNALS</span><h2>Last 30 days</h2></div><p>Anonymous action counts only. No customer name, phone number, WhatsApp message or enquiry content is stored.</p></div><div className="metrics"><article><b>{count('catalog_view')}</b><span>Catalogue visits</span><small>{count('catalog_view',7)} in 7 days</small></article><article><b>{count('product_view')}</b><span>Product views</span><small>{count('product_view',7)} in 7 days</small></article><article><b>{count('whatsapp_click')}</b><span>Product WhatsApp clicks</span><small>{count('whatsapp_click',7)} in 7 days</small></article><article><b>{count('generic_enquiry_open')}</b><span>Phone requests opened</span><small>{count('generic_enquiry_open',7)} in 7 days</small></article></div></section>

    <section className="panel"><div className="sectionHead"><div><span>PRODUCT INTEREST</span><h2>Top phones</h2></div><p>Ranked using product detail views and WhatsApp intent from the last 30 days.</p></div>{topProducts.length ? <div className="topList">{topProducts.map(({product,views,whatsapp}, index) => <div key={product!.id}><b>{index + 1}</b><span><strong>{product!.brand} {product!.model}</strong><small>{[product!.storage,product!.colour].filter(Boolean).join(' · ') || 'Unit details'}</small></span><span className="stats">{views} views · {whatsapp} WhatsApp</span></div>)}</div> : <div className="empty">No product-interest data yet. Metrics will populate automatically after customers use the storefront.</div>}</section>

    <style jsx>{`
      .trTools{max-width:1120px;margin:0 auto;padding:28px 0 80px;color:#201f1b}.toolsHead{display:flex;justify-content:space-between;align-items:end;gap:30px;margin-bottom:22px}.toolsHead>div:first-child>span,.sectionHead span{font-size:10px;letter-spacing:.16em;font-weight:900;color:#9a7448}.toolsHead h1{font-size:clamp(38px,5vw,64px);line-height:.95;letter-spacing:-.055em;margin:8px 0 12px}.toolsHead p,.sectionHead p{color:#6d6a63;max-width:680px}.headLinks,.actions{display:flex;gap:10px;flex-wrap:wrap}.headLinks a,.actions button,.actions label{border:1px solid #ddd5ca;background:#fff;color:#1d1c18;border-radius:999px;padding:11px 15px;text-decoration:none;font-weight:800;cursor:pointer}.headLinks a:last-child,.actions label{background:#1c2d28;color:#fff;border-color:#1c2d28}.actions label input{display:none}.actions .disabled{opacity:.5;pointer-events:none}.panel{background:#fff;border:1px solid #ded8cf;border-radius:26px;padding:24px;margin-bottom:20px;box-shadow:0 12px 38px rgba(61,50,38,.05)}.sectionHead{display:flex;justify-content:space-between;align-items:start;gap:28px;margin-bottom:20px}.sectionHead h2{font-size:28px;letter-spacing:-.035em;margin:6px 0}.sectionHead p{max-width:460px;text-align:right;margin:0}.notice{background:#fff8df;border:1px solid #ead89e;border-radius:16px;padding:13px 16px;margin-bottom:18px}.panel>small{display:block;margin-top:14px;color:#777168}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metrics article{background:#f5f1ea;border-radius:18px;padding:18px;display:grid;gap:6px}.metrics b{font-size:34px;letter-spacing:-.05em}.metrics span{font-weight:850}.metrics small{color:#81786e}.topList{display:grid}.topList>div{display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:14px;padding:14px 4px;border-bottom:1px solid #eee9e2}.topList>div>b{font-size:12px;color:#9a7448}.topList span{display:grid;gap:2px}.topList small{color:#777168}.stats{font-size:12px;color:#655d54}.empty{padding:28px;border:1px dashed #d2c7b8;border-radius:18px;text-align:center;color:#777168}@media(max-width:850px){.toolsHead,.sectionHead{display:block}.headLinks{margin-top:16px}.sectionHead p{text-align:left}.metrics{grid-template-columns:1fr 1fr}}@media(max-width:560px){.trTools{padding:18px 0 70px}.panel{padding:18px;border-radius:20px}.metrics{grid-template-columns:1fr}.topList>div{grid-template-columns:28px 1fr}.stats{grid-column:2}.actions{display:grid}.actions>*{text-align:center}.toolsHead h1{font-size:42px}}
    `}</style>
  </div>;
}
