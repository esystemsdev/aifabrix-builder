**Builder catalog (local development):** The AI Fabrix Builder ships [`lib/schema/infra.parameter.yaml`](../../lib/schema/infra.parameter.yaml) (JSON Schema: [`infra-parameter.schema.json`](../../lib/schema/infra-parameter.schema.json)) as the **source of truth** for which `kv://` keys the CLI knows about, how values are generated, and optional Azure naming hints. **Local** secret keys in `env.template` / `secrets.local.yaml` often use suffixes like `databases-{appKey}-{index}-urlKeyVault` / `passwordKeyVault`. **Azure** Key Vault secret names for the same logical secret usually use the **`{app-key}-` prefix** on those suffixes (see the database rows below). The two forms are not interchangeable. To verify workspace templates against the catalog, run **`aifabrix parameters validate`**. User-facing overview: [Infra parameters (configuration)](../../docs/configuration/infra-parameters.md).

**Deploy JSON vs local `.env` (plan 122):** In `env.template`, **`url://…`** placeholders are resolved to real URLs when generating **`.env`** for Docker/local (after `kv://`). When generating **`*-deploy.json`** for Miso Controller / Azure, the same lines must **not** stay as `url://…` (App Settings and ARM reject them). The generator maps them to **Key Vault secret names** (`location: keyvault`, `value` = bare secret name). Logic: [`lib/generator/deploy-manifest-azure-kv.js`](../../lib/generator/deploy-manifest-azure-kv.js), wired from [`lib/generator/helpers.js`](../../lib/generator/helpers.js) (`parseEnvironmentVariables`). **`frontDoorRouting.host`** values that use **`${DEV_USERNAME}`** or **`${REMOTE_HOST}`** are rewritten to **`{app-key}-frontdoor-routing-host`** in the manifest before unresolved-placeholder validation ([`lib/generator/index.js`](../../lib/generator/index.js)). Declarative URL behavior for local runs: [Declarative URLs](../../docs/configuration/declarative-urls.md), plan [122-declarative_url_resolution.plan.md](122-declarative_url_resolution.plan.md).

### `url://` token → Key Vault secret name (deploy manifest)

Rules use **`app.key`** from `application.yaml` as *owner app* (`{app-key}` below). Token grammar matches [`lib/utils/url-declarative-resolve-build.js`](../../lib/utils/url-declarative-resolve-build.js) (`parseUrlToken`).

| `url://` token (examples) | Vault secret name (manifest `value`) | Notes |
| ------------------------- | ------------------------------------ | ----- |
| `public` | `{app-key}-web-server-url` | Self app public URL |
| `internal` | `{app-key}-internal-server-url` | Self app internal URL |
| `public` / `internal` when `{app-key}` is **`keycloak`** | `keycloak-web-server-url` / `keycloak-internal-server-url` | Same unprefixed names as Miso Bicep (`05_miso-webapp.bicep`) |
| `keycloak-public`, `keycloak-internal` | `keycloak-web-server-url`, `keycloak-internal-server-url` | Cross-app from another manifest (e.g. miso-controller) |
| `{other-app}-public`, `{other-app}-internal` | `{other-app}-web-server-url`, `{other-app}-internal-server-url` | e.g. `dataplane-public` → `dataplane-web-server-url` |
| `vdir-public`, `vdir-internal` | `{app-key}-vdir-public`, `{app-key}-vdir-internal` | Path segment; populated like other URL secrets at deploy |
| `{target}-vdir-public` (suffix form) | `{target}-vdir-public` | e.g. self already `keycloak` → `keycloak-vdir-public` |
| `host-public`, `host-internal` | `{app-key}-host-public`, `{app-key}-host-internal` | Origin-only surface |

**Requirements:** `app.key` must be set when any line uses `url://`; otherwise `aifabrix json` fails with an explicit error. **`aifabrix parameters validate`** / catalog should include any new secret names you rely on (see infra.parameter.yaml patterns below).

