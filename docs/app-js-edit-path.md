# app.js Safe Edit Path

This plan defines how to start removing duplicated code from the large `app.js` file without risking accidental rewrites.

## Current Constraint

The GitHub connector can read small ranges from `app.js`, but whole-file reads are truncated in this session. Because GitHub content updates replace the whole file, we should not rewrite `app.js` through the connector unless we have the complete file content from a reliable local checkout.

## Required Edit Path

Use one of these safe paths before editing `app.js` directly:

1. Work from a local git checkout where `app.js` can be patched with normal file tools.
2. Use a tool that can apply a real line-based patch to GitHub without replacing the whole file.
3. Split future changes into new modules and bridges only when direct `app.js` edits are not required.

Preferred path: local git checkout.

## Local Checkout Checklist

Before editing:

- confirm `git` is installed locally
- clone or open `alimuhieddine/aba-aub-bros-arena`
- checkout the base branch `codex/rating-engine-foundation`
- create a branch for exactly one cleanup step
- verify `index.html` loads the current modules and bridge scripts

Recommended branch names:

- `codex/app-js-utils-cleanup`
- `codex/app-js-auth-cleanup`
- `codex/app-js-venues-cleanup`

## First Cleanup: Utility Duplicates

The first direct `app.js` cleanup should remove duplicate helper definitions now owned by `js/utils.js` and `js/utils-runtime-bridge.js`.

Known duplicate blocks in `app.js` from earlier inspection:

- `function cleanUuidValue` near line 10
- `function isValidUuidValue` near line 22
- `const fmtDate = ...` near line 1468
- `function escapeHtml` near line 1478
- `function jsString` near line 1487
- `function averageValues` near line 5138
- `function clampNumber` near line 7077

After removal, existing references should still work because:

- `js/utils.js` defines the helpers on `window.ABAUtils`
- `js/utils-runtime-bridge.js` rebinds global helper names after `app.js` loads

## Second Cleanup: Auth Duplicates

After utilities are cleaned up and tested, replace duplicate auth helper behavior with `window.ABAAuth` where safe.

Candidate functions and constants:

- cached access key usage: `aba_user_access`
- profile status text logic
- `cacheProfileAccess(profile)`
- small role/status helpers if they can be replaced without accessing private `let` state

Do not remove or replace functions that depend on private `app.js` state until they are extracted fully:

- `isCurrentUserAdmin()`
- `applyAccessUI()`
- `refreshAuthUI()`
- `loadMyProfile()`
- `saveProfile()`

## Third Cleanup: Admin/Venues Duplicates

After auth cleanup is tested, move pure admin and venue helper logic toward:

- `window.ABAAdmin`
- `window.ABAVenues`

Good candidates:

- pending member select string
- review payload construction
- venue select string
- venue payload construction
- venue sport row construction
- venue sport name/id extraction

Leave DOM-heavy rendering in `app.js` until a larger UI extraction branch.

## Test Checklist After Each app.js Cleanup

After each small cleanup branch, test:

- app loads
- login works
- logout works
- account/profile tab loads
- admin tab visibility works
- pending members load
- venue list loads
- create/edit venue works
- venue sport checkbox save works
- matches load
- team assignment works
- scoring works
- rankings load
- soccer recalculation works

## Stop Rule

If a cleanup causes any runtime issue, revert only that cleanup branch and keep the already merged modules. The bridge/module architecture allows us to stop safely without losing the feature work.

## Next Recommended PR

Create `codex/app-js-utils-cleanup` from `codex/rating-engine-foundation` and remove only the utility duplicate blocks listed above. Do not combine it with auth, admin, venues, or rating changes.
