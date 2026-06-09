-- ABA soccer player performance assessments.
-- Run after members, sports, matches, match_teams, and member_sport_permissions exist.

create extension if not exists pgcrypto;

create table if not exists public.match_soccer_performance_assessments (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  assessor_member_id uuid not null references public.members(id) on delete cascade,
  assessed_member_id uuid not null references public.members(id) on delete cascade,
  sport_id uuid not null references public.sports(id) on delete cascade,
  position_name text not null check (position_name in ('GK', 'DEF', 'MID', 'ATT')),
  performance_score numeric(3,1) not null check (performance_score >= 1 and performance_score <= 10),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, assessor_member_id, assessed_member_id)
);

create index if not exists match_soccer_performance_assessments_match_idx
  on public.match_soccer_performance_assessments (match_id);

create index if not exists match_soccer_performance_assessments_assessed_idx
  on public.match_soccer_performance_assessments (assessed_member_id);

create or replace function public.can_assess_soccer_match(p_match_id uuid, p_sport_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with actor as (
    select public.current_member_id() as member_id, public.current_member_role() as role
  )
  select exists (
    select 1
    from actor a
    join public.members m on m.id = a.member_id
    join public.matches mt on mt.id = p_match_id
    join public.sports s on s.id = coalesce(p_sport_id, mt.sport_id)
    where m.approval_status = 'approved'
      and coalesce(p_sport_id, mt.sport_id) = mt.sport_id
      and mt.status <> 'cancelled'
      and mt.score_status = 'submitted'
      and (s.name ilike '%soccer%' or s.name ilike '%football%')
      and (
        a.role in ('owner', 'admin')
        or (
          a.role = 'committee'
          and exists (
            select 1
            from public.member_sport_permissions p
            where p.member_id = a.member_id
              and p.sport_id = mt.sport_id
              and p.permission = 'manage'
          )
          and exists (
            select 1
            from public.match_teams t
            join public.match_team_players tp on tp.match_team_id = t.id
            where t.match_id = mt.id
              and tp.member_id = a.member_id
          )
        )
      )
  );
$$;

grant execute on function public.can_assess_soccer_match(uuid, uuid) to authenticated;

alter table public.match_soccer_performance_assessments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'match_soccer_performance_assessments'
      and policyname = 'approved members can read soccer assessments'
  ) then
    create policy "approved members can read soccer assessments"
      on public.match_soccer_performance_assessments
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
      and tablename = 'match_soccer_performance_assessments'
      and policyname = 'eligible assessors can insert soccer assessments'
  ) then
    create policy "eligible assessors can insert soccer assessments"
      on public.match_soccer_performance_assessments
      for insert
      to authenticated
      with check (
        assessor_member_id = public.current_member_id()
        and public.can_assess_soccer_match(match_id, sport_id)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'match_soccer_performance_assessments'
      and policyname = 'eligible assessors can update own soccer assessments'
  ) then
    create policy "eligible assessors can update own soccer assessments"
      on public.match_soccer_performance_assessments
      for update
      to authenticated
      using (
        assessor_member_id = public.current_member_id()
        and public.can_assess_soccer_match(match_id, sport_id)
      )
      with check (
        assessor_member_id = public.current_member_id()
        and public.can_assess_soccer_match(match_id, sport_id)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'match_soccer_performance_assessments'
      and policyname = 'eligible assessors can delete own soccer assessments'
  ) then
    create policy "eligible assessors can delete own soccer assessments"
      on public.match_soccer_performance_assessments
      for delete
      to authenticated
      using (
        assessor_member_id = public.current_member_id()
        and public.can_assess_soccer_match(match_id, sport_id)
      );
  end if;
end $$;
