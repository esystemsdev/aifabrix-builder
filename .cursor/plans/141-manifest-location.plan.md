# Plan 141 — Canonical manifest location, single resolver, CLI transparency

## Status

**Shipped (P0–P3 registry scan):** Resolver (`manifest-location.js`), gray **Manifest:** / `manifestSource` (`manifest-source-emit.js`), setup REPLACE absolute paths, `paths.js` / matrix wiring; **Phase P3** for `urls.local.yaml` refresh: **`urls-local-registry.js`** uses **`buildCanonicalRegistryScanDirs`** (system builder → **`getBuilderRoot()`** → `projectRoot/builder` → packages → cwd checkout `builder/`, de-duplicated). **`urls-local-registry-scan.js`** picks one config per `app.key` by **scan order** (later dir wins); **no cross-root mtime merge** and **no `AIFABRIX_BUILDER_DIR` ordering** or `appendCwdProjectBuilderDirIfDistinct`.

**CI / Jest:** Plan-scoped suites that touch real **`paths`** / config dirs run in **isolated Jest projects** (`jest.projects.js`, `jest.config.isolated.js`) so `jest.mock('…/paths')` from the default worker cannot leak; see **Plan tests (inventory)** below. Required for green **`npm run build:ci`** (`test:ci` → `ci-simulate.sh`).

## Plan tests (inventory)

| Test file | Plan phase | Isolated Jest project (`--selectProjects`) | Notes |
| --------- | ---------- | ------------------------------------------- | ----- |
| `tests/lib/utils/manifest-location.test.js` | P1 | `manifest-location` | Resolver tiers, `AIFABRIX_CONFIG` / `resetModules` per test |
| `tests/lib/utils/manifest-source-emit.test.js` | P2 | `manifest-source-emit` | Gray **Manifest:** / `manifestSource` helpers |
| `tests/lib/utils/urls-local-registry.test.js` | P3 | `urls-local-registry` | `refreshUrlsLocalRegistryFromBuilder`, canonical scan order, last-wins merge (no mtime) |
| `tests/lib/utils/installation-log.test.js` | (CI / Plan 140) | `installation-log` | Append/mask/rotate; isolated so **`paths`** mocks from other files do not break I/O |
| `tests/lib/commands/setup-prompts-format-paths.test.js` | P0b | *(default suite)* | `formatBuilderPlatformReplaceLines` — absolute REPLACE lines |

**Configuration:** `jest.projects.js` — each isolated file is listed in `defaultProject.testPathIgnorePatterns` **and** in `isolatedProjects` via `makeIsolatedProject(...)`.

**Commands (from repo root `aifabrix-builder/`):**

- Full gate: **`npm run build:ci`** (lint → `check:schema-sync` → `check:flags` → `test:ci` / `tests/scripts/ci-simulate.sh`).
- Default + isolated (same as **`npm test`**): **`node tests/scripts/test-wrapper.js`** (see `package.json` **`test`** script).
- One isolated project: **`npx jest --config jest.config.isolated.js --selectProjects <id> --runInBand`** (examples: `manifest-location`, `manifest-source-emit`, `urls-local-registry`, `installation-log`).

## Problem

Developers lose trust when:

- Multiple trees (`cwd` repo, `getProjectRoot()` CLI package, `AIFABRIX_HOME` / config `builder/`, `AIFABRIX_BUILDER_DIR`, ad-hoc multi-root ordering) compete for `application.yaml` / `variablesPath`.
- `urls.local.yaml` and resolve paths drift from “the folder I am editing”.
- There is no **one** validated rule set and no **visible** line in TTY output saying which path was used.

## Goal

