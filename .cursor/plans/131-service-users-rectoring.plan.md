---
name: 131-builder-integration-client-cli
overview: Replace Builder `service-user` CLI group with `integration-client` commands, align `lib/api` with MISO Controller `/api/v1/integration-clients` and `integration-client:*` permissions, and refresh `docs/commands/` (command-centric prose; no HTTP tutorials per docs-rules).
todos:
  - id: api-client-and-types
    content: Add `lib/api/integration-clients.api.js` + types; wire GET/POST/PUT/DELETE to `/api/v1/integration-clients`; JSDoc `@requiresPermission` for `integration-client:*`; remove or stop exporting legacy `service-users.api.js` paths.
    status: completed
  - id: commands-and-cli-setup
    content: Implement `lib/commands/integration-client.js` + `lib/cli/setup-integration-client.js`; map create to `key`/`displayName` (drop username/email); register `integration-client` in `lib/cli/index.js`; remove `setup-service-user` registration.
    status: completed
  - id: tests
    content: Update/replace `tests/lib/api/service-users.api.test.js`, `tests/lib/commands/service-user.test.js`, `help-builder.test.js`, `tests/manual/api-service-users.test.js`; add coverage for new paths and payloads.
    status: completed
  - id: cli-layout-matrix-and-help
    content: Update `.cursor/rules/cli-output-command-matrix.md`, `lib/utils/help-builder.js` (category command name), and any CLI layout snapshots/tests per cli-layout rules.
    status: completed
  - id: docs-commands
    content: Update `docs/commands/application-management.md`, `docs/commands/permissions.md`, `docs/commands/README.md` — anchors, examples, permission names, troubleshooting strings; grep `docs/` for residual `service-user`.
    status: completed
  - id: contributor-routes-doc
    content: Keep `.cursor/plans/routes.md` integration-clients table aligned; link from this plan if paths change.
    status: completed
  - id: dod-build-lint-test
    content: Run `npm run lint` → `npm test` (or `npm run build` / `npm run build:ci` per repo scripts); zero lint errors; all tests green.
    status: completed
isProject: false
---

# Builder CLI — Service user commands → Integration clients

## Overview

The MISO Controller no longer exposes `/api/v1/service-users`; integration OAuth clients are managed under **`/api/v1/integration-clients`** with permissions **`integration-client:create|read|update|delete`** (see **aifabrix-miso** and **`.cursor/plans/routes.md`** in this repo).

This plan refactors the **AI Fabrix Builder** CLI so users run **`aifabrix integration-client`** (subcommands unchanged in behavior: create, list, rotate-secret, delete, update-groups, update-redirect-uris) instead of **`aifabrix service-user`**. Update **`docs/commands/`** so command-centric docs, permission tables, and README links match the new names and RBAC strings. Contributor route summary: **`.cursor/plans/routes.md`** (Integration Clients table).

**Plan type:** Development + Documentation + Refactoring.

**Breaking change:** Remove the **`service-user`** command group (no long-term alias). User-facing **`docs/commands/`** documents **`integration-client`** only (no legacy command names in production-oriented docs).

## Scope

### In scope

- **`lib/api/`** — New HTTP client module targeting integration-clients paths; types in **`lib/api/types/`**.
- **`lib/commands/`** — Command handlers (TTY output, errors, permission hints).
- **`lib/cli/`** — Commander registration and help text.
- **`tests/`** — Unit/integration tests touching renamed modules.
- **`.cursor/rules/cli-output-command-matrix.md`** — Output profiles for renamed leaf commands.
- **`docs/commands/`** — User-facing docs only (no REST tutorials per **[docs-rules.mdc](../rules/docs-rules.mdc)**).

### Out of scope

- Changing **aifabrix-miso** controller code (already shipped separately).
- **`docs/commands/`** HTTP endpoint naming beyond plain-language “controller” outcomes (follow docs-rules).

## Rules and Standards

This plan must comply with **[Project Rules](../rules/project-rules.mdc)**:

| Section | Why it applies |
| ------- | -------------- |
| **Architecture Patterns / CLI** | Commander.js wiring, `lib/api/` usage, module layout |
| **CLI Command Development** | Descriptions, chalk errors, `handleCommandError`, validation |
| **Code Style** | CommonJS, async/await, `try`/`catch`, `path.join` |
| **Testing Conventions** | Jest mocks for `ApiClient`, mirror `tests/lib/` layout |
| **Quality Gates** | **`npm run lint`** then **`npm test`** (see Definition of Done) |
| **Code Quality Standards** | Files ≤500 lines, functions ≤50 lines, JSDoc on public APIs |
| **Security / ISO 27001** | Never log secrets; mask one-time `clientSecret` in logs |
| **[CLI layout](../rules/cli-layout.mdc)** | Help output, **`cli-output-command-matrix.md`** updates |
| **[Documentation Rules — CLI user docs](../rules/docs-rules.mdc)** | Command-centric wording; no REST paths in user docs |

