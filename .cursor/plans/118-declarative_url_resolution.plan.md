---
name: Declarative url:// resolution (Builder)
overview: Builder-only feature—applications declare a single `port` and front door (pattern) only (no `build.localPort`); host ports from `port + 10 + devId*100` (local) and `port + devId*100` (docker published); when `remote-server` is set and `developer-id` is non-zero/non-empty, public URLs use `dev<label>.<remote-host>` (e.g. `dev01.builder02.local`); nil/empty/`0` dev id keeps bare `remote-server` host; env.template uses url:// references; ~/.aifabrix/urls.local.yaml registers every app’s port and pattern; resolver emits docker and local .env.
todos:
  - id: urls-registry
    content: Maintain ~/.aifabrix/urls.local.yaml with all apps’ port + pattern; refresh when scanning builder apps or batch resolve
    status: pending
  - id: envkey-from-clientid
    content: Implement deriveEnvKeyFromClientId in Builder (hyphen segments, end-first match dev|tst|pro|miso; MISO_PIPELINE_ENV_KEY override)—spec + Jest golden vectors, no other repo required
    status: pending
  - id: port-rules
    content: Implement port math from plan §5—localHostPort = port+10+devId*100; publishedHostPort = port+devId*100; remove build.localPort from schema/generators
    status: pending
  - id: resolver-core
    content: Resolver inputs config.yaml, remote-server, registry, secrets/env; apply §8 remote host rewrite (dev*. subdomain when developer-id non-zero); outputs expanded url:// and two .env variants
    status: pending
  - id: remove-legacy-env-config
    content: Remove lib/schema/env-config.yaml stack and related CLI/docs after replacement infra defaults live in Builder code
    status: pending
  - id: schema-docs
    content: application-schema + docs—only `port` + frontDoor (remove `build.localPort`); env.template url://; sample YAMLs/generators
    status: pending
  - id: matrix-tests
    content: Jest goldens—§ scoping truth table; § base URL matrix (dev); tst/pro/miso rows; § run --reload matrix; §8 remote + dev id `01` vs nil/`0` (bare host) cases
    status: pending
isProject: false
---

# Declarative `url://` resolution (Builder only)

## Scope

This work lives entirely in the **aifabrix-builder** repository (this repo). It is **not** a Dataplane feature. Dataplane and other runtimes consume the **generated `.env` files** produced by the Builder; they do not own this resolver.

## What lives where

### Application manifest (per app, e.g. `builder/dataplane/application.yaml` inside a product repo)

- `**port`** — single canonical listen port for the app (container and internal URLs). **Host** ports for local dev and docker-published maps are **computed** at resolve time (see Resolver §5). `**build.localPort` is removed** — do not declare it in `application.yaml` or in schema; it must not appear in generators or sample apps after migration.
- `**frontDoorRouting` (front door)** — routing intent only: **enabled**, **pattern** (path), TLS/options as needed by schema. **No public URLs, no internal URLs, no hostnames** in this file.

The manifest is **environment-neutral**: the same file is used for dev, tst, pro; differences come from **resolve-time inputs** (below), not from duplicating addresses per environment.

### `env.template`

- Defines the **shape** of the eventual `.env` (keys, kv references, defaults).
- Contains **declarative URL placeholders**, for example:
  - `url://public`
  - `url://internal`
  - `url://miso-controller-public` (cross-app; other registered app keys as needed)

The Builder replaces these with concrete URLs when generating output.

### `~/.aifabrix/urls.local.yaml`

- **Global registry** for **all registered applications** the Builder knows about in the current workspace/workflow.
- Holds **only** intrinsic per-app data needed for resolution, for example:
  - `<app-key>-port`
  - `<app-key>-pattern`
- Does **not** store resolved URLs, `remote-server`, or environment-specific path prefixes. Those are computed each time `.env` files are generated.

## Resolver (conceptual algorithm — Builder)

Single pipeline used for **batch** and **per-app** resolve. Order matters where noted.

1. **Load user/workspace configuration** from `~/.aifabrix/config.yaml` (and related Builder config): e.g. **developer-id**, **remote-server** (if any), **useEnvironmentScopedResources**, paths, etc.
2. **Load or refresh `urls.local.yaml`** so it lists **every application’s** port and front-door pattern (from scanning `builder/*/application.yaml` or equivalent app registration list).
3. **Load secrets / environment file data** as today: resolve `kv://` and any other Builder rules so template placeholders become values where possible.
4. **Determine environment key for URL paths** (`dev`, `tst`, `pro`, `miso`) from the **application client id** available after resolution — conventionally `**MISO_CLIENTID`** (e.g. `miso-controller-dev-dataplane`). Builder implements parsing:
  - Optional override: `**MISO_PIPELINE_ENV_KEY`** if present in resolved env.
  - Else: split client id on `-`, scan **from the last segment backward**, first token in `{dev,tst,pro,miso}` wins; if none, default (e.g. `miso`). **This logic is specified and tested inside Builder**; align naming with how the controller issues client ids, but **no dependency on another repo’s source code.**
