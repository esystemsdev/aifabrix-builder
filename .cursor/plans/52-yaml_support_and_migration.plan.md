---
name: YAML Support and Migration
overview: Add YAML support for all human-editable config. Rename variables.yaml to application.yaml. Convert system/datasource files from JSON to YAML. Migration via one top-level function plus `aifabrix convert` command. Single-version documentation, no backward compatibility.
todos: []
isProject: false
---

# YAML Support and Migration Plan

## Overview

- **Product not in production** – no need for backward compatibility.
- **Single version documentation** – current only.
- **Simple migration** – one function for `application.yaml` resolution; `aifabrix convert` for one-time conversion.

**Goal:** All human-editable config is YAML; only deployment manifest stays JSON. Developers can add comments in YAML.

---

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Mandatory checks before commit: build, lint, test, coverage ≥80%, no hardcoded secrets.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – Files ≤500 lines, functions ≤50 lines, JSDoc for all public functions.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – New `aifabrix convert` command follows Commander.js pattern, input validation, chalk output, tests.
- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** – Changes to builder/ or integration/ must target generators/templates (lib/core/templates.js, lib/generator/*), not generated artifacts.
- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** – Schema validation, YAML validation with js-yaml; validate before deployment.
- **[Template Development](.cursor/rules/project-rules.mdc#template-development)** – Templates emit `application.yaml`; update Handlebars templates and generator context.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – try-catch for async, meaningful errors, chalk, no sensitive data in messages.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Tests in `tests/`, Jest, mock fs/paths, 80%+ coverage for new code.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – No secrets in code or logs; file operations use path.join().

**Key requirements:** Use `resolveApplicationConfigPath` as single entry point; update generators/templates for application.yaml and *.yaml system/datasource; JSDoc for all new/changed functions; BUILD → LINT → TEST before considering work complete.

---

## Before Development

- Read Architecture Patterns and Validation Patterns from project-rules.mdc.
- Review existing config loaders (lib/generator/helpers.js, lib/utils/paths.js) for patterns.
- Review lib/generator/external.js and lib/external-system/download.js for system/datasource flow.
- Understand YAML processing pattern (js-yaml load/dump) from project-rules.mdc.
- Run `npm run build` to establish baseline (must pass before starting).

---

## Definition of Done

Before marking this plan complete:

1. **Build**: Run `npm run build` FIRST (must complete successfully – runs lint + test:ci).
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings).
3. **Test**: Run `npm test` or `npm run test:ci` AFTER lint (all tests must pass, ≥80% coverage for new code).
4. **Validation order**: BUILD → LINT → TEST (mandatory sequence, never skip steps).
5. **File size limits**: Files ≤500 lines, functions ≤50 lines.
6. **JSDoc documentation**: All modified public functions have JSDoc comments.
7. **Code quality**: All rule requirements met.
8. **Security**: No hardcoded secrets, ISO 27001 compliance.
9. **Migration**: `resolveApplicationConfigPath` and `aifabrix convert` implemented; all content migrated.
10. **Documentation**: Single-version docs updated; no backward-compatibility sections.

---

## 1. File Format Convention


| File                   | Before                      | After                             |
| ---------------------- | --------------------------- | --------------------------------- |
| Application config     | `variables.yaml`            | `application.yaml`                |
| System definition      | `hubspot-system.json`       | `hubspot-system.yaml`             |
| Datasource definitions | `hubspot-datasource-*.json` | `hubspot-datasource-*.yaml`       |
| RBAC                   | `rbac.yaml`                 | `rbac.yaml` (unchanged)           |
| Deployment manifest    | `hubspot-deploy.json`       | `hubspot-deploy.json` (unchanged) |


**Rule:** YAML for config; JSON only for deployment manifest (API payload).

---

## 2. Migration Approach

### 2.1 application.yaml – One Top-Level Function

**Function:** `resolveApplicationConfigPath(appPath)` (or equivalent)

**Logic:**

1. If `application.yaml` exists in folder → return its path.
2. If not, check for `variables.yaml`.
3. If `variables.yaml` exists → rename it to `application.yaml`, return path.
4. If neither exists → throw error.

**Location:** Central place (e.g. `lib/utils/paths.js` or new `lib/utils/app-config-resolver.js`).

**Sync/async:** Sync is sufficient (fs.existsSync, fs.renameSync). All callers use the returned path.

**Usage:** All code that needs application config calls this function instead of hardcoding `variables.yaml`. No dual support; migration happens in-place when first accessed.

### 2.2 `aifabrix convert` Command

**Purpose:** One-time conversion for all developers.

**Command:** `aifabrix convert [<app>]` or `aifabrix convert --all`

**Actions:**

1. `variables.yaml` → `application.yaml` (rename).
2. `*-system.json` → `*-system.yaml` (parse JSON, write YAML, delete JSON).
3. `*-datasource-*.json` → `*-datasource-*.yaml` (parse JSON, write YAML, delete JSON).
4. Update `application.yaml` `externalIntegration.systems` and `externalIntegration.dataSources` to reference `.yaml` filenames.

**Scope:** Applies to `builder/` and `integration/` folders.

**When done:** Delete `aifabrix convert` command and its implementation once all developers have run it.

**No dual support:** Main code paths only support `.yaml`. No fallback to `.json`.

---

## 3. What Needs to Change

### 3.1 New / Central Components


| Component                               | Purpose                                                            |
| --------------------------------------- | ------------------------------------------------------------------ |
| `resolveApplicationConfigPath(appPath)` | Returns path to application.yaml; renames variables.yaml if needed |
| `aifabrix convert` command              | One-time conversion; CLI + implementation in lib/commands/ or lib/ |


### 3.2 Schema Changes


| File                                                                     | Change                                                                                                                           |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| [lib/schema/application-schema.json](lib/schema/application-schema.json) | `externalIntegration.systems` and `externalIntegration.dataSources` items: change pattern from `^[^ ].+\.json$` to `^[^ ].+(yaml |


**Note:** After migration, schema only allows `.yaml`. No need to support both during transition.

### 3.3 Config Loading (application.yaml)


| File                                                                                               | Change                                                                                                               |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [lib/generator/helpers.js](lib/generator/helpers.js)                                               | `loadVariables` – accept path or use resolver; callers pass path from `resolveApplicationConfigPath`                 |
| [lib/generator/index.js](lib/generator/index.js)                                                   | Use `resolveApplicationConfigPath`; pass `application.yaml` path to loaders                                          |
| [lib/generator/external-controller-manifest.js](lib/generator/external-controller-manifest.js)     | Use `resolveApplicationConfigPath`; load from `application.yaml`                                                     |
| [lib/generator/external.js](lib/generator/external.js)                                             | Use `resolveApplicationConfigPath`; resolve system file path from variables                                          |
| [lib/generator/builders.js](lib/generator/builders.js)                                             | Use `resolveApplicationConfigPath`; reference `application.yaml`                                                     |
| [lib/generator/split.js](lib/generator/split.js)                                                   | Write `application.yaml` instead of `variables.yaml`; update `extractVariablesYaml` name if needed                   |
| [lib/generator/external-schema-utils.js](lib/generator/external-schema-utils.js)                   | Write `application.yaml`; update `buildExternalVariables` to reference `.yaml` in systems/dataSources                |
| [lib/generator/wizard.js](lib/generator/wizard.js)                                                 | Generate `*-system.yaml`, `*-datasource-*.yaml`; update `application.yaml`; reference `.yaml` in externalIntegration |
| [lib/validation/validator.js](lib/validation/validator.js)                                         | `loadVariablesYaml` – use `resolveApplicationConfigPath`                                                             |
| [lib/utils/paths.js](lib/utils/paths.js)                                                           | Add or host `resolveApplicationConfigPath`                                                                           |
| [lib/core/templates.js](lib/core/templates.js)                                                     | Templates emit `application.yaml`                                                                                    |
| [lib/app/run-helpers.js](lib/app/run-helpers.js)                                                   | Use `resolveApplicationConfigPath`; update `application.yaml` for version                                            |
| [lib/utils/image-version.js](lib/utils/image-version.js)                                           | `updateAppVersionInVariablesYaml` → `updateAppVersionInApplicationYaml`; update `application.yaml`                   |
| [lib/app/show.js](lib/app/show.js)                                                                 | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/app/deploy.js](lib/app/deploy.js)                                                             | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/app/register.js](lib/app/register.js)                                                         | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/app/config.js](lib/app/config.js)                                                             | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/app/helpers.js](lib/app/helpers.js)                                                           | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/app/deploy-config.js](lib/app/deploy-config.js)                                               | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/app/push.js](lib/app/push.js)                                                                 | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/app/dockerfile.js](lib/app/dockerfile.js)                                                     | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/app/index.js](lib/app/index.js)                                                               | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/build/index.js](lib/build/index.js)                                                           | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/core/secrets.js](lib/core/secrets.js)                                                         | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/core/secrets-docker-env.js](lib/core/secrets-docker-env.js)                                   | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/validation/validate.js](lib/validation/validate.js)                                           | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/commands/app.js](lib/commands/app.js)                                                         | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/commands/up-common.js](lib/commands/up-common.js)                                             | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/commands/up-miso.js](lib/commands/up-miso.js)                                                 | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/commands/up-dataplane.js](lib/commands/up-dataplane.js)                                       | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/commands/wizard-core.js](lib/commands/wizard-core.js)                                         | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/cli/setup-app.js](lib/cli/setup-app.js)                                                       | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/cli/setup-utility.js](lib/cli/setup-utility.js)                                               | Use `resolveApplicationConfigPath`; update split-json output docs                                                    |
| [lib/utils/app-register-config.js](lib/utils/app-register-config.js)                               | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/utils/app-register-validator.js](lib/utils/app-register-validator.js)                         | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/utils/app-register-api.js](lib/utils/app-register-api.js)                                     | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/utils/app-run-containers.js](lib/utils/app-run-containers.js)                                 | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/utils/cli-utils.js](lib/utils/cli-utils.js)                                                   | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/utils/env-copy.js](lib/utils/env-copy.js)                                                     | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/utils/port-resolver.js](lib/utils/port-resolver.js)                                           | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/utils/secrets-helpers.js](lib/utils/secrets-helpers.js)                                       | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/utils/secrets-utils.js](lib/utils/secrets-utils.js)                                           | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/utils/template-helpers.js](lib/utils/template-helpers.js)                                     | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/utils/dockerfile-utils.js](lib/utils/dockerfile-utils.js)                                     | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/utils/env-ports.js](lib/utils/env-ports.js)                                                   | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/utils/error-formatters/validation-errors.js](lib/utils/error-formatters/validation-errors.js) | Update error messages: `application.yaml` not `variables.yaml`                                                       |
| [lib/utils/error-formatter.js](lib/utils/error-formatter.js)                                       | Update error messages                                                                                                |
| [lib/utils/variable-transformer.js](lib/utils/variable-transformer.js)                             | Update JSDoc/comments: `application.yaml` not `variables.yaml`                                                       |
| [lib/generator/github.js](lib/generator/github.js)                                                 | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/external-system/test.js](lib/external-system/test.js)                                         | Use YAML for loadSystemFiles, loadDatasourceFiles                                                                    |
| [lib/external-system/generator.js](lib/external-system/generator.js)                               | Use `resolveApplicationConfigPath`; emit `.yaml`                                                                     |
| [lib/external-system/deploy-helpers.js](lib/external-system/deploy-helpers.js)                     | Use `resolveApplicationConfigPath`                                                                                   |
| [lib/api/wizard.api.js](lib/api/wizard.api.js)                                                     | Use `resolveApplicationConfigPath` if applicable                                                                     |


### 3.4 System/Datasource YAML Loading


| File                                                   | Change                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| [lib/generator/external.js](lib/generator/external.js) | `loadSystemFile` – use `yaml.load` for `.yaml` (or `.yml`); remove `JSON.parse`       |
| [lib/generator/external.js](lib/generator/external.js) | `loadDatasourceFiles` – use `yaml.load` for `.yaml` (or `.yml`); remove `JSON.parse`  |
| [lib/generator/external.js](lib/generator/external.js) | `resolveSystemFilePath` – default to `*-system.yaml`; resolve `.yaml` files           |
| [lib/generator/external.js](lib/generator/external.js) | `loadDatasourceFiles` – expect `.yaml` filenames from externalIntegration.dataSources |


### 3.5 System/Datasource YAML Writing


| File                                                                               | Change                                                                                                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [lib/generator/external.js](lib/generator/external.js)                             | `generateExternalSystemDeployJson` – write `*-system.yaml` if generating new                                                         |
| [lib/generator/external-schema-utils.js](lib/generator/external-schema-utils.js)   | `writeSplitExternalSchemaFiles` – write `*-system.yaml`, `*-datasource-*.yaml`; update `buildExternalVariables` to reference `.yaml` |
| [lib/generator/wizard.js](lib/generator/wizard.js)                                 | Generate `*-system.yaml`, `*-datasource-*.yaml`; reference `.yaml` in externalIntegration                                            |
| [lib/external-system/download.js](lib/external-system/download.js)                 | `generateSystemFile` – write `*-system.yaml` with `yaml.dump`                                                                        |
| [lib/external-system/download.js](lib/external-system/download.js)                 | `generateDatasourceFiles` – write `*-datasource-*.yaml` with `yaml.dump`                                                             |
| [lib/external-system/download.js](lib/external-system/download.js)                 | `generateConfigFiles` – write `application.yaml` (not variables.yaml)                                                                |
| [lib/external-system/download.js](lib/external-system/download.js)                 | `generateVariablesYaml` → `generateApplicationYaml` or keep name; write to `application.yaml`                                        |
| [lib/external-system/download.js](lib/external-system/download.js)                 | `moveFilesToFinalLocation` – move `*-system.yaml`, `*-datasource-*.yaml`                                                             |
| [lib/external-system/download-helpers.js](lib/external-system/download-helpers.js) | Update references to `application.yaml`, `.yaml` system/datasource files                                                             |


### 3.6 Validation (External Files)


| File                                                       | Change                                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [lib/validation/validate.js](lib/validation/validate.js)   | `validateExternalFile` – detect `.yaml`/`.yml`; use `yaml.load` then validate against schema     |
| [lib/validation/validate.js](lib/validation/validate.js)   | `resolveExternalFiles` – resolve `*-system.yaml`, `*-datasource-*.yaml` from externalIntegration |
| [lib/validation/validator.js](lib/validation/validator.js) | `validateExternalIntegrationBlock` – allow `.yaml` filenames in systems/dataSources              |


### 3.7 Templates


| File                                                               | Change                                         |
| ------------------------------------------------------------------ | ---------------------------------------------- |
| [templates/applications/*/variables.yaml](templates/applications/) | Rename to `application.yaml`                   |
| [lib/core/templates.js](lib/core/templates.js)                     | Emit `application.yaml`; update template paths |


