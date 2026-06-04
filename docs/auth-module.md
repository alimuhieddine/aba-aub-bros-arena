# Auth Module Phase

This branch starts extracting auth/profile/access logic from `app.js` without changing runtime behavior yet.

## Added

`js/auth.js` exposes `window.ABAAuth` with pure auth/profile helpers:

- `ACCESS_CACHE_KEY`
- `EMAIL_REDIRECT_URL`
- `approvalStatus(profile)`
- `role(profile)`
- `isApprovedProfile(profile)`
- `isAdminProfile(profile)`
- `isRestrictedProfile(profile)`
- `accessSnapshot(profile)`
- `cacheProfileAccess(profile)`
- `cachedProfileAccess()`
- `clearCachedProfileAccess()`
- `profileStatusText(profile)`

## Why This Is Safe

The module does not replace existing `app.js` functions yet. It only creates a namespaced helper object for future extracted auth code to use.

`app.js` still owns:

- sign up
- login
- logout
- profile loading
- profile saving
- access UI rendering
- active tab restoration

## Script Order

`js/auth.js` is loaded after the Supabase client module and before `app.js`:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/supabase-client.js?v=1"></script>
<script src="js/auth.js?v=1"></script>
<script src="js/utils.js?v=1"></script>
<script src="app.js?v=135"></script>
<script src="js/utils-runtime-bridge.js?v=1"></script>
```

## Manual Test Result

Ali confirmed the auth module script is loaded and these flows still work:

- app loads
- login works
- logout works
- account/profile tab loads
- admin tab visibility works for admin users
- non-admin users do not see admin-only data

## Next Step

The next micro-step is to create a runtime bridge that lets existing `app.js` auth helper behavior delegate to `window.ABAAuth` where safe.

We should still avoid large `app.js` rewrites until a proper local checkout or non-truncated patch path is available.
