---
name: Datasource capability dimension CLI
overview: Add a new Builder CLI leaf command `aifabrix datasource capability dimension` that adds/updates a root `dimensions.<dimensionKey>` binding (local or fk) in a datasource JSON, with pre-write semantic validation modeled after `capability relate` validation and consistent CLI output + tests.
todos:
  - id: validator
    content: Add `lib/datasource/capability/dimension-validate.js` (pure semantic validation; no CLI/auth logic).
    status: completed
  - id: operations
    content: Add `lib/datasource/capability/dimension-operations.js` (apply/upsert root dimensions binding; returns JSON Patch ops).
    status: completed
  - id: runner
    content: Add `lib/datasource/capability/run-capability-dimension.js` (resolve path, validate, apply, schema validate, backup, atomic write; dry-run support).
    status: completed
  - id: cli
    content: Add `lib/commands/datasource-capability-dimension-cli.js` and wire into `lib/commands/datasource-capability.js`.
    status: completed
  - id: tests
    content: Add Jest tests for validator, operations, and CLI wiring (including overwrite/dry-run/error paths).
    status: completed
  - id: docs-matrix
    content: Update `cli-output-command-matrix.md` and add/update command docs under `docs/commands/`.
    status: completed
isProject: false
---

## Goal

Add a Builder CLI command that **adds a new root `dimensions` binding** to a datasource JSON (like the HubSpot example), with **pre-write semantic validation** that mirrors the existing `aifabrix datasource capability relate` validation pattern.

- **Command**: `aifabrix datasource capability dimension <file-or-key> ...`
- **Edits**: root `dimensions` object in a datasource JSON
- **Validation**: schema validation + semantic checks (field/fk/via references) before write

## Key references (existing behavior)

- **Dimension/FK semantics** (Dataplane knowledgebase): [`/workspace/aifabrix-dataplane/knowledgebase/datasource-schema/dimensions-and-foreign-keys.md`](/workspace/aifabrix-dataplane/knowledgebase/datasource-schema/dimensions-and-foreign-keys.md)
  - Local dimension example: `{ "type": "local", "field": "country" }`
  - FK-backed dimension example: `{ "type": "fk", "actor": "email", "via": [{ "fk": "hubspotOwner", "dimension": "owner" }] }`
- **Existing “relate” semantic validation plumbing**:
  - Validator: [`/workspace/aifabrix-builder/lib/datasource/capability/relate-validate.js`](/workspace/aifabrix-builder/lib/datasource/capability/relate-validate.js)
  - Runner (loads local target, optionally fetches remote): [`/workspace/aifabrix-builder/lib/datasource/capability/run-capability-relate.js`](/workspace/aifabrix-builder/lib/datasource/capability/run-capability-relate.js)
  - CLI output conventions: [`/workspace/aifabrix-builder/lib/commands/datasource-capability-relate-cli.js`](/workspace/aifabrix-builder/lib/commands/datasource-capability-relate-cli.js)
- **Existing “dimensions catalog” API client (Builder → Controller)**:
  - API: [`/workspace/aifabrix-builder/lib/api/dimensions.api.js`](/workspace/aifabrix-builder/lib/api/dimensions.api.js) (includes `listDimensions`)
  - CLI (already exists): [`/workspace/aifabrix-builder/lib/commands/dimension.js`](/workspace/aifabrix-builder/lib/commands/dimension.js)

## Rules and standards (must follow)

This plan changes Builder CLI surface area and adds new command modules + tests. It must comply with:

- **Builder project rules**: [`/workspace/aifabrix-builder/.cursor/rules/project-rules.mdc`](/workspace/aifabrix-builder/.cursor/rules/project-rules.mdc)
  - Commander + CommonJS patterns, input validation, ISO rules (no secrets), Jest tests, file/function size limits, JSDoc requirements
  - Mandatory quality gates: `npm run build` → `npm run lint` → `npm test`
- **CLI layout rules**: [`/workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc`](/workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc)
  - Canonical glyphs (✔ ⚠ ✖) + shared helpers (`cli-test-layout-chalk`)
  - Add a **leaf command** row to `.cursor/rules/cli-output-command-matrix.md`
- **CLI user docs rules**: [`/workspace/aifabrix-builder/.cursor/rules/docs-rules.mdc`](/workspace/aifabrix-builder/.cursor/rules/docs-rules.mdc)
  - Command-centric documentation; do **not** include raw HTTP endpoints/payloads in `docs/commands/**`

## Before development

- [ ] Review and follow the CLI layout glyph table + output profiles: [`/workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc`](/workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc)
- [ ] Add a matrix row for the new leaf command: `/workspace/aifabrix-builder/.cursor/rules/cli-output-command-matrix.md`
- [ ] Decide the output profile (recommended: **tty-summary** like `capability relate`, unless `--json` is introduced)
- [ ] Confirm we will reuse existing API client modules where needed (dimension catalog: `lib/api/dimensions.api.js`; datasource fetch: existing manifest resolver used by relate)

