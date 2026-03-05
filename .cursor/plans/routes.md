# API Routes: Dataplane and Miso Controller

APIs used by the Builder CLI, grouped by auth type. **Bearer-only** endpoints are not listed (see docs for upload/publish/validate pipeline endpoints that require OAuth2 Bearer or API_KEY only).

---

## Security principles

- **Only one endpoint** accepts **client-id + client-secret**: **POST /api/v1/auth/token** (token-mint on the controller). Callers get a token and use it as **Bearer** or **x-client-token** on all other endpoints.
- **Bearer** — Used for user/session auth and for machine-to-machine when the caller already has a token.
- **x-client-token** — Used only where “application authentication” is required (no user session): CI, pipeline validate/deploy, app status, external-systems/register, logs, sync, etc. The header must be explicitly documented on those routes.
- **No endpoint** (other than the token-issuing endpoint) is callable with only client-id and client-secret.

---

## Header: x-client-token

When client token is in use, callers must send the application token in the **x-client-token** header. For **controller-issued** token: obtain from controller **POST /api/v1/auth/token** with client credentials. For **dataplane** token (when calling dataplane endpoints that accept application auth): obtain from dataplane **GET/POST /api/v1/auth/client-token** (miso_client `create_fastapi_client_token_endpoint`). **Do not send client-id/client-secret on any other endpoint.**

---

## Auth policy (aligned with miso-controller)

- **Bearer by default:** User-facing routes use **Authorization: Bearer &lt;token&gt;** only.
- **x-client-token only where needed:** Application/CI flows (deploy, logs, sync, app status, etc.) use header **x-client-token** with the JWT from token-mint (or dataplane client-token endpoint for dataplane’s own token).
- **No client-id/secret on app routes:** The **only** endpoint that accepts `x-client-id` and `x-client-secret` is **POST /api/v1/auth/token** (token-mint). All other Controller and Dataplane routes require Bearer and/or **x-client-token**; callers must obtain a token first.
- **OpenAPI:** Every route that accepts application auth must document the **x-client-token** header parameter.

**For Builder:** Use token-mint (or dataplane GET/POST /api/v1/auth/client-token for dataplane token) to get a token, then send **x-client-token** (or Bearer) on Controller/Dataplane calls that support application auth. Do not send client-id/secret on any route other than token-mint.

---

## Auth types

| Type | Description |
|------|-------------|
| **Client token only** | Endpoint accepts only `x-client-token` (application token). |
| **Client token and Bearer** | Endpoint accepts either `x-client-token` or `Authorization: Bearer <token>`. |

**Must have client token** = Backend must accept `x-client-token` because the Builder (or CI, e.g. GitHub Actions) calls this endpoint without a user Bearer token — e.g. deploy from CI, download in CI, test-integration. If the backend accepted only Bearer, these flows would break.  
**Environments** (list/get/status/roles etc.): In practice you cannot use them without Bearer (interactive/admin); backend may still accept client token, but CI does not rely on it → **No** for must-have.

---

## 1. Client token only

Endpoints that accept **only** `x-client-token` (or Bearer from token exchange). “Client token only” here means **only x-client-token or Bearer is accepted**; **do not send client-id/secret** on these app endpoints. (The token-issuing endpoint `POST /api/v1/auth/token` is the only one that accepts client-id/secret to return a token; it is not listed in the app-endpoint tables.)

*None identified in current Builder usage for “x-client-token only, no Bearer”.*

---

## 2. Client token and Bearer

Endpoints that accept **either** `x-client-token` **or** `Authorization: Bearer <token>`. When using application auth, send **x-client-token** header (token from controller **POST /api/v1/auth/token** or, for dataplane, from dataplane **GET/POST /api/v1/auth/client-token**). Do not send client-id/secret.

### Miso Controller

