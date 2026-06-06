# send-match-reminders

Scheduled ABA match reminders.

Events:

- `same_day_match_reminder`: sent once per match/member to `IN` players on match day after 7:00 AM Asia/Beirut.
- `maybe_vote_deadline_reminder`: sent once per match/member to `MAYBE` players when voting deadline is within 3 hours and the match is not full.

Required SQL:

```sql
supabase/match-reminders.sql
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
- The function itself only sends same-day reminders after 7:00 AM Beirut and logs sent reminders to prevent duplicates.

Manual test:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-match-reminders" `
  -Headers @{ Authorization = "Bearer YOUR_REMINDER_CRON_SECRET" }
```
