---
name: Protection system CLI (141)
overview: "Builder CLI for protection (validate, upload, deploy, show, delete): AJV + resolve + dataplane APIs only — no local protection logic. Runtime in 401.1–401.4."
todos:
  - id: before-development
    content: "Read cli-layout.mdc, upload.js, datasource-validation-cli; confirm dataplane protection APIs or mock strategy"
    status: pending
  - id: phase-1-schema-resolve
    content: "protection.schema.json + lib/protection/resolve.js + load/validate AJV"
    status: pending
  - id: phase-2-api
    content: "lib/api/protection.api.js + types"
    status: pending
  - id: phase-3-display
    content: "lib/protection/protection-display.js + snapshot tests (layout-blocks)"
    status: pending
  - id: phase-4-validate-upload
    content: "protection validate + upload commands wired to display"
    status: pending
  - id: phase-5-deploy-show-delete
    content: "deploy, show, delete + cli registration"
    status: pending
  - id: phase-6-docs-matrix-tests
    content: "docs/commands/protection.md, cli-output-command-matrix, Jest command tests"
    status: pending
  - id: validation-gates
    content: "npm run build → npm run lint → npm test (all pass, zero lint errors)"
    status: pending
  - id: dod-closure
    content: "Verify Definition of Done; five matrix rows; no extra protection subcommands"
    status: pending
isProject: false
---

# 141 — Builder CLI: protection manifests (implementation)

## What this plan is

| Repo | Plans | What gets built |
|------|-------|-----------------|
| **aifabrix-dataplane** | [401.1](../../aifabrix-dataplane/.cursor/plans/401.1-protection-system.plan.md)–[401.4](../../aifabrix-dataplane/.cursor/plans/401.4-protection-system-runtime.plan.md), [401.protection](../../aifabrix-dataplane/.cursor/plans/401.protection.plan.md) | APIs, DB, validation engine, sync projection, ABAC consumption |
| **aifabrix-builder** (this plan) | **141** | CLI only: manifests under `integration/<app>/.protection/`, dataplane API calls |

Dataplane implementation plans were **not** removed. **Implementation detail for the builder lives here.**

**Prerequisite:** Dataplane `POST/GET/DELETE /api/v1/protection/*` from 401.1 (can stub/mock in CLI tests until live).

### Builder only — what Node does and does not do

The builder **never evaluates protection logic locally** (no expressions, FK traversal, principal resolution, projection, or ABAC).

| Builder does | Builder does not |
|--------------|------------------|
| JSON Schema validation (AJV) — structure only | Semantic graph / runtime validation (dataplane only) |
| Resolve manifests under `integration/<app>/.protection/` | Evaluate rules or simulate grants locally |
| Call dataplane validate / simulate / upload / show / delete | Store deployment or projection runtime state |
| Optional datasource sync trigger (existing API) | Reinterpret dataplane WARN/FAIL semantics |

```text
Builder never stores local protection runtime state.
Dataplane is the source of truth for deployment and runtime/projection state.
```

**Auth / environment:** Reuse existing paths only — `resolveControllerUrl`, `getDeploymentAuth`, `resolveDataplaneUrl`, `-e/--env` (same as datasource test / upload). **No** protection-specific auth module or token flow.

## Scope

### In scope

- Five subcommands under `aifabrix protection`: `validate`, `upload`, `deploy`, `show`, `delete`
- Local JSON Schema validation (AJV), `lib/api/protection.api.js`, TTY via `protection-display.js`
- Optional datasource sync after upload/deploy (reuse existing sync API)
- Jest unit/command tests; user docs under `docs/commands/`
- **Code quality:** BUILD → LINT → TEST per project quality gates

### Out of scope

- Extra commands (`protection test`, `test-integration`, `test-e2e`, etc.) — **no CLI explosion in v1**
- Local semantic validation, projection, ABAC, or identity logic in Node
- Local `.upload-state.json` or other builder-side deployment truth (optional content-hash cache for skip-only is OK; not authoritative)
- Miso controller deploy (`aifabrix deploy <app>`) — different product path
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
- [ ] Plan matrix rows for five leaf commands before merging CLI registration

