import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const BUCKET = 'contentos-storyboards';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

async function requireUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('AUTH_REQUIRED');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error('AUTH_REQUIRED');
  return data.user;
}

async function brandAccess(userId: string, brandId: string) {
  const { data: brand, error } = await admin.from('contentos_brands').select('id,name,workspace_id').eq('id', brandId).single();
  if (error || !brand) throw new Error('BRAND_NOT_FOUND');
  const { data: member } = await admin.from('contentos_workspace_members').select('role').eq('workspace_id', brand.workspace_id).eq('user_id', userId).maybeSingle();
  if (!member) throw new Error('FORBIDDEN');
  return brand;
}

async function vaultRead(secretId: string) {
  const { data, error } = await admin.rpc('contentos_read_vault_secret', { p_secret_id: secretId });
  if (error || !data) throw new Error('SECRET_UNAVAILABLE');
  return data as string;
}

async function vaultStore(secret: string, name: string, description: string) {
  const { data, error } = await admin.rpc('contentos_store_vault_secret', { p_secret: secret, p_name: name, p_description: description });
  if (error || !data) throw new Error(error?.message || 'SECRET_STORE_FAILED');
  return data as string;
}

async function vaultDelete(secretId?: string | null) {
  if (!secretId) return;
  await admin.rpc('contentos_delete_vault_secret', { p_secret_id: secretId });
}

async function configureOpenAI(req: Request) {
  const user = await requireUser(req);
  const body = await req.json();
  const brandId = String(body.brand_id || '');
  const apiKey = String(body.api_key || '').trim();
  if (!brandId || !apiKey) return json({ error: 'Brand and OpenAI API key are required.' }, 400);
  await brandAccess(user.id, brandId);

  const verifyRes = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!verifyRes.ok) {
    let message = 'OpenAI rejected this API key.';
    try { const payload = await verifyRes.json(); message = payload?.error?.message || message; } catch { }
    return json({ error: message }, 400);
  }

  const { data: existing } = await admin.from('contentos_ai_provider_credentials').select('api_key_secret_id').eq('brand_id', brandId).eq('provider', 'openai').maybeSingle();
  const secretId = await vaultStore(apiKey, `contentos_openai_${brandId}_${crypto.randomUUID()}`, 'ContentOS OpenAI API key');
  const { error } = await admin.from('contentos_ai_provider_credentials').upsert({
    brand_id: brandId,
    provider: 'openai',
    api_key_secret_id: secretId,
    status: 'configured',
    connected_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'brand_id,provider' });
  if (error) { await vaultDelete(secretId); throw error; }
  await vaultDelete(existing?.api_key_secret_id);
  return json({ ok: true, provider: 'openai', configured: true });
}

async function providerStatus(req: Request) {
  const user = await requireUser(req);
  const url = new URL(req.url);
  const brandId = url.searchParams.get('brand_id') || '';
  if (!brandId) return json({ error: 'brand_id is required.' }, 400);
  await brandAccess(user.id, brandId);
  const { data } = await admin.from('contentos_ai_provider_credentials').select('provider,status').eq('brand_id', brandId);
  const configured = new Set((data || []).filter((row) => row.status === 'configured').map((row) => row.provider));
  return json({ providers: {
    openai: { configured: configured.has('openai'), capabilities: ['copy','static_image'] },
    claude: { configured: configured.has('claude'), capabilities: ['copy','creative_review','visual_planning'] },
    google: { configured: configured.has('google'), capabilities: ['video'] },
  }});
}

type Scene = { scene?: number; duration?: string; visual?: string; on_screen_text?: string; voiceover?: string; image_prompt?: string };
type GeneratedAsset = { id: string; kind: 'static_poster'; storage_path: string; created_at: string; provider: 'openai'; model: string; size: string; quality: string };
type Pack = { hook?: string; script?: string; cta?: string; creative_prompt?: string; storyboard?: Scene[]; generated_assets?: GeneratedAsset[]; [key: string]: unknown };
type BrandAsset = { title: string; storage_path: string; mime_type: string | null };

