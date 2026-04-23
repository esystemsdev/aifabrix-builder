# External Integration Testing

← [Documentation index](../README.md) · [Commands index](README.md) · [External Integration Commands](external-integration.md)

Single source of truth for testing external integrations: unit tests (`aifabrix test`), dataplane structural validation (`aifabrix datasource test`), integration tests (`aifabrix test-integration` / `aifabrix datasource test-integration`), end-to-end tests (`aifabrix datasource test-e2e`), test payload configuration, list validation, and troubleshooting.

---

## Overview

Testing external integrations happens in three tiers:

1. **Unit tests** (`aifabrix test <app>`) – Local validation with no API calls. Validates syntax, schemas, field mappings, metadata schemas, and relationships using test payloads from the datasource configuration.
2. **Integration tests** (`aifabrix test-integration <app>`) – For an external system folder, calls the dataplane for an **app-wide** integration rollup (small CLI surface: environment, verbosity, debug). Per-datasource payloads, timeouts, and machine modes live on **`aifabrix datasource test-integration <datasourceKey>`**. Validates field mappings, metadata schemas, endpoint connectivity, and ABAC dimensions as returned by the dataplane for that flow.
3. **End-to-end (E2E) tests** (`aifabrix datasource test-e2e <datasourceKey>`) – Full flow against real external systems: config validation, credential connectivity, sync execution, data persistence, and CIP simulation. Uses real credentials and real external APIs (e.g. HubSpot, SharePoint).

