-- Rating grids need the same approved-member visibility as rankings.
-- This lets approved members, including sport committees, see all active approved
-- member names/avatars in the football rating table.

drop policy if exists "approved members can read rating member profiles"
  on public.members;

create policy "approved members can read rating member profiles"
  on public.members
  for select
  to authenticated
  using (
    approval_status = 'approved'
    and coalesce(is_active, true) = true
    and public.current_member_id() is not null
  );
