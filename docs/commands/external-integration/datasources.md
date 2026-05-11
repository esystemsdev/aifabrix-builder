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
- `log-test` - Display latest or specified structural validation log
- `log-integration` - Display latest or specified integration test log
- `log-e2e` - Display latest or specified E2E test log

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

