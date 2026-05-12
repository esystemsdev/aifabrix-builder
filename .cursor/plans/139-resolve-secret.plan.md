# Plan 139: In-memory secret resolution for up-platform / up-miso / up-dataplane

## Goal

Stop leaving resolved `.env` secrets on disk during platform bring-up. After `aifabrix setup` / `aifabrix up-platform` / `aifabrix up-miso` / `aifabrix up-dataplane`, the only places that may hold resolved values are:

1. Ephemeral `applications-dev-{id}/.env.run` and `.env.run.admin` (already cleaned after container is healthy by [run-container-start.js](../../lib/app/run-container-start.js)).
2. The user-local secrets store: `~/.aifabrix/secrets.local.yaml` (encrypted kv source of truth — not changed by this plan).
3. `~/.aifabrix/admin-secrets.env` (admin password file — not changed by this plan).

The persistent `<builderPath>/.env` and `build.envOutputPath` (e.g. repo-root `.env`) MUST only be materialized when the user explicitly runs `aifabrix resolve <app>`.

Also fixes the bug:

> `⚠ env.template not found for dataplane, skipping update`

which only appears when running the CLI as a binary (`aifabrix` on PATH) and `process.cwd()` is not the dataplane builder repo.

## Rules and Standards

This plan must comply with the following sections from [Project Rules](../../.cursor/rules/project-rules.mdc):

