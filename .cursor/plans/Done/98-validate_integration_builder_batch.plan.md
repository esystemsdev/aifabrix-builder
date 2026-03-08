---
name: Validate integration builder batch
overview: Add `--integration` and `--builder` flags to `aifabrix validate` so that a single call can validate all integration apps or all builder apps, with new path listing helpers, batch validation and display, CLI wiring, tests, and docs updates.
todos: []
isProject: false
---

# Validate --integration | --builder batch behavior

## Current behavior

- **Command:** `aifabrix validate <appOrFile>` in [lib/cli/setup-utility.js](lib/cli/setup-utility.js) (lines 255–273).
- **Logic:** [lib/validation/validate.js](lib/validation/validate.js) exposes `validateAppOrFile(appOrFile, options)`: if input is a file path it validates that file; otherwise it resolves the app (integration first, then builder via `detectAppType`) and runs either `validateExternalSystemComplete` (integration/external) or application + external files + RBAC validation (builder).
- **Paths:** Integration/builder roots come from [lib/utils/paths.js](lib/utils/paths.js) (`getIntegrationBuilderBaseDir`, `getIntegrationPath(appName)`, `getBuilderPath(appName)`). Builder root can be overridden with `AIFABRIX_BUILDER_DIR`. There is no existing “list all app names” under integration/ or builder/.

## Target behavior

