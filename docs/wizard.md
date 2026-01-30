# External System Wizard

## Overview

The AI Fabrix External System Wizard provides an interactive guided workflow for creating external system integrations. The wizard acts as a thin wrapper around the dataplane wizard API - all wizard logic (parsing, type detection, AI generation, validation) is handled by the dataplane server.

The wizard helps you:
- Create new external systems from OpenAPI specifications
- Add datasources to existing systems
- Generate configurations automatically using AI
- Validate configurations before deployment
- Support headless mode via `--config wizard.yaml` for automated/non-interactive deployments

## Quick Start

### Interactive Mode

Run the wizard command:

```bash
aifabrix wizard
```

Or with options (uses controller and environment from `config.yaml`):

```bash
aifabrix wizard --app my-integration
```

You can also use the wizard when creating an external system:

```bash
aifabrix create my-integration --type external --wizard
```

### Headless Mode (Non-Interactive)

For automated deployments, use a configuration file:

```bash
aifabrix wizard --config wizard.yaml
```

This mode skips all prompts and uses values from the configuration file.

## Wizard Workflow

The wizard follows the dataplane API workflow:

```yaml
Step 1: Create Session        POST /api/v1/wizard/sessions
Step 2: Parse OpenAPI         POST /api/v1/wizard/parse-openapi
Step 3: Credential Selection  POST /api/v1/wizard/credential-selection (optional)
Step 4: Detect Type           POST /api/v1/wizard/detect-type
Step 5: Generate Config       POST /api/v1/wizard/generate-config
Step 6: Validate              POST /api/v1/wizard/validate
Step 7: Save Files            Local file generation
```

### Step 1: Create Session

Creates a wizard session with the selected mode:
- **Create a new external system** - Start from scratch
- **Add datasource to existing system** - Add to an existing integration

For add-datasource mode, provide the existing system ID or key.

### Step 2: Parse OpenAPI

Select your source type and parse the OpenAPI specification:
- **OpenAPI file** - Local OpenAPI specification file
- **OpenAPI URL** - Remote OpenAPI specification URL
- **MCP server** - Model Context Protocol server
- **Known platform** - Pre-configured platform (HubSpot, Salesforce, etc.)

### Step 3: Credential Selection (Optional)

Configure credentials for the external system:
- **Create** - Create a new credential
- **Select** - Use an existing credential
- **Skip** - Configure credentials later

### Step 4: Detect API Type

The wizard automatically detects:
- API type (record-based, document-storage, etc.)
- Confidence scores for each detected type
- Recommended type based on analysis

**Detected Types**: `record-based` (CRUD operations), `document-storage` (file/folder operations), `sharepoint` (SharePoint-specific), `teams-meetings` (Teams/Graph API patterns), `crm`, `project-management`, `communication`, `e-commerce`, `calendar`, `email`, `help-desk`, `accounting`, `hr`, `custom`.

### Step 5: Generate Configuration

The wizard uses AI to generate configurations based on:
- OpenAPI specification structure
- Detected API type
- User intent (any descriptive text)
- User preferences (MCP, ABAC, RBAC)
- Field onboarding level (full/standard/minimal)

**Important**: The `intent` parameter accepts any descriptive text (e.g., "sales-focused CRM integration", "customer management system"). It's not limited to specific enum values.

### Step 6: Validate Configuration

Validates all generated configurations against:
- External system schema
- External datasource schema
- Application schema

Returns validation errors and warnings.

**See Also:** [Validation Commands](../commands/validation.md) - Complete validation documentation including schema details and validation principles.

### Step 7: Save Files

The wizard saves all files to `integration/<app-name>/`:
- `variables.yaml` - Application variables and external integration configuration
- `<systemKey>-system.json` - System configuration
- `<systemKey>-datasource-*.json` - Datasource configurations
- `env.template` - Environment variable template
- `README.md` - Documentation (AI-generated from dataplane when available)
- `<systemKey>-deploy.json` - Single deployment file
- `deploy.sh` - Bash deployment script
- `deploy.ps1` - PowerShell deployment script

## Headless Mode Configuration (wizard.yaml)

For automated deployments, create a `wizard.yaml` configuration file:

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

# Optional: Override deployment settings
deployment:
  controller: https://controller.example.com
  environment: dev
  dataplane: https://dataplane.example.com  # Override dataplane lookup
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

