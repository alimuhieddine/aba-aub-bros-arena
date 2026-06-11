-- ABA match edit history.
-- Run this to persist score, formation, and assessment audit events.

create table if not exists public.match_edit_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  actor_member_id uuid references public.members(id) on delete set null,
  event_type text not null default 'match_update',
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists match_edit_events_match_created_idx
  on public.match_edit_events (match_id, created_at desc);

create index if not exists match_edit_events_actor_created_idx
  on public.match_edit_events (actor_member_id, created_at desc);

alter table public.match_edit_events enable row level security;

drop policy if exists "approved members can read match edit history" on public.match_edit_events;
create policy "approved members can read match edit history"
  on public.match_edit_events
  for select
  using (
    exists (
      select 1
      from public.members m
      where m.auth_user_id = auth.uid()
        and m.approval_status = 'approved'
    )
  );

drop policy if exists "match managers can write match edit history" on public.match_edit_events;
create policy "match managers can write match edit history"
  on public.match_edit_events
  for insert
  with check (
    exists (
      select 1
      from public.members m
      where m.auth_user_id = auth.uid()
        and m.id = actor_member_id
        and m.approval_status = 'approved'
        and (
          m.role in ('owner', 'admin')
          or exists (
            select 1
            from public.matches mt
            join public.member_sport_permissions msp
              on msp.sport_id = mt.sport_id
             and msp.member_id = m.id
            where mt.id = match_edit_events.match_id
          )
          or exists (
            select 1
            from public.match_teams t
            join public.match_team_players p
              on p.match_team_id = t.id
            where t.match_id = match_edit_events.match_id
              and p.member_id = m.id
          )
        )
    )
  );
