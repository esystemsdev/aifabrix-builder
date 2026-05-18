---
name: test-trust — semantic validation CLI (143)
overview: "Builder CLI: aifabrix test-trust and aifabrix datasource test-trust run dataplane agent metadata validation (404.5) with flags aligned to test / test-integration / test-e2e. TTY output separates structural, integration, E2E, and semantic trust reality for integrators. Planning only until dataplane 404.5 and this plan are approved."
todos:
  - id: plan-review
    content: Review and approve this plan (after dataplane 404.5 API contract is frozen)
    status: pending
  - id: dataplane-404-5-prereq
    content: Confirm dataplane 404.5 endpoints + AgentTrustRun envelope (or reuse pattern) are live or stubbed for builder dev
    status: completed
  - id: api-module
    content: lib/api/agent-metadata-validation.api.js + types (validate POST, latest GET)
    status: completed
  - id: run-orchestration
    content: lib/datasource/agent-trust-run.js + lib/commands/test-trust-external.js (system fan-out)
    status: pending
  - id: cli-registration
    content: setup-app.test-trust-commands.js + datasource test-trust in datasource-unified-test-cli (or sibling)
    status: pending
  - id: display-exit
    content: lib/utils/agent-trust-run-display.js + exit code helper (trustDecision matrix)
    status: pending
  - id: logs-help-matrix
    content: test-trust-*.json log prefix, help-builder External Systems, cli-output-command-matrix rows
    status: pending
  - id: docs-tests
    content: docs/commands/external-integration-testing.md section; Jest command + display tests
    status: pending
  - id: validation-gates
    content: npm run build → npm run lint → npm test
    status: pending
isProject: false
---

# 143 — Builder CLI: `test-trust` (semantic / agent metadata validation)

## What this plan is


| Repo                             | Plan                                                                                                                                                                                                                    | Responsibility                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **aifabrix-dataplane**           | [404.0](../../aifabrix-dataplane/.cursor/plans/404.0-cip-datasource-metadata-agent-knowledge.plan.md) (epic), [404.5](../../aifabrix-dataplane/.cursor/plans/404.5-agent-metadata-validation-service.plan.md) (service) | `AgentMetadataValidationService`, persisted `agentValidation`, trust model, publish gate, admin APIs   |
| **aifabrix-builder** (this plan) | **143**                                                                                                                                                                                                                 | CLI commands, parameter parity with existing test commands, integrator-facing TTY/`--json`, debug logs |


**Status:** **Planning only — no implementation** until:

1. Dataplane **404.5** is approved and exposes a stable validate + read contract for builders.
2. This plan **143** is reviewed and approved.

## Problem

Integrators today can pass **local schema validation** (`aifabrix test`), **dataplane integration checks** (`test-integration`), and **live E2E** (`test-e2e`) without knowing whether **business metadata** (semantics, filters, dangerous ops, entity model) is **truthful enough for AI agents and publish**.

That gap is **layer B** in epic 404: semantic trust evidence (`agentValidation`), not connectivity or record counts.

**Goal for CLI output:** After a run, a developer must be able to answer in one screen:


| Question                                                        | Answered by                                                                      |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Did my **files** validate locally?                              | `aifabrix test` (not this command)                                               |
| Does the **dataplane** accept config + can it call the vendor?  | `test-integration` / `test-e2e` (not this command)                               |
| Is the **business metadata** fit to trust for agents / publish? | `**test-trust`** (this plan)                                                     |
| What is the **worst datasource** in a multi-DS system?          | System rollup table (this plan)                                                  |
| Can I **publish** under default v1 gate?                        | Trust line: `notTrusted` → blocked; `usableWithWarnings` → allowed with warnings |


Without deliberate UX, operators will confuse **E2E green** with **metadata trusted** — this plan forbids that by labeling each layer in the TTY header and footer.

## Command surface


