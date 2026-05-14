# Plan 140 — Platform installation log (`installation.log`)

> **Note:** Plan file basename retains the requested spelling `installatoin`; the on-disk log file must be spelled correctly: **`installation.log`**.

## Goal

When the user runs any of these **top-level** commands, append **exactly one** new installation record to the end of **`installation.log`** in the AI Fabrix CLI system directory (same directory as `config.yaml`, i.e. `paths.getAifabrixSystemDir()` — typically `~/.aifabrix/`):

- `aifabrix setup`
- `aifabrix teardown`
- `aifabrix up-infra`
- `aifabrix up-platform`
- `aifabrix up-miso`
- `aifabrix up-dataplane`

Each record describes **what happened operationally** (one action, one outcome, one readable block). **Do not** evolve this file into `audit.log`, debug output, or telemetry — scope stays deliberately boring and operator-scannable.

## Non-goals

- Replacing or duplicating `audit.log` semantics; keep ISO audit trail in `audit.log` as today.
- Logging every Docker API call, full compose stdout, `docker inspect`, registry metadata, or **image digests** (tags only).
- Storing credentials or raw `application.yaml` / `secrets.local.yaml` / `.env` contents.
- Serializing raw exception objects (no stack, no `cause` chain, no nested error JSON).

## Evidence (current code)

| Area | Location |
|------|----------|
| CLI registration `setup` / `teardown` | `lib/cli/setup-platform.js` |
| `setup` orchestration + infra detection | `lib/commands/setup.js` |
| Setup modes + `up-infra` + guided `up-platform` | `lib/commands/setup-modes.js` |
| `up-infra`, `up-platform`, `up-miso`, `up-dataplane` registration | `lib/cli/setup-infra.js` |
| Guided platform flow | `lib/cli/infra-guided.js` |
| `up-miso` / `up-dataplane` | `lib/commands/up-miso.js`, `lib/commands/up-dataplane.js` |
| `teardown` | `lib/commands/teardown.js` |
| Resolved config directory (log file parent) | `lib/utils/paths.js` → `getAifabrixSystemDir()` |
| Masking today | `lib/core/audit-logger.js` (`maskSensitiveData`, `getAuditLogPath`) |
| CLI package version | `package.json` `version` |

---

## Recommendations (normative for this plan)

### 1. Shared masking only (day one)

- **Extract** `maskSensitiveData` (and any helpers it needs) from `lib/core/audit-logger.js` into a single shared module, e.g. `lib/utils/log-redaction.js`.
- **Import** that module from `audit-logger.js` and from the installation-log writer.
- **Do not** add a second redaction implementation — secret drift between logs is a long-term maintenance risk.

### 2. One record per top-level command

- **`setup`:** emit **one** record when `handleSetup` finishes (success, failure, or user abort), aggregating infra + platform sub-steps inside that block. **No** nested records from `setup-modes`, `infra-guided`, or internal `up-*` helpers during the same `setup` invocation.
- **Standalone** `up-infra`, `up-platform`, `up-miso`, `up-dataplane`, **`teardown`:** one record each run.

### 3. Duration

- Capture **`startedAt`** (UTC ISO8601) when the top-level command handler begins (or as early as practical without double-starting on re-entrancy).
- Capture **`completedAt`** and derive **`durationSec`** (integer) or **`durationMs`** (pick one convention and stick to it in the schema; `durationSec` is enough for support if documented).

### 4. CLI version and platform version

- **`cliVersion`:** from Builder `package.json` at runtime (same source as `aifabrix --version` if applicable).
- **`platformVersion`:** human-meaningful tag when known (e.g. image tag string shared across platform images, or per-app tags under Platform Apps). If unknown, emit `unknown` rather than inventing. **Tags only** — see §10.

### 5. Hostname

- **Default:** do **not** log machine hostname (can be noisy or sensitive in enterprise).
- **Optional:** support logging hostname only behind an explicit opt-in (env or flag) if product later requires it — **off by default**. **`developerId`** is sufficient for most diagnostics.

### 6. Errors

- On failure: log **sanitized** error **message** only (pipe through shared `maskSensitiveData`).
- Optional **`errorCode`** when available (stable string or numeric code from known errors).
- **Never** log `error.stack`, `error.cause`, serialized nested objects, or raw `String(error)` of non-primitives without redaction and truncation rules.