### `frontDoorRouting.host` → Key Vault secret name (deploy manifest)

| `application.yaml` host value | Manifest `frontDoorRouting.host` after `aifabrix json` |
| ----------------------------- | ------------------------------------------------------ |
| Contains `${DEV_USERNAME}` and/or `${REMOTE_HOST}` | `{app-key}-frontdoor-routing-host` |
| Literal hostname (no those placeholders) | Unchanged |

Provisioning must store the **resolved hostname string** (e.g. Traefik/custom domain) in that vault secret so Azure / Front Door can consume it.

### Catalog entries (infra.parameter.yaml)

Additional **`keyPattern`** rows document emptyString-style URL/host helpers used for Azure parity: `{app-key}-frontdoor-routing-host`, `{app-key}-vdir-public`, `{app-key}-vdir-internal`, `{app-key}-host-public`, `{app-key}-host-internal`. See [`lib/schema/infra.parameter.yaml`](../../lib/schema/infra.parameter.yaml).

---

**Key Vault Architecture:**

- **Shared Key Vault**: One Key Vault supports multiple applications
- **Infrastructure Level Parameters**: Shared across all apps (e.g., `smtp.host` → `smtp-host`, `redis.urlKeyVault` → `redis-urlKeyVault`)
- **Application Level Parameters**: App-specific parameters (e.g., `secrets.sessionKeyVault` → `{app-key}-secrets-sessionKeyVault`)
- **Automatic Prefixing**: The `{app-key}` prefix is added automatically by the system during installation

| Parameter Type                 | Field Name                             | Location/Value | Description                    | Key Vault Name                                 |
| ------------------------------ | -------------------------------------- | -------------- | ------------------------------ | ---------------------------------------------- |
| **Database Configuration**     |                                        |                |                                |                                                |
| Database URL                   | `databases[i].urlKeyVault`             | `keyvault`     | Connection string secret name  | `{app-key}-databases-{index}-urlKeyVault`      |
| Database Username              | `databases[i].username`                | `variable`     | Database user account          | `none`                                         |
| Database name                  | `databases[i].name`                    | `variable`     | Database name                  | `none`                                         |
| Database Password              | `databases[i].passwordKeyVault`        | `keyvault`     | Password secret (auto16)       | `{app-key}-databases-{index}-passwordKeyVault` |
| **Redis Configuration**        |                                        |                |                                |                                                |
| Redis URL                      | `redis.urlKeyVault`                    | `keyvault`     | Redis connection string        | `redis-urlKeyVault`                            |
| Redis Username                 | `redis.username`                       | `variable`     | Redis user account             | `none`                                         |
| Redis Password                 | `redis.passwordKeyVault`               | `keyvault`     | Redis password (auto16)        | `redis-passwordKeyVault`                       |
| **Storage Configuration**      |                                        |                |                                |                                                |
| Storage Account Key            | `storage.keyKeyVault`                  | `keyvault`     | Storage account key            | `storage-keyKeyVault`                          |
| Storage Account Name           | `storage.name`                         | `variable`     | Storage account name           | `none`                                         |
| Storage Account URL            | `storage.url`                          | `variable`     | Storage account URL            | `none`                                         |
| **SMTP Configuration**         |                                        |                |                                |                                                |
| SMTP Host                      | `smtp.host`                            | `keyvault`     | SMTP server hostname           | `smtp-host`                                    |
| SMTP Port                      | `smtp.port`                            | `keyvault`     | SMTP server port               | `smtp-port`                                    |
| SMTP User                      | `smtp.user`                            | `keyvault`     | SMTP username                  | `smtp-user`                                    |
| SMTP Password                  | `smtp.passwordKeyVault`                | `keyvault`     | SMTP password (auto16)         | `smtp-passwordKeyVault`                        |
| SMTP Sender Email              | `smtp.senderEmail`                     | `keyvault`     | Default sender email           | `smtp-senderEmail`                             |
| **Front Door Configuration**   |                                        |                |                                |                                                |
| Front Door URL                 | `frontdoor.url`                        | `keyvault`     | Front Door endpoint URL        | `frontdoor-url`                                |
| Front Door Host                | `frontdoor.host`                       | `keyvault`     | Front Door hostname            | `frontdoor-host`                               |
| Traefik host template (YAML)   | `frontDoorRouting.host` with `${DEV_USERNAME}` / `${REMOTE_HOST}` | `keyvault` (via manifest) | Hostname string for routing | **`{app-key}-frontdoor-routing-host`** in `*-deploy.json`; see section above |
| **App Insights Configuration** |                                        |                |                                |                                                |
| App Insights Key               | `appinsights.keyKeyVault`              | `keyvault`     | Application Insights key       | `appinsights-keyKeyVault`                      |
| App Insights Connection String | `appinsights.connectionStringKeyVault` | `keyvault`     | App Insights connection string | `appinsights-connectionStringKeyVault`         |
| **ACR Configuration**          |                                        |                |                                |                                                |
| ACR Username                   | `acr.username`                         | `keyvault`     | Container registry username    | `acr-username`                                 |
| ACR Password                   | `acr.passwordKeyVault`                 | `keyvault`     | Container registry password    | `acr-passwordKeyVault`                         |
| ACR Server                     | `acr.server`                           | `keyvault`     | Container registry server      | `acr-server`                                   |
| **Application Secrets**        |                                        |                |                                |                                                |
| API Keys                       | `secrets.apiKeyVault`                  | `keyvault`     | 32-character random string     | `{app-key}-secrets-apiKeyVault`                |
| Session Secrets                | `secrets.sessionKeyVault`              | `keyvault`     | 32-character random string     | `{app-key}-secrets-sessionKeyVault`            |
| JWT Secrets                    | `secrets.jwtKeyVault`                  | `keyvault`     | 64-character random string     | `{app-key}-secrets-jwtKeyVault`                |
| Unique Tokens                  | `secrets.tokenKeyVault`                | `keyvault`     | UUID v4 identifier             | `{app-key}-secrets-tokenKeyVault`              |

