---
name: Remove --type and fix app path resolution
overview: "Remove the --type app | external option everywhere to close the loophole of deploying one key from different paths. Use a single resolution order: first integration folder, then builder folder; if neither exists, error."
todos: []
isProject: false
---

# Remove --type (app | external) and fix app path resolution

## Problem

The `--type app` and `--type external` options create a **loophole**: the same app key can be resolved from either `integration/<app>` or `builder/<app>`, which is ambiguous and error-prone. We should deploy (and operate on) **one key from one place**.

**Goal:** Delete the `--type` variable for path resolution everywhere. Use a **fixed resolution order** with no override:

1. Check **integration/** folder first
2. Then **builder/** folder
3. If neither exists → **error**

---

## Resolution rule (final behavior)


| Order | Location            | If found                               | If not found                                         |
| ----- | ------------------- | -------------------------------------- | ---------------------------------------------------- |
| 1     | `integration/<app>` | Use this path (external or app assets) | Try step 2                                           |
| 2     | `builder/<app>`     | Use this path (regular app)            | Go to step 3                                         |
| 3     | —                   | —                                      | **Error:** app not found in integration/ or builder/ |


No CLI flag may override this order. One key ⇒ one resolved path.

---

## Create command: keep `--type` and add validation

**Keep `--type` for create.** The create command must continue to support creating either an app or an external system, e.g.:

- `aifabrix create myapp` (or `--type webapp`, `api`, `service`, `functionapp`) → create app in **builder/**.
- `aifabrix create test-hubspot --type external` → create external system in **integration/**.

So `--type` on **create** means “what am I creating” (app kind vs external system), not “which path to use for an existing app.” That stays.

**Add validation on create:** Before creating a new app or external system, check if that name **already exists** in `integration/<name>` or `builder/<name>`. If it does, **error** and do not create (avoids overwriting or duplicate directories).


| Check                       | If exists | Action                                                                                                                                           |
| --------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `integration/<name>` exists | Yes       | Error: e.g. “App or external system '' already exists in integration/. Use a different name or remove integration/ if you intend to replace it.” |
| `builder/<name>` exists     | Yes       | Error: e.g. “App or external system '' already exists in builder/. Use a different name or remove builder/ if you intend to replace it.”         |
| Neither exists              | —         | Proceed with create (builder/ for app types, integration/ for external).                                                                         |


Implementation: in the create flow (e.g. `lib/cli/setup-app.js`, `lib/app/index.js`, or wherever create is handled), before creating any directory or files, call a small helper that checks `integration/<name>` and `builder/<name>` (e.g. `fs.existsSync` or `fs.promises.access`). If either exists, throw a clear error. Document this in the create command help and in docs (e.g. application-management, your-own-applications).

---

## Scope of removal

### Commands that currently accept `--type` for path resolution (remove the option and any branching on `options.type`)

- **deploy** – remove `--type`; resolve with order above; single deploy flow (external vs app is determined by what was found, not by flag).
- **json** – remove `--type`; resolve with same order.
- **validate** – remove `--type`; resolve with same order.
- **convert** – remove `--type`; resolve with same order.
- **split-json** – remove `--type`; resolve with same order (integration first, then builder, then error).
- **show** (if it has `--type`) – remove and use same resolution.
- Any other command that accepts `--type` **only for choosing integration vs builder** – remove it and use the fixed order.

### Code areas to update


| Area                                              | Change                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **lib/utils/paths.js**                            | `detectAppType(appName, options)` → remove use of `options.type`. Implement only: check integration first, then builder; if neither exists throw. Optionally simplify signature to `detectAppType(appName)` and remove `options` for path resolution.                                                                                                           |
| **lib/app/deploy.js**                             | Remove branching on `options.type === 'external'`; remove passing `options` into path resolution; single flow based on what `detectAppType` returned (isExternal from path, not from flag). Remove `logOfflinePathWhenType` calls if they only run when `options.type` is set; optionally keep a single “Using: ” log for all deploys.                          |
| **lib/app/deploy-config.js**                      | `loadDeploymentConfig(appName, options)` – stop passing `options` to `detectAppType` (or pass only non-type options). Return shape can keep `appPath` for logging.                                                                                                                                                                                              |
| **lib/generator/index.js**                        | `generateDeployJson(appName, options)` – remove `options.type`; call `detectAppType` without type override; remove or generalize `logOfflinePathWhenType` usage.                                                                                                                                                                                                |
| **lib/external-system/deploy.js**                 | No `options.type`; resolve path with fixed order; remove `logOfflinePathWhenType` if it was only for `--type`.                                                                                                                                                                                                                                                  |
| **lib/validation/validate.js**                    | Remove `options.type` and branching on `options.type === 'external'`; resolve with fixed order.                                                                                                                                                                                                                                                                 |
| **lib/commands/convert.js**                       | Remove `--type` option and path-resolution branching.                                                                                                                                                                                                                                                                                                           |
| **lib/cli/setup-utility.js**                      | Remove `--type` from json, split-json, show, validate (and any other utility commands that only used it for path resolution). Simplify `resolveSplitJsonApp` to use fixed order (integration first, then builder, then error). Remove `logOfflinePathWhenType` calls.                                                                                           |
| **lib/utils/cli-utils.js**                        | Remove `logOfflinePathWhenType` (or repurpose to always log “Using: ” with no `options.type` check).                                                                                                                                                                                                                                                            |
| **lib/cli/setup-app.js**                          | Keep `--type` only where it means **application kind** (webapp, api, service, functionapp, external) for **create**; remove any “Use app for builder only, external for integration only” style `--type` for path resolution. Add validation: before create, if integration/ or builder/ already has name, error (see Create command section). Clarify in docs. |
| **lib/cli/setup-external-system.js**              | Remove or narrow `--type` if it only affected path resolution; align with fixed order.                                                                                                                                                                                                                                                                          |
| **lib/generator/external-controller-manifest.js** | Remove reliance on `options.type` for path; use resolved path / isExternal from `detectAppType` only.                                                                                                                                                                                                                                                           |
| **lib/app/display.js**                            | Remove or update any “Run: aifabrix validate … --type external” to “Run: aifabrix validate …” and document resolution order.                                                                                                                                                                                                                                    |
| **lib/app/run.js**                                | Remove comment/reference to “--type app semantics”; run uses same resolution (builder only if that’s where app was resolved when we add run rules, or document that run is builder-only by design).                                                                                                                                                             |


### Documentation to update (remove or rewrite --type for path resolution)

- [docs/commands/deployment.md](docs/commands/deployment.md) – Remove `--type` from deploy; document resolution order (integration first, then builder, then error).
- [docs/commands/utilities.md](docs/commands/utilities.md) – Remove `--type` for json, split-json, show, validate where they refer to path resolution.
- [docs/commands/README.md](docs/commands/README.md) – Remove references to “--type app | external” for path resolution.
- [docs/commands/validation.md](docs/commands/validation.md) – Remove `--type`; document resolution order.
- [docs/commands/application-development.md](docs/commands/application-development.md) – Align with no --type for path.
- [docs/commands/external-integration.md](docs/commands/external-integration.md) – Remove path-resolution --type; document order.
- [docs/external-systems.md](docs/external-systems.md) – Same.
- [docs/wizard.md](docs/wizard.md) – Same.
- [docs/your-own-applications.md](docs/your-own-applications.md) – Same.
- [docs/deploying.md](docs/deploying.md) – Same.
- **Create command docs** (e.g. [docs/commands/application-management.md](docs/commands/application-management.md), [docs/your-own-applications.md](docs/your-own-applications.md)) – State that `aifabrix create <name> --type external` (and other types) is supported; and that create **fails with an error** if `integration/<name>` or `builder/<name>` already exists (use a different name or remove the existing directory).

In all path-resolution docs: state that the CLI **always** resolves an app by **first** looking in `integration/<app>`, **then** in `builder/<app>`, and errors if neither exists. No flag to override.

---

## Rules and Standards

This plan complies with [Project Rules](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** – Path resolution in one place (e.g. `lib/utils/paths.js`); no duplicate resolution logic; fix in source, not only generated artifacts.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – Clear UX: one resolution rule; remove options that create loopholes; chalk, try-catch, clear errors.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – Files ≤500 lines, functions ≤50 lines; JSDoc for changed functions.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Build, lint, test (≥80% for new/changed code); no hardcoded secrets.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Jest; update tests that relied on `--type app` or `--type external`; test resolution order (integration first, then builder, then error).
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – Clear error when app not found in integration/ or builder/.

**Key requirements**

- Single resolution order: integration first, then builder, then error. No `options.type` for path.
- Remove `--type` from all commands that used it only for path resolution; update docs accordingly.
- **Keep `--type` for create:** e.g. `aifabrix create test-hubspot --type external` (create new app or external system). `--type` here = application kind (webapp, api, service, functionapp, external), not path resolution.
- **Create validation:** If `integration/<name>` or `builder/<name>` already exists, error before creating; do not overwrite. Clear error message (e.g. “already exists in integration/ or builder/, use a different name”).
- Run build → lint → test in that order before marking done.

---

## Before Development

- Read Architecture Patterns and CLI Command Development in project-rules.mdc.
- List all call sites of `detectAppType(appName, options)` and all `.option('--type', ...)` that refer to path resolution.
- Confirm create flow entry point(s) (e.g. setup-app.js, app index) to add “already exists” check (integration/, builder/) before creating.
- Review docs list above and confirm no other files mention “--type app” or “--type external” for path.

---

## Definition of Done

**Feature completion**

- `--type app` and `--type external` are **removed** from deploy, json, validate, convert, split-json, show (and any other command that used them only for path resolution).
- **Create keeps `--type`:** e.g. `aifabrix create test-hubspot --type external` and other app types (webapp, api, service, functionapp) continue to work.
- **Create validation:** Before creating an app or external system, the CLI checks if `integration/<name>` or `builder/<name>` already exists; if either exists, it errors with a clear message and does not create (no overwrite). Documented in create help and relevant docs.
- Path resolution uses **only** the fixed order: 1) integration/, 2) builder/, 3) error if neither exists. No option overrides this.
- `detectAppType` (or equivalent) no longer accepts or uses `options.type` for path resolution; signature may be simplified to `detectAppType(appName)` where appropriate.
- `logOfflinePathWhenType` is removed or repurposed (e.g. always log “Using: ” without checking `options.type`).
- All documentation that mentioned “--type app” or “--type external” for path resolution is updated to describe the fixed resolution order and to remove the flag. Docs for **create** state that `--type` is for app kind (including external) and that create fails if the name already exists in integration/ or builder/.
- Tests updated: no tests rely on `--type app` or `--type external` for path; tests assert resolution order (integration first, then builder, then error). Tests added/updated for create validation (already-exists → error).

**Quality gates (mandatory order)** — see [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)

1. **Build**: Run `npm run build` first (must succeed; runs lint + test:ci).
2. **Lint**: Run `npm run lint` (zero errors and zero warnings).
3. **Test**: Run `npm test` (or `npm run test:ci`) after lint; all tests pass; ≥80% coverage for new/changed code.
4. **Order**: BUILD → LINT → TEST; do not skip steps.
5. **File size**: Files ≤500 lines, functions ≤50 lines.
6. **JSDoc**: All changed public functions have JSDoc.
7. **Security**: No hardcoded secrets; no sensitive data in log output.
8. All plan tasks completed.

---

## Plan Validation Report

**Date**: 2025-02-12  
**Plan**: .cursor/plans/58-deploy_type_app_path_and_offline_path_output.plan.md  
**Status**: ✅ VALIDATED (revised scope: remove --type, fixed resolution order)

### Plan Purpose

**Remove** the `--type app` and `--type external` options everywhere they are used for **path resolution**, to close the loophole of deploying one key from different paths. **Keep `--type` for create** (e.g. `aifabrix create test-hubspot --type external`). **Add create validation:** if the name already exists in integration/ or builder/, error and do not create. **Single resolution rule:** first check integration folder, then builder folder; if neither exists, error. Update all affected code and documentation. **Type:** Refactor (path resolution simplification, create validation, documentation).

### Applicable Rules

- ✅ [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns) – Path resolution in one place; no duplicate logic.
- ✅ [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development) – Remove confusing options; clear UX; error messages.
- ✅ [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) – File/function size, JSDoc.
- ✅ [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) – Build, lint, test, coverage.
- ✅ [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) – Update tests for new resolution; no --type.
- ✅ [Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging) – Clear “app not found” error.

### Rule Compliance

- ✅ DoD: Build → Lint → Test order, file size, JSDoc, security, all tasks.
- ✅ Scope: Commands, lib (paths, deploy, generator, validation, convert, setup-utility, cli-utils, etc.), and docs listed.
- ✅ Resolution order explicitly defined (integration → builder → error).

### Recommendations

- When implementing, do a repo-wide grep for `options.type`, `--type`, and “type app” / “type external” to catch every reference before and after changes. Do not remove `--type` from create; only from path-resolution commands.
- Keep a single source of truth for “integration first, then builder” (e.g. `detectAppType(appName)` with no type override) and use it from deploy, json, validate, convert, split-json, show.
- For create validation: check both integration and builder (e.g. getIntegrationPath(name), getBuilderPath(name)) before creating; if either directory exists, throw with a message that names the existing location and suggests using a different name or removing the directory.
- In docs, add one short “App path resolution” subsection that states the order and that there is no override flag. In create/docs, state that create fails if the app or external system name already exists in integration/ or builder/.