## Layout on disk

```text
integration/<appKey>/
  .protection/
    hubspot-country-sales.yaml    # v1: .yaml only (see below)
  application.yaml
  *-datasource-*.json
```

| Rule | v1 behavior |
|------|-------------|
| **File extension** | **`.yaml` only** under `.protection/` (no mixed `.json` in v1 — avoids extension ambiguity; add JSON later if platform adopts it elsewhere) |
| **`metadata.key` vs filename** | **Strict FAIL** if `metadata.key` ≠ filename stem (e.g. `hubspot-country-sales.yaml` → key must be `hubspot-country-sales`). Enforce in `resolve.js` + AJV where applicable. Prevents deployment drift immediately. |
| **Path safety** | **Reject** manifests outside `integration/<appKey>/.protection/` (no arbitrary paths, no `..` escape). Resolved path must sit under integration root for the resolved `appKey`. |

## Argument resolution (`<key|path>`)

Deterministic precedence for all commands that take `<key|path>`:

1. If the argument is an **existing file path** → use it (must pass path-safety rules above).
2. Else treat the argument as **`metadata.key`** → resolve `integration/<appKey>/.protection/<key>.yaml` (after `appKey` from `-a`, deploy positional, or cwd).

`appKey` resolution: deploy positional `[app]` → `-a/--app` → cwd integration discovery (same patterns as datasource commands).

## Commands and flags (v1)

Only these commands. Flag names match existing CLI (`datasource test`, `upload`, `delete`).

| Command | Flags |
|---------|--------|
| `protection validate <key\|path>` | `-a`, `-e`, `-v`, `--json`, `--warnings-as-errors`, `--simulate`, `--timeout` |
| `protection upload <key\|path>` | `-a`, `-e`, `-v`, `--dry-run`, `--no-sync` |
| `protection deploy [app]` | `-a`, `-e`, `--dry-run`, `--no-sync`, `--json` |
| `protection show <key>` | `-a`, `-e`, `--json` |
| `protection delete <key>` | `-a`, `-e`, `--yes` |

Register in [`lib/cli/index.js`](../lib/cli/index.js): `setupProtectionCommands(program)` from [`lib/commands/protection.js`](../lib/commands/protection.js).

### Flag semantics (v1)

| Flag | Semantics |
|------|-----------|
| `--warnings-as-errors` | Pass `strict: true` to dataplane validate/simulate. **Warnings from dataplane become blocking** for exit code / upload gate. Builder does **not** reclassify or invent extra strict rules. |
| `--dry-run` | **No dataplane mutation** — no `POST .../upload`, no `DELETE`. Allowed: local AJV + `POST .../validate` and (if requested) `POST .../simulate` only. |
| `--no-sync` | Upload/deploy still registers protection on dataplane. Protection is **active immediately**; **projections refresh only on the next datasource sync** for `spec.datasourceKey` (401.3). Print gray hint when sync skipped. |

## CLI terminal UI

**Product rule:** Protection CLI must **visually align with datasource validation UX** — same layout-blocks rhythm, glyphs, issue rows, and summary/footer patterns. Reuse `cli-test-layout-chalk` and datasource/validate display helpers; **do not invent protection-specific formatting conventions**.

