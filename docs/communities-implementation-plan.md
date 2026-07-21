# Communities Implementation Plan

## Goal

Move ABA from one global friend group to multiple isolated communities without leaking matches, activities, ratings, notes, or admin controls across communities.

## Phase 1: Add Foundation

- Add `communities`, `community_memberships`, `community_sport_permissions`, and `community_invitations`.
- Add nullable `community_id` to `matches`, `leagues`, `venues`, and `member_activities`.
- Keep current global policies active until the app has a selected community context.
- Backfill the current ABA group as the first community before enforcing isolation.

## Phase 2: App Context

- Load the signed-in member's active communities after profile approval.
- Store `activeCommunityId` in local state.
- Add a community switcher in the header/account area.
- Every create flow writes `community_id`.
- Every list/query filters by `activeCommunityId`.

## Phase 3: Permission Migration

- Replace global role checks with community role checks:
  - owner/admin inside the active community
  - sport committee inside the active community and sport
  - member inside the active community
- Keep platform owner controls separate from community owner controls.

## Phase 4: RLS Tightening

- Replace broad policies like "approved members can read all activities" with community membership policies.
- Scope match, activity, rating, notification, league, and venue reads by community.
- Add explicit cross-community match visibility for invited public players.

## Phase 5: Cross-Community Features

- Public player profile opt-in.
- External community invitations to specific matches.
- Cross-community leagues.
- Venue collaboration and booking APIs.

## Important Rule

Do not enforce community RLS until every existing row has a valid `community_id`, otherwise current data can disappear from the app.
