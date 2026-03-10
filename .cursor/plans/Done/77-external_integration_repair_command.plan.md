---
name: External integration repair command
overview: Rename sync-external-config to repair, expand it to fix more drift cases (system key mismatch, deleted/added datasources, missing externalIntegration), regenerate deployment manifest, and document the repair process.
todos: []
isProject: false
---

# External Integration Repair Command Plan

## Summary

Rename `sync-external-config` to `repair`, expand its scope to fix additional drift scenarios, regenerate the deployment manifest after repair, and document what the repair process fixes.

---

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc). Applicable sections:

- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** – Module structure, CLI command pattern, file organization; changes touch `lib/commands/` and `lib/cli/`
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – Command definition, input validation, error handling, chalk output, tests
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – File size limits (≤500 lines/file, ≤50 lines/function), JSDoc for all public functions
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Mandatory checks before commit: build, lint, tests, coverage ≥80%
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Tests in `tests/`, mirror source structure; mock external deps
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – Try-catch for async ops, meaningful errors, chalk for output, no secrets in logs
- **[Security & Compliance](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – No hardcoded secrets; validate inputs (app names, paths)

**Key requirements**: Use `path.join()` for paths; validate app name; add JSDoc for all public functions; use chalk for output; wrap async in try-catch.

---

## Before Development

- Read [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns) and [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development) from project-rules.mdc
- Review [lib/commands/sync-external-config.js](lib/commands/sync-external-config.js) and [lib/cli/setup-utility.js](lib/cli/setup-utility.js)
- Review [lib/generator/split.js](lib/generator/split.js) `extractRbacYaml` and [lib/generator/external-controller-manifest.js](lib/generator/external-controller-manifest.js) `toDeployJsonShape`
- Ensure no hardcoded secrets in repair logic

---

## Current State

- **Command**: `aifabrix sync-external-config <app>` in [lib/cli/setup-utility.js](lib/cli/setup-utility.js)
- **Module**: [lib/commands/sync-external-config.js](lib/commands/sync-external-config.js)
- **Current behavior**: Discovers `*-system.`* and `*-datasource-*.`* files on disk; updates `externalIntegration.systems` and `externalIntegration.dataSources` when they differ.

---

## Repairable Issues (What Repair Fixes)


| Issue                                                  | Description                                                            | Repair Action                                                             | Auto-fixable                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------- |
| **File list drift**                                    | `application.yaml` lists `.json` but files are `.yaml` (or vice versa) | Sync `systems` and `dataSources` to match discovered files                | Yes                                            |
| **Deleted datasource**                                 | Config lists a file that no longer exists                              | Remove from `externalIntegration.dataSources`                             | Yes                                            |
| **Added datasource**                                   | File exists on disk but not in config                                  | Add to `externalIntegration.dataSources`                                  | Yes                                            |
| **externalIntegration block missing**                  | No `externalIntegration` in application config                         | Create minimal block from discovered files                                | Yes (if system file exists)                    |
| **system.key vs app/folder mismatch**                  | System file has `key: X` but app name/folder is `Y`                    | Update `app.key` to match `system.key`; optionally rename deploy manifest | Yes (config only; folder rename is manual)     |
| **Deployment manifest stale**                          | `*-deploy.json` out of sync after config changes                       | Regenerate using `toDeployJsonShape` (system + dataSources only)          | Yes                                            |
| **rbac.yaml missing but system has roles/permissions** | System file has roles/permissions; no rbac.yaml exists                 | Extract roles/permissions from system file; create `rbac.yaml`            | Yes (eliminates "rbac.yaml not found" warning) |
| **Datasource systemKey mismatch**                      | Datasource file has `systemKey: X` but system file has `key: Y`        | Update `systemKey` in each datasource file to match system key            | Yes                                            |


---

## Non-Repairable (User Must Fix Manually)


| Issue                                                     | Why manual                                                                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Folder name vs system.key**                             | Renaming `integration/foo/` to `integration/bar/` changes app resolution; CLI uses folder name. User must rename folder and re-run repair. |
| **Invalid kv:// format**                                  | Secrets/config content; repair does not touch env.template or .env.                                                                        |
| **rbac.yaml not found** (system has no roles/permissions) | If system file has no roles or permissions, repair does not create rbac.yaml; RBAC is optional.                                            |
| **System file missing**                                   | No system file on disk → cannot infer config; repair fails with clear error.                                                               |


---

## Implementation Plan

### 1. Rename sync-external-config → repair

- Rename [lib/commands/sync-external-config.js](lib/commands/sync-external-config.js) → `lib/commands/repair.js`
- Export `repairExternalIntegration(appName, options)` (main entry) and `discoverIntegrationFiles(appPath)` (used internally)
- Update [lib/cli/setup-utility.js](lib/cli/setup-utility.js): change command from `sync-external-config` to `repair`
- Rename test file: `tests/lib/commands/sync-external-config.test.js` → `tests/lib/commands/repair.test.js`
- Add `--dry-run` to report changes without writing

### 2. Expand repair logic

**Repair flow (order matters):**

```mermaid
flowchart TD
    A[repair appName] --> B{App path exists?}
    B -->|No| C[Throw: app not found]
    B -->|Yes| D[Discover system + datasource files]
    D --> E{System file exists?}
    E -->|No| F[Throw: no system file]
    E -->|Yes| G[Load application config]
    G --> H{externalIntegration exists?}
    H -->|No| I[Create minimal block from discovered files]
    H -->|Yes| J[Sync systems + dataSources to disk]
    I --> K[Load system file - get system.key]
    J --> K
    K --> L{app.key matches system.key?}
    L -->|No| M[Update app.key = system.key]
    L -->|Yes| M
    M --> N{rbac.yaml missing and system has roles/permissions?}
    N -->|Yes| O[Create rbac.yaml from system]
    N -->|No| P[Regenerate deploy manifest]
    O --> P
    P --> Q[Done]
```



**Logic details:**

1. **Discover files** (unchanged): `*-system.(yaml|yml|json)`, `*-datasource-*.(yaml|yml|json)`
2. **Handle missing externalIntegration**: If `variables.externalIntegration` is absent, create:

```yaml
   externalIntegration:
     schemaBasePath: './'
     systems: [<discovered system file>]
     dataSources: [<discovered datasource files>]
     autopublish: true
     version: '1.0.0'
   

```

   Preserve `variables.app`, `variables.deployment`, etc. Add block only.
3. **Sync systems/dataSources**: Replace with discovered file lists (handles deleted + added)
4. **system.key alignment**: Load first system file; if `parsed.key !== variables.app?.key` and app key exists, set `variables.app.key = parsed.key`. Ensures manifest uses correct system key.
5. **rbac.yaml creation**: If system file has `roles` and/or `permissions` AND neither `rbac.yaml` nor `rbac.yml` exists in app path, create `rbac.yaml` with `{ roles, permissions }` extracted from the system file. Reuse `extractRbacYaml`-style logic from [lib/generator/split.js](lib/generator/split.js) (extract from system object). Create `rbac.yaml` (not rbac.yml) because [lib/generator/external-controller-manifest.js](lib/generator/external-controller-manifest.js) and [lib/generator/external.js](lib/generator/external.js) only load `rbac.yaml`; split-json writes `rbac.yml` which the generator does not find.
6. **Regenerate deploy manifest**: Call `generateControllerManifest(appName, { appPath })` then `toDeployJsonShape(manifest)`, write to `<systemKey>-deploy.json`. Manifest generation merges rbac.yaml into system; creating rbac.yaml before this step ensures RBAC is included.

### 3. Schema references

- [lib/schema/application-schema.json](lib/schema/application-schema.json): `externalIntegration` requires `schemaBasePath`, has `systems` and `dataSources` arrays
- [lib/schema/external-system.schema.json](lib/schema/external-system.schema.json): `key` required, pattern `^[a-z0-9-]+$`
- [lib/schema/external-datasource.schema.json](lib/schema/external-datasource.schema.json): `systemKey` required, must match ExternalSystem.key

Repair does not validate or modify system/datasource file contents (e.g. systemKey inside datasource files); validation remains in `aifabrix validate`.

### 4. Return value and dry-run

Return object:

```javascript
{
  updated: boolean,
  changes: string[],  // human-readable list of changes
  systemFiles: string[],
  datasourceFiles: string[],
  appKeyFixed?: boolean,
  rbacFileCreated?: boolean,
  manifestRegenerated?: boolean
}
```

With `--dry-run`: compute changes, do not write; report what would be done.

---

## Documentation Updates


| Document                                                                                 | Update                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/commands/utilities.md](docs/commands/utilities.md)                                 | Add section **aifabrix repair **** after convert. Describe: purpose, repairable issues (file drift, deleted/added datasources, missing externalIntegration, system key alignment, rbac.yaml creation from system, manifest regeneration), **`--dry-run`, when to run. |
| [docs/configuration/external-integration.md](docs/configuration/external-integration.md) | Add note: "If `application.yaml` gets out of sync with files on disk, run `aifabrix repair <app>` to fix."                                                                                                                                                            |
| [docs/commands/validation.md](docs/commands/validation.md)                               | Add troubleshooting: "Validation fails with 'External datasource file not found' or wrong extension → run `aifabrix repair <app>`"                                                                                                                                    |
| Create **docs/commands/repair.md** (optional)                                            | Dedicated page listing all repairable vs manual-fix items; link from utilities.md                                                                                                                                                                                     |


