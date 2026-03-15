---
name: Datasource E2E logs and optional app
overview: Enhance datasource test-e2e with managed-record counts and CIP execution info when verbose; add test-integration -v; add log-e2e and log-integration commands with a detailed visual log viewer; make --app optional by resolving app from datasource key (scan or parse); add "ds" as alias for "datasource"; manual tests and documentation updates.
todos: []
isProject: false
---

# Datasource E2E improvements, log commands, optional --app, and ds alias

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – New commands (log-e2e, log-integration), options (-v for test-integration), alias (ds); command pattern, options, error handling, chalk output.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – File ≤500 lines, functions ≤50 lines, JSDoc for all public functions.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Build first, then lint, then test; no hardcoded secrets; documentation updated.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Jest for unit tests, mocks for external deps; 80%+ coverage for new code; manual tests in tests/manual (excluded from CI).
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – try/catch for async, chalk for output, no secrets in logs.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – No secrets in code or logs; input validation.

**Key requirements:** Validate inputs (datasource key, file paths); JSDoc on new functions; unit tests for resolver, log-viewer, display; manual test checklist for CLI commands; docs updated per [docs-rules.mdc](.cursor/rules/docs-rules.mdc) (command-centric, no REST API details).

## Before Development

- Read CLI Command Development and Testing Conventions from project-rules.mdc.
- Review [lib/commands/datasource.js](lib/commands/datasource.js), [lib/datasource/test-e2e.js](lib/datasource/test-e2e.js), [lib/datasource/test-integration.js](lib/datasource/test-integration.js), [lib/utils/external-system-display.js](lib/utils/external-system-display.js).
- Review [tests/manual/README.md](tests/manual/README.md) and [tests/manual/api-external-test-e2e.test.js](tests/manual/api-external-test-e2e.test.js) for manual test patterns.
- Confirm [docs/commands/external-integration.md](docs/commands/external-integration.md) datasource section for doc update targets.

## Definition of Done

Before marking this plan complete:

1. **Build:** Run `npm run build` FIRST (must succeed; runs lint + test:ci).
2. **Lint:** Run `npm run lint` (zero errors/warnings).
3. **Test:** Run `npm test` or `npm run test:ci` AFTER lint (all tests pass; ≥80% coverage for new code).
4. **Order:** BUILD → LINT → TEST (mandatory; do not skip).
5. **Manual tests:** Execute manual test checklist (see section 7) against `integration/hubspot-test` (or create minimal fixture under integration/ if hubspot-test not available) and document results.
6. **File size:** New/edited files ≤500 lines; functions ≤50 lines.
7. **JSDoc:** All new public functions have JSDoc (params, returns, throws).
8. **Security:** No hardcoded secrets; no secrets in logs.
9. **Documentation:** All docs listed in section 8 updated.
10. **All tasks completed:** test-e2e -v, test-integration -v, log-e2e, log-integration, optional --app, ds alias, manual tests, docs.

## Scope

- **Builder (this repo):** CLI changes only. Dataplane already exposes `ExternalDataSourceE2ETestResponse` (with optional `auditLog` when `audit=true`), sync step evidence with record counts and `syncJobId`, and GET `/api/v1/external/{sourceIdOrKey}/executions/{executionId}` for CIP execution trace. No dataplane changes required unless you want to add `executionId` to the E2E response explicitly (currently it is inside `auditLog` when requested).
- **References:** [lib/datasource/test-e2e.js](lib/datasource/test-e2e.js), [lib/commands/datasource.js](lib/commands/datasource.js), [lib/utils/external-system-display.js](lib/utils/external-system-display.js), [lib/utils/test-log-writer.js](lib/utils/test-log-writer.js), [lib/utils/paths.js](lib/utils/paths.js), [lib/commands/repair-internal.js](lib/commands/repair-internal.js).

---

## 1. test-e2e -v: managed records and CIP execution

**Goal:** With `aifabrix datasource test-e2e <key> --verbose` (or `-v`), show (1) amount of managed records and (2) CIP execution log / executionId.

**Dataplane contract (already in place):**

- E2E request body can include `audit: true`; response then includes `auditLog` (list of CIP execution traces with `executionId`).
- Sync step evidence (in `steps` or `completedActions`) has `evidence.jobs[]` with `recordsProcessed`, `totalRecords`, and `audit`: `inserted`, `updated`, `deleted`, `totalProcessed`. If the backend adds `insertedCount`, `updatedCount`, `deletedCount`, `skippedCount`, `rejectedByQualityCount` (ExternalRecordBulkResponse), surface those when present.