**Dataplane datasource validation (single key):** `aifabrix datasource test <datasourceKey>` runs the unified validation API with run type **test** (structural/policy on the dataplane). `aifabrix datasource test-integration` uses run type **integration** (richer integration checks). Both use the same deployment auth as `datasource test-e2e`. See [External Integration Commands – datasource test](external-integration.md#aifabrix-datasource-test-datasourcekey).

**When to use each:**

- **Unit tests:** Before deploying, validating configuration locally, or testing field mappings without network access. Run first; no login required.
- **Datasource test (dataplane):** After publish, when you want a fast dataplane-side validation report for one datasource key (CI-friendly with `--json`).
- **Integration tests:** After unit tests pass, when validating against the dataplane without calling external systems (app-level `test-integration` or per-datasource `datasource test-integration`). Requires login and dataplane access.
- **E2E tests:** When you need to verify the full integration flow—credentials, sync, and data landing—before production. Requires the datasource to be published, credentials configured, and the same authentication style as other datasource dataplane commands (see [External Integration Commands](external-integration.md#aifabrix-datasource-test-e2e-datasourcekey)).

**Prerequisites for integration tests:**

- Logged in: `aifabrix login`
- Dataplane accessible (URL discovered from controller)
- System published to dataplane (e.g. via `aifabrix upload <systemKey>`) or ready for testing

<a id="debug-output-datasource-commands"></a>
### Debug output (`datasource` commands)

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

- **Pipeline test API** – Dataplane endpoint receives the payload and runs the pipeline test flow
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

| Step   | What it does (user terms) |
|--------|---------------------------|
| Config | Validates payload against metadata schema and field mappings (no external calls). |
| Credential | Tests that the configured credential can connect to the external API (e.g. OAuth/token). |
| Sync   | Creates and runs a sync job, then waits until it completes. |
| Data   | Checks that records or documents are stored and (where applicable) vectorized. |
| CIP    | Runs list/get with capacity input to exercise the CIP pipeline. |

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

**Options:** `-a, --app <app>`, `-e, --env <env>`, `-v, --verbose`, `-d, --debug [level]`, `--test-crud`, `--record-id <id>`, `--no-cleanup`, `--primary-key-value <value|@path>`, `--no-async`, `--timeout <ms>`, positional **`[capabilityKey]`** (preferred) or deprecated **`--capability <key>`**, `--strict-capability-scope`, `--json`, `--summary`, `--warnings-as-errors`, `--require-cert`.

**Option details:**
- **`--test-crud`** – Enable full CRUD lifecycle test (create → get → update → delete) when the datasource supports it.
- **`--record-id <id>`** – Use this record ID for get/update/delete when create is not supported or when targeting a specific record for CRUD.
- **`--no-cleanup`** – Do not delete the created/test record at the end; leave it for inspection.
- **`--primary-key-value <value|@path>`** – Primary key of an existing record. When set, the dataplane can fetch that record and use it as the payload template for create (no separate payload template needed). For composite keys, use a JSON file path (e.g. `@pk.json`).
- **`--debug [level]`** – Richer debug from the dataplane, optional appendix on the terminal, and (for this command) a log file under **`integration/<systemKey>/logs/`**. Levels: **`summary`** (default), **`full`**, **`raw`** (see [Debug output](#debug-output-datasource-commands)). Omit the appendix with **`--json`**.
- **`--timeout <ms>`** – Aggregate time budget for the POST and any polling (default fifteen minutes in the CLI).
- **`[capabilityKey]`** (positional) – Ask the dataplane to focus the run on one capability when that contract is supported. Human output (default TTY and **`--summary`**) highlights **that** capability’s status and any per-capability E2E steps when the report includes them. If the report still lists **more than one** capability row, the CLI prints a **warning** to stderr; use **`--strict-capability-scope`** to exit with status **1** in that case (plan §2.3).
- **`--capability <key>`** – Deprecated alias for the positional **`[capabilityKey]`**; if both are provided and differ, the positional value wins and the CLI warns.
- **`--strict-capability-scope`** – When a capability drill-down is requested, fail the process when the envelope lists multiple capability rows (client contract check).
- **`--json` / `--summary` / `--warnings-as-errors` / `--require-cert`** – Machine-oriented output and stricter exit codes; see `aifabrix datasource test-e2e --help`.

**Datasource config – primaryKey:** The datasource configuration must include `primaryKey` (required by the schema). It is an array of normalized attribute names (e.g. `["id"]` or `["externalId"]`) used for CRUD operations and table indexing. Validation fails if `primaryKey` is missing.

**Example:**
```bash
aifabrix datasource test-e2e hubspot-contacts --app hubspot --verbose

# Sync mode (no polling)
aifabrix datasource test-e2e hubspot-contacts --app hubspot --no-async

# Optional single-capability scope (positional)
aifabrix datasource test-e2e hubspot-contacts --app hubspot read
```

### Troubleshooting E2E

- **Datasource not found** – Wrong datasource key or the datasource is not published to the dataplane. Publish the system/datasource and use the correct key.
- **Permission denied** – Check dataplane RBAC for the token you use (same as other datasource commands). Run `aifabrix login` or fix app credentials in secrets.
- **Credential step fails** – The external credential is invalid or expired. Check the credential in your deploy manifest or credential store; refresh OAuth tokens if needed.
- **Sync step fails** – Often credential or external API related. Check the step message and evidence in the output; verify external system credentials and connectivity.
- **Config step fails (e.g. payload)** – If you omit a payload and the datasource has no test payload in config, validation may fail. Configure a test payload when publishing or supply one as appropriate for your run.

### Data safety

E2E tests use real external systems and credentials. Prefer:

- **Test credentials** and **test environments** (e.g. HubSpot dev portal, SharePoint test site).
- Avoid production data.
- Run in isolated CI environments when possible.

---

## Test payload configuration

<a id="test-payload-configuration"></a>

### Current format

Test payloads are configured in the **datasource** (YAML or JSON) with a `testPayload` object:

- **`payloadTemplate`** – Required. Sample payload that matches the expected API response structure. Used for field mapping and metadata schema validation.
- **`expectedResult`** – Optional. Expected normalized result after field mapping. Used only in **unit tests** for comparison.

### Inline example (YAML)

```yaml
key: hubspot-company
systemKey: hubspot
entityType: recordStorage
fieldMappings:
  dimensions:
    country: metadata.country
  attributes:
    name:
      expression: "{{properties.name.value}} | trim"
      type: string
      indexed: false
    country:
      expression: "{{properties.country.value}} | toUpper | trim"
      type: string
      indexed: false
testPayload:
  payloadTemplate:
    properties:
      name:
        value: Acme Corp
      country:
        value: us
  expectedResult:
    name: Acme Corp
    country: US
```

The payload must match the API response shape your field mappings expect (paths in expressions must resolve against `payloadTemplate`).

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
- [External Systems Guide](../external-systems.md) – External system configuration and test payload overview (including [Test Payloads](../external-systems.md#test-payloads))
