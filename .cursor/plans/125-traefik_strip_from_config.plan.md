---
name: Traefik strip from health path
overview: Confirm the private-vs-public URL model, then derive Traefik **StripPrefix** from the same path resolution as the compose **health** probe (`healthCheck.path` + shared vdir rules)—no `config.yaml` prefix list and no changes to application schema or shipped Keycloak template.
todos:
  - id: confirm-model
    content: Document in code (JSDoc) private URL vs public PathPrefix; strip derived from health path
    status: pending
  - id: strip-logic
    content: "buildTraefikConfig: stripPathPrefix = !(resolvedHealthPath startsWith traefik.path); remove frontDoor.stripPathPrefix"
    status: pending
  - id: wire-health
    content: Reuse resolveHealthCheckPathWithFrontDoorVdir (compose opts) when computing traefik.stripPathPrefix
    status: pending
  - id: tests
    content: "Compose tests: bare /health + vdir → strip; /auth/health/ready style → no strip; scoped /dev/auth"
    status: pending
  - id: docs-optional
    content: Optional short note in developer docs on private URL vs Traefik path (no schema / no keycloak template)
    status: pending
isProject: false
---

# Traefik StripPrefix aligned with health path (your model confirmed)

## Confirmation of your text (yes, this is correct)

- **Private / backend reachability** in Compose is **`http://<service_name>:<containerPort>`** (plus the **HTTP path** on the request). There is **no** `/dev`, `/tst`, or `/auth` in the **host** of that private URL—those segments are **not** part of “the private address.”

- **`/dev` / `/tst` / pattern base (`/auth`, `/miso`, …)** are **public ingress** concerns: they appear in **Traefik** `PathPrefix` and in resolved **public** `url://…` URLs when Traefik + `frontDoorRouting` apply. They are **not** extra path segments you add to the internal `http://keycloak:8080` hostname.

- **Forwarding rule you want:** the path the **container** sees after Traefik should match what we already treat as the **in-container health path**—driven by **`application.yaml` `healthCheck.path`** and the **same vdir / Plan 117 rules** we use when generating compose health checks (not a second, manual list in `config.yaml`).

So: **one path story** for “what path does the process listen on for health?” and **Traefik strip** is chosen so public routing does not break that.

## Why this replaces the earlier “config.yaml prefix list” idea

The previous draft used `traefikNoStripPathPrefixes` in `config.yaml` so operators could list `/auth`, `/dev/auth`, etc. You clarified that **backend** is private URL only and the **health section** already encodes path intent; duplicating prefixes in `config.yaml` is redundant and easy to drift from `healthCheck.path`.

Instead, **derive** strip from existing YAML + existing resolvers.

## Technical rule (high level)

After computing:

- **`traefik.path`** — same as today (PathPrefix / `url://vdir-public` segment, including `/dev`/`/tst` when scoped).
- **`resolvedHealthPath`** — same as compose health: `resolveHealthCheckPathWithFrontDoorVdir(config, devId, scopeOpts, remoteServer, { skipVdirMergeWhenPathIsBareHealth: true })` (bare `/health` stays root-only for miso-style apps).

Then:

- **Omit StripPrefix** when **`resolvedHealthPath`** is under the Traefik prefix (e.g. starts with `` `traefik.path` + `/` `` or equals the prefix where relevant): container expects the **full** path including `/auth/…` (Keycloak-style).
- **Use StripPrefix** when **`resolvedHealthPath`** does **not** start with that prefix (e.g. `/health` while Traefik path is `/miso`): container listens at **root** for health; Traefik must strip the public vdir.

This matches:

- **Keycloak**: `healthCheck.path` `/health/ready` → resolved `/auth/health/ready` → no strip → browser `/auth/health/ready` reaches the container as `/auth/health/ready`.
- **Miso / dataplane**: `healthCheck.path` `/health` → resolved `/health` (bare rule) → strip → container sees `/health`.

## Implementation (no schema / no shipped Keycloak template)

1. [`lib/utils/compose-generator.js`](lib/utils/compose-generator.js)
   - Add a small helper, e.g. `computeTraefikStripPathPrefix(traefikPath, resolvedHealthPath)` (normalize trailing slashes consistently).
   - **`buildTraefikConfig`** should accept the **resolved health path** (or `config` + `devId` + `scopeOpts` + `remoteServer` and call the same resolver **once**), set **`stripPathPrefix`** from the rule above.
   - **Remove** any use of **`frontDoor.stripPathPrefix`** (not in schema after restore).
   - **`buildServiceConfig`**: compute health path once, pass into `buildTraefikConfig` to avoid double work.

2. [`templates/typescript/docker-compose.hbs`](templates/typescript/docker-compose.hbs) / [`templates/python/docker-compose.hbs`](templates/python/docker-compose.hbs)  
   - No structural change; keep `{{#if traefik.stripPathPrefix}}` around StripPrefix labels.

3. **Tests** [`tests/lib/compose-generator.test.js`](tests/lib/compose-generator.test.js)  
   - Auth-style: front door + `/health/ready` → no `stripprefix` in output.  
   - Miso-style: front door + bare `/health` → `stripprefix` present.  
   - Scoped: `/dev/auth` + health under that prefix → no strip.

4. **Docs (optional)**  
   - One short paragraph: private URL vs public path; health path drives strip. No `application-schema.json` / no shipped `keycloak/application.yaml` edits.

5. **Follow-up (unchanged)**  
   - Keycloak image **no `curl`** for `CMD` healthchecks is separate from StripPrefix; handle via user `bashProbe` / image / generator default **without** touching shipped Keycloak template if that remains forbidden.

