# Feature Change Checklist

Use this checklist before adding or changing app features after the `app.js` cleanup work.

## Start Here

1. Branch from `codex/rating-engine-foundation`.
2. Keep each PR focused on one feature or one cleanup.
3. Check whether a helper already belongs in one of the small modules before adding more logic to `app.js`.

Current helper modules:

- `js/utils.js` and `js/utils-runtime-bridge.js`: shared utility helpers and compatibility globals.
- `js/auth.js` and `js/auth-runtime-bridge.js`: auth state helpers and compatibility globals.
- `js/admin.js`: admin and venue-management helpers.
- `js/venues.js`: venue lookup and sport support helpers.
- `js/leagues.js`: league display and pure league helpers.
- `js/matches.js`: match status, timing, filtering, invitation, and sport helpers.
- `js/teams.js`: team side, captain, editability, formation title, and assigned-player helpers.
- `js/scoring.js`: read-only scoring helpers and score summary display helpers.

The current activity/score points formula is documented in `docs/points-system.md`.

## Sensitive Areas

Treat these areas as high-risk and test them directly when touched:

- score submission and result finalization
- match point recalculation
- soccer rating formulas and soccer position rating writes
- soccer formula settings saved in `app_settings`
- rating audit rows in `match_position_rating_adjustments`
- auth gating and admin-only behavior
- venue support filtering
- team assignment and formation editing after finalization

## Rating Engine Guardrails

Do not mix rating-engine behavior changes with UI cleanup.

When changing ratings, include explicit tests or manual verification for:

- formula settings load/save
- finalized match recalculation
- formation edit recalculation
- rollback of previous rating adjustments
- `member_sport_position_ratings` updates
- `match_position_rating_adjustments` audit data

## Scoring Guardrails

Keep display helpers separate from write helpers.

When changing scoring, verify:

- simple score submit
- padel set validation
- save/continue/delete padel game
- finalize result
- submitted score summary display
- points saved for both teams
- soccer ratings are updated only through the intended finalization/recalculation path

## Lightweight Checks

Run these before opening a PR:

```powershell
node --check app.js
node --check js/utils.js
node --check js/auth.js
node --check js/admin.js
node --check js/venues.js
node --check js/leagues.js
node --check js/matches.js
node --check js/teams.js
node --check js/scoring.js
```

For module extractions, also run a small runtime smoke check that verifies the moved helpers are exported on their `window.ABA*` namespace.

## PR Notes

Every PR should say:

- what changed
- what behavior was intentionally not changed
- which sensitive areas were untouched
- which checks or manual tests were run