---

## Files to Touch


| File                                              | Change                                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `lib/commands/sync-external-config.js`            | Rename to `repair.js`; expand logic (missing block, system key, rbac creation, manifest) |
| `lib/cli/setup-utility.js`                        | Command `repair` instead of `sync-external-config`                                       |
| `tests/lib/commands/sync-external-config.test.js` | Rename to `repair.test.js`; add tests for new cases                                      |
| `docs/commands/utilities.md`                      | Add `aifabrix repair` section                                                            |
| `docs/configuration/external-integration.md`      | Add repair note                                                                          |
| `docs/commands/validation.md`                     | Add repair troubleshooting                                                               |


---

## Optional Enhancements (Out of Scope for Initial Plan)

- **Datasource systemKey fix**: If datasource file has `systemKey: X` but system has `key: Y`, repair could offer to update datasource files. Deferred; user can fix manually.
- **Folder rename guidance**: If `system.key !== appName` (folder name), repair could warn: "system.key is X but app folder is Y; consider renaming folder to X and re-running repair."

---

## Definition of Done

Before marking this plan complete:

1. **Build**: Run `npm run build` FIRST (must succeed; runs lint + test:ci)
2. **Lint**: Run `npm run lint` (zero errors/warnings)
3. **Test**: Run `npm test` or `npm run test:ci` after lint (all tests pass; ≥80% coverage for new code)
4. **Order**: BUILD → LINT → TEST (mandatory; do not skip)
5. **File size**: Files ≤500 lines, functions ≤50 lines
6. **JSDoc**: All public functions have JSDoc comments
7. **Code quality**: All rule requirements met
8. **Security**: No hardcoded secrets; ISO 27001–aligned handling of config and generated files
9. Command `aifabrix repair <app>` works for all repairable cases
10. `--dry-run` reports changes without writing
11. Deployment manifest is regenerated after repair when config changed
12. Documentation updated (utilities, external-integration, validation)
13. Tests cover: file drift, deleted datasource, added datasource, missing externalIntegration, system key update, rbac.yaml creation from system, manifest regeneration, dry-run, error cases

