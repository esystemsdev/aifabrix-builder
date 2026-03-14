---
name: ABAC validation quality and docs
overview: Add ABAC/datasource validation (dimensions, crossSystemJson, legacy crossSystem), improve human-readable error messages (oneOf/anyOf, patterns, hints), unify datasource validation across validate/file and manifest paths, add primaryKey and exposed.profiles reference checks, and update validation documentation.
todos: []
isProject: false
---

# ABAC validation, error messages, offline validation quality, and docs

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** – New module in `lib/datasource/` (abac-validator.js); edits to `lib/datasource/field-reference-validator.js`, `lib/utils/error-formatter.js`, `lib/validation/validate.js`, `lib/validation/external-manifest-validator.js`; CommonJS, path.join for paths.
- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** – Schema validation and procedural checks; developer-friendly error messages; use formatValidationErrors for AJV errors.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – Files ≤500 lines, functions ≤50 lines; JSDoc for all public functions; single responsibility.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Build first (`npm run build`), then lint, then test; zero lint errors; 100% tests pass; ≥80% coverage for new code.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Tests in `tests/lib/datasource/`, `tests/lib/validation/`; Jest; mock dependencies; success and error paths; mirror source structure.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – Meaningful, actionable error messages; never expose sensitive data in errors; structured messages with context.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – No secrets in error messages; validate inputs; mask sensitive data in validation output.
- **[Documentation Requirements](.cursor/rules/project-rules.mdc#documentation-requirements)** – JSDoc on all new public functions; update user docs per [docs-rules.mdc](.cursor/rules/docs-rules.mdc) (command-centric, no REST API details).

**Key requirements:** JSDoc on abac-validator and any new exports; human-readable messages with hints (e.g. "Add attribute or remove reference"); tests for abac-validator, field-reference (primaryKey, exposed.profiles), validate and manifest integration; build → lint → test order; no secrets in validation errors.

## Before Development

- Read Validation Patterns and Error Handling & Logging from [project-rules.mdc](.cursor/rules/project-rules.mdc).
- Review [lib/datasource/field-reference-validator.js](lib/datasource/field-reference-validator.js), [lib/datasource/validate.js](lib/datasource/validate.js), [lib/utils/error-formatter.js](lib/utils/error-formatter.js), [lib/validation/validate.js](lib/validation/validate.js), [lib/validation/external-manifest-validator.js](lib/validation/external-manifest-validator.js).
- Review [docs/commands/validation.md](docs/commands/validation.md) and [docs/configuration/validation-rules.md](docs/configuration/validation-rules.md) for doc update targets.
- Confirm dataplane ABAC semantics from prior analysis (dimensions→attributes, crossSystemJson operators, legacy crossSystem).

## Definition of Done

Before marking this plan complete:

1. **Build:** Run `npm run build` FIRST (must complete successfully; runs lint + test:ci).
2. **Lint:** Run `npm run lint` (must pass with zero errors/warnings).
3. **Test:** Run `npm test` or `npm run test:ci` after lint (all tests pass; ≥80% coverage for new code).
4. **Validation order:** BUILD → LINT → TEST (mandatory sequence; do not skip steps).
5. **File size:** New/edited files ≤500 lines; functions ≤50 lines.
6. **JSDoc:** All new public functions have JSDoc (params, returns, throws).
7. **Security:** No hardcoded secrets; no sensitive data in validation error messages.
8. **Docs:** validation.md and validation-rules.md updated per plan; new error messages reflected in Troubleshooting where appropriate.
9. All implementation tasks (ABAC validator, field-reference extensions, error-formatter, integration in validate and manifest validator, tests, docs) completed.

---

## 1. ABAC and datasource procedural validation (unchanged from prior scope)

- **New [lib/datasource/abac-validator.js](lib/datasource/abac-validator.js):** Validate dimension-to-attribute references (from `config.abac.dimensions` or `fieldMappings.dimensions`); validate `config.abac.crossSystemJson` (allowed operators, exactly one per path, value types, field path format); error on legacy `config.abac.crossSystem`.
- **Integrate:** Call from [lib/datasource/validate.js](lib/datasource/validate.js) after schema + field-reference checks; run the same post-schema checks (field refs + ABAC) in [lib/validation/external-manifest-validator.js](lib/validation/external-manifest-validator.js) for each inline datasource.
- **Unify datasource validation in [lib/validation/validate.js](lib/validation/validate.js):** When `validateExternalFile` runs for type `datasource`, it currently only runs the schema validator. Add post-schema step: run `validateFieldReferences(parsed)` and the new ABAC validator, and append errors. That way `aifabrix validate <file>` and `aifabrix validate <app>` Step 2 give the same quality as `aifabrix datasource validate <file>`.

---

## 2. Human-readable error messages

### 2.1 [lib/utils/error-formatter.js](lib/utils/error-formatter.js)

- **oneOf / anyOf:** AJV does not produce a single clear message for oneOf/anyOf failures (e.g. capabilities: array vs object). Add a branch in `formatSingleError`: when `error.keyword === 'oneOf'` or `'anyOf'`, produce a message such as: `Field "capabilities": must be either an array of operation names (e.g. ["list","get"]) or an object with boolean flags (e.g. { "list": true }).` Use `error.params` if available to mention which subschemas failed; otherwise keep the message generic but actionable.
- **Pattern descriptions:** Add entries to `PATTERN_DESCRIPTIONS` for patterns used in external-datasource and external-system schemas but not yet described, e.g.:
  - `^[a-zA-Z0-9_]+$` → "letters, numbers, and underscores only"
  - `^[a-zA-Z0-9_.]+$` → "letters, numbers, underscores, and dots only"
  So that pattern errors for dimension keys, attribute paths, etc. show a short human-readable rule instead of the regex.
- **const keyword:** If any schema uses `const`, add a formatter so the message is e.g. `Field "X": must be exactly "Y"` instead of a raw AJV message.

### 2.2 Procedural validation messages

- **Field-reference and ABAC:** Keep messages sentence-style and include a short hint where it helps, e.g. "field 'X' does not exist in fieldMappings.attributes. Add the attribute or remove the reference." For ABAC dimension errors, mirror dataplane wording and add suggestion (e.g. "Add 'attr' to fieldMappings.attributes or remove from dimensions.").
- **external-system-validators.js:** Replace raw regex in messages (e.g. "must match pattern ^[a-zA-Z0-9_]+$") with a short human phrase (e.g. "dimension key must contain only letters, numbers, and underscores") so docs and CLI stay consistent with error-formatter.

### 2.3 Consistency

- Prefer sentence case; optional trailing period for multi-sentence messages. Use "Allowed: ...", "Fix: ...", or "Use ... instead" where it reduces back-and-forth.

---

## 3. Additional offline validation for quality

### 3.1 primaryKey references

- **Rule:** Schema says primaryKey elements "must exist in fieldMappings.dimensions or fieldMappings.attributes". We do not enforce this today. Add a check (in [lib/datasource/field-reference-validator.js](lib/datasource/field-reference-validator.js) or in the new ABAC validator): each `primaryKey[]` entry must be present in `fieldMappings.attributes` keys (or in dimension keys if we treat dimensions as valid primaryKey sources; schema text allows both). Prefer attributes-only for simplicity unless schema explicitly allows dimension keys as primaryKey values.
- **Message:** e.g. "primaryKey[0]: field 'X' does not exist in fieldMappings.attributes. Each primaryKey value must reference an attribute name."

### 3.2 exposed.profiles field references

- **Rule:** Dataplane validates that each profile's field list references only existing `fieldMappings.attributes`. Add the same check: for `exposed.profiles.<name>[]`, each entry must be in the normalized attribute set.
- **Place:** [lib/datasource/field-reference-validator.js](lib/datasource/field-reference-validator.js) (same pattern as embedding/uniqueKey/quality), or a single "all field reference" helper used by both.
- **Message:** e.g. "exposed.profiles.[i]: field 'X' does not exist in fieldMappings.attributes."

### 3.3 validate flow parity

- **Already covered above:** [lib/validation/validate.js](lib/validation/validate.js) `validateExternalFile` for datasource must run schema + field refs + ABAC (and thus primaryKey + exposed.profiles once those checks exist). No separate task beyond implementing the shared post-schema step and calling it from validate.js and from the manifest validator.

### 3.4 Optional / later

- **rateLimit:** Currently enforced by schema (requestsPerWindow + windowSeconds or requestsPerSecond + burstSize). No extra procedural check needed unless we want to add a clearer error message when both forms are mixed.
- **Wizard config:** [lib/validation/wizard-config-validator.js](lib/validation/wizard-config-validator.js) has its own small formatter. Optionally reuse or align with [lib/utils/error-formatter.js](lib/utils/error-formatter.js) for oneOf/pattern so wizard errors stay consistent.

---

## 4. Documentation

- **[docs/commands/validation.md](docs/commands/validation.md):** Extend "What Gets Validated" and "External Datasource Schema" to list field-reference checks (indexing, quality, validation.repeatingValues, primaryKey, exposed.profiles) and ABAC checks (dimensions→attributes, crossSystemJson, legacy crossSystem). Note that local validation now includes these; only dimension catalog and crossSystemSql parsing remain server-side. Add any new error messages to Troubleshooting.
- **[docs/configuration/validation-rules.md](docs/configuration/validation-rules.md):** Under Step 2 external datasource file(s), add rows for: field reference validation (all listed paths); primaryKey elements must exist in attributes; exposed.profiles fields must exist in attributes; ABAC dimensions and crossSystemJson/crossSystem rules. Short note that Builder aligns with dataplane procedural checks where possible.

---

## 5. Implementation order

1. **Error-formatter:** oneOf/anyOf and pattern descriptions (and const if needed) so new and existing schema errors are readable.
2. **Field-reference validator:** Add primaryKey and exposed.profiles checks; keep messages human-readable with hints.
3. **ABAC validator:** New module; dimensions, crossSystemJson, legacy crossSystem; messages with suggestions.
4. **Integration:** validate.js (datasource path: post-schema = field refs + ABAC); validateDatasourceFile; external-manifest-validator for each datasource.
5. **external-system-validators:** Replace regex in error strings with short human phrases.
6. **Tests:** abac-validator, field-reference (primaryKey, exposed), validate and manifest integration tests.
7. **Docs:** validation.md and validation-rules.md updates.

---

## Summary


| Area                   | Action                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ABAC**               | New abac-validator: dimensions→attributes, crossSystemJson, legacy crossSystem.                                                                                           |
| **Error messages**     | error-formatter: oneOf/anyOf, more PATTERN_DESCRIPTIONS, const; procedural messages with hints; external-system-validators human phrases.                                 |
| **Offline validation** | primaryKey and exposed.profiles in field-reference-validator; validate.js datasource path runs full post-schema; manifest validator runs same post-schema per datasource. |
| **Docs**               | validation.md and validation-rules.md: list all field-ref and ABAC rules, troubleshooting for new errors.                                                                 |

---

## Plan Validation Report

**Date:** 2026-03-14  
**Plan:** .cursor/plans/110-abac_validation_quality_and_docs.plan.md  
**Status:** ✅ VALIDATED

### Plan Purpose

Add ABAC/datasource procedural validation (dimensions to attributes, crossSystemJson, legacy crossSystem), improve human-readable error messages (oneOf/anyOf, pattern descriptions, hints), unify datasource validation across `validate` file and manifest paths, add primaryKey and exposed.profiles reference checks, and update validation documentation. **Type:** Development (validation modules, error formatting, documentation).

**Affected areas:** lib/datasource (new abac-validator, field-reference-validator), lib/utils (error-formatter, external-system-validators), lib/validation (validate.js, external-manifest-validator), docs/commands/validation.md, docs/configuration/validation-rules.md.

### Applicable Rules

- **Architecture Patterns** – New and edited modules in lib/; schema and validation patterns.
- **Validation Patterns** – Schema and procedural validation; developer-friendly error messages.
- **Code Quality Standards** – File/function size limits; JSDoc; documentation.
- **Quality Gates** – Build, lint, test, coverage, no secrets (mandatory).
- **Testing Conventions** – Jest; tests mirror source; 80%+ coverage for new code.
- **Error Handling & Logging** – Actionable messages; no sensitive data in errors.
- **Security & Compliance** – No secrets in validation output; input validation.
- **Documentation Requirements** – JSDoc; user docs command-centric per docs-rules.

### Rule Compliance

- **DoD requirements:** Documented (build first, lint, test, order BUILD → LINT → TEST, file size, JSDoc, security, docs, all tasks).
- **Quality Gates:** Referenced; mandatory sequence and coverage (≥80%) included in DoD.
- **Validation Patterns:** Plan aligns with schema + procedural checks and human-readable messages.
- **Error Handling:** Plan explicitly requires actionable messages and hints; no sensitive data in errors.

### Plan Updates Made

- Added **Rules and Standards** section with links to project-rules.mdc (Architecture Patterns, Validation Patterns, Code Quality Standards, Quality Gates, Testing Conventions, Error Handling & Logging, Security & Compliance, Documentation Requirements) and key requirements.
- Added **Before Development** section with checklist (read rules, review listed files, review docs, confirm dataplane semantics).
- Added **Definition of Done** with: build first, lint, test after lint, validation order BUILD → LINT → TEST, file size, JSDoc, security, docs, all tasks.

### Recommendations

- When implementing, run `npm run build` before committing to ensure lint and test:ci pass.
- Keep abac-validator.js and field-reference-validator.js under 500 lines; extract helpers if needed.
- Add new error strings to docs/commands/validation.md Troubleshooting so users can look up messages.