| Method | Path | Builder usage | Must have client token |
|--------|------|----------------|------------------------|
| GET | `/api/v1/auth/user` | `getAuthUser` | No |
| GET | `/api/v1/auth/login` | `getAuthLogin` (params: redirect, state) | No |
| POST | `/api/v1/auth/validate` | `validateToken` | No |
| GET | `/api/v1/auth/roles` | `getAuthRoles` | No |
| GET | `/api/v1/auth/roles/refresh` | `refreshAuthRoles` | No |
| GET | `/api/v1/auth/permissions` | `getAuthPermissions` | No |
| GET | `/api/v1/auth/permissions/refresh` | `refreshAuthPermissions` | No |
| GET | `/api/v1/applications` | `listApplications` | Yes (CI show/list) |
| POST | `/api/v1/applications` | `createApplication` | No |
| GET | `/api/v1/applications/{appKey}` | `getApplication` | Yes (CI show) |
| PATCH | `/api/v1/applications/{appKey}` | `updateApplication` | No |
| DELETE | `/api/v1/applications/{appKey}` | `deleteApplication` | No |
| POST | `/api/v1/environments/{envKey}/applications/register` | `registerApplication` | Yes (CI register) |
| POST | `/api/v1/environments/{envKey}/applications/{appKey}/rotate-secret` | `rotateApplicationSecret` | No |
| GET | `/api/v1/environments/{envKey}/applications/{appKey}/status` | `getApplicationStatus` | Yes (CI status check) |
| POST | `/api/v1/pipeline/{envKey}/validate` | `validatePipeline` | **Yes (GitHub/CI deploy)** |
| POST | `/api/v1/pipeline/{envKey}/deploy` | `deployPipeline` | **Yes (GitHub/CI deploy)** |
| GET | `/api/v1/pipeline/{envKey}/deployments/{deploymentId}` | `getPipelineDeployment` | **Yes (CI deploy status)** |
| POST | `/api/v1/environments/{envKey}/applications/deploy` | `deployApplication` | Yes (CI deploy) |
| POST | `/api/v1/environments/{envKey}/deploy` | `deployEnvironment` | No (admin/Bearer) |
| GET | `/api/v1/environments/{envKey}/deployments` | `listDeployments` | Yes (CI list deployments) |
| GET | `/api/v1/environments/{envKey}/deployments/{deploymentId}` | `getDeployment` | Yes (CI get deployment) |
| GET | `/api/v1/environments/{envKey}/deployments/{deploymentId}/logs` | `getDeploymentLogs` | Yes (CI logs) |
| GET | `/api/v1/environments/{envKey}/applications/{appKey}/deployments` | `listApplicationDeployments` | Yes (CI) |
| GET | `/api/v1/environments` | `listEnvironments` | No (Bearer in practice) |
| POST | `/api/v1/environments` | `createEnvironment` | No |
| GET | `/api/v1/environments/{envKey}` | `getEnvironment` | No (Bearer in practice) |
| PATCH | `/api/v1/environments/{envKey}` | `updateEnvironment` | No |
| GET | `/api/v1/environments/{envKey}/status` | `getEnvironmentStatus` | No (Bearer in practice) |
| GET | `/api/v1/environments/{envKey}/applications` | `listEnvironmentApplications` | Yes (CI app list) |
| GET | `/api/v1/environments/{envKey}/applications/{appKey}` | `getEnvironmentApplication` | Yes (CI download/deploy) |
| GET | `/api/v1/environments/{envKey}/datasources` | `listEnvironmentDatasources` | No |
| GET | `/api/v1/environments/{envKey}/deployments` | `listEnvironmentDeployments` | Yes (CI) |
| GET | `/api/v1/environments/{envKey}/roles` | `listEnvironmentRoles` | No |
| PATCH | `/api/v1/environments/{envKey}/roles/{value}/groups` | `updateRoleGroups` | No |

### Dataplane

#### External systems

