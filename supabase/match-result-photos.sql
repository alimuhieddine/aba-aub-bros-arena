-- ABA match result photo support.
-- Run this before enabling end-of-game photo uploads.

alter table public.matches
  add column if not exists result_photo_path text,
  add column if not exists result_photo_file_name text;

insert into storage.buckets (id, name, public)
values ('match-result-photos', 'match-result-photos', true)
on conflict (id) do update set public = true;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'approved members can upload match result photos'
  ) then
    create policy "approved members can upload match result photos"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'match-result-photos'
        and owner = auth.uid()
        and exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'approved members can update match result photos'
  ) then
    create policy "approved members can update match result photos"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'match-result-photos'
        and owner = auth.uid()
        and exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
        )
      )
      with check (
        bucket_id = 'match-result-photos'
        and owner = auth.uid()
        and exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'approved members can delete match result photos'
  ) then
    create policy "approved members can delete match result photos"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'match-result-photos'
        and owner = auth.uid()
        and exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
        )
      );
  end if;
end $$;
