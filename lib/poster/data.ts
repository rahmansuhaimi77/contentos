import sharp from 'sharp';
import { loadBrandEngine } from '@/lib/engine/load';
import type { BrandProfile } from '@/lib/engine/profile';
import type { PosterData } from './templates';

export const POSTER_BUCKET = 'contentos-storyboards';
const ASSET_BUCKET = 'contentos-assets';

type Asset = { kind: string; title: string; storage_path: string; mime_type: string | null };
type GeneratedAsset = { id: string; kind: string; storage_path: string; created_at: string; [key: string]: unknown };

type Prep = 'logo' | 'photo' | 'background';

/**
 * Finds the logo inside an upload that may be a phone screenshot: ignores the top and
 * bottom 8% (status and navigation bars), takes the most common colour as background,
 * and crops to the box around pixels that differ from it, with a small margin.
 */
export async function cropToMark(input: Buffer) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const counts = new Map<number, number>();
  for (let i = 0; i < data.length; i += channels * 16) {
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const bgKey = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const bg = [((bgKey >> 8) & 15) * 16 + 8, ((bgKey >> 4) & 15) * 16 + 8, (bgKey & 15) * 16 + 8];
  const top0 = Math.floor(height * 0.08), bottom0 = Math.ceil(height * 0.92);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = top0; y < bottom0; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * channels;
      if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 60) {
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || (maxX - minX) * (maxY - minY) > width * height * 0.9) return input;
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04);
  const left = Math.max(0, minX - pad), top = Math.max(0, minY - pad);
  return sharp(input).extract({ left, top, width: Math.min(width - left, maxX - minX + pad * 2), height: Math.min(height - top, maxY - minY + pad * 2) }).toBuffer();
}

/**
 * Downloads an image and prepares it for the poster:
 * - logo: trims the empty margin around the mark (uploads are often phone screenshots
 *   with the logo floating in a tall blank canvas), then caps the height.
 * - photo: applies EXIF rotation and shrinks 12MP phone photos to 1200px.
 * - background: shrinks to poster width.
 * Falls back to the original bytes if processing fails.
 */
async function dataUrl(supabase: any, bucket: string, path: string, mime: string | null | undefined, prep: Prep) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return null;
  const original = Buffer.from(await data.arrayBuffer());
  try {
    let image = sharp(original, { failOn: 'none' }).rotate();
    if (prep === 'logo') image = sharp(await cropToMark(await image.toBuffer())).resize({ height: 360, withoutEnlargement: true });
    else if (prep === 'photo') image = image.resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true });
    else image = image.resize({ width: 1080, withoutEnlargement: true });
    const out = prep === 'logo' ? await image.png().toBuffer() : await image.jpeg({ quality: 84 }).toBuffer();
    return `data:${prep === 'logo' ? 'image/png' : 'image/jpeg'};base64,${out.toString('base64')}`;
  } catch {
    return `data:${mime || data.type || 'image/png'};base64,${original.toString('base64')}`;
  }
}

function firstSentence(text: string, max = 110) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  const sentence = clean.split(/(?<=[.!?])\s/)[0] || clean;
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
}

/** Supporting line: the first sentence of the post body after the hook. */
function supportLine(hook: string, script: string) {
  const body = (script || '').replace(hook, '').split('\n').map((l) => l.trim()).filter((l) => l && !/^(slide|scene)\s*\d/i.test(l));
  return body.length ? firstSentence(body[0]) : '';
}

/**
 * Picks a real product photo that honestly matches the post. When the post names a vehicle
 * type (e.g. MPV) and no photo of that type exists, returns null so the template shows no
 * car rather than a misleading one.
 */
