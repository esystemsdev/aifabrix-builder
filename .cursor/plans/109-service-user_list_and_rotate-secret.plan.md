---
name: service-user list and rotate-secret
overview: Add `aifabrix service-user list`, `aifabrix service-user rotate-secret`, `aifabrix service-user delete`, and update subcommands (`update-groups`, `update-redirect-uris`) to the Builder CLI, backed by the existing MISO Controller service-user APIs, and update all relevant documentation.
todos: []
isProject: false
---

# Service-user list, rotate-secret, delete, and update

## Scope

- **Repository:** [aifabrix-builder](.) (CLI and API client). The Controller API is already defined in [service-user.openapi.yaml](/workspace/aifabrix-miso/packages/miso-controller/openapi/service-user.openapi.yaml) (miso repo); no changes there.
- **CLI commands:** `aifabrix service-user list`, `aifabrix service-user rotate-secret`, `aifabrix service-user delete`, `aifabrix service-user update-groups`, and `aifabrix service-user update-redirect-uris` (subcommands under existing `service-user` group).

## Rules and Standards

This plan must comply with the following rules:

- **[Architecture Patterns – API Client Structure](.cursor/rules/project-rules.mdc#api-client-structure-pattern)** – Use `lib/api/service-users.api.js` and `lib/api/types/service-users.types.js`; add `listServiceUsers` and `regenerateSecretServiceUser` with JSDoc and `@requiresPermission`; follow ApiClient get/post patterns.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – Add subcommands under existing `service-user`; input validation, chalk output, `handleCommandError`; clear error messages for 401/403/404.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Tests in `tests/lib/api/` and `tests/lib/commands/`; mock ApiClient and auth; test success and error paths; mirror source structure.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – Files ≤500 lines, functions ≤50 lines; JSDoc for all public functions.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Build (lint + test) must succeed; lint zero errors; tests 100% pass; ≥80% coverage for new code.
- **[Security & Compliance](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – No hardcoded secrets; rotate-secret output is one-time only with warning; never log secrets.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – try-catch for async; meaningful messages; chalk for errors; actionable hints (e.g. “Run aifabrix login”).
- **[Documentation Rules](.cursor/rules/docs-rules.mdc)** – User docs in `docs/commands/` are command-centric; no REST URLs or request/response shapes; describe auth and permissions in user terms.

**Key requirements:** JSDoc and `@requiresPermission` on new API functions; validate `--id` for rotate-secret, delete, update-groups, and update-redirect-uris; reuse `getServiceUserAuth` and error-handling patterns from create; document list, rotate-secret, delete, and update subcommands in application-management.md with anchors; update permissions table and summary in permissions.md; add README index links.

## Before Development

- Read CLI Command Development and API Client Structure sections from [project-rules.mdc](.cursor/rules/project-rules.mdc).
- Review existing [lib/commands/service-user.js](lib/commands/service-user.js) and [lib/cli/setup-service-user.js](lib/cli/setup-service-user.js) for auth and error patterns.
- Review [docs/commands/application-management.md](docs/commands/application-management.md) and [docs/commands/permissions.md](docs/commands/permissions.md) for doc style and permission table format.
- Confirm Controller list, regenerate-secret, delete, update-groups, and update-redirect-uris behavior from [service-user.openapi.yaml](/workspace/aifabrix-miso/packages/miso-controller/openapi/service-user.openapi.yaml) (query params, request bodies, response shapes).

## Definition of Done

Before marking this plan complete:

1. **Build:** Run `npm run build` FIRST (must complete successfully; runs lint + test:ci).
2. **Lint:** Run `npm run lint` (must pass with zero errors/warnings).
3. **Test:** Run `npm test` or `npm run test:ci` after lint (all tests pass; ≥80% coverage for new code).
4. **Validation order:** BUILD → LINT → TEST (mandatory sequence; do not skip steps).
5. **File size:** All touched files ≤500 lines; new functions ≤50 lines.
6. **JSDoc:** All new public functions have JSDoc (params, returns, `@requiresPermission` where applicable).
7. **Security:** No hardcoded secrets; rotate-secret prints secret once with one-time warning only.
8. **Docs:** application-management.md (list, rotate-secret, delete, update-groups, update-redirect-uris sections), permissions.md (table + summary), README.md (index links) updated per plan; prose command-centric; no REST details in user docs.
9. All implementation tasks (API, commands, CLI wiring, tests, docs) completed.

## API contract (Controller, from OpenAPI)


| Command                           | Controller endpoint                            | Method | Permission            |
| --------------------------------- | ---------------------------------------------- | ------ | --------------------- |
| service-user list                 | `/api/v1/service-users`                        | GET    | `service-user:read`   |
| service-user rotate-secret        | `/api/v1/service-users/{id}/regenerate-secret` | POST   | `service-user:update` |
| service-user delete               | `/api/v1/service-users/{id}`                   | DELETE | `service-user:delete` |
| service-user update-groups        | `/api/v1/service-users/{id}/groups`            | PUT    | `service-user:update` |
| service-user update-redirect-uris | `/api/v1/service-users/{id}/redirect-uris`     | PUT    | `service-user:update` |


- **List:** Query params `page`, `pageSize`, `sort`, `filter`, `search`. Response: `{ data: [{ id, username, email, clientId, active }], meta, links }`.
- **Rotate secret:** Path param `id`. Response: `{ data: { clientSecret } }` (new secret shown once).
- **Delete:** Path param `id`. Deactivates the service user. Response: `{ data: null }`.
- **Update groups:** Path param `id`, body `{ groupNames: string[] }`. Response: `{ data: { id, groupNames } }`.
- **Update redirect URIs:** Path param `id`, body `{ redirectUris: string[] }` (min 1). Response: `{ data: { id, redirectUris } }`. Controller merges in its callback URL.

## Implementation

### 1. API layer

- **[lib/api/service-users.api.js](lib/api/service-users.api.js)**  
  - Add **listServiceUsers(controllerUrl, authConfig, options)**  
    - `GET /api/v1/service-users` with `params`: `page`, `pageSize`, `sort`, `filter`, `search`.  
    - JSDoc `@requiresPermission {Controller} service-user:read`.
  - Add **regenerateSecretServiceUser(controllerUrl, authConfig, id)**  
    - `POST /api/v1/service-users/${id}/regenerate-secret` (no body).  
    - JSDoc `@requiresPermission {Controller} service-user:update`.
  - Add **deleteServiceUser(controllerUrl, authConfig, id)**  
    - `DELETE /api/v1/service-users/${id}`.  
    - JSDoc `@requiresPermission {Controller} service-user:delete`.
  - Add **updateGroupsServiceUser(controllerUrl, authConfig, id, body)**  
    - `PUT /api/v1/service-users/${id}/groups` with body `{ groupNames }`.  
    - JSDoc `@requiresPermission {Controller} service-user:update`.
  - Add **updateRedirectUrisServiceUser(controllerUrl, authConfig, id, body)**  
    - `PUT /api/v1/service-users/${id}/redirect-uris` with body `{ redirectUris }`.  
    - JSDoc `@requiresPermission {Controller} service-user:update`.
- **[lib/api/types/service-users.types.js](lib/api/types/service-users.types.js)**  
  - Add **ListServiceUsersResponse**: `data` array of `{ id, username, email, clientId, active }`, plus `meta`, `links`.  
  - Add **RegenerateSecretServiceUserResponse**: `data.clientSecret`.  
  - Add **UpdateGroupsServiceUserResponse**: `data: { id, groupNames }`.  
  - Add **UpdateRedirectUrisServiceUserResponse**: `data: { id, redirectUris }`.

### 2. Command layer

- **[lib/commands/service-user.js](lib/commands/service-user.js)**  
  - **runServiceUserList(options)**  
    - Resolve controller URL and auth (same pattern as create: `getServiceUserAuth`, `resolveControllerUrl`).  
    - Call `listServiceUsers` with `page`, `pageSize`, `sort`, `filter`, `search`.  
    - Display table: id, username, email, clientId, active (e.g. via existing table utility or simple columnar log).  
    - Handle 401/403 with messages that point to login and `service-user:read`.
  - **runServiceUserRotateSecret(options)**  
    - Require service user `id` (e.g. `--id <uuid>`).  
    - Resolve controller URL and auth.  
    - Call `regenerateSecretServiceUser(controllerUrl, authConfig, id)`.  
    - On success: print new `clientSecret` and the same one-time warning used for create (reuse `ONE_TIME_WARNING`).  
    - Handle 401/403/404 with clear messages; 403 → “Missing permission: service-user:update”.
  - **runServiceUserDelete(options)**  
    - Require `--id <uuid>`. Resolve controller URL and auth.  
    - Call `deleteServiceUser(controllerUrl, authConfig, id)`.  
    - On success: confirm service user deactivated. Handle 401/403/404; 403 → “Missing permission: service-user:delete”.
  - **runServiceUserUpdateGroups(options)**  
    - Require `--id <uuid>` and `--group-names <comma-separated>`. Resolve controller URL and auth.  
    - Call `updateGroupsServiceUser(controllerUrl, authConfig, id, { groupNames })`.  
    - On success: confirm groups updated. Handle 400/401/403/404; 403 → “Missing permission: service-user:update”.
  - **runServiceUserUpdateRedirectUris(options)**  
    - Require `--id <uuid>` and `--redirect-uris <comma-separated>` (min 1). Resolve controller URL and auth.  
    - Call `updateRedirectUrisServiceUser(controllerUrl, authConfig, id, { redirectUris })`.  
    - On success: confirm redirect URIs updated. Handle 400/401/403/404; 403 → “Missing permission: service-user:update”.

### 3. CLI wiring

- **[lib/cli/setup-service-user.js](lib/cli/setup-service-user.js)**  
  - **service-user list**  
    - Options: `--controller`, `--page`, `--page-size`, `--search`, `--sort`, `--filter`.  
    - Action: call `runServiceUserList(opts)`, use `handleCommandError` on failure.
  - **service-user rotate-secret**  
    - Options: `--controller`, `--id <uuid>` (required).  
    - Action: call `runServiceUserRotateSecret(opts)`, use `handleCommandError` on failure.
  - **service-user delete**  
    - Options: `--controller`, `--id <uuid>` (required).  
    - Action: call `runServiceUserDelete(opts)`, use `handleCommandError` on failure.
  - **service-user update-groups**  
    - Options: `--controller`, `--id <uuid>` (required), `--group-names <names>` (comma-separated, required).  
    - Action: call `runServiceUserUpdateGroups(opts)`, use `handleCommandError` on failure.
  - **service-user update-redirect-uris**  
    - Options: `--controller`, `--id <uuid>` (required), `--redirect-uris <uris>` (comma-separated, min 1, required).  
    - Action: call `runServiceUserUpdateRedirectUris(opts)`, use `handleCommandError` on failure.
  - Update the `service-user` help text to mention list, rotate-secret, delete, update-groups, and update-redirect-uris (e.g. in “after” help or description).

### 4. Tests

- **[tests/lib/api/service-users.api.test.js](tests/lib/api/service-users.api.test.js)**  
  - List: mock `ApiClient#get`, call `listServiceUsers` with params, assert URL and query params.  
  - Regenerate: mock `ApiClient#post`, call `regenerateSecretServiceUser` with id, assert path and no body.  
  - Delete: mock `ApiClient#delete` (or equivalent), call `deleteServiceUser` with id, assert path.  
  - Update groups: mock `ApiClient#put`, call `updateGroupsServiceUser` with id and body, assert path and body.  
  - Update redirect URIs: mock `ApiClient#put`, call `updateRedirectUrisServiceUser` with id and body, assert path and body.
- **[tests/lib/commands/service-user.test.js](tests/lib/commands/service-user.test.js)**  
  - List: mock auth and API, run `runServiceUserList` with various options; assert table/output and error handling (401, 403).  
  - Rotate-secret: mock auth and API, run `runServiceUserRotateSecret` with valid id; assert secret and warning in output; test 403/404 error handling.  
  - Delete: mock auth and API, run `runServiceUserDelete` with valid id; assert success message; test 403/404.  
  - Update-groups: mock auth and API, run `runServiceUserUpdateGroups` with id and group-names; assert success; test 400/403/404 and missing options.  
  - Update-redirect-uris: mock auth and API, run `runServiceUserUpdateRedirectUris` with id and redirect-uris; assert success; test 400/403/404 and missing options.

### 5. Documentation to update


| Document                                                                               | Updates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[docs/commands/application-management.md](docs/commands/application-management.md)** | Add subsections (after [aifabrix-service-user-create](docs/commands/application-management.md#aifabrix-service-user-create)): **service-user list** (usage, options, permission service-user:read, output, issues). **service-user rotate-secret** (usage with --id, permission service-user:update, one-time secret warning, issues). **service-user delete** (usage with --id, deactivates user, permission service-user:delete, issues). **service-user update-groups** (usage with --id and --group-names, permission service-user:update, issues). **service-user update-redirect-uris** (usage with --id and --redirect-uris, permission service-user:update, issues). Keep prose command-centric; no REST in user docs (per [docs-rules.mdc](.cursor/rules/docs-rules.mdc)). |
| **[docs/commands/permissions.md](docs/commands/permissions.md)**                       | In the permissions table, add rows for `service-user list` (service-user:read), `service-user rotate-secret` (service-user:update), `service-user delete` (service-user:delete), `service-user update-groups` (service-user:update), `service-user update-redirect-uris` (service-user:update). In “Controller permissions (summary)”, add **service-user:read**, **service-user:update**, and **service-user:delete** if not already present.                                                                                                                                                                                                                                                                                                                                      |
| **[docs/commands/README.md](docs/commands/README.md)**                                 | In Application & Datasource Management, add entries for `service-user list`, `service-user rotate-secret`, `service-user delete`, `service-user update-groups`, and `service-user update-redirect-uris` with short descriptions and links to application-management.md (with anchors).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |


No changes to the OpenAPI spec in the builder (the spec lives in aifabrix-miso). No new doc files required unless you later add a dedicated “service-user” page; for this scope, application-management + permissions + README are sufficient.

## Flow (high level)

```mermaid
flowchart LR
  subgraph cli [CLI]
    List[service-user list]
    Rotate[service-user rotate-secret]
    Delete[service-user delete]
    UpdateGroups[service-user update-groups]
    UpdateUris[service-user update-redirect-uris]
  end
  subgraph commands [Commands]
    RunList[runServiceUserList]
    RunRotate[runServiceUserRotateSecret]
    RunDelete[runServiceUserDelete]
    RunGroups[runServiceUserUpdateGroups]
    RunUris[runServiceUserUpdateRedirectUris]
  end
  subgraph api [API]
    ListAPI[listServiceUsers]
    RegenAPI[regenerateSecretServiceUser]
    DeleteAPI[deleteServiceUser]
    GroupsAPI[updateGroupsServiceUser]
    UrisAPI[updateRedirectUrisServiceUser]
  end
  subgraph controller [Controller]
    GET[GET /service-users]
    POST[POST regenerate-secret]
    DEL[DELETE /service-users/id]
    PUTGroups[PUT groups]
    PUTUris[PUT redirect-uris]
  end
  List --> RunList --> ListAPI --> GET
  Rotate --> RunRotate --> RegenAPI --> POST
  Delete --> RunDelete --> DeleteAPI --> DEL
  UpdateGroups --> RunGroups --> GroupsAPI --> PUTGroups
  UpdateUris --> RunUris --> UrisAPI --> PUTUris
```



## Validation checklist

- `list`, `rotate-secret`, `delete`, `update-groups`, and `update-redirect-uris` subcommands appear under `aifabrix service-user --help`.
- List supports pagination and search; rotate-secret requires `--id` and prints secret once with warning; delete and update subcommands require `--id` (and update require their payload options).
- Permissions: list → service-user:read; rotate-secret, update-groups, update-redirect-uris → service-user:update; delete → service-user:delete.
- Docs: application-management.md (all five subcommands), permissions.md (table + summary), README.md (index links).
- Run `npm run build` (then lint and tests pass); new API and command tests added; ≥80% coverage for new code.

---

## Plan Validation Report

**Date:** 2025-03-14  
**Plan:** .cursor/plans/109-service-user_list_and_rotate-secret.plan.md  
**Status:** VALIDATED

### Plan Purpose

Add CLI subcommands under `aifabrix service-user`: **list**, **rotate-secret**, **delete**, **update-groups**, and **update-redirect-uris**. Implementation is in aifabrix-builder (API client + commands + CLI wiring + tests + docs); Controller API is already defined in aifabrix-miso. **Type:** Development (CLI commands, API client, tests, documentation).

### Applicable Rules

- **Architecture Patterns – API Client Structure** – New API functions and types in `lib/api/`; `@requiresPermission` and JSDoc.
- **CLI Command Development** – Subcommands, validation, chalk, error handling.
- **Testing Conventions** – Jest, mocks, API and command tests, 80%+ coverage.
- **Code Quality Standards** – File/function size limits, JSDoc.
- **Quality Gates** – Build, lint, test, coverage (mandatory).
- **Security & Compliance** – No hardcoded secrets; one-time secret handling.
- **Error Handling & Logging** – try-catch, chalk, actionable messages.
- **Documentation Rules** – Command-centric user docs; no REST in docs.

### Rule Compliance

- DoD requirements: Documented (build first, lint, test, order, file size, JSDoc, security, docs).
- All applicable rule sections referenced in Rules and Standards.
- Before Development and Definition of Done sections added.

### Plan Updates Made

- Added **Rules and Standards** with links to project-rules.mdc and docs-rules.mdc and key requirements.
- Added **Before Development** checklist (read rules, review existing service-user code and docs, confirm OpenAPI).
- Added **Definition of Done** (build → lint → test order, file size, JSDoc, security, docs, task completion).
- Updated Validation checklist to reference `npm run build` and coverage.
- Appended this validation report.

### Recommendations

- When implementing rotate-secret, ensure the printed secret is never logged or written to disk beyond the single CLI output.
- Reuse the same table or columnar display pattern used by other list commands (e.g. credential list, app list) for service-user list output.
- For delete, consider a confirmation prompt (e.g. “Deactivate service user ? (y/N)”) if desired; plan currently assumes non-interactive unless you add it.