---

## Plan Validation Report

**Date**: 2026-02-25  
**Plan**: .cursor/plans/77-external_integration_repair_command.plan.md  
**Status**: VALIDATED

### Plan Purpose

Rename sync-external-config to repair, expand repair to fix drift (file list, deleted/added datasources, missing externalIntegration, system key mismatch, rbac.yaml creation, manifest regeneration), and document the repair process. **Type**: Refactoring / CLI command development.

**Scope**: CLI command (`lib/cli/setup-utility.js`), command module (`lib/commands/`), tests, documentation.

### Applicable Rules

- [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns) – Module structure, CLI pattern
- [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development) – Command definition, validation, error handling
- [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) – File size, JSDoc
- [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) – Build, lint, test, coverage
- [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) – Jest, mock patterns
- [Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging) – Try-catch, chalk
- [Security & Compliance](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) – No secrets, input validation

### Rule Compliance

- DoD requirements: Documented (build → lint → test order, coverage, file size, JSDoc, security)
- Rules and Standards: Added with applicable sections and key requirements
- Before Development: Checklist added
- Definition of Done: Full checklist with BUILD → LINT → TEST and mandatory items

### Plan Updates Made

- Added **Rules and Standards** section with rule references and key requirements
- Added **Before Development** checklist
- Expanded **Definition of Done** with build/lint/test order and quality gates
- Appended this validation report

