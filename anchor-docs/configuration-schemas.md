---
title: Configuration schemas (technical anchor)
navigation_id: builder/configuration-schemas
owner: platform-team
last_verified_commit: TBD
---

## Summary

AJV JSON schemas under `lib/schema` validate `application.yaml`, external systems, and datasources. The application schema defines external integration blocks consumed by wizard and deploy flows.

## Details

When schema fields change, update wizard defaults and repair commands together so on-disk integrations stay valid.

## Examples

```bash
aifabrix validate <app>
```

## Paths

[path:aifabrix-builder/lib/schema/application-schema.json]
[path:aifabrix-builder/lib/utils/external-system-validators.js]
