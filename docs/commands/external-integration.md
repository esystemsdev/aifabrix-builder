# External Integration Commands

← [Documentation index](../README.md) · [Commands index](README.md)

Commands for creating, testing, and managing external system integrations. Commands that call the Dataplane require login and the appropriate Dataplane permissions (e.g. **external-system:read**, **external-system:create**, **credential:read**). See [Online Commands and Permissions](permissions.md). For detailed testing documentation (unit and integration tests, test payloads, troubleshooting), see [External Integration Testing](external-integration-testing.md).

**Implementation:** External system CLI commands (`download`, `upload`, `delete`, `test-integration`) are registered in `lib/cli/setup-external-system.js`.

**Dataplane commands:** `aifabrix upload <system-key>` and `aifabrix datasource upload <app> <file>` send configuration to the dataplane. The CLI displays a warning before doing so—ensure you are targeting the correct environment and have the required permissions (see [Permissions](permissions.md)).

**Resolve:** You can run `aifabrix resolve <app>` for external integrations when `integration/<app>/env.template` exists. If `application.yaml` is missing, resolve still runs in **env-only** mode and writes `integration/<app>/.env`; see [Utility commands – resolve](utilities.md#aifabrix-resolve-app).

**Create:** To create an external system, run `aifabrix create <app>` (external is the default type). Use `aifabrix create <app> --type webapp` for a builder app. The generated README in `integration/<app>/` includes a **Secrets** section with `aifabrix secret set <systemKey>/<key> <your value>` commands per authentication type (key has no `kv://` prefix).

**Repair:** If `application.yaml`, system file `dataSources`, or env.template gets out of sync with files on disk (e.g. after converting JSON ↔ YAML, adding/removing/renaming datasource files, auth variables wrongly listed in system `configuration`, or env.template having wrong KV_* keys), run `aifabrix repair <app>`. Repair supports `--auth <method>` to set the integration’s authentication method (canonical variables and security) and update env.template accordingly. When switching auth method, existing authentication variables (e.g. baseUrl, tokenUrl) are preserved. It also aligns datasource files with the manifest (dimensions and metadataSchema from attributes as source of truth) and supports optional flags `--rbac`, `--expose`, `--sync`, and `--test`; see [Utility commands – repair](utilities.md#aifabrix-repair-app) for details.

---

## aifabrix wizard

Interactive wizard for creating external systems.

**What:** Provides an interactive guided workflow for creating external system integrations. The first step is **mode** (Create new external system | Add datasource to existing system); then app name or system ID/key, then source, credential, and the rest. The wizard acts as a thin wrapper around the dataplane wizard API.

**When:** Use when creating new external systems or adding datasources to existing systems. The wizard helps you:
- Create new external systems from OpenAPI specifications
- Add datasources to existing systems (system ID/key is validated on the dataplane)
- Generate configurations automatically using AI
- Validate configurations before deployment

This command uses the active `controller` and `environment` from `config.yaml` (set via `aifabrix login` or `aifabrix auth config`). The dataplane URL is always discovered from the controller.

**Usage:**
```bash
# Interactive wizard (mode first, then prompts)
aifabrix wizard

# Wizard for an app (loads/saves integration/<appName>/wizard.yaml and error.log)
aifabrix wizard my-integration
# or
aifabrix wizard -a my-integration

# Headless from a config file
aifabrix wizard --config path/to/wizard.yaml

# With debug output (saves debug manifests on validation failure)
aifabrix wizard hubspot-test-v2 --debug
```

**Resume:** After an error, if an app key is known, state is saved to `integration/<appKey>/wizard.yaml` and the error is appended to `integration/<appKey>/error.log`. Run `aifabrix wizard <appKey>` to resume.

**Options:**
- `-a, --app <app>` - Application name (if not provided, will prompt)
- `--config <file>` - Run headless from a wizard config file
- `--silent` - Run headless using `integration/<app>/wizard.yaml` only (no prompts)
- `--debug` - Enable debug output and save debug manifests on validation failure

**Wizard Flow (7 steps):**
1. **Create Session** - Mode (create new system or add datasource), app name or system
2. **Source Selection** - OpenAPI file/URL, MCP server, or known platform; parse if applicable
3. **Credential Selection** - Skip, create new, or use existing (optional)
4. **Detect Type** - Automatically detect API type and category (skipped for known-platform)
5. **User Preferences & Generate Config** - Field onboarding level (full \| standard \| minimal), intent, MCP/ABAC/RBAC; AI-powered configuration generation
6. **Review & Validate** - Preview, accept or cancel, validate configurations
7. **Save Files** - Save all files to `integration/<app-name>/`

**Files Created:**
- `application.yaml` (or `application.json` if config format is `json`) - Application variables and external integration configuration
- `<systemKey>-system.yaml` (or `*.json`) - System configuration
- `<systemKey>-datasource-*.yaml` (or `*.json`) - Datasource configurations
- `env.template` - Environment variable template
- `README.md` - Documentation
- `<systemKey>-deploy.json` - Deployment manifest (generated)

When `format` is set in `~/.aifabrix/config.yaml` (via `aifabrix dev set-format`), the wizard generates files in that format.

**Examples:**
```bash
# Create HubSpot integration via wizard
aifabrix wizard --app hubspot-integration
# Select: Known platform > HubSpot

# Create from OpenAPI file
aifabrix wizard --app my-api
# Select: OpenAPI file > Provide path

# Use wizard when creating external system (create defaults to external)
aifabrix create my-integration --wizard
# Delete (path resolved: integration first, then builder)
aifabrix delete hubspot
```

**See Also:**
- [Wizard Guide](../wizard.md) - Detailed wizard documentation
- [External Systems Guide](../external-systems.md) - Manual external system creation
- [Validation Commands](validation.md) - Configuration validation documentation

---

## aifabrix download <system-key>

Download external system from dataplane to local development structure.

**What:** Fetches the full running manifest (system + all datasources) from the dataplane in a single request, then writes `<system-key>-deploy.json` and splits it into component files (application.yaml, system YAML, datasource YAMLs, env.template, README.md). The generated env.template includes `KV_*` entries derived from the system's `authentication.security` so credential coverage validation passes. If the integration folder already exists, existing `env.template` is merged (not overwritten); README.md is only replaced after a prompt unless `--force` is used.

**When:** Setting up local development for an existing external system, cloning a system from another environment, or retrieving a system configuration for modification.

**Usage:**
```bash
# Download external system from dataplane (uses controller and environment from config.yaml)
aifabrix download hubspot

# Download and convert component files to JSON (one-step: download → split → convert)
aifabrix download hubspot --format json

# Dry run to see what would be downloaded
aifabrix download hubspot --dry-run

# Overwrite existing README.md without prompting
aifabrix download hubspot --force
```

**Arguments:**
- `<system-key>` - External system key (identifier)

**Options:**
- `--format <format>` - Output format: `json` | `yaml` (default: `yaml` or config format). When `json`, runs the full pipeline: download → split → convert component files to JSON. When `yaml`, only splits into YAML components. If not passed, uses config format (set via `aifabrix dev set-format`) or `yaml`.
- `--dry-run` - Show what would be downloaded without actually downloading
- `--force` - Overwrite existing README.md without prompting

Controller and environment come from `config.yaml` (set via `aifabrix login` or `aifabrix auth config`).

**Prerequisites:**
- Must be logged in: `aifabrix login` (**Bearer token** required; client credentials are not sufficient for download—use device or interactive login).
- System must exist in the dataplane
- Dataplane permission: **external-system:read**

**Process:**
1. Resolves dataplane URL from controller and authenticates (Bearer required).
2. Downloads the **full manifest** (system + all datasources) from the dataplane in one go.
3. Validates the response, then builds deploy JSON. The generated env.template gets `KV_*` entries from the system’s `authentication.security` so credential validation passes.
4. Writes `<system-key>-deploy.json` to `integration/<system-key>/` and **splits** it into component files:
   - `application.yaml`, `<system-key>-system.yaml`, `<system-key>-datasource-<key>.yaml`, `env.template`, `README.md`
5. **Re-templating (when env.template exists):** Configuration entries in the system file with `location: variable` whose **name** matches a variable in `env.template` have their **value** set to `{{name}}` (e.g. `{{SHAREPOINT_SITE_ID}}`) so the downloaded file stays template-based. Entries whose name is not in env.template keep the value returned by the server.
6. If the folder already exists: **env.template** is merged with the existing file (local edits preserved). **README.md**: if it exists and `--force` is not set, the CLI prompts to replace (yes/no); with `--force`, README is overwritten without prompting.
7. Ensures placeholder secrets from env.template (empty values for credentials).
8. If `--format json`: runs convert so component files are JSON instead of YAML.

**Output:**
```yaml
📥 Downloading external system: hubspot

🌐 Resolving dataplane URL...
✓ Dataplane URL: https://dataplane.aifabrix.dev

📡 Downloading full manifest: hubspot
🔍 Validating downloaded data...
✓ System type: openapi
✓ Found 3 datasource(s)
📁 Creating directory: integration/hubspot
✓ Created: integration/hubspot/hubspot-deploy.json
📂 Splitting deploy JSON into component files...
✅ External system downloaded successfully!
Location: integration/hubspot
System: hubspot
Datasources: 3
```
With `--format json`, an extra line confirms conversion to JSON. If README.md already exists and `--force` is not set, you are prompted to replace it.

**File Structure:**
```text
integration/
  <system-key>/
    <system-key>-deploy.json                # Deployment manifest (downloaded, can be split)
    application.yaml                        # App configuration with externalIntegration block
    <system-key>-system.yaml                # External system definition
    <system-key>-datasource-<ds-key1>.yaml  # Datasource 1
    <system-key>-datasource-<ds-key2>.yaml  # Datasource 2
    env.template                            # Environment variables template
    README.md                               # Documentation
```

**Issues:**
- **"System key is required"** → Provide system key as argument
- **"Not logged in"** / **"Authentication required"** → Run `aifabrix login` (device or interactive flow to get a Bearer token)
- **Bearer token required** → Download requires a Bearer token; client credentials are not sufficient. Use `aifabrix login` (device or interactive flow) to obtain a Bearer token.
- **"System not found"** → Check system key exists in the dataplane
- **"Failed to download system"** → Check dataplane URL, authentication, and network connection
- **"Validation failed"** → Downloaded data doesn't match expected schema (application key, datasource systemKey, etc.)

**Next Steps:**
After downloading:
- Review configuration files in `integration/<system-key>/`
- Run unit tests: `aifabrix test <system-key>`
- Run integration tests: `aifabrix test-integration <system-key>`
- Deploy changes: `aifabrix deploy <system-key>` (resolves `integration/<system-key>/` first; no app register needed). After deploy (or upload), MCP/OpenAPI docs are served by the dataplane—see [Controller and Dataplane: What, Why, When](../deploying.md#controller-and-dataplane-what-why-when).

---

<a id="aifabrix-upload-system-key"></a>
## aifabrix upload <system-key>

Upload full external system (system + all datasources + RBAC) to the dataplane for the current environment.

**What:** Uploads the full manifest (system + datasources) to the dataplane: the CLI validates, then publishes the config and **registers RBAC with the controller**. It does **not** trigger controller-driven container/restart deployment. Use for fast development iteration and testing (e.g. with `aifabrix test-integration`). Promote to full platform with `aifabrix deploy <app>` when ready.

**When:** Develop and test on the dataplane; or when you have only dataplane access or limited controller permissions (e.g. no `applications:deploy` on the controller).

**When MCP/OpenAPI docs are available:** After publish (via upload or deploy), the dataplane serves MCP and OpenAPI docs at standard URLs. See [Controller and Dataplane: What, Why, When](../deploying.md#controller-and-dataplane-what-why-when).

**Usage:**
```bash
# Upload to dataplane (uses controller and environment from config)
aifabrix upload my-hubspot

# Validate and build payload only; no API calls
aifabrix upload my-hubspot --dry-run
```

**Arguments:** `<system-key>` – External system key (same as `integration/<system-key>/`).

**Options:**
- `--dry-run` – Validate locally and build payload only; no API calls
- `--debug` – Include debug output

**Prerequisites:**
- Login or app credentials for the system: `aifabrix login` or `aifabrix app register <system-key>`
- `integration/<system-key>/` with valid `application.yaml` and system/datasource files

> **Warning:** Before sending data, the CLI displays a warning that configuration will be sent to the dataplane. Ensure you are targeting the correct environment and have the required permissions. See [Permissions](permissions.md).

**Process:**
1. Validate locally (`validateExternalSystemComplete`)
2. Build payload from controller manifest (system with RBAC + datasources) → `{ version, application, dataSources, status: "draft" }`
3. **Configuration resolution:** The CLI resolves the **configuration** section before sending. Entries with `location: variable` get `{{VAR}}` replaced from the integration’s `.env` (or from resolved env.template if .env is missing). Entries with `location: keyvault` get `kv://` references resolved from your secrets (same as credential push). The payload sent to the dataplane contains **literal values** in configuration. If a variable or keyvault value is missing, the command fails with a message suggesting `aifabrix resolve <system-key>` or setting the variable in .env / ensuring the key exists in the secrets file.
4. Resolve dataplane URL and auth (from controller + environment)
5. **Credential secrets push (automatic):** The CLI reads `integration/<system-key>/.env` and sends any `KV_*` variables (values resolved from local/remote secrets if they are `kv://`). It also scans the upload payload (application + datasources) for `kv://` references that are **not** in `.env` and resolves their values from aifabrix secret systems (local file or remote), then sends all to the dataplane secret store. This stores secret *values* only; credential structure (type, fields) is created/updated by the publish step itself. So credentials in config can be satisfied from `.env` or from local/remote secrets without extra steps—the CLI handles it automatically.

   **Skip conditions:** If there is no `.env` file, no `KV_*` keys, or values are empty, the credential push step is skipped.

   **KV_* convention:** env.template and .env use `KV_<APPKEY>_<VAR>=value` (e.g. `KV_HUBSPOT_CLIENTID=xxx`, `KV_HUBSPOT_CLIENTSECRET=yyy`). Mapping: `KV_` + segments (underscores) → `kv://segment1/segment2/...` (lowercase). Example: `KV_HUBSPOT_CLIENTID` → `kv://hubspot/clientid`. The manifest must reference `kv://hubspot/clientid` (path style). Use `aifabrix credential env <system-key>` to prompt for values and write .env; use `aifabrix credential push <system-key>` to push .env secrets without a full upload.

   Dataplane permission **credential:create** is required for this automatic push; if the push fails (e.g. 403), upload still continues but secrets must be available elsewhere (e.g. env on dataplane). See [Secrets and config](../configuration/secrets-and-config.md) and [Permissions](permissions.md).
6. **Pipeline upload:** Sends the configuration to the Dataplane (upload, validate, and publish in one step). On failure, the CLI shows validation or publish errors and exits.

**Output example:**
```text
Uploading external system to dataplane: my-hubspot
Validation passed.
Resolving dataplane URL...
Dataplane: https://dataplane.example.com
⚠ Configuration will be sent to the dataplane. Ensure you are targeting the correct environment and have the required permissions.

Upload validated and published to dataplane.
Environment: dev
System: my-hubspot
Dataplane: https://dataplane.example.com
```

**Workflow:** Develop with `aifabrix upload` for quick iteration and testing. Promote with `aifabrix deploy <app>` when ready for full controller deployment and dev → tst → pro promotion.

**Issues / next steps:**
- **Validation failed** – Fix errors shown (e.g. missing `application.yaml`, invalid system/datasource files) then run again.
- **Authentication required** – Run `aifabrix login` or `aifabrix app register <system-key>`.
- For full controller deployment and environment promotion, run `aifabrix deploy <app>` (or promote via the web interface).

---

## aifabrix credential env <system-key>

Prompt for KV_* credential values and write `integration/<system-key>/.env`.

**What:** Interactively prompts for each KV_* variable found in env.template (e.g. KV_HUBSPOT_CLIENTID, KV_HUBSPOT_CLIENTSECRET), using password-type prompts for secrets, and writes the values to `.env`.

**When:** After creating or downloading an external system integration. Use before `aifabrix credential push` or `aifabrix upload` to supply credential values.

**Usage:**
```bash
aifabrix credential env hubspot
```

**Arguments:** `<system-key>` – External system key (same as `integration/<system-key>/`).

**Prerequisites:**
- `integration/<system-key>/env.template` must exist (created by wizard, download, or create)

**Process:**
1. Parses env.template for `KV_<APPKEY>_<VAR>=` lines
2. Prompts for each variable (password type for CLIENTID, CLIENTSECRET, APIKEY, USERNAME, PASSWORD, etc.)
3. Writes `.env` with mode 0o600

**See also:** [aifabrix credential push](#aifabrix-credential-push-system-key), [aifabrix upload](#aifabrix-upload-system-key)

---

<a id="aifabrix-credential-push-system-key"></a>
## aifabrix credential push <system-key>

Push credential secrets from `.env` to the dataplane (no upload/validate/publish).

**What:** Reads `integration/<system-key>/.env`, collects KV_* variables with non-empty values, and pushes them to the dataplane credential API. Same credential push logic as `aifabrix upload`, but without the manifest upload step.

**When:** You have updated .env with new credential values and want to sync them to the dataplane without re-uploading the full system.

**Usage:**
```bash
aifabrix credential push hubspot
```

**Arguments:** `<system-key>` – External system key.

**Prerequisites:**
- Must be logged in: `aifabrix login` or `aifabrix app register <system-key>`
- `integration/<system-key>/.env` with KV_* variables (use `aifabrix credential env <system-key>` to populate)
- Dataplane permission: **credential:create**

**See also:** [aifabrix credential env](#aifabrix-credential-env-system-key), [aifabrix credential list](permissions.md), [aifabrix upload](#aifabrix-upload-system-key)

---

<a id="aifabrix-delete-system-key"></a>
## aifabrix delete <system-key>

Delete external system from dataplane (also deletes all associated datasources).

**What:** Permanently removes an external system and all its associated datasources from the dataplane. This operation cannot be undone. The command prompts for confirmation before deletion unless `--yes` or `--force` is provided.

**When:** Removing external systems that are no longer needed, cleaning up test systems, or removing deprecated integrations.

This command uses the active `controller` and `environment` from `config.yaml` (set via `aifabrix login` or `aifabrix auth config`). The dataplane URL is always discovered from the controller.

**Usage:**
```bash
# Delete external system with confirmation prompt (defaults to integration/<app>)
aifabrix delete hubspot

# Delete without confirmation prompt (for automation)
aifabrix delete hubspot --yes
```

**Arguments:**
- `<system-key>` - External system key (identifier)

**Options:**
- `--type <type>` - Application type (default: `external`). Use `external` to target `integration/<app>/` when resolving local path.
- `--yes` - Skip confirmation prompt
- `--force` - Skip confirmation prompt (alias for `--yes`)

**Prerequisites:**
- Must be logged in: `aifabrix login`
- System must exist in the dataplane

**Process:**
1. Gets dataplane URL from controller
2. Fetches external system configuration to list associated datasources
3. Displays warning with list of datasources that will be deleted
4. Prompts for confirmation (unless `--yes` or `--force` is provided)
5. Deletes the system (and all associated datasources) from the dataplane
6. Displays success message

**Output (with confirmation):**
```yaml
📥 Deleting external system: hubspot

🔐 Getting authentication...
✓ Authentication successful
🌐 Getting dataplane URL from controller...
✓ Dataplane URL: https://dataplane.aifabrix.dev

⚠️  Warning: Deleting external system 'hubspot' will also delete all associated datasources:
 - hubspot-company
 - hubspot-contact
 - hubspot-deal

Are you sure you want to delete external system 'hubspot'? (yes/no): yes

🗑️  Deleting external system...
✓ External system 'hubspot' deleted successfully
✓ All associated datasources have been removed
```

**Output (with --yes flag):**
```yaml
📥 Deleting external system: hubspot

🔐 Getting authentication...
✓ Authentication successful
🌐 Getting dataplane URL from controller...
✓ Dataplane URL: https://dataplane.aifabrix.dev

⚠️  Warning: Deleting external system 'hubspot' will also delete all associated datasources:
 - hubspot-company
 - hubspot-contact
 - hubspot-deal

🗑️  Deleting external system...
✓ External system 'hubspot' deleted successfully
✓ All associated datasources have been removed
```

**Output (cancelled):**
```yaml
📥 Deleting external system: hubspot

🔐 Getting authentication...
✓ Authentication successful
🌐 Getting dataplane URL from controller...
✓ Dataplane URL: https://dataplane.aifabrix.dev

⚠️  Warning: Deleting external system 'hubspot' will also delete all associated datasources:
 - hubspot-company
 - hubspot-contact
 - hubspot-deal

Are you sure you want to delete external system 'hubspot'? (yes/no): no
Deletion cancelled.
```

**What Gets Deleted:**
- External system configuration
- All associated datasources
- System metadata and configuration

**Note:** This operation is permanent and cannot be undone. If you need to restore a deleted system, you must recreate it from scratch.

**Issues:**
- **"System key is required"** → Provide system key as argument
- **"External system not found in integration/..."** → Ensure the system exists in `integration/<system-key>/` or `builder/<system-key>/` (the CLI resolves integration first, then builder)
- **"Not logged in"** → Run `aifabrix login` first
- **"External system 'hubspot' not found"** → Check system key exists in the dataplane
- **"Failed to delete external system"** → Check dataplane URL, authentication, and network connection
- **"Authentication required"** → Run `aifabrix login` or `aifabrix app register` first

**Next Steps:**
After deletion:
- System and datasources are permanently removed from dataplane
- Local files in `integration/<system-key>/` are not deleted (preserved for reference)
- To recreate: Use `aifabrix create <system-key>` or `aifabrix wizard`

---

<a id="aifabrix-test-app"></a>
## aifabrix test <app>

Run unit tests for external system (local validation, no API calls).

**What:** Validates external system configuration locally without making API calls. Tests syntax, schemas, field mapping expressions, metadata schemas, and relationships using test payloads from the datasource when available.

**When:** Before deploying, validating configuration locally, or testing field mappings without network access.

**Usage:**
```bash
# Test entire external system
aifabrix test hubspot

# Test specific datasource only
aifabrix test hubspot --datasource hubspot-company

# Verbose output
aifabrix test hubspot --verbose
```

**Arguments:** `<app>` – Application name (external system).

**Options:** `-d, --datasource <key>` – Test specific datasource only. `-v, --verbose` – Show detailed validation output.

**Prerequisites:** None (fully local; no login required).

**Process:** (1) Load and validate `application.yaml`, system, and datasource files against schemas. (2) If a datasource has `testPayload.payloadTemplate`, validate metadata schema and field mappings against it (mock transformer; no API calls), and compare with `expectedResult` if provided. (3) Validate relationships (systemKey, entityKey). (4) Return structured results.

For test payload configuration, examples, and troubleshooting, see [External Integration Testing](external-integration-testing.md#unit-tests-aifabrix-test).

---

<a id="aifabrix-test-integration-app"></a>
## aifabrix test-integration <app>

Run integration tests via the dataplane. Requires dataplane access (authenticated). See [Online Commands and Permissions](permissions.md).

**What:** Tests external system configuration against the dataplane. Validates field mappings, metadata schemas, connectivity, and ABAC dimensions.

**When:** After unit tests pass, when validating against the real dataplane, or when testing endpoint connectivity before deployment.

**Usage:**
```bash
# Test entire external system (dataplane URL from controller)
aifabrix test-integration hubspot

# Test with environment or specific datasource
aifabrix test-integration hubspot --env tst
aifabrix test-integration hubspot --datasource hubspot-company
aifabrix test-integration hubspot --payload ./test-payload.json

# Verbose with custom timeout
aifabrix test-integration hubspot --verbose --timeout 60000

# Debug mode: include debug in response and write log to integration/<app>/logs/
aifabrix test-integration hubspot --debug
```

**Arguments:** `<app>` – Application name (external system).

**Options:** `-e, --env <env>` – Environment: dev, tst, or pro (default: from aifabrix auth config). `-d, --datasource <key>` – Test specific datasource only. `-p, --payload <file>` – Custom test payload file (overrides datasource testPayload). `-v, --verbose` – Detailed output. `--debug` – Include debug output in response and write log to `integration/<app>/logs/`. `--timeout <ms>` – Request timeout (default: 30000). Dataplane URL is always resolved from the controller.

**Prerequisites:** Logged in (`aifabrix login`); dataplane accessible; system published or ready for testing.

**Process:** (1) Resolve dataplane URL from controller. (2) For each datasource: load payload from datasource `testPayload.payloadTemplate` or `--payload` file; run the test; parse validation, field mapping, and connectivity results. (3) Display and aggregate results. Includes retry with exponential backoff for transient failures.

For payload sources, response handling, and troubleshooting, see [External Integration Testing](external-integration-testing.md#integration-tests-aifabrix-test-integration).

---

<a id="aifabrix-datasource"></a>
## aifabrix datasource

Manage external data sources.

**What:** Command group for managing external datasource configurations. Includes validation, listing, comparison, deployment, and testing operations for datasources that integrate with external systems.

**Subcommands:**
- `validate` - Validate external datasource JSON file
- `list` - List datasources from environment
- `diff` - Compare two datasource configuration files
- `deploy` - Deploy datasource to dataplane
- `test-integration` - Run integration (config) test for one datasource via dataplane
- `test-e2e` - Run E2E test for one datasource (config, credential, sync, data, CIP) via dataplane

**When:** Managing external integrations, deploying datasource configurations, validating datasource schemas, or running datasource-level tests.

**See Also:**
- [aifabrix datasource validate](#aifabrix-datasource-validate-file)
- [aifabrix datasource list](#aifabrix-datasource-list)
- [aifabrix datasource diff](#aifabrix-datasource-diff-file1-file2)
- [aifabrix datasource upload](#aifabrix-datasource-upload-myapp-file)
- [aifabrix datasource test-integration](#aifabrix-datasource-test-integration-datasourcekey)
- [aifabrix datasource test-e2e](#aifabrix-datasource-test-e2e-datasourcekey)

---

<a id="aifabrix-datasource-validate-file"></a>
### aifabrix datasource validate <file>

Validate external datasource JSON file.

**What:** Validates an external datasource JSON file against the external-datasource schema. Checks required fields, data types, and schema compliance.

**When:** Before deploying datasource, troubleshooting configuration issues, or validating schema changes.

**See Also:** [Validation Commands](validation.md) - Complete validation documentation including schema architecture and validation principles.

**Usage:**
```bash
# Validate datasource file
aifabrix datasource validate ./schemas/hubspot-deal.yaml

# Validate with relative path
aifabrix datasource validate schemas/my-datasource.yaml
```

**Arguments:**
- `<file>` - Path to external datasource JSON file

**Process:**
1. Reads datasource JSON file
2. Parses JSON content
3. Loads external-datasource schema
4. Validates file against schema
5. Displays validation results

**Output (valid):**
```yaml
✓ Datasource file is valid: ./schemas/hubspot-deal.yaml
```

**Output (invalid):**
```yaml
✗ Datasource file has errors: ./schemas/hubspot-deal.yaml
  • Missing required field 'key'
  • Field 'systemKey' must be a string
  • Field 'version' must match pattern ^[0-9]+\.[0-9]+\.[0-9]+$
```

**Issues:**
- **"File path is required"** → Provide path to datasource file
- **"File not found: <path>"** → Check file path is correct
- **"Invalid JSON syntax"** → Fix JSON syntax errors in file
- **"Missing required field"** → Add required fields to datasource configuration

**Next Steps:**
After validation:
- Fix any validation errors
- Use `aifabrix datasource diff` to compare versions
- Upload validated datasource: `aifabrix datasource upload <app> <file>`

**See Also:** [Validation Commands](validation.md) - Complete validation documentation including schema details and validation flow.

---

<a id="aifabrix-datasource-list"></a>
### aifabrix datasource list

List datasources from environment.

**What:** Lists all datasources registered in an environment via the Miso Controller API. Displays datasource key, display name, system key, version, and status.

**When:** Viewing available datasources, checking datasource status, or auditing environment configuration.

This command uses the active `controller` and `environment` from `config.yaml` (set via `aifabrix login` or `aifabrix auth config`). The dataplane URL is always discovered from the controller.

**Usage:**
```bash
# List datasources in environment (uses config.environment)
aifabrix datasource list

# Switch environment first if needed
aifabrix auth config --set-environment pro
aifabrix datasource list
```

**Prerequisites:**
- Must be logged in: `aifabrix login`

**Process:**
1. Gets authentication token from config
2. Lists datasources from controller for the environment
3. Extracts datasources from response
4. Displays datasources in formatted table

**Output:**
```yaml
📋 Datasources in environment: dev

Key                           Display Name                  System Key           Version         Status
------------------------------------------------------------------------------------------------------------------------
hubspot-deal                  HubSpot Deal                 hubspot              1.0.0           enabled
salesforce-contact            Salesforce Contact            salesforce           2.1.0           enabled
```

**Output (no datasources):**
```yaml
No datasources found in environment: dev
```

**Issues:**
- **"Not logged in"** → Run `aifabrix login` first
- **"Environment is required"** → Run `aifabrix login` or `aifabrix auth config --set-environment <env>`
- **"Failed to list datasources"** → Check controller URL and network connection
- **"Invalid API response format"** → Controller API may have changed; check API version

**Next Steps:**
After listing:
- Validate datasource: `aifabrix datasource validate <file>`
- Upload datasource: `aifabrix datasource upload <app> <file>`
- Compare datasources: `aifabrix datasource diff <file1> <file2>`

---

<a id="aifabrix-datasource-diff-file1-file2"></a>
### aifabrix datasource diff <file1> <file2>

Compare two datasource configuration files.

**What:** Compares two datasource JSON files and highlights differences, with special focus on dataplane-relevant fields (fieldMappings, exposed fields, sync configuration, OpenAPI, MCP). The generic command `aifabrix diff <file1> <file2>` (see [Validation Commands](validation.md#aifabrix-diff-file1-file2)) also works for two datasource files: it requires both files to be the same config type (app, system, or datasource) and validates them against their schema by default; `aifabrix datasource diff` is a convenience for comparing two datasource files with dataplane-focused output.

**When:** Before deploying datasource updates, validating schema migrations, or reviewing configuration changes for dataplane deployment.

**Usage:**
```bash
# Compare two datasource versions
aifabrix datasource diff ./schemas/hubspot-deal-v1.yaml ./schemas/hubspot-deal-v2.yaml

# Compare datasource configurations
aifabrix datasource diff ./old-datasource.yaml ./new-datasource.yaml
```

**Arguments:**
- `<file1>` - Path to first datasource file
- `<file2>` - Path to second datasource file

**Process:**
1. Compares files using standard diff logic
2. Identifies dataplane-relevant changes:
   - Field mappings changes
   - Exposed fields changes
   - Sync configuration changes
   - OpenAPI configuration changes
   - MCP configuration changes
3. Displays formatted diff with dataplane highlights

**Output:**
```yaml
Comparing: hubspot-deal-v1.yaml ↔ hubspot-deal-v2.yaml

Files are different

Version: 1.0.0 → 2.0.0

Added Fields:
  + fieldMappings.dealStage: "properties.dealstage"

Changed Fields:
  ~ exposed.fields:
    Old: ["dealname", "amount"]
    New: ["dealname", "amount", "dealstage"]
  ~ sync.interval:
    Old: 300
    New: 60

Summary:
  Added: 1
  Removed: 0
  Changed: 2
  Breaking: 0

📊 Dataplane-Relevant Changes:
  • Field Mappings: 1 changes
  • Exposed Fields: 1 changes
  • Sync Configuration: 1 changes
```

**Dataplane-Relevant Fields:**
- **fieldMappings** - Field mapping configuration changes
- **exposed** - Exposed fields changes
- **sync** - Sync configuration changes
- **openapi** - OpenAPI configuration changes
- **mcp** - MCP configuration changes

**Exit Codes:**
- **0** - Files are identical
- **1** - Files are different

**Issues:**
- **"File not found"** → Check file paths are correct
- **"Failed to parse"** → Fix JSON syntax errors in files
- **"Comparison failed"** → Check both files are valid datasource configurations

**Next Steps:**
After comparing:
- Review dataplane-relevant changes
- Validate new configuration: `aifabrix datasource validate <file2>`
- Upload updated datasource: `aifabrix datasource upload <app> <file2>`

---

<a id="aifabrix-datasource-upload-myapp-file"></a>
### aifabrix datasource upload <myapp> <file>

Upload datasource to dataplane. Requires dataplane access (authenticated). See [Online Commands and Permissions](permissions.md).

**What:** Validates and uploads an external datasource configuration to the dataplane. Gets dataplane URL from controller, then publishes the datasource.

> **Warning:** Before publishing, the CLI displays a warning that configuration will be sent to the dataplane. Ensure you are targeting the correct environment and have the required permissions. See [Permissions](permissions.md).

**When:** Uploading new datasource, updating existing datasource, or pushing datasource configuration changes to dataplane.

This command uses the active `controller` and `environment` from `config.yaml` (set via `aifabrix login` or `aifabrix auth config`). The dataplane URL is always discovered from the controller.

**Usage:**
```bash
# Upload datasource to dataplane
aifabrix datasource upload myapp ./schemas/hubspot-deal.yaml
```

**Arguments:**
- `<myapp>` - Application key
- `<file>` - Path to datasource JSON file

**Prerequisites:**
- Application must be registered: `aifabrix app register <myapp>`
- Must be logged in or have credentials in secrets.local.yaml
- Datasource file must be valid

**Process:**
1. Validates datasource file against schema
2. Loads datasource configuration
3. Extracts systemKey from configuration
4. Gets authentication (device token or client credentials)
5. Gets dataplane URL from controller
6. Displays warning (configuration will be sent to the dataplane)
7. Uploads datasource to the dataplane
8. Displays results

**Output:**
```yaml
📋 Uploading datasource...

🔍 Validating datasource file...
✓ Datasource file is valid
🔐 Getting authentication...
✓ Authentication successful
🌐 Getting dataplane URL from controller...
✓ Dataplane URL: https://dataplane.aifabrix.dev

🚀 Publishing datasource to dataplane...
⚠ Configuration will be sent to the dataplane. Ensure you are targeting the correct environment and have the required permissions.

✓ Datasource published successfully!

Datasource: hubspot-deal
System: hubspot
Environment: dev
```

**Issues:**
- **"Application key is required"** → Provide application key as first argument
- **"File path is required"** → Provide path to datasource file
- **"Controller URL is required"** → Run `aifabrix login` or `aifabrix auth config --set-controller <url>`
- **"Environment is required"** → Run `aifabrix login` or `aifabrix auth config --set-environment <env>`
- **"File not found"** → Check datasource file path is correct
- **"Datasource validation failed"** → Fix validation errors in datasource file
- **"systemKey is required"** → Add systemKey field to datasource configuration
- **"Not logged in"** → Run `aifabrix login` first
- **"Failed to get application from controller"** → Check application is registered and controller URL is correct
- **"Dataplane URL not found"** → Controller could not provide dataplane URL; check controller and network
- **"Upload failed"** → Check dataplane URL, authentication, and network connection

**Next Steps:**
After upload:
- Verify datasource: `aifabrix datasource list`
- Run integration test: `aifabrix datasource test-integration <datasourceKey> --app <app>`
- Run E2E test: `aifabrix datasource test-e2e <datasourceKey> --app <app>`
- Check datasource status in controller dashboard
- Monitor dataplane for datasource activity

---

<a id="aifabrix-datasource-test-integration-datasourcekey"></a>
### aifabrix datasource test-integration <datasourceKey>

Run integration (config) test for one datasource via the dataplane. Requires dataplane access. See [Online Commands and Permissions](permissions.md).

**What:** Tests a single datasource against the dataplane. Validates field mappings, metadata schemas, and connectivity. Supports client credentials for CI/CD.

**When:** Testing one datasource without running tests for the whole system; in CI pipelines; when inside `integration/<appKey>/` and running from that directory.

**Usage:**
```bash
# From integration/<appKey>/ or with explicit app
aifabrix datasource test-integration hubspot-company --app hubspot

# With custom payload and debug
aifabrix datasource test-integration hubspot-company -a hubspot --payload ./payload.json --debug

# With environment and timeout
aifabrix datasource test-integration hubspot-company -a hubspot -e tst --timeout 60000
```

**Arguments:** `<datasourceKey>` – Datasource key (e.g. hubspot-company, hubspot-deal).

**Options:** `-a, --app <appKey>` – App key (required if not inside `integration/<appKey>/`). `-p, --payload <file>` – Custom test payload file. `-e, --env <env>` – Environment: dev, tst, or pro. `--debug` – Include debug output and write log to `integration/<app>/logs/`. `--timeout <ms>` – Request timeout (default: 30000).

**Context:** Resolve systemKey from `--app` or from current directory when inside `integration/<appKey>/`.

**Prerequisites:** Logged in (`aifabrix login`) or client credentials configured; dataplane accessible; system and datasource published or ready for testing.

For details, see [External Integration Testing](external-integration-testing.md#datasource-integration-tests).

---

<a id="aifabrix-datasource-test-e2e-datasourcekey"></a>
### aifabrix datasource test-e2e <datasourceKey>

Run E2E test for one datasource via dataplane external API. Requires Bearer token or API key (client credentials not supported). See [Online Commands and Permissions](permissions.md).

**What:** Runs full E2E test (config, credential, sync, data, CIP) via the dataplane. By default the command starts the run asynchronously, then polls until the run completes or fails; use `-v` to see poll progress (e.g. number of steps completed so far). Reports per-step status. The dataplane runs E2E steps in order: config, credential, sync, data, CIP. Credential status is validated as the second step in this sequence.

**When:** End-to-end validation of a single datasource after integration tests pass; requires Bearer or API key authentication.

**Usage:**
```bash
# From integration/<appKey>/ or with explicit app (async + polling by default)
aifabrix datasource test-e2e hubspot-contacts --app hubspot

# With environment, debug, and verbose (shows poll progress)
aifabrix datasource test-e2e hubspot-contacts -a hubspot -e tst --debug -v

# Sync mode (single request, no polling)
aifabrix datasource test-e2e hubspot-contacts --app hubspot --no-async
```

**Arguments:** `<datasourceKey>` – Datasource key used as sourceIdOrKey (e.g. hubspot-contacts).

**Options:**
- `-a, --app <appKey>` – App key (required if not inside `integration/<appKey>/`).
- `-e, --env <env>` – Environment: dev, tst, or pro.
- `-v, --verbose` – Detailed step output and, when polling, progress (e.g. steps completed so far).
- `--debug` – Include debug output and write log to `integration/<app>/logs/`.
- `--test-crud` – Enable CRUD lifecycle test.
- `--record-id <id>` – Record ID to use for the test.
- `--no-cleanup` – Disable cleanup after the test.
- `--primary-key-value <value|@path>` – Primary key value, or path to a JSON file (prefix with `@`) for composite keys.
- `--no-async` – Use sync mode: single request, no polling (useful for short runs or backward compatibility).

**Prerequisites:** Logged in (`aifabrix login`) or API key configured. E2E tests require a Bearer token or API key; client credentials are not accepted. Run `aifabrix login` if you see "E2E tests require Bearer token or API key".

For details, see [External Integration Testing](external-integration-testing.md#datasource-e2e-tests).

