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
| `aifabrix datasource test-e2e` | Dataplane | **Logged in:** `external-system:read` **and** `external-data-source:sync` **and** `external-data-source:update` (all required). **CI:** validated app token (`x-client-token`). See [E2E validation and permissions](#e2e-validation-and-permissions). With **`--verify-audit`**, also **`audit:read`**. |
| `aifabrix datasource verify-audit` | Dataplane | `audit:read` | Re-runs the nine-row audit evidence matrix from the latest `test-e2e` debug log or explicit correlation/execution ids (no E2E re-run). |
| `aifabrix datasource load <datasourceKey>` | Dataplane | `external-data-source:sync` | Bulk record sync into dataplane storage. External integration only. **`--dry-run`** parses locally only (no dataplane write). Deployment auth: Bearer/API key or **x-client-token**. |
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
| `aifabrix dimension value create` | Controller | `dimensions:create` | Creates a value for a dimension (static dimension). Value must be unique within the dimension. |
| `aifabrix dimension value list` | Controller | `dimensions:read` | Lists values for a dimension. |
| `aifabrix dimension value delete` | Controller | `dimensions:delete` | Deletes a dimension value by id. |
| `aifabrix identity user create` | Controller | `users:create` or `admin:write` | Creates a user on the controller. |
| `aifabrix identity user list` / `get` / `groups` | Controller | `users:read` or `admin:read` | List/get users or list a user's groups. |
| `aifabrix identity group create` | Controller | `groups:create` or `admin:write` | Creates a group (`name` + `displayName`). |
| `aifabrix identity group list` / `get` / `members` | Controller | `groups:read` or `admin:read` | List/get groups or list members. |
| `aifabrix identity membership add` / `remove` | Controller | `users:update` or `groups:update` or `admin:write` | Add/remove user–group membership (controller ids). |
| `aifabrix identity role list` | Controller | `environments:read` | List role↔group mappings for an environment. |
| `aifabrix identity role set-groups` | Controller | `environments:update` | PATCH role→groups mapping for an environment. |
| `aifabrix identity cache clear` / `invalidate` | Controller | `cache:admin` | Clear all controller cache or invalidate by pattern. |
| `aifabrix identity apply` | Controller | `users:*`, `groups:*`, memberships; plus `cache:admin` if `--purge-cache`; plus `admin:sync` if `--sync` | Bulk CSV apply (users.csv shape); idempotent upsert. |
| `aifabrix identity sync` | Controller | `admin:sync` | Full identity sync to dataplane for `-e` environment. Optional `cache:admin` with `--purge-cache`. |
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

## E2E validation and permissions

<a id="e2e-validation-and-permissions"></a>

**`aifabrix datasource test-e2e`** (and app-level **`aifabrix test-e2e`**) call the dataplane **unified validation** flow with run type **e2e**. Auth and permissions depend on **how** you authenticate.

### Logged-in users (`aifabrix login` → Bearer token)

When you use a **user** token from `aifabrix login`, the dataplane **validates RBAC** on the controller for **every** scope below. **All three are required** to start E2E; missing any scope returns **access denied**.

| Permission | Why E2E needs it |
|------------|------------------|
| **`external-system:read`** | Read integration/system context and start the unified validation run. |
| **`external-data-source:sync`** | Run **sync jobs** during E2E (data ingestion into dataplane storage). |
| **`external-data-source:update`** | Run **capacity / CIP** steps that may **create, update, or delete** records on the external system. |

**Typical roles** that include all three: **aifabrix-developer**, **aifabrix-platform-admin** (assign via the controller UI for the target environment).

**Cannot run full E2E** with read-only roles alone—for example **aifabrix-observer** or **aifabrix-compliance-admin** (`external-system:read` and/or `external-data-source:read` without **sync** and **update**). Use **`datasource test`** or **`datasource test-integration`** for non–side-effecting checks instead.

Permissions are **environment-scoped**. Set them on the dataplane role for the environment you target (dev, tst, pro).

### CI / automation (application token)

For **CI/CD** or scripted runs without an interactive user, use the same **deployment auth** as [upload](deployment.md) and `test-integration`: a validated **application token** (`x-client-token` from client credentials exchange). That path is for **machine** callers, not a substitute for granting observer read access to humans.

Do **not** give integrators only **`external-system:read`** and expect them to run full E2E interactively—they need the **sync** and **update** scopes above.

### What E2E does (side effects are intentional)

By default, E2E is a **full integration test**, not a read-only API check. The dataplane may, in order:

- Validate config and test credentials against the **real** external API.
- **Start and wait for sync jobs**.
- **Verify persisted data** (records/documents/vectors where configured).
- Run **capacity / CIP** with external **create/update/delete** when fixtures and scenarios allow.

See [External integration testing – E2E](external-integration-testing.md#datasource-e2e-tests) and **Data safety** in that guide. Use **test credentials** and **non-production** environments.

### Additional scopes (optional)

| Add-on | Scope |
|--------|--------|
| Audit evidence matrix after a green E2E (`--verify-audit`) | **`audit:read`** |
| Pre-run publish of local files (`--sync` on CLI) | **`external-system:publish`** |

### Other commands (comparison)

| Goal | Command | Typical scopes (logged in) |
|------|---------|----------------------------|
| Structural/policy validation, no E2E side effects | `datasource test` | `external-system:read` or `external-system:publish` |
| Integration validation without full E2E CRUD | `datasource test-integration` | `external-system:publish` or `external-data-source:read` |
| Bulk fixture import | `datasource load` | **`external-data-source:sync`** only |
| Semantic trust / agent metadata | `datasource test-trust` | **`external-data-source:update`** (+ often publish for `--sync`) |

### Narrowing E2E side effects (CLI options)

Optional flags on **`aifabrix datasource test-e2e --help`** (for example **`--no-run-scenarios`**, **`--no-cleanup`**, capability-focused runs) reduce what the run does; they **do not** remove the need for **sync** and **update** permissions on the logged-in path unless the dataplane adds a dedicated read-only E2E mode later.

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
- **users:read** – List/get users and user groups (`aifabrix identity user *`).
- **users:create** – Create users (`identity user create`, `identity apply`).
- **users:update** – Update users and memberships (`identity membership *`, `identity apply`).
- **groups:read** – List/get groups and members (`identity group *`).
- **groups:create** – Create groups (`identity group create`, `identity apply`).
- **cache:admin** – Clear or invalidate controller auth/RBAC cache (`identity cache *`, `--purge-cache`).
- **admin:sync** – Full identity sync to dataplane (`identity sync`, `identity apply --sync`).

---

## Dataplane permissions (summary)

- **external-system:read** – List/get external systems, config, OpenAPI, wizard docs, platforms; protection read paths; **`datasource test`** / structural validation. **Required for E2E** but **not sufficient alone** for logged-in users—see [E2E validation and permissions](#e2e-validation-and-permissions).
- **external-system:create** – Create external system, from-template, wizard sessions and steps (parse, detect-type, generate-config, validate, etc.).
- **external-system:update** – Update external system, publish, rollback, save-template, deployment documentation uploads.
- **external-system:delete** – Delete (soft) external system. Also required for **`aifabrix protection delete`** (removes deployed protection manifest and projection lineage).
- **external-system:publish** – Dataplane **pipeline deployment** (mutating): full-system upload, datasource-scoped publish, **protection upload** (`aifabrix protection upload`, `upload .protection`), and default pre-run upload for **`test-trust`**. Accepts **Bearer/API key** or **x-client-token** (application token from client credentials exchange; the CLI does not send raw client id/secret to these endpoints). **Pipeline test** (system or per-datasource) uses the same deployment auth options for CI/CD.
- **external-data-source:read** – Pipeline test and **`datasource test`** / **`test-integration`** when not using `external-system:publish`; cached trust reads. **Does not replace** **`external-data-source:sync`** or **`update`** for logged-in **E2E** (see [E2E validation and permissions](#e2e-validation-and-permissions)).
- **audit:read** – Read execution logs and RBAC/ABAC audit traces on the dataplane. Required for **`aifabrix datasource verify-audit`** and for **`aifabrix datasource test-e2e --verify-audit`**, which validate the CLI **nine-row audit evidence matrix** after a successful E2E run.
- **governance:evaluate** – Run governance scenario acceptance (`aifabrix test-governance`). Evaluates per-subject ABAC visibility via governed search; operator token only (subjects are named in the scenario pack). Does not grant `record:search` impersonation on the public records API.
- **external-data-source:sync** – Sync jobs, **`datasource load`** (fixture import), and E2E sync steps. **Required for logged-in `datasource test-e2e`** together with **`external-system:read`** and **`external-data-source:update`**.
- **external-data-source:update** – Datasource mutations; **`test-trust`** / agent metadata validation. **Required for logged-in `datasource test-e2e`** (capacity / external CRUD steps) together with **read** and **sync**.
- **record:search** – Cross-datasource records search for **`aifabrix datasource export`** (governed read path with ABAC).
- **credential:read** – List/get credentials, wizard credentials list.
- **credential:create** – Create credential (if used by wizard).
- **credential:update** – Update credential.
- **credential:delete** – Delete credential.
- **Pipeline auth split** – **Publish to controller** from the Dataplane (internal) uses **client credentials** (x-client-id, x-client-secret) toward the controller; Bearer is not used on that path. **CLI → Dataplane** calls (`upload`, datasource upload, pipeline validate, **protection** validate/upload/list/show/delete, validation runs) accept **Bearer/API key** or **x-client-token** (application token). The CLI obtains **x-client-token** by exchanging app client credentials at the controller token endpoint when no user Bearer is available; see [Authentication](authentication.md) and [Deployment](deployment.md).

---

## See also

- [Authentication Commands](authentication.md) – Login and token options.
- [Application Management Commands](application-management.md) – Show, register, rotate.
- [Deployment Commands](deployment.md) – Deploy and env deploy.
- [External Integration Commands](external-integration.md) – Download, datasource upload, wizard.
- [Dimensions](dimensions.md) – Dimension catalog (`valueType`) for protection authoring.
- [Identity management](identity-management.md) – Users, groups, memberships, role mappings, cache, dataplane identity sync.
- [Protection](protection.md) – Protection manifests in `integration/.protection/`.
- [External integration testing](external-integration-testing.md) – `test`, `test-integration`, `test-e2e`, and **`test-trust`** (semantic agent metadata validation).
- [Governance scenario acceptance](governance-testing.md) – **`test-governance`** (ABAC visibility proof; separate from test-e2e).
- Scope names above are the contract for CLI operators; your platform team maps them to controller and dataplane RBAC. Use `aifabrix login` and role assignment in the controller UI—do not rely on private repository paths in this documentation.
