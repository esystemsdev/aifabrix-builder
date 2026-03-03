---
name: Repair env.template on repair
overview: "Add a repair step to `aifabrix repair` that aligns env.template with the system file: ensure all configuration variables (especially KV_* auth keys and kv:// values) match the system's configuration and authentication.security, add missing entries, and fix incorrect values."
todos: []
isProject: false
---

# Repair env.template keys in `aifabrix repair`

## Goal

When users run `aifabrix repair <app>`, the command should repair **env.template** so that variable names and `kv://` values match the source of truth in the system file (`*-system.json` / `*-system.yaml`). This fixes drift where env.template has wrong keys, missing auth variables, or outdated kv paths.

## Current behavior

- [lib/commands/repair.js](lib/commands/repair.js): `repairExternalIntegration` discovers system/datasource files, ensures `externalIntegration` block, aligns app key and datasource `systemKey`s, creates rbac from system if needed, and regenerates the deploy manifest. It does **not** touch env.template.

## Naming and path convention (env.template and manifest)

- **env.template** uses the *KV_ convention**: `KV_<APPKEY>_<VAR>=value` (e.g. `KV_HUBSPOT_CLIENTID=`, `KV_HUBSPOT_CLIENTSECRET=`). No extra underscores in the VAR part (CLIENTID, CLIENTSECRET, not CLIENT_ID, CLIENT_SECRET).
- **Mapping**: `KV`_ + segments (split by underscore) → `kv://segment1/segment2/...` (lowercase). Example: `KV_HUBSPOT_CLIENTID` → `kv://hubspot/clientid`. Implemented in [lib/utils/credential-secrets-env.js](lib/utils/credential-secrets-env.js) as `kvEnvKeyToPath(envKey)`.
- **Manifest** references the same **path style**: `kv://hubspot/clientid` (not Key Vault resource names). When repairing, env.template values and system/deploy auth paths should use this path style so they stay in sync.

## Source of truth for env.template

- **System file** (`integration/<app>/*-system.json`): has `authentication.security` (e.g. `clientId`, `clientSecret` → `kv://...`) and optionally `configuration` (name, value, location).
- **Canonical env.template** uses `KV_<APPKEY>_<VAR>` names and path-style `kv://` values. For auth vars, map security key camelCase to VAR: e.g. `clientId` → `CLIENTID`, `clientSecret` → `CLIENTSECRET` (same as [lib/generator/wizard.js](lib/generator/wizard.js) and [lib/app/config.js](lib/app/config.js)); path = `kv://<systemKey>/<securityKeyLowercase>` (e.g. `kv://hubspot/clientid`).
- Reuse [lib/utils/credential-secrets-env.js](lib/utils/credential-secrets-env.js): `systemKeyToKvPrefix(systemKey)` for APPKEY, and `kvEnvKeyToPath(envKey)` to derive path from env key when generating expected lines. Do **not** use `deriveAuthVarName` from download.js (it produces `CLIENT_ID`); use the wizard/config convention (CLIENTID, CLIENTSECRET).

## Implementation plan

### 1. Build effective configuration from system (in memory)

- In repair, after resolving the system file and `systemParsed`, build an **effective configuration** array that follows **KV_****_**** and path-style `**kv://`:
  - Start from `systemParsed.configuration` (or `[]`). For existing entries with `location: 'keyvault'`, normalize: env name must be `KV_<APPKEY>_<VAR>` (e.g. `KV_HUBSPOT_CLIENTID`), value must be path-style `kv://<systemKey>/<segment>` (e.g. `kv://hubspot/clientid`). Use `systemKeyToKvPrefix(systemKey)` for APPKEY and map security key to VAR in UPPERCASE no underscores (e.g. `clientId` → `CLIENTID`).
  - For each `authentication.security` entry (e.g. `clientId`, `clientSecret`), ensure there is a configuration entry: env name = `KV`_ + systemKeyToKvPrefix(systemKey) + `_` + securityKeyToVar(key) (e.g. `KV_HUBSPOT_CLIENTID`); value = path-style from that name via `kvEnvKeyToPath(envName)` (e.g. `kv://hubspot/clientid`). Add only if not already present (by env name or by path).
- Reuse [lib/utils/credential-secrets-env.js](lib/utils/credential-secrets-env.js): `systemKeyToKvPrefix`, `kvEnvKeyToPath`. Add a small helper to map security key (camelCase) to VAR (UPPERCASE no underscores). Build the array in memory; do not mutate the system object on disk.