1. **Single canonical search order** for on-disk application manifest discovery (where the CLI loads `application.yaml` / resolved config path for URL registry, resolve, run, build, platform flows — exact call graph to be consolidated in implementation).
2. **One module** owns validation of “allowed roots” + system-app allowlist; callers ask it for a result object `{ absolutePath, tier, appKey }` (shape TBD).
3. **CLI matrix** documents, per leaf command, whether manifest disk roots apply (see `.cursor/rules/cli-output-command-matrix.md` third column).
4. **TTY**: after success (or early in header where product prefers), emit **one gray metadata line** (per `layout.md` **Metadata** = gray via `metadata()` / `infoLine` in `lib/utils/cli-test-layout-chalk.js`) stating **which path was picked** (human-readable absolute path + tier label). `--json` / stdout-only commands either omit or include a stable `manifestSource` field (decision in implementation; matrix notes json-opt rows).
5. **`aifabrix setup` (guided / fresh install):** any prompt that describes **where** the CLI will write or **replace** platform material must show **full absolute paths** for the builder root and for each affected `keycloak` / `miso-controller` / `dataplane` directory (same transparency rule as § CLI output). Today the conflict prompt shows an absolute `builderRoot` but lists replacements as relative `builder/<app>/` only — see **Guided setup** below.

## Overview

Deliver one canonical on-disk manifest resolver (Tier 1 cwd + Tier 2 **aifabrix-work** else **aifabrix-home** for platform apps), wire it through resolve/registry/platform flows, emit a single gray **Manifest:** line where the matrix requires **141**, fix guided **setup** REPLACE paths to absolute, reconcile **`getSystemBuilderRoot()`** with Tier 2, and keep **`.cursor/rules/cli-output-command-matrix.md`** / **`.cursor/rules/cli-layout.mdc`** aligned.

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc) and CLI layout rules:

