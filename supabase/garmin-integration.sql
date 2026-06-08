-- ABA Garmin Connect integration foundation.
-- Run after activity-logging.sql.

create extension if not exists pgcrypto;

create table if not exists public.member_garmin_connections (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  garmin_user_id text not null,
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error')),
  permissions jsonb not null default '[]'::jsonb,
  last_sync_at timestamptz,
  last_activity_at timestamptz,
  error_message text,
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id),
  unique (garmin_user_id)
);

create table if not exists public.member_garmin_tokens (
  connection_id uuid primary key references public.member_garmin_connections(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz,
  token_type text,
  scope text,
  updated_at timestamptz not null default now()
);

create table if not exists public.member_garmin_oauth_states (
  state text primary key,
  member_id uuid not null references public.members(id) on delete cascade,
  code_verifier text not null,
  redirect_uri text not null,
  app_return_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

alter table public.member_garmin_connections enable row level security;
alter table public.member_garmin_tokens enable row level security;
alter table public.member_garmin_oauth_states enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_garmin_connections'
      and policyname = 'approved members can read own garmin connection'
  ) then
    create policy "approved members can read own garmin connection"
      on public.member_garmin_connections
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
            and m.id = member_garmin_connections.member_id
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_garmin_connections'
      and policyname = 'approved members can disconnect own garmin connection'
  ) then
    create policy "approved members can disconnect own garmin connection"
      on public.member_garmin_connections
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
            and m.id = member_garmin_connections.member_id
        )
      );
  end if;
end $$;

alter table public.member_activities
  alter column proof_path drop not null;

alter table public.member_activities
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'garmin')),
  add column if not exists external_source_id text,
  add column if not exists external_url text,
  add column if not exists external_payload jsonb;

create unique index if not exists member_activities_unique_external_source
  on public.member_activities (source, external_source_id);

create index if not exists member_activities_source_idx
  on public.member_activities (source, created_at desc);
