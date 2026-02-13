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
| `aifabrix show <appKey> --online` | Controller | `applications:read` or env-scoped app access | Fetches template app and/or environment application. For **external** (dataplane) apps, also calls Dataplane for system details → **Dataplane** `external-system:read` required in that case. |
| `aifabrix app show <appKey>` | Controller + Dataplane (if external) | Controller: `applications:read` or env-scoped app. If external: **Dataplane** `external-system:read` | Same as `show --online`. For external type, also calls Dataplane for system details (get external system, config, OpenAPI files/endpoints). |
| `aifabrix app register <appKey>` | Controller | `environments-applications:create` | Register app in environment and get client credentials. |
| `aifabrix app list` | Controller | `environments-applications:read` | List applications in the configured environment. |
| `aifabrix app rotate-secret <appKey>` | Controller | `environments-applications:update` | Rotate client secret for the app. |
| `aifabrix environment deploy <env>` | Controller | `controller:deploy` | Deploy environment infrastructure. |
| `aifabrix deploy [app]` | Controller | `applications:deploy` | Validate then deploy; uses pipeline validate + deploy. |
| `aifabrix deployments` | Controller | `deployments:read` | List deployments for the environment. |
| `aifabrix credential list` | Dataplane | `credential:read` | GET `/api/v1/credential` is a **Dataplane** endpoint. The Controller does not expose this path (see Controller OpenAPI). The CLI should target the Dataplane URL for this command. |
| `aifabrix download [systemKey]` | Dataplane | `external-system:read` | Download external system config from Dataplane. |
| `aifabrix upload [system-key]` | Dataplane | `external-system:publish` | Uses POST `/api/v1/pipeline/upload`, POST `.../upload/{id}/validate`, POST `.../upload/{id}/publish`. **Bearer token required** (e.g. from `aifabrix login`); client id/secret are not accepted for these endpoints. |
| `aifabrix datasource deploy` | Dataplane | `external-system:publish` | Uses pipeline publish. |
| `aifabrix test-integration` | Dataplane | `external-system:publish` or `external-data-source:read` | Calls Dataplane pipeline test endpoint. |
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

- **external-system:read** – List/get external systems, config, OpenAPI files/endpoints, wizard deployment docs, platforms. Also: Dataplane GET `/api/v1/pipeline/upload` (list uploads), GET `.../upload/{id}` (get upload), POST `.../pipeline/validate` (deployment validation).
- **external-system:create** – Create external system, from-template, wizard sessions and steps (parse, detect-type, generate-config, validate, etc.).
- **external-system:update** – Update external system, publish, rollback, save-template, deployment docs POST.
- **external-system:delete** – Delete (soft) external system.
- **external-system:publish** – Dataplane **pipeline deployment** (mutating): POST `/api/v1/pipeline/publish`, POST `.../{systemIdOrKey}/publish`, POST `/upload`, POST `.../upload/{id}/validate`, POST `.../upload/{id}/publish`, and optionally datasource test. All of these require **OAuth2 (Bearer) only**; client id/secret are **not** accepted.
- **external-data-source:read** – Can be used for Dataplane pipeline test endpoint (alternative to `external-system:publish`).
- **credential:read** – List/get credentials, wizard credentials list.
- **credential:create** – Create credential (if used by wizard).
- **credential:update** – Update credential.
- **credential:delete** – Delete credential.
- **audit:read** – Execution logs, RBAC/ABAC queries (datasource executions when applicable).
- **Pipeline auth split** – **POST `/api/v1/pipeline/publish-controller`** accepts **client credentials only** (x-client-id, x-client-secret); no Bearer. All **other** pipeline endpoints accept **OAuth2 (Bearer) or API_KEY only**; client id/secret are rejected. Use `aifabrix login` (or a client token with the right scope) for upload, publish, and test; use client credentials only for publish-controller (e.g. CI calling the dataplane to trigger controller deploy).

---

## See also

- [Authentication Commands](authentication.md) – Login and token options.
- [Application Management Commands](application-management.md) – Show, register, rotate.
- [Deployment Commands](deployment.md) – Deploy and environment deploy.
- [External Integration Commands](external-integration.md) – Download, datasource deploy, wizard.
- Miso Controller OpenAPI: `openapi-complete.yaml` in the miso-controller repo (operationId and security.oauth2 per path).
- Dataplane OpenAPI: `openapi.yaml` in the dataplane repo (operationId and security.oauth2 per path).
