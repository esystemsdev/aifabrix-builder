---
name: YAML Support and Migration
overview: Support both YAML and JSON for config on disk. Rename variables.yaml to application.yaml/application.json. Config I/O via converter layer (yamlToJson, jsonToYaml). Inside the code use JSON object and JSON Schema only. Deployment manifest stays JSON. Optional `aifabrix convert` for one-time migration. Single-version documentation.
todos: []
isProject: false
---

# YAML Support and Migration Plan

## Overview

- **Product not in production** – no need for backward compatibility.
- **Single version documentation** – current only.
- **Config on disk:** Application config and system/datasource files can be **either YAML or JSON** (developer choice). **Deployment manifest is JSON only.**
- **Converter layer:** One place for format handling: `yamlToJson` (read) and `jsonToYaml` (write). All loaders use this layer; no format logic elsewhere.
- **Inside the code:** Only **JSON object** (plain JS object) and **JSON Schema** for validation. No dual code paths.

**Goal:** Developers can use YAML or JSON files on disk; the application converts at I/O and works with a single internal representation (object + schema).

---

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Mandatory checks before commit: build, lint, test, coverage ≥80%, no hardcoded secrets.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – Files ≤500 lines, functions ≤50 lines, JSDoc for all public functions.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – New `aifabrix convert` command follows Commander.js pattern, input validation, chalk output, tests.
- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** – Changes to builder/ or integration/ must target generators/templates (lib/core/templates.js, lib/generator/*), not generated artifacts.
- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** – JSON Schema validation of config object; YAML/JSON parsing only in converter layer (js-yaml + JSON.parse); validate before deployment.
- **[Template Development](.cursor/rules/project-rules.mdc#template-development)** – Templates emit application config via converter (default e.g. application.yaml); update Handlebars templates and generator context.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – try-catch for async, meaningful errors, chalk, no sensitive data in messages.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Tests in `tests/`, Jest, mock fs/paths, 80%+ coverage for new code.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – No secrets in code or logs; file operations use path.join().

**Key requirements:** Use `resolveApplicationConfigPath` as single entry point for config path; use config format converters (yamlToJson / jsonToYaml) at I/O only; all internal code uses JSON object and JSON Schema; JSDoc for all new/changed functions; BUILD → LINT → TEST before considering work complete.

---

## Before Development

- Read Architecture Patterns and Validation Patterns from project-rules.mdc.
- Review existing config loaders (lib/generator/helpers.js, lib/utils/paths.js) for patterns.
- Review lib/generator/external.js and lib/external-system/download.js for system/datasource flow.
- Understand YAML processing (js-yaml) and where to centralize it: one config format module (yamlToJson, jsonToYaml, loadConfigFile, writeConfigFile).
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
9. **Migration**: Config format converter and `resolveApplicationConfigPath` implemented; all loaders/writers use them; optional `aifabrix convert` and content migration as needed.
10. **Documentation**: Single-version docs updated; no backward-compatibility sections.

---

## 1. File Format Convention


| File                   | Before                      | After (allowed on disk)                                        |
| ---------------------- | --------------------------- | -------------------------------------------------------------- |
| Application config     | `variables.yaml`            | `application.yaml` **or** `application.json`                   |
| System definition      | `hubspot-system.json`       | `hubspot-system.yaml` **or** `hubspot-system.json`             |
| Datasource definitions | `hubspot-datasource-*.json` | `hubspot-datasource-*.yaml` **or** `hubspot-datasource-*.json` |
| RBAC                   | `rbac.yaml`                 | `rbac.yaml` (unchanged)                                        |
| Deployment manifest    | `hubspot-deploy.json`       | `hubspot-deploy.json` (unchanged; **JSON only**)               |


**Rule:** Config files (application, system, datasource) may be **YAML or JSON** on disk. **Deployment manifest is JSON only.** All config is read via the converter layer into a JSON object and validated with JSON Schema.

---

## 2. Migration Approach

### 2.1 Config Path Resolution – One Top-Level Function

**Function:** `resolveApplicationConfigPath(appPath)` (or equivalent)

**Logic:**

1. If `application.yaml` or `application.yml` exists in folder → return its path.
2. If `application.json` exists → return its path.
3. If neither, check for `variables.yaml`; if it exists → rename to `application.yaml`, return path.
4. If none exist → throw error.

**Location:** Central place (e.g. `lib/utils/paths.js` or new `lib/utils/app-config-resolver.js`).

**Sync/async:** Sync is sufficient (fs.existsSync, fs.renameSync). All callers use the returned path. Callers then **load** the file via the config format converter (see 2.2); they never parse raw content themselves.

### 2.2 Config Format Converter Layer

**Purpose:** Single place where YAML/JSON is converted to or from the internal JSON object. All config loaders and writers go through this layer; the rest of the code only sees objects and uses JSON Schema.

**Functions (e.g. in `lib/utils/config-format.js` or similar):**

- `**yamlToJson(content)**` – Parse YAML string → return plain JS object (same shape as JSON). Used when reading `.yaml` / `.yml` files.
- `**jsonToYaml(object)**` – Serialize JS object → YAML string. Used when writing human-editable config as YAML.
- `**loadConfigFile(path)**` (or equivalent) – Read file at path; by extension use `yamlToJson` or `JSON.parse`; return object. Single entry point for "read config file regardless of format."
- `**writeConfigFile(path, object, format)**` – Write object to path as YAML or JSON based on `format` or path extension.

**Rule:** No `yaml.load` / `JSON.parse` / `yaml.dump` / `JSON.stringify` for config outside this module. All validation (AJV, JSON Schema) operates on the object.

### 2.3 `aifabrix convert` Command

**Purpose:** Let users convert all config files in an app (or all apps) to a single format: **YAML or JSON**. User chooses the target format; the command rewrites all in-scope files to that format and updates references.

**Command:**

```text
aifabrix convert <app> [--type external] (--json | --yaml)
aifabrix convert --all (--json | --yaml)
```

**Options:**


| Option            | Description                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<app>`           | App name (folder under `builder/` or `integration/`). Omit when using `--all`.                                                                                            |
| `--all`           | Convert all apps in `builder/` and `integration/`.                                                                                                                        |
| `--type external` | Convert only **external integration** files (system and datasource definitions) in the given app(s). Application config (application.yaml/application.json) is unchanged. |
| `--json`          | Convert all in-scope files to **JSON** (write via converter as .json; update references).                                                                                 |
| `--yaml`          | Convert all in-scope files to **YAML** (write via converter as .yaml; update references).                                                                                 |


**Behavior:**

- **Without `--type external`:** For each app, convert application config and (if present) external system/datasource files to the chosen format. Legacy `variables.yaml` is renamed to `application.yaml` or `application.json` per `--yaml`/`--json`. Then all `*-system.*` and `*-datasource-*.*` are read via converter and rewritten to the chosen extension; application config’s `externalIntegration.systems` and `externalIntegration.dataSources` are updated to the new filenames.
- **With `--type external`:** Only external integration files are converted (system and datasource); application config file and its format are left as-is. References in application config are updated to the new system/datasource filenames.

**Scope:** `builder/` and `integration/` when using `--all`; otherwise the named `<app>` folder. User can convert all files in the referred format (either `--json` or `--yaml`).

---

## 3. What Needs to Change

### 3.1 New / Central Components


| Component                               | Purpose                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `resolveApplicationConfigPath(appPath)` | Returns path to application config file (application.yaml, application.json, or legacy)                                  |
| Config format converter                 | `yamlToJson`, `jsonToYaml`, `loadConfigFile`, `writeConfigFile` – single I/O boundary; e.g. `lib/utils/config-format.js` |
| `aifabrix convert` command              | Convert config files to user-chosen format: `aifabrix convert [--type external] (--json                                  |


### 3.2 Schema Changes


| File                                                                     | Change                                                                                                                                       |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [lib/schema/application-schema.json](lib/schema/application-schema.json) | `externalIntegration.systems` and `externalIntegration.dataSources` items: allow both `.yaml`/`.yml` and `.json` (e.g. pattern `^[^ ].+(yaml |


**Note:** Schema validates the **object** (after load via converter). File references in that object may point to either `.yaml` or `.json` system/datasource files.

### 3.3 Config Loading (application config)

**Principle:** Resolve path with `resolveApplicationConfigPath`; load content with config format converter (`loadConfigFile` or equivalent). Callers receive **JSON object**; validate with JSON Schema.


| File                                                                                               | Change                                                                                            |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [lib/generator/helpers.js](lib/generator/helpers.js)                                               | `loadVariables` – accept path; use converter `loadConfigFile(path)` to get object                 |
| [lib/generator/index.js](lib/generator/index.js)                                                   | Use `resolveApplicationConfigPath`; load via converter; pass object to loaders                    |
| [lib/generator/external-controller-manifest.js](lib/generator/external-controller-manifest.js)     | Use resolver + converter; work with config object                                                 |
| [lib/generator/external.js](lib/generator/external.js)                                             | Use resolver + converter; resolve system/datasource paths from variables (`.yaml` or `.json`)     |
| [lib/generator/builders.js](lib/generator/builders.js)                                             | Use resolver + converter; reference application config object                                     |
| [lib/generator/split.js](lib/generator/split.js)                                                   | Write application config via converter (`application.yaml` or `application.json` per convention)  |
| [lib/generator/external-schema-utils.js](lib/generator/external-schema-utils.js)                   | Write application config via converter; systems/dataSources may reference `.yaml` or `.json`      |
| [lib/generator/wizard.js](lib/generator/wizard.js)                                                 | Generate system/datasource as YAML or JSON via converter; update application config object        |
| [lib/validation/validator.js](lib/validation/validator.js)                                         | Load config via `resolveApplicationConfigPath` + converter; validate object with JSON Schema      |
| [lib/utils/paths.js](lib/utils/paths.js)                                                           | Add or host `resolveApplicationConfigPath`                                                        |
| [lib/core/templates.js](lib/core/templates.js)                                                     | Templates emit application config (default e.g. `application.yaml` via converter)                 |
| [lib/app/run-helpers.js](lib/app/run-helpers.js)                                                   | Use resolver + converter; update config object then write via converter                           |
| [lib/utils/image-version.js](lib/utils/image-version.js)                                           | `updateAppVersionInVariablesYaml` → `updateAppVersionInApplicationYaml`; read/write via converter |
| [lib/app/show.js](lib/app/show.js)                                                                 | Use resolver + converter                                                                          |
| [lib/app/deploy.js](lib/app/deploy.js)                                                             | Use resolver + converter                                                                          |
| [lib/app/register.js](lib/app/register.js)                                                         | Use resolver + converter                                                                          |
| [lib/app/config.js](lib/app/config.js)                                                             | Use resolver + converter                                                                          |
| [lib/app/helpers.js](lib/app/helpers.js)                                                           | Use resolver + converter                                                                          |
| [lib/app/deploy-config.js](lib/app/deploy-config.js)                                               | Use resolver + converter                                                                          |
| [lib/app/push.js](lib/app/push.js)                                                                 | Use resolver + converter                                                                          |
| [lib/app/dockerfile.js](lib/app/dockerfile.js)                                                     | Use resolver + converter                                                                          |
| [lib/app/index.js](lib/app/index.js)                                                               | Use resolver + converter                                                                          |
| [lib/build/index.js](lib/build/index.js)                                                           | Use resolver + converter                                                                          |
| [lib/core/secrets.js](lib/core/secrets.js)                                                         | Use resolver + converter                                                                          |
| [lib/core/secrets-docker-env.js](lib/core/secrets-docker-env.js)                                   | Use resolver + converter                                                                          |
| [lib/validation/validate.js](lib/validation/validate.js)                                           | Use resolver + converter                                                                          |
| [lib/commands/app.js](lib/commands/app.js)                                                         | Use resolver + converter                                                                          |
| [lib/commands/up-common.js](lib/commands/up-common.js)                                             | Use resolver + converter                                                                          |
| [lib/commands/up-miso.js](lib/commands/up-miso.js)                                                 | Use resolver + converter                                                                          |
| [lib/commands/up-dataplane.js](lib/commands/up-dataplane.js)                                       | Use resolver + converter                                                                          |
| [lib/commands/wizard-core.js](lib/commands/wizard-core.js)                                         | Use resolver + converter                                                                          |
| [lib/cli/setup-app.js](lib/cli/setup-app.js)                                                       | Use resolver + converter                                                                          |
| [lib/cli/setup-utility.js](lib/cli/setup-utility.js)                                               | Use resolver + converter; update split-json output docs                                           |
| [lib/utils/app-register-config.js](lib/utils/app-register-config.js)                               | Use resolver + converter                                                                          |
| [lib/utils/app-register-validator.js](lib/utils/app-register-validator.js)                         | Use resolver + converter                                                                          |
| [lib/utils/app-register-api.js](lib/utils/app-register-api.js)                                     | Use resolver + converter                                                                          |
| [lib/utils/app-run-containers.js](lib/utils/app-run-containers.js)                                 | Use resolver + converter                                                                          |
| [lib/utils/cli-utils.js](lib/utils/cli-utils.js)                                                   | Use resolver + converter                                                                          |
| [lib/utils/env-copy.js](lib/utils/env-copy.js)                                                     | Use resolver + converter                                                                          |
| [lib/utils/port-resolver.js](lib/utils/port-resolver.js)                                           | Use resolver + converter                                                                          |
| [lib/utils/secrets-helpers.js](lib/utils/secrets-helpers.js)                                       | Use resolver + converter                                                                          |
| [lib/utils/secrets-utils.js](lib/utils/secrets-utils.js)                                           | Use resolver + converter                                                                          |
| [lib/utils/template-helpers.js](lib/utils/template-helpers.js)                                     | Use resolver + converter                                                                          |
| [lib/utils/dockerfile-utils.js](lib/utils/dockerfile-utils.js)                                     | Use resolver + converter                                                                          |
| [lib/utils/env-ports.js](lib/utils/env-ports.js)                                                   | Use resolver + converter                                                                          |
| [lib/utils/error-formatters/validation-errors.js](lib/utils/error-formatters/validation-errors.js) | Update error messages: application config (application.yaml / application.json)                   |
| [lib/utils/error-formatter.js](lib/utils/error-formatter.js)                                       | Update error messages                                                                             |
| [lib/utils/variable-transformer.js](lib/utils/variable-transformer.js)                             | Update JSDoc/comments: application config not variables.yaml                                      |
| [lib/generator/github.js](lib/generator/github.js)                                                 | Use resolver + converter                                                                          |
| [lib/external-system/test.js](lib/external-system/test.js)                                         | Load system/datasource via converter (fixtures can be .yaml or .json)                             |
| [lib/external-system/generator.js](lib/external-system/generator.js)                               | Use resolver + converter; emit config via converter (YAML or JSON)                                |
| [lib/external-system/deploy-helpers.js](lib/external-system/deploy-helpers.js)                     | Use resolver + converter                                                                          |
| [lib/api/wizard.api.js](lib/api/wizard.api.js)                                                     | Use resolver + converter if applicable                                                            |


### 3.4 System/Datasource Config Loading

**Principle:** Resolve paths for `*-system` and `*-datasource-*` files (extension `.yaml`, `.yml`, or `.json`). Load via config format converter; return object. Validate with JSON Schema.


| File                                                   | Change                                                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| [lib/generator/external.js](lib/generator/external.js) | `loadSystemFile` – use converter `loadConfigFile(path)`; path may be `.yaml` or `.json`                                       |
| [lib/generator/external.js](lib/generator/external.js) | `loadDatasourceFiles` – use converter for each file; accept `.yaml` or `.json` filenames from externalIntegration.dataSources |
| [lib/generator/external.js](lib/generator/external.js) | `resolveSystemFilePath` – resolve `*-system.yaml`, `*-system.json` (and .yml); prefer one convention if both exist            |
| [lib/generator/external.js](lib/generator/external.js) | All loaders return **object**; no raw YAML/JSON handling outside converter                                                    |


### 3.5 System/Datasource Config Writing

**Principle:** Write config objects via converter (`writeConfigFile` or `jsonToYaml` / `JSON.stringify`). Default for human-editable files may be YAML; filenames may be `.yaml` or `.json` per convention.


| File                                                                               | Change                                                                                                                       |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [lib/generator/external.js](lib/generator/external.js)                             | `generateExternalSystemDeployJson` – write system/datasource via converter (e.g. `*-system.yaml` or `.json`)                 |
| [lib/generator/external-schema-utils.js](lib/generator/external-schema-utils.js)   | `writeSplitExternalSchemaFiles` – write via converter; reference `.yaml` or `.json` in buildExternalVariables per convention |
| [lib/generator/wizard.js](lib/generator/wizard.js)                                 | Generate system/datasource files via converter; reference in externalIntegration                                             |
| [lib/external-system/download.js](lib/external-system/download.js)                 | `generateSystemFile` – write via converter (e.g. `jsonToYaml` for `.yaml`)                                                   |
| [lib/external-system/download.js](lib/external-system/download.js)                 | `generateDatasourceFiles` – write via converter                                                                              |
| [lib/external-system/download.js](lib/external-system/download.js)                 | `generateConfigFiles` – write application config via converter (`application.yaml` or `application.json`)                    |
| [lib/external-system/download.js](lib/external-system/download.js)                 | `generateVariablesYaml` → `generateApplicationYaml` or equivalent; write to application config file via converter            |
| [lib/external-system/download.js](lib/external-system/download.js)                 | `moveFilesToFinalLocation` – move generated `.yaml` or `.json` config files                                                  |
| [lib/external-system/download-helpers.js](lib/external-system/download-helpers.js) | Update references to application config and system/datasource file extensions (.yaml or .json)                               |


### 3.6 Validation (External Files)

**Principle:** Load file via converter (YAML or JSON by extension) to get object; validate object with JSON Schema. No format-specific validation logic.


| File                                                       | Change                                                                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [lib/validation/validate.js](lib/validation/validate.js)   | `validateExternalFile` – load via converter (`loadConfigFile`); validate returned object against schema                    |
| [lib/validation/validate.js](lib/validation/validate.js)   | `resolveExternalFiles` – resolve `*-system` and `*-datasource-*` with `.yaml`, `.yml`, or `.json` from externalIntegration |
| [lib/validation/validator.js](lib/validation/validator.js) | `validateExternalIntegrationBlock` – allow `.yaml` and `.json` filenames in systems/dataSources                            |


### 3.7 Templates


| File                                                               | Change                                                            |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| [templates/applications/*/variables.yaml](templates/applications/) | Rename to `application.yaml` (or provide both; default YAML)      |
| [lib/core/templates.js](lib/core/templates.js)                     | Emit application config via converter; default `application.yaml` |


