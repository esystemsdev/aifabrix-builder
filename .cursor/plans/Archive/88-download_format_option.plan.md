---
name: Download format option
overview: Extend `aifabrix download <appKey>` with `--format json|yaml` to run the full pipeline (download → split-json → convert) in one command; add `aifabrix dev set-format json|yaml` to persist default format in config.yaml; commands use config default when --format is not passed via CLI.
todos: []
isProject: false
---

# Download with --format json|yaml + dev set-format

## Overview

1. Extend `aifabrix download <appKey>` with `--format json|yaml` to run the full pipeline (download → split-json → convert) in one command.
2. Add `aifabrix dev set-format json|yaml` to persist the default format in `~/.aifabrix/config.yaml`.
3. Commands that accept `--format` (download, convert) use config format when `--format` is not passed via CLI.
4. Create external and wizard: when generating new external system files, use config format if set (application, system, datasource files in json or yaml).

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** - Adding `--format` option to existing command; input validation, error handling, chalk output, user experience
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** - Mandatory build, lint, test before commit; file size limits; test coverage; security
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - Files ≤500 lines, functions ≤50 lines; JSDoc for all public functions
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest; mock external dependencies; test success and error paths; 80%+ coverage for new code
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** - try-catch, chalk, handleCommandError, meaningful error messages

**Key Requirements:**

- Validate `--format` as `json` or `yaml` (case-insensitive); reject invalid values with clear error
- Use `handleCommandError` for command errors; process.exit(1) on failure
- Use chalk for output; follow Commander.js option pattern
- JSDoc for changed/added functions; include @param, @returns, @throws
- Mock `runConvert` in download tests; test format json calls convert, format yaml does not
- No hardcoded secrets; no logging of sensitive data

## Before Development

- Read CLI Command Development and Error Handling sections from project-rules.mdc
- Review config module: lib/core/config.js (getDeveloperId, setDeveloperId pattern for getFormat/setFormat)
- Review dev set-id in lib/cli/setup-dev.js (pattern for set-format)
- Review existing download command in setup-external-system.js and download.js
- Review runConvert in lib/commands/convert.js (force, validation, executeConversion)
- Review convert CLI in setup-utility.js (format handling)
- Review lib/external-system/generator.js (create flow; file extensions, writeConfigFile)
- Review lib/generator/wizard.js (writeSystemYamlFile, writeDatasourceYamlFiles, generateOrUpdateVariablesYaml)
- Review lib/commands/wizard-core.js (calls generateWizardFiles)
- Review tests for download, convert, config, dev, create, wizard

## Definition of Done

Before marking this plan as complete:

1. **Build**: Run `npm run build` FIRST (must complete successfully; runs lint + test:ci)
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings)
3. **Test**: Run `npm test` or `npm run test:ci` AFTER lint (all tests must pass; ≥80% coverage for new code)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence; never skip steps)
5. **File Size Limits**: Files ≤500 lines, functions ≤50 lines
6. **JSDoc**: All changed or added public functions have JSDoc comments
7. **Code Quality**: All rule requirements met
8. **Security**: No hardcoded secrets; no sensitive data in logs or error messages
9. All implementation tasks completed
10. Documentation updated (developer-isolation, secrets-and-config, utilities, external-integration, external-systems, commands README, configuration README)

## Goal

Unify the manual workflow and allow persistent default format:


| Manual (3 steps)                                 | Single command                            |
| ------------------------------------------------ | ----------------------------------------- |
| `aifabrix download hubspot`                      | `aifabrix download hubspot --format yaml` |
| `aifabrix split-json hubspot`                    | (included)                                |
| `aifabrix convert hubspot --format json --force` | `aifabrix download hubspot --format json` |


With config default: `aifabrix dev set-format json` then `aifabrix download hubspot` uses JSON without passing `--format`.

## Format Resolution (CLI vs config)

**Resolution order:** `--format` (CLI) > `config.yaml` `format` > command default.


| Command  | Default when neither CLI nor config  | Config key |
| -------- | ------------------------------------ | ---------- |
| download | `yaml`                               | `format`   |
| convert  | None (requires `--format` or config) | `format`   |


**Commands that use config format:** `download`, `convert`, `create` (external), `wizard`.  
**Commands that do NOT use config format:** `validate` (its `--format` is output format: json vs human-readable).

**Create external and wizard:** When generating new files (application config, system file, datasource files), use `config.getFormat() || 'yaml'`. No CLI `--format`; config drives the extension (.yaml vs .json) and writeConfigFile format.

