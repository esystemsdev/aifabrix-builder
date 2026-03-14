---
name: Pipeline Deployment API Migration
overview: Migrate the Builder's pipeline API usage from the legacy multi-step flow to the new unified Dataplane pipeline API (single upload, renamed datasource endpoint, removed/deprecated endpoints).
todos: []
isProject: false
---

# Pipeline Deployment API Migration Plan

## Rules and Standards

This plan must comply with rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns - API Client Structure](.cursor/rules/project-rules.mdc#api-client-structure-pattern)** - Use `lib/api/pipeline.api.js` for pipeline calls; define types in `lib/api/types/`
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** - Error handling, chalk output, input validation
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - File size limits, JSDoc for all public functions
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** - Build, lint, test; 80%+ coverage for new code
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest, mock API client, test success and error paths
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** - Try-catch, meaningful errors, no secrets in logs
- **[API Permissions](.cursor/rules/project-rules.mdc#api-permissions)** - Add `@requiresPermission` JSDoc per permissions-guide.md

**Key Requirements**: JSDoc for all functions; `@typedef` for request/response types; mock `ApiClient` in tests; `npm run build` before commit.

## Before Development

- Read [Dataplane pipeline API reference](/workspace/aifabrix-dataplane/.cursor/plans/pipeline.md)
- Review current [lib/api/pipeline.api.js](lib/api/pipeline.api.js) and [lib/commands/upload.js](lib/commands/upload.js)
- Confirm Dataplane has deployed the new pipeline API (single upload, validate, datasource upload)
- Review [permissions-guide.md](permissions-guide.md) for `@requiresPermission` updates

## Definition of Done

1. **Build**: Run `npm run build` FIRST (must succeed; runs lint + test:ci)
2. **Lint**: Run `npm run lint` (zero errors/warnings)
3. **Test**: Run `npm test` or `npm run test:ci` (all pass, ≥80% coverage for new code)
4. **Order**: BUILD → LINT → TEST (mandatory sequence)
5. **File limits**: Files ≤500 lines, functions ≤50 lines
6. **JSDoc**: All public functions and new types documented
7. **Permissions**: `@requiresPermission` on new/changed pipeline API functions
8. **No secrets**: No hardcoded tokens or credentials
9. All plan tasks completed

## Context

The [Dataplane pipeline API reference](/workspace/aifabrix-dataplane/.cursor/plans/pipeline.md) defines a simplified API. The Builder currently uses the legacy 3-step flow and several endpoints that are being removed or renamed.

## Gap Analysis: Current vs Target


| Current Builder                                                                                     | New Dataplane API                                     | Action                                                      |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| `uploadApplicationViaPipeline` + `validateUploadViaPipeline` + `publishUploadViaPipeline` (3 calls) | Single `POST /pipeline/upload` with `status: "draft"` | Replace 3-step flow with 1 call                             |
| `POST /pipeline/upload/{id}/validate`                                                               | Removed                                               | Remove `validateUploadViaPipeline`                          |
| `POST /pipeline/upload/{id}/publish`                                                                | Removed                                               | Remove `publishUploadViaPipeline`                           |
| `POST /pipeline/{systemKey}/publish`                                                                | Renamed to `POST /pipeline/{systemKey}/upload`        | Update `publishDatasourceViaPipeline` endpoint              |
| `POST /pipeline/publish`                                                                            | Use upload with `status: "published"`                 | Remove `publishSystemViaPipeline`                           |
| `POST /pipeline/deploy`                                                                             | Removed                                               | Remove `deployExternalSystemViaPipeline`                    |
| `POST /pipeline/{systemKey}/deploy`                                                                 | Removed                                               | Remove `deployDatasourceViaPipeline`                        |
| (none)                                                                                              | `POST /pipeline/validate`                             | Add `validatePipelineConfig` for optional validate-only use |


## Changes by File

### 1. [lib/api/pipeline.api.js](lib/api/pipeline.api.js)

**Upload flow (Builder use case):**

- `**uploadApplicationViaPipeline`**: Extend to accept optional `status` (default `"draft"`). Include `status` in request body. Response is now the publication result directly (no `uploadId`). Update JSDoc: "Single call: upload → validate → publish → controller register."
- `**validateUploadViaPipeline`**: **Remove** (endpoint removed).
- `**publishUploadViaPipeline`**: **Remove** (merged into upload).

**Datasource deploy:**

- `**publishDatasourceViaPipeline`**: Change endpoint from `/api/v1/pipeline/${systemKey}/publish` to `/api/v1/pipeline/${systemKey}/upload`. Body unchanged (full datasource config). Consider adding `uploadDatasourceViaPipeline` alias or renaming for clarity (optional).

**New:**

- `**validatePipelineConfig`**: Add function for `POST /api/v1/pipeline/validate`. Request body: `{ config: { version, application, dataSources } }`. Response: `{ isValid, errors, warnings }`. Use for optional dry-run validation against Dataplane.

**Remove or deprecate (per pipeline.md checklist):**

- `**deployExternalSystemViaPipeline`**: Remove (or `@deprecated` + remove export). Endpoint `POST /pipeline/deploy` removed. Not used by any Builder command.
- `**deployDatasourceViaPipeline`**: Remove (or deprecate). Endpoint removed. Not used by Builder commands.
- `**publishSystemViaPipeline`**: Remove (or deprecate). Endpoint `POST /pipeline/publish` removed. Callers would use `uploadApplicationViaPipeline` with `status: "published"`. Not used by Builder commands.

**Keep unchanged (same endpoints):**

- `validatePipeline`, `deployPipeline`, `getPipelineDeployment`, `getPipelineHealth` — Controller endpoints, not Dataplane pipeline.
- `testSystemViaPipeline`, `testDatasourceViaPipeline` — Same endpoints; no changes.

### 2. [lib/commands/upload.js](lib/commands/upload.js)

- Replace `runUploadValidatePublish` with a single call to `uploadApplicationViaPipeline`:
  - Pass payload with `status: "draft"`.
  - Handle response as publication result (no uploadId / validate / publish steps).
- Update error handling: single API response; errors come from upload response.
- Update imports: remove `validateUploadViaPipeline`, `publishUploadViaPipeline`.
- Extend `buildUploadPayload` to include `status: "draft"` (Builder always uses draft).

### 3. [lib/datasource/deploy.js](lib/datasource/deploy.js)

- No functional change: continue using `publishDatasourceViaPipeline`.
- The API module change (endpoint `/publish` → `/upload`) is transparent to this file. Optional: rename function usage to `uploadDatasourceViaPipeline` if the API is renamed.

### 4. [tests/lib/commands/upload.test.js](tests/lib/commands/upload.test.js)

- Remove mocks for `validateUploadViaPipeline`, `publishUploadViaPipeline`.
- Update `runUploadValidatePublish` tests: expect single `uploadApplicationViaPipeline` call with payload including `status: "draft"`.
- Update success/failure assertions for the unified response shape.

### 5. [tests/lib/api/pipeline.api.test.js](tests/lib/api/pipeline.api.test.js)

- Remove tests for `validateUploadViaPipeline`, `publishUploadViaPipeline`.
- Add tests for `validatePipelineConfig` (POST /pipeline/validate).
- Update `uploadApplicationViaPipeline` tests: body must include `status`, response shape no longer returns uploadId.
- Update `publishDatasourceViaPipeline` tests: assert endpoint `/upload` instead of `/publish`.
- Remove or adjust tests for deprecated functions (`deployExternalSystemViaPipeline`, `deployDatasourceViaPipeline`, `publishSystemViaPipeline`).

### 7. [.cursor/plans/dataplane.md](.cursor/plans/dataplane.md)

- Update Pipeline section: replace 3-step flow with single `POST /pipeline/upload` with `status: "draft"`.
- Update endpoint table: remove `upload/{id}/validate`, `upload/{id}/publish`, `publish`, `{systemKey}/publish`, `deploy`, `{systemKey}/deploy`; add `validate`, `{systemKey}/upload`.

### 7. [docs/commands/permissions.md](docs/commands/permissions.md)

- Update `aifabrix upload`: describe single `POST /api/v1/pipeline/upload` with `status: "draft"` instead of upload → validate → publish.
- Update Dataplane `external-system:publish` and Pipeline auth: mention new endpoints (upload, validate, `{systemKey}/upload`); note that `POST /pipeline/upload` now accepts Bearer, API_KEY, or client credentials per pipeline.md.

### 9. Optional: Client credentials for upload

Pipeline.md states upload accepts Bearer, API_KEY, **or** client credentials. Builder currently enforces Bearer via `requireBearerForDataplanePipeline`. Decide whether to relax this for `aifabrix upload` to allow client credentials; if yes, update [lib/utils/token-manager.js](lib/utils/token-manager.js) and [lib/commands/upload.js](lib/commands/upload.js) to skip `requireBearerForDataplanePipeline` when client credentials are used for upload only.

## Request/Response Summary

**New upload request:**

```json
{
  "version": "1.0.0",
  "application": { "key": "...", "displayName": "...", ... },
  "dataSources": [ ... ],
  "status": "draft"
}
```

**New validate request (optional):**

```json
{
  "config": {
    "version": "1.0.0",
    "application": { ... },
    "dataSources": [ ... ]
  }
}
```

**New upload response:** Publication result (system, datasources, warnings) — no `uploadId` for chained validate/publish.

## Execution Order

1. Update `lib/api/pipeline.api.js` (upload, validate, datasource endpoint; remove/deprecate legacy).
2. Add Dataplane types to `lib/api/types/pipeline.types.js`.
3. Update `lib/commands/upload.js` (single upload call).
4. Update tests.
5. Update dataplane.md and permissions.md.
6. (Optional) Add client-credentials support for upload.

---

## Plan Validation Report

**Date**: 2025-03-02  
**Plan**: .cursor/plans/91-pipeline_deployment_api_migration.plan.md  
**Status**: VALIDATED

### Plan Purpose

Migrate Builder pipeline API usage from the legacy 3-step flow to the new Dataplane pipeline API. Type: **Refactoring** (API integration changes). Affects: `lib/api/pipeline.api.js`, `lib/commands/upload.js`, tests, docs.

### Applicable Rules

- [Architecture Patterns - API Client Structure](.cursor/rules/project-rules.mdc) - Pipeline API changes
- [CLI Command Development](.cursor/rules/project-rules.mdc) - Upload command updates
- [Code Quality Standards](.cursor/rules/project-rules.mdc) - JSDoc, file size
- [Quality Gates](.cursor/rules/project-rules.mdc) - Build, lint, test
- [Testing Conventions](.cursor/rules/project-rules.mdc) - Jest, mocks
- [API Permissions](.cursor/rules/project-rules.mdc) - @requiresPermission JSDoc

### Rule Compliance

- DoD Requirements: Documented (build, lint, test, order)
- Type definitions: Added task for `lib/api/types/pipeline.types.js`
- JSDoc: Plan requires documentation for all functions
- Tests: Plan updates upload.test.js and pipeline.api.test.js

### API Schemas — Do You Need More Info?

**No.** The plan has sufficient API info for implementation:


| Source                                                                                                                                                       | Role                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| [aifabrix-dataplane/.cursor/plans/pipeline.md](/workspace/aifabrix-dataplane/.cursor/plans/pipeline.md)                                                      | Authoritative reference. Request/response shapes, endpoints, auth.                                                     |
| Builder [external-system.schema.json](lib/schema/external-system.schema.json), [external-datasource.schema.json](lib/schema/external-datasource.schema.json) | Defines `application` and `dataSources` structure used in payloads.                                                    |
| Dataplane `openapi/openapi.yaml`                                                                                                                             | Optional. Full OpenAPI spec if you need exact schema validation; may still reflect old API until Dataplane is updated. |


The plan’s Request/Response Summary matches pipeline.md. For implementation, use pipeline.md plus Builder schemas. Add `lib/api/types/pipeline.types.js` types from pipeline.md; refer to Dataplane OpenAPI only if you need finer schema details.

### Plan Updates Made

- Added Rules and Standards section
- Added Before Development checklist
- Added Definition of Done section
- Added task: update `lib/api/types/pipeline.types.js` with Dataplane pipeline types
- Appended validation report

### Recommendations

- Ensure Dataplane has deployed the new API before changing the Builder.
- When removing deprecated functions, keep exports as `@deprecated` wrappers for one release if external callers exist.

---

## Implementation Validation Report

**Date**: 2025-03-02  
**Plan**: .cursor/plans/91-pipeline_deployment_api_migration.plan.md  
**Status**: ✅ COMPLETE

### Executive Summary

The Pipeline Deployment API Migration has been implemented as specified. All execution-order tasks are done: pipeline API updated (single upload, validatePipelineConfig, publishDatasourceViaPipeline endpoint change, legacy functions removed), types added, upload command simplified, tests and docs updated. Code quality: format and lint pass with zero errors/warnings; all tests pass. One lint fix was applied during validation (max-statements in `upload.js` by extracting `logUploadSuccess`).

### Task Completion

The plan uses "Changes by File" and "Execution Order" (no checkbox list). All items are implemented:

| Item | Status |
|------|--------|
| 1. Update lib/api/pipeline.api.js | ✅ Done – single upload with status, validatePipelineConfig, publishDatasourceViaPipeline → /upload; removed validateUploadViaPipeline, publishUploadViaPipeline, deployExternalSystemViaPipeline, deployDatasourceViaPipeline, publishSystemViaPipeline |
| 2. Add types to lib/api/types/pipeline.types.js | ✅ Done – PipelineUploadRequest, PipelineUploadResponse, PipelineValidateConfigRequest, PipelineValidateConfigResponse |
| 3. Update lib/commands/upload.js | ✅ Done – single uploadApplicationViaPipeline call, buildUploadPayload with status "draft", runUploadValidatePublish returns publication result |
| 4. Update tests | ✅ Done – upload.test.js and pipeline.api.test.js updated; no mocks for removed functions; validatePipelineConfig and runUploadValidatePublish tests added |
| 5. Update dataplane.md and permissions.md | ✅ Done – Pipeline section and endpoint table updated; permissions describe single upload and new endpoints |
| 6. Optional client credentials | ⏭️ Not done (optional) |

### File Existence Validation

| File | Status |
|------|--------|
| lib/api/pipeline.api.js | ✅ Exists – upload with status, validatePipelineConfig, publishDatasourceViaPipeline (/upload), legacy removed |
| lib/api/types/pipeline.types.js | ✅ Exists – Dataplane upload/validate typedefs |
| lib/commands/upload.js | ✅ Exists – single upload call, status "draft", logDataplanePipelineWarning, logUploadSuccess |
| lib/datasource/deploy.js | ✅ Exists – unchanged, uses publishDatasourceViaPipeline |
| tests/lib/commands/upload.test.js | ✅ Exists – single upload, status "draft", runUploadValidatePublish, logDataplanePipelineWarning |
| tests/lib/api/pipeline.api.test.js | ✅ Exists – upload with status, validatePipelineConfig, publishDatasourceViaPipeline /upload; no tests for removed functions |
| .cursor/plans/dataplane.md | ✅ Exists – single upload flow, endpoint table updated |
| docs/commands/permissions.md | ✅ Exists – single POST /pipeline/upload, datasource upload, Pipeline auth |

### Test Coverage

- **Unit tests:** upload.test.js and pipeline.api.test.js cover upload command (single call, payload with status, success/failure, dry-run, runUploadValidatePublish) and pipeline API (uploadApplicationViaPipeline, validatePipelineConfig, publishDatasourceViaPipeline endpoint).
- **Removed code:** No tests for validateUploadViaPipeline, publishUploadViaPipeline, deployExternalSystemViaPipeline, deployDatasourceViaPipeline, publishSystemViaPipeline (removed).
- **Result:** All 233 test suites pass (5046 tests).

### Code Quality Validation

| Step | Result |
|------|--------|
| 1. Format (lint:fix) | ✅ PASSED |
| 2. Lint | ✅ PASSED (0 errors, 0 warnings after extracting logUploadSuccess) |
| 3. Tests | ✅ PASSED (all tests pass) |

### Cursor Rules Compliance

| Rule | Status |
|------|--------|
| API Client Structure | ✅ pipeline.api.js and pipeline.types.js used |
| CLI / error handling | ✅ chalk, try/catch, meaningful errors in upload and deploy |
| Code quality / file size | ✅ logUploadSuccess extracted to satisfy max-statements |
| JSDoc | ✅ Public functions and new types documented |
| Testing | ✅ Jest, mock ApiClient, success and error paths |
| Error handling & logging | ✅ No secrets in logs |
| @requiresPermission | ✅ Present on pipeline API functions |
| Async/file/validation | ✅ async/await, path.join, input validation |

### Implementation Completeness

- **Pipeline API:** Single upload, validate config, datasource upload endpoint, legacy removed.
- **Upload command:** Single call, status "draft", unified error handling.
- **Types:** Dataplane upload/validate request and response types.
- **Docs:** dataplane.md and permissions.md updated.
- **Optional:** Client credentials for upload not implemented.

### Issues and Recommendations

- None. Lint warning (max-statements in `uploadExternalSystem`) was resolved during validation by introducing `logUploadSuccess`.

### Final Validation Checklist

- [x] All plan tasks completed (except optional client credentials)
- [x] All mentioned files exist and contain expected changes
- [x] Tests exist and pass
- [x] Code quality (format → lint → test) passes
- [x] Cursor rules compliance verified
- [x] Implementation complete

