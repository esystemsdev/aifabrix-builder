---
title: Builder CLI overview (technical anchor)
navigation_id: builder/builder
owner: platform-team
last_verified_commit: TBD
---

## Summary

The Builder CLI (`bin/aifabrix.js`) orchestrates app scaffolding, infra, wizard flows, validation, and deploy to the controller. Command modules live under `lib/commands` with shared API clients in `lib/api`.

## Details

Generated output under `integration/` and `builder/` is produced by generators—fix behavior in templates and `lib/generator`, not only in generated copies.

## Examples

```bash
node bin/aifabrix.js --help
```

## Paths

[path:aifabrix-builder/README.md]
[path:aifabrix-builder/lib/cli.js]
