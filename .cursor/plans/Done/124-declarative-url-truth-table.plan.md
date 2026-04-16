---
name: ""
overview: ""
todos: []
isProject: false
---

# Declarative URL truth table (revised) — single rule set

## Scope

Unify **all** URL expansion behavior for the six logical surfaces (public/internal × full/host/vdir) under one explicit model, including:

- Infra: `traefik`, `tlsEnabled` (`infraTlsEnabled` in resolver ctx)
- App: `frontDoorRouting.enabled`, `pattern`, `host`, `tls`
- Config + app: **Plan 117** — `useEnvironmentScopedResources` (config) **and** `environmentScopedResources: true` (application.yaml) **and** derived env key from `MISO_CLIENTID` (**dev** / **tst** / pro / miso)
- Profile: `docker` vs `local`; `**aifabrix run <app> --reload`** must use **docker-shaped** expansion for `envOutputPath`
- `remote-server` empty → localhost bases (scheme from `tlsEnabled`)

Reference implementation touchpoints: `[lib/utils/url-declarative-resolve.js](lib/utils/url-declarative-resolve.js)`, `[lib/utils/url-declarative-resolve-build.js](lib/utils/url-declarative-resolve-build.js)`, `[lib/utils/url-declarative-public-base.js](lib/utils/url-declarative-public-base.js)`, `[lib/utils/url-public-path-prefix.js](lib/utils/url-public-path-prefix.js)`, `[lib/core/secrets.js](lib/core/secrets.js)`.

---

## Invariant: `traefik === false` means no proxy

**If Traefik is off, you are not behind the Traefik reverse proxy** — URL expansion must not behave as if you were.

When `**traefik` is false** in config:

- **Do not** use `frontDoorRouting.host` (or any Traefik-style hostname) as the public authority.
- **Do not** apply Plan 117 `**/dev`** or `**/tst**` path prefixes (those are proxy routing segments).
- **Do not** treat the app as having an active front-door **pattern** path on public URLs or `**url://vdir-*`** (no proxy stripping/remapping of paths).

Public URLs are **direct reachability**: `**remote-server` host + published port** (or **localhost** + derived port when remote is empty), with **scheme from `tlsEnabled`**, not “ingress URL” semantics.

This is the same idea already encoded in `pathActive = traefik && frontDoorRouting.enabled` and `pathPrefix` only when `traefik` — the plan states it explicitly so implementation and docs stay aligned.

---

## Single rule set (inputs → derived flags)

### 1) `pathActive` (front-door **pattern** segment, vdir-public, and path on full public URL)

`pathActive = (ctx.traefik === true) && (target application.yaml has frontDoorRouting.enabled === true)`.

- When **false**: no normalized pattern path in PUBLIC; `PUBLICVDIR` is empty; same for local **PRIVATE** when it mirrors public.
- When **true**: append normalized pattern (e.g. `/auth` from `/auth/`*).

### 2) `useTraefikHost` (authority = expanded `frontDoorRouting.host`, **no published port**)

`useTraefikHost = pathActive && (non-empty frontDoorRouting.host template after placeholder expansion)`.

- When **true**: public authority comes from Traefik host template; scheme follows **infra TLS** and existing `frontDoorRouting.tls` interaction (see implementation note below).
- When **false**: public authority comes from **remote-server + published port** (docker/local port rules) or **localhost** when remote empty; scheme from `**infraTlsEnabled`** only for this branch (do not inherit `https://` from `remote-server` when TLS is off).

### 3) `pathPrefix` (Plan 117 — **dev/tst** segment)

Computed only when `**ctx.traefik === true`** (caller gate today in `[replaceUrlRefToken](lib/utils/url-declarative-resolve.js)`):

`pathPrefix = computePublicUrlPathPrefix(useEnvironmentScopedResources, appEnvironmentScopedResources, derivedEnvKey)` → `''` | `/dev` | `/tst`.

**Single rule:**

- `baseEffective = useEnvironmentScopedResources && appEnvironmentScopedResources` (config gate **and** app `environmentScopedResources: true`).
- If `!traefik` → `pathPrefix` is always `''` (no `/dev` or `/tst` in URLs).
- If `traefik && baseEffective` and derived key is **dev** → `/dev`.
- If `traefik && baseEffective` and derived key is **tst** → `/tst`.
- If `traefik && baseEffective` and key is **pro** or **miso** (or other) → `''`.

This matches `[url-public-path-prefix.js](lib/utils/url-public-path-prefix.js)`; the **only** structural change in the plan is to ensure the **truth table + tests** explicitly cover combinations with `traefik: true`, both flags on, and **dev** vs **tst** client IDs.

### 4) Full URL path composition (PUBLIC and local PRIVATE when mirroring public)

**Ordered segments** after public base origin:

`fullPath = pathPrefix + patternSegment`

