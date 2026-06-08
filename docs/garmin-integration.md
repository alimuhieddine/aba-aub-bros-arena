# Garmin Connect Integration

ABA supports Garmin activity import through Supabase Edge Functions.

## Required Supabase Setup

Run:

```sql
-- supabase/garmin-integration.sql
```

Deploy these Edge Functions:

```text
garmin-oauth-start
garmin-oauth-callback
garmin-disconnect
garmin-activity-sync
```

Set these function secrets:

```text
GARMIN_CLIENT_ID
GARMIN_CLIENT_SECRET
GARMIN_REDIRECT_URI=https://<project-ref>.supabase.co/functions/v1/garmin-oauth-callback
APP_BASE_URL=https://<your-aba-app-url>
GARMIN_WEBHOOK_SECRET=<shared secret for activity sync>
```

## Flow

1. Member opens Account and clicks Connect Garmin.
2. `garmin-oauth-start` creates a PKCE OAuth state and returns Garmin's consent URL.
3. Garmin redirects to `garmin-oauth-callback`.
4. ABA stores visible connection status in `member_garmin_connections`.
5. ABA stores private OAuth tokens in `member_garmin_tokens`.
6. Garmin activity payloads sent to `garmin-activity-sync` create `member_activities` rows with `source = 'garmin'`.

Garmin imports are saved as `pending` by default so the existing admin approval workflow still controls points.
