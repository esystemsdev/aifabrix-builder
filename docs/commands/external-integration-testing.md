# External Integration Testing

← [Documentation index](../README.md) · [Commands index](README.md) · [External Integration Commands](external-integration.md)

Single source of truth for testing external integrations: unit tests (`aifabrix test`), dataplane structural validation (`aifabrix datasource test`), integration tests (`aifabrix test-integration` / `aifabrix datasource test-integration`), end-to-end tests (`aifabrix datasource test-e2e`), test payload configuration, list validation, and troubleshooting.

---

## Overview

Testing external integrations happens in several layers:

1. **Unit tests** (`aifabrix test <app>`) – Local validation with no API calls. Validates syntax, schemas, field mappings, metadata schemas, and relationships using test payloads from the datasource configuration.
2. **Integration tests** (`aifabrix test-integration <app>`) – For an external system folder, calls the dataplane for an **app-wide** integration rollup (small CLI surface: environment, verbosity, debug). Per-datasource payloads, timeouts, and machine modes live on **`aifabrix datasource test-integration <datasourceKey>`**. Validates field mappings, metadata schemas, endpoint connectivity, and ABAC dimensions as returned by the dataplane for that flow.
3. **End-to-end (E2E) tests** (`aifabrix datasource test-e2e <datasourceKey>`) – Full flow against real external systems: config validation, credential connectivity, sync execution, data persistence, and CIP simulation. Uses real credentials and real external APIs (e.g. HubSpot, SharePoint).
4. **Semantic trust** (`aifabrix verify-trust <systemKey>`; `aifabrix datasource verify-trust <datasourceKey>`) – Dataplane review of **business metadata** for AI agents (semantic fit, warnings, publish gate). Does **not** call external APIs or run CIP; use after local `test` and before or alongside E2E when you need trust evidence separate from connectivity.
5. **Governance acceptance** ([`aifabrix verify-governance <systemKey>`](governance-testing.md); alias `verify-governance`) – Prove **ABAC visibility** per subject user (sync record keys only). Default path uses scenario packs stored on the dataplane after `aifabrix upload`. Does **not** call vendor APIs and is **not** `test-e2e`. Requires baseline fixture load, identity sync, and `governance:evaluate` (see [Governance testing](governance-testing.md) and [Identity management](identity-management.md)).
6. **Enterprise AI Certification** – Product-facing verify commands and executive report ([full reference](enterprise-ai-certification.md)):
   - **`aifabrix verify-operations <systemKey>`** – Operational readiness (validate → test → test-integration → test-e2e). Flags: `-v`, `-d`, `--no-sync`, `--force`, `--json`.
   - **`aifabrix verify-trust <systemKey>`** – AI business context confidence. Flags: `-v`, `-d`, `--no-sync`, `--revalidate`, `--json`.
   - **`aifabrix verify-governance <systemKey>`** – Policy coverage and enforcement scenarios. Flags: `-v`, `--no-sync`, `--pack` (authoring override).
   - **`aifabrix lifecycle <systemKey>`** – Certification report (GET by default; **`--run`** to fill gaps). Flags: `-v`, `-d`, `--run`, `--no-sync`, `--force`, `--json`.

**Recommended certification order:** `upload` → `verify-operations` → `verify-trust` → `verify-governance` → `lifecycle`

**Advanced / debugging:** `validate`, `test`, `test-integration`, `test-e2e`, and per-datasource commands remain available for architects.

