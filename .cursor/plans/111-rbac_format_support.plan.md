---
name: RBAC format support
overview: Add JSON/YAML format support for RBAC config (rbac.yaml, rbac.yml, rbac.json) by introducing a single resolver and using the existing config-format layer everywhere RBAC is read or written, aligned with how application config is handled.
todos: []
isProject: false
---

# RBAC file format support (YAML/JSON)

## Current state

- **Application config** already supports multiple formats via `[lib/utils/app-config-resolver.js](lib/utils/app-config-resolver.js)` (`resolveApplicationConfigPath`) and `[lib/utils/config-format.js](lib/utils/config-format.js)` (`loadConfigFile` / `writeConfigFile`).
- **RBAC** is hardcoded to `rbac.yaml` (and in a few places `rbac.yml`) and parsed only with `yaml.load`; there is no `rbac.json` support and no single place that resolves “the” RBAC file path.

## Target behavior

- RBAC config can live as **rbac.yaml**, **rbac.yml**, or **rbac.json** (same structure; format inferred from extension).
- **Read**: One resolver returns the path to the existing RBAC file (first of `.yaml` / `.yml` / `.json`); all readers use that path + `loadConfigFile` (or a thin wrapper) so JSON is supported.
- **Write**: When updating an existing file, write to the same path so format is preserved; when creating a new RBAC file, default to **rbac.yaml**.
- Error messages and docs refer to “rbac file” or the actual filename (e.g. rbac.json) where appropriate.

## Implementation

### 1. RBAC path resolver

**File:** `[lib/utils/app-config-resolver.js](lib/utils/app-config-resolver.js)`

- Add `resolveRbacPath(appPath)`:
  - Check in order: `rbac.yaml`, `rbac.yml`, `rbac.json` (using `path.join(appPath, name)` and `fs.existsSync`).
  - Return the first path that exists, or `null` if none exist.
- No renames or migrations (unlike application config’s legacy `variables.yaml` → `application.yaml`).
- Export `resolveRbacPath` from the module.

**File:** `[lib/utils/paths.js](lib/utils/paths.js)`

- Require and re-export `resolveRbacPath` from `app-config-resolver` (alongside `resolveApplicationConfigPath`) so existing callers that use `paths` can use it.

### 2. Load RBAC with format support

**File:** `[lib/generator/helpers.js](lib/generator/helpers.js)`

- Change `loadRbac(rbacPath)` to use `loadConfigFile(rbacPath)` when the file exists, instead of reading and `yaml.load`-ing manually. This automatically supports `.json` (and keeps `.yaml`/`.yml`).
- Keep signature: `loadRbac(rbacPath)` returns parsed object or `null` if path is falsy or file does not exist; throw on parse error (message can reference “rbac file” or the path’s basename).
- Callers that currently pass `path.join(appPath, 'rbac.yaml')` will be updated to pass the result of `resolveRbacPath(appPath)` and only call `loadRbac` when that is non-null.

### 3. Call sites that resolve and load RBAC

- `**[lib/generator/index.js](lib/generator/index.js)`**  
In `loadDeploymentConfigFiles`: get `rbacPath` via `resolveRbacPath(appPath)` (from paths or app-config-resolver). If non-null, call `loadRbac(rbacPath)`; else set `rbac` to `null`.
- `**[lib/generator/external-controller-manifest.js](lib/generator/external-controller-manifest.js)`**  
Replace `path.join(appPath, 'rbac.yaml')` with `resolveRbacPath(appPath)`. If null, skip loading; else `loadRbac(rbacPath)`.
- `**[lib/generator/external.js](lib/generator/external.js)`**  
Same: use `resolveRbacPath(appPath)` and only load when non-null (two places that set rbacPath and call loadRbac).
- `**[lib/validation/validator.js](lib/validation/validator.js)`**  
In `validateRbac`: get path with `resolveRbacPath(appPath)` (need to require from paths or app-config-resolver). If null, return same “rbac file not found” warning as today. Else read with `loadConfigFile(path)` (not raw yaml). On parse error, throw with a message like “Invalid syntax in ” (e.g. “Invalid syntax in rbac.json”) instead of “Invalid YAML syntax in rbac.yaml”.

### 4. RBAC write paths (preserve or default format)

