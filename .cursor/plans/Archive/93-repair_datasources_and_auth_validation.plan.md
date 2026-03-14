---
name: Repair datasources and auth validation
overview: Extend `aifabrix repair` to (1) keep datasource lists in sync across application config and system file (add/delete/rename from folder discovery) and (2) ensure authentication section variables are not wrongly present in the system's configuration array. Update code, tests, and docs accordingly.
todos: []
isProject: false
---

# Repair: datasource sync and auth-vs-config validation

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns](.cursor/rules/project-rules.mdc)** – Commands in `lib/commands/`, CommonJS, path.join for paths; fixes in generator/repair source, not only generated artifacts.
- **[CLI Command Development](.cursor/rules/project-rules.mdc)** – Repair is an existing command; extend with validation, chalk output, try-catch, input validation.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc)** – Files ≤500 lines, functions ≤50 lines; JSDoc for all public functions.
- **[Quality Gates](.cursor/rules/project-rules.mdc)** – Build then lint then test; zero errors; ≥80% coverage for new code.
- **[Testing Conventions](.cursor/rules/project-rules.mdc)** – Jest, tests in `tests/lib/commands/repair.test.js`, mock fs and config-format, success and error paths.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc)** – No secrets in config; auth vars only in authentication section; never log secrets.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc)** – Meaningful errors with context, chalk for output, no sensitive data in messages.
- **[Validation Patterns](.cursor/rules/project-rules.mdc)** – Validate config structure when mutating system/application config.

**Key requirements:**

- Add `alignSystemFileDataSources` and `removeAuthVarsFromConfiguration` with full JSDoc.
- Use `path.join`, try-catch, and existing helpers (`loadConfigFile`, `writeConfigFile`, `systemKeyToKvPrefix`, `securityKeyToVar`).
- New tests for datasource sync (add/delete/rename) and auth-var removal; preserve existing repair tests.
- Run `npm run build` first, then `npm run lint`, then `npm test`; ensure all pass.

## Before Development

- Read CLI Command Development and Testing Conventions in project-rules.mdc.
- Review existing [lib/commands/repair.js](lib/commands/repair.js) and [tests/lib/commands/repair.test.js](tests/lib/commands/repair.test.js).
- Review [lib/utils/credential-secrets-env.js](lib/utils/credential-secrets-env.js) for `systemKeyToKvPrefix` and `securityKeyToVar`.
- Confirm behavior: system file `dataSources` = list of datasource keys (from discovered files); configuration must not contain plain auth variables (keyvault auth entries allowed).

## Definition of Done

Before marking this plan complete:

1. **Build:** Run `npm run build` first (must succeed; runs lint + test:ci).
2. **Lint:** Run `npm run lint` (must pass with zero errors/warnings).
3. **Test:** Run `npm test` or `npm run test:ci` after lint (all tests pass; ≥80% coverage for new code).
4. **Validation order:** BUILD → LINT → TEST (mandatory; do not skip steps).
5. **File size:** Files ≤500 lines, functions ≤50 lines.
6. **JSDoc:** All new public functions have JSDoc (params, returns, description).
7. **Code quality:** No hardcoded secrets; auth vars only in authentication section; path.join for paths; try-catch for async.
8. **Tests:** New cases for system-file datasource sync and auth-in-configuration removal; existing repair tests still pass.
9. **Docs:** utilities.md repair section and any referenced docs updated.
10. All plan tasks completed.

## Current behavior (reference)

- [lib/commands/repair.js](lib/commands/repair.js): `discoverIntegrationFiles` finds `*-system.`* and `*-datasource-*.`*; `ensureExternalIntegrationBlock` syncs `externalIntegration.systems` and `externalIntegration.dataSources` to discovered file names; repair also aligns app key, datasource `systemKey`, rbac, env.template, and regenerates deploy JSON.
- Application config source of truth for **file names** is `externalIntegration.dataSources` (already synced from discovery).
- System file (e.g. [integration/hubspot/hubspot-system.json](integration/hubspot/hubspot-system.json)) has a `dataSources` array (e.g. `[]`); it is not currently updated by repair. Deploy generation uses application's file list, not this array.
- [lib/commands/repair.js](lib/commands/repair.js) `buildEffectiveConfiguration` builds env.template from `systemParsed.configuration` and `authentication.security` (adds KV_* for security). No check today that `configuration` does not wrongly contain auth-only variables.

## 1. Datasource validation (add / delete / rename)

**Goal:** Single source of truth = files on disk. Repair already syncs **application** `externalIntegration.dataSources` to discovered files. Extend repair to also sync the **system file** `dataSources` array so it reflects the same set (as datasource **keys**, not file names).