5. **Compute host-facing ports** from `**port`** (manifest only) and numeric `**developerIdNum`** parsed from `**developer-id`** in config (e.g. string `01` → `**1`**; missing or non-numeric → `**0`**):
  - **Inside the container** the app always listens on `**port`**.
  - **Docker** `.env` profile — when public URLs use **host-published** port (e.g. `http://localhost:<pub>/…` in the golden matrices):  
  `**publishedHostPort = port + (developerIdNum * 100)`**  
  Example: `port=3001`, `developer-id=01` → **3101** (unchanged vs current matrix **A3/C3**).
  - **Local** `.env` profile — host port for `**url://public`** on the workstation:  
  `**localHostPort = port + 10 + (developerIdNum * 100)`**  
  Replaces former `**build.localPort`**. Example: `3001`, `01` → 3111 (unchanged vs matrix A4/C4). For `**developerIdNum = 0`**: `localHostPort = port + 10` only.
   Document edge cases (large `developer-id`, port overflow) in implementation; golden tests use `**01**` as today.
6. **Apply environment-scoped path prefix** when **URL-path effective** per [117-environment-scoped_resources_schema.plan.md](117-environment-scoped_resources_schema.plan.md). Builder must compute the same boolean as deploy/resolve: `baseEffective = Boolean(config.useEnvironmentScopedResources) && Boolean(app.environmentScopedResources)`; `**url://public` path prefix** applies only when `baseEffective && derivedEnvKey ∈ {dev,tst}` — then insert `/<derivedEnvKey>` before the app pattern (e.g. `/dev/data`, `/tst/data`). If `derivedEnvKey` is `pro` or `miso`, **no path prefix** even when `baseEffective` is true (plan 117: pro/miso never use the prefix).
7. **Combine** with `**remote-server**` (when set) vs **local** base URL for public URLs; choose **internal** bases per profile (service name:port inside docker network vs host-reachable URL for local profile) — product matrix from earlier discussion applies here.
8. **Remote-server developer subdomain (host rewrite):** When `**remote-server**` is set, any **public** (or local-profile mirror) URL whose origin matches that of `remote-server` must apply a **developer-scoped host** before final emission:
  - **Condition:** `**developer-id**` is **present, non-empty, and parses to `developerIdNum !== 0**` (see Resolver §5). If `**developer-id**` is **absent, empty, or parses to `0**`, do **not** rewrite the host.
  - **Transform:** `https://<remote-host>/<path>` → `https://dev<label>.<remote-host>/<path>` (same scheme and path). Example: `remote-server` `https://builder02.local`, `developer-id` `01`, path `/dev/data` → `**https://dev01.builder02.local/dev/data**`. With **no** dev id (nil / empty / `0`): `**https://builder02.local/dev/data**` → unchanged `**https://builder02.local/dev/data**`.
  - `**label`:** Use `dev` plus a stable string derived from the configured developer identity — e.g. **zero-padded numeric** `developerIdNum` → `dev01` for id `1`, `dev12` for id `12` (align with DNS labels; document exact padding in implementation). Optionally preserve leading zeros from config when they are the canonical form (e.g. config `01` → subdomain `dev01`).
  - **Scope:** Applies to URLs built from the `remote-server` base (Matrices **A/B/C** “remote yes” columns). **Does not** change `http://dataplane:3001` or other internal service hosts.
9. **Expand all `url://…` references** in the resolved template content using the registry + computed bases + patterns + path prefix **and**, when applicable, step **8**.
10. **Emit two artifacts** for the app (or workspace batch):
  - **Docker** `.env` (correct values for in-compose / remote-docker context).
  - **Local** `.env` (correct values for host-side dev).

Changing `**remote-server**` (or other global inputs) should allow **one** batch operation to re-run the pipeline so **all** applications get consistent `.env` outputs and an up-to-date `urls.local.yaml`.

## Use-case matrix (golden values for tests)

Use these tables as **contract fixtures** in Jest: same inputs → same `url://public` / `url://internal` expansions (and, for **reload**, same values on host as in the container run `.env`).

### Plan 117 — two-layer scoping → **public URL path prefix**

