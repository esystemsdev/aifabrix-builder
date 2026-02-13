# External System Wizard

← [Documentation index](README.md)

## Overview

The AI Fabrix External System Wizard provides an interactive guided workflow for creating external system integrations. The wizard acts as a thin wrapper around the dataplane wizard API - all wizard logic (parsing, type detection, AI generation, validation) is handled by the dataplane server.

The wizard helps you:
- Create new external systems from OpenAPI specifications
- Add datasources to existing systems
- Generate configurations automatically using AI
- Validate configurations before deployment
- Support headless mode via `--config <file>` or `--silent` (with app name and existing `wizard.yaml`) for automated/non-interactive runs

The wizard produces configuration that you then **deploy** (via the controller) or **upload** (to the dataplane); after publish, MCP and OpenAPI docs are available from the dataplane. See [Controller and Dataplane: What, Why, When](deploying.md#controller-and-dataplane-what-why-when) for details.

## Quick Start

### Command options

| Option | Description |
|--------|-------------|
| `[appName]` or `-a, --app <app>` | Application/integration key. When set, the wizard uses `integration/<appName>/wizard.yaml` for load/save and `error.log`. |
| `--config <file>` | Run headless using the given wizard config file (any path). Skips all prompts. |
| `--silent` | Run headless using **only** `integration/<appName>/wizard.yaml` (requires app name). No prompts; file must exist and be valid. |

### Interactive Mode

Run the wizard command (mode is asked first, then app name or system for add-datasource):

```bash
aifabrix wizard
```

Or with an app name (loads `integration/<appName>/wizard.yaml` if present; saves state and errors there):

```bash
aifabrix wizard my-integration
# or
aifabrix wizard -a my-integration
```

If `integration/<appName>/wizard.yaml` exists and is valid, the wizard shows a short summary and asks **Run with saved config?** — choose **Yes** to run headless with that config, or **No** to be told to edit the file and run `aifabrix wizard <appName>` again.

You can also use the wizard when creating an external system:

```bash
aifabrix create my-integration --type external --wizard
```

### Headless Mode (Non-Interactive)

For automated deployments you can run without prompts in two ways:

**1. Config file (any path):**

```bash
aifabrix wizard --config wizard.yaml
```

This mode skips all prompts and uses values from the specified configuration file.

**2. Silent mode (app-based wizard.yaml):**

```bash
aifabrix wizard my-integration --silent
```

This runs headless using **only** `integration/my-integration/wizard.yaml`. No prompts are shown. The file must exist and be valid; otherwise the command fails with a clear error. Use this in CI/CD when the app folder already has a complete `wizard.yaml`.

### Config Path and Resume

- When you provide an app name (e.g. `aifabrix wizard my-integration`), the wizard uses the folder `integration/my-integration/` for:
  - **wizard.yaml** – Loaded at start if it exists. If valid, a summary is shown and you are asked **Run with saved config?** (Yes = run headless with that config; No = exit with a message to edit the file and run again). Saved on success or on error (partial state).
  - **error.log** – Errors are appended here (timestamp + message; validation details from the API are included when available; no secrets).
- To resume after an error: run `aifabrix wizard <appKey>` again. The CLI will show: `To resume: aifabrix wizard <appKey>` and `See integration/<appKey>/error.log for details.`

## Wizard Workflow

The wizard asks **mode first** (before app name or dataplane), then creates a session and follows the dataplane API workflow:

```yaml
Step 1: Mode → Create session   "Create new" → app name; "Add datasource" → system ID/key (validated on dataplane)
Step 2: Source                  OpenAPI file/URL, MCP server, or Known platform (from dataplane when available)
Step 3: Credential              Skip | Create new | Use existing (optional)
Step 4: Detect Type             POST /api/v1/wizard/detect-type
Step 5: User Preferences       Field onboarding level (full|standard|minimal), intent, MCP/ABAC/RBAC → POST /api/v1/wizard/generate-config or generate-config-stream (body: fieldOnboardingLevel, intent, etc.)
Step 6: Review & Validate       Accept and save, or Cancel
Step 7: Save Files              Local file generation; wizard.yaml written to integration/<appKey>/
```

### Step 1: Mode and Create Session

The first question is: **What would you like to do?**
- **Create a new external system** – You are then prompted for application name (or it is taken from `aifabrix wizard <appName>`). The folder `integration/<appKey>/` is created and used for wizard.yaml and error.log.
- **Add datasource to existing system** – You are prompted for the existing system ID or key. The builder validates that the system exists on the dataplane (and re-prompts if not). The integration folder is derived from the system key.

After that, a wizard session is created via `POST /api/v1/wizard/sessions`.

### Step 2: Source Selection

Select your source type; then the wizard parses OpenAPI or tests the connection as needed:
- **OpenAPI file** – Local OpenAPI specification file
- **OpenAPI URL** – Remote OpenAPI specification URL
- **MCP server** – Model Context Protocol server
- **Known platform** – Pre-configured platform. The wizard **automatically detects Known Platforms** from your **dataplane template library** (`GET /api/v1/wizard/platforms` when available). Templates are **environment-specific**—the list may vary by environment or dataplane. If the endpoint is missing or returns an empty list, the "Known platform" choice is hidden.

### Step 3: Credential Selection (Optional)

Configure credentials for the external system:
- **Skip** – No credentials yet; you can add them later in `env.template` or via the dataplane. Choose this if you don't have test credentials.
- **Create** – Create a new credential on the dataplane
- **Use existing** – Select or enter a credential ID or key that exists on the dataplane. The wizard can **list** credentials for selection:
  - **Dataplane API:** `GET /api/v1/wizard/credentials` (optional query e.g. `activeOnly=true`) returns credentials for "Use existing". Documented in the Dataplane Wizard API table below.
  - **CLI:** Run `aifabrix credential list` to list credentials from the controller/dataplane (`GET /api/v1/credential`). Use the same controller URL and login as for other CLI commands.

**Validation:** The dataplane validates credentials when you choose "Use existing" (POST `/api/v1/wizard/credential-selection`). If the credential is not found or invalid, the wizard re-prompts for another ID/key or lets you leave the field empty to skip.

### Step 4: Detect API Type

The wizard automatically detects:
- API type (record-based, document-storage, etc.)
- Confidence scores for each detected type
- Recommended type based on analysis

**Detected Types**: `record-based` (CRUD operations), `document-storage` (file/folder operations), `sharepoint` (SharePoint-specific), `teams-meetings` (Teams/Graph API patterns), `crm`, `project-management`, `communication`, `e-commerce`, `calendar`, `email`, `help-desk`, `accounting`, `hr`, `custom`.

### Step 5: User Preferences & Generate Configuration

**User preferences (Step 5):**
- **Field onboarding level** – String, default: `"full"`. Enum: `full` \| `standard` \| `minimal`.
  - **full** – All fields mapped and indexed
  - **standard** – Core and important fields only
  - **minimal** – Essential fields only
- User intent (any descriptive text)
- MCP, ABAC, RBAC toggles

The value is saved in `wizard.yaml` under `preferences.fieldOnboardingLevel` and sent in the REST request body when calling `POST /api/v1/wizard/generate-config` or `POST /api/v1/wizard/generate-config-stream` as `fieldOnboardingLevel` (e.g. `fieldOnboardingLevel: "full"`).

The wizard then uses AI to generate configurations based on:
- OpenAPI specification structure
- Detected API type
- User intent (any descriptive text)
- User preferences (MCP, ABAC, RBAC)
- Field onboarding level (full/standard/minimal)

**Intent:** The `intent` parameter helps the AI generate a better integration manifest. You can describe your goals and any special integration requirements (e.g. "sales-focused CRM integration", "customer management with custom fields"). It accepts any descriptive text and is not limited to specific enum values. See [External Systems](external-systems.md) for configuration and manifest details.

### Step 6: Validate Configuration

Validates all generated configurations against:
- External system schema
- External datasource schema
- Application schema

Returns validation errors and warnings.

**See Also:** [Validation Commands](commands/validation.md) - Complete validation documentation including schema details and validation principles.

### Step 7: Save Files

The wizard saves all files to `integration/<appKey>/`:
- `wizard.yaml` - Saved wizard state (loaded on resume; saved on success or on error as partial state)
- `error.log` - Errors appended here (timestamp + message; validation details when the API returns them)
- `application.yaml` - Application variables and external integration configuration
- `<systemKey>-system.yaml` - System configuration
- `<systemKey>-datasource-*.jsyamlon` - Datasource configurations
- `env.template` - Environment variable template
- `README.md` - Documentation (AI-generated from dataplane when available)
- `<systemKey>-deploy.json` - Single deployment file
- `deploy.js` - Node deployment script (run `node deploy.js` for full flow)

## Headless Mode Configuration (wizard.yaml)

The wizard **includes deployment** configuration so you can target a specific controller and environment. For automated or targeted runs, set **`deployment.controller`** (and optionally `deployment.environment`, `deployment.dataplane`) in `wizard.yaml`.

For automated deployments, use a `wizard.yaml` file. When running interactively with an app name (e.g. `aifabrix wizard my-integration`), the wizard reads and writes `integration/my-integration/wizard.yaml` for load/save and resume.

Example location: `integration/<appKey>/wizard.yaml`

```yaml
# wizard.yaml - Headless configuration for external system wizard

# Required: Application name (lowercase alphanumeric with hyphens/underscores)
appName: my-integration

# Required: Wizard mode
mode: create-system  # 'create-system' | 'add-datasource'

# Required when mode='add-datasource'
# systemIdOrKey: existing-system-key

# Required: Source configuration
source:
  type: openapi-file  # 'openapi-file' | 'openapi-url' | 'mcp-server' | 'known-platform'
  
  # For openapi-file:
  filePath: ./path/to/openapi.yaml
  
  # For openapi-url:
  # url: https://api.example.com/openapi.json
  
  # For mcp-server:
  # serverUrl: https://mcp.example.com
  # token: ${MCP_TOKEN}  # Supports environment variable references
  
  # For known-platform:
  # platform: hubspot  # 'hubspot' | 'salesforce' | 'zendesk' | 'slack' | 'microsoft365'

# Optional: Credential configuration
credential:
  action: skip  # 'create' | 'select' | 'skip'
  # For action='select':
  # credentialIdOrKey: my-credential
  # For action='create':
  # config:
  #   key: my-oauth
  #   displayName: My OAuth
  #   type: OAUTH2
  #   config: {}

# Optional: Generation preferences
preferences:
  intent: "sales-focused CRM integration"  # Any descriptive text
  fieldOnboardingLevel: full               # 'full' | 'standard' | 'minimal'
  enableOpenAPIGeneration: true            # boolean
  enableMCP: false                         # Enable Model Context Protocol
  enableABAC: false                        # Enable Attribute-Based Access Control
  enableRBAC: false                        # Enable Role-Based Access Control

# Optional: Override deployment settings (wizard includes deployment; set when targeting a specific controller)
deployment:
  controller: https://controller.example.com   # Required when targeting a specific controller
  environment: dev
  dataplane: https://dataplane.example.com    # Optional: override dataplane lookup
```

### Environment Variable Support

The wizard.yaml supports environment variable references using `${VAR_NAME}` syntax:

```yaml
source:
  type: mcp-server
  serverUrl: https://mcp.example.com
  token: ${MCP_SERVER_TOKEN}
```

Environment variables are resolved at runtime. Missing variables will cause validation to fail.

### Headless Mode Examples

**Create from OpenAPI File:**

```yaml
appName: my-api
mode: create-system
source:
  type: openapi-file
  filePath: ./specs/openapi.yaml
preferences:
  intent: "REST API integration"
  fieldOnboardingLevel: full
```

**Create HubSpot Integration:**

```yaml
appName: hubspot-integration
mode: create-system
source:
  type: known-platform
  platform: hubspot
preferences:
  intent: "CRM integration for sales team"
  enableABAC: true
```

**Add Datasource to Existing System:**

```yaml
appName: existing-system-contacts
mode: add-datasource
systemIdOrKey: existing-system
source:
  type: openapi-url
  url: https://api.example.com/contacts/openapi.json
preferences:
  intent: "Contact management"
  fieldOnboardingLevel: standard
```

## Source Types

### OpenAPI File

Provide a local path to an OpenAPI specification file (YAML or JSON):

```bash
# Interactive: The wizard will prompt for the file path
aifabrix wizard

# Headless
aifabrix wizard --config wizard.yaml
```

The file will be uploaded to the dataplane for parsing.

### OpenAPI URL

Provide a URL to an OpenAPI specification:

```bash
# Interactive: The wizard will prompt for the URL
aifabrix wizard
```

The dataplane will fetch and parse the specification.

### MCP Server

Connect to a Model Context Protocol server:

```bash
# Interactive: The wizard will prompt for server URL and token
aifabrix wizard
```

The wizard will test the connection before proceeding.

### Known Platform

Select from pre-configured platforms (e.g. HubSpot, Salesforce, Zendesk, Slack, Microsoft 365). The wizard **automatically detects Known Platforms** from your **dataplane template library**; the list is **environment-specific** and may vary by environment or dataplane. The wizard uses platform-specific templates and configurations.

## Configuration Generation

The wizard uses AI to generate configurations based on:
- OpenAPI specification structure
- Detected API type and category
- User intent and preferences
- Best practices for external integrations

Generated configurations include:
- System metadata (key, display name, description)
- Authentication configuration
- API endpoint mappings
- Datasource definitions
- Entity relationships
- Field mappings with ABAC dimensions
- CIP pipeline definitions

### Field Onboarding Levels

- **full** - All fields mapped and indexed
- **standard** - Core and important fields only
- **minimal** - Essential fields only

## Validation

All configurations are validated against:
- External system schema
- External datasource schema
- Application schema

Validation errors are displayed before saving files.

**See Also:** [Validation Commands](commands/validation.md) - Complete validation documentation including schema architecture, validation flow, and troubleshooting.

## File Structure

The wizard creates the following file structure:

```yaml
integration/<appKey>/
├── wizard.yaml                    # Saved wizard state (load/save and resume)
├── error.log                      # Errors appended (timestamp + message; validation details when available)
├── application.yaml               # Application variables and external integration config
├── <systemKey>-system.yaml        # System configuration
├── <systemKey>-datasource-*.yaml  # Datasource configurations
├── env.template                   # Environment variable template
├── README.md                      # Documentation (AI-generated from dataplane when available)
├── <systemKey>-deploy.json        # Single deployment file
└── deploy.js                      # Node deployment script (check auth → login → deploy → test)
```

### README.md Generation

The wizard generates files (including `application.yaml` and `<systemKey>-deploy.json`), then calls the dataplane **POST** `/api/v1/wizard/deployment-docs/{systemKey}` with optional `variablesYaml` and `deployJson` in the request body. This produces higher-quality README.md content aligned with the integration folder. If the API is unavailable or returns no content, a basic README.md is used.

## Environment Variables

The wizard generates `env.template` with authentication variables based on the detected authentication type:

- **API Key**: `API_KEY=kv://secrets/api-key`
- **OAuth2**: `CLIENT_ID`, `CLIENT_SECRET`, `AUTH_URL`, `TOKEN_URL`
- **Bearer Token**: `BEARER_TOKEN=kv://secrets/bearer-token`
- **Basic Auth**: `USERNAME`, `PASSWORD`

Update these values in your secrets store before deployment.

## Deployment

After the wizard completes, you can test the integration on the dataplane with **`aifabrix upload <system-key>`** before promoting with **`aifabrix deploy <app>`**. See [External Integration Commands](commands/external-integration.md#aifabrix-upload-system-key). You can also deploy using the generated `deploy.js` script or the CLI directly.

### Using deploy.js

The wizard generates a Node script `deploy.js`. Run it for the full flow:

```bash
cd integration/<appKey>
node deploy.js
```

**What the script does:**
1. **Check auth** – Runs `aifabrix auth status`; if not logged in, runs `aifabrix login --environment <env>` so you can complete device or credentials flow.
2. **Validate** – Validates all JSON configuration files.
3. **Deploy** – Runs `aifabrix deploy <appKey>` to send the deployment to the Miso Controller.
4. **Run integration tests** – Runs `aifabrix test-integration <appKey>` (unless `RUN_TESTS=false`).

Controller URL and environment come from config (`aifabrix auth config`) or from `CONTROLLER` and `ENVIRONMENT` environment variables. You can extend the script (e.g. add steps or different test commands).

### Using CLI Directly

You can also deploy using the CLI directly. For external systems in `integration/<appKey>/`, the CLI resolves the app path automatically (integration first, then builder). No app register needed; the controller creates and deploys automatically:

```bash
aifabrix deploy <appKey>
```

## Troubleshooting

### Authentication Required

If you see "Authentication required", run:

```bash
aifabrix login
```

Or register your application:

```bash
aifabrix app register <appKey>
```

### Invalid token or insufficient permissions

When the dataplane returns 401 or 403, the CLI shows:

- The error message from the API
- **Permission details** when the API includes them in the response (e.g. `required.permissions`, `missing.permissions`)

If you see "Invalid token or insufficient permissions", check:

- That you are logged in: `aifabrix auth status`
- That the dataplane accepts your token (device token is validated by the controller; some dataplanes require client credentials)
- When the API returns permission details, the CLI displays **Missing permissions** and **Required permissions** so you can see exactly which permissions the endpoint needs (as documented in the dataplane OpenAPI spec)

To use client credentials, add entries to `~/.aifabrix/secrets.local.yaml` as `<app>-client-idKeyVault` and `<app>-client-secretKeyVault`, or contact your administrator.

### Dataplane URL Not Found

If the wizard cannot find the dataplane URL:
- Ensure your application is registered in the controller
- Check that the environment is correct
- Use `--dataplane <url>` to provide the URL directly

### OpenAPI Parsing Failed

If OpenAPI parsing fails:
- Verify the file is a valid OpenAPI specification
- Check that the file is accessible
- Ensure the OpenAPI version is supported (2.0 or 3.x)

### Configuration Generation Failed

If AI generation fails (e.g. "Request validation failed"):
- The CLI shows validation details when the dataplane returns them (field-level errors, configuration errors). The same details are written to `integration/<appKey>/error.log` (plain text, no ANSI codes) so you can inspect exactly which fields failed.
- Check your dataplane connection
- Verify authentication is working
- Try again (generation may timeout on large specifications)

### Validation Errors

If validation fails:
- Review the error messages (and `integration/<appKey>/error.log` for full validation details when the API returns them)
- Fix the configuration: edit `integration/<appKey>/wizard.yaml` and run `aifabrix wizard <appKey>` again, or re-run the wizard interactively from step 1

For detailed validation information, see [Validation Commands](commands/validation.md).

### Headless Mode Validation Failed

If wizard.yaml validation fails:
- Check for missing required fields
- Verify enum values are correct
- Ensure file paths exist (for openapi-file type)
- Check environment variables are defined (for ${VAR} references)

## Examples

### Create HubSpot Integration (Interactive)

```bash
aifabrix wizard --app hubspot-integration
# Select: Known platform > HubSpot
# Follow the prompts
```

### Create from OpenAPI File (Interactive)

```bash
aifabrix wizard --app my-api
# Select: OpenAPI file
# Provide path: ./openapi.yaml
# Follow the prompts
```

### Headless Mode (CI/CD Pipeline)

```bash
# Option 1: Config file (any path)
aifabrix wizard --config wizard.yaml

# Option 2: Silent mode (uses integration/<app>/wizard.yaml; no prompts)
aifabrix wizard my-integration --silent
```

Create `wizard.yaml` in your repo (or under `integration/<app>/wizard.yaml` for silent mode). You can include `deployment.controller`, `deployment.environment`, and `deployment.dataplane` to override config.

## Reference

- [External Systems Documentation](external-systems.md) - Manual external system creation
- [CLI Reference](commands/external-integration.md) - All CLI commands
- [Configuration Guide](configuration/README.md) - Configuration file formats

## Dataplane Wizard API

The wizard uses the following dataplane wizard API endpoints:

| Endpoint | Description |
| ---------- | ----------- |
| `POST /api/v1/wizard/sessions` | Create wizard session |
| `GET /api/v1/wizard/sessions/{id}` | Get session state |
| `PUT /api/v1/wizard/sessions/{id}` | Update session |
| `DELETE /api/v1/wizard/sessions/{id}` | Delete session |
| `GET /api/v1/wizard/sessions/{id}/progress` | Get session progress |
| `POST /api/v1/wizard/parse-openapi` | Parse OpenAPI file/URL |
| `GET /api/v1/wizard/credentials` | List credentials for Step 3 (optional query: `activeOnly`) |
| `POST /api/v1/wizard/credential-selection` | Credential selection |
| `POST /api/v1/wizard/detect-type` | Detect API type |
| `POST /api/v1/wizard/generate-config` | Generate configuration (body: openapiSpec, detectedType, intent, mode, fieldOnboardingLevel, userPreferences, etc.) |
| `POST /api/v1/wizard/generate-config-stream` | Generate config (streaming; same body including fieldOnboardingLevel) |
| `POST /api/v1/wizard/validate` | Validate configuration |
| `GET /api/v1/wizard/sessions/{id}/validate` | Validate all steps |
| `POST /api/v1/wizard/sessions/{id}/validate-step` | Validate specific step |
| `GET /api/v1/wizard/preview/{id}` | Get configuration preview |
| `POST /api/v1/wizard/test-mcp-connection` | Test MCP connection |
| `GET /api/v1/wizard/deployment-docs/{key}` | Get deployment docs (DB only) |
| `POST /api/v1/wizard/deployment-docs/{key}` | Generate deployment docs with optional `variablesYaml` and `deployJson` body for better README quality |
| `GET /api/v1/wizard/platforms` | Get known platforms (optional; empty/404 hides "Known platform" in Step 2) |

For detailed API documentation, see the dataplane API documentation.
