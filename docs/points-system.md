# Points System

ABA match points are split into activity points and score points.

## Match Activity Points

Match activity points reward showing up for a scheduled match.

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

The current persisted implementation applies this formula to finalized match point rows.

## Logged Activity Points

The Activity tab lets members log non-match sport activity with proof. Logged activity points are awarded only after admin approval.

Logged activities use continuous duration and admin-configurable sport intensity:

```text
activity_points = min(activity_cap, (duration_minutes / 30) * sport_intensity_rate)
```

Default rates before admin customization:

- high intensity sports: `1.0` point per 30 minutes
- medium activities such as gym/weightlifting/volleyball: `0.7` points per 30 minutes
- low intensity activities such as walking/stretching/yoga: `0.3` points per 30 minutes

Default cap:

- `3` points per logged activity

Examples with cap `3`:

- 25 min running at `1.0`: `0.83`
- 60 min gym at `0.7`: `1.40`
- 60 min walking at `0.3`: `0.60`
- 90 min padel at `1.0`: `3.00`

Logged activities add activity points only. They do not add score points, wins/draws/losses, or rating changes.

Proof files are uploaded to a private Supabase Storage bucket and reviewed by admins before points count.

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

`member_activities` stores approved non-match activity points separately. Rankings and player profiles add approved `member_activities.activity_points` to activity and total points.

## Migration

Run `supabase/activity-score-points.sql` before deploying the match point split.

Run `supabase/activity-logging.sql` before deploying logged activities.

After running the migration, use the admin Maintenance Tools button `Recalculate all points` to rebuild finalized match point rows with the current formula.
