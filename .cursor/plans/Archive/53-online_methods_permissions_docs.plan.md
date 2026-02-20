---
name: Online methods permissions docs
overview: Document all AI Fabrix Builder "online" (controller/dataplane) API methods with required permissions, add JSDoc permission comments in lib/api, validate docs and OpenAPI specs, and add a dedicated permissions reference in docs.
todos: []
isProject: false
---

# Document Online AI Fabrix Methods and Permissions

## Scope

- **Online methods**: CLI commands and `lib/api` functions that call **Miso Controller** or **Dataplane** APIs (require network and auth).
- **Sources of truth for permissions**:  
  - Miso Controller: [aifabrix-miso/packages/miso-controller/openapi/openapi-complete.yaml](/workspace/aifabrix-miso/packages/miso-controller/openapi/openapi-complete.yaml)  
  - Dataplane: [aifabrix-dataplane/openapi/openapi.yaml](/workspace/aifabrix-dataplane/openapi/openapi.yaml)
- **Builder API layer**: [lib/api/](lib/api/) (controller vs dataplane usage is already implied by base URL parameter names: `controllerUrl` vs `dataplaneUrl`; [credentials.api.js](lib/api/credentials.api.js) accepts either).

## 1. Validation of docs and OpenAPI specs

**Docs (where online methods are mentioned)**

- [docs/commands/README.md](docs/commands/README.md) – lists `show --online`, `app show`, deploy, login, etc.
- [docs/commands/application-management.md](docs/commands/application-management.md) – `show --online`, `app show`, `app register`, rotate; no permission requirements today.
- [docs/commands/deployment.md](docs/commands/deployment.md) – `environment deploy`, `deploy`; mentions "Insufficient permissions" but not which scopes.
- [docs/commands/authentication.md](docs/commands/authentication.md) – login, device flow, `--online` token.
- [docs/commands/external-integration.md](docs/commands/external-integration.md) – download, datasource deploy, test-integration (dataplane).
- [docs/your-own-applications.md](docs/your-own-applications.md) – login, deploy, controller URL.

**Validation tasks**

- Cross-check every documented online command against the implementation (which `lib/api` function and which endpoint it uses).
- Ensure Miso Controller spec path is valid and parseable: `/workspace/aifabrix-miso/packages/miso-controller/openapi/openapi-complete.yaml`.
- Ensure Dataplane spec path is valid and parseable: `/workspace/aifabrix-dataplane/openapi/openapi.yaml`.
- Optionally add a small script or CI step that parses both YAMLs and checks for duplicate/conflicting operationIds or missing security where expected (can be a follow-up).

## 2. Permission mapping (Builder lib/api to OpenAPI)

**Miso Controller** (base URL: controller)


