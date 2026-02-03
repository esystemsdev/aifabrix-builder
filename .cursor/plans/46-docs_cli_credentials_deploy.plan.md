---
name: Docs CLI Credentials Deploy
overview: Plan to improve documentation (prerequisites, install paths, disk space, back links, environment-first-time, deploying flow/prereqs/rollback), add credential list and wizard credential selection via API, fix/improve deployment list and deploy --tag commands, ensure deployment key is computed from minimal/canonical manifest JSON, and add a controller-side implementation section.
todos: []
isProject: false
---

# Documentation, Credentials, Deployment Commands and Controller Plan

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Mandatory checks before commit: build, lint, test, coverage ≥80%, no hardcoded secrets.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – Files ≤500 lines, functions ≤50 lines, JSDoc for all public functions.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – New commands (`credential list`, `deployment list`, `app deployment`) follow Commander.js pattern, input validation, chalk output, tests.
- **[API Client Structure Pattern](.cursor/rules/project-rules.mdc#api-client-structure-pattern)** – Use `lib/api/` for credential and deployment list; add types in `lib/api/types/` if new APIs.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Tests in `tests/`, Jest, mock API client, 80%+ coverage for new code.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – No secrets in code or logs; document security decisions (deployment key, controller behavior).
- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** – Schema validation for environment deploy config; deployment key from canonical JSON.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – try/catch for async, meaningful errors, chalk, no sensitive data in messages.

**Key requirements:** Use `lib/api/deployments.api.js` for list deployments; add credential API in `lib/api/` (or wizard.api) for list credentials; JSDoc for all new functions; tests for new CLI commands and modules; BUILD → LINT → TEST before considering work complete.

## Before Development

- Read CLI Command Development and Quality Gates from project-rules.mdc.
- Review existing commands in `lib/cli/` and API modules in `lib/api/` for patterns.
- Confirm credential list backend: controller `GET /api/v1/credential` vs dataplane (and auth: device vs client).
- Confirm deployment list API contract: `GET /api/v1/environments/{envKey}/deployments` params (page, pageSize, filter by app).

## Definition of Done

Before marking this plan complete:

1. **Build**: Run `npm run build` first (must succeed; runs lint + test:ci).
2. **Lint**: Run `npm run lint` (zero errors/warnings).
3. **Test**: Run `npm test` or `npm run test:ci` after lint (all tests pass; ≥80% coverage for new code).
4. **Validation order**: BUILD → LINT → TEST (do not skip).
5. **File size**: New/edited files ≤500 lines, functions ≤50 lines.
6. **JSDoc**: All new public functions have JSDoc (params, returns, throws).
7. **Security**: No hardcoded secrets; credential/deployment list do not log tokens or secrets.
8. **Docs**: All doc changes applied (prerequisites, back links, wizard, environment-first-time, deploying, controller section).
9. **CLI**: New commands implemented and documented (`credential list`, `deployment list`, `app deployment` as specified).
10. All plan tasks (sections 1–10) addressed.

## Scope summary

- **Documentation**: Prerequisites (Node.js, Azure/Docker install, secrets before up-platform, first-time token), wizard example (manual setup), infrastructure vs Azure marketplace, disk space, back links to docs/README.md, environment-first-time (full params + why/where), deploying (manifest naming, flow, prereqs, rollback, version vs deployment key, commands), and controller-side section.
- **Credentials**: Expose wizard credential list (dataplane `GET /api/v1/wizard/credentials`) and add `aifabrix credential list` calling controller/dataplane `GET /api/v1/credential`; document intent parameter for AI manifest generation per [.cursor/plans/credentials.md](.cursor/plans/credentials.md).
- **Deployment**: Fix/improve `aifabrix deployment list` and `aifabrix app deployment <appKey>` (use `GET /api/v1/environments/{envKey}/deployments and /api/v1/environments/{envKey}/applications/{appKey}/deployments`), improve `aifabrix deploy <appKey> --version`(newest version when multiple), ensure deployment key is derived from canonical manifest JSON (no whitespace/format variance). Value should be set in manifest

---

## 1. Prerequisites and setup documentation

**Node.js and runtime**

- In [README.md](README.md) and/or [docs/README.md](docs/README.md), add a short “Prerequisites” that includes: Node.js (recommended version, e.g. 18+), and for AI Fabrix Azure: installation from **Azure Marketplace** or **Docker**, with **full access to Docker** (docker commands) where applicable.

**Secrets before up-platform**

- Document that **secrets must be added before `up-platform**` (e.g. OpenAI or Azure OpenAI in the place the platform reads from). Point to existing secrets docs.

**First-time token without login**

- Document the current behavior: platform asks for login (admin / admin123) after Keycloak and Miso-Controller. If the controller supports **creating a token without interactive login (first time only)** (e.g. bootstrap token or admin API), document that option and the exact steps; otherwise add a short “Controller-side: first-time token” item in the controller section below.

---

## 2. Goal 2 – Wizard example (manual setup)

- In docs (e.g. [docs/wizard.md](docs/wizard.md) or a dedicated “Wizard example” subsection), add **one** clear **manual-setup** wizard example that follows: get your system’s OpenAPI specs → create authentication credentials → run wizard → test your manifest → deploy in dataplane. Keep it as a single linear example (link or inline), not multiple flows.

---

## 3. Infrastructure and install path

**Infrastructure doc**

- [docs/infrastructure.md](docs/infrastructure.md): Rename or clarify the “Install Miso-Controller (Azure Deployment)” subsection so it is explicit:
  - **Docker (local)**: steps under that section are for **Docker/local** install (create, build, run).
  - **Azure**: installation is via **Azure Marketplace** first; reference that and optionally link to marketplace or a separate “Azure install” doc.
- **Disk space**: Add a short “Disk space” note (e.g. “Roughly 10–15 GB for all platform images; exact size depends on images used”). Where possible, suggest validating image sizes from the system (e.g. `docker images` or registry) and document that.

---

## 4. Back links in docs

- Replace **“Back to Your Own Applications”** links that point to `your-own-applications.md` with **“Back to Documentation”** (or similar) linking to **[docs/README.md](docs/README.md)** for all pages that currently use that back link (grep found 26 files; update the back link in each so the primary “back” is docs index, not your-own-applications).

---

## 5. Wizard: credential list and intent

**Step 3 – credential selection**

- Document that the wizard can **list** credentials for selection:
  - **Dataplane**: `GET /api/v1/wizard/credentials` (optional query e.g. `activeOnly`). Document in [docs/wizard.md](docs/wizard.md) (e.g. in “Step 3: Credential Selection” and in the Dataplane Wizard API table).
- **CLI**: Add command `**aifabrix credential list**` that calls `**GET /api/v1/credential**` (dataplane where credentials live). Implement in `lib/` (new or existing credential module), wire in CLI, and document in wizard and CLI reference.
- **Intent**: In [docs/wizard.md](docs/wizard.md), expand the **intent** parameter description: it helps AI generate a better integration manifest; users can describe their needs and special integration requirements. Reference [.cursor/plans/credentials.md](.cursor/plans/credentials.md) for API shapes (list credentials, etc.).

---

## 6. Environment deploy (first time)

- [docs/deployment/environment-first-time.md](docs/deployment/environment-first-time.md):
  - **Why and where**: Add a short “Why” and “Where you deploy” (local vs Azure, and that Azure requires Marketplace install first).
  - **All parameters**: Document **all** supported parameters for the environment deploy request by referencing [lib/schema/environment-deploy-request.schema.json](lib/schema/environment-deploy-request.schema.json) (and optionally [lib/schema/infrastructure-schema.json](lib/schema/infrastructure-schema.json) for full Azure/infra semantics). Clarify that **local Docker** can use a **minimal** config file; point to [templates/infra/environment-dev.json](templates/infra/environment-dev.json) as the minimal example and note that Azure deploy may require more fields (subscriptionId, tenantId, deploymentType, etc. from infrastructure-schema).

---

## 7. Deploying doc – fixes and clarifications

**Manifest naming**

- State clearly: deployment manifest is `**<appKey>-deploy.json**` (for apps: `builder/<app>/<appKey>-deploy.json`; for external: `integration/<app>/<systemKey>-deploy.json`). Remove or replace references to “aifabrix-deploy.json” as the primary name in prose; deletre code/tests that not support legacy `aifabrix-deploy.json`- no backward compatibility.
- **Manifest content**: Document that the deployment manifest **includes** external system and data sources (for external type) so nothing is “missing” in the doc.

**Copy and flow**

- Fix any “Azure Marketplaceor” → “Azure Marketplace or” and ensure “Deploy your application via Azure Marketplace or Miso Controller” is correct.
- **Flow – why**: Add a short “Why” for the pipeline: same pipeline and orchestration to promote app or external system from dev to production; full audit trail and rollback; aligned with ISO 27k.

**Prerequisites**

- **Register**: Clarify that **register is for applications only**, not integrations (external systems). For integrations, recommend deploying via Miso-Controller and avoid extra config.
- **CI/CD**: Clarify that **secrets are per environment for security**, not for complexity. If deploying an integration with your own app, use rotate-secret and register like a normal app per environment. **Recommended**: deploy integration via Miso-Controller; use CI/CD only when the integration is fully integrated with your app.

**Deployment target**

- Describe deployment target only (Azure Container Apps vs local Docker); remove or soften **open-source vs enterprise** split in the “Deployment target” wording so it’s target-focused.

**Deploy environment (first time)**

- State that **“Deploy Environment (First Time)” should be validated** (e.g. environment exists, config valid); reference environment-first-time doc and schema.

**Rollback**

- Document: `aifabrix rollack my-app --deploymentId <deploymentId>` (or the actual CLI flag used) for rollback.
- **Version vs deployment**: Clarify:
  - **Deployment**: immutable; uniquely identified by **deployment Id.**
- Add a **small table**: “When to change version number” (e.g. breaking change → major; new feature → minor; fix → patch) as best practice.

---

## 8. Deployment commands

**List commands**

- `**aifabrix deployment list**`: Implement (or fix) to list last N (e.g. 50) deployments for the current environment using `**GET /api/v1/environments/{envKey}/deployments**`. Document in CLI reference and deploying.md. Decide and document whether more info is needed (e.g. filters, pagination - you can find parameter for filter and sort [.cursor/plans/credentials.md](.cursor/plans/credentials.md)).
- `**aifabrix app deployment <appKey>**`: Implement (or fix) to list last N (e.g. 50) deployments **for that app** in the environment. If the controller exposes an app-scoped list (e.g. by appKey), use it; otherwise filter client-side from environment deployments and document. API - /api/v1/environments/{envKey}/applications/{appKey}/deployments:

**Deploy with version**

- `info here`

---

## 9. Deployment key and manifest validation

- **Key from manifest**: Deployment key must be **fully validated** against the deployment manifest JSON. In code, the key is already computed from the **manifest object** (not raw file) in [lib/core/key-generator.js](lib/core/key-generator.js) via `generateDeploymentKeyFromJson` (sorted keys, no whitespace). Ensure:
  - **Canonical form**: All call paths that send the manifest to the controller use the **same** canonical JSON (e.g. same sort + no whitespace) before hashing, so that **whitespace or line breaks** in the file do **not** create a different key.
- **Doc**: In deploying.md, state that the deployment key is derived from the **canonical** deployment manifest JSON (minimal format, no formatting variance) and that the controller validates the key against the same canonical form.

---

## 10. Application version in variables.yaml and deployment JSON

Add an application **version** field so the deployment manifest and variables carry a semantic version (e.g. for rollback semantics and “when to change version” best practice). Aligns with controller rollback: [aifabrix-miso plan 137](.cursor/plans/137-deployment_refactor_and_rollback.plan.md) uses deployment id and `uploadedConfig` for rollback; version in the manifest is the application’s logical version (tag).

**Requirements**

- **variables.yaml** – Under `app:`, add optional `version`. Example: [builder/dataplane/variables.yaml](builder/dataplane/variables.yaml) add `version: "1.0.0"` (or leave empty for auto default).
- **Default when empty** – If `app.version` is missing or empty string, use **"1.0.0"** in:
  - The generated deployment JSON (manifest sent to controller).
  - Any code path that writes or normalizes variables.yaml (e.g. app create, wizard) so the file can store `version: "1.0.0"` when the user did not set one.
- **Deployment manifest (JSON)** – Include top-level `version` in the manifest; value = `variables.app?.version` normalized (empty/missing → `"1.0.0"`).
- **Schema** – Add optional `version` (string, e.g. semantic version pattern) to [lib/schema/application-schema.json](lib/schema/application-schema.json) deployment manifest properties.

**Implementation touchpoints**


| Area                       | File / change                                                                                                                                                                                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| variables.yaml (dataplane) | [builder/dataplane/variables.yaml](builder/dataplane/variables.yaml) – add `app.version: "1.0.0"` (or empty; code defaults to 1.0.0).                                                                                                                                                              |
| Manifest from variables    | [lib/generator/builders.js](lib/generator/builders.js) – in `buildAppMetadata()` add `version: (variables.app?.version && String(variables.app.version).trim()) ? String(variables.app.version).trim() : '1.0.0'`; ensure `buildBaseDeployment` passes it so the manifest has top-level `version`. |
| New app variables          | [lib/core/templates.js](lib/core/templates.js) – in `buildWebappVariables()` add `version: config.version                                                                                                                                                                                          |
| Wizard variables           | [lib/generator/wizard.js](lib/generator/wizard.js) – in `generateOrUpdateVariablesYaml` when setting `variables.app`, add `version: variables.app?.version                                                                                                                                         |
| Split JSON → variables     | [lib/generator/split.js](lib/generator/split.js) – in `extractAppSection()` add `if (deployment.version) app.version = deployment.version;`.                                                                                                                                                       |
| Schema                     | [lib/schema/application-schema.json](lib/schema/application-schema.json) – add optional property `"version"` (string, description “Application version (semantic); default 1.0.0 when empty”).                                                                                                     |


**Rollback context** – Per [137-deployment_refactor_and_rollback.plan.md](.cursor/plans/137-deployment_refactor_and_rollback.plan.md): rollback is by deployment id (POST applications/rollback with `deploymentId`); config is `uploadedConfig` only. The `version` field in the builder is the application’s semantic version in the manifest; the controller does not need to interpret it for rollback (rollback is by id), but it can be used for display and “when to change version” guidance in docs.

---

## Implementation notes

- **Credentials API**: `.cursor/plans/credentials.md` already describes `GET /api/v1/wizard/credentials` and `GET /api/v1/credential`. Wizard Step 3 should allow “Use existing” by listing credentials (call wizard/credentials or credential list). Implement `aifabrix credential list` against the appropriate backend (`/api/v1/credential`).
- **Deployment list**: [lib/api/deployments.api.js](lib/api/deployments.api.js) already has `listDeployments(controllerUrl, envKey, authConfig, options)`. Wire CLI commands to it and add pagination (e.g. pageSize=50).
- **Deployment key**: [lib/core/key-generator.js](lib/core/key-generator.js) already uses `sortObjectKeys` and `JSON.stringify` (no spaces). Ensure the manifest sent to the controller is built from the same structure that was hashed (no re-serialization with different formatting).
- **Manifest naming**: [lib/utils/paths.js](lib/utils/paths.js) and [lib/app/config.js](lib/app/config.js) use `<appName>-deploy.json`; docs and deploying.md should consistently say `<appKey>-deploy.json` and mention external systems as `<systemKey>-deploy.json`.

---

## File touchpoints


| Area                             | Files                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Prerequisites / install          | [README.md](README.md), [docs/README.md](docs/README.md), [docs/infrastructure.md](docs/infrastructure.md)                                                                                                                                                                                                                                                   |
| Back links                       | All 26 docs under `docs/` that use “Back to Your Own Applications” or link to `your-own-applications.md` for back                                                                                                                                                                                                                                            |
| Wizard + credentials             | [docs/wizard.md](docs/wizard.md), [lib/api/wizard.api.js](lib/api/wizard.api.js) (optional listWizardCredentials), new credential list command + CLI                                                                                                                                                                                                         |
| Environment first time           | [docs/deployment/environment-first-time.md](docs/deployment/environment-first-time.md), [lib/schema/environment-deploy-request.schema.json](lib/schema/environment-deploy-request.schema.json), [templates/infra/environment-dev.json](templates/infra/environment-dev.json)                                                                                 |
| Deploying                        | [docs/deploying.md](docs/deploying.md)                                                                                                                                                                                                                                                                                                                       |
| Deployment list / app deployment | [lib/cli/](lib/cli/) (new or existing setup), [lib/api/deployments.api.js](lib/api/deployments.api.js)                                                                                                                                                                                                                                                       |
| Deploy --tag                     | [lib/app/deploy.js](lib/app/deploy.js), [lib/deployment/deployer.js](lib/deployment/deployer.js), CLI deploy option                                                                                                                                                                                                                                          |
| Deployment key                   | [lib/core/key-generator.js](lib/core/key-generator.js), [lib/generator/index.js](lib/generator/index.js)                                                                                                                                                                                                                                                     |
| Application version              | [builder/dataplane/variables.yaml](builder/dataplane/variables.yaml), [lib/generator/builders.js](lib/generator/builders.js), [lib/core/templates.js](lib/core/templates.js), [lib/generator/wizard.js](lib/generator/wizard.js), [lib/generator/split.js](lib/generator/split.js), [lib/schema/application-schema.json](lib/schema/application-schema.json) |
| Controller section               | New subsection in [docs/deploying.md](docs/deploying.md) or new doc                                                                                                                                                                                                                                                                                          |


---

## Plan Validation Report

**Date**: 2025-02-03  
**Plan**: .cursor/plans/46-docs_cli_credentials_deploy.plan.md  
**Status**: VALIDATED

### Plan Purpose

Improve documentation (prerequisites, install, disk space, back links, environment-first-time, deploying flow/prereqs/rollback), add credential list and wizard credential selection via API, fix/improve deployment list and deploy --tag commands, ensure deployment key is from canonical manifest JSON, and add a controller-side section. **Type**: Documentation + Development (CLI/API) + Infrastructure (deployment).

### Applicable Rules

- **Quality Gates** – Build, lint, test, coverage, security; mandatory for all plans.
- **Code Quality Standards** – File/function size, JSDoc, documentation.
- **CLI Command Development** – New commands: `credential list`, `deployment list`, `app deployment`.
- **API Client Structure Pattern** – Credential list and deployment list use `lib/api/` modules.
- **Testing Conventions** – Tests for new commands and API usage; 80%+ coverage for new code.
- **Security & Compliance (ISO 27001)** – No secrets in code/logs; deployment key and controller behavior documented.
- **Validation Patterns** – Environment deploy schema; deployment key from canonical JSON.
- **Error Handling & Logging** – try/catch, chalk, no sensitive data in messages.

### Rule Compliance

- **DoD requirements**: Documented (build first, lint, test, order BUILD → LINT → TEST, file size, JSDoc, security, all tasks).
- **Rules and Standards**: Added with links to project-rules.mdc and key requirements.
- **Before Development**: Checklist added (read rules, review patterns, confirm API/auth for credential and deployment list).
- **Definition of Done**: Added with all 10 mandatory items including validation order and coverage.

### Plan Updates Made

- Added **Rules and Standards** section with applicable rule sections and key requirements.
- Added **Before Development** checklist (rules, patterns, credential backend, deployment list API).
- Added **Definition of Done** (build, lint, test, order, file size, JSDoc, security, docs, CLI, all tasks).
- Appended this **Plan Validation Report**.

### Recommendations

- When implementing `aifabrix credential list`, confirm whether the backend is controller or dataplane and which auth (device vs client credentials); document in wizard.md.
- For `deployment list` and `app deployment`, document default page size (e.g. 50) and whether the controller supports filtering by appKey.
- Run `npm run build` after each logical chunk (e.g. after new CLI commands) to catch lint/test issues early.

