---
name: Add build.reloadStart for run --reload
overview: Add an optional `build.reloadStart` field to application.yaml so that when running with `aifabrix run <app> --reload`, the container command can be overridden (e.g. `pnpm run reloadStart` for TypeScript, `make reloadStart` for Python) instead of the image default CMD.
todos: []
isProject: false
---

# Add build.reloadStart for run --reload

## Context

When you run `aifabrix run miso-controller --reload`, the builder:

1. Mounts your app code (e.g. `/workspace/aifabrix-miso`) at `/app` in the container via `build.context`.
2. Starts the container using the **image’s default CMD** (from the Dockerfile).

You want to configure a **reload start command** so that when running with `--reload`, the container runs that command instead of the image CMD (e.g. a pnpm script or make target for dev/watch mode).

## Approach

- Add optional `**build.reloadStart`** in `application.yaml`: a string command run from the mounted app root `/app` (e.g. `pnpm run reloadStart` for TypeScript, `make reloadStart` for Python).
- When generating Docker Compose for run, if **both** `devMountPath` (i.e. `--reload` is in effect) **and** `build.reloadStart` are set, pass a **command override** into the compose template so the service runs that command inside the container (e.g. `sh -c "cd /app && <reloadStart>"`).
- No change to `run` or `--reload` flags; only the compose generation and template change when this config is present.

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc):

- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** — Build (lint + test) must succeed before commit; lint zero errors; tests pass; ≥80% coverage for new code.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** — Files ≤500 lines, functions ≤50 lines; JSDoc for public functions.
- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** — Schema in `lib/schema/`, JSON Schema format; validate before use.
- **[Template Development](.cursor/rules/project-rules.mdc#template-development)** — Handlebars in `templates/`; `{{#if}}` for conditionals; validate context and document variables.
- **[Docker & Infrastructure](.cursor/rules/project-rules.mdc#docker--infrastructure)** — Docker Compose patterns; validate compose output.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** — Jest; tests in `tests/` mirroring source; mock deps; 80%+ coverage for new code.

**Key requirements:** Run `npm run build` then fix lint and test; add tests for compose generator (reloadStart with/without devMountPath) and schema; no hardcoded secrets; JSDoc for any new/changed JS.

## Before Development

- Read Template Development and Docker & Infrastructure sections from project-rules.mdc.
- Review existing `compose-generator.js` and `templates/typescript/docker-compose.hbs` for patterns.
- Confirm test file for compose generator (e.g. `tests/lib/utils/compose-generator.test.js` or equivalent).

## Definition of Done

Before marking this plan complete:

1. **Build:** Run `npm run build` FIRST (must succeed — runs lint + test).
2. **Lint:** Run `npm run lint` (zero errors/warnings).
3. **Test:** Run `npm test` or `npm run test:ci` after lint (all tests pass; ≥80% coverage for new code).
4. **Order:** BUILD → LINT → TEST (do not skip steps).
5. **File size:** All modified/new files ≤500 lines; functions ≤50 lines.
6. **JSDoc:** Any new or changed public functions in `compose-generator.js` have JSDoc.
7. **Security:** No hardcoded secrets; `reloadStart` is user-controlled command string only.
8. **Tasks:** Schema, compose generator, both compose templates, miso-controller template, docs, and tests completed.

## Implementation

### 1. Schema: add `build.reloadStart`

**File:** [lib/schema/application-schema.json](lib/schema/application-schema.json)

- In the `build` object (around line 733), add a new optional property:
  - `**reloadStart`** (string): description like “When running with --reload, override the container command with this command (run from the mounted app root /app). Examples: TypeScript `pnpm run reloadStart`, Python `make reloadStart`.”
  - No `pattern` or minimal validation so any command string is allowed.

### 2. Compose generator: pass reload start command into template data

**File:** [lib/utils/compose-generator.js](lib/utils/compose-generator.js)

- In `generateDockerCompose` (around 472–484), when building `templateData`:
  - If `resolveDevMountPath(options)` is truthy **and** `appConfig.build?.reloadStart` is a non-empty string, set:
    - `reloadStartCommand: appConfig.build.reloadStart.trim()`
  - Otherwise set `reloadStartCommand: null` (or omit).

### 3. Docker Compose templates: add command override when `reloadStartCommand` is set

**Files:**

- [templates/typescript/docker-compose.hbs](templates/typescript/docker-compose.hbs)
- [templates/python/docker-compose.hbs](templates/python/docker-compose.hbs)
- In the main app service (after `env_file` / before or after `ports`), add a conditional block:
  - When `reloadStartCommand` is present, emit a `command:` that runs the string inside the container from `/app`, e.g.:
    - `command: ["sh", "-c", "cd /app && {{reloadStartCommand}}"]`
  - Document that complex commands (e.g. with quotes) may need care in YAML.
- Ensure this block is only when `reloadStartCommand` is set so the rest of the compose (e.g. `devMountPath`, volumes) is unchanged.

### 4. Template app config: add example for miso-controller

**File:** [templates/applications/miso-controller/application.yaml](templates/applications/miso-controller/application.yaml)

- Under `build:` add:
  - `reloadStart: pnpm run reloadStart`
- (Or the exact script name used in that repo’s package.json, e.g. `reloadStart` / `start:dev` etc.) So new apps created from this template get a conventional reload command; existing deployments are unaffected.

### 5. Docs

- **Application YAML:** [docs/configuration/application-yaml.md](docs/configuration/application-yaml.md) — in the optional build options, document `build.reloadStart`: when set and when running with `--reload`, the container command is overridden; examples: TypeScript `pnpm run reloadStart`, Python `make reloadStart`.
- **Running / build:** [docs/running.md](docs/running.md) or [docs/building.md](docs/building.md) — one-line note that with `--reload`, if `build.reloadStart` is set, that command is used instead of the image CMD.

### 6. Tests

- **Compose generator:** In the test file that covers `generateDockerCompose`:
  - Add a case: options with `devMountPath` set and app config with `build.reloadStart: 'pnpm run reloadStart'` → generated YAML includes `command: ["sh", "-c", "cd /app && pnpm run reloadStart"]` for the app service.
  - Add a case: `devMountPath` set but no `build.reloadStart` → no `command` override.
  - Add a case: `build.reloadStart` set but no `devMountPath` → no `command` override (reloadStart is only for reload mode).
- **Schema:** If there is an application schema test, ensure `build.reloadStart` is accepted as an optional string.

## Behaviour summary


| Scenario                                                                               | Result                                                                     |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `aifabrix run miso-controller` (no --reload)                                           | No mount; image CMD; `build.reloadStart` ignored.                          |
| `aifabrix run miso-controller --reload`, no `build.reloadStart`                        | Mount at `/app`; image CMD.                                                |
| `aifabrix run miso-controller --reload` with `build.reloadStart: pnpm run reloadStart` | Mount at `/app`; container runs `sh -c "cd /app && pnpm run reloadStart"`. |


## Examples by runtime

- **TypeScript/Node:** `reloadStart: pnpm run reloadStart` (or `npm run reloadStart`); ensure the app’s package.json has a `reloadStart` (or equivalent) script that runs the dev server with watch/reload.
- **Python:** `reloadStart: make reloadStart` (or a direct command like `uv run watchfiles ...`); ensure the app’s Makefile (or docs) defines a `reloadStart` target for dev with reload.

## Dataplane / other apps

The same `build.reloadStart` mechanism can be used for dataplane or any other app: add in that app’s `application.yaml` a `reloadStart` command (e.g. `make reloadStart` or the repo’s dev script name). No code change needed beyond the single schema + compose + template + docs + tests above.

## Out of scope

- **Non-reload run:** We do not add a separate “run locally without Docker” command; the feature is strictly “when running the container with `--reload`, override the container command.”
- **Array form:** Supporting an array of arguments (exec form) can be a follow-up if needed; string form is sufficient for a single command (pnpm/make/script).

---

## Plan Validation Report

**Date:** 2025-02-23  
**Plan:** .cursor/plans/72-add_build.localstart_for_run_reload.plan.md  
**Status:** VALIDATED

### Plan Purpose

Add optional `build.reloadStart` to application.yaml so that `aifabrix run <app> --reload` can override the container command (e.g. `pnpm run reloadStart`, `make reloadStart`) instead of the image CMD. **Scope:** schema, compose-generator, Docker Compose templates (TypeScript + Python), miso-controller application template, docs, tests. **Type:** Development (feature), Template, Schema, Infrastructure.

### Applicable Rules

- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** — Mandatory build/lint/test and coverage; referenced in plan.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** — File/function size, JSDoc; plan includes in DoD.
- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** — Schema change in lib/schema; plan adds optional string property.
- **[Template Development](.cursor/rules/project-rules.mdc#template-development)** — Handlebars compose templates; plan uses `{{#if reloadStartCommand}}` and context variable.
- **[Docker & Infrastructure](.cursor/rules/project-rules.mdc#docker--infrastructure)** — Compose generation and service command override; plan aligns.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** — Plan requires tests for compose generator and schema.

### Rule Compliance

- DoD requirements: Documented (build first, lint, test, order, file size, JSDoc, security, tasks).
- Quality Gates: Build/lint/test and coverage referenced in Rules and DoD.
- Template/Docker: Conditional command in templates; compose generator passes `reloadStartCommand` only when devMountPath + reloadStart set.
- Testing: Plan specifies three compose test cases and schema acceptance.
- Security: reloadStart is a user-controlled command string; no secrets in config.

### Plan Updates Made

- Added **Rules and Standards** with links to project-rules.mdc (Quality Gates, Code Quality, Validation, Template, Docker, Testing).
- Added **Before Development** checklist (read rules, review compose/templates, confirm test file).
- Added **Definition of Done** (build → lint → test order, file size, JSDoc, security, all tasks).
- Appended this **Plan Validation Report**.

### Recommendations

- When implementing, run `npm run build` after changes and fix any lint or test failures.
- Ensure compose generator tests use the same test file that already covers `generateDockerCompose` (e.g. compose-generator.test.js).
- If the compose template value contains special YAML characters, document escaping in application-yaml docs.

---

## Implementation Validation Report

**Date:** 2025-02-23  
**Plan:** .cursor/plans/72-add_build.localstart_for_run_reload.plan.md  
**Status:** COMPLETE

### Executive Summary

All plan tasks are implemented. The schema was missing `build.reloadStart` and was added during validation; all other items (compose generator, both Docker Compose templates, miso-controller and dataplane application templates, docs, tests) were already in place. Format (lint:fix), lint, and test were run; all tests pass (4613 passed). One pre-existing lint warning remains in `lib/app/run-helpers.js` (max-statements); it is unrelated to this plan.

### Task Completion


| Task                                                                        | Status                         |
| --------------------------------------------------------------------------- | ------------------------------ |
| 1. Schema: add `build.reloadStart`                                          | Done (added during validation) |
| 2. Compose generator: pass `reloadStartCommand` in template data            | Done                           |
| 3. Docker Compose templates: command override when `reloadStartCommand` set | Done (typescript + python)     |
| 4. Template app config: miso-controller + dataplane                         | Done                           |
| 5. Docs: application-yaml.md, running.md                                    | Done                           |
| 6. Tests: compose generator (3 cases)                                       | Done                           |


**Completion:** 6/6 (100%).

### File Existence Validation

- **lib/schema/application-schema.json** — `build.reloadStart` property added (string, optional).
- **lib/utils/compose-generator.js** — `reloadStartCommand` derived from `devMountPath` + `appConfig.build?.reloadStart`, passed in `templateData`.
- **templates/typescript/docker-compose.hbs** — `{{#if reloadStartCommand}}` block with `command: ["sh", "-c", "cd /app && {{reloadStartCommand}}"]`.
- **templates/python/docker-compose.hbs** — Same conditional command block.
- **templates/applications/miso-controller/application.yaml** — `reloadStart: pnpm run start:reload`.
- **templates/applications/dataplane/application.yaml** — `reloadStart: make start-reload`.
- **docs/configuration/application-yaml.md** — `build.reloadStart` documented in optional build options.
- **docs/running.md** — Note that with `--reload`, if `build.reloadStart` is set, that command is used instead of the image CMD.
- **tests/lib/compose-generator.test.js** — Three tests: (1) devMountPath + reloadStart → command present, (2) devMountPath only → no command, (3) reloadStart only → no command.

### Test Coverage

- Compose generator: three tests for `reloadStart` (with/without devMountPath and build.reloadStart).
- Full suite: 4613 tests passed, 211 suites.
- No new schema-specific test for `reloadStart`; the schema allows optional properties and compose tests cover usage.

### Code Quality Validation

- **Format (lint:fix):** Passed (exit 0).
- **Lint:** Passed, 0 errors; 1 pre-existing warning in `lib/app/run-helpers.js` (max-statements, unrelated to this plan).
- **Tests:** All passed (4613).

### Cursor Rules Compliance

- **Code reuse:** Compose generator reuses `resolveDevMountPath` and existing template data pattern.
- **Error handling:** No new async paths that skip try/catch; existing compose flow unchanged.
- **Logging:** No new logging; no secrets in config.
- **Type safety:** Schema and YAML docs define the new field; no new JSDoc required for the small compose-generator change.
- **Async patterns:** Existing async compose generation unchanged.
- **File operations:** Not applicable for this feature.
- **Input validation:** `reloadStart` trimmed and checked for non-empty string when used.
- **Module patterns:** CommonJS; no new modules.
- **Security:** No hardcoded secrets; `reloadStart` is a user-controlled command string only.

### Implementation Completeness

- **Schema:** Complete — `build.reloadStart` added to application-schema.json.
- **Compose generator:** Complete — `reloadStartCommand` in template data when devMountPath and reloadStart are set.
- **Templates:** Complete — TypeScript and Python compose templates include conditional command.
- **Application templates:** Complete — miso-controller and dataplane have `reloadStart` examples.
- **Documentation:** Complete — application-yaml.md and running.md updated. building.md has no mention; plan allowed “running or building” for the one-line note; optional to add to building.md later.
- **Tests:** Complete — three compose-generator tests cover the required cases.

### Issues and Recommendations

- **None blocking.** Optional: add a one-line note to `docs/building.md` about `build.reloadStart` for consistency with running.md.

### Final Validation Checklist

- All tasks completed (schema added during validation)
- All files exist and contain expected changes
- Tests exist and pass (compose-generator reloadStart tests + full suite)
- Format and lint pass (one pre-existing warning only)
- Cursor rules compliance verified
- Implementation complete

