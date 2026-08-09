-- ContentOS multi-tenant MVP schema
create extension if not exists pgcrypto;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
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

create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  kind text not null check (kind in ('product','faq','testimonial','competitor','example','guideline','offer','other')),
  title text not null,
  content text not null,
  source_url text,
  created_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  objective text not null,
  platform text not null,
  format text not null,
  language text not null,
  brief jsonb not null default '{}'::jsonb,
  strategy text,
  status text not null default 'draft' check (status in ('draft','generated','approved','archived')),
  created_at timestamptz not null default now()
);

create table public.content_variants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  hook text not null default '',
  angle text not null default '',
  script text not null default '',
  caption text not null default '',
  cta text not null default '',
  creative_prompt text not null default '',
  status text not null default 'draft' check (status in ('draft','approved','rejected','published')),
  performance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index brands_workspace_id_idx on public.brands(workspace_id);
create index knowledge_items_brand_id_idx on public.knowledge_items(brand_id);
create index campaigns_brand_id_idx on public.campaigns(brand_id);
create index content_variants_campaign_id_idx on public.content_variants(campaign_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.brands enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.campaigns enable row level security;
alter table public.content_variants enable row level security;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id and user_id = auth.uid()
  ) or exists (
    select 1 from public.workspaces
    where id = target_workspace_id and owner_id = auth.uid()
  );
$$;

create policy "workspace members can read workspaces" on public.workspaces
for select using (public.is_workspace_member(id));
create policy "users can create workspaces" on public.workspaces
for insert with check (owner_id = auth.uid());
create policy "owners can update workspaces" on public.workspaces
for update using (owner_id = auth.uid());

create policy "members can read memberships" on public.workspace_members
for select using (public.is_workspace_member(workspace_id));
create policy "owners can manage memberships" on public.workspace_members
for all using (exists(select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()))
with check (exists(select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

create policy "members can manage brands" on public.brands
for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy "members can manage knowledge" on public.knowledge_items
for all using (exists(select 1 from public.brands b where b.id = brand_id and public.is_workspace_member(b.workspace_id)))
with check (exists(select 1 from public.brands b where b.id = brand_id and public.is_workspace_member(b.workspace_id)));

create policy "members can manage campaigns" on public.campaigns
for all using (exists(select 1 from public.brands b where b.id = brand_id and public.is_workspace_member(b.workspace_id)))
with check (exists(select 1 from public.brands b where b.id = brand_id and public.is_workspace_member(b.workspace_id)));

create policy "members can manage variants" on public.content_variants
for all using (exists(select 1 from public.campaigns c join public.brands b on b.id = c.brand_id where c.id = campaign_id and public.is_workspace_member(b.workspace_id)))
with check (exists(select 1 from public.campaigns c join public.brands b on b.id = c.brand_id where c.id = campaign_id and public.is_workspace_member(b.workspace_id)));
