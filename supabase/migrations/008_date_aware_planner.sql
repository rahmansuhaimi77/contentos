alter table contentos_content_plans
  add column if not exists start_date date;

alter table contentos_plan_items
  add column if not exists planned_date date;

update contentos_content_plans
set start_date = coalesce(start_date, created_at::date)
where start_date is null;

update contentos_plan_items i
set planned_date = p.start_date + (i.day_number - 1)
from contentos_content_plans p
where i.plan_id = p.id
  and i.planned_date is null;

alter table contentos_content_plans
  alter column start_date set default current_date;