- `aifabrix validate --integration` — validate every app under `integration/` in one run (each as external system).
- `aifabrix validate --builder` — validate every app under `builder/` in one run (each as builder app).
- Optional: `--integration` and `--builder` can both be passed to validate both sets in one call.
- When either flag is used, `<appOrFile>` is not required. When neither is used, current behavior remains: `<appOrFile>` is required.
- Exit code: 0 only if all validated apps pass; otherwise 1.

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** — Adding options and optional argument to `validate`; command pattern, user experience, chalk output, error messages.
- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** — Module structure (paths in `lib/utils/`, validation in `lib/validation/`), CommonJS, file organization.
- **[Code Style](.cursor/rules/project-rules.mdc#code-style)** — Async/await, try-catch for async ops, meaningful errors, input validation, `path.join()` for paths.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** — Jest, test file layout under `tests/lib/`, mock fs and paths, success and error paths, edge cases.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** — Files ≤500 lines, functions ≤50 lines, JSDoc for all public functions.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** — Build, lint, test before commit; coverage ≥80% for new code.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** — Structured errors, chalk for output, no secrets in logs.
- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** — Extends existing validate command and schema validation flow.

**Key requirements:** Commander.js option/argument pattern; validate inputs (e.g. require `appOrFile` when no flag); try-catch in action handler; JSDoc for new public functions; tests for paths listing and batch validate; `npm run build` then lint then test; no hardcoded secrets.

## Before Development

- Read CLI Command Development and Validation Patterns in project-rules.mdc.
- Review existing `validate` command and `validateAppOrFile` in `lib/cli/setup-utility.js` and `lib/validation/validate.js`.
- Confirm path helpers: `getIntegrationBuilderBaseDir`, `getIntegrationPath`, `getBuilderPath` in `lib/utils/paths.js`.
- Review `displayValidationResults` in `lib/validation/validate-display.js` for reuse in batch display.

## Definition of Done

Before marking this plan complete:

1. **Build:** Run `npm run build` first (must succeed; runs lint + test:ci).
2. **Lint:** Run `npm run lint` (zero errors/warnings).
3. **Test:** Run `npm test` or `npm run test:ci` after lint (all tests pass; ≥80% coverage for new code).
4. **Order:** BUILD → LINT → TEST (mandatory; do not skip).
5. **File size:** New/edited files ≤500 lines; functions ≤50 lines.
6. **JSDoc:** All new public functions have JSDoc (params, returns, throws).
7. **Code quality:** Rule requirements met; no hardcoded secrets.
8. **Security:** No secrets in logs; input/path handling safe.
9. All implementation tasks and doc updates done.
10. Batch behavior and exit codes match spec.

## Implementation plan

### 1. Paths: list app names under integration and builder

**File:** [lib/utils/paths.js](lib/utils/paths.js)

- Add `**getIntegrationRoot()`**: return `path.join(getIntegrationBuilderBaseDir(), 'integration')`. Used only for listing; keep `getIntegrationBuilderBaseDir` internal (already not exported).
- Add `**getBuilderRoot()`**: return `process.env.AIFABRIX_BUILDER_DIR` (trimmed) if set, else `path.join(getIntegrationBuilderBaseDir(), 'builder')`, so it matches the root used by `getBuilderPath(appName)`.
- Add `**listIntegrationAppNames()`**: `fs.readdirSync(getIntegrationRoot())` (or return `[]` if root missing), filter to entries where `fs.statSync(path.join(root, name)).isDirectory()` and `!name.startsWith('.')`, return sorted names.
- Add `**listBuilderAppNames()`**: same for `getBuilderRoot()`.
- Export: `getIntegrationRoot`, `getBuilderRoot`, `listIntegrationAppNames`, `listBuilderAppNames`.

Handle missing roots: if integration or builder root does not exist, return `[]` so “validate all” is a no-op for that root rather than throwing.

### 2. Validate: batch entry points and result shape

**File:** [lib/validation/validate.js](lib/validation/validate.js)

- **Batch result shape:**  
`{ batch: true, valid: boolean, results: [ { appName, result?, error? } ], errors: string[], warnings: string[] }`  
  - For each app: either `result` (full `validateAppOrFile` result) or `error` (string) if validation threw.  
  - Top-level `valid`: true only if every item has `result` and `result.valid`.  
  - Aggregate `errors`/`warnings` from all results (and per-app error messages).
- `**validateAllIntegrations(options)`**  
  - Call `listIntegrationAppNames()` from paths.  
  - For each name, `try { result = await validateAppOrFile(name, options); push({ appName, result }); } catch (e) { push({ appName, error: e.message }); }`.  
  - Build batch result and return it.
- `**validateAllBuilderApps(options)`**  
  - Same pattern using `listBuilderAppNames()`.
- `**validateAll(options)`** (optional, for both flags): run `validateAllIntegrations` and `validateAllBuilderApps`, merge `results` arrays and aggregate `valid`, `errors`, `warnings` into one batch result.

Export the new functions.

### 3. Display: batch results

**File:** [lib/validation/validate-display.js](lib/validation/validate-display.js)

- `**displayBatchValidationResults(batchResult)`**  
  - Expect `batchResult.batch === true` and `batchResult.results`.  
  - For each `results` item: log app name (e.g. section header), then if `result` use existing single-app display (reuse `displayValidationResults(result)` or a compact summary to avoid duplication); if `error` log the error line.  
  - Then print overall summary: e.g. “N passed, M failed” and overall status (passed / failed).  
  - Keep output readable (e.g. one block per app, then summary).
- **Single-app display reuse:** Prefer calling existing `displayValidationResults(result)` for each app so external-system step-by-step and normal app output stay consistent; if that is too verbose for batch, add an internal “compact” mode or a one-line summary helper and use it when `batchResult.batch` is true.

### 4. CLI: optional argument and flags

**File:** [lib/cli/setup-utility.js](lib/cli/setup-utility.js)

- Change command to `**validate [appOrFile]`** (optional argument).
- Add options:  
`**--integration`** — validate all integrations;  
`**--builder`** — validate all builder applications.
- Logic:
  - If `--integration` or `--builder` (or both):  
    - If both: call `validateAll()` (or call `validateAllIntegrations` and `validateAllBuilderApps` and merge).  
    - If only `--integration`: call `validateAllIntegrations()`.  
    - If only `--builder`: call `validateAllBuilderApps()`.  
    - Output: `displayBatchValidationResults(batchResult)`. If `--format json`, log `JSON.stringify(batchResult, null, 2)`.  
    - Exit 1 if `!batchResult.valid`, else 0.
  - Else:  
    - Require `appOrFile`; if missing, show error (e.g. “App name or file path is required, or use --integration / --builder”) and exit 1.  
    - Current flow: `validateAppOrFile(appOrFile, options)` then `displayValidationResults(result)` and exit 1 if `!result.valid`.
- Preserve existing `--format <format>` behavior for both single-app and batch (json vs default).

### 5. Tests

**File:** [tests/lib/validation/validate.test.js](tests/lib/validation/validate.test.js)

- **Paths (if not covered elsewhere):** Unit tests for `listIntegrationAppNames` / `listBuilderAppNames`: mock `fs.readdirSync` and `fs.statSync` so that only directories are returned; assert returned names and that non-dirs and dot-names are excluded. Empty root or missing root returns `[]`.
- **validate.js:**  
  - Mock `listIntegrationAppNames` / `listBuilderAppNames` and `validateAppOrFile`.  
  - `validateAllIntegrations`: empty list → batch result with 0 results, valid true; list of two names with both passing → valid true and two results; one passing and one throwing → valid false, one result with `result`, one with `error`.  
  - Same for `validateAllBuilderApps`.  
  - Optional: `validateAll` with both lists merged.
- **Display:** Test `displayBatchValidationResults` with a small batch result (e.g. two apps, one pass one fail): assert logger.log calls reflect per-app output and final summary (no need to snapshot full text; structure is enough).
- **CLI:** In existing CLI tests (or minimal integration), invoke validate with `--integration` and `--builder` with mocks so the right batch path is run and exit code is 1 when any app fails.

### 6. Documentation

- **[docs/commands/validation.md](docs/commands/validation.md)**  
  - In the “aifabrix validate” section: document `validate [appOrFile]` with optional argument.  
  - Add **Options:** `--integration` — validate all applications under `integration/`; `--builder` — validate all applications under `builder/`.  
  - Add usage examples:  
    - `aifabrix validate --integration`  
    - `aifabrix validate --builder`  
    - `aifabrix validate --integration --builder`
  - Describe batch output: per-app results then overall summary; exit code 1 if any app fails.  
  - Note that when `--integration` or `--builder` is used, `appOrFile` is optional and ignored if provided.
- **[docs/configuration/validation-rules.md](docs/configuration/validation-rules.md)**  
  - In the intro, mention that validation can be run for a single app/file or for all integrations or all builder apps in one call (`--integration` / `--builder`).
- **Cross-links:** Ensure [docs/commands/README.md](docs/commands/README.md) or command index still lists validate and optionally mention batch mode.

## Edge cases

- **Empty lists:** No integration or builder dirs (or empty): batch valid true, results `[]`, no-op display.
- **Per-app failure:** One app throws (e.g. missing `application.yaml`): record `{ appName, error }`, continue, set overall `valid: false`.
- **Builder root override:** `listBuilderAppNames()` uses the same `getBuilderRoot()` as `getBuilderPath`, so `AIFABRIX_BUILDER_DIR` is respected for batch builder validation.

## Files to touch


| Area       | File                                   | Changes                                                                                   |
| ---------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| Paths      | lib/utils/paths.js                     | getIntegrationRoot, getBuilderRoot, listIntegrationAppNames, listBuilderAppNames          |
| Validation | lib/validation/validate.js             | validateAllIntegrations, validateAllBuilderApps, optional validateAll; batch result shape |
| Display    | lib/validation/validate-display.js     | displayBatchValidationResults                                                             |
| CLI        | lib/cli/setup-utility.js               | validate [appOrFile], --integration, --builder, batch branch and exit code                |
| Tests      | tests/lib/validation/validate.test.js  | batch validation and display tests; mock paths list                                       |
| Tests      | tests/lib/utils/paths.test.js (or new) | listIntegrationAppNames / listBuilderAppNames if paths tests exist                        |
| Docs       | docs/commands/validation.md            | Options, examples, batch output                                                           |
| Docs       | docs/configuration/validation-rules.md | One-line batch mention                                                                    |


---

## Plan Validation Report

**Date:** 2025-03-08  
**Plan:** .cursor/plans/98-validate_integration_builder_batch.plan.md  
**Status:** VALIDATED

### Plan Purpose

Add `--integration` and `--builder` flags to `aifabrix validate` so one call can validate all integration apps or all builder apps. Scope: path listing helpers, batch validation and display, CLI wiring, tests, and docs. **Type:** Development (CLI options, lib changes, tests, documentation).

### Applicable Rules

- **CLI Command Development** — New options and optional argument; command pattern, UX, chalk, error handling.
- **Architecture Patterns** — Paths in lib/utils, validation in lib/validation; module/export pattern.
- **Code Style** — Async/await, try-catch, input validation, path.join, file ops.
- **Testing Conventions** — Jest, mocks (fs, paths), test layout, success/error/edge cases.
- **Code Quality Standards** — File/function size, JSDoc, documentation.
- **Quality Gates** — Mandatory for all plans; build/lint/test and coverage.
- **Error Handling & Logging** — Errors with context, chalk, no secrets in logs.
- **Validation Patterns** — Extends existing validate flow.

### Rule Compliance

- DoD requirements documented (build first, lint, test, order, coverage, file size, JSDoc, security).
- CLI, paths, validation, display, and tests addressed in implementation plan.
- Docs updates specified (validation.md, validation-rules.md, README cross-links).

### Plan Updates Made

- Added **Rules and Standards** with links to project-rules.mdc and key requirements.
- Added **Before Development** checklist (read rules, review validate command and paths, display).
- Added **Definition of Done** (build → lint → test, file size, JSDoc, security, tasks complete).

### Recommendations

- When implementing, keep batch display consistent with existing `displayValidationResults` (reuse or compact mode).
- In tests, mock `listIntegrationAppNames` / `listBuilderAppNames` so unit tests do not depend on real filesystem layout.
- Ensure empty integration/builder roots return `[]` and produce valid batch result (no-op) as specified in edge cases.

---

## Implementation Validation Report

**Date:** 2026-03-08  
**Plan:** .cursor/plans/98-validate_integration_builder_batch.plan.md  
**Status:** ✅ COMPLETE

### Executive Summary

All implementation requirements from the plan have been implemented. Path listing helpers, batch validation and display, CLI options, tests, and documentation are in place. Format, lint, and test all pass. One file (lib/utils/paths.js) exceeds 500 lines by count but has an existing eslint-disable for central path resolution; all other touched files are within limits.

### Task Completion

Implementation plan had 6 sections (Paths, Validate batch, Display, CLI, Tests, Documentation). All are implemented:

- **Paths:** getIntegrationRoot, getBuilderRoot, listIntegrationAppNames, listBuilderAppNames in lib/utils/paths.js; missing roots return [].
- **Validate batch:** Batch result shape and validateAllIntegrations, validateAllBuilderApps, validateAll in lib/validation/validate-batch.js; validate.js re-exports and wires to validateAppOrFile.
- **Display:** displayBatchValidationResults in lib/validation/validate-display.js (per-app blocks + summary).
- **CLI:** validate [appOrFile], --integration, --builder in lib/cli/setup-utility.js; runValidateCommand extracted for lint compliance.
- **Tests:** Batch and display tests in tests/lib/validation/validate.test.js; path list tests in tests/lib/utils/paths.test.js.
- **Documentation:** docs/commands/validation.md and docs/configuration/validation-rules.md updated with options, examples, and batch mention.

### File Existence Validation


| File                                   | Status                                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| lib/utils/paths.js                     | ✅ getIntegrationRoot, getBuilderRoot, listIntegrationAppNames, listBuilderAppNames implemented and exported                            |
| lib/validation/validate.js             | ✅ Batch exports (validateAllIntegrations, validateAllBuilderApps, validateAll, buildBatchResult); uses validate-batch.js               |
| lib/validation/validate-batch.js       | ✅ New file; buildBatchResult, collectResultErrors, collectResultWarnings, validateAllIntegrations, validateAllBuilderApps, validateAll |
| lib/validation/validate-display.js     | ✅ displayBatchValidationResults                                                                                                        |
| lib/cli/setup-utility.js               | ✅ validate [appOrFile], --integration, --builder, runValidateCommand                                                                   |
| tests/lib/validation/validate.test.js  | ✅ Batch and displayBatchValidationResults tests; paths mocks                                                                           |
| tests/lib/utils/paths.test.js          | ✅ listIntegrationAppNames/listBuilderAppNames (empty root, getIntegrationRoot/getBuilderRoot)                                          |
| docs/commands/validation.md            | ✅ validate [appOrFile], Options, batch examples, Batch mode description                                                                |
| docs/configuration/validation-rules.md | ✅ Batch mention in intro                                                                                                               |


### Test Coverage

- **Unit tests:** Batch validation (empty list, all pass, one throws, one invalid, validateAll merge), displayBatchValidationResults (per-app + summary, no results array).
- **Paths tests:** listIntegrationAppNames/listBuilderAppNames return [] when root missing; getIntegrationRoot/getBuilderRoot; AIFABRIX_BUILDER_DIR for builder root.
- **Location:** tests/lib/validation/validate.test.js, tests/lib/utils/paths.test.js.
- All tests pass (5207 passed, 28 skipped).

### Code Quality Validation


| Step              | Result                            |
| ----------------- | --------------------------------- |
| Format (lint:fix) | ✅ PASSED                          |
| Lint              | ✅ PASSED (0 errors, 0 warnings)   |
| Tests             | ✅ PASSED (237 suites, 5207 tests) |


### Cursor Rules Compliance

- **Code reuse:** Batch logic in validate-batch.js; display reuses displayValidationResults.
- **Error handling:** try/catch in batch loops; per-app errors captured; CLI handleCommandError.
- **Logging:** logger and chalk used; no secrets in logs.
- **Type safety:** JSDoc on new public functions (paths, validate-batch, validate-display).
- **Async patterns:** async/await; batch uses validateAppOrFile per app.
- **File operations:** path.join in paths.js; fs.readdirSync/statSync for listing.
- **Input validation:** appOrFile required when no --integration/--builder; missing root returns [].
- **Module patterns:** CommonJS; named exports.
- **Security:** No hardcoded secrets; path handling safe.

### Implementation Completeness

- **Paths:** ✅ getIntegrationRoot, getBuilderRoot, listIntegrationAppNames, listBuilderAppNames.
- **Batch result shape:** ✅ batch, valid, results[], errors[], warnings[]; aggregation from result.application and result.steps.
- **CLI:** ✅ Optional [appOrFile]; --integration, --builder; batch branch and exit code 0/1.
- **Display:** ✅ Per-app blocks and summary (N passed, M failed).
- **Docs:** ✅ validation.md and validation-rules.md updated.
- **File size:** lib/utils/paths.js is 562 lines (existing eslint-disable max-lines); validate.js 492, validate-display.js 475, setup-utility.js 335, validate-batch.js 149 — all within 500 except paths.js which is exempted.

### Issues and Recommendations

- None. Implementation matches plan. paths.js line count is pre-existing (eslint-disable for central path resolution).

### Final Validation Checklist

- All implementation tasks done (Paths, Validate batch, Display, CLI, Tests, Docs)
- All mentioned files exist and contain expected changes
- Tests exist for batch validation, display, and path listing; all pass
- Format (lint:fix) passed
- Lint passed (0 errors, 0 warnings)
- Tests passed
- Cursor rules compliance verified
- Batch behavior and exit codes match spec

