-- ABA match result photo support.
-- Run this before enabling end-of-game photo uploads.

create extension if not exists pgcrypto;

create table if not exists public.match_result_photos (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  photo_path text not null,
  photo_file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id)
);

alter table public.match_result_photos enable row level security;

drop policy if exists "approved members can read match result photos" on public.match_result_photos;
create policy "approved members can read match result photos"
  on public.match_result_photos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.members viewer
      where viewer.auth_user_id = auth.uid()
        and viewer.approval_status = 'approved'
        and (
          viewer.role = 'admin'
          or exists (
            select 1
            from public.matches m
            where m.id = match_result_photos.match_id
              and m.created_by = viewer.id
          )
        )
    )
  );

drop policy if exists "approved members can manage own match result photos" on public.match_result_photos;
create policy "approved members can manage own match result photos"
  on public.match_result_photos
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.members m
      where m.auth_user_id = auth.uid()
        and m.approval_status = 'approved'
        and (
          m.role = 'admin'
          or exists (
            select 1
            from public.matches match_row
            where match_row.id = match_result_photos.match_id
              and match_row.created_by = m.id
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.members m
      where m.auth_user_id = auth.uid()
        and m.approval_status = 'approved'
        and (
          m.role = 'admin'
          or exists (
            select 1
            from public.matches match_row
            where match_row.id = match_result_photos.match_id
              and match_row.created_by = m.id
          )
        )
    )
  );

insert into storage.buckets (id, name, public)
values ('match-result-photos', 'match-result-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "approved members can upload match result photos" on storage.objects;
create policy "approved members can upload match result photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'match-result-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.members m
      where m.auth_user_id = auth.uid()
        and m.approval_status = 'approved'
    )
  );

drop policy if exists "approved members can delete match result photos" on storage.objects;
create policy "approved members can delete match result photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'match-result-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.members m
      where m.auth_user_id = auth.uid()
        and m.approval_status = 'approved'
    )
  );
