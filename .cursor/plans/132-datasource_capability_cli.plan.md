---
name: Datasource capability CLI
overview: "Implement capability subcommands in aifabrix-builder with copy-first MVP: same-file JSON mutations, explicit profiles, JSON Patch dry-run, structured reference rewriting, collision/backup defaults, capability validate, symmetric remove, then UX/OpenAPI/relate (metadata-only v1)."
todos:
  - id: phase1-copy-mvp
    content: "Phase 1: copy + remove + --dry-run (JSON Patch) + AJV + rewriteCapabilityReferences + collision flags + backup + success footer; lib/datasource/capability/*"
    status: completed
  - id: phase1-cli-register
    content: Register datasource capability copy|remove|validate|create (alias add); datasource.js; HubSpot golden fixture test
    status: completed
  - id: phase1-profiles
    content: Early --profile / --as-profile on copy; --basic-exposure vs --basic documented
    status: completed
  - id: phase2-ux
    content: capability diff, --edit (inquirer); relate pipeline deferred
    status: completed
  - id: phase3-openapi
    content: create requires --from | --template | --openapi-operation; generate via dataplane-first OpenAPI
    status: pending
  - id: phase4-relate-meta
    content: relate v1 metadata-only (foreignKeys + optional mappings/schema); --relation-name; no pipeline until verified
    status: pending
  - id: docs-matrix
    content: Docs recommended workflow + cli-output-command-matrix.md + docs/commands per cli-layout
    status: completed
isProject: false
---

# Datasource capability CLI (builder alignment)

## Overview

Add **`datasource capability`** subcommands so developers **copy**, **remove**, and refine OpenAPI/CIP capability slices inside a single **`*-datasource-*.json`**, with validation, dry-run, explicit **`exposed.profiles`** handling, and metadata-only **`relate`** before any enrichment pipelines.

## Rules and Standards

