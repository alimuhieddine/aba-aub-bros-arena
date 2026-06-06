-- ABA scheduled match reminder support.
-- Run this before deploying/scheduling supabase/functions/send-match-reminders.

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  match_id uuid references public.matches(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  sent_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists notification_log_event_match_member_uidx
  on public.notification_log(event_type, match_id, member_id);

create index if not exists notification_log_member_idx
  on public.notification_log(member_id);

create index if not exists notification_log_match_idx
  on public.notification_log(match_id);

alter table public.notification_log enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_log'
      and policyname = 'approved admins can read notification log'
  ) then
    create policy "approved admins can read notification log"
      on public.notification_log
      for select
      using (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.role = 'admin'
            and m.approval_status = 'approved'
        )
      );
  end if;
end $$;
