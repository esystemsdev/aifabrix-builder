# External Integration Commands

← [Documentation index](../README.md) · [Commands index](README.md)

Commands for creating, testing, and managing external system integrations. Commands that call the Dataplane require login and the appropriate Dataplane permissions (e.g. **external-system:read**, **external-system:create**, **credential:read**). See [Online Commands and Permissions](permissions.md).

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
```

**Resume:** After an error, if an app key is known, state is saved to `integration/<appKey>/wizard.yaml` and the error is appended to `integration/<appKey>/error.log`. Run `aifabrix wizard <appKey>` to resume.

**Options:**
- `-a, --app <app>` - Application name (if not provided, will prompt)

**Wizard Flow:**
1. **Mode Selection** - Create new system or add datasource
2. **Source Selection** - OpenAPI file/URL, MCP server, or known platform
3. **Parse OpenAPI** - Parse specification (if applicable)
4. **Detect Type** - Automatically detect API type and category
5. **User Preferences** - Field onboarding level (full \| standard \| minimal), intent, and features (MCP, ABAC, RBAC). Saved in `wizard.yaml` under `preferences.fieldOnboardingLevel` and sent in the request body to `generate-config` / `generate-config-stream`.
6. **Generate Config** - AI-powered configuration generation
7. **Review & Validate** - Review and optionally edit configurations
8. **Save Files** - Save all files to `integration/<app-name>/`

**Files Created:**
- `application.yaml` - Application variables and external integration configuration
- `<systemKey>-system.yaml` - System configuration
- `<systemKey>-datasource-*.yaml` - Datasource configurations
- `env.template` - Environment variable template
- `README.md` - Documentation
- `<systemKey>-deploy.json` - Deployment manifest (generated)

**Examples:**
```bash
# Create HubSpot integration via wizard
aifabrix wizard --app hubspot-integration
# Select: Known platform > HubSpot

# Create from OpenAPI file
aifabrix wizard --app my-api
# Select: OpenAPI file > Provide path

# Use wizard when creating external system
aifabrix create my-integration --type external --wizard
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

**What:** Downloads an external system configuration and all its datasources from the dataplane API to a local development folder structure. Creates all necessary files for local development and testing.

**When:** Setting up local development for an existing external system, cloning a system from another environment, or retrieving a system configuration for modification.

**Usage:**
```bash
# Download external system from dataplane (uses controller and environment from config.yaml)
aifabrix download hubspot

# Dry run to see what would be downloaded
aifabrix download hubspot --dry-run
```

**Arguments:**
- `<system-key>` - External system key (identifier)

**Options:**
- `--dry-run` - Show what would be downloaded without actually downloading

Controller and environment come from `config.yaml` (set via `aifabrix login` or `aifabrix auth config`).

**Prerequisites:**
- Must be logged in: `aifabrix login`
- System must exist in the dataplane
- Dataplane permission: **external-system:read**

**Process:**
1. Gets dataplane URL from controller
2. Downloads system configuration from dataplane API: `GET /api/v1/external/systems/{systemKey}/config`
3. Downloads datasource configurations
4. Validates downloaded data against schemas
5. Creates `integration/<system-key>/` folder structure
6. Generates development files:
   - `<system-key>-deploy.json` - Deployment manifest (single file with inline system + datasources)
   - `application.yaml` - Application configuration with externalIntegration block
   - `env.template` - Environment variables template
   - `README.md` - Documentation with setup instructions

**Note:** The downloaded `<system-key>-deploy.json` can be split into component files using `aifabrix split-json <system-key>`, which creates:
   - `<system-key>-system.yaml` - External system definition
   - `<system-key>-datasource-<datasource-key>.yaml` - Datasource files (one per datasource)

