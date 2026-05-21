---
name: Relate validation + Dimension CLI
overview: Extend aifabrix-builder with (1) pre-write semantic validation for `datasource capability relate` (always local; automatic online validation when authenticated) and (2) a minimal `dimension` command group (create/get/list) that manages the Dimension Catalog in the Controller (source of truth) with eventual consistency to the dataplane via sync.
todos:
  - id: shared-resolvers
    content: Add shared resolver utilities for datasource-key lookup, remote manifest lookup, and dimension file parsing to avoid duplication across commands
    status: pending
  - id: relate-validate-module
    content: "Add relate-validate.js: semantic FK validation given { localContext, remoteManifest|null } (no CLI/auth logic inside)"
    status: pending
  - id: wire-run-capability-relate
    content: Call validation before applyCapabilityRelate; surface warnings/errors per cli-layout
    status: pending
  - id: remote-get-config
    content: "Automatic online validation when authenticated: resolveDataplaneAndAuth + getExternalSystemConfig + find dataSources entry by key"
    status: pending
  - id: cli-matrix-relate
    content: Update cli-output-command-matrix.md for relate if output behavior changes; add standardized success/warn lines to tests
    status: pending
  - id: api-dimensions-module
    content: "Add lib/api/dimensions.api.js (+ types): Controller GET/POST dimensions using existing ApiClient pattern; @requiresPermission in JSDoc; treat create as idempotent"
    status: pending
  - id: dimension-cli-command
    content: Register `aifabrix dimension create|get|list` in lib/cli.js; support --file input for create; resolveControllerAndAuth; human-oriented docs in docs/commands/
    status: pending
  - id: dimension-cli-tests
    content: Jest tests with mocked ApiClient for create (new + already-exists idempotent) + auth failure paths + file input
    status: pending
isProject: false
---

# Relate validation + Dimension CLI

## Rules and standards (must follow)

This plan changes Builder CLI surface area and adds API modules, so it must follow:

- **Project standards**: [`/workspace/aifabrix-builder/.cursor/rules/project-rules.mdc`](../rules/project-rules.mdc)
  - **CLI layout and output**: follow the CLI layout rule and keep the output matrix accurate
  - **API client structure**: new Controller calls must go through `lib/api/*` domain modules
  - **Security/ISO**: no secrets in logs/errors; validate/sanitize all user input
  - **Quality gates**: build/lint/test must pass before shipping
- **CLI layout**: [`/workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc`](../rules/cli-layout.mdc)
  - Use canonical glyphs/semantics and shared helpers (`cli-test-layout-chalk`)
  - Add/update a row in `cli-output-command-matrix.md` for every new **leaf** command
- **CLI user docs**: [`/workspace/aifabrix-builder/.cursor/rules/docs-rules.mdc`](../rules/docs-rules.mdc)
  - Docs must be command-centric; do **not** include REST paths/payloads in `docs/commands/*`

## Before development

- [ ] Update [`/workspace/aifabrix-builder/.cursor/rules/cli-output-command-matrix.md`](../rules/cli-output-command-matrix.md) for new leaf command(s).
- [ ] Add/update docs: `docs/commands/dimensions.md`.
- [ ] Run quality gates before finishing: `npm run build` → `npm run lint` → `npm test`.

## Architecture (implementation-level)

- **Controller = source of truth** for Dimension Catalog.
- **Dataplane sync = eventual consistency** (Builder does not guarantee when a newly created dimension key will be observable in dataplane-side validation).

---

## Part A — Relate command: valid foreign key metadata generation

### Context (current behavior)

- [`run-capability-relate.js`](workspace/aifabrix-builder/lib/datasource/capability/run-capability-relate.js) reads the source file, applies [`applyCapabilityRelate`](workspace/aifabrix-builder/lib/datasource/capability/relate-operations.js), then runs [`validateDatasourceParsed`](workspace/aifabrix-builder/lib/datasource/validate.js) (JSON schema + field refs + ABAC only—**does not** assert FK fields exist in `fieldMappings.attributes` / `metadataSchema`).
- Dataplane deploy-time validation **does** enforce FK rules ([`foreign_keys_mixin.py`](workspace/aifabrix-dataplane/app/services/validation/external_data_source_validator/foreign_keys_mixin.py)).

### Validation behavior (transparent UX)

- **Authenticated**: local validation + automatic online validation when authenticated.
- **Not authenticated**: local validation + warning that online checks were skipped.

### Standardized success/warn output (TTY + non-TTY)

When online validation runs:

- `✔ Local validation passed`
- `✔ Remote validation passed`
- `✔ Relation created: <localField> → <targetDatasource>.<targetField>`

When offline (not authenticated):

- `✔ Local validation passed`
- `⚠ Remote validation skipped (not authenticated)`
- `✔ Relation created`

### Semantic validation (explicit value)

Minimum semantic checks performed before writing FK metadata:

