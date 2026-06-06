-- ABA member profile photo support.
-- Run this before enabling profile photo uploads.

alter table public.members
  add column if not exists avatar_url text;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'members'
      and policyname = 'members can update own profile fields'
  ) then
    create policy "members can update own profile fields"
      on public.members
      for update
      to authenticated
      using (auth_user_id = auth.uid())
      with check (auth_user_id = auth.uid());
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('member-avatars', 'member-avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "members can read own avatar" on storage.objects;
drop policy if exists "members can upload own avatar" on storage.objects;
drop policy if exists "members can update own avatar" on storage.objects;
drop policy if exists "members can delete own avatar" on storage.objects;

create policy "members can read own avatar"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "members can upload own avatar"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "members can update own avatar"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "members can delete own avatar"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
