-- Fix workspace bootstrap with INSERT ... RETURNING under RLS.
-- Owners must be able to read their just-created workspace directly,
-- without relying only on the membership helper subquery.

drop policy if exists "contentos workspace members read" on public.contentos_workspaces;

create policy "contentos workspace members read"
on public.contentos_workspaces for select
to authenticated
using (
  owner_id = (select auth.uid())
  or contentos_private.is_workspace_member(id)
);