- **[CLI layout and output](.cursor/rules/project-rules.mdc#cli-layout-and-output)** — Points to [cli-layout.mdc](.cursor/rules/cli-layout.mdc), [layout.md](.cursor/rules/layout.md), and [cli-output-command-matrix.md](.cursor/rules/cli-output-command-matrix.md); manifest gray line and setup path copy must match the matrix and layout spec.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** — Commander wiring, chalk/UX, validation, tests for touched commands (`setup`, `resolve`, platform `up-*`, etc.).
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** — ≤500 lines per file, ≤50 lines per function, JSDoc on new public exports in `manifest-location.js` and helpers.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** — Jest in `tests/`, mocks for fs/http as needed; new resolver and setup-prompt changes get unit tests.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** — Structured, actionable errors from the resolver; never log secrets or full tokens; chalk for CLI errors.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** — Path validation / no traversal when resolving manifests; no hardcoded secrets.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** — Mandatory pre-commit checks (build, lint, tests, coverage for new code).

**Key requirements (extract)**

- Update or add matrix rows when leaf command behavior changes; follow **cli-layout.mdc** for new gray metadata lines.
- Use `path.join` / `path.resolve` for all composed paths; normalize cwd.
- Add Jest coverage for `lib/utils/manifest-location.js` and **P0b** setup prompt changes.

## Before Development

- [x] Read **CLI layout** ([cli-layout.mdc](.cursor/rules/cli-layout.mdc)) and **matrix** ([cli-output-command-matrix.md](.cursor/rules/cli-output-command-matrix.md)) **141** / **141+** rows for commands in scope.
- [x] Grep call sites for `getResolveAppPath`, `refreshUrlsLocalRegistryFromBuilder`, `getSystemBuilderRoot`, `urls-local-registry` (per plan Notes).
- [x] Confirm open questions (Tier 1a shape, JSON field, `getSystemBuilderRoot` vs Tier 2) with product or document decisions in PR.

## Definition of Done

Before closing the implementation PR(s) for this plan:

1. **Lint**: `npm run lint` — zero ESLint errors/warnings on touched files (run from repo root `aifabrix-builder/`).
2. **Tests**: `npm test` — all tests pass (100% for default suite); new code aims for **≥80%** branch coverage on added modules per project rules.
3. **Build**: `npm run build` — must succeed (**runs `lint` then `test`** per `package.json`; same gate as `npm run validate`).
4. **CI parity (PR / pre-merge)**: `npm run build:ci` — lint + schema sync + flag map check + `test:ci` as used in GitHub-style pipelines.
5. **Validation order**: run **lint** and **tests** to green before merge; do not skip **`build`** / **`build:ci`** when required by team process.
6. **File / function limits**: new/changed files ≤**500** lines; new functions ≤**50** lines (split if needed).
7. **JSDoc**: all new **public** functions in `lib/utils/manifest-location.js` (and any new exported helpers) documented per [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards).
8. **Security**: no secrets in logs or errors; paths resolved safely.
9. **Docs / matrix**: user-facing docs listed under **Documentation to update** stay accurate; matrix **141** legend matches shipped Tier 2 behavior.
10. **Phases**: P0b–P3 exit criteria in this plan satisfied for shipped slices; follow-up issues only for optional tests or Tier-1a / `getSystemBuilderRoot` open questions.

## Canonical search order (normative)

**Tier 1 — Current working directory (cwd)**

1. `path.join(cwd, 'integration', <systemKey>)` — when resolving an **external system** / integration key (folder name = system key). Used when the command’s target is an integration system, not a generic builder app.
2. `path.join(cwd, 'builder', <appKey>)` — **builder app** under the repo the developer is in.

**Tier 2 — System platform apps under workspace or home**

3. `path.join(<systemPlatformParent>, 'builder', <appKey>)` **only if** `<appKey>` is one of:

   - `keycloak`
   - `miso-controller`
   - `dataplane`

   **`<systemPlatformParent>`** (where platform system apps are materialized):

   - If **`aifabrix-work`** / **`AIFABRIX_WORK`** resolves to a path (same semantics as `getAifabrixWork()` in `lib/utils/paths.js`: env overrides YAML), use that directory.
   - **Else** use resolved **`aifabrix-home`**: the root used for `config.yaml` / `secrets.local.yaml` / `urls.local.yaml` (config key **`aifabrix-home`**, env **`AIFABRIX_HOME`**, default **`~/.aifabrix`**). Example when work is unset: **`/workspace/.aifabrix`**.

   Tier 2 paths are then e.g. **`<systemPlatformParent>/builder/miso-controller/`** (under work when set, under home when work is empty / not configured).

   **Not** the `aifabrix-builder` package root and **not** `getProjectRoot()` for this tier.

   **No** separate `AIFABRIX_BUILDER_DIR` scan for Tier 2, **no** mtime merge across arbitrary extra roots for the canonical picker — **nothing else** for Tier 2 beyond **work → else home** + `builder/<systemApp>`.

**Not found**

- Fail with one structured error from the single validator (clear message: tried tier 1a, 1b, 2 with listed paths).

### Notes and edge cases (implementation checklist)

- **cwd** must be normalized (`path.resolve(process.cwd())`). If cwd has no `package.json`, Tier 1 may still allow `builder/<app>` / `integration/<system>` if directories exist (confirm with product; default: require existence only, not package.json).
- **External vs builder app**: resolver API takes `targetKey` + `mode: 'integration' | 'builder' | 'auto'` (exact enum TBD) so Tier 1a vs 1b is unambiguous.
- **Today’s code** (`lib/utils/paths.js`, `getResolveAppPath`, `refreshUrlsLocalRegistryFromBuilder`, etc.): prefer **thin-wrapping** the manifest resolver where possible to avoid drift. **`urls.local.yaml` refresh** (plan 141 P3) now uses canonical scan dirs + last-wins merge in `urls-local-registry.js` / `urls-local-registry-scan.js`.
- **Regression risk**: callers that assumed Tier 2 was the Builder **package** repo must switch to **`getAifabrixWork() ?? getAifabrixHome()`** + `builder/<systemApp>`; document in `docs/` when behavior ships.
- **Code vs plan:** `getSystemBuilderRoot()` today uses `resolveSystemBuilderParentDir(getAifabrixSystemDir(), getAifabrixHome())` and may **diverge** from **work → else home**; implementation of plan 141 must **reconcile** Tier 2 with that helper (or replace it) so manifest discovery and materialization use the same parent.

### Documentation to update (validated)

Keep user-facing docs aligned with Tier 2 (**work if set, else home**) when plan 141 ships; matrix legend must match.

| Area | File | Change |
| ---- | ---- | ------ |
| Plan + matrix | This plan; `.cursor/rules/cli-output-command-matrix.md` | Tier 2 parent = **work if set, else home** (**141** / **141+** legend). |
| Config reference | `docs/commands/reference.md` | Under **`aifabrix-work`** / **`aifabrix-home`**: platform **`builder/keycloak`**, **`builder/miso-controller`**, **`builder/dataplane`** follow **work → else home**. |
| Developer isolation | `docs/commands/developer-isolation.md` | **`aifabrix dev set-work`**: same rule in prose (platform materialization parent). |
| Infra commands | `docs/commands/infrastructure.md` | Where text implied **`~/.aifabrix/builder/...`** only for `--force` / reinstall, clarify **resolved** parent (**work** when set, else **home**). |
| Config overview | `docs/configuration/secrets-and-config.md` | Optional one-line in **Important fields** or **`aifabrix-work`** narrative: platform `builder/` trees anchor on work when set. |
| URL registry | `docs/configuration/resolve-running-urls.md` | Only if copy still says “home only” for platform apps; should match **work-then-home** once code does. |

**Doc pass (2026-05-13):** plan + matrix + `reference.md` + `developer-isolation.md` + `infrastructure.md` + `secrets-and-config.md` updated for Tier 2 wording; **`resolve-running-urls.md`** left unchanged (no home-only claim today).

**Already consistent (no Tier 2 wording change required):** `docs/configuration/env-config.md` (relative path resolution work-then-home). **`declarative-urls.md`**, **`infra-parameters.md`**: generic `builder/<app>` — no platform-parent claim unless a sentence explicitly pins platform apps to home only.

## Single module (design)

**Proposed path:** `lib/utils/manifest-location.js` (name final in PR).

**Responsibilities**

- Export `resolveApplicationManifestPath({ appKey, systemKey, mode, cwd })` (signature TBD); resolve **Tier 2** parent from **`getAifabrixWork()`** when set, else **`getAifabrixHome()`**, matching **`aifabrix-work`** / **`aifabrix-home`** in `config.yaml` (and env overrides).
- Enforce system-app allowlist for Tier 2.
- Optional: `assertManifestWithinCanonicalRoots(absPath)` for defense-in-depth when reading files passed from outside.
- Unit tests: see **Plan tests (inventory)** (`tests/lib/utils/manifest-location.test.js`, isolated project **`manifest-location`**).

**Non-goals in first slice**

- Changing Controller/dataplane HTTP behavior.
- Rewriting all of `detectAppType` in one PR — **incremental**: new resolver used first by `urls.local.yaml` refresh + `resolve`, then expand.

## CLI output

- **Helper:** `metadata('Manifest: …')` or dedicated `formatManifestSourceLine(result)` in `cli-test-layout-chalk.js` (one place for string shape: `Manifest: <tier> — <absPath>`).
- **Matrix:** third column “Manifest roots (141)” — legend in matrix file; each leaf row tagged `141`, `141±`, `int`, `—` (see matrix).
- **cli-layout.mdc:** add bullet: new manifest line is **required** for commands tagged `141` when a manifest was read; use gray metadata.

## Guided setup — full paths (`aifabrix setup`)

**Observed UX** (example): the “Existing builder folder detected” block prints an absolute builder root (`/home/dev02/workspace/builder`) but the REPLACE list uses **relative** segments only:

```text
This setup path will REPLACE the platform app folders under:
  builder/keycloak/
  builder/miso-controller/
  builder/dataplane/
```

**Requirement (plan 141):** every path the user is told will be **replaced or written** must be **absolute** (resolved), e.g.:

```text
This setup path will REPLACE the platform app folders under:
  /home/dev02/workspace/builder/keycloak/
  /home/dev02/workspace/builder/miso-controller/
  /home/dev02/workspace/builder/dataplane/
```

**Implementation anchor:** `lib/commands/setup-prompts.js` → `promptBuilderDirConflict` — today builds the list with `` `${platformApps.map(a => `builder/${a}/`).join('\n  ')}` `` (lines ~352–359). Change to ``path.resolve(builderRoot, a)`` (or `path.join` + `path.resolve` once) per app, and apply the same rule anywhere else `setup` / `setup-modes` / guided flows echo “platform app folders” (grep for `REPLACE`, `builder/keycloak`, `platform app`).

**Layout:** use **gray metadata** for path lists if they are secondary to the question (per `layout.md`); keep the inquirer **message** readable (no path truncation).

## Phases

| Phase | Scope | Exit criteria |
| ----- | ----- | ------------- |
| P0 | This plan + matrix column + layout rule pointer + **setup full-path copy** spec (Guided setup) | Review approved |
| P0b | Implement setup prompt path formatting (`setup-prompts.js` + tests) | REPLACE block lists only resolved absolute paths; manual `af setup` check |
| P1 | Implement `manifest-location.js` + tests; wire `resolve` + `refreshUrlsLocalRegistryFromBuilder` | CI green; manual `af resolve miso-controller` from `aifabrix-miso` picks `cwd/builder/...` |
| P2 | Wire `run`, `build`, `up-miso`, `up-dataplane`, `up-platform`, `json`, `validate`, `show` | Matrix verified; gray line in each |
| P3 | Registry refresh: canonical scan roots + deterministic merge (plan 141) | **`urls-local-registry.js` / `urls-local-registry-scan.js`**: fixed dir order, last-wins per `app.key`; no mtime merge; `resolveApplicationConfigPath` per folder (yaml/yml/json) |

## References

- `lib/commands/setup-prompts.js` — `promptBuilderDirConflict` (setup REPLACE path copy; plan § Guided setup).
- Resolve **`<systemPlatformParent>`** via **`getAifabrixWork()`** then **`getAifabrixHome()`** (see `lib/utils/paths.js`). Reconcile with **`getSystemBuilderRoot()`** / **`resolveSystemBuilderParentDir`** during implementation so materialization and manifest Tier 2 stay aligned.
- `lib/utils/urls-local-registry.js` — registry refresh (today).
- `.cursor/rules/cli-output-command-matrix.md` — matrix third column.
- `.cursor/rules/layout.md` — Metadata gray line.
- `.cursor/rules/cli-layout.mdc` — compliance checklist.

## Open questions

1. Tier 1a: confirm **only** `integration/<systemKey>` (not `integration/<app>` for non-external).
2. ~~JSON output shape for `aifabrix app show` / `resolve --json`~~ — **`manifestSource`**: `{ tier, tierLabel, configPath }` (`tierLabel` is human-readable, e.g. `cwd/builder`). Present on **`aifabrix resolve --json`**, **`validate <app> --format json`** (single-app), **`show --json`** / **`show --online --json`** when a local tree can be resolved.
3. **`getSystemBuilderRoot()`** vs **`<systemPlatformParent>`:** confirm single rule when `aifabrix-home` points at `$HOME` but config lives under `~/.aifabrix/` — product intent here is **work → else home** for the **three** platform keys; edge cases currently handled by `resolveSystemBuilderParentDir` must be folded or explicitly deprecated.

## Plan Validation Report

**Date**: 2026-05-13  
**Plan**: `.cursor/plans/141-manifest-location.plan.md`  
**Status**: ✅ VALIDATED

### Plan purpose

Unify on-disk manifest discovery and CLI transparency (gray **Manifest:** line, absolute **setup** REPLACE paths, single resolver module) with Tier 2 parent **aifabrix-work** (resolved) **else** **aifabrix-home** for `keycloak` \| `miso-controller` \| `dataplane`. **Type:** Development (CLI + `lib/utils`) with documentation and matrix updates. **Scope:** `lib/utils/paths.js` reconciliation, new `manifest-location.js`, `urls-local-registry.js`, `setup-prompts.js`, phased wiring across resolve/run/build/platform commands.

### Applicable rules

- ✅ [CLI layout and output](.cursor/rules/project-rules.mdc#cli-layout-and-output) — Matrix + gray metadata + setup copy; referenced in **Rules and Standards**.
- ✅ [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development) — Commands and UX touched across phases.
- ✅ [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) — File/function limits and JSDoc.
- ✅ [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) — Jest tests for new module and setup changes.
- ✅ [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) — Captured in **Definition of Done** (`npm run build` / `build:ci`, lint, tests, coverage).
- ✅ [Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging) — Resolver and CLI error paths.
- ✅ [Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) — No secret leakage; safe path handling.

### Rule compliance

- ✅ **DoD**: Documented with repo-accurate scripts (`npm run build` = lint + test; `npm run build:ci` for CI parity).
- ✅ **Quality gates / file limits / JSDoc**: Explicit in **Definition of Done**.
- ✅ **CLI layout**: Plan already references **cli-layout.mdc**, **layout.md**, **cli-output-command-matrix.md**; **Rules and Standards** now ties them to **project-rules.mdc**.

### Plan updates made

- ✅ Added **Overview**, **Rules and Standards**, **Before Development**, and **Definition of Done** sections.
- ✅ Appended this **Plan Validation Report**.

### Recommendations

- **`getSystemBuilderRoot` vs Tier 2** (`getSystemBuilderRoot` vs `<systemPlatformParent>`): confirm there is no remaining double semantics on disk; resolve in a small follow-up if grep finds drift.
- ~~When implementing **P0b**, add a focused Jest test for absolute REPLACE lines~~ — ✅ **`tests/lib/commands/setup-prompts-format-paths.test.js`**.
- After code ships, re-scan **Documentation to update** table and **`resolve-running-urls.md`** if registry copy mentions platform-app roots.

---

_Plan file: `.cursor/plans/141-manifest-location.plan.md` (basename 141 per plan naming)._

## Implementation Validation Report

**Date**: 2026-05-14 (UTC, consolidated)  
**Plan**: `.cursor/plans/141-manifest-location.plan.md`  
**Status**: ✅ **P0–P3 (registry refresh slice)** shipped in code + docs/matrix pass; optional follow-ups below.

### Executive summary

**P0b** (setup REPLACE absolute paths), **P1** (`manifest-location.js` + `getResolveAppPath` / `paths.js` wiring), **P2** (gray **Manifest:** + `manifestSource` JSON where specified), and **P3** (`urls-local-registry` canonical scan dirs + last-wins merge, no mtime / no `AIFABRIX_BUILDER_DIR` scan ordering) are implemented with unit tests. **Before Development** checkboxes in this file are **`[x]`**.

### Task completion (plan markdown)

| Area | State |
| ---- | ----- |
| **Before Development** (§ Before Development) | ✅ All three items `[x]` in this file |
| **Phases P0–P2** (phases table) | ✅ Implemented in code (resolver, setup paths, manifest emit + wiring) |
| **Phase P3 (full exit)** | ✅ Registry refresh canonical scan + deterministic merge shipped (`urls-local-registry*`) |
| **Definition of Done** (§ Definition of Done) | ✅ Lint / tests / `build:ci` green when last validated; re-run before each release PR |

### File existence validation

| Item | Result |
| ---- | ------ |
| `lib/utils/manifest-location.js` | ✅ Present (~163 lines) |
| `lib/utils/manifest-source-emit.js` | ✅ Present (~128 lines) |
| `lib/utils/urls-local-registry.js` | ✅ Present (P3 canonical scan dirs) |
| `lib/utils/urls-local-registry-scan.js` | ✅ Present (last-wins merge per `app.key`) |
| `tests/lib/utils/manifest-location.test.js` | ✅ Present; isolated **`manifest-location`** |
| `tests/lib/utils/manifest-source-emit.test.js` | ✅ Present; isolated **`manifest-source-emit`** |
| `tests/lib/utils/urls-local-registry.test.js` | ✅ Present; isolated **`urls-local-registry`** (P3) |
| `tests/lib/utils/installation-log.test.js` | ✅ Present; isolated **`installation-log`** (Plan 140; CI stability with `paths`) |
| `tests/lib/commands/setup-prompts-format-paths.test.js` | ✅ Present (`formatBuilderPlatformReplaceLines`; default suite) |
| `lib/commands/setup-prompts.js` | ✅ `formatBuilderPlatformReplaceLines` uses `path.resolve(path.join(root, a))` for REPLACE list |
| `.cursor/rules/cli-output-command-matrix.md` | ✅ Referenced in plan; third column **141** / **141+** in repo |
| `lib/utils/paths.js` | ✅ `getResolveAppPath` integrates `manifest-location` (lazy require) |

### Test coverage

See **Plan tests (inventory)** (paths isolated where required). Summary:

- ✅ **`manifest-location`**, **`manifest-source-emit`**, **`urls-local-registry`**, **`installation-log`** — isolated projects; **`setup-prompts-format-paths`** — default suite.
- ✅ **`npm test`** / **`test:ci`** via **`build:ci`** green when last validated (default + isolated aggregate).

### Code quality validation

| Step | Result |
| ---- | ------ |
| **STEP 1 – `npm run lint:fix`** | ✅ PASSED (exit 0) |
| **STEP 2 – `npm run lint`** | ✅ PASSED (0 ESLint errors/warnings) |
| **STEP 3 – `npm test`** | ✅ PASSED (exit 0) |
| **`npm run build:ci`** (lint + `check:schema-sync` + `check:flags` + `test:ci`) | ✅ PASSED |

### Cursor rules compliance (spot-check)

- ✅ **Paths**: `path.join` / `path.resolve` used in setup REPLACE helper; manifest modules use `path` consistently.
- ✅ **Logging**: New emit paths use `logger` + shared `metadata()` from `cli-test-layout-chalk` (no raw `console.log` in touched emit utilities).
- ✅ **Module style**: CommonJS exports; JSDoc on new public helpers in plan-scoped files.
- ✅ **File size**: `manifest-location.js` and `manifest-source-emit.js` under **500** lines; `paths.js` pre-existing & large (tracked separately per repo policy).

### Implementation completeness vs plan sections

| Requirement | Notes |
| ----------- | ----- |
| Single resolver module | ✅ `manifest-location.js` with tests |
| Setup absolute REPLACE paths | ✅ `formatBuilderPlatformReplaceLines` + tests |
| Gray **Manifest:** TTY + matrix-facing commands | ✅ `manifest-source-emit.js`; wired via `setup-utility`, `run`, `build`, `show`, `validate`, platform `up-*` / guided infra per recent implementation |
| **JSON `manifestSource` field** | ✅ `resolve --json`, `validate --format json` (single app), `show --json` |
| **P3** registry scan / merge | ✅ **Shipped (2026-05-14)** — canonical `buildCanonicalRegistryScanDirs` + last-wins merge in `urls-local-registry-scan.js` (no mtime, no `AIFABRIX_BUILDER_DIR` scan order) |
| Plan **Status** / **Before Development** | ✅ Aligned with shipped work (see top of file) |

### Issues and recommendations

1. **Open questions** (§ Open questions): Tier **1a** scope and **`getSystemBuilderRoot` vs `<systemPlatformParent>`** edge cases remain for a focused PR if behavior still diverges anywhere on disk.
2. **Goal §1 “single call graph”**: Resolver is **`resolveApplicationManifestPathSync`** wired from **`paths.js`** (`getResolveAppPath` / related); not every historical manifest read path may yet go through it — grep when tightening further.
3. **Optional**: Integration or CLI snapshot tests for **Manifest:** lines if TTY output proves flaky in CI.

### Final validation checklist

- [x] All plan markdown tasks / checkboxes updated to reflect reality  
- [x] Resolver + emit + setup path files exist and behave as specified in code  
- [x] Targeted unit tests exist and pass  
- [x] `npm run lint:fix` → `npm run lint` → `npm test` → **`npm run build:ci`** all green  
- [x] Matrix + docs pass noted in plan **Documentation to update** / doc pass (2026-05-13)  
- [x] **Plan tests (inventory)** section documents Jest isolation + commands (`npm test`, `build:ci`, `--selectProjects`)

---

## Implementation Validation Report (follow-up)

**Date**: 2026-05-13  
**Scope:** `getManifestSourcePayload` + **`resolve --json`**; **`manifestSource`** on **`validate --format json`** (single app) and **`show --json`**; **`urls-local-registry`** per-folder config via **`resolveApplicationConfigPath`** + **`loadConfigFile`** (including **`application.json`**); plan **Status** / **Before Development** / P3 table / open question 2 updated.

Re-run from `aifabrix-builder/`: **`npm run lint:fix`**, **`npm run lint`**, **`npm test`**, **`npm run build:ci`**, and isolated **`npx jest --config jest.config.isolated.js --selectProjects urls-local-registry`** (or **`manifest-location`**, **`manifest-source-emit`**, **`installation-log`**) after touching those modules or their tests.