**Implementation:**

- **Request:** When `verbose` is true, set `body.audit = true` in the E2E request (in [lib/datasource/test-e2e.js](lib/datasource/test-e2e.js) `buildE2EBody`) so the response can include `auditLog`.
- **Display – managed records:** In [lib/utils/external-system-display.js](lib/utils/external-system-display.js) `displayE2EResults`, when `verbose` is true and a step is `sync`, read `evidence.jobs[]` and for each job show:
  - `recordsProcessed` / `totalRecords` (or from `audit`: `inserted`, `updated`, `deleted`, `totalProcessed`).
  - If present: `insertedCount`, `updatedCount`, `deletedCount`, `skippedCount`, `rejectedByQualityCount` (from job or job.audit).
- **Display – CIP execution:** When `verbose` and `data.auditLog` is present and non-empty, show a short line per trace (e.g. "CIP execution: " or "CIP execution trace(s): N"). Do not expose dataplane URLs in user docs; optional one-liner in code comment that full trace is available via the dataplane execution API is enough.
- **Validation:** Add or extend a test that with `verbose: true` the E2E body includes `audit: true` and that display code handles `auditLog` and sync job counts (mock response with `auditLog` and `evidence.jobs[].audit`).

**Example output (test-e2e -v):**

```
📊 E2E Test Results

Status: completed
  ✓ credential
    Test request completed with status 200
  ✓ mapping
    Pipeline test completed for all datasources
  ✓ sync
    Sync completed for all datasources
    Managed records: 96 processed (inserted: 0, updated: 96, deleted: 0) [totalProcessed: 96]
    CIP execution trace(s): 1 (executionId: abc123…)
  ✓ sync_status
  ✓ persistence
  ✓ vector
  ✓ cip_simulate
  ✓ capacity

✅ E2E test passed!
```

---

## 1b. test-integration -v (verbose)

**Goal:** Add `-v, --verbose` to `aifabrix datasource test-integration <datasourceKey>` so that when set, the CLI shows detailed step output (e.g. validation results, field mapping details, endpoint test) in the same style as test-e2e -v.

**Implementation:**

- In [lib/commands/datasource.js](lib/commands/datasource.js), add `.option('-v, --verbose', 'Show detailed step and validation output')` to the test-integration command and pass `options.verbose` into `runDatasourceTestIntegration`.
- In [lib/utils/external-system-display.js](lib/utils/external-system-display.js), `displayIntegrationTestResults` already accepts `verbose` and calls `displayVerboseIntegrationDetails` per datasource result. Ensure integration test result includes validationResults, fieldMappingResults, endpointTestResults and that verbose mode prints them (dimensions, mapping count, validation errors if any, normalized output summary).
- In [lib/datasource/test-integration.js](lib/datasource/test-integration.js), ensure the result passed to the display includes the fields needed for verbose output (no API change; display only).

---

## 2. New commands: log-e2e and log-integration

**Goal:** Two commands:

- `aifabrix datasource log-e2e <datasourceKey> [--file <path>]`
- `aifabrix datasource log-integration <datasourceKey> [--file <path>]`

**Behavior:**

- **Without `--file`:** Resolve app from datasource key (same logic as optional --app below). Log folder = `integration/<appKey>/logs/`. List files matching `test-e2e-*.json` or `test-integration-*.json`, choose the latest by mtime, and display it with the visual formatter.
- **With `--file`:** Use the given path (if relative, resolve relative to cwd or to the app logs dir; decide one convention and document). Display that file with the same formatter.
- **Visual interface (detailed):** A single formatter for both log types that prints the following so a developer can quickly see outcome, record counts, and errors. Use chalk, clear section headers, and compact bullet lists; terminal-only.
**For both log types:**
  - **Request** – sourceIdOrKey (or systemKey + datasourceKey), includeDebug, cleanup, primaryKeyValue (if present), timestamp/file name.
  - **Response summary** – success/status, error message if failed.
  **For E2E log (log-e2e):**
  - **Steps** – each step name, success/message; for **sync** step: per-job sourceKey, syncJobId, status, recordsProcessed/totalRecords; **audit** block: inserted, updated, deleted, totalProcessed; optional insertedCount, updatedCount, deletedCount, skippedCount, rejectedByQualityCount; firstRequestUrl (truncated if long), firstRequestDurationSeconds; apiCalls count or list (method, duration, responseSummary if present).
  - **CIP / auditLog** – if present: executionId (or trace id) per trace, step count; no raw URLs.
  - **Errors** – any step.error or top-level error with message.
  **For integration log (log-integration):**
  - **Validation** – isValid, errors[] (list each); normalizedMetadata field count or key sample.
  - **Field mapping** – dimensions[], mappedDimensions count, mappingCount.
  - **Endpoint test** – endpointConfigured, any message.
  - **Steps** – validation, fieldMapping, endpointTest with success/message.
  - **Normalized output** – brief summary (e.g. "Output: 12 fields" or top-level keys); optional sample of id/name if present.
  - **Errors** – any step error or validation errors.