**Key requirements (summary):**

- Use centralized **`ApiClient`** from **`lib/api/index.js`** for new integration-client functions.
- **`@requiresPermission`** JSDoc must use **`integration-client:*`** namespace (Controller).
- Create flow maps to controller body: **`key`**, **`displayName`**, optional **`description`**, optional **`keycloakClientId`**, **`redirectUris`**, **`groupNames`** — not legacy username/email.
- All new/changed public functions: JSDoc with `@param` / `@returns` / `@throws`.

## Before Development

- [ ] Read **`../rules/project-rules.mdc`** sections listed above and **`../rules/cli-layout.mdc`**.
- [ ] Read controller contract summary in **`.cursor/plans/routes.md`** (Integration Clients table).
- [ ] Skim existing **`lib/commands/service-user.js`** and **`lib/api/service-users.api.js`** for parity of flags and error messages.
- [ ] Grep **`docs/commands/`** for `service-user` and plan anchor renames.

## Definition of Done

1. **`npm run lint`** — ESLint passes with **zero errors** on touched **`*.js`** (run before tests).
2. **`npm test`** — All Jest suites pass (use **`npm run test:ci`** when matching CI matrix).
3. **`npm run build`** — Succeeds (**`lint && test`** per **`package.json`**); for CI parity also run **`npm run build:ci`** when preparing release (includes **`check:schema-sync`**, **`check:flags`**, **`test:ci`**).
4. **Order:** Lint → Test → Build sequence as defined by scripts; do not skip lint.
5. **New code:** Aim for **≥80%** branch coverage on new/changed modules where practical.
6. **File / function size:** Stay within **500 / 50** lines per project rules; split files if needed.
7. **Docs:** **`docs/commands/`** updated; no stale **`service-user`** command references in user docs (**`grep service-user docs/commands`** empty).
8. **CLI matrix:** **`.cursor/rules/cli-output-command-matrix.md`** lists **`aifabrix integration-client …`** leaf commands.
9. **No secrets** in logs, fixtures, or docs.

## Controller alignment (implementation truth)

| CLI intent | HTTP (contributor reference only; do not paste into user docs as a tutorial) | Permission |
| ---------- | ----------------------------------------------------------------------------- | ---------- |
| create | `POST` … **`/integration-clients`** | `integration-client:create` |
| list | `GET` … **`/integration-clients`** | `integration-client:read` |
| rotate-secret | `POST` … **`/integration-clients/{id}/regenerate-secret`** | `integration-client:update` |
| delete | `DELETE` … **`/integration-clients/{id}`** | `integration-client:delete` |
| update-groups | `PUT` … **`/integration-clients/{id}/groups`** | `integration-client:update` |
| update-redirect-uris | `PUT` … **`/integration-clients/{id}/redirect-uris`** | `integration-client:update` |

Full paths: prefix **`/api/v1`** on controller base URL inside **`ApiClient`**.

## Tasks (checklist)

- [x] Add **`lib/api/integration-clients.api.js`** — functions mirror old module (create, list, get-by-id if needed, regenerateSecret, delete, updateGroups, updateRedirectUris) with new URLs and JSON bodies matching OpenAPI.
- [x] Add **`lib/api/types/integration-clients.types.js`** — list/create response shapes (camelCase).
- [x] Deprecate/remove **`lib/api/service-users.api.js`** exports used by CLI; update **`lib/api/index.js`** if it re-exports domain modules.
- [x] Replace **`lib/commands/service-user.js`** with **`lib/commands/integration-client.js`** — rename runners (`runIntegrationClientCreate`, …); adjust **create** CLI options from **username/email** to **key + display name** (and optional **keycloak-client-id**).
- [x] Replace **`lib/cli/setup-service-user.js`** with **`lib/cli/setup-integration-client.js`** — command group **`integration-client`**; update **`HELP_AFTER`** examples and permission strings in messages.
- [x] **`lib/cli/index.js`** — call **`setupIntegrationClientCommands`** instead of **`setupServiceUserCommands`**.
- [x] **`lib/utils/help-builder.js`** — category entry **`integration-client`** (replace **`service-user`**).
- [x] **Tests** — migrate **`tests/lib/api/service-users.api.test.js`** → **`integration-clients.api.test.js`**; **`tests/lib/commands/service-user.test.js`** → **`integration-client.test.js`**; update **`tests/lib/utils/help-builder.test.js`**, **`tests/manual/api-service-users.test.js`** (rename or replace paths).
- [x] **`.cursor/rules/cli-output-command-matrix.md`** — replace six **`aifabrix service-user …`** rows with **`aifabrix integration-client …`** (same **tty-summary** profile).
- [x] **Documentation**
  - **`docs/commands/application-management.md`** — sections **`aifabrix integration-client …`** (anchors); **create** examples (**key**, **display name**, Postman example).
  - **`docs/commands/permissions.md`** — permission rows and summary bullets **`integration-client:*`**.
  - **`docs/commands/README.md`** — links and command names under Application & Management.
