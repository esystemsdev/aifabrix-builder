---
name: Offline field reference validation
overview: Add offline validation in the builder so that field references in indexing (embedding, uniqueKey), validation.repeatingValues[].field, and quality.rejectIf[].field are required to exist in fieldMappings.attributes, matching the dataplane's invalid_reference checks and giving users early feedback without deploying.
todos: []
isProject: false
---

# Offline Validation for Schema Field References

## Goal

Validate in the builder (offline) that every field name used in **indexing.embedding**, **indexing.uniqueKey**, **validation.repeatingValues[].field**, and **quality.rejectIf[].field** exists in **fieldMappings.attributes**. Invalid references are reported when users run `aifabrix datasource validate <file>` or when deploy runs validation, without needing to push to the dataplane.

## Scope

- **Builder (Node.js) only**: [lib/datasource/](lib/datasource/), [tests/lib/datasource/](tests/lib/datasource/).
- **No schema changes**: The external-datasource JSON schema stays as-is (structure/type/pattern only). Cross-reference checks are implemented in code.

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Mandatory checks before commit: build, lint, test, file size, JSDoc, no hardcoded secrets, test coverage ≥80% for new code.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – Files ≤500 lines, functions ≤50 lines; JSDoc for all public functions; single responsibility.
- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** – Validation logic in code; developer-friendly error messages; validate before deployment.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Jest; tests in `tests/` mirroring source; mock external deps; test success and error paths; 80%+ coverage.
- **[Code Style](.cursor/rules/project-rules.mdc#code-style)** – JavaScript conventions, naming (kebab-case files, camelCase functions), error handling with try-catch and meaningful messages.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – Structured error messages with context; never expose sensitive data in errors.
- **[Security & Compliance](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – No hardcoded secrets; input validation; no sensitive data in logs or errors.
- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** – CommonJS modules; logic in `lib/`; module export and file organization.

**Key requirements**

- Run `npm run build` first (runs lint then test); must complete successfully.
- Lint: `npm run lint` with zero errors/warnings.
- Test: all tests pass; ≥80% coverage for new code.
- JSDoc for all public functions; file ≤500 lines, functions ≤50 lines.
- No hardcoded secrets; meaningful, contextual error messages.

## Before Development

- Read [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) and [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards).
- Review [lib/datasource/validate.js](lib/datasource/validate.js) and [lib/utils/external-system-validators.js](lib/utils/external-system-validators.js) for existing validation patterns.
- Confirm test layout: [tests/lib/datasource/](tests/lib/datasource/) for new and updated tests.
- Ensure validation order: run `npm run build` (lint then test) and fix any failures before marking done.

## Current state

- [lib/datasource/validate.js](lib/datasource/validate.js): `validateDatasourceFile(filePath)` parses JSON and runs `loadExternalDataSourceSchema()` (AJV). Returns `{ valid, errors: string[], warnings }`. No cross-reference checks.
- Dataplane (Python) already enforces these references (ValidationRulesValidator, CipParameterValidator) with code `invalid_reference`. This plan mirrors that logic in the builder so the same errors can be caught offline.

## Approach

1. **New module**: Add a small validator that takes a **parsed** datasource object, derives the set of attribute names from `fieldMappings.attributes`, and returns a list of error messages for any invalid field reference. Reuse the dataplane rule: skip the cross-check when `fieldMappings.attributes` is missing or empty.
2. **Integration**: Run this validator inside `validateDatasourceFile` **after** schema validation. If schema fails, keep current behavior (return schema errors only). If schema passes, run the field-reference check and append any new errors to the result; set `valid: false` if there are field-reference errors.
3. **Error format**: Keep the existing API: `errors` remains `string[]`. Each new error should clearly identify the config path and the problem (e.g. `indexing.embedding[0]: field 'x' does not exist in fieldMappings.attributes`). Optionally document in code that this corresponds to dataplane `invalid_reference` for parity.

## Implementation

### 1. New module: field-reference validator

**File:** `lib/datasource/field-reference-validator.js` (new)

- **Function:** `validateFieldReferences(parsed) -> string[]`
  - **Input:** Parsed datasource object (after JSON parse).
  - **Output:** Array of error messages (empty if no invalid references).
- **Logic:**
  - `normalizedAttributes = Object.keys(parsed?.fieldMappings?.attributes ?? {})`. If `normalizedAttributes.length === 0`, return `[]` (skip check).
  - **indexing.embedding:** If `parsed.indexing?.embedding` is an array, for each element `field` at index `i`, if `field` is a string and `!normalizedAttributes.includes(field)`, push error: `indexing.embedding[${i}]: field '${field}' does not exist in fieldMappings.attributes`.
  - **indexing.uniqueKey:** If `parsed.indexing?.uniqueKey` is a non-empty string and `!normalizedAttributes.includes(parsed.indexing.uniqueKey)`, push error: `indexing.uniqueKey: field '${parsed.indexing.uniqueKey}' does not exist in fieldMappings.attributes`.
  - **validation.repeatingValues:** If `parsed.validation?.repeatingValues` is an array, for each item with a `field` (string), if `!normalizedAttributes.includes(rule.field)`, push error: `validation.repeatingValues[${index}].field: field '${rule.field}' does not exist in fieldMappings.attributes`.
  - **quality.rejectIf:** If `parsed.quality?.rejectIf` is an array, for each item with a `field` (string), if `!normalizedAttributes.includes(rule.field)`, push error: `quality.rejectIf[${index}].field: field '${rule.field}' does not exist in fieldMappings.attributes`.
- **JSDoc:** Document the function, parameters, return value, and that this aligns with dataplane `invalid_reference` semantics.
- **File/function size:** Keep the module under the project limit (e.g. one exported function, helpers if needed, under 500 lines).

### 2. Wire into datasource validation

**File:** [lib/datasource/validate.js](lib/datasource/validate.js)

- After the existing schema validation block:
  - If schema validation already failed (`!valid`), keep returning `{ valid: false, errors: formatValidationErrors(...), warnings }`.
  - If schema validation passed, call `validateFieldReferences(parsed)`. If the returned array is non-empty, return `{ valid: false, errors: [...schemaErrors, ...fieldRefErrors], warnings }`. Otherwise return `{ valid: true, errors: [], warnings }` as today.
- No change to the function signature or to callers ([lib/commands/datasource.js](lib/commands/datasource.js), [lib/datasource/deploy.js](lib/datasource/deploy.js), [lib/validation/validate.js](lib/validation/validate.js) via getValidatorForType + validateExternalFile for external-datasource type do not call validateDatasourceFile; they use the schema only). So the only entry point that gets the new checks is `validateDatasourceFile` and every caller of it (datasource validate, datasource deploy) will see the new errors.

**Note:** The generic `validate` command path in [lib/validation/validate.js](lib/validation/validate.js) uses `validateExternalFile`, which uses the schema validator directly, not `validateDatasourceFile`. So when a user runs `aifabrix validate path/to/datasource.json` with type external-datasource, they currently get only schema validation. To have field-reference validation there too, we could either (a) have `validateExternalFile` for type `datasource`/`external-datasource` call into a shared helper that runs both schema and field-reference validation, or (b) leave that for a follow-up. The plan assumes the primary path is `aifabrix datasource validate <file>` and deploy; if you want the generic validate command to include field-reference checks, that can be added in the same change set by having the external-datasource branch run the same field-reference validator on the parsed object after schema validation.

### 3. Tests

**File:** [tests/lib/datasource/datasource-validate.test.js](tests/lib/datasource/datasource-validate.test.js)

- Add tests for **validateDatasourceFile** (with schema mocked to pass):
  - Datasource with `indexing.embedding` containing a field not in `fieldMappings.attributes` → `valid: false`, errors include message for that path.
  - Datasource with `indexing.uniqueKey` not in `fieldMappings.attributes` → `valid: false`, errors include message for indexing.uniqueKey.
  - Datasource with `validation.repeatingValues[].field` not in attributes → `valid: false`, errors include message for that index.
  - Datasource with `quality.rejectIf[].field` not in attributes → `valid: false`, errors include message for that index.
  - Datasource with all references valid (all listed in fieldMappings.attributes) → no additional errors, `valid: true` (when schema mock passes).
  - Datasource with missing or empty `fieldMappings.attributes` and with indexing/validation/quality present → no field-reference errors (skip when attributes empty).

**File:** `tests/lib/datasource/field-reference-validator.test.js` (new)

- Unit tests for `validateFieldReferences(parsed)` only (no file I/O, no schema):
  - Empty or missing `fieldMappings.attributes` → returns [].
  - Invalid embedding / uniqueKey / repeatingValues.field / rejectIf.field → returns corresponding messages.
  - All references valid → returns [].
  - Optional: multiple invalid references in one config → all reported.

## Definition of Done

Before marking this plan complete:

1. **Build**: Run `npm run build` first (must complete successfully; runs lint then test).
2. **Lint**: `npm run lint` passes with zero errors and zero warnings.
3. **Test**: All tests pass; run after lint (via `npm run build` or `npm test`). Test coverage ≥80% for new code.
4. **Validation order**: BUILD → LINT → TEST (mandatory sequence; do not skip steps).
5. **File size limits**: New/updated files ≤500 lines; functions ≤50 lines.
6. **JSDoc**: All public functions have JSDoc (parameters, return, description; align with dataplane `invalid_reference` in comments where relevant).
7. **Code quality**: All applicable rule requirements from Rules and Standards met.
8. **Security**: No hardcoded secrets; no sensitive data in error messages or logs.
9. **Scope**: New code in `lib/datasource/`; new/updated tests in `tests/lib/datasource/` for both the new validator and `validateDatasourceFile`; no schema or external API changes beyond adding errors to the existing `errors` array.
10. All implementation tasks completed (field-reference validator, wiring in validate.js, tests).

## Optional follow-up

- Run field-reference validation from the generic `validate` command for external-datasource files (so `aifabrix validate <datasource-file>` also reports these errors). This may require a small refactor in [lib/validation/validate.js](lib/validation/validate.js) to reuse the same validation pipeline for datasource files.

---

## Plan Validation Report

**Date**: 2026-02-22  
**Plan**: .cursor/plans/71-offline_field_reference_validation.plan.md  
**Status**: VALIDATED

### Plan Purpose

Add offline validation in the builder so that field references in indexing (embedding, uniqueKey), validation.repeatingValues[].field, and quality.rejectIf[].field must exist in fieldMappings.attributes. Builder-only (lib/datasource, tests); no schema changes. Plan type: Development (validation feature, new module, tests).

### Applicable Rules

- **Quality Gates** – Applies to all plans; build, lint, test, file size, JSDoc, coverage, no secrets.
- **Code Quality Standards** – Applies; new module and updated validate.js, file/function size, JSDoc.
- **Validation Patterns** – Applies; cross-reference validation in code, developer-friendly error messages.
- **Testing Conventions** – Applies; Jest, tests in tests/lib/datasource, mocks, coverage.
- **Code Style** – Applies; JS conventions, naming, error handling.
- **Error Handling & Logging** – Applies; structured messages, no sensitive data in errors.
- **Security & Compliance** – Applies; no hardcoded secrets, input validation.
- **Architecture Patterns** – Applies; CommonJS, lib/datasource layout, module export.

### Rule Compliance

- DoD requirements: Documented (build, lint, test, order BUILD → LINT → TEST, file size, JSDoc, coverage, security, all tasks).
- Quality Gates: Compliant (mandatory checks and sequence reflected in DoD).
- Code Quality Standards: Compliant (file/function size and JSDoc in plan and DoD).
- Validation Patterns: Compliant (cross-check in code, clear error messages).
- Testing: Compliant (test files and cases specified; coverage ≥80% in DoD).

### Plan Updates Made

- Added **Rules and Standards** section with links to project-rules.mdc (Quality Gates, Code Quality Standards, Validation Patterns, Testing Conventions, Code Style, Error Handling & Logging, Security & Compliance, Architecture Patterns) and key requirements.
- Added **Before Development** checklist (read rules, review existing validation, confirm test layout, validation order).
- Updated **Definition of Done** with full checklist: build, lint, test, validation order, file size, JSDoc, code quality, security, scope, and all tasks completed.
- Appended this validation report.

### Recommendations

- When implementing, run `npm run build` after each logical change to catch lint and test failures early.
- Keep `validateFieldReferences` pure (parsed object in, string[] out) for easy unit testing without file or schema mocks.

