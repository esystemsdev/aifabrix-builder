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


| Layer                | Where                                                       | Role                                                                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Application**      | `application.yaml` (per app, e.g. dataplane)                | Declares whether *this app* is designed to use env-scoped resources (`environmentScopedResources`: boolean, default `false`).                                                                           |
| **User / workspace** | `~/.aifabrix/config.yaml` (`useEnvironmentScopedResources`) | **Activates** or **passivates** whether the Builder honors application-level `environmentScopedResources` locally. Prefer `aifabrix dev set-scoped-resources` with `true` or `false` over hand-editing. |


**Effective behavior:** Env-scoped naming (kv prefix, Redis DB index, compose container name, Traefik path, and related rules) applies only when:

1. **config.yaml** has the feature **activated** (see naming below), **and**
2. The **current app’s** `application.yaml` has `environmentScopedResources: true`, **and**
3. Current **envKey** is **dev** or **tst** (unchanged from the rest of this plan).

If config.yaml **passivates** the feature, treat **every** app as if `environmentScopedResources` were `false` for local resolution and compose generation, regardless of `application.yaml`. The raw application flag may still be emitted in deploy JSON for controller/dataplane alignment (implementation detail: document whether controller also respects a platform-level switch or only the manifest flag).

**Default recommendation:** **Passivated** in `config.yaml` (`false` or absent) so existing machines keep today’s behavior until the user explicitly opts in. Per-app default in schema remains `false`.

### Prerequisite

Implement this plan **after** the remote Docker spec ([65-remote-docker-validated.plan.md](Archive/65-remote-docker-validated.plan.md) — currently under `.cursor/plans/Archive/`). That plan targets shared infra, remote Docker, and the same `run --env` surface; this plan adds env-prefixed resource names on top so dev/tst/pro can share the same Postgres and Docker host without collisions.

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
- **User (primary):** Runs `aifabrix dev set-scoped-resources true` to **activate** or `aifabrix dev set-scoped-resources false` to **passivate** the user gate. This writes `**useEnvironmentScopedResources`** to `~/.aifabrix/config.yaml` using the same persistence path as other `dev set-`* commands. **Alternative:** edit `config.yaml` by hand (set or remove the key); behavior must match the CLI.
- **Discovery:** Extend `**aifabrix dev show`** (or equivalent config summary) so the current value of `useEnvironmentScopedResources` is visible when set, consistent with how other `config.yaml` fields are shown (e.g. `format`, `developer-id`).
- **No double manual key work:** When effective scoping is on, resolution still adds prefixed kv keys from base keys as already described; `env.template` stays unchanged.
- **env.template stays identical:** We do **not** change env.template content (e.g. `builder/dataplane/env.template`). The file stays the same; when we **resolve** the .env file, we get correct values from the secret file(s) by using prefixed keys (and Redis index) when **effective** scoping is on and env is dev/tst.
- **Secrets when effective scoping is on:** If the user already has base keys in the secret file (e.g. `databases-myapp-0-urlKeyVault`) and effective flag is true, when we **resolve** we add the env-prefixed keys with the **same values** (e.g. `dev-databases-myapp-0-urlKeyVault` = value of base key). Secret files are for development and evaluation; Azure creates correct values and auto-generates them—no change needed there.

## Implementation (Builder-only)

### 1. Application schema

- **File:** [lib/schema/application-schema.json](lib/schema/application-schema.json)
- Add optional top-level property:
  - `environmentScopedResources`: boolean, default `false`
  - Description: When true, this **application** (e.g. dataplane) declares support for env-scoped resource names. The Builder applies prefixing only if `**useEnvironmentScopedResources`** is activated in `~/.aifabrix/config.yaml` and env is **dev** or **tst**; **miso** and **pro** never use the prefix. Used to run dev/tst/pro against the same Postgres and Docker host when the user gate is on.
- Add to schema metadata/changelog (non-breaking).

### 2. User config (`config.yaml`)

