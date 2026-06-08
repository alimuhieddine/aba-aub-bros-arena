-- ABA member roles and sport-scoped committee permissions.
-- Run after the base members/sports tables exist.

create extension if not exists pgcrypto;

alter table public.members
  drop constraint if exists members_role_check;

alter table public.members
  add constraint members_role_check
  check (role in ('owner', 'admin', 'committee', 'member'));

create or replace function public.current_member_role()
returns text
language sql
security definer
set search_path = public
as $$
  select m.role
  from public.members m
  where m.auth_user_id = auth.uid()
  limit 1
$$;

grant execute on function public.current_member_role() to authenticated;

create or replace function public.current_member_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select m.id
  from public.members m
  where m.auth_user_id = auth.uid()
  limit 1
$$;

grant execute on function public.current_member_id() to authenticated;

create or replace function public.protect_member_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text := public.current_member_role();
  actor_member_id uuid := public.current_member_id();
  role_changed boolean := coalesce(new.role, '') is distinct from coalesce(old.role, '');
  admin_fields_changed boolean :=
    role_changed
    or coalesce(new.approval_status, '') is distinct from coalesce(old.approval_status, '')
    or coalesce(new.registration_status, '') is distinct from coalesce(old.registration_status, '')
    or coalesce(new.is_active, false) is distinct from coalesce(old.is_active, false)
    or coalesce(new.is_external, false) is distinct from coalesce(old.is_external, false)
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at;
begin
  if role_changed then
    if actor_role <> 'owner' then
      raise exception 'Only the owner can change member roles.';
    end if;

    if old.id = actor_member_id then
      raise exception 'You cannot change your role.';
    end if;
  elsif admin_fields_changed and actor_role not in ('owner', 'admin') then
    raise exception 'You cannot change protected member fields.';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'members'
      and policyname = 'approved owners can read member roles'
  ) then
    create policy "approved owners can read member roles"
      on public.members
      for select
      to authenticated
      using (
        public.current_member_role() = 'owner'
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'members'
      and policyname = 'approved owners can update member roles'
  ) then
    create policy "approved owners can update member roles"
      on public.members
      for update
      to authenticated
      using (
        public.current_member_role() = 'owner'
      )
      with check (
        public.current_member_role() = 'owner'
      );
  end if;

  if to_regclass('public.app_settings') is not null and not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_settings'
      and policyname = 'approved owners can manage app settings'
  ) then
    create policy "approved owners can manage app settings"
      on public.app_settings
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.role = 'owner'
            and m.approval_status = 'approved'
        )
      )
      with check (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.role = 'owner'
            and m.approval_status = 'approved'
        )
      );
  end if;

  if to_regclass('public.member_activities') is not null and not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_activities'
      and policyname = 'approved owners can read all activities'
  ) then
    create policy "approved owners can read all activities"
      on public.member_activities
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.role = 'owner'
            and m.approval_status = 'approved'
        )
      );
  end if;

  if to_regclass('public.member_activities') is not null and not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_activities'
      and policyname = 'approved owners can review activities'
  ) then
    create policy "approved owners can review activities"
      on public.member_activities
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.role = 'owner'
            and m.approval_status = 'approved'
        )
      )
      with check (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.role = 'owner'
            and m.approval_status = 'approved'
        )
      );
  end if;

  if to_regclass('public.member_activities') is not null and not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_activities'
      and policyname = 'approved owners can delete activities'
  ) then
    create policy "approved owners can delete activities"
      on public.member_activities
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.role = 'owner'
            and m.approval_status = 'approved'
        )
      );
  end if;
end $$;

create table if not exists public.member_sport_permissions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  sport_id uuid not null references public.sports(id) on delete cascade,
  permission text not null default 'manage'
    check (permission in ('manage')),
  granted_by uuid references public.members(id),
  created_at timestamptz not null default now(),
  unique (member_id, sport_id, permission)
);

create index if not exists member_sport_permissions_member_idx
  on public.member_sport_permissions (member_id);

create index if not exists member_sport_permissions_sport_idx
  on public.member_sport_permissions (sport_id);

alter table public.member_sport_permissions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_sport_permissions'
      and policyname = 'approved members can read own sport permissions'
  ) then
    create policy "approved members can read own sport permissions"
      on public.member_sport_permissions
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
            and (
              m.id = member_sport_permissions.member_id
              or m.role = 'owner'
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_sport_permissions'
      and policyname = 'approved owners can manage sport permissions'
  ) then
    create policy "approved owners can manage sport permissions"
      on public.member_sport_permissions
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
            and m.role = 'owner'
        )
      )
      with check (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
            and m.role = 'owner'
        )
      );
  end if;
end $$;
