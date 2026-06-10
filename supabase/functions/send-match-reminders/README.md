# send-match-reminders

Scheduled ABA match reminders.

Each reminder also creates a `member_notifications` inbox row, so members can see it in ABA even when the browser has no active push subscription.

Events:

- `same_day_match_reminder`: sent once per match/member to `IN` players on match day after 7:00 AM Asia/Beirut.
- `maybe_vote_deadline_reminder`: sent once per match/member to `MAYBE` players when voting deadline is within 3 hours and the match is not full.
- `match_result_pending_reminder`: sent once per match/member to approved owners/admins, sport committee managers for that match sport, and the match creator when a match ended more than 30 minutes ago and still has no submitted result.

Required SQL:

```sql
supabase/match-reminders.sql
supabase/notification-inbox.sql
```

Required secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `REMINDER_CRON_SECRET`

Deploy:

```powershell
& "C:\Users\alimu\Desktop\aba\supabase.exe" functions deploy send-match-reminders
```

Recommended schedule:

- Run every 30 minutes.
- The function itself only sends same-day reminders after 7:00 AM Beirut, checks awaiting-result matches from the last 72 hours, and logs sent reminders to prevent duplicates.

Manual test:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-match-reminders" `
  -Headers @{ Authorization = "Bearer YOUR_REMINDER_CRON_SECRET" }
```
