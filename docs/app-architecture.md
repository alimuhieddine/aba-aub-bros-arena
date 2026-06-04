# ABA App Architecture Plan

This branch is for splitting the current single-file app into safer modules before adding more sport rating engines, activity points, and notifications.

## Current State

The app is a static browser app with most behavior in `app.js`:

- Supabase client setup
- auth and profile access
- admin review
- venues
- leagues
- matches and invitations
- team assignment
- scoring
- padel games
- soccer ratings
- rankings
- activity proof demo data
- UI binding and rendering

The safest migration strategy is to split by feature while preserving the current global function names until the full migration is complete.

## Target Structure

```text
app.js                         bootstrap and compatibility layer
js/
  supabase-client.js           Supabase URL/key/client setup
  state.js                     shared state, constants, app-level globals
  utils.js                     formatting, escaping, UUID cleanup, date helpers
  utils-runtime-bridge.js      temporary compatibility bridge after app.js loads
  ui.js                        tabs, modals, render orchestration
  auth.js                      login, signup, logout, profile, access UI
  admin.js                     pending members, maintenance tools
  venues.js                    venue CRUD and venue_sports
  leagues.js                   league CRUD, standings, league summaries
  matches.js                   match CRUD, invitations, filters, cards
  teams.js                     team assignment, captains, formations
  scoring.js                   score modal, finalize result, match points
  padel.js                     padel games, set validation, padel scoring
  activities.js                member activity submissions and approval
  notifications.js             in-app notification creation and reading
  ratings/
    index.js                   sport rating engine registry
    shared.js                  shared clamps, settings, history helpers
    soccer.js                  soccer expected-goals and position ratings
    padel.js                   padel rating engine
```

## Rating Engine Direction

Every sport-specific engine should eventually implement this shape:

```js
{
  engineKey: "soccer",
  settingsKey: "soccer_rating_settings",
  defaultSettings: {},
  loadSettings(sport),
  saveSettings(sport, settings),
  validateMatch(match),
  calculateAdjustments(match, context),
  applyAdjustments(match, adjustments)
}
```

The existing soccer engine is the first engine. Padel should be second because padel scoring already exists.

## Data Model Direction

Long-term shared tables should separate official match ratings from activity points:

- official matches affect sport ratings
- approved activities affect active points only
- external/community games submitted as activities do not affect ratings unless a future verified external match system is created

Planned tables:

```text
sport_rating_settings
match_rating_adjustments
member_activities
activity_point_rules
notifications
```

The current `app_settings` and `match_position_rating_adjustments` foundation remains valid while we migrate gradually.

## Migration Order

1. Extract pure helpers into `js/utils.js`.
2. Extract Supabase setup into `js/supabase-client.js`.
3. Extract auth/profile/access into `js/auth.js`.
4. Extract venues/admin basics into `js/admin.js` and `js/venues.js`.
5. Extract leagues and matches.
6. Extract teams and scoring.
7. Move soccer rating code from `app.js` into `js/ratings/soccer.js`.
8. Add generic rating registry in `js/ratings/index.js`.
9. Add activity points.
10. Add notifications.
11. Add padel rating engine.

## Safety Rules

- Keep one branch per migration phase.
- Avoid changing behavior while moving code.
- Preserve existing global function names until all inline `onclick` handlers are removed from HTML.
- Test login, admin tab, match creation, team assignment, scoring, rankings, and soccer recalculation after each phase.
- Do not add new sport rating formulas during the file split.

## Phase 1a: Utility Module

Added `js/utils.js` with pure helpers:

- `cleanUuidValue`
- `isValidUuidValue`
- `escapeHtml`
- `jsString`
- `fmtDate`
- `clampNumber`
- `averageValues`

The helpers are attached to `window.ABAUtils` and also exposed as globals for compatibility.

Added `js/utils-runtime-bridge.js` as a temporary compatibility bridge. It runs after `app.js` loads and rebinds the duplicate helper globals back to `window.ABAUtils`. This proves the extracted utilities can own the runtime behavior before we delete the duplicate helper definitions from `app.js`.

