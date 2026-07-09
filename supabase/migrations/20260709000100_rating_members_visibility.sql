-- Rating grids need the same approved-member visibility as rankings.
-- This lets approved members, including sport committees, see all active approved
-- member names/avatars in the football rating table.

do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename = 'members'
       and policyname = 'approved members can read rating member profiles'
  ) then
    create policy "approved members can read rating member profiles"
      on public.members
      for select
      to authenticated
      using (
        approval_status = 'approved'
        and coalesce(is_active, true) = true
        and exists (
          select 1
            from public.members viewer
           where viewer.auth_user_id = auth.uid()
             and viewer.approval_status = 'approved'
             and coalesce(viewer.is_active, true) = true
        )
      );
  end if;
end $$;