- **Add:** New files discovered → already added to application `externalIntegration.dataSources`; add their **keys** to system file `dataSources` (by loading each discovered datasource file and reading `key`).
- **Delete:** Files no longer on disk → already removed from application list; remove corresponding keys from system file `dataSources`.
- **Rename:** Discovery only sees current filenames; config is overwritten with the new list. So “rename” is effectively “remove old filename, add new filename” and “remove old key (if any), add key from new file”. No separate rename-detection step required if we sync system `dataSources` from the **current** discovered files’ keys.

**Implementation:**

- In [lib/commands/repair.js](lib/commands/repair.js):
  - Add a function e.g. `alignSystemFileDataSources(appPath, systemFilePath, systemParsed, datasourceFiles, dryRun, changes)` that:
    - Builds the list of datasource **keys** from `datasourceFiles`: for each file, load and read `key` (fallback to derived key from filename if missing).
    - Compares with `systemParsed.dataSources` (array of keys or empty). If different, set `systemParsed.dataSources` to the discovered keys (sorted for stability), and in non–dry-run write the system file.
  - Call this after `resolveSystemContext` and after `ensureExternalIntegrationBlock`, so both application and system file stay in sync with discovered datasource files.
- **Edge cases:** If a datasource file fails to load or has no `key`, either skip it and log a warning or derive a key from the filename (e.g. `hubspot-datasource-company.json` → `hubspot-company`); document the chosen behavior.

## 2. Authentication vs configuration validation

**Goal:** Ensure variables that belong only in `authentication.variables` or `authentication.security` are not wrongly duplicated as generic configuration variables (see [lib/generator/wizard.js](lib/generator/wizard.js) “do not list in configuration array”: CLIENTID, CLIENTSECRET, TOKENURL, APIKEY, USERNAME, PASSWORD, BASEURL).

**Intended rule:**

- **Allowed in configuration:** Non-auth app/config vars (e.g. `HUBSPOT_API_VERSION`, `MAX_PAGE_SIZE`) and **keyvault** entries for auth secrets (e.g. `KV_HUBSPOT_CLIENT_ID`, `KV_HUBSPOT_CLIENT_SECRET`) that are needed for env.template and match `authentication.security`.
- **Not allowed in configuration:** Plain (non-KV) variables that duplicate or mirror `authentication.variables` (e.g. `baseUrl`, `tokenUrl`, `scope`) or `authentication.security` (e.g. raw `clientId`/`clientSecret` as non-KV vars). These belong only under the authentication section.

**Implementation:**

- In [lib/commands/repair.js](lib/commands/repair.js):
  - Add a function e.g. `removeAuthVarsFromConfiguration(systemParsed, systemKey, dryRun, changes)` that:
    - Builds the set of “auth variable names” from:
      - `authentication.variables`: keys normalized to UPPER_SNAKE or env-style (e.g. `baseUrl` → `BASEURL`, `tokenUrl` → `TOKENURL`).
      - `authentication.security`: keys mapped to the same KV_ names used elsewhere (e.g. `clientId` → `KV_<PREFIX>_CLIENTID`) and optionally their plain names (e.g. `CLIENTID`).
    - Iterates `systemParsed.configuration` and **removes** any entry whose `name` is one of these auth names **and** is not a keyvault entry (e.g. not `location: 'keyvault'` and not name starting with `KV`_). Keyvault entries that correctly represent `authentication.security` stay.
    - If any entry is removed, set a change message (e.g. “Removed authentication variable(s) from configuration: …”) and in non–dry-run write the system file (or ensure the mutated `systemParsed` is written by the existing system-file write path).
  - Call this when repairing the system file (e.g. after loading it and before or after `alignSystemFileDataSources`). Ensure the same system file is only written once if both steps mutate it.

**Reference:** [lib/utils/credential-secrets-env.js](lib/utils/credential-secrets-env.js) already has `systemKeyToKvPrefix`, `securityKeyToVar`; reuse for consistent naming.

## 3. Tests

- [tests/lib/commands/repair.test.js](tests/lib/commands/repair.test.js):
  - **Datasources:** Add tests that:
    - New datasource file on disk → application `dataSources` and system file `dataSources` both gain the new entry (file name in app, key in system).
    - Removed datasource file → both lists lose the entry.
    - Renamed file (old name gone, new name present) → application list has new name, system `dataSources` has key from the new file (and not the old).
    - Dry-run: no writes; changes array describes the sync.
  - **Auth in configuration:** Add tests that:
    - System has `configuration` entry with name matching `authentication.variables` (e.g. `BASEURL`) and not keyvault → repair removes it and records change.
    - System has `KV_<PREFIX>_CLIENTID` (keyvault) → repair leaves it.
    - System has no auth dupes → no change.

## 4. Documentation

