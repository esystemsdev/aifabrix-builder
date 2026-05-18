---
name: local-datasource-load-export-cli (144)
overview: |
  Builder CLI: `aifabrix datasource load` and `aifabrix datasource export` for local JSON/NDJSON
  import/export via existing dataplane APIs only (bulk records sync + Records Search).
  Local files live under integration/.data/ with a predictable naming convention.
  No direct database access. No implementation until this plan is approved.
todos:
  - id: plan-review
    content: Review and approve this plan (API paths, record mapping, export pagination limits)
    status: pending
  - id: local-data-convention
    content: Document integration/.data/ naming, discovery, and .gitignore guidance
    status: pending
  - id: records-search-api
    content: lib/api/records-search.api.js + types (POST records search, paging via limit loop)
    status: pending
  - id: records-bulk-api
    content: Fix/extend bulk client for POST data-storage records bulk (replace stale external /bulk path)
    status: pending
  - id: bulk-loader-service
    content: lib/datasource/bulk-loader-service.js — parse JSON/NDJSON, chunk, bulk API, aggregate errors
    status: pending
  - id: datasource-exporter-service
    content: lib/datasource/datasource-exporter-service.js — search queries, paginate-by-limit, stream write
    status: pending
  - id: datasource-load-cli
    content: datasource load command + dry-run + verbose + display helpers
    status: pending
  - id: datasource-export-cli
    content: datasource export command + filters/fields + verbose + display helpers
    status: pending
  - id: cli-matrix-help
    content: cli-output-command-matrix rows, datasource help text, help-builder External Systems
    status: pending
  - id: docs-tests
    content: docs/commands/external-integration/datasources.md section; Jest for parser, mapper, CLI
    status: pending
  - id: validation-gates
    content: npm run build → npm run lint → npm test
    status: pending
isProject: false
---

# 144 — Local datasource load / export CLI

## What this plan is

| Repo | Plan | Responsibility |
| --- | --- | --- |
| **aifabrix-dataplane** | (no new plan) | Existing **Records Search** (`POST /api/v1/records/search`) and **record bulk sync** (`POST /api/v1/data-storage/{sourceIdOrKey}/records/bulk`) |
| **aifabrix-builder** (this plan) | **144** | CLI `datasource load` / `datasource export`, local file discovery, parsers, API wrappers, TTY/`--json`, user docs |

**Status:** **Draft — awaiting approval.** No code changes until stakeholder sign-off.

## Problem

Integrators need a **simple, repeatable** way to:

1. **Seed** dataplane storage from local fixture files (dev, demos, regression datasets) without writing one-off scripts.
2. **Export** governed records back to disk for diffing, backups, or offline inspection.

Today there is no first-class CLI for either path. Ad-hoc scripts often bypass ABAC/search governance or reach for database connections — both are unacceptable for this platform.

**Goal:** Two commands that use **only published dataplane HTTP APIs**, with files in a **standard location** beside integration manifests.

## Non-goals (v1)

- CSV or other formats (JSON array + NDJSON only).
- Direct Postgres / records-DB connections from the builder.
- Replacing `aifabrix upload`, sync jobs, or `test-e2e` vendor flows.
- REST runtime canonical paths (`/api/v1/external/rest/...`) — bulk sync + RSS only.
- Builder-container apps (`builder/<appKey>/`) — **external integration only**, same guard as `test-trust` / `test-e2e`.
- Auto-generating field mappings from exported data.
- Watch mode, protection CLI coupling, or publish gates.

## Governance model (why export uses Records Search)

| Concern | Load (`datasource load`) | Export (`datasource export`) |
| --- | --- | --- |
| Entry API | `POST /api/v1/data-storage/{datasourceKey}/records/bulk` | `POST /api/v1/records/search` |
| Permission | `external-data-source:sync` | `record:search` |
| ABAC | Enforced on bulk sync path (dataplane) | Enforced in Records Search Service before results |
| Audit | Dataplane bulk sync audit events | Search audit ref in response `meta.auditRef` |
| Why not DB | N/A — writes go through sync service | Export must not read physical tables; search is the governed read primitive |

