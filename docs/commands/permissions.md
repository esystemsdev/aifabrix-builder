# Online Commands and Permissions

← [Documentation index](../README.md) · [Commands index](README.md)

Reference for CLI commands that call **online** APIs (Miso Controller or Dataplane). Each command requires login and the listed permission(s) on the target service. Permissions are enforced by the Controller or Dataplane RBAC; assign roles that grant the required scopes.

---

## Services

- **Controller** – Miso Controller (applications, environments, deployments, pipeline validate/deploy, auth).
- **Dataplane** – AI Fabrix Dataplane (external systems, credentials, wizard, pipeline publish/test, datasources).

## Environment-scoped access

Dataplane is **installed per environment** (e.g. dev, tst, pro). You must set permissions for the **target** dataplane and environment you use. Pipeline access and RBAC work the same way: they are **per environment**. Any endpoint that takes an `envKey` (e.g. pipeline validate/deploy, environment applications) is scoped to that environment. Configure the correct roles and permissions for the environment you target (dev, tst, or pro). **All permissions listed below can be set from the Miso Controller web interface** (roles, groups, and scopes per environment).

---

## Command → Service → Permissions

| Command | Service | Required permission(s) | Notes |
| -------- | --------- | ------------------------ | -------- |
| `aifabrix login` | Controller | None (device or client credentials) | Obtains token; subsequent commands use token scopes. |
| `aifabrix logout` | Controller | None | Clears local tokens. |
| `aifabrix show <app> --online` | Controller | `applications:read` or env-scoped app access | Fetches template app and/or environment application. For **external** (dataplane) apps, also calls Dataplane for system details → **Dataplane** `external-system:read` required in that case. |
| `aifabrix app show <app>` | Controller + Dataplane (if external) | Controller: `applications:read` or env-scoped app. If external: **Dataplane** `external-system:read` | Same as `show --online`. For external type, also calls Dataplane for system details (get external system, config, OpenAPI files/endpoints). |
| `aifabrix app register <appKey>` | Controller | `environments-applications:create` | Register app in environment and get client credentials. |
| `aifabrix app list` | Controller | `environments-applications:read` | List applications in the configured environment. |
| `aifabrix app rotate-secret <appKey>` | Controller | `environments-applications:update` | Rotate client secret for the app. |
| `aifabrix env deploy <env>` | Controller | `controller:deploy` | Deploy environment infrastructure. |
| `aifabrix deploy [app]` | Controller | `applications:deploy` | Validate then deploy; uses pipeline validate + deploy. |
| `aifabrix deployments` | Controller | `deployments:read` | List deployments for the environment. |
| `aifabrix credential list` | Dataplane | `credential:read` | Lists credentials on the **Dataplane** for the configured environment. The Controller does not offer this operation; ensure the CLI targets the correct Dataplane base URL. |
| `aifabrix download [systemKey]` | Dataplane | `external-system:read` | Download external system config from Dataplane. |
| `aifabrix upload [system-key]` | Dataplane | `external-system:publish`; **credential:create** (if using automatic push of KV_* from `.env`) | **Pipeline upload** on the Dataplane: draft upload, validation, and publish in one flow. The CLI shows a **Dataplane pipeline warning** before sending configuration. It may push credential material from `integration/<systemKey>/.env` (KV_* variables) and from `kv://` references using the credential APIs — **credential:create** is required for that push. If the push is denied, upload may still proceed without secrets. **Auth:** Bearer/API key from `aifabrix login`, or **x-client-token** (application token from client credentials exchange; same as [deployment](deployment.md)). |
| `aifabrix datasource upload` | Dataplane | `external-system:publish` | **Datasource-scoped publish** on the Dataplane. The CLI displays a **Dataplane pipeline warning** before sending configuration. |
| `aifabrix datasource test` | Dataplane | `external-system:publish` or `external-data-source:read` | Unified validation run (test run type) on the dataplane; same deployment auth as `test-integration`. |
| `aifabrix datasource test-integration` | Dataplane | `external-system:publish` or `external-data-source:read` | Unified validation run (integration) on the dataplane; supports deployment auth including **client credentials** exchanged for an app token (CI/CD). |
| `aifabrix datasource test-e2e` | Dataplane | `external-data-source:read` | Unified validation run (E2E) on the dataplane; uses the **same deployment auth** as `test-integration` (e.g. `aifabrix login` or app credentials). |
| `aifabrix datasource load <datasourceKey>` | Dataplane | `external-data-source:sync` | Bulk record sync (`POST` data-storage records bulk). External integration only. **`--dry-run`** parses locally only (no dataplane write). Deployment auth: Bearer/API key or **x-client-token**. |
| `aifabrix datasource export <datasourceKey>` | Dataplane | `record:search` | Governed records search export (not direct DB). External integration only. Max **10000** rows per run. Same deployment auth as other datasource dataplane commands. |
| `aifabrix datasource log-test` | Local | — | Reads a previously saved JSON log from `integration/<systemKey>/logs/`; **no** Controller or Dataplane request. |
| `aifabrix datasource log-integration` / `log-e2e` | Local | — | Same as `log-test` for `test-integration-*.json` or `test-e2e-*.json`; **no** online API call. |
| `aifabrix datasource log-trust` | Local | — | Reads the latest `test-trust-*.json` from `integration/<systemKey>/logs/` (from `test-trust --debug`); **no** online API call. |
| `aifabrix datasource clean-logs` | Local | — | Deletes matching debug JSON under `integration/<systemKey>/logs/`; **no** online API call. |
| `aifabrix test-integration` | Dataplane | `external-system:publish` or `external-data-source:read` | Calls pipeline test endpoint; supports **client credentials** (CI/CD). |
| `aifabrix validate <app> --cert-sync` | Dataplane | Same scopes as **`validate`** for the target, plus **`external-system:read`** when the CLI fetches the active certificate | Optional post-success step: refreshes **only** the `certification` object in the local `*-system` file. See [Certification and trust (CLI)](certification-and-trust.md). |
| `aifabrix show` / `aifabrix app show` with **`--verify-cert`** | Dataplane | **`external-system:read`** (when verify runs) | Optional certificate verify lines for external apps; does not require publish scope. |
| `aifabrix wizard [systemKey]` | Dataplane | `external-system:create`, `external-system:read`, `credential:read` (for credential step) | Wizard sessions and steps use Dataplane wizard API. |
| `aifabrix integration-client create` | Controller | `integration-client:create` | Create integration client (key, displayName, redirectUris, optional groupNames); receive one-time clientSecret (save at creation time). |
| `aifabrix integration-client list` | Controller | `integration-client:read` | List integration clients with optional pagination and search. |
| `aifabrix integration-client rotate-secret` | Controller | `integration-client:update` | Regenerate client secret for an integration client; new secret shown once only. |
| `aifabrix integration-client delete` | Controller | `integration-client:delete` | Deactivate an integration client. |
| `aifabrix integration-client update-groups` | Controller | `integration-client:update` | Update group assignments for an integration client. |
| `aifabrix integration-client update-redirect-uris` | Controller | `integration-client:update` | Update redirect URIs for an integration client (min 1). |
| `aifabrix dimension create` | Controller | `dimensions:create` (and `dimensions:read` for idempotent behavior) | Creates the dimension if missing; succeeds if it already exists. Supports `--file` and `--value-type` (`static` \| `dynamic` \| `both`) for CI/CD and protection authoring. |
| `aifabrix dimension get` | Controller | `dimensions:read` | Reads one dimension by id or key. |
| `aifabrix dimension list` | Controller | `dimensions:read` | Lists dimensions with optional paging/search. |
| `aifabrix dimension-value create` | Controller | `dimensions:create` | Creates a value for a dimension (static dimension). Value must be unique within the dimension. |
| `aifabrix dimension-value list` | Controller | `dimensions:read` | Lists values for a dimension. |
| `aifabrix dimension-value delete` | Controller | `dimensions:delete` | Deletes a dimension value by id. |
| `aifabrix protection validate <datasourceKey>` | Dataplane | `external-system:read` | Local schema check (offline), then dataplane validate; `--simulate` uses the same read scope. **Auth:** Bearer/API key or **x-client-token** (same as pipeline upload). |
| `aifabrix protection create <datasourceKey>` | Dataplane + Controller | **Dataplane** `external-system:read` (datasource GET); **Controller** `dimensions:read` (dimension GET); then **local** file write only | Probes online context, applies `--type` preset or explicit overrides, then writes `integration/.protection/<datasourceKey>.{yaml\|json}` (format from CLI config). No dataplane upload until `protection upload`. |
| `aifabrix protection upload <datasourceKey>` | Dataplane | `external-system:publish`; `external-system:read` (validate + preflight datasource exists) | `--dry-run` stops after validate (read only). Unless `--no-sync`, may start a datasource sync after upload (same dataplane sync scopes as other publish flows). **Auth:** Bearer/API key or **x-client-token** (same as `aifabrix upload`). |
| `aifabrix protection list` | Dataplane | `external-system:read` | Lists deployed protection manifests on the dataplane (paginated). **Auth:** Bearer/API key or **x-client-token**. |
| `aifabrix protection show <datasourceKey>` | Dataplane | `external-system:read` | Reads deployed manifest and status for one protection key (resolved from datasource key). **Auth:** Bearer/API key or **x-client-token**. |
| `aifabrix protection delete <datasourceKey>` | Dataplane | `external-system:delete` | Removes deployed protection and lineage-generated grants/values. **Auth:** Bearer/API key or **x-client-token**. |
| `aifabrix validate .protection` | Dataplane | `external-system:read` (when dataplane validate runs) | Batch local AJV for all files under resolved `integration/.protection/`; dataplane validate per file when authenticated. **Auth:** Bearer/API key or **x-client-token** for dataplane validate steps. |
| `aifabrix upload .protection` | Dataplane | `external-system:publish`; `external-system:read` | Batch upload all manifests; preflight requires each `spec.datasourceKey` to exist on the dataplane. **Auth:** Bearer/API key or **x-client-token** (same as `aifabrix upload`). |
| `aifabrix convert .protection` | Local | — | Converts manifest file formats under resolved `integration/.protection/` only; no Controller or Dataplane call. |
| `aifabrix test-governance <systemKey>` | Dataplane | `external-system:publish` (default upload before run); **`governance:evaluate`** (scenario run) | External integrations only. ABAC visibility acceptance (sync keys only). With `--no-sync`, publish is skipped; evaluate still requires `governance:evaluate`. Does not call vendor APIs. |
| `aifabrix test-trust <systemKey>` | Dataplane | `external-system:publish` (default upload before run); `external-data-source:update` (agent metadata validation) | External integrations only (`integration/<systemKey>/`). With `--no-sync`, publish is skipped; validation still requires `external-data-source:update`. |
| `aifabrix datasource test-trust <datasourceKey>` | Dataplane | Same as **`test-trust`** | Single-datasource semantic trust run (404.5). Default uploads integration files first (deployment auth: Bearer/API key or **x-client-token**, same as `test-e2e`). |