## Proposed CLI UX

Create a new leaf command under `datasource capability`:

- **Local binding**:
  - `aifabrix datasource capability dimension <file-or-key> --dimension <key> --type local --field <normalizedAttr>`
- **FK binding**:
  - `aifabrix datasource capability dimension <file-or-key> --dimension <key> --type fk --via <fkName>:<dimensionKey> [--via ...] [--actor email|displayName|userId|groups|roles] [--operator eq|in]`

Shared options (match existing capability command behavior):

- `--dry-run` (print JSON Patch ops; no write)
- `--overwrite` (required if `dimensions.<key>` already exists)
- `--no-backup` (skip backup copy)

## Semantic validation rules (modeled after `relate`)

### Always (local/offline)

- **Dimension key format**: matches schema propertyNames `^[a-zA-Z0-9_]+$`.
- **No silent overwrite**: if `dimensions.<key>` exists and `--overwrite` not set → blocking error.
- **Type rules** (align with schema `dimensionBinding`):
  - `type=local`: requires `field` and forbids `via`.
  - `type=fk`: requires `via` and forbids `field`.
- **Local type=local**: ensure `field` exists in `metadataSchema.properties` (stronger than schema; matches how relate checks metadataSchema).
- **Local type=fk**:
  - Each `via[].fk` must exist as a `foreignKeys[].name` in the same datasource.
  - Each `via[].dimension` must be a non-empty string matching `^[a-zA-Z0-9_]+$`.

### When possible (best-effort “online” checks, same model as relate)

If source doc provides `systemKey`, attempt to fetch target datasource config(s) for any FK used in `via[]` (same resolver pathway already used by relate via `tryFetchDatasourceConfig`):

- For each `via[]` entry:
  - Resolve the FK row (`foreignKeys[].name === via.fk`) to get `targetDatasource`.
  - Load target datasource locally if present; else try remote fetch.
  - If target datasource config is available: validate that `via.dimension` exists as a key in `target.dimensions`.

Additionally, when authenticated (same auth model used by existing `aifabrix dimension list`), validate the **root dimension key** (`--dimension <key>`) exists in the **dimension catalog** by calling `listDimensions` via `lib/api/dimensions.api.js`.

- If not authenticated: warn and skip catalog check (do not block).
- If authenticated and key not found: blocking error (mirrors “unknown dimension key” behavior in deploy-time catalog validation).

User-visible behavior should match relate’s UX:

- Always log `✔ Local validation passed`
- If remote fetch succeeded for all needed targets: `✔ Remote validation passed`
- If remote fetch is skipped (not authenticated or no systemKey): `⚠ Remote validation skipped (not authenticated)`
- Warnings (non-blocking):
  - If `type=fk` and actor omitted: mirror existing warning intent in Builder warnings (`warnFkWithoutActor` in [`/workspace/aifabrix-builder/lib/validation/datasource-warnings.js`](/workspace/aifabrix-builder/lib/validation/datasource-warnings.js))

## Implementation outline (files)

### 1) Add pure validator

- Create `lib/datasource/capability/dimension-validate.js`
  - Pattern-match `relate-validate.js`: **no CLI/auth logic**, just takes `{ localContext, remoteManifestsByDatasourceKey }` (or similar) and returns `{ ok, errors, warnings, resolved }`.

### 2) Add pure mutation operations

- Create `lib/datasource/capability/dimension-operations.js`
  - `applyCapabilityDimension(doc, opts)`:
    - Upsert into `dimensions` object
    - Return `{ doc, patchOperations, updatedSections, replaced }`
  - Reuse the JSON Patch style used by relate (`op: add|replace`), so `--dry-run` output stays consistent.

### 3) Add runner (file IO + optional remote fetch)

- Create `lib/datasource/capability/run-capability-dimension.js`
  - Mirror `run-capability-relate.js` structure:
    - Resolve input path via `resolveValidateInputPath` (from [`/workspace/aifabrix-builder/lib/datasource/validate.js`](/workspace/aifabrix-builder/lib/datasource/validate.js))
    - Read/parse JSON
    - Perform semantic validation (local + optional remote)
    - Apply mutation
    - Run `validateDatasourceParsed` on the mutated doc
    - Backup + atomic write (reuse `writeBackup` + `atomicWriteJson` from `run-capability-copy.js`)

### 4) Add CLI command

- Add `lib/commands/datasource-capability-dimension-cli.js`
  - Follow patterns in `datasource-capability-relate-cli.js`:
    - commander options
    - consistent success/warn output via `cli-test-layout-chalk`
    - `--dry-run` prints JSON Patch operations