**Operator messaging (TTY):** Export is **governed search output**, not a raw DB dump. Filters and ABAC may exclude rows; `meta.excluded` counts are surfaced in verbose mode.

## Verified dataplane API contracts

> User brief mentioned `POST /datasources/{key}/bulk` and `POST /search/query`. **Canonical paths below are verified in dataplane OpenAPI and tests.**

### Bulk load (write)

- **Path:** `POST /api/v1/data-storage/{sourceIdOrKey}/records/bulk`
- **Operation:** `bulkSyncExternalData`
- **Body:** `ExternalRecordBulkRequest`

```json
{
  "syncType": "incremental",
  "sync": false,
  "records": [
    {
      "key": "ext-1",
      "displayName": "Row one",
      "recordType": "item",
      "metadata": { "email": "a@example.com", "name": "Row one" }
    }
  ]
}
```

- **`syncType`:** `incremental` (default for CLI load), `bulk`, or `validate` (dry-run on server — distinct from CLI `--dry-run`).
- **Evidence:** `tests/api/v1/endpoints/test_external_data.py`, `tests/api/v1/endpoints/records/test_records_search_after_bulk_sync_http.py`

**Builder gap:** `lib/api/datasources-core.api.js` → `bulkOperation` still posts to **`/api/v1/external/{sourceIdOrKey}/bulk`**, which is **not** in current OpenAPI. Plan **144** must add or replace with **`/api/v1/data-storage/{sourceIdOrKey}/records/bulk`** (do not call the stale path).

### Records search (read / export)

- **Path:** `POST /api/v1/records/search` (not `/search/query`)
- **Operation:** `searchRecords`
- **Body:** `RecordsSearchRequest` — scope with `datasourceKeys: [datasourceKey]`, `searchMode: "full"`, `intent` (default `validation` for export), optional `filters` / `exclude`, `limit` (1–10000).
- **Response:** `{ data, meta, links }` — `data` is full records when `searchMode` is `full`.
- **Evidence:** `app/api/v1/endpoints/records/search.py`, `app/schemas/records_search.py`

**Pagination v1 limitation:** RSS currently returns a **single page** (`meta.currentPage` is always 1; `links.next` is empty). Export loops by raising `limit` only up to **10000** per run. Document this cap; add open question for offset/cursor pagination if larger exports are required.

## Local data layout (`integration/.data/`)

### Directory

```
integration/
  .data/                          # shared local record fixtures (not per-app subfolder)
    hubspot-test-data-company.json
    hubspot-test-data-users.ndjson
  hubspot-test/
    application.yaml
    hubspot-test-datasource-company.json
    ...
```

- **Folder:** `integration/.data/` at the integration root (sibling of `hubspot-test/`, `sharepoint-test/`, etc.).
- **Not** `integration/<systemKey>/.data/` for v1 (keeps paths stable when cwd is repo root).

### File naming

```
{systemKey}-data-{entitySuffix}.{json|ndjson}
```

| Input | Resolved parts | Example file |
| --- | --- | --- |
| `datasourceKey` `hubspot-test-company`, `systemKey` `hubspot-test` | `entitySuffix` = `company` (strip `{systemKey}-` prefix from key) | `integration/.data/hubspot-test-data-company.json` |
| Datasource file `hubspot-test-datasource-users.json` | Same suffix `users` when key is `hubspot-test-users` | `hubspot-test-data-users.ndjson` |

**Resolution order for default input/output path:**

1. CLI `--file <path>` if provided.
2. Else `integration/.data/{systemKey}-data-{entitySuffix}.json` if exists.
3. Else same path with `.ndjson` extension.
4. Else fail with actionable error listing expected paths.

**`entitySuffix` algorithm:**

1. Load datasource manifest; read `systemKey` and `key`.
2. If `key` starts with `` `${systemKey}-` ``, suffix = remainder.
3. Else suffix = segment after last `-` in `key`, or full `key` if no hyphen.

### File formats (v1)

