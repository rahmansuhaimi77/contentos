import { BrandProfileSchema, slugify, type BrandProfile } from '../profile';
import kampusride from './kampusride.json';
import sewapro from './sewapro.json';

/**
 * Starter packs. These are seed DATA for brands that have not saved a profile yet; once a
 * brand saves its profile (Brand page → Brand profile), the stored copy wins.
 */
const PACKS: Record<string, BrandProfile> = Object.fromEntries(
  [kampusride, sewapro].map((pack) => {
    const parsed = BrandProfileSchema.parse(pack);
    return [parsed.slug, parsed];
  }),
);

export function starterPackFor(brandName: string): BrandProfile | null {
  return PACKS[slugify(brandName)] ?? null;
}

export function listStarterPacks() {
  return Object.values(PACKS).map((pack) => ({ slug: pack.slug, summary: pack.summary }));
}

export function starterPackBySlug(slug: string): BrandProfile | null {
  return PACKS[slug] ?? null;
}
