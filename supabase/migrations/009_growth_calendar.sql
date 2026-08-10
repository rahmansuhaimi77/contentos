create table if not exists public.contentos_growth_profiles (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null unique references public.contentos_brands(id) on delete cascade,
  created_by uuid not null default auth.uid(),
  current_phase text not null default 'controlled_beta' check (current_phase in ('controlled_beta','beta_driver_onboarding','pre_launch','stabilisation','driver_activation_sprint','public_launch','launch_week','early_growth','growth_optimisation','retention')),
  marketplace_need text not null default 'product_stability' check (marketplace_need in ('product_stability','driver_supply','passenger_demand','balanced')),
  target_launch_start date,
  target_launch_end date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contentos_growth_calendar_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.contentos_brands(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  phase text not null,
  academic_phase text not null default '',
  title text not null,
  objective text not null default '',
  audience_focus text not null default '',
  marketplace_need text not null default 'balanced' check (marketplace_need in ('product_stability','driver_supply','passenger_demand','balanced')),
  content_mix jsonb not null default '[]'::jsonb,
  ops_priorities jsonb not null default '[]'::jsonb,
  success_gates jsonb not null default '[]'::jsonb,
  status text not null default 'planned' check (status in ('planned','active','completed','delayed')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contentos_growth_calendar_valid_dates check (end_date >= start_date)
);

create index if not exists contentos_growth_calendar_brand_dates_idx on public.contentos_growth_calendar_items(brand_id, start_date, end_date);
create index if not exists contentos_growth_calendar_brand_order_idx on public.contentos_growth_calendar_items(brand_id, sort_order);

alter table public.contentos_growth_profiles enable row level security;
alter table public.contentos_growth_calendar_items enable row level security;

create policy "contentos members manage growth profiles" on public.contentos_growth_profiles
for all using (
  exists (select 1 from public.contentos_brands b where b.id = brand_id and contentos_private.is_workspace_member(b.workspace_id))
) with check (
  exists (select 1 from public.contentos_brands b where b.id = brand_id and contentos_private.is_workspace_member(b.workspace_id))
);

create policy "contentos members manage growth calendar" on public.contentos_growth_calendar_items
for all using (
  exists (select 1 from public.contentos_brands b where b.id = brand_id and contentos_private.is_workspace_member(b.workspace_id))
) with check (
  exists (select 1 from public.contentos_brands b where b.id = brand_id and contentos_private.is_workspace_member(b.workspace_id))
);

grant select, insert, update, delete on public.contentos_growth_profiles to authenticated;
grant select, insert, update, delete on public.contentos_growth_calendar_items to authenticated;
