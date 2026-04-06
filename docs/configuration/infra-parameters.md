# Infra parameter catalog (`infra.parameter.yaml`)

← [Documentation index](../README.md) · [Configuration](README.md)

The Builder maintains a **shipped catalog** of infrastructure-related `kv://` secret keys: how values are generated, when they are auto-created (`up-infra`, app resolve, and related flows), and optional **Azure Key Vault naming hints**. This keeps local `env.template` references, secret generation, and Azure naming aligned without scattering magic key lists in code.

## Where the catalog lives (repository)

- **Data:** `lib/schema/infra.parameter.yaml` (default catalog the CLI loads).
- **Schema:** `lib/schema/infra-parameter.schema.json` (AJV validation when the catalog is loaded).

Contributors who add or rename `kv://` keys in app `env.template` files should update the catalog and run **`aifabrix parameters validate`** (see [Validation commands: parameters validate](../commands/validation.md#aifabrix-parameters-validate)).

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

The **human-readable matrix** for Azure-side names remains [.cursor/plans/keyvault.md](../../.cursor/plans/keyvault.md) (contributor reference). The **Builder catalog** records explicit `azure.vaultSecretName` or notes per entry where that helps.

## Audit: Miso install Bicep vs local keys

This section records a **point-in-time cross-check** between:

- **Local** `kv://` / `secrets.local.yaml` keys (Builder templates and `infra.parameter.yaml`), and  
- **`@Microsoft.KeyVault(...;SecretName=...)`** references in **aifabrix-miso** `infrastructure/bicep/modules/05_miso-webapp.bicep` and `07_keycloak-webapp.bicep` (`prefix` = app install key, e.g. `miso-controller`).

Miso **application** manifest schema (`docs/schemas/application.md`) still describes configuration entries as `databases[i].urlKeyVault` / `passwordKeyVault`, which map to **`{app-key}-databases-{index}-urlKeyVault`** style names in Azure — aligned with the catalog `vaultSecretNamePattern` rows for database secrets.

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

When you change Bicep `SecretName` values or Builder `kv://` keys, update **`lib/schema/infra.parameter.yaml`**, this table, and [.cursor/plans/keyvault.md](../../.cursor/plans/keyvault.md) if the user-facing matrix changes.

## What uses the catalog

- **`aifabrix up-infra`** — Ensures infra-related keys (catalog `ensureOn` / `standardUpInfraEnsureKeys`, plus keys discovered from workspace `env.template` and `application.yaml` database lists).
- **`aifabrix resolve <app> --force`** (and other flows that generate missing secrets) — Uses catalog-driven generators where defined (e.g. index-aware database URL/password for multi-DB apps).
- **`aifabrix parameters validate`** — Loads the catalog, checks internal generator rules, then checks that `kv://` keys referenced under discovered app directories are covered by the catalog (exact or pattern).

## Workspace discovery limits

Discovery scans app directories under the configured Builder workspace (for example the directory implied by **`AIFABRIX_BUILDER_DIR`** or your current monorepo layout). Apps outside that tree are not scanned for `env.template` usage. If you rely on validation or auto-ensure for a repo layout the CLI does not see, run **`parameters validate`** from a workspace root that contains those `builder/<appKey>/` folders or adjust your Builder directory configuration.

## Related commands and docs

- [aifabrix parameters validate](../commands/validation.md#aifabrix-parameters-validate)
- [Secrets and config](secrets-and-config.md)
- [env.template](env-template.md)
- [Commands: Infrastructure](../commands/infrastructure.md) (`up-infra`)
- [Commands: Utilities](../commands/utilities.md) (`resolve`, `secret validate`)
