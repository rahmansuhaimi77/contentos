import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 120;

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';
const BUCKET = 'contentos-storyboards';

const InputSchema = z.object({ variantId: z.string().uuid() });

type ProductionPack = {
  strategy?: string;
  hook?: string;
  angle?: string;
  script?: string;
  caption?: string;
  cta?: string;
  creative_prompt?: string;
  storyboard?: Array<{
    scene: number;
    duration: string;
    visual: string;
    on_screen_text: string;
    voiceover: string;
    image_prompt: string;
  }>;
  qa_notes?: string[];
  generated_assets?: GeneratedAsset[];
  [key: string]: unknown;
};

type GeneratedAsset = {
  id: string;
  kind: 'static_poster';
  storage_path: string;
  created_at: string;
  provider: 'openai';
  model: string;
  size: string;
  quality: string;
};

type BrandAsset = {
  title: string;
  storage_path: string;
  mime_type: string | null;
};

async function getAuthenticatedClient(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

function isInstallRequest(value: string) {
  return /install|add to home screen|android|iphone|notification/i.test(value);
}

function chooseReferenceAssets(assets: BrandAsset[], request: string) {
  const install = isInstallRequest(request);
  const chosen: BrandAsset[] = [];

  if (install) {
    const appIcon = assets.find((asset) => /app icon/i.test(asset.title));
    if (appIcon) chosen.push(appIcon);
  }

  const primary = assets.find((asset) => /primary vertical.*light|primary.*light background/i.test(asset.title))
    || assets.find((asset) => /horizontal.*light/i.test(asset.title))
    || assets.find((asset) => !/monochrome/i.test(asset.title));
  if (primary && !chosen.some((asset) => asset.storage_path === primary.storage_path)) chosen.push(primary);

  return chosen.slice(0, 2);
}

function buildPosterPrompt(args: {
  brandName: string;
  platform: string;
  request: string;
  objective: string;
  pack: ProductionPack;
  variant: { hook: string; script: string; caption: string; cta: string; creative_prompt: string };
  visual: Record<string, string | null> | null;
  hasReferences: boolean;
}) {
  const { brandName, platform, request, objective, pack, variant, visual, hasReferences } = args;
  const scene = pack.storyboard?.[0];
  const referenceRule = hasReferences
    ? 'REFERENCE IMAGES ARE OFFICIAL BRAND ASSETS. Preserve the logo/app icon identity, proportions and colours faithfully. Do not redesign, stylise, recolour or replace the supplied brand marks.'
    : 'Do not invent or redraw a brand logo. If a logo is needed, leave a clean reserved brand area rather than fabricating one.';

  return `Create ONE finished, publish-ready STATIC SOCIAL MEDIA POSTER for ${brandName}.

OUTPUT
- One portrait poster only. No carousel, no storyboard, no video frame sequence.
- Canvas: 1024x1536 portrait. Keep critical text and branding comfortably inside a central social-media safe area.
- The poster must look like a final designed marketing asset, not a wireframe or prompt sheet.
- Optimise for mobile viewing: short copy, strong hierarchy, generous spacing and legible text.

CAMPAIGN
Platform: ${platform}
Objective: ${objective}
User request — FOLLOW THIS TOPIC EXACTLY: ${request}
Hook/source headline: ${variant.hook || pack.hook || scene?.on_screen_text || ''}
Supporting copy/source script: ${variant.script || pack.script || ''}
CTA: ${variant.cta || pack.cta || ''}
Creative direction: ${variant.creative_prompt || pack.creative_prompt || scene?.image_prompt || ''}

BRAND SYSTEM
Brand: ${brandName}
Primary colour: ${visual?.primary_color || 'use the approved reference'}
Secondary colour: ${visual?.secondary_color || 'use the approved reference'}
Accent colour: ${visual?.accent_color || 'use the approved reference'}
Typography guidance: ${visual?.font_notes || 'clean, highly legible brand-appropriate typography'}
Visual style: ${visual?.visual_style || 'clean, modern, trustworthy, mobile-first'}
Image rules: ${visual?.image_rules || 'use verified brand cues only'}
${referenceRule}

CONTENT RULES
- Do not change the requested campaign into a generic brand introduction.
- Do not add fake testimonials, ratings, prices, statistics, endorsements, availability claims, safety guarantees or regulatory claims.
- Do not invent app screens. If the request requires app UI and no real screenshot is supplied, use simple device/browser cues instead of fake detailed UI.
- Keep written copy concise. Do not paste the whole campaign brief into the poster.
- Spell the brand name exactly: ${brandName}.
- Produce only the final poster image.`;
}

async function callOpenAIImage(args: {
  prompt: string;
  references: Array<{ bytes: ArrayBuffer; filename: string; mimeType: string }>;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI image generation is not connected. Add OPENAI_API_KEY in the deployment environment.');

  const configuredModel = process.env.OPENAI_IMAGE_MODEL?.trim();
  const models = configuredModel ? [configuredModel] : ['gpt-image-2', 'gpt-image-1'];
  const quality = process.env.OPENAI_IMAGE_QUALITY?.trim() || 'low';
  const size = '1024x1536';
  let lastError = 'Image generation failed.';

  for (const model of models) {
    try {
      let response: Response;
      if (args.references.length) {
        const form = new FormData();
        form.set('model', model);
        form.set('prompt', args.prompt);
        form.set('size', size);
        form.set('quality', quality);
        form.set('output_format', 'png');
        for (const reference of args.references) {
          form.append('image[]', new Blob([reference.bytes], { type: reference.mimeType }), reference.filename);
        }
        response = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        });
      } else {
        response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt: args.prompt, size, quality, output_format: 'png' }),
        });
      }

      const payload = await response.json();
      if (!response.ok) {
        lastError = payload?.error?.message || `OpenAI image generation failed (${response.status}).`;
        if (!configuredModel && /model|not found|access|does not exist/i.test(lastError)) continue;
        throw new Error(lastError);
      }

      const encoded = payload?.data?.[0]?.b64_json;
      if (!encoded) throw new Error('OpenAI returned no image data.');
      return { bytes: Buffer.from(encoded, 'base64'), model, quality, size };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Image generation failed.';
      if (configuredModel) throw error;
    }
  }

  throw new Error(lastError);
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedClient(req);
    if (!auth) return Response.json({ error: 'Please sign in before generating visuals.' }, { status: 401 });

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Invalid visual request.' }, { status: 400 });

    const { supabase } = auth;
    const { data: variantRow, error: variantError } = await supabase
      .from('contentos_content_variants')
      .select('id,campaign_id,hook,script,caption,cta,creative_prompt,production_pack')
      .eq('id', parsed.data.variantId)
      .single();
    if (variantError || !variantRow) return Response.json({ error: variantError?.message || 'Content item not found.' }, { status: 404 });

    const { data: campaignRow, error: campaignError } = await supabase
      .from('contentos_campaigns')
      .select('brand_id,platform,format,objective,brief')
      .eq('id', variantRow.campaign_id)
      .single();
    if (campaignError || !campaignRow) return Response.json({ error: campaignError?.message || 'Campaign not found.' }, { status: 404 });

    const brief = (campaignRow.brief || {}) as Record<string, unknown>;
    const contentType = String(brief.content_type || '').toLowerCase();
    const isStatic = contentType === 'poster' || /static/i.test(campaignRow.format || '');
    if (!isStatic) return Response.json({ error: 'One-click generation is enabled for static posters first. Use the video handoff for video content.' }, { status: 400 });

    const pack = (variantRow.production_pack || {}) as ProductionPack;
    const requestText = String(brief.assistant_request || brief.extra || variantRow.hook || '');

    const [{ data: brandRow }, { data: visualRow }, { data: assetRows }] = await Promise.all([
      supabase.from('contentos_brands').select('name').eq('id', campaignRow.brand_id).single(),
      supabase.from('contentos_brand_visuals').select('primary_color,secondary_color,accent_color,font_notes,visual_style,image_rules').eq('brand_id', campaignRow.brand_id).maybeSingle(),
      supabase.from('contentos_brand_assets').select('title,storage_path,mime_type').eq('brand_id', campaignRow.brand_id).eq('kind', 'logo').order('created_at', { ascending: false }),
    ]);

    const brandName = brandRow?.name || 'Brand';
    const references = chooseReferenceAssets((assetRows || []) as BrandAsset[], requestText);
    const downloaded: Array<{ bytes: ArrayBuffer; filename: string; mimeType: string }> = [];
    for (const asset of references) {
      const { data, error } = await supabase.storage.from('contentos-assets').download(asset.storage_path);
      if (error || !data) continue;
      downloaded.push({
        bytes: await data.arrayBuffer(),
        filename: asset.storage_path.split('/').pop() || 'brand-reference.png',
        mimeType: asset.mime_type || data.type || 'image/png',
      });
    }

    const prompt = buildPosterPrompt({
      brandName,
      platform: campaignRow.platform,
      request: requestText,
      objective: campaignRow.objective,
      pack,
      variant: {
        hook: variantRow.hook,
        script: variantRow.script,
        caption: variantRow.caption,
        cta: variantRow.cta,
        creative_prompt: variantRow.creative_prompt,
      },
      visual: (visualRow as Record<string, string | null> | null) ?? null,
      hasReferences: downloaded.length > 0,
    });

    const generated = await callOpenAIImage({ prompt, references: downloaded });
    const assetId = crypto.randomUUID();
    const storagePath = `${campaignRow.brand_id}/${variantRow.id}/generated/${assetId}.png`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, generated.bytes, {
      contentType: 'image/png',
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) throw new Error(`Visual created, but saving failed: ${uploadError.message}`);

    const asset: GeneratedAsset = {
      id: assetId,
      kind: 'static_poster',
      storage_path: storagePath,
      created_at: new Date().toISOString(),
      provider: 'openai',
      model: generated.model,
      size: generated.size,
      quality: generated.quality,
    };
    const nextPack: ProductionPack = {
      ...pack,
      generated_assets: [asset, ...(pack.generated_assets || [])].slice(0, 10),
    };

    const { error: updateError } = await supabase
      .from('contentos_content_variants')
      .update({ production_pack: nextPack, updated_at: new Date().toISOString() })
      .eq('id', variantRow.id);
    if (updateError) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      throw new Error(`Visual created, but linking it to the content failed: ${updateError.message}`);
    }

    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
    return Response.json({
      asset,
      signedUrl: signed?.signedUrl || null,
      pack: nextPack,
      message: 'Static poster generated and saved to ContentOS.',
    });
  } catch (error) {
    console.error('generate-visual', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to generate visual.' }, { status: 500 });
  }
}