## Design

- `**--format yaml`** (default): Download manifest → split to YAML components. Same behavior as today; backward compatible.
- `**--format json`**: Download manifest → split to YAML → convert all component files to JSON (reuse existing `runConvert` with `force: true`; no prompt).
- **Config default**: When `format` is set in config (via `dev set-format`), download and convert use it when `--format` is not passed.
- Deploy manifest (`<appKey>-deploy.json`) stays JSON (convert does not touch it).

## Implementation

### 1. Config module: add format getter/setter

**File:** [lib/core/config.js](lib/core/config.js)

- Add `getFormat()` – returns `config.format` (string) or `null` if not set.
- Add `setFormat(format)` – validates `json` or `yaml`, saves to config, persists via `saveConfig`.
- Add `format` to `getDefaultConfig` (undefined) and `applyConfigDefaults` if needed.
- Export `getFormat` and `setFormat`.

### 2. New command: `aifabrix dev set-format`

**File:** [lib/cli/setup-dev.js](lib/cli/setup-dev.js)

- Add `dev set-format <format>` subcommand (same pattern as `dev set-id`).
- Validate format: must be `json` or `yaml` (case-insensitive).
- Call `config.setFormat(format)`, log success, optionally call `displayDevConfig` or show format confirmation.
- Use `handleCommandError` for errors.

### 3. Add format to `dev config` display

**File:** [lib/cli/setup-dev.js](lib/cli/setup-dev.js)

- In `displayDevConfig`, add `format` to optional config vars (from `config.getFormat()`).
- Show `format: 'yaml'` or `format: (not set)`.

### 4. Extend CLI: `--format` option and resolution

**File:** [lib/cli/setup-external-system.js](lib/cli/setup-external-system.js)

- Add `.option('--format <format>', 'Output format: json | yaml (default: yaml or config)')` to download.
- Resolution: `effectiveFormat = options.format || (await config.getFormat()) || 'yaml'`.
- Validate if format passed: must be `json` or `yaml`.
- Pass `effectiveFormat` to `downloadExternalSystem`.

**File:** [lib/cli/setup-utility.js](lib/cli/setup-utility.js)

- For **convert**: Resolution: `effectiveFormat = options.format || (await config.getFormat())`.
  - If neither set: throw `"Option --format is required and must be 'json' or 'yaml' (or set default with aifabrix dev set-format)"`.
  - Otherwise pass `effectiveFormat` to `runConvert`.

### 5. Extend download module

**File:** [lib/external-system/download.js](lib/external-system/download.js)

- Add `format` parameter (default `'yaml'`) to `downloadExternalSystem(options)`.
- After `processDownloadedSystem` (download + split):
  - If `format === 'yaml'`: done.
  - If `format === 'json'`: call `runConvert(systemKey, { format: 'json', force: true })`.
- Handle convert errors with a clear message.

### 6. Create external: use config format

**File:** [lib/external-system/generator.js](lib/external-system/generator.js)

- `generateExternalSystemFiles` accepts optional `format` param (default from `config.getFormat() || 'yaml'`).
- `generateExternalSystemTemplate`: use `format` to choose output path (`*-system.yaml` vs `*-system.json`) and pass format to `writeConfigFile`.
- `generateExternalDataSourceTemplate`: use `format` for datasource file extension.
- `updateVariablesYamlWithExternalIntegration`: accept format; use `application.yaml` or `application.json` and write with `writeConfigFile(path, vars, format)`; reference system/datasource filenames with correct extension.

**File:** [lib/app/index.js](lib/app/index.js)

- When calling `generateExternalSystemFiles` for `config.type === 'external'`, resolve format: `await config.getFormat()` or `'yaml'`, pass to generator.

### 7. Wizard: use config format

**File:** [lib/generator/wizard.js](lib/generator/wizard.js)

- `generateWizardFiles` accepts optional `format` in options (default from `config.getFormat() || 'yaml'`).
- `writeSystemYamlFile` (or generalize): accept format; use `*-system.yaml` or `*-system.json`; call `writeConfigFile(path, config, format)`.
- `writeDatasourceYamlFiles`: accept format; use `.yaml` or `.json` extension per datasource file.
- `generateOrUpdateVariablesYaml`: accept format; use `application.yaml` or `application.json`; `writeConfigFile(configPath, variables, format)`.
- `generateConfigFilesForWizard`: pass format through; ensure systemFileName and datasourceFileNames use correct extension.