| Method | Path | Builder usage | Must have client token |
|--------|------|----------------|------------------------|
| GET | `/api/v1/external/systems` | `listExternalSystems` | Yes (CI download/list) |
| POST | `/api/v1/external/systems` | `createExternalSystem` | No |
| GET | `/api/v1/external/systems/{systemIdOrKey}` | `getExternalSystem` | **Yes (CI download)** |
| PUT | `/api/v1/external/systems/{systemIdOrKey}` | `updateExternalSystem` | No |
| DELETE | `/api/v1/external/systems/{systemIdOrKey}` | `deleteExternalSystem` | No |
| GET | `/api/v1/external/systems/{systemIdOrKey}/config` | `getExternalSystemConfig` | **Yes (CI download)** |
| POST | `/api/v1/external/systems/from-template` | `createFromTemplate` | No |
| GET | `/api/v1/external/systems/{systemIdOrKey}/openapi-files` | `listOpenAPIFiles` | Yes (CI show) |
| GET | `/api/v1/external/systems/{systemIdOrKey}/openapi-endpoints` | `listOpenAPIEndpoints` | Yes (CI show) |
| POST | `/api/v1/external/systems/{systemIdOrKey}/publish` | `publishExternalSystem` | No |
| POST | `/api/v1/external/systems/{systemIdOrKey}/rollback` | `rollbackExternalSystem` | No |
| POST | `/api/v1/external/systems/{systemIdOrKey}/save-template` | `saveAsTemplate` | No |

#### Pipeline (test; client token + Bearer)

| Method | Path | Builder usage | Must have client token |
|--------|------|----------------|------------------------|
| POST | `/api/v1/pipeline/{systemKey}/test` | `testSystemViaPipeline` | **Yes (CI test-integration)** |
| POST | `/api/v1/pipeline/{systemKey}/{datasourceKey}/test` | `testDatasourceViaPipeline` | **Yes (CI test-integration)** |

#### Wizard

| Method | Path | Builder usage | Must have client token |
|--------|------|----------------|------------------------|
| POST | `/api/v1/wizard/sessions` | `createWizardSession` | No |
| GET | `/api/v1/wizard/sessions/{sessionId}` | `getWizardSession` | No |
| PUT | `/api/v1/wizard/sessions/{sessionId}` | `updateWizardSession` | No |
| DELETE | `/api/v1/wizard/sessions/{sessionId}` | `deleteWizardSession` | No |
| GET | `/api/v1/wizard/sessions/{sessionId}/progress` | `getWizardProgress` | No |
| POST | `/api/v1/wizard/parse-openapi` | `parseOpenApi` (also via file upload) | No |
| POST | `/api/v1/wizard/credential-selection` | `credentialSelection` | No |
| POST | `/api/v1/wizard/detect-type` | `detectType` | No |
| POST | `/api/v1/wizard/platforms/{platformKey}/config` | `getPlatformConfig` | No |
| POST | `/api/v1/wizard/generate-config` | `generateConfig` | No |
| POST | `/api/v1/wizard/generate-config-stream` | `generateConfigStream` | No |
| POST | `/api/v1/wizard/validate` | `validateWizardConfig` | No |
| GET | `/api/v1/wizard/sessions/{sessionId}/validate` | `validateAllSteps` | No |
| POST | `/api/v1/wizard/sessions/{sessionId}/validate-step` | `validateStep` | No |
| GET | `/api/v1/wizard/preview/{sessionId}` | `getPreview` | No |
| POST | `/api/v1/wizard/test-mcp-connection` | `testMcpConnection` | No |
| GET | `/api/v1/wizard/deployment-docs/{systemKey}` | `getDeploymentDocs` | No |
| POST | `/api/v1/wizard/deployment-docs/{systemKey}` | `postDeploymentDocs` | No |
| GET | `/api/v1/wizard/platforms` | `getWizardPlatforms` | No |
| GET | `/api/v1/wizard/platforms/{platformKey}` | `getPlatformDetails` | No |
| POST | `/api/v1/wizard/discover-entities` | `discoverEntities` | No |
| GET | `/api/v1/wizard/credentials` | `listWizardCredentials` | No |

#### Datasources (core)