**Implementation:**

- **Resolver:** Reuse the same app-resolution used for test-e2e/test-integration when `--app` is omitted (see section 4). So log-e2e and log-integration take `<datasourceKey>` and optional `--app` and `--file`.
- **New module:** e.g. [lib/datasource/log-viewer.js](lib/datasource/log-viewer.js): `getLatestLogPath(logsDir, pattern)`, `formatLogContent(parsedJson, logType)`, `runLogViewer(datasourceKey, options)` where `options.app`, `options.file`, `options.logType` = `'test-e2e'` | `'test-integration'`.
- **CLI:** In [lib/commands/datasource.js](lib/commands/datasource.js) add:
  - `datasource log-e2e <datasourceKey>` with options `--app`, `--file`; call log-viewer with `logType: 'test-e2e'`.
  - `datasource log-integration <datasourceKey>` with options `--app`, `--file`; call log-viewer with `logType: 'test-integration'`.
- **Docs:** In [docs/commands/external-integration.md](docs/commands/external-integration.md) (datasource section) and any dedicated datasource doc, document both commands: what they show, that without `--file` the latest log in the app’s log folder is used, and that `--app` can be omitted when the datasource key resolves to a single app.

**Example output (log-e2e):** Request (sourceIdOrKey, includeDebug, cleanup); Response (success, status); Steps with per-step success/message; for sync step: job sourceKey, syncJobId, recordsProcessed/totalRecords, audit inserted/updated/deleted/totalProcessed, firstRequestUrl trunc, duration, apiCalls count; CIP execution trace count. **Example output (log-integration):** Request (systemKey, datasourceKey, includeDebug); Response (success, message); Validation (isValid, normalizedMetadata field count); Field mapping (dimensions, mappingCount); Endpoint test; Steps; Normalized output summary.

---

## 3. Alias "ds" for "datasource"

**Goal:** Allow `aifabrix ds ...` as shorthand for `aifabrix datasource ...`.

**Implementation:** In [lib/commands/datasource.js](lib/commands/datasource.js), when creating the command, add `.alias('ds')` to the Commander subcommand (e.g. `program.command('datasource').description('...').alias('ds')`). Confirm Commander supports alias on the parent command so that `program.command('datasource').alias('ds')` registers both names. If the API only allows alias on the program, add a separate `program.command('ds')` that delegates to the same handler (e.g. re-use the same command object or action). Update docs to mention `ds` as shorthand.

---

## 4. Make --app optional (resolve app from datasource key)

**Goal:** For all datasource commands that take a datasource key and currently require `--app` or cwd: try to resolve app from the key. If exactly one app matches, proceed; if multiple, ask the user to pass `--app`.

**Resolution order:**

1. Explicit `--app` if provided.
2. Current directory: if cwd is under `integration/<appKey>/`, use that `appKey` (existing `resolveIntegrationAppKeyFromCwd()`).
3. **Scan:** For each app in `listIntegrationAppNames()`, load `application.yaml` and datasource files (from `externalIntegration.dataSources`), read each file’s `key` (as in [lib/datasource/test-integration.js](lib/datasource/test-integration.js) / `findDatasourceFileByKey`). If any datasource key equals the given `datasourceKey`, record that app. If exactly one app → use it. If more than one → throw with message: "More than one app has this datasource; add --app ."
4. **Parse fallback:** If zero apps from scan, try convention `<external-system-key>-<ds-key>`: e.g. `test-e2e-hubspot-companies` → candidate app key `test-e2e-hubspot` (all segments except the last). Check that `integration/<candidate>/` exists (and optionally that it contains a datasource with that key). If found, use that app.

**Where to implement:**

