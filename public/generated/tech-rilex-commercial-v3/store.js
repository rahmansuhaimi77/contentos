import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';
const BRAND_ID = '6ec53e94-fabc-4a99-9799-5e7d9bff9c80';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

const grid = document.getElementById('catalog-grid');
const countEl = document.getElementById('catalog-count');
const stateEl = document.getElementById('catalog-state');
const searchInput = document.getElementById('catalog-search');
const brandFilter = document.getElementById('catalog-brand');
const conditionFilter = document.getElementById('catalog-condition');
const priceFilter = document.getElementById('catalog-price');
const clearButton = document.getElementById('catalog-clear');
const dialog = document.getElementById('product-dialog');
const panel = document.getElementById('product-panel');
const closeButton = document.getElementById('product-close');
let products = [];
let settings = null;
let previousFocus = null;

const money = (value) => value == null ? 'Ask for current price' : new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(Number(value));
const text = (value) => value == null || value === '' ? 'Not specified' : String(value);
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
const safeImage = (value) => { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const statusLabel = (status) => ({ available: 'Available', reserved: 'Reserved', sold: 'Sold', unavailable: 'Unavailable' }[status] || status);

function track(eventType, productId = null) {
  const source = `${location.pathname}${location.search}`.slice(0, 180);
  supabase.from('tech_rilex_events').insert({ brand_id: BRAND_ID, product_id: productId, event_type: eventType, source_path: source }).then(() => {}).catch(() => {});
}

function mediaMarkup(product, large = false) {
  const image = safeImage(product.image_urls?.[0]);
  if (image) return `<img src="${esc(image)}" alt="${esc(`${product.brand} ${product.model}`)}" loading="lazy">`;
  return `<div class="phonePlaceholder${large ? ' large' : ''}" aria-hidden="true"></div>`;
}

function cardMarkup(product) {
  const specs = [product.storage, product.colour, product.condition_label, product.battery_health != null ? `${product.battery_health}% battery` : null].filter(Boolean);
  const disabled = ['sold', 'unavailable'].includes(product.stock_status);
  return `<article class="phoneCard" data-product-id="${esc(product.id)}">
    <div class="phoneMedia">
      <span class="stockPill ${esc(product.stock_status)}">${esc(statusLabel(product.stock_status))}</span>
      ${product.featured ? '<span class="featuredPill">FEATURED</span>' : ''}
      ${mediaMarkup(product)}
    </div>
    <div class="phoneBody">
      <span class="phoneBrand">${esc(product.brand)}</span>
      <h3>${esc(product.model)}</h3>
      <div class="phoneSpecs">${specs.slice(0,4).map((item) => `<span>${esc(item)}</span>`).join('')}</div>
      <div class="phonePrice">${esc(money(product.price))}${product.price == null ? '' : ' <small>current listed price</small>'}</div>
      <div class="phoneActions">
        <button type="button" data-view-product="${esc(product.id)}">View details</button>
        <button type="button" class="secondary" data-enquire-product="${esc(product.id)}" ${disabled ? 'disabled' : ''}>${disabled ? esc(statusLabel(product.stock_status)) : 'WhatsApp'}</button>
      </div>
    </div>
  </article>`;
}

function filteredProducts() {
  const query = (searchInput?.value || '').trim().toLowerCase();
  const brand = brandFilter?.value || '';
  const condition = conditionFilter?.value || '';
  const maxPrice = Number(priceFilter?.value || 0);
  return products.filter((product) => {
    const haystack = [product.brand, product.model, product.storage, product.colour, product.condition_label].filter(Boolean).join(' ').toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (brand && product.brand !== brand) return false;
    if (condition && product.condition_label !== condition) return false;
    if (maxPrice && product.price != null && Number(product.price) > maxPrice) return false;
    return true;
  });
}

function renderCatalog() {
  if (!grid || !stateEl) return;
  const visible = filteredProducts();
  grid.innerHTML = visible.map(cardMarkup).join('');
  if (countEl) countEl.textContent = `${visible.length} ${visible.length === 1 ? 'phone' : 'phones'}`;
  stateEl.hidden = visible.length > 0;
  if (!products.length) {
    stateEl.innerHTML = '<h3>Fresh stock is being added.</h3><p>Tell Tech Rilex the phone you want and we can check the current options directly.</p><button type="button" data-enquire>Request a phone</button>';
  } else if (!visible.length) {
    stateEl.innerHTML = '<h3>No exact match.</h3><p>Clear the filters or send Tech Rilex the model you are looking for.</p><button type="button" id="empty-clear">Clear filters</button>';
    document.getElementById('empty-clear')?.addEventListener('click', clearFilters);
  }
  bindCatalogActions();
}

function populateFilters() {
  const brands = [...new Set(products.map((item) => item.brand).filter(Boolean))].sort();
  const conditions = [...new Set(products.map((item) => item.condition_label).filter(Boolean))].sort();
  if (brandFilter) brandFilter.innerHTML = '<option value="">All brands</option>' + brands.map((item) => `<option>${esc(item)}</option>`).join('');
  if (conditionFilter) conditionFilter.innerHTML = '<option value="">All conditions</option>' + conditions.map((item) => `<option>${esc(item)}</option>`).join('');
}

function clearFilters() {
  if (searchInput) searchInput.value = '';
  if (brandFilter) brandFilter.value = '';
  if (conditionFilter) conditionFilter.value = '';
  if (priceFilter) priceFilter.value = '';
  renderCatalog();
}

function buildProductMessage(product) {
  const parts = [product.storage, product.colour, product.condition_label].filter(Boolean).join(' / ');
  let message = `Hi Tech Rilex, I'm interested in ${product.brand} ${product.model}`;
  if (parts) message += ` (${parts})`;
  if (product.price != null) message += ` listed at ${money(product.price)}`;
  message += '. Can you confirm the current availability and unit details?';
  return message;
}

function openWhatsApp(product) {
  const number = String(settings?.whatsapp_number || document.body.dataset.whatsappNumber || '').replace(/\D/g, '');
  if (!number) return;
  track('whatsapp_click', product.id);
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(buildProductMessage(product))}`, '_blank', 'noopener,noreferrer');
}

function detailRows(product) {
  return [
    ['Storage', product.storage],
    ['Colour', product.colour],
    ['Condition', product.condition_label],
    ['Battery health', product.battery_health == null ? null : `${product.battery_health}%`],
    ['Warranty', product.warranty],
    ['Accessories', product.accessories],
    ['Status', statusLabel(product.stock_status)],
  ].map(([label, value]) => `<div class="detailRow"><span>${esc(label)}</span><span>${esc(text(value))}</span></div>`).join('');
}

function openProduct(product, updateUrl = true) {
  if (!dialog || !panel) return;
  previousFocus = document.activeElement;
  const unavailable = ['sold', 'unavailable'].includes(product.stock_status);
  panel.innerHTML = `<button class="productClose" id="product-close-inner" aria-label="Close product">×</button>
    <div class="productLayout">
      <div class="productHeroMedia">${mediaMarkup(product, true)}</div>
      <div class="productInfo">
        <p class="eyebrow">${esc(product.brand)} / ${esc(statusLabel(product.stock_status))}</p>
        <h2>${esc(product.model)}</h2>
        <div class="detailPrice">${esc(money(product.price))}</div>
        <div class="detailList">${detailRows(product)}</div>
        ${product.description ? `<p class="productDescription">${esc(product.description)}</p>` : ''}
        <button class="detailCta" id="product-whatsapp" ${unavailable ? 'disabled' : ''}>${unavailable ? esc(statusLabel(product.stock_status)) : 'Ask about this phone on WhatsApp ↗'}</button>
        <a class="detailLink" href="/tech-rilex/${encodeURIComponent(product.slug)}">Permanent link to this phone</a>
      </div>
    </div>`;
  dialog.hidden = false;
  document.body.style.overflow = 'hidden';
  track('product_view', product.id);
  document.getElementById('product-close-inner')?.addEventListener('click', closeProduct);
  document.getElementById('product-whatsapp')?.addEventListener('click', () => openWhatsApp(product));
  if (updateUrl) {
    const next = location.pathname.startsWith('/tech-rilex') ? `/tech-rilex/${encodeURIComponent(product.slug)}` : `${location.pathname}?phone=${encodeURIComponent(product.slug)}`;
    history.pushState({ product: product.slug }, '', next);
  }
}

function closeProduct() {
  if (!dialog) return;
  dialog.hidden = true;
  document.body.style.overflow = '';
  if (location.pathname.startsWith('/tech-rilex/')) history.pushState({}, '', '/tech-rilex');
  else if (new URLSearchParams(location.search).has('phone')) history.pushState({}, '', location.pathname);
  previousFocus?.focus?.();
}

function bindCatalogActions() {
  document.querySelectorAll('[data-view-product]').forEach((button) => button.addEventListener('click', () => {
    const product = products.find((item) => item.id === button.dataset.viewProduct);
    if (product) openProduct(product);
  }));
  document.querySelectorAll('[data-enquire-product]').forEach((button) => button.addEventListener('click', () => {
    const product = products.find((item) => item.id === button.dataset.enquireProduct);
    if (product) openWhatsApp(product);
  }));
  document.querySelectorAll('#catalog-state [data-enquire]').forEach((button) => button.addEventListener('click', () => document.querySelector('[data-enquire]')?.click()));
}

function initialSlug() {
  const query = new URLSearchParams(location.search).get('phone');
  if (query) return query;
  const parts = location.pathname.split('/').filter(Boolean);
  return parts[0] === 'tech-rilex' && parts[1] ? decodeURIComponent(parts[1]) : '';
}

async function loadStore() {
  if (stateEl) stateEl.innerHTML = '<h3>Loading current phones…</h3><p>Checking the live Tech Rilex catalogue.</p>';
  const [{ data: settingsData }, { data: productData, error }] = await Promise.all([
    supabase.from('tech_rilex_settings').select('whatsapp_number,whatsapp_display,store_name,currency').eq('brand_id', BRAND_ID).maybeSingle(),
    supabase.from('tech_rilex_products').select('*').eq('brand_id', BRAND_ID).eq('is_published', true).order('featured', { ascending: false }).order('sort_order').order('created_at', { ascending: false }),
  ]);
  settings = settingsData || null;
  if (settings?.whatsapp_number) document.body.dataset.whatsappNumber = settings.whatsapp_number;
  const display = document.getElementById('store-whatsapp-display');
  if (display && settings?.whatsapp_display) display.textContent = settings.whatsapp_display;
  if (error) {
    if (stateEl) stateEl.innerHTML = '<h3>Catalogue unavailable right now.</h3><p>You can still contact Tech Rilex on WhatsApp.</p>';
    return;
  }
  products = productData || [];
  populateFilters();
  renderCatalog();
  track('catalog_view');
  const slug = initialSlug();
  if (slug) {
    const product = products.find((item) => item.slug === slug);
    if (product) openProduct(product, false);
  }
}

[searchInput, brandFilter, conditionFilter, priceFilter].forEach((el) => el?.addEventListener('input', renderCatalog));
clearButton?.addEventListener('click', clearFilters);
closeButton?.addEventListener('click', closeProduct);
dialog?.addEventListener('click', (event) => { if (event.target === dialog) closeProduct(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && dialog && !dialog.hidden) closeProduct(); });
window.addEventListener('popstate', () => { if (dialog && !dialog.hidden) dialog.hidden = true; });
document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('[data-enquire]') : null;
  if (target) track('generic_enquiry_open');
}, true);

loadStore();
