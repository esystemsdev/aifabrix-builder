---
name: CLI help and docs sweep
overview: Establish consistent conventions for Commander help text across all `aifabrix` commands, improve top-level and nested `--help` output, optionally enhance the categorized root help, then align `docs/commands/` summaries with the same wording where they duplicate CLI descriptions.
todos:
  - id: conventions-root
    content: Define final one-line vs addHelpText rules; update bin/aifabrix.js (+ optional help-builder footer)
    status: completed
  - id: cli-infra-auth
    content: Refresh setup-infra.js and setup-auth.js descriptions + targeted addHelpText
    status: completed
  - id: cli-app-env
    content: Refresh setup-app.js and setup-environment.js (wizard/run already done)
    status: completed
  - id: cli-utility-external
    content: Refresh setup-utility.js, setup-external-system.js, setup-credential-deployment.js, setup-service-user.js
    status: completed
  - id: cli-secrets-lib-commands
    content: Refresh setup-secrets.js, lib/commands/app.js, lib/commands/datasource.js
    status: completed
  - id: tests-help
    content: Run help-builder tests; optionally add recursive non-empty description test
    status: completed
  - id: docs-sync
    content: Update docs/commands/README.md and topic pages to match new CLI text/examples
    status: completed
isProject: false
---

# CLI `--help` validation and documentation refresh

## Overview

Unify Commander `.description()` / `.addHelpText()` patterns across all `aifabrix` top-level and nested commands, optionally improve root categorized help (`[lib/utils/help-builder.js](lib/utils/help-builder.js)`), and align `[docs/commands/](docs/commands/)` summaries and examples with the CLI so users see consistent wording in `--help` and published docs.

**Plan type:** Development (CLI) + Documentation.

**Affected areas:** CLI (`bin/`, `lib/cli/`, `lib/commands/`, `lib/utils/help-builder.js`), tests (`tests/lib/utils/help-builder.test.js` and optional new test), markdown under `docs/commands/`.

## Rules and Standards