| Command                                          | Scope                                                                                    | Dataplane                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `aifabrix test-trust <systemKey>`                | All datasources under `integration/<systemKey>/` (declaration order, same as `test-e2e`) | Per-datasource validate (+ optional latest read) |
| `aifabrix datasource test-trust <datasourceKey>` | One datasource                                                                           | Single validate                                  |


**Aliases:** Register under existing `datasource` / `ds` group like `test`, `test-integration`, `test-e2e`.

**Builder apps (`builder/<appKey>/`):** **Not supported.** Same pattern as external-only dataplane tests: if `detectAppType` resolves to `builder`, exit with a clear error directing the user to external integration paths (no container/local semantic agent).

**Local-only `aifabrix test`:** Unchanged. `**test-trust` never runs offline** — it always calls the dataplane (after optional `--sync`).

## How this relates to existing test commands

```text
integration/<systemKey>/
  │
  ├─ aifabrix test              → local files + schema (no dataplane semantic agent)
  ├─ aifabrix test-integration  → dataplane pipeline: integration health
  ├─ aifabrix test-e2e          → dataplane: live vendor + sync + CIP + data
  └─ aifabrix test-trust        → dataplane: AI semantic review of business metadata (404.5)
```


| Dimension                           | `test`                 | `test-integration`                    | `test-e2e`                               | `test-trust`                                                   |
| ----------------------------------- | ---------------------- | ------------------------------------- | ---------------------------------------- | -------------------------------------------------------------- |
| Runs on builder app                 | yes (container)        | yes (container)                       | yes (container)                          | **no**                                                         |
| Runs on external integration        | yes (local)            | yes (dataplane)                       | yes (dataplane)                          | **yes (dataplane)**                                            |
| Proves vendor connectivity          | no                     | partial                               | **yes**                                  | **no**                                                         |
| Proves business metadata for agents | no                     | no                                    | no                                       | **yes**                                                        |
| Default pre-publish upload          | no (`--sync` rejected) | optional `--sync`                     | publish by default (`--no-sync` to skip) | **same as test-e2e** (publish by default; `--no-sync` to skip) |
| Typical duration                    | seconds                | seconds–minutes                       | minutes                                  | seconds–minutes (agent call; cache hit faster)                 |
| Primary pass signal                 | `results.valid`        | `DatasourceTestRun` / rollup `status` | E2E steps + optional cert                | `**trustDecision`**                                            |


**Recommended integrator order (document in user docs):**

1. `aifabrix test <systemKey>` — fix manifest locally.
2. `aifabrix test-trust <systemKey>` — fix semantic gaps before expensive E2E.
3. `aifabrix test-integration` / `test-e2e` — prove runtime against vendor.

## Parameter parity (flags)

Parameters are **intentionally aligned** with existing commands so scripts can swap `test-e2e` → `test-trust` with minimal changes. Trust-specific flags are additive.

### Top-level `aifabrix test-trust <systemKey>`


| Flag                   | Source command              | Behavior for `test-trust`                                                                                                                                                                                    |
| ---------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `-e, --env <env>`      | test-e2e / test-integration | Environment for dataplane (`dev`, `tst`, `pro`). Default: same as test-e2e (implicit env when omitted on external — do not override auth/env unless user set `-e`).                                          |
| `-v, --verbose`        | all                         | Show `observedBusinessModel` summary, top findings, per-datasource detail in rollup.                                                                                                                         |
| `-d, --debug`          | all                         | Write `integration/<systemKey>/logs/test-trust-<datasourceKey>-<timestamp>.json` (sanitized; no secrets).                                                                                                    |
| `--no-sync`            | test-e2e                    | Skip upload before trust run; use config already on dataplane. **Default: publish local files first** (equivalent to test-e2e default). Deprecated/no-op `--sync` on test-e2e: **do not add** on test-trust. |
| `--warnings-as-errors` | test-e2e / test-integration | Exit **1** when any datasource has `trustDecision: usableWithWarnings` (treat warnings like publish strictness for CI).                                                                                      |
| `--json`               | datasource test*            | Print machine envelope to stdout (system rollup JSON). Suppress TTY.                                                                                                                                         |
| `--summary`            | datasource test*            | One-line rollup after run.                                                                                                                                                                                   |
| `--timeout <ms>`       | datasource test*            | POST + poll budget; **default `120000`** (agent slower than structural test).                                                                                                                                |
| `--no-cert-sync`       | test-e2e                    | **Not applicable v1** — omit from help (trust does not touch certification block).                                                                                                                           |
| `--require-cert`       | test-e2e                    | **Not applicable v1** — omit.                                                                                                                                                                                |


