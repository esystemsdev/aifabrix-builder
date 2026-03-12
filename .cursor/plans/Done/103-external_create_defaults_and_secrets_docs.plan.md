---
name: External create defaults and secrets docs
overview: Make external the default for `aifabrix create`; generate env.template from authentication.security when present (with path-style kv:// and fallback by auth type); add a per-auth "Secrets" section to the external README template; preserve existing authentication.variables when running repair --auth; add systemDisplayName to the wizard (WizardConfigGenerationRequest) so authentication.displayName is system-level; and update all documentation.
todos: []
isProject: false
---

# External create default, env.template from auth params, README secrets, and repair --auth preservation

## Overview

This plan changes the default type for `aifabrix create` to external; generates env.template from `authentication.security` (with path-style kv:// and auth-type fallback); adds a per-auth "Secrets" section to the external README template; preserves existing `authentication.variables` when running `repair --auth`; adds `systemDisplayName` to the wizard so config generation requests can set system-level `authentication.displayName` (e.g. when OpenAPI title is entity-specific); and updates all user-facing documentation. **Scope:** CLI (create command), wizard generator, external-readme, Handlebars templates, repair-auth-config, wizard config/API, validation, and docs. **Type:** Development (CLI/commands, modules, templates) + Documentation + Security (secret management).

## Rules and Standards

This plan must comply with the following from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Mandatory checks before commit: build, lint, test, file size, coverage ≥80%, no hardcoded secrets. Applies to all changes.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – Files ≤500 lines, functions ≤50 lines; JSDoc for all public functions. Applies to lib/generator, lib/utils, lib/commands.
- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** – Generated output under integration/ and builder/ must be fixed at the generator/template source; CLI command pattern (Commander.js). Applies to create command, wizard, and external README/env.template generation.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – Input validation, error handling with chalk, clear options and descriptions. Applies to create command default type and repair --auth behavior.
- **[Template Development](.cursor/rules/project-rules.mdc#template-development)** – Handlebars in `templates/`, validate context, document required variables. Applies to README.md.hbs and secretPaths context.
- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** – env.template and schema validation; developer-friendly errors. Applies to env.template kv:// and env-template-auth validation.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – Use kv:// for secrets; never log or expose secrets. Applies to env.template and README secret set examples.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Jest, tests in `tests/`, mock externals, 80%+ coverage for new code. Applies to section 6 tests.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – try-catch for async, chalk for output, never log secrets. Applies to all touched modules.

**Key requirements:** Run `npm run build` (then lint, then test) before commit; keep files ≤500 lines and functions ≤50 lines; add JSDoc for new/changed public functions; fix behavior in generators/templates, not only in generated artifacts; use path.join(); no hardcoded secrets; test coverage ≥80% for new code.

## Before Development

- Read Quality Gates and Code Quality Standards from project-rules.mdc
- Review create command and wizard flow in lib/cli/setup-app.js and lib/generator/wizard.js
- Review repair --auth implementation (lib/commands/repair-auth-config.js or repair.js)
- Review external README template and buildExternalReadmeContext in lib/utils/external-readme.js
- Review env.template generation and credential-secrets-env (KV_ names, path format)
- Confirm docs-rules: CLI user docs must not expose REST/API details; keep command-centric language
- Review wizard config generation request payload and wizard.yaml schema for adding systemDisplayName

## Definition of Done

Before marking this plan complete, ensure:

1. **Build:** Run `npm run build` FIRST (must complete successfully; runs lint + test:ci).
2. **Lint:** Run `npm run lint` (must pass with zero errors/warnings).
3. **Test:** Run `npm test` or `npm run test:ci` AFTER lint (all tests must pass; ≥80% coverage for new code).
4. **Validation order:** BUILD → LINT → TEST (mandatory sequence; do not skip steps).
5. **File size:** Files ≤500 lines, functions ≤50 lines.
6. **JSDoc:** All new or modified public functions have JSDoc (params, returns, throws as applicable).
7. **Code quality:** All requirements from Rules and Standards met; no hardcoded secrets; ISO 27001–aligned secret handling.
8. **Security:** Secrets only via kv:// and aifabrix secret set; never log secrets or tokens.
9. **All tasks completed:** Sections 1–7 implemented; docs updated; tests added/updated as in section 8.

## 1. Change create default from webapp to external

**Goal:** `aifabrix create hubspot-test` creates an external system (no flag). `aifabrix create my-app --type webapp` creates a web app.

**Files to update:**

- **[lib/cli/setup-app.js](lib/cli/setup-app.js)**  
  - Change create command default: `.option('--type <type>', '...', 'external')` (line 113).  
  - Update `shouldUseWizard`: wizard runs when `options.wizard && (options.type === 'external' || !options.type)` (already allows no type; keep behavior so wizard is used for external).  
  - Update `isExternalType` to treat missing type as external: `const isExternalType = options.type === 'external' || !options.type;` so non-interactive create without `--type` creates external.
- **[lib/app/index.js](lib/app/index.js)**  
  - Line 71: `const initialType = options.type || 'external';`
- **[lib/app/prompts.js](lib/app/prompts.js)**  
  - Line 429–430: `const appType = options.type || 'external';`

**Result:** No `--type` → external (integration/). `--type webapp` (or api, service, functionapp) → builder/.

---

## 2. Generate env.template from authentication parameters (with kv:// paths)

**Goal:** env.template is generated in the Builder (wizard/create, not from the dataplane). It must contain full path-style values (e.g. `KV_HUBSPOT_APIKEY=kv://hubspot-test/apikey`) so [lib/validation/env-template-auth.js](lib/validation/env-template-auth.js) `validateAuthKvCoverage` passes. Prefer **authentication.security** as the single source for which env vars to generate; use auth-type fallback when security is absent.

**Current behavior:**

- [lib/generator/wizard.js](lib/generator/wizard.js) `generateEnvTemplate` reads `systemConfig.authentication` (or `systemConfig.auth`) and auth type (default `'apikey'`).
- Uses a fixed mapping by auth type (`addApiKeyAuthLines`, `addOAuth2AuthLines`, etc.) and writes **empty values** (e.g. `KV_HUBSPOT_DEMO_CLIENTID=`). No `kv://` paths are written.
- Validation fails when the system file has `authentication.security` but env.template has no kv paths.
- [lib/commands/repair-env-template.js](lib/commands/repair-env-template.js) already builds expected env.template from `authentication.security` with path-style `KEY=kv://systemKey/variable`.

**Problem:** Generation ignores `authentication.security` from the dataplane; only a small set of auth types is supported; empty values cause validation to fail; auth methods such as `queryParam`, `hmac`, `aad` are not covered.

**Recommended direction:**

1. **Use `authentication.security` when present**
  In `generateEnvTemplate` ([lib/generator/wizard.js](lib/generator/wizard.js)): if `systemConfig.authentication?.security` (or `systemConfig.auth?.security`) exists and is an object, iterate over it and for each key add one env line:
  - Env name: `KV_<PREFIX>_<securityKeyToVar(key)>` (reuse [lib/utils/credential-secrets-env.js](lib/utils/credential-secrets-env.js) `systemKeyToKvPrefix` and `securityKeyToVar`).
  - Value: the security value as-is if it is already a valid `kv://` path; otherwise build path-style `kv://<systemKey>/<key>` (camelCase) to match the system file and validator.
2. **Fallback when `authentication.security` is missing**
  Keep auth-type-based logic but **emit path-style values** so validation passes (e.g. oauth2: `KV_<PREFIX>_CLIENTID=kv://<systemKey>/clientId`, `KV_<PREFIX>_CLIENTSECRET=kv://<systemKey>/clientSecret`). Use same convention as repair/validator: `kv://<systemKey>/<camelCaseKey>`.
3. **Support all auth methods**
  Extend fallback to cover all schema-supported methods ([lib/external-system/generator.js](lib/external-system/generator.js) `buildAuthenticationFromMethod`): `oauth2`, `aad`, `apikey`, `basic`, `queryParam`, `oidc`, `hmac`, `none`. For `none` (and optionally `oidc` with empty security), add no auth lines.
4. **Single source of truth**
  Prefer **authentication.security** for “what env vars to generate.” Auth type is only used for fallback and for comments (e.g. “# OAuth2 Authentication”).
5. **Normalize auth shape**
  Dataplane may return `authentication.method` or `authentication.type`; system file may use `auth` or `authentication`. Read both and normalize (`method` vs `type`) so security is not missed.

**Files to touch:**


| File                                                                       | Change                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [lib/generator/wizard.js](lib/generator/wizard.js)                         | In `generateEnvTemplate`: (1) When `authentication.security` exists, build lines from it with path-style values. (2) When absent, keep auth-type fallback but add `kv://<systemKey>/<var>` values. (3) Support all auth methods in fallback; reuse or share logic with [lib/utils/credential-secrets-env.js](lib/utils/credential-secrets-env.js) for KV_ names and path format. |
| [lib/validation/env-template-auth.js](lib/validation/env-template-auth.js) | No change required; already validates that env.template contains the kv paths from the system file.                                                                                                                                                                                                                                                                              |


---

## 3. README template: document secrets per authentication type

**Goal:** Generated README for external systems includes a "Secrets" section with the correct `aifabrix secret set kv://<systemKey>/<key> <your value>` commands per auth type.

**Approach:**

- **Extend context in [lib/utils/external-readme.js](lib/utils/external-readme.js)**  
  - In `buildExternalReadmeContext`, accept optional `authType` (and optionally full `authentication` object).  
  - Build a `secretPaths` array: for each auth type, list `{ path: 'kv://<systemKey>/<key>', description: '...' }` (lowercase key to match system file and env.template).  
  - Map: apikey → `[{ path: 'kv://systemKey/apikey', description: 'API Key' }]`; oauth2/aad → clientid, clientsecret; basic → username, password; bearer/token → bearertoken; queryParam → paramvalue; hmac → signingsecret; none → [].
- **Update [templates/external-system/README.md.hbs](templates/external-system/README.md.hbs)**  
  - Add a "Secrets" section (e.g. after "Quick Start" or after "Configure Authentication and Datasources") that:  
    - Explains that secrets are resolved from `.aifabrix` or key vault and can be set with `aifabrix secret set`.  
    - Lists one line per secret: `aifabrix secret set {{path}} <your value>` (and optional short description).
  - Use `{{#if secretPaths.length}}` / `{{#each secretPaths}}` so the section is omitted when there are no secrets (e.g. auth none).
- **Callers must pass auth into README context**  
  - **[lib/generator/wizard-readme.js](lib/generator/wizard-readme.js)**  
    - When calling `generateExternalReadmeContent`, pass `authType` (and systemKey is already there) from `systemConfig.authentication.type` or `systemConfig.auth?.type`.
  - **[lib/app/readme.js](lib/app/readme.js)**  
    - For external, pass `authType` from `config.authentication?.type` or `config.authType` into `generateExternalReadmeContent`.
  - **[lib/external-system/download-helpers.js](lib/external-system/download-helpers.js)**  
    - In `generateReadme`, pass `authType` from `application.authentication?.type` (or equivalent).
  - **[lib/generator/external-schema-utils.js](lib/generator/external-schema-utils.js)**  
    - In `writeSplitExternalSchemaFiles`, when calling `generateExternalReadmeContent`, pass auth from `application.authentication`.
  - **[lib/external-system/generator.js](lib/external-system/generator.js)**  
    - If it generates README, pass auth type from config (check current call sites).

---

## 4. Documentation updates

**Goal:** All user-facing docs reflect: (1) default create is external; (2) use `--type webapp` for web apps; (3) where relevant, mention the new README Secrets section and env.template kv:// values.

**Docs to update (replace "create ... --type external" with "create ..." for external, and add "create my-app --type webapp" for web app; ensure default is stated):**

- **[docs/commands/application-development.md](docs/commands/application-development.md)**  
  - State default type is `external`; examples: `aifabrix create hubspot-test` (external), `aifabrix create my-app --type webapp` (web app).  
  - Update "External Type" section to describe default and that `--type webapp` is for builder apps.  
  - Mention that env.template includes full `kv://` paths and README lists `aifabrix secret set` commands per auth.
- **[docs/commands/README.md](docs/commands/README.md)**  
  - Any create example: use `create <app>` for external and `create <app> --type webapp` for web app; one-line note that default is external.
- **[docs/commands/external-integration.md](docs/commands/external-integration.md)**  
  - Replace `aifabrix create <app> --type external` with `aifabrix create <app>` where it describes creating an external system.  
  - Add note that README in integration folder includes a "Secrets" section with `aifabrix secret set kv://<systemKey>/<key> <value>`.
- **[docs/external-systems.md](docs/external-systems.md)**  
  - Same as above: default create = external; examples without `--type external`; optional short note on secrets in README and env.template.
- **[docs/your-own-applications.md](docs/your-own-applications.md)**  
  - Update create examples (e.g. `aifabrix create hubspot-test --type external` → `aifabrix create hubspot-test`; add web app example with `--type webapp`).
- **[docs/wizard.md](docs/wizard.md)**  
  - If wizard examples use `create ... --type external`, switch to `create ...` for external and mention default.
- **[README.md](README.md)** (project root)  
  - Update create example to show default external and optional `--type webapp`.
- **Integration sample [integration/hubspot/README.md](integration/hubspot/README.md)**  
  - If it says "create hubspot --type external", change to "create hubspot" and add a short "Secrets" subsection with the actual `aifabrix secret set kv://hubspot/...` commands for that integration (or point to generated README behavior).

**Consistency:** Everywhere we say "to create an external system" use `aifabrix create <name>`; "to create a web app" use `aifabrix create <name> --type webapp`. State once in application-development (and optionally in README) that the default type is `external`.

---

## 5. Repair `--auth`: preserve existing authentication when switching method

**Goal:** When running `aifabrix repair <key> --auth <method>` (e.g. `--auth apikey`) and the system file already has an authentication block, **read the existing authentication** and **preserve non-security values** from the old one instead of overwriting with defaults.

**Behavior to implement:**

- Before applying the new auth method (e.g. apikey), read the current system file’s `authentication` (or `auth`).
- **Preserve** `authentication.variables` from the existing block (e.g. `baseUrl`, `tokenUrl`, `authorizationUrl`, `headerName`, `paramName`, `tenantId`, etc.). Only replace the auth **method** and **security** (kv:// references) with the new method’s structure; copy over any existing `variables` so that user-configured URLs and options are not lost.
- If the existing block has no `variables`, the new method’s default variables can be used.
- Apply the same idea to any other non-security fields on the authentication object that are method-agnostic or that should carry over (e.g. custom fields the schema allows).

**Files to touch:**

- **[lib/commands/repair-auth-config.js](lib/commands/repair-auth-config.js)** (or wherever `repair --auth` is implemented): when building the new authentication object for the chosen method, merge in or copy `authentication.variables` (and other preserved fields) from the parsed existing system file before writing.

**Result:** Switching from e.g. oauth2 to apikey with `aifabrix repair <key> --auth apikey` keeps the existing `baseUrl` (and other variables); only the auth method and security keys (clientId/clientSecret → apikey) change.

---

## 7. Wizard: add systemDisplayName to config generation request

**Goal:** Support `systemDisplayName` in the wizard so that config generation (WizardConfigGenerationRequest) can set a system-level display name for the credential. When the OpenAPI title is entity-specific (e.g. "Companies"), pass the system name here so `authentication.displayName` is system-level (e.g. "Hubspot Demo") rather than entity-specific.

**Schema (WizardConfigGenerationRequest):**

- **systemDisplayName:** `anyOf: [ { type: 'string' }, { type: 'null' } ]`
- **Title:** Systemdisplayname
- **Description:** System-level display name for the credential (e.g. "Hubspot Demo"). When the OpenAPI title is entity-specific (e.g. "Companies"), pass the system name here so authentication.displayName is system-level.

**Implementation:**

- **Wizard flow:** Ensure the wizard collects or accepts `systemDisplayName` (string | null) and includes it in the payload sent to the wizard config generation API (or in wizard.yaml used for headless generation). Where the CLI today has `--display-name` for create, ensure it maps to `systemDisplayName` in the wizard path when the wizard is used.
- **Prompts:** If the wizard prompts for display name, store it as `systemDisplayName` and pass it through to the generation request so the dataplane/backend can set `authentication.displayName` to this value.
- **wizard.yaml / schema:** If the local wizard config schema (e.g. [lib/schema/wizard-config.schema.json](lib/schema/wizard-config.schema.json)) is used for headless or file-driven runs, add `systemDisplayName` (string | null) with the same description so it is validated and passed to the generation request.
- **API request:** Where the Builder calls the wizard config generation endpoint, include `systemDisplayName` in the request body when present (optional field; omit or null when not set).

**Files to touch (candidates):**

- Wizard entry and API: [lib/commands/wizard-core.js](lib/commands/wizard-core.js), [lib/api/wizard.api.js](lib/api/wizard.api.js) or [lib/api/wizard-platform.api.js](lib/api/wizard-platform.api.js) – ensure request payload includes `systemDisplayName`.
- Prompts / create: [lib/generator/wizard-prompts.js](lib/generator/wizard-prompts.js), [lib/app/prompts.js](lib/app/prompts.js) – already have `systemDisplayName` in places; ensure wizard path passes it into the generation request.
- Schema: [lib/schema/wizard-config.schema.json](lib/schema/wizard-config.schema.json) – add `systemDisplayName` property (string | null) with title and description if not already present.
- Docs: [docs/wizard.md](docs/wizard.md) – mention system-level display name and when to set it (e.g. when OpenAPI title is entity-specific); document that `systemIdOrKey` must be the application/system key (e.g. hubspot-demo from appName), not an entity or datasource key (e.g. companies).
- **systemIdOrKey:** In [lib/commands/wizard.js](lib/commands/wizard.js), [lib/commands/wizard-headless.js](lib/commands/wizard-headless.js), and [lib/commands/wizard-core.js](lib/commands/wizard-core.js) (and any code that passes wizard.yaml config to the dataplane), ensure `systemIdOrKey` is set from the app/system key (e.g. `appName` or resolved system `key`), never from a datasource or entity key; add validation or schema description so script authors do not pass a datasource key.

**Result:** Users can supply a system-level display name (e.g. "Hubspot Demo") in the wizard; the config generation request sends it so that `authentication.displayName` is system-level instead of inheriting an entity-specific OpenAPI title (e.g. "Companies").

**systemIdOrKey must be the application/system key (dataplane requirement):**

- If the client (e.g. script using wizard.yaml) sends `systemIdOrKey` = **entity or datasource key** (e.g. `"companies"`) instead of the **app/system key** (e.g. `"hubspot-demo"`), the whole system config—including auth—will use that wrong value on the dataplane.
- The flow that runs the wizard with wizard.yaml **must pass the application/system key** as `systemIdOrKey`, not the first datasource key or an entity key. Use e.g. `appName` or the platform/system key (e.g. `"hubspot-demo"`), never a datasource/entity identifier (e.g. `"companies"`).
- **Implementation:** Where the Builder builds the wizard session or config generation request from wizard.yaml or from interactive flow, ensure `systemIdOrKey` is set from the **system/app key** (e.g. from `appName`, or from the resolved system’s `key`/`systemKey` when in add-datasource mode), and validate or document that it must not be an entity or datasource key. Add validation or docs so script authors and callers do not pass a datasource key (e.g. "companies") as `systemIdOrKey`.

---

## 8. Tests

- **Create command and default type**  
  - Tests that assume default webapp (e.g. in [lib/app](lib/app), [lib/cli](lib/cli)): update to expect default `external` or explicitly pass `--type webapp` where a builder app is required.  
  - Add or adjust a test that `create foo` without `--type` creates under `integration/foo/` and uses external config.
- **env.template content**  
  - In [tests/lib/generator/wizard-generator.test.js](tests/lib/generator/wizard-generator.test.js): (1) env.template generated from `authentication.security` contains correct KEY=kv:// lines; (2) fallback by auth type produces path-style values; (3) validation passes when system file has security. Assert generated env.template for external with apikey contains `KV_*_APIKEY=kv://<systemKey>/apikey` (and similarly for oauth2, basic, bearer). Optionally run `validateAuthKvCoverage` on wizard-generated output when the system file includes `authentication.security`.
- **README secret paths**  
  - In [tests/local/lib/utils/external-readme.test.js](tests/local/lib/utils/external-readme.test.js) or a test for external-readme: assert that with `authType: 'apikey'` and systemKey `hubspot-test`, generated README includes a Secrets section and the line `aifabrix secret set kv://hubspot-test/apikey <your value>` (or equivalent). Same for oauth2 (clientid, clientsecret) if feasible.
- **Repair --auth preservation**  
  - Add or update tests: when repairing with `--auth apikey` (or another method) and the system file already has authentication with `variables.baseUrl` (or other variables), the repaired file retains those variable values; only method and security keys change.
- **Wizard systemDisplayName**  
  - Add or update tests: when running the wizard with `systemDisplayName` set (or from wizard.yaml), the config generation request includes `systemDisplayName` and the generated system/credential uses it for authentication.displayName where applicable.
- **Wizard systemIdOrKey**  
  - Add or update tests and/or validation: when running the wizard (interactive or with wizard.yaml), `systemIdOrKey` sent to the dataplane is the application/system key (e.g. from appName or resolved system key), not an entity or datasource key (e.g. "companies"); document or assert that callers must pass the system key.

---

## Summary


| Area                     | Change                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Default type             | `create` default = `external`; use `--type webapp` for web apps.                                                                                                                                                                                                                                       |
| env.template             | Generate from `authentication.security` when present (path-style kv://); fallback by auth type with path-style values; support all auth methods (oauth2, aad, apikey, basic, queryParam, oidc, hmac, none). Single source of truth: security; normalize auth shape (method/type, auth/authentication). |
| README                   | New "Secrets" section in external README template; context includes `secretPaths` from `authType`; all generators pass auth into README.                                                                                                                                                               |
| Repair --auth            | When running `aifabrix repair <key> --auth <method>`, read existing authentication and preserve `authentication.variables` (e.g. baseUrl) and other non-security fields from the old block; only replace method and security.                                                                          |
| Wizard systemDisplayName | Add `systemDisplayName` (string                                                                                                                                                                                                                                                                        |
| Docs                     | Replace "create x --type external" with "create x"; add "create x --type webapp"; document default and new README/env.template behavior.                                                                                                                                                               |
| Tests                    | Update defaults; env.template from security + fallback + validation; README secret commands; repair --auth preserves variables; wizard systemDisplayName and systemIdOrKey (app key not datasource key).                                                                                               |


**Out of scope (env.template):** Fetching env.template from the dataplane (we keep generating it in the Builder). No dataplane API or response shape changes. No wizard.yaml schema changes for credential.

---

## Plan Validation Report

**Date:** 2025-03-12  
**Plan:** .cursor/plans/103-external_create_defaults_and_secrets_docs.plan.md  
**Status:** VALIDATED

### Plan Purpose

Change create default to external; generate env.template from authentication.security (path-style kv://) with auth-type fallback; add README "Secrets" section with aifabrix secret set examples per auth type; preserve authentication.variables when running repair --auth; add systemDisplayName to wizard (WizardConfigGenerationRequest) so authentication.displayName is system-level; update all user-facing docs. **Affected areas:** CLI (create command), lib/generator/wizard.js, lib/utils/external-readme.js, templates/external-system/README.md.hbs, lib/commands/repair-auth-config.js, wizard (config generation request, prompts, schema), validation, docs. **Type:** Development (CLI, modules, templates) + Documentation + Security (secret management).

### Applicable Rules

- **Quality Gates** – Mandatory for all plans; build, lint, test, file size, coverage, no secrets.
- **Code Quality Standards** – File/function size limits, JSDoc; applies to all code changes.
- **Architecture Patterns** – Generator/template as source of truth for integration/builder output; CLI pattern.
- **CLI Command Development** – create and repair command behavior, options, UX.
- **Template Development** – README Handlebars template, context (secretPaths, authType).
- **Validation Patterns** – env.template kv:// and validateAuthKvCoverage.
- **Security & Compliance (ISO 27001)** – kv:// and secret set documentation; no logging of secrets.
- **Testing Conventions** – Jest, coverage ≥80% for new code; section 6 test tasks.
- **Error Handling & Logging** – try-catch, chalk, no secret logging.

### Rule Compliance

- **DoD requirements:** Documented (build first, then lint, then test; file size; JSDoc; security; all tasks).
- **Quality Gates:** Referenced in Rules and Standards and Definition of Done.
- **Code Quality Standards:** Referenced; file size and JSDoc in DoD.
- **Plan-specific:** CLI, template, validation, security, and testing rules mapped to plan sections.

### Plan Updates Made

- Added **Overview** (purpose, scope, type).
- Added **Rules and Standards** with links to project-rules.mdc and key requirements.
- Added **Before Development** checklist.
- Added **Definition of Done** (build → lint → test order, file size, JSDoc, security, all tasks).
- Appended this **Plan Validation Report**.

### Recommendations

- When implementing section 2, reuse `systemKeyToKvPrefix` and `securityKeyToVar` from credential-secrets-env.js so KV_ names and path format stay consistent with repair and validator.
- When implementing section 5 (repair --auth), read the system file once and merge existing `authentication.variables` into the new method's structure before writing.
- Run `npm run build` after each major change (create default, env.template, README, repair, wizard systemDisplayName, docs) to catch lint and test failures early.

---

## Implementation Validation Report

**Date:** 2025-03-12  
**Plan:** .cursor/plans/103-external_create_defaults_and_secrets_docs.plan.md  
**Status:** COMPLETE

### Executive Summary

All plan sections (1–8) are implemented. Code quality validation passed: format (lint:fix), lint (0 errors; 1 pre-existing warning in `lib/commands/up-dataplane.js`), and full test suite (240 suites, 5287 tests). Key files exist with expected logic; tests cover create default type, env.template path-style kv://, README secretPaths, repair --auth variable preservation, and wizard systemDisplayName.

### Task Completion

| Section | Description | Status |
|--------|-------------|--------|
| 1 | Change create default from webapp to external | Done – setup-app.js, app/index.js, app/prompts.js |
| 2 | Generate env.template from authentication (kv:// paths) | Done – wizard.js addLinesFromSecurity, fallback, toPathStyleKv |
| 3 | README template: Secrets section per auth type | Done – external-readme.js secretPaths, README.md.hbs |
| 4 | Documentation updates | Done – application-development, external-integration, wizard, README, etc. |
| 5 | Repair --auth: preserve authentication.variables | Done – repair.js merge existingAuth.variables |
| 7 | Wizard systemDisplayName in config generation | Done – wizard-config.schema.json, wizard-core-helpers, wizard flows |
| 8 | Tests | Done – app, wizard-generator, external-readme, repair, wizard-core |

**Completion:** 7/7 implementation sections (section 6 not in plan numbering).

### File Existence Validation

| File | Status |
|------|--------|
| lib/cli/setup-app.js | Present – default `external`, isExternalType, shouldUseWizard |
| lib/app/index.js | Present – initialType `external`, getBaseDirForAppType |
| lib/app/prompts.js | Present – appType default `external` |
| lib/generator/wizard.js | Present – generateEnvTemplate from security + fallback, path-style kv:// |
| lib/utils/external-readme.js | Present – buildSecretPaths, secretPaths in context |
| templates/external-system/README.md.hbs | Present – Secrets section, secretPaths |
| lib/commands/repair.js | Present – applyAuthMethod preserves variables |
| lib/schema/wizard-config.schema.json | Present – systemDisplayName property |
| lib/commands/wizard-core-helpers.js | Present – buildConfigPayload systemDisplayName |
| lib/commands/wizard-core.js, wizard.js, wizard-headless.js | Present – systemDisplayName passed to API |
| lib/api/wizard.api.js | Present – JSDoc systemDisplayName |
| docs/commands/application-development.md | Present – default external, examples |
| docs/commands/external-integration.md | Present – create without --type external |
| docs/wizard.md, README.md, integration/hubspot/README.md | Present – updated create examples and secrets |

### Test Coverage

| Area | Test File | Status |
|------|-----------|--------|
| Create default type | tests/lib/app/app.test.js | Present – "should create under integration/ when type is external (default type)" |
| env.template path-style kv:// | tests/lib/generator/wizard-generator.test.js | Present – from authentication.security and fallback by auth type |
| README secretPaths | tests/lib/utils/external-readme.test.js | Present – secretPaths for apikey/oauth2/none, Secrets section and aifabrix secret set |
| Repair --auth preservation | tests/lib/commands/repair.test.js | Present – "preserves existing authentication.variables when switching auth method" |
| Wizard systemDisplayName | tests/lib/commands/wizard-core.test.js | Present – "should pass systemDisplayName to generateConfig when provided" |

### Code Quality Validation

| Step | Result | Notes |
|------|--------|--------|
| Format (lint:fix) | PASSED | Exit code 0 |
| Lint | PASSED | Exit code 0; 1 warning in lib/commands/up-dataplane.js (max-statements, pre-existing) |
| Tests | PASSED | 240 suites, 5287 tests, 28 skipped |

### Cursor Rules Compliance

- **Code reuse:** Centralized credential-secrets-env (securityKeyToVar, path format); repair and wizard share patterns.
- **Error handling:** try-catch and chalk in touched modules.
- **Logging:** No secrets logged; CLI output only.
- **Type safety:** JSDoc on buildConfigPayload, buildSecretPaths, and API generateConfig.
- **Async patterns:** async/await and fs.promises used.
- **File operations:** path.join used for paths.
- **Input validation:** app name and options validated in create/repair/wizard.
- **Module patterns:** CommonJS, named/default exports.
- **Security:** kv:// only; no hardcoded secrets; README documents secret set.

### Implementation Completeness

- **CLI (create):** Default type external; --type webapp for builder.
- **env.template:** From authentication.security when present; fallback by auth type; path-style kv://.
- **README:** Secrets section with secretPaths; callers pass authType.
- **Repair --auth:** Existing variables merged; method and security replaced.
- **Wizard:** systemDisplayName in schema, payload, and API; flows pass it through.
- **Docs:** Default create and examples updated; secrets/env.template mentioned where relevant.

### Issues and Recommendations

- **Lint:** One pre-existing warning in `lib/commands/up-dataplane.js` (max-statements). Not introduced by this plan; can be refactored separately.
- **systemIdOrKey:** Plan section 7 documents that systemIdOrKey must be app/system key; tests and docs confirm intended usage; no dedicated test for “reject datasource key” (optional enhancement).

### Final Validation Checklist

- [x] All plan sections (1–8) implemented
- [x] All mentioned files exist with expected changes
- [x] Tests exist and pass for create default, env.template, README secrets, repair --auth, wizard systemDisplayName
- [x] Format (lint:fix) and lint pass
- [x] Full test suite passes
- [x] Cursor rules compliance verified for touched code
- [x] Implementation complete; report appended to plan file