| Doc | Use for |
|-----|---------|
| [cli-layout.mdc](../.cursor/rules/cli-layout.mdc) | Profiles, glyphs, `--json` rules |
| [layout.md](../.cursor/rules/layout.md) | Colors, sections, semantic red/yellow |
| [cli-output-command-matrix.md](../.cursor/rules/cli-output-command-matrix.md) | One row per leaf command (add five rows) |

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
| `aifabrix protection upload` | **layout-blocks** + **tty-summary** (footer) | **int** |
| `aifabrix protection deploy` | **layout-blocks** + **json-opt** | **int** |
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
  1. **Protection file** (always when resolved): `metadata('Protection: integration — /abs/.../integration/<app>/.protection/<key>.yaml')`
  2. **Application** (when `appKey` known): [`emitManifestMetadataLineIfTTY`](../lib/utils/manifest-source-emit.js) once — `Manifest: cwd/integration — .../application.yaml`
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
formatProtectionBatchDeployTTY(results, opts) → string
formatProtectionShowTTY({ manifest, status }, opts) → string
formatProtectionDeleteSummaryTTY(response, opts) → string
```

### Per-command UI

#### `protection validate <key|path>`

**Profile:** layout-blocks + json-opt.

**Flow (TTY):**

```text
Protection validate
────────────────────────────────────────
Protection: integration — /abs/.../.protection/hubspot-country-sales.yaml
Manifest: cwd/integration — /abs/.../application.yaml

Target
────────────────────────────────────────
Environment: dev
Dataplane: http://localhost:3201

  ⏳ Local schema check...
  ✔ Local schema valid

  ⏳ Dataplane validation...
Protection: hubspot-country-sales
Datasource: hubspot-deals
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
- Run aifabrix protection validate hubspot-country-sales
```

With `--simulate` and validate OK, append **Simulation:** section (sample size, grant preview counts) before Summary.

With `--json`: print full dataplane report JSON only (stdout).

#### `protection upload <key|path>`

**Profile:** layout-blocks header + tty-summary footer (same rhythm as [`upload.js`](../lib/commands/upload.js)).

```text
Protection upload
────────────────────────────────────────
Protection: integration — /abs/.../.protection/<key>.yaml
System: <appKey>

Target
...
  ⏳ Local schema check...
  ✔ Local schema valid
  ⏳ Dataplane validation...
  ✔ Validation passed

  ⏳ Uploading protection manifest...
✔ Protection 'hubspot-country-sales' uploaded (version 3)

  ⏳ Syncing datasource hubspot-deals...
✔ Sync started (jobId: …)
```

**`--dry-run`:** stop after validate (and simulate if requested); **no upload API call**. Yellow line `Dry run: would upload protection (no mutation).` + gray summary (`key`, `datasourceKey`, rule count).

**Upload API:** idempotent **upsert by `metadata.key`** on dataplane ([401.1](../../aifabrix-dataplane/.cursor/plans/401.1-protection-system.plan.md)).

**Operational note (TTY):** Deploying protection **before** the target datasource has synced data is valid; projection may produce **zero grants/values** until records exist — mention in docs when upload succeeds with no sync yet.

**`--no-sync`:** skip sync block; gray `Sync skipped (--no-sync). Protection active on dataplane; projections update on next datasource sync.`

**Blocking failure:** `formatBlockingError('Protection upload failed:')` + message; no success footer.

#### `protection deploy [app]`

**Profile:** layout-blocks batch + json-opt.

```text
Protection deploy
────────────────────────────────────────
App: hubspot
Manifest: cwd/integration — /abs/.../application.yaml

Target
...

hubspot-country-sales
  ✔ Validated and uploaded

hubspot-region-sales
  ✖ DP-PROT-020 Unknown dimension
      hint: dimensionKey "region" not in catalog

Summary:
  ✖ 1 passed, 1 failed
  Overall: Failed