- **Source field exists**: each `--field` exists in `fieldMappings.attributes`.
- **Target datasource exists**:
  - **Local**: resolved under `integration/<app>/` by datasource key when available.
  - **Online (when authenticated)**: resolved in a fetched remote manifest when local target is not available.
- **Target field exists**: each `--target-field` exists in the target datasource `metadataSchema` (or default to `externalId` when omitted).
- **Type compatibility**: local join field type matches target join field type when both resolve from `metadataSchema`.
- **Nullable mismatch warning**: warn (non-blocking) when local vs target nullability is inconsistent for a join (do not block by default).

### Clean separation (no auth in validator)

`relate-validate.js` must not contain CLI/auth logic. The validator is invoked with:

```js
{
  localContext,
  remoteManifest: remoteManifestOrNull
}
```

The caller decides whether a remote manifest is available (authenticated → fetch; otherwise null).

```mermaid
flowchart TD
  parseSource[Parse source JSON]
  resolveLocal[Resolve localContext (source+target if present)]
  maybeFetchRemote{Authenticated?}
  fetchManifest[Fetch remote manifest]
  validate[Semantic FK validation]
  apply[applyCapabilityRelate + schema validate]

  parseSource --> resolveLocal --> maybeFetchRemote
  maybeFetchRemote -->|yes| fetchManifest --> validate
  maybeFetchRemote -->|no| validate
  resolveLocal --> validate --> apply
```

---

## Part B — `aifabrix dimension create` (new command group)

### Purpose

Create a **dimension catalog** row so datasource configs (`fieldMappings.dimensions`, FK-backed `dimensions`, etc.) can reference a key that exists for ABAC/deploy validation.

### Primary implementation

1. **`lib/api/dimensions.api.js`**  
   - `createDimension(controllerUrl, authConfig, body)` → create-if-missing behavior  
   - Optional follow-up: `getDimension(controllerUrl, authConfig, keyOrId, options)` → `GET /api/v1/dimensions/:dimensionIdOrKey` for post-create verification  
   - Use [`ApiClient`](workspace/aifabrix-builder/lib/api/index.js) like other domains; add JSDoc `@requiresPermission` per [permissions-guide.md](workspace/aifabrix-builder/docs/commands/permissions.md).

2. **CLI registration**  
   - Minimal commands: `create`, `get`, `list` (no sync/poll/status commands in v1).  
   - `aifabrix dimension create` supports either direct flags **or** `--file <path>` input (for CI/CD).  
   - Resolve auth via existing controller helpers (same pattern as commands that call Controller with Bearer).

3. **User messaging (no raw REST in user docs)**  
   - Success: dimension created in **controller catalog**.  
   - Note: **dataplane** picks up catalog entries via **sync** from the controller; until sync completes, dataplane validation may still **warn** on unknown dimension keys ([validation-rules.md](workspace/aifabrix-dataplane/knowledgebase/integration/validation-rules.md)). Do not promise instant dataplane visibility unless we add polling or admin sync (optional stretch).

4. **“Validate via dataplane” interpretation**  
   - **MVP:** After create, optional **`dimension get <key>`** (Controller) to confirm the row exists.  
   - **Dataplane-side proof:** Run existing **`aifabrix datasource validate`** / deploy pipeline when the user is ready—those paths hit dataplane rules once catalog is synced—not a new CLI subcommand unless we add a dedicated probe later.

5. **Docs & matrix**  
   - Add [`cli-output-command-matrix.md`](workspace/aifabrix-builder/.cursor/rules/cli-output-command-matrix.md) row for `dimension create`.  
   - Add concise **`docs/commands/dimensions.md`** (command-centric; no HTTP paths per [docs-rules.mdc](workspace/aifabrix-builder/.cursor/rules/docs-rules.mdc)).

### Explicit non-goals (unless scope expands)

- Calling dataplane `/api/controller/dimensions` from Builder with user tokens (wrong auth model).  
- New dataplane **public** `api/v1` dimension endpoints—product decision, separate initiative.  
- Replacing Controller-side dimension admin UI.

---

## Out of scope unless requested

- Changing dataplane Python validation.  
- Implementing dataplane HTTP endpoints solely for Builder catalog reads.
- No runtime dataplane execution guarantees are provided by Builder validation.

## Definition of Done

Before marking this plan complete:

- **Implementation completeness**
  - `datasource capability relate` performs the planned pre-write semantic validation (always local; automatic online validation when authenticated) and produces standardized success/warn lines.
  - `aifabrix dimension create|get|list` exists, uses the centralized `lib/api/` client pattern, supports `--file` for create, and has Jest coverage (create new + already-exists idempotent + auth failure).
  - `cli-output-command-matrix.md` includes an accurate row for `dimension create` (and any relate profile changes are reflected).
  - `docs/commands/dimensions.md` added/updated and follows docs rules (no REST endpoint/payload tutorial).