This plan must comply with [`.cursor/rules/project-rules.mdc`](file:///workspace/aifabrix-builder/.cursor/rules/project-rules.mdc) and companion CLI docs:

| Topic | Rule file | Why it applies |
| ------|-----------|----------------|
| CLI layout, glyphs, output profiles | [`.cursor/rules/cli-layout.mdc`](file:///workspace/aifabrix-builder/.cursor/rules/cli-layout.mdc), [`.cursor/rules/cli-output-command-matrix.md`](file:///workspace/aifabrix-builder/.cursor/rules/cli-output-command-matrix.md) | New leaf commands and terminal output |
| User-facing command docs | [`.cursor/rules/docs-rules.mdc`](file:///workspace/aifabrix-builder/.cursor/rules/docs-rules.mdc) | Docs under `docs/commands/` — command-centric, no REST URLs |
| Architecture / module layout | **Architecture Patterns** in project-rules | `lib/commands/`, `lib/datasource/`, CommonJS |
| Commander, UX, tests | **CLI Command Development** | New subcommands under `datasource` |
| AJV / schemas | **Validation Patterns** | `external-datasource.schema.json` |
| File/function limits, JSDoc | **Code Quality Standards** | ≤500 lines / ≤50 lines per function; JSDoc on public APIs |
| Lint + test gate | **Quality Gates** | Mandatory before commit |
| Secrets / logs | **Security & Compliance**, **Error Handling & Logging** | No secrets in logs; ISO-minded handling |

**Key requirements (extract):**

- Register capability commands (pattern aligns with existing [`datasource.js`](file:///workspace/aifabrix-builder/lib/commands/datasource.js)); validate inputs; try/catch async actions; chalk for errors/success.
- Update **[cli-output-command-matrix.md](file:///workspace/aifabrix-builder/.cursor/rules/cli-output-command-matrix.md)** for every new leaf command.
- Tests live under **`tests/`**; target **≥80% coverage** for new code.
- Use **`path.join()`** for filesystem paths; never log sensitive data.

## Before Development

- [x] Read **CLI layout** + **cli-output-command-matrix** for output conventions.
- [x] Review existing datasource commands: [`validate`](file:///workspace/aifabrix-builder/lib/datasource/validate.js), [`diff`](file:///workspace/aifabrix-builder/lib/datasource/diff.js), [`datasource.js`](file:///workspace/aifabrix-builder/lib/commands/datasource.js).
- [x] Skim **`external-datasource.schema.json`** for `capabilities`, `openapi.operations`, `execution.cip.operations`, `exposed.profiles`, `foreignKeys`.
- [x] Confirm HubSpot companies fixture shape for golden tests.

## Definition of Done

Before merging implementation for this plan:

1. **`npm run lint`** — ESLint passes with **zero** errors on touched files (`eslint . --ext .js`).
2. **`npm test`** — Full test suite passes (invoked by build step).
3. **`npm run build`** — Runs **`lint` then `test`** per [`package.json`](file:///workspace/aifabrix-builder/package.json); must succeed (mandatory gate).
4. **`npm run build:ci`** — Use when verifying CI parity (`check:schema-sync`, `check:flags`, `test:ci`).
5. **File size** — New/edited files ≤**500** lines; functions ≤**50** lines (split modules if needed).
6. **JSDoc** — Public functions and new modules have **`@fileoverview`** / **`@function`** as per project-rules.
7. **Tests** — New commands/modules have Jest coverage; **≥80%** on new code where applicable.
8. **Security** — No hardcoded secrets; backups must not duplicate credential payloads from env.
9. **Documentation** — `docs/commands/` updated (workflow + new commands); matrix updated.
10. **Tasks** — All plan todos completed.

**Validation order note:** This repo’s **`npm run build`** is **lint → test** (no separate compile). Do not skip lint before tests.

---

## Reality check vs ad-hoc specs

| Spec assumption | Actual in [aifabrix-builder](file:///workspace/aifabrix-builder) |
|-----------------|------------------------------------------------------------------|
| New `cli/**/*.ts` tree | Builder is **JavaScript** (`lib/commands/`, `lib/datasource/`). Use **JSDoc `@typedef`** for internal shapes. |
| Per-capability YAML files | One **`*-datasource-*.json`** per datasource; parallel trees **`capabilities[]`**, **`openapi.operations.<name>`**, **`execution.cip.operations.<name>`** ([external-datasource.schema.json](file:///workspace/aifabrix-builder/lib/schema/external-datasource.schema.json)). |
| Abstract capability record | Real contract is schema-driven: OpenAPI op refs, CIP steps, **`exposed.profiles`**, optional **`restRuntime`** — see [test-e2e-hubspot-datasource-companies.json](file:///workspace/aifabrix-dataplane/integration/test-e2e-hubspot/test-e2e-hubspot-datasource-companies.json). |
| Local OpenAPI parse | Wizard uses **dataplane** parsing ([wizard-core.js](file:///workspace/aifabrix-builder/lib/commands/wizard-core.js)); optional local walker later. |
| Whole-file `datasource diff` | Already: `aifabrix datasource diff <file1> <file2>`. Capability-scoped diff remains a **new** subcommand. |

**Naming:** Keys match `^[a-z][a-zA-Z0-9_]*$`; normalize `--as` / `--as-profile` to legal keys.

---

## Command surface (prioritized)

Namespace: **`datasource capability`** — register via `setupDatasourceCapabilityCommands` in [lib/commands/datasource.js](file:///workspace/aifabrix-builder/lib/commands/datasource.js).

### Phase 1 (MVP): copy-first

| Command | Purpose |
| --------|---------|
| **`capability copy`** | Clone coordinated subtrees from `--from` → `--as`; primary developer workflow. |
| **`capability remove`** | Delete one capability: drop **`capabilities[]`** entry, **`openapi.operations.<name>`**, **`execution.cip.operations.<name>`**; optional **`exposed.profiles`** row; then AJV-validate. Mirrored safety to copy (`--dry-run`, backup, `--no-backup`). |
| **`capability validate`** | Structural + AJV for file or single **`--capability`** slice (after manual edits). |
| **`capability create`** | New capability **without** non-executable stubs — see creation sources below. Alias: **`add`**. |

Example (profiles explicit — no guessing):

```bash
aifabrix datasource capability copy companies \
  --from create \
  --as createBasic \
  --profile create \
  --as-profile createBasic
```

(`companies` = datasource key or path under `integration/<app>/`, same resolution as `datasource validate`.)

Example (**remove** — drop a capability and an exposure profile key when names align):

```bash
aifabrix datasource capability remove test-e2e-hubspot-companies \
  --capability createCliTrial \
  --profile createCliTrial \
  --dry-run
```

**`remove` semantics (normative):**

- **Required:** **`--capability <key>`** — capability key to delete (must match `^[a-z][a-zA-Z0-9_]*$`).
- **Remove from document:** remove **`key`** from **`capabilities[]`**; delete **`openapi.operations[key]`** and **`execution.cip.operations[key]`** if present — default: **fail** if the key is missing from all tracked locations unless **`--force`** (explicit no-op when already absent).
- **Profiles:** optional **`--profile <name>`** — also delete **`exposed.profiles[name]`** when authors named a profile after the capability or when removing a stale profile row explicitly. Do **not** delete unrelated profiles by default.
- **References elsewhere:** optional follow-up (Phase 2): strip **`testPayload.scenarios`** entries whose **`operation`** equals the removed key; Phase 1 may **warn** or require **`--prune-test-scenarios`** to avoid silent drift.
- Same **`--dry-run`** (JSON Patch of removals), **`backup/***.bak`**, **`--no-backup`**, **`validateDatasourceParsed`** before write, and **success footer** as **`copy`**.

**Creation sources for `create` / `add` (no placeholder OpenAPI/CIP):** require **at least one** of:

- **`--from <existing>`** — clone like copy but single-step scaffold from sibling capability.
- **`--template <name>`** — named template under `lib/datasource/capability/templates/` (executable-shaped defaults).
- **`--openapi-operation <operationId>`** — bind to resolved OpenAPI operation (Phase 3 wiring).

### Phase 2+

- **`capability diff`** — `--capability-a` / `--capability-b` (subtrees + optional profiles).
- **`capability edit`** — interactive (`inquirer`).
- **`capability generate`** — bulk read ops (Phase 3).
- **`capability relate`** — v1 **metadata-only** (see Phase 4).

---

## Phase 1 — MVP: **copy** + **`remove`** + `--dry-run` + validation + same-file mutation

**Priority order:** (1) **`copy`**, (2) **`remove`** (inverse mutation reusing shared **`removeCapability`**-style helpers), (3) **`--dry-run`**, (4) **AJV validation**, (5) **atomic write** — defer **`create`** until copy/remove paths + profiles + collision + backup are solid.

### Resolve path and IO

Reuse key/path resolution from [validate](file:///workspace/aifabrix-builder/lib/datasource/validate.js) / [paths](file:///workspace/aifabrix-builder/lib/utils/paths.js). Load JSON → mutate in memory → validate → write atomically.

### `copy` behavior

For source **`from`**, target **`as`**:

- Deep-clone **`openapi.operations[from]`** → **`openapi.operations[as]`**.
- Deep-clone **`execution.cip.operations[from]`** → **`execution.cip.operations[as]`**.
- Append **`as`** to **`capabilities[]`** (unique).
- **Profiles (early):** If **`--profile`** and **`--as-profile`** are set, deep-copy **`exposed.profiles[profile]`** → **`exposed.profiles[asProfile]`**. If omitted, **do not** auto-guess profile linkage.

### `rewriteCapabilityReferences(object, from, to)`

Walk cloned **`openapi`** / **`cip`** subtrees; rewrite **only known keys** when values equal old capability id:

`openapiRef`, `operation`, `operationRef`, `capability`, `dependsOn`, `sourceOperation` — **no** blind global string replace in Phase 1.

### Collision strategy

| Flag | Behavior |
|------|----------|
| **`--fail-if-exists`** | Default: exit non-zero if **`as`** already exists in `capabilities`, `openapi.operations`, or `execution.cip.operations`. |
| **`--overwrite`** | Replace existing **`as`** subtrees (document destructive scope). |
| **`--suffix`** | Same as **`--auto-suffix`**: deterministic rename on conflict (e.g. `createBasic2`). |

### JSON Patch + `--dry-run`

Compute **RFC 6902 JSON Patch** before write; **`--dry-run`** prints Patch + human-readable diff; exit 0; no write.

### Rollback protection

Before write, copy original to **`backup/<basename>.<timestamp>.bak`**; **`--no-backup`** skips.

### Success footer (mutating commands)

```text
Updated:
  capabilities[]: …
  openapi.operations.…
  execution.cip.operations.…
  exposed.profiles.…

Next:
  aifabrix datasource validate <file-or-key>
```

### `remove` behavior

- Implement **`applyCapabilityRemove(doc, { capability, profile?, pruneTestScenarios? })`** returning **`doc`**, **`patchOperations`**, **`updatedSections`** (mirror **`applyCapabilityCopy`** structure for **`runCapabilityRemove`**).
- Reuse path resolution + **`validateDatasourceParsed`** + backup + atomic write from the same runner pattern as **`run-capability-copy.js`**.
- Default **fail** if **`--capability`** is absent from **`capabilities[]`**, **`openapi.operations`**, and **`execution.cip.operations`** (nothing to do / typo guard), unless **`--force`** is specified for explicit no-op or partial deletes (document exact semantics in CLI help).

### Golden fixture test

Use HubSpot companies datasource; copy `create` → disposable key with **`--profile` / `--as-profile`**; assert AJV valid; assert **`openapi.operations.create`** unchanged; unit-test **`rewriteCapabilityReferences`**. Add remove round-trip: **`remove`** the disposable key and assert schema-valid file and absence of dropped keys.

---

## Phase 2 — UX

- **`--basic-exposure`** vs **`--basic`** (shortcut): reduce **`exposed.profiles`** from **`metadataSchema`** (required + primitives only) — **implemented** on **`capability copy`** / **`create`** with **`--as-profile`**.
- **`capability diff`**, **`capability edit`** — **implemented** (`inquirer` + `$EDITOR` for edit; TTY required).

---

## Phase 3 — OpenAPI-assisted `create` / `generate`

Prefer dataplane/wizard reuse; **`generate --type read`** from templates under `lib/datasource/capability/templates/`.

---

## Phase 4 — `relate` (v1 metadata-only)

No CIP pipeline until runtime semantics verified.

```bash
aifabrix datasource capability relate deals \
  --to companies \
  --field companyId \
  --target-field externalId \
  --relation-name company
```

v1 touches: **`foreignKeys[]`**; optional **`fieldMappings.attributes`**; optional **`metadataSchema.properties.<relationName>`**. **`--relation-name`** required.

---

## Documentation

Recommended workflow (command-centric):

```text
wizard → datasource validate → capability copy (profiles) → edit exposed if needed → validate → upload/deploy
# rollback experiment:
capability remove <key> [--profile …] → datasource validate → upload/deploy
```

---

## Plan Validation Report

**Date**: 2026-05-06  
**Plan**: [`.cursor/plans/132-datasource_capability_cli.plan.md`](file:///workspace/aifabrix-builder/.cursor/plans/132-datasource_capability_cli.plan.md)  
**Status**: ✅ **VALIDATED**

### Plan purpose

**Type:** Development (CLI + library modules + tests + docs).

Implement **`datasource capability`** commands in the AI Fabrix Builder to mutate external datasource JSON (**capabilities**, **openapi.operations**, **execution.cip.operations**, **exposed.profiles**, later **foreignKeys**) with copy-first workflow and **symmetric remove**, schema validation, dry-run via JSON Patch, and ISO-aligned quality gates.

### Applicable rules

- ✅ [**CLI layout and output**](file:///workspace/aifabrix-builder/.cursor/rules/project-rules.mdc) — references **cli-layout.mdc** and output matrix (required for new commands).
- ✅ [**CLI Command Development**](file:///workspace/aifabrix-builder/.cursor/rules/project-rules.mdc) — Commander pattern, validation, chalk, tests.
- ✅ [**Validation Patterns**](file:///workspace/aifabrix-builder/.cursor/rules/project-rules.mdc) — AJV + `external-datasource.schema.json`.
- ✅ [**Code Quality Standards**](file:///workspace/aifabrix-builder/.cursor/rules/project-rules.mdc) — file/function limits, JSDoc.
- ✅ [**Quality Gates**](file:///workspace/aifabrix-builder/.cursor/rules/project-rules.mdc) — lint, tests, coverage, no secrets in code/logs.
- ✅ [**Security & Compliance**](file:///workspace/aifabrix-builder/.cursor/rules/project-rules.mdc) — backups and logs must not leak credentials.
- ✅ [**Testing Conventions**](file:///workspace/aifabrix-builder/.cursor/rules/project-rules.mdc) — Jest under `tests/`.
- ✅ [**docs-rules**](file:///workspace/aifabrix-builder/.cursor/rules/docs-rules.mdc) — user docs stay command-centric.

### Rule compliance

- ✅ **DoD**: Documented in **Definition of Done** (`npm run lint`, `npm test`, `npm run build`, optional `build:ci`, coverage, JSDoc, matrix/docs).
- ✅ **CLI-specific rules**: cli-layout + matrix called out; implementation must update matrix per leaf command.
- ✅ **Plan content**: Copy-first MVP, no non-executable stubs without `--from` / `--template` / `--openapi-operation`; relate v1 metadata-only.

### Plan updates made (this validation pass)

- ✅ Documented **`aifabrix datasource capability remove`** — delete capability slices + optional **`exposed.profiles`** row; **`--dry-run`**, backup, AJV; optional **`testPayload.scenarios`** pruning flag.
- ✅ Added **Overview**
- ✅ Added **Rules and Standards** with links to project-rules and cli-layout/docs-rules
- ✅ Added **Before Development** checklist
- ✅ Added **Definition of Done** aligned with **`npm run build`** = lint + test
- ✅ Restored **copy-first** technical sections and todos in YAML frontmatter (file had reverted to an older draft)
- ✅ Appended this **Plan Validation Report**

### Recommendations

- During implementation, register subcommands in [`lib/commands/datasource.js`](file:///workspace/aifabrix-builder/lib/commands/datasource.js) (parent may also touch [`lib/cli.js`](file:///workspace/aifabrix-builder/lib/cli.js) only if top-level wiring is required — follow existing `setupDatasourceCommands` pattern).
- Run **`npm run build:ci`** before merge if schema sync / flag checks could be affected.
- Keep **[permissions-guide.md](file:///workspace/aifabrix-builder/docs/commands/permissions.md)** updated only if new code adds Controller/Dataplane API calls with new permission needs.

## Implementation Validation Report

**Date**: 2026-05-06  
**Plan**: [`.cursor/plans/132-datasource_capability_cli.plan.md`](file:///workspace/aifabrix-builder/.cursor/plans/132-datasource_capability_cli.plan.md)  
**Status**: ⚠️ **PARTIAL — roadmap incomplete** — ✅ **Phase 1 + Phase 2 UX shipped**; ❌ **Phase 3 (OpenAPI-assisted create)** and **Phase 4 (`relate`)** remain **pending** in YAML frontmatter.

### Executive Summary

Implemented **`datasource capability`** commands: **`copy`**, **`remove`**, **`validate`**, **`create`/`add`**, **`diff`**, **`edit`** (TTY + `$EDITOR` / nano fallback / `--editor`), with **`lib/datasource/capability/*`**, **`validateDatasourceParsed`**, **`docs/commands/external-integration.md`**, and **cli-output-command-matrix** rows for capability leaf commands. Optional HubSpot integration test skips when the dataplane fixture path is absent.

YAML **`todos`**: **`phase1-*`**, **`docs-matrix`**, **`phase2-ux`** → **`completed`**; **`phase3-openapi`**, **`phase4-relate-meta`** → **`pending`**. **Before Development** checklist (markdown) is fully checked.

This validation pass ran **`npm run lint:fix`** → **`npm run lint`** → **`npm test`** (all exit **0**). **`jest.projects.js`** — isolated project **`run-capability-copy`** added so **`tests/lib/datasource/run-capability-copy.test.js`** runs in a fresh worker (**`jest.mock('fs')`** bleed from other suites had caused intermittent **`File not found`** on temp JSON paths).

### Task Completion

| Source | Total | Completed | Incomplete | Completion |
| ------ | ----- | ----------- | ---------- | ---------- |
| YAML `todos` (frontmatter) | 7 | 5 | 2 | ~71% |
| Markdown checkboxes (“Before Development”) | 4 | 4 | 0 | 100% |

**Pending YAML todos:** `phase3-openapi`, `phase4-relate-meta`.

**Completed YAML todos:** `phase1-copy-mvp`, `phase1-cli-register`, `phase1-profiles`, `phase2-ux`, `docs-matrix`.

### File Existence Validation

| Path | Status |
| ---- | ------ |
| [`lib/commands/datasource.js`](file:///workspace/aifabrix-builder/lib/commands/datasource.js) (`setupDatasourceCapabilityCommands`) | ✅ |
| [`lib/commands/datasource-capability.js`](file:///workspace/aifabrix-builder/lib/commands/datasource-capability.js) | ✅ |
| [`lib/datasource/validate.js`](file:///workspace/aifabrix-builder/lib/datasource/validate.js) (`validateDatasourceParsed`, `resolveValidateInputPath`) | ✅ |
| `lib/datasource/capability/` — `capability-key.js`, `capability-resolve.js`, `capability-storage-keys.js`, `copy-operations.js`, `copy-test-payload.js`, `json-pointer.js`, `reference-rewrite.js`, `remove-operations.js`, `basic-exposure.js`, `capability-diff-slice.js`, `run-capability-copy.js`, `run-capability-remove.js`, `run-capability-diff.js`, `run-capability-edit.js`, `validate-capability-slice.js` | ✅ |
| [`lib/schema/external-datasource.schema.json`](file:///workspace/aifabrix-builder/lib/schema/external-datasource.schema.json) | ✅ |
| [`docs/commands/external-integration.md`](file:///workspace/aifabrix-builder/docs/commands/external-integration.md) (capability subsection) | ✅ |
| [`.cursor/rules/cli-output-command-matrix.md`](file:///workspace/aifabrix-builder/.cursor/rules/cli-output-command-matrix.md) | ✅ |
| Dataplane HubSpot fixture (optional integration test) | ⚠️ **`capability-hubspot-copy.integration.test.js`** skips unless fixture path exists (e.g. sibling **`aifabrix-dataplane`** checkout) |

**Deferred per plan:** `lib/datasource/capability/templates/` (Phase 3 templates), OpenAPI-assisted **`create`/`generate`**, **`capability relate`** (Phase 4).

### Test Coverage

| Area | Status |
| ---- | ------ |
| Unit / CLI tests mirroring `lib/datasource/capability/*` and `datasource-capability` (`tests/lib/datasource/run-capability-*.test.js`, `capability-*`, `datasource-capability-*.test.js`, etc.) | ✅ Present |
| HubSpot integration (`capability-hubspot-copy.integration.test.js`) | ⚠️ Skipped when fixture unavailable |
| **Coverage ≥80% on new code** | ⚠️ Not run in this pass (`npm run test:coverage` optional) |

### Code Quality Validation

| Step | Result |
| ---- | ------ |
| **STEP 1 — ESLint fix** (`npm run lint:fix`) | ✅ PASSED (exit 0) |
| **STEP 2 — Lint** (`npm run lint`) | ✅ PASSED (0 errors, 0 warnings) |
| **STEP 3 — Test** (`npm test`) | ✅ PASSED — multi-project wrapper (**41** projects); latest run **43** suites / **507** tests (counts vary by wrapper aggregation) |

**Note:** Wall-clock full suite ~**12–21s** in CI/agent environments; not sub‑500ms per project.

### Cursor Rules Compliance (spot check)

| Area | Assessment |
| ---- | ---------- |
| CLI layout / matrix / docs-rules | ✅ Capability leaves documented; command-centric **`docs/commands`** |
| Code reuse / modules | ✅ Logic under **`lib/datasource/capability/`** |
| Error handling / logging | ✅ Structured CLI errors; **`logger`** + chalk |
| JSDoc / `@fileoverview` | ✅ Command module + capability runners |
| Security | ✅ No secrets in reviewed capability paths |
| Jest / fs | ✅ **`run-capability-copy`** isolated per **`jest.projects.js`** to avoid **`jest.mock('fs')`** worker bleed |

### Implementation Completeness vs Plan Sections

| Topic | Status |
| ----- | ------ |
| Phase 1 — copy, remove, dry-run, AJV, backup, collision/`--suffix`, profiles | ✅ Implemented |
| Phase 1 — `create`/`add` | ⚠️ Requires **`--from`** (or equivalent) for real slices; templates/OpenAPI deferred to Phase 3 |
| Phase 2 — **`diff`**, **`edit`** (inquirer), basic exposure helpers | ✅ Implemented (`basic-exposure.js`, tests) |
| Phase 3 — templates dir, OpenAPI-driven create/generate | ❌ Pending (`phase3-openapi`) |
| Phase 4 — **`relate`** metadata-only | ❌ Pending (`phase4-relate-meta`) |

### Issues and Recommendations

1. **`npm run build:ci`** before merge when schema sync / flag checks may be affected.
2. Optional **`npm run test:coverage`** on **`lib/datasource/capability/**`** for ≥80% evidence.
3. **`jest.projects.js`**: keep **`capability-run-real-fs`** (copy/diff/edit) isolated if new **`jest.mock('fs')`** suites appear in the default worker pool.

### Final Validation Checklist

- [x] YAML todos accurate for delivered scope (Phase 1–2 UX done; Phase 3–4 pending)
- [x] Key files present (`datasource-capability.js`, `lib/datasource/capability/*`, `datasource.js` wiring)
- [x] **`npm run lint:fix`** + **`npm run lint`** + **`npm test`** pass
- [x] Docs + CLI output matrix reference capability commands
- [ ] **Full plan roadmap** (Phase 3 OpenAPI + Phase 4 relate) — open until implemented or scope formally narrowed