### 7. Source of values

- For toggles and URLs that can come from config vs CLI, annotate provenance, e.g.  
  `traefik: true (config)`  
  `tlsEnabled: false (cli override)`  
  This reduces “why did setup do X?” confusion during support.

### 8. Operation ID

- Generate a stable, human-readable **`operationId`** per record (e.g. `op_20260513_001` using UTC date + per-process counter, or a short UUID).  
- Enables future correlation with `audit.log`, support bundles, or telemetry without merging those systems now.

### 9. Deterministic section order

Records use a **fixed** section order so operators can scan visually:

1. **Identity** — `recordVersion`, `operationId`, `command`, `mode` (interactive | automation), `developerId`, `cliVersion`, `platformVersion` (if known), `startedAt`, `completedAt`, `durationSec`
2. **Outcome** — `outcome: success|failure|aborted` (use `aborted` for user cancel if distinguishable)
3. **Infra** — effective service toggles + provenance annotations
4. **Platform apps** — app keys + **image tags only** (no digests)
5. **Config** — safe keys only; URLs without userinfo; `adminEmail: set|unset` (never raw email unless product explicitly allows)
6. **Cleanup** — teardown / reinstall impact fields (`volumesRemoved`, `configPreserved`, builder dirs cleaned as names-only when relevant)
7. **Error** — present **only** on failure/aborted-with-error: sanitized message + optional `errorCode`; omit section entirely on success

Empty sections may be omitted **or** printed as `  (none)` — pick one rule in implementation and test it; prefer **omit** to reduce noise unless operators ask for explicit placeholders.

### 10. Images

- Log **repository:tag** strings only (what the operator would `docker pull`).
- **Do not** log SHA256 digests, inspect output, or registry auth headers.

### 11. Interactive vs non-interactive

- Log **`mode: interactive`** when stdin is a TTY / prompts may run; **`mode: automation`** when `-y` / `--yes` / CI-style non-interactive paths dominate. Document the heuristic in code comments.

### 12. Teardown persistence impact

- Teardown records must state persistence clearly, e.g.:  
  `volumesRemoved: true`  
  `configPreserved: true`  
  (Values must match actual `teardown` / `down-infra` behavior in `lib/commands/teardown.js`.)

### 13. Record schema version

- First line inside the block after headers: **`recordVersion: 1`** so future parsers or support tooling can evolve safely.

### 14. Atomic append

- Build the **entire** record string in memory (single buffer), run **full-body** `maskSensitiveData` on any user-derived or error-derived fragments before assembly if needed, then **`appendFile` once** (or one `fs.open` + `write` + `close`). Avoid partial writes on crash mid-record.

### 15. Operational scope only

- Keep content to “what happened operationally?” — no debug verbosity, no audit-grade security narrative (that stays in `audit.log`).

### 16. Rotation safeguard (small, recommended)

- Even if minimal v1 ships without rotation, add a **small** safeguard early: when `installation.log` exceeds **10–20 MB**, rotate to `installation.log.1`, shift prior `.1` → `.2`, etc., **keep last 3 files**. Prevents rare support incidents years later. Implementation can be a few lines before append.

---

## Example record (illustrative)

```txt
================================================================================
INSTALLATION 2026-05-13T12:00:00Z
--------------------------------------------------------------------------------
recordVersion: 1
operationId: op_20260513_001
command: setup
outcome: success
durationSec: 84
cliVersion: 1.8.2
platformVersion: 2026.05
developerId: 2
mode: interactive
startedAt: 2026-05-13T11:58:36Z
completedAt: 2026-05-13T12:00:00Z

Infra
  traefik: true (config)
  tlsEnabled: false (cli override)
  pgAdmin: true (config)
  redisCommander: true (config)

Platform Apps
  keycloak: quay.io/keycloak/keycloak:26.1
  miso-controller: ghcr.io/esystems/miso:2026.05
  dataplane: ghcr.io/esystems/dataplane:2026.05

Config
  controllerUrl: https://localhost:8443
  adminEmail: set

Cleanup
  volumesRemoved: false
  configPreserved: true

================================================================================
```