Select from pre-configured platforms:
- HubSpot
- Salesforce
- Zendesk
- Slack
- Microsoft 365

The wizard uses platform-specific templates and configurations.

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

**See Also:** [Validation Commands](../commands/validation.md) - Complete validation documentation including schema architecture, validation flow, and troubleshooting.

## File Structure

The wizard creates the following file structure:

```yaml
integration/<app-name>/
├── variables.yaml              # Application variables and external integration config
├── <systemKey>-system.json     # System configuration
├── <systemKey>-datasource-*.json   # Datasource configurations
├── env.template                # Environment variable template
├── README.md                   # Documentation (AI-generated from dataplane when available)
├── <systemKey>-deploy.json     # Single deployment file
├── deploy.sh                   # Bash deployment script
└── deploy.ps1                  # PowerShell deployment script
```

### README.md Generation

The wizard attempts to fetch AI-generated README.md content from the dataplane's deployment-docs API. If the API is available and returns content, that content is used. Otherwise, a basic README.md is generated with essential information about the integration.

## Environment Variables

The wizard generates `env.template` with authentication variables based on the detected authentication type:

- **API Key**: `API_KEY=kv://secrets/api-key`
- **OAuth2**: `CLIENT_ID`, `CLIENT_SECRET`, `AUTH_URL`, `TOKEN_URL`
- **Bearer Token**: `BEARER_TOKEN=kv://secrets/bearer-token`
- **Basic Auth**: `USERNAME`, `PASSWORD`

Update these values in your secrets store before deployment.

## Deployment

After the wizard completes, you can deploy your external system using the generated deployment scripts or the CLI directly.

### Using Deployment Scripts

The wizard generates deployment scripts for both Unix-like systems (Bash) and Windows (PowerShell):

**Bash (Linux/macOS):**
```bash
cd integration/<app-name>
./deploy.sh
```

**PowerShell (Windows):**
```powershell
cd integration\<app-name>
.\deploy.ps1
```

**Environment Variables:**
- `ENVIRONMENT` - Environment key (default: dev)
- `CONTROLLER` - Controller URL (default: <http://localhost:3000>)
- `RUN_TESTS` - Set to "true" to run integration tests after deployment

**Example:**
```bash
ENVIRONMENT=prod CONTROLLER=https://controller.example.com ./deploy.sh
```

The deployment scripts will:
1. Validate all JSON configuration files
2. Deploy all datasources to the specified environment
3. Optionally run integration tests if `RUN_TESTS=true`

### Using CLI Directly

You can also deploy using the CLI directly:

```bash
aifabrix deploy <app-name>
```

## Troubleshooting

### Authentication Required

If you see "Authentication required", run:

```bash
aifabrix login
```

Or register your application:

```bash
aifabrix app register <app-name>
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

If AI generation fails:
- Check your dataplane connection
- Verify authentication is working
- Try again (generation may timeout on large specifications)

### Validation Errors

If validation fails:
- Review the error messages
- Edit the configuration manually in Step 7 (interactive mode)
- Fix the wizard.yaml and re-run (headless mode)

For detailed validation information, see [Validation Commands](../commands/validation.md).

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
# Create wizard.yaml in your repo (can include deployment.controller, deployment.environment, deployment.dataplane to override config)
# Run in CI/CD (uses config or wizard.yaml deployment overrides)
aifabrix wizard --config wizard.yaml
```

## Reference

- [External Systems Documentation](external-systems.md) - Manual external system creation
- [CLI Reference](commands/external-integration.md) - All CLI commands
- [Configuration Guide](configuration.md) - Configuration file formats

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
| `POST /api/v1/wizard/credential-selection` | Credential selection |
| `POST /api/v1/wizard/detect-type` | Detect API type |
| `POST /api/v1/wizard/generate-config` | Generate configuration |
| `POST /api/v1/wizard/generate-config-stream` | Generate config (streaming) |
| `POST /api/v1/wizard/validate` | Validate configuration |
| `GET /api/v1/wizard/sessions/{id}/validate` | Validate all steps |
| `POST /api/v1/wizard/sessions/{id}/validate-step` | Validate specific step |
| `GET /api/v1/wizard/preview/{id}` | Get configuration preview |
| `POST /api/v1/wizard/test-mcp-connection` | Test MCP connection |
| `GET /api/v1/wizard/deployment-docs/{key}` | Get deployment docs |

For detailed API documentation, see the dataplane API documentation.