export function choosePhoto(profile: BrandProfile, photos: Asset[], text: string, seed: string): Asset | null {
  if (!photos.length) return null;
  const lower = text.toLowerCase();
  const rule = profile.poster.photo_rules.find((r) => r.when.some((w) => lower.includes(w.toLowerCase())));
  if (rule) {
    return photos.find((p) => rule.photo_title_has.some((w) => p.title.toLowerCase().includes(w.toLowerCase()))) ?? null;
  }
  const named = photos.find((p) => lower.includes(p.title.toLowerCase()));
  if (named) return named;
  const hash = [...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return photos[hash % photos.length];
}

export async function loadPosterContext(supabase: any, variantId: string) {
  const { data: variant, error } = await supabase
    .from('contentos_content_variants')
    .select('id,campaign_id,hook,script,caption,cta,production_pack')
    .eq('id', variantId)
    .single();
  if (error || !variant) return null;
  const { data: campaign } = await supabase.from('contentos_campaigns').select('brand_id,platform,format,brief').eq('id', variant.campaign_id).single();
  if (!campaign) return null;
  const ctx = await loadBrandEngine(supabase, campaign.brand_id);
  if (!ctx) return null;

  const [{ data: visual }, { data: assets }] = await Promise.all([
    supabase.from('contentos_brand_visuals').select('primary_color,secondary_color,accent_color').eq('brand_id', campaign.brand_id).maybeSingle(),
    supabase.from('contentos_brand_assets').select('kind,title,storage_path,mime_type').eq('brand_id', campaign.brand_id).order('created_at', { ascending: true }),
  ]);
  return { variant, campaign, ctx, visual, assets: (assets ?? []) as Asset[] };
}

export async function buildPosterData(
  supabase: any,
  loaded: NonNullable<Awaited<ReturnType<typeof loadPosterContext>>>,
  opts: { backgroundPath?: string | null; withPhoto: boolean },
): Promise<{ data: PosterData; photoTitle: string | null }> {
  const { variant, ctx, visual, assets } = loaded;
  const pack = (variant.production_pack || {}) as { hook?: string; script?: string; cta?: string };
  const headline = (pack.hook || variant.hook || '').trim();
  const script = pack.script || variant.script || variant.caption || '';
  const logoAsset = assets.find((a) => a.kind === 'logo' && !/monochrome|dark background|icon|badge/i.test(a.title)) ?? assets.find((a) => a.kind === 'logo');
  const photos = assets.filter((a) => a.kind === 'vehicle' || a.kind === 'product' || a.kind === 'photo');
  const photo = opts.withPhoto ? choosePhoto(ctx.profile, photos, `${headline} ${script}`, variant.id) : null;

  const [logo, photoData, background] = await Promise.all([
    logoAsset ? dataUrl(supabase, ASSET_BUCKET, logoAsset.storage_path, logoAsset.mime_type, 'logo') : Promise.resolve(null),
    photo ? dataUrl(supabase, ASSET_BUCKET, photo.storage_path, photo.mime_type, 'photo') : Promise.resolve(null),
    opts.backgroundPath ? dataUrl(supabase, POSTER_BUCKET, opts.backgroundPath, 'image/png', 'background') : Promise.resolve(null),
  ]);

  return {
    photoTitle: photoData ? photo?.title ?? null : null,
    data: {
      brandName: ctx.brand.name,
      headline,
      support: supportLine(headline, script),
      cta: dedupeCta((pack.cta || variant.cta || '').trim(), ctx.profile.poster.contact),
      contact: ctx.profile.poster.contact,
      website: ctx.profile.poster.website,
      colors: {
        primary: visual?.primary_color || '#0C1130',
        secondary: visual?.secondary_color || '#83201A',
        light: '#F7F7F8',
      },
      logo,
      photo: photoData,
      background,
    },
  };
}

/** Drops the CTA line when it only repeats the contact number already printed above it. */
function dedupeCta(cta: string, contact: string) {
  const digits = (value: string) => value.replace(/\D/g, '');
  const contactDigits = digits(contact);
  if (contactDigits.length >= 7 && digits(cta).includes(contactDigits)) {
    const rest = cta.replace(/whatsapp|wa\.me\/?|\+?6?0[\d\s-]{8,}/gi, '').replace(/\s+/g, ' ').trim();
    return rest.length > 8 ? rest.charAt(0).toUpperCase() + rest.slice(1) : '';
  }
  return cta;
}

export function latestBackground(pack: { generated_assets?: GeneratedAsset[] } | null) {
  return (pack?.generated_assets || []).find((a) => a.kind === 'ai_background') ?? null;
}
