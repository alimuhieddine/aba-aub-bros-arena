# Padel Rating System

Padel uses one overall 1-10 rating per player in `member_sport_profiles.rating`.

It does not use soccer-style ATT/DEF/GK position ratings because the app only stores set scores, not point-by-point or shot-level stats.

## Rating Unit

Ratings update per completed padel game, not per set.

Both players on the same team receive the same rating delta for that game.

After results are saved, each player chip displays the combined padel overall rating change for that match as `OVR before->after (delta)`.

Player profiles show the current padel overall rating as `OVR` inside the player's Padel panel.

## Formula

Team rating:

```text
team_rating = average(player_1_rating, player_2_rating)
```

Expected win probability:

```text
expected = 1 / (1 + 10 ^ ((opponent_team_rating - team_rating) / 2))
```

Base delta:

```text
delta = 0.25 * (actual - expected)
```

Where:

- win actual = `1`
- loss actual = `0`

Set-score margin multiplier:

```text
margin_multiplier = clamp(1 + abs(total_games_won - total_games_lost) / 24, 0.85, 1.20)
```

Comeback bonus:

```text
+0.05 for the winning team only when it lost Set 1 and won the game
```

Final delta:

```text
final_delta = delta * margin_multiplier + comeback_bonus_if_any
```

Ratings are clamped to `1-10`.

## Comeback Detection

A comeback is detected when:

1. the game has at least 3 completed sets
2. the winning team lost the first completed set
3. the winning team won the game

## Migration

Run `supabase/padel-rating-engine.sql` before deploying this app change.

The migration adds `game_id` to `match_position_rating_adjustments` so each completed padel game can have its own audit rows.

## Recalculation

Use Admin > Maintenance Tools > Recalculate all finalized matches to rebuild padel ratings for completed padel games.
