# Leagues Module

`js/leagues.js` owns small league helpers that can move out of `app.js` without changing behavior.

## Current Ownership

- league dashboard section default open/closed state
- league section localStorage keys
- league section open/closed persistence
- league section wrapper HTML

`app.js` still owns league Supabase queries, linked match/game calculations, standings, rendering orchestration, and global compatibility wrappers used by inline handlers.

## Safety Notes

This module does not change league scoring, soccer ratings, match counting, or Supabase writes. It is only a helper extraction for the gradual `app.js` split.