### 2. Add env.template repair step in repair command

- **New helper** (in [lib/commands/repair.js](lib/commands/repair.js) or a small dedicated module under `lib/commands/` or `lib/generator/`):
  - **Input**: `appPath`, `systemParsed`, `systemKey`, `dryRun`, `changes[]`.
  - **Logic**:
    - Build effective configuration (step 1).
    - Expected env.template content = `extractEnvTemplate(effectiveConfiguration)` (require from [lib/generator/split.js](lib/generator/split.js)).
    - **If env.template is missing**: write expected content, push a change message, return `true`.
    - **If env.template exists**: parse current content; for each line:
      - If line is `KEY=value` and `KEY` is in the effective configuration, replace with the expected `KEY=value` from effective config (so names and kv paths are corrected).
      - Otherwise (comment, empty, or variable not in config) keep the line as-is.
      - After processing all lines, append any configuration keys that were not present.
    - If any change was made, push a change description to `changes` and write the file (unless `dryRun`).
  - **Output**: boolean (whether env.template was repaired/created).

### 3. Integrate into `repairExternalIntegration`

- After `createRbacFromSystemIfNeeded`, call the new env.template repair helper with `appPath`, `systemParsed`, `systemKey`, `dryRun`, `changes`.
- Set e.g. `envTemplateRepaired = true/false` and include it in the returned result object.
- Ensure repair still runs **before** `persistChangesAndRegenerate` so that when the manifest is regenerated, it uses the repaired env.template.

### 4. Preserve existing non-config lines

- When merging, keep comments, blank lines, and any variables that are not in the system configuration (e.g. custom or legacy vars). Only add/update lines for the variables that come from the effective configuration, so user-added content is not removed.

### 5. Tests

- **Tests**: In [tests/lib/commands/repair.test.js](tests/lib/commands/repair.test.js), add cases: (1) env.template missing → created from system config; (2) env.template has wrong kv path → corrected; (3) env.template missing one auth variable → added; (4) dryRun → no file write; (5) non-config lines and comments preserved.

## Documentation updates

Update the following docs so repair and the KV_* / path-style convention are clearly described.

### [docs/external-systems.md](docs/external-systems.md)

- **env.template section (around 1090–1105):** Already documents KV_* and path-style mapping. Add one sentence after the "Credential flow" list: e.g. "If env.template keys or values drift from the system file (e.g. wrong variable names or non–path-style kv refs), run `aifabrix repair <app>` to align env.template with the system."
- **Troubleshooting (around 1451–1453):** In the bullet "application.yaml out of sync with files", expand to: "Run `aifabrix repair <app>` to align `externalIntegration.systems` and `externalIntegration.dataSources` with discovered files on disk, and to repair env.template (KV_* names and path-style `kv://` values) to match the system file."

### [docs/commands/external-integration.md](docs/commands/external-integration.md)

- **Intro / Repair (line 11):** Expand the Repair sentence to: "If `application.yaml` or env.template gets out of sync with files on disk (e.g. after converting JSON ↔ YAML, adding/removing datasource files, or env.template having wrong KV_* keys), run `aifabrix repair <app>`; see [Utility commands – repair](utilities.md#aifabrix-repair-app)."
- *KV_ convention (around 244):** Already states path style and repair reference; no change required unless adding an explicit "Repair aligns env.template to this convention."

### [docs/commands/utilities.md](docs/commands/utilities.md)

- **Repair section (aifabrix repair ***, ~212–229):** In **What**, add: "repairs env.template so KV_ variable names and path-style `kv://` values match the system file (adds missing auth vars, corrects names/values)." Under **Repairable issues**, add a bullet: "**env.template key drift** — env.template has wrong or missing KV_* keys or non–path-style kv values; repair aligns names and values with the system’s authentication.security and configuration."

### [docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md)

- *External integrations: KV_ (57–64):** In the first bullet (`.env` in integration folder), add that for external integrations the convention is `KV_<system-key>_<VAR>` (e.g. `KV_HUBSPOT_CLIENTID`, `KV_HUBSPOT_CLIENTSECRET`) mapping to path-style `kv://hubspot/clientid`, `kv://hubspot/clientsecret`. Add a short note: "Run `aifabrix repair <app>` to align env.template keys and path-style values with the system file if they drift."

### [integration/hubspot/QUICK_START.md](integration/hubspot/QUICK_START.md)

