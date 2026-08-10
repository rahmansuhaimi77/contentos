do $$
begin
  if not exists (select 1 from vault.secrets where name = 'contentos_publish_worker_key') then
    perform vault.create_secret(replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''), 'contentos_publish_worker_key', 'Secret used only by the ContentOS scheduled publishing worker');
  end if;
end $$;

create or replace function public.contentos_get_worker_secret()
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare v_secret text;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'contentos_publish_worker_key' order by created_at desc limit 1;
  return v_secret;
end; $$;

revoke all on function public.contentos_get_worker_secret() from public, anon, authenticated;
grant execute on function public.contentos_get_worker_secret() to service_role;

do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'contentos-publish-worker' limit 1;
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
  perform cron.schedule(
    'contentos-publish-worker', '* * * * *',
    $cron$
      select net.http_post(
        url := 'https://xqlfytlknhazusowiiug.supabase.co/functions/v1/contentos-social/worker',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-contentos-worker',(select decrypted_secret from vault.decrypted_secrets where name='contentos_publish_worker_key' order by created_at desc limit 1)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 10000
      );
    $cron$
  );
end $$;
