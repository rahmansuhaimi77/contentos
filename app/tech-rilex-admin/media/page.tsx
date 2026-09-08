'use client';

import Link from 'next/link';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type Brand = { id: string; workspace_id: string; name: string };
type Product = { id: string; brand: string; model: string; storage: string | null; colour: string | null; image_urls: string[]; is_published: boolean };

type Uploaded = { path: string; url: string; name: string };

const SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const BUCKET = 'contentos-assets';
const ALLOWED = new Set(['image/jpeg','image/png','image/webp']);

function safeFileName(name: string) {
  const parts = name.toLowerCase().split('.');
  const ext = parts.length > 1 ? parts.pop()!.replace(/[^a-z0-9]/g, '') : 'jpg';
  const base = parts.join('.').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 44) || 'phone';
  return `${base}.${ext}`;
}

export default function TechRilexMediaPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [uploaded, setUploaded] = useState<Uploaded[]>([]);
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
    const { data: productData, error: productError } = await supabase.from('tech_rilex_products').select('id,brand,model,storage,colour,image_urls,is_published').eq('brand_id', nextBrand.id).order('created_at', { ascending: false });
    if (productError) setMessage(productError.message);
    setProducts((productData || []) as Product[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (!files.length || !brand) return;
    const invalid = files.find((file) => !ALLOWED.has(file.type) || file.size > 5 * 1024 * 1024);
    if (invalid) { setMessage(`${invalid.name}: use JPG, PNG or WebP up to 5MB.`); return; }

    setBusy(true); setMessage('');
    const newItems: Uploaded[] = [];
    for (const file of files) {
      const safe = safeFileName(file.name);
      const path = `${brand.id}/tech-rilex/${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safe}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type, cacheControl: '3600' });
      if (error) { setMessage(`Upload failed for ${file.name}: ${error.message}`); continue; }
      const url = `${SUPABASE_URL}/functions/v1/tech-rilex-image?path=${encodeURIComponent(path)}`;
      newItems.push({ path, url, name: file.name });
    }

    if (newItems.length && productId) {
      const product = products.find((item) => item.id === productId);
      if (product) {
        const nextUrls = [...(product.image_urls || []), ...newItems.map((item) => item.url)];
        const { error } = await supabase.from('tech_rilex_products').update({ image_urls: nextUrls, updated_at: new Date().toISOString() }).eq('id', product.id);
        if (error) setMessage(`Images uploaded, but product attachment failed: ${error.message}`);
        else setMessage(`${newItems.length} image${newItems.length === 1 ? '' : 's'} uploaded and attached to ${product.brand} ${product.model}.`);
      }
    } else if (newItems.length) {
      setMessage(`${newItems.length} image${newItems.length === 1 ? '' : 's'} uploaded. Copy the URL below or choose a product before the next upload to attach automatically.`);
    }

    setUploaded((current) => [...newItems, ...current]);
    setBusy(false);
    await load();
  }

  async function detach(product: Product, url: string) {
    const next = (product.image_urls || []).filter((item) => item !== url);
    const { error } = await supabase.from('tech_rilex_products').update({ image_urls: next, updated_at: new Date().toISOString() }).eq('id', product.id);
    setMessage(error ? error.message : 'Image detached from product. The private file is retained to avoid accidental deletion of shared media.');
    if (!error) await load();
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setMessage('Image URL copied.'); }
    catch { setMessage('Could not access the clipboard in this browser.'); }
  }

  if (loading) return <div style={{ padding: 32 }}>Loading Tech Rilex media…</div>;
  if (authRequired) return <div style={{ padding: 32 }}><h1>Tech Rilex Media</h1><p>Sign in first.</p><Link href="/login">Sign in</Link></div>;

  return <div className="mediaPage">
    <header className="mediaHead"><div><span>TECH RILEX / MEDIA</span><h1>Product images</h1><p>Upload directly into the existing private ContentOS asset bucket. Public access is allowed only after the image URL is attached to a published Tech Rilex product.</p></div><div className="links"><Link href="/tech-rilex-admin">Inventory</Link><Link href="/tech-rilex-admin/tools">Store Ops</Link></div></header>
    {message && <div className="notice">{message}</div>}

    <section className="panel uploadPanel"><div><span>UPLOAD</span><h2>Add phone photos</h2><p>JPG, PNG or WebP. Maximum 5MB per image. Choose a product to attach uploads automatically.</p></div><div className="uploadControls"><label>Attach to product<select value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Upload only — do not attach yet</option>{products.map((product) => <option key={product.id} value={product.id}>{product.brand} {product.model}{product.storage ? ` · ${product.storage}` : ''}</option>)}</select></label><label className={busy ? 'uploadButton disabled' : 'uploadButton'}>{busy ? 'Uploading…' : 'Choose images'}<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleUpload} disabled={busy} /></label></div></section>

    {uploaded.length > 0 && <section className="panel"><div className="sectionHead"><div><span>RECENT UPLOADS</span><h2>This session</h2></div></div><div className="recent">{uploaded.map((item) => <div key={item.path}><div className="preview pending"><small>PRIVATE UNTIL PUBLISHED</small></div><span><strong>{item.name}</strong><small>{item.path}</small></span><button onClick={() => copy(item.url)}>Copy URL</button></div>)}</div></section>}

    <section className="panel"><div className="sectionHead"><div><span>PRODUCT MEDIA</span><h2>{products.length} inventory items</h2></div><p>Images attached to drafts remain inaccessible through the public image endpoint. Publishing the product activates only its attached image URLs.</p></div>{products.length === 0 ? <div className="empty">Add a real inventory item first, then return here to attach photos.</div> : <div className="productList">{products.map((product) => <article key={product.id}><div className="productTitle"><div><strong>{product.brand} {product.model}</strong><small>{[product.storage, product.colour].filter(Boolean).join(' · ') || 'Unit details'} · {product.is_published ? 'Published' : 'Draft'}</small></div><span>{product.image_urls?.length || 0} image{product.image_urls?.length === 1 ? '' : 's'}</span></div>{product.image_urls?.length ? <div className="imageGrid">{product.image_urls.map((url) => <div key={url} className="imageItem"><img src={url} alt={`${product.brand} ${product.model}`} /><div><button onClick={() => copy(url)}>Copy URL</button><button className="danger" onClick={() => detach(product, url)}>Detach</button></div></div>)}</div> : <div className="noImages">No images attached yet.</div>}</article>)}</div>}</section>

    <style jsx>{`
      .mediaPage{max-width:1120px;margin:0 auto;padding:28px 0 80px;color:#201f1b}.mediaHead{display:flex;justify-content:space-between;align-items:end;gap:28px;margin-bottom:22px}.mediaHead>div:first-child>span,.panel span{font-size:10px;letter-spacing:.16em;font-weight:900;color:#9a7448}.mediaHead h1{font-size:clamp(38px,5vw,64px);line-height:.95;letter-spacing:-.055em;margin:8px 0 12px}.mediaHead p,.panel p,.sectionHead p{color:#6d6a63;max-width:690px}.links{display:flex;gap:10px;flex-wrap:wrap}.links a{border:1px solid #ddd5ca;background:#fff;color:#1d1c18;border-radius:999px;padding:11px 15px;text-decoration:none;font-weight:800}.panel{background:#fff;border:1px solid #ded8cf;border-radius:26px;padding:24px;margin-bottom:20px;box-shadow:0 12px 38px rgba(61,50,38,.05)}.panel h2{font-size:28px;letter-spacing:-.035em;margin:6px 0}.notice{background:#fff8df;border:1px solid #ead89e;border-radius:16px;padding:13px 16px;margin-bottom:18px}.uploadPanel{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:end}.uploadControls{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:end}.uploadControls label:first-child{display:grid;gap:7px;font-size:11px;font-weight:850;color:#625d55}.uploadControls select{width:100%;border:1px solid #d9d2c8;background:#faf8f4;border-radius:13px;padding:11px 12px;font:inherit}.uploadButton{background:#1c2d28;color:#fff;border-radius:999px;padding:12px 17px;font-weight:850;cursor:pointer;text-align:center}.uploadButton input{display:none}.uploadButton.disabled{opacity:.55;pointer-events:none}.sectionHead{display:flex;justify-content:space-between;align-items:start;gap:28px}.sectionHead p{max-width:480px;text-align:right;margin:0}.recent,.productList{display:grid;gap:12px}.recent>div{display:grid;grid-template-columns:100px 1fr auto;gap:14px;align-items:center;border-top:1px solid #eee9e2;padding-top:12px}.recent span{display:grid;gap:3px}.recent small,.productTitle small{color:#777168;word-break:break-all}.recent button,.imageItem button{border:1px solid #ddd5ca;background:#fff;border-radius:999px;padding:8px 11px;cursor:pointer}.preview{height:72px;border-radius:14px;background:#f3efe8;display:grid;place-items:center}.preview small{font-size:8px;color:#8a7761}.productList article{border-top:1px solid #eee9e2;padding-top:16px}.productTitle{display:flex;justify-content:space-between;gap:18px;align-items:start}.productTitle>div{display:grid;gap:4px}.productTitle>span{font-size:11px;color:#7c7368}.imageGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}.imageItem{border:1px solid #e1dbd2;border-radius:16px;overflow:hidden;background:#faf8f4}.imageItem img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;background:#eee}.imageItem>div{display:flex;gap:6px;padding:9px}.imageItem button{font-size:11px}.imageItem .danger{color:#9d3434}.noImages,.empty{padding:24px;border:1px dashed #d2c7b8;border-radius:16px;color:#777168;text-align:center;margin-top:12px}@media(max-width:850px){.mediaHead,.uploadPanel,.sectionHead{display:block}.links{margin-top:16px}.uploadControls{margin-top:18px}.sectionHead p{text-align:left}.imageGrid{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.mediaPage{padding:18px 0 70px}.panel{padding:18px;border-radius:20px}.uploadControls{grid-template-columns:1fr}.imageGrid{grid-template-columns:1fr 1fr}.recent>div{grid-template-columns:70px 1fr}.recent button{grid-column:2}.mediaHead h1{font-size:42px}}
    `}</style>
  </div>;
}
