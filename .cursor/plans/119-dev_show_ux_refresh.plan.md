---
name: dev show UX refresh
overview: Rework `aifabrix dev show` output in `displayDevConfig` for grouped, column-aligned sections; show Remote + Remote Identity only when `remote-server` is set; parse the client cert CN to detect config vs certificate developer-id mismatch and surface it with inline and block warnings; use `aifabrix dev refresh` in the Fix hint with copy that developer-id must be in sync with the certificate.
todos:
  - id: cert-cn-helper
    content: Add getCertSubjectDeveloperId(certDir) in dev-cert-helper.js + tests (openssl subject mock)
    status: completed
  - id: dev-show-module
    content: Extract grouped displayDevConfig to dev-show-display module; gate Remote/Identity on remote-server; column-aligned rows
    status: completed
  - id: mismatch-refresh-copy
    content: "Implement mismatch detection + inline ⚠️ + block with Config/Certificate lines and Fix: developer-id sync + aifabrix dev refresh"
    status: completed
  - id: cli-tests
    content: Update cli.test.js dev show / set-format expectations; add mismatch case if practical with mocks
    status: completed
isProject: false
---

# Improved `aifabrix dev show` layout and remote identity

## Overview

Rework `aifabrix dev show` (`displayDevConfig`) into grouped, readable sections; show Remote and Remote Identity only when `remote-server` is set; parse client certificate CN to detect developer-id mismatch and highlight remediation using `aifabrix dev refresh`. Underlying config data stays the same—layout, labels, and conditional blocks only.

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** — CommonJS, `lib/commands/` vs `lib/utils/` layout, named exports; extracted display module aligns with existing command/helper structure.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** — `dev show` keeps Commander wiring in `setup-dev.js`; user-facing output uses logger/chalk; actionable mismatch text with `aifabrix dev refresh`.
- **[Code Style](.cursor/rules/project-rules.mdc#code-style)** — async/await, const, template literals where appropriate; clear validation of inputs in new helpers.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** — Files ≤500 lines, functions ≤50 lines, JSDoc on public functions (cert CN parser, display exports).
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** — Jest, tests under `tests/` mirroring `lib/`, mock `execFileSync` for OpenSSL subject tests.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** — Do not log PEM bodies, private keys, or tokens; certificate UX shows status, expiry, and id metadata only.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** — Parse/network/OpenSSL failures surface as safe user labels (e.g. MISSING/unreadable), not raw dumps.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** — Mandatory build, lint, and full test pass before completion.

**Key requirements (summary)**

- Split rendering so `setup-dev.js` stays a thin orchestrator and respects file/function size limits.
- Document new public APIs with JSDoc; follow existing `dev-cert-helper` and `app/show-display` formatting patterns.
- Update CLI tests for new log strings; add unit coverage for CN parsing.
- Run the full validation sequence after implementation.

## Before Development

- Read [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development) and [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) in project-rules.mdc.
- Re-read current `displayDevConfig` in `lib/cli/setup-dev.js` and cert helpers in `lib/utils/dev-cert-helper.js`.
- Review existing `dev show` / `dev set-format` test expectations in `tests/lib/cli.test.js`.

## Definition of Done

Before marking this plan complete:

1. **Build**: Run `npm run build` first (must succeed; project script runs lint + tests as configured).
2. **Lint**: Run `npm run lint`; zero errors (resolve warnings per team policy).
3. **Test**: Run `npm test` or `npm run test:ci`; all tests pass.
4. **Order**: BUILD → LINT → TEST; do not skip or reorder quality checks.
5. **Coverage**: ≥80% coverage on new/changed code where practical (cert subject helper, dev show display).
6. **Limits**: No source file >500 lines; no function >50 lines without decomposition.
7. **JSDoc**: New public functions have JSDoc (`@fileoverview`, `@param`, `@returns`, `@throws` as appropriate).
8. **Security**: No hardcoded secrets; no logging of certificate PEM or private key material.
9. **Behaviour**: Output matches the confirmed behaviour table (grouped sections, Remote/Identity gated on `remote-server`, mismatch inline + block + `aifabrix dev refresh` fix copy).
10. **Todos**: All frontmatter todos completed and verified in code review.

## Context

- Current implementation: `[displayDevConfig](c:\workspace\esystemsdev\aifabrix-builder\lib\cli\setup-dev.js)` logs a flat list mixing ports, environment, controller, and many `optionalConfigVars` keys (including duplicate `aifabrix-home` / resolved and `aifabrix-work` / resolved).
- Cert on disk: `[getCertDir](c:\workspace\esystemsdev\aifabrix-builder\lib\utils\dev-cert-helper.js)` + `cert.pem`; expiry already via `[getCertValidNotAfter](c:\workspace\esystemsdev\aifabrix-builder\lib\utils\dev-cert-helper.js)`. CN convention for CSR/certs is `dev-<developerId>` (same file).
- Remote auth resolves cert path using **config** developer-id (`[getRemoteDevAuth](c:\workspace\esystemsdev\aifabrix-builder\lib\utils\remote-dev-auth.js)`).

## Behaviour (confirmed)


| Requirement        | Implementation                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grouped sections   | 👤 Developer, 🌐 Remote, 🔐 Remote Identity (conditional), Ports, Configuration, Paths, Integrations — same data as today, clearer labels                                                                                                                                                                                                                     |
| Remote block       | Emit **only when** `remote-server` is truthy (after trim): Server, Docker (`docker-endpoint`), SSH (`sync-ssh-user`@`sync-ssh-host`), and **retain** `docker-tls-skip-verify` (user asked to keep all data)                                                                                                                                                   |
| Remote Identity    | **Only if** `remote-server` exists: Certificate status (VALID / EXPIRED / MISSING / unreadable), Developer ID **from cert** (parse CN `dev-<id>`), Expires + days remaining when applicable                                                                                                                                                                   |
| No duplicate paths | Single **Home** = `paths.getAifabrixHome()`; single **Work** = `paths.getAifabrixWork()`; drop separate override vs resolved lines unless you add a one-line gray hint when override differs (optional; default to spec: resolved only)                                                                                                                       |
| Mismatch           | When cert exists and parsed cert dev id **disagrees** with config developer-id: append **⚠️** to the Certificate status line; print **⚠️ Developer ID mismatch** block with Config vs Certificate columns; **Fix** copy (per your direction): state that **developer-id must match the client certificate**, then `**aifabrix dev refresh`** (not `dev sync`) |
| Comparison rule    | Compare in a way that treats numeric equality (e.g. `2` vs `02`) as match if both parse as the same non-negative integer; still display values as stored / as read from subject                                                                                                                                                                               |


## Certificate parsing

- Add a small helper in `[lib/utils/dev-cert-helper.js](c:\workspace\esystemsdev\aifabrix-builder\lib\utils\dev-cert-helper.js)`: run OpenSSL `x509 -subject -noout -in cert.pem` (reuse existing `runOpenSSL` / path pattern like `getCertValidNotAfter`), parse `CN=dev-XX` / `CN = dev-XX`, return digits string or `null` if missing/invalid.
- Reuse expiry from `getCertValidNotAfter` for VALID vs EXPIRED (compare to `Date.now()`).

## Structure / file size

- Extract rendering from `[setup-dev.js](c:\workspace\esystemsdev\aifabrix-builder\lib\cli\setup-dev.js)` into a focused module (e.g. `[lib/commands/dev-show-display.js](c:\workspace\esystemsdev\aifabrix-builder\lib\commands\dev-show-display.js)` or `[lib/utils/dev-show-display.js](c:\workspace\esystemsdev\aifabrix-builder\lib\utils\dev-show-display.js)`) so `displayDevConfig` stays a thin async orchestrator and functions stay under ~50 lines.
- Use a single label column width (aligned with patterns in `[lib/app/show-display.js](c:\workspace\esystemsdev\aifabrix-builder\lib\app\show-display.js)`, e.g. `padEnd(18)`).

## Integrations section

- **Secrets API**: show resolved URL when `[resolveSharedSecretsEndpoint](c:\workspace\esystemsdev\aifabrix-builder\lib\utils\remote-dev-auth.js)` returns an `http(s)` endpoint (same logic as today’s optional `aifabrix-secrets (effective)`); otherwise show raw `aifabrix-secrets` or `(not set)`.
- **Mutagen Folder**: `user-mutagen-folder` (and any other integration-only keys not moved under Remote).

## Configuration section

- `environment`, `controller`, `format`, plus any remaining keys that are not placed in Remote / Paths / Integrations (so nothing is dropped).

## Tests

- Update `[tests/lib/cli.test.js](c:\workspace\esystemsdev\aifabrix-builder\tests\lib\cli.test.js)` expectations for `dev show` / `dev set-format` (they assert exact `logger.log` strings today).
- Add unit tests for CN parsing in `[tests/lib/utils/dev-cert-helper.test.js](c:\workspace\esystemsdev\aifabrix-builder\tests\lib\utils\dev-cert-helper.test.js)` (mock `execFileSync` output for `-subject`).

## Fix copy (exact intent)

Example block (wording can be tightened in implementation):

```text
Fix:
  Developer-id in config must match your client certificate; sync with:
    aifabrix dev refresh
```

(If product copy should be even shorter, keep the two ideas: **match certificate** and **aifabrix dev refresh**.)

## Plan Validation Report

**Date**: 2026-04-04  
**Plan**: [.cursor/plans/119-dev_show_ux_refresh.plan.md](119-dev_show_ux_refresh.plan.md)  
**Status**: ✅ VALIDATED

### Plan Purpose

Improve CLI UX for `aifabrix dev show` by grouping output, removing redundant path lines, conditionally showing Remote and Remote Identity when `remote-server` is set, parsing the client certificate CN to detect developer-id mismatch, and surfacing a clear fix that references `aifabrix dev refresh` with developer-id / certificate sync messaging. Scope: `lib/cli/setup-dev.js`, new or extended display module, `lib/utils/dev-cert-helper.js`, and Jest tests.

**Type**: Development (CLI / refactoring / testing)  
**Affected areas**: CLI output, utilities (cert parsing), commands layout, tests.

### Applicable Rules

- ✅ [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns) — Module placement and CommonJS exports for extracted display logic.
- ✅ [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development) — Commander-bound `dev show`; chalk/logger UX for warnings.
- ✅ [Code Style](.cursor/rules/project-rules.mdc#code-style) — Conventions for helpers and async code.
- ✅ [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) — File/function size and JSDoc.
- ✅ [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) — Jest updates and mocks.
- ✅ [Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) — No secret/cert material in logs.
- ✅ [Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging) — Safe failure modes for OpenSSL parse errors.
- ✅ [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) — DoD encodes build → lint → test.

### Rule Compliance

- ✅ **DoD requirements**: Documented under **Definition of Done** (build, lint, test, order, coverage, limits, JSDoc, security, behaviour).
- ✅ **CLI / display**: Plan defers implementation to extracted module and keeps Commander entry thin.
- ✅ **Testing**: Plan explicitly updates `cli.test.js` and `dev-cert-helper.test.js`.
- ✅ **Security**: Plan calls out certificate display as metadata only; validation reinforces ISO 27001 logging rules.

### Plan Updates Made

- ✅ Added **Overview** section.
- ✅ Added **Rules and Standards** with links to project-rules.mdc and a key-requirements summary.
- ✅ Added **Before Development** checklist.
- ✅ Added **Definition of Done** with mandatory BUILD → LINT → TEST sequence and project quality gates.
- ✅ Appended this **Plan Validation Report**.

### Recommendations

- During implementation, if `npm run build` already runs lint + tests, still run `npm run lint` and `npm test` explicitly when diagnosing failures (per Quality Gates mental model).
- If user-facing docs mention `dev show` output (e.g. `docs/commands/developer-isolation.md`), update them in a follow-up if the team wants screenshots or sample output aligned with the new layout—this plan does not mandate doc edits.
- Optional: add one focused integration-style test for mismatch output if mocks for OpenSSL subject lines become brittle across platforms; unit tests on parsed subject strings remain primary.

## Implementation Validation Report

**Date**: 2026-04-04  
**Plan**: [.cursor/plans/119-dev_show_ux_refresh.plan.md](119-dev_show_ux_refresh.plan.md)  
**Status**: ⚠️ INCOMPLETE (plan scope implemented; full `npm test` has unrelated failures on this environment)

### Executive Summary

All plan deliverables are present in the codebase: certificate CN parsing in `dev-cert-helper`, extracted `dev-show-display` with remote gating and mismatch UX, wired `setup-dev.js`, and tests (`dev-cert-helper.test.js`, `cli.test.js`, `dev-show-display.test.js`). ESLint passes with zero errors and zero warnings after `npm run lint:fix` and `npm run lint`. The full Jest run reports **2 failing tests** in `config-paths.test.js` and `config.test.js` (POSIX path expectations vs Windows `path.resolve` output)—not in files touched by this plan.

### Task Completion


| Task                  | Status                                |
| --------------------- | ------------------------------------- |
| cert-cn-helper        | ✅ Completed                           |
| dev-show-module       | ✅ Completed                           |
| mismatch-refresh-copy | ✅ Completed (see Fix copy note below) |
| cli-tests             | ✅ Completed                           |


- **Completion (frontmatter todos)**: 4/4 marked completed.

### File Existence Validation


| File                                                                                                                              | Status |
| --------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `lib/utils/dev-cert-helper.js` (`getCertSubjectDeveloperId`, `parseDeveloperIdFromX509SubjectOutput`, `developerIdsMatchNumeric`) | ✅      |
| `lib/commands/dev-show-display.js`                                                                                                | ✅      |
| `lib/cli/setup-dev.js` (imports `displayDevConfig` from commands)                                                                 | ✅      |
| `tests/lib/utils/dev-cert-helper.test.js`                                                                                         | ✅      |
| `tests/lib/cli.test.js` (dev show / set-id / set-format)                                                                          | ✅      |
| `tests/lib/commands/dev-show-display.test.js`                                                                                     | ✅      |


### Test Coverage

- ✅ Unit tests for CN parsing and OpenSSL subject (`dev-cert-helper.test.js`).
- ✅ CLI handler expectations updated (`cli.test.js`).
- ✅ Display module tests: **with** and **without** `remote-server`, TLS variants, mismatch (`dev-show-display.test.js`).
- Scoped check: `dev-show-display.test.js`, `dev-cert-helper.test.js`, and `cli.test.js` (dev-related) pass.
- ⚠️ Full `npm test`: **fails** (2 tests, Windows path normalization in config/config-paths suites).

### Code Quality Validation


| Step                        | Result                                                   |
| --------------------------- | -------------------------------------------------------- |
| Format (`npm run lint:fix`) | ✅ PASSED (exit 0)                                        |
| Lint (`npm run lint`)       | ✅ PASSED (0 errors, 0 warnings)                          |
| Test (`npm test`)           | ❌ FAILED — 2 failures (see above), 269/271 suites passed |


### Cursor Rules Compliance (spot check)

- ✅ CommonJS, `logger` / `chalk` for CLI output, `path.join` where applicable.
- ✅ JSDoc on public cert helpers and module `@fileoverview`.
- ✅ No PEM/private key logging in display path; cert metadata only.
- ✅ File size: `dev-show-display.js` ~425 lines, `dev-cert-helper.js` ~347 lines (both ≤500).
- ⚠️ **Plan vs product copy**: Original plan Fix line specified `aifabrix dev refresh`; refined UX uses `**af dev sync`** in `dev-show-display.js`. Align product/docs with whichever command is canonical.

### Implementation Completeness (plan scope)

- ✅ Certificate subject parsing and numeric id equivalence.
- ✅ Grouped sections; Remote + Identity only when `remote-server` is truthy (after trim).
- ✅ Single Home/Work from paths; Integrations (Secrets API / Mutagen); Configuration fallbacks when no remote.
- ✅ Mismatch: inline ⚠️ on certificate line + block with Config ID / Certificate ID.
- N/A (not in plan): database, migrations, REST API, docs updates.

### Issues and Recommendations

1. **Full test suite**: Fix or normalize `config-paths.test.js` / `config.test.js` expectations on Windows (use `path.resolve` or `path.normalize` in assertions), or run CI on POSIX-only if intentional.
2. **Fix command**: Reconcile `aifabrix dev refresh` (plan / onboarding) vs `af dev sync` (current mismatch block) with product naming (`af` is an alias in `package.json` bin).
3. **Optional**: Run `npm run test:coverage` on changed files if the team tracks ≥80% on new code formally.

### Final Validation Checklist

- All plan todos completed (implementation + tests for this feature)
- All plan-scoped files exist
- Plan-scoped tests exist and pass
- Lint passes (0 errors, 0 warnings)
- Full `npm test` passes on this machine (blocked by 2 unrelated failures)
- Cursor rules spot-check: no critical violations in changed modules

