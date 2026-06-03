# Extracted Module Wiring Loader

This small follow-up fixes script wiring for extracted modules without rewriting the large `index.html` file from this session.

## What Changed

`js/auth-runtime-bridge.js` now auto-loads these modules if `index.html` has not listed them explicitly:

- `js/auth.js`
- `js/admin.js`
- `js/venues.js`

It still binds safe auth helper globals after `window.ABAAuth` is available.

## Why

The app already loads `js/auth-runtime-bridge.js`. Updating this small file is safer than replacing all of `index.html` through a whole-file GitHub connector update.

Explicit script tags in `index.html` are still preferred long term. This loader keeps the app stable until we have a safer local edit path for larger file cleanup.

## Test Checklist

Confirm:

- app loads
- login works
- logout works
- admin tab opens
- pending members list loads
- venue list loads
- create/edit venue works
- venue sport checkboxes save correctly
- non-admin restrictions still work