*(Failure records add **Error** section; **Cleanup** may reflect reinstall / wipe modes for `setup`.)*

---

## Implementation approach

1. **`lib/utils/log-redaction.js`**  
   - Move **`maskSensitiveData`** (and dependencies) from `audit-logger.js`; re-export for audit + installation log.  
   - Add unit tests for redaction in one place.

2. **`lib/utils/installation-log.js`** (or `lib/core/installation-log.js`)  
   - `appendInstallationRecord(dto)` — validates DTO, renders deterministic sections, applies masking to error lines, optional rotation check, single atomic append.  
   - `createOperationId()` — timestamp-based or UUID per recommendations.  
   - Swallow filesystem errors with **one** `logger.warn` so CLI never fails because logging failed.

3. **Session timing**  
   - Thin **`withInstallationTiming(command, fn)`** or explicit `markStart`/`markEnd` at the **single** outer handler for each top-level command (`setup.js` action wrapper, `setup-infra.js` per command, `teardown.js`).

4. **Call sites**  
   - **`lib/commands/setup.js`:** one success/failure/abort path → one record.  
   - **`lib/cli/setup-infra.js`:** one record per `up-infra` / `up-platform` / `up-miso` / `up-dataplane`.  
   - **`lib/commands/teardown.js`:** one record with **Cleanup** / persistence fields.  
   - **Do not** call the writer from nested helpers invoked during `setup` unless guarded so only the outer `setup` emits (e.g. pass `installationContext: null` into helpers when invoked from setup, or use async local storage / single-flight flag — simplest: **only** `handleSetup` and standalone command handlers call the writer).

5. **Platform version source**  
   - Derive from resolved image tags already chosen for keycloak/miso/dataplane, or from a single env/manifest constant if one exists; document “unknown” fallback in code.

6. **Tests** (`tests/lib/utils/log-redaction.test.js`, `tests/lib/utils/installation-log.test.js`)  
   - Redaction: secrets in messages → masked.  
   - Installation log: temp dir, atomic append, deterministic section order, no stack in error fixture, rotation at threshold (optional separate test with small max size for speed).

7. **Documentation**  
   - One-line mention: append-only `installation.log` beside `config.yaml`; no secrets; correlates with `operationId` for support.

## CLI layout / matrix

- Update `.cursor/rules/cli-output-command-matrix.md` only if user-visible lines are added; if logging stays silent, note “writes `installation.log` (silent)”.

## Open questions (resolve during implementation)

1. **`down-infra`** alone: still **out of scope** unless product extends the command list.  
2. **`up-platform --force`:** log **cleaned app names** under **Cleanup** (names only, no paths with home if that leaks layout policy — prefer app keys).

---

## Implementation checklist

- [x] Extract **`maskSensitiveData`** → `lib/utils/log-redaction.js`; wire **`audit-logger.js`**.  
- [x] Add **`installation.log`** writer: `recordVersion`, `operationId`, timing, versions, deterministic sections, atomic append, optional rotation.  
- [x] Wire **one record** per: `setup`, `teardown`, `up-infra`, `up-platform`, `up-miso`, `up-dataplane` (no nested records during `setup`).  
- [x] Provenance annotations `(config)` / `(cli override)` where feasible.  
- [x] Teardown: **`volumesRemoved`**, **`configPreserved`** (and any other factual booleans from implementation).  
- [x] **`mode: interactive|automation`** heuristic.  
- [x] Errors: sanitized message + optional code only.  
- [x] Unit tests: redaction + installation log + rotation (if implemented).

## Implementation Validation Report

**Date**: 2026-05-13  
**Plan**: `.cursor/plans/140-installatoin.log.plan.md`  
**Status**: ✅ COMPLETE (implementation + quality gates)

### Executive Summary

Plan 140 is implemented in the builder repo: shared redaction in `lib/utils/log-redaction.js`, append-only `installation.log` beside the system config dir, one record per scoped top-level command, rotation, masked errors, and unit tests. `npm run lint:fix`, `npm run lint`, and `npm test` all completed successfully (574 tests, 54 suites).

### Task completion