Aligned with [117-environment-scoped_resources_schema.plan.md](117-environment-scoped_resources_schema.plan.md).


| `config.yaml` `useEnvironmentScopedResources` | `application.yaml` `environmentScopedResources` | Derived envKey (from `MISO_CLIENTID` / override) | **Path prefix** in `url://public` (before app pattern, e.g. `/data`) |
| --------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| `false` or absent                             | any                                             | any                                              | **none** (user gate passivated)                                      |
| `true`                                        | `false` or absent                               | any                                              | **none** (app not opted in)                                          |
| `true`                                        | `true`                                          | `dev`                                            | `**/dev**`                                                           |
| `true`                                        | `true`                                          | `tst`                                            | `**/tst**`                                                           |
| `true`                                        | `true`                                          | `pro`                                            | **none** (plan 117: pro never prefixed)                              |
| `true`                                        | `true`                                          | `miso`                                           | **none** (plan 117: miso never prefixed)                             |


Abbreviations for tables below:

- **URL-path effective** = prefix column is `/dev` or `/tst` as above (not “none”).
- **URL-path inactive** = prefix none → public path is `/data` only (same as former “unscoped” columns).

`deriveEnvKeyFromClientId` must be covered by dedicated tests (`…-dev-…`, `…-tst-…`, `…-pro-…`, `miso-…`, override `MISO_PIPELINE_ENV_KEY`).

### Fixed example inputs (unless a row overrides)


| Parameter                                         | Value                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| App                                               | `dataplane` (`urls.local.yaml`: `dataplane-port: 3001`, `dataplane-pattern: /data/*`) |
| `port` (only port in manifest)                    | `3001`                                                                                |
| `developer-id`                                    | `01` → `**developerIdNum = 1**`                                                       |
| Computed `**publishedHostPort**` (docker profile) | `3001 + 1*100` = **3101**                                                             |
| Computed `**localHostPort**` (local profile)      | `3001 + 10 + 1*100` = **3111** (no `build.localPort`)                                 |
| `remote-server` (when “Remote”)                   | `https://builder02.local`                                                             |
| Path segment from pattern                         | `/data/*` → `**/data**` in URL                                                        |


### Matrix A — `url://public` / `url://internal` when **URL-path effective** (`/dev`)

Assumes: `useEnvironmentScopedResources: true`, `environmentScopedResources: true`, derived envKey `**dev**`, client id such as `miso-controller-dev-dataplane`.


| #   | `remote-server` set? | Output profile | `url://public`                     | `url://internal`                   |
| --- | -------------------- | -------------- | ---------------------------------- | ---------------------------------- |
| A1  | Yes                  | Docker `.env`  | `https://builder02.local/dev/data` | `http://dataplane:3001`            |
| A2  | Yes                  | Local `.env`   | `https://builder02.local/dev/data` | `https://builder02.local/dev/data` |
| A3  | No                   | Docker `.env`  | `http://localhost:3101/dev/data`   | `http://dataplane:3001`            |
| A4  | No                   | Local `.env`   | `http://localhost:3111/dev/data`   | `http://dataplane:3001`            |


### Matrix B — same as A but **URL-path effective** with envKey `**tst**` (prefix `/tst`)

Assumes: both flags `true`, derived envKey `**tst**` (e.g. client id containing `-tst-`). Replace `**/dev**` with `**/tst**` in every `url://public` value (and in `url://internal` when it mirrors public on Local `.env`).


| #   | `remote-server` set? | Output profile | `url://public`                           |
| --- | -------------------- | -------------- | ---------------------------------------- |
| B1  | Yes                  | Docker `.env`  | `https://dev01.builder02.local/tst/data` |
| B2  | Yes                  | Local `.env`   | `https://dev01.builder02.local/tst/data` |
| B3  | No                   | Docker `.env`  | `http://localhost:3101/tst/data`         |
| B4  | No                   | Local `.env`   | `http://localhost:3111/tst/data`         |


(`url://internal` cells follow the same **internal** rules as Matrix A.) **B1/B2** use `**dev01**` when `developer-id` is non-zero (§8); else `**builder02.local**` only.

### Matrix C — **URL-path inactive** (no `/dev` or `/tst` prefix)

Use this whenever the Plan 117 table yields **none**: user gate off, or app flag off, or derived envKey is `**pro**` or `**miso**`, or any combination that does not produce `/dev`/`/tst`. Public path is `**/data**` only.