### 3.8 Content Migration (Builder/Integration)


| Path                                            | Change                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `builder/dataplane/variables.yaml`              | Rename to `application.yaml`                                          |
| `builder/keycloak/variables.yaml`               | Rename to `application.yaml`                                          |
| `builder/miso-controller/variables.yaml`        | Rename to `application.yaml`                                          |
| `integration/hubspot/variables.yaml`            | Rename to `application.yaml`                                          |
| `integration/hubspot/hubspot-system.json`       | Convert to `hubspot-system.yaml`                                      |
| `integration/hubspot/hubspot-datasource-*.json` | Convert to `hubspot-datasource-*.yaml`                                |
| `integration/hubspot/variables.yaml`            | Update externalIntegration.systems to `hubspot-system.yaml`           |
| `integration/hubspot/variables.yaml`            | Update externalIntegration.dataSources to `hubspot-datasource-*.yaml` |


### 3.9 Documentation


| File                                                                                     | Change                                                                                       |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [docs/configuration/variables-yaml.md](docs/configuration/variables-yaml.md)             | Rename to `application-yaml.md`; update content                                              |
| [docs/configuration/README.md](docs/configuration/README.md)                             | Update links and references                                                                  |
| [docs/configuration/external-integration.md](docs/configuration/external-integration.md) | Update examples: `.yaml` filenames                                                           |
| [docs/commands/validation.md](docs/commands/validation.md)                               | Update all `variables.yaml` → `application.yaml`                                             |
| [docs/commands/utilities.md](docs/commands/utilities.md)                                 | Update split-json, json output descriptions                                                  |
| [docs/commands/deployment.md](docs/commands/deployment.md)                               | Update references                                                                            |
| [docs/commands/application-management.md](docs/commands/application-management.md)       | Update references                                                                            |
| [docs/commands/external-integration.md](docs/commands/external-integration.md)           | Update examples                                                                              |
| [docs/external-systems.md](docs/external-systems.md)                                     | Update all `*.json` → `*.yaml`                                                               |
| [docs/your-own-applications.md](docs/your-own-applications.md)                           | Update references                                                                            |
| [docs/README.md](docs/README.md)                                                         | Update index                                                                                 |
| [docs/configuration.md](docs/configuration.md)                                           | Update references                                                                            |
| [docs/deploying.md](docs/deploying.md)                                                   | Update references                                                                            |
| [docs/running.md](docs/running.md)                                                       | Update references                                                                            |
| [docs/building.md](docs/building.md)                                                     | Update references                                                                            |
| [docs/wizard.md](docs/wizard.md)                                                         | Update references                                                                            |
| [docs/developer-isolation.md](docs/developer-isolation.md)                               | Update references                                                                            |
| [docs/github-workflows.md](docs/github-workflows.md)                                     | Update references                                                                            |
| [docs/infrastructure.md](docs/infrastructure.md)                                         | Update references                                                                            |
| [integration/hubspot/README.md](integration/hubspot/README.md)                           | Update file names                                                                            |
| [integration/hubspot/QUICK_START.md](integration/hubspot/QUICK_START.md)                 | Update file names                                                                            |
| [integration/hubspot/create-hubspot.js](integration/hubspot/create-hubspot.js)           | Update log message                                                                           |
| All other docs                                                                           | Grep for `variables.yaml`, `hubspot-system.json`, `hubspot-datasource` → update to new names |


