-- ABA phone notification foundation
-- Run this before enabling phone notifications in the app.

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
values (
  'push_notifications',
  '{"public_key":"","enabled":false}'::jsonb,
  1
)
on conflict (key) do nothing;

create table if not exists public.member_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text,
  auth text,
  subscription jsonb not null,
  user_agent text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_push_subscriptions_member_idx
  on public.member_push_subscriptions(member_id);

create index if not exists member_push_subscriptions_enabled_idx
  on public.member_push_subscriptions(enabled);

alter table public.member_push_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_push_subscriptions'
      and policyname = 'approved members can read own push subscriptions'
  ) then
    create policy "approved members can read own push subscriptions"
      on public.member_push_subscriptions
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.members m
          where m.id = member_push_subscriptions.member_id
            and m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
        )
        or exists (
          select 1
          from public.members admin_member
          where admin_member.auth_user_id = auth.uid()
            and admin_member.role = 'admin'
            and admin_member.approval_status = 'approved'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_push_subscriptions'
      and policyname = 'approved members can save own push subscriptions'
  ) then
    create policy "approved members can save own push subscriptions"
      on public.member_push_subscriptions
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.members m
          where m.id = member_push_subscriptions.member_id
            and m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_push_subscriptions'
      and policyname = 'approved members can update own push subscriptions'
  ) then
    create policy "approved members can update own push subscriptions"
      on public.member_push_subscriptions
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.members m
          where m.id = member_push_subscriptions.member_id
            and m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
        )
      )
      with check (
        exists (
          select 1
          from public.members m
          where m.id = member_push_subscriptions.member_id
            and m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_push_subscriptions'
      and policyname = 'approved members can delete own push subscriptions'
  ) then
    create policy "approved members can delete own push subscriptions"
      on public.member_push_subscriptions
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.members m
          where m.id = member_push_subscriptions.member_id
            and m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
        )
      );
  end if;
end $$;

-- After generating VAPID keys, update the public key like this:
-- update public.app_settings
-- set value = jsonb_build_object('enabled', true, 'public_key', 'YOUR_PUBLIC_VAPID_KEY'),
--     version = version + 1,
--     updated_at = now()
-- where key = 'push_notifications';
