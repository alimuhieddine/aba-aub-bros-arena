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
soccer-rating-foundation.js    temporary shared soccer formula patch
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
7. Move soccer rating code from `app.js` and `soccer-rating-foundation.js` into `js/ratings/soccer.js`.
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
<script src="js/utils.js?v=1"></script>
<script src="app.js?v=135"></script>
<script src="js/utils-runtime-bridge.js?v=1"></script>
<script src="soccer-rating-foundation.js?v=1"></script>
```

Startup has been manually tested with `js/utils.js` and `js/utils-runtime-bridge.js` loaded. The app still loads.

Core flows have also been manually tested with the bridge loaded: login, admin, match work, team assignment, scoring, rankings, and soccer recalculation still work.

Keep the duplicate helper definitions in `app.js` until we can edit the large file through a proper local checkout or non-truncated patch path. The bridge keeps runtime behavior owned by `js/utils.js` in the meantime.

## First Refactor Goal

The first code refactor should stay small:

- add `js/utils.js` done
- load `js/utils.js` before `app.js` done
- add `js/utils-runtime-bridge.js` done
- load `js/utils-runtime-bridge.js` after `app.js` done
- test app startup done
- test core admin and match flows done
- remove duplicate helper definitions from `app.js` when a safe non-truncated edit path is available

This keeps risk low and proves the script loading pattern before larger feature modules are extracted.
