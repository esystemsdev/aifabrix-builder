---
name: Protection system CLI (141)
overview: "Builder CLI: protection (401) + dimension catalog valueType (183). Extend existing dimension create/get/list and dimension-file resolver; document protection + dimensions for authors. Batch .protection; deploy .protection not implemented. No coding in plan-only pass."
todos:
  - id: before-development
    content: Read cli-layout.mdc, dimension.js, dimension-file.js, dimensions.md; confirm dataplane protection APIs + Controller dimension valueType (183)
    status: pending
  - id: phase-0-dimension-value-type
    content: "Extend dimension create/get/list + dimension-file.js for valueType static|dynamic|both; matrix + dimensions.md"
    status: pending
  - id: phase-1-schema-resolve
    content: protection.schema.json + lib/protection/resolve.js + load/validate AJV
    status: pending
  - id: phase-2-api
    content: lib/api/protection.api.js + types
    status: pending
  - id: phase-3-display
    content: lib/protection/protection-display.js + snapshot tests (layout-blocks)
    status: pending
  - id: phase-4-validate-upload
    content: protection validate + upload commands wired to display
    status: pending
  - id: phase-5-show-delete-batch-scope
    content: show, delete + upload/validate/convert .protection batch + cli registration
    status: pending
  - id: phase-6-docs-matrix-tests
    content: docs/commands/protection.md + dimensions.md valueType; cli-output-command-matrix; Jest command tests
    status: pending
  - id: validation-gates
    content: npm run build → npm run lint → npm test (all pass, zero lint errors)
    status: pending
  - id: dod-closure
    content: Verify Definition of Done; four protection matrix rows + batch scope rows; deploy .protection returns not-implemented
    status: pending
isProject: false
---

# 141 — Builder CLI: protection manifests (implementation)

## What this plan is

| Repo | Plans | What gets built |
|------|-------|-----------------|
| **aifabrix-dataplane** | [401.1](../../aifabrix-dataplane/.cursor/plans/401.1-protection-system.plan.md)–[401.4](../../aifabrix-dataplane/.cursor/plans/401.4-protection-system-runtime.plan.md), [401.protection](../../aifabrix-dataplane/.cursor/plans/401.0-protection.plan.md) | APIs, DB, validation engine, sync projection, ABAC consumption |
| **aifabrix-builder** (this plan) | **141** | Protection CLI + **dimension `valueType`** on existing dimension commands + user documentation |
| **aifabrix-miso** | [183](../../aifabrix-miso/.cursor/plans/183-dimension-value-assignment-mode.plan.md) | Controller API + OpenAPI: `Dimension.valueType` on catalog (blocks meaningful protection until synced) |

Dataplane implementation plans were **not** removed. **Implementation detail for the builder lives here.**

**Prerequisites:**

| Prerequisite | Owner | Builder impact |
|--------------|-------|----------------|
| Dataplane `POST/GET/DELETE /api/v1/protection/*` | [401.1](../../aifabrix-dataplane/.cursor/plans/401.1-protection-system.plan.md) | Protection commands (stub/mock until live) |
| Controller `Dimension.valueType` (`static` \| `dynamic` \| `both`) | [183](../../aifabrix-miso/.cursor/plans/183-dimension-value-assignment-mode.plan.md) | **Extend existing** `aifabrix dimension *` commands — do not add a separate `dimension value-type` command |
| Baseline master JSON | [configs/data/baseline-dimensions.json](../../aifabrix-dataplane/configs/data/baseline-dimensions.json) | Authors set `valueType` per dimension before writing protection grants |

### Builder only — what Node does and does not do

The builder **never evaluates protection logic locally** (no expressions, FK traversal, principal resolution, projection, or ABAC).

| Builder does | Builder does not |
|--------------|------------------|
| JSON Schema validation (AJV) — structure only | Semantic graph / runtime validation (dataplane only) |
| Resolve manifests under `{work}/.protection/` by **datasource key** | Evaluate rules or simulate grants locally |
| Call dataplane validate / simulate / upload / show / delete | Store deployment or projection runtime state |
| Optional datasource sync trigger (existing API) | Reinterpret dataplane WARN/FAIL semantics |

```text
Builder never stores local protection runtime state.
Dataplane is the source of truth for deployment and runtime/projection state.
```

**Auth / environment:** Reuse existing paths only — `resolveControllerUrl`, `getDeploymentAuth`, `resolveDataplaneUrl`, `-e/--env` (same as datasource test / upload). **No** protection-specific auth module or token flow.

## Scope

### In scope