- **File:** Extend merged user config in [lib/core/config.js](lib/core/config.js) (`getConfig()`, defaults, persist helpers). [lib/utils/config-paths.js](lib/utils/config-paths.js) is path resolution only—not where config keys are defined.
- Add optional property `**useEnvironmentScopedResources`** (boolean). Default when absent: `**false`** (passivated).
- Document in user-facing config docs (see §8): how to activate/passivate; interaction with per-app `environmentScopedResources`.
- Any command that resolves secrets, generates compose, or applies env-scoped naming must compute `**effectiveEnvironmentScopedResources = Boolean(config.useEnvironmentScopedResources) && Boolean(app.environmentScopedResources)`** (and still require dev/tst for actual prefixing per the rest of this plan).

### 2b. CLI: `aifabrix dev set-scoped-resources`

- **Command:** `aifabrix dev set-scoped-resources <true|false>` (positional boolean; reject invalid values with a clear message—mirror patterns from `dev set-format` / `dev set-id`).
- **Files (typical):** Commander registration next to other `dev` subcommands: [lib/cli/setup-dev.js](lib/cli/setup-dev.js) (e.g. `set-id`) and/or [lib/cli/setup-dev-path-commands.js](lib/cli/setup-dev-path-commands.js) (e.g. `set-format`, `set-env-config`). **Do not** use [lib/commands/dev-cli-handlers.js](lib/commands/dev-cli-handlers.js) — that module is for remote Builder Server user APIs (`dev list` / `dev add`, etc.), not local `config.yaml` mutations.
- **Behavior:** Read merged config, set `**useEnvironmentScopedResources`** to the parsed boolean, write `config.yaml` with existing permissions rules (`600` / directory `700`). Print a short confirmation (chalk, consistent with sibling commands). Optionally print the **effective** reminder: app-level `environmentScopedResources` must still be true for any app to actually scope resources.
- `**dev show`:** Include `**useEnvironmentScopedResources`** in the displayed config when the key is present (and show effective default when absent: e.g. “passivated (default)” if product wants explicit UX).
- **Tests:** Follow the pattern in [tests/lib/cli.test.js](tests/lib/cli.test.js) for `dev set-id` / `dev set-format` (command action registration + mocked config write). Optionally add focused tests beside those describes; `dev-cli-handlers.test.js` covers remote dev API handlers, not local `dev set-`* config writers.

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
- **Current environment:** Pass **envKey** into the resolve flow. For paths tied to `aifabrix run`, the codebase only accepts **dev | tst | pro** today (`prepareAppRun`); use that value for prefix decisions (**dev** and **tst** only). For other flows (e.g. deploy, wizard) define a single resolver contract so `miso`-style semantics do not accidentally trigger kv prefixing—**prefix only when the effective env is dev or tst** per this plan.

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
- **envKey source:** `aifabrix run` already exposes `-e, --env` (default `dev`) and validates **dev | tst | pro** ([lib/cli/setup-app.js](lib/cli/setup-app.js), [lib/app/run.js](lib/app/run.js)). The CLI currently always supplies `options.env`, so `config.environment` is not used as a run fallback—either wire `getCurrentEnvironment()` into run when product wants that, or keep CLI-default behavior and document it. Pass the chosen envKey into compose generation and secret resolution; **pro** and any non-(dev/tst) key: no prefix.

### 7. Database names (builder side)

- **Manifest:** Keep base names in deployment JSON (e.g. `databases: [{ name: "myapp" }]`). Controller/dataplane will use env-prefixed names when deploying to dev/tst and the flag is set.
- **Local:** Connection strings and DB names come from resolved .env (Key Vault keys already env-prefixed in resolution). No separate “create database” step in the builder for app DBs (only miso in [lib/infrastructure/helpers.js](lib/infrastructure/helpers.js)); document that when using env-scoped resources, the actual DB (e.g. `dev_myapp`) must exist or be created by controller/infra/scripts.

### 8. Documentation

#### 8a. Documentation to update (validated checklist)

