# Teams Module

`js/teams.js` owns small team helpers that can move out of `app.js` without changing behavior.

## Current Ownership

- team side lookup
- team side lookup from team id
- captain side lookup for a member
- team side sort values
- team side labels
- ordered side sorting
- team name lookup by side
- preferred team side order
- current team map by member id
- current team-player map by member id

`app.js` still owns team assignment UI, captain permissions, formation editing, soccer formation logic, scoring integration, and rating recalculation.

## Safety Notes

This module does not change team assignment saves, captain behavior, formation validation, scoring, soccer ratings, or Supabase writes. It is only a helper extraction for the gradual `app.js` split.
