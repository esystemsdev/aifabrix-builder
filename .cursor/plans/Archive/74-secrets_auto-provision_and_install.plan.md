---
name: Secrets auto-provision and install
overview: "Automate secret creation and storage so the system can be installed and run without manual configuration: ensure secrets are created in the correct store (file path, remote API, or local fallback), optionally encrypted when secrets-encryption is set; read secrets from secret files or remote API when creating resources (e.g. database users); add up-infra --adminPwd plus validation and documentation for secrets.local.yaml."
todos: []
isProject: false
---

# Secrets auto-provision and zero-touch install

## Current state

- **Secrets source**: `[lib/core/secrets.js](lib/core/secrets.js)` loads secrets via cascade (user `~/.aifabrix/secrets.local.yaml` + config `aifabrix-secrets` path, or remote API when `aifabrix-secrets` is `http(s)://`).
- **Config**: `[lib/core/config.js](lib/core/config.js)` reads `~/.aifabrix/config.yaml`; `getSecretsPath()` returns `aifabrix-secrets` or `secrets-path`; `getSecretsEncryptionKey()` returns `secrets-encryption`.
- **Generation**: `[lib/utils/secrets-generator.js](lib/utils/secrets-generator.js)` has `createDefaultSecrets(secretsPath)` and `generateMissingSecrets(envTemplate, secretsPath)`; both write only to a **file path** (no remote, no encryption of new values).
- **Admin secrets**: `[lib/infrastructure/helpers.js](lib/infrastructure/helpers.js)` `ensureAdminSecrets()` creates `~/.aifabrix/admin-secrets.env` via `secrets.generateAdminSecretsEnv()`; backfills empty fields with `admin123`. Admin file is plaintext.
- **up-infra**: `[lib/cli/setup-infra.js](lib/cli/setup-infra.js)` calls `config.ensureSecretsEncryptionKey()` then `infra.startInfra()`; no `--adminPwd` and no prior “ensure infra secrets in store”.
- **Naming**: `[.cursor/plans/keyvault.md](.cursor/plans/keyvault.md)` documents Key Vault–style names (e.g. `postgres-passwordKeyVault`, `redis-urlKeyVault`, `{app-key}-databases-{index}-passwordKeyVault`).

## Goals

1. **No manual secret setup**: Automatically create missing secret values when installing infra, apps, or integrations.
2. **Read secrets when provisioning**: When creating resources that require secrets (e.g. database users, Redis users, service accounts), **read** the secret value from the configured store (secret file or remote API) and use it for the create/provision operation—do not generate or hardcode at creation time. Read path follows the same cascade as today: file path → read from file; `http(s)://` → read from remote API; no config → read from user secrets file.
3. **Storage order**:
4. **Storage order**:
  - If `aifabrix-secrets` is a **file path** → create/write missing values in that file (create file if missing).  
  - If `aifabrix-secrets` is **http(s) URL** → try adding to builder server (plain text); on failure, add to user’s local secrets file and **warn**.  
  - If **no** `aifabrix-secrets` → add to local file (`~/.aifabrix/secrets.local.yaml` or `aifabrix-home`).
5. **Encryption**: If `secrets-encryption` is set in config, **encrypt only newly created values** when writing to a file.
6. **admin-secrets.env**: Support encrypting or generating from main secrets; add `aifabrix up-infra --adminPwd` to override default `admin123`.
7. **Validation and docs**: Validate `secrets.local.yaml` (structure + naming); document naming convention and which docs to update.

---

## Rules and Standards