### 3.8 Content Migration (Builder/Integration)

**Optional:** Run `aifabrix convert` to rename `variables.yaml` → `application.yaml` and optionally convert `*-system.json` / `*-datasource-*.json` to `.yaml`. After migration, code still accepts both `.yaml` and `.json` via converter.


| Path                                            | Change                                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `builder/*/variables.yaml`                      | Rename to `application.yaml` (or `application.json`)                                            |
| `integration/hubspot/variables.yaml`            | Rename to `application.yaml` (or `application.json`)                                            |
| `integration/hubspot/hubspot-system.json`       | Optional: convert to `hubspot-system.yaml` via convert command                                  |
| `integration/hubspot/hubspot-datasource-*.json` | Optional: convert to `hubspot-datasource-*.yaml`                                                |
| application config                              | Update externalIntegration.systems / dataSources to reference actual filenames (.yaml or .json) |


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
| [docs/external-systems.md](docs/external-systems.md)                                     | Document config files as `.yaml` or `.json`; deployment manifest JSON only                   |
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


**Single version:** No backward-compatibility sections. Document that application and system/datasource config may be YAML or JSON; deployment manifest is JSON only; config is loaded via converter and validated with JSON Schema.

### 3.10 Tests


| File                                                                                                                 | Change                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| All tests in `tests/`                                                                                                | Use `resolveApplicationConfigPath`; load via converter (or mock converter to return object)                                                          |
| All tests in `tests/`                                                                                                | Fixtures may use `application.yaml` or `application.json`; system/datasource `.yaml` or `.json`                                                      |
| [tests/lib/generator/generator.test.js](tests/lib/generator/generator.test.js)                                       | Update paths, mock `resolveApplicationConfigPath` and converter                                                                                      |
| [tests/lib/generator/external-controller-manifest.test.js](tests/lib/generator/external-controller-manifest.test.js) | Update paths; use converter for load                                                                                                                 |
| [tests/lib/validation/validator.test.js](tests/lib/validation/validator.test.js)                                     | Update paths and error messages; validate object from converter                                                                                      |
| [tests/lib/validation/validate.test.js](tests/lib/validation/validate.test.js)                                       | Update paths; test both .yaml and .json loading via converter                                                                                        |
| [tests/lib/app/show.test.js](tests/lib/app/show.test.js)                                                             | Update paths                                                                                                                                         |
| [tests/integration/hubspot/hubspot-integration.test.js](tests/integration/hubspot/hubspot-integration.test.js)       | Update file names, assertions; support .yaml or .json fixtures                                                                                       |
| Fixtures                                                                                                             | Create/update with application config and system/datasource files (.yaml or .json); add tests for converter (yamlToJson, jsonToYaml, loadConfigFile) |