| Method | Path | Builder usage | Must have client token |
|--------|------|----------------|------------------------|
| GET | `/api/v1/external/` | `listDatasources` | Yes (CI) |
| POST | `/api/v1/external/` | `createDatasource` | No |
| GET | `/api/v1/external/{sourceIdOrKey}` | `getDatasource` | Yes (CI download) |
| PUT | `/api/v1/external/{sourceIdOrKey}` | `updateDatasource` | No |
| DELETE | `/api/v1/external/{sourceIdOrKey}` | `deleteDatasource` | No |
| GET | `/api/v1/external/{sourceIdOrKey}/config` | `getDatasourceConfig` | Yes (CI download) |
| POST | `/api/v1/external/{sourceIdOrKey}/publish` | `publishDatasource` | No |
| POST | `/api/v1/external/{sourceIdOrKey}/rollback` | `rollbackDatasource` | No |
| POST | `/api/v1/external/{sourceIdOrKey}/test` | `testDatasource` | Yes (CI test) |
| GET | `/api/v1/external/{sourceIdOrKey}/openapi-endpoints` | `listDatasourceOpenAPIEndpoints` | Yes (CI show) |
| GET | `/api/v1/external/{sourceIdOrKey}/executions` | `listExecutionLogs` | No |
| GET | `/api/v1/external/{sourceIdOrKey}/executions/{executionId}` | `getExecutionLog` | No |
| GET | `/api/v1/external/executions` | `listAllExecutionLogs` | No |
| POST | `/api/v1/external/{sourceIdOrKey}/bulk` | `bulkOperation` | No |
| GET | `/api/v1/external/{sourceIdOrKey}/status` | `getDatasourceStatus` | Yes (CI status) |

#### Datasources (extended: records, grants, policies, sync, documents)

| Method | Path | Builder usage | Must have client token |
|--------|------|----------------|------------------------|
| GET | `/api/v1/external/{sourceIdOrKey}/records` | `listRecords` | No |
| POST | `/api/v1/external/{sourceIdOrKey}/records` | `createRecord` | No |
| GET | `/api/v1/external/{sourceIdOrKey}/records/{recordIdOrKey}` | `getRecord` | No |
| PUT | `/api/v1/external/{sourceIdOrKey}/records/{recordIdOrKey}` | `updateRecord` | No |
| DELETE | `/api/v1/external/{sourceIdOrKey}/records/{recordIdOrKey}` | `deleteRecord` | No |
| GET | `/api/v1/external/{sourceIdOrKey}/grants` | `listGrants` | No |
| POST | `/api/v1/external/{sourceIdOrKey}/grants` | `createGrant` | No |
| GET | `/api/v1/external/{sourceIdOrKey}/grants/{grantIdOrKey}` | `getGrant` | No |
| PUT | `/api/v1/external/{sourceIdOrKey}/grants/{grantIdOrKey}` | `updateGrant` | No |
| DELETE | `/api/v1/external/{sourceIdOrKey}/grants/{grantIdOrKey}` | `deleteGrant` | No |
| GET | `/api/v1/external/{sourceIdOrKey}/policies` | `listPolicies` | No |
| POST | `/api/v1/external/{sourceIdOrKey}/policies` | `attachPolicy` | No |
| DELETE | `/api/v1/external/{sourceIdOrKey}/policies/{policyIdOrKey}` | `detachPolicy` | No |
| GET | `/api/v1/external/{sourceIdOrKey}/sync` | `listSyncJobs` | No |
| POST | `/api/v1/external/{sourceIdOrKey}/sync` | `createSyncJob` | No |
| GET | `/api/v1/external/{sourceIdOrKey}/sync/{syncJobId}` | `getSyncJob` | No |
| PUT | `/api/v1/external/{sourceIdOrKey}/sync/{syncJobId}` | `updateSyncJob` | No |
| POST | `/api/v1/external/{sourceIdOrKey}/sync/{syncJobId}/execute` | `executeSyncJob` | No |
| POST | `/api/v1/external/data-sources/{sourceIdOrKey}/documents/validate` | `validateDocuments` | No |
| POST | `/api/v1/external/data-sources/{sourceIdOrKey}/documents/bulk` | `bulkDocuments` | No |
| GET | `/api/v1/external/data-sources/{sourceIdOrKey}/documents` | `listDocuments` | No |

