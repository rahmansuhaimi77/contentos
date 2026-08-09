-- ContentOS isolated schema for a shared Supabase project.
-- All application tables are prefixed contentos_ and RLS helpers live outside the public API schema.

create extension if not exists pgcrypto;
create schema if not exists contentos_private;

create table if not exists public.contentos_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contentos_workspace_members (
  workspace_id uuid not null references public.contentos_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.contentos_brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.contentos_workspaces(id) on delete cascade,
  name text not null,
  product text not null default '',
  audience text not null default '',
  positioning text not null default '',
  voice text not null default '',
  offer text not null default '',
  proof text not null default '',
  preferred_cta text not null default '',
  avoid text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contentos_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.contentos_brands(id) on delete cascade,
  kind text not null check (kind in ('product','faq','testimonial','competitor','example','guideline','offer','other')),
  title text not null,
  content text not null,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contentos_campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.contentos_brands(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  objective text not null,
  platform text not null,
  format text not null,
  language text not null,
  brief jsonb not null default '{}'::jsonb,
  strategy text,
  status text not null default 'draft' check (status in ('draft','generated','in_review','approved','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contentos_content_variants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.contentos_campaigns(id) on delete cascade,
  hook text not null default '',
  angle text not null default '',
  script text not null default '',
  caption text not null default '',
  cta text not null default '',
  creative_prompt text not null default '',
  status text not null default 'draft' check (status in ('draft','in_review','approved','rejected','published')),
  review_note text not null default '',
  performance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contentos_workspaces_owner_id_idx on public.contentos_workspaces(owner_id);
create index if not exists contentos_workspace_members_user_id_idx on public.contentos_workspace_members(user_id);
create index if not exists contentos_brands_workspace_id_idx on public.contentos_brands(workspace_id);
create index if not exists contentos_knowledge_items_brand_id_idx on public.contentos_knowledge_items(brand_id);
create index if not exists contentos_campaigns_brand_id_idx on public.contentos_campaigns(brand_id);
create index if not exists contentos_campaigns_created_by_idx on public.contentos_campaigns(created_by);
create index if not exists contentos_content_variants_campaign_id_idx on public.contentos_content_variants(campaign_id);
create index if not exists contentos_content_variants_status_idx on public.contentos_content_variants(status);

create or replace function public.contentos_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function contentos_private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.contentos_workspaces w
    where w.id = target_workspace_id and w.owner_id = auth.uid()
  ) or exists (
    select 1 from public.contentos_workspace_members wm
    where wm.workspace_id = target_workspace_id and wm.user_id = auth.uid()
  );
$$;

create or replace function contentos_private.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.contentos_workspaces w
    where w.id = target_workspace_id and w.owner_id = auth.uid()
  ) or exists (
    select 1 from public.contentos_workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin')
  );
$$;

grant usage on schema contentos_private to authenticated;
grant execute on function contentos_private.is_workspace_member(uuid) to authenticated;
grant execute on function contentos_private.is_workspace_admin(uuid) to authenticated;
revoke all on schema contentos_private from anon;
revoke execute on function contentos_private.is_workspace_member(uuid) from anon;
revoke execute on function contentos_private.is_workspace_admin(uuid) from anon;

alter table public.contentos_workspaces enable row level security;
alter table public.contentos_workspace_members enable row level security;
alter table public.contentos_brands enable row level security;
alter table public.contentos_knowledge_items enable row level security;
alter table public.contentos_campaigns enable row level security;
alter table public.contentos_content_variants enable row level security;

create policy "contentos workspace members read" on public.contentos_workspaces
for select to authenticated using (contentos_private.is_workspace_member(id));
create policy "contentos users create workspace" on public.contentos_workspaces
for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "contentos owners update workspace" on public.contentos_workspaces
for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "contentos members read memberships" on public.contentos_workspace_members
for select to authenticated using (contentos_private.is_workspace_member(workspace_id));
create policy "contentos admins insert memberships" on public.contentos_workspace_members
for insert to authenticated with check (contentos_private.is_workspace_admin(workspace_id));
create policy "contentos admins update memberships" on public.contentos_workspace_members
for update to authenticated using (contentos_private.is_workspace_admin(workspace_id)) with check (contentos_private.is_workspace_admin(workspace_id));
create policy "contentos admins delete memberships" on public.contentos_workspace_members
for delete to authenticated using (contentos_private.is_workspace_admin(workspace_id));

create policy "contentos members manage brands" on public.contentos_brands
for all to authenticated
using (contentos_private.is_workspace_member(workspace_id))
with check (contentos_private.is_workspace_member(workspace_id));

create policy "contentos members manage knowledge" on public.contentos_knowledge_items
for all to authenticated
using (exists(select 1 from public.contentos_brands b where b.id = brand_id and contentos_private.is_workspace_member(b.workspace_id)))
with check (exists(select 1 from public.contentos_brands b where b.id = brand_id and contentos_private.is_workspace_member(b.workspace_id)));

create policy "contentos members read campaigns" on public.contentos_campaigns
for select to authenticated
using (exists(select 1 from public.contentos_brands b where b.id = brand_id and contentos_private.is_workspace_member(b.workspace_id)));
create policy "contentos members create campaigns" on public.contentos_campaigns
for insert to authenticated
with check (created_by = (select auth.uid()) and exists(select 1 from public.contentos_brands b where b.id = brand_id and contentos_private.is_workspace_member(b.workspace_id)));
create policy "contentos members update campaigns" on public.contentos_campaigns
for update to authenticated
using (exists(select 1 from public.contentos_brands b where b.id = brand_id and contentos_private.is_workspace_member(b.workspace_id)))
with check (exists(select 1 from public.contentos_brands b where b.id = brand_id and contentos_private.is_workspace_member(b.workspace_id)));
create policy "contentos members delete campaigns" on public.contentos_campaigns
for delete to authenticated
using (exists(select 1 from public.contentos_brands b where b.id = brand_id and contentos_private.is_workspace_member(b.workspace_id)));

create policy "contentos members manage variants" on public.contentos_content_variants
for all to authenticated
using (exists(select 1 from public.contentos_campaigns c join public.contentos_brands b on b.id = c.brand_id where c.id = campaign_id and contentos_private.is_workspace_member(b.workspace_id)))
with check (exists(select 1 from public.contentos_campaigns c join public.contentos_brands b on b.id = c.brand_id where c.id = campaign_id and contentos_private.is_workspace_member(b.workspace_id)));

create trigger contentos_workspaces_set_updated_at before update on public.contentos_workspaces for each row execute function public.contentos_set_updated_at();
create trigger contentos_brands_set_updated_at before update on public.contentos_brands for each row execute function public.contentos_set_updated_at();
create trigger contentos_knowledge_set_updated_at before update on public.contentos_knowledge_items for each row execute function public.contentos_set_updated_at();
create trigger contentos_campaigns_set_updated_at before update on public.contentos_campaigns for each row execute function public.contentos_set_updated_at();
create trigger contentos_variants_set_updated_at before update on public.contentos_content_variants for each row execute function public.contentos_set_updated_at();

grant select, insert, update, delete on public.contentos_workspaces to authenticated;
grant select, insert, update, delete on public.contentos_workspace_members to authenticated;
grant select, insert, update, delete on public.contentos_brands to authenticated;
grant select, insert, update, delete on public.contentos_knowledge_items to authenticated;
grant select, insert, update, delete on public.contentos_campaigns to authenticated;
grant select, insert, update, delete on public.contentos_content_variants to authenticated;

revoke all on public.contentos_workspaces from anon;
revoke all on public.contentos_workspace_members from anon;
revoke all on public.contentos_brands from anon;
revoke all on public.contentos_knowledge_items from anon;
revoke all on public.contentos_campaigns from anon;
revoke all on public.contentos_content_variants from anon;
