# External Integration: Datasource Commands

← [Documentation index](../../README.md) · [Commands index](../README.md) · [External integration](../external-integration.md)

Datasource commands manage external datasource configurations: validation, listing, comparison, publish, testing, and log viewing.

For end-to-end testing details and payload troubleshooting, see [External Integration Testing](../external-integration-testing.md).

---

<a id="aifabrix-datasource"></a>
## aifabrix datasource

Manage external data sources.

**What:** Command group for managing external datasource configurations. You can use `ds` as a shorthand: `aifabrix ds` is equivalent to `aifabrix datasource`.

**When:** Use these commands when you want to validate/publish/test a single datasource without re-uploading the entire external system.

**Subcommands:**
- `validate` - Validate external datasource YAML/JSON file (offline)
- `list` - List datasources from the environment
- `diff` - Compare two datasource configuration files
- `upload` - Publish one datasource to the dataplane (by file path or datasource key)
- `test` - Run structural/policy validation for one datasource key on the dataplane
- `test-integration` - Run integration validation for one datasource key on the dataplane
- `test-e2e` - Run E2E validation for one datasource key on the dataplane
- `load` - Import local JSON/NDJSON fixture files via dataplane bulk record sync
- `export` - Export governed records to local JSON/NDJSON via records search
- `log-test` - Display latest or specified structural validation log
- `log-integration` - Display latest or specified integration test log
- `log-e2e` - Display latest or specified E2E test log
- `log-trust` - Display latest or specified agent trust log (`test-trust --debug`)
- `clean-logs` - Remove saved debug JSON under `integration/<systemKey>/logs/`

---

<a id="aifabrix-datasource-validate-file"></a>
### aifabrix datasource validate <file>

Validate external datasource YAML/JSON file (offline).

**What:** Validates a datasource YAML/JSON file (or a directory of datasource files) against the external-datasource schema plus semantic checks.

**When:** Before publish, when migrating schemas, or when troubleshooting validation failures.

**Usage:**
```bash
# Validate a datasource file
aifabrix datasource validate ./schemas/hubspot-deal.yaml

# Validate a directory (recursively)
aifabrix datasource validate ./integration/myapp/schemas

# Machine-readable output
aifabrix datasource validate ./schemas --json

# Treat warnings as errors
aifabrix datasource validate ./schemas --fail-on-warning

# Strict mode
aifabrix datasource validate ./schemas --strict

# Attempt safe auto-fixes (preview)
aifabrix datasource validate ./schemas --fix --dry-run
```

**See also:** [Validation Commands](../validation.md)

---

<a id="datasource-capability-commands"></a>
### Datasource capability commands

Use these when you already have a working datasource file and want to **duplicate**, **create**, **remove**, **relate**, or **diff** one capability inside the same file.

**Recommended workflow:** finish wizard/download → `aifabrix datasource validate <file-or-key>` → capability commands (try `--dry-run` first) → validate again → upload/publish.

See [Datasource capability commands](./datasource-capabilities.md) for the full command reference.

---

<a id="aifabrix-datasource-list"></a>
### aifabrix datasource list [prefix]

List datasources from the configured environment.

**What:** Lists datasources registered in the configured environment (optionally filtered by key prefix).

**When:** Checking what is deployed in an environment or confirming publish results.

**Usage:**
```bash
aifabrix datasource list
aifabrix datasource list test

# Shorthand
aifabrix ds list
```

---

<a id="aifabrix-datasource-diff-file1-file2"></a>
### aifabrix datasource diff <file1> <file2>

Compare two datasource configuration files.

**What:** Compares two datasource files and highlights differences (useful for review before publish).

**When:** Reviewing changes or validating migrations between versions.

**Usage:**
```bash
aifabrix datasource diff ./old-datasource.yaml ./new-datasource.yaml
```

---

<a id="aifabrix-datasource-upload-myapp-file"></a>
### aifabrix datasource upload <file-or-key>

Publish one datasource to the dataplane.

**What:** Validates and publishes a single datasource (file path or datasource key).

**When:** Iterating on one datasource without uploading the full system.

**Usage:**
```bash
# Upload by path
aifabrix datasource upload ./integration/myapp/myapp-datasource-contacts.json

# Upload by datasource key (resolved under integration/<app>/)
aifabrix datasource upload test-e2e-hubspot-users
```

> **Warning:** Before publishing, the CLI displays a warning that configuration will be sent to the dataplane. Confirm you are targeting the correct environment.

---

<a id="aifabrix-datasource-test-datasourcekey"></a>
### aifabrix datasource test <datasourceKey>

Run a structural/policy validation job for one datasource key on the dataplane.

**What:** Runs a lightweight online validation for the datasource key (faster than integration/E2E).

**When:** Quick post-publish checks or CI gates.

**Usage:**
```bash
aifabrix datasource test hubspot-company --app hubspot
```

---

<a id="aifabrix-datasource-test-integration-datasourcekey"></a>
### aifabrix datasource test-integration <datasourceKey>

Run an integration validation job for one datasource key on the dataplane.

**What:** Runs integration-style online checks for one datasource.

**When:** Verifying behavior for one datasource without testing the entire system.

**Usage:**
```bash
aifabrix datasource test-integration hubspot-company --app hubspot
```

---

<a id="aifabrix-datasource-test-e2e-datasourcekey"></a>
### aifabrix datasource test-e2e <datasourceKey>

Run an E2E validation job for one datasource key on the dataplane.

**What:** Runs the full end-to-end validation flow (config, credentials, sync, data, CIP) for one datasource.

**When:** Final verification against a real external system (requires real credentials).

**Usage:**
```bash
aifabrix datasource test-e2e hubspot-contacts --app hubspot
```

---