These files **exist today** and should be updated when implementing; no new doc files are required unless the team prefers a dedicated short page.


| File                                                                                 | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/commands/developer-isolation.md](docs/commands/developer-isolation.md)         | Add a full section `**aifabrix dev set-scoped-resources`** (purpose, `true`/`false`, examples, that it sets `useEnvironmentScopedResources` in `config.yaml`, link to **effective** behavior with `application.yaml`). Add **See also** links to `dev show`, [application-yaml.md](../configuration/application-yaml.md), [secrets-and-config.md](../configuration/secrets-and-config.md). Place near other `dev set-`* sections (`set-format`, `set-env-config`) for discoverability. |
| [docs/commands/README.md](docs/commands/README.md)                                   | Table of contents: new bullet under **Developer Isolation Commands** for `dev set-scoped-resources` with anchor link into `developer-isolation.md`.                                                                                                                                                                                                                                                                                                                                    |
| [docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md) | In **config.yaml** / **Key fields**: document `**useEnvironmentScopedResources`** (optional boolean; default passivated when absent); point to `**aifabrix dev set-scoped-resources`** as the supported way to change it. Keep language command-centric per CLI user-docs rules (no HTTP/API detail).                                                                                                                                                                                  |
| [docs/configuration/application-yaml.md](docs/configuration/application-yaml.md)     | Document per-app `**environmentScopedResources`** (e.g. dataplane): declares app support; **effective** only when user gate is on; cross-link to `dev set-scoped-resources` and secrets-and-config.                                                                                                                                                                                                                                                                                    |
| [docs/configuration/README.md](docs/configuration/README.md)                         | Optional one-line mention in **Remote development** or **Quick links** only if `environmentScopedResources` becomes a first-class row in the index table; otherwise secrets-and-config + application-yaml are enough.                                                                                                                                                                                                                                                                  |


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
- **CLI:** Tests for `dev set-scoped-resources` and, if applicable, `**dev show`** output including `useEnvironmentScopedResources` (§2b).

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
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – kv:// and secret resolution in [lib/core/secrets.js](lib/core/secrets.js); never log secrets; no hardcoded secrets; input validation.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – `dev set-scoped-resources`: Commander.js, chalk, validate `true`/`false`, try/catch; mirror `dev set-id` / `dev set-format` patterns in [lib/cli/setup-dev.js](lib/cli/setup-dev.js) / [lib/cli/setup-dev-path-commands.js](lib/cli/setup-dev-path-commands.js).
- **[Docker & Infrastructure](.cursor/rules/project-rules.mdc#docker--infrastructure)** – Compose generation; env vars for config; validate compose output.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – Structured errors with context; never expose secrets in messages; chalk for CLI output.
- **User docs:** [.cursor/rules/docs-rules.mdc](.cursor/rules/docs-rules.mdc) — command-centric `docs/` updates for §8a (no REST/API detail).

**Key requirements:** JSDoc for new/changed functions; try-catch for async; validate app name, envKey, and `set-scoped-resources` arguments; path.join() for paths; tests for schema, variable flow, secrets resolution, Redis index, compose behavior, and **dev set-scoped-resources** / **dev show**.

## Before Development

- Read [Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns) in `project-rules.mdc` (application-schema.json changes).
- Read [Security & Compliance](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) for secret handling; trace [lib/core/secrets.js](lib/core/secrets.js) and prefixed-key behavior.
- Review [lib/utils/compose-generator.js](lib/utils/compose-generator.js) (`buildNetworkAndContainerNames`, `buildTraefikConfig`) and call sites in [lib/app/run-helpers.js](lib/app/run-helpers.js).
- **envKey for run:** [lib/app/run.js](lib/app/run.js) `prepareAppRun` accepts **dev | tst | pro** via CLI `-e, --env` ([lib/cli/setup-app.js](lib/cli/setup-app.js)); `config.environment` in [lib/core/config.js](lib/core/config.js) is a separate knob—see §6 before wiring fallbacks. Prefix **kv://** / compose only for **dev** and **tst** per this plan.
- Review `dev set-id` / `dev set-format` and `dev show` in [tests/lib/cli.test.js](tests/lib/cli.test.js) before adding `dev set-scoped-resources`.
- Confirm prerequisite: [65-remote-docker-validated.plan.md](Archive/65-remote-docker-validated.plan.md) in `.cursor/plans/Archive/`.

## Definition of Done

Before marking this plan complete:

1. **Build:** Run `npm run build` FIRST (must succeed; runs lint + test:ci).
2. **Lint:** Run `npm run lint` (must pass with zero errors and zero warnings).
3. **Test:** Run `npm test` or `npm run test:ci` AFTER lint (all tests pass; ≥80% coverage for new code).
4. **Validation order:** BUILD → LINT → TEST (mandatory sequence; do not skip steps).
5. **File size:** Files ≤500 lines, functions ≤50 lines.
6. **JSDoc:** All new or modified public functions have JSDoc (params, returns, throws).
7. **Code quality:** All rule requirements met; no hardcoded secrets; ISO 27001 considerations for secret handling.
8. **Tasks:** Schema updated; **config.yaml** loads `useEnvironmentScopedResources` (default passivated); `**aifabrix dev set-scoped-resources true|false`** implemented and `**dev show`** reflects the value; variable flow and deploy JSON include application flag; **effective** flag wired through secrets resolution (kv prefix + add keys with same values); Redis DB index on resolve; compose container name and Traefik path prefix; run flow passes envKey, app config, and user gate; **documentation checklist §8a** completed; tests passing (config gate matrix + CLI).
9. **All plan tasks completed:** All implementation tasks (sections 1–9, including §2b) completed and verified.
10. **Rule compliance:** All items in **Rules and standards** and **Before development** addressed; no new `lib/api` calls without `@requiresPermission` per [docs/commands/permissions.md](docs/commands/permissions.md) if applicable.

## Out of scope (for this plan)

- Controller/Dataplane logic to apply env prefix when deploying to Azure (align contract and docs only).
- Automatic creation of env-prefixed databases in local Postgres (document expectation instead).
- Remote Docker, TLS onboarding, and Mutagen sync (see [65-remote-docker-validated.plan.md](Archive/65-remote-docker-validated.plan.md); implement that plan first).

## Plan update (2026-04-03)

- **Clarified model:** `environmentScopedResources` remains **per application** in `application.yaml` (concrete example: **dataplane**).
- **Added user gate:** `~/.aifabrix/config.yaml` gains `**useEnvironmentScopedResources`** to **activate** or **passivate** whether the Builder honors application-level flags for local resolution and compose. **Effective** scoping = user gate ∧ app flag ∧ dev/tst rules.
- **Renumbered** implementation sections (user config §2; former §3–8 shifted); tests and DoD updated for the config gate matrix.

## Plan update (2026-04-04)

- **CLI:** Added `**aifabrix dev set-scoped-resources true|false`** (§2b) as the supported way to set `**useEnvironmentScopedResources`**; `**dev show`** should display the current gate.
- **Documentation:** Added **§8a validated checklist** listing concrete files under `docs/commands/` and `docs/configuration/` to update; noted files that do **not** require changes unless overlap appears.

## Codebase validation (2026-04-05)

**Verdict:** The plan is **implementable** and aligns with the current Builder layout. **Canonical filename:** `.cursor/plans/117-environment-scoped_resources_schema.plan.md`.


| Check                                                | Result                                                                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/schema/application-schema.json`                 | Exists; `environmentScopedResources` not yet present (expected).                                                                             |
| `lib/core/config.js`                                 | Exists; `environment` default `dev`; right place to add `useEnvironmentScopedResources`.                                                     |
| `lib/core/secrets.js`                                | Exists at this path (not `lib/secrets.js`).                                                                                                  |
| `lib/utils/compose-generator.js`                     | `buildTraefikConfig`, `buildNetworkAndContainerNames` exist as named in §5.                                                                  |
| `lib/app/run.js`, `run-helpers.js`                   | Exist; `prepareAppRun` uses `options.env` ∈ {dev,tst,pro}.                                                                                   |
| `lib/cli/setup-dev.js`, `setup-dev-path-commands.js` | Correct targets for new `dev set-scoped-resources`.                                                                                          |
| `lib/commands/dev-cli-handlers.js`                   | **Wrong** target for this feature (remote dev user APIs only); §2b updated.                                                                  |
| `aifabrix run --env`                                 | Implemented in `setup-app.js` with default `dev`.                                                                                            |
| Prerequisite plan 65                                 | Present as `.cursor/plans/Archive/65-remote-docker-validated.plan.md`; prerequisite link updated.                                            |
| Docs §8a                                             | All listed paths exist under `docs/commands/` and `docs/configuration/`.                                                                     |
| Downstream                                           | [118-declarative_url_resolution.plan.md](118-declarative_url_resolution.plan.md) already depends on this plan’s flags—keep formulas in sync. |


**Residual risks for implementers:** (1) Define one authoritative **Redis DB index** map and reuse everywhere. (2) Any command that resolves secrets outside `run` must receive the same **effective** boolean + env key as compose. (3) Traefik example in Purpose uses `/dev/api`; §5 shows `/${envKey}${pattern}`—confirm double-slash rules with `frontDoor.pattern` in code.

## Plan validation report (`/validate-plan`)

**Date:** 2026-04-05  
**Plan:** `.cursor/plans/117-environment-scoped_resources_schema.plan.md`  
**Status:** ✅ VALIDATED

### Plan purpose

Per-app `**environmentScopedResources`** plus user gate `**useEnvironmentScopedResources`** in `~/.aifabrix/config.yaml`; CLI `**aifabrix dev set-scoped-resources`**. When **effective** and env is **dev/tst**, prefix kv keys, Redis DB index, compose container/Traefik path; **pro** (and miso-style URL semantics) do not get path/kv prefix per plan. **Type:** Development (schema, `lib/core/config.js`, `lib/core/secrets.js`, compose, run) + Documentation + Testing.

### Applicable rules

- ✅ [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) — DoD §1–4: BUILD → LINT → TEST.
- ✅ [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) — DoD §5–6; Rules section.
- ✅ [Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns) — §1 application-schema.
- ✅ [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns) — lib layout, schema path.
- ✅ [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development) — §2b; **Rules** updated with explicit CLI + docs-rules.
- ✅ [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) — §9, `cli.test.js` pattern.
- ✅ [Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) — §4 secrets; path **lib/core/secrets.js** in Rules.
- ✅ [Docker & Infrastructure](.cursor/rules/project-rules.mdc#docker--infrastructure) — §5 compose.
- ✅ [Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging) — CLI and resolution errors.

### Rule compliance

- ✅ DoD: Build first, lint (zero warnings), test/coverage, file size, JSDoc, security, docs §8a, tasks 1–10.
- ✅ Rules and standards: Linked to `project-rules.mdc`, `docs-rules.mdc`, `lib/core/secrets.js`.
- ✅ Before development: Checklist with accurate **run envKey** (dev/tst/pro) vs prefix rules (dev/tst only).

### Plan updates made (this `/validate-plan` run)

- Expanded **Rules and standards** (CLI Command Development, **lib/core/secrets.js**, docs-rules).
- Reworked **Before development** (checkboxes, correct files, no misleading “miso” as `run --env`).
- Added DoD **§10** (rule compliance / permissions).
- Removed obsolete **2025 / plan 64** duplicate validation blocks; retained **Codebase validation (2026-04-05)** + this report.

### Recommendations

- Implement after prerequisite plan **65** (Archive).
- Centralize Redis index mapping; wire **effective** + **envKey** through every resolve path that touches kv or compose.
- Keep **118** `url://` prefix math aligned with `**baseEffective`** here.