### Recommendations

- When implementing, ensure `repair.js` keeps functions under 50 lines; split logic if needed
- Mock `generateControllerManifest`, `toDeployJsonShape`, and file I/O in tests

---

## Implementation Validation Report

**Date**: 2026-02-26  
**Plan**: .cursor/plans/77-external_integration_repair_command.plan.md  
**Status**: ✅ COMPLETE

### Executive Summary

Implementation is complete. All plan requirements are met. Code quality validation passed (format, lint, tests). Cursor rules compliance verified. One pre-existing lint fix was applied in `lib/validation/external-manifest-validator.js`; one refactor applied to `lib/commands/repair.js` to satisfy max-statements rule.

### Task Completion

- **Rename sync-external-config → repair**: ✅ Complete (lib/commands/repair.js, lib/cli/setup-utility.js, tests/lib/commands/repair.test.js)
- **Expand repair logic**: ✅ Complete (missing externalIntegration, system key alignment, rbac.yaml creation, manifest regeneration)
- **Documentation**: ✅ Complete (utilities.md, external-integration.md, validation.md)
- **docs/commands/repair.md**: N/A (optional, not created)

### File Existence Validation


| File                                         | Status                              |
| -------------------------------------------- | ----------------------------------- |
| `lib/commands/repair.js`                     | ✅ Exists                            |
| `lib/cli/setup-utility.js`                   | ✅ Updated (repair command)          |
| `tests/lib/commands/repair.test.js`          | ✅ Exists                            |
| `docs/commands/utilities.md`                 | ✅ Updated (aifabrix repair section) |
| `docs/configuration/external-integration.md` | ✅ Updated (repair note)             |
| `docs/commands/validation.md`                | ✅ Updated (repair troubleshooting)  |
| `lib/commands/sync-external-config.js`       | ✅ Removed (renamed)                 |
| `docs/commands/repair.md`                    | Optional (not created)              |


### Test Coverage

- ✅ Unit tests exist: `tests/lib/commands/repair.test.js`
- Tests cover: discoverIntegrationFiles, no changes needed, file drift, dry-run, missing externalIntegration, app.key update, rbac.yaml creation, error cases (not external, config not found, no system file), manifest regeneration failure
- All 221 test suites passed, 4848 tests

### Code Quality Validation


| Step                      | Result                          |
| ------------------------- | ------------------------------- |
| Format (npm run lint:fix) | ✅ PASSED                        |
| Lint (npm run lint)       | ✅ PASSED (0 errors, 0 warnings) |
| Tests (npm test)          | ✅ PASSED (all tests pass)       |


### Cursor Rules Compliance


| Rule             | Status                                               |
| ---------------- | ---------------------------------------------------- |
| Code reuse       | ✅ PASSED                                             |
| Error handling   | ✅ PASSED (try-catch, meaningful errors)              |
| Logging          | ✅ PASSED (chalk, logger)                             |
| Type safety      | ✅ PASSED (JSDoc on public functions)                 |
| Async patterns   | ✅ PASSED (async/await, fs.promises where applicable) |
| File operations  | ✅ PASSED (path.join)                                 |
| Input validation | ✅ PASSED (app name validation)                       |
| Module patterns  | ✅ PASSED (CommonJS)                                  |
| Security         | ✅ PASSED (no hardcoded secrets)                      |


### Implementation Completeness

