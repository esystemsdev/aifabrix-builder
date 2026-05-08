---
name: CLI style gap audit
overview: "Audit of aifabrix-builder CLI commands against [cli-layout.mdc](workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc), [layout.md](workspace/aifabrix-builder/.cursor/rules/layout.md), and [cli-output-command-matrix.md](workspace/aifabrix-builder/.cursor/rules/cli-output-command-matrix.md): which leaf commands still violate canonical glyphs and shared chalk helpers, and what to change."
todos:
  - id: p1-wizard-glyphs
    content: Replace \u2713 with canonical ✔ + helpers in wizard-*.js files
    status: completed
  - id: p2-raw-green
    content: Migrate login, secure, dev-*, setup-infra TLS, infra-guided, deploy, external-system-local-test-tty to formatSuccessLine/successGlyph
    status: completed
  - id: p3-create-next-steps
    content: Refactor app/display.js Next steps to formatNextActions / section pattern
    status: completed
  - id: p4-matrix-docs
    content: Shrink cli-output-command-matrix Backlog after fixes; optional grep gate in CI/docs
    status: completed
isProject: false
---

# CLI layout compliance gap list

## Overview

Static audit of AI Fabrix Builder CLI leaf commands against canonical terminal layout: glyphs (**✔ ✖ ⚠ ⏭**), shared helpers in [`lib/utils/cli-test-layout-chalk.js`](workspace/aifabrix-builder/lib/utils/cli-test-layout-chalk.js), and per-command output profiles in [`cli-output-command-matrix.md`](workspace/aifabrix-builder/.cursor/rules/cli-output-command-matrix.md). This document lists prioritized fixes (wizard glyph drift, raw `chalk.green` success lines, `create` next-steps structure, optional follow-ups).

**Scope:** `lib/commands/**`, `lib/cli/**`, `lib/utils/**`, `lib/app/**` as cited in the tables below. **Plan type:** Refactoring (CLI UX consistency) and documentation updates (matrix backlog).

**Sources of truth:** [cli-layout.mdc](workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc), [layout.md](workspace/aifabrix-builder/.cursor/rules/layout.md), [cli-output-command-matrix.md](workspace/aifabrix-builder/.cursor/rules/cli-output-command-matrix.md). The matrix **Backlog** already calls out wizard (`\u2713`), **dev-***, **secure**, and raw `chalk.green` success lines.

**Method:** Static scan for non-canonical success glyphs and raw green success lines (excluding [`cli-test-layout-chalk.js`](workspace/aifabrix-builder/lib/utils/cli-test-layout-chalk.js), which defines canonical behavior).

## Rules and standards

Work must align with [project-rules.mdc](workspace/aifabrix-builder/.cursor/rules/project-rules.mdc) and the specialized CLI layout docs:

