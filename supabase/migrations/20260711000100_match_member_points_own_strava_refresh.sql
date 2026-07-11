-- Let approved members refresh their own finalized match point row after a
-- Strava activity is imported and linked to a match they played.

do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename = 'match_member_points'
       and policyname = 'approved members can refresh own finalized match points'
  ) then
    create policy "approved members can refresh own finalized match points"
      on public.match_member_points
      for all
      to authenticated
      using (
        member_id = public.current_member_id()
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
        and exists (
          select 1
            from public.match_invitations invitation
           where invitation.match_id = match_member_points.match_id
             and invitation.member_id = match_member_points.member_id
             and invitation.status = 'in'
        )
      )
      with check (
        member_id = public.current_member_id()
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
        and exists (
          select 1
            from public.match_invitations invitation
           where invitation.match_id = match_member_points.match_id
             and invitation.member_id = match_member_points.member_id
             and invitation.status = 'in'
        )
      );
  end if;
end $$;