- **env.template section (137–146):** Replace the example that currently shows `CLIENTID=kv://hubspot-clientidKeyVault` and `CLIENTSECRET=kv://hubspot-clientsecretKeyVault` with the correct convention: use `KV_HUBSPOT_CLIENTID=` and `KV_HUBSPOT_CLIENTSECRET=` (path-style values optional in template, e.g. `kv://hubspot/clientid`). Add a one-line note that variable names follow `KV_<APPKEY>_<VAR>` and map to path-style `kv://` (e.g. `KV_HUBSPOT_CLIENTID` → `kv://hubspot/clientid`), and that `aifabrix repair hubspot` can fix env.template if it gets out of sync.

## Key files


| File                                                                                 | Change                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [lib/commands/repair.js](lib/commands/repair.js)                                     | Add env.template repair step; optional: extract “build effective config” + “merge env.template” into a small helper in same file or new module.                                                                    |
| [lib/generator/split.js](lib/generator/split.js)                                     | No change; reuse `extractEnvTemplate`.                                                                                                                                                                             |
| [lib/utils/credential-secrets-env.js](lib/utils/credential-secrets-env.js)           | Reuse `systemKeyToKvPrefix`, `kvEnvKeyToPath` for canonical env names and path-style `kv://` values. No use of `deriveAuthVarName` (download.js) so naming stays `KV_HUBSPOT_CLIENTID` not `KV_HUBSPOT_CLIENT_ID`. |
| [tests/lib/commands/repair.test.js](tests/lib/commands/repair.test.js)               | New tests for env.template repair (missing file, wrong/missing keys, dryRun, preserve comments/extra vars).                                                                                                        |
| [docs/external-systems.md](docs/external-systems.md)                                 | env.template note + troubleshooting repair bullet (env.template repair).                                                                                                                                           |
| [docs/commands/external-integration.md](docs/commands/external-integration.md)       | Repair intro sentence (env.template drift).                                                                                                                                                                        |
| [docs/commands/utilities.md](docs/commands/utilities.md)                             | Repair section: What + Repairable issues (env.template key drift).                                                                                                                                                 |
| [docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md) | External integrations: KV_* convention (path-style + repair).                                                                                                                                                      |
| [integration/hubspot/QUICK_START.md](integration/hubspot/QUICK_START.md)             | env.template example and convention (KV_* + path-style + repair).                                                                                                                                                  |


## Out of scope

- Changing how the wizard or download generates env.template (repair only aligns existing or missing env.template to the system file).
- Validating kv references (e.g. `validateAuthKvCoverage`) as part of repair; repair is corrective, validation remains separate.

---

## Implementation Validation Report

**Date:** 2025-03-03  
**Plan:** .cursor/plans/92-repair_env.template_on_repair.plan.md  
**Status:** ✅ COMPLETE

### Executive Summary

All implementation requirements from the plan have been completed. The repair command now includes an env.template repair step that aligns `KV_*` variable names and path-style `kv://` values with the system file. A dedicated module `lib/commands/repair-env-template.js` implements build-effective-config and merge logic; `lib/commands/repair.js` integrates it and exposes `envTemplateRepaired` in the result. All listed documentation has been updated, and tests cover the required scenarios plus additional unit tests for the new module.

### Task Completion

| Requirement | Status |
|-------------|--------|
| 1. Build effective configuration from system (in memory) | ✅ Implemented in `repair-env-template.js` (`buildEffectiveConfiguration`, `addFromConfiguration`, `addFromAuthSecurity`, `normalizeKeyvaultEntry`) |
| 2. Add env.template repair step (helper with create/merge logic) | ✅ `repairEnvTemplate` in `repair-env-template.js`; uses `extractEnvTemplate` from `lib/generator/split.js` |
| 3. Integrate into `repairExternalIntegration` | ✅ Called after `createRbacFromSystemIfNeeded`; `envTemplateRepaired` in result; runs before `persistChangesAndRegenerate` |
| 4. Preserve existing non-config lines | ✅ `mergeEnvTemplateContent` / `processLine` keep comments, blank lines, and vars not in effective config |
| 5. Tests (missing → created; wrong kv path; missing auth var; dryRun; preserve comments) | ✅ All five in `repair.test.js`; plus unit tests in `repair-env-template.test.js` and extra integration cases |
| Documentation updates (5 docs + QUICK_START) | ✅ All updated as specified |

### File Existence Validation