| lib/api module      | Function                                  | Endpoint                                                                 | Permission (oauth2)                                                    |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| auth.api.js         | getToken                                  | POST /api/v1/auth/token                                                  | (client credentials; no scope in spec)                                 |
| auth.api.js         | getClientToken                            | GET/POST /api/v1/auth/client-token                                       | (clientCredentials or unauthenticated)                                 |
| auth.api.js         | getAuthUser                               | GET /api/v1/auth/user                                                    | auth:read                                                              |
| auth.api.js         | getAuthLogin, initiateDeviceCodeFlow, ... | /api/v1/auth/login, callback, refresh, validate, roles, permissions, ... | auth:read where applicable; login/callback public or clientCredentials |
| applications.api.js | listApplications                          | GET /api/v1/applications                                                 | applications:read                                                      |
| applications.api.js | createApplication                         | POST /api/v1/applications                                                | applications:create                                                    |
| applications.api.js | getApplication                            | GET /api/v1/applications/{appKey}                                        | applications:read                                                      |
| applications.api.js | updateApplication                         | PATCH /api/v1/applications/{appKey}                                      | applications:update                                                    |
| applications.api.js | deleteApplication                         | DELETE /api/v1/applications/{appKey}                                     | applications:delete                                                    |
| applications.api.js | registerApplication                       | POST /api/v1/environments/{envKey}/applications/register                 | environments-applications:create                                       |
| applications.api.js | rotateApplicationSecret                   | POST .../applications/{appKey}/rotate-secret                             | environments-applications:update                                       |
| applications.api.js | getApplicationStatus                      | GET .../applications/{appKey}/status                                     | (varies; bearer or app credentials)                                    |
| environments.api.js | listEnvironments                          | GET /api/v1/environments                                                 | environments:read                                                      |
| environments.api.js | createEnvironment                         | POST /api/v1/environments                                                | environments:create                                                    |
| environments.api.js | getEnvironment                            | GET /api/v1/environments/{envKey}                                        | environments:read                                                      |
| environments.api.js | updateEnvironment                         | PATCH ...                                                                | environments:update                                                    |
| environments.api.js | getEnvironmentStatus                      | GET .../status                                                           | environments:read                                                      |
| environments.api.js | listEnvironmentApplications               | GET .../applications                                                     | environments-applications:read                                         |
| environments.api.js | listEnvironmentDeployments                | GET .../deployments                                                      | deployments:read                                                       |
| environments.api.js | listEnvironmentRoles                      | GET .../roles                                                            | environments:read                                                      |
| environments.api.js | updateRoleGroups                          | PATCH .../roles/{roleValue}/groups                                       | environments:update                                                    |
| environments.api.js | getEnvironmentApplication                 | GET .../applications/{appKey}                                            | environments-applications:read                                         |
| environments.api.js | listEnvironmentDatasources                | GET .../datasources                                                      | (controller; check spec for scope)                                     |
| deployments.api.js  | deployApplication                         | POST .../applications/deploy                                             | applications:deploy                                                    |
| deployments.api.js  | deployEnvironment                         | POST .../deploy                                                          | controller:deploy                                                      |
| deployments.api.js  | listDeployments                           | GET .../deployments                                                      | deployments:read                                                       |
| deployments.api.js  | getDeployment                             | GET .../deployments/{id}                                                 | deployments:read                                                       |
| deployments.api.js  | getDeploymentLogs                         | GET .../deployments/{id}/logs                                            | deployments:read                                                       |
| deployments.api.js  | listApplicationDeployments                | GET .../applications/{appKey}/deployments                                | deployments:read                                                       |
| pipeline.api.js     | validatePipeline                          | POST /api/v1/pipeline/{envKey}/validate                                  | applications:deploy                                                    |
| pipeline.api.js     | deployPipeline                            | POST /api/v1/pipeline/{envKey}/deploy                                    | applications:deploy                                                    |
| pipeline.api.js     | getPipelineDeployment                     | GET .../deployments/{id}                                                 | applications:deploy                                                    |
| pipeline.api.js     | getPipelineHealth                         | GET .../health                                                           | (public)                                                               |


**Dataplane** (base URL: dataplane)


| lib/api module                                        | Function                                                                          | Endpoint                                               | Permission (oauth2)                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| credentials.api.js                                    | listCredentials                                                                   | GET /api/v1/credential                                 | credential:read                                                                      |
| external-systems.api.js                               | listExternalSystems                                                               | GET /api/v1/external/systems                           | external-system:read                                                                 |
| external-systems.api.js                               | createExternalSystem                                                              | POST ...                                               | external-system:create                                                               |
| external-systems.api.js                               | getExternalSystem                                                                 | GET .../systems/{id}                                   | external-system:read                                                                 |
| external-systems.api.js                               | updateExternalSystem                                                              | PUT ...                                                | external-system:update                                                               |
| external-systems.api.js                               | deleteExternalSystem                                                              | DELETE ...                                             | external-system:delete                                                               |
| external-systems.api.js                               | getExternalSystemConfig                                                           | GET .../config                                         | external-system:read                                                                 |
| external-systems.api.js                               | createExternalSystemFromTemplate                                                  | POST .../from-template                                 | (check dataplane spec)                                                               |
| external-systems.api.js                               | getOpenApiFiles, getOpenApiEndpoints                                              | GET .../openapi-files, .../openapi-endpoints           | external-system:read                                                                 |
| external-systems.api.js                               | publishExternalSystem, rollbackExternalSystem, saveExternalSystemTemplate         | POST .../publish, .../rollback, .../save-template      | (check spec; often external-system:update or publish)                                |
| pipeline.api.js                                       | publishSystemViaPipeline, publishDatasourceViaPipeline                            | POST /api/v1/pipeline/publish, .../{systemKey}/publish | oauth2: [] (authenticated)                                                           |
| pipeline.api.js                                       | testDatasourceViaPipeline                                                         | POST .../{systemKey}/{datasourceKey}/test              | oauth2: []                                                                           |
| pipeline.api.js                                       | deployExternalSystemViaPipeline, deployDatasourceViaPipeline                      | POST .../deploy, .../{systemKey}/deploy                | oauth2: []                                                                           |
| pipeline.api.js                                       | uploadApplicationViaPipeline, validateUploadViaPipeline, publishUploadViaPipeline | POST .../upload, .../upload/{id}/validate, .../publish | oauth2: []                                                                           |
| wizard.api.js                                         | (all wizard endpoints)                                                            | /api/v1/wizard/...                                     | Many use external-system:create; some may differ (check dataplane spec per endpoint) |
| datasources-core.api.js / datasources-extended.api.js | (datasource CRUD, publish, test, executions, etc.)                                | /api/v1/external/...                                   | (dataplane external datasource scopes; extract from dataplane openapi)               |