| #   | `remote-server` set? | Output profile | `url://public`                 | `url://internal`               |
| --- | -------------------- | -------------- | ------------------------------ | ------------------------------ |
| C1  | Yes                  | Docker `.env`  | `https://builder02.local/data` | `http://dataplane:3001`        |
| C2  | Yes                  | Local `.env`   | `https://builder02.local/data` | `https://builder02.local/data` |
| C3  | No                   | Docker `.env`  | `http://localhost:3101/data`   | `http://dataplane:3001`        |
| C4  | No                   | Local `.env`   | `http://localhost:3111/data`   | `http://dataplane:3001`        |


Representative tests: `(use=false, app=true)`, `(use=true, app=false)`, `(use=true, app=true, envKey=pro)`, `(use=true, app=true, envKey=miso)` — all should match **C1–C4** for the same remote/profile columns.

Port notes: **3001** = container listen `**port**`; **3101** = `publishedHostPort`; **3111** = `localHostPort` per §5 formulas with `developer-id` `01`.

Cross-app (`url://miso-controller-public`, etc.): same rules using that app’s `urls.local.yaml` port/pattern and the **same** scoping row for the **target** app’s public URL.

### Matrix D — `aifabrix run myapp --reload`

CLI: `--reload` — *In dev: use sync and mount (requires remote server; Mutagen or local Docker)* ([lib/cli/setup-app.js](lib/cli/setup-app.js)). Host `.env` at `envOutputPath` must match **container** run `.env` for `url://*` expansions ([lib/utils/env-copy.js](lib/utils/env-copy.js)).


| #   | `run --env`     | `remote-server` | Sync / mount                           | `useEnvironmentScopedResources` | `app environmentScopedResources` | Derived envKey | Expected `**envOutputPath` `.env**` for `url://*`                                                                                                                                                                                                                                                                                                   |
| --- | --------------- | --------------- | -------------------------------------- | ------------------------------- | -------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `dev` (default) | set             | Mutagen + SSH ok, `--reload`           | `true`                          | `true`                           | `dev`          | **Same strings as Matrix A** for **Docker `.env**` row matching remote yes/no (host file = docker-profile expansions)                                                                                                                                                                                                                               |
| D2  | `dev`           | set             | Mutagen ok                             | `false`                         | `true`                           | `dev`          | Same as **Matrix C** docker row (path `/data` only)                                                                                                                                                                                                                                                                                                 |
| D3  | `dev`           | set             | Mutagen ok                             | `true`                          | `false`                          | `dev`          | Same as **Matrix C** docker row                                                                                                                                                                                                                                                                                                                     |
| D4  | `dev`           | absent          | Local Docker, `--reload`               | `true`                          | `true`                           | `dev`          | Same as **A3** (docker profile: `localhost:3101/...`)                                                                                                                                                                                                                                                                                               |
| D5  | `dev`           | set             | **No** sync config / remote sync fails | any                             | any                              | any            | **Error** (substring): `run --reload requires remote server sync settings` — full message in [lib/app/run.js](lib/app/run.js) (`ensureReloadSync`) includes hints for `aifabrix dev init` / `user-mutagen-folder`, `sync-ssh-user`, `sync-ssh-host`                                                                                                 |
| D6  | `tst`           | set or absent   | `--reload`                             | `true`                          | `true`                           | `tst`          | **Docker profile** for tst — same as **Matrix B** public/internal rules for the matching `remote-server` × profile; host `envOutputPath` still equals container env when run writes merge                                                                                                                                                           |
| D7  | `pro`           | *               | `--reload`                             | *                               | *                                | `pro`          | **No** `/dev`/`/tst` in public URLs (**Matrix C** shape); mount/sync: [lib/app/run.js](lib/app/run.js) `resolveRunOptions` only passes `devMountPath` when `options.reload && envKey === 'dev'` — **reload mount behavior is dev-specific in code today**; document so tests do not assume `devMountPath` for `tst`/`pro` unless product extends it |


**Golden rule for tests:** for each **D1/D2/D3/D4/D6** row, assert `envOutputPath` parsed map for any `url://`-expanded vars **equals** the corresponding **Docker `.env**` map for identical resolver inputs (parity with container).

### How tests should map to the matrices

- **Unit:** Plan 117 table → given gate, app flag, envKey → expect path prefix or none.
- **Unit:** `deriveEnvKeyFromClientId` fixtures for `dev` / `tst` / `pro` / `miso` / override.
- **Integration / golden:** Matrix **A1–A4**, **B1–B4**, **C1–C4** as string equality on `url://public` and `url://internal`; add at least one row **remote-server set + developer-id absent or `0**` expecting **no** `dev*.` subdomain (bare `builder02.local`).
- **Integration:** Matrix **D** — run prepare with mocked secrets and sync; assert merged `envOutputPath` matches docker-profile **A/B/C** row as specified.

