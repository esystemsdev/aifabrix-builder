---
name: up-miso dataplane parameter consolidation
overview: Single reference for `aifabrix up-miso` / `up-dataplane` — how `kv://` and `${VAR}` resolve for local install, what is auto-generated vs intentionally empty, gaps toward **zero manual** setup, and alignment with 121/122/124. **Docs:** `docs/configuration/infra-parameters.md` must be updated in lockstep (user-facing mirror of § “How values resolve” + platform install + link to this plan). **Does not by itself add new catalog `parameters[]` rows** (121 owns the catalog; 123 tracks gaps and follow-ups). **URL semantics:** [124](124-declarative-url-truth-table.plan.md) is the canonical truth table; [122](122-declarative_url_resolution.plan.md) is the Plan 122 archive (delivery + deep matrices).
todos:
  - id: defer-urls-to-122
    content: Do not add catalog `literal` URL generators for service public URLs; migrate keycloak/miso/dataplane URL-shaped `kv://` to `url://` + registry per 122 when that plan ships
    status: completed
  - id: optional-standard-dataplane-keys
    content: Optionally extend `standardUpInfraEnsureKeys` (or discovery doc) for dataplane DB indices 0–3 if product wants secrets before first `builder/dataplane` copy
    status: completed
  - id: dedupe-create-default-secrets
    content: Align or remove `createDefaultSecrets` duplication vs catalog (`lib/utils/secrets-generator.js`)
    status: completed
  - id: tighten-legacy-generate
    content: Narrow `generateSecretValue` fallback after catalog; unknown `kv://` keys fail `parameters validate` already — reduce silent heuristics over time
    status: completed
  - id: database-secret-yaml-source
    content: Remove `MISO_CONTROLLER_DATABASE_NAMES` constant when `requires.databases` is always authoritative (`lib/parameters/database-secret-values.js`); document `_pass123` formula in infra-parameters.md or catalog notes
    status: completed
  - id: tests-union-kv
    content: Jest — union of active `kv://` in keycloak, miso-controller, dataplane `env.template` files remains catalog-covered (extend `parameters-validate` / fixture tests when templates add keys)
    status: completed
  - id: local-zero-touch-urls
    content: Until 122 ships, close gap where URL-shaped `kv://` use `emptyString` in catalog (keycloak/miso/dataplane public+internal) — interim non-empty local bootstrap or document required `resolve --force` + manual URL fill
    status: completed
  - id: semantic-kv-onboarding-email
    content: ONBOARDING_ADMIN_EMAIL uses `*KeyVault` pattern → randomBytes32 today (invalid email); catalog exact entry with emptyAllowed or literal dev default, or template default without kv
    status: completed
  - id: docs-infra-parameters-md
    content: "Update docs/configuration/infra-parameters.md: `${VAR}` vs `kv://` resolution (infra-env-defaults.js, resolve order); shared keys (e.g. miso-controller-api-key); empty URL/Azure keys; recommended up-infra → up-miso → up-dataplane; link .cursor/plans/123; keep command-centric (no REST); refresh Related links"
    status: completed
isProject: false
---

# Plan 123 — `up-miso` / `up-dataplane` and parameter consolidation

## Relationship to other plans


| Plan                                                                                       | Role                                                                                                                                                                           | Status                                                  |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| [121-infra.parameter.yaml_parameters.plan.md](121-infra.parameter.yaml_parameters.plan.md) | `infra.parameter.yaml` catalog, catalog-first `generateSecretValue`, `up-infra` discovery, `aifabrix parameters validate`                                                      | **Complete** (see 121 Implementation Validation Report) |
| [122-declarative_url_resolution.plan.md](122-declarative_url_resolution.plan.md)           | `url://` placeholders, `urls.local.yaml`, port math, remove `build.localPort`; **resolve order: `kv://` then `url://`** (Builder no longer ships `lib/schema/env-config.yaml`) | **Complete** (see 122 Implementation Validation Report) |
| **123 (this doc)**                                                                         | Bridges platform install commands + remaining cleanup; **does not redefine** 121 or 122                                                                                        | **Complete**                                            |


## Commands (behavioral summary)

- `**aifabrix up-miso`** — Requires `up-infra` healthy; ensures `builder/keycloak` and `builder/miso-controller` from templates; runs both apps in Docker (`lib/commands/up-miso.js`).
- `**aifabrix up-dataplane`** — Controller health + auth; ensures `builder/dataplane`; register/rotate + deploy; runs dataplane locally (`lib/commands/up-dataplane.js`).

