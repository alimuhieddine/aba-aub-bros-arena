-- Stores the formula breakdown used for each saved rating adjustment.
-- Run once before relying on persisted rating "why" details after refresh.

alter table public.match_position_rating_adjustments
  add column if not exists formula_meta jsonb;

comment on column public.match_position_rating_adjustments.formula_meta is
  'JSON breakdown of the soccer rating formula inputs and components used for this adjustment.';