## Validation — discussion coverage

This section audits **everything** raised in the conversation against the plan. Use it before implementation to confirm nothing is silently missing.

### Configuration and inputs


| Variable / topic                                                                      | Covered?           | Where                                                                                                                         |
| ------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Builder-only** scope (not Dataplane-owned resolver)                                 | Yes                | § Scope                                                                                                                       |
| `~/.aifabrix/config.yaml` **developer-id**                                            | Yes                | Resolver §1; fixtures `01`, port **3101** / **3111**                                                                          |
| `**remote-server**` (set vs absent)                                                   | Yes                | Matrices A/B/C columns; D1–D7; Resolver §8 `**dev<label>.` host** when `developer-id` non-zero; bare host when nil/`0`        |
| `**useEnvironmentScopedResources**` (user gate)                                       | Yes                | Resolver §1, §6; truth table; D2 vs D1                                                                                        |
| `**aifabrix dev set-scoped-resources**` (writes user gate)                            | Yes (by reference) | Same as user gate; see [117-environment-scoped_resources_schema.plan.md](117-environment-scoped_resources_schema.plan.md) §2b |
| `**application.yaml` `environmentScopedResources**`                                   | Yes                | Truth table; D3                                                                                                               |
| `**application.yaml` `port**` (sole port field)                                       | Yes                | Registry + fixtures (`3001`)                                                                                                  |
| `**build.localPort` removed**; local host port **computed**                           | Yes                | Resolver §5; fixed inputs (`localHostPort` / `publishedHostPort`)                                                             |
| `**application.yaml` `frontDoorRouting**` (pattern, enabled, TLS — **no URLs/hosts**) | Yes                | § What lives where                                                                                                            |
| `**~/.aifabrix/urls.local.yaml**` — **only** `<app>-port`, `<app>-pattern`            | Yes                | § What lives where                                                                                                            |
| No **resolved URLs** or **effectivePathPrefix** stored in registry                    | Yes                | § What lives where                                                                                                            |
| `**env.template**` shape + `**kv://**`                                                | Yes                | Resolver §3 (resolve before `url://`)                                                                                         |
| `**MISO_CLIENTID**` → derived **envKey**                                              | Yes                | Resolver §4; truth table; test note                                                                                           |
| `**MISO_PIPELINE_ENV_KEY**` override                                                  | Yes                | Resolver §4; test note (not duplicated per matrix row — covered by unit tests)                                                |
| **Batch / one-shot** refresh when `**remote-server**` (or globals) change             | Yes                | Resolver closing paragraph                                                                                                    |
| **Delete `lib/schema/env-config.yaml**` + `**aifabrix-env-config**`                   | Yes                | § Legacy removal                                                                                                              |
| **Infra defaults** replaced by **Builder code constants**                             | Yes                | § Legacy removal                                                                                                              |


### URL placeholders and outputs