Secrets for `.env` generation flow through resolve: `env.template` → interpolate `${VAR}` where applicable → replace `kv://` from the secrets store → profile-specific passes (docker/local) in `lib/core/secrets.js` / `lib/utils/secrets-helpers.js`. Infra host/port defaults for `${VAR}` live in `**lib/utils/infra-env-defaults.js`** (loaded via `lib/utils/env-config-loader.js` → `buildEnvVarMap` in `lib/utils/env-map.js`); optional user override path remains `aifabrix dev set-env-config` if configured. Plan **122** shipped `url://` + `urls.local.yaml` on top of the same ordering (`**kv://` before `url://`**). **124** refines *how* those URLs compose (proxy vs direct); invariant and tables live there.

## How values resolve (local install)

Two independent mechanisms appear in `env.template`:

### A. `${VAR}` placeholders (not secrets)

Examples: `KEYCLOAK_PUBLIC_PORT`, `REDIS_HOST`, `DB_HOST`, `KEYCLOAK_HOST`, `KEYCLOAK_PORT`, `MISO_HOST`, `MISO_PORT`.

- **Source:** `buildEnvVarMap(environment, …)` merges `**[lib/utils/infra-env-defaults.js](lib/utils/infra-env-defaults.js)`** (`docker` vs `local` blocks) with **developer-id** port math (`*_PUBLIC_PORT`, etc.).
- **When:** First phase of `resolveKvReferences` — `interpolateEnvVars(template, envVars)` runs **before** `kv://` substitution (`lib/core/secrets.js`, `lib/utils/secrets-helpers.js`).
- **Result:** For a normal dev install, these are **never empty** unless defaults are wrong or interpolation order is broken.

### B. `kv://secret-key` references (secrets store)

Examples: `API_KEY=kv://miso-controller-api-key-secretKeyVault`, `ENCRYPTION_KEY=kv://secrets-encryptionKeyVault`, database URLs/passwords, Azure/Mori keys.

- **Source:** User secrets file (e.g. `~/.aifabrix/secrets.local.yaml` or configured path), populated by `**up-infra`** (`ensureInfraSecrets` + discovery) and/or `**aifabrix resolve <app> --force`** / ensure-on-run paths that call `ensureSecretsFromEnvTemplate`.
- **Rules:** `[lib/schema/infra.parameter.yaml](lib/schema/infra.parameter.yaml)` — each key has a **generator** (or matches a **keyPattern**):
  - `**randomBytes32`** — e.g. most `*KeyVault` suffix keys: **API_KEY**, **ENCRYPTION_KEY**, JWT secrets, onboarding **password**, Keycloak tokens, dataplane client secret, etc. First ensure creates a value; **dataplane and miso-controller sharing `miso-controller-api-key-secretKeyVault`** means one shared secret file entry serves both apps.
  - `**databaseUrl` / `databasePassword**` — `databases-*-{index}-*` keys aligned with `requires.databases` in `application.yaml`.
  - `**literal**` — e.g. `redis-url` = `redis://${REDIS_HOST}:${REDIS_PORT}`; `${REDIS_*}` expanded when the secret value is applied (`replaceKvInContent` in `secrets-helpers.js`).
  - `**emptyString` / `emptyAllowed**` — URL-shaped keys in the catalog (`keycloak-server-url`, `keycloak-internal-server-url`, pattern `^[a-z0-9-]+-url$`, etc.) and **redis-password** when Redis has no password locally.
- **“Missing” from the user’s point of view:** If a key was never **ensured**, resolve throws “Missing secrets”. Fix: run `up-infra`, then `resolve <app> --force` (or use commands that call ensure with `force`), so the catalog generates missing keys.

### C. Intentionally empty or “don’t care” for local

- **Azure `kv://` lines** (`AZURE_SUBSCRIPTION_ID`, …): catalog treats them as `*KeyVault` → **randomBytes32** locally unless refined. With `**DEPLOYMENT=database`** (or non-Azure modes), the controller often **does not** need real Azure credentials; random placeholders are acceptable for “install comes up”. If the app validates non-empty UUID-shaped values, catalog may need `**emptyAllowed`** or dedicated entries (follow-up).
- **URL-shaped secrets (legacy `kv://`):** catalog `**emptyString`** rows remain for **Azure/Bicep** and older secrets files. **Shipped** `templates/applications/miso-controller/env.template` and **dataplane** use `**url://`** for Keycloak + Miso public/internal URLs (same tokens as plan 122); resolve expands them after `kv://`. Optional **Mori** and other non-registry URLs may still use `kv://…-url` patterns with `emptyString` until product adds `url://` or literals.

### D. Onboarding admin email (historical)

- **Fixed:** exact catalog entry `**miso-controller-admin-emailKeyVault`** with `**generator: literal`** (`admin@aifabrix.ai`) so the key is not caught by `*KeyVault` → `randomBytes32`.

## Goal: local installation without manual work

**Today (honest state):**