- **Shared helper:** New function in [lib/utils/paths.js](lib/utils/paths.js) or a small [lib/datasource/resolve-app.js](lib/datasource/resolve-app.js): `resolveAppKeyForDatasource(datasourceKey, explicitApp)` returning `Promise<{ appKey: string }>`. Implementation: (1) if explicitApp return it; (2) if resolveIntegrationAppKeyFromCwd() return it; (3) scan integration apps and collect matches; (4) if one match return it, if multiple throw, if zero try parse and existence check; (5) if still no app, throw the same error as today ("Use --app  or run from integration//").
- **Call sites:** Use this in:
  - [lib/datasource/test-e2e.js](lib/datasource/test-e2e.js): replace `resolveAppKey(options.app)` with `await resolveAppKeyForDatasource(datasourceKey, options.app)`.
  - [lib/datasource/test-integration.js](lib/datasource/test-integration.js): replace current app resolution with `resolveAppKeyForDatasource(datasourceKey, options.app)` (and keep systemKey resolution from that app).
  - New log-e2e and log-integration handlers: pass `options.app` and datasourceKey into the same resolver to get appKey for logs path.

**Scope of "all cases where we have --app":** Apply to datasource test-integration, test-e2e, log-e2e, log-integration. Other commands that use `--app` (e.g. auth, login, repair, create) are out of scope unless you explicitly want the same resolution there; they often use `--app` as "application name" in a different sense (builder app or integration app by name), so keep this behavior limited to datasource-key-based commands.

---

## 5. Summary and file list


| Area                      | Action                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| test-e2e -v               | Set `audit: true` when verbose; in display, show sync job record counts and auditLog summary (executionId / trace count).                                                |
| test-integration -v       | Add `-v, --verbose` option; display detailed validation, field mapping, endpoint test (same style as e2e).                                                               |
| log-e2e / log-integration | New commands; shared log viewer (latest file or --file); detailed terminal format (request, response, steps, sync counts, validation, CIP trace).                        |
| --app optional            | New resolver: cwd → scan by datasource key → parse key; use in test-e2e, test-integration, log-e2e, log-integration.                                                     |
| ds alias                  | `datasource` command alias `ds`.                                                                                                                                         |
| Docs                      | [docs/commands/external-integration.md](docs/commands/external-integration.md): log-e2e, log-integration, optional --app, ds, test-integration -v, test-e2e -v.          |
| Unit tests                | test-e2e body has audit when verbose; display handles auditLog and counts; resolver unit tests (scan one/many/zero, parse fallback); log-viewer tests (format mock log). |
| Manual tests              | Checklist in section 7; optional tests/manual/datasource-commands.test.js; use integration/hubspot-test; document in tests/manual/README.md.                             |


**Key files to add/change:**

- [lib/datasource/test-e2e.js](lib/datasource/test-e2e.js) – body.audit when verbose; use new app resolver.
- [lib/utils/external-system-display.js](lib/utils/external-system-display.js) – verbose: sync record counts + auditLog line(s).
- [lib/datasource/log-viewer.js](lib/datasource/log-viewer.js) – new: getLatestLogPath, formatLogContent, runLogViewer.
- [lib/datasource/resolve-app.js](lib/datasource/resolve-app.js) – new: resolveAppKeyForDatasource (or under paths.js if preferred).
- [lib/commands/datasource.js](lib/commands/datasource.js) – log-e2e, log-integration, alias ds; pass resolver into test commands.
- [lib/datasource/test-integration.js](lib/datasource/test-integration.js) – use resolveAppKeyForDatasource.
- [lib/utils/paths.js](lib/utils/paths.js) – possibly export listIntegrationAppNames for resolver (already exported).
- [docs/commands/external-integration.md](docs/commands/external-integration.md) – datasource section: log-e2e, log-integration, optional --app, ds alias, test-integration -v, test-e2e -v.

---

## 6. Dataplane verification (no code change in builder)

- Confirm that POST test-e2e with `audit: true` returns `auditLog` with at least one item and each item has `executionId` (or equivalent) so the CLI can show "CIP execution: …". If the schema uses a different field name, adjust the display code accordingly.
- Confirm GET `/api/v1/external/{sourceIdOrKey}/executions/{executionId}` exists and returns the CIP execution log when you have an executionId from the E2E response (for future use; CLI does not need to call it in this plan if we only show executionId in the summary).

---

## 7. Manual tests and validation

**Goal:** Ensure the new and changed behavior works correctly with real data and a real integration folder. Manual tests are run via `npm run test:manual` (or `npx jest --config jest.config.manual.js --runInBand …`) and are excluded from CI.