**Single version:** No backward-compatibility sections, no migration guides for old formats.

### 3.10 Tests


| File                                                                                                                 | Change                                                                                 |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| All tests in `tests/`                                                                                                | Replace `variables.yaml` paths with `application.yaml`                                 |
| All tests in `tests/`                                                                                                | Replace `*-system.json` mocks with `*-system.yaml`                                     |
| All tests in `tests/`                                                                                                | Replace `*-datasource-*.json` mocks with `*-datasource-*.yaml`                         |
| [tests/lib/generator/generator.test.js](tests/lib/generator/generator.test.js)                                       | Update paths, mock `resolveApplicationConfigPath`                                      |
| [tests/lib/generator/external-controller-manifest.test.js](tests/lib/generator/external-controller-manifest.test.js) | Update paths                                                                           |
| [tests/lib/validation/validator.test.js](tests/lib/validation/validator.test.js)                                     | Update paths and error messages                                                        |
| [tests/lib/validation/validate.test.js](tests/lib/validation/validate.test.js)                                       | Update paths                                                                           |
| [tests/lib/app/show.test.js](tests/lib/app/show.test.js)                                                             | Update paths                                                                           |
| [tests/integration/hubspot/hubspot-integration.test.js](tests/integration/hubspot/hubspot-integration.test.js)       | Update file names, assertions                                                          |
| Fixtures                                                                                                             | Create/update fixtures with `application.yaml`, `*-system.yaml`, `*-datasource-*.yaml` |


