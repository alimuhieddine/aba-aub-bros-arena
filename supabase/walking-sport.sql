-- Add Walking as an activity-only sport.
-- After running this once in Supabase SQL editor, Walking will appear
-- automatically in the activity sport dropdown and use the app's
-- default low-intensity rate of 0.3.

insert into public.sports (name)
select 'Walking'
where not exists (
  select 1
  from public.sports
  where lower(name) = 'walking'
);
