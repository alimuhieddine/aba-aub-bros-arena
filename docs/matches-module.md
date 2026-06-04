# Matches Module

`js/matches.js` owns small match helpers that can move out of `app.js` without changing behavior.

## Current Ownership

- invitation status counts
- invitation member lookup
- external invitation detection
- external player invitation filtering
- IN-player invitation filtering
- IN-player name list building
- filled player count
- remaining spot calculation
- match time overlap detection
- minutes-until-start calculation
- display status calculation
- status pill class calculation
- voting open check
- match editability check
- match formation open/closed storage key
- match formation open/closed persistence
- my-status classification
- match status filter classification
- match filter priority ordering

`app.js` still owns match Supabase queries, filtering, cards, voting, time conflicts, team assignment, scoring, and global compatibility wrappers used by inline handlers.

## Safety Notes

This module does not change match creation, voting, team assignment, scoring, soccer ratings, league standings, or Supabase writes. It is only a helper extraction for the gradual `app.js` split.