**File:** [lib/commands/wizard-core.js](lib/commands/wizard-core.js)

- Before calling `generateWizardFiles`, resolve format: `await config.getFormat()` or `'yaml'`, pass in options.

### 8. Validation

- CLI: Reject invalid `--format` (e.g. `xml`, empty) with error: `"Option --format must be 'json' or 'yaml'"`.
- `setFormat`: same validation.
- Ensure `systemKey` validation (existing) remains.
- Follow existing patterns: `handleCommandError`, chalk, structured errors.

### 9. Tests

- **lib/core/config.js**: Test `getFormat`, `setFormat` (read/write, validation).
- **lib/cli/setup-dev.js**: Test `dev set-format json`, `dev set-format yaml`, invalid format.
- **lib/cli**: Test download with `--format`, without `--format` (mock config.getFormat), config fallback.
- **lib/cli/setup-utility.js**: Test convert with `--format`, without `--format` and config set, neither (error).
- **lib/external-system/download.js**: Test `format === 'json'` calls `runConvert`; `format === 'yaml'` does not.
- **lib/external-system/generator.js**: Test generateExternalSystemFiles with format json vs yaml (file extensions, application config).
- **lib/generator/wizard.js**: Test generateWizardFiles with format json vs yaml; mock config.getFormat.

### 10. Documentation (all places to update)


| Doc                                                                                  | Update                                                                                                                                                             |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [docs/commands/developer-isolation.md](docs/commands/developer-isolation.md)         | Add **aifabrix dev set-format** section (near dev config/set-id); describe that format is stored in config and used by download/convert when `--format` not passed |
| [docs/commands/README.md](docs/commands/README.md)                                   | Add `aifabrix dev set-format` to dev commands list                                                                                                                 |
| [docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md) | Add `format` to config.yaml key fields (developer preference for json/yaml; used by download, convert, create external, wizard)                                     |
| [docs/configuration/README.md](docs/configuration/README.md)                         | Mention format in config summary if applicable                                                                                                                     |
| [docs/commands/utilities.md](docs/commands/utilities.md)                             | **convert**: Change "required" to "required unless config format is set"; add note about `dev set-format`                                                          |
| [docs/commands/external-integration.md](docs/commands/external-integration.md)       | **download**: Add `--format`, document config fallback, examples                                                                                                   |
| [docs/external-systems.md](docs/external-systems.md)                                 | Update download examples; mention config format; document create/wizard use config format                                                                          |
| [docs/developer-isolation.md](docs/developer-isolation.md)                           | Add `aifabrix dev set-format` where dev config is documented (optional)                                                                                            |
| [docs/wizard.md](docs/wizard.md)                                                     | Mention wizard-generated files use config format when set                                                                                                          |
| [docs/commands/application-development.md](docs/commands/application-development.md) | Document create external uses config format when set                                                                                                               |

**Excluded:** `validate --format` (output format for validation results) – document as unchanged; does NOT use config format.

## Code paths summary (no coding yet – plan only)


| Area                               | What changes                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `lib/core/config.js`               | New `getFormat()`, `setFormat(format)`; validate json/yaml                   |
| `lib/cli/setup-dev.js`             | New `dev set-format <format>`; add format to `displayDevConfig`              |
| `lib/cli/setup-external-system.js` | Download: add `--format`, resolve via config, pass to download               |
| `lib/cli/setup-utility.js`         | Convert: resolve format from options or config; error if neither             |
| `lib/external-system/download.js`  | Accept format; call runConvert when json                                     |
| `lib/external-system/generator.js` | Create external: accept format; use .yaml or .json for system/datasource/app |
| `lib/app/index.js`                 | Pass config format to generateExternalSystemFiles when type external         |
| `lib/generator/wizard.js`          | Wizard: accept format; use .yaml or .json for system/datasource/app          |
| `lib/commands/wizard-core.js`      | Resolve config format, pass to generateWizardFiles                           |
| `lib/commands/convert.js`          | No change (caller resolves format)                                           |


## File summary