Any missing or ambiguous scope should be filled by re-reading the corresponding path in the OpenAPI files.

## 3. Comment all permissions in lib/api

- In each **lib/api** file, for every exported function that calls an online endpoint:
  - Add a **JSDoc line** (e.g. `@requiresPermission` or a single `@permission` / inline comment) stating the **service** (Controller vs Dataplane) and the **scope(s)** required (e.g. `applications:read`, `external-system:read`).
- Prefer a consistent tag so it’s grep-friendly, e.g.:
  - `@requiresPermission {Controller} applications:read`
  - `@requiresPermission {Dataplane} external-system:read`
- If the spec has no scope (e.g. client credentials only, or public), say "Client credentials" or "Public" in the comment.
- **Files to update**: [lib/api/auth.api.js](lib/api/auth.api.js), [lib/api/applications.api.js](lib/api/applications.api.js), [lib/api/environments.api.js](lib/api/environments.api.js), [lib/api/deployments.api.js](lib/api/deployments.api.js), [lib/api/pipeline.api.js](lib/api/pipeline.api.js), [lib/api/credentials.api.js](lib/api/credentials.api.js), [lib/api/external-systems.api.js](lib/api/external-systems.api.js), [lib/api/wizard.api.js](lib/api/wizard.api.js), [lib/api/datasources-core.api.js](lib/api/datasources-core.api.js), [lib/api/datasources-extended.api.js](lib/api/datasources-extended.api.js). No need to comment [lib/api/index.js](lib/api/index.js) (no direct endpoints).

## 4. Update documentation

- **New doc**: Add a **"Online commands and permissions"** (or **"API permissions reference"**) page under `docs/` (e.g. [docs/commands/permissions.md](docs/commands/permissions.md) or [docs/api-permissions.md](docs/api-permissions.md)) that:
  - Lists **CLI commands** that use online APIs (e.g. `show --online`, `app show`, `app register`, `deploy`, `environment deploy`, `login`, `credential list`, `download`, `datasource deploy`, `test-integration`, wizard-related commands).
  - For each command (or group), states which **service** (Controller / Dataplane) and which **permission(s)** are required, with a short note (e.g. "Requires login and applications:read").
  - Optionally includes a **table**: Command | Service | Permissions (and link to RBAC/roles docs if they exist).
- **Existing docs** to touch:
  - [docs/commands/README.md](docs/commands/README.md): Add a short pointer to the new permissions reference where online commands are listed.
  - [docs/commands/application-management.md](docs/commands/application-management.md): For `show --online` and `app show`, add one line each like "Requires Controller access and applications:read (or environments-applications:read for env-scoped app)."
  - [docs/commands/deployment.md](docs/commands/deployment.md): For `environment deploy` and `deploy`, add required permissions (e.g. controller:deploy, applications:deploy) and link to the new reference.
  - [docs/commands/authentication.md](docs/commands/authentication.md): Briefly note that subsequent online commands require specific scopes and point to the permissions reference.
  - [docs/commands/external-integration.md](docs/commands/external-integration.md): For download, datasource deploy, test-integration, add Dataplane permissions (e.g. external-system:read, credential:read) and link to the reference.

## 5. Implementation order