This plan must comply with the following from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** (mandatory) – Build must run first and succeed; lint and test with zero errors; file size limits; no hardcoded secrets.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** (mandatory) – Files ≤500 lines, functions ≤50 lines; JSDoc for all public functions.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – Secret management (kv://, no exposure in logs/errors), data protection, input validation; never log secrets or tokens.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – New option `up-infra --adminPwd`; optional `secrets validate`; input validation, chalk output, try-catch in actions.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – Meaningful errors with context; never expose secrets in messages; chalk for CLI.
- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** – YAML validation for secrets file; validate before read/write where appropriate.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Tests in `tests/` mirroring `lib/`; mock fs, config, API; 80%+ coverage for new code.
- **[Docker & Infrastructure](.cursor/rules/project-rules.mdc#docker--infrastructure)** – Infra helpers and admin-secrets.env usage; secure config and env handling.
- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** – CommonJS, `lib/core` and `lib/utils` layout; use existing `lib/api/dev.api.js` for remote secrets.

**Key requirements**

- Run `npm run build` first (lint + test:ci); then `npm run lint` and `npm test` as per Quality Gates.
- All new public functions must have JSDoc with `@param`, `@returns`, `@throws` where applicable.
- No hardcoded secrets; use config and existing secrets modules; never log secret values.
- Validate file paths and config values; use `path.join()` for paths.
- New modules (e.g. `secrets-ensure.js`) and CLI changes must have corresponding tests.

---

## Before Development

- Read Security & Compliance and Secret Management in project-rules.mdc.
- Read CLI Command Development for `up-infra` option and optional `secrets validate`.
- Review existing `lib/core/secrets.js`, `lib/utils/secrets-generator.js`, and `lib/utils/local-secrets.js` for integration points.
- Review `lib/api/dev.api.js` `addSecret` and `lib/commands/secrets-set.js` for remote vs file behavior.
- Confirm validation order BUILD → LINT → TEST before marking work complete.

---

## Definition of Done

Before marking this plan complete, ensure:

1. **Build**: Run `npm run build` FIRST (must complete successfully – runs lint + test:ci).
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings).
3. **Test**: Run `npm test` or `npm run test:ci` AFTER lint (all tests must pass; ≥80% coverage for new code).
4. **Validation order**: BUILD → LINT → TEST (mandatory sequence; do not skip steps).
5. **File size**: All new/edited files ≤500 lines; functions ≤50 lines.
6. **JSDoc**: All new public functions have JSDoc (parameters, returns, throws, and `@fileoverview` where appropriate).
7. **Code quality**: All requirements from project-rules.mdc met (error handling, input validation, path.join, no secrets in logs).
8. **Security**: No hardcoded secrets; ISO 27001–aligned secret handling; admin-secrets.env and secrets file behavior documented.
9. **Rule references**: Implementation follows the Rules and Standards sections above.
10. **Tasks**: All implementation steps (secrets-ensure module, read-from-store when provisioning, up-infra wiring, app/integration ensure, validation, docs) completed.

---

## 1. Central “ensure secrets” service

**Location**: New module e.g. `lib/core/secrets-ensure.js` (or under `lib/utils/`).

**Responsibilities**:

- **Input**: List of secret keys (and optional suggested values), or derive keys from an `env.template` string (reuse `findMissingSecretKeys` from `[lib/utils/secrets-generator.js](lib/utils/secrets-generator.js)`).
- **Resolve write target** from config:
  - Read `aifabrix-secrets` and `secrets-encryption` via existing config helpers.
  - If `aifabrix-secrets` is a **file path** (not `http(s)://`): target = that path (expand `~`); create parent dir and file if missing.
  - If `aifabrix-secrets` is **http(s) URL**: for each key, try remote `addSecret` (reuse `[lib/api/dev.api.js](lib/api/dev.api.js)` `addSecret`); on failure (e.g. 403, 404, network), write to **user secrets file** and log a **warning**.
  - If no `aifabrix-secrets`: target = user secrets file.
- **Only add missing keys**: Load existing secrets from file (or from remote when URL) and skip keys that already have a value.
- **Values**: Use existing `[generateSecretValue](lib/utils/secrets-generator.js)` for infra/app keys; empty string for integration “credentials only” placeholders when requested.
- **Encryption**: When writing to a **file** and `secrets-encryption` is set, encrypt the **new** value (e.g. `secure://...`) using existing `[lib/utils/secrets-encryption.js](lib/utils/secrets-encryption.js)` before writing. Do not encrypt values sent to remote API (API receives plaintext as today).
- **API**: Expose e.g. `ensureSecretsForKeys(keys[], options?)` and `ensureSecretsFromEnvTemplate(envTemplatePathOrContent, options?)`; options may include `emptyValuesForCredentials: true` for integrations.

**Integration points**:

- **File writes**: Reuse and extend `[lib/utils/local-secrets.js](lib/utils/local-secrets.js)` `saveSecret` for arbitrary path; or use `[lib/utils/secrets-generator.js](lib/utils/secrets-generator.js)` `loadExistingSecrets` / `saveSecretsFile` with encryption step for new keys.
- **Remote**: Reuse `devApi.addSecret`; handle “key already exists” if API returns that (treat as success); on any failure, fallback to user file + warning.
- **Encryption**: When saving to file, for each new key run value through `encryptSecret` if `config.getSecretsEncryptionKey()` is set, then write `secure://...` into the file.

---

## 1b. Read secrets from store when provisioning resources

When creating resources that require a secret (e.g. database user, Redis user, service account), the implementation must **read** the secret value from the configured store and use it for the create/provision call—not generate a new value or use a hardcoded default at creation time.

**Read path (same cascade as `loadSecrets`)**:

- If `aifabrix-secrets` is a **file path** → read from that file (existing `lib/core/secrets.js` load from path).
- If `aifabrix-secrets` is **http(s) URL** → read from remote API (builder server); use existing dev API or secrets client that fetches by key.
- If **no** `aifabrix-secrets` → read from user secrets file (`~/.aifabrix/secrets.local.yaml` or `aifabrix-home`).

**Requirements**:

- Use the resolved value only in memory for the create/provision operation; never log it or write it elsewhere.
- If the key is missing or read fails, fail the operation with a clear message (e.g. “Secret X not found; run ensure-secrets or add it to your secrets file”), rather than falling back to a default password for the resource.
- Applies to: infra startup that creates DB/Redis users, app install/setup that creates database users or binds credentials, and any other provisioning step that needs a password or token from the store.

**Integration**:

- Reuse `lib/core/secrets.js` `loadSecrets(secretsPath)` (or equivalent) so the same cascade is used for both “ensure missing keys” and “read value for provisioning.”
- Document in secrets-and-config that provisioning reads from the same store (file or online) as the rest of the system.

---

## 2. Use “ensure secrets” when starting infra

**In** `[lib/infrastructure/helpers.js](lib/infrastructure/helpers.js)` **or** `[lib/infrastructure/index.js](lib/infrastructure/index.js)`:

- Before (or inside) `ensureAdminSecrets()`:
  - Call the new ensure service with the **infra secret keys** (e.g. `postgres-passwordKeyVault`, `redis-passwordKeyVault`, `redis-urlKeyVault`, `keycloak-admin-passwordKeyVault`, `keycloak-auth-server-urlKeyVault` — align with `[createDefaultSecrets](lib/utils/secrets-generator.js)` and keyvault.md).
  - This creates the secrets in the correct store (file path, remote, or local) and encrypts new values if `secrets-encryption` is set.
- When creating or configuring infra resources that need a password (e.g. database user creation, init scripts): **read** the secret from the store using the same cascade as `loadSecrets` (file or remote), then use that value for the create operation; do not generate or assume a default at creation time (see section 1b).

**In** `[lib/core/secrets.js](lib/core/secrets.js)` `**generateAdminSecretsEnv`**:

- Keep using `loadSecrets(secretsPath)` so it reads from the same cascade (including remote). If infra secrets were just ensured, they will be available.
- When generating `admin-secrets.env`, if `secrets-encryption` is set, either:
  - **Option A**: Keep writing **plaintext** to `admin-secrets.env` (current behavior) so Docker Compose can read it; encryption only in `secrets.local.yaml`.  
  - **Option B**: Store infra passwords only in the main secrets file and generate `admin-secrets.env` from decrypted values at runtime (no change to Compose; decryption when writing the file).
- Recommend **Option A** for minimal change; document that `admin-secrets.env` remains plaintext and should have restricted permissions (600).

**New option** `aifabrix up-infra --adminPwd <password>`:

- In `[lib/cli/setup-infra.js](lib/cli/setup-infra.js)`, add `.option('--adminPwd <password>', 'Override default admin password for new install (Postgres, pgAdmin, Redis Commander)')`.
- Pass this into infra start (e.g. options.adminPwd). In `ensureAdminSecrets()` / `generateAdminSecretsEnv()`:
  - If `adminPwd` is provided and we are creating or backfilling admin secrets, use it instead of `admin123` for `POSTGRES_PASSWORD`, `PGADMIN_DEFAULT_PASSWORD`, `REDIS_COMMANDER_PASSWORD`, and ensure the same value is set for `postgres-passwordKeyVault` in the main secrets store when creating defaults.

---

## 3. Ensure secrets when creating or running an application

- **App create**: After generating files (e.g. in `[lib/app/index.js](lib/app/index.js)` `generateApplicationFiles` or in the create flow after `generateConfigFiles`), load the app’s `env.template`, call the new ensure service with keys derived from that template so app-specific secrets (e.g. `databases-<app>-0-passwordKeyVault`, `redis-`*, etc.) exist.
- **App install / create database user (or similar)**: When the app install or setup flow creates a database user or any resource that requires a secret, **read** the secret from the configured store (file or remote) using the same read path as in section 1b, and use that value for the create operation—do not generate or hardcode at creation time.
- **App run / generateEnvFile**: Today `[generateEnvFile](lib/core/secrets.js)` with `force: true` calls `generateMissingSecrets(template, secretsFileForGeneration)` which only writes to a file. Replace or wrap this with the new ensure service so that:
  - Missing keys are ensured in the correct store (file path, remote with fallback, or local).
  - New values are encrypted when writing to file and `secrets-encryption` is set.
- **Places that call generateEnvFile with force**: `[lib/app/run-helpers.js](lib/app/run-helpers.js)` (indirect), `[lib/commands/up-miso.js](lib/commands/up-miso.js)`, `[lib/build/index.js](lib/build/index.js)`, `[lib/cli/setup-utility.js](lib/cli/setup-utility.js)`, `[lib/app/register.js](lib/app/register.js)`, `[lib/app/rotate-secret.js](lib/app/rotate-secret.js)`. Prefer a single path: e.g. `generateEnvFile` (or a shared “prepare env” helper) calls the ensure service when it needs to create missing secrets, instead of calling `generateMissingSecrets` with a file path only.

---

## 4. Ensure secrets for integrations (credentials placeholders)

- When creating or onboarding an **integration** (e.g. wizard or download that creates `integration/<name>/` with `env.template` or credential config):
  - Call the ensure service with the credential keys inferred from the integration (e.g. from env.template or a small schema), with option **emptyValuesForCredentials: true** so placeholders are created with empty string.
  - This avoids “missing secret” errors while still requiring the user to fill real credentials later.

---

## 5. Validation of secrets.local.yaml and naming convention

- **Validation**:
  - Add a small validator (e.g. in `lib/utils/secrets-helpers.js` or a dedicated module) that:
    - Reads the file at a given path (or the resolved “write target” path when it’s a file).
    - Checks it’s valid YAML and a flat key-value object (no nested objects for secret values).
    - Optionally checks key names against the allowed naming convention (e.g. `*KeyVault` suffix, patterns from keyvault.md).
  - Expose via CLI e.g. `aifabrix secrets validate [path]` (optional) and/or run when reading/writing in the ensure service (e.g. after writing, re-read and validate).
- **Naming convention** (document in repo):
  - Add a section to `[docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md)` (or a new `docs/configuration/secrets-naming.md`) that documents the convention: table from `[.cursor/plans/keyvault.md](.cursor/plans/keyvault.md)` (parameter type, field name, key in secrets file, description). State that `secrets.local.yaml` uses the same keys as Key Vault secret names for consistency with production.

---

## 6. Documentation to update

- `**[docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md)`**  
  - Describe automatic creation of missing secrets (on up-infra, app create/run, integration create).  
  - Document that when **creating resources** (e.g. database users), the system **reads** the secret from the configured store (secret file or remote API) and uses that value—no generation or default at creation time.  
  - Document storage order: file path → write there; http(s) URL → try remote, then local + warning; no config → local.  
  - Document that when `secrets-encryption` is set, **newly created** values in file-based stores are encrypted.  
  - Add (or link to) naming convention and validation.
- `**[docs/commands/infrastructure.md](docs/commands/infrastructure.md)`**  
  - Document `aifabrix up-infra --adminPwd <password>` for overriding default admin password on new install.
- `**[docs/configuration/README.md](docs/configuration/README.md)`**  
  - Short note that secrets can be auto-created and where to find the full behavior (secrets-and-config.md).
- **Optional new doc** `docs/configuration/secrets-naming.md`: Full table of secret keys (from keyvault.md), validation rules, and that `secrets.local.yaml` should follow this convention.
- **Quick start / README** (e.g. `[docs/README.md](docs/README.md)` or main `[README.md](README.md)`): Mention that first-time `aifabrix up-infra` (and optionally `--adminPwd`) creates required secrets automatically.
- `**admin-secrets.env`**: In secrets-and-config or infrastructure docs, state that `~/.aifabrix/admin-secrets.env` is generated from the main secrets store and is plaintext; restrict permissions (600); when using `aifabrix secure`, only `secrets.local.yaml` (or the configured file) holds encrypted values.

---

## 7. Implementation order (suggested)

1. Add **secrets-ensure** module with storage-order logic, encryption of new file values, and remote try-then-fallback.
2. Ensure **provisioning paths read from store**: Any code that creates a database user, Redis user, or similar resource must read the secret from the store (file or remote) via the same cascade as `loadSecrets`; fail clearly if the secret is missing (see section 1b).
3. Wire **up-infra**: ensure infra secrets before `ensureAdminSecrets`; add `--adminPwd` and use it when creating/backfilling admin and `postgres-passwordKeyVault`.
4. Replace/wrap **generateMissingSecrets** usage with the ensure service so app run/create and build flows create secrets in the right place with optional encryption.
5. Add **integration** placeholder secrets (empty values) in the integration create/wizard path.
6. Add **validation** (structure + naming) and **docs** (secrets-and-config, infrastructure, naming, README).

---

## Diagram (high level)

```mermaid
flowchart LR
  subgraph config[config.yaml]
    A[aifabrix-secrets]
    B[secrets-encryption]
  end
  subgraph ensure[Ensure secrets service]
    C[Resolve target]
    D[Add missing keys]
    E[Encrypt if set]
  end
  subgraph targets[Write targets]
    F[File path]
    G[Remote API]
    H[User file fallback]
  end
  config --> ensure
  ensure --> F
  ensure --> G
  G -->|on failure| H
  ensure --> E
  E --> F
```



---

## Out of scope (for later)

- Changing how the **remote** API stores secrets (e.g. server-side encryption).
- Migrating existing unencrypted file values to encrypted (only new values encrypted as per goal).
- Backup/restore of secrets (already documented as not supported).

## Plan Validation Report

**Date**: 2025-02-23  
**Plan**: .cursor/plans/74-secrets_auto-provision_and_install.plan.md  
**Status**: VALIDATED

### Plan Purpose

- **Title**: Secrets auto-provision and zero-touch install.  
- **Summary**: Automate secret creation and storage so the system can be installed and run without manual configuration: ensure secrets are created in the correct store (file path, remote API, or local fallback), optionally encrypted when `secrets-encryption` is set, add `up-infra --adminPwd`, and add validation and documentation for `secrets.local.yaml`.  
- **Scope**: Core secrets module, infrastructure (up-infra, admin-secrets.env), app create/run and integration flows, CLI options, validation (YAML/structure/naming), documentation.  
- **Type**: Security (secret management, ISO 27001–aligned) + Development (CLI commands, new modules, infra wiring).

### Applicable Rules

- Quality Gates – mandatory build/lint/test order and file size; no hardcoded secrets.  
- Code Quality Standards – file/function size limits; JSDoc for public functions.  
- Security & Compliance (ISO 27001) – secret management, no logging of secrets, data protection.  
- CLI Command Development – new `up-infra --adminPwd`; optional `secrets validate`; validation and chalk.  
- Error Handling & Logging – meaningful errors; no secrets in messages.  
- Validation Patterns – YAML and structure validation for secrets file.  
- Testing Conventions – Jest, mocks, 80%+ coverage for new code.  
- Docker & Infrastructure – infra helpers and admin-secrets.env.  
- Architecture Patterns – CommonJS, lib/core and lib/utils; use `lib/api/dev.api.js`.

### Rule Compliance

- DoD requirements: Documented (build first, lint, test, validation order, file size, JSDoc, security, tasks).  
- Quality Gates: Referenced; BUILD → LINT → TEST and coverage called out.  
- Security: Plan aligns with Secret Management and Data Protection (no hardcoded secrets, encrypt new values when configured).  
- CLI/Testing/Validation/Infra/Architecture: Addressed in plan and in Rules and Standards.

### Plan Updates Made

- Added **Rules and Standards** section with links to project-rules.mdc and key requirements.  
- Added **Before Development** checklist (read rules, review existing modules, confirm validation order).  
- Added **Definition of Done** with 10 items (build, lint, test, order, file size, JSDoc, code quality, security, rule references, all tasks).  
- Appended this **Plan Validation Report**.

### Recommendations

- When implementing the ensure service, add unit tests for: file-path target, remote-URL-with-fallback, and encryption-of-new-values.  
- For `secrets validate`, add a test that validates a valid YAML file and one that rejects invalid structure.  
- Run `npm run build` after each major step (secrets-ensure module, up-infra wiring, app/integration ensure) to catch regressions early.

