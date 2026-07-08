-- Allow approved members to read sport-manager assignments.
-- The app uses this list only to calculate public football position rating averages
-- with default 5 values for committee members who have not voted yet.

do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename = 'member_sport_permissions'
       and policyname = 'approved members can read sport manager assignments'
  ) then
    create policy "approved members can read sport manager assignments"
      on public.member_sport_permissions
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
end $$;
