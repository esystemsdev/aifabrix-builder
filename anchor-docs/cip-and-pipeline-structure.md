---
title: CIP and pipeline structure (technical anchor)
navigation_id: builder/cip-pipeline-structure
owner: platform-team
last_verified_commit: TBD
---

## Summary

Datasource JSON describes CIP stages (fetch, transform, accessFields, exposure, sync) executed by Dataplane. Builder validates structure against `external-datasource.schema.json` and related schemas.

## Details

Builder commands generate and repair datasource files; runtime semantics are implemented in Dataplane—link across repos with matching `navigation_id` anchors.

## Examples

Run `aifabrix repair <systemKey>` after structural edits to integration files.

## Paths

[path:aifabrix-builder/lib/schema/external-datasource.schema.json]
[path:aifabrix-builder/docs/wizard.md]