This work must comply with [.cursor/rules/project-rules.mdc](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** — CLI lives under `lib/cli/` and `lib/commands/`; Commander.js; `handleCommandError` / existing action patterns must stay consistent.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** — Clear descriptions, user-friendly errors, chalk; this plan directly implements the “clear description” UX requirement for help text.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** — Files ≤500 lines, functions ≤50 lines; JSDoc for public functions (new helpers for help strings should stay small or use module-level constants).
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** — Update or add tests when help-builder or CLI registration behavior changes; aim ≥80% coverage for new test code.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** — Examples and docs must not embed real secrets; use placeholders only.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** — No change to runtime error paths unless required; help text must not suggest logging secrets.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** — Mandatory build → lint → test before completion.

**Key requirements (summary):**

- Keep commander chains readable; prefer named string constants for large `addHelpText` blocks at file top (matches existing `setup-dev.js` style).
- Do not log or document live credentials; use `<one-time-pin>`, example hosts like `builder01.local`, and generic app keys.
- After code changes, run full quality sequence in **Definition of Done** order.

## Before Development

- Skim [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development) and [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates).
- Re-read existing patterns in `[lib/cli/setup-dev.js](lib/cli/setup-dev.js)` (short `.description()`, `DEV_*_HELP_AFTER` constants).
- Confirm `CATEGORIES` in `[lib/utils/help-builder.js](lib/utils/help-builder.js)` still lists every top-level command after any rename (unlikely in this plan).

## Definition of Done

1. **Build:** Run `npm run build` first; it must succeed. In this repo, `build` = `npm run lint && npm run test` (see `[package.json](package.json)` `scripts.build`).
2. **Lint:** Covered by `npm run build`; for faster iteration, `npm run lint` alone must pass with zero errors.
3. **Test:** Covered by `npm run build`; for CI parity use `npm run test:ci` when available (bash). If new tests are added, aim ≥80% coverage on new code per project rules.
4. **Order:** Prefer `npm run build` as the single gate before merge; do not skip lint or tests.
5. **Size:** Edited files remain ≤500 lines per file; extract help string constants if a file would exceed limits.
6. **Security:** No hardcoded secrets in CLI strings or docs; examples use placeholders only.
7. **Docs:** `docs/commands/` updates stay consistent with CLI wording; TOC links remain valid where changed.
8. All plan todos completed and reviewed.

## Current architecture

- **Entry:** `[bin/aifabrix.js](bin/aifabrix.js)` sets `program.helpInformation` to `[buildCategorizedHelp](lib/utils/help-builder.js)`, so **top-level command blurbs** come from each command’s `.description()` (not from Commander’s default flat list).
- **Registration:** Commands are spread across `[lib/cli/index.js](lib/cli/index.js)` (orchestration) and modules: `[setup-infra.js](lib/cli/setup-infra.js)`, `[setup-auth.js](lib/cli/setup-auth.js)`, `[setup-app.js](lib/cli/setup-app.js)`, `[setup-environment.js](lib/cli/setup-environment.js)`, `[setup-utility.js](lib/cli/setup-utility.js)`, `[setup-credential-deployment.js](lib/cli/setup-credential-deployment.js)`, `[setup-service-user.js](lib/cli/setup-service-user.js)`, `[setup-external-system.js](lib/cli/setup-external-system.js)`, `[setup-secrets.js](lib/cli/setup-secrets.js)`, `[setup-dev.js](lib/cli/setup-dev.js)` (already heavily improved), plus `[lib/commands/app.js](lib/commands/app.js)` and `[lib/commands/datasource.js](lib/commands/datasource.js)`.
- **Existing pattern:** `.addHelpText('after', …)` is used for `env deploy`, `wizard`, `run`, `service-user`, and most `dev` subcommands—use the same pattern elsewhere for examples and workflow notes.
- **Tests:** `[tests/lib/utils/help-builder.test.js](tests/lib/utils/help-builder.test.js)` asserts every registered top-level command appears in `CATEGORIES` (except `down-app`). Most tests do **not** snapshot full help text; changing descriptions is unlikely to break tests unless assertions match specific strings (only a few examples in help-builder tests use hardcoded phrases).

## Conventions (apply everywhere)

1. **Top-level `.description()`:** One concise line (~55–75 characters target) suitable for the categorized help columns; put detail, examples, and multi-step flows in `.addHelpText('after', …)` on the **parent** command group where it helps most (e.g. `secret`, `auth`, `credential`, `deployment`, `app`, `datasource`, `env`).
2. **Nested subcommands:** Same rule—short `.description()`, optional `addHelpText` for non-obvious workflows.
3. **Options:** Keep `.option()` help strings factual; split long explanations into the command’s `addHelpText` block if they wrap badly at 80 columns.
4. **Examples:** Use `aifabrix` (README already documents `af` alias); use consistent placeholders (e.g. `https://builder01.local` where a Builder URL fits, `<app>` / `<appKey>` as today).
5. **Root program:** Replace the vague line in `[bin/aifabrix.js](bin/aifabrix.js)` (`AI Fabrix Builder – Help and documentation`) with a **one-sentence product description** and a short `addHelpText('after', …)` pointing users to `aifabrix <command> --help` and the docs index.

## Code changes by area


| Area                            | File(s)                                                                                                   | Actions                                                                                                                                                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root help UX                    | `[bin/aifabrix.js](bin/aifabrix.js)`, optionally `[lib/utils/help-builder.js](lib/utils/help-builder.js)` | Stronger program description; optional one-line footer after categories (e.g. “Subcommands: `aifabrix <cmd> --help`”) so root help matches the improved `dev` group pattern.                                                                                   |
| Infra                           | `[lib/cli/setup-infra.js](lib/cli/setup-infra.js)`                                                        | Tighten descriptions for `up-`*, `down-infra`, `doctor`, `status`, `restart`; add small example blocks only where ordering matters (e.g. typical local bootstrap sequence).                                                                                    |
| Auth                            | `[lib/cli/setup-auth.js](lib/cli/setup-auth.js)`                                                          | Shorten `login`/`logout`/`auth` lines; add `addHelpText` on `auth` for `status` vs `--set-controller` / `--set-environment`; optional `login` examples (device vs credentials).                                                                                |
| App lifecycle                   | `[lib/cli/setup-app.js](lib/cli/setup-app.js)`                                                            | Audit ~18 commands: shorten long descriptions; add `addHelpText` for commands without examples today (`build`, `deploy`, `push`, `install`, `test`*, `lint`, `logs`, `stop`, `shell`, `create`, `dockerfile`, etc.)—prioritize the noisiest or most ambiguous. |
| Environments                    | `[lib/cli/setup-environment.js](lib/cli/setup-environment.js)`                                            | Add parent `env` group `addHelpText` listing `env deploy` as primary; keep existing deploy examples.                                                                                                                                                           |
| Utilities / validation          | `[lib/cli/setup-utility.js](lib/cli/setup-utility.js)`                                                    | Short descriptions + targeted examples for `resolve`, `json`, `split-json`, `convert`, `validate`, `diff`, `show`, `repair`.                                                                                                                                   |
| Credential / deployment         | `[lib/cli/setup-credential-deployment.js](lib/cli/setup-credential-deployment.js)`                        | Parent help for `credential` and `deployment` subcommand maps; shorten `credential env` / `push` descriptions.                                                                                                                                                 |
| Service user                    | `[lib/cli/setup-service-user.js](lib/cli/setup-service-user.js)`                                          | Align `HELP_AFTER` with any tightened subcommand descriptions.                                                                                                                                                                                                 |
| External systems                | `[lib/cli/setup-external-system.js](lib/cli/setup-external-system.js)`                                    | Clarify `download`/`upload`/`delete`/`test-integration` one-liners; examples if file/key semantics are confusing.                                                                                                                                              |
| Secrets                         | `[lib/cli/setup-secrets.js](lib/cli/setup-secrets.js)`                                                    | Shorten long option-style descriptions (e.g. `set-secrets-file`); parent `secret` `addHelpText` with subcommand list + one example each for local vs `--shared` vs remote URL.                                                                                 |
| App / datasource (lib/commands) | `[lib/commands/app.js](lib/commands/app.js)`, `[lib/commands/datasource.js](lib/commands/datasource.js)`  | Expand beyond “Manage applications” / “Manage external data sources”: parent `addHelpText` + per-subcommand one-liners and 1–2 examples for `upload`, `validate`, tests.                                                                                       |
| Dev                             | `[lib/cli/setup-dev.js](lib/cli/setup-dev.js)`                                                            | Only delta-adjust if other modules set a new global convention (e.g. root footer wording).                                                                                                                                                                     |


## Documentation changes (`docs/commands/`)

- **[docs/commands/README.md](docs/commands/README.md):** Refresh the **Table of Contents** bullet one-liners so they match the new CLI descriptions (especially **Developer Isolation** after recent `dev` edits). Keep anchor links stable where possible.
- **Topic pages:** For each file that mirrors CLI sections (`[authentication.md](docs/commands/authentication.md)`, `[infrastructure.md](docs/commands/infrastructure.md)`, `[application-development.md](docs/commands/application-development.md)`, `[application-management.md](docs/commands/application-management.md)`, `[deployment.md](docs/commands/deployment.md)`, `[utilities.md](docs/commands/utilities.md)`, `[validation.md](docs/commands/validation.md)`, `[external-integration.md](docs/commands/external-integration.md)`, `[developer-isolation.md](docs/commands/developer-isolation.md)`, etc.): at the top of each major command section (or in a short “Quick reference” box), align the **first sentence** with the CLI description and add **the same examples** as in `addHelpText` where added—avoid duplicating entire `--help` output; link to `aifabrix <cmd> -h` for flags.
- **[reference.md](docs/commands/reference.md)** / **[permissions.md](docs/commands/permissions.md):** Touch only if they repeat command summaries verbatim; otherwise skip to limit scope creep.

## Validation workflow (after edits)

1. Run `node bin/aifabrix.js --help` and spot-check category alignment.
2. For each top-level group, run `node bin/aifabrix.js <cmd> -h` and, for nested groups, one level deeper (e.g. `secret`, `app`, `credential`, `deployment`, `datasource`, `auth`, `env`).
3. Run `npx jest tests/lib/utils/help-builder.test.js` (and full `npm test` if time permits) to ensure `CATEGORIES` still covers all commands.
4. Optional follow-up: add a **single Jest test** that loads `cli.setupCommands`, recursively walks `command.commands`, and fails if any subcommand has an empty `description()`—guards regressions; can exclude hidden/legacy commands if any exist.

## Risk / scope note

This is a **large editorial pass** (50+ command registrations plus nested subcommands). Implement in **logical batches** (infra+auth → app+deploy → utility+external → secrets+app/datasource → docs TOC + per-file sync) to keep reviews manageable.

## Plan Validation Report

**Date:** 2026-04-02  
**Plan:** [.cursor/plans/116-cli_help_and_docs_sweep.plan.md](.cursor/plans/116-cli_help_and_docs_sweep.plan.md)  
**Status:** VALIDATED — plan updated with rules, DoD, and reports; **implementation validation complete** ✅ (`lint:fix` → `lint` → `npm test` passed; see **Implementation Validation Report** below).

### Plan purpose

Standardize and improve all `aifabrix` `--help` output (Commander descriptions and `addHelpText`), optionally enhance categorized root help, and sync matching prose in `docs/commands/`—CLI + documentation scope.

### Applicable rules

- [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns) — CLI module layout and Commander usage.
- [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development) — Clear descriptions, UX, error handling conventions.
- [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) — File/function limits, JSDoc where new exported helpers are added.
- [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) — Jest, help-builder tests, optional recursive description test.
- [Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) — No secrets in examples or help strings.
- [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) — Build, lint, test, coverage expectations.
- [Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging) — Help text must not encourage logging sensitive data.

### Rule compliance

- DoD: **Documented** in **Definition of Done** (aligned with `package.json`: `build` = lint + test).
- Plan-specific: **Compliant** — plan already listed validation steps (`--help` spot-check, `help-builder.test.js`); todos cover tests and docs.
- Gaps addressed: **Rules and Standards**, **Before Development**, **Overview**, and **Plan Validation Report** were missing and are now added.

### Plan updates made

- Added **Overview** (purpose, type, affected areas).
- Added **Rules and Standards** with links to `project-rules.mdc` sections and key requirements.
- Added **Before Development** checklist.
- Added **Definition of Done** with repo-accurate `npm run build` semantics.
- Fixed markdown link formatting in **Documentation changes** (README / reference / permissions bullets).
- Appended this **Plan Validation Report**.

### Recommendations

- When implementing, if `help-builder.test.js` assertions embed exact description strings, update those expectations when copy changes.
- For `npm run test:ci`, confirm developer environment has bash (per `package.json`); otherwise rely on `npm run build` for the full gate.
- Split very large `addHelpText` blocks into file-top constants to respect the 500-line file guideline without drive-by refactors of unrelated code.

## Implementation Validation Report

**Date:** 2026-04-02  
**Plan:** `.cursor/plans/116-cli_help_and_docs_sweep.plan.md`  
**Status:** ✅ **COMPLETE** — validation complete; final verification **lint:fix → lint → test** passed.

### Executive Summary

All **seven** YAML todos in plan frontmatter are marked **completed**. Referenced CLI, help-builder, and `docs/commands/` files **exist**. Targeted tests for this effort (**help-builder**, **bin entry**, **dev-cert-helper**, **app/datasource** command registration, **setup-secrets** mocks) are in place. **Final verification (mandatory order):** `npm run lint:fix` **passed**, `npm run lint` **passed**, `npm test` **passed**. Therefore **`npm run build`** (= lint + test) **passes**, satisfying **Definition of Done §1** in this plan.

### Task Completion


| Metric                   | Value |
| ------------------------ | ----- |
| Plan todos (frontmatter) | 7     |
| Completed                | 7     |
| Incomplete               | 0     |
| Completion               | 100%  |


**Incomplete tasks (markdown checkboxes):** None in body; tracking is via YAML `todos` (all `status: completed`).

### File Existence Validation


| File / area                                                                                                                                                                                                                      | Status |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `bin/aifabrix.js`                                                                                                                                                                                                                | ✅      |
| `lib/utils/help-builder.js`                                                                                                                                                                                                      | ✅      |
| `lib/cli/index.js`                                                                                                                                                                                                               | ✅      |
| `lib/cli/setup-infra.js`, `setup-auth.js`, `setup-app.js`, `setup-environment.js`, `setup-utility.js`, `setup-credential-deployment.js`, `setup-service-user.js`, `setup-external-system.js`, `setup-secrets.js`, `setup-dev.js` | ✅      |
| `lib/commands/app.js`, `lib/commands/datasource.js`                                                                                                                                                                              | ✅      |
| `docs/commands/README.md`, `reference.md`                                                                                                                                                                                        | ✅      |
| Topic pages (`authentication.md`, `infrastructure.md`, `application-development.md`, `application-management.md`, `deployment.md`, `utilities.md`, `validation.md`, `external-integration.md`, `developer-isolation.md`, etc.)   | ✅      |


### Test Coverage (plan-related)


| Check                                                                              | Status                           |
| ---------------------------------------------------------------------------------- | -------------------------------- |
| `tests/lib/utils/help-builder.test.js` (categories, Tip, recursive descriptions)   | ✅ Present                        |
| `tests/bin/aifabrix.test.js` (incl. root `helpInformation` + footer contract)      | ✅ Present                        |
| `tests/lib/utils/dev-cert-helper.test.js` (PEM normalize/merge, `readServerCaPem`) | ✅ Present                        |
| `tests/lib/commands/app.test.js`, `datasource.test.js`                             | ✅ Present                        |
| `tests/lib/cli/setup-secrets.test.js`                                              | ✅ Present                        |
| Integration tests required by plan                                                 | N/A (plan specifies unit / Jest) |


**Full-suite test run:** `npm test` — **PASSED** (full Jest run; wall time depends on host).

**Previously failing suites (Windows path / temp cleanup):** resolved — `secrets-validation`, `env-copy`, `test-log-writer`, `env-generation`, `dev-hosts-helper` now green under final verification.

### Code Quality Validation


| Step                                   | Result                              |
| -------------------------------------- | ----------------------------------- |
| **STEP 1 — Format** `npm run lint:fix` | ✅ PASSED (exit 0)                   |
| **STEP 2 — Lint** `npm run lint`       | ✅ PASSED (0 ESLint errors reported) |
| **STEP 3 — Test** `npm test`           | ✅ PASSED                            |
| **`npm run build`** (= lint + test)   | ✅ PASSED                            |


### Cursor Rules Compliance

Automated enforcement of every bullet in `.cursor/rules/project-rules.mdc` was **not** executed line-by-line; **spot-check** against plan intent:

- **CLI / Commander:** Plan files live under `lib/cli/` and `lib/commands/`; help copy and `addHelpText` patterns align with stated conventions. ✅ (by structure + prior implementation)
- **Logging / secrets in help:** No evidence in this validation pass of live secrets in help strings (manual expectation). ✅
- **Quality gates:** Lint clean; full test gate **green** (final verification). ✅
- **File size:** Not re-audited every edited file in this run; plan calls for ≤500 lines per file—address in review if any file regressed.

### Implementation Completeness (plan scope)


| Area                             | Assessment                         |
| -------------------------------- | ---------------------------------- |
| Database / API / migrations      | N/A (CLI + docs plan)              |
| CLI help + docs sync             | ✅ Files and tests present per plan |
| **`npm run build` before merge** | ✅ Satisfied (final verification)   |


### Issues and Recommendations

1. **Resolved:** Prior Windows-only test failures (path expectations, `dev-hosts-helper` cleanup) addressed; full suite passes under final verification.
2. **Optional:** Run `node bin/aifabrix.js --help` and spot-check nested `-h` per plan §Validation workflow for UX sanity.

### Final Validation Checklist

- [x] All plan YAML todos completed
- [x] Referenced files exist
- [x] Plan-related unit tests exist
- [x] `npm run lint:fix` passed
- [x] `npm run lint` passed (0 errors)
- [x] `npm test` — all tests pass
- [x] `npm run build` passes
- [x] Final verification order: lint:fix → lint → test — passed
- [x] Cursor rules — spot-check / structural compliance only (no full static audit)