- `patternSegment` = normalized pattern when `pathActive`, else `''`.
- Join rules: avoid duplicate slashes; if both empty, URL is **origin only** (no trailing path).

`**PUBLICHOST` / `PRIVATEHOST`:** origin only — **no** `pathPrefix` and **no** pattern (host-only surfaces stay host-only).

`**PUBLICVDIR` / `PRIVATEVDIR`:** normalized pattern path when `pathActive`, else `''` — **plus** the docker/local split below.

### 5) Docker vs local for **internal** surfaces

- **Docker profile:** `PRIVATE` / `PRIVATEHOST` = `http://<appKey>:<listenPort>`; `**PRIVATEVDIR` always `''`** (even when `PUBLICVDIR=/auth`).
- **Local profile (no `--reload`):** `PRIVATE`* **mirrors** `PUBLIC`* (same base, pathPrefix, pattern, vdir rules).

### 6) Empty `remote-server`

Use **localhost** with derived host port (existing docker/local port math); **scheme** = `https` if `infraTlsEnabled`, else `http`. Same `pathActive`, `useTraefikHost`, and `pathPrefix` rules apply.

---

## Truth-table rows to add (beyond base Keycloak matrix)

Explicit golden cases (docker + local where applicable):


| Config / app           | traefik | tlsEnabled | pathActive | baseEffective | MISO_CLIENTID-derived | Expected path segment(s) on PUBLIC (after origin) |
| ---------------------- | ------- | ---------- | ---------- | ------------- | --------------------- | ------------------------------------------------- |
| Scoped on              | true    | either     | true       | true          | **dev**               | `/dev` + `/auth` (order: `/dev` then pattern)     |
| Scoped on              | true    | either     | true       | true          | **tst**               | `/tst` + `/auth`                                  |
| Scoped on              | true    | either     | true       | false         | dev/tst               | `/auth` only (no `/dev` or `/tst`)                |
| Scoped on              | true    | either     | false      | true          | dev                   | `/dev` only (no pattern)                          |
| Scoped off / app false | true    | either     | true       | any           | dev                   | `/auth` only                                      |
| Any                    | false   | either     | any        | any           | any                   | **no** `/dev`/`/tst` (prefix forced off)          |


**Note:** Confirm final string for “dev + auth” matches product (`/dev/auth` vs normalizing slashes); tests should lock the canonical form.

---

## Implementation notes (for execution phase)

1. **Centralize** computation of `{ pathActive, useTraefikHost, pathPrefix, patternSegment, schemeForDirect }` in one place consumed by public/internal builders to avoid drift between `[url-declarative-public-base.js](lib/utils/url-declarative-public-base.js)` and `[url-declarative-resolve-build.js](lib/utils/url-declarative-resolve-build.js)`. `**useTraefikHost` must be impossible when `traefik` is false** (hard gate: no proxy / no Traefik host branch).
2. **Tests:** extend the exhaustive matrix with rows for **scoped + traefik + dev**, **scoped + traefik + tst**, **scoped + traefik + pro**, **scoped config off + app on**, **traefik off + scoped flags on** (prefix must be empty).
3. **Docs:** `[docs/configuration/declarative-urls.md](docs/configuration/declarative-urls.md)` — one subsection stating the **single rule** for Plan 117 (both flags + traefik + derived key) and how it composes with `pathActive` and `useTraefikHost`.

---

## Todos (execution)

- Centralize URL resolution flags + composition (pathPrefix + pattern + Traefik vs published host)
- Align `url-declarative-public-base.js` with `useTraefikHost` vs direct/published-port branch and TLS scheme rules
- Implement docker-only empty `vdir-internal`; local internal mirrors public
- Verify `--reload` uses docker profile for url expansion
- Add golden tests: base Keycloak matrix + **scoped dev/tst/pro** × traefik on/off × pathActive on/off
- Update declarative-urls.md with unified rules (117 + front door + TLS + remote empty) and **explicit `traefik: false` = no proxy** invariant

---

## See also

- **[122-declarative_url_resolution.plan.md](./122-declarative_url_resolution.plan.md)** — original Plan 122 archive (port math, registry, matrices A–D, phased delivery). Marked as historical; **124** is canonical for live rules.

---

## Implementation Validation Report

**Date:** 2026-04-07  
**Plan:** `.cursor/plans/124-declarative-url-truth-table.plan.md`  
**Status:** ✅ **COMPLETE** (with minor follow-up notes)

### Executive Summary

Plan 124 behavior is implemented in the Builder: `pathActive` gates Traefik host authority and pattern segments; Plan 117 path prefix is gated by `traefik`; docker `url://vdir-internal` is empty; local internal mirrors public where applicable; docs and Jest coverage are in place. **`npm run lint:fix` → `npm run lint` → `npm test`** all succeeded (zero ESLint issues; **5,895** tests passed, **28** skipped).

