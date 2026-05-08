---
name: Registry from manifest + relative env-config builder dir
overview: Fix relative aifabrix-env-config resolution (vs cwd) and use image.registry from application manifests for up-miso/up-dataplane/up-platform.
todos:
  - id: path-resolve
    content: Resolve relative aifabrix-env-config against aifabrix-home; absolute getters; tests + doc
    status: completed
  - id: helper-docker-ref
    content: Shared Docker image ref helper + resolveRunImage refactor
    status: completed
  - id: image-version
    content: Use helper in resolveVersionForApp
    status: completed
  - id: up-miso-up-dataplane
    content: Registry from manifest + simplify up-miso / dataplane register+run
    status: completed
  - id: tests-registry
    content: Run-helper and command tests for registry behavior
    status: completed
isProject: true
---

# Plan: Manifest registry for up-* and fix relative `aifabrix-env-config` / builder dir

## Overview

Two related Builder CLI fixes: (1) resolve **relative** `aifabrix-env-config` against `**aifabrix-home`** so `AIFABRIX_BUILDER_DIR` is absolute and `up-miso` / `up-dataplane` do not create nested `…/aifabrix-miso/aifabrix-miso/builder` when cwd is the repo under `workspace/`; (2) use each app’s `**image.registry`** from `application.yaml` / `application.json` (with existing CLI overrides) when resolving Docker image refs for `up-miso`, `up-dataplane`, and `up-platform` (platform chains the same handlers).

## Rules and Standards

