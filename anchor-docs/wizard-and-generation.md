---
title: Wizard and config generation (technical anchor)
navigation_id: builder/wizard-and-config-generation
owner: platform-team
last_verified_commit: TBD
---

## Summary

The wizard (`lib/commands/wizard*.js`, generator modules) drives headless and interactive creation of external systems from OpenAPI, MCP, or presets. Outputs land in `integration/<app>/`.

## Details

Wizard documentation in `docs/wizard.md` is user-facing; this anchor ties CLI behavior to code entrypoints for maintainers.

## Examples

```bash
aifabrix wizard --config wizard.yaml
```

## Paths

[path:aifabrix-builder/docs/wizard.md]
[path:aifabrix-builder/lib/generator/wizard.js]
