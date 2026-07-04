create table if not exists public.member_sport_rating_notes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  committee_member_id uuid not null references public.members(id) on delete cascade,
  sport_id uuid not null references public.sports(id) on delete cascade,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, sport_id, committee_member_id)
);

create index if not exists member_sport_rating_notes_member_idx
  on public.member_sport_rating_notes (member_id);

create index if not exists member_sport_rating_notes_committee_idx
  on public.member_sport_rating_notes (committee_member_id);

create index if not exists member_sport_rating_notes_sport_idx
  on public.member_sport_rating_notes (sport_id);

create or replace function public.touch_member_sport_rating_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_member_sport_rating_notes_updated_at
  on public.member_sport_rating_notes;

create trigger touch_member_sport_rating_notes_updated_at
before update on public.member_sport_rating_notes
for each row
execute function public.touch_member_sport_rating_notes_updated_at();

alter table public.member_sport_rating_notes enable row level security;

do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename = 'member_sport_rating_notes'
       and policyname = 'approved members can read sport rating notes'
  ) then
    create policy "approved members can read sport rating notes"
      on public.member_sport_rating_notes
      for select
      to authenticated
      using (
        exists (
          select 1
            from public.members viewer
           where viewer.auth_user_id = auth.uid()
             and viewer.approval_status = 'approved'
        )
      );
  end if;

  if not exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename = 'member_sport_rating_notes'
       and policyname = 'committees and admins can manage sport rating notes'
  ) then
    create policy "committees and admins can manage sport rating notes"
      on public.member_sport_rating_notes
      for all
      to authenticated
      using (
        exists (
          select 1
            from public.members actor
           where actor.id = public.current_member_id()
             and actor.approval_status = 'approved'
             and (
               actor.role in ('owner', 'admin')
               or (
                 actor.role = 'committee'
                 and actor.id = committee_member_id
                 and exists (
                   select 1
                     from public.member_sport_permissions permission
                    where permission.member_id = actor.id
                      and permission.sport_id = member_sport_rating_notes.sport_id
                      and permission.permission = 'manage'
                 )
               )
             )
        )
      )
      with check (
        exists (
          select 1
            from public.members actor
           where actor.id = public.current_member_id()
             and actor.approval_status = 'approved'
             and (
               actor.role in ('owner', 'admin')
               or (
                 actor.role = 'committee'
                 and actor.id = committee_member_id
                 and exists (
                   select 1
                     from public.member_sport_permissions permission
                    where permission.member_id = actor.id
                      and permission.sport_id = member_sport_rating_notes.sport_id
                      and permission.permission = 'manage'
                 )
               )
             )
        )
      );
  end if;
end $$;