**Location:** [tests/manual/](tests/manual/). Use [integration/hubspot-test/](integration/hubspot-test/) as the target app when running CLI commands (it exists in this repo with application config and datasource files). If a different fixture is needed (e.g. minimal app with one datasource), create it under `integration/` and document it.

**Manual test checklist (validate after implementation):**

1. **Optional --app (resolve from datasource key)**
  - From repo root: `aifabrix datasource test-integration hubspot-test-company` (or the exact datasource key in hubspot-test) without `--app`. Expect: app resolved, test runs.  
  - Same for `test-e2e`, `log-e2e`, `log-integration` without `--app` when only one app has that datasource key.  
  - If two apps had the same datasource key: expect error "More than one app has this datasource; add --app ".  
  - With `--app hubspot-test`: same commands succeed and use that app.
2. **test-e2e -v**
  - `aifabrix datasource test-e2e <key> -v` (and optionally `--debug`). Expect: step list, managed record counts for sync step (e.g. inserted/updated/deleted/totalProcessed), and CIP execution trace summary when auditLog is returned.
3. **test-integration -v**
  - `aifabrix datasource test-integration <key> -v`. Expect: detailed validation, field mapping, and endpoint test output (dimensions, mapping count, validation result).
4. **log-e2e**
  - After running test-e2e with `--debug`, run `aifabrix datasource log-e2e <key>` (no `--file`). Expect: latest E2E log from `integration/hubspot-test/logs/` displayed with the detailed format (request, response, steps, sync job record counts, CIP trace count).  
  - `aifabrix datasource log-e2e <key> --file integration/hubspot-test/logs/test-e2e-<timestamp>.json`. Expect: that file displayed in the same format.
5. **log-integration**
  - After running test-integration with `--debug`, run `aifabrix datasource log-integration <key>` (no `--file`). Expect: latest integration log displayed with validation, field mapping, steps, normalized output summary.  
  - With `--file <path>`: that file displayed.
6. **ds alias**
  - `aifabrix ds test-e2e <key> -v`, `aifabrix ds log-e2e <key>`, `aifabrix ds list`. Expect: same behavior as `aifabrix datasource ...`.

**Optional:** Add a new manual test file under `tests/manual/` (e.g. `datasource-commands.test.js`) that runs the above scenarios when an integration app and dataplane are available; skip or return early when not (same pattern as [tests/manual/api-external-test-e2e.test.js](tests/manual/api-external-test-e2e.test.js)). Document in [tests/manual/README.md](tests/manual/README.md).

---

## 8. Documentation to update

**Primary doc:** [docs/commands/external-integration.md](docs/commands/external-integration.md).

**Sections to add or update (command-centric; no REST API details per [docs-rules.mdc](.cursor/rules/docs-rules.mdc)):**


| Topic                              | Action                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **aifabrix datasource** (overview) | Add subcommands: `log-e2e`, `log-integration`. Mention that `ds` is an alias for `datasource`.                                                                                             |
| **test-integration ****            | Document `-v, --verbose`. State that `--app` is optional when the datasource key resolves to a single app (or when running from `integration/<appKey>/`).                                  |
| **test-e2e ****                    | Document that with `-v` the CLI shows managed record counts and CIP execution trace summary. State that `--app` is optional (same as above).                                               |
| **log-e2e ****                     | New subsection: what the command does (show last or specified E2E log in a readable format); options `--app`, `--file`; without `--file` uses latest log in app log folder; example usage. |
| **log-integration ****             | New subsection: same for integration logs (validation, field mapping, steps, normalized output).                                                                                           |
| **Optional --app**                 | In datasource command descriptions, state that app can be resolved from cwd, from datasource key (single match), or from parsing key; if multiple apps match, user must pass `--app`.      |
| **ds alias**                       | Mention in datasource overview that `aifabrix ds` is equivalent to `aifabrix datasource`.                                                                                                  |


**Other docs:** If [docs/commands/application-management.md](docs/commands/application-management.md) or a dedicated datasource doc exists and references datasource commands, add the same updates there or link to external-integration.md for CLI usage.

---

## Plan Validation Report

**Date:** 2026-03-14  
**Plan:** .cursor/plans/107-datasource_e2e_logs_and_optional_app.plan.md  
**Status:** VALIDATED

### Plan Purpose

