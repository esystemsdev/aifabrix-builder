---
name: AIFABRIX_HOME WORK register + print
overview: Add **`aifabrix-work`** in `config.yaml` (repo/workspace root, independent of **`aifabrix-home`**). Expose **`AIFABRIX_WORK`** in the user environment on Windows and macOS/Linux when set via **`aifabrix dev set-work`**, alongside existing plan for **`AIFABRIX_HOME`** registration after **`dev set-home`**. Optional **`dev print-home`** / **`dev print-work`** for scripts; update Builder and configuration docs that list config keys or dev commands.
todos:
  - id: config-work-key
    content: Add aifabrix-work get/set in config-paths + core config; paths.getAifabrixWork() with AIFABRIX_WORK env → yaml → null (no default unless product decides)
    status: completed
  - id: cli-set-work-show
    content: dev set-work <path> (+ --no-register-env); dev show lists aifabrix-work + optional resolved; print-home + print-work stdout-only
    status: completed
  - id: register-env-both
    content: Shared register module sets/clears User AIFABRIX_HOME + AIFABRIX_WORK on win32; single managed POSIX env file exports both; profile block sources it; hook set-home + set-work
    status: completed
  - id: tests
    content: Unit tests for getAifabrixWork, set-work, registration mocks
    status: completed
  - id: docs-builder
    content: Update secrets-and-config.md, developer-isolation.md, commands/README.md, commands/reference.md as listed in plan
    status: completed
  - id: docs-configuration-repo
    content: Optional one-line updates to Setup-developer.md / README.md example keys if we document aifabrix-work for container/workspace layouts
    status: cancelled
isProject: false
---

# `aifabrix-work` + `AIFABRIX_WORK`, and `AIFABRIX_HOME` registration

## Overview

Extend the AI Fabrix Builder CLI so `config.yaml` can store an optional `**aifabrix-work**` (repo/workspace root), resolve it with optional `**AIFABRIX_WORK**` env override, and register `**AIFABRIX_HOME**` / `**AIFABRIX_WORK**` into the user environment on Windows and POSIX shells when developers run `**dev set-home**` / `**dev set-work**`. Includes `**print-home**` / `**print-work**`, tests, and documentation updates.

## Rules and Standards

