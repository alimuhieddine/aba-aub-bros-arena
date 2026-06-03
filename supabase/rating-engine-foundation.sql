-- ABA rating engine foundation migration
-- Run this in the Supabase SQL editor before enabling shared soccer formula settings.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_by uuid references public.members(id),
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_settings'
      and policyname = 'approved members can read app settings'
  ) then
    create policy "approved members can read app settings"
      on public.app_settings
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.approval_status = 'approved'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_settings'
      and policyname = 'approved admins can manage app settings'
  ) then
    create policy "approved admins can manage app settings"
      on public.app_settings
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.members m
          where m.auth_user_id = auth.uid()
            and m.role = 'admin'
            and m.approval_status = 'approved'
        )
      )
      with check (
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

insert into public.app_settings (key, value, version)
values (
  'soccer_rating_settings',
  '{
    "rollingAverageWindow": 20,
    "minimumMatchesRequired": 10,
    "defaultAverageTotalGoals": 15,
    "attackConstant": 1.0,
    "defenseConstant": 1.0,
    "attAttackShare": 0.70,
    "midAttackShare": 0.30,
    "midDefenseShare": 0.15,
    "defDefenseShare": 0.50,
    "gkDefenseShare": 0.35,
    "winModifier": 0.10,
    "lossModifier": -0.10,
    "maxGain": 0.35,
    "maxLoss": 0.35,
    "minRating": 1,
    "maxRating": 10
  }'::jsonb,
  1
)
on conflict (key) do nothing;

alter table public.match_position_rating_adjustments
  add column if not exists formula_version integer,
  add column if not exists settings_snapshot jsonb;

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.match_position_rating_adjustments'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%match_id%'
      and pg_get_constraintdef(oid) ilike '%member_id%'
      and pg_get_constraintdef(oid) ilike '%sport_id%'
      and pg_get_constraintdef(oid) not ilike '%position_name%'
  loop
    execute format(
      'alter table public.match_position_rating_adjustments drop constraint %I',
      constraint_row.conname
    );
  end loop;
end $$;

create unique index if not exists match_position_rating_adjustments_match_member_sport_position_uidx
  on public.match_position_rating_adjustments (match_id, member_id, sport_id, position_name);
