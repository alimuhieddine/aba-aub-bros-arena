# Strava Integration

Run SQL first:

```sql
supabase/strava-integration.sql
supabase/member-body-profile.sql
```

Required Supabase secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REDIRECT_URI`
- `STRAVA_SYNC_SECRET`
- `APP_BASE_URL`

Suggested values for this project:

```text
STRAVA_REDIRECT_URI=https://welleqrjtlullhbdhive.supabase.co/functions/v1/strava-oauth-callback
APP_BASE_URL=https://alimuhieddine.github.io/aba-aub-bros-arena/
STRAVA_SYNC_SECRET=choose-a-long-random-secret
```

Deploy:

```powershell
& "C:\Users\alimu\Desktop\aba\supabase.exe" functions deploy strava-oauth-start
& "C:\Users\alimu\Desktop\aba\supabase.exe" functions deploy strava-oauth-callback
& "C:\Users\alimu\Desktop\aba\supabase.exe" functions deploy strava-disconnect
& "C:\Users\alimu\Desktop\aba\supabase.exe" functions deploy strava-activity-import --no-verify-jwt
```

Strava app callback domain:

```text
welleqrjtlullhbdhive.supabase.co
```

OAuth scope used:

```text
read,activity:read_all
```

The app's `Import Recent` button imports recent activities for the logged-in member.

For near-automatic sync, schedule `strava-activity-import` every 15-30 minutes with:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "https://welleqrjtlullhbdhive.supabase.co/functions/v1/strava-activity-import" `
  -Headers @{ Authorization = "Bearer YOUR_STRAVA_SYNC_SECRET" } `
  -Body (@{ days = 3 } | ConvertTo-Json) `
  -ContentType "application/json"
```

Auto-approval rules:

- Duration must be 10-360 minutes.
- The member must have a valid weight in their profile.
- Activity is auto-approved when it has calories >= 30 or distance >= 200 m.
- Activities missing those signals are imported as pending for admin review.

Points formula:

```text
points = min(6, calories / weight_kg * 0.30 * 1.20)
```

If a member has no saved weight, the import uses 75 kg as a fallback for previewing points, but the activity stays pending for admin review.

When a player has an approved Strava activity that overlaps a match they played, the app uses the Strava activity points instead of the estimated match duration points the next time match points are saved or recalculated.