| Variable / topic                                                 | Covered? | Where                                                                                                                            |
| ---------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `**url://public**`                                               | Yes      | A/B/C, D                                                                                                                         |
| `**url://internal**` (docker: service host; local: matrix rules) | Yes      | A/C (B: same internal rules as A, § Matrix B)                                                                                    |
| `**url://<appKey>-public**` (cross-app)                          | Yes      | § env.template; § Cross-app sentence after Matrix C                                                                              |
| `**url://<appKey>-internal**` (cross-app)                        | Partial  | **Implied** same as public with internal rules; add **golden test** row in implementation (plan does not spell a separate table) |
| **Two outputs**: **Docker** `.env` vs **Local** `.env**          | Yes      | Resolver §9; matrix “Output profile”                                                                                             |
| **Pattern** normalization (`/data/*` → `/data`)                  | Yes      | Fixed inputs                                                                                                                     |


### Scoping and run behavior


| Variable / topic                                                                   | Covered? | Where                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plan 117** `baseEffective` and **URL-path** prefix only when **dev/tst**         | Yes      | Truth table; Resolver §6                                                                                                                                                                        |
| **No** path prefix for `**pro`** / `**miso`** even if both flags true              | Yes      | Truth table rows                                                                                                                                                                                |
| **Matrix** remote × docker/local × path effective / inactive                       | Yes      | A, B, C                                                                                                                                                                                         |
| `**aifabrix run myapp --reload`**                                                  | Yes      | Matrix D                                                                                                                                                                                        |
| **Host `envOutputPath` ≡ container** for `url://*` on reload                       | Yes      | D intro; D1, D4, D6; env-copy / run.js refs                                                                                                                                                     |
| `**--reload`** Mutagen/remote vs **local Docker**                                  | Yes      | D1, D4, D5                                                                                                                                                                                      |
| `**run --env`** (`dev`/`tst`/`pro`) vs **derived envKey from client id**           | Partial  | **D6/D7** touch run env; **URL prefix** still follows **client-derived envKey** in matrices — tests must hold both notions where they diverge (document explicitly in implementation if needed) |
| `**resolveRunOptions`**: `**devMountPath`** only when `reload && envKey === 'dev'` | Yes      | D7                                                                                                                                                                                              |


### Known inconsistencies to close before coding


| Item                              | Issue                                                                    | Action                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cross-app `url://…-internal`**  | Not a separate golden table.                                             | Add **one** Jest case (e.g. `miso-controller-internal`) in **matrix-tests** todo.                                                             |
| **CLI `run --env` vs URL envKey** | If `run --env tst` but client id still `…-dev-…`, behavior is ambiguous. | **Resolve in implementation** (prefer client id for `url://` per plan; document run `--env` as lifecycle/mount only if that is the decision). |


### Verdict

All **major** cases and variables from the thread are represented: **two-layer scoping**, **client-id-derived envKey**, **remote/local**, **docker vs local .env**, **registry contents**, **reload parity**, **legacy env-config removal**, and **golden matrices** for **dev/tst** and **inactive** paths. **Host port rules** are locked in Resolver §5 (`**build.localPort` removed**). **Residuals** are **cross-app internal** golden and **run `--env` vs URL envKey**.

### Locked: port rules (replaces former open question)

- **Manifest:** only `**port`**.
- **Docker profile host-published:** `port + developerIdNum * 100`.
- **Local profile host:** `port + 10 + developerIdNum * 100`.

## Legacy removal (Builder)

- Remove `**build.localPort`** from [lib/schema/application-schema.json](lib/schema/application-schema.json), validators, generators, sample `application.yaml` files, and any helpers that read it (e.g. port resolution in [lib/utils/secrets-helpers.js](lib/utils/secrets-helpers.js)); use Resolver §5 formulas instead.
- Remove the `**lib/schema/env-config.yaml`** model and dependent code paths (`env-config-loader`, merge with `aifabrix-env-config`, etc.), tests, and documentation that described that world.
- Replace shared infra defaults (docker service names, base ports) with **Builder-owned constants** or a minimal internal module — not a second user-edited YAML parallel to `config.yaml`.
- Drop old host interpolation patterns (e.g. `${DEV_USERNAME}` in front door host) if front door **host** is no longer user-authored and URLs come only from `url://` resolution.

## Deliverables checklist

- Builder resolver module + **Jest** golden cases for client-id → env key, port math, and URL matrix (docker/local × remote/local × scoped on/off).
- `urls.local.yaml` read/write and **batch resolve** UX (exact command shape TBD in implementation).
- Schema + validator: `**application.yaml`** — `**port` + front door** only for routing; **remove `build.localPort`** everywhere; **forbids** embedding resolved URLs if that was previously allowed.
- **Documentation** under `docs/` in this repository: manifest, `env.template`, `url://`, global registry, `resolve`/batch workflow, removal of env-config story.

## Rules and standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** — **BUILD → LINT → TEST** before merge; `npm run build` first per repository workflow.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** — Files ≤500 lines, functions ≤50 lines; split resolver/registry modules if needed; JSDoc on new public exports.
- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** — Schema and AJV where new machine-readable artifacts are introduced; removing `build.localPort` must keep `application-schema.json` validation and generator tests green.
- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** — CommonJS, `lib/schema/` for schemas; new resolver in `lib/` with clear boundaries (`path.join()` for paths).
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** — Any batch-resolve or extended `resolve` UX: Commander.js, input validation, chalk, try/catch on async.
- **[Template Development](.cursor/rules/project-rules.mdc#template-development)** — `env.template` gains `url://` placeholders; document patterns for generators that emit templates.
- **[Docker & Infrastructure](.cursor/rules/project-rules.mdc#docker--infrastructure)** — Dual docker vs local `.env` must stay consistent with [lib/utils/compose-generator.js](lib/utils/compose-generator.js) and [lib/app/run.js](lib/app/run.js) published-port behavior.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** — Resolver must not log resolved URLs if they contain secrets; never log `secrets.local.yaml` contents; **kv://** materialized before **url://** (overlap with [116-infra.parameter.yaml_parameters.plan.md](116-infra.parameter.yaml_parameters.plan.md)).
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** — Jest golden matrices §A–D; mock workspace/fs where needed; ≥80% coverage on **new** resolver and registry code.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** — Fail fast on ambiguous `run --env` vs client-id envKey with clear messages once product decision is fixed.

**User docs:** [.cursor/rules/docs-rules.mdc](.cursor/rules/docs-rules.mdc) — command-centric `docs/` (what the CLI does, not REST/API detail).

**Key requirements:** Implement **117** gate booleans or stub them in tests; keep `**baseEffective`** formula identical to [117-environment-scoped_resources_schema.plan.md](117-environment-scoped_resources_schema.plan.md); coordinate `**kv://` before `url://`** with plan **116** in any unified resolve pipeline.

## Before development

- Read [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) and [Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns) in `project-rules.mdc`.
- Re-read [117-environment-scoped_resources_schema.plan.md](117-environment-scoped_resources_schema.plan.md) (two-layer gate, dev/tst-only path prefix).
- Skim [116-infra.parameter.yaml_parameters.plan.md](116-infra.parameter.yaml_parameters.plan.md) for catalog / `**kv://`** ordering relative to this resolver.
- Trace: [lib/core/secrets.js](lib/core/secrets.js) or current resolve chain, [lib/utils/secrets-helpers.js](lib/utils/secrets-helpers.js), [lib/utils/env-copy.js](lib/utils/env-copy.js), [lib/app/run.js](lib/app/run.js) (`calculateHostPort`, `ensureReloadSync`, `resolveRunOptions`), [lib/cli/setup-app.js](lib/cli/setup-app.js) `--env` / `--reload`.
- Trace legacy removal: [lib/schema/env-config.yaml](lib/schema/env-config.yaml), [lib/utils/env-config-loader.js](lib/utils/env-config-loader.js), [lib/utils/config-paths.js](lib/utils/config-paths.js) `aifabrix-env-config`.
- Decide and document **single source of truth** for URL path envKey when `run --env` and `MISO_CLIENTID` disagree (plan § known inconsistencies).

## Definition of done

Before marking this plan complete:

1. **Build:** Run `npm run build` **first** (must succeed).
2. **Lint:** Run `npm run lint`; **zero** errors and **zero** warnings.
3. **Test:** Run `npm test` or `npm run test:ci` **after** lint; all tests pass; **≥80% coverage** on new resolver, registry, and port-math helpers.
4. **Validation order:** **BUILD → LINT → TEST** only; no skipped steps.
5. **File / function size:** New/changed files ≤500 lines; functions ≤50 lines.
6. **JSDoc:** New exported functions documented (`@param`, `@returns`, `@throws`).
7. **Security:** No hardcoded secrets; no logging of sensitive env values; ISO 27001–aligned handling of generated `.env` paths in errors (paths OK, values not).
8. **Documentation:** `docs/` updated (manifest, `env.template`, `url://`, registry, batch resolve); per [docs-rules.mdc](.cursor/rules/docs-rules.mdc).
9. **Plan success criteria:** Golden matrices A/B/C/D implemented or equivalent coverage; `build.localPort` removed from schema/generators/helpers; env-config stack removed or replaced per **Legacy removal**; `urls.local.yaml` read/write operational; **117** `baseEffective` behavior matches truth table when 117 is present (or explicitly stubbed in tests until 117 lands).
10. **Frontmatter todos:** All `todos` completed or superseded by a follow-up plan reference.
11. **Cross-plan:** Implementation stays consistent with **117** URL-path rules and **116** `kv://` / resolve order if those plans ship in the same release train.

## Codebase validation (2026-04-05)

**Verdict:** The plan is **internally consistent** and matches high-level Builder layout. It describes a **large behavioral change** versus today’s implementation; several items below must be reflected during implementation (not blockers to the spec).

### Evidence — paths and today’s behavior


| Plan claim                                     | Reality check                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/schema/application-schema.json`           | Exists. `**build.localPort`** still present under `build` (e.g. `localPort` around line ~745). `**frontDoorRouting`** exists (not a separate `frontDoor` root key).                                                                                                 |
| `lib/schema/env-config.yaml`                   | Exists; default via [lib/utils/config-paths.js](lib/utils/config-paths.js) (`aifabrix-env-config`). Removal implies `**lib/utils/env-config-loader.js`**, `**dev set-env-config`**, and **secrets-helpers** override chain updates—not only deleting one YAML file. |
| `lib/utils/secrets-helpers.js`                 | Exists; documents `**build.localPort` or `port`** for local `.env` / `envOutputPath` behavior—align with plan §5 when removing `localPort`.                                                                                                                         |
| `lib/app/run.js` `calculateHostPort`           | Today: `hostPort = options.port                                                                                                                                                                                                                                     |
| `url://` placeholders                          | **Not implemented** in lib today (only in this plan). Resolver is greenfield.                                                                                                                                                                                       |
| `~/.aifabrix/urls.local.yaml`                  | **Not present** in codebase; greenfield registry.                                                                                                                                                                                                                   |
| Plan **117** gate fields                       | `**useEnvironmentScopedResources`**, `**environmentScopedResources`** not in production code yet—118’s §6 matrices assume 117 (or feature-flagged tests).                                                                                                           |
| [lib/utils/env-copy.js](lib/utils/env-copy.js) | Exists; uses `getLocalPort` / port resolver—will evolve with dual docker vs local `.env` outputs.                                                                                                                                                                   |
| Matrix D5 / D7                                 | `ensureReloadSync` throws with message containing `run --reload requires remote server sync settings`; `resolveRunOptions` sets `devMountPath` only when `options.reload && envKey === 'dev'` — matches plan D7 note.                                               |


### Doc / link hygiene

- Fixed in this pass: broken markdown links `[aifabrix-builder](aifabrix-builder)` → plain repo wording.
- **Dependency:** Treat [117-environment-scoped_resources_schema.plan.md](117-environment-scoped_resources_schema.plan.md) as **ordering or contract**: either land 117 first, or stub the same booleans in 118 so golden tests match the truth table.

### Residuals (unchanged — still valid)

- **Cross-app `url://…-internal`** golden (plan already flags).
- `**run --env` vs client-id-derived envKey** for URL prefix (plan §258–264); implementation must pick one source of truth and document it.

## Open questions (to close before implementation)

- **Registry collisions**: single `~/.aifabrix/urls.local.yaml` vs per-workspace file if `AIFABRIX_WORK` differs.
- **Missing `MISO_CLIENTID` at resolve**: fail fast vs require `MISO_PIPELINE_ENV_KEY` in secrets for local-only apps.

## Plan validation report (`/validate-plan`)

**Date:** 2026-04-05  
**Plan:** `.cursor/plans/118-declarative_url_resolution.plan.md`  
**Status:** ✅ VALIDATED

### Plan purpose

Builder-only **declarative `url://` resolution**: single `port` + `frontDoorRouting`, `**~/.aifabrix/urls.local.yaml`**, dual Docker vs Local `.env`, port math (`publishedHostPort` / `localHostPort`), client-id `**deriveEnvKey`**, integration with **117** path prefix and **reload** parity (Matrix D). Removes `**build.localPort`** and **env-config.yaml** stack. **Type:** Architecture + Development + Refactoring (legacy removal) + Documentation + Testing.

### Applicable rules

- ✅ [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) — DoD §1–4.
- ✅ [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) — DoD §5–6; Rules section.
- ✅ [Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns) — Schema + template validation.
- ✅ [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns) — `lib/` layout.
- ✅ [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development) — Batch resolve TBD.
- ✅ [Template Development](.cursor/rules/project-rules.mdc#template-development) — `env.template` `url://`.
- ✅ [Docker & Infrastructure](.cursor/rules/project-rules.mdc#docker--infrastructure) — Compose/run alignment.
- ✅ [Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) — Secrets / resolve order with 116.
- ✅ [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) — Golden matrices.
- ✅ [Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging) — Ambiguity resolution §259–264.

### Rule compliance

- ✅ DoD: Full checklist (items 1–11) added with BUILD → LINT → TEST, coverage, security, docs, todos, cross-plan consistency.
- ✅ Rules and standards: Linked `project-rules.mdc`, `docs-rules.mdc`, plans **116**/**117**.
- ✅ Before development: Trace and decision checklist for envKey ambiguity.

### Plan updates made (this `/validate-plan` run)

- Inserted **Rules and standards**, **Before development**, and **Definition of done** before **Codebase validation**.
- Appended this **Plan validation report**.
- Added Resolver **§8** — **remote-server developer subdomain**: `https://builder02.local/…` → `https://dev01.builder02.local/…` when `developer-id` is non-zero/non-empty; unchanged host when dev id nil/empty/`0`. Updated golden matrices **A/B/C** remote rows and validation table row for `remote-server`.

### Recommendations

- Land **117** (or test doubles) before asserting §6 matrices in CI.
- When **116** introduces unified resolve, enforce **step 3 → step 8** order from this plan’s Resolver section in one module to avoid drift.
- Resolve `**run --env` vs `deriveEnvKey`** early and encode in Jest to avoid flaky Matrix D tests.

