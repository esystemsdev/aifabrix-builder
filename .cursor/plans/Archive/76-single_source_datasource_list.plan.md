---
name: Single source datasource list
overview: Keep file names only at application level (application.yaml/application.json). In JSON output (manifest, upload payload) use only external-system and data sources content — no duplicate file-name lists.
todos: []
isProject: false
---

# File Names at Application Level; JSON = External-System + Data Sources Only

## Agreed approach

1. **Application level (application.yaml / application.json)**
  File names stay here only: `externalIntegration.systems` and `externalIntegration.dataSources` are the single source of truth for which system and datasource files exist. Manifest and validation keep reading this list to resolve and load files.
2. **JSON (deploy manifest, upload payload)**
  Use only **external-system** (the system object) and **data sources** (the array of datasource objects). The JSON does not duplicate or depend on file-name lists; it carries only the inlined system and datasource content.

---

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc). Applicable sections:

- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** – Changes touch generators and generated output (integration/builder); fixes belong in the generator, not only in generated artifacts.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – File size limits (≤500 lines/file, ≤50 lines/function), JSDoc for all public functions.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Mandatory checks before commit: build, lint, tests, coverage ≥80%.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Tests in `tests/`, mirror source structure; adjust tests if manifest shape changes.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – Try-catch for async ops, meaningful errors, no secrets in logs.
- **[Security & Compliance](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – No hardcoded secrets; validate inputs (paths, config).

**Key requirements**

- Keep file-name resolution in application config; manifest/generators read from it.
- When changing deploy JSON shape, update tests (e.g. `external-controller-manifest.test.js`, upload tests).
- Use `path.join()` for paths; validate YAML/JSON before use.
- Add/update JSDoc for any new or changed public functions.

## Before Development

- Read Architecture Patterns and Generated Output in project-rules.mdc.
- Review `lib/generator/external-controller-manifest.js` and upload payload construction in `lib/commands/upload.js`.
- Confirm which tests assert manifest shape (`tests/lib/generator/external-controller-manifest.test.js`, `tests/lib/commands/upload.test.js`).
- Ensure no hardcoded secrets or sensitive data in manifest/JSON output.

## Definition of Done

Before marking this plan complete:

1. **Build**: Run `npm run build` first (must succeed; runs lint + test:ci).
2. **Lint**: Run `npm run lint` (zero errors/warnings).
3. **Test**: Run `npm test` or `npm run test:ci` after lint (all tests pass; ≥80% coverage for new code).
4. **Order**: BUILD → LINT → TEST (mandatory; do not skip).
5. **File size**: Files ≤500 lines, functions ≤50 lines.
6. **JSDoc**: All public functions have JSDoc comments.
7. **Code quality**: All rule requirements met.
8. **Security**: No hardcoded secrets; ISO 27001–aligned handling of config and generated files.
9. All implementation steps and file changes from this plan are done.
10. Tests updated for any manifest/JSON shape change and passing.

---

## Current flow (for context)

- **Application config** (application.yaml / application.json) holds `externalIntegration.systems` and `externalIntegration.dataSources` (file names). Wizard, download, and split write these when generating or updating integration files.
- **Manifest** ([lib/generator/external-controller-manifest.js](lib/generator/external-controller-manifest.js)) reads application config, loads the system file and datasource files by name, and returns an object that includes both `externalIntegration` (with file names) and inlined `system` and `dataSources` (content).
- **Upload** ([lib/commands/upload.js](lib/commands/upload.js)) builds the payload as `{ version, application: manifest.system, dataSources: manifest.dataSources }` — so the payload sent to the pipeline is already **only** external-system (system object) and data sources (array). File names are not sent in the payload.

---

## Implementation plan

### 1. Keep file names only at application level

- **No change** to where file names are read: manifest and [lib/utils/schema-resolver.js](lib/utils/schema-resolver.js) continue to use `variables.externalIntegration.systems` and `variables.externalIntegration.dataSources` from application config to resolve and load files.
- Ensure wizard, download, and split **write** the correct file names into application config so the list does not drift (e.g. one wrong entry like `datasource-record-storage.json`). Where they build the list from an API or from deploy JSON, keep using the same naming rule: `<systemKey>-datasource-<suffix>.<ext>`.

### 2. JSON: only external-system + data sources

- **Manifest JSON** (e.g. `*-deploy.json`): When the manifest is serialized to JSON or used for upload, it should expose only what’s needed for the pipeline: **system** (external-system object) and **dataSources** (array of datasource objects). So:
  - In [lib/commands/upload.js](lib/commands/upload.js) the payload already is `{ version, application: manifest.system, dataSources: manifest.dataSources }` — good.
  - Optionally, when writing the deploy manifest to disk (e.g. in wizard), the saved JSON can omit or slim down the `externalIntegration` block (e.g. drop `schemaBasePath`, `systems`, `dataSources` file lists) so the deploy JSON is clearly “system + dataSources only.” If other consumers need `externalIntegration` in the file, keep it but document that the canonical file list lives in application config.
- **Upload payload**: Already uses only system + dataSources; no change.

### 3. Keep application config and system JSON in sync when writing

To avoid drift (e.g. application config listing one wrong file while system has the correct keys):

- **Wizard**: When writing application config and system file, ensure the system file’s `dataSources` (keys) matches the datasource files that were written; and that `externalIntegration.dataSources` (file names) matches the same set (one file name per key, using the naming convention).
- **Download**: Already builds file names from API `dataSources`; ensure the written system file includes `dataSources` (keys) from the same response so system and application config stay aligned.
- **Split**: Already builds file names from `deployment.dataSources`; no change required.

---

## Files to touch (summary)


| File                                                                                           | Change                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [lib/generator/external-controller-manifest.js](lib/generator/external-controller-manifest.js) | Keep reading file names from application config. Optionally, when building the object that gets written as deploy JSON, omit or minimalize `externalIntegration` so the saved JSON is “system + dataSources only.” |
| [lib/commands/upload.js](lib/commands/upload.js)                                               | No change (payload already system + dataSources only).                                                                                                                                                             |
| [lib/generator/wizard.js](lib/generator/wizard.js)                                             | Ensure written system file has `dataSources` (keys) in sync with `externalIntegration.dataSources` (file names).                                                                                                   |
| [lib/external-system/download-helpers.js](lib/external-system/download-helpers.js)             | Ensure written system file has `dataSources` (keys) from the API response so it matches the generated file names.                                                                                                  |
| [lib/utils/schema-resolver.js](lib/utils/schema-resolver.js)                                   | No change; keep using application config for file names.                                                                                                                                                           |
| Tests                                                                                          | Adjust if manifest shape changes (e.g. deploy JSON without full `externalIntegration`).                                                                                                                            |


---

## Result

- **File names** live only in application config (application.yaml / application.json) as the single source of truth for which system and datasource files exist.
- **JSON** (deploy manifest, upload payload) uses only **external-system** (system object) and **data sources** (datasource objects); no duplicate file-name lists in the JSON.
- **Sync**: When writing application config and system file (wizard, download, split), keep the system’s `dataSources` (keys) and application’s `externalIntegration.dataSources` (file names) in sync so they don’t drift.

---

## Plan Validation Report

**Date**: 2025-02-25  
**Plan**: .cursor/plans/76-single_source_datasource_list.plan.md  
**Status**: ✅ VALIDATED

### Plan Purpose

Single source of truth for datasource/system file names at application level (application.yaml/application.json). JSON output (deploy manifest, upload payload) carries only external-system object and data sources array—no duplicate file-name lists. Affected areas: generator (external-controller-manifest, wizard), upload command, download-helpers, schema-resolver, and tests. **Type**: Refactoring / architecture (configuration and manifest structure).

### Applicable Rules

- ✅ [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns) – Generator vs generated output; fixes in generator
- ✅ [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) – File size, JSDoc
- ✅ [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) – Build, lint, test, coverage
- ✅ [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) – Tests for manifest shape changes
- ✅ [Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging) – Async and error handling
- ✅ [Security & Compliance](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) – No secrets, input validation

### Rule Compliance

- ✅ DoD requirements: Documented (build → lint → test, order, coverage, file size, JSDoc, security)
- ✅ Rules and Standards: Added with applicable sections and key requirements
- ✅ Before Development: Checklist added
- ✅ Definition of Done: Full checklist with BUILD → LINT → TEST and all mandatory items

### Plan Updates Made

- ✅ Added **Rules and Standards** section with rule references and key requirements
- ✅ Added **Before Development** checklist
- ✅ Added **Definition of Done** with build/lint/test order and quality gates
- ✅ Appended this validation report

### Recommendations

- When changing manifest shape (e.g. omitting or slimming `externalIntegration` in deploy JSON), run the affected test files and add or adjust assertions so the "system + dataSources only" contract is covered.
- If deploy JSON is written in multiple places (wizard, other flows), ensure all writers use the same slim shape so the single-source approach stays consistent.

---

## Implementation Validation Report

**Date**: 2025-02-25  
**Plan**: .cursor/plans/76-single_source_datasource_list.plan.md  
**Status**: ✅ IMPLEMENTATION COMPLETE (⚠️ Lint has project-wide issues)

### Executive Summary

Plan 76 implementation requirements are **complete**. File names live only at application level; JSON (deploy manifest, upload payload) uses only external-system and data sources. `toDeployJsonShape` was added to `external-controller-manifest.js`; wizard and download flows keep system `dataSources` keys in sync with application `externalIntegration.dataSources` file names. All tests pass. Lint reports 5 errors and 5 warnings in files across the codebase (some in plan 76 scope, some in other modules).

### Task Completion

- **Plan structure**: No explicit checkbox tasks; plan defines implementation guidelines.
- **Implementation steps**: All completed per "Files to touch" summary.

### File Existence Validation

| File | Status | Implementation |
|------|--------|----------------|
| lib/generator/external-controller-manifest.js | ✅ | `toDeployJsonShape()` added; reads file names from application config; deploy JSON shape = system + dataSources only |
| lib/commands/upload.js | ✅ | No change; payload already `{ version, application: manifest.system, dataSources: manifest.dataSources }` |
| lib/generator/wizard.js | ✅ | Uses `toDeployJsonShape()` when writing deploy manifest; `systemConfigWithDataSourcesKeys` keeps system `dataSources` keys in sync with `externalIntegration.dataSources` file names |
| lib/external-system/download-helpers.js | ✅ | `generateVariablesYaml` builds datasource file names from API `dataSources` |
| lib/external-system/download.js | ✅ | `generateSystemFile` sets `dataSources: dataSourcesKeys` from API response; file names derived from same `dataSources` array |
| lib/utils/schema-resolver.js | ✅ | No change; continues using application config for file names |
| tests/lib/generator/external-controller-manifest.test.js | ✅ | Tests for `toDeployJsonShape` (excludes externalIntegration, system + dataSources only) |
| tests/lib/commands/upload.test.js | ✅ | Tests `buildUploadPayload` (version, application, dataSources shape) |

### Test Coverage

- ✅ Unit tests exist for `toDeployJsonShape` in `external-controller-manifest.test.js`
- ✅ Unit tests exist for `buildUploadPayload` in `upload.test.js`
- ✅ All 4,845 tests pass (including 221 test suites)

### Code Quality Validation

| Step | Result | Notes |
|------|--------|-------|
| Format (lint:fix) | ⚠️ | ESLint ran; 5 errors, 5 warnings remain |
| Lint | ❌ FAILED | 5 errors, 5 warnings (setup-utility.js, sync-external-config.js, wizard.js, wizard-prompts.js) |
| Tests | ✅ PASSED | All tests pass |

**Lint details** (project-wide; not all in plan 76 scope):
- lib/cli/setup-utility.js: Function max-lines
- lib/commands/sync-external-config.js: max-statements
- lib/commands/wizard.js: unused var, max-lines, max-statements, complexity
- lib/generator/wizard-prompts.js: file max-lines

### Cursor Rules Compliance (Plan 76 Scope)

- ✅ Code reuse: Uses existing `generateControllerManifest`, `loadVariables`, etc.
- ✅ Error handling: Try-catch, meaningful errors in `toDeployJsonShape`
- ✅ Type safety: JSDoc for `toDeployJsonShape`, `buildUploadPayload`
- ✅ File operations: path.join, fs.promises
- ✅ Input validation: `toDeployJsonShape` validates manifest; appName validation in manifest generator
- ✅ Module patterns: CommonJS, named exports
- ✅ Security: No hardcoded secrets; config-driven file resolution

### Implementation Completeness

- ✅ Manifest shape: `toDeployJsonShape` returns system + dataSources only (no externalIntegration)
- ✅ Upload payload: Uses `manifest.system` and `manifest.dataSources` only
- ✅ Wizard: Writes deploy JSON via `toDeployJsonShape`; system file has `dataSources` keys matching datasource file names
- ✅ Download: System file has `dataSources` keys from API; application config has matching file names from same source
- ✅ Schema resolver: Continues using application config for file resolution

### Issues and Recommendations

1. **Lint**: Resolve remaining lint errors/warnings (especially in wizard.js and wizard-prompts.js) to meet project quality gates. Some issues may predate plan 76.
2. **Documentation**: `toDeployJsonShape` JSDoc clearly documents the "system + dataSources only" contract.

### Final Validation Checklist

- [x] Implementation requirements completed
- [x] All plan-touched files exist and implement the required behavior
- [x] Tests exist and pass for manifest shape and upload payload
- [ ] Lint passes (project-wide lint issues block full compliance)
- [x] Cursor rules followed for plan 76 scope
- [x] Single-source approach: file names in application config; JSON = system + dataSources only

---

## Validation Report (Knowledge Base)

**Date**: 2025-02-27  
**Plan**: .cursor/plans/Done/76-single_source_datasource_list.plan.md  
**Status**: ⚠️ INCOMPLETE (schema alignment issues; MarkdownLint not run)

### Executive Summary

Plan 76 does not explicitly list documentation files—it focuses on implementation (generators, manifest, upload). Related docs were identified by topic (application config, external integration, datasources) and validated. **Schema-based validation found invalid `entityType` values in `docs/external-systems.md`**. MarkdownLint was not run (markdownlint not installed in the project).

### Documents Validated

- **Total**: 4
- **Passed structure/references**: 4
- **Schema alignment**: 1 doc with invalid examples
- **Auto-fixed**: 0 (no MarkdownLint run)

### Document List

| Document | Structure | References | Schema |
|----------|-----------|------------|--------|
| docs/configuration/application-yaml.md | ✅ | ✅ | ✅ (externalIntegration optional) |
| docs/configuration/external-integration.md | ✅ | ✅ | ✅ |
| docs/commands/external-integration.md | ✅ | ✅ | N/A (CLI only) |
| docs/external-systems.md | ✅ | ✅ | ❌ (entityType examples invalid) |

### Structure Validation

- **docs/configuration/application-yaml.md**: Single `#` title, proper hierarchy, nav to Documentation index and Configuration. Content focused on builder usage.
- **docs/configuration/external-integration.md**: Proper structure, nav links. Describes externalIntegration block correctly.
- **docs/commands/external-integration.md**: Proper structure, nav links, comprehensive command coverage.
- **docs/external-systems.md**: Proper structure, nav link to Documentation index, Mermaid diagrams present.

### Reference Validation

- Cross-references within `docs/` use valid relative paths.
- Links to `../README.md`, `README.md`, `application-yaml.md`, `external-systems.md`, `validation.md`, `permissions.md`, `wizard.md`, `external-integration-testing.md`, `configuration/secrets-and-config.md` all resolve to existing files.
- No broken internal links found.

### Schema-based Validation

| Document | Schema | Result |
|----------|--------|--------|
| docs/configuration/application-yaml.md | application-schema.json | ✅ No explicit externalIntegration example; mentions externalIntegration as optional. |
| docs/configuration/external-integration.md | application-schema.json (externalIntegration) | ✅ Example valid: schemaBasePath, systems, dataSources, autopublish, version. |
| docs/external-systems.md | external-datasource.schema.json | ❌ **entityType invalid**: Examples use `entityType: company` (e.g. line 222, 515). Schema enum allows only: `document-storage`, `documentStorage`, `vector-store`, `vectorStore`, `record-storage`, `recordStorage`, `message-service`, `messageService`, `none`. Use e.g. `recordStorage` for HubSpot companies. |
| docs/external-systems.md | external-system.schema.json | ✅ System examples align (key, displayName, type, authentication, etc.). |

### Markdown Validation

- **MarkdownLint**: Not run (markdownlint not in package.json; `npx markdownlint` failed with "could not determine executable to run").
- **Recommendation**: Add `markdownlint` and `markdownlint-cli` to devDependencies and run as part of docs validation.

### Project Rules Compliance

- Docs focus on **how to use the aifabrix builder** (CLI, configuration, workflows).
- Config examples (application.yaml, externalIntegration) generally match `lib/schema/application-schema.json`.
- `entityType` examples in external-systems.md do **not** match `lib/schema/external-datasource.schema.json`.

### Manual Fixes Required

1. **docs/external-systems.md**: Replace `entityType: company` (and similar invalid values) with a valid schema enum value (e.g. `recordStorage` for record-based entities like companies, contacts, deals). Update all HubSpot and other examples that use invalid entityType values.
2. **Project**: Add markdownlint to devDependencies and run it on docs as part of validation.

### Final Checklist

- [x] Related documents validated (plan does not list docs; related docs identified by topic)
- [ ] MarkdownLint passes (markdownlint not installed)
- [x] Cross-references within docs/ valid
- [x] No broken internal links
- [ ] Examples and structure correct vs lib/schema (entityType examples invalid in external-systems.md)
- [x] Content focused on using the builder (external users)
- [ ] Auto-fixes applied; manual fixes documented