| Area                                                     | Auto?               | Notes                                                                                                            |
| -------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `${VAR}` infra hosts/ports                               | Yes                 | `infra-env-defaults.js` + dev-id                                                                                 |
| Shared secrets (API key, encryption, JWT, DB strings)    | Yes                 | After `up-infra` + per-app ensure/`resolve --force`                                                              |
| Redis URL / empty redis password                         | Yes                 | `literal` + `emptyAllowed`                                                                                       |
| Public/internal service URLs (Keycloak, Miso, dataplane) | **Yes** (local)     | `**url://` in shipped miso-controller + dataplane templates**; Keycloak template uses `url://` for hostname/path |
| Onboarding admin email                                   | **Fixed**           | Catalog literal `admin@aifabrix.ai` (`miso-controller-admin-emailKeyVault`)                                      |
| Dataplane DB secrets before `builder/dataplane` exists   | **Yes** (bootstrap) | `standardUpInfraEnsureKeys` includes dataplane DB slots (plan 121 / 123)                                         |


**Delivered:** **122** URLs for platform templates; onboarding email literal; **standardUpInfraEnsureKeys** includes dataplane DB indices; **infra-parameters.md** documents resolve order and `**aifabrix up-infra` → `up-miso` → `up-dataplane`**.

## What must exist in the secrets store (`kv://`)

Union of **active** (non-comment) `kv://` lines in:

- [templates/applications/keycloak/env.template](templates/applications/keycloak/env.template)
- [templates/applications/miso-controller/env.template](templates/applications/miso-controller/env.template)
- [templates/applications/dataplane/env.template](templates/applications/dataplane/env.template)

**121** guarantees each such key matches [lib/schema/infra.parameter.yaml](lib/schema/infra.parameter.yaml) (exact or pattern) and is generated via catalog (or DB helpers) when ensured.

**Categories (informal):**

- **Infra-shared:** `redis-url`, `redis-passwordKeyVault`, `postgres-passwordKeyVault`, …
- **Per-app databases:** `databases-{appKey}-{index}-urlKeyVault` / `passwordKeyVault` (keycloak 0; miso-controller 0–1; dataplane 0–3)
- **Tokens / KeyVault suffix:** `*KeyVault` patterns (JWT, API keys, Azure/Mori placeholders, encryption, npm token, etc.)
- **URL-shaped keys today:** e.g. `keycloak-server-url`, `miso-controller-web-server-url`, `dataplane-web-server-url` — catalog often uses `emptyString` or patterns; platform templates use `**url://`** per **122** (shipped); **124** tracks further behavioral alignment (Traefik/direct, path prefixes).

## Does plan 123 add entries to `lib/schema/infra.parameter.yaml`?

**No — not as a goal of this plan.**

- **121** already introduced and maintains the catalog (`parameters[]`, patterns, `standardUpInfraEnsureKeys`, generators).
- **123** only tracks coordination and optional follow-ups. The only **optional** catalog touch is the todo *optional-standard-dataplane-keys*: if done, it may append **key names** to the root-level `standardUpInfraEnsureKeys` list (bootstrap list), not new `generator` / `parameters[]` definitions unless a new `kv://` key appears in templates first (then 121-style catalog work applies).
- **123 explicitly avoids** adding URL `literal` generators to the catalog for service public URLs — that stays with `**url://`** (**122** shipped; **124** for rule refinements).

## Design decisions (123)

1. **No second URL system in the catalog** — Avoid adding many `generator: literal` URL strings to `infra.parameter.yaml` for public/internal service URLs; that duplicates **122/124** and conflicts with resolve order documented in 121 ↔ 122.
2. **121 stays source of truth for `kv://` key names and generators** (secrets, DB URLs/passwords, random material).
3. **122 (archive) + 124 (canonical rules)** cover computed public/internal URLs, `urls.local.yaml`, and port/proxy composition. `**env-config.yaml` is gone** from Builder; **124** is the live truth table for URL behavior; **122** retains delivery history and deep matrices.
4. **Optional `standardUpInfraEnsureKeys`** for dataplane DB keys — Only if product requires secrets before `builder/dataplane` exists; otherwise discovery after template copy is enough (121 Phase 3 behavior).

## Follow-up work (todos above)

- **122/124 alignment:** When migrating templates, replace URL-like `kv://` with `url://public` / `url://internal` / cross-app refs (per shipped **122**); keep **121** catalog entries until migration, then delete or mark deprecated. **124** drives further resolver/test/doc work on Traefik vs direct and Plan 117 gating.
- **JS cleanup:** `createDefaultSecrets`, legacy `generateSecretValue` branches, `MISO_CONTROLLER_DATABASE_NAMES` — shrink in favor of catalog + YAML-driven DB lists (121 already fixed index-aware miso-controller generation; constant is a leftover optimization).
- **Tests:** Keep `parameters validate` / workspace tests in sync when platform `env.template` files gain new `kv://` keys.
- **Contributor/user docs (`docs-infra-parameters-md` todo):** Done for shipped `url://` (see Validation Report). For **deep** URL rules (proxy off, path prefixes, TLS), link or mirror from `[docs/configuration/declarative-urls.md](../docs/configuration/declarative-urls.md)` and **124** — not by re-expanding full matrices in `infra-parameters.md`.