**Not carried from `test`:** `--sync` (rejected on local test) — trust uses test-e2e sync semantics only.

**Not carried from `test-e2e`:** `--min-vector-hits`, `--min-processed`, `--no-cleanup`, capability drill-down, `--no-async`, watch loop (defer watch to a follow-up if needed).

### `aifabrix datasource test-trust <datasourceKey>`

Reuse `**attachDatasourceTestCommonOptions`** from `[datasource-unified-test-cli.options.js](../lib/commands/datasource-unified-test-cli.options.js)` with:


| Option                              | Include   | Notes                                                                                              |
| ----------------------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| `-a, --app`                         | yes       | Same resolution as `datasource test-e2e`                                                           |
| `-e, --env`                         | yes       |                                                                                                    |
| `-v, --verbose`                     | yes       |                                                                                                    |
| `-d, --debug`                       | yes       | Log file prefix `test-trust-`                                                                      |
| `-p, --payload`                     | **no**    | Trust input is manifest-derived only (404.5 allowlist)                                             |
| `--timeout`                         | yes       | default `120000`                                                                                   |
| `--sync`                            | yes       | Upload before validate                                                                             |
| `--json` / `--summary`              | yes       |                                                                                                    |
| `--warnings-as-errors`              | yes       |                                                                                                    |
| `--no-cert-sync` / `--require-cert` | **no**    |                                                                                                    |
| `--no-async`                        | **no**    | Trust validate may async-poll on dataplane; always wait for terminal status (like system test-e2e) |
| watch flags                         | **no** v1 |                                                                                                    |


### Trust-only flags (both commands)


| Flag           | Purpose                                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--strict`     | Exit **1** unless every scope is `trustDecision: trusted` (maps to dataplane `strictAgentValidationGate` / 404.5 strict mode). Default gate: `notTrusted` only fails. |
| `--revalidate` | Force new agent run (`revalidate: true` on API); ignore `inputHash` cache hit.                                                                                        |


## Dataplane API contract (expected — owned by 404.5)

**Builder does not run the AI agent locally.** All semantic validation is dataplane-side.

Until 404.5 is implemented, builder work may use **mock fixtures** behind `AIFABRIX_AGENT_TRUST_MOCK=1` (optional dev-only; document in plan implementation, not user docs).

### Proposed operations (names subject to 404.5 final OpenAPI)


| Operation           | Purpose                                    | Builder usage                                                                      |
| ------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| **Validate** `POST` | Run or reuse validation for datasource key | `datasource test-trust`, each row of `test-trust`                                  |
| **Latest** `GET`    | Read last `agentValidation` without re-run | `test-trust --summary` fast path (optional v1.1); verbose may show cached vs fresh |


**Request body (validate)** — minimal builder payload:

```yaml
environment: dev | tst | pro
revalidate: boolean   # --revalidate
includeDebug: boolean # -d / debug level
```

**Response envelope (builder-facing)** — camelCase; stable for `--json` and TTY:

```yaml
# Working name: AgentTrustRun (align with DatasourceTestRun patterns)
datasourceKey: string
systemKey: string
status: ok | warn | fail | skipped   # CLI rollup helper (derived from trustDecision + transport)
agentValidation:
  validationStatus: pending | passed | warning | failed
  trustDecision: trusted | usableWithWarnings | notTrusted
  confidence: number
  summary: string
  validatedAt: string
  inputHash: string
  highLevelWarnings: string[]       # safe subset for operators
  contractVersion: string
  cacheHit: boolean                 # true when 404.5 reused hash