### 3.11 CLI


| File                                               | Change                         |
| -------------------------------------------------- | ------------------------------ |
| [lib/cli/index.js](lib/cli/index.js)               | Add `aifabrix convert` command |
| [lib/commands/convert.js](lib/commands/convert.js) | New: implement convert logic   |


---

## 4. `aifabrix convert` Implementation Details

**Logic:**

1. If `--all`: iterate over `builder/` and `integration/` subdirs.
2. If `<app>`: convert only that app folder.
3. For each app folder:
  - Rename `variables.yaml` → `application.yaml` (if variables.yaml exists, application.yaml does not).
  - For each `*-system.json`: `yaml.dump(JSON.parse(content))` → write `*-system.yaml`, delete `*.json`.
  - For each `*-datasource-*.json`: same.
  - Update `application.yaml` `externalIntegration.systems` and `externalIntegration.dataSources` to `.yaml` extensions.
4. Log what was converted.

**Removal:** After all developers have run it, delete the command and its implementation.

---

## 5. Execution Order

1. **Phase 1: Add resolver and convert**
  - Implement `resolveApplicationConfigPath`.
  - Implement `aifabrix convert`.
  - Run `aifabrix convert --all` on repo content.
2. **Phase 2: Switch code to application.yaml and YAML**
  - Update all loaders to use `resolveApplicationConfigPath`.
  - Update system/datasource loaders to use YAML.
  - Update writers to emit YAML.
