# External System Wizard

## Overview

The AI Fabrix External System Wizard provides an interactive guided workflow for creating external system integrations. The wizard acts as a thin wrapper around the dataplane wizard API - all wizard logic (parsing, type detection, AI generation, validation) is handled by the dataplane server.

The wizard helps you:
- Create new external systems from OpenAPI specifications
- Add datasources to existing systems
- Generate configurations automatically using AI
- Validate configurations before deployment

## Quick Start

Run the wizard command:

```bash
aifabrix wizard
```

Or with options:

```bash
aifabrix wizard --app my-integration --controller https://controller.example.com --environment dev
```

You can also use the wizard when creating an external system:

```bash
aifabrix create my-integration --type external --wizard
```

## Wizard Workflow

The wizard follows these steps:

### Step 1: Mode Selection

Choose what you want to do:
- **Create a new external system** - Start from scratch
- **Add datasource to existing system** - Add to an existing integration

### Step 2: Source Selection

Select your source type:
- **OpenAPI file** - Local OpenAPI specification file
- **OpenAPI URL** - Remote OpenAPI specification URL
- **MCP server** - Model Context Protocol server
- **Known platform** - Pre-configured platform (HubSpot, Salesforce, etc.)

### Step 3: Parse OpenAPI (if applicable)

If you selected an OpenAPI file or URL, the wizard will:
- Parse the OpenAPI specification
- Extract API endpoints and schemas
- Prepare the specification for type detection

### Step 4: Detect API Type (optional)

The wizard automatically detects:
- API type (REST, GraphQL, RPC, etc.)
- API category (CRM, support, sales, etc.)
- Confidence scores for detection

### Step 5: User Preferences

Configure your preferences:
- **User intent** - Sales-focused, support-focused, marketing-focused, or general
- **MCP** - Enable Model Context Protocol
- **ABAC** - Enable Attribute-Based Access Control
- **RBAC** - Enable Role-Based Access Control

### Step 6: Generate Configuration

The wizard uses AI to generate:
- External system configuration
- Datasource configurations
- Authentication settings
- API endpoint mappings

This step may take 10-30 seconds.

### Step 7: Review & Validate

Review the generated configuration:
- View system and datasource configurations
- Edit configurations manually if needed
- Validate configurations against schemas

### Step 8: Save Files

The wizard saves all files to `integration/<app-name>/`:
- `variables.yaml` - Application variables and external integration configuration
- `<systemKey>-deploy.json` - System configuration
- `<systemKey>-deploy-*.json` - Datasource configurations
- `env.template` - Environment variable template
- `README.md` - Documentation
- `application-schema.json` - Single deployment file

## Source Types

### OpenAPI File

Provide a local path to an OpenAPI specification file (YAML or JSON):

```bash
# The wizard will prompt for the file path
aifabrix wizard
```

The file will be uploaded to the dataplane for parsing.

### OpenAPI URL

Provide a URL to an OpenAPI specification:

```bash
# The wizard will prompt for the URL
aifabrix wizard
```

The dataplane will fetch and parse the specification.

### MCP Server

Connect to a Model Context Protocol server:

```bash
# The wizard will prompt for:
# - MCP server URL
# - Authentication token
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

## Validation

All configurations are validated against:
- External system schema
- External datasource schema
- Application schema

Validation errors are displayed before saving files.

## File Structure

The wizard creates the following file structure:

```
integration/<app-name>/
├── variables.yaml              # Application variables and external integration config
├── <systemKey>-deploy.json     # System configuration
├── <systemKey>-deploy-*.json   # Datasource configurations
├── env.template                # Environment variable template
├── README.md                   # Documentation
└── application-schema.json     # Single deployment file
```

## Environment Variables

The wizard generates `env.template` with authentication variables based on the detected authentication type:

- **API Key**: `API_KEY=kv://secrets/api-key`
- **OAuth2**: `CLIENT_ID`, `CLIENT_SECRET`, `AUTH_URL`, `TOKEN_URL`
- **Bearer Token**: `BEARER_TOKEN=kv://secrets/bearer-token`
- **Basic Auth**: `USERNAME`, `PASSWORD`

Update these values in your secrets store before deployment.

## Deployment

After the wizard completes, deploy your external system:

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
- Edit the configuration manually in Step 7
- Re-validate before saving

## Examples

### Create HubSpot Integration

```bash
aifabrix wizard --app hubspot-integration
# Select: Known platform > HubSpot
# Follow the prompts
```

### Create from OpenAPI File

```bash
aifabrix wizard --app my-api
# Select: OpenAPI file
# Provide path: ./openapi.yaml
# Follow the prompts
```

### Create with Custom Dataplane

```bash
aifabrix wizard --app my-integration --dataplane https://dataplane.example.com
```

## Reference

- [External Systems Documentation](external-systems.md) - Manual external system creation
- [CLI Reference](cli-reference.md) - All CLI commands
- [Configuration Guide](configuration.md) - Configuration file formats

## Dataplane Wizard API

The wizard uses the dataplane wizard API endpoints:
- `POST /api/v1/wizard/mode-selection` - Select wizard mode
- `POST /api/v1/wizard/source-selection` - Select source type
- `POST /api/v1/wizard/parse-openapi` - Parse OpenAPI file
- `POST /api/v1/wizard/detect-type` - Detect API type
- `POST /api/v1/wizard/generate-config` - Generate configuration
- `POST /api/v1/wizard/validate` - Validate configuration
- `POST /api/v1/wizard/test-mcp-connection` - Test MCP connection

For detailed API documentation, see the dataplane API documentation.

