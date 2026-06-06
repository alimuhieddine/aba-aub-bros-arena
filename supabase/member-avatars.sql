-- ABA member profile photo support.
-- Run this before enabling profile photo uploads.

alter table public.members
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('member-avatars', 'member-avatars', true)
on conflict (id) do update set public = true;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'members can upload own avatar'
  ) then
    create policy "members can upload own avatar"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'member-avatars'
        and exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and (storage.foldername(name))[1] = m.id::text
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'members can update own avatar'
  ) then
    create policy "members can update own avatar"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'member-avatars'
        and exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and (storage.foldername(name))[1] = m.id::text
        )
      )
      with check (
        bucket_id = 'member-avatars'
        and exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and (storage.foldername(name))[1] = m.id::text
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'members can delete own avatar'
  ) then
    create policy "members can delete own avatar"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'member-avatars'
        and exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and (storage.foldername(name))[1] = m.id::text
        )
      );
  end if;
end $$;