| Area | Status |
|------|--------|
| Checklist (§ Implementation checklist) | 8/8 marked complete after verification |
| Shared masking / no duplicate redaction | ✅ `audit-logger.js` imports `maskSensitiveData` from `log-redaction.js`; installation record uses same module |
| Installation log writer | ✅ `lib/utils/installation-log.js` (+ `installation-log-record.js`, `installation-log-core.js`) |
| Call sites | ✅ `setup.js`, `teardown.js`, `installation-log-command.js` used by `setup-infra.js`, `setup-infra-up-platform-action.js`, `setup-infra-up-dataplane-action.js` |
| Provenance | ✅ `buildInfraSectionLines` annotates `config` vs `cli override` (`installation-log-core.js`) |
| Teardown cleanup fields | ✅ `pushCleanupBlock` supports `volumesRemoved`, `configPreserved` |
| Mode | ✅ `resolveLogMode` → `interactive` / `automation` |
| Errors | ✅ `pushErrorSection` uses `maskSensitiveData` on message (and code); no stack serialization |
| Rotation | ✅ `rotateInstallationLogIfNeeded` + test with small `maxBytes` |
| Nested records during `setup` | ✅ No `appendInstallationRecord` in `setup-modes.js` / nested helpers — only `setup.js` + standalone infra handlers |

### File existence (plan vs repo)

| Planned / implied | Path | Status |
|-------------------|------|--------|
| Shared redaction | `lib/utils/log-redaction.js` | ✅ (includes `maskEnvLine` / URL masking for parity with `logs <app>`) |
| Audit wiring | `lib/core/audit-logger.js` | ✅ imports `../utils/log-redaction` |
| Writer + record builder | `lib/utils/installation-log.js`, `installation-log-record.js`, `installation-log-core.js` | ✅ |
| CLI hook | `lib/cli/installation-log-command.js` | ✅ |
| Infra CLI split | `lib/cli/setup-infra-up-platform-action.js`, `setup-infra-up-dataplane-action.js` | ✅ |
| Tests (plan named `tests/lib/...`; actual mirrors `lib/`) | `tests/lib/utils/log-redaction.test.js`, `tests/lib/utils/installation-log.test.js` | ✅ |
| `tests/lib/core/audit-logger.test.js` | Delegation / existing coverage | ✅ present |

### Test coverage

- **Redaction**: `log-redaction.test.js` — keyword patterns, hex, URL credentials, `maskEnvLine` edge cases.
- **Installation log**: atomic append, masked failure message, rotation, deterministic `Config` before `Cleanup` ordering.
- **Full suite**: `npm test` — **574 passed**, **54** test suites, exit code **0**.

### Code quality validation

| Step | Result |
|------|--------|
| STEP 1 — `npm run lint:fix` | ✅ PASSED |
| STEP 2 — `npm run lint` | ✅ PASSED (0 errors) |
| STEP 3 — `npm test` | ✅ PASSED |

### Cursor rules / policy (spot check)

- **Code reuse**: Single redaction module; installation log reuses it — ✅  
- **Logging**: Writer uses `logger.warn` on append failure; does not throw — ✅  
- **Security**: No raw secrets in record builder; URLs sanitized via helpers — ✅  
- **Module style**: CommonJS, `path.join` in writer — ✅  
- **File size**: Large `setup-infra` handlers extracted to action modules — ✅ (aligns with project limits)

### Gaps / recommendations (non-blocking)

1. **Documentation (plan §7)**: No dedicated one-line mention of `installation.log` in `README.md` or `docs/commands/` yet; optional follow-up for support onboarding.  
2. **CLI output matrix (plan § CLI layout)**: `.cursor/rules/cli-output-command-matrix.md` does not mention silent `installation.log` writes; optional note if you want matrix parity.  
3. **Plan §6 paths**: Updated in this pass to `tests/lib/utils/log-redaction.test.js` and `tests/lib/utils/installation-log.test.js` for accuracy.

### Final validation checklist

- [x] All implementation checklist items completed (verified in repo)  
- [x] All primary files exist and are wired  
- [x] Tests exist and pass (including targeted installation + redaction suites)  
- [x] Lint (with fix pass) clean  
- [x] No duplicate `maskSensitiveData` in `audit-logger.js`  
- [x] Implementation matches plan intent (operational scope, rotation, single record per command)