| Format | Structure | Parser |
| --- | --- | --- |
| **JSON** | Top-level **array** of objects | `JSON.parse` entire file |
| **NDJSON** | One JSON object per line (blank lines skipped) | Line stream |

**No CSV in v1.**

### Record shapes in files

Support two input shapes (auto-detect per object):

1. **Canonical bulk record** (pass-through): `{ key, displayName, recordType, metadata }` — sent as-is after validation.
2. **Payload / metadata-only** (convenience): plain object → mapped using datasource manifest:
   - `key` from `primaryKey` field(s) in payload (composite keys joined per existing builder conventions).
   - `recordType` from datasource `resourceType`.
   - `displayName` from `labelKey` when present, else empty string.
   - Full object (or remainder) stored in `metadata`.

**Minimal validation (client-side, before upload):**

- Non-empty array after parse.
- Each record: resolvable `key`, string `recordType`, object `metadata` (may be empty).
- `--dry-run`: parse + map + chunk size estimate + required-field check; **no HTTP bulk POST**.

### Git / secrets

- Recommend `integration/.data/*.json` in `.gitignore` for real PII; allow committed **synthetic** fixtures via team policy.
- Document: never commit production exports with live credentials in metadata.

## Command surface

Register under existing `aifabrix datasource` / `af ds` group (after `upload`, before or after test commands — align with `docs/commands/external-integration/datasources.md`).

| Command | Purpose |
| --- | --- |
| `aifabrix datasource load <datasourceKey>` | Parse local file → chunk → bulk sync API |
| `aifabrix datasource export <datasourceKey>` | Records search → serialize JSON or NDJSON |

**External integration only.** If resolved app is `builder/<appKey>/`, exit with clear error (same pattern as `test-trust`).

### Shared flags

| Flag | Load | Export | Notes |
| --- | --- | --- | --- |
| `-a, --app <integrationFolder>` | yes | yes | Resolve system/datasource manifest |
| `-e, --env <name>` | yes | yes | Environment in aifabrix config |
| `--file <path>` | yes | yes | Override default `integration/.data/...` path |
| `-v, --verbose` | yes | yes | Progress, batch stats, excluded counts |
| `--json` | yes | yes | Machine output; no TTY layout |
| `--dry-run` | yes | no | Load only: parse/validate/size; no upload |
| `--batch-size <n>` | yes | — | Default `100` (tune per payload size) |
| `--sync-type <incremental\|bulk\|validate>` | yes | — | Default `incremental`; maps to API `syncType` |
| `--format <json\|ndjson>` | auto | yes | Infer from extension when omitted |
| `--filter <json>` | — | yes | JSON filter object for `RecordsSearchRequest.filters` |
| `--fields <csv>` | — | yes | Project exported metadata keys (top-level); omit = full record objects in `data` |
| `--limit <n>` | — | yes | Default `1000`; max `10000` (API cap) |
| `--intent <retrieval\|grounding\|analytics\|validation>` | — | yes | Default `validation` for export |

**Auth:** `aifabrix auth status` before run; use existing dataplane URL + token resolution. Apply plan **142** version gate on all dataplane calls.

## Services (builder modules)

| Module | Responsibility |
| --- | --- |
| `lib/datasource/local-data-paths.js` | Resolve `integration/.data/` paths, entity suffix, `--file` override |
| `lib/datasource/record-file-parser.js` | JSON array + NDJSON streaming parse |
| `lib/datasource/record-mapper.js` | Payload → canonical bulk record using datasource manifest |
| `lib/datasource/bulk-loader-service.js` | Chunk, call bulk API, retries (transient 5xx/429), aggregate per-batch errors |
| `lib/datasource/datasource-exporter-service.js` | Build search request, call search API, apply `--fields`, write output file |
| `lib/api/records-search.api.js` | `searchRecords(dataplaneUrl, authConfig, body)` |
| `lib/api/records-bulk.api.js` (or fix `datasources-core.api.js`) | `bulkSyncRecords(...)` → correct path |
| `lib/utils/datasource-load-display.js` | TTY layout-blocks for load |
| `lib/utils/datasource-export-display.js` | TTY layout-blocks for export |
| `lib/commands/datasource-load-export-cli.js` | Commander registration |