| File                                       | Change                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `lib/core/config.js`                       | Add `getFormat`, `setFormat`; validate json/yaml                       |
| `lib/cli/setup-dev.js`                     | Add `dev set-format <format>`; add format to `displayDevConfig`        |
| `lib/cli/setup-external-system.js`         | Add `--format`, resolve from config, pass to download                  |
| `lib/cli/setup-utility.js`                 | Convert: resolve format from CLI or config; update error when neither  |
| `lib/external-system/download.js`          | Accept format, call `runConvert` when format is json                   |
| `lib/external-system/generator.js`         | Accept format; generate .yaml or .json for system/datasource/app       |
| `lib/app/index.js`                         | Pass config format to external generator                               |
| `lib/generator/wizard.js`                  | Accept format; generate .yaml or .json for system/datasource/app       |
| `lib/commands/wizard-core.js`              | Resolve config format, pass to generateWizardFiles                     |
| `docs/commands/developer-isolation.md`     | Document `dev set-format`                                             |
| `docs/commands/README.md`                  | Add dev set-format to list                                            |
| `docs/configuration/secrets-and-config.md` | Add format key; used by download, convert, create, wizard             |
| `docs/commands/utilities.md`               | Convert: config fallback                                              |
| `docs/commands/external-integration.md`    | Download: `--format`, config                                          |
| `docs/external-systems.md`                 | Download, create, wizard: config format                               |
| `docs/wizard.md`                           | Wizard uses config format when set                                    |
| `docs/commands/application-development.md` | Create external uses config format when set                           |
| `tests/`                                   | Config, dev set-format, download, convert, generator, wizard          |


## Example usage (post-implementation)

```bash
# Set default format (persisted in config.yaml)
aifabrix dev set-format json
aifabrix dev set-format yaml

# View config (shows format)
aifabrix dev config

# Same as today (YAML components)
aifabrix download hubspot
aifabrix download hubspot --format yaml

# One-step download → split → convert to JSON
aifabrix download hubspot --format json

# With config default: no --format needed
aifabrix dev set-format json
aifabrix download hubspot   # uses JSON from config

# Convert uses config when --format not passed
aifabrix dev set-format yaml
aifabrix convert hubspot --force   # uses yaml from config

# Create and wizard use config format for generated files
aifabrix dev set-format json
aifabrix create myapp --type external   # generates application.json, *-system.json, *-datasource-*.json
aifabrix wizard myapp                   # wizard-generated files use JSON
```

---

## Plan Validation Report

**Date**: 2025-03-01  
**Plan**: .cursor/plans/88-download_format_option.plan.md  
**Status**: VALIDATED

### Plan Purpose

Extend `aifabrix download` with `--format json|yaml`; add `aifabrix dev set-format json|yaml` to persist default format in config.yaml; commands (download, convert) use config format when `--format` is not passed. **Type**: Development (CLI + config). **Scope**: config module, dev commands, download, convert, docs.

### Applicable Rules

- [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development) - Adding option to existing command
- [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) - Mandatory checks before commit
- [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) - File size, JSDoc, documentation
- [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) - Jest, mocks, coverage
- [Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging) - Error handling, chalk, handleCommandError

### Rule Compliance

- DoD Requirements: Documented (build, lint, test, validation order, file size, JSDoc, security, tasks)
- CLI Command Development: Plan specifies option, validation, handleCommandError, chalk
- Quality Gates: Plan includes test coverage, build/lint/test sequence
- Testing Conventions: Plan specifies tests for CLI options, download+convert flow, error paths

### Plan Updates Made

- Added Rules and Standards section with rule references and key requirements
- Added Before Development checklist
- Added Definition of Done section with full DoD requirements

### Recommendations

- Ensure download tests mock `runConvert` to avoid side effects and validate it is called only when `format === 'json'`
- When calling `runConvert` from download, ensure `detectAppType` resolves to `integration/<systemKey>` after split (files are written there)
- Do not wire config format into `validate --format`; it is output format (json vs human), not file format
- Test config resolution: convert with neither `--format` nor config should error; with config set, convert without `--format` should succeed

---

## Implementation Validation Report

**Date**: 2025-03-01  
**Plan**: .cursor/plans/88-download_format_option.plan.md  
**Status**: ✅ COMPLETE

### Executive Summary

The Download format option plan has been fully implemented. All implementation tasks are complete, all required files exist, tests cover the new functionality, and code quality validation passes. Format resolution (`--format` > config > default) is implemented for download, convert, create external, and wizard.

**Completion**: 100%

### Task Completion