- **[Security & Compliance (ISO 27001)](../../.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** — Core driver of this plan: stop writing resolved secrets to disk; keep kv:// resolution centralized in `lib/core/secrets.js`; never log secrets; encrypt at rest where possible.
- **[Architecture Patterns — Generated Output](../../.cursor/rules/project-rules.mdc#generated-output-integration-and-builder)** — `<appPath>/.env` and `envOutputPath` are generated artifacts; fixes must go into the generator (`lib/core/secrets-env-content.js`, `lib/app/register.js`, `lib/app/rotate-secret.js`, `lib/build/index.js`), not into the produced files.
- **[Code Quality Standards](../../.cursor/rules/project-rules.mdc#code-quality-standards)** — Files ≤ 500 lines, functions ≤ 50 lines, JSDoc on all public functions (including the new `noWrite` option).
- **[Code Style — File Operations & Error Handling](../../.cursor/rules/project-rules.mdc#code-style)** — Use `path.join()`, wrap async ops in try-catch, chalk for user output, handle ENOENT explicitly when removing stale `.env` files.
- **[CLI Command Development](../../.cursor/rules/project-rules.mdc#cli-command-development)** — Updates to `aifabrix resolve` success message and to `aifabrix setup` / `aifabrix teardown` clean-up flow must follow the Commander pattern, use chalk, and provide actionable hints.
- **[CLI Layout and Output](../../.cursor/rules/cli-layout.mdc)** — Updated success / completion lines (`resolve`, `up-platform`, `up-miso`, `up-dataplane`) must follow `lib/utils/cli-test-layout-chalk` helpers (`formatSuccessLine`, `formatSuccessParagraph`, `formatNextActions`) and update [cli-output-command-matrix.md](../../.cursor/rules/cli-output-command-matrix.md) if any leaf command output changes.
- **[Testing Conventions](../../.cursor/rules/project-rules.mdc#testing-conventions)** — Mirror source structure; mock `fs`, `paths.getBuilderPath`, and `secrets`; cover both success and failure paths; ≥ 80% branch coverage on touched modules.
- **[Quality Gates](../../.cursor/rules/project-rules.mdc#quality-gates)** — Mandatory pre-commit checks: file size, JSDoc, no hardcoded secrets, build/lint/test pass.
- **[Error Handling & Logging](../../.cursor/rules/project-rules.mdc#error-handling--logging)** — Use `logger` (not raw `console.log`); never include resolved kv:// values in logs; warn (not throw) when stale `.env` files cannot be deleted.
- **[Critical Rules — Must Not Do](../../.cursor/rules/project-rules.mdc#must-not-do-)** — No hardcoded secrets; never expose secrets in error messages or success logs (e.g. log the path, not the resolved value); do not bypass the generator by editing produced `.env` directly.

**Key Requirements (extracted from the sections above)**:

- Persistent `.env` writes are removed from non-resolve flows (register, rotate-secret, build, up-platform/up-miso/up-dataplane).
- `aifabrix resolve <app>` remains the only path that materializes `<appPath>/.env` and `build.envOutputPath`.
- `updateEnvTemplate` resolves the template via `paths.getBuilderPath(appKey)` (respects `AIFABRIX_BUILDER_DIR` and system builder root for `keycloak` / `miso-controller` / `dataplane`).
- New `noWrite` option on `generateEnvFile` is documented with JSDoc (`@param {boolean} [options.noWrite]`); default behavior preserved.
- Stale `.env` cleanup is bounded to system-owned paths (`getSystemBuilderRoot()` and `getAifabrixSystemDir()`); user-repo paths are warned about, never deleted silently.
- Tests cover: binary-mode `updateEnvTemplate` regression, `noWrite` skip-write behavior, register/rotate/build no-`.env`-on-disk path, and a post-`up-dataplane` filesystem assertion.
- No secret values are written to logs at any point; only file paths and key names.

## Before Development

- [ ] Read [Security & Compliance (ISO 27001)](../../.cursor/rules/project-rules.mdc#security--compliance-iso-27001) and [Architecture — Generated Output](../../.cursor/rules/project-rules.mdc#generated-output-integration-and-builder) end-to-end.
- [ ] Re-read current implementations: [lib/core/secrets-env-content.js](../../lib/core/secrets-env-content.js) (`generateEnvFile`, `generateEnvContent`), [lib/core/secrets-env-write.js](../../lib/core/secrets-env-write.js) (`resolveAndWriteEnvFile`, `resolveAndGetEnvMap`), [lib/utils/env-template.js](../../lib/utils/env-template.js), [lib/utils/env-copy.js](../../lib/utils/env-copy.js).
- [ ] Confirm the run path is already in-memory: [lib/app/run-env-compose.js](../../lib/app/run-env-compose.js) (`buildMergedRunEnvAndWrite` → `.env.run` + `.env.run.admin`) and [lib/app/run-container-start.js](../../lib/app/run-container-start.js) (`waitForHealthyAndCleanupEnvFiles`).
- [ ] Inventory callers of `generateEnvFile` so each migrating site is accounted for: `lib/app/register.js`, `lib/app/rotate-secret.js`, `lib/build/index.js`, `lib/cli/setup-utility.js`.
- [ ] Inventory tests that assert `.env` is written today (so they can be flipped to assert no-write): grep for `generateEnvFile`, `.env file updated with new credentials`, `envOutputPath` in `tests/`.
- [ ] Plan test cases first (TDD): binary-mode `updateEnvTemplate` regression, `generateEnvFile({ noWrite: true })`, register/rotate/build no-write assertions, post-`up-dataplane` integration assertion.
- [ ] Review [cli-output-command-matrix.md](../../.cursor/rules/cli-output-command-matrix.md) to plan success-message edits for `resolve`, `up-platform`, `up-miso`, `up-dataplane`.

## Definition of Done

Before marking this plan complete, ensure (mandatory order: **BUILD → LINT → TEST**):

1. **Build**: `npm run build` runs successfully (this script runs `lint` then `test`; both must pass).
2. **Lint**: `npm run lint` reports zero errors and zero warnings on touched files.
3. **Test**: `npm test` is green; new and updated tests under `tests/lib/utils/env-template.test.js`, `tests/lib/core/secrets*.test.js`, `tests/lib/app/register.test.js`, `tests/lib/app/rotate-secret.test.js`, `tests/lib/build/*.test.js`, and `tests/integration/steps/step-03-resolve.test.js` are included and passing.
4. **Coverage**: ≥ 80% branch coverage on every touched source file (verify with `npm run test:coverage`).
5. **File / function size**: Every modified source file stays ≤ 500 lines; every modified or new function stays ≤ 50 lines. No `/* eslint-disable max-lines* */` added.
6. **JSDoc**: All modified public functions retain JSDoc; new options (`noWrite`) are documented with `@param`/`@returns`/`@throws` and an `@example` where helpful.
7. **Security review (ISO 27001)**: Confirm no resolved kv:// value is logged anywhere on the new code paths; only file paths and key names. Confirm stale-`.env` cleanup is restricted to system-owned paths.
8. **Generator-not-artifact discipline**: Every fix lands in the generator/CLI (`lib/core`, `lib/app`, `lib/utils`, `lib/cli`, `lib/commands`); no committed edits to produced `.env` files.
9. **CLI output compliance**: Any new or changed success / completion line follows [cli-layout.mdc](../../.cursor/rules/cli-layout.mdc) and uses `lib/utils/cli-test-layout-chalk` helpers; [cli-output-command-matrix.md](../../.cursor/rules/cli-output-command-matrix.md) updated if leaf-command output changes.
10. **Validation script (from §Validation below)**: Manual run from `/workspace/aifabrix-training` (binary mode) reproduces no warning, no persistent `.env`, and `aifabrix resolve dataplane` materializes the file.
11. **Documentation**: [docs/commands/utilities.md](../../docs/commands/utilities.md), [docs/configuration/env-template.md](../../docs/configuration/env-template.md), [docs/running.md](../../docs/running.md), and `CHANGELOG.md` updated.
12. **All tasks completed**: Every checkbox in `## Changes` and `## Tests` is closed.

## Current Behavior (what writes `.env` to disk today)

- [lib/app/register.js#saveLocalCredentials](../../lib/app/register.js) (lines 84–113): on localhost register, calls `updateEnvTemplate(...)` then `generateEnvFile(appKey, null, 'local', true)`.
- [lib/app/rotate-secret.js#saveCredentialsLocally](../../lib/app/rotate-secret.js) (lines 276–304): same pattern on rotate.
- [lib/build/index.js#postBuildTasks](../../lib/build/index.js) (lines 197–206): after `aifabrix build`.
- [lib/cli/setup-utility.js#setupResolveCommand](../../lib/cli/setup-utility.js) (lines 124–156): explicit `aifabrix resolve <app>` (this is the only legitimate caller).

`generateEnvFile` in [lib/core/secrets-env-content.js](../../lib/core/secrets-env-content.js) (lines 398–424) writes two files:

- `<appPath>/.env` (line 416: `fs.writeFileSync(envPath, toWrite, ...)`)
- `build.envOutputPath` via `processEnvVariables` in [lib/utils/env-copy.js](../../lib/utils/env-copy.js) (called at line 420).

The container run flow does NOT depend on `<appPath>/.env`. It builds the merged env in memory via `resolveAndGetEnvMap` and writes only `.env.run` / `.env.run.admin` to `applications-dev-{id}/`, which are deleted after health check (see [run-container-start.js](../../lib/app/run-container-start.js) lines 126–129). So removing the persistent writes from register/rotate/build is safe.

## Bug: `env.template not found for dataplane, skipping update`

[lib/utils/env-template.js](../../lib/utils/env-template.js) line 108:

```108:111:lib/utils/env-template.js
async function updateEnvTemplate(appKey, clientIdKey, clientSecretKey, _controllerUrl) {
  const envTemplatePath = path.join(process.cwd(), 'builder', appKey, 'env.template');

  if (!fsSync.existsSync(envTemplatePath)) {
```

Uses `process.cwd()` instead of `pathsUtil.getBuilderPath(appKey)`. When running the binary from a non-dataplane repo (e.g. `/workspace/aifabrix-training`), `cwd/builder/dataplane/env.template` does not exist; the dataplane template lives at `~/.aifabrix/builder/dataplane/env.template` (resolved by `getBuilderPath` via `getSystemBuilderRoot` for system apps). Result: the env.template is silently not updated with MISO_CLIENTID / MISO_CLIENTSECRET kv refs.

## Design

Introduce a single switch — `persistEnvOnDisk` — that defaults to **false** everywhere except the `aifabrix resolve` command.

```mermaid
flowchart LR
  upPlatform[up-platform / up-miso / up-dataplane] --> regRot[register or rotate]
  buildCmd[aifabrix build] --> regRot
  regRot --> persistFalse{persistEnvOnDisk = false}
  persistFalse --> updateTpl[updateEnvTemplate kv-only<br/>writes env.template only]
  persistFalse --> skipEnv[skip generateEnvFile<br/>no .env, no envOutputPath]
  resolveCmd[aifabrix resolve app] --> persistTrue{persistEnvOnDisk = true}
  persistTrue --> generateEnv[generateEnvFile<br/>writes appPath.env + envOutputPath]
  runApp[aifabrix run app] --> inMemory[resolveAndGetEnvMap<br/>writes only .env.run / .env.run.admin]
  inMemory --> cleanup[unlink after health check]
```

## Changes

### 1. Fix `updateEnvTemplate` to respect `AIFABRIX_BUILDER_DIR` / system builder root

File: [lib/utils/env-template.js](../../lib/utils/env-template.js)

- Replace `path.join(process.cwd(), 'builder', appKey, 'env.template')` with `path.join(require('./paths').getBuilderPath(appKey), 'env.template')`.
- Update tests in [tests/lib/utils/env-template.test.js](../../tests/lib/utils/env-template.test.js) to mock `paths.getBuilderPath` (or assert on the resolved path returned by it) instead of hardcoding `path.join(process.cwd(), 'builder', testAppKey, 'env.template')`.

### 2. Gate persistent `.env` writes behind explicit resolve

File: [lib/core/secrets-env-content.js](../../lib/core/secrets-env-content.js)

- Add a `noWrite` (or `inMemoryOnly`) option to `generateEnvFile`. When true:
  - Skip `fs.writeFileSync(envPath, toWrite, ...)` (do not write `<appPath>/.env`).
  - Skip the `processEnvVariables(envPath, variablesPath, appName, secretsPath)` call (do not write `build.envOutputPath`).
  - Return the resolved content map / path to a temp file via `lib/core/secrets-env-write.js#resolveAndWriteEnvFile` if a caller still needs a tmp path. Prefer returning the in-memory content directly for callers that only need to log success.
- Default `noWrite = false` (no behavior change for existing direct callers).

### 3. Skip persistent `.env` writes from register / rotate / build

Files:

- [lib/app/register.js](../../lib/app/register.js) (lines 84–113)
- [lib/app/rotate-secret.js](../../lib/app/rotate-secret.js) (lines 276–304)
- [lib/build/index.js](../../lib/build/index.js) (lines 197–206)

Changes:

- In `saveLocalCredentials` and `saveCredentialsLocally`: keep `updateEnvTemplate(...)` (so `env.template` learns the new kv:// names) and **remove** the `generateEnvFile(..., 'local', true)` call. Replace the log line `.env file updated with new credentials` with a message that clarifies env will be resolved in-memory at run time (no on-disk `.env`). The kv values themselves are already persisted to `~/.aifabrix/secrets.local.yaml` by `saveLocalSecret(...)` immediately above.
- In `postBuildTasks`: replace `secrets.generateEnvFile(appName, buildConfig.secrets, 'docker')` with `secrets.generateEnvContent(appName, buildConfig.secrets, 'docker')` (in-memory) — only validate / log success; do not write `<appPath>/.env`. Build args still flow through `resolveAndGetEnvMap` (already in-memory; see [secrets-env-write.js](../../lib/core/secrets-env-write.js) lines 200–209).

### 4. Keep `aifabrix resolve <app>` as the only writer

File: [lib/cli/setup-utility.js](../../lib/cli/setup-utility.js) (`setupResolveCommand`, lines 124–156)

- No code change in behavior. Confirm the call site continues to use `generateEnvFile(..., { skipOutputPath: false })` so `<appPath>/.env` and `envOutputPath` are written.
- Update the success line to make the trade-off explicit: "Resolved .env written to `<path>`. Note: up-platform / up-miso / up-dataplane resolve secrets in-memory only — run `aifabrix resolve <app>` whenever you need an on-disk `.env`."

### 5. Clean stale `.env` files written by older builds

Files:

- [lib/commands/teardown.js](../../lib/commands/teardown.js) (existing teardown logic)
- [lib/commands/setup.js](../../lib/commands/setup.js) (existing `--force` / clean-install paths)

Changes:

- Extend the clean step so that for each system builder app (`keycloak`, `miso-controller`, `dataplane`) under `getSystemBuilderRoot()` and `getProjectBuilderAppPath()`, any existing `<appPath>/.env` is unlinked. Same for `build.envOutputPath` when it resolves to a path inside `getAifabrixSystemDir()` (e.g. `~/.aifabrix/.env`). Do NOT delete a user's repo-root `.env` (i.e. when `envOutputPath` resolves outside the aifabrix system dir) — only warn.
- Add a one-time migration log on `setup` if such files exist: `Removed stale resolved .env at <path>; run "aifabrix resolve <app>" if you need an on-disk copy`.

### 6. Documentation

- [docs/commands/utilities.md](../../docs/commands/utilities.md): clarify that `aifabrix resolve <app>` is the only command that writes a persistent `.env`; up-platform / up-miso / up-dataplane resolve in-memory.
- [docs/configuration/env-template.md](../../docs/configuration/env-template.md): note the change and that `env.template` is still updated with MISO_* kv refs during register/rotate.
- [docs/running.md](../../docs/running.md): emphasize that `aifabrix run <app>` uses ephemeral `.env.run` (already true) and never touches `<appPath>/.env`.

## Tests

- [tests/lib/utils/env-template.test.js](../../tests/lib/utils/env-template.test.js): update existing 11 tests to assert resolution via `paths.getBuilderPath` (mock `AIFABRIX_BUILDER_DIR` or `paths.getBuilderPath`); add a regression test that proves the binary-from-other-cwd case finds the dataplane template under the system builder root.
- New unit test for `generateEnvFile({ noWrite: true })`: asserts the in-memory content is returned and no `fs.writeFileSync` for `<appPath>/.env` and no `processEnvVariables` call.
- Update [tests/lib/core/secrets.test.js](../../tests/lib/core/secrets.test.js) and [tests/lib/utils/env-copy.test.js](../../tests/lib/utils/env-copy.test.js) coverage as needed.
- Update register/rotate/build tests to confirm `.env` is NOT written when running under up-platform-style flows.
- Add an integration-style test (or extend [tests/integration/steps/step-03-resolve.test.js](../../tests/integration/steps/step-03-resolve.test.js)) that runs `up-dataplane` against a fake controller and asserts no `<appPath>/.env` or `envOutputPath .env` is present after success.

## Validation

After implementation, run from a non-builder cwd (binary mode) to reproduce the original conditions:

```bash
cd /workspace/aifabrix-training
af teardown -y
af setup
ls -la /workspace/.aifabrix/.env                           # must NOT exist
ls -la /workspace/.aifabrix/builder/dataplane/.env         # must NOT exist
grep MISO_CLIENTID /workspace/.aifabrix/builder/dataplane/env.template   # MUST be present (no warn)

af resolve dataplane
ls -la /workspace/.aifabrix/builder/dataplane/.env         # must exist after explicit resolve
```

## Backwards Compatibility

- Public CLI surface is unchanged.
- `aifabrix resolve <app>` still writes `.env` (behavior preserved).
- `aifabrix run <app>` already used ephemeral `.env.run` — no change.
- External integrations / `kv://` resolution / `env.template` updates remain in place; only the persistent `.env` write step is gated.
- Existing scripts that depended on `<appPath>/.env` or repo-root `.env` after `up-*` must call `aifabrix resolve <app>` once. Add an explicit note in `CHANGELOG.md` and in the up-platform / up-dataplane completion footer.

## Out of Scope

- Encrypted at-rest secrets format (still YAML in `secrets.local.yaml`).
- Removing `build.envOutputPath` from templates — keep the setting; only stop materializing it during up-* flows. `aifabrix resolve <app>` continues to honour it.
- Changes to MisoClient / Controller / Dataplane consumers.

---

## Plan Validation Report

**Date**: 2026-05-12
**Plan**: [aifabrix-builder/.cursor/plans/139-resolve-secret.plan.md](139-resolve-secret.plan.md)
**Status**: VALIDATED

### Plan Purpose

**Type**: Refactoring + Security (ISO 27001 secret-management hardening) with a small Bug Fix and CLI Output update.

**Summary**: Stop materializing resolved `.env` files on disk during `aifabrix setup` / `up-platform` / `up-miso` / `up-dataplane`. Move all secret resolution to in-memory for the run flow (which already uses ephemeral `.env.run` + `.env.run.admin` and unlinks them after health-check), keep `aifabrix resolve <app>` as the only command that writes a persistent `.env`, and fix [lib/utils/env-template.js](../../lib/utils/env-template.js) to resolve templates via `paths.getBuilderPath` so the dataplane `env.template` is found when the CLI runs as a binary outside the dataplane repo.

**Affected areas**:

- Core secrets generators: [lib/core/secrets-env-content.js](../../lib/core/secrets-env-content.js), [lib/core/secrets-env-write.js](../../lib/core/secrets-env-write.js).
- App lifecycle generators: [lib/app/register.js](../../lib/app/register.js), [lib/app/rotate-secret.js](../../lib/app/rotate-secret.js), [lib/build/index.js](../../lib/build/index.js).
- Utilities: [lib/utils/env-template.js](../../lib/utils/env-template.js), [lib/utils/env-copy.js](../../lib/utils/env-copy.js).
- CLI commands: [lib/cli/setup-utility.js](../../lib/cli/setup-utility.js) (`resolve`), [lib/commands/setup.js](../../lib/commands/setup.js), [lib/commands/teardown.js](../../lib/commands/teardown.js).
- Tests under `tests/lib/utils/`, `tests/lib/core/`, `tests/lib/app/`, `tests/lib/build/`, `tests/integration/steps/`.
- Docs: [docs/commands/utilities.md](../../docs/commands/utilities.md), [docs/configuration/env-template.md](../../docs/configuration/env-template.md), [docs/running.md](../../docs/running.md), `CHANGELOG.md`.

### Applicable Rules

- Security & Compliance (ISO 27001) — Primary driver; plan explicitly removes resolved secrets from on-disk artifacts and limits stale-cleanup to system-owned paths.
- Architecture Patterns — Generated Output — Plan fixes the generators (`lib/core/secrets-env-content.js`, `lib/app/*`, `lib/build/index.js`) rather than the produced `.env` files.
- Code Quality Standards — File ≤ 500 lines, function ≤ 50 lines, JSDoc on new `noWrite` option.
- Code Style (File Operations & Error Handling) — `path.join`, try-catch around async ops, ENOENT handling for stale-`.env` cleanup.
- CLI Command Development — Updates to `resolve`, `setup`, `teardown` use Commander pattern, chalk, actionable hints.
- CLI Layout and Output — Touched success/completion lines must use `lib/utils/cli-test-layout-chalk` helpers and [cli-output-command-matrix.md](../../.cursor/rules/cli-output-command-matrix.md) must be updated if leaf-command output changes.
- Testing Conventions — Mock fs and paths; mirror source; cover success/failure; ≥ 80% branch coverage.
- Quality Gates (mandatory) — `npm run build` → `npm run lint` → `npm test` all green.
- Error Handling & Logging — `logger` not `console.log`; never log resolved kv:// values.
- Critical Rules — Must Not Do — No hardcoded secrets; no secret exposure in logs; no edits to produced artifacts.

### Rule Compliance

- DoD Requirements: Documented (BUILD → LINT → TEST order, ≥ 80% coverage, file/function size, JSDoc, security review, generator-not-artifact discipline, CLI output compliance, manual validation script, docs/CHANGELOG, all tasks closed).
- Security & Compliance: Compliant — the plan is itself a secret-hygiene improvement; logs are explicitly restricted to paths and key names; stale-cleanup is bounded to `getSystemBuilderRoot()` / `getAifabrixSystemDir()`.
- Architecture — Generated Output: Compliant — every change targets the generator code path; no edits to `<appPath>/.env` or `envOutputPath` artifacts.
- Code Quality Standards: Compliant — changes are localized (a flag in one function, three call-site rewrites, one path fix); no file is expected to cross 500 lines. JSDoc obligations called out for `noWrite`.
- CLI Layout and Output: Compliant — plan calls out `lib/utils/cli-test-layout-chalk` helpers and explicit update of [cli-output-command-matrix.md](../../.cursor/rules/cli-output-command-matrix.md) when leaf-command output changes.
- Testing Conventions: Compliant — new and updated tests enumerated; integration coverage extended via [tests/integration/steps/step-03-resolve.test.js](../../tests/integration/steps/step-03-resolve.test.js).
- Quality Gates: Compliant — explicit `npm run build` / `npm run lint` / `npm test` (and `npm run test:coverage`) in DoD; reflects [package.json](../../package.json) scripts.
- Error Handling & Logging: Compliant — plan replaces "`.env` file updated" lines with non-leaking messages and uses warn (not throw) for non-deletable stale files.
- Critical Rules — Must Not Do: Compliant — no secrets logged; no edits to produced artifacts; uses `path.join` and `paths.getBuilderPath`.

### Plan Updates Made

- Added "Rules and Standards" section linking the relevant subsections of [project-rules.mdc](../../.cursor/rules/project-rules.mdc) and [cli-layout.mdc](../../.cursor/rules/cli-layout.mdc), with extracted Key Requirements.
- Added "Before Development" checklist (read rules; re-read current implementations; inventory callers and tests; TDD test plan; CLI output planning).
- Added "Definition of Done" section with mandatory BUILD → LINT → TEST order, coverage, size limits, JSDoc, security review, generator discipline, CLI output compliance, validation script, docs/CHANGELOG, all-tasks-closed.
- Appended this Plan Validation Report.

### Recommendations

- Filename convention: the basename `139-resolve-secret.plan.md` follows the repo's existing `{N}-{slug}.plan.md` pattern (matches `Archive/124-…`, `Archive/122-…`) but diverges from the generic `{major}.{minor}` pattern in some plan rules. No rename suggested — keep consistency with existing files in `.cursor/plans/`.
- Consider numbering the items in `## Changes` to align with the DoD "all tasks completed" checkbox and to make progress trackable in PRs.
- When implementing item 5 ("Clean stale `.env` files written by older builds"), add an explicit per-call audit log via `lib/core/audit-logger.js` (only the path; never the content) to keep the cleanup auditable per ISO 27001.
- For the CLI completion footer update on `up-platform` / `up-miso` / `up-dataplane`, include a one-line "Tip: run `aifabrix resolve <app>` to materialize an on-disk `.env`" so users discover the new mental model without reading CHANGELOG.
- Add a focused unit test that asserts no `fs.writeFileSync` is called with a path ending in `/.env` from the register/rotate/build modules (Jest spy on `fs.writeFileSync`) so the no-write guarantee cannot regress silently.
