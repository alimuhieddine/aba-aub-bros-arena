# send-push Edge Function

Sends ABA web push notifications to saved `member_push_subscriptions`.

Supported notification types:

- `test_push`: sends a test notification to the authenticated member.
- `match_invite`: sends match invite notifications to newly invited members.
- `creator_vote_changed`: notifies the match creator when an invited player changes vote.
- `creator_game_full`: notifies the match creator when the match becomes full.

## Required secrets

Set these in Supabase before deploying/running the function:

```bash
supabase secrets set VAPID_PUBLIC_KEY="YOUR_PUBLIC_KEY"
supabase secrets set VAPID_PRIVATE_KEY="YOUR_PRIVATE_KEY"
supabase secrets set VAPID_SUBJECT="mailto:your-email@example.com"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
```

The public key should also be saved in `public.app_settings`:

```sql
update public.app_settings
set value = jsonb_build_object(
  'enabled', true,
  'public_key', 'YOUR_PUBLIC_VAPID_KEY'
),
version = version + 1,
updated_at = now()
where key = 'push_notifications';
```

## Deploy

```bash
supabase functions deploy send-push
```