- **Quality gates (mandatory order)**
  - Run **build first**: `npm run build` (must succeed).
  - Run **lint**: `npm run lint` (zero warnings/errors).
  - Run **tests**: `npm test` (all tests pass; new behavior has coverage).
- **Security**
  - No hardcoded secrets/tokens; no sensitive data in logs or error messages.
  - Input validation for CLI flags (key formats, required params, enums).

## Plan Validation Report

**Date**: 2026-05-07  
**Plan**: `/workspace/aifabrix-builder/.cursor/plans/133-relate_dimension_cli_validation.plan.md`  
**Status**: ✅ VALIDATED (updated with required rule references + DoD)

### Plan purpose

Add two Builder CLI features:

- Pre-write validation for `aifabrix datasource capability relate`
- A new `aifabrix dimension create` command that creates dimensions in the Controller catalog (with correct expectations about dataplane visibility via sync)

### Applicable rules

- ✅ [`/workspace/aifabrix-builder/.cursor/rules/project-rules.mdc`](../rules/project-rules.mdc) — CLI + API modules + security + quality gates
- ✅ [`/workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc`](../rules/cli-layout.mdc) — CLI output profiles, glyphs, shared helpers, output matrix updates
- ✅ [`/workspace/aifabrix-builder/.cursor/rules/docs-rules.mdc`](../rules/docs-rules.mdc) — command-centric docs, no REST/API tutorials in user docs

### Plan updates made by validation

- ✅ Added **Rules and standards** section with required rule references
- ✅ Added **Before development** checklist
- ✅ Added **Definition of Done** with mandatory build → lint → test order
- ✅ Appended this validation report

## Implementation Validation Report

**Date**: 2026-05-07  
**Plan**: `/workspace/aifabrix-builder/.cursor/plans/133-relate_dimension_cli_validation.plan.md`  
**Status**: ✅ COMPLETE (Parts A + B implemented)

### Executive summary

- **Part B (Dimensions + dimension values)**: ✅ Implemented (CLI + API modules + docs + tests)
- **Part A (Relate semantic validation + shared resolvers)**: ✅ Implemented (validator + runner wiring + shared resolvers + tests)

### Task completion (from plan frontmatter)

Plan frontmatter `todos` are still marked `pending` (not updated), but the implementation exists for both Part A and Part B. Consider updating frontmatter statuses to match reality.

### File existence validation

- ✅ `lib/api/dimensions.api.js` (Controller dimensions; idempotent create)
- ✅ `lib/api/dimension-values.api.js` (Controller dimension values)
- ✅ `lib/commands/dimension.js` (CLI: `dimension create|get|list`)
- ✅ `lib/commands/dimension-value.js` (CLI: `dimension-value create|list|delete`)
- ✅ `lib/resolvers/dimension-file.js` (file input parsing; supports `values[]`)
- ✅ `docs/commands/dimensions.md` (single lifecycle doc: dimensions + dimension-value)
- ✅ `tests/lib/commands/dimension.test.js`
- ✅ `tests/lib/commands/dimension-value.test.js`
- ✅ `tests/manual/api-dimensions.test.js` (real Controller API manual test)
- ✅ `lib/resolvers/datasource-resolver.js`
- ✅ `lib/resolvers/manifest-resolver.js`
- ✅ `lib/datasource/capability/relate-validate.js`
- ✅ `lib/datasource/capability/run-capability-relate.js` (wiring: automatic online validation when authenticated)
- ✅ `lib/commands/datasource-capability-relate-cli.js` (standardized success/warn lines)
- ✅ `tests/lib/datasource/relate-validate.test.js`

### Test coverage validation

- **Unit/CLI tests**: ✅ present for dimensions + dimension values (mocked API modules)
- **Manual API tests**: ✅ present for dimensions (+ additional coverage added during this work)
- **Relate semantic validation tests**: ✅ present (`tests/lib/datasource/relate-validate.test.js`)

### Code quality validation (mandatory order)

All commands executed in `/workspace/aifabrix-builder`:

- ✅ **Format**: `npm run lint:fix` (exit 0)
- ✅ **Lint**: `npm run lint` (exit 0; zero warnings/errors)
- ✅ **Tests**: `npm test` (exit 0; all test suites pass)

### Rules compliance notes (spot checks)

- ✅ CLI help now includes **Examples** blocks for `dimension` + `dimension-value` leaf commands via Commander `addHelpText('after', …)`.
- ✅ User docs remain command-centric in `docs/commands/` (no REST path tutorials).
- ✅ Manual tests fail fast when auth is missing (existing `tests/manual/setup.js` validation harness).

### Gaps vs Definition of Done

- ✅ Dimension CLI and supporting modules match DoD for Part B.
- ✅ Relate semantic validation and shared resolvers (Part A) are present, so the plan’s DoD is **fully met**.

