# Rating Engine Foundation

This branch adds the foundation needed before changing the ABA soccer rating engine.

## Added Files

- `supabase/rating-engine-foundation.sql`

## What It Fixes

- Moves soccer formula settings from per-browser `localStorage` to shared Supabase `app_settings`.
- Keeps localStorage only as a cache/fallback.
- Adds formula versioning through `app_settings.version`.
- Adds `formula_version` and `settings_snapshot` to `match_position_rating_adjustments`.

## Required Supabase Step

Run `supabase/rating-engine-foundation.sql` in the Supabase SQL editor before using shared soccer formula settings and adjustment audit fields.

## Runtime Status

The temporary `soccer-rating-foundation.js` runtime patch has been retired. Shared soccer formula settings and adjustment audit data are now handled directly in `app.js`.

## Test Checklist

1. Run the SQL migration.
2. Log in as an approved admin.
3. Open Admin and confirm the soccer formula status says it is shared and versioned.
4. Save formula settings and verify `public.app_settings` contains `soccer_rating_settings`.
5. Finalize or recalculate a soccer match.
6. Verify `match_position_rating_adjustments` rows include `formula_version` and `settings_snapshot`.