- [x] Optional: **`permissions-guide.md`** / **`docs/commands/cli-reference.md`** — not present in repo; **`grep service-user docs/`** limited to historical/plan context where applicable.

## Risk / notes

- **UX:** Users typing **`aifabrix service-user`** will get “unknown command”; direct them to **`aifabrix integration-client --help`** and **`docs/commands/application-management.md`** (changelog/release note optional).
- **Payload:** Integration client **create** rejects legacy username/email; CLI must validate **key** format (align with controller Zod: lowercase alphanumeric + hyphens).

---

## Plan Validation Report

**Date**: 2026-05-05  
**Plan**: `.cursor/plans/131-service-users-rectoring.plan.md`  
**Status**: ✅ **VALIDATED**

### Plan Purpose

Refactor Builder CLI and **`docs/commands/`** from **`service-user`** / legacy controller paths to **`integration-client`** commands and **`integration-client:*`** permissions, aligned with MISO Controller Integration Clients API.

### Applicable Rules

- ✅ **[Quality Gates / Build & test](../rules/project-rules.mdc)** — DoD documents **`npm run lint`**, **`npm test`**, **`npm run build`** consistent with **`package.json`**.
- ✅ **[CLI Command Development](../rules/project-rules.mdc)** — Tasks cover Commander setup, **`lib/api/`**, error handling.
- ✅ **[Testing Conventions](../rules/project-rules.mdc)** — Explicit test file migrations listed.
- ✅ **[Code Quality Standards](../rules/project-rules.mdc)** — File/function limits and JSDoc called out in Rules + DoD.
- ✅ **[CLI layout](../rules/cli-layout.mdc)** — **`cli-output-command-matrix.md`** + **help-builder** included in tasks.
- ✅ **[docs-rules](../rules/docs-rules.mdc)** — Scope limits user docs to command-centric updates; table above is contributor-only alignment.

### Rule Compliance

- ✅ **DoD:** Build / lint / test sequence documented (Builder **`build`** = **`lint && test`**; **`build:ci`** noted for CI).
- ✅ **Rule references:** **Rules and Standards** + **Before Development** link **`../rules/project-rules.mdc`** and **`cli-layout`**, **`docs-rules`**.
- ✅ **Tasks:** Cover API, commands, CLI wiring, tests, matrix, docs.

### Plan Updates Made (validate-plan step)

- ✅ Added **Overview**, **Scope**, **Controller alignment** table, **Tasks**, **Risks**.
- ✅ Added **Rules and Standards**, **Before Development**, **Definition of Done** per **`validate-plan`** command.
- ✅ Added YAML **frontmatter** with **`todos`** for tracking.
- ✅ Appended **Plan Validation Report** to this file.

### Recommendations

- During implementation, run **`grep -r service-user lib docs tests`** and burn down stragglers.
- Consider a single **`CHANGELOG`** or release note snippet for CLI breaking rename (if repo maintains one).

---

## Implementation Validation Report

**Date**: 2026-05-06  
**Plan**: `.cursor/plans/131-service-users-rectoring.plan.md`  
**Status**: ✅ **COMPLETE**

### Executive Summary

Implementation matches the plan: **`integration-client`** CLI and **`lib/api/integration-clients.api.js`** are wired to Controller **`/api/v1/integration-clients`** with **`integration-client:*`** permissions; legacy **`service-user`** modules are removed from **`lib/`**; unit and manual tests exist; **`npm run lint:fix`**, **`npm run lint`**, and **`npm test`** all exit **0** with **zero ESLint warnings** on the lint pass documented below.