- ✅ Command `aifabrix repair <app>` works
- ✅ `--dry-run` option reports changes without writing
- ✅ Exports: `repairExternalIntegration`, `discoverIntegrationFiles`
- ✅ Return value structure matches plan
- ✅ Deployment manifest regenerated after repair
- ✅ rbac.yaml created from system when missing
- ✅ Documentation updated

### Issues Addressed During Validation

1. **external-manifest-validator.js** – Fixed `== null` to `=== null || === undefined` (eqeqeq lint rule)
2. **repair.js** – Extracted `resolveSystemContext` helper to satisfy max-statements (21 → ≤20)
3. **validate.test.js** – Fixed quotes rule (double → single quotes)

### Final Validation Checklist

- All tasks completed
- All files exist
- Tests exist and pass
- Code quality validation passes
- Cursor rules compliance verified
- Implementation complete

---

## Knowledge Base Validation Report

**Date**: 2026-02-27  
**Plan**: .cursor/plans/Done/77-external_integration_repair_command.plan.md  
**Documents**: docs/commands/utilities.md, docs/configuration/external-integration.md, docs/commands/validation.md  
**Status**: ✅ COMPLETE

### Executive Summary

All three plan-referenced documentation files pass validation. Structure, references, schema-based examples, and MarkdownLint checks are compliant. No manual fixes required.

### Documents Validated

| Document | Status | Notes |
| -------- | ------ | ----- |
| docs/commands/utilities.md | ✅ Passed | Repair section present; structure and nav valid |
| docs/configuration/external-integration.md | ✅ Passed | Repair note present; example valid per schema |
| docs/commands/validation.md | ✅ Passed | Repair troubleshooting present; cross-refs valid |

**Total**: 3 · **Passed**: 3 · **Failed**: 0 · **Auto-fixed**: 0

### Structure Validation

- **utilities.md**: Single `#` title, correct hierarchy, nav links (Documentation index, Commands index), dedicated `aifabrix repair <app>` section with purpose, repairable issues, usage, options, issues.
- **external-integration.md**: Single `#` title, correct hierarchy, nav links (Documentation index, Configuration), repair note at line 16: "If application.yaml gets out of sync with files on disk, run `aifabrix repair <app>` to fix."
- **validation.md**: Single `#` title, correct hierarchy, nav links (Documentation index, Commands index), repair troubleshooting in Issues (line 343): "External datasource file not found" or wrong extension → Run `aifabrix repair <app>`.

### Reference Validation

All cross-references within docs/ resolve to existing files:

- utilities.md → application-yaml.md, external-integration.md ✓
- external-integration.md → external-systems.md, application-yaml.md ✓
- validation.md → wizard.md, external-integration.md, external-systems.md, external-integration-testing.md, configuration/README.md, README.md ✓

No broken internal links.

### Schema-based Validation

- **external-integration.md** (application-schema.json): Example at lines 19–29:
  ```yaml
  externalIntegration:
    schemaBasePath: ./schemas
    systems: [hubspot-system.yaml]
    dataSources: [hubspot-datasource-deal.yaml, hubspot-datasource-contact.yaml]
    autopublish: true
    version: 1.0.0
  ```
  ✅ Valid: schemaBasePath, systems, dataSources, autopublish, version conform to application-schema.json externalIntegration block.

- **utilities.md**, **validation.md**: No externalIntegration/system/datasource YAML/JSON examples requiring schema validation; CLI usage and troubleshooting only.

### Markdown Validation

- **MarkdownLint**: Passed (0 errors) on all three files.
- **Auto-fixes**: None applied; no fixable issues found.

### Project Rules Compliance

- Content focused on **using the builder** (CLI commands, workflows, configuration) for external users.
- CLI examples use `aifabrix` correctly.
- Config examples align with lib/schema (application-schema.json for externalIntegration).
- Mermaid diagram in validation.md uses canonical flow styling.

### Final Checklist

- [x] All documents validated
- [x] MarkdownLint passes (0 errors)
- [x] Cross-references within docs/ valid
- [x] No broken links
- [x] Examples and structure correct per lib/schema (application-schema.json)
- [x] Content focused on using the builder (external users)