### Miso install Bicep vs local `KeyVault` suffix

Some Azure deploy templates use a **different secret name shape** than local `kv://` keys for the same logical value:

| Local / `secrets.local.yaml` (Builder) | Azure Key Vault secret name (Miso Bicep) | Source |
| --------------------------------------- | ------------------------------------------ | ------ |
| `keycloak-admin-passwordKeyVault` | `{app-key}-keycloak-admin-password` | `05_miso-webapp.bicep`, `07_keycloak-webapp.bicep` |
| `postgres-passwordKeyVault` (Docker infra admin) | `{app-key}-postgres-admin-password` | `07_keycloak-webapp.bicep` only — **not** the same role as shared `postgres-passwordKeyVault` in local infra |

Unprefixed names that **match** between Bicep and local env include `keycloak-web-server-url`, `keycloak-internal-server-url`, `miso-controller-web-server-url`, `miso-controller-internal-server-url`, and `miso-controller-client-secretKeyVault`. A full line-by-line list is maintained in [Infra parameters — Bicep audit](../../docs/configuration/infra-parameters.md#audit-miso-install-bicep-vs-local-keys).

**Deploy-manifest-only names** (appear in `*-deploy.json` as keyvault `value`; pipeline / install must create the secret if not already present): `{app-key}-frontdoor-routing-host`, `{app-key}-vdir-public`, `{app-key}-vdir-internal`, `{app-key}-host-public`, `{app-key}-host-internal`. Bicep may still hard-code some app settings (e.g. Keycloak `KC_HTTP_RELATIVE_PATH` in `07_keycloak-webapp.bicep`); align vault secrets and ARM templates when switching those apps to manifest-driven Key Vault references.