---
name: Builder CLI — unified testing and certification
overview: End-to-end plan for aifabrix CLI support for Dataplane unified validation (POST /api/v1/validation/run), DatasourceTestRun envelope, datasource- and **external-system-level** scopes, certification surfacing, async polling, CI-ready machine output, and normative TTY UI (Data Quality + Trust, aggregation at system level). Includes strict operational contracts (exit codes, rendering order, async, limits, schema enforcement) to prevent implementation drift. Defers HTTP field detail to Dataplane OpenAPI and plan 365.
todos:
  - id: validation-report-tty-kit
    content: Reusable TTY kit (`lib/utils/validation-report-tty-kit.js`) + shared envelope logging (`datasource-test-run-tty-log.js`) for validation CLI and external server tests
    status: completed
  - id: layout-local-external-test
    content: Local `aifabrix test` — plan §3.2 layout via `external-system-local-test-tty.js` + `displayTestResults(..., appName)`
    status: completed
  - id: layout-external-server-integration-e2e
    content: External `test-integration` / `test-e2e` — DatasourceTestRun TTY when envelopes present; E2E loop keeps `datasourceTestRun`; `--debug` passed into `displayIntegrationTestResults`
    status: completed
  - id: api-post-poll-system
    content: Single API module — POST + shared poll; system scope + optional fan-out merge (§2.2, §9, §17.4)
    status: completed
  - id: datasource-test-capability
    content: "`datasource test` + `test-e2e <ds> <capabilityKey>` drill-down (§2.1, §2.3)"
    status: completed
  - id: renderer-ds-system
    content: Renderer — §3.2 + §16 (datasource) + §17 (system); dedupe, RBAC, no leakage (§3.9–§3.12)
    status: pending
  - id: exit-flags
    content: Exit matrix §3.1 + §3.1a; `--require-cert`, `--warnings-as-errors`
    status: pending
  - id: machine-schema-ci
    content: "`--json` / `--summary`; schema sync CI §8.1; flag map §4 tested"
    status: completed
  - id: watch-progress-debug
    content: "`--watch` §3.14; progress §3.13; debug limits §3.7; `reportVersion` §3.15"
    status: pending
  - id: docs-permissions
    content: Permissions JSDoc + `docs/commands` updates (no raw REST in user docs); deprecate legacy external test URLs (§11)
    status: completed
  - id: tests-snapshots
    content: Unit/integration/golden TTY snapshots per §12; system aggregate fixtures §17.6–17.8
    status: pending
isProject: true
---

# 115 — Builder CLI: full testing and certification support

This document is the **product and implementation plan** for exercising Dataplane validation, integration, E2E, and **certification** through the **AI Fabrix Builder CLI** (`aifabrix` / `aifx`). It aligns three sources of truth:


| Source                                                                                                                                  | Role                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dataplane **361** — `aifabrix-dataplane/.cursor/plans/361.builder.plan.md` *(may live under `.cursor/plans/-1.done/` on some branches)* | **HTTP surface**: public tier, `POST /api/v1/validation/run`, optional `GET` poll, success = **DatasourceTestRun** only; legacy routes out of scope for new work.           |
| Dataplane **365** (contract intent) and **362** (migration ordering)                                                                    | **Request shape**: `validationScope`, `runType`, unified options on one body — exact fields in **OpenAPI** (`openapi.yaml` / `/api/v1/openapi.json`).                       |
| `lib/schema/datasource-test-run.schema.json` (Builder copy of canonical envelope)                                                       | **Success JSON contract** for `--json` output, golden tests, and AJV validation in CI; must stay in sync with Dataplane `app/schemas/json/datasource-test-run.schema.json`. |


**Non-goals here:** implementation code, duplicate OpenAPI field lists, or REST documentation in user-facing CLI docs (per Builder docs rules).

**Strict contracts:** Exit codes, human rendering order, async/poll behavior, debug limits, schema sync enforcement, and related rules below are **normative** for CLI implementation and tests — not suggestions.

## Contents