### Current Wire-Up

Load the utility module before `app.js`, then load the bridge after `app.js` in `index.html`:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/supabase-client.js?v=1"></script>
<script src="js/auth.js?v=1"></script>
<script src="js/admin.js?v=1"></script>
<script src="js/venues.js?v=1"></script>
<script src="js/leagues.js?v=1"></script>
<script src="js/matches.js?v=1"></script>
<script src="js/teams.js?v=1"></script>
<script src="js/utils.js?v=1"></script>
<script src="app.js?v=135"></script>
<script src="js/utils-runtime-bridge.js?v=1"></script>
<script src="js/auth-runtime-bridge.js?v=1"></script>
```

Startup has been manually tested with `js/utils.js`, `js/supabase-client.js`, and `js/utils-runtime-bridge.js` loaded. The app still loads.

Core flows have also been manually tested with the bridge loaded: login, admin, match work, team assignment, scoring, rankings, and soccer recalculation still work.

Keep the duplicate helper definitions in `app.js` until we can edit the large file through a proper local checkout or non-truncated patch path. The bridge keeps runtime behavior owned by `js/utils.js` in the meantime.

## Phase 1d: League Section Helpers

Added `js/leagues.js` for pure league helpers that do not touch standings, match counting, Supabase writes, or rating formulas.

Current ownership:

- league section default open/closed state
- league section localStorage keys
- league section open/closed persistence
- league section wrapper HTML

`app.js` keeps global wrappers for inline handlers and still owns league data loading, standings, rendering orchestration, and all match/rating interactions.

## Phase 1e: Match Invitation Helpers

Added `js/matches.js` for pure match helpers that do not touch match creation, voting, team assignment, scoring, Supabase writes, or rating formulas.

Current ownership:

- invitation status counts
- invitation member lookup
- external invitation detection
- external player invitation filtering
- filled player count
- remaining spot calculation
- match time overlap detection
- display status calculation
- status pill class calculation
- voting open check
- match editability check

`app.js` keeps global wrappers and still owns match data loading, filtering, cards, voting, time conflicts, team assignment, scoring, and rating interactions.

## Phase 1f: Team Side Helpers

Added `js/teams.js` for pure team lookup helpers that do not touch team assignment saves, captain behavior, formation validation, scoring, Supabase writes, or rating formulas.

Current ownership:

- team side lookup
- team side lookup from team id
- team side sort values
- team side labels
- ordered side sorting
- team name lookup by side
- current team map by member id
- current team-player map by member id

`app.js` keeps global wrappers and still owns team assignment UI, captain permissions, formation editing, soccer formation logic, scoring integration, and rating recalculation.

## Phase 1b: Supabase Client Module

Added `js/supabase-client.js` with the shared Supabase URL, publishable key, and client creation. The module exposes:

- `window.ABASupabase.url`
- `window.ABASupabase.key`
- `window.ABASupabase.client`
- `window.supabaseClient` as a compatibility global when one does not already exist

This module is intentionally non-breaking. `app.js` still has local `SUPABASE_URL`, `SUPABASE_KEY`, and `supabaseClient` constants until we can safely edit the large file. Future modules should use `window.ABASupabase.client`.

The module has been loaded after the Supabase SDK and before `app.js`; the app still loads.

## First Refactor Goal

The first code refactor should stay small:

- add `js/utils.js` done
- load `js/utils.js` before `app.js` done
- add `js/utils-runtime-bridge.js` done
- load `js/utils-runtime-bridge.js` after `app.js` done
- test app startup done
- test core admin and match flows done
- add `js/supabase-client.js` done
- load `js/supabase-client.js` after Supabase SDK and before `app.js` done
- remove duplicate helper/client definitions from `app.js` when a safe non-truncated edit path is available

This keeps risk low and proves the script loading pattern before larger feature modules are extracted.
