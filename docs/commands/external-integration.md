# External Integration Commands

← [Back to Commands Index](README.md) | [Back to Quick Start](../quick-start.md)

Commands for creating, testing, and managing external system integrations.

---

## aifabrix wizard

Interactive wizard for creating external systems.

**What:** Provides an interactive guided workflow for creating external system integrations. The wizard acts as a thin wrapper around the dataplane wizard API - all wizard logic (parsing, type detection, AI generation, validation) is handled by the dataplane server.

**When:** Use when creating new external systems or adding datasources to existing systems. The wizard helps you:
- Create new external systems from OpenAPI specifications
- Add datasources to existing systems
- Generate configurations automatically using AI
- Validate configurations before deployment

**Usage:**
```bash
# Interactive wizard (will prompt for app name)
aifabrix wizard

# Wizard with app name
aifabrix wizard --app my-integration

# Wizard with controller and environment
aifabrix wizard --app my-integration --controller https://controller.example.com --environment dev

# Wizard with direct dataplane URL
aifabrix wizard --app my-integration --dataplane https://dataplane.example.com
```

**Options:**
- `-a, --app <app>` - Application name (if not provided, will prompt)
- `-c, --controller <url>` - Controller URL
- `-e, --environment <env>` - Environment (dev, tst, pro), default: dev
- `--dataplane <url>` - Dataplane URL (overrides controller lookup)

**Wizard Flow:**
1. **Mode Selection** - Create new system or add datasource
2. **Source Selection** - OpenAPI file/URL, MCP server, or known platform
3. **Parse OpenAPI** - Parse specification (if applicable)
4. **Detect Type** - Automatically detect API type and category
5. **User Preferences** - Configure intent and features (MCP, ABAC, RBAC)
6. **Generate Config** - AI-powered configuration generation
7. **Review & Validate** - Review and optionally edit configurations
8. **Save Files** - Save all files to `integration/<app-name>/`

**Files Created:**
- `variables.yaml` - Application variables and external integration configuration
- `<systemKey>-deploy.json` - System configuration
- `<systemKey>-deploy-*.json` - Datasource configurations
- `env.template` - Environment variable template
- `README.md` - Documentation
- `application-schema.json` - Single deployment file

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
```

**See Also:**
- [Wizard Guide](../wizard.md) - Detailed wizard documentation
- [External Systems Guide](../external-systems.md) - Manual external system creation

---

## aifabrix download <system-key>

Download external system from dataplane to local development structure.

**What:** Downloads an external system configuration and all its datasources from the dataplane API to a local development folder structure. Creates all necessary files for local development and testing.

**When:** Setting up local development for an existing external system, cloning a system from another environment, or retrieving a system configuration for modification.

**Usage:**
```bash
# Download external system from dataplane
aifabrix download hubspot --environment dev

# Download with custom controller URL
aifabrix download hubspot --environment dev --controller https://controller.aifabrix.ai

# Dry run to see what would be downloaded
aifabrix download hubspot --environment dev --dry-run
```

**Arguments:**
- `<system-key>` - External system key (identifier)

**Options:**
- `-e, --environment <env>` - Environment (dev, tst, pro) (default: dev)
- `-c, --controller <url>` - Controller URL (optional, uses configured controller if not provided)
- `--dry-run` - Show what would be downloaded without actually downloading

**Prerequisites:**
- Must be logged in: `aifabrix login --method device --environment <env>`
- System must exist in the dataplane

**Process:**
1. Gets dataplane URL from controller
2. Downloads system configuration from dataplane API: `GET /api/v1/external/systems/{systemKey}/config`
3. Downloads datasource configurations
4. Validates downloaded data against schemas
5. Creates `integration/<system-key>/` folder structure
6. Generates development files:
   - `variables.yaml` - Application configuration with externalIntegration block
   - `<system-key>-deploy.json` - External system definition
   - `<system-key>-deploy-<entity>.json` - Datasource files (one per entity)
   - `env.template` - Environment variables template
   - `README.md` - Documentation with setup instructions

**Output:**
```yaml
📥 Downloading external system 'hubspot' from dataplane...