| §                                                                   | Topic                                                                               |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [1](#1-problem-statement)                                           | Problem statement                                                                   |
| [2](#2-architectural-rule-one-http-operation-scopes-and-commands)   | Architectural rule — one HTTP operation, scopes, commands                           |
| [3](#3-operational-contracts-strict)                                | Operational contracts (exit codes, TTY order, async, debug, watch, `reportVersion`) |
| [4](#4-flag-to-request-mapping-contract)                            | Flag-to-request mapping                                                             |
| [5](#5-request-side-cli--dataplane)                                 | Request side (CLI → Dataplane)                                                      |
| [6](#6-response-side-datasourcetestrun-as-the-single-success-shape) | Response shape (`DatasourceTestRun`)                                                |
| [7](#7-human-output-contract-decision-oriented-cli)                 | Human output contract                                                               |
| [8](#8-machine-output-and-ci-certification-gates)                   | Machine output and CI                                                               |
| [9](#9-async-polling-implementation-detail)                         | Async polling                                                                       |
| [10](#10-relationship-to-local-datasource-validate-file)            | vs local `datasource validate`                                                      |
| [11](#11-migration-and-deprecation-builder)                         | Migration and deprecation                                                           |
| [12](#12-testing-strategy-builder-repo)                             | Testing strategy                                                                    |
| [13](#13-anti-patterns)                                             | Anti-patterns                                                                       |
| [14](#14-deliverables-checklist)                                    | Deliverables + definition of done                                                   |
| [15](#15-traceability)                                              | Traceability                                                                        |
| [16](#16-cli-ui-specification-tty-gold-standard--datasource-scope)  | TTY — datasource scope                                                              |
| [17](#17-external-system-system-level-cli-ui)                       | TTY — system scope                                                                  |
| [18](#18-next-steps-optional-follow-ups)                            | Next steps                                                                          |


---

## 1. Problem statement

Developers need the CLI to answer, in order:

1. Is this datasource **structurally and policy-wise** acceptable (`runType: test`)?
2. Does the **integration pipeline** run cleanly (`runType: integration`)?
3. Which **capabilities** work end-to-end (`runType: e2e`)?
4. What **certification tier** is achievable, and what **blockers** prevent promotion?
5. For an **external system** (business integration unit): **where to focus** — is the system as a whole ready, which datasources drag it down, and what is the critical drill-down path?

Today, Builder still targets **legacy** per-resource test routes in places (e.g. `lib/api/external-test.api.js`). New work must **converge on the unified validation API** described in plan **361** and populate the **DatasourceTestRun** envelope so the same renderer and `--json` path work for all run types, and so **system-level** views can **aggregate** without repeating full datasource output (§17).

---

## 2. Architectural rule: one HTTP operation, scopes, and commands

**HTTP:** Still **one** family: `POST /api/v1/validation/run` (+ optional poll). **Scope** is selected with `**validationScope`** (and ids) per plan **365** / OpenAPI — e.g. **single datasource** vs **external system (aggregate)**.

### 2.0 Three-level debugging pyramid (product model)


| Level          | Question answered                                         | Typical command surface (target)                                                                                                                                                                            |
| -------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **System**     | Where should I focus? Which datasource is the bottleneck? | `aifabrix test <systemKey>`, `aifabrix test-integration <systemKey>`, `aifabrix test-e2e <systemKey>` **when** the resolved app is **external integration** (`integration/<systemKey>/`), not a builder app |
| **Datasource** | What is broken in this datasource?                        | `aifabrix datasource test …`, `test-integration …`, `test-e2e …`                                                                                                                                            |
| **Capability** | Why does this operation fail?                             | `aifabrix datasource test-e2e <datasourceKey> <capabilityKey>` (§2.3)                                                                                                                                       |


**Dispatch collision (normative):** Top-level `**aifabrix test <name>`** today may mean **builder app** tests when `<name>` resolves under **builder**. For **external** systems, `**test` / `test-integration` / `test-e2e`** must resolve `**integration/<systemKey>/`** (same disambiguation pattern as existing `test-integration <app>` in `lib/cli/setup-external-system.js`). If ambiguous, require **cwd** under `integration/<systemKey>/` or an explicit flag (e.g. `--system <systemKey>`) — document in command help. **Do not** change builder-app semantics accidentally.

### 2.1 Datasource-scoped CLI (validationScope = datasource)


| CLI command (target)                                          | `runType` in JSON | Primary sections in `DatasourceTestRun`                                                                                                     |
| ------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `aifabrix datasource test <datasourceKey>` *(new or aliased)* | `test`            | `validation`, `certificate` (when server includes it for this run), `developer`, `audit`, `debug`                                           |
| `aifabrix datasource test-integration <datasourceKey>`        | `integration`     | `validation` (if returned), `integration`, `certificate`, `capabilities` / `capabilitySummary` as applicable, `developer`, `audit`, `debug` |
| `aifabrix datasource test-e2e <datasourceKey>`                | `e2e`             | Full stack: `validation`, `integration`, `certificate`, `capabilities` / `capabilitySummary`, `developer`, `audit`, `debug`                 |


### 2.1a Datasource command flags (implemented; `--help` order)

**Source of truth (code):** `lib/commands/datasource-unified-test-cli.options.js` (`attachDatasourceTestCommonOptions`, `attachDatasourceWatchOptions`) and `lib/commands/datasource-unified-test-cli.js` (per-command `addHelpText`, E2E-only flags).

**Registration order** (what users see under `Options:` before `--help`) is intentionally:

1. `**-a, --app <app>`** — integration folder / app context for resolution and auth.
2. `**-e, --env <env>`** — `dev`  `tst`  `pro`.
3. `**-v, --verbose**` — maps to `explain` on the validation request where applicable.
4. `**-d, --debug [level]**` — `includeDebug` on request; TTY appendix `summary` (default when flag present without value), `full`, or `raw` (not combined with `--json` in the human renderer path).
5. `**-p, --payload <file>**` — **only** `datasource test` and `datasource test-integration` (custom payload → `payloadTemplate` on request). **Not** registered for `datasource test-e2e`.
6. `**--timeout <ms>`** — aggregate wall-clock budget for POST + polls (defaults: **30000** for `test` / `test-integration`; **900000** (15m) for `test-e2e`).
7. `**--json`** — print raw `DatasourceTestRun` JSON to stdout; exit matrix unchanged (§3.1).
8. `**--summary`** — compact summary line.
9. `**--warnings-as-errors**` — exit **1** when root `status` is `warn`.
10. `**--require-cert`** — exit **2** when certification is missing or `not_passed` per §3.1.
11. `**--no-async`** — **only** `datasource test` and `datasource test-e2e` (no poll; fail if `reportCompleteness` is not `full` on first response). **Not** registered for `datasource test-integration` (always async poll path).
12. **Watch family** — `--watch`, `--watch-path <path>` (repeatable, default `[]`), `--watch-application-yaml`, `--watch-ci`, `--watch-full-diff`.

`**datasource test-e2e` only** (chained after common options, **before** examples in help):

- `**--test-crud`**, `**--record-id <id>`**, `**--no-cleanup**`, `**--primary-key-value <value|@path>**`
- `**--capability <key>**` — deprecated alias for capability drill-down; prefer **positional** `[capabilityKey]`.
- `**--strict-capability-scope`** — exit **1** if a capability drill-down is requested but multiple `capabilities[]` rows violate §2.3 contract.

**Invocation:** `aifabrix datasource test-e2e <datasourceKey> [capabilityKey]` — positional `capabilityKey` wins over `--capability` when both differ (stderr warning).

### 2.2 External-system-scoped CLI (validationScope = externalSystem)


| CLI command (target)                                          | `runType`     | Request intent                                               |
| ------------------------------------------------------------- | ------------- | ------------------------------------------------------------ |
| `aifabrix test <systemKey>` *(external resolution only)*      | `test`        | System rollup: structural / trust summary across datasources |
| `aifabrix test-integration <systemKey>` *(no `--datasource`)* | `integration` | System integration health across datasources                 |
| `aifabrix test-e2e <systemKey>` *(external path)*             | `e2e`         | System E2E / capability overview across datasources          |


**Flag interface (normative, system-level commands):** `aifabrix test`, `test-integration`, and `test-e2e` expose the **same small surface** (no `--json` / `--summary` / `--timeout` / `--watch` on these top-level commands in the current Builder implementation):

- `**-e, --env <env>`** — Environment selection (builder: dev/tst with a Commander default; external: only applied when the user passes `-e` / `--env` so auth-config default env is not overridden — see `lib/cli/setup-app.test-commands.js` and `lib/cli/setup-external-system.js` `rawArgs` checks).
- `**-v, --verbose`** — More detail (per §16/§17 rules).
- `**-d, --debug**` — **Boolean** on system-level commands (no `[level]` variant today): external integration path writes logs under `integration/<systemKey>/logs/` where applicable; help/examples live in `lib/cli/setup-app.help.js` and `lib/cli/setup-external-system.help.js`.
- `**-h, --help`**

**External `test-e2e <systemKey>`:** The CLI **does not** expose `--no-async`. For the integration path, `lib/cli/setup-app.test-commands.js` passes `**async: true`** into the external E2E runner so the command **always polls** until completion (same intent as datasource commands without `--no-async`).

**Asymmetry vs datasource family:** `aifabrix datasource test*` uses `**-d, --debug [level]`**, `**--timeout`**, machine modes (`--json` / `--summary`), exit modifiers, `**--no-async**` (where registered), and **watch** — see **§2.1a**.

**Datasource scoping (normative):** system-level commands do **not** take `--datasource` or `--payload`. To debug a single datasource, use the **datasource** command family (§2.1), e.g. `aifabrix datasource test-integration <datasourceKey>` / `aifabrix datasource test-e2e <datasourceKey>`.

**Body:** `validationScope` = external system + `systemKey` (exact field names in OpenAPI).

**Data shape (preferred vs interim):**

1. **Preferred:** One **system-scoped** POST returns an OpenAPI-defined **aggregate** (e.g. wrapper listing **child `DatasourceTestRun`** items + `systemRollup` fields). CLI maps that to §17 UI without N round-trips.
2. **Interim:** CLI **fans out** N datasource-scoped calls (or reuses parallel internal API), merges with **deterministic rules in §17.4**, then renders §17. **Must** produce the same exit code as if a single aggregate existed (**§3.1a** on **computed** `systemStatus`).

**Consistency:** Datasource commands remain thin wrappers; system commands add an **aggregation layer** (server- or client-side) then reuse **poll / exit / flags** from §3–§4.

### 2.3 Capability drill-down (debugging)

**Command:**

```bash
aifabrix datasource test-e2e <datasourceKey> <capabilityKey>
```

**Semantics (normative):**

- **Single-capability run:** The CLI sets the unified request so the server scopes the run to **one** capability (exact OpenAPI field name per `openapi.yaml`). **Builder implementation:** `lib/datasource/unified-validation-run-body.js` passes `**e2eOptions.capabilityKeys: [<capabilityKey>]`** when a drill-down key is set (positional `[capabilityKey]` or deprecated `--capability`). The response is still a full **DatasourceTestRun** envelope, but the server **must** populate only the relevant capability row in `capabilities[]` (and adjust `capabilitySummary` accordingly) when that contract is supported.
- **No aggregate shortcuts:** Human renderer for this invocation **skips** multi-capability aggregation tables; it renders **one** capability block (status, permission line, E2E steps, issues) only. If the server returns more than one capability, CLI treats that as **contract violation**: print a single warning line, still emit `--json` verbatim, exit code follows normal matrix unless `--strict-capability-scope` (optional) forces exit `1`.
- **Guarantee:** Implementations must document the request field used; tests include a fixture with a single `capabilities[]` entry.

Omitting `<capabilityKey>` keeps current behavior (full capability set per server defaults).

---

## 3. Operational contracts (strict)

This section locks behavior so CI, snapshots, and user scripts do not drift across runTypes or releases.

### 3.1 Exit code matrix (normative)


| Condition                                                                                                                                                                | Exit code                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Root `status` is `fail`                                                                                                                                                  | **1**                                                                                   |
| Root `status` is `warn`                                                                                                                                                  | **0** by default; **1** if `--warnings-as-errors` is set                                |
| Root `status` is `ok` or `skipped`                                                                                                                                       | **0** (unless overridden by cert row below)                                             |
| `certificate.status` is `not_passed` **and** flag `--require-cert` is set                                                                                                | **2** (evaluated after success HTTP; does not apply if HTTP layer already exited **3**) |
| Successful HTTP and no row above forced failure                                                                                                                          | **0**                                                                                   |
| **HTTP error** (any non-success status from Dataplane, including 4xx/5xx), **TLS/cert verification failure**, **DNS/connect timeout**, **invalid JSON** in response body | **3**                                                                                   |
| **Client misuse** (unknown flag, missing required arg, local file not found for `--payload`)                                                                             | **4**                                                                                   |


**Ordering:** Parse body → apply `status` / `--warnings-as-errors` → then apply `--require-cert` → exit.

`**--json`:** Exit codes follow the **same** matrix; stdout is still the raw envelope on HTTP success.

### 3.1a System-scoped and client-aggregated exit codes (normative)

Applies when `**validationScope`** is **external system** (§2.2, §17) and the CLI either receives **one** server aggregate or **merges** N datasource-scoped `**DatasourceTestRun`** results (interim fan-out).


| Situation                                                                                                  | Effective status for §3.1 rows                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preferred:** single JSON body from OpenAPI with explicit `**systemStatus`** (or equivalent rollup field) | Use `**systemStatus`** for root-status rules in §3.1. If the body also has a top-level `**status**` that disagrees, `**systemStatus` wins** for exit mapping. |
| **Preferred:** single body with only root `**status`** and no separate rollup field                        | Use root `**status`** as today.                                                                                                                               |
| **Interim:** client merged children **{R₁…Rₙ}** per §17.4                                                  | Compute `**systemStatus`** with the rules in §17.4; treat that computed value **as** root `status` for §3.1 (ok / warn / fail / skipped).                     |


**Certificate and `--require-cert`:** On system scope, evaluate exit **2** as: **any** child with `certificate.status === 'not_passed'` **or** §17.4 system certification **not_passed** when certificates are present on any child — same ordering as §3.1 after HTTP success.

**HTTP / transport:** For interim fan-out, **any** child request that ends in §3.1 row “HTTP error / TLS / DNS / timeout / invalid JSON” forces exit **3** for the **whole** command (do not merge partial success with a failed child call). **4xx/5xx** on one child counts as that row.

**Poll:** If the aggregate is async, polling applies to the **system** handle when the server provides one; if interim mode polls **per child**, **all** children must reach terminal `**reportCompleteness`** (or equivalent) before final merge — a stuck child exhausts §3.6 budget → §3.4 timeout rules (exit **1** vs **3** per last body).

### 3.2 `DatasourceTestRun` human rendering — deterministic priority (TTY)

**Authoritative layout and examples:** §16.

**Section order (always, for default human TTY):** render blocks in this sequence — **product narrative** (Data Quality + Trust → capabilities → pipeline → certification). **Omit** a block only per §3.9; **never** reorder.

1. **Header** — `Datasource: {datasourceKey} ({systemKey})`, `Run: {runType label}`, `Status: {glyph + root status}`, `Run ID: {runId or testRunId}`; show `reportCompleteness` when not `full` (§3.4).
2. **Verdict** — single product line derived from root `status` + `certificate.status` (when present), e.g. “Limited production use”, “Not usable”, “Pipeline not working” (exact phrase table in §16.3).
3. **Summary** — `developer.executiveSummary` or §3.2 fallback paragraph (one short block).
4. **Separator** — horizontal rule or `────────────────` (consistent width).
5. **Data Quality** — trust strip: **no** ICC/PDS/DTS labels; map from `validation.dataReadiness`, `validation.status`, and severity rollups of `validation.issues` into **Schema coverage / Data consistency / Data reliability** lines (OK/WARN/FAIL glyphs). Optional **Confidence:** line only if server provides a value via `developer` bullets, `validation.summary`, or a documented numeric extension — **omit line if absent** (no client-invented percentages).
6. **Deductions** (optional) — up to **3** top blocking items (from grouped issues) when they clarify quality before the capability table; skip if redundant with **Failures**.
7. **Readiness** — line from `validation.dataReadiness` → “Ready / Partial / Not ready” (glyph).
8. **Separator**
9. **Capabilities** — when `capabilities` / `capabilitySummary` present (§3.8, §3.9); permission failures show **lock** marker per §3.10 (e.g. `(permission missing)`).
10. **Failures** — expanded grouped issues per §3.11 (capability-scoped first, then validation/cert).
11. **Impact** — `developer.whatFailed` / synthesized impact bullets; **no** duplicate sentences already shown under Failures.
12. **Separator**
13. **Integration** — `integration.stepResults` when present (§3.9); durations from `evidence` / step metadata when present.
14. **Separator**
15. **Certification** — when `certificate` present (§3.9): target tier, pass/fail, blockers, **Maturity** ladder (bronze / silver / gold vs `certificate.level` + `certificate.status`).
16. **Separator**
17. **Next actions** — `developer.nextActions` + deduped hints (§3.11); **last** substantive block.
18. **Debug / audit** — only when `--debug` (§3.7); always after Next actions.

`**datasource test` (runType test):** omit **Capabilities**, **Integration**, **Certification** blocks when absent (§3.9); keep Header → Verdict → Summary → Data Quality → Issues-style **Failures** → Impact → Next actions.

`**datasource test-integration`:** omit **Capabilities** / **Certification** when absent; keep Integration prominent per §16.7 example.

**Fallback when `developer` is missing or empty:**

1. **Summary:** first non-empty of `certificate.summary`, `validation.summary`, `integration.summary`, then synthetic one-liner from root `status` + `runType`.
2. **Next actions:** merge `developer.nextActions` with deduped hints from `validation.issues` and `certificate.blockers` (blocking first) — §3.11.
3. **Verdict / Impact bullets:** derive minimal copy from layer statuses only (OK/WARN/FAIL — no internal metric names).

`**--summary` mode:** not the full §3.2 layout; fixed compact lines per §16.9 and §8.

### 3.3 Validation vs integration overlap (no double reporting)

- **Data rule:** The CLI **never prints the same `Issue` twice** in human output. If an issue appears in both `validation.issues` and another layer, **prefer** the first occurrence in render order: certificate `blockers` → validation `issues` → capability/E2E errors (dedupe key: `code` if set, else normalized `message`).
- **Display rule:** For `runType: integration` or `e2e`, show the **Data Quality** block (§3.2) **only if** `validation` is present; do **not** synthesize validation from integration.
- **Summary line:** If validation and integration both explain the same failure, **one** human sentence under **Failures** (§3.11); integration step list stays under **Integration** (§3.2 order) — do not repeat the same sentence in both sections.

### 3.4 `reportCompleteness` lifecycle and safe rendering


| Completeness | Meaning (CLI interpretation)                        | Sections safe to render from body                                                                                                                             |
| ------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minimal`    | Accept or early async handle; report may be stubbed | Header, `runId` / `testRunId`, root `status` if present; **do not** render empty capability/integration tables — show single line “Run in progress; polling…” |
| `partial`    | Some layers filled, run not finished                | Header + any layer that is **present and non-empty**; for empty layers show “Pending…” once per layer max                                                     |
| `full`       | Terminal report for this run                        | All present blocks per §3.2 order                                                                                                                             |


**Transitions:** `minimal` → `partial` → `full` during poll.

**Poll timeout (client budget exhausted, §3.6):** If the last successful JSON body has root `status` `**fail`**, exit **1** (matrix row for `fail` wins). Otherwise exit **3** with message `Report incomplete: timeout` and print the last body if any.

**Normative poll stop:** Stop when `reportCompleteness === 'full'` **or** OpenAPI defines another terminal condition (e.g. root `status` terminal **and** no further server updates).

### 3.5 Async behavior — all runTypes, shared implementation

- **Any** `runType` (`test`, `integration`, `e2e`) may return async handles (`testRunId`, `reportCompleteness: minimal|partial`). **Same** poll module, **same** interval/backoff, **same** progress UI (§3.13) for all commands.
- **Partial reports:** On each poll, re-run the **full** deterministic renderer (§3.2) with latest body; replace screen content or append “updated …” per product choice — **must** be consistent across commands (recommend: TTY refresh single view + timestamp).
- **Flags (datasource commands):** `--no-async` is registered on `**aifabrix datasource test`** and `**aifabrix datasource test-e2e`** only (`includeNoAsync` is false for `datasource test-integration`). System-level `test*` commands do not expose `--no-async`; external E2E path always polls for completeness (`lib/cli/setup-app.test-commands.js`).

### 3.6 Timeout and retry policy (normative)


| Item                                           | Value                                                                                                                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--timeout <ms>` default (datasource commands) | **30000** — applies as **one aggregate wall-clock budget** for the whole command: initial POST **plus** all poll requests (not per-request), unless overridden |
| Poll interval (initial)                        | **2 s**                                                                                                                                                        |
| Poll backoff                                   | **exponential**, cap **15 s** between polls                                                                                                                    |
| Per-request HTTP socket timeout                | **min(remaining budget, 30000)** per call so a single hung read does not exceed remaining budget                                                               |
| Retries on **HTTP 3** class                    | **No** automatic retry for 4xx/5xx. **Retry only** for `ECONNRESET`, `ETIMEDOUT`, `ECONNABORTED` on **POST**, max **2** retries, backoff **1 s / 2 s**         |
| Failure messaging                              | Always print last `runId` / `testRunId` if present; for exit **3** include HTTP status or transport code                                                       |


Long-running datasource E2E: user raises `--timeout` (e.g. **300000**) for the same aggregate budget.

### 3.7 Debug payload size and truncation (normative)


| `--debug` level | CLI behavior                                                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `summary`       | No embedded payloads; lengths only; trace ids                                                                                                                                                                                                                                   |
| `full`          | Per-field **max 8192 bytes** UTF-8 per printed string; truncate with suffix `… [truncated, N bytes]`                                                                                                                                                                            |
| `raw`           | Per-field **max 65536 bytes** on TTY; **max 1 MiB** when stdout is not a TTY (redirect/file); always **redact** lines matching secret patterns (tokens, `Authorization`); never print more than **200 lines** per payload blob — remainder `… [N lines omitted; use audit ref]` |


**Full data:** Always print `audit.traceRefs` / `debug.payloadRefs` when present so users can pull full bodies from authorized audit/trace paths — CLI does not re-fetch by default.

### 3.8 Capability ordering (normative)

1. **If** `capabilities[].order` or server-provided ordered array is present in schema extension, **use array order** as returned (schema today: order on integration steps, not capability — so default below applies).
2. **Else** sort by: `type` ascending `**read` → `write` → `sync` → `custom`**, then `**key` ASCII ascending**.
3. **Drill-down** (§2.3): single row — no sort needed.

Snapshot tests **must** use fixtures with deterministic order.

### 3.9 “No data” handling


| Missing / empty                  | Human output                                                                                                                                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `capabilities` or empty array | Omit **Capabilities** section; one line under header: “No capabilities reported.”                                                                                                                                                                                    |
| No `integration`                 | Omit **Integration** section entirely (no placeholder).                                                                                                                                                                                                              |
| No `certificate`                 | Omit **Certificate** section; if `--require-cert`, treat as **not_passed** for exit **2** only when product defines that behavior — **normative:** missing `certificate` with `--require-cert` → exit **2** and message “Certification not returned; cannot verify.” |
| No `validation`                  | Omit **Validation** section.                                                                                                                                                                                                                                         |
| Empty `developer`                | Use §3.2 fallback.                                                                                                                                                                                                                                                   |


`**--json`:** Always print full parsed object; no omission.

### 3.10 RBAC surfacing (normative)

- When a capability or layer fails with `Issue.code` matching prefix `**DP-SEC-`** **or** message/hint implies permission denial, CLI **must** print a dedicated line: `Permission: <capabilities[].permission or hint-derived>` when `permission` is present on that capability row.
- **Normalize:** Map common server phrases (“403”, “forbidden”, “not authorized”) to a standard line: `Access: permission denied` + show `permission` field if present.
- **Ordering:** RBAC-related issues appear **within** the relevant capability block **before** generic E2E step errors for that capability.

### 3.11 Error grouping and deduplication (normative)

- **Group** issues in human output by `(code || 'NO_CODE', normalized message)`; show **one** heading per group with count if > 1.
- **Hints:** Deduplicate identical `hint` strings globally for the run; show once under the group.
- **Cross-layer:** Apply §3.3 dedupe across validation, certificate blockers, and capability-level issues.

### 3.12 Strict “no internal leakage” (normative)

**Never** show in default or `--verbose` human output:

- Strings `**ICC`**, `**PDS`**, `**DTS**` (case-insensitive) and labels “validation engine”, “metricValue”, “contract envelope”.
- Raw `**metricsOutput**` / `**certificationOutput**` keys or nested dumps.

**Allowed:** `--debug=full|raw` may show **redacted** structural keys if required for support, but still **not** marketing-unfriendly engine codenames unless behind `**AIFABRIX_INTERNAL_DIAG=1`** (optional escape hatch for staff).

**Integration step `name`:** Show as returned **unless** name matches internal-only registry (maintain denylist in CLI); unknown names render as `Step: {name}` (literal step name), not opaque internal IDs.

### 3.13 Progress indicators (normative)

- **POST in flight:** Spinner + elapsed seconds; if server returns `202` or body includes progress hints, merge when available.
- **Polling:** Same spinner; every **5 s** (or each poll tick, whichever is less frequent) print current `**reportCompleteness`** and best-known root `status`.
- **Integration/E2E with `integration.stepResults` or E2E steps:** When rendering **after** completion, show step list with durations from `evidence` / `durationMs` when present.

### 3.14 Watch mode (normative)

**Command flag:** `--watch` (optional on all three datasource test commands).


| Aspect   | Behavior                                                                                                                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger  | Rerun when watched files change: default glob **datasource JSON** for resolved app (`integration/<systemKey>/**/*datasource*.json` or explicit `--watch-path`); **application.yaml** optional second watch |
| Debounce | **500 ms** coalescing from last FS event                                                                                                                                                                   |
| Diff     | On rerun, if previous report cached, print **unified diff** of **root `status`**, **certificate.status**, and **capability key list + statuses** only (not full JSON) unless `--watch-full-diff`           |
| Exit     | **does not exit** on test failure by default (developer loop); `**--watch-ci`** exits with normal matrix after first run                                                                                   |


### 3.15 `reportVersion` backward compatibility (normative)

- CLI declares **supported** major version **N**; accepts **N** and **N-1** major from `reportVersion` without error.
- **Older than N-1:** exit **0/1/2** per body if parse succeeds; print **stderr** warning: `reportVersion unsupported (got X, support Y–Z)`; human renderer uses **generic** fallbacks for unknown sections (print JSON subtree max 20 lines) — **or** exit **4** if `--strict-report-version` (optional).
- **Newer than supported (minor ahead):** accept; print **info** stderr once: `Newer reportVersion; some fields may be ignored`.
- **Parsing fails** (required fields missing): exit **3**.

---

## 4. Flag-to-request mapping contract

CLI flags **must** map 1:1 to OpenAPI request fields (names below follow **intent**; **exact** property names are whatever `openapi.yaml` defines — update this table when OpenAPI changes).

**Datasource commands (`aifabrix datasource test*`)** — see **§2.1a** for the authoritative flag list and `--help` order. Summary mapping (Builder code: `lib/datasource/unified-validation-run-body.js`, `lib/utils/validation-run-request.js`, `lib/commands/datasource-validation-cli.js`):


| CLI flag                                                                                         | Request field (logical)                         | Default                                                  | Notes                                                                                     |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| *(datasource command)* `datasource test` / `datasource test-integration` / `datasource test-e2e` | `runType`                                       | derived from subcommand                                  | `test`                                                                                    |
| `-a, --app <appKey>`                                                                             | resolution only                                 | cwd / single match                                       | Sets app context for paths and auth; may set body `applicationKey` if OpenAPI requires    |
| `-e, --env <env>`                                                                                | client config                                   | `dev`                                                    | Selects controller/dataplane base URL and token — not always a body field                 |
| `-v, --verbose`                                                                                  | `explain: true` on request                      | off                                                      | Datasource commands                                                                       |
| `-d, --debug [level]`                                                                            | `includeDebug` + TTY appendix mode              | off; appendix default `summary` when flag present        | Datasource commands only; levels `summary`                                                |
| `-p, --payload <file>`                                                                           | inline or ref payload                           | none                                                     | `**test` + `test-integration` only** — not registered for `datasource test-e2e`           |
| `--timeout <ms>`                                                                                 | client aggregate budget                         | 30000 (`test` / `test-integration`); 900000 (`test-e2e`) | POST + polls; see §3.6                                                                    |
| `--json` / `--summary`                                                                           | *(client output only)*                          | off                                                      | Do not mutate envelope                                                                    |
| `--warnings-as-errors` / `--require-cert`                                                        | *(client exit only)*                            | false                                                    | §3.1                                                                                      |
| `--no-async`                                                                                     | `asyncRun: false` / no poll path                | off                                                      | `**datasource test` + `datasource test-e2e` only** — not on `datasource test-integration` |
| `--watch*`                                                                                       | *(client only)*                                 | off                                                      | §3.14                                                                                     |
| `--test-crud`                                                                                    | `testCrud: true`                                | false                                                    | `datasource test-e2e` only                                                                |
| `--record-id`, `--no-cleanup`, `--primary-key-value`                                             | `e2eOptions.*`                                  | OpenAPI defaults                                         | `datasource test-e2e` only                                                                |
| `--capability <key>`                                                                             | same as positional filter                       | none                                                     | Deprecated; prefer `[capabilityKey]`                                                      |
| `<capabilityKey>` positional                                                                     | capability filter (`e2eOptions.capabilityKeys`) | none                                                     | §2.3                                                                                      |
| `--capabilities <csv>`                                                                           | capabilities list                               | server default                                           | Optional future multi-select                                                              |


**System-level** `aifabrix test` / `test-integration` / `test-e2e` — **only** `-e`, `-v`, `-d` (+ `-h`) in current Builder CLI; no `--json` / `--summary` / `--timeout` / `--watch` on those commands (see **§2.2** and `lib/cli/setup-app.test-commands.js` / `lib/cli/setup-external-system.js`).

**Drift prevention:** Builder CI includes a check that every documented flag appears in `lib/cli` setup and in a **machine-readable** `flag-map.json` (or test fixture) cross-checked against OpenAPI `operationId` for validation run (optional codegen later).

---

## 5. Request side (CLI → Dataplane)

- **Mechanical usage** matches plan **361**: `POST /api/v1/validation/run` with body from OpenAPI; **no** path segments for `runType` or `validationScope`.
- **§4** is authoritative for flags; permissions documented per `permissions-guide.md`.
- **Debug:** Request debug verbosity must align with §3.7 and server expectations.

---

## 6. Response side: `DatasourceTestRun` as the single success shape

Canonical schema: `**lib/schema/datasource-test-run.schema.json`**.

### 6.1 Top-level fields the CLI must understand

- `**reportVersion`**: See §3.15.
- `**runType**`, `**status**`: Drive exit code (§3.1) and header.
- `**reportCompleteness**`: See §3.4–3.5.
- `**systemKey**`, `**datasourceKey**`: Always in header.
- `**validation**`, `**integration**`, `**certificate**`, `**capabilities**`, `**capabilitySummary**`, `**developer**`, `**debug**`, `**audit**`: As in schema; human TTY per §3.2 and **§16**; machine modes per §8.

### 6.2 Certification in the developer workflow

1. Render **Certification** block in §3.2 / §16 position when `certificate` object present.
2. **Tier and blockers:** `certificate.level`, `certificate.status`, `certificate.blockers` with shared **Issue** formatter.
3. **Coverage:** `certificate.capabilityCoverage` beside capability summary when both exist.
4. Exit code **2** only via `--require-cert` per §3.1.

---

## 7. Human output contract (decision-oriented CLI)

Default TTY layout is **§16** (gold standard); block order is **normative** in §3.2.

The CLI is a **decision engine**, not a JSON pretty-printer. **Determinism** and **exit codes** are defined in §3. **Positioning:** the CLI proves **data is trustworthy and safe to use for downstream AI and automation** — not merely that HTTP calls succeeded.

**Progressive disclosure:**


| Mode        | Behavior                                                         |
| ----------- | ---------------------------------------------------------------- |
| Default     | §3.12 compliance; blocking issues first                          |
| `--verbose` | Non-blocking issues, more step detail; still no internal leakage |
| `--debug`   | §3.7 limits + audit pointers                                     |
| `--json`    | Raw envelope; exit §3.1                                          |


**Status glyphs:** OK / WARN / FAIL / SKIPPED — map from `ok` / `warn` / `fail` / `skipped`.

**Errors:** RFC 7807 → exit **3**; format per §3.1 messaging.

---

## 8. Machine output and CI certification gates

- `**--json`**: Exact success body; exit §3.1.
- `**--summary`**: Fixed layout per **§16.9** (line order snapshot-tested); fields include `datasourceKey`, root `status`, optional confidence if present, capability counts, certificate tier + glyph.
- **AJV:** Validate fixtures and golden files against `datasource-test-run.schema.json`.
- `**--fail-fast`:** If OpenAPI supports early abort, pass through; else display-only stop after first blocking group.

### 8.1 Schema sync enforcement (CI — normative)

- **Builder** `npm test` (or dedicated `npm run check:schema-sync`) computes **SHA-256** of `lib/schema/datasource-test-run.schema.json` and compares to Dataplane `app/schemas/json/datasource-test-run.schema.json`.
- **Source of truth:** Dataplane file in CI checkout (git submodule, sparse checkout, or copied artifact from pinned dataplane ref). **Mismatch → fail build** with message: `DatasourceTestRun schema drift: builder abc… ≠ dataplane def…`.
- **Optional:** Also assert `reportVersion` enum or `$id` equality if both files embed a sync token (future).

---

## 9. Async polling (implementation detail)

Poll `GET /api/v1/validation/run/{testRunId}` per OpenAPI. Behavior: §3.4–3.6, **one shared module** for all runTypes.

---

## 10. Relationship to local `datasource validate <file>`

- **Local `validate`**: offline file/schema.
- **Remote test commands**: authoritative **DatasourceTestRun**.

Flow: local validate → `datasource test` → `test-integration` → `test-e2e`.

---

## 11. Migration and deprecation (Builder)

1. Unified client in `lib/api/` (POST + poll).
2. Repoint datasource test commands; deprecate legacy external test URLs per plan **365**.
3. Permissions + `docs/commands` updates.
4. Schema sync job §8.1.

---

## 12. Testing strategy (Builder repo)

- **Unit:** Request builder; exit matrix §3.1; rendering order snapshots; dedupe §3.11; drill-down §2.3.
- **Integration (mocked HTTP):** `minimal` → `partial` → `full` poll chain; timeout exit **3**.
- **Golden `--json`:** AJV-valid; capability order §3.8.
- **TTY snapshots:** §16.5–16.11 (datasource); §17.6–17.8 (system).
- **Schema sync test:** Mock both paths or use fixture hash.

---

## 13. Anti-patterns

- Legacy test URLs for validation concerns.
- **Different** poll/render behavior per runType.
- **Different** exit semantics for the same root `status`.
- Dumping internal metrics on TTY (§3.12).
- `**--json`** that mutates the envelope.
- **System view:** pasting full §16 output for every datasource (violates §17.5); missing **Use:** drill-down line; inventing **Confidence** without server input (§17.3).

---

## 14. Deliverables checklist

- Single API module: POST + shared poll (§3.5–3.6, §9); system scope + optional fan-out merge (§2.2, §17.4).
- `datasource test` + drill-down `test-e2e <ds> <capability>` (§2.3).
- Renderer: §3.2 + §16 (datasource) + §17 (system aggregate), §3.9 empty, §3.11 dedupe, §3.12 leakage, §3.10 RBAC, chalk §16.12.
- Exit matrix §3.1; `--require-cert`, `--warnings-as-errors`.
- `--json` / `--summary`; schema sync CI §8.1.
- `--watch` §3.14; progress §3.13; debug limits §3.7.
- `reportVersion` handling §3.15.
- Flag map §4 documented and tested.

### 14.1 Definition of done

Work matches this plan when **all** of the following hold:

1. **Unified API path only** — No new reliance on legacy per-resource test URLs for validation concerns; `lib/api/` uses POST + optional poll per **361** / OpenAPI (§5, §9, §11).
2. **Exit semantics** — §3.1 and **§3.1a** behavior covered by tests; `--require-cert` and `--warnings-as-errors` documented in command help.
3. **Human output** — Default TTY for datasource commands follows §3.2 + §16 (snapshots); system commands follow §17 without dumping full §16 per datasource by default.
4. **Machine output** — `--json` emits unmodified success body(ies) per §8 / §17.12; `--summary` lines match §16.9 / §17.9.
5. **CI** — `datasource-test-run.schema.json` sync check §8.1 passes; golden fixtures AJV-valid.
6. **Permissions and docs** — `permissions-guide.md` / JSDoc and user-facing command docs updated without violating Builder docs rules (no REST tutorial in `docs/commands`).

---

## 15. Traceability


| Topic                             | Where defined                                                  |
| --------------------------------- | -------------------------------------------------------------- |
| HTTP paths, deprecation           | Dataplane **361**                                              |
| `validationScope`, `runType`      | Dataplane **365**                                              |
| Migration ordering, route removal | Dataplane **362**                                              |
| Envelope fields                   | `datasource-test-run.schema.json`                              |
| OpenAPI property names            | Dataplane `openapi.yaml`                                       |
| System-level TTY + aggregation    | §17; `validationScope` + OpenAPI system aggregate (when added) |


---

## 16. CLI UI specification (TTY gold standard) — datasource scope

Normative **default human output** for `**aifabrix datasource …`** test commands (single datasource). Aligned with **DatasourceTestRun**, **Data Quality + Trust** positioning, **certification**, **capability E2E**, **debug/audit**, and **§3** deterministic rules. **Do not** surface ICC/PDS/DTS or raw `metricsOutput` here (§3.12). **External system** overview UI is **§17** (aggregation — shorter, prioritization-first).

### 16.1 UX model — questions answered in order

1. **Verdict** — Can I use this datasource (for this run type)?
2. **Data Quality** — Is the data/configuration trustworthy?
3. **Capabilities** — What works end-to-end; what fails (including permissions)?
4. **Integration** — Where does the pipeline break?
5. **Certification** — Can I promote / what tier is blocked?
6. **Next actions** — What do I fix first?

### 16.2 Field mapping (envelope → UI)


| UI block           | Primary `DatasourceTestRun` sources                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Header             | `datasourceKey`, `systemKey`, `runType`, `status`, `runId`, `testRunId`, `reportCompleteness`                                                                |
| Verdict            | root `status`, `certificate.status`, `certificate.level` (product phrase table §16.3)                                                                        |
| Summary            | `developer.executiveSummary` → else §3.2 fallback                                                                                                            |
| Data Quality lines | `validation.dataReadiness`, `validation.status`, rollups from `validation.issues` (mapped to three trust lines §16.4); never print internal engine codenames |
| Confidence         | optional: only if server exposes a single scalar or phrase in `developer` / agreed extension — **omit** if missing                                           |
| Deductions         | top blocking `Issue`s (grouped)                                                                                                                              |
| Readiness          | `validation.dataReadiness` enum → user-facing Ready / Partial / Not ready                                                                                    |
| Capabilities table | `capabilities[]`, `capabilitySummary`; `permission`, `status`; lock marker when RBAC-related (§3.10)                                                         |
| Failures           | grouped `Issue` / `Error` per §3.11; hints indented                                                                                                          |
| Impact             | `developer.whatFailed`, `developer.whatNeedsAttention` — deduped vs Failures                                                                                 |
| Integration        | `integration.stepResults`; duration from `evidence` / timings                                                                                                |
| Certification      | `certificate.status`, `certificate.level`, `certificate.blockers`, `certificate.summary`; maturity ladder compares achieved vs target tier                   |
| Next actions       | `developer.nextActions` + deduped hints                                                                                                                      |
| Debug              | `debug`, `audit` per §3.7; trace URLs/refs as returned (no REST tutorial in user docs)                                                                       |


### 16.3 Verdict phrase table (normative defaults)

Map root `status` + optional cert to **one** headline after `Verdict:`:


| Root status | Cert (if present) | Verdict line (example class)                                                                                                          |
| ----------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ok`        | `passed`          | Suitable for production use                                                                                                           |
| `ok`        | `not_passed`      | Functional with certification gaps                                                                                                    |
| `warn`      | any               | Limited production use                                                                                                                |
| `fail`      | any               | Not usable / Pipeline not working / Configuration invalid (pick by `runType`: test → config; integration → pipeline; e2e → usability) |
| `skipped`   | any               | Skipped (reason from `developer` or `validation.summary` if present)                                                                  |


Exact strings are **snapshot-tested**; tune copy in one locale table in code.

### 16.4 Data Quality three lines (normative labels)

Always these **three** labels in order (glyph from rollup):

1. **Schema coverage** — structural/config completeness (from validation issues codes / readiness, not “ICC”).
2. **Data consistency** — mapping + type coherence signals from validation issues.
3. **Data reliability** — connectivity/exec hints from validation layer when present.

If a slice has no signal, use **WARN** or **OK** per server-provided `validation.status` and issue presence — document heuristics in renderer tests.

### 16.5 Reference layout — `datasource test-e2e`

```text
Datasource: hubspot.deals (hubspot)
Run: e2e
Status: ⚠ WARN
Run ID: run_8f3k2

Verdict: ⚠ Limited production use

Summary:
3 of 5 capabilities working — write operations failing

────────────────────────────────

Data Quality:
✔ Schema coverage
⚠ Data consistency
✖ Data reliability

Confidence: 89% (Good)

Deductions:
- deal.create failed
- invalid mapping: amount

Readiness: ✖ Not ready

────────────────────────────────

Capabilities:
✔ deal.list
✔ deal.get
✖ deal.create (permission missing)
✖ deal.update
✔ deal.delete

Failures:

deal.create
- Permission denied
  Hint: Add RBAC permission hubspot.deal.create

deal.update
- Field mapping invalid: amount → dealAmount
  Hint: Fix fieldMapping

Impact:
- Write operations unreliable
- Data updates may fail

────────────────────────────────

Integration:
✔ fetch
✔ transform
✔ normalize
✖ policy enforcement
✔ output

────────────────────────────────

Certification:
Target: silver
Status: ✖ Not achieved

Blockers:
- deal.create not working
- deal.update not working

Maturity:
✔ Bronze
✖ Silver
✖ Gold

────────────────────────────────

Next actions:
- Add RBAC permission hubspot.deal.create
- Fix field mapping: amount → dealAmount
- Re-run test-e2e
```

*(Lock icon in capability line is optional; plain `(permission missing)` satisfies §3.10.)*

### 16.6 Reference layout — `datasource test`

```text
Datasource: hubspot.deals (hubspot)
Run: test
Status: ✖ FAIL
Run ID: run-f9c2b78628f0

Verdict: ✖ Not usable

Summary:
Configuration is incomplete — blocking issues found

────────────────────────────────

Data Quality:
✖ Schema coverage
⚠ Data consistency
✖ Data reliability

Confidence: 62% (Partial)

Readiness: ✖ Not ready

────────────────────────────────

Issues:

✖ Missing field mapping: amount → dealAmount
  Hint: Add fieldMapping for amount

✖ Missing permission: hubspot.deal.create
  Hint: Add RBAC permission

Impact:
- deal.create will fail
- certification cannot be achieved

────────────────────────────────

Next actions:
- Add missing field mapping
- Grant required permission
```

### 16.7 Reference layout — `datasource test-integration`

```text
Datasource: hubspot.deals (hubspot)
Run: integration
Status: ✖ FAIL
Run ID: run-f9c2b78628f0

Verdict: ✖ Pipeline not working

Summary:
Pipeline execution failed at policy enforcement

────────────────────────────────

Data Quality:
⚠ Data consistency issues detected

Confidence: 78% (Partial)

────────────────────────────────

Integration:
✔ fetch
✔ transform
✔ normalize
✖ policy enforcement
  Error: missing access field ownerId
  Hint: add accessField ownerId
✔ output

Duration: 420ms

Impact:
- Data filtering incomplete
- Results may be inconsistent

────────────────────────────────

Next actions:
- Add accessField ownerId
```

### 16.8 Debug mode (`--debug`)

```text
Debug (summary)

Trace ID: trace_abc123

Execution:

✔ fetch deals (120ms)
✔ transform
✖ normalize
  Error: invalid type: expected number, got string

Audit:
Trace: (refs from audit.traceRefs / debug.payloadRefs per response)

Use --debug=full for payload details
```

Print **opaque refs only** in default debug summary; full URLs are acceptable if the server returns them — still apply §3.7 size limits.

### 16.9 Summary mode (`--summary`, CI)

```text
hubspot.deals ⚠ WARN
Confidence: 89%
Capabilities: 3/5
Certificate: silver ✖
```

**Normative fields:** `datasourceKey`, root status glyph, optional confidence **only if** present in body (else omit line), `capabilitySummary` counts if present, `certificate.level` + pass/fail glyph if present. One block, fixed line order for snapshots.

### 16.10 Progress (async / long runs)

```text
Running e2e test...
⏳ Executing capabilities (2/5)

Current status: ⚠ WARN
Confidence: 72%
```

Capability index `(2/5)` uses **sorted** capability list length (§3.8). **Confidence** line omitted if unknown. Aligns with §3.13.

### 16.11 Watch mode (diff view)

```text
Watching for changes...

Change detected: datasource.json
Re-running test...

Previous: ✖ FAIL (62%)
Current:  ⚠ WARN (89%) ↑ +27%

Remaining issues:
- deal.create
- deal.update
```

Percentages only if present in prior/current parsed summaries; else omit. **↑** optional when TTY supports unicode; plain text `+27%` sufficient. See §3.14.

### 16.12 Color and symbol contract (chalk / TTY)


| Meaning           | Symbol | Suggested color |
| ----------------- | ------ | --------------- |
| OK                | ✔      | green           |
| WARN              | ⚠      | yellow          |
| FAIL              | ✖      | red             |
| SKIPPED           | ⏭      | gray            |
| Metadata / labels | (none) | gray            |
| In progress       | ⏳      | yellow or cyan  |


**NO_COLOR** env disables colors; symbols remain.

### 16.13 Machine modes

- `**--json`:** full **DatasourceTestRun** only — no UI blocks (§8).
- `**--summary`:** §16.9 only.

---

## 17. External system (system-level) CLI UI

**Purpose:** Answer whether the **external system** (identified by `systemKey`) is **ready as a whole** — the **business integration unit**, not a single datasource. **Core principle:** **aggregation + prioritization + navigation**, **not** repetition of full §16 layouts for every datasource.

### 17.1 Questions answered (system scope)

1. **Verdict** — Can we rely on this external system end-to-end?
2. **Data Quality** — Rolled-up trust (same three lines as §16.4, **aggregated**).
3. **Datasources** — Which units are OK / partial / failing (**primary navigational index**).
4. **Key issues** — Top failures only (**cap**), grouped by datasource.
5. **Capabilities overview** — Compact per-datasource signal (not full §16 capability drill-down).
6. **Integration health** *(runType integration)* — Per-datasource pipeline status, not every step for every OK datasource.
7. **Certification** — System-level result + **per-datasource breakdown** (bottleneck / weakest link).
8. **Next actions** — Prioritized; **always** end with explicit **drill-down** commands.

### 17.2 Command surfaces (normative)

Use `**aifabrix test <systemKey>`**, `**test-integration <systemKey>`**, or `**test-e2e <systemKey>**` only when resolution is **external integration** (§2.0). Examples below use `hubspot` as `systemKey`.


| User intent                        | Command                                                   | `runType`     |
| ---------------------------------- | --------------------------------------------------------- | ------------- |
| System rollup (structural / trust) | `aifabrix test hubspot` *(external dispatch)*             | `test`        |
| System integration health          | `aifabrix test-integration hubspot` *(no `--datasource`)* | `integration` |
| System E2E / capability overview   | `aifabrix test-e2e hubspot`                               | `e2e`         |


**Scoped to one datasource:** use the **datasource** command family (renders §16, not §17), e.g. `aifabrix datasource test-integration hubspot.deals` / `aifabrix datasource test-e2e hubspot.deals`.

### 17.3 Deterministic block order (system TTY)

**Never** dump full per-datasource §16 output by default. Order:

1. **Header** — `System: {systemKey}`, optional `Environment: {env}` from `-e / --env`, `Run: {runType}`, `Status: {glyph + systemStatus}`, optional aggregate `Run ID` / correlation from server.
2. **Verdict** — from `systemStatus` + system cert rollup (§17.4).
3. **Summary** — one short paragraph: counts of datasources OK / partial / fail, or server-provided system summary if present.
4. **Separator**
5. **Data Quality** — same three labels as §16.4; glyphs from **aggregate** rules §17.4.
6. **Confidence** — **omit** unless server provides a **single** system-level value or **all** children supply a harmonized scalar; **never** average invented percentages client-side.
7. **Readiness** — system readiness: **Not ready** if any child `dataReadiness` is `not_ready`; **Limited use** if any `partial` and none `not_ready`; **Ready** if all `ready` (glyphs per §16.12).
8. **Separator**
9. **Datasources** — table: `datasourceKey`, rollup status, short readiness label. **Collapse (default):** list **only** datasources with status **warn** or **fail**; single summary line `✔ N datasource(s) fully ready` for **ok** children. `**--verbose`:** list all datasources.
10. **Weakest link** — one line: `Blocking datasource: {key}` = first by sort **fail** > **warn** > **ok**, then `datasourceKey` ASCII (§17.4).
11. **Separator**
12. **Key issues** — max **5** issue **groups** across the system (blocking first); each group prefixed with datasource key; **no** full step dumps.
13. **Capabilities overview** *(runType e2e or test when capabilities exist)* — per datasource, **one line** of compact operation status (e.g. read/create/update/delete style **only** when capability keys map cleanly; else top **4** capability keys by §3.8 order + glyphs). **No** E2E step traces here.
14. **Integration health** *(runType integration)* — per datasource: **one** line (pipeline OK/WARN/FAIL) + expand **only** failing datasources with **failed step name + hint** (max **2** steps per datasource).
15. **Global impact** *(optional, one short block)* — at most **3** bullets from aggregated `developer.whatFailed` or synthesized high-level consequences; dedupe with Key issues.
16. **Separator**
17. **Certification** — `System Level:` pass/fail; **Breakdown:** each datasource → tier + glyph; system **not achieved** if any datasource `certificate.status` is `not_passed` **or** weakest tier below product target (§17.4).
18. **Next actions** — max **5** bullets; first item **must** reference **blocking datasource** when any fail.
19. **Use:** (navigation) — **always** print **concrete** drill-down, e.g. `aifabrix datasource test-e2e hubspot.deals`.
20. **Debug** — last; §3.7 / §16.8 pattern for **aggregate** trace ids only unless `--debug=full`.

### 17.4 Aggregation logic (normative)

Inputs: ordered set of **child** `DatasourceTestRun` reports **{R₁…Rₙ}** for datasources under `systemKey` (same `runType`). Missing child = **skipped** row in table, not silent omit (mark as “not reported”).


| Derived field                    | Rule                                                                                                                                                                                                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `systemStatus`                   | **fail** if any child `status` is `fail`; else **warn** if any `warn`; else **ok** if all `ok`; else **skipped** if all `skipped`; else mixed → **warn**.                                                                                                                                           |
| Data Quality line glyphs         | **Schema coverage:** **fail** if any child validation implies structural failure; **warn** if any warn and none fail; else **ok**. Same pattern for **consistency** / **reliability** from child `validation.issues` severities (heuristics snapshot-tested; no ICC/PDS/DTS strings).               |
| System readiness                 | From child `validation.dataReadiness` as in §17.3.                                                                                                                                                                                                                                                  |
| **Weakest link datasource**      | First child with `status` **fail**; if none, first with **warn**; sort ties by `datasourceKey`.                                                                                                                                                                                                     |
| System certification             | **not_passed** if **any** child `certificate.status` is `not_passed` **or** child missing certificate when others have one (document as gap). **Tier display:** show each child’s `certificate.level`; “target” tier for system = product default (e.g. silver) until OpenAPI supplies system goal. |
| Key issues pool                  | Collect blocking `Issue`s from children; dedupe §3.11 key; sort by severity then datasource key; take **5**.                                                                                                                                                                                        |
| **Dependency hint** *(optional)* | If manifest exposes datasource dependencies, one **Dependency impact:** line (e.g. deals → companies); **omit** if unknown.                                                                                                                                                                         |


### 17.5 UX rules (system level)

- **Shorter than §16** — overview only; never print all integration steps for healthy datasources.
- **Prioritize** failing and partial datasources in tables and issue blocks.
- **Always** print **Use:** drill-down to datasource (and capability if one blocker is a single capability).
- **Aggregate, don’t duplicate** — one issue group per **(datasource, code/message)**; no repeat of the same hint under three sections.
- **Same symbols/colors** as §16.12.

### 17.6 Reference layout — system `test` / rollup (`aifabrix test hubspot`)

```text
System: hubspot
Environment: dev
Status: ⚠ WARN

Verdict: ⚠ Partially ready

Summary:
2 of 3 datasources working — deals write operations failing

────────────────────────────────

Data Quality:
✔ Schema coverage
⚠ Data consistency
✖ Data reliability

Confidence: 84% (Good)

Readiness: ⚠ Limited use

────────────────────────────────

Datasources:

✔ hubspot.contacts        (Ready)
⚠ hubspot.companies      (Partial)
✖ hubspot.deals          (Not ready)

Blocking datasource: hubspot.deals

────────────────────────────────

Key issues:

hubspot.deals
- deal.create failing (permission missing)
- mapping issue: amount

hubspot.companies
- inconsistent ownerId mapping

────────────────────────────────

Capabilities overview:

contacts:
✔ read ✔ create ✔ update ✔ delete

companies:
✔ read ✔ create ⚠ update ✔ delete

deals:
✔ read ✖ create ✖ update ✔ delete

────────────────────────────────

Certification:

System level: ✖ Not achieved

Breakdown:
✔ contacts → gold
⚠ companies → silver
✖ deals → not certified

────────────────────────────────

Next actions:
- Fix hubspot.deals (blocking system readiness)
- Resolve RBAC for deal.create
- Fix mapping: amount → dealAmount

Use:
  aifabrix datasource test-e2e hubspot.deals
```

### 17.7 Reference layout — system `test-integration`

```text
System: hubspot
Run: integration
Status: ⚠ WARN

Summary:
Pipeline issues in 2 datasources

────────────────────────────────

Integration health:

✔ contacts pipeline
⚠ companies pipeline
✖ deals pipeline

────────────────────────────────

Failures:

hubspot.deals
✖ policy enforcement
  Hint: missing ownerId

hubspot.companies
⚠ normalization issues

────────────────────────────────

Next actions:
- Fix deals policy enforcement
- Review companies normalization

Use:
  aifabrix datasource test-integration hubspot.deals
```

### 17.8 Reference layout — system `test-e2e`

```text
System: hubspot
Run: e2e
Status: ⚠ WARN

Summary:
Some operations failing across datasources

────────────────────────────────

Capabilities by datasource:

contacts:
✔ read ✔ create ✔ update ✔ delete

companies:
✔ read ✔ create ⚠ update ✔ delete

deals:
✔ read ✖ create ✖ update ✔ delete

────────────────────────────────

Global impact:
- CRM write operations unreliable
- Sales workflows may fail

────────────────────────────────

Certification:

System: ✖ Not certified

Reason:
- deals datasource failing

────────────────────────────────

Next actions:
- Fix deals datasource first (critical path)

Use:
  aifabrix datasource test hubspot.deals
```

### 17.9 Progress / watch / summary (system)

- **Progress:** reuse §3.13 / §16.10; show **datasource index** `(i/N)` when partial aggregate available.
- **Watch:** §3.14; diff **systemStatus**, **weakest link key**, and **datasource status list** (not full §16 diff).
- `**--summary`:** one line: `hubspot ⚠ WARN | datasources 2/3 ok | cert ✖` (+ optional confidence if present).

### 17.10 Optional enhancements

- **Dependency impact:** one block when manifest/graph known (§17.4).
- **Environment:** always echo resolved env in header when `-e` / `--env` used.

### 17.11 Mapping to DatasourceTestRun (no ambiguity)

Every visible line must trace to: **(a)** a field on a child `DatasourceTestRun`, **(b)** a **deterministic aggregate** in §17.4, or **(c)** fixed product copy from phrase tables. **Forbidden:** free-form prose not tied to (a)–(c).

### 17.12 Machine output (`--json`)

- **Preferred:** one JSON object as defined in OpenAPI for system scope (e.g. `systemKey`, `systemStatus`, `children: DatasourceTestRun[]`, optional rollup fields).
- **Interim (client fan-out):** print a **JSON array** of **DatasourceTestRun**, sorted by `**datasourceKey`** ascending; print **stderr** notice `aggregate format: interim array` once. **CI** should prefer OpenAPI aggregate once available — same exit rules §3.1a.

---

## 18. Next steps (optional follow-ups)

- **Implementation spec:** functions/modules per package (`validation-run.api.js`, `datasource-test-render.js`, `system-aggregate.js`, `poll-unified.js`).
- **Renderer pseudo-code:** datasource path §3.2 + §16; system path §17.3–17.4; snapshot §16.5–16.7 and §17.6–17.8.
- **UI → field matrix:** extend §16.2 / §17.11 with OpenAPI system aggregate schema when available.

This plan intentionally does **not** restate every JSON property; implementers read the schema and OpenAPI together.

## Implementation Validation Report

**Date**: 2026-04-04 (plan text amended 2026-04-09: §3.1a, Contents, §14.1 definition of done, frontmatter `todos`, traceability **362**)  
**Plan**: `.cursor/plans/115-testing-tool.plan.md`  
**Status**: ⚠️ INCOMPLETE (plan §14 deliverables unchecked; partial implementation validated)

### Executive Summary

Code quality commands (`npm run lint:fix`, `npm run lint`) pass. Full `npm test` is **intermittent** in this environment: `datasource-validation-watch` tests and schema-sync tests have been hardened (see below), but **lazy `require('./paths')` inside `buildWatchTargetList`** is still recommended if flakes persist—edit was blocked here by filesystem permissions on `lib/utils/datasource-validation-watch.js`. The plan’s §14 checklist remains **all open**; large items (§16–§17 renderer, system aggregate, positional capability arg) are not fully delivered vs this document.

### Task Completion (§14 checklist)


| Item                                                  | Plan checkbox | Notes                                                                                                                                                                          |
| ----------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Single API module POST + poll; system fan-out         | `[ ]`         | `lib/api/validation-run.api.js`, `lib/utils/validation-run-*.js` present; system aggregate §17 not verified complete                                                           |
| `datasource test` + `test-e2e <ds> <capability>`      | `[ ]`         | Positional `[capabilityKey]` + deprecated `--capability` + mismatch warning implemented (`datasource-unified-test-cli.js`); still verify server contract + fixtures end-to-end |
| Renderer §3.2 / §16 / §17                             | `[ ]`         | Partial / minimal display; full TTY spec not audited                                                                                                                           |
| Exit matrix; `--require-cert`, `--warnings-as-errors` | `[ ]`         | Verify in CLI                                                                                                                                                                  |
| `--json` / `--summary`; schema sync                   | `[ ]`         | Schema sync: `lib/utils/datasource-test-run-schema-sync.js` uses `node:fs` (reduces `jest.mock('fs')` interference)                                                            |
| `--watch` §3.14; progress; debug limits               | `[ ]`         | Watch: `lib/utils/datasource-validation-watch.js`; `watchCi` early return after first run; debounce 500ms                                                                      |
| `reportVersion` §3.15                                 | `[ ]`         | Spot-check implementation                                                                                                                                                      |
| Flag map §4                                           | `[ ]`         | `lib/schema/flag-map-validation-run.json` present                                                                                                                              |


**Completion (§14)**: 0 / 8 checkboxes marked done in the plan file.

### File existence (spot check)

- ✅ `lib/api/validation-run.api.js`, `lib/utils/validation-run-poll.js`, `lib/utils/validation-run-request.js`, `lib/utils/validation-run-post-retry.js`
- ✅ `lib/utils/datasource-validation-watch.js`
- ✅ `lib/schema/flag-map-validation-run.json`
- ✅ Tests: `tests/lib/api/validation-run.api.test.js`, `tests/lib/utils/validation-run-*.test.js`, `tests/lib/utils/datasource-validation-watch.test.js`, `tests/lib/utils/datasource-test-run-schema-sync.test.js`, CLI tests for validation/unified test

### Test coverage

- ✅ Unit tests exist for validation-run API, request/poll/retry, schema sync, watch utilities, and related CLI layers.
- ✅ Isolated Jest projects + `node:fs` + lazy `paths` require + watch test `afterEach` without `restoreAllMocks` — full suite green in verification run; repeat `npm test` if CI shows rare cross-suite noise.

### Code quality validation

- ✅ **Format/Lint**: `npm run lint:fix` → `npm run lint` (pass).
- ⚠️ **Tests**: `npm test` should be re-run locally until green; intermittent failures were addressed via compose win32 mock fix, hosts cleanup retries, `node:fs` in schema-sync, isolated Jest project for watch tests, and `watchCi` early return.

### Cursor rules compliance (spot check)

- ✅ CommonJS, `path.join`, try/catch patterns in touched tests; no secrets added.
- ✅ `buildWatchTargetList` uses lazy `require('./paths')`; watch tests omit `restoreAllMocks` in `afterEach`.

### Implementation completeness vs full plan

- ⚠️ **Documentation / system UI / full §16–§17**: not complete per plan scope.
- ✅ **Incremental**: unified validation run client, polling, watch mode hooks, flag map, schema sync helper, and tests are in repo.

### Issues and recommendations

1. Mark §14 items in the plan as `[x]` only when each bullet is verified against the codebase.
2. Apply **lazy `require('./paths')`** at the start of `buildWatchTargetList` (remove top-level `paths` import from `datasource-validation-watch.js`) if watch tests still flake under multi-project Jest.
3. Keep `**tests/lib/infrastructure/compose.test.js**` win32 case using forward slashes after `path.resolve` mock so `toDockerBindMountSource` regex matches on Linux workers.
4. `**tests/lib/utils/dev-hosts-helper.test.js**`: `fs.rmSync` with `maxRetries` / swallowed errors reduces tmp cleanup races.

### Final validation checklist

- All §14 tasks completed (plan checkboxes)
- Key implementation files exist
- Tests exist for validation-run / watch / schema sync
- Lint passes (this run)
- `npm test` green in verification run (re-run in CI; rare flakes possible in other suites)
- Registry/docs aligned if APIs changed (Builder docs rules: no raw REST in user docs)

## Implementation Validation Report

**Date**: 2026-04-16  
**Plan**: `.cursor/plans/115-testing-tool.plan.md`  
**Status**: ⚠️ **INCOMPLETE** (core slices implemented; several §14 deliverables still unchecked)

### Executive summary

- ✅ **Code quality**: `pnpm run lint:fix` → `pnpm run lint` passed
- ✅ **Tests**: `pnpm test` passed (full suite green in this run)
- ✅ **Recent work implemented**:
  - System-level `test` / `test-integration` / `test-e2e` now share the same small interface (`-e`, `-v`, `-d/--debug` as **boolean**, `-h`) — see **§2.2** vs datasource **§2.1a**
  - `--debug` for local external `test` writes logs under `integration/<systemKey>/logs/`
  - TTY color semantics improved per `layout.md` (legacy + envelope paths), and tests added for most updated surfaces
- ⚠️ **Plan completeness**: §14 checklist items are still mostly `[ ]` and should be reviewed/checked only when each is verified end-to-end against this plan.

### Files verified (spot)

- `lib/commands/datasource-unified-test-cli.js` + `lib/commands/datasource-unified-test-cli.options.js` (refactor to stay under 500 lines; lint rule satisfied)
- `lib/utils/external-system-display.js` / `lib/utils/external-system-local-test-tty.js` (TTY UX alignment)
- `lib/cli/setup-app.js`, `lib/cli/setup-external-system.js` (system-level CLI flag interface)
- Tests added/updated across `tests/lib/utils/`*, `tests/lib/commands/*`, `tests/lib/external-system/*`

### Code quality validation (this run)

- ✅ **Format**: `pnpm run lint:fix`
- ✅ **Lint**: `pnpm run lint`
- ✅ **Tests**: `pnpm test`

### Remaining work (task list)

These map directly to the unchecked §14 items and remaining plan sections that are not yet fully delivered:

1. **Renderer completeness** (plan §3.2 + §16 + §17)
  - Datasource renderer: verify all required blocks, empty handling (§3.9), dedupe (§3.11), leakage guardrails (§3.12), RBAC surfacing (§3.10) are fully implemented and covered by fixtures.
  - System aggregate renderer (§17): implement/verify the system-level rollup output (not just per-datasource list) and ensure it does not dump full §16 per datasource by default.
2. **Exit matrix §3.1 end-to-end** (including system aggregate §3.1a)
  - Confirm exit codes for all combinations (ok/warn/fail + `--warnings-as-errors` + `--require-cert`), including aggregated/system mode.
3. **Machine output modes** (`--json` / `--summary`) + schema sync CI (§8.1)
  - Ensure fixtures are AJV-valid against `lib/schema/datasource-test-run.schema.json` and schema-sync gate is part of CI (`npm run check:schema-sync` exists; ensure plan §8.1 expectations are met).
4. **Watch mode + progress UI + debug limits** (plan §3.13–§3.14, §3.7)
  - Verify progress messaging is present/consistent across datasource commands.
  - Verify watch mode diff behavior (§3.14) matches the plan, including `--watch-ci` exit semantics.
5. **Docs/registry alignment** (builder docs rule: no REST in user docs)
  - Ensure `docs/commands/`* and any support/registry maps reflect the *actual* CLI interfaces and behavior after the flag/interface changes.

## Implementation Validation Report (validate-implementation)

**Date**: 2026-04-16  
**Plan**: `.cursor/plans/115-testing-tool.plan.md`  
**Status**: ⚠️ **INCOMPLETE** (remaining §14 items not yet verified/delivered)

### Task completion (plan §14 checkboxes)

- **Total**: 8
- **Completed**: 3
- **Incomplete**: 5

**Incomplete items:**

- Renderer: §3.2 + §16 (datasource) + §17 (system aggregate), including empty handling/dedupe/leakage/RBAC surfacing
- Exit matrix §3.1 + §3.1a end-to-end (`--require-cert`, `--warnings-as-errors`) including system-aggregate mode
- Machine outputs: `--json` / `--summary` + schema sync CI §8.1 (fixtures AJV-valid)
- Watch/progress/debug limits: `--watch` §3.14 + progress §3.13 + debug size limits §3.7
- Flag map §4: normative **§4** / **§2.1a** tables synced to code (2026-04-16); machine-readable parity / expanded CI for `lib/schema/flag-map-validation-run.json` still pending

### File existence validation (high-signal targets)

- ✅ `lib/api/validation-runner.js` (single POST + poll orchestrator)
- ✅ `lib/api/validation-run.api.js` (unified validation API helpers)
- ✅ `lib/datasource/unified-validation-run.js` (datasource-scoped unified runner)
- ✅ `lib/commands/datasource-unified-test-cli.js` + `lib/commands/datasource-unified-test-cli.options.js` (CLI wiring + shared options/help)
- ✅ `lib/utils/datasource-test-run-tty-log.js` + `lib/utils/datasource-test-run-report-version.js` (`reportVersion` diagnostics)

### Test coverage validation (spot)

- ✅ Tests exist for the unified validation API + polling + CLI wiring (full `npm test` pass in this run)
- ✅ Legacy external test API module removed (`lib/api/external-test.api.js`) and its tests removed

### Code quality validation (this run; mandatory order)

- ✅ Format: `npm run lint:fix`
- ✅ Lint: `npm run lint` (0 errors, 0 warnings)
- ✅ Tests: `npm test` (pass)

### Cursor rules / docs policy (spot)

- ✅ CommonJS module pattern maintained
- ✅ No secrets introduced
- ⚠️ User-facing CLI docs refreshed (2026-04-16) for system vs `datasource` flags, debug logs, capability positional; keep avoiding REST paths in `docs/commands/*` and re-check after further CLI churn

### Final validation checklist

- All §14 tasks completed (plan checkboxes)
- Key implementation files exist
- Lint passes (this run)
- Tests pass (this run)
- Registry/docs aligned if interfaces changed

## Plan changelog (CLI parameters)

**2026-04-16:** Normative plan text was aligned with the **current Builder CLI** (see `lib/commands/datasource-unified-test-cli.options.js`, `lib/commands/datasource-unified-test-cli.js`, `lib/cli/setup-app.test-commands.js`, `lib/cli/setup-external-system.js`):

- **§2.1a** — Datasource `test` / `test-integration` / `test-e2e`: full flag set, `**--help` option registration order**, per-command differences (`--payload`, `--no-async`, default `--timeout`), E2E-only flags, and positional `[capabilityKey]`.
- **§2.2** — System-level `test` / `test-integration` / `test-e2e`: `**-e` / `-v` / `-d/--debug` (boolean) / `-h` only**; no `--json` / `--summary` / `--timeout` / `--watch`; `rawArgs` env override.
- **§3.5** — `**--no-async`** only on `datasource test` + `datasource test-e2e` (not `datasource test-integration`).
- **§4** — Flag matrix rewritten to match **§2.1a** + system-level split.
- **§2.3** — Request wiring documents `**e2eOptions.capabilityKeys`** (`lib/datasource/unified-validation-run-body.js`).
- **§2.2** (follow-up) — Documented **system `test-e2e`** always-async polling (`async: true` in `setup-app.test-commands.js`).
- **Validate-tests §14 table** — Notes column for capability drill-down row updated to match current CLI behavior.
- **User docs (`docs/commands/*`)** — `application-development.md`, `external-integration.md`, `external-integration-testing.md`: aligned with small system-level test surface; documented `datasource test --debug` → `test-*.json` logs; removed stale sample CLI transcripts from the testing guide (prefer `--json` / printed log paths for stability).
- **`datasource log-test`** — CLI + `log-viewer` resolve latest structural **`test-*.json`** (excluding `test-e2e-*` / `test-integration-*`); user docs + permissions row + README index updated.
- **CI gates** — `package.json` **`build:ci`**: runs **`check:schema-sync`** then **`check:flags`** (flag-map JSON test) before **`test:ci`**.
- **Exit matrix (§3.1) tests** — Extended `datasource-test-run-exit.test.js` (fail vs `--require-cert`, `ok`/`skipped`, warn+requireCert, unknown status, `exitCodeForPollTimeout(null)`).
- **`runLogViewer` + `log-test` wiring** — `log-viewer-run.test.js` (structural log via `--file`); `datasource.test.js` asserts **`log-test`** action calls **`runLogViewer`** with **`logType: 'test`**.
- **Unified CLI finalize** — `datasource-validation-cli.test.js`: **`--warnings-as-errors`**, **`--require-cert`** (missing cert), **`--strict-capability-scope`** with multi-row `capabilities[]` vs single row.
- **System rollup** — `tests/lib/external-system/test-system-level.test.js`: empty keys, all-ok aggregate, one `fail`, `apiError` mapping (`runSystemLevelTest`).
- **`--watch-ci`** — `datasource-validation-watch.test.js`: first-run exit `0`, non-zero exit `1`, and **no SIGINT/SIGTERM listeners** registered when `watchCi` short-circuits after first run.
- **`--summary` shape** — `tests/lib/utils/datasource-test-run-summary.test.js`: `formatDatasourceTestRunSummary` (null envelope, key + status, `capabilitySummary`, `focusCapabilityKey` present/missing, certificate line).
- **2026-04-20 (continued)** — **AJV**: `tests/fixtures/datasource-test-run-rich.json` + extra cases in `datasource-test-run-ajv.test.js` (rich envelope, reject missing `datasourceKey`). **Debug limits §3.7**: `datasource-test-run-debug-slice.test.js` asserts 50-issue / 30-blocker caps. **System rollup exit**: `test-system-level.test.js` — `skipped` success, `pollTimedOut` / `incompleteNoAsync` failures. **TTY smoke**: `datasource-test-run-display-tty.test.js` (e2e “No capabilities reported”, drill-down suppresses line). **`docs/commands/permissions.md`** — removed raw HTTP paths/methods from user-facing rows (docs-rules). Frontmatter: **`machine-schema-ci`**, **`docs-permissions`** → completed.

## Implementation Validation Report (validate-implementation)

**Date**: 2026-04-20T08:17:16Z  
**Plan**: `aifabrix-builder/.cursor/plans/115-testing-tool.plan.md`  
**Status**: ⚠️ **INCOMPLETE** (plan deliverables and §14 verification not finished; codebase and CI gates are healthy)

### Executive summary

| Area | Result |
|------|--------|
| **Plan YAML todos** | **4 pending** (`renderer-ds-system`, `exit-flags`, `watch-progress-debug`, `tests-snapshots`); **`machine-schema-ci`** + **`docs-permissions`** completed 2026-04-20 |
| **§14 checklist table** (8 rows) | All rows still documented as **`[ ]`** — **0 / 8** marked verified in-plan |
| **Format / lint** | ✅ `npm run lint:fix` → `npm run lint` (exit 0) |
| **Tests** | ✅ `npm test` (exit 0, this workspace) |
| **CI-style gate** | ✅ `npm run build:ci` (lint + `check:schema-sync` + `check:flags` + `test:ci` / ci-simulate) exit 0 |

The plan cannot be marked **COMPLETE** until §14 items are verified and checkboxes/todos are closed intentionally. Implementation is **substantially present** (unified validation run, watch, flags, schema sync, many tests).

### Task completion

- **Markdown `- [ ]` / `- [x]` tasks**: None found in this plan body (tasks are expressed as YAML `todos` + §14 table).
- **Frontmatter `todos`**: **4** with `status: pending` (renderer, exit-flags, watch-progress-debug, tests-snapshots); **2** completed (`machine-schema-ci`, `docs-permissions`).
- **§14 table (lines ~1194–1203)**: **8** items; all still **`[ ]`** in the plan text.

### File existence validation (high-signal)

| Path | Status |
|------|--------|
| `lib/api/validation-run.api.js`, `lib/api/validation-runner.js` | ✅ Present |
| `lib/utils/validation-run-request.js`, `validation-run-poll.js`, `validation-run-post-retry.js` | ✅ Present |
| `lib/utils/datasource-validation-watch.js` | ✅ Present |
| `lib/commands/datasource-unified-test-cli.js`, `datasource-unified-test-cli.options.js` | ✅ Present |
| `lib/schema/flag-map-validation-run.json` | ✅ Present |
| `lib/utils/datasource-test-run-display.js` (`formatDatasourceTestRunSummary`) | ✅ Present |
| `tests/lib/utils/datasource-test-run-summary.test.js` | ✅ Present (added same validation run to match plan changelog) |
| `tests/lib/utils/datasource-validation-watch.test.js` (incl. `watchCi` cases) | ✅ Present |

### Test coverage (spot)

- ✅ Unified validation / poll / CLI: multiple suites under `tests/lib/api/`, `tests/lib/utils/`, `tests/lib/commands/`, `tests/lib/datasource/`, `tests/lib/external-system/`.
- ⚠️ **Golden / snapshot TTY** (`tests-snapshots` todo): not evidenced as complete.
- ✅ **DatasourceTestRun AJV** — `datasource-test-run-ajv.test.js` validates minimal + **rich** fixtures and a negative case; `check:schema-sync` remains in **`build:ci`**. (CLI `--json` streaming not separately asserted here.)

### Code quality validation (mandatory order)

1. ✅ **Format / fix**: `npm run lint:fix` — PASSED  
2. ✅ **Lint**: `npm run lint` — PASSED (0 errors)  
3. ✅ **Tests**: `npm test` — PASSED  
4. ✅ **Extended CI**: `npm run build:ci` — PASSED (includes `check:schema-sync`, `check:flags`, `test:ci`)

### Cursor rules compliance (spot)

- ✅ CommonJS, ESLint clean on touched tree; no secrets in validation commands.
- ✅ **Docs rules**: `docs/commands/permissions.md` scrubbed of raw HTTP paths (2026-04-20). Further JSDoc / §11 “legacy URL” cleanup may remain.

### Implementation completeness vs plan scope

- ✅ Core: POST + poll path, datasource unified test CLI, watch + `watchCi`, flag map + CI check, schema sync gate, exit helper tests, system rollup tests (see existing plan changelog).
- ❌ **Full** §16 / §17 renderer, full exit matrix in aggregate mode, snapshot TTY, and docs closure — **not** validated as complete by this run.

### Issues and recommendations

1. ~~**Restore or add** `tests/lib/utils/datasource-test-run-summary.test.js`~~ — added 2026-04-20 during validation.
2. Close **frontmatter todos** and **§14 table** only after each bullet is verified end-to-end (per plan’s own guidance).
3. Keep running **`npm run build:ci`** before merges touching validation / schema / flags.

### Final validation checklist

- [ ] All plan tasks / §14 items completed and marked in the plan
- [x] Key implementation files exist (incl. `datasource-test-run-summary.test.js`)
- [x] Tests exist for major modules; full `npm test` + `build:ci` green (this run)
- [x] Code quality validation passes (`lint:fix`, `lint`, tests, CI simulation)
- [x] Cursor rules / docs alignment improved (`docs/commands/permissions.md`); optional JSDoc / §11 follow-up
- [ ] Implementation complete vs full §16–§17 / snapshots scope