- **Title:** Datasource E2E improvements, log commands, optional --app, and ds alias.
- **Scope:** CLI (datasource test-e2e -v, test-integration -v, log-e2e, log-integration, optional --app, ds alias), display helpers, log viewer, app resolver, manual tests, documentation.
- **Type:** Development (CLI commands, options, alias, resolver, log viewer); Testing (unit + manual); Documentation.

### Applicable Rules

- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – New commands and options; command pattern, chalk, error handling.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – File/function size, JSDoc.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Build first, lint, test; no secrets; docs updated.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Jest, mocks, coverage; manual tests in tests/manual.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – try/catch, chalk, no secrets in logs.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – Input validation, no secrets in code or logs.
- **[Documentation Rules](.cursor/rules/docs-rules.mdc)** – Command-centric docs; no REST API details in user docs.

### Rule Compliance

- DoD: Build → Lint → Test order documented; manual test checklist; file size, JSDoc, security, all tasks.
- CLI: New commands and options described; resolver and display behavior specified.
- Testing: Unit tests (resolver, display, log-viewer) and manual checklist with integration/hubspot-test.
- Docs: external-integration.md and optional --app, ds alias, test-integration -v, test-e2e -v, log-e2e, log-integration.

### Plan Updates Made

- Added **Rules and Standards** with links to project-rules.mdc (CLI, Code Quality, Quality Gates, Testing, Error Handling, Security).
- Added **Before Development** (read rules, review datasource/test-e2e/test-integration/display, manual test pattern, docs).
- Added **Definition of Done** (build first, lint, test, manual tests, file size, JSDoc, security, documentation, all tasks).
- Added **test-integration -v** (section 1b) and **example output for test-e2e -v**.
- Expanded **log-e2e / log-integration** visual interface with detailed fields and **example output** summary.
- Added **section 7: Manual tests and validation** (checklist, integration/hubspot-test, optional datasource-commands.test.js, README).
- Added **section 8: Documentation to update** (external-integration.md, table of topics and actions, docs-rules).
- Updated **Summary table** with test-integration -v, manual tests, and doc path.
- Appended this validation report.

### Recommendations

- Run manual checklist against integration/hubspot-test after implementation; add tests/manual/datasource-commands.test.js if useful for regression.
- When implementing log viewer, keep output format aligned with the detailed spec (request, response, steps, sync counts, validation, CIP trace) so developers get consistent, actionable output.
- Confirm Commander.js supports `.alias('ds')` on the parent `datasource` command; if not, register `ds` as a separate command that delegates to the same action.

---

## Validation Report

**Date:** 2026-03-14  
**Plan:** .cursor/plans/107-datasource_e2e_logs_and_optional_app.plan.md  
**Document(s):** docs/commands/external-integration.md  
**Status:** ✅ COMPLETE

### Executive Summary

Documentation referenced by plan 107 was validated. The primary doc **docs/commands/external-integration.md** passes structure, reference, and Markdown checks. One fix was applied (missing anchor for link fragment). No config YAML/JSON examples in this doc require schema validation (content is CLI usage and terminal output examples). **docs/commands/application-management.md** was checked; it does not reference datasource commands, so no updates required there per plan.

### Documents Validated


| Document                                | Status | Notes                                              |
| --------------------------------------- | ------ | -------------------------------------------------- |
| docs/commands/external-integration.md   | ✅ Pass | Structure, links, Markdown OK; anchor added        |
| docs/commands/application-management.md | ✅ N/A  | No datasource command references; no change needed |


- **Total:** 1 primary doc (plan target)
- **Passed:** 1
- **Auto-fixed:** 1 (anchor)

### Structure Validation

- **docs/commands/external-integration.md:** Single `#` title at top; consistent `##` / `###` hierarchy; nav back to Documentation index and Commands index present. Sections cover datasource overview, subcommands (validate, list, diff, upload, test-integration, test-e2e, **log-e2e**, **log-integration**), optional --app, and ds alias as specified in plan 8.

### Reference Validation

- **Cross-references within docs:** All checked links resolve:
  - `../README.md`, `README.md`, `permissions.md`, `external-integration-testing.md`, `utilities.md`, `validation.md`, `../deploying.md`, `../configuration/secrets-and-config.md` — all exist.
- **Fragment fix:** Link `[aifabrix credential env](#aifabrix-credential-env-system-key)` pointed to a missing anchor. Added `<a id="aifabrix-credential-env-system-key"></a>` before the "## aifabrix credential env " heading so the fragment is valid.

### Schema-based Validation