**Output:**
```yaml
📥 Downloading external system 'hubspot' from dataplane...

🔐 Getting authentication...
✓ Authentication successful
🌐 Getting dataplane URL from controller...
✓ Dataplane URL: https://dataplane.aifabrix.dev

📥 Downloading system configuration...
✓ System configuration downloaded
📥 Downloading datasources...
✓ Downloaded 3 datasource(s)

📝 Generating development files...
✓ Created integration/hubspot/hubspot-deploy.json
✓ Created integration/hubspot/application.yaml
✓ Created integration/hubspot/env.template
✓ Created integration/hubspot/README.md

💡 Tip: Split the deployment manifest into component files:
   aifabrix split-json hubspot
   # Creates: hubspot-system.yaml, hubspot-datasource-*.yaml

✅ External system downloaded successfully!
   Location: integration/hubspot/
```

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
- **"Not logged in"** → Run `aifabrix login` first
- **"System not found"** → Check system key exists in the dataplane
- **"Failed to download system"** → Check dataplane URL, authentication, and network connection
- **"Partial download failed"** → Some datasources may have failed; check error messages
- **"Validation failed"** → Downloaded data doesn't match expected schema

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

**What:** Uploads the full manifest to the dataplane using the pipeline **upload → validate → publish** flow. No controller deploy: the controller is used only to resolve the dataplane URL and authentication. The dataplane does **not** deploy RBAC to the controller—RBAC stays in the dataplane; promote to the full platform later via the web UI or `aifabrix deploy <app>`.

**When:** Test the full system on the dataplane without promoting; or when you have only dataplane access or limited controller permissions (e.g. no `applications:deploy` on the controller).