findings:                           # admin/verbose only; omit in --json unless -v
  - severity: info | warning | error
    code: string
    message: string
    field: string
    recommendation: string
observedBusinessModel:              # verbose only
  datasourcePurpose: string
  detectedEntity: string
  keyFields: string[]
  recommendedFilters: string[]
  dangerousOperations: string[]
  missingContext: string[]
meta:                               # optional cross-check lines for TTY
  lastTestIntegrationAt: string     # if dataplane can link prior runs (404.5+; else omit)
  lastTestE2eAt: string
  configInputHash: string
```

**Permissions:** Document `@requiresPermission` on new `lib/api` functions per [permissions-guide.md](../.cursor/rules/permissions-guide.md) once 404.5 defines required scopes (likely external-data-source write or dedicated validate permission).

**Version gate:** Reuse `[assertDataplaneCliVersionCompatible](../lib/utils/dataplane-cli-version-gate.js)` (plan 142) on all dataplane calls.

## Exit codes

Separate from E2E/cert matrix — trust uses `**trustDecision`** first.


| Code  | Meaning                                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** | All scopes: `trusted` or `usableWithWarnings` (and not `--warnings-as-errors` with warnings)                                                            |
| **1** | Any `notTrusted`, or `--strict` with any non-`trusted`, or `--warnings-as-errors` with any `usableWithWarnings`, or validate `validationStatus: failed` |
| **3** | Transport failure, auth failure, unparseable body, poll timeout (same convention as `datasource-test-run-exit.js` comment)                              |


System rollup: reuse `[computeSystemExitCodeFromDatasourceRows](../lib/utils/datasource-test-run-exit.js)` pattern but map each row’s synthetic `status` from `trustDecision`:


| `trustDecision`      | Row `status` for rollup |
| -------------------- | ----------------------- |
| `trusted`            | `ok`                    |
| `usableWithWarnings` | `warn`                  |
| `notTrusted`         | `fail`                  |


Then apply `--warnings-as-errors` / `--strict` on aggregated rollup.

## Output specification (TTY — `layout-blocks`)

Profile: `**layout-blocks`** + `cli-test-layout-chalk` (same family as `test-e2e`, `datasource test`). Register rows in [cli-output-command-matrix.md](../.cursor/rules/cli-output-command-matrix.md).

### Design principles

1. **Label the layer** — First line after title: `Semantic trust validation (agent metadata, not E2E)`.
2. **Show trust, not fake E2E** — Do not print capability step trees or sync counts unless dataplane embeds a short cross-reference in `meta` (optional).
3. **Reality panel** — Fixed trio so developers see what was *not* tested:
4. **Safe by default** — Do not print full `findings[].recommendation` in default TTY; one-line `highLevelWarnings` only. Verbose (`-v`) adds capped findings table (max 10) + `observedBusinessModel` bullets.
5. **Publish hint** — Footer line maps `trustDecision` to 404.5 v1 gate text (warning-only vs `--strict`).

### Datasource-level example (success with warnings)

```text
────────────────────────────────────────────────────────
  Semantic trust — hubspot-deals
  Environment: dev · System: hubspot
────────────────────────────────────────────────────────

  Layer checked: business metadata (404.5 agent validation)
  Not checked here: vendor connectivity, sync, record counts (use test-e2e)

  Trust: ⚠ usableWithWarnings · confidence 72% · passed (warning)
  Validated: 2026-05-18T14:02:11Z · inputHash 8f3a…c21 · cache: miss

  Summary
  Entity model mostly matches deals pipeline; two filter fields lack
  semantic descriptions agents can rely on.

  Warnings (high level)
  • FILTER_SEMANTICS_MISSING — exposed.filterable hs_dealstage without description
  • OPERATION_SEMANTICS_DERIVED — delete capability relies on derived x-ai-intent only

  ── Integration reality (informative) ──
  Local manifest:  uploaded (sync before run)
  E2E last run:    unknown (run aifabrix datasource test-e2e hubspot-deals -a hubspot)
  Publish gate:    allowed (warning-only); use --strict to require trusted

  Next actions
  • Add semantic.description on filterable fields (404.1 checklist)
  • Re-run: aifabrix datasource test-trust hubspot-deals -a hubspot -v
  • Full live proof: aifabrix datasource test-e2e hubspot-deals -a hubspot