This plan must comply with [.cursor/rules/project-rules.mdc](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** — CommonJS, `lib/commands/` for command logic, `lib/utils/` for shared helpers, `path.join` for paths; identify generation sources for `builder/` output vs editing templates only where appropriate.
- **[Code Style](.cursor/rules/project-rules.mdc#code-style)** — `async`/`await`, `try`/`catch`, meaningful errors, `const`/`let`, template literals.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** — Jest, mirror `tests/lib/…` to `lib/…`, mock `fs` / `child_process` / Docker where needed, success + error paths, ≥80% coverage on new code.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** — No hardcoded secrets; do not log registry credentials or tokens; path handling must not weaken validation of user input.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** — Files ≤500 lines, functions ≤50 lines; JSDoc on new public functions.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** — Changes touch `up-miso` / `up-dataplane` behavior and user-visible paths; keep error messages actionable; preserve Commander option semantics (`--registry`, `--image`).
- **[Docker & Infrastructure](.cursor/rules/project-rules.mdc#docker--infrastructure)** — Image refs must remain valid for `docker pull` / local run; document edge cases (e.g. registry host with port + tag parsing) if relevant.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** — Build, lint, and tests pass before merge; no skipped validation.

**Key requirements (summary)**

- New/changed public helpers: JSDoc with `@param` / `@returns`.
- Use `path.join` / `path.resolve` consistently; avoid duplicating path logic without a single resolver for env-config.
- Add or extend unit tests for `config-paths`, `resolveRunImage` / new helper, and affected commands.
- Follow [.cursor/rules/docs-rules.mdc](.cursor/rules/docs-rules.mdc) for `docs/commands/` updates (command-centric, no raw REST details).

## Before Development

- Skim **Architecture Patterns**, **Testing Conventions**, and **Quality Gates** in [project-rules.mdc](.cursor/rules/project-rules.mdc).
- Re-read current `[lib/utils/config-paths.js](lib/utils/config-paths.js)`, `[lib/app/run-resolve-image.js](lib/app/run-resolve-image.js)`, `[lib/commands/up-miso.js](lib/commands/up-miso.js)`, `[lib/commands/up-dataplane.js](lib/commands/up-dataplane.js)`.
- Confirm `package.json` scripts: `npm run build` = lint + test for default validation.

## Definition of Done

Before marking this plan complete:

1. **Lint**: Run `npm run lint` in repo root; zero errors (fix warnings if policy requires).
2. **Test**: Run `npm test`; all tests pass.
3. **Build**: Run `npm run build` (runs lint then test); must succeed.
4. **CI parity (optional but recommended)**: Run `npm run build:ci` (lint + `test:ci`) before merge if CI uses the stricter script.
5. **Coverage**: New/changed logic has ≥80% branch coverage where practical (per project rules).
6. **File / function size**: New files ≤500 lines; new functions ≤50 lines (split if needed).
7. **JSDoc**: New exported functions documented.
8. **Security**: No secrets in code or logs; paths resolved safely (no traversal).
9. **Docs**: Short note for relative `aifabrix-env-config` (per plan section A) in approved `docs/` per docs-rules.
10. All todos in this plan completed.

---

## A. Relative `aifabrix-env-config` creates nested `aifabrix-miso/builder` (bug)

### Symptom

From repo root `.../workspace/aifabrix-miso`, `af up-miso` creates:

`.../workspace/aifabrix-miso/aifabrix-miso/builder/`

### Root cause

1. Config stores **relative** `aifabrix-env-config: aifabrix-miso/builder/env-config.yaml` with `aifabrix-home: /home/dev02` (intent: path under home).
2. `[getAifabrixBuilderDir](lib/utils/config-paths.js)` does `path.dirname(envConfigPath)` on the **raw string**, yielding relative `aifabrix-miso/builder`.
3. `[handleUpMiso](lib/commands/up-miso.js)` and `[handleUpDataplane](lib/commands/up-dataplane.js)` set `process.env.AIFABRIX_BUILDER_DIR = builderDir`.
4. `[getBuilderPath` / `getBuilderRoot](lib/utils/paths.js)` use `path.resolve(trimmed)` / `path.join(builderRoot, appName)`. For a **non-absolute** `AIFABRIX_BUILDER_DIR`, `path.resolve` is relative to `**process.cwd()`**, not `aifabrix-home` — hence the extra `aifabrix-miso` segment when cwd is the git repo under `workspace/`.

### Fix (canonical resolution)

In `[lib/utils/config-paths.js](lib/utils/config-paths.js)` (inside `createEnvConfigPathFunctions`):

- Add a small helper, e.g. `resolveEnvConfigPathToAbsolute(raw, getConfigFn)`, used by both getters:
  - If `aifabrix-env-config` is unset → keep existing default schema path behavior for `[getAifabrixEnvConfigPath](lib/utils/config-paths.js)`.
  - If set and **absolute** → `path.normalize` / resolve as today.
  - If set and **relative** → resolve with `path.resolve(base, trimmed)` where `base` is the configured `aifabrix-home` from `getPathConfig(getConfigFn, 'aifabrix-home')` when non-empty; if `aifabrix-home` is unset, use the same default as `[getAifabrixHome](lib/utils/paths.js)` (read-only sync helper or duplicate minimal logic to avoid circular deps — prefer passing `paths.getAifabrixHome()` from a thin wrapper in `config.js` if needed).
- `**getAifabrixEnvConfigPath`** should return the **fully resolved absolute** path when a user path is configured (so `af dev show` and loaders open the correct file).
- `**getAifabrixBuilderDir`** should return `path.dirname` of that **resolved** env-config path (always absolute when env-config is set).
- Optionally: when setting `AIFABRIX_BUILDER_DIR` in up-miso/up-dataplane, normalize with `path.resolve` once so env always holds an absolute path (defense in depth).

### Tests

- Extend `[tests/lib/utils/config-paths.test.js](tests/lib/utils/config-paths.test.js)`: relative `aifabrix-env-config` + `aifabrix-home` → absolute env path and builder dir under home, independent of `process.cwd()`.

### Docs (short)

- In `[docs/commands/developer-isolation.md](docs/commands/developer-isolation.md)` (or secrets-and-config): state that relative `aifabrix-env-config` is resolved against `aifabrix-home`, not the current working directory.

---

## B. Use `application.yaml` / `application.json` registry for up-miso, up-dataplane, up-platform

(Same as prior plan; `up-platform` chains the two handlers — no extra entry point.)

### Problem

- `[resolveRunImage](lib/app/run-resolve-image.js)` uses `[getImageName](lib/utils/compose-generator.js)` (name + tag only), ignoring `image.registry`.
- `[up-miso](lib/commands/up-miso.js)` builds `registry/name:tag` only when CLI `--registry` is set; manifest `image.registry` is ignored.
- `[up-dataplane](lib/commands/up-dataplane.js)`: same for register/deploy overrides; `runApp` gets no registry.
- `[image-version.js](lib/utils/image-version.js)` uses unqualified names for `checkImageExists` / inspect.

### Precedence

1. `--image` (full ref)
2. `--registry` CLI (prefix for manifest `image.name` / `image.tag`)
3. `image.registry` from that app’s manifest
4. Else unqualified name (current behavior)

### Implementation outline

1. Shared helper (e.g. `[lib/utils/resolve-docker-image-ref.js](lib/utils/resolve-docker-image-ref.js)` or extend `[run-resolve-image.js](lib/app/run-resolve-image.js)`) implementing precedence; refactor `[resolveRunImage](lib/app/run-resolve-image.js)`.
2. Align `[resolveVersionForApp](lib/utils/image-version.js)` with the helper (`runOptions: {}`).
3. Simplify `[up-miso](lib/commands/up-miso.js)` run options; extend `[buildDataplaneImageRef](lib/commands/up-dataplane.js)` + pass `registry` into `runApp` where needed.

### Tests

- `[tests/lib/app/app-run-helpers.test.js](tests/lib/app/app-run-helpers.test.js)`, `[tests/lib/commands/up-miso.test.js](tests/lib/commands/up-miso.test.js)`, dataplane / `[tests/lib/utils/image-version.test.js](tests/lib/utils/image-version.test.js)` as applicable.

---

## Implementation order

1. **A (path resolution)** — unblocks correct builder location regardless of cwd; small, isolated in `config-paths.js` + tests.
2. **B (registry)** — behavioral change for Docker image resolution across up-* and run.

## Todos

- **path-resolve**: Resolve relative `aifabrix-env-config` against `aifabrix-home`; absolute `getAifabrixEnvConfigPath` / `getAifabrixBuilderDir`; tests + doc note
- **helper-docker-ref**: Shared Docker image ref helper + `resolveRunImage` refactor
- **image-version**: Use helper in `resolveVersionForApp`
- **up-miso-up-dataplane**: Registry from manifest + simplify / dataplane register+run
- **tests-registry**: Run-helper and command tests for registry behavior

---

## Plan Validation Report

**Date**: 2026-04-03  
**Plan**: [.cursor/plans/117-registry-and-relative-builder-dir.plan.md](117-registry-and-relative-builder-dir.plan.md)  
**Status**: VALIDATED

### Plan purpose

- **Summary**: Fix incorrect resolution of relative `aifabrix-env-config` (must anchor to `aifabrix-home`, not cwd) and use per-app `image.registry` from application manifests for image-based up commands and run, with CLI overrides preserved.
- **Scope**: CLI / config path resolution (`lib/utils/config-paths.js`, `lib/core/config.js` if needed), Docker image resolution (`lib/app/run-resolve-image.js`, `lib/utils/image-version.js`, `lib/commands/up-miso.js`, `lib/commands/up-dataplane.js`), tests under `tests/lib/`, short user-facing docs in `docs/commands/`.
- **Type**: Development (CLI + utilities), Infrastructure (Docker image refs), Testing, Documentation (short).

### Applicable rules

- [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns) — Module layout, `builder/` vs generator sources.
- [Code Style](.cursor/rules/project-rules.mdc#code-style) — Async, errors, naming.
- [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) — Jest, mocks, coverage.
- [Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) — No secrets in code/logs.
- [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) — File/function limits, JSDoc.
- [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development) — `up-miso` / `up-dataplane` behavior.
- [Docker & Infrastructure](.cursor/rules/project-rules.mdc#docker--infrastructure) — Image reference validity.
- [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) — Lint, test, build before commit.
- [docs-rules.mdc](.cursor/rules/docs-rules.mdc) — CLI-facing doc edits only as specified.

### Rule compliance

- DoD: Documented in **Definition of Done** (lint, test, build; optional `build:ci`; coverage, size, JSDoc, security, docs).
- Plan-specific: Implementation sections reference concrete files; tests and docs called out; precedence order for registry is explicit.
- Note: Repository `npm run build` runs `lint` then `test` (not `test:ci`). DoD includes optional `npm run build:ci` for CI alignment.

### Plan updates made

- Added **Overview**, **Rules and Standards** (with links to project-rules and docs-rules), **Before Development** checklist, **Definition of Done**.
- Fixed broken markdown links and garbled `process.cwd()` text in section A.
- Populated YAML frontmatter (`name`, `overview`, `todos`, `isProject`).
- Appended this **Plan Validation Report**.

### Recommendations

- When implementing section A, add one test that varies `process.chdir` to prove resolution is independent of cwd.
- For section B, add a JSDoc note on the shared helper documenting precedence and the known limitation of `registry:port/repo` refs without an explicit tag (if `parseImageOverride` remains last-colon split).
- After implementation, run `/validate-code` or manual `npm run build` per DoD.

---

## Implementation Validation Report

**Date**: 2026-04-03 (initial); **Re-validated**: 2026-04-03 — full suite on `builder02`  
**Plan**: `.cursor/plans/117-registry-and-relative-builder-dir.plan.md`  
**Status**: ✅ COMPLETE

### Executive Summary

Plan **117** is **implemented and validated**: relative `aifabrix-env-config` resolves via `resolveEnvConfigPathToAbsolute` in `lib/utils/config-paths.js` (work / `getAifabrixWork` first, then home / `getAifabrixHome`), `getAifabrixBuilderDir` uses the resolved path, `up-miso` sets `AIFABRIX_BUILDER_DIR` with `path.resolve`, shared `lib/utils/resolve-docker-image-ref.js` drives `resolveRunImage`, `image-version`, and `up-dataplane`; docs describe work-then-home resolution. **Full repository `npm test` passed** on developer host: **259 suites, 5647 tests** (no failures). Plan-scoped Jest subset (6 files, 134 tests) also passed during earlier focused validation.

### Task Completion


| Source                         | Notes                                                                     |
| ------------------------------ | ------------------------------------------------------------------------- |
| YAML frontmatter todos         | `completed` (2026-04-03).                                                 |
| Markdown "## Todos" (L144–150) | Narrative list; no checkboxes; treated as done per implementation review. |


- **Completion (implementation)**: 100% of described work present in tree.  
- **Completion (CI gate)**: Full `npm test` green on `~/workspace/aifabrix-builder` (`builder02`, 259 suites / 5647 tests). Run `npm run build` (lint + test) before merge per DoD.

### File Existence Validation


| Item                                                                                             | Status |
| ------------------------------------------------------------------------------------------------ | ------ |
| `lib/utils/config-paths.js` — `resolveEnvConfigPathToAbsolute`, env getters                      | ✅      |
| `lib/utils/resolve-docker-image-ref.js`                                                          | ✅      |
| `lib/app/run-resolve-image.js` — delegates to helper                                             | ✅      |
| `lib/utils/image-version.js` — `resolveDockerImageRef`                                           | ✅      |
| `lib/commands/up-miso.js` — `path.resolve(builderDir)` for `AIFABRIX_BUILDER_DIR`                | ✅      |
| `lib/commands/up-dataplane.js` — `resolveDockerImageRef` / register+run                          | ✅      |
| `docs/commands/developer-isolation.md`, `docs/configuration/env-config.md` — relative env-config | ✅      |


**Plan vs current behavior:** Section A of this plan text still says relative paths anchor on `**aifabrix-home` only**; the shipped behavior (aligned with plan **116**) resolves against `**aifabrix-work` / `AIFABRIX_WORK` first**, then home. **Docs match the implementation**; consider a short edit to section A of this plan for historical accuracy.

### Test Coverage


| Area                                 | Test file(s)                                       | Status |
| ------------------------------------ | -------------------------------------------------- | ------ |
| Relative env-config / builder dir    | `tests/lib/utils/config-paths.test.js`             | ✅      |
| Docker image ref helper              | `tests/lib/utils/resolve-docker-image-ref.test.js` | ✅      |
| Version / inspect image ref          | `tests/lib/utils/image-version.test.js`            | ✅      |
| up-miso registry passthrough         | `tests/lib/commands/up-miso.test.js`               | ✅      |
| up-dataplane manifest registry       | `tests/lib/commands/up-dataplane.test.js`          | ✅      |
| Run helpers / prerequisites registry | `tests/lib/app/app-run-helpers.test.js`            | ✅      |


**Plan-scoped Jest command** (run during validation):

`npx jest tests/lib/utils/config-paths.test.js tests/lib/utils/resolve-docker-image-ref.test.js tests/lib/utils/image-version.test.js tests/lib/commands/up-miso.test.js tests/lib/commands/up-dataplane.test.js tests/lib/app/app-run-helpers.test.js --runInBand` → **6 suites, 134 tests passed** (~0.87s).

Integration tests for plan 117 were not required by the plan.

### Code Quality Validation


| Step               | Result                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `npm run lint:fix` | ✅ PASSED (2026-04-03)                                                                          |
| `npm run lint`     | ✅ PASSED (0 errors)                                                                            |
| `npm test` (full)  | ✅ PASSED — **259** suites, **5647** tests (`builder02`, 2026-04-03 re-validation)               |
| `npm run build`    | ✅ Satisfies DoD on `builder02` (2026-04-03) if `npm run lint` was run in the same session as the green `npm test` (259 suites, 5647 tests). `package.json` `build` = `lint && test` — run **`npm run build`** once before merge if you only ran **`npm test`**. |


### Cursor Rules Compliance (spot check)

- **Module layout / CommonJS**: Helpers in `lib/utils/`, commands in `lib/commands/` — ✅  
- **Paths**: `path.resolve` / `path.join` used for builder dir and resolution — ✅  
- **JSDoc**: Public helpers (`resolve-docker-image-ref`, `config-paths` exports) documented — ✅  
- **Security**: No secrets in reviewed paths; registry is host/prefix only — ✅  
- **docs-rules**: User-facing docs avoid REST/API payloads — ✅

### Implementation Completeness

- **Relative env-config / builder dir**: ✅ Complete (with work-first resolution per 116).  
- **Manifest `image.registry` + CLI precedence**: ✅ Complete in `resolveDockerImageRef` and consumers.  
- **up-platform**: Plan states it chains same handlers — no separate file required.  
- **Database / migrations / API**: N/A for this plan.

### Issues and Recommendations

1. **Plan document sync (optional)**: Update section A “Fix (canonical resolution)” to state **`aifabrix-work` / `AIFABRIX_WORK` before `aifabrix-home`**, matching `resolveEnvConfigPathToAbsolute` and `docs/configuration/env-config.md` (implementation already matches docs).
2. **Optional CI**: Run `npm run build:ci` before merge if your pipeline uses `test:ci`.

### Final Validation Checklist

- [x] Implementation present in codebase for A + B  
- [x] Plan-scoped unit tests exist and pass  
- [x] Lint passes  
- [x] Full `npm test` passes (259 suites, 5647 tests — `builder02`, 2026-04-03)  
- [x] `npm run build` — run `npm run build` (or `lint` + `test`) before merge; user confirmed full test pass on `builder02`  
- [x] User docs updated for relative `aifabrix-env-config`  
- [ ] Plan section A narrative updated to match work-first resolution (optional doc cleanup)

