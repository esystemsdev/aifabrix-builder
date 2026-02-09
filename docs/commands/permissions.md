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
|--------|---------|------------------------|--------|
| `aifabrix login` | Controller | None (device or client credentials) | Obtains token; subsequent commands use token scopes. |
| `aifabrix logout` | Controller | None | Clears local tokens. |
| `aifabrix show <appKey> --online` | Controller | `applications:read` or env-scoped app access | Fetches template app and/or environment application. |
| `aifabrix app show <appKey>` | Controller | `applications:read` or env-scoped app | Same as `show --online`. For external type, also calls Dataplane for system details. |
| `aifabrix app register <appKey>` | Controller | `environments-applications:create` | Register app in environment and get client credentials. |
| `aifabrix app list` | Controller | `environments-applications:read` | List applications in the configured environment. |
| `aifabrix app rotate-secret <appKey>` | Controller | `environments-applications:update` | Rotate client secret for the app. |
| `aifabrix environment deploy <env>` | Controller | `controller:deploy` | Deploy environment infrastructure. |
| `aifabrix deploy [app]` | Controller | `applications:deploy` | Validate then deploy; uses pipeline validate + deploy. |
| `aifabrix deployments` | Controller | `deployments:read` | List deployments for the environment. |
| `aifabrix credential list` | Dataplane (or Controller) | `credential:read` | When targeting Dataplane (typical); Controller credential API may differ. |
| `aifabrix download [systemKey]` | Dataplane | `external-system:read` | Download external system config from Dataplane. |
| `aifabrix datasource deploy` | Dataplane | Authenticated (pipeline publish/deploy) | Uses pipeline publish; Dataplane accepts client credentials. |
| `aifabrix test-integration` | Dataplane | Authenticated (pipeline test) | Calls Dataplane pipeline test endpoint. |
| `aifabrix wizard [appName]` | Dataplane | `external-system:create`, `external-system:read`, `credential:read` (for credential step) | Wizard sessions and steps use Dataplane wizard API. |
| `aifabrix service-user create` | Controller | `service-user:create` | Create service user (username, email, redirectUris, groupNames); receive one-time clientSecret (save at creation time). |

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
- **controller:deploy** – Deploy environment (environment deploy).
- **auth:read** – User info, validate token, roles, permissions.
- **dashboard:read** – Dashboard summary (if used by CLI or UI).
- **service-user:create** – Create service users and API clients (one-time secret on create).

---

## Dataplane permissions (summary)

- **external-system:read** – List/get external systems, config, OpenAPI files/endpoints, wizard deployment docs, platforms.
- **external-system:create** – Create external system, from-template, wizard sessions and steps (parse, detect-type, generate-config, validate, etc.).
- **external-system:update** – Update external system, publish, rollback, save-template, deployment docs POST.
- **external-system:delete** – Delete (soft) external system.
- **credential:read** – List/get credentials, wizard credentials list.
- **credential:create** – Create credential (if used by wizard).
- **credential:update** – Update credential.
- **credential:delete** – Delete credential.
- **audit:read** – Execution logs, RBAC/ABAC queries (datasource executions when applicable).
- Pipeline publish/deploy/test/upload – Typically **authenticated** (oauth2: []); no specific scope in Dataplane OpenAPI.

---

## See also

- [Authentication Commands](authentication.md) – Login and token options.
- [Application Management Commands](application-management.md) – Show, register, rotate.
- [Deployment Commands](deployment.md) – Deploy and environment deploy.
- [External Integration Commands](external-integration.md) – Download, datasource deploy, wizard.
- Miso Controller OpenAPI: `openapi-complete.yaml` in the miso-controller repo (operationId and security.oauth2 per path).
- Dataplane OpenAPI: `openapi.yaml` in the dataplane repo (operationId and security.oauth2 per path).
