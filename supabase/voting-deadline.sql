-- ABA match voting deadline foundation
-- Run before deploying the voting deadline app update.

alter table public.matches
  add column if not exists voting_deadline_at timestamptz;

update public.matches
set voting_deadline_at = start_time - interval '24 hours'
where voting_deadline_at is null
  and start_time is not null;

create index if not exists matches_voting_deadline_at_idx
  on public.matches(voting_deadline_at);