| File | Status |
|------|--------|
| lib/commands/repair.js | ✅ Exists; calls `repairEnvTemplate`, returns `envTemplateRepaired` |
| lib/commands/repair-env-template.js | ✅ Exists (new); `buildEffectiveConfiguration`, `repairEnvTemplate`, helpers |
| lib/generator/split.js | ✅ No change; `extractEnvTemplate` reused |
| lib/utils/credential-secrets-env.js | ✅ `systemKeyToKvPrefix`, `kvEnvKeyToPath`, `securityKeyToVar` (new) used |
| tests/lib/commands/repair.test.js | ✅ Env.template repair cases: create when missing, wrong path, add missing auth, dryRun, preserve comments, already correct, non-keyvault vars |
| tests/lib/commands/repair-env-template.test.js | ✅ Unit tests for `buildEffectiveConfiguration` and `repairEnvTemplate` |
| tests/lib/utils/credential-secrets-env.test.js | ✅ Tests for `securityKeyToVar` |
| docs/external-systems.md | ✅ env.template drift sentence after Credential flow; troubleshooting bullet expanded |
| docs/commands/external-integration.md | ✅ Repair intro sentence (env.template drift) |
| docs/commands/utilities.md | ✅ Repair What + Repairable issues (env.template key drift) |
| docs/configuration/secrets-and-config.md | ✅ KV_ convention (path-style + repair note) |
| integration/hubspot/QUICK_START.md | ✅ env.template example `KV_HUBSPOT_CLIENTID`/`CLIENTSECRET`, path-style, repair note |

### Test Coverage

- **Unit tests:** `repair-env-template.test.js` — `buildEffectiveConfiguration` (empty key, auth only, non-keyvault config, keyvault normalization, dedupe, hyphen systemKey); `repairEnvTemplate` (no config + missing file, create when missing, dryRun no write, repair when content differs, no change when correct, dryRun repair no write).
- **Integration tests:** `repair.test.js` — creates env.template when missing; repairs wrong kv path; adds missing auth variable; dry-run does not write; preserves comments and non-config lines; does not repair when already correct; includes non-keyvault configuration vars in repaired env.template.
- **Credential-secrets-env:** `securityKeyToVar` tests added.

### Code Quality Validation

| Step | Result |
|------|--------|
| Format (lint:fix) | ✅ PASSED (exit code 0) |
| Lint | ✅ PASSED (0 errors, 0 warnings) |
| Tests | ✅ PASSED (234 suites, 5069 tests) |

### Cursor Rules Compliance

| Rule | Status |
|------|--------|
| Code reuse | ✅ Uses `credential-secrets-env.js` (`systemKeyToKvPrefix`, `kvEnvKeyToPath`, `securityKeyToVar`) and `extractEnvTemplate` from `split.js` |
| Error handling | ✅ No hardcoded secrets; file ops in repair path are guarded (e.g. skip read when file missing and no effective config) |
| Module patterns | ✅ CommonJS; `repair-env-template.js` has @fileoverview and JSDoc on exported and key helpers |
| File operations | ✅ `path.join` for paths; encoding `utf8` on read/write |
| Input validation | ✅ Effective config built from system structure; no direct user input in repair-env-template |
| Security | ✅ No secrets in code; env.template holds keys/placeholders only |
| File size / complexity | ✅ Logic split into `repair-env-template.js` to satisfy lint limits |

### Implementation Completeness

- **Effective configuration:** Built from `systemParsed.configuration` (keyvault normalized to `KV_<APPKEY>_<VAR>` and path-style value) and `authentication.security` (env name via `securityKeyToVar`, path via `kvEnvKeyToPath`).
- **Repair behavior:** Missing file → create from effective config; existing file → merge (update/config keys, append missing, keep comments and other lines).
- **Integration:** Repair runs after RBAC step, before persist/regenerate; result includes `envTemplateRepaired`.

### Notes

- `integration/hubspot/env.template` in the repo still uses the old keys (`KV_HUBSPOT_CLIENT_ID` / `CLIENT_SECRET` and non–path-style values). Running `aifabrix repair hubspot` would align it to the new convention; the implementation and QUICK_START.md example are correct.

### Final Validation Checklist

- [x] All implementation plan items completed
- [x] All key files exist and contain expected changes
- [x] Tests exist for repair and repair-env-template and pass
- [x] Code quality (format, lint, test) passes
- [x] Cursor rules compliance verified
- [x] Documentation updated as specified

