---
title: CLI and authentication (technical anchor)
navigation_id: builder/cli-authentication
owner: platform-team
last_verified_commit: TBD
---

## Summary

Authentication commands obtain controller tokens (device or client credentials) and persist config under the user’s aifabrix profile. Implementation is centralized in `lib/api/auth.api.js` and related helpers.

## Details

User-facing command documentation belongs in `docs/commands/`; keep HTTP endpoint names out of CLI user docs per builder documentation rules.

## Examples

See authentication command doc index for flags and prerequisites.

## Paths

[path:aifabrix-builder/docs/commands/README.md]
[path:aifabrix-builder/lib/api/auth.api.js]
