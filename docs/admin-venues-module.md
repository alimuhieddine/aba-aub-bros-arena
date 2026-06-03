# Admin And Venues Module Phase

This branch starts extracting admin and venue helper logic from `app.js` without changing runtime behavior yet.

## Added

`js/admin.js` exposes `window.ABAAdmin` with admin helpers:

- `isAdminProfile(profile)`
- `canReviewMembers(profile)`
- `memberReviewPayload(decision, reviewerId)`
- `pendingMemberSelect()`
- `adminOnlySelector()`

`js/venues.js` exposes `window.ABAVenues` with venue helpers:

- `venueSelect()`
- `venuePayload({ name, address, googleMapsUrl, imageUrl })`
- `venueSportRows(venueId, sportIds)`
- `sportNamesForVenue(venue)`
- `sportIdsForVenue(venue)`
- `venueStatusText(venue)`
- `venueStatusClass(venue)`
- `venueOptionLabel(venue)`
- `mapLinkHtml(url)`

## Why This Is Safe

These modules do not replace existing `app.js` functions yet. They only create namespaced helper objects for future extracted admin and venue code to use.

`app.js` still owns:

- pending member loading and review actions
- venue loading
- venue form state
- venue create/update actions
- venue sport checkbox state
- admin tab rendering

## Script Order For Testing

Load the new modules after `js/auth.js` and before `app.js`:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/supabase-client.js?v=1"></script>
<script src="js/auth.js?v=1"></script>
<script src="js/admin.js?v=1"></script>
<script src="js/venues.js?v=1"></script>
<script src="js/utils.js?v=1"></script>
<script src="app.js?v=135"></script>
<script src="js/utils-runtime-bridge.js?v=1"></script>
<script src="js/auth-runtime-bridge.js?v=1"></script>
<script src="soccer-rating-foundation.js?v=1"></script>
```

## Manual Test Checklist

After adding the script lines, confirm:

- app loads
- login works
- admin tab opens for admin users
- pending members list still loads
- venue list still loads
- create/edit venue still works
- venue sport checkboxes still save correctly
- non-admin users still cannot see admin-only data

## Next Step After Testing

If these modules load safely, merge this checkpoint. The next micro-step can add runtime bridges for pure admin/venue helpers, or begin a proper local edit of `app.js` when a safe edit path is available.
