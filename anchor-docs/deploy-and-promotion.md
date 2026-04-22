---
title: Deploy and promotion (technical anchor)
navigation_id: builder/deploy-and-promotion
owner: platform-team
last_verified_commit: TBD
---

## Summary

Deploy commands build deployment payloads, resolve secrets, and call controller APIs so environments receive updated integration artifacts. Permissions are documented alongside API helpers.

## Details

Use centralized `lib/api` modules for new HTTP calls; document required permissions in JSDoc per `permissions-guide.md`.

## Examples

See deployment command docs for flags controlling dry-run and target environment selection.

## Paths

[path:aifabrix-builder/lib/app/deploy.js]
[path:aifabrix-builder/docs/commands/README.md]
