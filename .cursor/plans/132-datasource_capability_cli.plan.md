---
name: Datasource capability CLI
overview: "Implement capability subcommands in aifabrix-builder with copy-first MVP: same-file JSON mutations, explicit profiles, JSON Patch dry-run, structured reference rewriting, collision/backup defaults, capability validate, then UX/OpenAPI/relate (metadata-only v1)."
todos:
  - id: phase1-copy-mvp
    content: "Phase 1: copy + --dry-run (JSON Patch) + AJV + rewriteCapabilityReferences + collision flags + backup + success footer; lib/datasource/capability/*"
    status: pending
  - id: phase1-cli-register
    content: "Register datasource capability copy|validate|create (alias add); datasource.js; HubSpot golden fixture test"
    status: pending
  - id: phase1-profiles
    content: Early --profile / --as-profile on copy; --basic-exposure vs --basic documented
    status: pending
  - id: phase2-ux
    content: capability diff, --edit (inquirer); relate pipeline deferred
    status: pending
  - id: phase3-openapi
    content: "create requires --from | --template | --openapi-operation; generate via dataplane-first OpenAPI"
    status: pending
  - id: phase4-relate-meta
    content: relate v1 metadata-only (foreignKeys + optional mappings/schema); --relation-name; no pipeline until verified
    status: pending
  - id: docs-matrix
    content: Docs recommended workflow + cli-output-command-matrix.md + docs/commands per cli-layout
    status: pending
isProject: false
---

# Datasource capability CLI (builder alignment)

## Overview

Add **`datasource capability`** subcommands so developers copy and refine OpenAPI/CIP capability slices inside a single **`*-datasource-*.json`**, with validation, dry-run, explicit **`exposed.profiles`** handling, and metadata-only **`relate`** before any enrichment pipelines.

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

- [ ] Read **CLI layout** + **cli-output-command-matrix** for output conventions.
- [ ] Review existing datasource commands: [`validate`](file:///workspace/aifabrix-builder/lib/datasource/validate.js), [`diff`](file:///workspace/aifabrix-builder/lib/datasource/diff.js), [`datasource.js`](file:///workspace/aifabrix-builder/lib/commands/datasource.js).
- [ ] Skim **`external-datasource.schema.json`** for `capabilities`, `openapi.operations`, `execution.cip.operations`, `exposed.profiles`, `foreignKeys`.
- [ ] Confirm HubSpot companies fixture shape for golden tests.

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
| **`capability validate`** | **`--validate-only`**: structural + AJV for file or single `--capability` slice (after manual edits). |
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

## Phase 1 — MVP: **copy** + `--dry-run` + validation + same-file mutation

**Priority order:** (1) **`copy`**, (2) **`--dry-run`**, (3) **AJV validation**, (4) **atomic write** — defer **`create`** until copy path + profiles + collision + backup are solid.

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
| **`--suffix`** | Deterministic rename on conflict (e.g. `createBasic2`). |

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

### Golden fixture test

Use HubSpot companies datasource; copy `create` → disposable key with **`--profile` / `--as-profile`**; assert AJV valid; assert **`openapi.operations.create`** unchanged; unit-test **`rewriteCapabilityReferences`**.

---

## Phase 2 — UX

- **`--basic-exposure`** vs **`--basic`** (shortcut): reduce **`exposed.profiles`** from **`metadataSchema`** (required + primitives only).
- **`capability diff`**, **`capability edit`**.

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
```

---

## Plan Validation Report

**Date**: 2026-05-06  
**Plan**: [`.cursor/plans/132-datasource_capability_cli.plan.md`](file:///workspace/aifabrix-builder/.cursor/plans/132-datasource_capability_cli.plan.md)  
**Status**: ✅ **VALIDATED**

### Plan purpose

**Type:** Development (CLI + library modules + tests + docs).

Implement **`datasource capability`** commands in the AI Fabrix Builder to mutate external datasource JSON (**capabilities**, **openapi.operations**, **execution.cip.operations**, **exposed.profiles**, later **foreignKeys**) with copy-first workflow, schema validation, dry-run via JSON Patch, and ISO-aligned quality gates.

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