For `aifabrix datasource test`, `datasource test-integration`, `datasource test-e2e`, `datasource test-trust`, `datasource load`, and `datasource export`, flags such as `--watch` (where supported) only re-run the same command when local files change; permissions and Dataplane scopes are unchanged per invocation.

---

## Controller permissions (summary)

- **applications:read** – List/get template applications and (with env) environment applications.
- **applications:create** – Create template application.
- **applications:update** – Update template application.
- **applications:delete** – Delete template application.
- **applications:deploy** – Pipeline validate, pipeline deploy, get pipeline deployment.
- **environments:read** – List/get environments, status, roles, datasources.
- **environments:create** – Create environment.
- **environments:update** – Update environment, role groups.
- **environments-applications:create** – Register application in environment.
- **environments-applications:read** – List/get environment applications, app status.
- **environments-applications:update** – Rotate application secret.
- **deployments:read** – List/get deployments and deployment logs.
- **controller:deploy** – Deploy environment (env deploy).
- **auth:read** – User info, validate token, roles, permissions.
- **dashboard:read** – Dashboard summary (if used by CLI or UI).
- **integration-client:create** – Create integration clients and API credentials (one-time secret on create).
- **integration-client:read** – List integration clients.
- **integration-client:update** – Regenerate secret, update groups, update redirect URIs for integration clients.
- **integration-client:delete** – Deactivate integration clients.
- **dimensions:create** – Create dimensions (Dimension Catalog).
- **dimensions:read** – List/get dimensions (Dimension Catalog).
- **dimensions:update** – Update dimensions or dimension values (when used by controller).
- **dimensions:delete** – Delete dimensions or dimension values (cascade deletes values when deleting the dimension).

