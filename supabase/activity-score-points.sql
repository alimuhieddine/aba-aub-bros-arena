-- Split match points into activity points and score points.
-- Run this before deploying the activity/score points app change.

alter table public.match_member_points
  add column if not exists activity_points numeric not null default 0,
  add column if not exists score_points numeric not null default 0;

with calculated_points as (
  select distinct on (p.id)
    p.id,
    least(
      3,
      greatest(
        0,
        coalesce(floor(extract(epoch from (m.end_time - m.start_time)) / 1800.0), 0)
      )
    )::numeric as activity_points,
    case
      when mtp.id is null then 0
      when coalesce(mt.result, 'participated') = 'win' then 7
      when coalesce(mt.result, 'participated') = 'draw' then 2
      else 0
    end::numeric as score_points
  from public.match_member_points p
  join public.matches m
    on m.id = p.match_id
  left join public.match_teams mt
    on mt.match_id = m.id
  left join public.match_team_players mtp
    on mtp.team_id = mt.id
   and mtp.member_id = p.member_id
  order by p.id, (mtp.id is not null) desc
)
update public.match_member_points p
set
  activity_points = calculated_points.activity_points,
  score_points = calculated_points.score_points,
  base_points = calculated_points.activity_points + calculated_points.score_points,
  difficulty_factor = 1,
  consistency_bonus = 0
from calculated_points
where calculated_points.id = p.id;
