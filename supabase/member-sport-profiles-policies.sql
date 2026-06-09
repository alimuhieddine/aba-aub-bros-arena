-- Allow approved members to read sport profiles, and allow privileged users
-- to create/update profile rows needed by match rating recalculations.
-- Run after members, sports, member_sport_profiles, and member_sport_permissions exist.

alter table public.member_sport_profiles enable row level security;

drop policy if exists "approved members can read sport profiles" on public.member_sport_profiles;
create policy "approved members can read sport profiles"
  on public.member_sport_profiles
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

drop policy if exists "approved members can manage own sport profile" on public.member_sport_profiles;
create policy "approved members can manage own sport profile"
  on public.member_sport_profiles
  for all
  to authenticated
  using (
    member_id = public.current_member_id()
    and exists (
      select 1
      from public.members viewer
      where viewer.id = public.current_member_id()
        and viewer.approval_status = 'approved'
    )
  )
  with check (
    member_id = public.current_member_id()
    and exists (
      select 1
      from public.members viewer
      where viewer.id = public.current_member_id()
        and viewer.approval_status = 'approved'
    )
  );

drop policy if exists "approved admins and committees can manage sport profiles" on public.member_sport_profiles;
create policy "approved admins and committees can manage sport profiles"
  on public.member_sport_profiles
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
            and exists (
              select 1
              from public.member_sport_permissions permission
              where permission.member_id = actor.id
                and permission.sport_id = member_sport_profiles.sport_id
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
            and exists (
              select 1
              from public.member_sport_permissions permission
              where permission.member_id = actor.id
                and permission.sport_id = member_sport_profiles.sport_id
                and permission.permission = 'manage'
            )
          )
        )
    )
  );