- **[CLI layout and output](.cursor/rules/project-rules.mdc#cli-layout-and-output)** — Use [cli-layout.mdc](workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc), [layout.md](workspace/aifabrix-builder/.cursor/rules/layout.md), and [cli-output-command-matrix.md](workspace/aifabrix-builder/.cursor/rules/cli-output-command-matrix.md); update the matrix when profiles or helper adoption change.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** — Commander patterns, chalk UX, tests for changed behavior, actionable errors.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** — Jest; extend [`tests/lib/utils/cli-test-layout-chalk.test.js`](workspace/aifabrix-builder/tests/lib/utils/cli-test-layout-chalk.test.js) when helper behavior changes.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** — Files ≤500 lines, functions ≤50 lines, JSDoc on public functions.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** — `npm run build`, lint clean, all tests pass, ≥80% coverage for new code.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** — No secrets in logs or terminal output.

**Canonical implementation map:** [cli-layout.mdc](workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc) + [`layout.md`](workspace/aifabrix-builder/.cursor/rules/layout.md) (helper map to `cli-test-layout-chalk.js`).

## Before development

- [ ] Read [cli-layout.mdc](workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc) and the helper map in [layout.md](workspace/aifabrix-builder/.cursor/rules/layout.md).
- [ ] Cross-check each affected command’s **output profile** in [cli-output-command-matrix.md](workspace/aifabrix-builder/.cursor/rules/cli-output-command-matrix.md) (e.g. **delegate** vs **tty-summary** vs **stream-logs**) so refactors do not force **layout-blocks** where the matrix says not to.
- [ ] For infra/login/deploy paths, confirm whether output is user TTY vs script-oriented before changing structure.

## Definition of Done

Before closing this plan:

1. **Build:** Run `npm run build` from the repo root **first**. Per [`package.json`](workspace/aifabrix-builder/package.json), this runs `npm run lint` then `npm test` and must succeed.
2. **Lint:** Zero ESLint errors and warnings (`npm run lint`, also run as part of build).
3. **Test:** All unit tests pass (`npm test`, included in build). For CI parity, optionally run `npm run build:ci` (adds `check:schema-sync`, `check:flags`, `test:ci`).
4. **Validation order:** Use `npm run build` as the primary gate (lint before tests); do not skip steps.
5. **Code quality:** Respect file ≤500 lines and function ≤50 lines per [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards).
6. **JSDoc:** New or materially changed public functions documented.
7. **Coverage:** ≥80% for new code per [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates).
8. **Security:** No hardcoded secrets; no sensitive data in CLI output.
9. **Matrix:** Update the **Layout compliance / Backlog** section in [cli-output-command-matrix.md](workspace/aifabrix-builder/.cursor/rules/cli-output-command-matrix.md) when debt is resolved.
10. **Todos:** All YAML frontmatter todos marked completed.

---

## Gap analysis

---

## Priority 1 — Wrong success glyph (`\u2713` / ✓ vs ✔)

| Command | Matrix profile | What to fix |
| -------- | --------------- | ----------- |
| **`aifabrix wizard`** | delegate | Replace all `\u2713` success prefixes with canonical **✔** via `successGlyph()` / `formatSuccessLine()` / `formatSuccessParagraph()` from [cli-test-layout-chalk.js](workspace/aifabrix-builder/lib/utils/cli-test-layout-chalk.js) (or [cli-layout-chalk.js](workspace/aifabrix-builder/lib/utils/cli-layout-chalk.js) re-export). **Files:** [wizard-core.js](workspace/aifabrix-builder/lib/commands/wizard-core.js), [wizard-core-helpers.js](workspace/aifabrix-builder/lib/commands/wizard-core-helpers.js), [wizard-headless.js](workspace/aifabrix-builder/lib/commands/wizard-headless.js), [wizard.js](workspace/aifabrix-builder/lib/commands/wizard.js), [wizard-entity-selection.js](workspace/aifabrix-builder/lib/commands/wizard-entity-selection.js). Also align the plain green line without a glyph in `wizard-core.js` (RBAC updated message) if it should read as a success line per spec. |

---

## Priority 2 — Raw `chalk.green` success lines (should use shared helpers)

| Command | Matrix profile | What to fix |
| -------- | --------------- | ----------- |
| **`aifabrix login`** | tty-summary | [login-device.js](workspace/aifabrix-builder/lib/commands/login-device.js): replace `chalk.green('✔ Authentication successful')` with `formatSuccessLine(...)` (glyph + color centralized). |
| **`aifabrix secure`** | tty-summary | [secure.js](workspace/aifabrix-builder/lib/commands/secure.js): replace inlined `  ✔ Encrypted …` with `formatSuccessLine` (or indented composite pattern consistent with [layout.md](workspace/aifabrix-builder/.cursor/rules/layout.md) § composite lines). |
| **`aifabrix dev init`** | tty-summary + stream-logs | [dev-init.js](workspace/aifabrix-builder/lib/commands/dev-init.js): migrate certificate / dev-id / SSH / config success lines from raw `chalk.green('  ✔ …')` to helpers. |
| **`aifabrix dev down`** | tty-summary | [dev-down.js](workspace/aifabrix-builder/lib/commands/dev-down.js): same for stopped sync/app messages. |
| **`aifabrix dev init`** (hosts / SSH sidecars) | (same) | [dev-hosts-helper.js](workspace/aifabrix-builder/lib/utils/dev-hosts-helper.js), [dev-init-ssh-merge.js](workspace/aifabrix-builder/lib/utils/dev-init-ssh-merge.js): success lines use raw `chalk.green` + `  ✔`; route through `formatSuccessLine` or a small dev-specific wrapper if indentation must stay. |
| **`aifabrix up-infra`** / **`up-platform`** / **`up-miso`** / **`up-dataplane`** / **`down-infra`** / **`restart`** (guided paths) | tty-summary + stream-logs | [setup-infra.js](workspace/aifabrix-builder/lib/cli/setup-infra.js): `persistTlsEnabledFlag` uses raw `chalk.green(\`✔ TLS mode …\`)` though `formatSuccessLine` is already imported — switch to helper for consistency with `persistOptionalServiceFlag`. [infra-guided.js](workspace/aifabrix-builder/lib/cli/infra-guided.js): `logUpPlatformForceCleanSummary` builds `const check = chalk.green('✔')`; use `successGlyph()` (or equivalent) so glyph+color stay canonical. |
| **`aifabrix deploy`** | tty-summary + stream-logs | [app/deploy.js](workspace/aifabrix-builder/lib/app/deploy.js): status line uses `chalk.green(\`✔ ${st}\`)` — prefer `formatSuccessLine` / shared pattern. |
| **Flows using local external test TTY** (e.g. **`aifabrix test`** paths that print the local plan layout) | stream-logs | [external-system-local-test-tty.js](workspace/aifabrix-builder/lib/utils/external-system-local-test-tty.js): per-file rows use raw green/red with embedded ✔/✖; migrate to helpers while preserving row layout. |

---

## Priority 3 — Section structure vs layout (not only glyph drift)

| Command | Matrix profile | What to fix |
| -------- | --------------- | ----------- |
| **`aifabrix create`** | tty-summary | [app/display.js](workspace/aifabrix-builder/lib/app/display.js): “Next steps” blocks use `chalk.green('\nNext steps:')` plus white numbered lines. Spec-aligned approach: **bold white** section title and **`formatNextActions`** / **`formatBulletSection`**-style bullets per [layout.md](workspace/aifabrix-builder/.cursor/rules/layout.md) (Next actions). Same file mixes `chalk.blue` labels — decide whether to keep product-specific blues or normalize section labels to gray/bold-white per spec when refactoring. |

---

## Priority 4 — Lower urgency / profile-specific (touch only when editing related code)

| Area | Notes |
| ------ | ------ |
| [app/show-display.js](workspace/aifabrix-builder/lib/app/show-display.js), [validation/validate-display.js](workspace/aifabrix-builder/lib/validation/validate-display.js), [datasource/list.js](workspace/aifabrix-builder/lib/datasource/list.js), [datasource-test-run-display.js](workspace/aifabrix-builder/lib/utils/datasource-test-run-display.js) | Mostly semantic coloring of words (“passed”, “enabled”, aggregates). Align with helpers **when those modules change**; not all lines need `formatSuccessLine` if they are table cells rather than verdict lines. |
| [external-system-readiness-display.js](workspace/aifabrix-builder/lib/utils/external-system-readiness-display.js) / [external-system-readiness-display-internals.js](workspace/aifabrix-builder/lib/utils/external-system-readiness-display-internals.js) | Summary lines use `chalk.green` for counts/status; converge with tty-summary conventions when touched. |
| [wizard-config-validator.js](workspace/aifabrix-builder/lib/validation/wizard-config-validator.js) | `console.log(chalk.green('Wizard configuration is valid'))` — no ✔; optional `formatSuccessLine` when wizard validation UX is revised. |
| [core/diff.js](workspace/aifabrix-builder/lib/core/diff.js) | Matrix classifies **`aifabrix diff`** / datasource diff as **stdout-only** with minimal chalk; green “Added Fields” may remain acceptable; only normalize if product asks for full layout-blocks there. |

---

## Commands that appear compliant from this pass

No additional gaps were found in **[setup.js](workspace/aifabrix-builder/lib/commands/setup.js)** / **[teardown.js](workspace/aifabrix-builder/lib/commands/teardown.js)** (already use `formatSuccessParagraph` / `formatSuccessLine`). **`aifabrix datasource capability *`** slice was previously aligned per matrix (“success sections use cli-test-layout-chalk”). **`lib/cli/setup-dev.js`** / **`setup-dev-path-commands.js`** no longer show `\u2713` drift in a quick scan (consistent with completed work in [129-cli_layout_adoption.plan.md](workspace/aifabrix-builder/.cursor/plans/Done/129-cli_layout_adoption.plan.md)).

---

## Completion checklist (after fixes)

1. Re-run grep for `\u2713`, `\\u2713`, and ad hoc `chalk.green(\`✔` in `lib/commands`, `lib/cli`, `lib/app` (excluding the canonical helper module).
2. Extend or snapshot-touch [tests/lib/utils/cli-test-layout-chalk.test.js](workspace/aifabrix-builder/tests/lib/utils/cli-test-layout-chalk.test.js) only if new helpers or behavior change.
3. Update the **Layout compliance / Backlog** paragraph in [cli-output-command-matrix.md](workspace/aifabrix-builder/.cursor/rules/cli-output-command-matrix.md) to reflect resolved vs remaining debt.

## Implementation Validation Report

**Date**: 2026-05-08  
**Plan**: `.cursor/plans/137-cli-style-gap-audit.plan.md`  
**Status**: ✅ COMPLETE

### Executive Summary
- **Result**: All planned CLI style-gap remediations are implemented and validated.
- **Key outcome**: Wizard and other CLI surfaces now use canonical success glyph **✔** via shared helpers; `create` output uses `formatNextActions`.

### Task Completion
- **Total tasks**: 4
- **Completed**: 4
- **Incomplete**: 0
- **Completion**: 100%

### File Existence / Change Coverage (plan-linked)
- ✅ `lib/commands/wizard-core.js`
- ✅ `lib/commands/wizard-core-helpers.js`
- ✅ `lib/commands/wizard-headless.js`
- ✅ `lib/commands/wizard.js`
- ✅ `lib/commands/wizard-entity-selection.js`
- ✅ `lib/commands/login-device.js`
- ✅ `lib/commands/secure.js`
- ✅ `lib/commands/dev-init.js`
- ✅ `lib/commands/dev-down.js`
- ✅ `lib/utils/dev-hosts-helper.js`
- ✅ `lib/utils/dev-init-ssh-merge.js`
- ✅ `lib/cli/setup-infra.js`
- ✅ `lib/cli/infra-guided.js`
- ✅ `lib/app/deploy.js`
- ✅ `lib/utils/external-system-local-test-tty.js`
- ✅ `lib/app/display.js`
- ✅ `.cursor/rules/cli-output-command-matrix.md`

### Test Coverage
- ✅ Updated unit tests to reflect new `create` “Next actions” output:
  - `tests/lib/app/app-display.test.js`
- ✅ No helper API behavior changes required updating `tests/lib/utils/cli-test-layout-chalk.test.js` (helpers reused as-is).

### Code Quality Validation (required order)
- ✅ **Format**: `npm run lint:fix`
- ✅ **Lint**: `npm run lint` (0 errors, 0 warnings)
- ✅ **Tests**: `npm test` (all tests passed)

### Cursor Rules / CLI Layout Compliance Notes
- ✅ **Glyphs**: No remaining `\u2713`/✓ occurrences under `lib/**` (wizard drift removed).
- ✅ **Shared helpers**: Success output standardized via `formatSuccessLine` / `formatSuccessParagraph` / `successGlyph` where applicable.
- ✅ **Profiles respected**: Changes stayed within each command’s declared output profile (no new layout-block wrappers introduced for stream/delegate profiles).

### Issues / Follow-ups
- None required for this plan. Remaining optional items in Priority 4 can be addressed opportunistically when those modules are edited.