3. **Phase 3: Update schemas, templates, docs, tests**
  - Schema patterns for `.yaml`.
  - Templates emit `application.yaml`.
  - Docs single-version.
  - Tests updated.
4. **Phase 4: Remove convert**
  - Delete `aifabrix convert` when no longer needed.

---

## 6. Summary


| Item               | Change                                                                      |
| ------------------ | --------------------------------------------------------------------------- |
| Application config | `variables.yaml` → `application.yaml` (rename via resolver or convert)      |
| System/datasource  | `*.json` → `*.yaml` (convert, then delete JSON)                             |
| Migration          | One function `resolveApplicationConfigPath`; one command `aifabrix convert` |
| Dual support       | None; single format after convert                                           |
| Documentation      | Single version, current only                                                |


---

---

## Plan Validation Report

**Date**: 2025-02-08
**Plan**: .cursor/plans/50-yaml_support_and_migration.plan.md
**Status**: ✅ VALIDATED

### Plan Purpose

YAML support and migration: rename `variables.yaml` to `application.yaml`; convert system/datasource files from JSON to YAML; single top-level `resolveApplicationConfigPath` function; one-time `aifabrix convert` command. Scope: CLI commands, generators, validation, templates, schemas, docs, tests. Plan type: Refactoring + Architecture.