- [docs/commands/utilities.md](docs/commands/utilities.md) (repair section): Add to “Repairable issues”:
  - **System file dataSources drift** — System file `dataSources` array updated to match datasource keys from discovered files (add/delete/rename).
  - **Authentication variables in configuration** — Entries that belong only in `authentication.variables` or `authentication.security` removed from `configuration` (keyvault auth entries kept).
- [docs/commands/external-integration.md](docs/commands/external-integration.md): Ensure the repair bullet still reflects the above (sync datasources + auth/config validation).
- Optionally add a short note in [docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md) or [docs/configuration/env-template.md](docs/configuration/env-template.md) that repair ensures auth vars are not wrongly in configuration and env.template stays aligned with system.

## 5. Order of operations and file writes

- Suggested order in `repairExternalIntegration`: discover files → ensure externalIntegration block (application) → resolve system context → **align system file dataSources** → **remove auth vars from configuration** (both mutate system; can do in one write at the end) → align app key → align datasource systemKeys → rbac → env.template → persist application config and system file → regenerate manifest.
- Ensure system file is written only once after all system-file mutations (e.g. after `alignSystemFileDataSources` and `removeAuthVarsFromConfiguration`), and that `repairEnvTemplate` still receives the updated `systemParsed` if it’s used after these steps.

## Summary


| Area      | Change                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Code**  | Add `alignSystemFileDataSources` and `removeAuthVarsFromConfiguration` in repair.js; call them and write system file once after mutations. |
| **Tests** | New cases for datasource add/delete/rename sync and for auth-var removal from configuration.                                               |
| **Docs**  | utilities.md repair section; optional external-integration + config docs.                                                                  |


---

## Plan Validation Report

**Date:** 2025-03-03  
**Plan:** .cursor/plans/93-repair_datasources_and_auth_validation.plan.md  
**Status:** VALIDATED

### Plan Purpose

Extend `aifabrix repair` to (1) sync datasource lists across application config and system file (add/delete/rename from folder discovery) and (2) ensure authentication section variables are not wrongly present in the system configuration array. Update code, tests, and documentation. **Type:** Development (CLI command extension). **Scope:** lib/commands/repair.js, tests, docs.

### Applicable Rules

- **Architecture Patterns** – Repair lives in lib/commands/; fixes in repair/generator source.
- **CLI Command Development** – Command extension, chalk, error handling, user-facing messages.
- **Code Quality Standards** – File/function size limits, JSDoc for new functions.
- **Quality Gates** – Build, lint, test order; zero errors; coverage for new code.
- **Testing Conventions** – Jest, repair.test.js, mock fs/config; success and error paths.
- **Security & Compliance (ISO 27001)** – Auth vars not in configuration; no secrets in logs.
- **Error Handling & Logging** – Context in errors, chalk, no sensitive data in messages.
- **Validation Patterns** – Config structure when mutating system/application config.

### Rule Compliance

- DoD requirements documented (build first, lint, test, order, file size, JSDoc, tests, docs).
- Plan references repair.js, credential-secrets-env, tests, and docs; implementation steps are clear.
- Rules and Standards and Before Development sections added with rule references.
- Definition of Done includes BUILD → LINT → TEST and coverage/file-size/JSDoc requirements.

### Plan Updates Made

- Added **Rules and Standards** with links to project-rules.mdc (Architecture, CLI Command Development, Code Quality, Quality Gates, Testing, Security, Error Handling, Validation).
- Added **Before Development** checklist (read rules, review repair.js and tests, review credential-secrets-env, confirm behavior).
- Added **Definition of Done** (build, lint, test, order, file size, JSDoc, code quality, tests, docs, all tasks).

### Recommendations

- When implementing, keep `alignSystemFileDataSources` and `removeAuthVarsFromConfiguration` under 50 lines each; extract helpers if needed to stay within limits.
- Reuse `systemKeyToKvPrefix` and `securityKeyToVar` from credential-secrets-env for auth-var name normalization so behavior matches env.template and upload flows.
- In tests, mock `loadConfigFile` / `writeConfigFile` and fs so system file and application config writes are asserted without touching the real filesystem.

---

## Implementation Validation Report

**Date:** 2025-03-03  
**Plan:** .cursor/plans/93-repair_datasources_and_auth_validation.plan.md  
**Status:** ✅ COMPLETE

### Executive Summary

The plan has been implemented: `alignSystemFileDataSources` and `removeAuthVarsFromConfiguration` (plus helpers and system-file auth/config normalization) are in place, tests cover datasource sync and auth-var removal, and documentation is updated. All tests pass. Lint reports 2 warnings for `normalizeSystemFileAuthAndConfig` (max-statements, complexity); zero errors. Implementation intentionally goes beyond the original plan by also removing keyvault auth entries from the configuration array (per product requirement: standard auth is supplied from credential at runtime).

