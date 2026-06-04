# Scoring Module

`js/scoring.js` owns small scoring helpers that can move out of `app.js` without changing behavior.

## Current Ownership

- score entry lookup by optional entry type
- score entry lookup by linked game id

`app.js` still owns score modal UI, padel set parsing, score saving, result finalization, match point persistence, soccer rating recalculation, and global compatibility wrappers.

## Safety Notes

This module does not change score writes, result finalization, match points, soccer ratings, rating formulas, or Supabase writes. It is only a read-only helper extraction for the gradual `app.js` split.