### 3.11 CLI


| File                                               | Change                                                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [lib/cli/index.js](lib/cli/index.js)               | Add `aifabrix convert [] [--type external] --json                                                                                                       |
| [lib/commands/convert.js](lib/commands/convert.js) | New: implement convert logic (scope by app or --all; optional --type external; target format --json/--yaml); use config format converter for read/write |


---

## 4. `aifabrix convert` Implementation Details

**Inputs:**

- One of: `<app>` or `--all`.
- Exactly one of: `--json` or `--yaml` (target format for all in-scope files).
- Optional: `--type external` (only external system/datasource files; leave application config as-is except for updating references).

**Logic:**

1. **Resolve scope:** If `--all`, list app folders in `builder/` and `integration/`. If `<app>`, use that single app path (resolve under builder/ or integration/).
2. **For each app in scope:**
  - **Application config (when not `--type external`):** If legacy `variables.yaml` exists and no application config yet, rename to `application.yaml` or `application.json` per `--yaml`/`--json`. If application config already exists in the other format, load via converter, write to the target format (and rename file if extension changes), update any references.
  - **External only (when `--type external`)** or **full convert:** For each `*-system.*` and `*-datasource-*.*` (any of .yaml, .yml, .json), load via converter, write to target format with correct new extension (e.g. `--yaml` → `.yaml`), remove old file if extension changed. Update application config’s `externalIntegration.systems` and `externalIntegration.dataSources` to the new filenames; if not `--type external`, write application config in target format as well.
3. **Log:** Report which files were converted and to which format.

**Implementation:** Use config format converter for all read/write; no raw yaml.load/JSON.parse outside converter. Validate after load if desired; write only config files (never deployment manifest).

---

## 5. Execution Order

1. **Phase 1: Add config format converter and resolver**
  - Implement config format converter (`yamlToJson`, `jsonToYaml`, `loadConfigFile`, `writeConfigFile`) in one module (e.g. `lib/utils/config-format.js`).
  - Implement `resolveApplicationConfigPath` (returns path to application.yaml, application.json, or renames variables.yaml).
  - Add tests for converter and resolver.
2. **Phase 2: Switch all config loaders to resolver + converter**
  - All call sites use `resolveApplicationConfigPath` then load via converter (or a single “resolve and load” helper that returns object).
  - System/datasource loaders use converter by file extension; return object; validate with JSON Schema.
  - Writers use converter to write application and system/datasource config (YAML or JSON per convention).
3. **Phase 3: Update schemas, templates, docs, tests**
  - Schema patterns allow `.yaml`, `.yml`, `.json` for config file references.
  - Templates emit application config via converter (default e.g. application.yaml).
  - Docs: config may be YAML or JSON; deployment manifest JSON only; converter at I/O, object + schema inside.
  - Tests updated; fixtures may be .yaml or .json; test converter.
4. **Phase 4: Convert command**
  - Implement `aifabrix convert <app> [--type external] (--json | --yaml)` and `aifabrix convert --all (--json | --yaml)`. User chooses target format; convert all in-scope files to that format and update references.
  - Run convert on repo as needed; command remains available for teams to standardize on YAML or JSON.

---

## 6. Summary


| Item            | Change                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| Config on disk  | Application and system/datasource: **YAML or JSON** (developer choice). Deployment manifest: **JSON only**.       |
| Converter layer | `yamlToJson`, `jsonToYaml`, `loadConfigFile`, `writeConfigFile` – single I/O boundary; no format logic elsewhere. |
| Inside code     | **JSON object** only; validate with **JSON Schema**.                                                              |
| Path resolution | `resolveApplicationConfigPath` returns path to application.yaml, application.json, or renames variables.yaml.     |
| Convert command | `aifabrix convert [--type external] --json                                                                        |
| Documentation   | Single version; document dual format (YAML/JSON) for config, JSON only for deploy manifest.                       |


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