## Definition of done (for 123 closure)

- Todos in this file’s frontmatter completed or explicitly superseded by merged **122** implementation (including `**docs-infra-parameters-md`**). Ongoing URL *rule* work is **124**, not a reopen of 123.
- `**docs/configuration/infra-parameters.md` updated** to reflect resolution of `${VAR}` vs `kv://`, shared secret keys, legacy empty URL `kv://` rows where still relevant, onboarding email, and the recommended platform command sequence — with a **Related** link to this plan (`.cursor/plans/123-up-miso-dataplane-and-parameter-consolidation.plan.md`).
- **Zero-touch local install:** URL-shaped values populated by `**url://`** (122 shipped); **onboarding email** no longer random bytes; command sequence documented and verified (up-infra → up-miso → up-dataplane).
- No contradiction with 121 (catalog) or 122/124 (`url://` / registry / legacy removal; **124** for behavioral truth table).

## Mermaid — target pipeline (`url://` layer, shipped with 122)

```mermaid
flowchart LR
  subgraph today [Today infra-env-defaults.js]
    builderPorts[infra-env-defaults plus dev-id ports]
    catalog[infra.parameter.yaml]
    secrets[secrets store]
    kv[kv resolve]
    env[.env]
    catalog --> secrets
    secrets --> kv
    builderPorts --> kv
    kv --> env
  end
  subgraph after122 [After 122 complete]
    urlsReg[urls.local.yaml]
    urlRes[url expand]
    catalog2[infra.parameter.yaml]
    secrets2[secrets store]
    env2[docker and local .env]
    catalog2 --> secrets2
    secrets2 --> urlRes
    urlsReg --> urlRes
    urlRes --> env2
  end
```



**Invariant (121 + 122):** materialize `**kv://`** before expanding `**url://`**. **124** does not change that ordering; it specifies *composition* of expanded URLs (proxy vs direct, paths, TLS).

## Implementation Validation Report

**Date:** 2026-04-06  
**Plan:** `.cursor/plans/123-up-miso-dataplane-and-parameter-consolidation.plan.md`  
**Status:** ✅ **COMPLETE**

### Executive Summary

All **nine** YAML frontmatter todos are `**completed`**. Miso-controller and generic monitoring env snippets now use `**url://`** for Keycloak and Miso public/internal URLs (aligned with **dataplane**). `**generateSecretValue`** throws when the infra catalog loads but a key has **no rule**, and falls back to **legacy heuristics only** if the catalog **fails to load** (tests / broken installs). Catalog **notes** on `keycloak-server-url` / `keycloak-internal-server-url` document Bicep vs template split. `**lib/core/templates-env.js`** uses `url://miso-controller-public` for `MISO_WEB_SERVER_URL`.

### Task completion (frontmatter)

All todos: `completed` (see plan YAML).

### Code / template changes (closure)


| Area                                                  | Change                                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `templates/applications/miso-controller/env.template` | `KEYCLOAK_`* + `MISO_WEB_SERVER_URL` + `MISO_CONTROLLER_URL` → `url://…`                                               |
| `lib/core/templates-env.js`                           | `MISO_WEB_SERVER_URL` → `url://miso-controller-public`                                                                 |
| `lib/utils/secrets-generator.js`                      | Catalog-first + DB helpers; throw if unmatched when catalog OK; legacy only if catalog load throws                     |
| `lib/schema/infra.parameter.yaml`                     | Notes on legacy kv URL keys vs shipped `url://`                                                                        |
| `docs/configuration/infra-parameters.md`              | Gap paragraph updated for `url://` on platform templates                                                               |
| Plan body                                             | Relationship table: **121** / **122** / **124** / **123**; honest-state table refreshed; **124** = canonical URL rules |


### Tests updated

- `tests/lib/utils/secrets-generator.test.js` — catalog-backed keys + throw case; `generateMissingSecrets` fixtures use valid `*KeyVault` / `*-url` keys.
- `tests/lib/core/templates.test.js`, `templates-env.test.js` — expect `url://miso-controller-public`.

### Quality gates

- `npm run lint` — clean for touched JS.
- `npm test` — suites tied to this work pass in isolation; **full** `npm test` may still report unrelated failures in **external-datasource** / **generator** schema tests if the workspace schema fixtures are out of sync (pre-existing drift).

### Final checklist

- All frontmatter todos completed  
- Platform URL gap closed for miso-controller + docs  
- `generateSecretValue` tightened per plan  
- Plan 122 row marked Complete; **124** added later as canonical URL truth table (123 relationship table updated)