---

## Dataplane permissions (summary)

- **external-system:read** – List/get external systems, config, OpenAPI files/endpoints, wizard deployment docs, platforms. Also covers read-only **pipeline upload** listing and retrieval, **deployment validation** on the Dataplane, and **protection** validate/simulate/list/show/status/history/explain (`aifabrix protection *` read paths, `validate .protection` dataplane step). Those dataplane read paths accept **Bearer/API key** or **x-client-token**, same as pipeline upload.
- **external-system:create** – Create external system, from-template, wizard sessions and steps (parse, detect-type, generate-config, validate, etc.).
- **external-system:update** – Update external system, publish, rollback, save-template, deployment docs POST.
- **external-system:delete** – Delete (soft) external system. Also required for **`aifabrix protection delete`** (removes deployed protection manifest and projection lineage).
- **external-system:publish** – Dataplane **pipeline deployment** (mutating): full-system upload, datasource-scoped publish, **protection upload** (`aifabrix protection upload`, `upload .protection`), and default pre-run upload for **`test-trust`**. Accepts **Bearer/API key** or **x-client-token** (application token from client credentials exchange; the CLI does not send raw client id/secret to these endpoints). **Pipeline test** (system or per-datasource) uses the same deployment auth options for CI/CD.
- **external-data-source:read** – Dataplane pipeline test and datasource validation runs. Can be used for pipeline test (alternative to `external-system:publish`). Covers `aifabrix datasource test` and `test-integration` when not using `external-system:publish`, and is required for `aifabrix datasource test-e2e` (unified E2E validation run; same login or app-token style auth as `test-integration`). Also used by agent metadata validation **GET** (latest/history) when the CLI reads cached trust results.
- **governance:evaluate** – Run governance scenario acceptance (`aifabrix test-governance`). Evaluates per-subject ABAC visibility via governed search; operator token only (subjects are named in the scenario pack). Does not grant `record:search` impersonation on the public records API.
- **external-data-source:update** – Mutating datasource-scoped operations. Required for **`aifabrix test-trust`** / **`datasource test-trust`** agent metadata validation runs (`POST` on the dataplane). Distinct from E2E read-only checks: trust runs may change persisted `agentValidation` state on the datasource.
- **external-data-source:sync** – Bulk record sync for **`aifabrix datasource load`** (import local JSON/NDJSON fixtures into dataplane storage).
- **record:search** – Cross-datasource records search for **`aifabrix datasource export`** (governed read path with ABAC).
- **credential:read** – List/get credentials, wizard credentials list.
- **credential:create** – Create credential (if used by wizard).
- **credential:update** – Update credential.
- **credential:delete** – Delete credential.
- **audit:read** – Execution logs, RBAC/ABAC queries (datasource executions when applicable).
- **Pipeline auth split** – **Publish to controller** from the Dataplane (internal) uses **client credentials** (x-client-id, x-client-secret) toward the controller; Bearer is not used on that path. **CLI → Dataplane** calls (`upload`, datasource upload, pipeline validate, **protection** validate/upload/list/show/delete, validation runs) accept **Bearer/API key** or **x-client-token** (application token). The CLI obtains **x-client-token** by exchanging app client credentials at the controller token endpoint when no user Bearer is available; see [Authentication](authentication.md) and [Deployment](deployment.md).

---

## See also

- [Authentication Commands](authentication.md) – Login and token options.
- [Application Management Commands](application-management.md) – Show, register, rotate.
- [Deployment Commands](deployment.md) – Deploy and env deploy.
- [External Integration Commands](external-integration.md) – Download, datasource upload, wizard.
- [Dimensions](dimensions.md) – Dimension catalog (`valueType`) for protection authoring.
- [Protection](protection.md) – Protection manifests in `integration/.protection/`.
- [External integration testing](external-integration-testing.md) – `test`, `test-integration`, `test-e2e`, and **`test-trust`** (semantic agent metadata validation).
- [Governance scenario acceptance](governance-testing.md) – **`test-governance`** (ABAC visibility proof; separate from test-e2e).
- Miso Controller OpenAPI: `openapi-complete.yaml` in the miso-controller repo (operationId and security.oauth2 per path).
- Dataplane OpenAPI: `openapi.yaml` in the dataplane repo (operationId and security.oauth2 per path).
