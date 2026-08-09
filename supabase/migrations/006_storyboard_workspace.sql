create table if not exists public.contentos_storyboards (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null unique references public.contentos_content_variants(id) on delete cascade,
  brand_id uuid not null references public.contentos_brands(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'prompt_ready' check (status in ('draft','prompt_ready','generating','review','approved')),
  aspect_ratio text not null default '9:16',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contentos_storyboards_brand_id_idx on public.contentos_storyboards(brand_id);
create index if not exists contentos_storyboards_created_by_idx on public.contentos_storyboards(created_by);
alter table public.contentos_storyboards enable row level security;

drop policy if exists "contentos members manage storyboards" on public.contentos_storyboards;
create policy "contentos members manage storyboards"
on public.contentos_storyboards for all to authenticated
using (
  exists (
    select 1 from public.contentos_brands b
    where b.id = contentos_storyboards.brand_id
      and contentos_private.is_workspace_member(b.workspace_id)
  )
)
with check (
  exists (
    select 1 from public.contentos_brands b
    where b.id = contentos_storyboards.brand_id
      and contentos_private.is_workspace_member(b.workspace_id)
  )
);

create table if not exists public.contentos_storyboard_frames (
  id uuid primary key default gen_random_uuid(),
  storyboard_id uuid not null references public.contentos_storyboards(id) on delete cascade,
  scene_number integer not null check (scene_number between 1 and 12),
  duration text,
  visual text not null,
  on_screen_text text,
  voiceover text,
  image_prompt text not null,
  status text not null default 'prompt_ready' check (status in ('prompt_ready','generating','generated','uploaded','approved','rejected')),
  asset_path text,
  provider text,
  generation_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(storyboard_id, scene_number)
);

create index if not exists contentos_storyboard_frames_storyboard_id_idx on public.contentos_storyboard_frames(storyboard_id);
alter table public.contentos_storyboard_frames enable row level security;

drop policy if exists "contentos members manage storyboard frames" on public.contentos_storyboard_frames;
create policy "contentos members manage storyboard frames"
on public.contentos_storyboard_frames for all to authenticated
using (
  exists (
    select 1 from public.contentos_storyboards s
    join public.contentos_brands b on b.id = s.brand_id
    where s.id = contentos_storyboard_frames.storyboard_id
      and contentos_private.is_workspace_member(b.workspace_id)
  )
)
with check (
  exists (
    select 1 from public.contentos_storyboards s
    join public.contentos_brands b on b.id = s.brand_id
    where s.id = contentos_storyboard_frames.storyboard_id
      and contentos_private.is_workspace_member(b.workspace_id)
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contentos-storyboards',
  'contentos-storyboards',
  false,
  10485760,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "contentos members read storyboard files" on storage.objects;
create policy "contentos members read storyboard files"
on storage.objects for select to authenticated
using (
  bucket_id = 'contentos-storyboards'
  and exists (
    select 1 from public.contentos_brands b
    where b.id::text = (storage.foldername(storage.objects.name))[1]
      and contentos_private.is_workspace_member(b.workspace_id)
  )
);

drop policy if exists "contentos members upload storyboard files" on storage.objects;
create policy "contentos members upload storyboard files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'contentos-storyboards'
  and exists (
    select 1 from public.contentos_brands b
    where b.id::text = (storage.foldername(storage.objects.name))[1]
      and contentos_private.is_workspace_member(b.workspace_id)
  )
);

drop policy if exists "contentos members update storyboard files" on storage.objects;
create policy "contentos members update storyboard files"
on storage.objects for update to authenticated
using (
  bucket_id = 'contentos-storyboards'
  and exists (
    select 1 from public.contentos_brands b
    where b.id::text = (storage.foldername(storage.objects.name))[1]
      and contentos_private.is_workspace_member(b.workspace_id)
  )
)
with check (
  bucket_id = 'contentos-storyboards'
  and exists (
    select 1 from public.contentos_brands b
    where b.id::text = (storage.foldername(storage.objects.name))[1]
      and contentos_private.is_workspace_member(b.workspace_id)
  )
);

drop policy if exists "contentos members delete storyboard files" on storage.objects;
create policy "contentos members delete storyboard files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'contentos-storyboards'
  and exists (
    select 1 from public.contentos_brands b
    where b.id::text = (storage.foldername(storage.objects.name))[1]
      and contentos_private.is_workspace_member(b.workspace_id)
  )
);