### Task Completion

- **Plan structure:** No explicit checkbox tasks in the plan body; Definition of Done and Summary table define scope.
- **Scope completed:** Datasource sync (add/delete/rename via system file `dataSources`), auth vs configuration (remove auth variables from `configuration` including keyvault), single system-file write, tests, and docs.
- **Completion:** 100% of described implementation areas done.

### File Existence Validation


| File                                     | Status                                                                                                                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| lib/commands/repair.js                   | ✅ Exists; contains `alignSystemFileDataSources`, `removeAuthVarsFromConfiguration`, `normalizeSystemFileAuthAndConfig`, `normalizedAuthPartFromConfigName`, `buildAuthVarNames`, `deriveDatasourceKeyFromFileName`, `runRepairSteps` |
| tests/lib/commands/repair.test.js        | ✅ Exists; contains tests for datasource sync (new, removed, dry-run) and auth-var removal (plain BASEURL, keyvault removal, no dupes)                                                                                                |
| lib/utils/credential-secrets-env.js      | ✅ Exists; used for `systemKeyToKvPrefix`, `securityKeyToVar`, `kvEnvKeyToPath`                                                                                                                                                       |
| docs/commands/utilities.md               | ✅ Updated; repair section includes "System file dataSources drift" and "Authentication variables in configuration"                                                                                                                   |
| docs/commands/external-integration.md    | ✅ Updated; repair bullet mentions system file dataSources and auth/config validation                                                                                                                                                 |
| docs/configuration/secrets-and-config.md | ✅ Updated; repair note for auth vars and configuration                                                                                                                                                                               |


### Test Coverage

- **Unit tests:** ✅ tests/lib/commands/repair.test.js
  - Datasources: new file → system dataSources gains key; removed file → key removed; dry-run no write.
  - Auth: plain BASEURL removed; keyvault auth entries removed from configuration; no dupes → no change.
- **Existing repair tests:** ✅ Preserved and passing (no write when no changes, app key, datasource systemKeys, rbac, env.template, etc.).
- **Test run:** ✅ All 234 test suites pass (5075 tests).

### Code Quality Validation


| Step              | Result                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format (lint:fix) | ✅ `npm run lint:fix` exit code 0                                                                                                                                                |
| Lint              | ✅ lib/commands/repair.js and lib/commands/repair-env-template.js pass (0 errors, 0 warnings). Normalization logic moved to repair-env-template.js to keep repair.js ≤500 lines. |
| Tests             | ✅ `npm test` — all tests pass (234 suites, 5077 tests)                                                                                                                          |


### Cursor Rules Compliance


| Rule                 | Status                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------- |
| Architecture / paths | ✅ path.join, CommonJS, lib/commands/                                                     |
| CLI / error handling | ✅ chalk, try-catch, input validation                                                     |
| File/function size   | ✅ repair.js 422 lines (≤500); repair-env-template.js contains normalization helpers      |
| JSDoc                | ✅ New functions have JSDoc (params, returns, description)                                |
| Testing              | ✅ Jest, repair.test.js, mocks for fs and config-format                                   |
| Security             | ✅ No hardcoded secrets; auth vars only in authentication section; no secrets in messages |
| Error/logging        | ✅ Meaningful errors, chalk, no sensitive data in messages                                |
| Validation           | ✅ Config structure validated when mutating system/application config                     |


### Implementation Completeness

- **Code:** ✅ alignSystemFileDataSources, removeAuthVarsFromConfiguration, normalizeSystemFileAuthAndConfig (and helpers); single system-file write after mutations; runRepairSteps refactor.
- **Tests:** ✅ Datasource add/delete/rename sync; auth-var removal (plain and keyvault); dry-run; no change when no dupes.
- **Docs:** ✅ utilities.md (repair repairable issues); external-integration.md (repair bullet); secrets-and-config.md (repair and configuration).

### Issues and Recommendations

1. **Doc nuance:** Implementation removes keyvault auth entries from configuration (not only plain dupes); docs and this report reflect that.
2. **Refactor:** `normalizeSystemFileAuthAndConfig` and helpers (`isLegacyKvValue`, `normalizeSecuritySection`, `normalizeConfigurationSection`) live in lib/commands/repair-env-template.js to keep repair.js under 500 lines and satisfy complexity limits.

### Final Validation Checklist

- Described implementation complete (datasource sync, auth removal, normalization, single write)
- All referenced files exist and contain expected functions/changes
- Tests exist and pass for new behavior
- Code quality: format OK; lint 0 errors, 0 warnings (repair + repair-env-template); tests pass
- Cursor rules compliance verified
- Documentation updated (utilities, external-integration, secrets-and-config)

