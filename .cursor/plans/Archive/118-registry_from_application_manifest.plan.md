---
name: Registry from application manifest
overview: Unify Docker image resolution so `image.registry` from each app’s `application.yaml` / `application.json` (via existing config loading) is used for local runs and dataplane register/deploy overrides, with CLI `--registry` and `--image` retaining higher precedence. `up-platform` needs no separate change beyond the two handlers it already calls.
todos:
  - id: helper-resolve-ref
    content: Add shared resolveDockerImageRef(appName, appConfig, runOptions) and refactor resolveRunImage to use it
    status: completed
  - id: image-version-align
    content: Use same helper in image-version.js resolveVersionForApp (runOptions {})
    status: completed
  - id: up-miso-simplify
    content: "up-miso: pass registry + image map only; remove redundant buildImageRefFromRegistry if fully superseded"
    status: completed
  - id: up-dataplane-registry
    content: "up-dataplane: merge YAML image.registry into buildDataplaneImageRef; pass registry into runApp"
    status: completed
  - id: tests
    content: Update/add tests for run helpers, up-miso, dataplane ref, image-version as applicable
    status: completed
isProject: true
---

# Use application manifest registry for up-miso / up-dataplane / up-platform

## Overview

Unify Docker image resolution so `**image.registry**` from each app’s application manifest (YAML/JSON via existing config loading) is used for local runs and dataplane register/deploy overrides. CLI `**--image**` and `**--registry**` keep higher precedence. `**up-platform**` only chains `handleUpMiso` and `handleUpDataplane`; no separate handler work.

## Rules and Standards

