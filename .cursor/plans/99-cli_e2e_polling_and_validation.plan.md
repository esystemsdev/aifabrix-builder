---
name: CLI E2E polling and validation
overview: "Align the Builder CLI with the dataplane E2E API (plan 329): add async start + polling, support new request options (testCrud, recordId, cleanup, primaryKeyValue), extend display and validation testing, update docs, and add tests."
todos: []
isProject: false
---

# CLI E2E polling, validation, and docs after dataplane plan 329

## Summary of dataplane changes (plan 329)

The dataplane now supports:

- **Async E2E:** `POST /api/v1/external/{sourceIdOrKey}/test-e2e?asyncRun=true` returns **202** with `{ testRunId, status: "running", startedAt }`. Client polls `GET /api/v1/external/{sourceIdOrKey}/test-e2e/{testRunId}` until `status` is `"completed"` or `"failed"`. Poll response: `status`, `completedActions` (steps so far), and when finished `steps`, `success`, `error`, `durationSeconds`, `debug`.
- **Request body:** In addition to existing fields, `ExternalDataSourceE2ETestRequest` includes: `testCrud`, `recordId`, `cleanup`, `primaryKeyValue` (see [openapi.yaml](file:///workspace/aifabrix-dataplane/openapi/openapi.yaml) around lines 15877–15902).
- **primaryKey:** Required in datasource config and used for CRUD lifecycle and table indexing (backend). The Builder schema already has `primaryKey` in [lib/schema/external-datasource.schema.json](lib/schema/external-datasource.schema.json).

The CLI currently calls only `POST .../test-e2e` (sync), sends only `includeDebug` when `--debug`, and does not support the new body options or polling.

---

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Mandatory for all plans. Build completes successfully (`npm run build`), lint passes (`npm run lint`), all tests pass, coverage ≥80% for new code, no hardcoded secrets.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – Files ≤500 lines, functions ≤50 lines; JSDoc for all public functions; single responsibility.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – Command pattern (Commander.js), input validation, error handling with chalk, user-friendly messages; add tests for the command.
- **[Architecture Patterns / API Client Structure](.cursor/rules/project-rules.mdc#api-client-structure-pattern)** – Use `lib/api/` for dataplane calls; add `@requiresPermission` for new API functions; JSDoc and typed interfaces.
- **[Code Style](.cursor/rules/project-rules.mdc#code-style)** – Async/await, try-catch for async ops, meaningful errors, input validation, path.join() for paths.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Jest, tests mirror source under `tests/lib/`, mock API client and deps, success and error paths, 80%+ coverage for new code.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – Structured errors, chalk for output, never log secrets or tokens.
- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** – Schema validation (external-datasource schema with primaryKey); reuse existing validate path.
- **[Security & Compliance](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – No secrets in code or logs; validate inputs; document permissions for API.
- **[Documentation Rules](.cursor/rules/docs-rules.mdc)** – CLI user docs: command-centric, no REST URLs/endpoints; describe what the command does, options, and auth in user terms.

**Key requirements:** BUILD → LINT → TEST order; JSDoc for new functions (including `getE2ETestRun`); try-catch for async; validate datasourceKey and options; tests for API, test-e2e flow, display, command, and validation (primaryKey).

---

## Before Development

- Read Quality Gates and CLI Command Development in project-rules.mdc.
- Review existing `lib/api/external-test.api.js` and `lib/datasource/test-e2e.js` for patterns.
- Review `lib/utils/external-system-display.js` `displayE2EResults` and command in `lib/commands/datasource.js`.
- Confirm dataplane E2E API: POST with `asyncRun=true` returns testRunId; GET test-e2e/{testRunId} returns status and completedActions/steps.
- Read docs-rules.mdc for documentation edits (no REST details in user docs).

---

## Definition of Done

Before marking this plan complete, ensure:

1. **Build:** Run `npm run build` FIRST (must complete successfully; runs lint + test:ci).
2. **Lint:** Run `npm run lint` (must pass with zero errors and zero warnings).
3. **Test:** Run `npm test` or `npm run test:ci` AFTER lint (all tests must pass; ≥80% coverage for new code).
4. **Validation order:** BUILD → LINT → TEST (mandatory sequence; never skip steps).
5. **File size:** New/edited files ≤500 lines; functions ≤50 lines.
6. **JSDoc:** All new public functions have JSDoc (params, returns, throws); `getE2ETestRun` and any new helpers documented; `@requiresPermission` on new Dataplane API functions.
7. **Code quality:** All rule requirements met; no hardcoded secrets; input validation and error handling in place.
8. **Security:** No secrets or tokens in logs; auth and permissions documented per permissions-guide.
9. **Docs:** external-integration.md and external-integration-testing.md updated per docs-rules (command-centric, no REST URLs in user-facing text).
10. All implementation tasks (§1–§7) and tests completed; validation test for primaryKey (missing vs present) in place.

---

## 1. API client ([lib/api/external-test.api.js](lib/api/external-test.api.js))

- **testDatasourceE2E:** Support async start:
  - Add optional parameter or options: `asyncRun` (boolean). When `true`, call POST with query param `asyncRun=true`.
  - Return value: either sync body (steps, success, …) or async start body (`testRunId`, `status`, `startedAt`). Document that caller must check for `testRunId` to detect async response (e.g. 202 with body).
- **getE2ETestRun (new):**  
`getE2ETestRun(dataplaneUrl, sourceIdOrKey, testRunId, authConfig)`  
Calls `GET /api/v1/external/{sourceIdOrKey}/test-e2e/{testRunId}`. Returns poll response: `{ status, completedActions, steps?, success?, error?, ... }`. Same auth as E2E (Bearer or API key). JSDoc and `@requiresPermission` as for existing E2E.

Handle 404 on poll (unknown/expired run) with a clear error.

---

## 2. Datasource test-e2e flow ([lib/datasource/test-e2e.js](lib/datasource/test-e2e.js))

- **Default: async with polling.**  
Call POST with `asyncRun: true`. If response has `testRunId`, poll `getE2ETestRun` in a loop (with configurable interval and timeout, e.g. 2–3 s interval, 10–15 min max). Until `status === 'completed' || status === 'failed'`.
- **Request body** from options (and existing `includeDebug` when `--debug`):
  - `testCrud` (boolean) → from `options.testCrud`
  - `recordId` (string) → from `options.recordId`
  - `cleanup` (boolean) → from `options.cleanup` (default true)
  - `primaryKeyValue` (string or object) → from `options.primaryKeyValue` (see below)
- **primaryKeyValue:** Accept string (single PK) or path to JSON file (e.g. `@file.json` or a path) for composite key; pass through to body as string or parsed object.
- **Optional sync mode:** Support `--no-async` or `async: false` to use current behavior (single POST without asyncRun) for backward compatibility or short runs. When sync, response shape is the same as today (steps in body).
- **Logging:** When polling and `verbose`, log each poll (e.g. “Polling… status: running, N steps completed”) and show `completedActions` in display helper so user sees progress.
- **Debug log:** For async run, write final poll response (and optionally last few poll responses) to the same debug log file when `--debug`.

---

## 3. CLI command options ([lib/commands/datasource.js](lib/commands/datasource.js))

Add options to `datasource test-e2e <datasourceKey>`:

- `--test-crud` – set body `testCrud: true`
- `--record-id <id>` – set body `recordId`
- `--no-cleanup` – set body `cleanup: false`
- `--primary-key-value <value|@path>` – set body `primaryKeyValue` (string, or read JSON from file if value starts with `@`)
- `--no-async` – use sync mode (POST without asyncRun; no polling)

Pass these through to `runDatasourceTestE2E(..., options)`.

Failure detection: for async flow, use final poll result: `steps` or `completedActions` to determine if any step failed; set exit code 1 when `success === false` or any step has `success === false` or `error`.

---

## 4. Display ([lib/utils/external-system-display.js](lib/utils/external-system-display.js))

**displayE2EResults(data, verbose):**

- Support **poll response shape:**  
If `data.steps` is absent but `data.completedActions` is present, use `completedActions` as the list of steps to display (running state). If both are present (final state), prefer `steps` for the summary.
- Show **status** when present: e.g. “Status: running” or “Status: completed/failed” so async runs are clear.
- When `status === 'running'` and verbose, show “(N steps completed so far)” or similar.
- Keep existing behavior for sync response (data.steps only) and for final poll (data.steps + data.success, data.error).

---

## 5. Validation and schema

- **Schema:** [lib/schema/external-datasource.schema.json](lib/schema/external-datasource.schema.json) already requires `primaryKey`. No change needed.
- **Validation flow:** Existing `validate` path (e.g. [lib/validation/validate.js](lib/validation/validate.js), [lib/validation/external-manifest-validator.js](lib/validation/external-manifest-validator.js)) validates external datasource configs with this schema, so missing or invalid `primaryKey` already fails validation.
- **Validation tests:** Add or extend tests so that:
  - A datasource config **without** `primaryKey` fails validation (schema or manifest validation).
  - A datasource config **with** valid `primaryKey` (e.g. `["id"]` or `["externalId"]`) passes.  
  Prefer reusing existing validate test structure in [tests/lib/validation/validate.test.js](tests/lib/validation/validate.test.js) or [tests/lib/validation](tests/lib/validation) (e.g. external-manifest or schema type detection for `external-datasource`).

---

## 6. Documentation

- **[docs/commands/external-integration.md](docs/commands/external-integration.md)** (section “aifabrix datasource test-e2e”):
  - Describe **async flow:** command starts the run, then polls until completed or failed; user sees progress when using `-v`.
  - Document new options: `--test-crud`, `--record-id`, `--no-cleanup`, `--primary-key-value`, `--no-async`.
  - Keep prerequisite (Bearer or API key) and link to [External Integration Testing](external-integration-testing.md).
- **[docs/commands/external-integration-testing.md](docs/commands/external-integration-testing.md)** (Datasource E2E tests):
  - Add subsection on **async and polling:** start with POST (async), then poll GET until done; recommend default async for long runs.
  - Document **primaryKeyValue:** when set, API fetches that record and uses it (minus primary key) as payload template for create; no need to send payloadTemplate for that run.
  - Document **testCrud**, **recordId**, **cleanup** in “Options” or “Request options” (user-facing, no HTTP/URL details per docs-rules).
  - Add **primaryKey** to “Test payload configuration” or a short “Datasource config” note: datasource config must include `primaryKey` (required by schema); used for CRUD and table indexing.

Do **not** add REST URLs or request/response field names beyond what’s needed for CLI options and user-facing behavior (per [.cursor/rules/docs-rules.mdc](.cursor/rules/docs-rules.mdc)).

---

## 7. Tests

- **lib/api/external-test.api.js**
  - **getE2ETestRun:** call GET with sourceIdOrKey and testRunId; auth required (reject when no token/apiKey).
  - **testDatasourceE2E** with `asyncRun: true`: POST called with `?asyncRun=true` (or equivalent via options); response with testRunId returned as-is.
- **lib/datasource/test-e2e.js**
  - Async flow: when response has `testRunId`, poll until status completed/failed; verify getE2ETestRun called with correct args; verify returned data is final poll result.
  - Sync flow: when `--no-async` or asyncRun false, single POST, no poll; response with steps used as result.
  - Body: options.testCrud, recordId, cleanup, primaryKeyValue passed into request body (and includeDebug when debug).
  - primaryKeyValue from file: when value starts with `@`, read file and parse JSON into body.primaryKeyValue.
- **lib/utils/external-system-display.js**
  - displayE2EResults with poll shape: data with `completedActions` but no `steps` (running); data with `steps` and `status: 'completed'` or `'failed'`.
  - displayE2EResults with sync shape (data.steps only) unchanged.
- **lib/commands/datasource.js**
  - test-e2e command: options passed to runDatasourceTestE2E; exit code 1 when final result has failure (success false or step.error).
- **Validation**
  - At least one test that validates an external-datasource config without `primaryKey` fails (and with valid primaryKey passes). Prefer existing validate or external-manifest test file.

---

## 8. Implementation order

1. API: add `getE2ETestRun`; extend `testDatasourceE2E` for asyncRun (query param + return start response).
2. Display: extend `displayE2EResults` for poll response (status, completedActions, steps).
3. test-e2e.js: implement async loop (start + poll), build body from new options, optional sync with `--no-async`.
4. CLI: add options to datasource test-e2e and pass to runDatasourceTestE2E.
5. Tests: API, test-e2e module, display, command, validation (primaryKey).
6. Docs: external-integration.md and external-integration-testing.md.

---

## 9. Out of scope

- Changing dataplane API or OpenAPI.
- Adding new validation rules beyond existing schema (primaryKey already required).
- Knowledge base articles in the dataplane repo (those are listed in plan 329’s Knowledgebase Validation Report; not part of this CLI plan).

