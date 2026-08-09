alter table public.contentos_content_variants
  add column if not exists production_pack jsonb not null default '{}'::jsonb;

alter table public.contentos_content_variants
  add column if not exists source_plan_item_id uuid null references public.contentos_plan_items(id) on delete set null;

create index if not exists contentos_content_variants_source_plan_item_id_idx
  on public.contentos_content_variants(source_plan_item_id)
  where source_plan_item_id is not null;

alter table public.contentos_plan_items
  add column if not exists production_status text not null default 'not_started';

create index if not exists contentos_plan_items_production_status_idx
  on public.contentos_plan_items(production_status);
