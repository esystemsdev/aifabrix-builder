---
name: Remove deployment.controllerUrl and environment
overview: "Remove deployment.controllerUrl and external-system.environment from schemas and codebase. The manifest must stay generic: URLs (controller, dataplane, baseUrl) and environment are resolved outside the manifest by the user, controller, and runtime config—not defined in the manifest."
todos: []
isProject: false
---

# Remove deployment.controllerUrl and external-system.environment

## Design principle

**Manifest is generic.** It must not contain environment-specific URLs or config:

- Controller URL → user config / auth (`config.controller`, login)
- Dataplane URL → controller knows it
- External system baseUrl → controller/runtime config, not manifest structure

Environment, URLs, and runtime targets are **outside** the manifest.

---

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** - Schema changes; validate against JSON schemas, provide developer-friendly errors
- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** - Module structure, schema location in `lib/schema/`, generator vs template outputs
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - File size limits (≤500 lines, ≤50 per function), JSDoc for public functions
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** - Mandatory build, lint, test before commit; 80%+ coverage for new code
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest, mock external deps, test success and error paths, fixtures in `tests/`
- **[Security & Compliance](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** - No hardcoded secrets; URLs removed from manifest align with this
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** - Meaningful error messages, never expose sensitive data

**Key Requirements**:

- Update schema validation if structure changes; ensure AJV still validates
- Fix generators (builders.js, variable-transformer.js) that produce deployment JSON
- Keep tests in `tests/`; update fixtures and assertions for removed fields
- Add/update JSDoc when changing function signatures
- Use try-catch for async in app-register-config changes

---

## Before Development

- Read Validation Patterns and Architecture Patterns from project-rules.mdc
- Trace `extractExternalIntegrationUrl` / `extractExternalAppConfiguration` callers to confirm registration API expectations
- Confirm Controller repo changes scope (separate tracking)
- Review existing hubspot-system.json and hubspot-deploy.json structure before migration

---

## Definition of Done

Before marking this plan complete:

1. **Build**: Run `npm run build` FIRST (must succeed; runs lint + test:ci)
2. **Lint**: Run `npm run lint` (zero errors/warnings)
3. **Test**: Run `npm test` or `npm run test:ci` AFTER lint (all tests pass; ≥80% coverage for new code)
4. **Validation order**: BUILD → LINT → TEST (mandatory sequence)
5. **File size limits**: Files ≤500 lines, functions ≤50 lines
6. **JSDoc**: All modified public functions have JSDoc comments
7. **Security**: No hardcoded secrets; manifest remains generic (no URLs)
8. All tasks in Parts 1–3 completed
9. Controller repo changes documented (scope only; implementation in separate repo)

---

## Part 1: Remove deployment.controllerUrl

### 1.1 Schema

- [lib/schema/application-schema.json](lib/schema/application-schema.json): Remove `controllerUrl` from the `deployment` object (lines 849–854). Optionally remove the entire `deployment` block if it has no other properties.

### 1.2 Generator and transformer

- [lib/generator/builders.js](lib/generator/builders.js): Remove `validateDeploymentFields` logic that sets `controllerUrl` (lines 271–282); remove or simplify the function if `deployment` becomes empty.
- [lib/utils/variable-transformer.js](lib/utils/variable-transformer.js): Remove `controllerUrl` handling in `validateDeploymentConfig` (lines 211–214).

### 1.3 Templates

- [lib/core/templates.js](lib/core/templates.js): In `generateExternalSystemVariables`, remove `deployment.controllerUrl` from the returned object (lines 37–40).

### 1.4 Documentation

- [docs/configuration/deployment-key.md](docs/configuration/deployment-key.md): Remove `deployment.controllerUrl` from the table (line 43) and from the design rationale list (line 68).
- [docs/configuration/variables-yaml.md](docs/configuration/variables-yaml.md): Remove `deployment.controllerUrl` from the optional fields list (line 9).
- [docs/deploying.md](docs/deploying.md): Remove or adjust any example that shows `controllerUrl` in the manifest (around line 1028).

### 1.5 Tests

- [tests/lib/generator/generator.test.js](tests/lib/generator/generator.test.js): Remove assertions and fixtures with `controllerUrl` (lines 1433, 1458, 1957–2020).
- [tests/lib/utils/variable-transformer.test.js](tests/lib/utils/variable-transformer.test.js): Remove `controllerUrl` fixture and assertion (lines 289, 297).
- [tests/lib/core/templates.test.js](tests/lib/core/templates.test.js): The `controllerUrl` in `generateEnvTemplate` is for MISO_CONTROLLER_URL in env.template (a different concept—runtime env for apps). Confirm whether that stays or needs a different source; likely unchanged.

---

## Part 2: Remove external-system.environment (baseUrl, region)

### 2.1 Schema

- [lib/schema/external-system.schema.json](lib/schema/external-system.schema.json): Remove the `environment` property (lines 115–132).

### 2.2 Migration: configuration.items for URL-like values

Per-environment values (baseUrl, region, etc.) move into `configuration.items`:

- Add `BASE_URL` (or `API_BASE_URL`) and optional `REGION` as configuration items with `portalInput`.
- Controller resolves these at deploy time; manifest only defines the structure.

### 2.3 Builder: drop URL extraction for app registration

- [lib/utils/app-register-config.js](lib/utils/app-register-config.js): `extractUrlFromSystemJson` reads `environment.baseUrl`. Since we drop extraction:
  - Remove `extractUrlFromSystemJson` (or make it a no-op).
  - `extractExternalIntegrationUrl` / `extractExternalAppConfiguration` must no longer require a URL from the system JSON. Decide what `externalIntegration.url` should be:
    - Empty / null and let the controller resolve it, or
    - Remove `url` from the registration payload if the API no longer expects it.
    Check how `extractExternalAppConfiguration` is used and what the registration API expects.

### 2.4 Migrate external system files

- [integration/hubspot/hubspot-system.json](integration/hubspot/hubspot-system.json) and [integration/hubspot/hubspot-deploy.json](integration/hubspot/hubspot-deploy.json): Remove `environment` (`baseUrl`). Add `BASE_URL` (or `API_BASE_URL`) to `configuration` if the Controller expects it.

### 2.5 Documentation

- [docs/configuration/deployment-key.md](docs/configuration/deployment-key.md): Remove `externalSystem.environment` from the table (line 47) and from the design rationale (line 65).

### 2.6 Tests

- [tests/integration/hubspot/hubspot-integration.test.js](tests/integration/hubspot/hubspot-integration.test.js): Remove `expect(systemJson.environment.baseUrl).toBe(...)` (line 924).
- [tests/lib/utils/app-register-config.test.js](tests/lib/utils/app-register-config.test.js): Remove or change the test that expects `Missing environment.baseUrl` (lines 320–328).

---

## Part 3: Controller (separate repo)

- Controller must stop reading `deployment.controllerUrl` and `externalSystem.environment.baseUrl` from the manifest.
- Resolve controller URL from auth/config; dataplane URL from controller config; external baseUrl from `configuration.items` (e.g. `BASE_URL`) or from environment-specific config.
- Document these changes in the Controller repo.

---

## Summary of removals


| Location                                           | Remove                                                      |
| -------------------------------------------------- | ----------------------------------------------------------- |
| application-schema.json                            | deployment.controllerUrl                                    |
| external-system.schema.json                        | environment (baseUrl, region)                               |
| builders.js, variable-transformer.js               | controllerUrl handling                                      |
| templates.js                                       | deployment.controllerUrl in generateExternalSystemVariables |
| app-register-config.js                             | extractUrlFromSystemJson / URL-from-manifest                |
| hubspot-system.json, hubspot-deploy.json           | environment block                                           |
| deployment-key.md, variables-yaml.md, deploying.md | References to both                                          |
| Tests                                              | All related fixtures and assertions                         |


---

## Plan Validation Report

**Date**: 2025-02-08
**Plan**: .cursor/plans/50-remove_deployment.controllerurl_and_environment.plan.md
**Status**: VALIDATED

### Plan Purpose

Remove `deployment.controllerUrl` and `external-system.environment` from schemas and codebase so the manifest stays generic. URLs (controller, dataplane, baseUrl) and environment are resolved outside the manifest by the user, controller, and runtime config.

**Scope**: Schemas (application-schema, external-system), generators (builders.js, variable-transformer), templates (templates.js), utils (app-register-config), integration files (hubspot), docs, tests.

**Type**: Refactoring (schema removal, code simplification).

### Applicable Rules

- [Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns) - Schema changes
- [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns) - Module structure, generator vs artifact
- [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) - File size, JSDoc
- [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) - Build, lint, test mandatory
- [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) - Jest, fixtures, coverage
- [Security & Compliance](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) - No hardcoded secrets
- [Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging) - Error messages

### Rule Compliance

- DoD requirements: Documented (build, lint, test, validation order)
- Validation Patterns: Plan addresses schema changes and generator fixes
- Code Quality Standards: Plan includes JSDoc note for modified functions
- Quality Gates: DoD enforces build → lint → test
- Testing Conventions: Plan explicitly lists test file updates

### Plan Updates Made

- Added Rules and Standards section with rule references
- Added Before Development checklist
- Added Definition of Done section with mandatory validation steps
- Appended this validation report

### Recommendations

- Before implementing Part 2.3, verify how `extractExternalAppConfiguration` / `externalIntegration.url` are used by the registration API (possibly in Controller or applications.api).
- When modifying hubspot-system.json, consider whether Controller expects `BASE_URL` in configuration.items; coordinate with Controller repo changes.

