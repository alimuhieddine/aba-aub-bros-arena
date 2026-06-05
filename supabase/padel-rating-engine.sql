-- Padel overall rating engine support.
-- Run this before deploying the padel rating app change.

alter table public.match_position_rating_adjustments
  add column if not exists game_id uuid references public.match_games(id) on delete cascade;

do $$
declare
  constraint_name text;
begin
  select conname
    into constraint_name
  from pg_constraint
  where conrelid = 'public.match_position_rating_adjustments'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) like '%match_id%'
    and pg_get_constraintdef(oid) like '%member_id%'
    and pg_get_constraintdef(oid) like '%sport_id%'
    and pg_get_constraintdef(oid) like '%position_name%'
  limit 1;

  if constraint_name is not null then
    execute format(
      'alter table public.match_position_rating_adjustments drop constraint %I',
      constraint_name
    );
  end if;
end $$;

drop index if exists match_position_rating_adjustments_match_member_sport_position_uidx;

create unique index if not exists match_position_rating_adjustments_match_game_member_sport_position_uidx
  on public.match_position_rating_adjustments (
    match_id,
    coalesce(game_id, '00000000-0000-0000-0000-000000000000'::uuid),
    member_id,
    sport_id,
    position_name
  );