### Applicable Rules

- ✅ [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) – Mandatory build, lint, test, coverage before commit
- ✅ [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) – File size, JSDoc
- ✅ [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development) – New `aifabrix convert` command
- ✅ [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns) – Generators/templates as source of truth
- ✅ [Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns) – Schema and YAML validation
- ✅ [Template Development](.cursor/rules/project-rules.mdc#template-development) – application.yaml templates
- ✅ [Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging) – try-catch, chalk
- ✅ [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) – Jest, coverage
- ✅ [Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) – No secrets in code

### Rule Compliance

- ✅ DoD Requirements: Documented (build → lint → test, validation order, file size, JSDoc)
- ✅ Quality Gates: Compliant
- ✅ Code Quality Standards: Compliant
- ✅ CLI Command Development: Compliant (convert command pattern)
- ✅ Architecture Patterns: Compliant (generator/template changes)
- ✅ Validation Patterns: Compliant (YAML load/dump, schema validation)

### Plan Updates Made

- ✅ Added Rules and Standards section with project-rules.mdc references
- ✅ Added Before Development checklist
- ✅ Added Definition of Done section with mandatory BUILD → LINT → TEST order
- ✅ Fixed truncated schema pattern in Section 3.2 (`^[^ ].+\.(yaml|yml)$`)

### Recommendations

- Consider adding `aifabrix convert` tests in Phase 1 (before removal) to verify conversion logic.
- When implementing `resolveApplicationConfigPath`, ensure it is sync (fs.existsSync, fs.renameSync) as noted in plan.
- Update project-rules.mdc "Generated Output" and "File Path Construction" examples to reference `application.yaml` after migration is complete.