-- ABA notification inbox.
-- Run before deploying the send-push inbox update.

create extension if not exists pgcrypto;

create table if not exists public.member_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_member_id uuid not null references public.members(id) on delete cascade,
  actor_member_id uuid references public.members(id) on delete set null,
  type text not null,
  title text not null,
  body text,
  url text,
  data jsonb not null default '{}'::jsonb,
  delivery_status text not null default 'queued'
    check (delivery_status in ('queued', 'sent', 'failed', 'no_subscription')),
  delivery_error text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists member_notifications_recipient_created_idx
  on public.member_notifications (recipient_member_id, created_at desc);

create index if not exists member_notifications_unread_idx
  on public.member_notifications (recipient_member_id, read_at)
  where read_at is null;

alter table public.member_notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_notifications'
      and policyname = 'approved members can read own notifications'
  ) then
    create policy "approved members can read own notifications"
      on public.member_notifications
      for select
      to authenticated
      using (
        recipient_member_id = public.current_member_id()
        and exists (
          select 1
          from public.members m
          where m.id = recipient_member_id
            and m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_notifications'
      and policyname = 'approved members can mark own notifications read'
  ) then
    create policy "approved members can mark own notifications read"
      on public.member_notifications
      for update
      to authenticated
      using (
        recipient_member_id = public.current_member_id()
      )
      with check (
        recipient_member_id = public.current_member_id()
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_notifications'
      and policyname = 'owners and admins can read all notifications'
  ) then
    create policy "owners and admins can read all notifications"
      on public.member_notifications
      for select
      to authenticated
      using (
        public.current_member_role() in ('owner', 'admin')
      );
  end if;
end $$;
