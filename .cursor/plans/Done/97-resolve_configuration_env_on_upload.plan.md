---
name: Resolve configuration env on upload
overview: Resolve configuration on upload (variable → {{VAR}} from .env; keyvault → kv:// from secrets). On download, re-template configuration from env.template (if name matches, set value to {{name}}; else skip).
todos: []
isProject: false
---

# Resolve configuration section .env and kv:// on upload/deploy

## Current behavior

- **External system upload** ([lib/commands/upload.js](lib/commands/upload.js)): Builds payload from manifest via `buildUploadPayload(manifest)`. Pushes `kv://` refs from `.env` and from the payload to the dataplane credential store via `pushCredentialSecrets`. Sends the **unchanged** payload (with `configuration[].value` still containing `{{SHAREPOINT_SITE_ID}}` or `kv://...`) to the pipeline.
- **Datasource deploy** ([lib/datasource/deploy.js](lib/datasource/deploy.js)): Loads datasource JSON and publishes it as-is; no resolution of configuration values.
- **kv://** is already resolved for writing `.env` (e.g. `aifabrix resolve`) and is pushed to the dataplane for credentials; the **configuration** array in the upload payload is not resolved today.

## Goal

When uploading an external system or deploying a datasource, resolve the **configuration** section based on `**location`**:

1. `**location === "variable"`** — **Not** secret. Resolve only `{{VAR}}` from the integration’s .env (resolved env map). Do not treat as secret; do not resolve or push `kv://` for these entries.
2. `**location === "keyvault"`** — Same as secure variable. Resolve `kv://` from secrets (same as credential/secure variables); credential push already stores these on the dataplane.

The payload sent to the dataplane will contain **literal values** in `configuration`. Variable entries get env-backed values; keyvault entries get secret-backed values.

On **download**, when `env.template` exists: for each configuration entry with `location === 'variable'` whose `name` matches a variable in env.template, set `value` to `{{name}}` so the downloaded file stays template-based; if name does not match, leave value unchanged (skip).

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** — Build succeeds, lint and tests pass, file size and coverage requirements; mandatory for all plans.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** — Files ≤500 lines, functions ≤50 lines; JSDoc for all public functions.
- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** — New module in `lib/utils/`; CommonJS; fix behavior in generator/source, not only generated artifacts.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** — Upload/download flow changes; input validation, error handling, chalk for output.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** — Jest; tests in `tests/`; mock fs/secrets/API; 80%+ coverage for new code.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** — No logging of secrets; mask in error messages; use existing secret resolution.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** — try-catch for async; actionable errors; never expose secrets in messages.

**Key requirements**: JSDoc for new public functions; try-catch for async; path.join for paths; no secrets in logs or error text; tests for resolver and upload/download behavior; run build → lint → test before commit.

## Before Development

- Read Quality Gates and Code Quality Standards in project-rules.mdc.
- Review existing resolution flow in `lib/core/secrets.js` and `lib/utils/credential-secrets-env.js`.
- Review upload flow in `lib/commands/upload.js` and download flow in `lib/external-system/download.js`.
- Confirm error message wording for missing vars/secrets (no secret values in output).

## Definition of Done

Before marking this plan complete:

1. **Build**: Run `npm run build` first; it must succeed (runs lint + test:ci).
2. **Lint**: Run `npm run lint`; zero errors and zero warnings.
3. **Test**: Run `npm test` or `npm run test:ci` after lint; all tests pass; ≥80% coverage for new code.
4. **Validation order**: BUILD → LINT → TEST (do not skip steps).
5. **File size**: New/edited files ≤500 lines; functions ≤50 lines.
6. **JSDoc**: All new public functions have JSDoc (params, returns, throws, @fileoverview where applicable).
7. **Security**: No hardcoded secrets; no logging or exposure of secret values in errors.
8. **Tasks**: All implementation tasks and doc updates done; resolver, upload, and download behavior implemented and tested.

## Implementation

### 1. Resolved env map for integration app

Add a helper that returns a flat `{ VAR: value }` map for an integration app:

- **Input**: `systemKey` (e.g. `my-sharepoint`).
- **Logic**:
  - Integration path: `getIntegrationPath(systemKey)`.
  - If `integration/<systemKey>/.env` exists: read it and parse to a key–value map (reuse [parseEnvToMap](lib/utils/credential-secrets-env.js) from `credential-secrets-env.js`). If `.env` was produced by `aifabrix resolve`, values are already resolved (no `kv://` in values).
  - If `.env` does not exist: read `integration/<systemKey>/env.template`, load secrets via `loadSecrets(undefined, systemKey)` from [lib/core/secrets.js](lib/core/secrets.js), then call `resolveKvReferences(templateContent, secrets, 'local', ..., systemKey)` to get resolved env content, then parse that content with the same .env parser to get the map.
- **Output**: `Promise<{ envMap: Object, secrets: Object }>` so callers can use both for `{{VAR}}` substitution and for `kv://` resolution in configuration.

Place this in a small new module, e.g. `**lib/utils/configuration-env-resolver.js`**, to keep concerns separated and avoid bloating `credential-secrets-env.js` or `secrets.js`. It can depend on `getIntegrationPath`, `parseEnvToMap` (from credential-secrets-env), `loadSecrets`, `resolveKvReferences` (from core/secrets), and `loadEnvTemplate` (from secrets-helpers or generator/helpers).

### 2. Resolve configuration array values (location-aware)

In the same module (or alongside), add:

- **resolveConfigurationValues(configArray, envMap, secrets)** (mutates the array in place), **location-aware**:
  - For each item with a string `value`, branch on **item.location**:
    - **location === 'variable'** (non-secret): Resolve only `{{VAR}}` from envMap. Replace all `{{VAR}}` tokens with envMap[VAR]. Missing var → throw (e.g. “Missing configuration env var: VAR. Run 'aifabrix resolve ' or set VAR in .env.”). Do not resolve kv:// for variable entries; if value is kv://, treat as misconfiguration (error).
    - **location === 'keyvault'** (same as secure variable): Resolve kv:// from secrets via resolveKvValue(secrets, value). If null → throw. Do not substitute {{VAR}} for keyvault (value is expected to be a kv ref).
  - Only mutate `value`; leave name, location, portalInput unchanged. Regex `/\{\{([^}]+)\}\}/g` for {{VAR}}; use existing resolveKvValue for keyvault.

### 3. Wire into external system upload

In [lib/commands/upload.js](lib/commands/upload.js):

- After `payload = buildUploadPayload(manifest)` and before `pushAndLogCredentialSecrets`:
  - Call the new helper to get `{ envMap, secrets }` for `systemKey`.
  - If `payload.application.configuration` is a non-empty array, call `resolveConfigurationValues(payload.application.configuration, envMap, secrets)`.
  - For each object in `payload.dataSources` that has a `configuration` array, call `resolveConfigurationValues(ds.configuration, envMap, secrets)`.
- Keep the existing order: resolve configuration first, then push credential secrets, then `runUploadValidatePublish(payload)` so the payload sent to the pipeline has resolved configuration values.

### 4. Wire into datasource deploy (optional / if applicable)

In [lib/datasource/deploy.js](lib/datasource/deploy.js):

- After loading and validating the datasource config, if the datasource has a top-level `configuration` array (and the schema supports it for the deploy payload):
  - Resolve `systemKey` from `datasourceConfig.systemKey`.
  - Build `{ envMap, secrets }` for that `systemKey` (same helper as upload).
  - Call `resolveConfigurationValues(datasourceConfig.configuration, envMap, secrets)` before `publishDatasourceToDataplane`.
- If the published payload does not include a `configuration` array (e.g. dataplane only uses system-level configuration), this step can be skipped or done only when `datasourceConfig.configuration` is present.

### 5. Validation and errors

- **variable** (missing `{{VAR}}`): If envMap[VAR] is undefined, throw; suggest `aifabrix resolve <system-key>` or set VAR in .env.
- **keyvault** (unresolved `kv://`): If resolveKvValue(secrets, value) returns null, throw; suggest `aifabrix resolve <system-key>` and ensure the key exists in the secrets file.
- Do not log or expose secret values in error messages.

### 6. Documentation and tests

- **Docs**: In [docs/commands/external-integration.md](docs/commands/external-integration.md) or the upload/deploy section, state that configuration values are resolved from the integration’s `.env` (and `kv://` from secrets) before upload/deploy, and that `aifabrix resolve <system-key>` should be run if values are missing.
- **Tests**: Add unit tests for the new resolver module (build resolved env map from .env vs env.template; resolveConfigurationValues for `{{VAR}}` and `kv://`; missing var/secret throws). Add or extend an upload test in [tests/lib/commands/upload.test.js](tests/lib/commands/upload.test.js) (or equivalent) that verifies configuration values are resolved before the payload is sent (e.g. mock manifest with `{{VAR}}` and assert the payload passed to the pipeline has literals).

## Files to add

- **lib/utils/configuration-env-resolver.js**: `buildResolvedEnvMapForIntegration(systemKey)`, `resolveConfigurationValues(configArray, envMap, secrets)`, and (for download) `retemplateConfigurationFromEnvTemplate(configArray, envTemplatePath)` or equivalent that sets `value` to `{{name}}` when `name` is in env.template keys and `location === 'variable'`.

## Files to change

- **lib/commands/upload.js**: After building the payload, call the resolver and mutate `payload.application.configuration` and each `payload.dataSources[].configuration`.
- **lib/external-system/download.js**: After `splitDeployJson`, if `env.template` exists at integration path, call the re-templating helper on the system configuration and write the updated system (or deploy) file back.
- **lib/datasource/deploy.js**: If datasource config has `configuration`, resolve it before publish (using same helper and `systemKey` from config).
- **Docs**: See “Documentation to update” below.
- **Tests**: New tests for the resolver (build env map, resolveConfigurationValues, retemplate from env.template); update or add upload tests for resolution; add download test that after re-templating, config entries with name in env.template have value `{{name}}`.

## Order of operations (upload)

1. Validate, build manifest, build payload.
2. **Resolve configuration** (new): build env map + secrets for `systemKey`, resolve `application.configuration` and each `dataSources[].configuration`.
3. Push credential secrets (existing).
4. Call pipeline upload (existing).

No change to the credential push or pipeline API contract; only the payload’s configuration section is modified to contain resolved literals before send.

---

## Download: re-template configuration from env.template

When downloading from the server, the API may return **resolved** values in `configuration[].value` (e.g. `"123"`). To keep local files template-based and aligned with `env.template`, add a **re-templating** step on download.

### Behavior

- **When**: After `splitDeployJson` has run (so `env.template` and `*-system.json` exist under the integration path).
- **Input**: `env.template` (parsed to get variable names = keys) and the system configuration (from the split output, e.g. `*-system.json` or the in-memory system object).
- **Logic**: For each configuration item with `location === 'variable'`: if `item.name` **matches** a key present in `env.template` (e.g. `SHAREPOINT_SITE_ID`), set `item.value` to `{{item.name}}` (e.g. `"{{SHAREPOINT_SITE_ID}}"`). If `item.name` does **not** match any key in `env.template`, **skip** (leave `value` unchanged, keep server value).
- **Output**: Write the updated configuration back into the system file (or deploy JSON) so the downloaded artifact uses template placeholders where the name exists in env.template.

### Implementation notes

- Add a helper (e.g. in the same `configuration-env-resolver.js` or in download flow) that: parses `env.template` to a set of variable names; walks `configuration[]`; for each item with `location === 'variable'` and `item.name` in that set, sets `item.value = '{{' + item.name + '}}'`. Optionally restrict to `location === 'variable'` only so keyvault entries are not re-templated.
- Call this **after** `splitDeployJson` in [lib/external-system/download.js](lib/external-system/download.js): read the written system file (or the deploy JSON), apply re-templating using `env.template` at the integration path, then write the system file (or deploy JSON) back.
- If `env.template` is missing (e.g. first-time download), skip re-templating (leave values as returned by the server).

### Order of operations (download)

1. GET manifest from dataplane, validate, build deploy JSON, write deploy JSON, run `splitDeployJson`.
2. **Re-template** (new): If `env.template` exists at integration path, parse it for keys; for each `configuration` entry with `location === 'variable'` and `name` in those keys, set `value` to `{{name}}`; write updated system (or deploy) artifact back.
3. Existing steps (e.g. ensure placeholder secrets, convert to JSON if requested).

---

## Documentation to update

- **[docs/commands/external-integration.md](docs/commands/external-integration.md)** (or equivalent upload/download section):
  - **Upload**: State that configuration values are resolved before upload: `location: variable` → `{{VAR}}` from `.env`; `location: keyvault` → `kv://` from secrets. Recommend running `aifabrix resolve <system-key>` if values are missing.
  - **Download**: State that when `env.template` exists, configuration entries whose `name` matches a variable in `env.template` have their `value` set to `{{name}}` so the downloaded file stays template-based; other entries keep the server value.
- **[docs/configuration/validation-rules.md](docs/configuration/validation-rules.md)** or **[docs/configuration/README.md](docs/configuration/README.md)** (if they describe configuration or env.template): Mention that upload resolves `configuration` from .env/secrets and download re-templates `configuration` from env.template when present.
- **[docs/configuration/env-template.md](docs/configuration/env-template.md)**: Note that variable names in env.template align with `configuration[].name` for variable-location entries, and that download uses env.template to re-insert `{{VAR}}` placeholders in the system config when the name matches.

---

## Plan Validation Report

**Date**: 2025-03-08  
**Plan**: .cursor/plans/97-resolve_configuration_env_on_upload.plan.md  
**Status**: VALIDATED

### Plan Purpose

Resolve configuration section on upload (variable → `{{VAR}}` from .env; keyvault → `kv://` from secrets) and on download re-template configuration from env.template when `name` matches. Affects: upload command, download flow, datasource deploy, new `lib/utils/configuration-env-resolver.js`, and docs. Type: Development (CLI/modules) + Security (secret handling).

### Applicable Rules

- **Quality Gates** — Build, lint, test, file size, coverage, no secrets; mandatory.
- **Code Quality Standards** — File/function size limits, JSDoc; mandatory.
- **Architecture Patterns** — New module in lib/utils; CommonJS; fix at source.
- **CLI Command Development** — Upload/download changes; validation, errors, chalk.
- **Testing Conventions** — Jest, tests in tests/, mocks, 80%+ coverage.
- **Security & Compliance (ISO 27001)** — No logging of secrets; mask in errors.
- **Error Handling & Logging** — try-catch, actionable errors, no sensitive data in messages.

### Rule Compliance

- DoD requirements documented (build, lint, test, order BUILD → LINT → TEST, file size, JSDoc, security).
- Quality Gates and Code Quality Standards referenced in plan.
- Security: plan explicitly forbids logging/exposing secrets in error messages.
- Tests: plan requires unit tests for resolver and upload/download resolution/re-templating.

### Plan Updates Made

- Added **Rules and Standards** with links to project-rules.mdc (Quality Gates, Code Quality Standards, Architecture, CLI Command Development, Testing, Security, Error Handling).
- Added **Before Development** checklist (read rules, review secrets/credential flow, upload/download flow, error wording).
- Added **Definition of Done** (build first, lint, test, validation order, file size, JSDoc, security, all tasks).
- Appended this **Plan Validation Report**.

### Recommendations

- When implementing, mock `loadSecrets` and `resolveKvReferences` in resolver tests to avoid touching real secrets.
- Add a test that re-templating is skipped when env.template is missing (first-time download).
- Ensure error messages for missing `{{VAR}}` or unresolved `kv://` mention `aifabrix resolve <system-key>` without including secret values.

---

## Implementation Validation Report

**Date**: 2025-03-08  
**Plan**: .cursor/plans/97-resolve_configuration_env_on_upload.plan.md  
**Status**: COMPLETE

### Executive Summary

Implementation of plan 97 (Resolve configuration env on upload) has been validated. All required files exist, behavior matches the plan (upload resolution, download re-templating, datasource deploy resolution), tests cover the new resolver and upload flow, documentation is updated, and code quality checks pass with zero lint errors/warnings.

### Task Completion

- Plan uses implementation sections rather than checkboxes; all described work is done.
- **Resolved env map**: `buildResolvedEnvMapForIntegration(systemKey)` in `lib/utils/configuration-env-resolver.js` — complete.
- **Resolve configuration values**: `resolveConfigurationValues(configArray, envMap, secrets, systemKey)` — complete (variable + keyvault, errors without exposing secrets).
- **Upload wiring**: `resolvePayloadConfiguration` in upload.js, called after build payload, before credential push — complete.
- **Download re-templating**: `retemplateConfigurationForDownload`, `applyRetemplateToSystemFile` after `splitDeployJson` — complete.
- **Datasource deploy**: Configuration resolution when `datasourceConfig.configuration` present — complete.
- **Docs**: external-integration.md, env-template.md, validation-rules.md — complete.
- **Tests**: Resolver unit tests and upload test for configuration resolution — complete.

### File Existence Validation


| File                                               | Status                                                                                                                                                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lib/utils/configuration-env-resolver.js            | Exists (179 lines); exports buildResolvedEnvMapForIntegration, resolveConfigurationValues, getEnvTemplateVariableNames, retemplateConfigurationFromEnvTemplate, retemplateConfigurationForDownload, substituteVarPlaceholders |
| lib/commands/upload.js                             | Modified; resolvePayloadConfiguration, buildResolvedEnvMapForIntegration, resolveConfigurationValues used                                                                                                                     |
| lib/external-system/download.js                    | Modified; applyRetemplateToSystemFile, retemplateConfigurationForDownload used after splitDeployJson                                                                                                                          |
| lib/datasource/deploy.js                           | Modified; configuration resolution before publish when config has configuration array                                                                                                                                         |
| tests/lib/utils/configuration-env-resolver.test.js | Exists (212 lines); covers substituteVarPlaceholders, resolveConfigurationValues, getEnvTemplateVariableNames, retemplateConfigurationFromEnvTemplate, buildResolvedEnvMapForIntegration, retemplateConfigurationForDownload  |
| tests/lib/commands/upload.test.js                  | Modified; mocks configuration-env-resolver, test verifies configuration resolution before pipeline upload                                                                                                                     |
| docs/commands/external-integration.md              | Updated; upload process step 3 (configuration resolution), download process step 5 (re-templating)                                                                                                                            |
| docs/configuration/env-template.md                 | Updated; configuration alignment paragraph                                                                                                                                                                                    |
| docs/configuration/validation-rules.md             | Updated; upload/download resolution note                                                                                                                                                                                      |


### Test Coverage

- **Unit tests**: `tests/lib/utils/configuration-env-resolver.test.js` — buildResolvedEnvMapForIntegration (.env vs env.template, empty), resolveConfigurationValues (variable/keyvault, missing var/secret, variable with kv://), getEnvTemplateVariableNames, retemplateConfigurationFromEnvTemplate, retemplateConfigurationForDownload (env.template missing vs present).
- **Upload**: `tests/lib/commands/upload.test.js` — configuration resolver invoked, payload has resolved values when mock mutates.
- **Test run**: 237 suites passed, 5161 tests passed.

### Code Quality Validation


| Step              | Result                        |
| ----------------- | ----------------------------- |
| Format (lint:fix) | PASSED                        |
| Lint              | PASSED (0 errors, 0 warnings) |
| Tests             | PASSED (all tests pass)       |


### File Size and Standards

- lib/utils/configuration-env-resolver.js: 179 lines (≤500).
- lib/commands/upload.js: 219 lines.
- lib/external-system/download.js: 460 lines (≤500).
- lib/datasource/deploy.js: 262 lines.
- All new/edited files within line limits; JSDoc on public functions; path.join for paths.

### Cursor Rules Compliance


| Rule             | Status                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Code reuse       | Resolver uses parseEnvToMap, resolveKvValue from credential-secrets-env; loadSecrets, resolveKvReferences from core/secrets |
| Error handling   | throw new Error with actionable messages; no secret values in messages                                                      |
| Logging          | No logging of secrets; errors suggest aifabrix resolve without exposing values                                              |
| Type safety      | JSDoc @param, @returns, @throws on public functions; @fileoverview on module                                                |
| Async patterns   | async/await; loadSecrets, resolveKvReferences, getActualSecretsPath awaited                                                 |
| File operations  | path.join for paths; fs.readFileSync/fs.existsSync where used                                                               |
| Input validation | systemKey validated (required, string); config arrays checked before resolve                                                |
| Module patterns  | CommonJS require/module.exports                                                                                             |
| Security         | No hardcoded secrets; errors reference "configuration 'name'" or "keyvault reference", not values                           |


### Implementation Completeness

- **New module**: lib/utils/configuration-env-resolver.js — complete with all required functions.
- **Upload**: Configuration resolved before credential push and pipeline upload — complete.
- **Download**: Re-templating applied to system file when env.template exists — complete.
- **Datasource deploy**: Configuration resolved when present — complete.
- **Documentation**: Upload/download and env.template/validation-rules updated — complete.
- **Tests**: Resolver and upload resolution covered — complete.

### Final Validation Checklist

- All implementation tasks done (resolver, upload, download, datasource deploy, docs, tests)
- All mentioned files exist and contain expected behavior
- Tests exist for new resolver and upload configuration resolution; all tests pass
- Code quality: format and lint pass (0 errors, 0 warnings)
- Cursor rules compliance verified (error handling, no secrets in messages, JSDoc, path.join, CommonJS)
- Implementation complete