- `**[lib/commands/repair-rbac.js](lib/commands/repair-rbac.js)**`  
  - **loadOrCreateRbac**: Use `resolveRbacPath(appPath)` to get existing path. If it exists, load with `loadConfigFile(path)` and return `{ rbac, rbacPath: resolvedPath }`. If none exists, return same structure but `rbacPath` = `path.join(appPath, 'rbac.yaml')` for the default write path.
  - **mergeRbacFromDatasources** (write step): When writing, use `writeConfigFile(rbacPath, rbac)` so that if the user had `rbac.json`, we write JSON; if we created new, `rbacPath` is `rbac.yaml` and we write YAML. Remove direct `yaml.dump` + `fs.writeFileSync` in favor of `writeConfigFile`.
- `**[lib/commands/repair.js](lib/commands/repair.js)`**  
In `createRbacFromSystemIfNeeded`: use `resolveRbacPath(appPath)`; if non-null, return false (file already exists). When creating, keep writing `rbac.yaml` (default) via existing or `writeConfigFile` with path `path.join(appPath, 'rbac.yaml')`.
- **Other writers** (split, app config, external-schema-utils): They only *create* new RBAC files; keep default output as **rbac.yaml** (no change required for format support; optional improvement: in app/config and external-schema-utils, consider checking `resolveRbacPath` and skipping create if e.g. rbac.json already exists).

### 5. Documentation and messages

- **Docs:** In `[docs/commands/utilities.md](docs/commands/utilities.md)`, `[docs/external-systems.md](docs/external-systems.md)`, `[docs/configuration/validation-rules.md](docs/configuration/validation-rules.md)` (and any other references to “rbac.yaml” only): state that RBAC config can be **rbac.yaml**, **rbac.yml**, or **rbac.json** (same structure).
- **Error messages:** Where we throw on invalid RBAC content, use the resolved file basename (e.g. “Invalid syntax in rbac.json”) so the user knows which file failed.

### 6. Tests

- **Resolver:** Add tests for `resolveRbacPath`: returns rbac.yaml when only it exists; returns rbac.yml when only it exists; returns rbac.json when only it exists; precedence order when multiple exist (e.g. rbac.yaml first); returns null when none exist.
- **Validator:** Add/update tests for RBAC validation when the file is **rbac.json** (valid structure; invalid JSON); adjust existing tests that assume only rbac.yaml/yml.
- **Generator / repair / repair-rbac:** Adjust mocks and expectations so that:
  - Load uses resolved path (and optionally test with rbac.json).
  - Repair-rbac write uses `writeConfigFile` and preserves format (test with rbac.json present).
- **Repair:** Test that `createRbacFromSystemIfNeeded` does not create a file when `rbac.json` (or rbac.yaml/yml) already exists.

## Summary of file changes


| Area      | File                                                                                                             | Change                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Resolver  | `lib/utils/app-config-resolver.js`                                                                               | Add `resolveRbacPath(appPath)`; export it.                                                    |
| Paths     | `lib/utils/paths.js`                                                                                             | Re-export `resolveRbacPath`.                                                                  |
| Load      | `lib/generator/helpers.js`                                                                                       | `loadRbac(rbacPath)` uses `loadConfigFile(rbacPath)` when file exists.                        |
| Generator | `lib/generator/index.js`                                                                                         | Use `resolveRbacPath` + load only when non-null.                                              |
| External  | `lib/generator/external-controller-manifest.js`, `lib/generator/external.js`                                     | Use `resolveRbacPath`; load only when non-null.                                               |
| Validator | `lib/validation/validator.js`                                                                                    | Use `resolveRbacPath` + `loadConfigFile`; improve error message.                              |
| Repair    | `lib/commands/repair-rbac.js`                                                                                    | Resolve path; load with `loadConfigFile`; write with `writeConfigFile`.                       |
| Repair    | `lib/commands/repair.js`                                                                                         | Use `resolveRbacPath` in `createRbacFromSystemIfNeeded`; skip create if any rbac file exists. |
| Docs      | utilities.md, external-systems.md, validation-rules.md                                                           | Document rbac.yaml / rbac.yml / rbac.json.                                                    |
| Tests     | New or existing under `tests/lib/utils/`, `tests/lib/validation/`, `tests/lib/generator/`, `tests/lib/commands/` | Resolver tests; validator/generator/repair tests for JSON and precedence.                     |


## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** – Path resolution and config loading live in `lib/utils/`; follow existing app-config-resolver and config-format patterns.
- **[Code Style](.cursor/rules/project-rules.mdc#code-style)** – Use `path.join()` for paths; validate inputs; meaningful error messages with context (e.g. file basename).
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – Files ≤500 lines, functions ≤50 lines; JSDoc for all public functions (e.g. `resolveRbacPath`, `loadRbac`).
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Build → lint → test must pass; no hardcoded secrets; tests in `tests/`.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Jest; mirror structure under `tests/lib/`; mock fs/config; test success and error paths; ≥80% coverage for new code.
- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** – Use `loadConfigFile` / `writeConfigFile` at I/O boundary; developer-friendly error messages.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – Structured error messages; never expose secrets in messages; reference actual file (e.g. rbac.json) in errors.

**Key requirements:**

- Add `resolveRbacPath(appPath)` with JSDoc; return first of rbac.yaml / rbac.yml / rbac.json or null.
- Use `loadConfigFile` / `writeConfigFile` from config-format for all RBAC read/write so format is inferred by extension.
- On parse error, throw with message like "Invalid syntax in " (not only "rbac.yaml").
- New/updated tests for resolver, validator (rbac.json), generator, repair, repair-rbac; maintain or improve coverage.

## Before Development

- Read Architecture Patterns and Validation Patterns in project-rules.mdc (config resolution and config-format usage).
- Review `lib/utils/app-config-resolver.js` and `lib/utils/config-format.js` for existing patterns.
- Confirm test locations: `tests/lib/utils/` (resolver), `tests/lib/validation/`, `tests/lib/generator/`, `tests/lib/commands/`.

## Definition of Done

Before marking this plan complete:

1. **Build:** Run `npm run build` first (must succeed; runs lint + test:ci).
2. **Lint:** Run `npm run lint` (must pass with zero errors/warnings).
3. **Test:** Run `npm test` or `npm run test:ci` after lint (all tests pass; ≥80% coverage for new code).
4. **Validation order:** BUILD → LINT → TEST (mandatory; do not skip steps).
5. **File size:** All touched files ≤500 lines; new functions ≤50 lines.
6. **JSDoc:** All new/changed public functions have JSDoc (params, returns, throws).
7. **Code quality:** No hardcoded secrets; path construction via `path.join()`; errors reference actual file where relevant.
8. **Tasks:** Resolver added; all call sites updated; validator and repair use format-aware load/write; docs updated; tests added/updated as in Implementation and Summary.

## Optional follow-ups (out of scope for this plan)

- **Split / app config / external-schema-utils:** When creating a new RBAC file, optionally match application config format (e.g. create rbac.json if application.json exists); current plan keeps “new file = rbac.yaml”.
- **CLI help:** Description in setup-utility already mentions “rbac.yml”; update to “rbac.yaml / rbac.yml / rbac.json” if desired.

---

## Plan Validation Report

**Date:** 2025-03-14  
**Plan:** .cursor/plans/111-rbac_format_support.plan.md  
**Status:** VALIDATED

### Plan Purpose

- **Title:** RBAC file format support (YAML/JSON).
- **Summary:** Add format-agnostic support for RBAC config so it can be rbac.yaml, rbac.yml, or rbac.json by introducing a single path resolver and using the existing config-format layer for all read/write, aligned with application config.
- **Scope:** Utils (app-config-resolver, paths, config-format), generator (helpers, index, external, external-controller-manifest), validation (validator), commands (repair, repair-rbac), docs, tests.
- **Type:** Refactoring / development (configuration loading and path resolution; no new CLI commands, no template or Docker changes).

### Applicable Rules

- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** – Path resolution and module layout; resolver in utils; consistent with app config.
- **[Code Style](.cursor/rules/project-rules.mdc#code-style)** – path.join(), error messages with context, input validation.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – File/function size; JSDoc for public API.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Build, lint, test, coverage, no secrets (mandatory).
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Jest; tests under tests/; mocks; coverage.
- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** – config-format at I/O boundary; clear errors.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – Context in errors; no secrets in messages.

### Rule Compliance

- DoD requirements: Documented (build first, then lint, then test; order and coverage).
- Architecture: Plan reuses app-config-resolver pattern and config-format.
- Code quality: JSDoc and file/function size called out in DoD.
- Testing: Resolver, validator, generator, repair tests specified; coverage ≥80% in DoD.
- Error messages: Plan specifies using resolved file basename (e.g. rbac.json) in errors.

### Plan Updates Made

- Added **Rules and Standards** with links to project-rules.mdc and key requirements.
- Added **Before Development** checklist (read rules, review resolver/config-format, confirm test layout).
- Added **Definition of Done** (build → lint → test, file size, JSDoc, no secrets, all tasks).
- Appended this **Plan Validation Report**.

### Recommendations

- When implementing, add tests for `resolveRbacPath` in `tests/lib/utils/app-config-resolver.test.js` (or a dedicated rbac-resolver test file) covering precedence and null.
- Ensure validator error message uses the resolved path's basename (e.g. "Invalid syntax in rbac.json") so it stays accurate for all formats.