<a id="aifabrix-datasource-load-datasourcekey"></a>
### aifabrix datasource load <datasourceKey>

Import local fixture records into dataplane storage for one datasource key.

**What:** Reads a JSON array or NDJSON file and uploads records through the dataplane bulk record sync path. Use this to seed dev fixtures, demos, or regression datasets without one-off scripts.

**When:** After the datasource is published on the dataplane (`datasource upload` or `upload <systemKey>`). For live vendor proof, use `test-e2e` instead.

**Local files:** By default, files live under `integration/.data/` using the naming pattern `{systemKey}-data-{entitySuffix}.json` or `.ndjson`, where `entitySuffix` is derived from the datasource key (for example `hubspot-test-company` → `hubspot-test-data-company.json`).

**Usage:**
```bash
aifabrix datasource load hubspot-test-company --app hubspot-test
aifabrix datasource load hubspot-test-company --file ./fixtures/rows.ndjson -v
aifabrix datasource load hubspot-test-company --dry-run
af ds load hubspot-test-company --batch-size 50 --sync-type incremental
```

**Options (high level):** `--app`, `--env`, `--file`, `--format`, `--batch-size` (default 100), `--sync-type` (default `incremental`), `--dry-run`, `--verbose`, `--json`.

**Notes:**
- External integration folders only (`integration/<systemKey>/`).
- Record objects may be canonical bulk rows (`key`, `displayName`, `recordType`, `metadata`) or plain payloads mapped using the datasource manifest (`primaryKey`, `labelKey`, `resourceType`).
- Never commit production exports or fixtures that contain live credentials or PII unless your team policy allows it.

---

<a id="aifabrix-datasource-export-datasourcekey"></a>
### aifabrix datasource export <datasourceKey>

Export governed records for one datasource key to a local JSON or NDJSON file.

**What:** Runs a governed records search scoped to the datasource and writes results to disk. This is **search output with ABAC applied**, not a raw database dump.

**When:** To diff, back up, or inspect records that the platform would return through Records Search. Large exports are capped at 10,000 rows per run (dataplane limit).

**Usage:**
```bash
aifabrix datasource export hubspot-test-company --app hubspot-test
aifabrix datasource export hubspot-test-company --format ndjson --limit 500 -v
aifabrix datasource export hubspot-test-company --filter '{"status":{"eq":"active"}}'
af ds export hubspot-test-company --fields email,name --strict
```

**Options (high level):** `--app`, `--env`, `--file`, `--format`, `--filter` (JSON object), `--fields` (comma-separated metadata keys), `--limit` (default 1000, max 10000), `--intent` (default `validation`), `--strict`, `--verbose`, `--json`.

---

<a id="aifabrix-datasource-log-test-datasourcekey"></a>
### aifabrix datasource log-test <datasourceKey>

Show the latest structural validation log produced by `datasource test --debug`.

**What:** Prints a readable view of the latest `test-*.json` log in `integration/<systemKey>/logs/`.

---

<a id="aifabrix-datasource-log-integration-datasourcekey"></a>
### aifabrix datasource log-integration <datasourceKey>

Show the latest integration test log produced by `datasource test-integration --debug`.

**What:** Prints a readable view of the latest `test-integration-*.json` log in `integration/<systemKey>/logs/`.

---

<a id="aifabrix-datasource-log-e2e-datasourcekey"></a>
### aifabrix datasource log-e2e <datasourceKey>

Show the latest E2E test log produced by `datasource test-e2e --debug`.

**What:** Prints a readable view of the latest `test-e2e-*.json` log in `integration/<systemKey>/logs/`.

---

<a id="aifabrix-datasource-log-trust-datasourcekey"></a>
### aifabrix datasource log-trust <datasourceKey>

Show the latest agent trust log produced by `datasource test-trust --debug`.

**What:** Prints a readable view of the latest `test-trust-*.json` log in `integration/<systemKey>/logs/` (trust decision, confidence, warnings, and findings summary).

**Usage:**

```bash
aifabrix datasource log-trust hubspot-companies
aifabrix datasource log-trust hubspot-companies --app test-e2e-hubspot
aifabrix datasource log-trust hubspot-companies --file integration/test-e2e-hubspot/logs/test-trust-hubspot-companies-2026-05-19T12-00-00-000Z.json
```

**Options:** `-a, --app <app>`, `-f, --file <path>` (same as other `log-*` commands).

---

<a id="aifabrix-datasource-clean-logs"></a>
### aifabrix datasource clean-logs

Remove local debug JSON written by `datasource test*` commands with `--debug` (or `-d` on app-level integration/E2E rollups).

**What:** Deletes files under `integration/<systemKey>/logs/` matching the chosen log kind. Does not call the Controller or Dataplane. Does not remove `error.log` or integration config.

**When:** After iterative testing when log folders grow large, or before sharing an integration folder.

**Usage:**

```bash
aifabrix datasource clean-logs --app test-e2e-hubspot
aifabrix datasource clean-logs --all
aifabrix datasource clean-logs --app test-e2e-hubspot --type e2e
aifabrix datasource clean-logs --dry-run
aifabrix datasource clean-logs --all --type integration --json
```

**Options:**

- `-a, --app <app>` — One integration folder (system key). Required unless `--all` is set.
- `--all` — Every `integration/<app>/logs/` directory discovered under the cwd integration root and the materialized integration root (dot-prefixed folders such as `.protection` are skipped).
- `-t, --type <type>` — `test` (structural `test-*.json` only), `integration`, `e2e`, `trust`, or `all` (default).
- `--dry-run` — Print paths that would be removed; do not delete.
- `--json` — Emit a single JSON summary (no TTY file list).

**Note:** `aifabrix logs <app>` shows Docker container logs for builder apps; use `clean-logs` only for integration debug JSON.

