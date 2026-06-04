# Auth Runtime Bridge

This branch adds a tiny compatibility bridge for the auth module.

## Added

`js/auth-runtime-bridge.js` runs after `app.js` and delegates safe global helpers to `window.ABAAuth`:

- `cacheProfileAccess(profile)`
- `setProfileStatusText(profile)`

## Why Only These Helpers

Some auth functions in `app.js` depend on private top-level `let` state such as `currentProfile`. A runtime bridge loaded after `app.js` cannot safely read that state. Those functions stay in `app.js` until we can edit the large file directly.

## Script Order

The bridge is loaded after `app.js` and after the utility bridge:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/supabase-client.js?v=1"></script>
<script src="js/auth.js?v=1"></script>
<script src="js/utils.js?v=1"></script>
<script src="app.js?v=135"></script>
<script src="js/utils-runtime-bridge.js?v=1"></script>
<script src="js/auth-runtime-bridge.js?v=1"></script>
```

## Manual Test Result

Ali confirmed the bridge is loaded and these flows still work:

- app loads
- login works
- logout works
- account/profile status text updates correctly
- admin tab visibility works
- non-admin users do not see admin-only data

## Next Step

This bridge can be merged as another checkpoint. The next larger step should be a proper local edit of `app.js` to replace duplicated auth helper definitions with calls to `window.ABAAuth`.