**When MCP/OpenAPI docs are available:** After publish (via upload or deploy), the dataplane serves MCP and OpenAPI docs at standard URLs. See [Controller and Dataplane: What, Why, When](../deploying.md#controller-and-dataplane-what-why-when).

**Usage:**
```bash
# Upload to dataplane (uses controller and environment from config)
aifabrix upload my-hubspot

# Validate and build payload only; no API calls
aifabrix upload my-hubspot --dry-run

# Use a specific dataplane URL
aifabrix upload my-hubspot --dataplane https://dataplane.example.com
```

**Arguments:** `<system-key>` – External system key (same as `integration/<system-key>/`).

**Options:**
- `--dry-run` – Validate locally and build payload only; no API calls
- `--dataplane <url>` – Dataplane URL (default: discovered from controller)

**Prerequisites:**
- Login or app credentials for the system: `aifabrix login` or `aifabrix app register <system-key>`
- `integration/<system-key>/` with valid `application.yaml` and system/datasource files

**Process:**
1. Validate locally (`validateExternalSystemComplete`)
2. Build payload from controller manifest (system with RBAC + datasources) → `{ version, application, dataSources }`
3. Resolve dataplane URL and auth (from controller + environment)
4. `POST /api/v1/pipeline/upload` → get upload ID
5. `POST /api/v1/pipeline/upload/{id}/validate` → on failure, show validation errors and exit
6. `POST /api/v1/pipeline/upload/{id}/publish`

**Output example:**
```text
Uploading external system to dataplane: my-hubspot
Validation passed.
Resolving dataplane URL...
Dataplane: https://dataplane.example.com

Upload validated and published to dataplane.
Environment: dev
System: my-hubspot
Dataplane: https://dataplane.example.com
```

**Issues / next steps:**
- **Validation failed** – Fix errors shown (e.g. missing `application.yaml`, invalid system/datasource files) then run again.
- **Authentication required** – Run `aifabrix login` or `aifabrix app register <system-key>`.
- The system is available only on this dataplane until you run `aifabrix deploy <app>` (or promote via the web interface).

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
5. Calls dataplane API: `DELETE /api/v1/external/systems/{systemKey}`
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
- To recreate: Use `aifabrix create <system-key> --type external` or `aifabrix wizard`

---

<a id="aifabrix-test-app"></a>
## aifabrix test <app>

Run unit tests for external system (local validation, no API calls).

**What:** Validates external system configuration locally without making API calls. Tests JSON syntax, schema validation, field mapping expressions, metadata schemas, and relationships. Uses test payloads from datasource configuration if available.

**When:** Before deploying changes, validating configuration locally, or testing field mappings without network access.

**Usage:**
```bash
# Test entire external system
aifabrix test hubspot

# Test specific datasource only
aifabrix test hubspot --datasource hubspot-company

# Verbose output with detailed validation
aifabrix test hubspot --verbose
```

**Arguments:**
- `<app>` - Application name (external system)

**Options:**
- `-d, --datasource <key>` - Test specific datasource only
- `-v, --verbose` - Show detailed validation output

**Process:**
1. Loads and validates `application.yaml` syntax
2. Loads and validates system JSON file(s) against `external-system.schema.json`
3. Loads and validates datasource JSON file(s) against `external-datasource.schema.json`
4. If `testPayload.payloadTemplate` exists in datasource:
   - Validates metadata schema against test payload
   - Tests field mapping expressions (mock transformer, no real API calls)
   - Compares with `expectedResult` if provided
5. Validates relationships (systemKey matches, entityKey consistency)
6. Returns structured test results

**Validation Checks:**
- JSON syntax validation
- Schema validation (external-system.schema.json, external-datasource.schema.json)
- Field mapping expression syntax validation:
  - Validates pipe-based DSL syntax: `{{path.to.field}} | toUpper | trim`
  - Ensures path is wrapped in `{{}}`
  - Validates transformation names (toUpper, toLower, trim, default, toNumber, etc.)
  - Checks for proper pipe separator `|`
- Metadata schema validation against test payload
- Required fields presence
- Relationship validation (systemKey, entityKey)

**See Also:** [Validation Commands](validation.md) - Complete validation documentation including schema details, validation flow, and error formatting.

**Output (success):**
```yaml
🧪 Running unit tests for 'hubspot'...

✓ Application configuration is valid
✓ System configuration is valid (hubspot-system.yaml)
✓ Datasource configuration is valid (hubspot-datasource-company.yaml)
✓ Datasource configuration is valid (hubspot-datasource-contact.yaml)
✓ Datasource configuration is valid (hubspot-datasource-deal.yaml)

Field Mapping Tests:
  ✓ hubspot-company: All field mappings valid
  ✓ hubspot-contact: All field mappings valid
  ✓ hubspot-deal: All field mappings valid

Metadata Schema Tests:
  ✓ hubspot-company: Metadata schema valid against test payload
  ✓ hubspot-contact: Metadata schema valid against test payload
  ✓ hubspot-deal: Metadata schema valid against test payload

✅ All tests passed!
```

**Output (failure):**
```yaml
🧪 Running unit tests for 'hubspot'...

✓ Application configuration is valid
✓ System configuration is valid (hubspot-system.yaml)
✗ Datasource configuration has errors (hubspot-datasource-company.yaml):
  • Field mapping expression invalid: '{{properties.name.value | trim' (missing closing brace)
  • Metadata schema validation failed: Field 'country' not found in test payload

Field Mapping Tests:
  ✗ hubspot-company: 1 field mapping error(s)

❌ Tests failed!
```

**Test Payload Configuration:**
Test payloads are configured in datasource JSON files using the `testPayload` property:

```json
{
  "key": "hubspot-company",
  "testPayload": {
    "payloadTemplate": {
      "properties": {
        "name": { "value": "Acme Corp" },
        "country": { "value": "us" }
      }
    },
    "expectedResult": {
      "name": "Acme Corp",
      "country": "US"
    }
  }
}
```

**Issues:**
- **"App name is required"** → Provide application name as argument
- **"Application not found"** → Check application exists in `integration/<app>/`
- **"Validation failed"** → Fix errors reported in test output
- **"Test payload not found"** → Add `testPayload` to datasource configuration or use `--datasource` to test specific datasource
- **"Field mapping expression invalid"** → Check expression syntax: `{{path}} | transformation`

**Next Steps:**
After unit tests:
- Fix any validation errors
- Run integration tests: `aifabrix test-integration <app>`
- Deploy validated configuration: `aifabrix deploy <app>`

---

<a id="aifabrix-test-integration-app"></a>
## aifabrix test-integration <app>

Run integration tests via dataplane pipeline API. Requires Dataplane access (authenticated; pipeline test endpoint). See [Online Commands and Permissions](permissions.md).

**What:** Tests external system configuration by calling the dataplane pipeline test API. Validates field mappings, metadata schemas, and endpoint connectivity using real API calls. Requires dataplane access and authentication. Includes online validation of ABAC dimensions against the Dimension Catalog.

**When:** After unit tests pass, validating against real dataplane, or testing endpoint connectivity before deployment.

**See Also:** [Validation Commands](validation.md) - Complete validation documentation including online ABAC dimension validation.

This command uses the active `controller` and `environment` from `config.yaml` (set via `aifabrix login` or `aifabrix auth config`). The dataplane URL is always discovered from the controller.

**Usage:**
```bash
# Test entire external system
aifabrix test-integration hubspot

# Test specific datasource only
aifabrix test-integration hubspot --datasource hubspot-company

# Use custom test payload file
aifabrix test-integration hubspot --payload ./test-payload.json

# Verbose output with detailed results
aifabrix test-integration hubspot --verbose

# Custom timeout
aifabrix test-integration hubspot --timeout 60000
```

**Arguments:**
- `<app>` - Application name (external system)

**Options:**
- `-d, --datasource <key>` - Test specific datasource only
- `-p, --payload <file>` - Path to custom test payload file (overrides datasource testPayload)
- `-v, --verbose` - Show detailed test output
- `--timeout <ms>` - Request timeout in milliseconds (default: 30000)

**Prerequisites:**
- Must be logged in: `aifabrix login`
- Dataplane must be accessible
- System must exist in dataplane (or be ready for testing)

**Process:**
1. Gets dataplane URL from controller
2. For each datasource (or specified one):
   - Loads test payload from datasource config (`testPayload.payloadTemplate`) or from `--payload` file
   - Calls dataplane pipeline API: `POST /api/v1/pipeline/{systemKey}/{datasourceKey}/test`
   - Request body: `{ "payloadTemplate": <testPayload> }`
   - Parses response with validation results, field mapping results, endpoint test results
3. Displays results for each datasource
4. Returns aggregated results

**Response Handling:**
- Parses `validationResults` (isValid, errors, warnings, normalizedMetadata)
- Parses `fieldMappingResults` (dimensions, mappedFields, mappingCount)
- Parses `endpointTestResults` (endpointConfigured, connectivity status)

**Output (success):**
```yaml
🧪 Running integration tests for 'hubspot' via dataplane...

🔐 Getting authentication...
✓ Authentication successful
🌐 Getting dataplane URL from controller...
✓ Dataplane URL: https://dataplane.aifabrix.dev

Testing datasource: hubspot-company
  ✓ Validation: passed
  ✓ Field mappings: 5 fields mapped successfully
  ✓ Endpoint connectivity: connected
  ✓ Metadata schema: valid

Testing datasource: hubspot-contact
  ✓ Validation: passed
  ✓ Field mappings: 8 fields mapped successfully
  ✓ Endpoint connectivity: connected
  ✓ Metadata schema: valid

Testing datasource: hubspot-deal
  ✓ Validation: passed
  ✓ Field mappings: 6 fields mapped successfully
  ✓ Endpoint connectivity: connected
  ✓ Metadata schema: valid

✅ All integration tests passed!
```

**Output (failure):**
```yaml
🧪 Running integration tests for 'hubspot' via dataplane...

🔐 Getting authentication...
✓ Authentication successful
🌐 Getting dataplane URL from controller...
✓ Dataplane URL: https://dataplane.aifabrix.dev

Testing datasource: hubspot-company
  ✗ Validation: failed
    • Field 'country' not found in payload
  ✗ Field mappings: 3 of 5 fields mapped successfully
  ✓ Endpoint connectivity: connected
  ✗ Metadata schema: invalid

❌ Integration tests failed!
```

**Test Payload:**
Test payloads can be:
1. From datasource configuration (`testPayload.payloadTemplate`)
2. From custom file (`--payload` flag)
3. Generated automatically if not provided (basic structure)

**Retry Logic:**
The command includes automatic retry logic for transient API failures:
- 3 retries with exponential backoff
- Retries on network errors, timeouts, and 5xx server errors

**Issues:**
- **"App name is required"** → Provide application name as argument
- **"Not logged in"** → Run `aifabrix login` first
- **"Dataplane URL not found"** → Check controller configuration and that the controller can provide a dataplane URL
- **"Test payload not found"** → Add `testPayload` to datasource configuration or use `--payload` flag
- **"API call failed"** → Check dataplane URL, authentication, and network connection
- **"Request timeout"** → Increase timeout with `--timeout` flag or check network connection
- **"Validation failed"** → Fix errors reported in test output

**Next Steps:**
After integration tests:
- Fix any validation or connectivity errors
- Re-run unit tests: `aifabrix test <app>`
- Deploy validated configuration: `aifabrix deploy <app>`

---

<a id="aifabrix-datasource"></a>
## aifabrix datasource

Manage external data sources.

**What:** Command group for managing external datasource configurations. Includes validation, listing, comparison, and deployment operations for datasources that integrate with external systems.

**Subcommands:**
- `validate` - Validate external datasource JSON file
- `list` - List datasources from environment
- `diff` - Compare two datasource configuration files
- `deploy` - Deploy datasource to dataplane

**When:** Managing external integrations, deploying datasource configurations, or validating datasource schemas.

**See Also:**
- [aifabrix datasource validate](#aifabrix-datasource-validate-file)
- [aifabrix datasource list](#aifabrix-datasource-list)
- [aifabrix datasource diff](#aifabrix-datasource-diff-file1-file2)
- [aifabrix datasource deploy](#aifabrix-datasource-deploy-myapp-file)

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
- Deploy validated datasource: `aifabrix datasource deploy <app> <file>`

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
2. Calls controller API: `GET /api/v1/environments/{env}/datasources`
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
- Deploy datasource: `aifabrix datasource deploy <app> <file>`
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
- Deploy updated datasource: `aifabrix datasource deploy <app> <file2>`

---

<a id="aifabrix-datasource-deploy-myapp-file"></a>
### aifabrix datasource deploy <myapp> <file>

Deploy datasource to dataplane. Requires Dataplane access (authenticated; pipeline publish). See [Online Commands and Permissions](permissions.md).

**What:** Validates and deploys an external datasource configuration to the dataplane via the Miso Controller. Gets dataplane URL from controller, then deploys datasource configuration.

**When:** Deploying new datasource, updating existing datasource, or pushing datasource configuration changes to dataplane.

This command uses the active `controller` and `environment` from `config.yaml` (set via `aifabrix login` or `aifabrix auth config`). The dataplane URL is always discovered from the controller.

**Usage:**
```bash
# Deploy datasource to dataplane
aifabrix datasource deploy myapp ./schemas/hubspot-deal.yaml
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
6. Publishes datasource to dataplane:
   - POST to `http://<dataplane-url>/api/v1/pipeline/{systemKey}/publish`
   - Sends datasource configuration as request body
7. Displays deployment results

**Output:**
```yaml
📋 Deploying datasource...

🔍 Validating datasource file...
✓ Datasource file is valid
🔐 Getting authentication...
✓ Authentication successful
🌐 Getting dataplane URL from controller...
✓ Dataplane URL: https://dataplane.aifabrix.dev

🚀 Publishing datasource to dataplane...

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
- **"Deployment failed"** → Check dataplane URL, authentication, and network connection

**Next Steps:**
After deployment:
- Verify datasource: `aifabrix datasource list`
- Check datasource status in controller dashboard
- Monitor dataplane for datasource activity

