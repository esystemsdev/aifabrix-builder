# Infra parameter catalog (`infra.parameter.yaml`)

← [Documentation index](../README.md) · [Configuration](README.md)

The Builder maintains a **shipped catalog** of infrastructure-related `kv://` secret keys: how values are generated, when they are auto-created (`up-infra`, app resolve, and related flows), and optional **Azure Key Vault naming hints**. This keeps local `env.template` references, secret generation, and Azure naming aligned without scattering magic key lists in code.

## Where the catalog lives

The infra parameter catalog ships **with the Builder CLI** as `infra.parameter.yaml`, together with a JSON schema used when the catalog is loaded. You do not need to edit these files for normal use.

If you maintain app `env.template` files and add or rename `kv://` keys, keep them aligned with the shipped catalog and run **`aifabrix parameters validate`** (see [Validation commands: parameters validate](../commands/validation.md#aifabrix-parameters-validate)).

## How local `.env` values are resolved

`env.template` mixes two kinds of placeholders:

### `${VAR}` (not secrets)

Examples: `KEYCLOAK_PUBLIC_PORT`, `REDIS_HOST`, `DB_HOST`, `KEYCLOAK_HOST`, `MISO_HOST`.

- Defaults come from the Builder’s built-in **docker** vs **local** host/port map, merged with your **`developer-id`** from `~/.aifabrix/config.yaml` for published/local host ports.
- The Builder interpolates these **before** it substitutes `kv://` values when generating `.env` files.

### `kv://secret-key` (secrets store)

Examples: `API_KEY=kv://miso-controller-api-key-secretKeyVault`, `ENCRYPTION_KEY=kv://secrets-encryptionKeyVault`, database URLs.

- Values live in your secrets file (often **`~/.aifabrix/secrets.local.yaml`**, or the path set by **`aifabrix-secrets`** in config).
- **`aifabrix up-infra`** ensures infra-related keys (catalog `ensureOn: upInfra`, **`standardUpInfraEnsureKeys`**, and keys discovered from workspace `env.template` / `requires.databases`).
- **`aifabrix resolve <app> --force`** (and some run paths) create any **missing** keys using **`infra.parameter.yaml`** generators (`randomBytes32`, `databaseUrl`, `literal`, `emptyString`, `emptyAllowed`, etc.).
- **Shared keys:** the same secret name can appear in more than one app template (for example **`miso-controller-api-key-secretKeyVault`** in both miso-controller and dataplane). One entry in the secrets file applies everywhere.

### Local database passwords (dev)

For `databases-<appKey>-<index>-passwordKeyVault`, local defaults use the same rule as Docker infra init: PostgreSQL role **`<db_name>_user`** with password **`<db_name_without_user_suffix>_pass123`**, where `<db_name>` comes from **`requires.databases`** in **`application.yaml`**. If **`builder/<appKey>/`** does not exist yet, the Builder falls back to the shipped template under **`templates/applications/<appKey>/application.yaml`**.

### Gaps to know (zero-touch install)

- **Service public/internal URLs** in shipped **miso-controller** and **dataplane** `env.template` files use **`url://…`** (resolved after `kv://`) so local `.env` gets computed URLs from the registry — see [Declarative `url://` placeholders](declarative-urls.md). Catalog rows such as **`keycloak-server-url`** / **`miso-controller-web-server-url`** remain for **Azure/Bicep** and any legacy secrets file; they are not required in templates that already use `url://`.
- **Azure-related `kv://` lines** may hold generated placeholders locally when you use **`DEPLOYMENT=database`**; deployed Azure environments use Key Vault secret names that often differ from local `kv://` key names. The catalog’s Azure-related entries describe naming where that matters.

### Suggested platform sequence

For Keycloak + Miso Controller + Dataplane on one machine: **`aifabrix up-infra`** → **`aifabrix up-miso`** → **`aifabrix up-dataplane`** (requires login for the last step). Ensure missing secrets with **`aifabrix resolve <app> --force`** if a command reports missing `kv://` keys.

## Onboarding: file structure (secrets-related)

Typical global and app layout relevant to `kv://` and infra secrets:

| Location | Role |
| -------- | ---- |
| `~/.aifabrix/config.yaml` | Developer id, secrets file path (`aifabrix-secrets`), controller, environment, optional remote Docker settings. |
| `~/.aifabrix/secrets.local.yaml` (or path from `aifabrix-secrets`) | Resolved secret values for `kv://` references; flat keys ending in `KeyVault` and similar. |
| `~/.aifabrix/admin-secrets.env` | Infra admin credentials for Postgres / tooling (written when you run `up-infra`). |
| `builder/<appKey>/env.template` | Placeholders and `kv://` references; `aifabrix resolve` materializes `.env`. |
| `builder/<appKey>/application.yaml` | App metadata and `requires.databases` (used with the catalog to infer database-related secret keys). |

See [Secrets and config](secrets-and-config.md) for encryption, remote vs local stores, and when the CLI creates missing keys.

## Variables, keys, and naming (local vs Azure)

- **Local `kv://` and `secrets.local.yaml` keys** follow the suffixes used in Builder templates, e.g. `databases-<appKey>-<index>-urlKeyVault` and `databases-<appKey>-<index>-passwordKeyVault`, plus shared infra keys such as `postgres-passwordKeyVault`, `redis-passwordKeyVault`, etc.
- **Azure Key Vault secret names** for the same logical values are often **prefixed with the application key**, e.g. `{app-key}-databases-{index}-urlKeyVault`. The two strings are **not** always identical; do not assume one name works in both places.

For Azure deployments, prefer the **`azure`** section on each catalog entry (`vaultSecretName`, `vaultSecretNamePattern`, and notes). Local `kv://` keys and Azure secret names are related but not always identical.

## Audit: Miso install Bicep vs local keys

This section records a **point-in-time cross-check** between:

- **Local** `kv://` / `secrets.local.yaml` keys (Builder templates and `infra.parameter.yaml`), and  
- **`@Microsoft.KeyVault(...;SecretName=...)`** references in the **Miso Controller** Azure install (Bicep; install prefix is the app key, e.g. `miso-controller`).

The Miso application manifest still describes configuration entries as `databases[i].urlKeyVault` / `passwordKeyVault`, which map to **`{app-key}-databases-{index}-urlKeyVault`** style names in Azure — aligned with the catalog `vaultSecretNamePattern` rows for database secrets.

| Azure `SecretName` (Bicep) | Local / Builder secret key (typical) | Notes |
| -------------------------- | ------------------------------------ | ----- |
| `${prefix}-databases-0-urlKeyVault` | `databases-<appKey>-0-urlKeyVault` | Same `KeyVault` suffix both sides; Azure adds `prefix-`. |
| `${prefix}-databases-1-urlKeyVault` | `databases-<appKey>-1-urlKeyVault` | Same pattern for secondary DB (e.g. miso-logs). |
| `${prefix}-secrets-jwtKeyVault` | `<appKey>-secrets-jwtKeyVault` or schema-driven `secrets.jwtKeyVault` | App-scoped JWT; Bicep uses install prefix. |
| `${prefix}-encryption-keyKeyVault` | `encryption-keyKeyVault` (when present in templates) | Check app manifest / env.template for exact local key. |
| `${prefix}-keycloak-admin-password` | `keycloak-admin-passwordKeyVault` | **Different shape:** Azure drops the `KeyVault` suffix; local keeps it. Catalog `azure.vaultSecretNamePattern` documents this. |
| `${prefix}-postgres-admin-password` | (not the same as `postgres-passwordKeyVault`) | **Different secret:** Keycloak stack Postgres admin on Azure vs shared Docker `postgres-passwordKeyVault` for local infra. |
| `keycloak-server-url` | `keycloak-server-url` | Unprefixed; matches local key name (non–Key Vault convention). |
| `keycloak-internal-server-url` | `keycloak-internal-server-url` | Unprefixed. |
| `miso-controller-web-server-url` | `miso-controller-web-server-url` | Unprefixed; matches local env key. |
| `miso-controller-internal-server-url` | `miso-controller-internal-server-url` | Unprefixed. |
| `${prefix}-miso-clientIdKeyVault` | Pattern `*KeyVault` / app manifest | Client ID secret for controller install. |
| `miso-controller-client-secretKeyVault` | `miso-controller-client-secretKeyVault` | Unprefixed secret name in Bicep for this reference. |

When Bicep `SecretName` values or Builder `kv://` keys change, the shipped infra parameter catalog and this table should be updated together so local and Azure naming stay documented in one place.

## CLI flags and existing `kv://` values

`ensure` only **creates** missing or empty keys. When you pass **`--adminPassword`**, **`--userPassword`**, or **`--adminEmail`** on **`aifabrix up-infra`**, the CLI also **overwrites** every secrets-store key whose catalog row is a **`literal`** generator containing the matching placeholder (`{{adminPassword}}`, `{{userPassword}}`, or `{{adminEmail}}`). Those keys are discovered from **`infra.parameter.yaml`**—not hardcoded in the ensure module—so new literals stay in sync automatically.

Shared scalar defaults for those placeholders live under the catalog root **`defaults:`** (shipped values for local dev). **`admin-secrets.env`** (Postgres / pgAdmin / Redis Commander) uses the same defaults when fields are empty, via a relaxed read of the catalog file so behavior stays aligned even if full schema validation were to fail.

## What uses the catalog

- **`aifabrix up-infra`** — Ensures infra-related keys (catalog `ensureOn` / `standardUpInfraEnsureKeys`, plus keys discovered from workspace `env.template` and `application.yaml` database lists). Applies the CLI placeholder overwrite behavior above when flags are set.
- **`aifabrix resolve <app> --force`** (and other flows that generate missing secrets) — Uses catalog-driven generators where defined (e.g. index-aware database URL/password for multi-DB apps).
- **`aifabrix parameters validate`** — Loads the catalog, checks internal generator rules, then checks that `kv://` keys referenced under discovered app directories are covered by the catalog (exact or pattern).

## Workspace discovery limits

Discovery scans app directories under the configured Builder workspace (for example the directory implied by **`AIFABRIX_BUILDER_DIR`** or your current monorepo layout). Apps outside that tree are not scanned for `env.template` usage. If you rely on validation or auto-ensure for a repo layout the CLI does not see, run **`parameters validate`** from a workspace root that contains those `builder/<appKey>/` folders or adjust your Builder directory configuration.

## Related commands and docs

- Plan: [123 — up-miso / up-dataplane and parameter consolidation](../../.cursor/plans/123-up-miso-dataplane-and-parameter-consolidation.plan.md) (tracking doc for local resolve order, gaps, and alignment with the parameter catalog)
- [aifabrix parameters validate](../commands/validation.md#aifabrix-parameters-validate)
- [Declarative `url://` placeholders](declarative-urls.md)
- [Secrets and config](secrets-and-config.md)
- [env.template](env-template.md)
- [Commands: Infrastructure](../commands/infrastructure.md) (`up-infra`, `up-miso`, `up-dataplane`)
- [Commands: Utilities](../commands/utilities.md) (`resolve`, `secret validate`)