This plan must comply with [.cursor/rules/project-rules.mdc](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** — CommonJS, `lib/utils/` for registration helper, `path.join()` for paths; dev commands wired via existing Commander setup (`[lib/cli/setup-dev.js](lib/cli/setup-dev.js)`).
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** — Descriptions, validation, try/catch, chalk for user-facing messages; `**print-home` / `print-work`** use plain stdout only (no chalk) for scripting.
- **[Code Style](.cursor/rules/project-rules.mdc#code-style)** — Async/await, meaningful errors, input validation for paths.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** — Jest, mirror `tests/lib/...`, mock `**child_process`** / `**fs`** for registration and path I/O.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** — No secrets in generated shell files; only path strings; never log tokens; validate/sanitize paths written to profile snippets to avoid injection.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** — New files ≤500 lines, functions ≤50 lines, JSDoc on public exports.
- **[Documentation Requirements](.cursor/rules/project-rules.mdc#documentation-requirements)** — JSDoc on new modules; user docs in `docs/` per [docs-rules.mdc](.cursor/rules/docs-rules.mdc) (command-centric, no REST/API endpoint detail).
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** — `npm run build`, lint clean, all tests pass, ≥80% coverage on new code where practical.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** — Clear failures when OS registration fails; do not print full paths in errors if deemed sensitive in context (paths here are operational, not secrets).

**Key requirements (summary):** Register env only with explicit user action (`set-home` / `set-work`); support `--no-register-env`; mock external side effects in tests; run full Builder validation before merge.

## Before Development

- Read **CLI Command Development** and **Testing Conventions** in `project-rules.mdc`.
- Review existing `[dev set-home](lib/cli/setup-dev.js)` and `[config-paths.js](lib/utils/config-paths.js)` patterns for path keys.
- Confirm `package.json` scripts: `npm run build` = `lint` + `test`.
- List any duplicate `set-home` mentions under `docs/commands/` after edits (keep README and developer-isolation aligned).

## Definition of Done

Before marking this plan complete:

1. **Lint:** `npm run lint` — zero errors (run from the `aifabrix-builder` repository root).
2. **Tests:** `npm test` — all pass; use `npm run test:ci` for CI parity when needed.
3. **Build:** `npm run build` — succeeds (runs **lint then test** per repository `[package.json](../../package.json)`; not a separate compile step).
4. **Order:** Run **lint** before relying on full **test** suite; `**npm run build`** encodes the mandatory sequence for this repo.
5. **Coverage:** Aim for **≥80%** branch coverage on new registration and path-resolution code.
6. **Size & docs:** New/changed files ≤500 lines, functions ≤50 lines; JSDoc on new public APIs.
7. **Security:** No hardcoded secrets; generated `aifabrix-shell-env.sh` and Windows user env contain only intended variable names and path values.
8. **Documentation:** Builder docs listed in this plan updated; optional configuration repo updates if doing onboarding examples.
9. **Tasks:** All plan todos completed.

## Goals

1. `**aifabrix-home`** (existing): Fabrix state/config home; sync `**AIFABRIX_HOME`** to the OS user environment when changed via `**aifabrix dev set-home`** (plus optional `**dev print-home`**).
2. `**aifabrix-work`** (new): **Workspace root for git repos** — may differ from `**aifabrix-home`**. Sync `**AIFABRIX_WORK`** when changed via `**aifabrix dev set-work**` so `**echo $AIFABRIX_WORK**` (bash/zsh) / `**echo $env:AIFABRIX_WORK**` (PowerShell) works in **new** terminals after registration.
3. Single `**--no-register-env`** flag on `**set-home`** and `**set-work`** to skip touching OS/shell registration.

## Config schema

- **YAML key:** `aifabrix-work` (optional string, absolute or resolvable path; store normalized absolute path like other path keys).
- **Semantics:** “default clone / repo root” for the developer; **not** used as a substitute for `**aifabrix-home`** (secrets, infra, `~/.aifabrix` data stay on home unless migrated separately).

## Node resolution: `getAifabrixWork()`

Add in `[lib/utils/paths.js](aifabrix-builder/lib/utils/paths.js)` (or adjacent helper):

- **Precedence:** `**AIFABRIX_WORK`** env (trim, resolve) → `**aifabrix-work`** from `config.yaml` (read via same config discovery as today) → `**null`** if unset (no implicit default to `aifabrix-home` unless product explicitly wants that—**default plan: no default**, so missing key means “not configured”).
- **Tests:** mirror patterns in `[tests/lib/utils/paths.test.js](aifabrix-builder/tests/lib/utils/paths.test.js)` / `[config-paths.test.js](aifabrix-builder/tests/lib/utils/config-paths.test.js)`.

## CLI


| Command                            | Behavior                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `**aifabrix dev set-work <path>`** | Set/clear `aifabrix-work` in yaml (empty clears); then register `**AIFABRIX_WORK`** (unless `--no-register-env`). |
| `**aifabrix dev set-home <path>`** | Unchanged semantics + register `**AIFABRIX_HOME`** as in prior plan.                                              |
| `**aifabrix dev print-work`**      | Stdout only: resolved work path or empty line if unset (exit 0); for scripting.                                   |
| `**aifabrix dev print-home`**      | Stdout only: `paths.getAifabrixHome()`.                                                                           |
| `**aifabrix dev show`**            | List yaml values for `**aifabrix-work`** and optional **resolved** `AIFABRIX_WORK` / home (same pattern as home). |


Wire commands in `[lib/cli/setup-dev.js](aifabrix-builder/lib/cli/setup-dev.js)`; persist via `[lib/utils/config-paths.js](aifabrix-builder/lib/utils/config-paths.js)` + `[lib/core/config.js](aifabrix-builder/lib/core/config.js)` exports as needed.

## OS / shell registration (shared module)

One module (e.g. `[lib/utils/register-aifabrix-shell-env.js](aifabrix-builder/lib/utils/register-aifabrix-shell-env.js)`):

- **Windows:** user env `**AIFABRIX_HOME`** and `**AIFABRIX_WORK`** set or removed independently (PowerShell `SetEnvironmentVariable`, User scope). Clearing `**set-work`** removes `**AIFABRIX_WORK`** only; clearing `**set-home`** removes `**AIFABRIX_HOME`** only.
- **macOS/Linux:** one sourced file under the config dir, e.g. `**~/.aifabrix/aifabrix-shell-env.sh`**, containing `export` lines only for vars that are set; omit or `unset` on clear. Same **marked profile block** as in the home-only plan (source this file once).
- **Idempotent** updates when either command runs (rewrite file with current pair of values).

## Documentation to update (validated list)

### Builder repo (required for this feature)


| File                                                                                                    | Change                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[docs/configuration/secrets-and-config.md](aifabrix-builder/docs/configuration/secrets-and-config.md)` | In the **config.yaml** section: add `**aifabrix-work`** to the managed-keys list; short definition vs `**aifabrix-home`**; document `**AIFABRIX_HOME`** / `**AIFABRIX_WORK**` user env registration when using `**dev set-home**` / `**dev set-work**`, `**--no-register-env**`, new-terminal / IDE note. |
| `[docs/commands/developer-isolation.md](aifabrix-builder/docs/commands/developer-isolation.md)`         | New section `**aifabrix dev set-work**` (mirror `**set-home**`); extend `**dev set-home**` with registration behavior; document `**print-home**` / `**print-work**`; `**dev show**` fields.                                                                                                               |
| `[docs/commands/README.md](aifabrix-builder/docs/commands/README.md)`                                   | Add bullet for `**dev set-work**` / `**print-work**` next to `**set-home**`.                                                                                                                                                                                                                              |
| `[docs/commands/reference.md](aifabrix-builder/docs/commands/reference.md)`                             | Under **Configuration (config.yaml)**, add `**aifabrix-work`** with example line alongside `**aifabrix-home`**.                                                                                                                                                                                           |


### Builder repo (check if mentions need alignment)

- `[docs/commands/permissions.md](aifabrix-builder/docs/commands/permissions.md)` — only if new commands get `@requiresPermission` JSDoc elsewhere (likely N/A for local-only dev commands).
- Any **generated** or duplicate command lists under `docs/commands/` surfaced by search for `set-home` — keep in sync with README / developer-isolation.

### Configuration repo (onboarding; optional but recommended)


| File                                                                   | Change                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[configuration/Setup-developer.md](configuration/Setup-developer.md)` | Where **example** `config.yaml` keys appear (e.g. container workspace note around `aifabrix-home`), add `**aifabrix-work`** as the **git workspace root** when that layout uses a separate repos folder (e.g. `/workspace` vs `/workspace/.aifabrix`). |
| `[configuration/README.md](configuration/README.md)`                   | If it lists typical `config.yaml` keys, add `**aifabrix-work`** in the same breath as other keys.                                                                                                                                                      |


### Out of scope unless requested

- **Miso / dataplane** repos — no change unless another product doc duplicates `config.yaml` key lists (grep before release).
- **Auto-append** to `**configuration/SetupDeveloperEnv.ps1`** / `**.sh`** installers.

## Out of scope

- Using `**aifabrix-work`** as default `**cwd`** for all CLI commands without a follow-up design (this plan only stores, resolves, exports, and documents).
- **macOS GUI** inheritance of `**AIFABRIX_WORK`** without a shell (LaunchAgent layer).

## Optional prompt templates

Lower priority: prompt snippets that shorten `**PWD`** under `**$AIFABRIX_WORK`** (separate from `**$AIFABRIX_HOME`**); can live in `**templates/shell/`** and a short pointer in **secrets-and-config.md**.

---

## Plan Validation Report

**Date:** 2026-04-03  
**Plan:** [.cursor/plans/116-afhome_env_and_prompt.plan.md](116-afhome_env_and_prompt.plan.md)  
**Status:** VALIDATED (after rule references and DoD added)

### Plan purpose

- **Summary:** Add `aifabrix-work`, `AIFABRIX_WORK` / `AIFABRIX_HOME` OS registration, `dev set-work`, `print-home` / `print-work`, shared shell-env module, tests, and documentation.
- **Scope:** CLI (`lib/cli/setup-dev.js`), config (`lib/core/config.js`, `lib/utils/config-paths.js`), paths (`lib/utils/paths.js`), new `lib/utils/register-aifabrix-shell-env.js` (or equivalent), Jest tests, Builder `docs/`, optional `configuration/` repo.
- **Type:** Development (primary), Documentation, Security-adjacent (writes user env / profile; no secrets).

### Applicable rules


| Rule section                                                                             | Status            | Notes                                                             |
| ---------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------- |
| [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)           | Applied in plan   | CommonJS, `lib/utils/`, path helpers                              |
| [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)       | Applied in plan   | Commander, validation, stdout for print commands                  |
| [Code Style](.cursor/rules/project-rules.mdc#code-style)                                 | Applied in plan   | Async, errors                                                     |
| [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)               | Applied in plan   | Jest, mock `child_process` / `fs`                                 |
| [Security & Compliance](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)  | Applied in plan   | No secrets in shell exports; path handling                        |
| [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)         | Applied in plan   | 500/50 lines, JSDoc                                               |
| [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)                           | Documented in DoD | `npm run build`, lint, tests                                      |
| [Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)      | Applied in plan   | User-visible errors for registration failures                     |
| [Documentation Requirements](.cursor/rules/project-rules.mdc#documentation-requirements) | Cross-rule        | Align `docs/` with [docs-rules.mdc](.cursor/rules/docs-rules.mdc) |


### Rule compliance

- **DoD:** Documented in **Definition of Done** (lint → test via `npm run build`; this repo’s `build` is `lint && test`, not a separate “compile first” step).
- **Plan-specific:** Registration side effects must be testable without touching real user profiles where possible; document `--no-register-env` for automation.

### Plan updates made (this validation)

- Added **Overview**, **Rules and Standards**, **Before Development**, **Definition of Done**.
- Linked [.cursor/rules/project-rules.mdc](.cursor/rules/project-rules.mdc) and docs-rules for user-facing docs.
- Clarified Builder validation commands to match `[package.json](../../package.json)` (`build` = lint + test).

### Recommendations

- When implementing Windows registration, prefer `**SetEnvironmentVariable(..., User)`** via PowerShell over `setx` to avoid length limits and quoting issues; unit-test the command builder.
- For POSIX profile hooks, use a **single marked block** and idempotent append to avoid duplicate `source` lines; document manual removal if users uninstall CLI.
- Re-grep `docs/commands` for `set-home` after edits so **README**, **developer-isolation**, and **reference** stay aligned.
- If `lib/utils/paths.js` approaches 500 lines, extract `**getAifabrixWork`** (and related) into a small sibling module per **Code Quality Standards**.

---

## Implementation Validation Report

**Date:** 2026-04-03  
**Plan:** `.cursor/plans/116-afhome_env_and_prompt.plan.md`  
**Status:** ✅ COMPLETE

### Executive Summary

Required Builder code, tests, and user docs for `aifabrix-work`, `AIFABRIX_WORK` / `AIFABRIX_HOME` registration, `dev set-work` / `print-home` / `print-work`, and the shared `register-aifabrix-shell-env` module are implemented. ESLint passes with zero issues. **Full suite verified on builder02:** `npm test` — **Test Suites: 259 passed, 259 total**; **Tests: 5,647 passed** (28 skipped).

### Task completion (frontmatter / scope)


| Todo                    | Status                                                        |
| ----------------------- | ------------------------------------------------------------- |
| config-work-key         | ✅                                                             |
| cli-set-work-show       | ✅                                                             |
| register-env-both       | ✅                                                             |
| tests                   | ✅                                                             |
| docs-builder            | ✅                                                             |
| docs-configuration-repo | ⏭️ Cancelled (optional; not applied in `configuration/` repo) |


### File existence validation


| Item                                                                                | Status         |
| ----------------------------------------------------------------------------------- | -------------- |
| `lib/utils/config-paths.js` — `getAifabrixWorkOverride` / `setAifabrixWorkOverride` | ✅              |
| `lib/utils/paths.js` — `getAifabrixWork`                                            | ✅              |
| `lib/utils/register-aifabrix-shell-env.js`                                          | ✅ (~204 lines) |
| `lib/cli/setup-dev-path-commands.js` — set-home/set-work/print-*/set-format         | ✅ (~140 lines) |
| `lib/cli/setup-dev.js` — `dev show` extended                                        | ✅              |
| `lib/core/config.js` — path fns via `createPathConfigFunctions`                     | ✅              |
| `tests/lib/utils/config-paths.test.js` — work override tests                        | ✅              |
| `tests/lib/utils/paths.test.js` — `getAifabrixWork`                                 | ✅              |
| `tests/lib/utils/register-aifabrix-shell-env.test.js`                               | ✅              |
| `docs/configuration/secrets-and-config.md`                                          | ✅              |
| `docs/commands/developer-isolation.md`                                              | ✅              |
| `docs/commands/README.md`                                                           | ✅              |
| `docs/commands/reference.md`                                                        | ✅              |


### Out of scope / not done

- **Optional prompt templates** (`templates/shell/`) — still lower priority per plan.
- **configuration repo** — optional doc lines not applied; frontmatter todo cancelled.

### Test coverage

- ✅ Unit tests exist for config work path, `getAifabrixWork`, and registration helpers (incl. mocked `execFile` / temp-dir POSIX).
- Integration tests for this feature: not required by plan.

### Code quality validation


| Step               | Result                                                                                |
| ------------------ | ------------------------------------------------------------------------------------- |
| `npm run lint:fix` | ✅ PASSED                                                                              |
| `npm run lint`     | ✅ PASSED (0 errors, 0 warnings)                                                       |
| `npm test`         | ✅ PASSED — 259 suites, 5,647 tests passed (builder02, `~/workspace/aifabrix-builder`) |
| `npm run build`    | ✅ Equivalent to lint + test; use before merge                                         |


### Cursor rules compliance (spot check)

- ✅ CommonJS, `path.join` / resolved paths in config setters; JSDoc on registration module exports.
- ✅ `print-home` / `print-work` use `process.stdout.write` (no chalk) in `setup-dev-path-commands.js`.
- ✅ Registration errors surface to user on `set-home` / `set-work` when registration throws after YAML save.
- ✅ No secrets in generated shell snippets (paths only).

### Final validation checklist

- Core plan tasks implemented (Builder)
- Tests added under `tests/lib/utils/` mirroring `lib/utils/`
- Required Builder docs updated
- Lint clean (`npm run lint`)
- Full `npm test` green (259 suites, 5,647 tests — builder02)
- Optional: `configuration` repo doc lines (cancelled for this pass)
- Optional: prompt templates under `templates/shell/` (still out of scope per plan)

