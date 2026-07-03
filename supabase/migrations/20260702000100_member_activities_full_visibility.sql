drop policy if exists "approved members can read own and approved activities" on public.member_activities;
drop policy if exists "approved members can read all activities" on public.member_activities;

create policy "approved members can read all activities"
  on public.member_activities
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