────────────────────────────────────────────────────────
```

### Datasource-level example (not trusted)

```text
  Trust: ✖ notTrusted · confidence 41% · failed
  ...
  Warnings (high level)
  • ENTITY_MISMATCH — manifest entityType deal vs observed contact-centric model

  Publish gate:    blocked (trustDecision notTrusted)

  Next actions
  • Review findings with -v; fix manifest entityType / fieldMappings
  • Do not treat test-e2e success as metadata trust
```

### System-level `aifabrix test-trust <systemKey>`

Mirror `[external-system-system-test-tty.js](../lib/utils/external-system-system-test-tty.js)` rollup:

```text
────────────────────────────────────────────────────────
  Semantic trust — system hubspot (3 datasources)
────────────────────────────────────────────────────────

  System trust: ⚠ usableWithWarnings (worst-of rollup)

  Datasource                    Trust                  Conf.   Status
  ─────────────────────────────────────────────────────────────────
  hubspot-companies             ✔ trusted              91%    passed
  hubspot-contacts              ⚠ usableWithWarnings   68%    warning
  hubspot-deals                 ✖ notTrusted           41%    failed

  ── What this run proved ──
  ✔ Semantic metadata reviewed for 3 datasource(s) on dataplane
  ✖ Did not call HubSpot or run CIP (not E2E)

  Publish gate (warning-only):  blocked — 1 datasource notTrusted
  Fix hubspot-deals then re-run: aifabrix test-trust hubspot

  Next actions
  • aifabrix datasource test-trust hubspot-deals -a hubspot -v
  • After trust passes: aifabrix test-e2e hubspot
