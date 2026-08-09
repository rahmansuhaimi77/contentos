create table if not exists public.contentos_brand_visuals (
  brand_id uuid primary key references public.contentos_brands(id) on delete cascade,
  primary_color text,
  secondary_color text,
  accent_color text,
  font_notes text,
  visual_style text,
  image_rules text,
  updated_at timestamptz not null default now()
);

alter table public.contentos_brand_visuals enable row level security;

drop policy if exists "contentos members manage brand visuals" on public.contentos_brand_visuals;
create policy "contentos members manage brand visuals"
on public.contentos_brand_visuals
for all
to authenticated
using (
  exists (
    select 1 from public.contentos_brands b
    where b.id = contentos_brand_visuals.brand_id
      and contentos_private.is_workspace_member(b.workspace_id)
  )
)
with check (
  exists (
    select 1 from public.contentos_brands b
    where b.id = contentos_brand_visuals.brand_id
      and contentos_private.is_workspace_member(b.workspace_id)
  )
);

create table if not exists public.contentos_brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.contentos_brands(id) on delete cascade,
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('logo','screenshot','vehicle','visual_reference','other')),
  title text not null,
  storage_path text not null unique,
  mime_type text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists contentos_brand_assets_brand_id_idx on public.contentos_brand_assets(brand_id);

alter table public.contentos_brand_assets enable row level security;

drop policy if exists "contentos members manage brand assets" on public.contentos_brand_assets;
create policy "contentos members manage brand assets"
on public.contentos_brand_assets
for all
to authenticated
using (
  exists (
    select 1 from public.contentos_brands b
    where b.id = contentos_brand_assets.brand_id
      and contentos_private.is_workspace_member(b.workspace_id)
  )
)
with check (
  exists (
    select 1 from public.contentos_brands b
    where b.id = contentos_brand_assets.brand_id
      and contentos_private.is_workspace_member(b.workspace_id)
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contentos-assets','contentos-assets',false,5242880,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "contentos members read asset files" on storage.objects;
create policy "contentos members read asset files"
on storage.objects for select to authenticated
using (
  bucket_id = 'contentos-assets'
  and exists (
    select 1 from public.contentos_brands b
    where b.id::text = (storage.foldername(name))[1]
      and contentos_private.is_workspace_member(b.workspace_id)
  )
);

drop policy if exists "contentos members upload asset files" on storage.objects;
create policy "contentos members upload asset files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'contentos-assets'
  and exists (
    select 1 from public.contentos_brands b
    where b.id::text = (storage.foldername(name))[1]
      and contentos_private.is_workspace_member(b.workspace_id)
  )
);

drop policy if exists "contentos members update asset files" on storage.objects;
create policy "contentos members update asset files"
on storage.objects for update to authenticated
using (
  bucket_id = 'contentos-assets'
  and exists (
    select 1 from public.contentos_brands b
    where b.id::text = (storage.foldername(name))[1]
      and contentos_private.is_workspace_member(b.workspace_id)
  )
)
with check (
  bucket_id = 'contentos-assets'
  and exists (
    select 1 from public.contentos_brands b
    where b.id::text = (storage.foldername(name))[1]
      and contentos_private.is_workspace_member(b.workspace_id)
  )
);

drop policy if exists "contentos members delete asset files" on storage.objects;
create policy "contentos members delete asset files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'contentos-assets'
  and exists (
    select 1 from public.contentos_brands b
    where b.id::text = (storage.foldername(name))[1]
      and contentos_private.is_workspace_member(b.workspace_id)
  )
);