```

**Deploy order:** Process `.protection/*.yaml` in **stable lexical sort** by filename (deterministic CI/local runs).

**`--dry-run`:** per-file `⏭ Would upload` / `✔ Would pass validation` — no upload mutations.

**Skip unchanged (v1):** **Content hash only** (SHA-256 of file bytes vs last hash in optional `.protection/.upload-state.json`). **No mtime** — avoids cross-environment false skips.

**Default:** **Stop on first validate/upload failure** (do not continue batch).

**`-v`:** per-file local path under each key.

**`--json`:** `{ appKey, results: [{ key, valid, uploaded, sync?, syncJobIds?, error?, report? }] }`.

#### `protection show <key>`

**Profile:** tty-summary + json-opt (like `app show` — compact facts, not full test layout).

**Source of truth:** **Deployed dataplane state** — not the local filesystem manifest. Local files may differ or be absent; `show` always queries dataplane.

**TTY fields (minimum):** `protectionKey`, **enabled**, **datasourceKey**, **version** (or content hash if API exposes), **last projection run** (`lastProjectionRunAt` / `lastSuccessfulProjectionRunAt`), projection status, rule counts, cached dynamic value / grant counts when status API provides them.

```text
Protection: hubspot-country-sales
────────────────────────────────────────
Environment: dev
Dataplane: http://localhost:3201

Enabled: yes
Datasource: hubspot-deals
Version: 3
Content hash: sha256:abc… (if returned)
Last upload: 2026-05-16T12:00:00Z
Last projection run: 2026-05-16T12:05:00Z (ok)

Rules: 4 enabled / 4 total
Dynamic values (cached): 128
Principal grants (cached): 512
```

**`--json`:** merged `GET /protection/{key}` + `GET .../status` payload.

#### `protection delete <key>`

**Profile:** tty-summary (mirror [`delete.js`](../lib/external-system/delete.js)).

Without `--yes`:

```text
⚠  Warning: Deleting protection 'hubspot-country-sales' will remove:
 - Projected dynamic dimension values for this protection
 - Principal grants linked to this protection
 - Protection manifest record on dataplane

Associated datasource: hubspot-deals (data not deleted)

Are you sure you want to delete protection 'hubspot-country-sales'? (yes/no):
```

With confirm / `--yes`:

```text
✔ Protection 'hubspot-country-sales' deleted
  Dynamic values removed: 128
  Principal grants removed: 512
```

**Scope of delete:** Removes **deployed protection manifest** and **lineage-generated** dynamic dimension values + principal grants on dataplane. **Does not** delete datasource records, external system config, or integration files on disk.

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
    resolve.js                           # resolve app + manifest path from key|path|--app
    load.js                              # read YAML manifest (v1)
    validate-local.js                    # AJV against protection.schema.json
    protection-display.js                # TTY + --json formatters (layout-blocks / tty-summary)
    protection-display-log-helpers.js    # optional split if display file > 500 lines
    sync-after-upload.js                 # trigger datasource sync by datasourceKey
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

### `lib/protection/resolve.js`

Resolve `{ appKey, manifestPath, protectionKey }` per **Argument resolution** above.

- Reject paths outside `integration/<appKey>/.protection/`
- Reject non-`.yaml` files in v1
- **Strict FAIL** when loaded `metadata.key` ≠ filename stem
- Errors: missing file, duplicate keys in deploy scan, multiple app matches

### `lib/protection/load.js`

- `loadProtectionManifest(manifestPath)` → parsed YAML only (v1)

### `lib/protection/validate-local.js`

- AJV compile `protection.schema.json` — **schema / shape only**
- **Never** semantic graph, FK, dimension catalog, or principal checks (dataplane validate/simulate only)
- Fail fast before any dataplane call

### Auth + dataplane URL

Reuse existing stack (no new auth model):

- [`resolveControllerUrl`](../lib/utils/controller-url.js)
- [`getDeploymentAuth`](../lib/utils/token-manager.js)
- [`resolveDataplaneUrl`](../lib/utils/dataplane-resolver.js)
- `-e, --env` passed through like datasource test commands

### `lib/protection/sync-after-upload.js`

After successful upload/deploy:

1. Collect **unique** `spec.datasourceKey` values from all manifests uploaded in the run (deploy: **one sync start per datasource key**, not per file)
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

### 1. `protection validate <key|path>`

```text
resolve path → load manifest → AJV
  → resolve dataplane URL + auth
  → POST validate
  → if --simulate and validate OK → POST simulate
  → printProtectionValidateReport (see CLI terminal UI)
  → exit 1 if invalid or --warnings-as-errors and WARNs
```

### 2. `protection upload <key|path>`

```text
resolve → load → AJV
  → POST validate (fail on error)
  → if --dry-run: stop after validate OK
  → POST upload
  → unless --no-sync: sync-after-upload for manifest.spec.datasourceKey
  → print success + status summary (-v for detail)
```

### 3. `protection deploy [app]`

```text
resolve appKey (arg or -a or cwd)
  → list integration/<app>/.protection/*.yaml (lexical sort)
  → optional: skip unchanged (content hash vs .protection/.upload-state.json)
  → for each file: load → AJV → validate → upload (stop on first fail)
  → if --dry-run: no upload mutations
  → batch sync: unique datasourceKeys once unless --no-sync
  → print batch summary with syncJobIds (--json optional)
```

### 4. `protection show <key>`

```text
resolve → GET protection + GET status
  → human summary or --json
```

No local file required (shows deployed state). Still accept `-a` for env/auth context.

### 5. `protection delete <key>`

```text
resolve → confirm unless --yes
  → DELETE protection
  → print cleanup summary from response
```

## Implementation order

1. Schema + `resolve` + `load` + `validate-local` + unit tests (offline)
2. `protection-display.js` + snapshot tests (fixture reports from 401.2 shape)
3. `protection.api.js` + mock tests
4. `validate` command wired to display
5. `upload` + `sync-after-upload` + upload TTY
6. `deploy`, `show`, `delete` + batch/show/delete TTY
7. Register CLI + docs + **five matrix rows**

## Tests

| Test | Covers |
|------|--------|
| `protection-resolve.test.js` | path vs key precedence, `--app`, cwd |
| `protection-resolve.test.js` | **[EDGE]** filename/key mismatch → strict FAIL |
| `protection-resolve.test.js` | **[EDGE]** manifest outside integration root → FAIL |
| `protection-resolve.test.js` | **[EDGE]** invalid extension (`.json`) → FAIL in v1 |
| `protection-validate-local.test.js` | AJV pass/fail; no semantic checks |
| `protection-validate.test.js` | mock ApiClient validate/simulate; `--warnings-as-errors` → `strict` |
| `protection-upload.test.js` | dry-run: no upload call; no-sync hint |
| `protection-deploy.test.js` | lexical order; stop on first fail; duplicate keys in folder |
| `protection-deploy.test.js` | unique datasource sync batching; syncJobId in summary |

Fixtures under `tests/fixtures/protection/` (valid YAML, key mismatch, invalid schema).

## Documentation

- [`docs/commands/protection.md`](../docs/commands/protection.md) — workflow and examples (no HTTP paths in prose per docs-rules)
- Update [`cli-output-command-matrix.md`](../.cursor/rules/cli-output-command-matrix.md) for five leaf commands

## Definition of Done

**Functional**

- [ ] `aifabrix protection validate|upload|deploy|show|delete` registered and documented
- [ ] Flags match table above; `--warnings-as-errors` → API `strict`
- [ ] Local AJV runs before dataplane on validate/upload/deploy
- [ ] Upload/deploy trigger datasource sync unless `--no-sync`
- [ ] TTY UI uses `cli-test-layout-chalk` + `protection-display.js`; five rows in `cli-output-command-matrix.md`
- [ ] `--json` skips layout; snapshots cover validate + deploy batch
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

Implement **aifabrix protection** CLI (validate, upload, deploy, show, delete) for integration `.protection/` manifests, calling dataplane protection APIs with layout-aligned TTY output. Type: **CLI Development** (Node.js / Commander.js / Jest).

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

- Implement `protection-display.js` before wiring commands so TTY stays consistent from the first command.
- Add `tests/fixtures/protection/` validation report JSON from 401.2 for snapshot stability.
- Register matrix rows in the same PR as `setupProtectionCommands` to avoid layout drift.