────────────────────────────────────────────────────────
```

### `--json` / `--summary`

- `**--json`:** Single object: `{ systemKey, environment, rollup: { trustDecision, confidence, status }, datasources: AgentTrustRun[] }` — no ANSI.
- `**--summary`:** `hubspot: trust=usableWithWarnings (2/3 trusted, 1 notTrusted) exit=1`

### Debug logs

- Path: `integration/<systemKey>/logs/test-trust-<datasourceKey>-<iso>.json`
- Contents: request metadata, full API response, **sanitized** (strip tokens; never write agent prompt text if returned by mistake — redact in builder before write per ISO rules).

## Implementation map (when approved)


| Area           | File(s)                                                                                        | Notes                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| API            | `lib/api/agent-metadata-validation.api.js`, `lib/api/types/agent-metadata-validation.types.js` | `@requiresPermission` per 404.5                                         |
| Datasource run | `lib/datasource/agent-trust-run.js`                                                            | resolve app, sync optional, POST validate, poll if async                |
| System fan-out | `lib/commands/test-trust-external.js`                                                          | clone ordering from `test-e2e-external.js`                              |
| CLI top-level  | `lib/cli/setup-app.test-trust-commands.js`                                                     | register `test-trust`; wire from `setup-app.js`                         |
| CLI datasource | extend `lib/commands/datasource-unified-test-cli.js` or `datasource-trust-cli.js`              | `test-trust` subcommand                                                 |
| Display        | `lib/utils/agent-trust-run-display.js`                                                         | TTY + summary; reuse `cli-test-layout-chalk`                            |
| Exit           | `lib/utils/agent-trust-run-exit.js`                                                            | trustDecision → exit code                                               |
| Help           | `lib/cli/setup-app.help.js` → `TEST_TRUST_HELP_AFTER`; `datasource-trust-help.js`              | cross-link test-e2e                                                     |
| Help index     | `lib/utils/help-builder.js`                                                                    | External Systems category                                               |
| Logs           | `lib/datasource/log-viewer.js`                                                                 | recognize `test-trust-` prefix (exclude from structural `test-` picker) |
| Docs           | `docs/commands/external-integration-testing.md`                                                | new § Semantic trust (`test-trust`)                                     |
| Tests          | `tests/lib/commands/test-trust*.test.js`, `tests/lib/utils/agent-trust-run-display.test.js`    | mock API; snapshot TTY lines                                            |


Keep each new file ≤500 lines, functions ≤50 lines (project rules).

## Rules and standards

Comply with [project-rules.mdc](../.cursor/rules/project-rules.mdc):


| Rule                                                                                        | Apply to 143                                          |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| CLI Command Development                                                                     | Commander, try/catch, `handleCommandError`            |
| [cli-layout.mdc](../.cursor/rules/cli-layout.mdc) + [layout.md](../.cursor/rules/layout.md) | layout-blocks, canonical glyphs ✔ ⚠ ✖                 |
| [cli-output-command-matrix.md](../.cursor/rules/cli-output-command-matrix.md)               | Add `test-trust` + `datasource test-trust` rows       |
| [docs-rules.mdc](../.cursor/rules/docs-rules.mdc)                                           | Command-centric docs; no HTTP tutorial                |
| API client pattern                                                                          | `lib/api/`* only (no raw `makeApiCall`)               |
| Security                                                                                    | No secrets in logs; no local agent with customer data |
| Quality gates                                                                               | `npm run build` → `npm run lint` → `npm test`         |


## Non-goals (v1)

- Running semantic validation inside **builder** container apps.
- Replacing `test`, `test-integration`, or `test-e2e`.
- Auto-applying `observedBusinessModel` to manifest (`aifabrix repair` automation) — human or explicit future command.
- Watch mode, certification sync, protection CLI coupling.
- Exposing validator prompts or raw LLM output in TTY/`--json`.
- Batch `test-trust` across multiple systems in one invocation.

## Before development

- Approve dataplane [404.5](../../aifabrix-dataplane/.cursor/plans/404.5-agent-metadata-validation-service.plan.md) — freeze endpoint paths and response schema (`AgentTrustRun` or reuse `DatasourceTestRun` extension).
- Approve this plan **143**.
- Read [cli-layout.mdc](../.cursor/rules/cli-layout.mdc), [datasource-unified-test-cli.options.js](../lib/commands/datasource-unified-test-cli.options.js), [test-e2e-external.js](../lib/commands/test-e2e-external.js).
- Confirm 142 version gate is active on dataplane calls.
- Add matrix rows before merging CLI registration.

## Definition of done

1. `aifabrix test-trust <systemKey>` and `aifabrix datasource test-trust <datasourceKey>` registered with flags in § Parameter parity.
2. TTY matches § Output specification (snapshot tests).
3. Exit codes match § Exit codes (unit tests).
4. Debug logs use `test-trust-` prefix and sanitization.
5. `docs/commands/external-integration-testing.md` explains layer vs test / test-integration / test-e2e.
6. `help-builder` lists commands under External Systems.
7. `npm run build` → `npm run lint` → `npm test` — zero lint errors; ≥80% coverage on new modules.

## Open questions (resolve before implementation)

1. Does 404.5 expose a **system-level** validate endpoint, or only per-datasource POST (builder fan-out only)?
2. Should default TTY include **last E2E/integration timestamps** from dataplane, or stay trust-only until linkage exists?
3. Is `POST` validate **synchronous** or poll-based (affects `--timeout` defaults and `--no-async` parity)?
4. CI recommendation: document `test-trust` before `test-e2e` in integration templates — who updates `integration/*/README.md` generator?
5. Should `--json` include full `findings` for automation, or require `-v` + separate admin API?

## Acceptance (plan approval checklist)

- Stakeholder agrees **trust ≠ E2E** messaging in TTY mockups.
- Parameter matrix signed off against `test` / `test-integration` / `test-e2e`.
- Dataplane 404.5 owner confirms response envelope fields for builder `--json`.
- No implementation PRs until both 404.5 and **143** are approved.

