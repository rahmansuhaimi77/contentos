create table if not exists public.contentos_ai_provider_credentials (
  brand_id uuid not null references public.contentos_brands(id) on delete cascade,
  provider text not null,
  api_key_secret_id uuid not null,
  status text not null default 'configured',
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (brand_id, provider),
  constraint contentos_ai_provider_credentials_provider_check check (provider in ('openai','claude','google')),
  constraint contentos_ai_provider_credentials_status_check check (status in ('configured','disabled','error'))
);

alter table public.contentos_ai_provider_credentials enable row level security;

-- Secrets are only read/written by trusted Edge Functions using the service role.
revoke all on table public.contentos_ai_provider_credentials from anon, authenticated;
grant all on table public.contentos_ai_provider_credentials to service_role;