🔐 Getting authentication...
✓ Authentication successful
🌐 Getting dataplane URL from controller...
✓ Dataplane URL: https://dataplane.aifabrix.ai

📥 Downloading system configuration...
✓ System configuration downloaded
📥 Downloading datasources...
✓ Downloaded 3 datasource(s)

📝 Generating development files...
✓ Created integration/hubspot/variables.yaml
✓ Created integration/hubspot/hubspot-deploy.json
✓ Created integration/hubspot/hubspot-deploy-company.json
✓ Created integration/hubspot/hubspot-deploy-contact.json
✓ Created integration/hubspot/hubspot-deploy-deal.json
✓ Created integration/hubspot/env.template
✓ Created integration/hubspot/README.md

✅ External system downloaded successfully!
   Location: integration/hubspot/
```

**File Structure:**
```text
integration/
  <system-key>/
    variables.yaml                    # App configuration with externalIntegration block
    <system-key>-deploy.json         # External system definition
    <system-key>-deploy-<entity1>.json  # Datasource 1
    <system-key>-deploy-<entity2>.json  # Datasource 2
    env.template                     # Environment variables template
    README.md                        # Documentation
```

**Issues:**
- **"System key is required"** → Provide system key as argument
- **"Not logged in"** → Run `aifabrix login --method device --environment <env>` first
- **"System not found"** → Check system key exists in the dataplane
- **"Failed to download system"** → Check dataplane URL, authentication, and network connection
- **"Partial download failed"** → Some datasources may have failed; check error messages
- **"Validation failed"** → Downloaded data doesn't match expected schema

**Next Steps:**
After downloading:
- Review configuration files in `integration/<system-key>/`
- Run unit tests: `aifabrix test <system-key>`
- Run integration tests: `aifabrix test-integration <system-key>`
- Deploy changes: `aifabrix deploy <system-key>`

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
1. Loads and validates `variables.yaml` syntax
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

**Output (success):**
```yaml
🧪 Running unit tests for 'hubspot'...

✓ Application configuration is valid
✓ System configuration is valid (hubspot-deploy.json)
✓ Datasource configuration is valid (hubspot-deploy-company.json)
✓ Datasource configuration is valid (hubspot-deploy-contact.json)
✓ Datasource configuration is valid (hubspot-deploy-deal.json)

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
✓ System configuration is valid (hubspot-deploy.json)
✗ Datasource configuration has errors (hubspot-deploy-company.json):
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

Run integration tests via dataplane pipeline API.

**What:** Tests external system configuration by calling the dataplane pipeline test API. Validates field mappings, metadata schemas, and endpoint connectivity using real API calls. Requires dataplane access and authentication.

**When:** After unit tests pass, validating against real dataplane, or testing endpoint connectivity before deployment.

**Usage:**
```bash
# Test entire external system
aifabrix test-integration hubspot --environment dev

# Test specific datasource only
aifabrix test-integration hubspot --environment dev --datasource hubspot-company

# Use custom test payload file
aifabrix test-integration hubspot --environment dev --payload ./test-payload.json

# Verbose output with detailed results
aifabrix test-integration hubspot --environment dev --verbose

# Custom timeout
aifabrix test-integration hubspot --environment dev --timeout 60000
```

**Arguments:**
- `<app>` - Application name (external system)

**Options:**
- `-d, --datasource <key>` - Test specific datasource only
- `-p, --payload <file>` - Path to custom test payload file (overrides datasource testPayload)
- `-e, --environment <env>` - Environment (dev, tst, pro) (default: dev)
- `-c, --controller <url>` - Controller URL (optional)
- `-v, --verbose` - Show detailed test output
- `--timeout <ms>` - Request timeout in milliseconds (default: 30000)

**Prerequisites:**
- Must be logged in: `aifabrix login --method device --environment <env>`
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
✓ Dataplane URL: https://dataplane.aifabrix.ai

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
✓ Dataplane URL: https://dataplane.aifabrix.ai

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
- **"Not logged in"** → Run `aifabrix login --method device --environment <env>` first
- **"Environment is required"** → Provide `--environment` flag (dev/tst/pro)
- **"Dataplane URL not found"** → Check controller configuration and network connection
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