Keep each new file ≤500 lines, functions ≤50 lines.

## CLI output layout (TTY — `layout-blocks`)

Profile: **layout-blocks** + **json-opt** + manifest line **int** (plan 141). Register rows in [cli-output-command-matrix.md](../.cursor/rules/cli-output-command-matrix.md).

Design principles:

1. **Label the layer** — Load: “dataplane bulk sync”; Export: “governed records search (not a DB dump)”.
2. **Show paths** — Gray `Manifest:` and `Data file:` lines with absolute paths.
3. **Progress** — Verbose: records processed, batches, bytes written; non-verbose: summary only.
4. **Failures** — Per-batch errors aggregated; blocking ✖ for exit 1.

### `datasource load` — success (verbose)

```text
────────────────────────────────────────────────────────
  Load records — hubspot-test-company
  Environment: dev · System: hubspot-test
────────────────────────────────────────────────────────

  Layer: dataplane bulk sync (incremental)
  Manifest: integration/hubspot-test — /abs/.../application.yaml
  Data file: /abs/.../integration/.data/hubspot-test-data-company.json

  Parsed: 250 records · format json · est. 3 batch(es) @ 100

  Batch 1/3  ✔ inserted 100 · updated 0 · failed 0
  Batch 2/3  ✔ inserted 100 · updated 0 · failed 0
  Batch 3/3  ✔ inserted 50 · updated 0 · failed 0

  Result: ✔ 250 processed · 250 inserted · 0 updated · 0 failed
────────────────────────────────────────────────────────
```

### `datasource load` — dry-run

```text
  Mode: dry-run (no upload)

  Parsed: 250 records · valid keys · est. payload ~1.2 MB
  Would upload: 3 batch(es) · syncType incremental

  ✔ Dry-run passed
```

### `datasource load` — partial failure

```text
  Batch 2/3  ✖ failed 2 of 100

  Failures (first 5)
  • rec-042 — validation: metadata.name required
  • rec-099 — HTTP 409 conflict

  Result: ✖ 198 ok · 2 failed (exit 1)
```

### `datasource export` — success (verbose)

```text
────────────────────────────────────────────────────────
  Export records — hubspot-test-company
  Environment: dev · System: hubspot-test
────────────────────────────────────────────────────────

  Layer: governed records search (ABAC applied)
  Not used: direct database access

  Search: intent validation · limit 1000 · filters (none)
  Manifest: integration/hubspot-test — /abs/.../application.yaml
  Output: /abs/.../integration/.data/hubspot-test-data-company.ndjson

  Fetched: 437 records · excluded abac 12 · filter 3
  Wrote: 437 lines (ndjson) · 2.1 MB

  ✔ Export complete
────────────────────────────────────────────────────────
```

### `datasource export` — hit limit cap

```text
  ⚠ Fetched 10000 records (limit cap). More rows may exist.
  Re-run with --filter or wait for dataplane search pagination.
```

### `--json` shapes (sketch)

**Load result:**

```json
{
  "datasourceKey": "hubspot-test-company",
  "systemKey": "hubspot-test",
  "dryRun": false,
  "file": "/abs/.../hubspot-test-data-company.json",
  "recordCount": 250,
  "batches": [{ "index": 1, "insertedCount": 100, "updatedCount": 0, "failed": [] }],
  "totals": { "insertedCount": 250, "updatedCount": 0, "failedCount": 0 }
}
```

**Export result:**

```json
{
  "datasourceKey": "hubspot-test-company",
  "outputFile": "/abs/.../hubspot-test-data-company.ndjson",
  "recordCount": 437,
  "meta": { "excluded": { "abac": 12, "filter": 3 }, "auditRef": "rss-..." }
}
```

## Exit codes

| Code | Load | Export |
| --- | --- | --- |
| **0** | All batches succeeded (or dry-run passed) | Search OK, write OK (warnings allowed unless `--strict`) |
| **1** | Parse/validation failure, any batch failures, or `--dry-run` validation failed | Search/write failure, or zero rows when user passed `--strict` |
| **3** | Auth, dataplane unreachable, version gate failure | Same |

