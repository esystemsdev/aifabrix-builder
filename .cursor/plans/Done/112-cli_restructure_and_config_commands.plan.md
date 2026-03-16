---
name: CLI restructure and config commands
overview: "Plan covers: removing `dev config` (keep `dev set-id`), adding `--force` to up-platform/up-miso/up-dataplane with full clean of builder app dirs, renaming help categories and moving datasource to External Systems, folding auth config into auth with better docs, adding `secret set-secrets-file`, `dev set-env-config`, `dev set-home`, plus validation, tests, and documentation updates."
todos: []
isProject: false
---

# CLI Restructure, Config Commands, and Documentation

## Overview

This plan restructures CLI commands (remove `dev config`, fold `auth config` into `auth`), adds `--force` to up-platform/up-miso/up-dataplane with full clean of builder app dirs, renames help categories and moves datasource to External Systems, and adds new commands: `secret set-secrets-file`, `dev set-env-config`, `dev set-home`. It also covers validation, tests, and documentation updates.

**Plan type:** Development (CLI commands) + Refactoring + Documentation.  
**Affected areas:** CLI (lib/cli/, lib/commands/), config (lib/core/config.js, lib/utils/config-paths.js), help (lib/utils/help-builder.js), infrastructure (up-common, up-miso, up-dataplane), docs (docs/commands/, docs/configuration/), tests (tests/lib/).

---

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc). Applicable sections:

- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Mandatory checks before commit: build, lint, tests, coverage ≥80%, file size, JSDoc, no hardcoded secrets.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – Files ≤500 lines, functions ≤50 lines; JSDoc for all public functions; documentation requirements.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – Command pattern (validation, error handling, chalk), add commands in lib/cli/ and logic in lib/commands/, write tests.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Jest, tests in tests/, mock externals, success and error paths, 80%+ coverage for new code.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – try-catch for async, structured errors, chalk, never log secrets.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – No hardcoded secrets, validate inputs (paths, URLs), prevent path traversal (e.g. clean builder dirs only under builder root).
- **[Development Workflow](.cursor/rules/project-rules.mdc#development-workflow)** – Post-development: run build, lint, tests, coverage check.
- **[Code Style](.cursor/rules/project-rules.mdc#code-style)** – Input validation, path.join() for paths, meaningful error messages.

**Key requirements:**

- Use Commander.js command pattern with try-catch and `handleCommandError`; validate all inputs (paths, URLs).
- New/updated commands: input validation, JSDoc for public functions, tests in tests/ mirroring lib/ structure.
- `cleanBuilderAppDirs`: only remove dirs under builder root; validate paths to prevent path traversal.
- No secrets in logs or error messages; no hardcoded secrets in code.
- Run `npm run build` (then lint and test) before considering the work done.

---

## Before Development

- Read Quality Gates and CLI Command Development in project-rules.mdc.
- Review existing commands in lib/cli/setup-dev.js, setup-auth.js, setup-secrets.js, setup-infra.js for patterns.
- Review lib/commands/auth-config.js and lib/commands/up-common.js for error handling and config usage.
- Confirm open decisions (secrets-file name, dev show vs set-id for display, test/test-integration in Applications category) if needed.

---

## Definition of Done

Before marking this plan complete:

1. **Build:** Run `npm run build` first (must succeed; runs lint + test:ci).
2. **Lint:** Run `npm run lint` (must pass with zero errors/warnings).
3. **Test:** Run `npm test` or `npm run test:ci` after lint (all tests pass; ≥80% coverage for new code).
4. **Validation order:** BUILD → LINT → TEST (mandatory; do not skip steps).
5. **File size:** All touched files ≤500 lines; new functions ≤50 lines.
6. **JSDoc:** All new/changed public functions have JSDoc (params, returns, throws as applicable).
7. **Code quality:** Input validation, try-catch for async, path.join() for paths, chalk for CLI output.
8. **Security:** No hardcoded secrets; path validation for cleanBuilderAppDirs (no path traversal); no secrets in logs.
9. **Documentation:** docs/ updated for removed/renamed commands and new options/commands; auth and new secret/dev commands documented with examples.
10. **All plan tasks** (sections 1–8) completed and reflected in code, tests, and docs.

---

## 1. Remove `dev config` command

- **Current state:** [lib/cli/setup-dev.js](lib/cli/setup-dev.js) registers both `dev config` (with `--set-id`) and `dev set-id <id>`. They duplicate the same behavior for setting developer ID; `dev config` also shows config when no options are passed.
- **Change:** Remove the `dev config` command entirely. Keep only `dev set-id <id>` for setting developer ID. For "show configuration", either:
  - Have `dev set-id` with no args show current config (if Commander allows optional `<id>`), or
  - Add a small `dev show` or keep a single `dev` invocation that only displays config (no subcommand). Recommendation: make `dev set-id` the only way to set ID; add a `dev show` (or document running `dev set-id` with current id to see config) to display ports and config vars.
- **References to update:** All call sites that say "Run aifabrix dev config" → "Run aifabrix dev set-id " or "aifabrix dev show" (e.g. [lib/commands/dev-init.js](lib/commands/dev-init.js) line 344, [lib/commands/up-dataplane.js](lib/commands/up-dataplane.js), [lib/commands/auth-config.js](lib/commands/auth-config.js), docs, and tests). [tests/lib/cli.test.js](tests/lib/cli.test.js) has a full "dev config" describe block (lines 2626+): remove or refactor to "dev set-id" and any new "dev show" behavior.

## 2. New action: `--force` for up-platform, up-miso, up-dataplane

- **Behavior when `--force` is used:** Fully clean the builder app directory (or directories) used by the command, then run the existing flow so content is re-fetched from templates (e.g. [lib/commands/up-common.js](lib/commands/up-common.js) `ensureAppFromTemplate`).
- **Scope of "running folder":**
  - **up-platform:** builder/keycloak, builder/miso-controller, builder/dataplane (all three).
  - **up-miso:** builder/keycloak, builder/miso-controller.
  - **up-dataplane:** builder/dataplane.
- **Implementation:** Add a shared helper (e.g. in [lib/commands/up-common.js](lib/commands/up-common.js)) such as `cleanBuilderAppDirs(appNames: string[])` that removes or clears the builder subdirs for the given app names (using [lib/utils/paths.js](lib/utils/paths.js) `getBuilderPath` and respecting `AIFABRIX_BUILDER_DIR`). Add `--force` option to:
  - [lib/cli/setup-infra.js](lib/cli/setup-infra.js): `up-platform`, `up-miso`, `up-dataplane`.
  - In each handler, when `options.force` is true: call the clean helper for the relevant app(s), then run the existing logic (so `ensureAppFromTemplate` copies from templates again).
- **Safety:** Only remove/clear directories that are under the builder root (no path traversal); consider confirming the path is under `getBuilderPath('')` or similar.

## 3. Main help (`aifabrix -h`) and category renames

- **Category rename:** In [lib/utils/help-builder.js](lib/utils/help-builder.js), change category name from **"Application & Datasource Management"** to **"Application & Management"**.
- **Move datasource:** Remove `datasource` from the "Application & Management" category and add it to **"External Systems"**. So "Application & Management" will list: app, credential, deployment, service-user. "External Systems" will list: download, upload, delete, repair, test, test-integration, **datasource** (with description e.g. "Manage external data sources").
- **Top-level description:** Update the main program description in [bin/aifabrix.js](bin/aifabrix.js) to something like "Help and documentation" or "AI Fabrix Builder – Help and documentation" if that was the intent (current: "AI Fabrix Local Fabric & Deployment SDK").
- **Applications category – test / test-integration:** Your note said "delete here test  test-integration " and "add deleted them in application category". Interpreted as: **remove** `test` and `test-integration` from the **"Applications (Create & Develop)"** category so they only appear under **External Systems**. That would leave Applications with: create, wizard, build, run, shell, install, test-e2e, lint, logs, stop, dockerfile. Confirm whether you want `test` and `test-integration` removed from Applications (they are currently in both categories in the codebase: Applications has `test`, External Systems has `test` and `test-integration` – need to ensure the same command is not registered twice; today they may be the same command with different help grouping). If the same command is shared, help-builder only controls where they appear; remove them from the Applications category in CATEGORIES in help-builder.

## 4. Auth: remove `auth config` subcommand and move options to `auth`

- **Current state:** [lib/cli/setup-auth.js](lib/cli/setup-auth.js) has `auth` with subcommands `status` and `config`. `auth config` supports `--set-controller <url>` and `--set-environment <env>`.
- **Change:** Remove the `auth config` subcommand. Add `--set-controller <url>` and `--set-environment <env>` as options on the **parent `auth` command**. When the user runs `aifabrix auth --set-controller …` or `aifabrix auth --set-environment …`, run the same logic as current [lib/commands/auth-config.js](lib/commands/auth-config.js) `handleAuthConfig`. If only `aifabrix auth` is run (no options), show help or redirect to `auth status` (or show status by default).
- **Documentation:** Improve `aifabrix auth -h`: document that these options set default controller and environment in config; add short examples (e.g. set controller, set environment, set both). Update [docs/commands/authentication.md](docs/commands/authentication.md): remove "auth config" section, document `aifabrix auth --set-controller` and `--set-environment` with examples.
- **References:** Replace all "auth config" and "aifabrix auth config" in code and docs with "auth" and "aifabrix auth" (e.g. error messages in [lib/commands/up-dataplane.js](lib/commands/up-dataplane.js), [lib/commands/auth-config.js](lib/commands/auth-config.js), docs, tests).

## 5. New command: `aifabrix secret set-secrets-file <path>`

- **Purpose:** Set the `aifabrix-secrets` value in `~/.aifabrix/config.yaml` (or configured config file). Path can be a local file path or an https URL (for remote secrets).
- **Naming:** You asked for a better parameter name than "set-project-file". Suggested name: `**set-secrets-file`** (subcommand: `aifabrix secret set-secrets-file <path>`). Alternative: `set-file` under secret.
- **Implementation:** In [lib/cli/setup-secrets.js](lib/cli/setup-secrets.js) add subcommand `set-secrets-file <path>`. Handler: validate path (non-empty; if URL, allow https); call `config.setSecretsPath(path)` (or the existing setter for `aifabrix-secrets` in [lib/core/config.js](lib/core/config.js) – already `setSecretsPath`). [lib/utils/config-paths.js](lib/utils/config-paths.js) exposes setter via config; ensure config module exports it (already does via path config functions).
- **Docs:** Document in [docs/commands/utilities.md](docs/commands/utilities.md) and [docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md).

## 6. New command: `aifabrix dev set-env-config <filePath>`

- **Purpose:** Set the `aifabrix-env-config` value in config.yaml.
- **Implementation:** In [lib/cli/setup-dev.js](lib/cli/setup-dev.js) add `dev set-env-config <filePath>`. Handler: call `config.setAifabrixEnvConfigPath(filePath)` (from [lib/utils/config-paths.js](lib/utils/config-paths.js), exposed via [lib/core/config.js](lib/core/config.js)). Validate non-empty path.
- **Docs:** [docs/commands/developer-isolation.md](docs/commands/developer-isolation.md) and [docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md).

## 7. New command: `aifabrix dev set-home <path>`

- **Purpose:** Set the `aifabrix-home` value in config.yaml.
- **Implementation:** In [lib/cli/setup-dev.js](lib/cli/setup-dev.js) add `dev set-home <path>`. Handler: call `config.setAifabrixHomeOverride(path)` (same config/paths modules). Validate non-empty path.
- **Docs:** Same as above.

## 8. Validation, tests, and documentation

- **Validation:** Ensure new and changed commands validate inputs (path, URL format for set-secrets-file; non-empty paths for set-env-config and set-home). Use existing patterns (e.g. [lib/commands/auth-config.js](lib/commands/auth-config.js), [lib/commands/secrets-set.js](lib/commands/secrets-set.js)).
- **Tests:**
  - Remove or refactor tests that depend on `dev config` in [tests/lib/cli.test.js](tests/lib/cli.test.js); add tests for `dev set-id` and, if added, `dev show`.
  - Add tests for `auth` with `--set-controller` / `--set-environment` (refactor from [tests/lib/commands/auth-config.test.js](tests/lib/commands/auth-config.test.js) if it exists).
  - Add tests for `secret set-secrets-file`, `dev set-env-config`, `dev set-home` (config write + read back).
  - Add tests for `up-platform --force`, `up-miso --force`, `up-dataplane --force`: mock clean + ensureAppFromTemplate flow (clean called with correct app names; template copy invoked).
- **Documentation:** Update [docs/commands/README.md](docs/commands/README.md), [docs/commands/authentication.md](docs/commands/authentication.md), [docs/commands/utilities.md](docs/commands/utilities.md), [docs/commands/developer-isolation.md](docs/commands/developer-isolation.md), [docs/commands/infrastructure.md](docs/commands/infrastructure.md), and [docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md) to reflect removed/renamed commands and new options/commands. Replace every "auth config" reference with "auth" and the new options. Add examples for auth and for the new secret/dev config commands.

---

## Summary of files to touch


| Area               | Files                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Dev config removal | `lib/cli/setup-dev.js`, `lib/commands/dev-init.js`, tests (cli.test.js, etc.), docs                                             |
| --force clean      | `lib/commands/up-common.js`, `lib/cli/setup-infra.js`, `lib/commands/up-miso.js`, `lib/commands/up-dataplane.js`, tests         |
| Help/categories    | `lib/utils/help-builder.js`, `bin/aifabrix.js` (description)                                                                    |
| Auth               | `lib/cli/setup-auth.js`, `lib/commands/auth-config.js`, docs, tests, all "auth config" refs                                     |
| New commands       | `lib/cli/setup-secrets.js` (set-secrets-file), `lib/cli/setup-dev.js` (set-env-config, set-home), config usage already in place |
| Docs/tests         | Multiple docs under `docs/`, test files under `tests/`                                                                          |


## Open decisions

1. **Parameter name for secrets file:** Use `set-secrets-file` (recommended) or another name (e.g. `set-file`, `secrets-file`).
2. **After removing `dev config`:** Provide a dedicated "show config" via a `dev show` subcommand, or rely on `dev set-id <currentId>` to display config (and document that).
3. **Applications category:** Confirm that `test` and `test-integration` should be removed from "Applications (Create & Develop)" in the help so they only appear under "External Systems".

---

## Plan Validation Report

**Date:** 2025-03-16  
**Plan:** .cursor/plans/112-cli_restructure_and_config_commands.plan.md  
**Status:** VALIDATED

### Plan Purpose

CLI restructure and config commands: remove `dev config` (keep `dev set-id`), add `--force` to up-platform/up-miso/up-dataplane with full clean of builder app dirs, rename "Application & Datasource Management" to "Application & Management" and move datasource to External Systems, fold `auth config` into `auth` with options, add `secret set-secrets-file`, `dev set-env-config`, `dev set-home`, plus validation, tests, and documentation. **Scope:** CLI (lib/cli/, lib/commands/), config, help builder, infrastructure up-commands, docs, tests. **Type:** Development + Refactoring + Documentation.

### Applicable Rules

- **Quality Gates** – Mandatory checks (build, lint, test, coverage, file size, JSDoc, no secrets); referenced in Rules and Standards and Definition of Done.
- **Code Quality Standards** – File/function size limits, JSDoc; referenced.
- **CLI Command Development** – Command pattern, validation, tests; referenced.
- **Testing Conventions** – Jest, mocks, coverage; referenced.
- **Error Handling & Logging** – try-catch, chalk, no secrets in logs; referenced.
- **Security & Compliance** – Path validation, no path traversal for clean; referenced.
- **Development Workflow** – Post-dev build/lint/test; referenced in DoD.
- **Code Style** – Input validation, path.join; referenced.

### Rule Compliance

- DoD requirements: Documented (build first, then lint, then test; order BUILD → LINT → TEST; file size, JSDoc, security, all tasks).
- Quality Gates: Reflected in Definition of Done and Rules and Standards.
- CLI/Testing/Security/Error handling: Addressed in plan tasks and Rules and Standards.

### Plan Updates Made

- Added **Rules and Standards** section with links to project-rules.mdc and key requirements.
- Added **Before Development** checklist (read rules, review existing commands, confirm open decisions).
- Added **Definition of Done** with: build → lint → test order, file size, JSDoc, code quality, security, documentation, all tasks.
- Appended this **Plan Validation Report**.

### Recommendations

- Resolve the three open decisions before or during implementation (set-secrets-file name, dev show vs set-id for display, test/test-integration in Applications).
- When implementing `cleanBuilderAppDirs`, add a unit test that verifies path traversal is rejected (e.g. path outside builder root).
- After implementation, run `npm run build` and fix any lint or test failures before marking the plan complete.

