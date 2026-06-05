-- ABA activity logging migration
-- Run this before deploying the Activity tab logging feature.

create extension if not exists pgcrypto;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_by uuid references public.members(id),
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_settings'
      and policyname = 'approved members can read app settings'
  ) then
    create policy "approved members can read app settings"
      on public.app_settings
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_settings'
      and policyname = 'approved admins can manage app settings'
  ) then
    create policy "approved admins can manage app settings"
      on public.app_settings
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.role = 'admin'
            and m.approval_status = 'approved'
        )
      )
      with check (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.role = 'admin'
            and m.approval_status = 'approved'
        )
      );
  end if;
end $$;

insert into public.app_settings (key, value, version)
values ('activity_sport_settings', '{}'::jsonb, 1)
on conflict (key) do nothing;

create table if not exists public.member_activities (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  sport_id uuid not null references public.sports(id),
  title text not null,
  activity_date date not null,
  start_time time not null,
  end_time time not null,
  duration_minutes integer not null check (duration_minutes > 0),
  activity_points numeric(8,2) not null default 0 check (activity_points >= 0),
  proof_path text not null,
  proof_file_name text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_by uuid references public.members(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_activities_member_idx
  on public.member_activities (member_id, created_at desc);

create index if not exists member_activities_status_idx
  on public.member_activities (status, created_at desc);

create index if not exists member_activities_sport_idx
  on public.member_activities (sport_id, activity_date desc);

alter table public.member_activities enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_activities'
      and policyname = 'approved members can read own and approved activities'
  ) then
    create policy "approved members can read own and approved activities"
      on public.member_activities
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
            and (
              m.id = member_activities.member_id
              or member_activities.status = 'approved'
              or m.role = 'admin'
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_activities'
      and policyname = 'approved members can submit own activities'
  ) then
    create policy "approved members can submit own activities"
      on public.member_activities
      for insert
      to authenticated
      with check (
        status = 'pending'
        and exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
            and m.id = member_activities.member_id
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_activities'
      and policyname = 'approved admins can review activities'
  ) then
    create policy "approved admins can review activities"
      on public.member_activities
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.role = 'admin'
            and m.approval_status = 'approved'
        )
      )
      with check (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.role = 'admin'
            and m.approval_status = 'approved'
        )
      );
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('activity-proofs', 'activity-proofs', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'approved members can upload activity proofs'
  ) then
    create policy "approved members can upload activity proofs"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'activity-proofs'
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
      and policyname = 'activity proof owners and admins can read'
  ) then
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
              and m.role = 'admin'
              and m.approval_status = 'approved'
          )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'activity proof owners can delete failed uploads'
  ) then
    create policy "activity proof owners can delete failed uploads"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'activity-proofs'
        and owner = auth.uid()
      );
  end if;
end $$;
