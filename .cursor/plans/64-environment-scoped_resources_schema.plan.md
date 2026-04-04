---
name: Environment-scoped resources schema
overview: Per-application environmentScopedResources (e.g. dataplane) plus useEnvironmentScopedResources in ~/.aifabrix/config.yaml, toggled via aifabrix dev set-scoped-resources true|false. When effective and env is dev/tst, resource names are prefixed so dev/tst/pro can share Postgres and Docker. Miso and pro never use the prefix.
todos: []
isProject: false
---

# Environment-Scoped Resources (application.yaml + config.yaml + CLI)

## Purpose

Allow applications to opt in to **environment-prefixed resource names** so that dev, tst, and pro can share the same Postgres instance and Docker host without name collisions. When enabled and the target environment is **dev** or **tst**:

- Key Vault (kv://) keys: `<envKey>-<existing-key>` (e.g. `dev-my-keyvault-value-key`)
- Database names: `<envKey>-<existing-app-db>` (e.g. `dev-myapp` for PostgreSQL)
- Docker container name: `<envKey>-<existing-name>` (e.g. `dev-myapp`)
- Traefik path: `<envKey>-<virtual-dir>` (e.g. `/dev/api`)

**miso** and **pro** never use the prefix. **env.template is not modified;** resolution and generation use the **effective** flag so the resolved .env and services are correct.

### Two-layer control

| Layer | Where | Role |
| --- | --- | --- |
| **Application** | `application.yaml` (per app, e.g. dataplane) | Declares whether *this app* is designed to use env-scoped resources (`environmentScopedResources`: boolean, default `false`). |
| **User / workspace** | `~/.aifabrix/config.yaml` (`useEnvironmentScopedResources`) | **Activates** or **passivates** whether the CLI honors application-level `environmentScopedResources`. Prefer **`aifabrix dev set-scoped-resources true|false`** to change this; manual YAML edit remains valid. |

**Effective behavior:** Env-scoped naming (kv prefix, Redis DB index, compose container name, Traefik path, and related rules) applies only when:

1. **config.yaml** has the feature **activated** (see naming below), **and**
2. The **current app’s** `application.yaml` has `environmentScopedResources: true`, **and**
3. Current **envKey** is **dev** or **tst** (unchanged from the rest of this plan).

If config.yaml **passivates** the feature, treat **every** app as if `environmentScopedResources` were `false` for local resolution and compose generation, regardless of `application.yaml`. The raw application flag may still be emitted in deploy JSON for controller/dataplane alignment (implementation detail: document whether controller also respects a platform-level switch or only the manifest flag).

**Default recommendation:** **Passivated** in `config.yaml` (`false` or absent) so existing machines keep today’s behavior until the user explicitly opts in. Per-app default in schema remains `false`.

### Prerequisite

Implement this plan **after** [65-remote-docker-validated.plan.md](65-remote-docker-validated.plan.md). Plan 65 provides shared infra, `run --env dev|tst|pro`, and remote Docker; plan 64 adds env-prefixed resource names on top so dev/tst/pro can share the same Postgres and Docker host without collisions.

## Naming the flags

**Application (`application.yaml`):**

- **Recommended:** `environmentScopedResources` (boolean). Meaning: *this application* is allowed to use env-scoped resource names when the user config activates the feature.
- Alternatives considered: `prefixResourceNamesByEnvironment`, `sharedInfrastructureMode`. The first is verbose; the second describes the goal rather than the mechanism.

**User config (`~/.aifabrix/config.yaml`):**

- **Recommended:** `useEnvironmentScopedResources` (boolean) — `true` = **activated** (honor each app’s `environmentScopedResources`); `false` or omitted = **passivated** (ignore app flag for Builder-local behavior).
- Rationale: avoids duplicating the same key name in two files with different semantics; makes the merge rule readable in code and docs (`effective = config.useEnvironmentScopedResources && app.environmentScopedResources`).
- Alternatives: `environmentScopedResourcesEnabled`, or reusing `environmentScopedResources` only in config with doc clarity that it is the **global gate** (not recommended—confusing next to application.yaml).

## User experience

- **Application:** Each app that needs shared-infra dev/tst (e.g. dataplane) sets `environmentScopedResources: true` in `application.yaml`.
- **User (primary):** Runs `aifabrix dev set-scoped-resources true` to **activate** or `aifabrix dev set-scoped-resources false` to **passivate** the user gate. This writes **`useEnvironmentScopedResources`** to `~/.aifabrix/config.yaml` using the same persistence path as other `dev set-*` commands. **Alternative:** edit `config.yaml` by hand (set or remove the key); behavior must match the CLI.
- **Discovery:** Extend **`aifabrix dev show`** (or equivalent config summary) so the current value of `useEnvironmentScopedResources` is visible when set, consistent with how other `config.yaml` fields are shown (e.g. `format`, `developer-id`).
- **No double manual key work:** When effective scoping is on, resolution still adds prefixed kv keys from base keys as already described; `env.template` stays unchanged.
- **env.template stays identical:** We do **not** change env.template content (e.g. `builder/dataplane/env.template`). The file stays the same; when we **resolve** the .env file, we get correct values from the secret file(s) by using prefixed keys (and Redis index) when **effective** scoping is on and env is dev/tst.
- **Secrets when effective scoping is on:** If the user already has base keys in the secret file (e.g. `databases-myapp-0-urlKeyVault`) and effective flag is true, when we **resolve** we add the env-prefixed keys with the **same values** (e.g. `dev-databases-myapp-0-urlKeyVault` = value of base key). Secret files are for development and evaluation; Azure creates correct values and auto-generates them—no change needed there.

## Implementation (Builder-only)

### 1. Application schema

- **File:** [lib/schema/application-schema.json](lib/schema/application-schema.json)
- Add optional top-level property:
  - `environmentScopedResources`: boolean, default `false`
  - Description: When true, this **application** (e.g. dataplane) declares support for env-scoped resource names. The Builder applies prefixing only if **`useEnvironmentScopedResources`** is activated in `~/.aifabrix/config.yaml` and env is **dev** or **tst**; **miso** and **pro** never use the prefix. Used to run dev/tst/pro against the same Postgres and Docker host when the user gate is on.
- Add to schema metadata/changelog (non-breaking).

### 2. User config (`config.yaml`)

- **File:** Config load path used by CLI (e.g. [lib/utils/config-paths.js](lib/utils/config-paths.js) / `config.getConfig()` — exact module TBD at implementation time).
- Add optional property **`useEnvironmentScopedResources`** (boolean). Default when absent: **`false`** (passivated).
- Document in user-facing config docs (see §8): how to activate/passivate; interaction with per-app `environmentScopedResources`.
- Any command that resolves secrets, generates compose, or applies env-scoped naming must compute **`effectiveEnvironmentScopedResources = Boolean(config.useEnvironmentScopedResources) && Boolean(app.environmentScopedResources)`** (and still require dev/tst for actual prefixing per the rest of this plan).

### 2b. CLI: `aifabrix dev set-scoped-resources`

- **Command:** `aifabrix dev set-scoped-resources <true|false>` (positional boolean; reject invalid values with a clear message—mirror patterns from `dev set-format` / `dev set-id`).
- **Files (typical):** Commander registration next to other `dev` subcommands ([lib/cli/setup-dev.js](lib/cli/setup-dev.js) or [lib/cli.js](lib/cli.js) per current layout); handler in [lib/commands/dev-cli-handlers.js](lib/commands/dev-cli-handlers.js) (or the module that implements `dev set-format`, `dev set-env-config`).
- **Behavior:** Read merged config, set **`useEnvironmentScopedResources`** to the parsed boolean, write `config.yaml` with existing permissions rules (`600` / directory `700`). Print a short confirmation (chalk, consistent with sibling commands). Optionally print the **effective** reminder: app-level `environmentScopedResources` must still be true for any app to actually scope resources.
- **`dev show`:** Include **`useEnvironmentScopedResources`** in the displayed config when the key is present (and show effective default when absent: e.g. “passivated (default)” if product wants explicit UX).
- **Tests:** [tests/lib/commands/dev-cli-handlers.test.js](tests/lib/commands/dev-cli-handlers.test.js) (or parallel test file)—success for `true`/`false`, invalid argument, config write mocked; if `dev show` is extended, assert the field appears in output when set.

### 3. Application config and variable flow

- **Files:** [lib/utils/variable-transformer.js](lib/utils/variable-transformer.js), [lib/generator/split-variables.js](lib/generator/split-variables.js), [lib/generator/builders.js](lib/generator/builders.js)
- Ensure the application flag is:
  - Read from application.yaml (e.g. top-level `environmentScopedResources` or under `deployment`)
  - Passed through variable transformation and into deployment manifest
- **Deployment manifest:** Include `environmentScopedResources` (application intent) in the deploy JSON so the Controller can apply the same logic for Azure (DB names, Key Vault references, etc.). Whether CI/CD sets a platform equivalent of `useEnvironmentScopedResources` is out of scope for Builder-only work; align with controller docs.
- **Builder-local behavior** (secrets, compose, run): use **effective** flag (§2–3), not the raw application flag alone.

### 4. Key Vault (kv://) resolution

- **File:** [lib/core/secrets.js](lib/core/secrets.js)
- **env.template is unchanged;** resolution produces the correct .env. When generating .env for an app:
  - If **effective** `environmentScopedResources` is true and the **current environment key** (from config) is **dev** or **tst**, resolve using the **prefixed** kv key (e.g. `databases-myapp-0-urlKeyVault` → look up `dev-databases-myapp-0-urlKeyVault`).
  - **Add prefixed keys with same values:** If the prefixed key is missing in the secrets file, use the **base key’s value** and add the prefixed key with that same value (so existing base keys work; we duplicate to prefixed keys for dev/eval). User does not need to manually duplicate keys.
- **Current environment:** Pass **envKey** (miso | dev | tst | pro) into the resolve flow—from the run command’s `--env` when provided, otherwise from `config.getConfig().environment`. If envKey is missing or not dev/tst, do not prefix.

### 4b. Redis: correct DB index when resolving

- When **effective** scoping is true and envKey is **dev** or **tst**, set the correct **Redis DB index** when resolving (e.g. dev → index 0, tst → index 1, or a defined mapping) so each environment uses a different Redis DB on the same Redis instance. Apply this during resolution so the resolved .env (or Redis URL) contains the right index; env.template stays unchanged.

### 5. Docker Compose (run)

- **File:** [lib/utils/compose-generator.js](lib/utils/compose-generator.js)
- **Container name:** In `buildNetworkAndContainerNames`, when **effective** scoping is true and current envKey (passed in or from config) is **dev** or **tst**, set container name to `<envKey>-<appName>` (or keep devId if we want to avoid clashes between developers: e.g. `aifabrix-dev${devId}-${envKey}-${appName}`). Align with product preference (single dev host vs multi-developer).
- **Traefik path:** In `buildTraefikConfig`, when **effective** scoping is true and envKey is dev or tst, prefix the path: e.g. path = `/${envKey}${derivePathFromPattern(frontDoor.pattern)}` so `/api` becomes `/dev/api`.
- **Router name:** Ensure Traefik router/service names stay unique (e.g. use `dev-myapp` when env-prefixed) so multiple envs do not clash.
- **Call sites:** [lib/app/run-helpers.js](lib/app/run-helpers.js) (e.g. `prepareEnvironment` → `generateComposeFile`) and any caller of `generateDockerCompose` must pass app config, **user config gate** (or precomputed effective flag), and current envKey. Compose generator should receive envKey and **effective** scoping and apply the rules above.

### 6. Run flow: pass envKey, app config, and config gate

- **Files:** [lib/app/run.js](lib/app/run.js), [lib/app/run-helpers.js](lib/app/run-helpers.js)
- When loading app config for run, include `environmentScopedResources` from application.yaml and read `useEnvironmentScopedResources` from `config.getConfig()`; compute **effective** boolean for downstream modules.
- **envKey source:** Use the run command's `--env` option when present (per plan 65: `aifabrix run myapp --env dev|tst|pro`); otherwise use `config.getConfig().environment`. Pass this envKey into the compose generator and into secret resolution. If unset, treat as “no prefix” (safe default).

### 7. Database names (builder side)

- **Manifest:** Keep base names in deployment JSON (e.g. `databases: [{ name: "myapp" }]`). Controller/dataplane will use env-prefixed names when deploying to dev/tst and the flag is set.
- **Local:** Connection strings and DB names come from resolved .env (Key Vault keys already env-prefixed in resolution). No separate “create database” step in the builder for app DBs (only miso in [lib/infrastructure/helpers.js](lib/infrastructure/helpers.js)); document that when using env-scoped resources, the actual DB (e.g. `dev_myapp`) must exist or be created by controller/infra/scripts.

### 8. Documentation

#### 8a. Documentation to update (validated checklist)

These files **exist today** and should be updated when implementing; no new doc files are required unless the team prefers a dedicated short page.

| File | Why |
| --- | --- |
| [docs/commands/developer-isolation.md](docs/commands/developer-isolation.md) | Add a full section **`aifabrix dev set-scoped-resources`** (purpose, `true`/`false`, examples, that it sets `useEnvironmentScopedResources` in `config.yaml`, link to **effective** behavior with `application.yaml`). Add **See also** links to `dev show`, [application-yaml.md](../configuration/application-yaml.md), [secrets-and-config.md](../configuration/secrets-and-config.md). Place near other `dev set-*` sections (`set-format`, `set-env-config`) for discoverability. |
| [docs/commands/README.md](docs/commands/README.md) | Table of contents: new bullet under **Developer Isolation Commands** for `dev set-scoped-resources` with anchor link into `developer-isolation.md`. |
| [docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md) | In **config.yaml** / **Key fields**: document **`useEnvironmentScopedResources`** (optional boolean; default passivated when absent); point to **`aifabrix dev set-scoped-resources`** as the supported way to change it. Keep language command-centric per CLI user-docs rules (no HTTP/API detail). |
| [docs/configuration/application-yaml.md](docs/configuration/application-yaml.md) | Document per-app **`environmentScopedResources`** (e.g. dataplane): declares app support; **effective** only when user gate is on; cross-link to `dev set-scoped-resources` and secrets-and-config. |
| [docs/configuration/README.md](docs/configuration/README.md) | Optional one-line mention in **Remote development** or **Quick links** only if `environmentScopedResources` becomes a first-class row in the index table; otherwise secrets-and-config + application-yaml are enough. |

**Not required unless content overlaps:** [docs/configuration/env-config.md](docs/configuration/env-config.md) (unless env-scoped resolution is described there later); [docs/commands/permissions.md](docs/commands/permissions.md) (local config only, no new Controller permission). **JSDoc** on the new handler: `@requiresPermission` only if a network call is added (it should not be for this command).

#### 8b. Doc content reminders

- **Secrets:** [docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md) – when **effective** scoping is on, resolve can add env-prefixed keys with the same values as base keys; Azure flow unchanged.
- **Deployment/running:** Shared Postgres/Docker across dev/tst/pro requires **app opt-in** (`application.yaml`) **and** **user gate** (`dev set-scoped-resources true` or equivalent in `config.yaml`).

### 9. Tests

- **Schema:** Add test that deployment manifest and validation accept `environmentScopedResources` and that it is optional (default false).
- **Variable transformer / split:** Test that the application flag is passed through from application config to deployment manifest.
- **Config gate:** Test matrix: `useEnvironmentScopedResources` false + app true → no prefix in secrets/compose; `useEnvironmentScopedResources` true + app false → no prefix; both true + dev/tst → prefix; both true + pro/miso → no prefix (per env rules).
- **Secrets:** Test that when **effective** scoping is true and envKey is dev (or tst), kv resolution uses env-prefixed keys and adds prefixed keys with same values when missing; when envKey is pro/miso or unset, or gate is off, no prefix.
- **Redis:** Test that when **effective** scoping is true and env is dev/tst, resolved output has correct Redis DB index.
- **Compose:** Test that with **effective** scoping and envKey dev, container name and Traefik path are prefixed; with envKey pro, app flag false, or user gate false, no prefix.
- **CLI:** Tests for `dev set-scoped-resources` and, if applicable, **`dev show`** output including `useEnvironmentScopedResources` (§2b).

## Flow summary

```mermaid
flowchart LR
  subgraph appConfig
    A[application.yaml environmentScopedResources]
  end
  subgraph userConfig
    B[config.yaml useEnvironmentScopedResources]
    B2[dev set-scoped-resources true|false]
    C[config.yaml environment / run --env]
  end
  subgraph builder
    X[effective = B and A and dev/tst rules]
    D[Deploy JSON app flag]
    E[resolveKvReferences]
    F[Compose generator]
  end
  B2 --> B
  A --> X
  B --> X
  A --> D
  C --> E
  C --> F
  X --> E
  X --> F
  E -->|"effective + dev/tst"| G["Prefixed kv keys"]
  F -->|"effective + dev/tst"| H["Prefixed container + path"]
```



## Rules and Standards

This plan must comply with the following from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** – Schema in `lib/schema/`, JSON Schema format; validate before deployment; developer-friendly error messages.
- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** – Module structure (CommonJS, lib/ layout); schema under `lib/schema/`; generated output in builder/ from generators.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – Files ≤500 lines, functions ≤50 lines; JSDoc for all public functions; single responsibility.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Build/lint/test pass; coverage ≥80% for new code; no hardcoded secrets; documentation updated.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Tests in `tests/` mirroring `lib/`; Jest; mock external deps; success and error paths; 80%+ coverage.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – kv:// and secret resolution in `lib/secrets.js`; never log secrets; no hardcoded secrets; input validation.
- **[Docker & Infrastructure](.cursor/rules/project-rules.mdc#docker--infrastructure)** – Compose generation; env vars for config; validate compose output.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – Structured errors with context; never expose secrets in messages; chalk for CLI output.

**Key requirements:** JSDoc for new/changed functions; try-catch for async; validate app name, envKey, and `set-scoped-resources` arguments; path.join() for paths; tests for schema, variable flow, secrets resolution, Redis index, compose behavior, and **dev set-scoped-resources** / **dev show**.

## Before Development

- Read Validation Patterns and Schema Validation from project-rules.mdc (application-schema.json changes).
- Read Secret Management and Data Protection from Security & Compliance (secrets.js resolution, add prefixed keys).
- Review existing compose-generator and buildNetworkAndContainerNames / buildTraefikConfig for run-time env usage.
- Confirm envKey source (config.getConfig().environment) and valid values (miso, dev, tst, pro) in deployment-validation.
- Review an existing **`dev set-*`** command and **`dev show`** output shape before implementing `dev set-scoped-resources`.

## Definition of Done

Before marking this plan complete:

1. **Build:** Run `npm run build` FIRST (must succeed; runs lint + test:ci).
2. **Lint:** Run `npm run lint` (must pass with zero errors and zero warnings).
3. **Test:** Run `npm test` or `npm run test:ci` AFTER lint (all tests pass; ≥80% coverage for new code).
4. **Validation order:** BUILD → LINT → TEST (mandatory sequence; do not skip steps).
5. **File size:** Files ≤500 lines, functions ≤50 lines.
6. **JSDoc:** All new or modified public functions have JSDoc (params, returns, throws).
7. **Code quality:** All rule requirements met; no hardcoded secrets; ISO 27001 considerations for secret handling.
8. **Tasks:** Schema updated; **config.yaml** loads `useEnvironmentScopedResources` (default passivated); **`aifabrix dev set-scoped-resources true|false`** implemented and **`dev show`** reflects the value; variable flow and deploy JSON include application flag; **effective** flag wired through secrets resolution (kv prefix + add keys with same values); Redis DB index on resolve; compose container name and Traefik path prefix; run flow passes envKey, app config, and user gate; **documentation checklist §8a** completed; tests passing (config gate matrix + CLI).
9. **All plan tasks completed:** All implementation tasks (sections 1–9, including §2b) completed and verified.

## Out of scope (for this plan)

- Controller/Dataplane logic to apply env prefix when deploying to Azure (align contract and docs only).
- Automatic creation of env-prefixed databases in local Postgres (document expectation instead).
- Remote Docker, TLS onboarding, and Mutagen sync (see [65-remote-docker-validated.plan.md](65-remote-docker-validated.plan.md); implement that plan first).

---

## Plan Validation Report

**Date:** 2025-02-13  
**Plan:** .cursor/plans/64-environment-scoped_resources_schema.plan.md  
**Status:** VALIDATED

### Plan Purpose

Add an optional application-level boolean `environmentScopedResources` so that for **dev** and **tst** only, resource names (Key Vault keys, database names, Docker container name, Traefik path) are prefixed with the environment key, and Redis uses the correct DB index. Enables dev/tst/pro to share the same Postgres and Docker host. env.template stays unchanged; resolution and generation apply the flag. One boolean; resolve adds prefixed secret keys with same values when missing. Plan type: Development (schema, config flow, secrets, compose, run) + Documentation.

### Applicable Rules

- [Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns) – Schema and validation changes.
- [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns) – Module and schema layout.
- [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) – File size, JSDoc.
- [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) – Build, lint, test, coverage, security.
- [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) – Jest, structure, coverage.
- [Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) – Secret management, kv resolution.
- [Docker & Infrastructure](.cursor/rules/project-rules.mdc#docker--infrastructure) – Compose generation.
- [Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging) – Errors and logging.

### Rule Compliance

- DoD requirements: Documented (build first, lint, test, order, coverage, file size, JSDoc, security).
- Rules and Standards: Added with links to project-rules.mdc.
- Before Development: Checklist added.
- Definition of Done: Expanded with full BUILD → LINT → TEST and task checklist.

### Plan Updates Made

- Added **Rules and Standards** section with applicable rule sections and key requirements.
- Added **Before Development** checklist (schema, secrets, compose, envKey).
- Expanded **Definition of Done** with mandatory build/lint/test order, file size, JSDoc, and task completion items.
- Appended this **Plan Validation Report**.

### Recommendations

- When implementing, ensure `generateEnvFile` / `resolveKvReferences` receive **effective** scoping (config gate ∧ app flag) and envKey so resolution can prefix and add keys without changing env.template.
- Add `useEnvironmentScopedResources` to the same config load/merge path as other `~/.aifabrix/config.yaml` keys; keep defaults backward compatible (passivated).
- Define Redis DB index mapping (e.g. dev → 0, tst → 1) in one place (constant or config) and use it during resolution.
- Add validator test that application.yaml with `environmentScopedResources: true` validates and that the flag is optional.

---

## Plan Validation Report (Re-validation)

**Date:** 2025-02-20  
**Plan:** .cursor/plans/64-environment-scoped_resources_schema.plan.md  
**Status:** ✅ VALIDATED

### Plan Purpose

Add an optional application-level boolean `environmentScopedResources` so that for **dev** and **tst** only, resource names (Key Vault keys, database names, Docker container name, Traefik path) are prefixed with the environment key, and Redis uses the correct DB index. Enables dev/tst/pro to share the same Postgres and Docker host. env.template stays unchanged; resolution and generation apply the flag. **Affected areas:** schema (`lib/schema/`), config/variable flow (`lib/utils/variable-transformer.js`, `lib/generator/`), secrets (`lib/core/secrets.js`), Docker Compose (`lib/utils/compose-generator.js`), run flow (`lib/app/run.js`, run-helpers), documentation. **Plan type:** Development (schema, config, secrets, compose, run) + Documentation.

### Applicable Rules

- ✅ [Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns) – Schema in lib/schema/, JSON Schema, validate before deployment.
- ✅ [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns) – Module structure, lib/ layout, schema under lib/schema/.
- ✅ [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) – Files ≤500 lines, functions ≤50 lines, JSDoc.
- ✅ [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) – Build/lint/test, coverage ≥80%, no hardcoded secrets.
- ✅ [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) – Jest, tests in tests/, success and error paths.
- ✅ [Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) – kv:// resolution, never log secrets.
- ✅ [Docker & Infrastructure](.cursor/rules/project-rules.mdc#docker--infrastructure) – Compose generation, env vars, validate compose.
- ✅ [Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging) – Structured errors, no secrets in messages.

### Rule Compliance

- ✅ DoD Requirements: Build (first), Lint, Test, order BUILD → LINT → TEST, file size, JSDoc, security, all tasks completed.
- ✅ Rules and Standards: Present with rule links and key requirements.
- ✅ Before Development: Checklist present (schema, secrets, compose, envKey).
- ✅ Definition of Done: Includes explicit “All plan tasks completed” item.

### Plan Updates Made (This Re-validation)

- ✅ DoD: Added item 9 “All plan tasks completed” for explicit task-completion requirement.
- ✅ Appended this re-validation report.

### Recommendations

- Implement after [65-remote-docker-validated.plan.md](65-remote-docker-validated.plan.md) as stated in Prerequisite.
- Centralize Redis DB index mapping (e.g. dev → 0, tst → 1) and use it in resolution.
- Ensure `resolveKvReferences` (or equivalent in lib/core/secrets.js) receives **effective** scoping and envKey for prefixing and adding prefixed keys with same values when missing.

---

## Plan update (2026-04-03)

- **Clarified model:** `environmentScopedResources` remains **per application** in `application.yaml` (concrete example: **dataplane**).
- **Added user gate:** `~/.aifabrix/config.yaml` gains **`useEnvironmentScopedResources`** to **activate** or **passivate** whether the Builder honors application-level flags for local resolution and compose. **Effective** scoping = user gate ∧ app flag ∧ dev/tst rules.
- **Renumbered** implementation sections (user config §2; former §3–8 shifted); tests and DoD updated for the config gate matrix.

## Plan update (2026-04-04)

- **CLI:** Added **`aifabrix dev set-scoped-resources true|false`** (§2b) as the supported way to set **`useEnvironmentScopedResources`**; **`dev show`** should display the current gate.
- **Documentation:** Added **§8a validated checklist** listing concrete files under `docs/commands/` and `docs/configuration/` to update; noted files that do **not** require changes unless overlap appears.

