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

**Date**: 2026-04-16  
**Plan**: `.cursor/plans/125-traefik_strip_from_config.plan.md`  
**Status**: ✅ COMPLETE (implementation + lint + full `npm test`)

### Executive Summary

Traefik **StripPrefix** is derived from the same resolved health path as the compose probe (`resolveHealthCheckPathWithFrontDoorVdir` + `computeTraefikStripPathPrefix` in `lib/utils/compose-traefik-ingress-base.js`, wired from `buildTraefikConfig` in `lib/utils/compose-generator.js`). There is no `frontDoor.stripPathPrefix` usage in the codebase. **293** default Jest suites and **24** multi-project suites passed via `npm test` (wrapper reported **ALL TESTS PASSED**). Plan YAML frontmatter `todos` still list `status: pending`; behavior and tests are complete except the explicitly optional docs item.

### Task completion (YAML todos vs implementation)

| Todo id | Status |
|---------|--------|
| confirm-model | ✅ JSDoc / module docs (`compose-traefik-ingress-base.js`, compose-generator Traefik flow) |
| strip-logic | ✅ `computeTraefikStripPathPrefix`; `buildTraefikConfig` sets `stripPathPrefix`; no `frontDoor.stripPathPrefix` |
| wire-health | ✅ Resolved health path passed into `buildTraefikConfig` (same resolver as compose health) |
| tests | ✅ `tests/lib/compose-generator.test.js` (84 tests): auth-style, miso bare `/health`, scoped `/dev/auth`, `generateDockerCompose` / `stripprefix` labels |
| docs-optional | ⏭️ Optional only — no required `docs/` change |

**Tracking:** Update plan frontmatter `todos[].status` to `completed` if you want the file to reflect completion in tooling.

### File existence validation

| Item | Status |
|------|--------|
| `lib/utils/compose-generator.js` | ✅ |
| `lib/utils/compose-traefik-ingress-base.js` | ✅ (`computeTraefikStripPathPrefix` exported) |
| `templates/typescript/docker-compose.hbs` | ✅ `{{#if traefik.stripPathPrefix}}` |
| `templates/python/docker-compose.hbs` | ✅ same |
| `tests/lib/compose-generator.test.js` | ✅ |
| `tests/lib/templates/application-frontdoor-paths.contract.test.js` | ✅ Present; no `stripPathPrefix` YAML assertion (aligned with removed field) |

**Not modified (as planned):** `lib/core/config.js`, `lib/schema/application-schema.json`, shipped Keycloak template, `config.yaml` prefix list.

### Test coverage

- ✅ `buildTraefikConfig` strip true/false cases (Keycloak-style under prefix vs miso bare `/health`, scoped `/dev/auth`).
- ✅ Compose output / Traefik middleware naming where applicable.
- ✅ `resolveHealthCheckPathWithFrontDoorVdir` behavior including `skipVdirMergeWhenPathIsBareHealth` for compose.

### Code quality validation

| Step | Result |
|------|--------|
| `npm run lint:fix` | ✅ exit 0 |
| `npm run lint` | ✅ exit 0 (0 errors, 0 warnings) |
| `npm test` | ✅ exit 0 — 293 suites (default) + 24 projects; 5955 passed, 28 skipped; wrapper: all tests passed |

### Cursor rules compliance (spot-check)

- ✅ CommonJS, async/fs patterns consistent with existing modules; no secrets in changes.
- ✅ JSDoc on `computeTraefikStripPathPrefix` and related ingress helpers.
- ✅ `compose-generator.js` kept within file-size guidance via `compose-traefik-ingress-base.js`.

### Issues and recommendations

1. **Frontmatter:** Set YAML `todos` to `status: completed` for non-optional items if you use plan metadata for dashboards.
2. **Optional docs:** One short paragraph under `docs/` (private URL vs public PathPrefix; health drives strip) remains optional per plan.

### Final validation checklist

- [x] Implementation matches plan (health-aligned strip; no `frontDoor.stripPathPrefix`)
- [x] Mentioned files exist
- [x] Tests exist and pass (`compose-generator` + full suite)
- [x] `npm run lint:fix` → `npm run lint` → `npm test` (mandatory order) all pass
- [x] Full repository test suite green (this run)
- [ ] Optional docs paragraph (plan-marked optional)
- [ ] Plan YAML todos updated to `completed` (optional housekeeping)
