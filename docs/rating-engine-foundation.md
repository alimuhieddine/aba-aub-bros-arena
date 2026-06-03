# Rating Engine Foundation

This branch adds the foundation needed before changing the ABA soccer rating engine.

## Added Files

- `supabase/rating-engine-foundation.sql`
- `soccer-rating-foundation.js`

## What It Fixes

- Moves soccer formula settings from per-browser `localStorage` to shared Supabase `app_settings`.
- Keeps localStorage only as a cache/fallback.
- Adds formula versioning through `app_settings.version`.
- Adds `formula_version` and `settings_snapshot` to `match_position_rating_adjustments`.
- Uses the existing min/max rating inputs to clamp position ratings.
- Allows one rating adjustment row per match/member/sport/position.
- Recalculates bulk finalized matches oldest-to-newest.

## Required Supabase Step

Run `supabase/rating-engine-foundation.sql` in the Supabase SQL editor before enabling the runtime file.

## Required HTML Wire-Up

Load the runtime patch immediately after `app.js` in `index.html`:

```html
<script src="app.js?v=135"></script>
<script src="soccer-rating-foundation.js?v=1"></script>
```

The connector used by Codex could create files and branches, but did not provide a partial edit operation for existing large files. This final one-line `index.html` wire-up still needs to be applied before the runtime changes execute in production.

## Test Checklist

1. Run the SQL migration.
2. Add the script tag to `index.html`.
3. Log in as an approved admin.
4. Open Admin and confirm the soccer formula status says it is shared and versioned.
5. Save formula settings and verify `public.app_settings` contains `soccer_rating_settings`.
6. Finalize or recalculate a soccer match.
7. Verify `match_position_rating_adjustments` rows include `formula_version` and `settings_snapshot`.
8. Run bulk soccer recalculation and confirm the confirmation prompt says oldest-to-newest.
