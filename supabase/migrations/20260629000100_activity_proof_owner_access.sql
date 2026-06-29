drop policy if exists "activity proof owners and admins can read" on storage.objects;
create policy "activity proof owners and admins can read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'activity-proofs'
    and (
      owner = auth.uid()
      or exists (
        select 1
        from public.members m
        where m.auth_user_id = auth.uid()
          and m.role in ('owner', 'admin')
          and m.approval_status = 'approved'
      )
    )
  );

drop policy if exists "activity proof owners and admins can delete" on storage.objects;
create policy "activity proof owners and admins can delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'activity-proofs'
    and (
      owner = auth.uid()
      or exists (
        select 1
        from public.members m
        where m.auth_user_id = auth.uid()
          and m.role in ('owner', 'admin')
          and m.approval_status = 'approved'
      )
    )
  );
