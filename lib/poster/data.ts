import { loadBrandEngine } from '@/lib/engine/load';
import type { BrandProfile } from '@/lib/engine/profile';
import type { PosterData } from './templates';

export const POSTER_BUCKET = 'contentos-storyboards';
const ASSET_BUCKET = 'contentos-assets';

type Asset = { kind: string; title: string; storage_path: string; mime_type: string | null };
type GeneratedAsset = { id: string; kind: string; storage_path: string; created_at: string; [key: string]: unknown };

async function dataUrl(supabase: any, bucket: string, path: string, mime?: string | null) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return null;
  const bytes = Buffer.from(await data.arrayBuffer());
  return `data:${mime || data.type || 'image/png'};base64,${bytes.toString('base64')}`;
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
    logoAsset ? dataUrl(supabase, ASSET_BUCKET, logoAsset.storage_path, logoAsset.mime_type) : Promise.resolve(null),
    photo ? dataUrl(supabase, ASSET_BUCKET, photo.storage_path, photo.mime_type) : Promise.resolve(null),
    opts.backgroundPath ? dataUrl(supabase, POSTER_BUCKET, opts.backgroundPath, 'image/png') : Promise.resolve(null),
  ]);

  return {
    photoTitle: photoData ? photo?.title ?? null : null,
    data: {
      brandName: ctx.brand.name,
      headline,
      support: supportLine(headline, script),
      cta: (pack.cta || variant.cta || '').trim(),
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

export function latestBackground(pack: { generated_assets?: GeneratedAsset[] } | null) {
  return (pack?.generated_assets || []).find((a) => a.kind === 'ai_background') ?? null;
}