## Files to touch (summary)

| Area | File(s) |
|------|---------|
| Logic | [`lib/utils/compose-generator.js`](lib/utils/compose-generator.js) |
| Templates | (unchanged behavior) [`templates/typescript/docker-compose.hbs`](templates/typescript/docker-compose.hbs), [`templates/python/docker-compose.hbs`](templates/python/docker-compose.hbs) |
| Tests | [`tests/lib/compose-generator.test.js`](tests/lib/compose-generator.test.js) |
| Docs | Optional under `docs/` |

**Not used:** `config.yaml` prefix list, [`lib/core/config.js`](lib/core/config.js) changes for this feature, [`lib/schema/application-schema.json`](lib/schema/application-schema.json), [`templates/applications/keycloak/application.yaml`](templates/applications/keycloak/application.yaml).

## Implementation Validation Report

**Date**: 2026-04-13  
**Plan**: `.cursor/plans/125-traefik_strip_from_config.plan.md`  
**Status**: ⚠️ IMPLEMENTATION COMPLETE — full-repo test run has unrelated failures

### Executive Summary

The plan’s behavior is implemented in `lib/utils/compose-generator.js` with Traefik ingress helpers split into `lib/utils/compose-traefik-ingress-base.js` to satisfy the repository **max-lines (500)** rule on `compose-generator.js`. Unit/integration coverage for compose and Traefik strip behavior is present and passes. `npm run lint:fix` and `npm run lint` complete with **0 errors, 0 warnings**. `npm test` reports **2 failing suites** (`paths.test.js`, `register-aifabrix-shell-env.test.js`) that are **not touched by this plan**; all **84** tests in `tests/lib/compose-generator.test.js` pass.

### Task completion (YAML todos vs implementation)

Frontmatter `todos` still show `status: pending` in this file; behavior-wise the work items are done except the explicitly optional docs note.

| Todo id | Implemented |
|---------|-------------|
| confirm-model | ✅ JSDoc on ingress base module + compose-generator health/Traefik flow |
| strip-logic | ✅ `computeTraefikStripPathPrefix` + `buildTraefikConfig`; `frontDoor.stripPathPrefix` removed |
| wire-health | ✅ `buildServiceConfig` passes `healthCheck.path` into `buildTraefikConfig`; resolver uses `buildTraefikIngressBase` (no cycle) |
| tests | ✅ `tests/lib/compose-generator.test.js` (auth / miso / scoped + compose output assertions) |
| docs-optional | ⏭️ Not required by plan closure (optional only) |

### File existence validation

| Item | Status |
|------|--------|
| [`lib/utils/compose-generator.js`](lib/utils/compose-generator.js) | ✅ (under 500 lines after split) |
| [`lib/utils/compose-traefik-ingress-base.js`](lib/utils/compose-traefik-ingress-base.js) | ✅ **Added** during validation to fix `max-lines` |
| [`templates/typescript/docker-compose.hbs`](templates/typescript/docker-compose.hbs) | ✅ `{{#if traefik.stripPathPrefix}}` unchanged |
| [`templates/python/docker-compose.hbs`](templates/python/docker-compose.hbs) | ✅ same |
| [`tests/lib/compose-generator.test.js`](tests/lib/compose-generator.test.js) | ✅ |
| [`tests/lib/templates/application-frontdoor-paths.contract.test.js`](tests/lib/templates/application-frontdoor-paths.contract.test.js) | ✅ Keycloak `stripPathPrefix` assertion removed (field not in shipped YAML) |
| Optional `docs/` paragraph | ⏭️ Skipped (optional) |

**Not modified (as planned):** `lib/core/config.js`, `lib/schema/application-schema.json`, shipped Keycloak `application.yaml`, `config.yaml` prefix list.

### Test coverage

- ✅ Unit tests for `buildTraefikConfig` `stripPathPrefix` (auth, miso bare `/health`, scoped `/dev/auth`).
- ✅ `generateDockerCompose` asserts `stripprefix` / absence for IdP vs miso-style cases.
- ✅ Existing health-path / `resolveHealthCheckPathWithFrontDoorVdir` tests retained.

### Code quality validation

| Step | Result |
|------|--------|
| `npm run lint:fix` | ✅ exit 0 |
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npx jest tests/lib/compose-generator.test.js` | ✅ 84 passed |
| `npm test` (full) | ⚠️ 2 suites failed (see below) |

### Cursor rules compliance (spot-check)

- ✅ CommonJS, `path.join` where applicable, no secrets added.
- ✅ JSDoc on new module and public-facing helpers.
- ✅ File size: `compose-generator.js` brought under **500 lines** via `compose-traefik-ingress-base.js`.

### Issues and recommendations

1. **Full `npm test`**: Failures in `tests/lib/utils/paths.test.js` and `tests/lib/utils/register-aifabrix-shell-env.test.js` should be investigated separately; they are outside plan 125 file scope.
2. **Plan frontmatter**: Optionally update YAML `todos` to `status: completed` for tracking.
3. **Optional docs**: Add the short “private URL vs public PathPrefix” paragraph under `docs/` if you want user-facing documentation.

### Final validation checklist

- [x] Implementation matches plan (derive strip from compose health path; no `frontDoor.stripPathPrefix`)
- [x] Mentioned templates and tests exist / updated
- [x] Lint passes (0 errors, 0 warnings)
- [x] Compose-generator tests pass
- [ ] Full repository test suite green (blocked by unrelated failures)
- [ ] Optional docs paragraph (plan-marked optional)
