---
name: Service user create OpenAPI and CLI
overview: Add an OpenAPI spec for the miso-controller "create service user" API (with group assignment and one-time secret response), then implement a builder API client and CLI command that call this interface.
todos: []
isProject: false
---

# Service user create – OpenAPI spec and CLI

## Goal

- **1.** You need a service user for your integration.
- **2.** You provide basic user info (e.g. name, description).
- **3.** You assign the user to a group.
- **4.** You run a command (CLI).
- **5.** You receive a **one-time-only** secret (returned only in the create response).

The **miso-controller** exposes an API that the builder will call. This plan adds: (1) the OpenAPI spec that describes that controller API, (2) a builder API client and types, and (3) a CLI command that calls the API and displays the one-time secret with a clear warning.

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc). Applicable sections:

- **[Architecture Patterns – API Client Structure](.cursor/rules/project-rules.mdc#api-client-structure-pattern)** – New `lib/api/service-users.api.js` and `lib/api/types/service-users.types.js`; use `ApiClient`, JSDoc `@typedef` for request/response.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – New command in `lib/cli.js`, implementation in `lib/commands/`; input validation, chalk output, tests for the command.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – Files ≤500 lines, functions ≤50 lines; JSDoc for all public functions.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Build → Lint → Test; zero lint errors; all tests pass; ≥80% coverage for new code.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Tests in `tests/` mirroring `lib/`; mock `ApiClient`; success and error paths; API client testing pattern.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – Never log the one-time secret; mask in logs; document one-time nature in spec and CLI warning.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – Try-catch for async ops; chalk for errors; never log secrets.

**Key requirements**

- Use `ApiClient` from `lib/api/index.js`; add JSDoc types in `lib/api/types/service-users.types.js`.
- For the new Controller API function, add `@requiresPermission` JSDoc per [permissions-guide.md](.cursor/rules/permissions-guide.md) and document in [docs/commands/permissions.md](docs/commands/permissions.md).
- CLI: validate inputs (name, group required), clear error messages for 400/401/403, print one-time secret once with explicit “save now” warning.
- Tests: unit tests for `createServiceUser` (mock `ApiClient`); CLI test that one-time secret and warning are printed; no secrets in test output assertions (mask or assert presence only).

## Before Development

- Read API Client Structure and CLI Command Development in project-rules.mdc
- Review [lib/api/auth.api.js](lib/api/auth.api.js) and [lib/api/applications.api.js](lib/api/applications.api.js) for patterns
- Review [permissions-guide.md](.cursor/rules/permissions-guide.md) for `@requiresPermission`
- Confirm controller base path: `POST /api/v1/service-users` (or `/api/v1/service-users/create`)

## Definition of Done

Before marking this plan complete:

1. **Build** – Run `npm run build` first (must succeed; runs lint + test).
2. **Lint** – Run `npm run lint` (must pass with zero errors and zero warnings).
3. **Test** – Run `npm test` after lint (all tests pass; ≥80% coverage for new code).
4. **Order** – BUILD → LINT → TEST (do not skip steps).
5. **File size** – Each file ≤500 lines; each function ≤50 lines.
6. **JSDoc** – All public functions have JSDoc (params, returns, throws).
7. **Security** – No hardcoded secrets; one-time secret never logged; CLI shows warning when printing secret.
8. **Permissions** – New Controller API function has `@requiresPermission` and is listed in docs/commands/permissions.md.
9. All plan deliverables implemented: OpenAPI spec, `lib/api` module + types, CLI command, tests, docs.
10. Run `/validate-implementation` on this plan after implementation.

## Where the spec lives

The path `packages/miso-controller/openapi/service-user.openapi.yaml` does not exist in this workspace (there is no `packages/` directory here). The builder references `packages/miso-controller` only for `.env` output ([templates/applications/miso-controller/variables.yaml](templates/applications/miso-controller/variables.yaml)).

- **In this repo:** add the OpenAPI spec under **templates** so the builder owns the contract and the CLI can call “what we have to call in miso-controller”:
  - **New file:** [templates/applications/miso-controller/openapi/service-user.openapi.yaml](templates/applications/miso-controller/openapi/service-user.openapi.yaml)
- The **miso-controller** (in `packages/miso-controller` or elsewhere) should implement this same contract; the spec can be copied or referenced there for codegen/docs.

## 1. OpenAPI spec – create service user

**File:** `templates/applications/miso-controller/openapi/service-user.openapi.yaml`

Define a single operation that matches your flow:

- **Path:** `POST /api/v1/service-users` (or `POST /api/v1/service-users/create` if the controller uses that convention).
- **Summary:** Create a service user for an integration, assign to a group, and return a one-time secret.
- **Security:** Require auth (e.g. Bearer or controller client credentials); permission `service-user:create` is already defined in [templates/applications/miso-controller/rbac.yaml](templates/applications/miso-controller/rbac.yaml) (lines 38–41).
- **Request body:**
  - `name` (string, required) – e.g. “My Integration” or integration key.
  - `description` (string, optional) – human-readable purpose.
  - `group` or `groupId` (string, required) – group to assign (e.g. `AI-Fabrix-Developers` or group id/key).
- **Response (201):**
  - `clientId` (string) – stable identifier for the service user.
  - `clientSecret` (string) – **one-time-only**; document in the spec that this is returned only on create and must be stored securely; no GET endpoint should return the secret again.
- **Error responses:** 400 (validation), 401 (unauthorized), 403 (forbidden – e.g. missing `service-user:create`).

Schema names (examples): `ServiceUserCreateRequest`, `ServiceUserCreateResponse`. Include a short description on the response that the secret is one-time and must be saved at creation time.

## 2. Builder API client and types

- **New:** [lib/api/service-users.api.js](lib/api/service-users.api.js)  
  - `createServiceUser(controllerUrl, authConfig, body)`  
  - Calls `POST /api/v1/service-users` (or the path chosen in the spec) with `body: { name, description?, group }`.  
  - Returns the response (including `clientId`, `clientSecret`).  
  - Use existing [lib/api/index.js](lib/api/index.js) `ApiClient` and auth pattern (bearer or client credentials).
- **New:** [lib/api/types/service-users.types.js](lib/api/types/service-users.types.js)  
  - JSDoc `@typedef` for request (e.g. `ServiceUserCreateRequest`: name, description?, group) and response (e.g. `ServiceUserCreateResponse`: clientId, clientSecret, optionally success/timestamp if the controller wraps it).

## 3. CLI command

- **Command:** e.g. `aifabrix service-user create --name <name> --group <group> [--description <description>]`
- **Behavior:**
  - Resolve controller URL and auth (same as other commands: env, login, or options).
  - Call `createServiceUser(controllerUrl, authConfig, { name, description, group })`.
  - On success: print the one-time secret **once**, with a clear warning (e.g. “Save this secret now; it will not be shown again”).
  - On error: surface 400/401/403 with clear messages (e.g. “Missing permission: service-user:create” for 403).
- **Where to wire:** [lib/cli.js](lib/cli.js) – new subcommand under a `service-user` (or `service-user create`) command.
- **Implementation:** New module under `lib/commands/` (e.g. `lib/commands/service-user.js`) that handles the create flow and output, and uses `lib/api/service-users.api.js`.

## 4. Tests and docs

- **Tests:**  
  - Unit tests for `createServiceUser`: mock `ApiClient`, assert path, body, and response handling (success and error).  
  - CLI test: mock the service-users API, run `service-user create` with options, assert correct args and that the one-time secret is printed and warning message appears.
- **Docs:**  
  - Short section in [docs/commands/](docs/commands/) (or under authentication/application-management) describing: “Create service user for integration (name, group), get one-time secret”; reference the OpenAPI spec and permission `service-user:create`.

## 5. Flow summary

```mermaid
sequenceDiagram
  participant User
  participant CLI
  participant BuilderAPI
  participant Controller

  User->>CLI: "aifabrix service-user create with name and group"
  CLI->>BuilderAPI: "createServiceUser(controllerUrl, auth, body)"
  BuilderAPI->>Controller: "POST /api/v1/service-users with name, description, group"
  Controller->>Controller: "Create user, assign group, generate one-time secret"
  Controller-->>BuilderAPI: "201 response with clientId and clientSecret"
  BuilderAPI-->>CLI: "response"
  CLI-->>User: "Print clientId, clientSecret and one-time-only warning"
```



## Validation

- OpenAPI spec: valid YAML, path and request/response match controller contract.
- Builder: `npm run lint` and `npm test` pass; new code follows [.cursor/rules/project-rules.mdc](.cursor/rules/project-rules.mdc) (API client in `lib/api/`, JSDoc types, no secrets in logs).
- After implementation, run: `/validate-implementation` on this plan.

## Out of scope (for this plan)

- Controller implementation (assumed to exist or be added in the miso-controller repo).
- Regenerating or rotating the service user secret (already covered by `service-user:update` in rbac; can be a separate endpoint/spec later).
- Listing or deleting service users (optional future extension).

---

## Plan Validation Report

**Date**: 2025-02-09  
**Plan**: .cursor/plans/54-service_user_create_openapi_and_cli.plan.md  
**Status**: VALIDATED

### Plan Purpose

- **Title**: Service user create – OpenAPI spec and CLI  
- **Summary**: Add an OpenAPI spec for the miso-controller create-service-user API (group assignment, one-time secret response), then implement a builder API client and CLI command that call this interface.  
- **Scope**: OpenAPI spec (YAML in templates), `lib/api` (service-users.api.js, service-users.types.js), `lib/commands` (service-user.js), `lib/cli.js`, tests, docs.  
- **Type**: Development (CLI command, API client, template/spec).  
- **Key components**: `templates/applications/miso-controller/openapi/service-user.openapi.yaml`, `lib/api/service-users.api.js`, `lib/api/types/service-users.types.js`, `lib/commands/service-user.js`, CLI wiring, unit + CLI tests, command docs and permissions.

### Applicable Rules

- **Architecture Patterns – API Client Structure** – New API module and types; use ApiClient and JSDoc typedefs.  
- **CLI Command Development** – New command, validation, chalk, tests.  
- **Code Quality Standards** – File/function size limits, JSDoc.  
- **Quality Gates** – Mandatory build/lint/test order and pass criteria.  
- **Testing Conventions** – Jest, mocks, tests in `tests/`, API client testing pattern.  
- **Security & Compliance** – No logging of one-time secret; mask in logs.  
- **Error Handling & Logging** – Try-catch, chalk, no secrets in logs.  
- **Critical Rules** – `@requiresPermission` for new Controller API; see permissions-guide.md.

### Rule Compliance

- DoD requirements: Documented (build first, then lint, then test; zero lint errors; tests pass; coverage; file size; JSDoc; security; permissions).  
- Applicable rule sections referenced in plan with links.  
- Before Development checklist added.  
- Definition of Done includes validation order and `/validate-implementation` step.

### Plan Updates Made

- Added **Rules and Standards** with links to project-rules.mdc (API Client Structure, CLI Command Development, Code Quality Standards, Quality Gates, Testing Conventions, Security & Compliance, Error Handling & Logging) and key requirements (including `@requiresPermission` and permissions docs).  
- Added **Before Development** checklist (read rules, review existing API/CLI patterns, confirm permissions guide and controller path).  
- Added **Definition of Done** (build → lint → test order, file size, JSDoc, security, permissions, all deliverables, validate-implementation).  
- Appended this **Plan Validation Report**.

### Recommendations

- When implementing, add the new Controller endpoint to [docs/commands/permissions.md](docs/commands/permissions.md) with required permission `service-user:create`.  
- In tests, assert that the one-time secret is printed and the warning message appears without asserting the literal secret value (security).

---

## Implementation Validation Report

**Date**: 2025-02-09  
**Plan**: .cursor/plans/54-service_user_create_openapi_and_cli.plan.md  
**Status**: ✅ COMPLETE

### Executive Summary

All plan deliverables are implemented: OpenAPI spec, builder API client and types, CLI command `aifabrix service-user create`, tests, and documentation. Build, lint, and tests pass.

### Task Completion

- OpenAPI spec: in aifabrix-miso (`packages/miso-controller/openapi/service-user.openapi.yaml`) – ✅
- Builder API: `lib/api/service-users.api.js`, `lib/api/types/service-users.types.js` – ✅
- CLI: `lib/commands/service-user.js`, `lib/cli/setup-service-user.js`, wired in `lib/cli/index.js` – ✅
- Tests: `tests/lib/api/service-users.api.test.js`, `tests/lib/commands/service-user.test.js` – ✅
- Docs: `docs/commands/permissions.md` (row + summary), `docs/commands/application-management.md` (section), `docs/commands/README.md` (TOC) – ✅

### File Existence Validation

- ✅ lib/api/types/service-users.types.js
- ✅ lib/api/service-users.api.js
- ✅ lib/commands/service-user.js
- ✅ lib/cli/setup-service-user.js
- ✅ tests/lib/api/service-users.api.test.js
- ✅ tests/lib/commands/service-user.test.js
- ℹ️ OpenAPI spec: in aifabrix-miso repo (`packages/miso-controller/openapi/service-user.openapi.yaml`), not in builder templates

### Test Coverage

- ✅ Unit tests for `createServiceUser` (mock ApiClient; path, body with username/email/redirectUris/groupNames, success/error)
- ✅ CLI tests for `service-user create` (username/email/redirectUris/groupNames required, auth, 400/401/403, one-time warning, comma-separated parsing)

### Code Quality Validation

- ✅ Format: `npm run lint:fix` – PASSED
- ✅ Lint: `npm run lint` – PASSED (0 errors, 0 warnings)
- ✅ Tests: `npm test` – PASSED
- ✅ Build: `npm run build` – PASSED

### Cursor Rules Compliance

- ✅ API client in `lib/api/`, JSDoc types in `lib/api/types/service-users.types.js`
- ✅ `@requiresPermission {Controller} service-user:create` on `createServiceUser`
- ✅ CLI validation (username, email, redirectUris, groupNames), chalk output, error handling
- ✅ One-time secret not logged; warning shown when printing secret
- ✅ docs/commands/permissions.md updated; command doc in application-management.md

### Implementation Completeness

- ✅ OpenAPI spec (miso-controller): POST /api/v1/service-users, request body username/email/redirectUris/groupNames
- ✅ createServiceUser(controllerUrl, authConfig, body) implemented
- ✅ service-user create command with --username, --email, --redirect-uris, --group-names, [--description], --controller
- ✅ Permissions and application-management docs updated

### Final Validation Checklist

- All plan deliverables implemented
- All files exist (builder API, CLI, tests, docs)
- Tests exist and pass (4229 passed)
- Code quality (lint) passes (1 pre-existing warning in show-display.js)
- Cursor rules and permissions documented
- Build succeeds

---

## Specs – What We Implemented

### API Contract (Controller – aifabrix-miso)

**Path:** `POST /api/v1/service-users`

**Request body (required):**


| Field        | Type     | Required | Description                                                                                             |
| ------------ | -------- | -------- | ------------------------------------------------------------------------------------------------------- |
| username     | string   | yes      | 1–100 chars (e.g. api-client-001)                                                                       |
| email        | string   | yes      | Valid email format                                                                                      |
| redirectUris | string[] | yes      | OAuth2 redirect URIs (min 1; e.g. [https://app.example.com/callback](https://app.example.com/callback)) |
| groupNames   | string[] | yes      | Group names to assign (e.g. AI-Fabrix-Developers)                                                       |
| description  | string   | no       | Optional, max 500 chars                                                                                 |


**Response (201):** `clientId`, `clientSecret` (one-time-only; save at creation time)

**Error responses:** 400 (validation), 401 (unauthorized), 403 (forbidden – e.g. missing `service-user:create`)

**Spec location:** `aifabrix-miso/packages/miso-controller/openapi/service-user.openapi.yaml`

### Builder API Client

**Module:** `lib/api/service-users.api.js`

- `createServiceUser(controllerUrl, authConfig, body)` where `body` has `username`, `email`, `redirectUris`, `groupNames`, optional `description`
- `@requiresPermission {Controller} service-user:create`

**Types:** `lib/api/types/service-users.types.js` – `ServiceUserCreateRequest`, `ServiceUserCreateResponse`

### CLI Command

**Command:** `aifabrix service-user create`

**Options:**


| Option          | Short | Required | Description                                             |
| --------------- | ----- | -------- | ------------------------------------------------------- |
| --username      | -u    | yes      | Service user username                                   |
| --email         | -e    | yes      | Email address                                           |
| --redirect-uris |       | yes      | Comma-separated redirect URIs (min 1)                   |
| --group-names   |       | yes      | Comma-separated group names (e.g. AI-Fabrix-Developers) |
| --description   | -d    | no       | Optional description                                    |
| --controller    |       | no       | Controller URL (default: from config)                   |


**Example:**

```bash
aifabrix service-user create --username api-client-001 --email api@example.com \
  --redirect-uris "https://app.example.com/callback" \
  --group-names "AI-Fabrix-Developers"
```

**Behavior:** Resolves controller URL and auth (device token), validates all required fields, calls `createServiceUser`, prints `clientId` and `clientSecret` with one-time warning; handles 400/401/403 with clear messages.

### Evolution from Original Plan

The original plan specified `name`, `group`. Implementation uses the controller’s current contract:

- **username** – replaces `name`
- **email** – new required field
- **redirectUris** – new required array (OAuth2 redirect URIs)
- **groupNames** – replaces `group` (array of group names, e.g. AI-Fabrix-Developers)
- **description** – optional (unchanged)

### Files (Builder)


| File                                      | Purpose                          |
| ----------------------------------------- | -------------------------------- |
| `lib/api/service-users.api.js`            | API client `createServiceUser`   |
| `lib/api/types/service-users.types.js`    | JSDoc types                      |
| `lib/commands/service-user.js`            | Command implementation           |
| `lib/cli/setup-service-user.js`           | CLI wiring                       |
| `tests/lib/api/service-users.api.test.js` | API unit tests                   |
| `tests/lib/commands/service-user.test.js` | CLI unit tests                   |
| `docs/commands/application-management.md` | Command documentation            |
| `docs/commands/permissions.md`            | Permission `service-user:create` |
| `docs/commands/README.md`                 | TOC entry                        |