This plan must comply with [.cursor/rules/project-rules.mdc](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** — CommonJS, `lib/commands/` + `lib/utils/`; keep Docker-run resolution separate from `getImageName` consumers unless audited.
- **[Code Style](.cursor/rules/project-rules.mdc#code-style)** — async/await, try/catch, clear errors.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** — Jest, mirror `tests/lib/…`, mocks, ≥80% on new code.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** — No secrets in code or logs.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** — Files ≤500 lines, functions ≤50 lines; JSDoc on new public exports.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** — Preserve `--registry` / `--image` semantics.
- **[Docker & Infrastructure](.cursor/rules/project-rules.mdc#docker--infrastructure)** — Valid image refs for local Docker and pullable deploy paths.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** — Lint, tests, build before merge.

**Key requirements:** JSDoc on new helper; extend tests under **Tests**; follow [.cursor/rules/docs-rules.mdc](.cursor/rules/docs-rules.mdc) for any `docs/` edits.

## Before Development

- Skim **Testing Conventions**, **CLI Command Development**, and **Quality Gates** in [project-rules.mdc](.cursor/rules/project-rules.mdc).
- Re-read `lib/app/run-resolve-image.js`, `lib/utils/compose-generator.js`, `lib/commands/up-miso.js`, `lib/commands/up-dataplane.js`, `lib/utils/image-version.js`.
- Grep for `registryMode` / `runOptions.registry` before removing run-opt fields.

## Definition of Done

1. **Lint**: `npm run lint` — zero errors.
2. **Test**: `npm test` — all pass.
3. **Build**: `npm run build` (runs **lint** then **test** per `package.json`) — must succeed.
4. **CI (recommended)**: `npm run build:ci` if pipeline uses `test:ci`.
5. **Coverage / size / JSDoc**: ≥80% on new code where practical; ≤500 lines/file, ≤50 lines/function; JSDoc on new exports.
6. **Security**: No hardcoded secrets.
7. Optional: one-line CLI doc that YAML `image.registry` applies when `--registry` is omitted ([docs-rules](.cursor/rules/docs-rules.mdc)).
8. All todos complete.

**Order:** This repo’s `npm run build` = lint → test; or run lint and test explicitly in that order.

---

## Problem

- Local run resolves images via `[run-resolve-image.js](lib/app/run-resolve-image.js)` → `[composeGenerator.getImageName](lib/utils/compose-generator.js)`, which uses only `image.name` and `image.tag`, ignoring `image.registry`.
- `[up-miso.js](lib/commands/up-miso.js)` only builds `registry/name:tag` when CLI `--registry` is set (`buildImageRefFromRegistry`); it never reads `image.registry` from the manifest. The `registry` / `registryMode` fields on `runOpts` are unused by `resolveRunImage`.
- `[up-dataplane.js](lib/commands/up-dataplane.js)` mirrors the same gap: `buildDataplaneImageRef` only runs with CLI `--registry`; `runApp('dataplane', …)` passes no image/registry, so Docker sees an unqualified name.
- `[image-version.js](lib/utils/image-version.js)` uses unqualified `getImageName` for `checkImageExists` / `docker inspect`, so version-from-image can disagree with the ref actually used after this fix unless aligned.

`[app-config-resolver.js](lib/utils/app-config-resolver.js)` already resolves `application.yaml`, `application.yml`, and `application.json`; no new manifest format work is required beyond reading `image.registry` from the loaded object.

## Precedence (single rule)

For each app, effective Docker repository reference:

1. `**--image`** (full ref for that app) — unchanged; parsed with existing `[parseImageOverride](lib/utils/parse-image-ref.js)`.
2. `**--registry` CLI** — when present, use as host prefix for that app’s `image.name` / `image.tag` from its manifest (same as today’s `buildImageRefFromRegistry` behavior, but YAML fills in when CLI is omitted).
3. `**image.registry` from that app’s manifest** — trim, strip trailing slashes; if non-empty, use `${registry}/${image.name}:${image.tag}`.
4. **Otherwise** — keep current behavior: `image.name` + `image.tag` only (Docker Hub / local short names).

Per-app YAML matters: Keycloak and miso-controller may use different registries; do not assume one registry for all apps unless `--registry` is passed.

## Implementation

### 1. Central helper for repository + tag

Add a small module (e.g. `[resolve-docker-image-ref.js](lib/utils/resolve-docker-image-ref.js)`) or extend `[run-resolve-image.js](lib/app/run-resolve-image.js)` with a documented function:

- **Inputs:** `appName`, `appConfig` (already loaded), `runOptions` (`image`, `registry` optional).
- **Output:** `{ imageName, imageTag }` where `imageName` may be `registry.example/aifabrix/keycloak` (repository path Docker expects before `:`).
- **Logic:** Implement the precedence above; reuse `composeGenerator.getImageName(appConfig, appName)` for the unqualified repository path, then prefix with `runOptions.registry || appConfig?.image?.registry` when non-empty.

Refactor `[resolveRunImage](lib/app/run-resolve-image.js)` to delegate to this helper so `[checkPrerequisites](lib/app/run-helpers.js)` / `[startContainer](lib/app/run-helpers.js)` / `[run-container-start.js](lib/app/run-container-start.js)` pick up manifest registry automatically for all `aifabrix run` flows, not only up-*.

### 2. Align version-from-image with the same ref

In `[resolveVersionForApp](lib/utils/image-version.js)`, replace the unqualified `getImageName` + `checkImageExists` / `getVersionFromImage` inputs with the same helper and `runOptions: {}` (no CLI overrides in that code path), so template apps with `image.registry` resolve versions against the same image Docker uses.

### 3. Simplify up-miso and fix up-dataplane overrides

- **up-miso:** In `runMisoApps`, stop building full refs via `buildImageRefFromRegistry` when you can pass through `registry: options.registry` and optional `image` from `parseImageOptions` only. Remove dead `registry`/`registryMode` on run opts if nothing else reads them, or keep `registryMode` only if another layer uses it (grep before deleting).
- **up-dataplane:** Update `buildDataplaneImageRef(cliRegistry)` to use `cliRegistry || variables?.image?.registry` (same trimming rules) so `registerApplication` / `deployApp` get a pullable `registry/name:tag` when the manifest defines `image.registry`.
- Pass `registry: options.registry` into `runApp('dataplane', …)` so CLI override still wins over YAML for the run step without duplicating full ref construction.

### 4. up-platform

No separate handler: `[setupUpPlatformCommand](lib/cli/setup-infra.js)` calls `handleUpMiso` then `handleUpDataplane` with the same `options`. Fixes in (1)–(3) apply automatically.

## Tests

- `[tests/lib/app/app-run-helpers.test.js](tests/lib/app/app-run-helpers.test.js)`: `checkPrerequisites` with `appConfig.image.registry` set (and with CLI `runOptions.registry` / `runOptions.image`) — expect `checkImageExists` called with prefixed repository when appropriate.
- `[tests/lib/commands/up-miso.test.js](tests/lib/commands/up-miso.test.js)`: When manifest mock includes `image.registry` and no `--registry` / `--image`, `runApp` receives options that resolve to the prefixed image (or assert behavior via mocked `runApp` / `checkImageExists` depending on existing patterns).
- **Add or extend dataplane tests** if present for `buildDataplaneImageRef` / `handleUpDataplane`; otherwise add a focused unit test for the new registry merge in `up-dataplane.js` or the shared helper.
- `[tests/lib/utils/image-version.test.js](tests/lib/utils/image-version.test.js)` (if coverage exists): manifest with `image.registry` uses prefixed name for existence check.

## Edge cases (document in JSDoc, minimal code)

- **Port in registry host** (e.g. `localhost:5000/repo`): existing `parseImageOverride` last-colon split is ambiguous for refs without a tag; out of scope unless you already use that form — document “prefer explicit `--image` with `:tag`”.
- **Empty / whitespace `image.registry`:** treat as absent; keep Docker Hub short names.
- **Do not change** `getImageName` semantics for manifest generators that need repository name without host unless audit shows they already combine registry elsewhere; keep the new logic in the Docker-run resolution layer only.

## Optional follow-up (not required for MVP)

- Brief note in internal contributor docs that `image.registry` drives local `up-`* and `run` when set; user-facing CLI docs already mention `--registry` — add one line that YAML `image.registry` is the default when the flag is omitted.

---

## Plan Validation Report

**Date**: 2026-04-03  
**Plan**: [.cursor/plans/118-registry_from_application_manifest.plan.md](118-registry_from_application_manifest.plan.md)  
**Status**: VALIDATED

### Plan purpose

- **Summary**: Use per-app `image.registry` from application manifests for Docker image resolution, with `--image` and `--registry` overrides; align `image-version` with the same ref; simplify `up-miso` and fix `up-dataplane` register/deploy/run.
- **Scope**: `lib/app/run-resolve-image.js`, new or extended `lib/utils/`* helper, `lib/utils/image-version.js`, `lib/commands/up-miso.js`, `lib/commands/up-dataplane.js`, `tests/lib/`**.
- **Type**: Development, Infrastructure (Docker), Testing; optional docs.

### Applicable rules

- [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns), [Code Style](.cursor/rules/project-rules.mdc#code-style), [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions), [Security & ISO 27001](.cursor/rules/project-rules.mdc#security--compliance-iso-27001), [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards), [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development), [Docker & Infrastructure](.cursor/rules/project-rules.mdc#docker--infrastructure), [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates), [docs-rules.mdc](.cursor/rules/docs-rules.mdc) for optional doc line.

### Rule compliance

- **DoD**: Documented in **Definition of Done**; clarifies this repo’s `npm run build` = `lint` + `test` (see `package.json`), not `test:ci` unless using `build:ci`.
- **Plan**: Precedence, files, tests, edge cases present.

### Plan updates made (this validation)

- Added **Overview**, **Rules and Standards**, **Before Development**, **Definition of Done**.
- Cleaned markdown links and list emphasis in Problem, Precedence, Implementation, Tests, Optional follow-up.
- Fixed broken composite link for run-helpers / run-container-start.
- Set `isProject: true` in frontmatter.
- Appended this report.

### Recommendations

- Prefer a dedicated `resolve-docker-image-ref.js` if `run-resolve-image.js` would exceed file-size limits after refactor.
- Run `npm run build` after implementation; use `npm run build:ci` when matching CI.

---

## Implementation Validation Report

**Date**: 2026-04-03  
**Re-validated**: 2026-04-03 (builder02 — full suite)  
**Plan**: `.cursor/plans/118-registry_from_application_manifest.plan.md`  
**Status**: ✅ **COMPLETE**

### Executive Summary

All plan deliverables are present in `lib/` and covered by tests. `**npm test` on builder02 (`dev02@builder02:~/workspace/aifabrix-builder`)**: **259** test suites passed, **5647** tests passed. Earlier validation on a different environment saw unrelated `EACCES` failures on `/aifabrix-miso/builder`; that is **resolved** in the builder02 workspace. Plan-scoped suites (**148** tests across six files) continue to pass as part of the full run.

### Task completion (frontmatter todos)


| ID                    | Status      |
| --------------------- | ----------- |
| helper-resolve-ref    | ✅ completed |
| image-version-align   | ✅ completed |
| up-miso-simplify      | ✅ completed |
| up-dataplane-registry | ✅ completed |
| tests                 | ✅ completed |


**Completion**: 5/5 (100%).

### File existence and implementation


| Item                                                                                                                                                 | Status                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `lib/utils/resolve-docker-image-ref.js` (new) — `resolveDockerImageRef`, `resolveComposeImageOverrideString`, `normalizeDockerRegistryPrefix`, JSDoc | ✅                               |
| `lib/app/run-resolve-image.js` — delegates to `resolveDockerImageRef`                                                                                | ✅                               |
| `lib/utils/compose-generator.js` — `resolveComposeImageOverrideString` for compose image line; **486 lines** (≤500)                                  | ✅                               |
| `lib/utils/image-version.js` — `resolveVersionForApp` uses `resolveDockerImageRef`                                                                   | ✅                               |
| `lib/commands/up-miso.js` — passes `registry` / `registryMode` / optional `image`; no `buildImageRefFromRegistry`                                    | ✅                               |
| `lib/commands/up-dataplane.js` — manifest + CLI registry in `buildDataplaneImageRef`; `runApp` gets `registry`                                       | ✅                               |
| `lib/app/run-helpers.js` / `run-container-start.js` — use `resolveRunImage` (unchanged entry, new behavior)                                          | ✅                               |
| Optional `docs/` one-liner for YAML `image.registry`                                                                                                 | ⏭️ not required (plan optional) |


### Test coverage


| Test file                                                                                 | Status   |
| ----------------------------------------------------------------------------------------- | -------- |
| `tests/lib/utils/resolve-docker-image-ref.test.js`                                        | ✅ exists |
| `tests/lib/app/app-run-helpers.test.js` — registry / precedence                           | ✅        |
| `tests/lib/commands/up-miso.test.js` — `--registry` passthrough                           | ✅        |
| `tests/lib/commands/up-dataplane.test.js` — `buildDataplaneImageRef`, `handleUpDataplane` | ✅        |
| `tests/lib/utils/image-version.test.js` — prefixed `checkImageExists`                     | ✅        |
| `tests/lib/compose-generator.test.js` — still passes with compose integration             | ✅        |


Full `npm test`: **259** suites, **5647** tests, all passed (includes plan-scoped coverage).

### Code quality validation


| Step                        | Result                                       |
| --------------------------- | -------------------------------------------- |
| Format (`npm run lint:fix`) | ✅ exit 0 (as validated 2026-04-03)           |
| Lint (`npm run lint`)       | ✅ exit 0                                     |
| Full `npm test`             | ✅ **259** suites, **5647** tests (builder02) |
| Plan-scoped tests           | ✅ included in full run                       |


### Cursor rules compliance (spot check)

- **CommonJS / structure**: utilities under `lib/utils/`, commands under `lib/commands/`. ✅  
- **JSDoc**: public exports in `resolve-docker-image-ref.js` documented. ✅  
- **File size**: `compose-generator.js` 486 lines; `resolve-docker-image-ref.js` 124 lines. ✅  
- **No secrets** in touched code paths. ✅  
- **getImageName** in `compose-generator.js` unchanged for bare name; registry applied via `resolveComposeImageOverrideString` / run path per plan. ✅

### Implementation completeness (plan scope)

- **Database / migrations / new API routes**: N/A (CLI/Docker resolution only). ✅ N/A  
- **up-platform**: no separate change required per plan. ✅

### Issues and recommendations

1. **Optional**: Add user-facing one line under `docs/commands/` that YAML `image.registry` applies when `--registry` is omitted (plan § Definition of Done item 7).
2. **Optional tests**: `resolveComposeImageOverrideString` branches for `options.tag` / passthrough `options.image` (minor coverage gaps).

### Final validation checklist

- All plan todos completed (frontmatter updated)
- All implementation files exist and match plan intent
- Tests exist for new/modified behavior; full suite passes
- `lint:fix` + `lint` pass (validated on implementation)
- Full `npm test` — **259** suites, **5647** tests passed (builder02, 2026-04-03)
- No plan-required code violations identified in reviewed files