1. **Validate** – Confirm both OpenAPI files exist and are valid YAML; optionally run a quick parse in Node (e.g. `js-yaml.load`). Cross-check documented online commands in docs against actual `lib/api` usage in the codebase.
2. **Extract exact scopes** – For any Builder-used endpoint where the scope is still unclear, read the relevant path in [openapi-complete.yaml](/workspace/aifabrix-miso/packages/miso-controller/openapi/openapi-complete.yaml) and [openapi.yaml](/workspace/aifabrix-dataplane/openapi/openapi.yaml) and document the exact `security.oauth2` scope(s).
3. **Add @requiresPermission (or equivalent) comments** in all listed `lib/api` files.
4. **Add** the new permissions reference doc and **update** the existing docs as above.

## 6. Out of scope / notes

- Changing RBAC or OpenAPI specs in miso-controller or dataplane repos is out of scope; only consumption and documentation in the builder repo.
- If the workspace does not have access to `aifabrix-miso` or `aifabrix-dataplane` at plan-execution time, validation steps that read those paths should be documented as manual or run in an environment where those repos are present (e.g. in a monorepo or CI that clones them).

## Summary

- **Validate**: Docs vs implementation; both OpenAPI specs exist and are parseable.
- **Comment**: Every online API function in `lib/api` with service and permission scope.
- **Document**: New permissions reference page; update README, application-management, deployment, authentication, and external-integration docs to state required permissions and link to the reference.

---

## Implementation Validation Report

**Date:** 2025-02-09  
**Plan:** .cursor/plans/53-online_methods_permissions_docs.plan.md  
**Status:** COMPLETE

### Executive Summary

Implementation is complete. All 10 lib/api modules have @requiresPermission JSDoc comments, docs/commands/permissions.md was added, and five command docs were updated with permission notes and links. Format, lint, and tests all passed. No plan checkboxes are present (narrative plan); the four implementation-order steps are done.

### Task Completion

- Total tasks: 0 checkboxes in plan (narrative); implementation order steps: 4
- Completed: 4 (validate/align, extract scopes, add comments, add/update docs)
- Incomplete: 0
- Completion: 100%

### Incomplete Tasks

- None

### File Existence Validation

- docs/commands/permissions.md – exists (new)
- lib/api/auth.api.js – exists, contains @requiresPermission
- lib/api/applications.api.js – exists, contains @requiresPermission
- lib/api/credentials.api.js – exists, contains @requiresPermission
- lib/api/environments.api.js – exists, contains @requiresPermission
- lib/api/deployments.api.js – exists, contains @requiresPermission
- lib/api/pipeline.api.js – exists, contains @requiresPermission
- lib/api/external-systems.api.js – exists, contains @requiresPermission
- lib/api/wizard.api.js – exists, contains @requiresPermission
- lib/api/datasources-core.api.js – exists, contains @requiresPermission
- lib/api/datasources-extended.api.js – exists, contains @requiresPermission
- docs/commands/README.md – exists, links to permissions.md
- docs/commands/application-management.md – exists, permission lines and link
- docs/commands/deployment.md – exists, controller:deploy and applications:deploy + link
- docs/commands/authentication.md – exists, note + link to permissions
- docs/commands/external-integration.md – exists, permissions and link

### Test Coverage

- Unit tests: Existing tests cover lib/api usage indirectly (deploy, show, credential, wizard). No new logic; no new test file required.
- Integration tests: Not required by plan.
- Tests: All passed (npm test, exit code 0).

### Code Quality Validation

- Format: PASSED (npm run lint:fix, exit code 0)
- Lint: PASSED (0 errors, 0 warnings)
- Tests: PASSED (all tests pass)

### Cursor Rules Compliance

- Code reuse: PASSED (no duplication introduced)
- Error handling: PASSED (unchanged)
- Logging: PASSED (unchanged)
- Type safety: PASSED (JSDoc @requiresPermission added)
- Async patterns: PASSED (unchanged)
- File operations: PASSED (unchanged)
- Input validation: PASSED (unchanged)
- Module patterns: PASSED (CommonJS, exports unchanged)
- Security: PASSED (no secrets; permission docs only)

### Implementation Completeness

- Database schema: N/A
- Services: N/A
- API endpoints: COMPLETE (documented in lib/api and permissions.md)
- Schemas: N/A
- Migrations: N/A
- Documentation: COMPLETE (permissions.md + 5 doc updates)

### Issues and Recommendations

- None. Optional: add CI that parses Controller/Dataplane OpenAPI YAMLs to keep @requiresPermission in sync with spec security.

### Final Validation Checklist

- All tasks completed
- All files exist
- Tests exist and pass
- Code quality validation passes
- Cursor rules compliance verified
- Implementation complete