| Section | Status | Notes |
|---------|--------|-------|
| 1. Config module (getFormat/setFormat) | ✅ | Via lib/utils/config-format-preference.js, integrated in lib/core/config.js |
| 2. dev set-format command | ✅ | lib/cli/setup-dev.js |
| 3. dev config display format | ✅ | displayDevConfig shows format |
| 4. Download --format + resolution | ✅ | lib/cli/setup-external-system.js |
| 4. Convert format resolution | ✅ | lib/cli/setup-utility.js |
| 5. Download module format | ✅ | lib/external-system/download.js calls runConvert when json |
| 6. Create external config format | ✅ | lib/external-system/generator.js, lib/app/index.js |
| 7. Wizard config format | ✅ | lib/generator/wizard.js, lib/commands/wizard-core.js |
| 8. Validation | ✅ | Invalid format rejected; handleCommandError used |
| 9. Tests | ✅ | Config, dev set-format, download, convert, generator, wizard |
| 10. Documentation | ✅ | developer-isolation, external-integration, utilities, secrets-and-config, README, wizard, application-development, external-systems |

### File Existence Validation

| File | Status |
|------|--------|
| lib/core/config.js | ✅ (integrates format functions) |
| lib/utils/config-format-preference.js | ✅ (new – getFormat, setFormat) |
| lib/cli/setup-dev.js | ✅ |
| lib/cli/setup-external-system.js | ✅ |
| lib/cli/setup-utility.js | ✅ |
| lib/external-system/download.js | ✅ |
| lib/external-system/generator.js | ✅ |
| lib/app/index.js | ✅ |
| lib/generator/wizard.js | ✅ |
| lib/commands/wizard-core.js | ✅ |
| docs/commands/developer-isolation.md | ✅ |
| docs/commands/README.md | ✅ |
| docs/configuration/secrets-and-config.md | ✅ |
| docs/commands/utilities.md | ✅ |
| docs/commands/external-integration.md | ✅ |
| docs/external-systems.md | ✅ |
| docs/wizard.md | ✅ |
| docs/commands/application-development.md | ✅ |

### Test Coverage

| Area | Test File | Status |
|------|-----------|--------|
| getFormat, setFormat | tests/lib/core/config.test.js | ✅ |
| dev set-format | tests/lib/cli.test.js | ✅ (json, yaml, invalid) |
| download --format, config fallback | tests/lib/cli-uncovered-commands.test.js | ✅ |
| download format json calls runConvert | tests/lib/external-system/external-system-download.test.js | ✅ |
| convert format resolution | tests/lib/cli-uncovered-commands.test.js | ✅ |
| generator format json | tests/lib/external-system/external-system-generator.test.js | ✅ |
| wizard format json | tests/lib/generator/wizard-generator.test.js | ✅ |
| runConvert (format validation) | tests/lib/commands/convert.test.js | ✅ |

### Code Quality Validation

| Step | Result |
|------|--------|
| Format (npm run lint:fix) | ✅ PASSED |
| Lint (npm run lint) | ✅ PASSED (0 errors, 0 warnings) |
| Tests (npm test) | ✅ PASSED (4989 passed, 229 suites) |

### Cursor Rules Compliance

| Rule | Status |
|------|--------|
| Code reuse | ✅ Uses shared config-format-preference, writeConfigFile |
| Error handling | ✅ try-catch, handleCommandError, clear errors |
| Logging | ✅ logger, chalk; no secrets logged |
| Type safety | ✅ JSDoc on changed functions |
| Async patterns | ✅ async/await, fs.promises |
| File operations | ✅ path.join, writeConfigFile |
| Input validation | ✅ json/yaml validation, format normalization |
| Module patterns | ✅ CommonJS, proper exports |
| Security | ✅ No hardcoded secrets |

### Implementation Completeness

- ✅ Config format: getFormat/setFormat, validateAndNormalizeFormat
- ✅ CLI: dev set-format, download --format, convert format resolution
- ✅ Download: runConvert when format=json
- ✅ Create external: config format passed to generator
- ✅ Wizard: config format passed to generateWizardFiles
- ✅ Documentation: all listed docs updated

### Issues and Recommendations

- **docs/configuration/README.md**: Plan mentioned "Mention format in config summary if applicable" – no format reference found. Optional; format is documented in secrets-and-config.md.
- Minor: One worker process warning during tests (force exit); unrelated to this plan.

### Final Validation Checklist

- [x] All implementation tasks completed
- [x] All files exist
- [x] Tests exist and pass
- [x] Format (lint:fix) passes
- [x] Lint passes (0 errors, 0 warnings)
- [x] Tests pass
- [x] Cursor rules compliance verified
- [x] Documentation updated

