---
name: Builder grantType and rateLimit validation
overview: "Implement Builder validation improvements for external-system configs: custom rules for OAuth2/AAD grantType and conditional authorizationUrl (aligned with dataplane plan 327 and dataplane validation-rules.md), document rateLimit and grantType in Builder docs, and add tests."
todos: []
isProject: false
---

# Builder validation: grantType, authorizationUrl, and rateLimit

## Context

- **Dataplane plan 327** (done): Added `grantType` to the external-system schema and dataplane validator; conditional `authorizationUrl` when grantType is `authorization_code` or omitted; created [knowledgebase/integration/validation-rules.md](https://github.com/aifabrix-dataplane) with a "Recommendations for Builder" section.
- **Dataplane validation-rules.md** (in aifabrix-dataplane): States that Builder should validate (1) **grantType** for oauth2/aad: optional, must be `client_credentials` or `authorization_code`; when `authorization_code` or absent, require `authorizationUrl`; (2) **rateLimit**: when present, require either `requestsPerWindow` + `windowSeconds` or `requestsPerSecond` + `burstSize`.
- **Builder schema** ([lib/schema/external-system.schema.json](lib/schema/external-system.schema.json)): Already defines `grantType` and `authorizationUrl` in `$defs.authenticationVariablesByMethod` (lines 89–98) and full `rateLimit` with `oneOf` (lines 487–524). The schema cannot express the conditional rule "when grantType is authorization_code or omitted, authorizationUrl required" (variables are `additionalProperties: string`), so **custom validation** is required for grantType/authorizationUrl. **rateLimit** is already enforced by the schema’s `oneOf` via AJV.

## Scope

- **Code**: Add custom validation for oauth2/aad grantType and conditional authorizationUrl in the Builder validation flow; no schema changes.
- **Docs**: Update Builder validation rules to document grantType and rateLimit (and optionally link to dataplane alignment).
- **Tests**: Add unit tests for the new grantType/authorizationUrl rules.

---

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** – Schema validation, AJV usage, developer-friendly error messages; custom validation runs after schema and must push clear errors.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – Files ≤500 lines, functions ≤50 lines; JSDoc for all public functions; plan already suggests extracting to `external-system-auth-rules.js` if validate.js grows.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Jest, tests in `tests/lib/validation/`, mock schema validator so only new custom checks are under test; 80%+ coverage for new code.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Build, lint, and test must pass before commit; mandatory sequence BUILD → LINT → TEST.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – Clear, actionable error messages for grantType and authorizationUrl (no sensitive data in messages).
- **[Security & Compliance](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – Input validation and sanitization; no hardcoded secrets; docs must not expose REST/API details (per docs-rules).

**Key requirements**

- Use defensive checks: only run when `parsed.authentication?.variables` exists; treat non-oauth2/aad as no-op.
- Push clear errors (e.g. "grantType must be one of: client_credentials, authorization_code"; "authorizationUrl is required when grantType is authorization_code or omitted").
- Add JSDoc for `validateOAuth2GrantTypeAndAuthorizationUrl` (params, return, throws).
- Tests: valid/invalid cases for oauth2 and aad, no-op for other methods; optional rateLimit schema test.
- Docs: command-centric, no REST/API details (see [docs-rules](.cursor/rules/docs-rules.mdc)).

---

## Before Development

- Read Validation Patterns and Code Quality Standards from project-rules.mdc.
- Review existing `validateExternalFile` and `validateRoleReferences` in `lib/validation/validate.js`.
- Confirm external-system schema `$defs.authenticationVariablesByMethod` and rateLimit `oneOf` (no schema change needed).
- Review `docs/configuration/validation-rules.md` and `docs/commands/validation.md` structure.
- Review `tests/lib/validation/validate.test.js` and mock patterns for schema validation.

---

## 1. Custom validation: grantType and authorizationUrl

**Where**: Run after AJV in the same place role-reference checks run for external system files.

**Location**: [lib/validation/validate.js](lib/validation/validate.js) — in `validateExternalFile`, when `normalizedType === 'system'`, after schema validation and `validateRoleReferences`, call a new function that validates auth rules for oauth2/aad.

**Logic** (align with dataplane):

- If `authentication.method` is `oauth2` or `aad`:
  - **grantType**: If `authentication.variables.grantType` is present, it must be exactly `client_credentials` or `authorization_code`; otherwise push a clear error (e.g. "authentication.variables.grantType must be one of: client_credentials, authorization_code").
  - **authorizationUrl**: Effective grant = `variables.grantType || 'authorization_code'`. If effective grant is `authorization_code`, then `variables.authorizationUrl` must be present and non-empty; otherwise push error (e.g. "authentication.variables.authorizationUrl is required when grantType is authorization_code or omitted").
- If method is not oauth2/aad, do nothing.

**Implementation options**:

- **A (recommended)**: Add a function `validateOAuth2GrantTypeAndAuthorizationUrl(parsed, errors)` in `validate.js` and call it from `validateExternalFile` when `normalizedType === 'system'`.
- **B**: Extract to a small module e.g. `lib/validation/external-system-auth-rules.js` and require it from `validate.js` (keeps validate.js under 500 lines if it grows).

Use defensive checks: only run when `parsed.authentication?.variables` exists; treat missing `method` or non-oauth2/aad as no-op.

---

## 2. rateLimit

No code change. The external-system schema already defines `rateLimit` with `oneOf` requiring either (`requestsPerWindow` + `windowSeconds`) or (`requestsPerSecond` + `burstSize`). AJV is used for external system files in [lib/validation/validate.js](lib/validation/validate.js) via [lib/utils/schema-loader.js](lib/utils/schema-loader.js) (`loadExternalSystemSchema()`), so invalid `rateLimit` (e.g. only one of the pair, or wrong types) will already produce schema errors. Optional: add one test that a system with invalid `rateLimit` fails validation (e.g. `rateLimit: { requestsPerWindow: 100 }` without `windowSeconds`) to lock behavior.

---

## 3. Documentation

- **[docs/configuration/validation-rules.md](docs/configuration/validation-rules.md)**  
  - In the "External system file(s)" table (Step 2), add two rows:
    - **grantType (oauth2/aad)**: Optional. When present must be `client_credentials` or `authorization_code`. When `authorization_code` or omitted, `authorizationUrl` is required.
    - **rateLimit (optional)**: When present, must specify either `requestsPerWindow` + `windowSeconds` or `requestsPerSecond` + `burstSize` (enforced by schema).
  - Optionally add a short "Alignment with dataplane" note pointing to the dataplane’s validation-rules doc (without exposing REST/API details), per docs-rules.
- **Optional**: In [docs/commands/validation.md](docs/commands/validation.md), under External System Schema key requirements, add one line each for grantType and rateLimit so CLI users see them in one place.

---

## 4. Tests

- **Unit tests** for the new grantType/authorizationUrl validation:
  - **Valid**: oauth2 with `grantType: "client_credentials"` and no `authorizationUrl` → no error.
  - **Valid**: oauth2 with `grantType: "authorization_code"` and `authorizationUrl` set → no error.
  - **Valid**: oauth2 with no grantType (default authorization_code) and `authorizationUrl` set → no error.
  - **Invalid**: oauth2 with `grantType: "authorization_code"` and no `authorizationUrl` → one error.
  - **Invalid**: oauth2 with grantType omitted and no `authorizationUrl` → one error.
  - **Invalid**: oauth2 with `grantType: "invalid_value"` → one error (grantType must be one of …).
  - **Same behavior for `aad`** (at least one test for aad, e.g. client_credentials without URL is valid).
  - **No-op**: method `apikey` or `none` → no grantType/authorizationUrl errors.

Prefer adding these in [tests/lib/validation/validate.test.js](tests/lib/validation/validate.test.js) inside the `validateExternalFile` describe block (or a new describe for "OAuth2/AAD grantType and authorizationUrl"). Use mocks so that the schema validator returns `true` and only the new custom checks are under test; use real parsed objects that would pass schema (required fields set) so failures are due to the new rules.

- **Optional**: In [tests/local/lib/schema/schema-validation.test.js](tests/local/lib/schema/schema-validation.test.js) (or validate.test.js), add a test that an external system with `rateLimit: { requestsPerWindow: 100 }` (missing `windowSeconds`) fails schema validation, to document that rateLimit oneOf is enforced.

---

## 5. Files to touch (summary)


| File                                                                                                 | Change                                                                                                                     |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [lib/validation/validate.js](lib/validation/validate.js)                                             | Add `validateOAuth2GrantTypeAndAuthorizationUrl(parsed, errors)`; call it from `validateExternalFile` when type is system. |
| [docs/configuration/validation-rules.md](docs/configuration/validation-rules.md)                     | Document grantType and rateLimit in Step 2 external system table; optional dataplane alignment sentence.                   |
| [docs/commands/validation.md](docs/commands/validation.md)                                           | Optional: one line each for grantType and rateLimit under External System key requirements.                                |
| [tests/lib/validation/validate.test.js](tests/lib/validation/validate.test.js)                       | Add tests for grantType/authorizationUrl (valid and invalid cases, oauth2 and aad, no-op for other methods).               |
| [tests/local/lib/schema/schema-validation.test.js](tests/local/lib/schema/schema-validation.test.js) | Optional: test that invalid rateLimit fails schema validation.                                                             |


---

## 6. Order of implementation

1. Implement `validateOAuth2GrantTypeAndAuthorizationUrl` and integrate in `validateExternalFile`.
2. Add unit tests for grantType/authorizationUrl; run `npm test` and fix any failures.
3. Update docs (validation-rules.md, optionally validation.md).
4. Optionally add rateLimit schema test; run full test suite and lint.

---

## 7. Definition of done

**Feature completion**

- For external system files with method oauth2 or aad, grantType (if present) is restricted to `client_credentials` or `authorization_code`, and when effective grant is `authorization_code`, `authorizationUrl` is required.
- rateLimit continues to be enforced by existing schema (no regression).
- validation-rules.md documents grantType and rateLimit; validation.md updated if chosen.
- No REST/API details in user-facing docs (per docs-rules).

**Mandatory quality gates (before marking plan complete)**

1. **Build**: Run `npm run build` first (must succeed; runs lint + test:ci).
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings).
3. **Test**: Run `npm test` or `npm run test:ci` after lint (all tests must pass; ≥80% coverage for new code).
4. **Validation order**: BUILD → LINT → TEST (do not skip steps).
5. **File size**: Files ≤500 lines, functions ≤50 lines (extract to `lib/validation/external-system-auth-rules.js` if validate.js grows).
6. **JSDoc**: All public functions (e.g. `validateOAuth2GrantTypeAndAuthorizationUrl`) have JSDoc comments.
7. **Code quality**: All applicable rule requirements met.
8. **Security**: No hardcoded secrets; no sensitive data in error messages.
9. All plan tasks completed; new tests pass; existing tests and lint remain green.

---

## Plan Validation Report

**Date**: 2025-03-07  
**Plan**: .cursor/plans/96-builder_granttype_and_ratelimit_validation.plan.md  
**Status**: ✅ VALIDATED

### Plan Purpose

Implement Builder validation for external-system configs: custom rules for OAuth2/AAD grantType and conditional authorizationUrl (aligned with dataplane); document rateLimit and grantType in Builder docs; add unit tests. **Type**: Development (validation logic, documentation, tests). **Scope**: lib/validation/validate.js, docs/configuration/validation-rules.md, docs/commands/validation.md, tests/lib/validation/validate.test.js, optionally schema-validation test.

### Applicable Rules

- ✅ [Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns) – Custom validation after AJV; clear error messages.
- ✅ [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) – File/function size, JSDoc; plan suggests extraction if validate.js grows.
- ✅ [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) – Jest, mocks, coverage; tests in tests/lib/validation/.
- ✅ [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) – Build, lint, test, coverage; now documented in DoD.
- ✅ [Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging) – Clear error messages; plan specifies message text.
- ✅ [Security & Compliance](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) – Input validation; no secrets in messages; docs-rules (no REST/API in user docs).

### Rule Compliance

- ✅ DoD requirements: Documented (build first, lint, test, order BUILD → LINT → TEST, file size, JSDoc, security, tasks).
- ✅ Validation Patterns: Compliant (custom validation after schema, push errors).
- ✅ Code Quality: Compliant (extract module option, JSDoc called out).
- ✅ Testing: Compliant (unit tests specified, mocks, coverage).
- ✅ Quality Gates: Compliant (mandatory checks added to DoD).
- ✅ Documentation: Compliant (docs-rules respected; no REST/API in user docs).

### Plan Updates Made

- ✅ Added **Rules and Standards** section with links to project-rules.mdc (Validation Patterns, Code Quality, Testing, Quality Gates, Error Handling, Security).
- ✅ Added **Before Development** checklist (read rules, review validate.js/schema/docs/tests).
- ✅ Expanded **Definition of Done** with mandatory quality gates: build → lint → test order, npm commands, file size, JSDoc, security, task completion.
- ✅ Appended this validation report.

### Recommendations

- Run `npm run build` after implementation to confirm lint + test:ci pass.
- If `lib/validation/validate.js` approaches 500 lines, extract `validateOAuth2GrantTypeAndAuthorizationUrl` (and related helpers) to `lib/validation/external-system-auth-rules.js` as described in the plan.
- Optional rateLimit schema test is a good regression lock; consider adding it in the same pass as the grantType/authorizationUrl tests.

---

## Implementation Validation Report

**Date**: 2025-03-07  
**Plan**: .cursor/plans/96-builder_granttype_and_ratelimit_validation.plan.md  
**Status**: ✅ COMPLETE

### Executive Summary

All plan requirements have been implemented. Custom OAuth2/AAD grantType and authorizationUrl validation runs after schema validation for external system files; documentation and tests are in place; format, lint, and tests pass. Implementation uses a dedicated module (`external-system-auth-rules.js`) to keep `validate.js` under 500 lines.

### Task Completion

- **Total tasks**: Plan is section-based (no explicit checkboxes). All required sections implemented.
- **Completed**: Custom validation (grantType/authorizationUrl), rateLimit (no code change), documentation (validation-rules.md + validation.md), unit tests (grantType/authorizationUrl), optional rateLimit schema test, roundtrip fixture fix.
- **Incomplete**: None.
- **Completion**: 100%.

### File Existence Validation


| File                                                                                                                                         | Status                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [lib/validation/validate.js](lib/validation/validate.js)                                                                                     | ✅ Exists; requires `external-system-auth-rules`, calls `validateOAuth2GrantTypeAndAuthorizationUrl` when `normalizedType === 'system'` after `validateRoleReferences`. 482 lines (≤500). |
| [lib/validation/external-system-auth-rules.js](lib/validation/external-system-auth-rules.js)                                                 | ✅ **New file**; exports `validateOAuth2GrantTypeAndAuthorizationUrl` with JSDoc, defensive checks, clear error messages. 49 lines.                                                       |
| [docs/configuration/validation-rules.md](docs/configuration/validation-rules.md)                                                             | ✅ Exists; Step 2 table includes **grantType (oauth2/aad)** and **rateLimit (optional)** rows.                                                                                            |
| [docs/commands/validation.md](docs/commands/validation.md)                                                                                   | ✅ Exists; External System Schema Key Requirements include grantType/authorizationUrl and rateLimit lines.                                                                                |
| [tests/lib/validation/validate.test.js](tests/lib/validation/validate.test.js)                                                               | ✅ Exists; describe "OAuth2/AAD grantType and authorizationUrl" with 9 tests (valid/invalid/no-op).                                                                                       |
| [tests/local/lib/schema/schema-validation.test.js](tests/local/lib/schema/schema-validation.test.js)                                         | ✅ Exists; test "should reject external-system with invalid rateLimit (missing windowSeconds)".                                                                                           |
| [tests/lib/external-system/external-system-download-roundtrip.test.js](tests/lib/external-system/external-system-download-roundtrip.test.js) | ✅ Fixture updated with `authorizationUrl` so oauth2 config passes new validation.                                                                                                        |


### Test Coverage

- **Unit tests**: ✅ `tests/lib/validation/validate.test.js` – 9 cases: oauth2 client_credentials (no URL), oauth2 authorization_code + URL, oauth2 no grantType + URL, oauth2 authorization_code no URL (error), oauth2 omitted grantType no URL (error), oauth2 invalid grantType (error), aad client_credentials (no URL), apikey no-op, none no-op.
- **Schema test**: ✅ `tests/local/lib/schema/schema-validation.test.js` – invalid rateLimit (requestsPerWindow only) fails validation.
- **Roundtrip**: ✅ Roundtrip test fixture includes `authorizationUrl`; test passes.
- **Coverage**: New code covered by focused unit tests; schema and integration behavior locked.

### Code Quality Validation


| Step                  | Result                                                          |
| --------------------- | --------------------------------------------------------------- |
| **Format** (lint:fix) | ✅ PASSED (exit code 0)                                          |
| **Lint**              | ✅ PASSED (0 errors, 0 warnings)                                 |
| **Tests**             | ✅ PASSED – 236 suites, 5136 tests (28 skipped). All tests pass. |


### Cursor Rules Compliance


| Rule                | Status                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| Code reuse          | ✅ Validation in dedicated module; no duplication.                                                          |
| Error handling      | ✅ Errors pushed to array; defensive checks; no sensitive data in messages.                                 |
| Logging             | ✅ No console.log in new code; validation is silent (errors array).                                         |
| Type safety / JSDoc | ✅ JSDoc on `validateOAuth2GrantTypeAndAuthorizationUrl` (params, description); fileoverview in new module. |
| Async patterns      | ✅ Validation is synchronous; call site in existing async flow.                                             |
| File operations     | ✅ N/A in auth rules (no file I/O).                                                                         |
| Input validation    | ✅ Defensive checks: `parsed?.authentication?.variables`, `typeof variables === 'object'`, method check.    |
| Module patterns     | ✅ CommonJS require/module.exports.                                                                         |
| Security            | ✅ No hardcoded secrets; error messages reference only field names.                                         |
| File size           | ✅ validate.js 482 lines; external-system-auth-rules.js 49 lines; functions ≤50 lines.                      |


### Implementation Completeness

- **Custom validation**: ✅ grantType (client_credentials | authorization_code) and conditional authorizationUrl when effective grant is authorization_code; no-op for non-oauth2/aad.
- **rateLimit**: ✅ No code change; schema oneOf enforced by AJV.
- **Documentation**: ✅ validation-rules.md and validation.md updated; no REST/API details (docs-rules).
- **Tests**: ✅ Unit tests for grantType/authorizationUrl; optional rateLimit schema test added; roundtrip fixture fixed.

### Issues and Recommendations

- None. Implementation matches plan; quality gates pass.
- Optional: Run local schema tests with `INCLUDE_LOCAL_TESTS=true` when validating schema behavior (rateLimit test lives there).

### Final Validation Checklist

- All plan sections implemented (custom validation, docs, tests, rateLimit behavior)
- All mentioned files exist and contain expected changes
- New module `external-system-auth-rules.js` created; validate.js under 500 lines
- Tests exist and pass (OAuth2/AAD describe + rateLimit schema test + roundtrip)
- Format (lint:fix) passes
- Lint passes (0 errors, 0 warnings)
- Full test suite passes
- Cursor rules compliance verified
- Implementation complete

---

## Validation Report (Knowledge Base)

**Date**: 2025-03-08  
**Plan**: .cursor/plans/Done/96-builder_granttype_and_ratelimit_validation.plan.md  
**Document(s)**: docs/configuration/validation-rules.md, docs/commands/validation.md  
**Status**: ✅ COMPLETE

### Executive Summary

Documentation referenced in the plan was validated for structure, references, schema alignment, and Markdown. Both docs pass; grantType and rateLimit are documented and align with `lib/schema/external-system.schema.json`. MarkdownLint passed after table-format fixes in `validation-rules.md`.

### Documents Validated

- **Total**: 2  
- **Passed**: 2  
- **Failed**: 0  
- **Auto-fixed**: 1 (validation-rules.md table formatting for MD060)

#### Document List

- ✅ **docs/configuration/validation-rules.md** – Structure, cross-references, and schema-aligned content (external-system, application, external-datasource). Tables fixed for MarkdownLint compact style.
- ✅ **docs/commands/validation.md** – Structure, cross-references, and schema-aligned content. No lint changes.

### Structure Validation

- **validation-rules.md**: Single `#` title, clear `##`/`###` hierarchy, required sections (Steps 1–3, external system/datasource rules, troubleshooting). Nav: Configuration README, Commands validation.
- **validation.md**: Single `#` title, clear hierarchy (Overview, JSON Schemas, How validation works, Command sections, Examples, Troubleshooting). Nav: Documentation index, Commands index.

### Reference Validation

- **validation-rules.md**: Links to `README.md` (config), `../commands/validation.md#aifabrix-validate-apporfile` – all targets exist.
- **validation.md**: Links to `../README.md`, `README.md`, `../wizard.md`, `external-integration.md`, `../external-systems.md`, `../configuration/validation-rules.md`, `external-integration-testing.md`, `../configuration/README.md` – all targets exist.
- No broken internal links.

### Schema-based Validation

- **docs/configuration/validation-rules.md** ↔ **lib/schema/external-system.schema.json**: ✅  
  - grantType (oauth2/aad): doc “client_credentials | authorization_code”; schema `$defs.authenticationVariablesByMethod` matches.  
  - authorizationUrl: doc “required when authorization_code or omitted”; schema description matches.  
  - rateLimit: doc “requestsPerWindow + windowSeconds or requestsPerSecond + burstSize”; schema `rateLimit` oneOf matches.  
  - authentication.method enum: doc lists oauth2, apikey, basic, aad, none, queryParam, oidc, hmac; schema matches.  
  - type: openapi, mcp, custom; key/displayName/description requirements; all consistent.
- **docs/commands/validation.md** ↔ **lib/schema/external-system.schema.json**: ✅  
  - External System Schema key requirements (grantType, authorizationUrl, rateLimit) match schema and validation-rules.md.  
  - No YAML/JSON code blocks in these sections that require schema validation of payloads; prose and tables align with schema.

### Markdown Validation

- **MarkdownLint**: ✅ Passed (0 errors) after fixes.  
- **validation-rules.md**: MD060 table-column-style resolved by using compact-style separator rows (space around pipes in separator lines).  
- **validation.md**: No lint issues.

### Project Rules Compliance

- **Focus**: Both docs describe how to use the builder (CLI, `aifabrix validate`, rules, steps). No REST/API endpoint or HTTP details.  
- **docs-rules**: Command-centric; auth described in user terms; no backend endpoint names.  
- **Examples and structure**: Align with lib/schema (application, external-system, external-datasource) as above.

### Automatic Fixes Applied

- **docs/configuration/validation-rules.md**: Table separator rows updated for MD060 “compact” style (spaces around pipes in `| ------ | ... |` rows) in all tables (Validation steps; Step 1 application.yaml, externalIntegration, rbac, env.template; Step 2 external system, external datasource; Step 3 manifest; Rules at a glance).

### Manual Fixes Required

- None.

### Final Checklist

- [x] All listed docs validated  
- [x] MarkdownLint passes (0 errors)  
- [x] Cross-references within docs/ valid  
- [x] No broken internal links  
- [x] Examples and structure align with lib/schema (external-system, application, external-datasource)  
- [x] Content focused on using the builder (external users)  
- [x] Auto-fixes applied; no manual fixes outstanding

