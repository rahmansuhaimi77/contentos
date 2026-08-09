create table if not exists public.contentos_flow_profiles (
  workspace_id uuid primary key references public.contentos_workspaces(id) on delete cascade,
  daily_credits integer not null default 50 check (daily_credits >= 0),
  monthly_credits integer not null default 200 check (monthly_credits >= 0),
  lite_cost integer not null default 10 check (lite_cost > 0),
  fast_cost integer not null default 20 check (fast_cost > 0),
  quality_cost integer not null default 100 check (quality_cost > 0),
  preferred_preset text not null default 'economy' check (preferred_preset in ('economy','balanced','premium')),
  updated_at timestamptz not null default now()
);

alter table public.contentos_flow_profiles enable row level security;

drop policy if exists "contentos members manage flow profile" on public.contentos_flow_profiles;
create policy "contentos members manage flow profile"
on public.contentos_flow_profiles for all to authenticated
using (contentos_private.is_workspace_member(workspace_id))
with check (contentos_private.is_workspace_member(workspace_id));