**Dataplane datasource validation (single key):** `aifabrix datasource test <datasourceKey>` runs the unified validation API with run type **test** (structural/policy on the dataplane). `aifabrix datasource test-integration` uses run type **integration** (richer integration checks). Both use the same deployment auth as `datasource test-e2e`. See [External Integration Commands – datasource test](external-integration.md#aifabrix-datasource-test-datasourcekey).

**When to use each:**

- **Unit tests:** Before deploying, validating configuration locally, or testing field mappings without network access. Run first; no login required.
- **Datasource test (dataplane):** After publish, when you want a fast dataplane-side validation report for one datasource key (CI-friendly with `--json`).
- **Integration tests:** After unit tests pass, when validating against the dataplane without calling external systems (app-level `test-integration` or per-datasource `datasource test-integration`). Requires login and dataplane access.
- **E2E tests:** When you need to verify the full integration flow—credentials, sync, and data landing—before production. Requires the datasource to be published, credentials configured, and the same authentication style as other datasource dataplane commands (see [External Integration Commands](external-integration.md#aifabrix-datasource-test-e2e-datasourcekey)).
- **Semantic trust:** When you need to know whether **agent-facing metadata** on the dataplane is trusted enough for agents and publish (not whether HubSpot/SharePoint APIs work). Requires login and dataplane access; publishes local integration files before the run unless you pass **`--no-sync`**.

**Prerequisites for integration tests:**

- Logged in: `aifabrix login`
- Dataplane accessible (URL discovered from controller)
- System published to dataplane (e.g. via `aifabrix upload <systemKey>`) or ready for testing

<a id="debug-output-datasource-commands"></a>
### Debug output (`datasource` commands)

For **`aifabrix datasource test`**, **`datasource test-integration`**, **`datasource test-e2e`**, and **`datasource verify-trust`**, debug logging can write JSON under **`integration/<systemKey>/logs/`** (prefixes **`test-`**, **`test-integration-`**, **`test-e2e-`**, **`verify-trust-`** respectively). Use **`datasource log-test`**, **`log-integration`**, **`log-e2e`**, or **`log-trust`** to print the latest matching log (each command only opens its own prefix; structural **`log-test`** ignores `test-e2e-`, `test-integration-`, and `verify-trust-` files). Use **`aifabrix datasource clean-logs`** (`--app` or `--all`, optional `--type`, `--dry-run`) to remove saved debug files locally.

For **`aifabrix datasource test`**, **`datasource test-integration`**, and **`datasource test-e2e`**, **`--debug`** accepts an optional **level**: **`summary`** (default when you pass `--debug` alone), **`full`**, or **`raw`**. The dataplane returns richer debug in the run result; the CLI prints an extra appendix after the normal human output (truncation, line caps, and basic redaction on **`raw`**). All three commands also write a timestamped JSON file under **`integration/<systemKey>/logs/`**—filename prefixes are **`test-`**, **`test-integration-`**, and **`test-e2e-`** respectively. Use **`aifabrix datasource log-test`** to open the latest structural **`test-*.json`** (see [External Integration Commands](external-integration.md#aifabrix-datasource-log-test-datasourcekey)). If you use **`--json`**, stdout is only the raw report JSON—no debug appendix.

App-wide **`aifabrix test-integration <app>`** (external system) only supports **`-d` / `--debug`** as a **boolean** (log files under **`integration/<systemKey>/logs/`** where applicable; no **`summary`** / **`full`** / **`raw`** levels on that top-level command).

<a id="watch-mode-datasource-commands"></a>
### Watch mode (`datasource` commands)

For **`aifabrix datasource test`**, **`datasource test-integration`**, and **`datasource test-e2e`**, you can add **`--watch`** so the CLI runs the same validation again when relevant files on disk change—useful while editing datasource JSON or integration config.

**What is watched:** By default, the CLI watches the resolved integration app folder (the same folder **`--app`** would point to, or the folder inferred from your current working directory or datasource key). Optional **`--watch-path <path>`** (repeatable) adds another file or directory. **`--watch-application-yaml`** ensures **`integration/<app>/application.yaml`** is part of the watch set (it is usually already under the integration tree).

**Behavior:** The first run behaves like a normal invocation (same exit codes and output modes). After that, file-change events are **debounced** (about half a second) so rapid saves trigger a single re-run. When the validation **report fingerprint** changes (overall status, certificate status, and per-capability statuses), the CLI prints a short **watch diff** line; use **`--watch-full-diff`** for a two-line before/after fingerprint. **`--watch-ci`** runs **once** and then exits with the usual exit code—handy in scripts that only need a single run but want the same watch-oriented output. Without **`--watch-ci`**, the process keeps waiting; stop with **Ctrl+C** (exit **130**).

**Not covered:** Watch mode only reacts to local filesystem changes. It does not replace publishing to the dataplane; if your workflow requires an upload before the server sees new config, run **`aifabrix upload`** (or your usual publish step) separately.

---

## Unit tests (`aifabrix test`)

<a id="unit-tests-aifabrix-test"></a>

### What is validated

- **Syntax** – JSON/YAML parsing and structure
- **Schemas** – External system and datasource files against `external-system.schema.json` and `external-datasource.schema.json`
- **Field mappings** – Expression syntax (e.g. `{{path.to.field}} | toUpper | trim`), path wrapping in `{{}}`, transformation names, pipe separator
- **Metadata schema** – Validated against the test payload when `testPayload.payloadTemplate` is present
- **Relationships** – systemKey matches, entityKey consistency
- **Expected result** – If `testPayload.expectedResult` is provided, unit tests compare the transformed output to it

### How test payloads are used

Unit tests use the **datasource** `testPayload.payloadTemplate` (and optional `expectedResult`):

- If `testPayload.payloadTemplate` exists: metadata schema is validated against it, and field mapping expressions are run with a mock transformer (no real API calls). If `expectedResult` is set, the transformed result is compared to it.
- If no test payload is configured: schema and syntax are still validated; field mapping and metadata schema checks are skipped for that datasource.

### Options

- `-e, --env <env>` – Optional environment label for external runs
- `-v, --verbose` – Show detailed validation output
- `-d, --debug` – Write a JSON debug log under `integration/<systemKey>/logs/` when the run succeeds

### Example commands

```bash
aifabrix test hubspot
aifabrix test hubspot -v
aifabrix test hubspot -e tst -d
```

### CLI output

The command prints a structured summary (files checked, per-datasource results, and errors when validation fails). Exact wording and layout change between CLI versions; rerun with `-v` for more detail or inspect the debug JSON when `-d` is enabled.

### Troubleshooting

- **"App name is required"** – Provide the application name as argument.
- **"Application not found"** – Ensure the app exists in `integration/<systemKey>/` (external) or `builder/<appKey>/` (normal app).
- **"Validation failed"** – Fix errors reported in the test output (syntax, schema, or field mapping).
- **"Test payload not found"** – Add a `testPayload` block to the datasource configuration, or run **`aifabrix datasource test-integration <datasourceKey>`** with **`--payload <file>`** when you need an explicit payload override. For full test payload configuration, see [Test payload configuration](#test-payload-configuration).
- **"Field mapping expression invalid"** – Use valid syntax: `{{path}} | transformation`; ensure path is wrapped in `{{}}` and transformation names are supported (e.g. toUpper, toLower, trim, default, toNumber).

**Next steps:** Fix any validation errors, then run integration tests: `aifabrix test-integration <app>`.

---

## Integration tests (`aifabrix test-integration`)

<a id="integration-tests-aifabrix-test-integration"></a>

### What is validated

- **Dataplane integration run** – The dataplane receives the payload and runs the integration validation flow
- **Field mappings** – Applied against the supplied payload; results reported (e.g. mapped field count)
- **Metadata schema** – Validated against the payload
- **Endpoint connectivity** – Whether the configured endpoint is reachable
- **ABAC dimensions** – Online validation against the Dimension Catalog (when applicable)

### Where payloads come from

1. **Datasource** – `testPayload.payloadTemplate` from the datasource configuration (same as unit tests)
2. **Custom file** – On **`aifabrix datasource test-integration <datasourceKey>`**, **`--payload <file>`** overrides the datasource test payload for that run. File format: a single payload object (JSON or YAML) matching the API response shape. The app-wide **`aifabrix test-integration <app>`** command does not take **`--payload`** in the CLI today—use the datasource command when you need an explicit file.

### Options (app-wide `aifabrix test-integration <app>`)

- `-e, --env <env>` – Environment for the dataplane run (dev, tst, pro)
- `-v, --verbose` – More detailed test output
- `-d, --debug` – Write diagnostic material to `integration/<systemKey>/logs/` where applicable (boolean flag; no **`summary`** / **`full`** / **`raw`** levels on this command)

Per-datasource **`--payload`**, **`--timeout`**, **`--json`**, and related controls belong on **`aifabrix datasource test-integration <datasourceKey>`** (see [Datasource integration tests](#datasource-integration-tests)).

### Process

1. Resolve dataplane URL from controller (uses `config.yaml` controller and environment).
2. Run the app-wide integration validation flow (rollup across datasources for that system).
3. Display aggregated results.

### Example commands

```bash
aifabrix test-integration hubspot
aifabrix test-integration hubspot --env tst
aifabrix test-integration hubspot -v
aifabrix test-integration hubspot --debug
```

### CLI output

The CLI prints progress hints (for example authentication and dataplane discovery) and a per-datasource or rollup summary depending on implementation. Exact banners, icons, and ordering change between releases; use **`aifabrix datasource test-integration`** with **`--json`** when you need stable, scriptable output for a single datasource key.

### Troubleshooting

- **"App name is required"** – Provide the application name as argument.
- **"Not logged in"** – Run `aifabrix login` first.
- **"Dataplane URL not found"** – Check controller configuration and that the controller can provide a dataplane URL.
- **"Test payload not found"** – Add `testPayload` to the datasource configuration or use `--payload <file>`. See [Test payload configuration](#test-payload-configuration).
- **"API call failed"** – Check dataplane URL, authentication, and network.
- **"Request timeout"** – For datasource-scoped runs, increase the aggregate budget with **`aifabrix datasource test-integration … --timeout <ms>`**; the app-wide command does not expose `--timeout` in the CLI today.
- **"Validation failed"** – Fix errors reported in the output (payload shape, field mappings, or metadata schema). Check permissions for dataplane validation runs (see [Online Commands and Permissions](permissions.md)).

**Next steps:** Fix validation or connectivity errors, re-run unit tests if you changed config, then deploy: `aifabrix deploy <app>`.

**Retry logic:** The command retries transient API failures (e.g. network errors, timeouts, 5xx) with exponential backoff (up to 3 retries).

---

## Datasource integration tests (`aifabrix datasource test-integration`)

<a id="datasource-integration-tests"></a>

Test **one** datasource via the dataplane unified validation API (integration run type) without running tests for the whole system. Useful in CI or when iterating on a single datasource.

**Command:**

```bash
aifabrix datasource test-integration <datasourceKey> [options]
```

**Context:** Resolve `systemKey` from `--app <app>` or from the current directory when inside `integration/<systemKey>/`.

**Options:** `-a, --app <app>`, `-p, --payload <file>`, `-e, --env <env>`, `-v, --verbose`, `--debug [level]`, `--timeout <ms>`, `--json`, `--summary`, `--warnings-as-errors`, `--require-cert`.

**Auth:** Deployment auth from `aifabrix login`, cached client token, or client credentials exchanged for an app token (CI/CD)—same path as `aifabrix datasource test-e2e`.

**Example:**

```bash
cd integration/hubspot
aifabrix datasource test-integration hubspot-company

# Or with explicit app
aifabrix datasource test-integration hubspot-company --app hubspot --debug
```

---

## Datasource E2E tests (`aifabrix datasource test-e2e`)

<a id="datasource-e2e-tests"></a>

Run a full end-to-end test for **one** datasource: the dataplane runs config validation, credential check, sync job, data verification, and CIP simulation in order. E2E tests call **real external systems** (e.g. HubSpot, SharePoint) and use **real credentials**—use test environments and test credentials, not production.

### When to use E2E

- Verify that your datasource works end-to-end against the external system.
- Test credential connectivity before going to production.
- Confirm sync runs and data lands in the database as expected.
- Validate CIP simulation (list/get) with your field mappings.

### What the E2E test does (steps)

The dataplane runs these steps in sequence. All run by default; you can interpret the output to see which step failed.

| Step       | What it does (user terms)                                                                 |
|------------|-------------------------------------------------------------------------------------------|
| Config     | Validates payload against metadata schema and field mappings (no external calls).         |
| Credential | Tests that the configured credential can connect to the external API (e.g. OAuth/token).  |
| Sync       | Creates and runs a sync job, then waits until it completes.                               |
| Data       | Checks that records or documents are stored and (where applicable) vectorized.            |
| CIP        | Runs list/get with capacity input to exercise the CIP pipeline.                           |

Run the command, inspect the response (and optional debug log), fix configuration or credentials if a step fails, then run again until all steps pass.

### Prerequisites

- **Authentication** – Same as `aifabrix datasource test-integration`: use `aifabrix login`, or configure the integration app’s client credentials so the CLI can exchange them for a deployment token used against the dataplane.
- **External system and datasource published** to the dataplane (e.g. via deploy/publish flow).
- **Credential configured** for the external system (or datasource override) with access to the external API.

### Async flow and polling

By default the command starts the E2E run asynchronously, then polls the dataplane until the run completes or fails. This is recommended for long-running tests. Use `-v` to see progress (e.g. how many steps have completed so far). For short runs or when you prefer a single request/response, use `--no-async` (sync mode).

The same unified flow is used for **`datasource test`** and **`datasource test-integration`** when async polling applies. Transient connection errors on the first request or on **poll** requests (e.g. reset/timeout) are retried a few times with short backoff; HTTP error responses are not retried.

**Command:**

```bash
aifabrix datasource test-e2e <datasourceKey> [capabilityKey] [options]
```

**Options:** `-a, --app <app>`, `-e, --env <env>`, `-v, --verbose`, `-d, --debug [level]`, `--no-run-scenarios`, `--no-cleanup`, `--primary-key-value <value|@path>`, `--no-async`, `--timeout <ms>`, positional **`[capabilityKey]`**, `--strict-capability-scope`, `--json`, `--summary`, `--warnings-as-errors`, `--require-cert`.

**Option details:**
- **Capacity / CRUD** – The dataplane merges request options with each datasource’s `testPayload` (`payloadTemplate`, `primaryKey`, `scenarios`). When capabilities and fixtures align, the capacity step runs list/get/create/update/delete without extra flags. Use **`--no-run-scenarios`** to skip expanding `testPayload.scenarios` and use the default capacity path only.
- **`--no-cleanup`** – Do not delete the created/test record at the end; leave it for inspection.
- **`--primary-key-value <value|@path>`** – Primary key of an existing record. When set, the dataplane can fetch that record and use it as the payload template for create (no separate payload template needed). For composite keys, use a JSON file path (e.g. `@pk.json`).
- **`--debug [level]`** – Richer debug from the dataplane, optional appendix on the terminal, and (for this command) a log file under **`integration/<systemKey>/logs/`**. Levels: **`summary`** (default), **`full`**, **`raw`** (see [Debug output](#debug-output-datasource-commands)). Omit the appendix with **`--json`**.
- **`--timeout <ms>`** – Aggregate time budget for the run request and any polling (default fifteen minutes in the CLI).
- **`[capabilityKey]`** (positional) – Ask the dataplane to focus the run on one capability when that contract is supported. Human output (default TTY and **`--summary`**) highlights **that** capability’s status and any per-capability E2E steps when the report includes them. If the report still lists **more than one** capability row, the CLI prints a **warning** to stderr; use **`--strict-capability-scope`** to exit with status **1** in that case.
- **`--strict-capability-scope`** – When a capability drill-down is requested, fail the process when the envelope lists multiple capability rows (client contract check).
- **`--json` / `--summary` / `--warnings-as-errors` / `--require-cert`** – Machine-oriented output and stricter exit codes; see `aifabrix datasource test-e2e --help`.
- **`--verify-audit`** – After a **successful** E2E, validate the nine-row **audit evidence matrix** on the dataplane (RBAC/ABAC capture for the run). Requires **`audit:read`** on your role in addition to the usual E2E scopes. Use **`--no-verify-audit`** to skip. Optional **`--audit-poll-ms`** / **`--audit-poll-interval-ms`** control how long the CLI waits for audit rows to appear after the run finishes.

**Datasource config – primaryKey:** The datasource configuration must include `primaryKey` (required by the schema). It is an array of normalized attribute names (e.g. `["id"]` or `["externalId"]`) used for CRUD operations and table indexing. Validation fails if `primaryKey` is missing.

**Example:**

```bash
aifabrix datasource test-e2e hubspot-contacts --app hubspot --verbose

# Sync mode (no polling)
aifabrix datasource test-e2e hubspot-contacts --app hubspot --no-async

# Optional single-capability scope (positional)
aifabrix datasource test-e2e hubspot-contacts --app hubspot read

# E2E plus audit evidence proof (opt-in; requires audit:read)
aifabrix datasource test-e2e hubspot-contacts --app hubspot --sync --verify-audit -v
```

## Audit evidence verification (`aifabrix datasource verify-audit`)

After a green E2E, integrators often need proof that **governance audit rows** exist on the dataplane (RBAC/ABAC capture, per-execution traces)—not only that the external API call succeeded. **`--verify-audit`** on `datasource test-e2e` runs this check in the same process. **`datasource verify-audit`** re-runs the same matrix **without** calling the external vendor again.

**When to use:**

- CI gates after E2E: connectivity plus audit evidence in one exit code.
- Re-check audit rows after a dataplane upgrade using the latest `test-e2e` debug log.
- Debug “E2E passed but Logs tab is empty” by failing fast with row-level reasons.

**Prerequisites:**

- Logged in with a role that includes **`audit:read`** (see [Permissions](permissions.md)).
- Dataplane environment with audit evidence capture enabled for validation runs.
- For log-based runs: a prior **`datasource test-e2e --debug`** (or pass **`--correlation-id`** / **`--execution-id`** explicitly).

**Command:**

```bash
aifabrix datasource verify-audit <datasourceKey> [options]
```

**Options:** `-a, --app`, `-e, --env`, `-v, --verbose`, `--json`, `-f, --file <path>`, `--correlation-id`, `--execution-id`, `--audit-poll-ms`, `--audit-poll-interval-ms`.

**Exit codes:** `0` matrix passed; `1` matrix or missing ids failed; `3` auth/unreachable/invalid inputs.

**Matrix (nine rows):** executions list (captured RBAC/ABAC), global rbac-decisions and abac-traces lists, per-execution rbac/abac/errors/steps, correlation grouping, distinct traces per execution. Skipped governance capture counts as **pass** (not enforcement deny).

### Troubleshooting E2E

- **Datasource not found** – Wrong datasource key or the datasource is not published to the dataplane. Publish the system/datasource and use the correct key.
- **Permission denied** – Check dataplane RBAC for the token you use (same as other datasource commands). Run `aifabrix login` or fix app credentials in secrets.
- **Credential step fails** – The external credential is invalid or expired. Check the credential in your deploy manifest or credential store; refresh OAuth tokens if needed.
- **Sync step fails** – Often credential or external API related. Check the step message and evidence in the output; verify external system credentials and connectivity.
- **Config step fails (e.g. payload)** – If you omit a payload and the datasource has no test payload in config, validation may fail. Configure a test payload when publishing or supply one as appropriate for your run.

### Data safety

E2E tests use real external systems and credentials.

- Use **test credentials** and **test environments** (for example HubSpot dev portal, SharePoint test site).
- Avoid production data.
- Prefer isolated CI environments when possible.

### Fixture round-trips (load / export)

After E2E or manual seeding, use **`aifabrix datasource load`** and **`aifabrix datasource export`** to import or export local JSON/NDJSON fixtures under `integration/.data/`. See [Datasource commands – load and export](external-integration/datasources.md#aifabrix-datasource-load-datasourcekey).

---

## Semantic trust (`aifabrix verify-trust`)

<a id="semantic-trust-aifabrix-verify-trust"></a>

### What this layer checks

Semantic trust answers whether **business metadata** on the dataplane is fit for **AI agents and publish**, not whether your laptop can parse JSON or whether a vendor API accepts credentials.

| Layer | Command | Proves |
| ----- | ------- | ------ |
| Local structure | `aifabrix test` | Files and schemas on disk |
| Dataplane integration | `test-integration` | Dataplane accepts config; integration checks |
| Live external proof | `datasource test-e2e` | Credentials, sync, records, CIP |
| **Semantic trust** | **`verify-trust`** | Agent metadata validation and trust decision on the dataplane |

**Default publish gate (informative):** `notTrusted` blocks publish; `usableWithWarnings` is allowed with warnings; use **`--strict`** on the CLI to require `trusted` for exit code 0.

### Commands

```bash
# All datasources under integration/<systemKey>/ (declaration order, same as test-e2e)
aifabrix verify-trust hubspot
aifabrix verify-trust hubspot -v --revalidate
aifabrix verify-trust hubspot --no-sync

# Single datasource
aifabrix datasource verify-trust hubspot-companies --app hubspot -v
```

### Options (aligned with other test commands)

Shared with **`test-e2e`** where applicable: **`-a, --app`**, **`-e, --env`**, **`-v, --verbose`**, **`-d, --debug`**, **`--no-sync`**, **`--json`**, **`--summary`**.

Trust-specific:

- **`--revalidate`** – Force a fresh validation run on the dataplane (do not rely only on cached latest).
- **`--strict`** – Exit with status **1** unless trust decision is **`trusted`** (default allows `usableWithWarnings`).
- **`--warnings-as-errors`** – Treat `usableWithWarnings` like a failure for exit code purposes.
- **`--timeout <ms>`** – HTTP timeout for validate/latest requests (default **120000** on both top-level and datasource commands).
- **`--summary`** – Compact output; when **`--revalidate`** is omitted, the CLI reads the latest stored validation from the dataplane first (falls back to a new run if none exists).

### Prerequisites

- Logged in: `aifabrix login`
- Dataplane reachable (URL from controller, same as other datasource commands)
- Integration folder under **`integration/<systemKey>/`** with datasources declared like **`test-e2e`**

Unless **`--no-sync`** is set, the CLI **uploads local integration files** before each trust run so the dataplane evaluates what is on disk.

### Recommended order

1. `aifabrix test <systemKey>` — fix local structure.
2. `aifabrix verify-trust <systemKey>` — fix semantic metadata gaps cheaply.
3. `aifabrix datasource test-e2e <datasourceKey>` — prove live external behavior.

### Troubleshooting

- **External system only** — `verify-trust` applies to **`integration/<systemKey>/`** external apps, not generic builder apps.
- **Confused with E2E green** — E2E success does not imply semantic trust; run **`verify-trust`** when agent metadata matters.
- **Stale dataplane config** — Omit **`--no-sync`** so local files upload first, or publish manually then use **`--no-sync`**.
- **Strict CI failure** — Drop **`--strict`** for warning-only gates, or fix findings until decision is **`trusted`**.

---

## Test payload configuration

<a id="test-payload-configuration"></a>

### Current format

Test payloads are configured in the **datasource** (YAML or JSON) with a `testPayload` object:

- **`payloadTemplate`** – Required. Sample payload that matches the expected API response structure. Used for field mapping and metadata schema validation.
- **`expectedResult`** – Optional. Expected normalized result after field mapping. Used only in **unit tests** for comparison.

### Inline example (YAML)

Trimmed `recordStorage` datasource showing `testPayload` only; a full file also needs `metadataSchema`, `primaryKey`, `labelKey`, `dimensions`, and `execution` per `external-datasource.schema.json`.

```yaml
key: hubspot-company
displayName: HubSpot Company
systemKey: hubspot
entityType: recordStorage
resourceType: company
primaryKey: [externalId]
labelKey: [name]
metadataSchema:
  type: object
  properties:
    externalId: { type: string, index: true }
    name: { type: string, index: true }
    country: { type: string, index: true }
dimensions:
  country:
    type: local
    field: country
    actor: userId
    operator: eq
fieldMappings:
  attributes:
    externalId:
      expression: "{{raw.id}}"
    name:
      expression: "{{raw.properties.name.value}} | trim"
    country:
      expression: "{{raw.properties.country.value}} | toUpper | trim"
testPayload:
  payloadTemplate:
    id: "1"
    properties:
      name:
        value: Acme Corp
      country:
        value: us
  expectedResult:
    externalId: "1"
    name: Acme Corp
    country: US
```

The payload must match the API response shape your field mappings expect (use `raw.*` roots in expressions; paths must resolve against `payloadTemplate`).

### Custom file (integration tests only)

Use `--payload <file>` to supply a single payload object from a file (JSON or YAML). The file should contain one object that matches the same shape as above (e.g. a single item or wrapper your mappings expect). This overrides the datasource `testPayload.payloadTemplate` for that run.

### Future

Planned improvements (to be documented when implemented): test payloads as an array (one per scenario), one entry per capability (list/get/create/update/delete), and/or separate test files in a `tests/` folder (e.g. `tests/<datasource-filename>.yaml`) with the same name as the datasource file.

---

## Validating list responses

<a id="validating-list-responses"></a>

List APIs often return an array or a wrapper like `{ results: [...] }`. Current validators assume a **single object** payload.

**Recommendation for now:** Use a single representative item in `payloadTemplate` for list-style APIs—e.g. the first element of the array or a single item from `results`. That way field mappings and metadata schema are validated against one item.

**Future:** Support for list-shaped payloads (array or wrapper key) and validating each item against the schema and field mappings may be added later.

---

## Capabilities

Datasources declare **capabilities** (e.g. list, get, create, update, delete). Today, tests use **one payload per datasource**; the same `testPayload` is used regardless of capability.

**Future:** The design may tie test cases to capability (e.g. different payloads per operation—create vs update vs delete). The new testing doc will be updated when that is implemented.

---

## See also

- [External Integration Commands](external-integration.md) – Command reference for `aifabrix test`, `aifabrix test-integration`, `aifabrix datasource test-integration`, `aifabrix datasource test-e2e`, and related commands
- [Validation Commands](validation.md) – General validation, schemas, and `aifabrix validate`
- [Governance testing](governance-testing.md) – `verify-governance` and scenario packs
- [Enterprise AI Certification](enterprise-ai-certification.md) – `verify-operations`, `verify-trust`, `verify-governance`, `lifecycle`
- [Identity management](identity-management.md) – Users, groups, and dataplane identity sync before governance runs
- [Protection](protection.md) – Protection manifests and upload before governed fixture load
- [Permissions](permissions.md) – Scopes for test, E2E, trust, governance, and audit verification
- [External Systems Guide](../external-systems.md) – External system configuration overview (test payload detail is in this document only)