## Implementation map (when approved)

| Area | File(s) | Notes |
| --- | --- | --- |
| API search | `lib/api/records-search.api.js`, `lib/api/types/records-search.types.js` | `@requiresPermission` `record:search` |
| API bulk | `lib/api/records-bulk.api.js` or fix `datasources-core.api.js` | `@requiresPermission` `external-data-source:sync` |
| Paths / parse | `local-data-paths.js`, `record-file-parser.js`, `record-mapper.js` | Unit-test heavy |
| Services | `bulk-loader-service.js`, `datasource-exporter-service.js` | No DB imports |
| CLI | `datasource-load-export-cli.js`, extend `lib/commands/datasource.js` | Commander |
| Display | `datasource-load-display.js`, `datasource-export-display.js` | `cli-test-layout-chalk` |
| Docs | `docs/commands/external-integration/datasources.md` | Command-centric per docs-rules |
| Tests | `tests/lib/datasource/bulk-loader-service.test.js`, export/parser tests, CLI action mocks | ≥80% on new modules |

## Rules and standards

Comply with [project-rules.mdc](../.cursor/rules/project-rules.mdc):

| Rule | Apply to 144 |
| --- | --- |
| [CLI Command Development](../.cursor/rules/project-rules.mdc#cli-command-development) | Commander, validation, chalk errors |
| [cli-layout.mdc](../.cursor/rules/cli-layout.mdc) + [layout.md](../.cursor/rules/layout.md) | layout-blocks, glyphs ✔ ⚠ ✖ |
| [cli-output-command-matrix.md](../.cursor/rules/cli-output-command-matrix.md) | Add `datasource load` + `datasource export` rows |
| [docs-rules.mdc](../.cursor/rules/docs-rules.mdc) | User docs: outcomes, not HTTP tutorial |
| API client pattern | `lib/api/*` only |
| [Code Quality Standards](../.cursor/rules/project-rules.mdc#code-quality-standards) | ≤500 lines/file, ≤50 lines/function, JSDoc |
| [Security & Compliance](../.cursor/rules/project-rules.mdc#security--compliance-iso-27001) | No secrets in logs; no DB export |
| [Quality Gates](../.cursor/rules/project-rules.mdc#quality-gates) | build → lint → test |

**Key requirements:**

- `try/catch` on all async paths; `formatBlockingError` for failures.
- `path.join()` for all file operations.
- JSDoc on exported functions.
- Update `DATASOURCE_HELP_AFTER` examples in `lib/commands/datasource.js`.

## Before development

- [ ] Approve this plan **144**.
- [ ] Confirm bulk API path fix (`data-storage/.../records/bulk`) with dataplane owner.
- [ ] Confirm export pagination strategy (v1 cap vs dataplane enhancement).
- [ ] Read [cli-layout.mdc](../.cursor/rules/cli-layout.mdc), [143 plan](143-test-trust-semantic-validation-cli.plan.md) for CLI patterns.
- [ ] Run `aifabrix auth status` in target dev environment.
- [ ] Add matrix rows before merging CLI registration.

## Definition of Done

1. `aifabrix datasource load <datasourceKey>` and `datasource export <datasourceKey>` registered with flags above.
2. Default paths use `integration/.data/{systemKey}-data-{entitySuffix}.{json|ndjson}`.
3. Load uses **`POST /api/v1/data-storage/{key}/records/bulk`** only; export uses **`POST /api/v1/records/search`** only.
4. TTY matches § CLI output layout (snapshot tests).
5. `--dry-run` on load performs no upload.
6. Docs: import/export examples, NDJSON, governance, search-vs-DB rationale.
7. **`npm run build`** FIRST → **`npm run lint`** → **`npm test`** (zero lint errors; ≥80% coverage on new modules).
8. File size and JSDoc rules satisfied.

## Open questions (resolve before implementation)

1. **Stale builder bulk URL** — Deprecate `bulkOperation` `/api/v1/external/.../bulk` or alias to data-storage path?
2. **Export >10k rows** — Wait for RSS pagination, or add filter-based chunking in v2?
3. **Default `syncType`** — Is `incremental` correct for integrator fixtures (no deletes), or should default be `bulk` with explicit `--sync-type`?
4. **`.data` in git** — Commit synthetic fixtures only, or always gitignore `integration/.data/`?
5. **Server `syncType: validate`** — Expose as `--server-validate` for preview without CLI `--dry-run`?
6. **Publish before load** — Should load auto-run `upload` when datasource missing on dataplane (like `test-e2e --sync`)? Default **no** for v1.

## Acceptance (plan approval checklist)

- [ ] Stakeholder approves `integration/.data/` naming and flat folder layout.
- [ ] Stakeholder accepts export pagination cap for v1 (≤10000 per run).
- [ ] TTY mockups signed off (load vs export layer labeling).
- [ ] API path alignment confirmed with dataplane OpenAPI.
- [ ] **No implementation PRs until plan 144 is approved.**

---

## Plan Validation Report

**Date**: 2026-05-18  
**Plan**: `.cursor/plans/144-local-datasource-load-export-cli.plan.md`  
**Status**: ⚠️ NEEDS UPDATES (draft awaiting stakeholder approval; structurally complete)

### Plan Purpose

Implement **local JSON/NDJSON import/export** for external datasource keys in the AI Fabrix Builder CLI, using dataplane **bulk record sync** for loads and **Records Search** for exports. Includes `integration/.data/` file conventions, services, CLI TTY layout, and user documentation. Type: **Development** (CLI commands, API clients, docs). Scope: CLI, `lib/api/`, `lib/datasource/`, docs — not dataplane changes.

### Applicable Rules

- ✅ [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development) — New `datasource load` / `export` subcommands
- ✅ [cli-layout.mdc](.cursor/rules/cli-layout.mdc) — layout-blocks TTY mockups
- ✅ [cli-output-command-matrix.md](.cursor/rules/cli-output-command-matrix.md) — Matrix rows required at implementation
- ✅ [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) — File/function limits, JSDoc
- ✅ [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) — BUILD → LINT → TEST documented in DoD
- ✅ [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) — Jest coverage for parsers/services/CLI
- ✅ [Security & Compliance](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) — No DB access, no secrets in logs
- ✅ [docs-rules.mdc](.cursor/rules/docs-rules.mdc) — Command-centric user documentation
- ✅ [API client pattern](.cursor/rules/project-rules.mdc#api-client-structure-pattern) — `lib/api/` modules with JSDoc types

### Rule Compliance

- ✅ DoD Requirements: Documented (build → lint → test, order mandatory)
- ✅ File size / JSDoc: Referenced in plan
- ✅ CLI layout / matrix: Specified; rows pending implementation
- ⚠️ API paths: Corrected from user brief; stale `bulkOperation` path flagged
- ⚠️ Plan approval: Explicit gate — no code until approved

### Plan Updates Made

- ✅ Added **Rules and Standards** section with project-rules links
- ✅ Added **Before Development** checklist
- ✅ Added **Definition of Done** with validation order
- ✅ Added **CLI output layout** (TTY mockups) per user request
- ✅ Documented **integration/.data/** naming convention
- ✅ Verified dataplane endpoints against OpenAPI/tests
- ✅ Added validation report (this section)

### Recommendations

1. **Approve** plan 144 before any implementation branch.
2. **Resolve open question #1** (stale `/api/v1/external/.../bulk`) early — implementation must not ship the wrong URL.
3. **Resolve open question #2** (export row cap) or document product expectation for large tenants.
4. When implementing, add **cli-output-command-matrix** rows: `aifabrix datasource load | layout-blocks + json-opt | int` and `aifabrix datasource export | layout-blocks + json-opt | int`.
5. Add a short cross-link from [external-integration-testing.md](../docs/commands/external-integration-testing.md) (“after E2E, use load/export for fixture round-trips”) during docs task.
