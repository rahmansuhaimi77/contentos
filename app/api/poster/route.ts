import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { ImageResponse } from 'next/og';
import { z } from 'zod';
import { buildPosterData, latestBackground, loadPosterContext, POSTER_BUCKET } from '@/lib/poster/data';
import { renderTemplate, SIZES, type PosterTemplate } from '@/lib/poster/templates';
import { posterFonts } from '@/lib/poster/fonts';

export const runtime = 'nodejs';
export const maxDuration = 60;

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

const InputSchema = z.object({
  variantId: z.string().uuid(),
  template: z.enum(['auto', 'photo', 'bold', 'scene']).default('auto'),
  size: z.enum(['feed', 'story']).default('feed'),
  save: z.boolean().default(true),
});

async function getAuthenticatedClient(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } },
  ) as any;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return supabase;
}

/**
 * Renders a poster for a content item with exact brand text, the real logo and a real
 * product photo (or the latest AI background scene). Free: no image model is called here.
 * save=true stores the PNG and adds it to the item's generated assets; save=false streams it.
 */
export async function POST(req: Request) {
  try {
    const supabase = await getAuthenticatedClient(req);
    if (!supabase) return Response.json({ error: 'Please sign in first.' }, { status: 401 });
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Invalid poster request.' }, { status: 400 });
    const { variantId, size, save } = parsed.data;

    const loaded = await loadPosterContext(supabase, variantId);
    if (!loaded) return Response.json({ error: 'Content item not found.' }, { status: 404 });

    const background = latestBackground(loaded.variant.production_pack);
    let template = parsed.data.template as PosterTemplate | 'auto';
    if (template === 'scene' && !background) return Response.json({ error: 'No AI background yet. Generate an AI scene first.' }, { status: 409 });
    if (template === 'auto') template = background ? 'scene' : 'photo';

    const { data, photoTitle } = await buildPosterData(supabase, loaded, {
      backgroundPath: template === 'scene' ? background?.storage_path : null,
      withPhoto: template === 'photo',
    });
    if (!data.headline) return Response.json({ error: 'This item has no headline yet.' }, { status: 400 });
    const used: PosterTemplate = template === 'photo' && !data.photo ? 'bold' : template;

    const { width, height } = SIZES[size];
    const image = new ImageResponse(renderTemplate(used, data, size), { width, height, fonts: await posterFonts() });
    const png = Buffer.from(await image.arrayBuffer());

    if (!save) return new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });

    const id = crypto.randomUUID();
    const brandId = loaded.campaign.brand_id;
    const storagePath = `${brandId}/${variantId}/posters/${id}.png`;
    const { error: uploadError } = await supabase.storage.from(POSTER_BUCKET).upload(storagePath, png, { contentType: 'image/png', upsert: false });
    if (uploadError) throw new Error(`Poster rendered but saving failed: ${uploadError.message}`);

    const asset = {
      id,
      kind: 'template_poster',
      template: used,
      storage_path: storagePath,
      created_at: new Date().toISOString(),
      provider: 'contentos',
      model: `template · ${used}${photoTitle ? ` · ${photoTitle}` : ''}`,
      size: `${width}x${height}`,
      quality: 'exact text',
    };
    const pack = loaded.variant.production_pack || {};
    const nextPack = { ...pack, generated_assets: [asset, ...((pack as any).generated_assets || [])].slice(0, 20) };
    const { error: updateError } = await supabase.from('contentos_content_variants').update({ production_pack: nextPack, updated_at: new Date().toISOString() }).eq('id', variantId);
    if (updateError) {
      await supabase.storage.from(POSTER_BUCKET).remove([storagePath]);
      throw new Error(`Poster rendered but linking it failed: ${updateError.message}`);
    }
    const { data: signed } = await supabase.storage.from(POSTER_BUCKET).createSignedUrl(storagePath, 3600);
    return Response.json({ asset, signedUrl: signed?.signedUrl ?? null, pack: nextPack, template: used, photo: photoTitle });
  } catch (error) {
    console.error('[poster]', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Poster failed.' }, { status: 500 });
  }
}
