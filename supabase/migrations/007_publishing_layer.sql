create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table if not exists public.contentos_social_apps (
  workspace_id uuid not null references public.contentos_workspaces(id) on delete cascade,
  platform text not null check (platform in ('threads','tiktok','instagram','facebook')),
  client_id text not null default '',
  redirect_uri text not null default '',
  status text not null default 'not_configured' check (status in ('not_configured','configured','error')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, platform)
);

create table if not exists public.contentos_social_app_credentials (
  workspace_id uuid not null,
  platform text not null,
  client_secret_secret_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, platform),
  foreign key (workspace_id, platform) references public.contentos_social_apps(workspace_id, platform) on delete cascade
);

create table if not exists public.contentos_social_connections (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.contentos_brands(id) on delete cascade,
  platform text not null check (platform in ('threads','tiktok','instagram','facebook')),
  platform_user_id text not null,
  username text,
  display_name text,
  status text not null default 'connected' check (status in ('connecting','connected','expired','error','disconnected')),
  scopes text[] not null default '{}',
  token_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, platform)
);

create table if not exists public.contentos_social_connection_credentials (
  connection_id uuid primary key references public.contentos_social_connections(id) on delete cascade,
  access_token_secret_id uuid not null,
  refresh_token_secret_id uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.contentos_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  brand_id uuid not null references public.contentos_brands(id) on delete cascade,
  workspace_id uuid not null references public.contentos_workspaces(id) on delete cascade,
  platform text not null check (platform in ('threads','tiktok','instagram','facebook')),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.contentos_publications (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.contentos_brands(id) on delete cascade,
  variant_id uuid references public.contentos_content_variants(id) on delete set null,
  plan_item_id uuid references public.contentos_plan_items(id) on delete set null,
  connection_id uuid references public.contentos_social_connections(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  platform text not null check (platform in ('threads','tiktok','instagram','facebook')),
  post_text text not null,
  media jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','approved','scheduled','publishing','published','failed','cancelled')),
  scheduled_for timestamptz,
  published_at timestamptz,
  platform_post_id text,
  permalink text,
  error_message text,
  retry_count integer not null default 0 check (retry_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contentos_publications_due_idx on public.contentos_publications(status, scheduled_for) where status = 'scheduled';
create index if not exists contentos_publications_brand_idx on public.contentos_publications(brand_id, created_at desc);

create table if not exists public.contentos_publish_events (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.contentos_publications(id) on delete cascade,
  event_type text not null,
  message text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.contentos_social_apps enable row level security;
alter table public.contentos_social_app_credentials enable row level security;
alter table public.contentos_social_connections enable row level security;
alter table public.contentos_social_connection_credentials enable row level security;
alter table public.contentos_oauth_states enable row level security;
alter table public.contentos_publications enable row level security;
alter table public.contentos_publish_events enable row level security;

create policy "contentos members read social apps" on public.contentos_social_apps for select using (
  exists (select 1 from public.contentos_workspace_members m where m.workspace_id = contentos_social_apps.workspace_id and m.user_id = auth.uid())
);
create policy "contentos admins manage social apps" on public.contentos_social_apps for all using (
  exists (select 1 from public.contentos_workspace_members m where m.workspace_id = contentos_social_apps.workspace_id and m.user_id = auth.uid() and m.role in ('owner','admin'))
) with check (
  exists (select 1 from public.contentos_workspace_members m where m.workspace_id = contentos_social_apps.workspace_id and m.user_id = auth.uid() and m.role in ('owner','admin'))
);
create policy "contentos members read social connections" on public.contentos_social_connections for select using (
  exists (select 1 from public.contentos_brands b join public.contentos_workspace_members m on m.workspace_id = b.workspace_id where b.id = contentos_social_connections.brand_id and m.user_id = auth.uid())
);
create policy "contentos members manage publications" on public.contentos_publications for all using (
  exists (select 1 from public.contentos_brands b join public.contentos_workspace_members m on m.workspace_id = b.workspace_id where b.id = contentos_publications.brand_id and m.user_id = auth.uid())
) with check (
  exists (select 1 from public.contentos_brands b join public.contentos_workspace_members m on m.workspace_id = b.workspace_id where b.id = contentos_publications.brand_id and m.user_id = auth.uid())
);
create policy "contentos members read publish events" on public.contentos_publish_events for select using (
  exists (select 1 from public.contentos_publications p join public.contentos_brands b on b.id = p.brand_id join public.contentos_workspace_members m on m.workspace_id = b.workspace_id where p.id = contentos_publish_events.publication_id and m.user_id = auth.uid())
);

create or replace function public.contentos_store_vault_secret(p_secret text, p_name text, p_description text default '') returns uuid language plpgsql security definer set search_path = public, vault as $$
declare v_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  select vault.create_secret(p_secret, p_name, p_description) into v_id;
  return v_id;
end; $$;

create or replace function public.contentos_read_vault_secret(p_secret_id uuid) returns text language plpgsql security definer set search_path = public, vault as $$
declare v_secret text;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where id = p_secret_id;
  return v_secret;
end; $$;

create or replace function public.contentos_delete_vault_secret(p_secret_id uuid) returns void language plpgsql security definer set search_path = public, vault as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  delete from vault.secrets where id = p_secret_id;
end; $$;

revoke all on function public.contentos_store_vault_secret(text,text,text) from public, anon, authenticated;
revoke all on function public.contentos_read_vault_secret(uuid) from public, anon, authenticated;
revoke all on function public.contentos_delete_vault_secret(uuid) from public, anon, authenticated;
grant execute on function public.contentos_store_vault_secret(text,text,text) to service_role;
grant execute on function public.contentos_read_vault_secret(uuid) to service_role;
grant execute on function public.contentos_delete_vault_secret(uuid) to service_role;
