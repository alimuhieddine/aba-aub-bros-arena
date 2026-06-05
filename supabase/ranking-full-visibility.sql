do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'members'
      and policyname = 'approved members can read ranking member profiles'
  ) then
    create policy "approved members can read ranking member profiles"
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

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'match_member_points'
      and policyname = 'approved members can read finalized ranking points'
  ) then
    create policy "approved members can read finalized ranking points"
      on public.match_member_points
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.members viewer
          where viewer.auth_user_id = auth.uid()
            and viewer.approval_status = 'approved'
            and coalesce(viewer.is_active, true) = true
        )
        and exists (
          select 1
          from public.matches m
          where m.id = match_member_points.match_id
            and coalesce(m.status, '') <> 'cancelled'
            and (
              m.score_status = 'submitted'
              or m.status = 'completed'
            )
        )
      );
  end if;
end $$;
