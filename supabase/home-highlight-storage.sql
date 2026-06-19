insert into storage.buckets (id, name, public)
values ('highlights', 'highlights', true)
on conflict (id) do update
set public = true;

drop policy if exists "approved admins can upload home highlights" on storage.objects;
create policy "approved admins can upload home highlights"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'highlights'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.members m
      where m.auth_user_id = auth.uid()
        and m.approval_status = 'approved'
        and m.role in ('owner', 'admin')
    )
  );

drop policy if exists "approved admins can update home highlights" on storage.objects;
create policy "approved admins can update home highlights"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'highlights'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.members m
      where m.auth_user_id = auth.uid()
        and m.approval_status = 'approved'
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    bucket_id = 'highlights'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.members m
      where m.auth_user_id = auth.uid()
        and m.approval_status = 'approved'
        and m.role in ('owner', 'admin')
    )
  );

drop policy if exists "approved admins can delete home highlights" on storage.objects;
create policy "approved admins can delete home highlights"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'highlights'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.members m
      where m.auth_user_id = auth.uid()
        and m.approval_status = 'approved'
        and m.role in ('owner', 'admin')
    )
  );