### Task Completion

| Area | Status |
|------|--------|
| YAML frontmatter todos (`api-client-and-types` … `dod-build-lint-test`) | All **completed** |
| Markdown body checklist (“Tasks (checklist)”) | All items marked **[x]** (aligned with repo state) |
| “Before Development” pre-flight bullets | Informational only (not execution gates) |

### File Existence Validation

| Path | Status |
|------|--------|
| `lib/api/integration-clients.api.js` | ✅ Present |
| `lib/api/types/integration-clients.types.js` | ✅ Present |
| `lib/commands/integration-client.js` | ✅ Present |
| `lib/cli/setup-integration-client.js` | ✅ Present |
| `lib/cli/index.js` wires `setupIntegrationClientCommands` | ✅ Verified |
| `lib/utils/help-builder.js` lists `integration-client` | ✅ Verified |
| `lib/api/service-users.api.js`, `lib/commands/service-user.js`, `lib/cli/setup-service-user.js` | ✅ Removed (not present) |
| `.cursor/rules/cli-output-command-matrix.md` — six `aifabrix integration-client …` rows | ✅ Present |
| `.cursor/plans/routes.md` — Builder alignment paragraph | ✅ Present |
| `templates/applications/miso-controller/rbac.yaml` — `integration-client:*` | ✅ Present |
| `tests/lib/api/integration-clients.api.test.js` | ✅ Present |
| `tests/lib/commands/integration-client.test.js` | ✅ Present |
| `tests/manual/api-integration-clients.test.js` | ✅ Present |
| `tests/lib/utils/help-builder.test.js` — updated expectations | ✅ Present |

### Test Coverage

| Check | Result |
|-------|--------|
| Unit tests mirror **`lib/api`** / **`lib/commands`** layout | ✅ |
| **`integration-clients.api`** and **`integration-client`** command covered (create/list/rotate/delete/update paths, mocks, exit paths) | ✅ |
| Help-builder category includes **`integration-client`** | ✅ |
| Manual suite **`tests/manual/api-integration-clients.test.js`** for real Controller list | ✅ (excluded from default **`npm test`** per repo config) |

### Code Quality Validation

| Step | Command | Result |
|------|---------|--------|
| 1 Format / fix | `npm run lint:fix` | ✅ Exit **0** |
| 2 Lint | `npm run lint` | ✅ Exit **0** (0 errors, 0 warnings) |
| 3 Tests | `npm test` | ✅ Exit **0** — all suites passed |

### Cursor Rules Compliance (spot-check)

| Topic | Assessment |
|-------|------------|
| **`lib/api`** uses **`ApiClient`** from **`lib/api/index.js`** | ✅ |
| **`@requiresPermission`** uses **`integration-client:*`** in **`integration-clients.api.js`** | ✅ |
| Commander setup uses **`handleCommandError`** in **`setup-integration-client.js`** | ✅ |
| User **`docs/commands/`** remain command-centric (no REST tutorials); **`service-user`** absent from **`docs/commands/`** | ✅ **`grep service-user docs/commands`** → no matches |
| No secrets logged in new flows (secrets shown only as intentional CLI output for one-time secret) | ✅ |

### Implementation Completeness

| Item | Status |
|------|--------|
| Controller HTTP alignment (create/list/regenerate/delete/groups/redirect-uris) | ✅ Implemented in **`integration-clients.api.js`** |
| CLI create payload (**key**, **displayName**, optional **keycloakClientId**, **redirectUris**, **groupNames**) | ✅ |
| Documentation (**application-management**, **permissions**, **README**) | ✅ **`integration-client`** only in **`docs/commands`** |
| Database / migrations | N/A (out of scope) |

### Issues and Recommendations

- **`CHANGELOG.md`** may still describe historical **`service-user`** CLI; optional editorial update for release notes only (not blocking).
- **`CHANGELOG.md`** updates apply only if the team maintains history there.

### Final Validation Checklist

- [x] Plan tasks completed (frontmatter + body checklist)
- [x] Expected files exist; legacy **`service-user`** **`lib`** modules absent
- [x] Tests exist for new API and commands; help-builder updated
- [x] **`npm run lint:fix`** → **`npm run lint`** → **`npm test`** all pass (**0** lint warnings on full lint)
- [x] **`docs/commands`** free of **`service-user`** references
- [x] Implementation validation report appended to this plan file
