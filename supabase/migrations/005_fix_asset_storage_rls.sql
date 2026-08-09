drop policy if exists "contentos members upload asset files" on storage.objects;
drop policy if exists "contentos members read asset files" on storage.objects;
drop policy if exists "contentos members update asset files" on storage.objects;
drop policy if exists "contentos members delete asset files" on storage.objects;

create policy "contentos members upload asset files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'contentos-assets'
  and exists (
    select 1
    from public.contentos_brands b
    where b.id::text = (storage.foldername(storage.objects.name))[1]
      and contentos_private.is_workspace_member(b.workspace_id)
  )
);

create policy "contentos members read asset files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'contentos-assets'
  and exists (
    select 1
    from public.contentos_brands b
    where b.id::text = (storage.foldername(storage.objects.name))[1]
      and contentos_private.is_workspace_member(b.workspace_id)
  )
);

create policy "contentos members update asset files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'contentos-assets'
  and exists (
    select 1
    from public.contentos_brands b
    where b.id::text = (storage.foldername(storage.objects.name))[1]
      and contentos_private.is_workspace_member(b.workspace_id)
  )
)
with check (
  bucket_id = 'contentos-assets'
  and exists (
    select 1
    from public.contentos_brands b
    where b.id::text = (storage.foldername(storage.objects.name))[1]
      and contentos_private.is_workspace_member(b.workspace_id)
  )
);

create policy "contentos members delete asset files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'contentos-assets'
  and exists (
    select 1
    from public.contentos_brands b
    where b.id::text = (storage.foldername(storage.objects.name))[1]
      and contentos_private.is_workspace_member(b.workspace_id)
  )
);
