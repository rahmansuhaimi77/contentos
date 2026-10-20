-- 011 · Brand Profile
-- Every brand-specific rule ContentOS uses (voice, pillars, exemplar ideas, phases,
-- calendar, channels, claims, modes) lives in this column as data. The generators no longer
-- branch on a brand's name. Shape: lib/engine/profile.ts (BrandProfileSchema).
--
-- Safe to run more than once. Existing RLS on contentos_brands already covers the column.

alter table public.contentos_brands
  add column if not exists profile jsonb not null default '{}'::jsonb;

comment on column public.contentos_brands.profile is
  'ContentOS Brand Profile (lib/engine/profile.ts). Empty object = use the bundled starter pack for this brand.';
