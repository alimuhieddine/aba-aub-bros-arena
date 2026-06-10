-- ABA Strava integration foundation.
-- Run after activity-logging.sql.

create extension if not exists pgcrypto;

create table if not exists public.member_strava_connections (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  strava_athlete_id text not null,
  athlete_username text,
  athlete_first_name text,
  athlete_last_name text,
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error')),
  scope text,
  last_sync_at timestamptz,
  last_activity_at timestamptz,
  error_message text,
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id),
  unique (strava_athlete_id)
);

create table if not exists public.member_strava_tokens (
  connection_id uuid primary key references public.member_strava_connections(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz not null,
  token_type text,
  scope text,
  updated_at timestamptz not null default now()
);

create table if not exists public.member_strava_oauth_states (
  state text primary key,
  member_id uuid not null references public.members(id) on delete cascade,
  redirect_uri text not null,
  app_return_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

alter table public.member_strava_connections enable row level security;
alter table public.member_strava_tokens enable row level security;
alter table public.member_strava_oauth_states enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_strava_connections'
      and policyname = 'approved members can read own strava connection'
  ) then
    create policy "approved members can read own strava connection"
      on public.member_strava_connections
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
            and m.id = member_strava_connections.member_id
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_strava_connections'
      and policyname = 'approved members can read connected strava members'
  ) then
    create policy "approved members can read connected strava members"
      on public.member_strava_connections
      for select
      to authenticated
      using (
        status = 'connected'
        and exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
        )
      );
  end if;
end $$;

alter table public.member_activities
  alter column proof_path drop not null;

alter table public.member_activities
  add column if not exists source text not null default 'manual',
  add column if not exists external_source_id text,
  add column if not exists external_url text,
  add column if not exists external_payload jsonb;

alter table public.member_activities
  drop constraint if exists member_activities_source_check;

alter table public.member_activities
  add constraint member_activities_source_check
  check (source in ('manual', 'garmin', 'strava'));

create unique index if not exists member_activities_unique_external_source
  on public.member_activities (source, external_source_id);

create index if not exists member_activities_source_idx
  on public.member_activities (source, created_at desc);