### Task completion (§ Todos — execution)

| Item | Status |
|------|--------|
| Centralize URL flags + composition (`pathPrefix`, pattern, Traefik vs direct) | ✅ `lib/utils/url-declarative-url-flags.js` + wiring in resolve / resolve-build |
| Align `url-declarative-public-base.js` (`pathActive` / direct branch, TLS) | ✅ `pathActive` required for Traefik host; direct `remote-server` + scheme rules preserved |
| Docker-only empty `vdir-internal`; local mirrors public | ✅ `expandResolvedUrlToken` docker internal vdir; truth-table + expand tests |
| Verify `--reload` / `envOutputPath` docker-shaped URLs | ✅ No code change required; existing `writeEnvOutputForReload` + Matrix D tests |
| Golden tests (scoped dev/tst/pro × traefik × pathActive) | ✅ `tests/lib/utils/url-declarative-truth-table-124.test.js` + updated `url-declarative-resolve-expand.test.js` + existing matrices |
| `docs/configuration/declarative-urls.md` | ✅ Traefik off / passive front door / vdir-internal docker vs local |

**Note:** The plan’s “centralize `{ … schemeForDirect }` in one place” is **partially** met: `pathActive` and `computeDeclarativePathPrefix` live in `url-declarative-url-flags.js`; `schemeForDirect` / `remotePublicBaseWithoutTraefik` remain in `url-declarative-public-base.js` (acceptable split; no drift observed).

### File existence validation

| Path | Status |
|------|--------|
| `lib/utils/url-declarative-resolve.js` | ✅ (uses `computeDeclarativePathPrefix`) |
| `lib/utils/url-declarative-resolve-build.js` | ✅ (`computePathActive`, vdir-internal docker, `pathActive` → public base) |
| `lib/utils/url-declarative-public-base.js` | ✅ (`pathActive` gate on Traefik host) |
| `lib/utils/url-public-path-prefix.js` | ✅ (unchanged contract; called via flags module) |
| `lib/utils/url-declarative-url-flags.js` | ✅ **new** |
| `lib/core/secrets.js` | ✅ (`expandDeclarativeUrlsIfPresent` unchanged contract; profile still `docker` \| `local`) |

### Test coverage

| Test file | Role |
|-----------|------|
| `tests/lib/utils/url-declarative-truth-table-124.test.js` | Plan 124 flags + matrix (dev/tst/pro, passive pathActive, traefik off, local vdir parity) |
| `tests/lib/utils/url-declarative-resolve-expand.test.js` | Ingress matrix, host-public, cross-app, Plan 117 + passive front door |
| `tests/lib/utils/declarative-url-resolution.test.js` | Builder helpers + `frontDoorIngressActive` / pattern |
| `tests/lib/utils/url-declarative-public-base.test.js` | Direct remote + `infraTlsEnabled` scheme |
| `tests/lib/utils/declarative-url-matrix-d-reload.test.js` | Docker vs local + reload parity |

**Optional gap:** Explicit golden for **`useEnvironmentScopedResources: true`** with **`environmentScopedResources: false`** on the app (baseEffective false, traefik on, pathActive on) is not isolated in `url-declarative-truth-table-124.test.js`; behavior is covered indirectly via scoped-config-off and path-prefix unit tests. Add one case if you want row-for-row parity with § truth-table row “baseEffective false, dev/tst”.

### Code quality validation

- ✅ **Format / fix:** `npm run lint:fix` — exit 0  
- ✅ **Lint:** `npm run lint` — exit 0 (0 errors, 0 warnings)  
- ✅ **Tests:** `npm test` — all suites passed  

### Cursor rules compliance (spot check)

- ✅ CommonJS, `path.join`, JSDoc on public helpers, no secrets in code  
- ✅ New module size within project norms; no `console.log` in library code under review  

### Implementation completeness (plan scope)

- ✅ No database migrations or API routes (N/A for this plan)  
- ✅ Documentation updated per plan  
- ⚠️ **Optional:** Single module exporting all derived flags including `schemeForDirect` — not required for correctness  

### Issues and recommendations

1. Keep **124** as the canonical spec; update **122** only as archive pointers (already done elsewhere).  
2. (Optional) Add one Jest case: **app `environmentScopedResources: false`**, config scoped **on**, traefik **on**, `enabled: true`, dev client → public path **without** `/dev`.  

### Final validation checklist

- [x] Execution todos implemented  
- [x] Referenced lib files exist and implement plan 124 rules  
- [x] Tests exist, mirror `lib/utils`, and pass  
- [x] `lint:fix` + `lint` + `npm test` pass  
- [x] `docs/configuration/declarative-urls.md` reflects Traefik/proxy/vdir rules  
- [x] Report appended to this plan file  

