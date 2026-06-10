-- ABA member body profile fields for verified activity calculations.
-- Run after the members table exists.

alter table public.members
  add column if not exists gender text,
  add column if not exists height_cm numeric(5,1),
  add column if not exists weight_kg numeric(5,1);

alter table public.members
  drop constraint if exists members_gender_check,
  drop constraint if exists members_height_cm_check,
  drop constraint if exists members_weight_kg_check;

alter table public.members
  add constraint members_gender_check
    check (gender is null or gender in ('male', 'female')),
  add constraint members_height_cm_check
    check (height_cm is null or (height_cm >= 100 and height_cm <= 230)),
  add constraint members_weight_kg_check
    check (weight_kg is null or (weight_kg >= 30 and weight_kg <= 250));