- **Four** subcommands: `aifabrix protection validate|upload|show|delete <datasourceKey>` (e.g. `hubspot-companies`)
- **Shared folder** `{aifabrix-work}/.protection/` — **not** under `integration/hubspot|sharepoint|salesforce/`; one manifest **per external datasource key**
- **Batch (scope `.protection`):** `validate .protection`, `upload .protection`, `convert .protection` (all files in folder)
- **`deploy .protection`:** explicit **not implemented** in v1 (controller pipeline does not understand `.protection`; use `upload .protection`)
- **`delete .protection`:** **not supported** (no batch delete)
- **Convert:** scope **`.protection` only** — converts **all** files in folder; **cannot** convert a single protection file via `convert <file>`
- **Lifecycle preflight** on batch **upload:** each manifest’s datasource must already exist on dataplane
- Local JSON Schema validation (AJV), `lib/api/protection.api.js`, TTY via `protection-display.js`
- Optional datasource sync after upload/deploy (reuse existing sync API)
- Jest unit/command tests; **user documentation** (see [Documentation](#documentation))
- **Extend existing dimension commands** for `valueType` ([§Dimension catalog CLI](#dimension-catalog-cli--valuetype-183))
- **Code quality:** BUILD → LINT → TEST per project quality gates

### Out of scope

- New top-level command (e.g. `aifabrix dimension set-value-type`) — use flags + `--file` on **`dimension create`** and display on **get/list**

- Extra commands (`protection test`, `test-integration`, `test-e2e`, etc.) — **no CLI explosion in v1**
- Local semantic validation, projection, ABAC, or identity logic in Node
- Local `.upload-state.json` or other builder-side deployment truth (optional content-hash cache for skip-only is OK; not authoritative)
- Protection manifests under `integration/<appKey>/` — use shared `{work}/.protection/` only
- **Any** protection batch/single publish via `deploy <appKey>` — use **`upload .protection`** or **`protection upload`**
- Dataplane backend implementation (401.1–401.4)

## Rules and Standards

This plan must comply with [Project Rules](../.cursor/rules/project-rules.mdc):

- **[CLI Command Development](../.cursor/rules/project-rules.mdc)** — Commander.js in `lib/commands/protection.js`, chalk output, try/catch, input validation
- **[CLI Layout](../.cursor/rules/cli-layout.mdc)** + [layout.md](../.cursor/rules/layout.md) — layout-blocks / tty-summary; canonical glyphs; `--json` skips TTY
- **[Code Quality Standards](../.cursor/rules/project-rules.mdc)** — files ≤500 lines, functions ≤50 lines, JSDoc on public functions
- **[Quality Gates](../.cursor/rules/project-rules.mdc)** — `npm run build` FIRST, then lint, then test; zero lint errors
- **[Testing Conventions](../.cursor/rules/project-rules.mdc)** — Jest mocks for `lib/api`; mirror `tests/lib/commands/` patterns
- **[Error Handling & Logging](../.cursor/rules/project-rules.mdc)** — `formatBlockingError`; no secrets in logs
- **[docs-rules.mdc](../.cursor/rules/docs-rules.mdc)** — command-centric user docs; no raw HTTP tutorial in `docs/commands/protection.md`

**Key requirements**

- Use centralized `lib/api/protection.api.js` + JSDoc `@typedef` in `types/protection.types.js`
- Reuse auth/env resolution exactly (no protection-specific auth)
- Map `--warnings-as-errors` → dataplane `strict: true` only (no local reinterpretation)
- TTY aligned with datasource validation; `--json` → stdout only
- ≥80% coverage goal for new modules (per project gates)

## Before Development

- [ ] Read [cli-layout.mdc](../.cursor/rules/cli-layout.mdc) and [cli-output-command-matrix.md](../.cursor/rules/cli-output-command-matrix.md)
- [ ] Review [`upload.js`](../lib/commands/upload.js), [`datasource-validation-cli.js`](../lib/commands/datasource-validation-cli.js), [`delete.js`](../lib/external-system/delete.js)
- [ ] Confirm dataplane protection endpoints from 401.1/401.2 or define ApiClient mocks for offline work
- [ ] Copy/sync `protection.schema.json` from dataplane when available
- [ ] Plan matrix rows for four `protection` commands + batch `.protection` scope rows before CLI registration
- [ ] Review [`dimension.js`](../lib/commands/dimension.js), [`dimension-file.js`](../lib/resolvers/dimension-file.js), [`dimensions.md`](../docs/commands/dimensions.md) for `valueType` gaps

## Dimension catalog CLI — `valueType` (183)

Protection authors **must** set each dimension’s **`valueType`** in the Controller catalog before writing grants in `.protection/`. The builder already ships **`aifabrix dimension create|get|list`** — this plan **extends those commands**, it does not replace them.

### Terminology (document in user docs)

| Field | Where | Meaning for authors |
|-------|--------|---------------------|
| **`dataType`** | `dimension create --data-type` | Value **shape**: `string` \| `number` \| `boolean` |
| **`valueType`** | `dimension create --value-type` or `--file` | How values are **assigned**: `static` (catalog only), `dynamic` (projection from business data), `both` (catalog + projection; protection grant may need explicit `valueType`) |
| **`effectiveValueType`** | `protection show`, dataplane validate report | Resolved per **grant** at validate/projection time — shown by protection CLI, not set on `dimension create` |

### Files to change (implementation — when approved)

| File | Change |
|------|--------|
| [`lib/commands/dimension.js`](../lib/commands/dimension.js) | `--value-type static\|dynamic\|both` on **create**; validate in `buildCreatePayload`; **get**: `headerKeyValue('Value type:', row.valueType)`; **list**: add `ValueType` column (or abbrev `VType`) to table |
| [`lib/resolvers/dimension-file.js`](../lib/resolvers/dimension-file.js) | Extend `DimensionCreateInput` with `valueType`; validate enum; default **`static`** if omitted in file (migration-friendly) |
| [`lib/api/dimensions.api.js`](../lib/api/dimensions.api.js) | Pass `valueType` on create body when Controller OpenAPI includes it (after 183) |
| [`lib/api/types/dimensions.types.js`](../lib/api/types/dimensions.types.js) | JSDoc `@typedef` — `valueType` on create/response |
| [`docs/commands/dimensions.md`](../docs/commands/dimensions.md) | New **Value type (`valueType`)** section; update create/get/list examples; link to protection doc |
| [`.cursor/rules/cli-output-command-matrix.md`](../.cursor/rules/cli-output-command-matrix.md) | Note in **Layout compliance** for dimension commands: TTY must show `valueType`; optional `--json` includes field when present |

### `dimension create` (flags + file)

```bash
aifabrix dimension create --key department --display-name "Department" \
  --data-type string --value-type dynamic

aifabrix dimension create --file ./department.json
```

`department.json` example (add to dimensions.md):

```json
{
  "key": "department",
  "displayName": "Department",
  "dataType": "string",
  "valueType": "dynamic",
  "isRequired": false,
  "values": []
}
```

For **`static`** dimensions (e.g. `sensitivity`), include `values[]` as today; `valueType: "static"`.

### `dimension get` / `dimension list` (TTY)

**get** — add line after `Type:` (dataType):

```text
Value type: dynamic
```

**list** — extend header row (adjust column widths per [layout.md](../.cursor/rules/layout.md)):

```text
Key                      Display                           Type      VType     Required
```

Use human labels in TTY: **Value type** on get; **VType** or **ValueType** on list if width constrained.

### Optional follow-on (not blocking 141 protection)

| Item | Plan |
|------|------|
| `dimension list --value-type <enum>` filter | Add when Controller list API supports filter ([183](../../aifabrix-miso/.cursor/plans/183-dimension-value-assignment-mode.plan.md)) |
| `dimension update` command | Out of 141 — create is idempotent; use create or Miso UI |

### Tests (dimension valueType)

| Test | Asserts |
|------|---------|
| `tests/lib/commands/dimension.test.js` (or existing) | create with `--value-type dynamic` sends body.valueType |
| `tests/lib/resolvers/dimension-file.test.js` | file with/without valueType; invalid enum fails |
| `tests/lib/commands/dimension.test.js` | get/list TTY or snapshot includes valueType when API returns it |

## Layout on disk

Protection is **not** part of any external system folder (`integration/hubspot/`, `integration/sharepoint/`, etc.). It uses one **shared** directory next to `integration/` and `builder/` under the apps materialization parent ([`getAppsMaterializationParent()`](../lib/utils/paths.js)).

```text
{aifabrix-work}/                    # or configured materialization parent
  integration/
    hubspot/
      application.yaml
      hubspot-system.json
      hubspot-datasource-companies.json
    sharepoint/
      ...
    salesforce/
      ...
  .protection/                      # shared — all platforms
    hubspot-companies.yaml          # preferred: stem = datasource key
    hubspot-protection-companies.yaml   # allowed if maps to datasource key hubspot-companies
    sharepoint-protection-sites.yaml
```

| Rule | v1 behavior |
|------|-------------|
| **One manifest per datasource** | Each file protects exactly one **external datasource key** (`spec.datasourceKey`). CLI argument is that key: `hubspot-companies`, not integration `appKey`. |
| **Not under integration/** | **Forbidden** to place `.protection/` inside `integration/<systemKey>/`. |
| **Filename** | **Preferred:** `<datasourceKey>.yaml` (e.g. `hubspot-companies.yaml`). **Also allowed:** `{systemKey}-protection-{suffix}.yaml` when `{systemKey}-{suffix}` equals the datasource key (e.g. `hubspot-protection-companies` → `hubspot-companies`). |
| **`metadata.key` / `spec.datasourceKey`** | **Strict FAIL** if `spec.datasourceKey` ≠ CLI datasource key, or duplicate `spec.datasourceKey` across files in `.protection/`. |
| **File extension (`protection *`)** | **`.yaml` only** for `protection validate|upload|…` (reject `.json` with hint: `aifabrix convert .protection --format yaml`). |
| **Path safety** | Only files under `{work}/.protection/`; reject `..` and paths outside that root. |

**External systems (for contrast):**

```text
integration/<appKey>/               # hubspot, sharepoint, salesforce — controller deploy lifecycle
  application.yaml
  *-datasource-*.json
```

## Argument resolution — `<datasourceKey>` (single-file `protection *`)

For `aifabrix protection validate|upload|show|delete <datasourceKey>`:

1. **`datasourceKey`** = external datasource key (e.g. `hubspot-companies`), same id used in `*-datasource-*.json` and dataplane.
2. Resolve manifest path under `{work}/.protection/`:
   - Try `{work}/.protection/<datasourceKey>.yaml`
   - Else scan `*.{yaml,json}` in `.protection/` and pick the file whose `spec.datasourceKey` (after load) equals `datasourceKey`
   - Else match filename `{system}-protection-{suffix}` → datasource key `{system}-{suffix}`
3. **Optional explicit path:** if argument is an existing file under `.protection/`, use it (must still pass path-safety rules).
4. **No `-a/--app`** for resolution (there is no per-integration protection folder). `-e/--env` only for dataplane/auth.

Examples:

```bash
aifabrix protection validate hubspot-companies
aifabrix protection upload hubspot-companies
aifabrix protection show hubspot-companies
aifabrix protection delete hubspot-companies
```

## Lifecycle — protection ≠ external system

```text
Phase 1 — external (per integration app)
  aifabrix deploy hubspot              → controller → system + datasources on dataplane
  aifabrix validate hubspot            → application + system + datasource files under integration/hubspot/ only

Phase 2 — protection (shared .protection/, after datasources exist)
  aifabrix validate .protection        → all manifests in {work}/.protection/
  aifabrix upload .protection          → upload all to dataplane (direct API)
  aifabrix deploy .protection          → NOT IMPLEMENTED (controller has no .protection scope)
```

| Rule | v1 |
|------|-----|
| `deploy <appKey>` | External system only — **never** reads `{work}/.protection/`. |
| `validate <appKey>` | `integration/<appKey>/` only — **never** includes `.protection/`. |
| `deploy .protection` | **Not implemented** — exit with clear message: controller pipeline does not support `.protection`; use **`upload .protection`**. |
| `delete .protection` | **Not supported** — use `protection delete <datasourceKey>` per manifest. |
| `upload .protection` | Dataplane protection API only; **preflight** each `spec.datasourceKey` exists on dataplane before upload. |

**Preflight:** `lib/protection/preflight-datasource-ready.js` — before batch upload (and optional on dataplane validate batch).

## Scope token `.protection` — top-level commands

Reserved positional **`.protection`** (not an app key). Operates on **`{work}/.protection/`** only.

| Command | v1 behavior |
|---------|-------------|
| `aifabrix validate .protection` | Validate **all** manifests in folder (local AJV; dataplane validate when authed). |
| `aifabrix upload .protection` | Upload **all** manifests (validate → upload → optional sync per unique datasourceKey). |
| `aifabrix convert .protection --format yaml\|json` | Convert **all** `*.{json,yaml}` in folder; **cannot** convert one protection file. |
| `aifabrix deploy .protection` | **Error (not implemented)** — do not route to controller or dataplane deploy batch. |
| `aifabrix delete .protection` | **Error (not supported)**. |

**Parser:** In each command’s action, if positional is `.protection`, branch to `lib/protection/*-batch.js` **before** `detectAppType('.protection')`.

### JSON ↔ YAML — `aifabrix convert .protection` only

Extend [`lib/commands/convert.js`](../lib/commands/convert.js) (and CLI help):

- **Accept:** `convert .protection --format yaml|json` — glob `{work}/.protection/*.{json,yaml}`, convert every file whose extension differs from target; prompt lists all files; delete old extensions after write.
- **Reject:** `convert hubspot` including `.protection/`; `convert .protection/foo.yaml` (single file); `convert hubspot-companies` for protection.

**Tests:** `convert.test.js` — `convert .protection --format yaml` converts entire folder; single-file convert rejected.

### Batch validate — `aifabrix validate .protection`

Same folder glob, lexical order, stop on first failure (default). Per file: local AJV + datasourceKey rules; dataplane `POST .../validate` when authed. Shared: `validate-batch.js`.

### Batch upload — `aifabrix upload .protection` (not deploy)

Wire in [`lib/cli/setup-external-system.js`](../lib/cli/setup-external-system.js) or shared upload router (alongside `upload <systemKey>`):

```text
if (arg === '.protection') → upload-batch.run(opts)
  → preflight-datasource-ready per manifest
  → per file: AJV → dataplane validate → upload
  → batch sync unique datasourceKeys unless --no-sync
```

**Do not** implement `deploy-batch.js` in v1. Remove any plan to upload via `deploy .protection`.

### Protection vs datasource (lifecycle only)

| | Datasource | Protection |
|---|------------|------------|
| On-disk home | `integration/<app>/…-datasource-*.json` | `{work}/.protection/*.yaml` |
| CLI id | file path or datasource key under app | **datasource key** (global) |
| Batch validate | `validate <app>` | `validate .protection` |
| Batch publish | `deploy <app>` (controller) | **`upload .protection`** (dataplane) — **not** `deploy .protection` |
| Single-file ops | `datasource validate <file>` | `protection validate <datasourceKey>` |

## Commands and flags (v1)

Only these **`protection`** subcommands. Flag names match existing CLI (`datasource test`, `upload`, `delete`).

| Command | Flags |
|---------|--------|
| `protection validate <datasourceKey>` | `-e`, `-v`, `--json`, `--warnings-as-errors`, `--simulate`, `--timeout` |
| `protection upload <datasourceKey>` | `-e`, `-v`, `--dry-run`, `--no-sync` |
| `protection show <datasourceKey>` | `-e`, `--json` |
| `protection delete <datasourceKey>` | `-e`, `--yes` |

| Batch (positional `.protection`) | Flags |
|----------------------------------|--------|
| `validate .protection` | `-e`, `-v`, `--json`, `--warnings-as-errors`, `--simulate`, `--timeout` |
| `upload .protection` | `-e`, `--dry-run`, `--no-sync`, `--json`, `-v` |
| `convert .protection` | `--format yaml\|json`, `--force` (convert command flags) |
| `deploy .protection` | **Not implemented** (documented error only) |
| `delete .protection` | **Not supported** (documented error only) |

Register in [`lib/cli/index.js`](../lib/cli/index.js): `setupProtectionCommands(program)` from [`lib/commands/protection.js`](../lib/commands/protection.js).

### Flag semantics (v1)

| Flag | Semantics |
|------|-----------|
| `--warnings-as-errors` | Pass `strict: true` to dataplane validate/simulate. **Warnings from dataplane become blocking** for exit code / upload gate. Builder does **not** reclassify or invent extra strict rules. |
| `--dry-run` | **No dataplane mutation** — no `POST .../upload`, no `DELETE`. Allowed: local AJV + `POST .../validate` and (if requested) `POST .../simulate` only. |
| `--no-sync` | Upload/deploy still registers protection on dataplane. Protection is **active immediately**; **projections refresh only on the next datasource sync** for `spec.datasourceKey` (401.3). Identity/user/group sync does **not** rerun projections. Print gray hint when sync skipped. |

## CLI terminal UI

**Product rule:** Protection CLI must **visually align with datasource validation UX** — same layout-blocks rhythm, glyphs, issue rows, and summary/footer patterns. Reuse `cli-test-layout-chalk` and datasource/validate display helpers; **do not invent protection-specific formatting conventions**.

| Doc | Use for |
|-----|---------|
| [cli-layout.mdc](../.cursor/rules/cli-layout.mdc) | Profiles, glyphs, `--json` rules |
| [layout.md](../.cursor/rules/layout.md) | Colors, sections, semantic red/yellow |
| [cli-output-command-matrix.md](../.cursor/rules/cli-output-command-matrix.md) | Four `protection *` rows + `validate|upload|convert .protection`; `deploy .protection` = not-implemented error profile |

**Canonical helpers:** [`lib/utils/cli-test-layout-chalk.js`](../lib/utils/cli-test-layout-chalk.js) (`sectionTitle`, `headerKeyValue`, `metadata`, `formatStatusKeyValue`, `formatBlockingError`, `formatSuccessLine`, `formatWarningLine`, `formatProgress`, `formatNextActions`, `formatBulletSection`).

**Reference implementations (copy patterns, not code):**

| Existing command | Display module | Pattern |
|------------------|----------------|---------|
| `datasource test` / validate server report | [`datasource-test-run-display.js`](../lib/utils/datasource-test-run-display.js) | **layout-blocks**: header → Status → Verdict → issues list |
| `aifabrix validate` | [`validate-display.js`](../lib/validation/validate-display.js) | Section titles, `logErrorDetail`, batch summary |
| `aifabrix upload` | [`upload.js`](../lib/commands/upload.js) | Target block + `SEP` + progress |
| `aifabrix delete` | [`delete.js`](../lib/external-system/delete.js) | Warning + confirm + success line |
| Manifest gray line | [`manifest-source-emit.js`](../lib/utils/manifest-source-emit.js) | One `Manifest: <tier> — <absPath>` per command |

**New module:** `lib/protection/protection-display.js` (+ optional `protection-display-log-helpers.js` if file approaches 500 lines).

Dataplane validate/simulate responses reuse the **standard validation report envelope** ([401.2](../../aifabrix-dataplane/.cursor/plans/401.2-protection-system-validation.plan.md): `tasks[]`, `stableCode`, `PASS`/`FAIL`/`WARN`). The CLI maps that envelope to the same issue rows as datasource validation — not a custom protection dialect.

### Output profile matrix (add to cli-output-command-matrix.md)

| Command | Profile | Manifest roots (141) |
|---------|---------|----------------------|
| `aifabrix protection validate` | **layout-blocks** + **json-opt** | **int** |
| `aifabrix validate .protection` | **layout-blocks** + **json-opt** | **int** |
| `aifabrix upload .protection` | **layout-blocks** + **json-opt** | **int** |
| `aifabrix convert .protection` | **tty-summary** (convert profile) | **int** |
| `aifabrix deploy .protection` | **blocking error** (not implemented) | **int** ≠ 0 |
| `aifabrix protection upload` | **layout-blocks** + **tty-summary** (footer) | **int** |
| `aifabrix protection show` | **tty-summary** + **json-opt** | **int** |
| `aifabrix protection delete` | **tty-summary** | **int** |

### Shared TTY conventions

- **Separator:** `const SEP = chalk.gray('────────────────────────────────────────');` (same as [`upload.js`](../lib/commands/upload.js)).
- **Glyphs:** ✔ success, ⚠ warning (non-blocking), ✖ blocking failure, ⏭ skipped, ⏳ progress — per [layout.md](../.cursor/rules/layout.md).
- **Red = blocking only;** yellow = warnings. Never red for warnings.
- **Non-TTY / `NO_COLOR`:** same glyphs and line structure; colors no-op.
- **`--json`:** **stdout = JSON only** (machine payload). Human-oriented logs, progress, and errors go to **stderr** when needed (same automation contract as other json-opt commands). No decorative TTY layout on stdout.
- **`-v`:** extra task detail (full `hint`, `schemaPath`) and sync sub-steps; default caps issues at 10 per section.
- **Manifest metadata (human TTY only):**
  1. **Protection file** (always when resolved): `metadata('Protection: work — /abs/.../.protection/hubspot-companies.yaml')`
  2. **Datasource key** line: `Datasource: hubspot-companies` (no integration `application.yaml` line — protection is not under integration/)
- **Target block** (before API calls, like upload): Environment, Dataplane URL (gray labels, bold white values).

### Validation report → TTY (`protection-display.js`)

Map standard report fields to layout-blocks (mirror [`appendValidationIssueLines`](../lib/utils/datasource-test-run-display.js) + [`validate-display-log-helpers`](../lib/validation/validate-display-log-helpers.js)):

| Report input | TTY section |
|--------------|-------------|
| `metadata.protectionKey`, `metadata.datasourceKey`, `metadata.appKey` | Header `headerKeyValue` lines |
| Aggregate `status` / `valid` | `formatStatusKeyValue` → `Status: ✔ OK` / `⚠ WARN` / `✖ FAIL` |
| `tasks[]` where `result === 'FAIL'` | **Validation issues:** — `✖ <stableCode> <message>` + gray indent `hint` / `schemaPath` |
| `tasks[]` where `result === 'WARN'` | **Warnings:** — `⚠ …` (yellow) |
| `tasks[]` where `result === 'PASS'` and `-v` | **Checks passed:** — `✔ <taskName>` (optional section) |
| Simulation block (if `--simulate`) | **Simulation:** — **records sampled**, **grants projected** (count), **unresolved principals** (count/list); plus `DP-PROT-050` / WARN rows — not warnings alone |
| Overall | **Summary:** — `formatSuccessLine` or `formatBlockingError` + `headerKeyValue('Overall:', …)` |

**Exit codes (validate):** align with [`datasource-validation-cli.js`](../lib/commands/datasource-validation-cli.js): API error → 3; blocking FAIL → 1; WARN only → 0 unless `--warnings-as-errors` (maps API `strict: true`).

Exported functions:

```text
formatProtectionValidateTTY(report, opts) → string
printProtectionValidateReport(report, opts) → void  // logger; respects --json
formatProtectionBatchUploadTTY(results, opts) → string
formatProtectionBatchValidateTTY(results, opts) → string
formatDeployProtectionNotImplementedTTY() → string
formatProtectionShowTTY({ manifest, status }, opts) → string
formatProtectionDeleteSummaryTTY(response, opts) → string
```

### Per-command UI

#### `protection validate <datasourceKey>`

**Profile:** layout-blocks + json-opt.

**Flow (TTY):**

```text
Protection validate
────────────────────────────────────────
Protection: work — /abs/.../.protection/hubspot-companies.yaml
Datasource: hubspot-companies

Target
────────────────────────────────────────
Environment: dev
Dataplane: http://localhost:3201

  ⏳ Local schema check...
  ✔ Local schema valid

  ⏳ Dataplane validation...
Protection: hubspot-companies
Datasource: hubspot-companies
Status: ✖ FAIL

Verdict:
Expression references unknown FK "country" on datasource hubspot-deals

Validation issues:
  ✖ DP-PROT-011 Unknown FK in expression
      hint: fk.country.metadata.iso3 — register foreign key on datasource
      path: spec.rules[0].grants[0].valueExpression

Summary:
  ✖ Validation failed
  Overall: Failed

Next actions:
- Fix FK binding in hubspot-deals-datasource.json
- Run aifabrix protection validate hubspot-companies
```

With `--simulate` and validate OK, append **Simulation:** section (sample size, grant preview counts) before Summary.

With `--json`: print full dataplane report JSON only (stdout).

#### `protection upload <datasourceKey>`

**Profile:** layout-blocks header + tty-summary footer (same rhythm as [`upload.js`](../lib/commands/upload.js)).

```text
Protection upload
────────────────────────────────────────
Protection: work — /abs/.../.protection/hubspot-companies.yaml
Datasource: hubspot-companies

Target
...
  ⏳ Local schema check...
  ✔ Local schema valid
  ⏳ Dataplane validation...
  ✔ Validation passed

  ⏳ Uploading protection manifest...
✔ Protection for 'hubspot-companies' uploaded (deploymentId …, revision …)

  ⏳ Syncing datasource hubspot-companies...
✔ Sync started (syncJobId: …)
```

**`--dry-run`:** stop after validate (and simulate if requested); **no upload API call**. Yellow line `Dry run: would upload protection (no mutation).` + gray summary (`key`, `datasourceKey`, rule count).

**Upload API:** idempotent **upsert by `metadata.key`** on dataplane ([401.1](../../aifabrix-dataplane/.cursor/plans/401.1-protection-system.plan.md)).

**Operational note (TTY):** Deploying protection **before** the target datasource has synced data is valid; projection may produce **zero grants/values** until records exist — mention in docs when upload succeeds with no sync yet.

**`--no-sync`:** skip sync block; gray `Sync skipped (--no-sync). Protection active on dataplane; projections update on next datasource sync.`

**Blocking failure:** `formatBlockingError('Protection upload failed:')` + message; no success footer.

#### `upload .protection` (batch TTY)

**Profile:** layout-blocks batch + json-opt.

```text
Protection upload (batch)
────────────────────────────────────────
Scope: .protection
Folder: /abs/.../.protection

hubspot-companies
  ✔ Validated and uploaded

sharepoint-protection-sites
  ✖ DP-PROT-020 Unknown dimension
      hint: dimensionKey "region" not in catalog

Summary:
  ✖ 1 passed, 1 failed
  Overall: Failed
```

**Order:** all `*.yaml` in `{work}/.protection/`, **stable lexical sort**. **`--dry-run`**, optional content-hash skip (`.protection/.upload-state.json`), **stop on first failure**, **`-v`**, **`--json`**. Implemented in `upload-batch.js`.

#### `deploy .protection` (v1 — not implemented)

```text
✖ deploy .protection is not supported.

Protection manifests are uploaded to the dataplane directly, not via the Miso Controller deploy pipeline.

Use:
  aifabrix upload .protection
  aifabrix protection upload <datasourceKey>
```

Exit non-zero. **Do not** call controller or `deployExternalSystem`.

#### `protection show <datasourceKey>`

**Profile:** tty-summary + json-opt (like `app show` — compact facts, not full test layout).

**Source of truth:** **Deployed dataplane state** — not the local filesystem manifest. Local files may differ or be absent; `show` always queries dataplane.

**TTY fields (minimum):** `protectionKey`, **enabled**, **datasourceKey**, **version** (or content hash if API exposes), **last projection run** (`lastProjectionRunAt` / `lastSuccessfulProjectionRunAt`), projection status, rule counts, grant counts **by effective value type** (`static` / `dynamic`), cached dynamic value / total grant counts when status API provides them.

**Value type display (required):** Effective grant mode comes from **`Dimension.valueType`** in the synced catalog ([183](../../aifabrix-miso/.cursor/plans/183-dimension-value-assignment-mode.plan.md)), not from manifest grant fields. Dataplane `GET .../status` (or merged manifest summary) must return per-grant **`effectiveValueType`** (`static` | `dynamic`) — resolved at validate/upload/projection per [401.2](../../aifabrix-dataplane/.cursor/plans/401.2-protection-system-validation.plan.md).

```text
Protection: hubspot-companies
────────────────────────────────────────
Environment: dev
Dataplane: http://localhost:3201

Enabled: yes
Datasource: hubspot-companies
Version: 3
Content hash: sha256:abc… (if returned)
Last upload: 2026-05-16T12:00:00Z
Last projection run: 2026-05-16T12:05:00Z (ok)

Rules: 4 enabled / 4 total
Grants (cached): 512 (static: 64, dynamic: 448)
Dynamic values (cached): 128

Grants by rule (-v):
  sales-country-users
    country → dynamic  ({{fk.country.metadata.iso2}})
  nordics-region-group
    region → static  (nordics)
```

**`-v`:** list each rule → grants as `dimensionKey → {effectiveValueType}` + truncated `valueExpression` (gray). Do **not** show manifest grant `valueType` unless dimension is `both` and author set an override.

**`--json`:** merged `GET /protection/{key}` + `GET .../status`; include `grantsSummary[]` with `ruleKey`, `dimensionKey`, `effectiveValueType`, `valueExpression` (and `grantValueType` only when present on manifest for `both` dimensions).

#### `protection delete <datasourceKey>`

**Profile:** tty-summary (mirror [`delete.js`](../lib/external-system/delete.js)).

Without `--yes`:

```text
⚠  Warning: Deleting protection for datasource 'hubspot-companies' will remove:
 - Projected dynamic dimension values for this protection
 - Principal grants linked to this protection
 - Protection manifest record on dataplane

Associated datasource records are not deleted.

Are you sure you want to delete protection for 'hubspot-companies'? (yes/no):
```

With confirm / `--yes`:

```text
✔ Protection for 'hubspot-companies' deleted
  Dynamic values removed: 128
  Principal grants removed: 512
```

**Scope of delete:** Removes **deployed protection manifest** and **lineage-generated** dynamic dimension values + principal grants on dataplane. **Does not** delete datasource records, external system config, or files under `{work}/.protection/`. **No** `delete .protection` batch.

Use `inquirer` confirm pattern from delete external system; `formatBlockingError` on API failure.

### UI tests

| Test | Asserts |
|------|---------|
| `tests/lib/protection/protection-display.test.js` | Issue rows, status colors, `-v` cap |
| `tests/local/lib/protection/protection-display-snapshot.test.js` | Stable TTY strings (fixtures from 401.2 sample report) |

Wire command tests to mock API + snapshot human output (pattern: [`datasource-test-run-display-snapshot.test.js`](../tests/local/lib/utils/datasource-test-run-display-snapshot.test.js)).

## Implementation — modules

```text
lib/
  schema/protection.schema.json          # copy/sync from dataplane when available
  protection/
    resolve.js                           # resolve manifest from datasourceKey under {work}/.protection/
    paths.js                             # getProtectionRoot() → {work}/.protection
    load.js                              # read YAML manifest (v1)
    validate-local.js                    # AJV against protection.schema.json
    protection-display.js                # TTY + --json formatters (layout-blocks / tty-summary)
    protection-display-log-helpers.js    # optional split if display file > 500 lines
    sync-after-upload.js                 # trigger datasource sync by datasourceKey
    validate-batch.js                    # validate .protection — all files
    upload-batch.js                      # upload .protection — all files
    preflight-datasource-ready.js        # block batch upload if datasource missing on dataplane
  api/
    protection.api.js                    # HTTP to dataplane
    types/protection.types.js            # JSDoc typedefs
  commands/
    protection.js                        # Commander setup + actions
tests/lib/commands/
  protection-*.test.js
  protection/fixtures/
docs/commands/protection.md
```

Keep each file ≤500 lines; extract helpers if `protection.js` grows.

## Implementation — shared helpers

### `lib/protection/paths.js` + `resolve.js`

- `getProtectionRoot()` → `path.join(getAppsMaterializationParent(), '.protection')`
- Resolve `{ datasourceKey, manifestPath }` per **Argument resolution** above
- Reject paths outside `{work}/.protection/`
- Reject non-`.yaml` for `protection *` commands in v1
- **Strict FAIL:** duplicate `spec.datasourceKey` in folder; loaded `spec.datasourceKey` ≠ CLI argument
- Errors: missing manifest for datasource key, ambiguous filename match

### `lib/protection/load.js`

- `loadProtectionManifest(manifestPath)` → parsed YAML only (v1)

### `lib/protection/validate-local.js`

- AJV compile `protection.schema.json` — **schema / shape only**
- **Never** semantic graph, FK, dimension catalog, or principal checks (dataplane validate/simulate only)
- Fail fast before any dataplane call

### Manifest contract alignment ([401.1](../../aifabrix-dataplane/.cursor/plans/401.1-protection-system.plan.md))

Sync `protection.schema.json` from dataplane. Every `rules[].grants[]` entry **must** include:

| Field | Required | Notes |
|-------|----------|--------|
| `dimensionKey` | **Yes** | |
| `valueExpression` | **Yes** | |
| `valueType` | **No** (default) | **Omit** from author manifests when `Dimension.valueType` is `static` or `dynamic` ([183](../../aifabrix-miso/.cursor/plans/183-dimension-value-assignment-mode.plan.md)) |
| `valueType` | **Yes** (AJV) | Only when synced dimension has `valueType: both` — disambiguates static vs dynamic for that grant |

**AJV / validate-local:** do **not** require `valueType` on every grant. Optional property with `enum: [static, dynamic]` when present.

Builder does **not** resolve or infer effective `valueType` locally. Dataplane validate/simulate resolves from dimension catalog and returns **`effectiveValueType`** in reports for TTY ([401.2](../../aifabrix-dataplane/.cursor/plans/401.2-protection-system-validation.plan.md)).

**User docs** (`docs/commands/protection.md`): dimension `valueType` is configured in the dimension catalog (baseline master: dataplane `configs/data/baseline-dimensions.json`, synced to miso via `pnpm sync-json`); protection grants omit `valueType` except when dimension mode is `both`; `protection show` displays **effective** value types from dataplane.

### Auth + dataplane URL

Reuse existing stack (no new auth model):

- [`resolveControllerUrl`](../lib/utils/controller-url.js)
- [`getDeploymentAuth`](../lib/utils/token-manager.js)
- [`resolveDataplaneUrl`](../lib/utils/dataplane-resolver.js)
- `-e, --env` passed through like datasource test commands

### `lib/protection/sync-after-upload.js`

After successful upload (single or `upload .protection` batch):

1. Collect **unique** `spec.datasourceKey` values from all manifests uploaded in the run (**one sync start per datasource key**, not per file)
2. Unless `--no-sync`: call existing datasource sync helper per unique key — e.g. [`datasources-extended.api.js`](../lib/api/datasources-extended.api.js)
3. **Expose `syncJobId`** (or equivalent) in upload/deploy TTY summary and `--json` results
4. Sync failure after successful upload: **warn and continue** by default (upload and projection are separate operational concerns); do not roll back upload

## Implementation — API client (`lib/api/protection.api.js`)

| Function | Dataplane | Body / notes |
|----------|-----------|--------------|
| `validateProtection(url, auth, manifest, opts)` | `POST /api/v1/protection/validate` | `{ manifest }`, `strict` if `--warnings-as-errors` |
| `simulateProtection(url, auth, manifest, opts)` | `POST /api/v1/protection/simulate` | after validate passes; `sampleSize` optional later |
| `uploadProtection(url, auth, manifest)` | `POST /api/v1/protection/upload` | `{ manifest }` |
| `getProtection(url, auth, key)` | `GET /api/v1/protection/{key}` | |
| `getProtectionStatus(url, auth, key)` | `GET /api/v1/protection/{key}/status` | used by `show` |
| `deleteProtection(url, auth, key)` | `DELETE /api/v1/protection/{key}` | |

Use [`ApiClient`](../lib/api/index.js) like [`pipeline.api.js`](../lib/api/pipeline.api.js). Map `--warnings-as-errors` → `strict: true` in JSON body.

## Implementation — per command

### 1. `protection validate <datasourceKey>`

```text
resolve path → load manifest → AJV
  → resolve dataplane URL + auth
  → POST validate
  → if --simulate and validate OK → POST simulate
  → printProtectionValidateReport (see CLI terminal UI)
  → exit 1 if invalid or --warnings-as-errors and WARNs
```

### 2. `protection upload <datasourceKey>`

```text
resolve → load → AJV
  → POST validate (fail on error)
  → if --dry-run: stop after validate OK
  → POST upload
  → unless --no-sync: sync-after-upload for manifest.spec.datasourceKey
  → print success + status summary (-v for detail)
```

### 3. `upload .protection` (batch)

```text
upload arg === '.protection'
  → list {work}/.protection/*.yaml (lexical sort)
  → preflight-datasource-ready per manifest
  → upload-batch.run(opts) — per file: AJV → validate → upload (stop on first fail)
  → batch sync unique datasourceKeys unless --no-sync
```

### 4. `deploy .protection` (v1)

```text
deploy arg === '.protection' → print not-implemented message → exit 1
```

### 5. `validate .protection` (batch)

```text
validate arg === '.protection' → validate-batch.run(opts)
```

### 6. `convert .protection`

```text
convert arg === '.protection' → convert all *.{json,yaml} in {work}/.protection/ (no single-file)
```

### 7. `protection show <datasourceKey>`

```text
resolve → GET protection + GET status
  → formatProtectionShowTTY (counts by effectiveValueType; -v lists grants)
  → human summary or --json
```

No local file required (shows deployed state). Lookup by **datasource key** on dataplane. Requires dataplane status payload with `effectiveValueType` per grant ([401.1](../../aifabrix-dataplane/.cursor/plans/401.1-protection-system.plan.md)).

### 8. `protection delete <datasourceKey>`

```text
resolve → confirm unless --yes
  → DELETE protection
  → print cleanup summary from response
```

## Implementation order

**Recommended:** land dimension `valueType` CLI + dimensions.md **before or with** protection CLI so authors can configure catalogs while testing protection.

1. Confirm Controller exposes `valueType` on dimension APIs ([183](../../aifabrix-miso/.cursor/plans/183-dimension-value-assignment-mode.plan.md)) — or mock in builder tests until live
2. **`dimension-file.js`** + **`dimension.js`** (`valueType` create/get/list) + dimension tests
3. **`docs/commands/dimensions.md`** — `valueType` section
4. Protection: schema + `resolve` + `load` + `validate-local` + unit tests (offline)
5. `protection-display.js` + snapshot tests (fixture reports from 401.2 shape)
6. `protection.api.js` + mock tests
7. `validate` / `upload` / batch commands wired to display
8. `show`, `delete` TTY; register CLI
9. **`docs/commands/protection.md`** + matrix rows + README index

## Tests

| Test | Covers |
|------|--------|
| `protection-resolve.test.js` | datasourceKey → `hubspot-companies.yaml` and `hubspot-protection-companies.yaml` |
| `protection-resolve.test.js` | **[EDGE]** duplicate spec.datasourceKey in folder → FAIL |
| `protection-resolve.test.js` | **[EDGE]** manifest outside `{work}/.protection/` → FAIL |
| `protection-resolve.test.js` | **[EDGE]** invalid extension (`.json`) → FAIL with convert hint in v1 |
| `convert.test.js` | `convert .protection --format yaml` converts entire folder; rejects single-file protection convert |
| `protection-validate-local.test.js` | AJV pass/fail; no semantic checks |
| `protection-validate-local.test.js` | **[EDGE]** grant without `valueType` passes AJV; unknown grant `valueType` enum fails |
| `protection-display.test.js` | `formatProtectionShowTTY` shows grant lines with `static` / `dynamic` effective types |
| `protection-validate.test.js` | mock ApiClient validate/simulate; `--warnings-as-errors` → `strict` |
| `protection-upload.test.js` | dry-run: no upload call; no-sync hint |
| `protection-upload-batch.test.js` | lexical order; stop on first fail; duplicate datasourceKey in folder |
| `protection-upload-batch.test.js` | unique datasource sync batching; syncJobId in summary |
| `deploy.test.js` | `deploy .protection` → not-implemented error; `deploy hubspot` never reads `{work}/.protection/` |
| `validate-batch.test.js` | `validate .protection` all files; `validate hubspot` excludes `.protection/` |
| `preflight-datasource-ready.test.js` | `upload .protection` fails when datasource missing on dataplane |
| `dimension-create-value-type.test.js` | `--value-type` and `--file` payload include `valueType` |
| `dimension-get-list-value-type.test.js` | TTY displays `valueType` when present in API response |

Fixtures under `tests/fixtures/protection/` (valid YAML, key mismatch, invalid schema).  
Fixtures under `tests/fixtures/dimension/` — create JSON with each `valueType` enum.

## Documentation

Per [docs-rules.mdc](../.cursor/rules/docs-rules.mdc): **command-centric**, no REST paths or payload schemas in prose. Cross-link plans [401.5](../../aifabrix-dataplane/.cursor/plans/401.5-protection-system-use-cases.plan.md) for business scenarios (HR Manager, SharePoint sensitivity).

### Deliverables (141 documentation scope)

| Document | Audience | Content to add |
|----------|----------|----------------|
| [`docs/commands/dimensions.md`](../docs/commands/dimensions.md) | Operators, integration authors | **`valueType`** section: static vs dynamic vs both; difference from `dataType`; when to use `values[]`; baseline master in dataplane `configs/data/baseline-dimensions.json`; sync via miso `pnpm sync-json` |
| [`docs/commands/protection.md`](../docs/commands/protection.md) | Same | **New file** (v1): shared `.protection/` layout; lifecycle vs `integration/<app>/`; datasource key as CLI id; batch `validate\|upload\|convert .protection`; `deploy .protection` not supported; grants omit `valueType` except dimension `both`; **`protection show`** displays **effective** types; prerequisite “define dimensions first” with link to dimensions.md |
| [`docs/commands/README.md`](../docs/commands/README.md) | Discoverability | Index entries for **Protection** and updated **Dimensions** blurb mentioning `valueType` |
| Optional: `docs/guides/governance-workflow.md` | Business + dev | Short narrative: catalog (`valueType`) → protection manifest → upload → datasource sync → runtime ABAC (defer if timeboxed) |

### Suggested doc structure — `docs/commands/protection.md`

1. **Prerequisites** — login, datasource deployed (`aifabrix deploy <app>`), dimensions in catalog with correct `valueType` ([dimensions.md](dimensions.md))
2. **Where files live** — `{work}/.protection/<datasourceKey>.yaml` (not under integration)
3. **Workflow** — validate → upload → (optional sync) → show; contrast with `upload .protection` batch
4. **Manifest basics** — `spec.datasourceKey`, rules, principal, grants, optional `when` ([401.5](../../aifabrix-dataplane/.cursor/plans/401.5-protection-system-use-cases.plan.md)); no grant `valueType` when catalog defines mode
5. **Examples** — country (dynamic), region (static), HR manager (`when.groups: [Manager]`)
6. **Flags** — `--warnings-as-errors`, `--simulate`, `--dry-run`, `--no-sync`
7. **Troubleshooting** — dimension unknown (`DP-PROT-020`), principal not in snapshot (`DP-PROT-050`), zero grants until datasource has data

### Suggested addition — `docs/commands/dimensions.md`

After **Dimension commands** intro, add:

```markdown
## Value type (`valueType`)

Each dimension has a **value type** (separate from **data type**):

| valueType | Meaning | Protection grants |
|-----------|---------|-------------------|
| static | Values only from catalog (`dimension-value create` or baseline JSON) | Use `dimensionKey` + `valueExpression` only |
| dynamic | Values created by protection projection from datasource sync | Same |
| both | Catalog and projection allowed | Grant must include `valueType: static` or `dynamic` |

Set on create: `--value-type static|dynamic|both` or in the `--file` JSON next to `dataType`.
```

### CLI output matrix

Update [`cli-output-command-matrix.md`](../.cursor/rules/cli-output-command-matrix.md):

| Command | Profile | Notes (141) |
|---------|---------|-------------|
| `aifabrix dimension create` | tty-summary | Must show created key + **valueType** in success/summary lines |
| `aifabrix dimension get` | tty-summary | Must show **Value type:** line |
| `aifabrix dimension list` | tty-summary | Table includes **valueType** column |
| `aifabrix protection validate` | layout-blocks + json-opt | int |
| … | (existing protection rows unchanged) | … |

Add **Layout compliance** bullet under dimension commands: snapshot or test asserts `valueType` visible when API returns it.

## Definition of Done

**Functional**

- [ ] **`valueType` on dimension commands:** `create` (`--value-type` + `--file`), `get`, `list` per [§Dimension catalog CLI](#dimension-catalog-cli--valuetype-183); tests updated
- [ ] **`docs/commands/dimensions.md`** documents `valueType` and links to protection workflow
- [ ] **`docs/commands/protection.md`** published with prerequisites, `.protection/` layout, batch scope, effective types on `show`
- [ ] **`cli-output-command-matrix.md`** updated for dimension + protection rows
- [ ] `aifabrix protection validate|upload|show|delete <datasourceKey>` registered
- [ ] Batch: `validate .protection`, `upload .protection`, `convert .protection` (all files); `deploy .protection` → not-implemented; `delete .protection` → not supported
- [ ] Manifests only under `{work}/.protection/`; not under `integration/<app>/`
- [ ] `deploy <appKey>` and `validate <appKey>` never touch `.protection/`; preflight on `upload .protection`
- [ ] Flags match table above; `--warnings-as-errors` → API `strict`
- [ ] Local AJV runs before dataplane on validate/upload
- [ ] Upload (single + batch) triggers datasource sync unless `--no-sync`
- [ ] TTY UI uses `cli-test-layout-chalk` + `protection-display.js`; matrix rows per **Output profile matrix**
- [ ] `--json` skips layout; snapshots cover validate + `upload .protection` batch
- [ ] All tests in **Tests** / **UI tests** sections pass
- [ ] No extra protection subcommands in v1
- [ ] New public functions have JSDoc; files ≤500 lines, functions ≤50 lines
- [ ] No hardcoded secrets; ISO 27001 patterns (mask tokens in errors)

**Validation (mandatory order — run once at end)**

```bash
cd /home/dev02/workspace/aifabrix-builder
npm run build    # FIRST — must succeed (includes lint + test:ci per project)
npm run lint     # zero errors/warnings if run standalone
npm test         # or npm run test:ci — all tests pass, ≥80% coverage on new code
```

Never skip build before lint/test. Do not commit if build or lint fails.

---

## Plan Validation Report

**Date**: 2026-05-16  
**Plan**: `.cursor/plans/141-protection-system.plan.md`  
**Status**: ✅ VALIDATED

### Plan Purpose

Implement **aifabrix protection** CLI keyed by **datasource key**, manifests in shared **`{work}/.protection/`**, batch **`validate|upload|convert .protection`**, **`deploy .protection` not implemented** (use **`upload .protection`**). Separate lifecycle from `integration/<app>/` external deploy. Type: **CLI Development** (Node.js / Commander.js / Jest).

### Applicable Rules

- ✅ CLI Command Development — Commander, validation, UX
- ✅ CLI Layout — layout-blocks, json-opt, matrix rows
- ✅ Code Quality Standards — 500/50 limits, JSDoc
- ✅ Quality Gates — BUILD → LINT → TEST
- ✅ Testing Conventions — Jest, ApiClient mocks
- ✅ Error Handling & Logging — formatBlockingError, no secrets
- ✅ docs-rules — user-facing command docs

### Rule Compliance

- ✅ DoD documents build/lint/test order
- ✅ CLI layout and API client patterns specified
- ✅ Scope boundaries clear (builder vs dataplane 401.x)
- ⚠️ Dataplane API prerequisite — document mock path if 401.1 not live (already noted)

### Plan Updates Made

- ✅ Added **Rules and Standards**, **Before Development**
- ✅ Normalized **Scope** (`### In scope` / `### Out of scope`)
- ✅ Expanded **Definition of Done** with explicit npm commands
- ✅ Synced frontmatter todos (`before-development`, `validation-gates`, `dod-closure`)

### Recommendations

- Implement **`dimension valueType`** before protection docs tell users to set catalog modes — avoids “unknown dimension” confusion during protection validate.
- Implement `protection-display.js` before wiring protection commands so TTY stays consistent from the first command.
- Add `tests/fixtures/protection/` validation report JSON from 401.2 for snapshot stability.
- Register **dimension + protection** matrix rows in the same PR as CLI registration to avoid layout drift.
- Keep **`dataType` vs `valueType`** visible in all dimension TTY output — primary support burden for governance authors.
