'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type BrandRow = { id: string; workspace_id: string; name: string };
type Product = {
  id: string;
  workspace_id: string;
  brand_id: string;
  slug: string;
  brand: string;
  model: string;
  storage: string | null;
  colour: string | null;
  condition_label: string | null;
  battery_health: number | null;
  price: number | null;
  warranty: string | null;
  accessories: string | null;
  description: string | null;
  image_urls: string[];
  stock_status: 'available' | 'reserved' | 'sold' | 'unavailable';
  featured: boolean;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
type Ops = { product_id: string; supplier_name: string | null; supplier_reference: string | null; supplier_cost: number | null; internal_notes: string | null };
type Settings = { id: string; whatsapp_number: string; whatsapp_display: string; store_name: string; currency: string };

type FormState = {
  id: string;
  brand: string;
  model: string;
  storage: string;
  colour: string;
  condition_label: string;
  battery_health: string;
  price: string;
  warranty: string;
  accessories: string;
  description: string;
  image_urls: string;
  stock_status: Product['stock_status'];
  featured: boolean;
  is_published: boolean;
  sort_order: string;
  supplier_name: string;
  supplier_reference: string;
  supplier_cost: string;
  internal_notes: string;
};

const emptyForm: FormState = {
  id: '', brand: '', model: '', storage: '', colour: '', condition_label: '', battery_health: '', price: '', warranty: '', accessories: '', description: '', image_urls: '', stock_status: 'available', featured: false, is_published: false, sort_order: '0', supplier_name: '', supplier_reference: '', supplier_cost: '', internal_notes: '',
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

function money(value: number | null) {
  if (value == null) return 'Price not set';
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(value);
}

export default function TechRilexAdminPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [brand, setBrand] = useState<BrandRow | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [ops, setOps] = useState<Record<string, Ops>>({});
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState('');
  const [settingsNumber, setSettingsNumber] = useState('');
  const [settingsDisplay, setSettingsDisplay] = useState('');

  async function load() {
    setLoading(true);
    setMessage('');
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setAuthRequired(true);
      setLoading(false);
      return;
    }
    setAuthRequired(false);

    const { data: brandData, error: brandError } = await supabase
      .from('contentos_brands')
      .select('id,workspace_id,name')
      .eq('name', 'Tech Rilex')
      .limit(1)
      .maybeSingle();

    if (brandError || !brandData) {
      setMessage(brandError?.message || 'Tech Rilex Brand Brain was not found for this account.');
      setLoading(false);
      return;
    }
    const nextBrand = brandData as BrandRow;
    setBrand(nextBrand);

    const [{ data: productData, error: productError }, { data: opsData }, { data: settingsData, error: settingsError }] = await Promise.all([
      supabase.from('tech_rilex_products').select('*').eq('brand_id', nextBrand.id).order('featured', { ascending: false }).order('sort_order').order('created_at', { ascending: false }),
      supabase.from('tech_rilex_inventory_ops').select('*').eq('workspace_id', nextBrand.workspace_id),
      supabase.from('tech_rilex_settings').select('*').eq('brand_id', nextBrand.id).maybeSingle(),
    ]);

    if (productError) setMessage(productError.message);
    if (settingsError) setMessage(settingsError.message);
    setProducts((productData || []) as Product[]);
    const nextOps: Record<string, Ops> = {};
    ((opsData || []) as Ops[]).forEach((row) => { nextOps[row.product_id] = row; });
    setOps(nextOps);
    const nextSettings = (settingsData || null) as Settings | null;
    setSettings(nextSettings);
    setSettingsNumber(nextSettings?.whatsapp_number || '');
    setSettingsDisplay(nextSettings?.whatsapp_display || '');
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function editProduct(product: Product) {
    const internal = ops[product.id];
    setForm({
      id: product.id,
      brand: product.brand,
      model: product.model,
      storage: product.storage || '',
      colour: product.colour || '',
      condition_label: product.condition_label || '',
      battery_health: product.battery_health == null ? '' : String(product.battery_health),
      price: product.price == null ? '' : String(product.price),
      warranty: product.warranty || '',
      accessories: product.accessories || '',
      description: product.description || '',
      image_urls: (product.image_urls || []).join('\n'),
      stock_status: product.stock_status,
      featured: product.featured,
      is_published: product.is_published,
      sort_order: String(product.sort_order || 0),
      supplier_name: internal?.supplier_name || '',
      supplier_reference: internal?.supplier_reference || '',
      supplier_cost: internal?.supplier_cost == null ? '' : String(internal.supplier_cost),
      internal_notes: internal?.internal_notes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function field<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    if (!brand) return;
    if (!form.brand.trim() || !form.model.trim()) {
      setMessage('Brand and model are required.');
      return;
    }
    setSaving(true);
    setMessage('');

    const baseSlug = slugify([form.brand, form.model, form.storage, form.colour].filter(Boolean).join('-')) || 'phone';
    const slug = form.id ? products.find((item) => item.id === form.id)?.slug || baseSlug : `${baseSlug}-${Date.now().toString(36).slice(-5)}`;
    const productPayload = {
      workspace_id: brand.workspace_id,
      brand_id: brand.id,
      slug,
      brand: form.brand.trim(),
      model: form.model.trim(),
      storage: form.storage.trim() || null,
      colour: form.colour.trim() || null,
      condition_label: form.condition_label.trim() || null,
      battery_health: form.battery_health ? Number(form.battery_health) : null,
      price: form.price ? Number(form.price) : null,
      warranty: form.warranty.trim() || null,
      accessories: form.accessories.trim() || null,
      description: form.description.trim() || null,
      image_urls: form.image_urls.split('\n').map((item) => item.trim()).filter(Boolean),
      stock_status: form.stock_status,
      featured: form.featured,
      is_published: form.is_published,
      sort_order: Number(form.sort_order || 0),
      updated_at: new Date().toISOString(),
    };

    let productId = form.id;
    if (form.id) {
      const { error } = await supabase.from('tech_rilex_products').update(productPayload).eq('id', form.id);
      if (error) { setMessage(error.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('tech_rilex_products').insert(productPayload).select('id').single();
      if (error || !data) { setMessage(error?.message || 'Could not create product.'); setSaving(false); return; }
      productId = data.id;
    }

    const opsPayload = {
      product_id: productId,
      workspace_id: brand.workspace_id,
      supplier_name: form.supplier_name.trim() || null,
      supplier_reference: form.supplier_reference.trim() || null,
      supplier_cost: form.supplier_cost ? Number(form.supplier_cost) : null,
      internal_notes: form.internal_notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error: opsError } = await supabase.from('tech_rilex_inventory_ops').upsert(opsPayload, { onConflict: 'product_id' });
    if (opsError) { setMessage(`Product saved, but internal ops failed: ${opsError.message}`); setSaving(false); await load(); return; }

    setForm(emptyForm);
    setMessage('Product saved.');
    setSaving(false);
    await load();
  }

  async function removeProduct(product: Product) {
    if (!window.confirm(`Delete ${product.brand} ${product.model}? This cannot be undone.`)) return;
    const { error } = await supabase.from('tech_rilex_products').delete().eq('id', product.id);
    setMessage(error ? error.message : 'Product deleted.');
    if (!error) await load();
  }

  async function togglePublished(product: Product) {
    const { error } = await supabase.from('tech_rilex_products').update({ is_published: !product.is_published, updated_at: new Date().toISOString() }).eq('id', product.id);
    setMessage(error ? error.message : product.is_published ? 'Product unpublished.' : 'Product published.');
    if (!error) await load();
  }

  async function saveSettings() {
    if (!settings || !brand) return;
    const digits = settingsNumber.replace(/\D/g, '');
    if (digits.length < 8) { setMessage('Enter a valid WhatsApp number in international format, e.g. 60145705911.'); return; }
    setSaving(true);
    const { error } = await supabase.from('tech_rilex_settings').update({ whatsapp_number: digits, whatsapp_display: settingsDisplay.trim(), updated_at: new Date().toISOString() }).eq('id', settings.id);
    setSaving(false);
    setMessage(error ? error.message : 'WhatsApp settings saved.');
    if (!error) await load();
  }

  if (loading) return <div style={{ padding: 32 }}>Loading Tech Rilex inventory…</div>;
  if (authRequired) return <div style={{ maxWidth: 680, margin: '60px auto', padding: 28, background: '#fff', borderRadius: 24 }}><h1>Tech Rilex Inventory</h1><p>Sign in to ContentOS to manage Tech Rilex products.</p><Link href="/login">Sign in</Link></div>;

  return (
    <div className="trAdmin">
      <div className="trAdminHead">
        <div><span className="trEyebrow">TECH RILEX / STORE ADMIN</span><h1>Inventory & storefront</h1><p>Add a phone once, publish it, and it appears on the public Tech Rilex catalogue.</p></div>
        <div className="trHeadActions"><a href="/tech-rilex" target="_blank" rel="noreferrer">Open storefront ↗</a><button onClick={() => { setForm(emptyForm); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>New phone</button></div>
      </div>

      {message && <div className="trNotice">{message}</div>}

      <section className="trPanel trSettings">
        <div><span className="trEyebrow">SALES CHANNEL</span><h2>WhatsApp</h2><p>The storefront reads this setting live. Change the number here when Tech Rilex gets a new line.</p></div>
        <div className="trSettingsFields"><label>International number<input value={settingsNumber} onChange={(e) => setSettingsNumber(e.target.value)} placeholder="60145705911" /></label><label>Display number<input value={settingsDisplay} onChange={(e) => setSettingsDisplay(e.target.value)} placeholder="014-570 5911" /></label><button onClick={saveSettings} disabled={saving}>Save WhatsApp</button></div>
      </section>

      <form className="trPanel trForm" onSubmit={saveProduct}>
        <div className="trFormTitle"><div><span className="trEyebrow">{form.id ? 'EDIT PHONE' : 'ADD PHONE'}</span><h2>{form.id ? `${form.brand} ${form.model}` : 'New inventory item'}</h2></div>{form.id && <button type="button" className="trTextButton" onClick={() => setForm(emptyForm)}>Cancel edit</button>}</div>
        <div className="trGrid3">
          <label>Brand *<input value={form.brand} onChange={(e) => field('brand', e.target.value)} placeholder="Apple" required /></label>
          <label>Model *<input value={form.model} onChange={(e) => field('model', e.target.value)} placeholder="iPhone 15 Pro" required /></label>
          <label>Storage<input value={form.storage} onChange={(e) => field('storage', e.target.value)} placeholder="256GB" /></label>
          <label>Colour<input value={form.colour} onChange={(e) => field('colour', e.target.value)} placeholder="Natural Titanium" /></label>
          <label>Condition<input value={form.condition_label} onChange={(e) => field('condition_label', e.target.value)} placeholder="Excellent / Like New" /></label>
          <label>Battery health %<input type="number" min="0" max="100" value={form.battery_health} onChange={(e) => field('battery_health', e.target.value)} placeholder="92" /></label>
          <label>Selling price (RM)<input type="number" min="0" step="1" value={form.price} onChange={(e) => field('price', e.target.value)} placeholder="2999" /></label>
          <label>Warranty<input value={form.warranty} onChange={(e) => field('warranty', e.target.value)} placeholder="2 weeks" /></label>
          <label>Accessories<input value={form.accessories} onChange={(e) => field('accessories', e.target.value)} placeholder="Cable, case" /></label>
        </div>
        <label>Description<textarea rows={3} value={form.description} onChange={(e) => field('description', e.target.value)} placeholder="Only include confirmed facts about this unit." /></label>
        <label>Image URLs <small>one URL per line</small><textarea rows={3} value={form.image_urls} onChange={(e) => field('image_urls', e.target.value)} placeholder="https://…" /></label>
        <div className="trGrid3">
          <label>Status<select value={form.stock_status} onChange={(e) => field('stock_status', e.target.value as Product['stock_status'])}><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold</option><option value="unavailable">Unavailable</option></select></label>
          <label>Sort order<input type="number" value={form.sort_order} onChange={(e) => field('sort_order', e.target.value)} /></label>
          <div className="trChecks"><label><input type="checkbox" checked={form.featured} onChange={(e) => field('featured', e.target.checked)} /> Featured</label><label><input type="checkbox" checked={form.is_published} onChange={(e) => field('is_published', e.target.checked)} /> Publish now</label></div>
        </div>
        <div className="trInternal"><span className="trEyebrow">INTERNAL ONLY — NEVER SHOWN PUBLICLY</span><div className="trGrid3"><label>Supplier<input value={form.supplier_name} onChange={(e) => field('supplier_name', e.target.value)} /></label><label>Supplier reference<input value={form.supplier_reference} onChange={(e) => field('supplier_reference', e.target.value)} /></label><label>Supplier cost (RM)<input type="number" min="0" value={form.supplier_cost} onChange={(e) => field('supplier_cost', e.target.value)} /></label></div><label>Internal notes<textarea rows={2} value={form.internal_notes} onChange={(e) => field('internal_notes', e.target.value)} /></label></div>
        <button className="trPrimary" disabled={saving}>{saving ? 'Saving…' : form.id ? 'Save changes' : 'Add phone'}</button>
      </form>

      <section className="trPanel">
        <div className="trListHead"><div><span className="trEyebrow">INVENTORY</span><h2>{products.length} phones</h2></div><p>Published items are visible publicly. Drafts and internal supplier data remain private.</p></div>
        {products.length === 0 ? <div className="trEmpty">No phones yet. Add the first real unit above.</div> : <div className="trTableWrap"><table><thead><tr><th>Phone</th><th>Status</th><th>Price</th><th>Visibility</th><th>Supplier</th><th></th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><b>{product.brand} {product.model}</b><small>{[product.storage, product.colour, product.condition_label].filter(Boolean).join(' · ') || 'Details not set'}</small></td><td><span className={`trStatus ${product.stock_status}`}>{product.stock_status}</span></td><td>{money(product.price)}</td><td><button className="trTextButton" onClick={() => togglePublished(product)}>{product.is_published ? 'Published' : 'Draft'}</button></td><td>{ops[product.id]?.supplier_name || '—'}</td><td><div className="trRowActions"><button onClick={() => editProduct(product)}>Edit</button><button className="danger" onClick={() => removeProduct(product)}>Delete</button></div></td></tr>)}</tbody></table></div>}
      </section>

      <style jsx>{`
        .trAdmin{max-width:1180px;margin:0 auto;padding:28px 0 80px;color:#201f1b}.trAdminHead{display:flex;justify-content:space-between;gap:28px;align-items:end;margin-bottom:22px}.trAdminHead h1{font-size:clamp(38px,5vw,66px);letter-spacing:-.055em;line-height:.95;margin:8px 0 12px}.trAdminHead p,.trListHead p,.trSettings p{color:#6d6a63;max-width:680px}.trEyebrow{font-size:10px;letter-spacing:.16em;font-weight:900;color:#9a7448}.trHeadActions{display:flex;gap:10px;flex-wrap:wrap}.trHeadActions a,.trHeadActions button,.trPrimary,.trSettingsFields button{border:0;border-radius:999px;padding:12px 16px;background:#1c2d28;color:#fff;text-decoration:none;font-weight:800;cursor:pointer}.trHeadActions a{background:#fff;color:#1d1c18;border:1px solid #ddd5ca}.trNotice{background:#fff8df;border:1px solid #ead89e;border-radius:16px;padding:13px 16px;margin:0 0 18px}.trPanel{background:#fff;border:1px solid #ded8cf;border-radius:26px;padding:24px;margin:0 0 20px;box-shadow:0 12px 38px rgba(61,50,38,.05)}.trPanel h2{margin:6px 0 12px;font-size:28px;letter-spacing:-.035em}.trSettings{display:grid;grid-template-columns:1fr 1.2fr;gap:28px;align-items:end}.trSettingsFields{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end}.trForm{display:grid;gap:18px}.trFormTitle,.trListHead{display:flex;justify-content:space-between;gap:20px;align-items:start}.trGrid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.trForm label,.trSettingsFields label,.trInternal label{display:grid;gap:7px;font-size:11px;font-weight:850;letter-spacing:.05em;color:#625d55}.trForm input,.trForm textarea,.trForm select,.trSettingsFields input,.trInternal input,.trInternal textarea{width:100%;border:1px solid #d9d2c8;background:#faf8f4;border-radius:13px;padding:11px 12px;color:#1e1d1a;font:inherit;outline:none}.trForm input:focus,.trForm textarea:focus,.trForm select:focus,.trSettingsFields input:focus,.trInternal input:focus,.trInternal textarea:focus{border-color:#9a7448;box-shadow:0 0 0 3px rgba(154,116,72,.12)}.trChecks{display:flex;align-items:center;gap:18px;padding:12px}.trChecks label{display:flex;align-items:center;gap:7px}.trChecks input{width:auto}.trInternal{padding:18px;border-radius:18px;background:#f3efe8;display:grid;gap:12px}.trPrimary{justify-self:start;padding:14px 22px}.trTextButton{border:0;background:transparent;text-decoration:underline;text-underline-offset:4px;cursor:pointer;color:#5b4a36}.trEmpty{padding:34px;border:1px dashed #ccc1b2;border-radius:18px;color:#7a736a;text-align:center}.trTableWrap{overflow:auto}.trTableWrap table{width:100%;border-collapse:collapse;min-width:850px}.trTableWrap th,.trTableWrap td{text-align:left;padding:13px 10px;border-bottom:1px solid #eee9e2;font-size:13px}.trTableWrap th{font-size:9px;letter-spacing:.12em;color:#7b7268}.trTableWrap td:first-child{display:grid;gap:3px}.trTableWrap td small{color:#777168}.trStatus{display:inline-block;border-radius:999px;padding:5px 9px;background:#ece8e1;font-size:10px;text-transform:uppercase;font-weight:850}.trStatus.available{background:#e5f1e9;color:#315b41}.trStatus.reserved{background:#fff1cf;color:#805d13}.trStatus.sold,.trStatus.unavailable{background:#eee;color:#666}.trRowActions{display:flex;gap:7px}.trRowActions button{border:1px solid #ddd5ca;background:#fff;border-radius:999px;padding:7px 10px;cursor:pointer}.trRowActions .danger{color:#9d3434}.trListHead p{margin:0;max-width:440px;text-align:right}@media(max-width:900px){.trAdmin{padding:18px 0 70px}.trAdminHead,.trFormTitle,.trListHead{display:block}.trHeadActions{margin-top:16px}.trSettings{grid-template-columns:1fr}.trSettingsFields,.trGrid3{grid-template-columns:1fr 1fr}.trListHead p{text-align:left}.trChecks{padding:6px 0}}@media(max-width:620px){.trPanel{border-radius:20px;padding:18px}.trSettingsFields,.trGrid3{grid-template-columns:1fr}.trAdminHead h1{font-size:42px}.trChecks{display:grid;gap:10px}}
      `}</style>
    </div>
  );
}