**Usage:**
```bash
# Validate datasource file
aifabrix datasource validate ./schemas/hubspot-deal.json

# Validate with relative path
aifabrix datasource validate schemas/my-datasource.json
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
✓ Datasource file is valid: ./schemas/hubspot-deal.json
```

**Output (invalid):**
```yaml
✗ Datasource file has errors: ./schemas/hubspot-deal.json
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

---

<a id="aifabrix-datasource-list"></a>
### aifabrix datasource list

List datasources from environment.

**What:** Lists all datasources registered in an environment via the Miso Controller API. Displays datasource key, display name, system key, version, and status.

**When:** Viewing available datasources, checking datasource status, or auditing environment configuration.

**Usage:**
```bash
# List datasources in environment
aifabrix datasource list --environment dev

# List datasources in production
aifabrix datasource list --environment pro
```

**Options:**
- `-e, --environment <env>` - Environment ID or key (required)

**Prerequisites:**
- Must be logged in: `aifabrix login --method device --environment <env>`

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
- **"Not logged in"** → Run `aifabrix login --method device --environment <env>` first
- **"Environment is required"** → Provide `--environment` flag (miso/dev/tst/pro)
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

**What:** Compares two datasource JSON files and highlights differences, with special focus on dataplane-relevant fields (fieldMappings, exposed fields, sync configuration, OpenAPI, MCP).

**When:** Before deploying datasource updates, validating schema migrations, or reviewing configuration changes for dataplane deployment.

**Usage:**
```bash
# Compare two datasource versions
aifabrix datasource diff ./schemas/hubspot-deal-v1.json ./schemas/hubspot-deal-v2.json

# Compare datasource configurations
aifabrix datasource diff ./old-datasource.json ./new-datasource.json
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
Comparing: hubspot-deal-v1.json ↔ hubspot-deal-v2.json

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

Deploy datasource to dataplane.

**What:** Validates and deploys an external datasource configuration to the dataplane via the Miso Controller. Gets dataplane URL from controller, then deploys datasource configuration.

**When:** Deploying new datasource, updating existing datasource, or pushing datasource configuration changes to dataplane.

**Usage:**
```bash
# Deploy datasource to dataplane
aifabrix datasource deploy myapp ./schemas/hubspot-deal.json \
  --controller https://controller.aifabrix.ai \
  --environment dev
```

**Arguments:**
- `<myapp>` - Application key
- `<file>` - Path to datasource JSON file

**Options:**
- `--controller <url>` - Controller URL (required)
- `-e, --environment <env>` - Environment (miso, dev, tst, pro) (required)

**Prerequisites:**
- Application must be registered: `aifabrix app register <myapp> --environment <env>`
- Must be logged in or have credentials in secrets.local.yaml
- Datasource file must be valid

**Process:**
1. Validates datasource file against schema
2. Loads datasource configuration
3. Extracts systemKey from configuration
4. Gets authentication (device token or client credentials)
5. Gets dataplane URL from controller API
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
✓ Dataplane URL: https://dataplane.aifabrix.ai

🚀 Publishing datasource to dataplane...

✓ Datasource published successfully!

Datasource: hubspot-deal
System: hubspot
Environment: dev
```

**Issues:**
- **"Application key is required"** → Provide application key as first argument
- **"File path is required"** → Provide path to datasource file
- **"Controller URL is required"** → Provide `--controller` flag
- **"Environment is required"** → Provide `-e, --environment` flag
- **"File not found"** → Check datasource file path is correct
- **"Datasource validation failed"** → Fix validation errors in datasource file
- **"systemKey is required"** → Add systemKey field to datasource configuration
- **"Not logged in"** → Run `aifabrix login` first
- **"Failed to get application from controller"** → Check application is registered and controller URL is correct
- **"Dataplane URL not found"** → Application may not have dataplane configured
- **"Deployment failed"** → Check dataplane URL, authentication, and network connection

**Next Steps:**
After deployment:
- Verify datasource: `aifabrix datasource list --environment <env>`
- Check datasource status in controller dashboard
- Monitor dataplane for datasource activity