function chooseReferenceAssets(assets: BrandAsset[], request: string) {
  const install = /install|add to home screen|android|iphone|notification/i.test(request);
  const chosen: BrandAsset[] = [];
  if (install) {
    const icon = assets.find((asset) => /app icon/i.test(asset.title));
    if (icon) chosen.push(icon);
  }
  const logo = assets.find((asset) => /primary vertical.*light|primary.*light background/i.test(asset.title))
    || assets.find((asset) => /horizontal.*light/i.test(asset.title))
    || assets.find((asset) => !/monochrome/i.test(asset.title));
  if (logo && !chosen.some((item) => item.storage_path === logo.storage_path)) chosen.push(logo);
  return chosen.slice(0, 2);
}

function buildPrompt(args: { brandName: string; platform: string; objective: string; request: string; variant: any; pack: Pack; visual: any; hasReferences: boolean }) {
  const scene = args.pack.storyboard?.[0];
  return `Create ONE finished, publish-ready STATIC SOCIAL MEDIA POSTER for ${args.brandName}.

OUTPUT
- One portrait poster only. No carousel, storyboard, or video sequence.
- Canvas 1024x1536 portrait.
- Final designed marketing asset, not a wireframe or prompt sheet.
- Mobile-first: short copy, strong hierarchy, generous spacing, highly legible typography.

CAMPAIGN
Platform: ${args.platform}
Objective: ${args.objective}
USER REQUEST — FOLLOW EXACTLY: ${args.request}
Headline source: ${args.variant.hook || args.pack.hook || scene?.on_screen_text || ''}
Supporting source: ${args.variant.script || args.pack.script || ''}
CTA source: ${args.variant.cta || args.pack.cta || ''}
Creative direction: ${args.variant.creative_prompt || args.pack.creative_prompt || scene?.image_prompt || ''}

BRAND SYSTEM
Brand: ${args.brandName}
Primary colour: ${args.visual?.primary_color || 'use approved reference'}
Secondary colour: ${args.visual?.secondary_color || 'use approved reference'}
Accent colour: ${args.visual?.accent_color || 'use approved reference'}
Typography: ${args.visual?.font_notes || 'clean, modern, highly legible'}
Visual style: ${args.visual?.visual_style || 'clean, modern, trustworthy, mobile-first'}
Image rules: ${args.visual?.image_rules || 'verified brand cues only'}
${args.hasReferences ? 'The attached reference images are official brand assets. Preserve their identity and colours faithfully; do not redesign, recolour, distort or replace the brand marks.' : 'Do not invent or redraw a brand logo. Leave a clean brand area if no official mark is supplied.'}

RULES
- Do not turn the requested topic into a generic brand introduction.
- Do not add fake testimonials, ratings, prices, statistics, endorsements, availability, safety guarantees or regulatory claims.
- Do not invent app screens. Use simple browser/device cues if real UI is not supplied.
- Do not paste the full brief onto the poster.
- Spell the brand name exactly: ${args.brandName}.
- Produce only the final poster image.`;
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function callOpenAIImage(apiKey: string, prompt: string, references: Array<{ bytes: Uint8Array; filename: string; mimeType: string }>) {
  const model = 'gpt-image-1';
  const size = '1024x1536';
  const quality = 'medium';
  let response: Response;

  if (references.length) {
    const form = new FormData();
    form.set('model', model);
    form.set('prompt', prompt);
    form.set('size', size);
    form.set('quality', quality);
    form.set('output_format', 'png');
    for (const reference of references) {
      form.append('image[]', new Blob([reference.bytes], { type: reference.mimeType }), reference.filename);
    }
    response = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form });
  } else {
    response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, size, quality, output_format: 'png' }),
    });
  }

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI image generation failed (${response.status}).`);
  const encoded = payload?.data?.[0]?.b64_json;
  if (!encoded) throw new Error('OpenAI returned no image data.');
  return { bytes: decodeBase64(encoded), model, size, quality };
}

async function generateStatic(req: Request) {
  const user = await requireUser(req);
  const body = await req.json();
  const variantId = String(body.variant_id || body.variantId || '');
  if (!variantId) return json({ error: 'variant_id is required.' }, 400);

  const { data: variant, error: variantError } = await admin.from('contentos_content_variants')
    .select('id,campaign_id,hook,script,caption,cta,creative_prompt,production_pack').eq('id', variantId).single();
  if (variantError || !variant) return json({ error: 'Content item not found.' }, 404);

  const { data: campaign, error: campaignError } = await admin.from('contentos_campaigns')
    .select('brand_id,platform,format,objective,brief').eq('id', variant.campaign_id).single();
  if (campaignError || !campaign) return json({ error: 'Campaign not found.' }, 404);
  await brandAccess(user.id, campaign.brand_id);

  const brief = campaign.brief || {};
  const contentType = String(brief.content_type || '').toLowerCase();
  if (!(contentType === 'poster' || /static/i.test(campaign.format || ''))) return json({ error: 'One-click image generation is enabled for static posters first.' }, 400);

  const { data: credential } = await admin.from('contentos_ai_provider_credentials')
    .select('api_key_secret_id,status').eq('brand_id', campaign.brand_id).eq('provider', 'openai').maybeSingle();
  if (!credential || credential.status !== 'configured') return json({ error: 'OpenAI is not connected for this brand. Open Settings → AI & Channels and connect OpenAI once.' }, 409);
  const apiKey = await vaultRead(credential.api_key_secret_id);

  const requestText = String(brief.assistant_request || brief.extra || variant.hook || '');
  const [{ data: brand }, { data: visual }, { data: assets }] = await Promise.all([
    admin.from('contentos_brands').select('name').eq('id', campaign.brand_id).single(),
    admin.from('contentos_brand_visuals').select('primary_color,secondary_color,accent_color,font_notes,visual_style,image_rules').eq('brand_id', campaign.brand_id).maybeSingle(),
    admin.from('contentos_brand_assets').select('title,storage_path,mime_type').eq('brand_id', campaign.brand_id).eq('kind','logo').order('created_at', { ascending: false }),
  ]);

  const selected = chooseReferenceAssets((assets || []) as BrandAsset[], requestText);
  const references: Array<{ bytes: Uint8Array; filename: string; mimeType: string }> = [];
  for (const asset of selected) {
    const { data, error } = await admin.storage.from('contentos-assets').download(asset.storage_path);
    if (error || !data) continue;
    references.push({ bytes: new Uint8Array(await data.arrayBuffer()), filename: asset.storage_path.split('/').pop() || 'brand-reference.png', mimeType: asset.mime_type || data.type || 'image/png' });
  }

  const pack = (variant.production_pack || {}) as Pack;
  const prompt = buildPrompt({ brandName: brand?.name || 'Brand', platform: campaign.platform, objective: campaign.objective, request: requestText, variant, pack, visual, hasReferences: references.length > 0 });
  const generated = await callOpenAIImage(apiKey, prompt, references);
  const assetId = crypto.randomUUID();
  const storagePath = `${campaign.brand_id}/${variant.id}/generated/${assetId}.png`;
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, generated.bytes, { contentType: 'image/png', cacheControl: '3600', upsert: false });
  if (uploadError) throw new Error(`Visual created, but saving failed: ${uploadError.message}`);

  const asset: GeneratedAsset = { id: assetId, kind: 'static_poster', storage_path: storagePath, created_at: new Date().toISOString(), provider: 'openai', model: generated.model, size: generated.size, quality: generated.quality };
  const nextPack: Pack = { ...pack, generated_assets: [asset, ...(pack.generated_assets || [])].slice(0, 10) };
  const { error: updateError } = await admin.from('contentos_content_variants').update({ production_pack: nextPack, updated_at: new Date().toISOString() }).eq('id', variant.id);
  if (updateError) { await admin.storage.from(BUCKET).remove([storagePath]); throw new Error(`Visual created, but linking it failed: ${updateError.message}`); }

  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  return json({ asset, signedUrl: signed?.signedUrl || null, pack: nextPack, message: 'Static poster generated and saved to ContentOS.' });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const path = new URL(req.url).pathname;
  try {
    if (path.endsWith('/config/openai') && req.method === 'POST') return await configureOpenAI(req);
    if (path.endsWith('/status') && req.method === 'GET') return await providerStatus(req);
    if (path.endsWith('/generate-static') && req.method === 'POST') return await generateStatic(req);
    if (path.endsWith('/health')) return json({ ok: true });
    return json({ error: 'Route not found.' }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    const status = message === 'AUTH_REQUIRED' ? 401 : message === 'FORBIDDEN' ? 403 : message === 'BRAND_NOT_FOUND' ? 404 : 500;
    return json({ error: message }, status);
  }
});
