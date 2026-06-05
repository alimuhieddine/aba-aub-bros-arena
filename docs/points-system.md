# Points System

ABA match points are split into activity points and score points.

## Activity Points

Activity points reward showing up for a scheduled activity.

```text
x = min(3, floor(activity_duration_hours / 0.5))
```

Examples:

- under 30 minutes: 0 activity points
- 30 minutes: 1 activity point
- 60 minutes: 2 activity points
- 90 minutes: 3 activity points
- longer than 90 minutes: 3 activity points

If the duration is missing or invalid, the app falls back to 0 activity points.

The current persisted implementation applies this formula to finalized match point rows. The local Proof demo also uses the same duration rule for non-match activity cards. A future Supabase-backed non-match activity feature should store the same `activity_points` value and keep `score_points` at `0`.

## Match Score Points

For matches, score points are added on top of activity points:

- loss: `+0`
- draw: `+2`
- win: `+7`

So a normal 90-minute match gives:

- loss: `3`
- draw: `5`
- win: `10`

## Stored Fields

`match_member_points` stores:

- `activity_points`: duration-based participation points
- `score_points`: win/draw/loss points
- `base_points`: compatibility total for existing generated totals
- `difficulty_factor`: currently `1`
- `consistency_bonus`: currently `0`
- `total_points`: existing legacy/generated total field

When `activity_points` or `score_points` are present, rankings and profiles read `activity_points + score_points` as the authoritative total. `total_points` is only a fallback for older rows.

## Migration

Run `supabase/activity-score-points.sql` before deploying this app change.

After running the migration, use the admin Maintenance Tools button `Recalculate all points` to rebuild finalized match point rows with the current formula.