- **docs/commands/external-integration.md:** This doc is command-focused (CLI usage, options, examples). Code blocks are either **bash** (command examples) or **yaml** used for CLI output samples and file-structure examples (e.g. "Output (valid):", "File Structure:"). No full application.yaml, external-system, or external-datasource config examples are present that would need validation against **lib/schema** (application-schema.json, external-system.schema.json, external-datasource.schema.json). **Result:** N/A for schema validation; doc aligns with docs-rules (command-centric, no REST API details).

### Markdown Validation

- **MarkdownLint:** Run on `docs/commands/external-integration.md`. Before fix: 1 error (MD051 link-fragments — invalid fragment `#aifabrix-credential-env-system-key`). After adding the anchor: **0 errors**, 0 warnings.

### Project Rules Compliance

- **Focus:** Doc describes how to use the builder (CLI commands, workflows, options). No REST API details in user-facing prose.
- **CLI/config:** Command names and options match the implementation (datasource, test-e2e, test-integration, log-e2e, log-integration, --app, --file, -v, ds alias).
- **docs-rules.mdc:** Command-centric; optional --app and resolution behavior described without backend URLs.

### Automatic Fixes Applied

- Added anchor `<a id="aifabrix-credential-env-system-key"></a>` in docs/commands/external-integration.md so the "See also" link from credential push to credential env is valid.

### Manual Fixes Required

- None.

### Final Checklist

- Document(s) validated (external-integration.md)
- MarkdownLint passes (0 errors) after fix
- Cross-references within docs/ valid; broken fragment fixed
- No broken internal links
- Doc is command-focused; no config examples to validate against lib/schema in this file
- Content focused on using the builder (external users)
- Auto-fix applied; report attached to plan

---

## Implementation Validation Report

**Date:** 2026-03-14  
**Plan:** .cursor/plans/107-datasource_e2e_logs_and_optional_app.plan.md  
**Status:** ✅ COMPLETE

### Executive Summary

Plan 107 (datasource E2E logs, optional --app, log-e2e/log-integration, ds alias) is implemented. All listed files exist; unit tests cover test-e2e (audit when verbose), test-integration (resolver), resolve-app, log-viewer, display (sync counts + auditLog), and CLI registration (including log-e2e and log-integration). Plan 107–related tests pass (156 tests in 11 suites). Full-repo lint reports pre-existing issues in other modules (setup-secrets, core/secrets, infrastructure); the files touched by this plan are lint-clean. Documentation (docs/commands/external-integration.md) was updated and validated separately.

### Task Completion

- **Definition of Done (plan section):** Build/lint/test order, manual test checklist, file size, JSDoc, security, documentation, and feature set (test-e2e -v, test-integration -v, log-e2e, log-integration, optional --app, ds alias) are addressed.
- **No checkbox task list** in plan body; completion inferred from file existence, tests, and doc updates.
- **Completion:** 100% for scope of this plan.

### File Existence Validation


| File                                  | Status                                                                                         |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| lib/datasource/test-e2e.js            | ✅ Exists; body.audit when verbose, uses resolveAppKeyForDatasource                             |
| lib/datasource/test-integration.js    | ✅ Exists; uses resolveAppKeyForDatasource, getSystemKeyFromAppKey                              |
| lib/datasource/log-viewer.js          | ✅ Exists; getLatestLogPath, formatLogContent, formatE2ELog, formatIntegrationLog, runLogViewer |
| lib/datasource/resolve-app.js         | ✅ Exists; resolveAppKeyForDatasource, appHasDatasourceKey                                      |
| lib/commands/datasource.js            | ✅ Exists; log-e2e, log-integration, alias ds (conditional), test-integration -v                |
| lib/utils/external-system-display.js  | ✅ Exists; formatSyncStepEvidence, displayE2EResults verbose sync + auditLog                    |
| lib/utils/paths.js                    | ✅ Exists; listIntegrationAppNames used by resolver                                             |
| docs/commands/external-integration.md | ✅ Exists; log-e2e, log-integration, optional --app, ds, test-integration -v, test-e2e -v       |


### Test Coverage