#### Credential (Dataplane)

| Method | Path | Builder usage | Must have client token |
|--------|------|----------------|------------------------|
| GET | `/api/v1/credential` | `listCredentials` | No |
| POST | `/api/v1/credential/secret` | `storeCredentialSecrets` | No (used with Bearer upload flow) |

---

## No auth (public)

| Service | Method | Path | Builder usage |
|---------|--------|------|----------------|
| Controller | GET | `/api/v1/pipeline/{envKey}/health` | `getPipelineHealth` |
| Controller | GET | `/api/v1/auth/client-token` | `getClientToken` (GET) — for obtaining token (browser/config), not for calling other APIs with client-id/secret |
| Controller | POST | `/api/v1/auth/client-token` | `getClientToken` (POST) — same |
| Controller | POST | `/api/v1/auth/login` (device code) | `initiateDeviceCodeFlow` |
| Controller | POST | `/api/v1/auth/login/device/token` | `pollDeviceCodeToken` |
| Controller | GET | `/api/v1/auth/login/diagnostics` | `getAuthLoginDiagnostics` |

**Note:** **GET/POST .../auth/client-token** (Controller or Dataplane) are for **obtaining** the token (browser/config). Do not use them to call other APIs with client-id/secret; use the token as Bearer or x-client-token on other endpoints.

---

## Not listed (Bearer-only)

Dataplane pipeline endpoints that require **OAuth2 (Bearer) or API_KEY only**. **Auth: Authorization: Bearer only;** no **x-client-token**; no client-id/secret. Omitted from the tables above per request.

- `POST /api/v1/pipeline/upload` — `uploadApplicationViaPipeline`
- `POST /api/v1/pipeline/{systemKey}/upload` — `publishDatasourceViaPipeline`
- `POST /api/v1/pipeline/validate` — `validatePipelineConfig`
- `POST /api/v1/external/{sourceIdOrKey}/test-e2e` — `testDatasourceE2E` (Bearer or API key only; no x-client-token)

**Controller auth refresh (Bearer only):** Require refresh token; not callable with x-client-token.

- `POST /api/v1/auth/refresh` — `refreshUserToken`
- `POST /api/v1/auth/login/device/refresh` — `refreshDeviceToken`

See `requireBearerForDataplanePipeline` in `lib/utils/token-manager.js` and `docs/commands/permissions.md` for details.

---

## Validation summary

- **No client-id/secret on app routes:** Only **POST /api/v1/auth/token** (Controller) accepts `x-client-id` and `x-client-secret`. For all other Controller and Dataplane calls, Builder must send **x-client-token** (obtained from token-mint).
- **Same endpoint, two Builder functions:** `listDeployments` (deployments.api.js) and `listEnvironmentDeployments` (environments.api.js) both call **GET /api/v1/environments/{envKey}/deployments**; they refer to the same Controller route.
- **Pipeline deployment (Controller)** — `validatePipeline`, `deployPipeline`, `getPipelineDeployment`: **Must have client token = Yes**, because GitHub Actions and other CI run deploy without a user Bearer token; they use app client credentials → client token.
- **Environments (Controller)** — `listEnvironments`, `getEnvironment`, `getEnvironmentStatus`, roles, etc.: **Must have client token = No**. In practice you cannot get environments without Bearer (interactive/admin). Backend may still accept client token; CI does not rely on it.
- **Dataplane pipeline test** — `testSystemViaPipeline`, `testDatasourceViaPipeline`: **Must have client token = Yes** for `aifabrix datasource test-integration` / `aifabrix test-integration` in CI (permissions.md: “supports client credentials (CI/CD)”).
- **Dataplane download** — `getExternalSystem`, `getExternalSystemConfig`, list/get datasource(s), config: **Must have client token = Yes** for `aifabrix download` in CI.
- **Wizard** — All wizard endpoints: **Must have client token = No** (interactive only).

See also: miso-controller `.cursor/plans/routes.md` for the authoritative auth policy and per-route tables.