- Wire it into `lib/commands/datasource-capability.js` next to `setupCapabilityRelateCommand`.

### 5) Tests

- Add Jest tests similar in style to existing capability tests:
  - `tests/lib/commands/datasource-capability-dimension-cli.test.js` (CLI action wiring, option parsing, error surfaces)
  - `tests/lib/datasource/capability-dimension-operations.test.js` (pure mutation logic)
  - `tests/lib/datasource/capability-dimension-validate.test.js` (semantic validator; local validation + remote-skipped path)

Remote validation should be tested with mocked `tryFetchDatasourceConfig`, ensuring:

- not authenticated → warns/skips
- remote config present → validates `via.dimension` existence

### 6) Docs + output matrix

- Update `.cursor/rules/cli-output-command-matrix.md` with a new leaf row for `datasource capability dimension`.
- Add user docs under `docs/commands/external-integration/` (command-centric per docs rules; no REST details), alongside the other datasource-capability commands.

## Non-goals (explicit)

- **No “CIP input enforce” work in this plan** (explicitly skipped).
- No dataplane backend changes.

## Definition of done

- `aifabrix datasource capability dimension` exists and edits root `dimensions`.
- Pre-write validation blocks invalid bindings and matches relate-style UX for offline/online validation messaging.
- Mutated JSON passes `validateDatasourceParsed`.
- CLI output matrix + docs updated.
- Builder quality gates pass: `npm run build` → `npm run lint` → `npm test`.

## Plan Validation Report

**Date**: 2026-05-07  
**Plan**: `/workspace/aifabrix-builder/.cursor/plans/135-datasource_capability_dimension_cli.plan.md`  
**Status**: ✅ VALIDATED

### Plan purpose

Add a new Builder CLI leaf command that edits datasource root `dimensions` bindings (local and FK-backed), using relate-style pre-write semantic validation and consistent CLI output/testing patterns.

### Applicable rules

- ✅ [`/workspace/aifabrix-builder/.cursor/rules/project-rules.mdc`](/workspace/aifabrix-builder/.cursor/rules/project-rules.mdc) — CLI patterns, security, testing, quality gates
- ✅ [`/workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc`](/workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc) — glyphs/helpers + output matrix for new leaf commands
- ✅ [`/workspace/aifabrix-builder/.cursor/rules/docs-rules.mdc`](/workspace/aifabrix-builder/.cursor/rules/docs-rules.mdc) — command-centric docs (no REST tutorial content)

### Rule compliance checks

- ✅ **DoD quality gate order** documented: build → lint → test
- ✅ **Leaf command matrix update** included
- ✅ **Input validation + non-secret logging** covered by referenced rules

### Updates made during validation

- ✅ Added **Rules and standards** section with required rule references
- ✅ Added **Before development** checklist
- ✅ Expanded online validation to optionally verify **dimension catalog key existence** via existing Builder API client (`lib/api/dimensions.api.js`)

## Implementation Validation Report

**Date**: 2026-05-07  
**Plan**: `/workspace/aifabrix-builder/.cursor/plans/135-datasource_capability_dimension_cli.plan.md`  
**Status**: ✅ COMPLETE

### Executive summary

Implemented `aifabrix datasource capability dimension` end-to-end (ops + semantic validation + runner + CLI), with unit tests covering mutation logic, semantic validation, CLI wiring, and runner critical paths (dry-run/write/backup, via parsing, remote target fetch path, and authenticated catalog enforcement).

### Task completion

All plan frontmatter todos are now marked **completed**.

### File existence validation

- ✅ `lib/datasource/capability/dimension-operations.js`
- ✅ `lib/datasource/capability/dimension-validate.js`
- ✅ `lib/datasource/capability/run-capability-dimension.js`
- ✅ `lib/commands/datasource-capability-dimension-cli.js`
- ✅ `lib/commands/datasource-capability.js` (wired command)
- ✅ `.cursor/rules/cli-output-command-matrix.md` (leaf command row added)
- ✅ `docs/commands/external-integration/datasource-capabilities.md` (command documented)

### Test coverage validation

- ✅ Ops: `tests/lib/datasource/capability-dimension-operations.test.js`
- ✅ Validator: `tests/lib/datasource/capability-dimension-validate.test.js`
- ✅ CLI wiring: `tests/lib/commands/datasource-capability-dimension-cli.test.js`
- ✅ Runner critical paths: `tests/lib/datasource/run-capability-dimension.test.js`

### Code quality validation (mandatory order)

Executed in `/workspace/aifabrix-builder`:

- ✅ **Format**: `npm run lint:fix` (exit 0)
- ✅ **Lint**: `npm run lint` (exit 0; zero warnings/errors)
- ✅ **Test**: `npm test` (exit 0; all tests pass)