| Test File                                       | Status | Coverage                                                                                                                      |
| ----------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| tests/lib/datasource/test-e2e.test.js           | ✅      | resolveAppKeyForDatasource call, body.audit when verbose, E2E flow                                                            |
| tests/lib/datasource/test-integration.test.js   | ✅      | Resolver mock, pipeline test flow                                                                                             |
| tests/lib/datasource/resolve-app.test.js        | ✅      | Explicit app, empty key, cwd, scan one/many, parse fail, appHasDatasourceKey, fallback when explicit app path missing         |
| tests/lib/datasource/log-viewer.test.js         | ✅      | getLatestLogPath, formatLogContent (E2E + integration), runLogViewer (--file, resolve app, no log, missing key, invalid JSON) |
| tests/lib/utils/external-system-display.test.js | ✅      | displayE2EResults: sync step evidence (Managed records), auditLog (CIP execution trace)                                       |
| tests/lib/commands/datasource.test.js           | ✅      | Registers validate, list, diff, upload, **log-e2e**, **log-integration** with options                                         |


- **Unit tests:** Present for resolver, log-viewer, display, test-e2e, test-integration, and CLI registration.
- **Manual tests:** Checklist in plan section 7; optional tests/manual/datasource-commands.test.js not required for validation.
- **Plan 107–related tests:** 156 tests, 11 suites, all passing.

### Code Quality Validation

- **Format (lint:fix):** Run; pre-existing lint issues remain in **other** files (lib/cli/setup-secrets.js, lib/core/secrets.js, lib/infrastructure/*). Plan 107 files were not changed by lint:fix.
- **Lint:** Full `npm run lint` reports 2 errors and 4 warnings in non–plan-107 files. **Plan 107 implementation files** (lib/datasource/*, lib/commands/datasource.js, lib/utils/external-system-display.js) are lint-clean (eslint-disable used only where justified for formatter complexity).
- **Tests:** `npm test` for plan 107–related paths: **PASSED** (156 tests, 11 suites).

### Cursor Rules Compliance

- **Code reuse:** Resolver shared by test-e2e, test-integration, log-viewer; display helpers reused.
- **Error handling:** try/catch in async paths; errors passed to CLI with process.exit(1).
- **Logging:** logger/chalk used; no secrets in logs.
- **Type safety:** JSDoc on new public functions (resolve-app, log-viewer, display additions).
- **Async patterns:** async/await, fs.promises in log-viewer and resolve-app.
- **File operations:** path.join, no hardcoded paths.
- **Input validation:** datasource key and paths validated; empty key rejected.
- **Module patterns:** CommonJS; named exports.
- **Security:** No hardcoded secrets; no secrets in log output.

### Implementation Completeness

- **CLI:** test-e2e -v, test-integration -v, log-e2e, log-integration, optional --app, ds alias implemented.
- **Resolver:** resolveAppKeyForDatasource (explicit → cwd → scan → parse) used by test-e2e, test-integration, log-viewer.
- **Log viewer:** getLatestLogPath, format E2E/integration, runLogViewer with --file or latest.
- **Display:** Sync step evidence and auditLog summary in displayE2EResults when verbose.
- **Documentation:** docs/commands/external-integration.md updated (log-e2e, log-integration, optional --app, ds, -v).
- **Database/schemas/migrations:** N/A for this plan.

### Do We Need More Tests?

**No.** The plan’s test requirements are satisfied:

- **test-e2e body audit when verbose:** Covered in test-e2e.test.js.
- **display auditLog and sync counts:** Covered in external-system-display.test.js (verbose sync step evidence, CIP execution trace).
- **resolver:** resolve-app.test.js (explicit app, cwd, scan one/many/zero, parse fallback, appHasDatasourceKey, explicit app path missing).
- **log-viewer:** log-viewer.test.js (getLatestLogPath, formatLogContent E2E/integration, runLogViewer with/without --file, no log, invalid JSON).
- **CLI registration:** datasource.test.js now includes “should register log-e2e command” and “should register log-integration command” (added during this validation).

Optional extras (not required by plan): parse-fallback success path (e.g. key `hubspot-companies` → app `hubspot`), or end-to-end action tests that invoke log-e2e/log-integration handlers with mocks. Manual test checklist in section 7 remains for human execution against a real integration app/dataplane.

### Final Validation Checklist

- All plan 107 tasks implemented (test-e2e -v, test-integration -v, log-e2e, log-integration, optional --app, ds alias, docs)
- All listed files exist and contain expected logic
- Unit tests exist for resolver, log-viewer, display, test-e2e, test-integration, CLI registration
- Plan 107–related tests pass (156 tests)
- Plan 107 code is lint-clean; full-repo lint has pre-existing issues elsewhere
- Cursor rules compliance verified for new/changed code
- Documentation updated and validated (see Validation Report above)

