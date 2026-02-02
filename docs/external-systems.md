# External Systems Guide

← [Back to Your Own Applications](your-own-applications.md)

Connect your AI Fabrix Dataplane to third-party APIs like HubSpot, Salesforce, or any REST API. External systems don't require Docker containers—they're pure integrations that sync data and expose it via MCP/OpenAPI.

## What Are External Systems?

External systems are integrations that connect to third-party APIs and make their data available in your AI Fabrix Dataplane. Unlike regular applications, they:

- **Don't need Docker images** - No containers to build or run
- **Don't need ports** - They're API clients, not servers
- **Sync data automatically** - Pull data from external APIs into your dataplane
- **Expose via MCP/OpenAPI** - Make external data queryable by AI models
- **Support field mappings** - Transform external API data into normalized schemas

**When to use external systems:**
- Integrating with CRM systems (HubSpot, Salesforce)
- Connecting to SaaS APIs (Slack, Teams, GitHub)
- Syncing data from external databases
- Making third-party data available to AI models

**When to use regular applications:**
- Building custom APIs or services
- Running background jobs or workers
- Creating web applications
- Anything that needs a containerized runtime

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "fontFamily": "Poppins, Arial Rounded MT Bold, Arial, sans-serif",
    "fontSize": "16px",
    "background": "#FFFFFF",
    "primaryColor": "#F8FAFC",
    "primaryTextColor": "#0B0E15",
    "primaryBorderColor": "#E2E8F0",
    "lineColor": "#E2E8F0",
    "textColor": "#0B0E15",
    "borderRadius": 16
  },
  "flowchart": {
    "curve": "linear",
    "nodeSpacing": 34,
    "rankSpacing": 34,
    "padding": 10
  }
}}%%

flowchart LR

%% =======================
%% Styles
%% =======================
classDef base fill:#FFFFFF,color:#0B0E15,stroke:#E2E8F0,stroke-width:1.5px;
classDef medium fill:#1E3A8A,color:#ffffff,stroke-width:0px;
classDef primary fill:#0062FF,color:#ffffff,stroke-width:0px;

%% =======================
%% Flow
%% =======================
ExternalAPI[External API<br/>HubSpot/Salesforce/etc]:::primary --> ExternalSystem[External System<br/>Authentication & Configuration]:::medium
ExternalSystem --> Datasources[Datasources<br/>Field Mappings]:::base
Datasources --> Dataplane[Dataplane<br/>Schema Publishing]:::base
Dataplane --> AIModels[AI Models<br/>Query via MCP/OpenAPI]:::base
```

---

## Quick Start: Create Your First External System

**New to external systems?** Try the interactive wizard:

```bash
aifabrix wizard
```

The wizard guides you through creating external systems with AI-powered configuration generation. See the [Wizard Guide](wizard.md) for details.

**Prefer manual creation?** Follow the steps below to create a HubSpot integration manually.

### Step 1: Create the External System

```bash
aifabrix create hubspot --type external
```

**You'll be asked:**
- System key? *(defaults to app name: `hubspot`)*
- System display name? *HubSpot CRM*
- System description? *HubSpot CRM integration*
- System type? *OpenAPI / MCP / Custom* → Choose **OpenAPI**
- Authentication type? *OAuth2 / API Key / Basic Auth* → Choose **OAuth2**
- Number of datasources? *(1-10)* → Enter **3** (for companies, contacts, deals)

**What gets created:**
```yaml
integration/
  hubspot/
    variables.yaml                    # App configuration
    hubspot-system.json              # External system definition
    hubspot-datasource-company.json  # Companies datasource
    hubspot-datasource-contact.json  # Contacts datasource
    hubspot-datasource-deal.json     # Deals datasource
    hubspot-deploy.json              # Deployment manifest (generated)
    rbac.yaml                        # RBAC roles and permissions (optional)
    env.template                     # Environment variables
    README.md                        # Documentation
```

All files are in the same folder for easy viewing and management.

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "fontFamily": "Poppins, Arial Rounded MT Bold, Arial, sans-serif",
    "fontSize": "16px",
    "background": "#FFFFFF",
    "primaryColor": "#F8FAFC",
    "primaryTextColor": "#0B0E15",
    "primaryBorderColor": "#E2E8F0",
    "lineColor": "#E2E8F0",
    "textColor": "#0B0E15",
    "borderRadius": 16
  },
  "flowchart": {
    "curve": "linear",
    "nodeSpacing": 34,
    "rankSpacing": 34,
    "padding": 10
  }
}}%%

flowchart TD

%% =======================
%% Styles
%% =======================
classDef base fill:#FFFFFF,color:#0B0E15,stroke:#E2E8F0,stroke-width:1.5px;
classDef medium fill:#1E3A8A,color:#ffffff,stroke-width:0px;
classDef primary fill:#0062FF,color:#ffffff,stroke-width:0px;

%% =======================
%% Flow
%% =======================
Create[aifabrix create hubspot<br/>--type external]:::primary --> Variables[variables.yaml<br/>App configuration<br/>externalIntegration block]:::base
Create --> SystemJson[hubspot-system.json<br/>External system definition]:::base
Create --> Datasource1[hubspot-datasource-company.json<br/>Companies datasource]:::base
Create --> Datasource2[hubspot-datasource-contact.json<br/>Contacts datasource]:::base
Create --> Datasource3[hubspot-datasource-deal.json<br/>Deals datasource]:::base
Create --> DeployManifest[hubspot-deploy.json<br/>Deployment manifest]:::base
Create --> EnvTemplate[env.template<br/>Environment variables]:::base
Create --> Readme[README.md<br/>Documentation]:::base

Variables --> Deploy[Deploy Process]:::base
SystemJson --> Deploy
Datasource1 --> Deploy
Datasource2 --> Deploy
Datasource3 --> Deploy
```

### Step 2: Configure Authentication

Edit `integration/hubspot/hubspot-system.json` to configure OAuth2. Use standard environment variable references:

```json
{
  "key": "hubspot",
  "displayName": "HubSpot CRM",
  "description": "HubSpot CRM integration",
  "type": "openapi",
  "environment": {
    "baseUrl": "https://api.hubapi.com"
  },
  "authentication": {
    "type": "oauth2",
    "oauth2": {
      "tokenUrl": "{{TOKENURL}}",
      "clientId": "{{CLIENTID}}",
      "clientSecret": "{{CLIENTSECRET}}",
      "scopes": [
        "crm.objects.companies.read",
        "crm.objects.companies.write",
        "crm.objects.contacts.read",
        "crm.objects.contacts.write",
        "crm.objects.deals.read",
        "crm.objects.deals.write"
      ]
    }
  },
  "configuration": [
    {
      "name": "CLIENTID",
      "value": "hubspot-clientidKeyVault",
      "location": "keyvault",
      "required": true
    },
    {
      "name": "CLIENTSECRET",
      "value": "hubspot-clientsecretKeyVault",
      "location": "keyvault",
      "required": true
    },
    {
      "name": "TOKENURL",
      "value": "https://api.hubapi.com/oauth/v1/token",
      "location": "variable",
      "required": true
    }
  ]
}
```

**What this does:**
- `baseUrl` - The API endpoint for HubSpot
- `tokenUrl` - OAuth2 token endpoint (uses `{{TOKENURL}}` variable)
- `clientId` / `clientSecret` - References standard variables `{{CLIENTID}}` and `{{CLIENTSECRET}}`
- `configuration` - Defines variables that can be set via Miso Controller or Dataplane portal interface
- `scopes` - Required OAuth2 permissions

**Important:**
- Standard variables (`CLIENTID`, `CLIENTSECRET`, `TOKENURL`) are managed by the dataplane credentials system—no `portalInput` needed
- Values are set via the Miso Controller or Dataplane portal interface
- The platform automatically manages Key Vault storage—you don't need to manually store secrets
- For custom variables, you can add `portalInput` to configure UI fields (see examples below)

### Step 3: Configure Datasources

Each datasource maps an external entity (company, contact, deal) to your dataplane. Edit the datasource JSON files to configure field mappings.

**Example: `hubspot-datasource-company.json`**

```json
{
  "key": "hubspot-company",
  "systemKey": "hubspot",
  "entityType": "company",
  "resourceType": "customer",
  "fieldMappings": {
    "dimensions": {
      "country": "metadata.country",
      "domain": "metadata.domain"
    },
    "attributes": {
      "name": {
        "expression": "{{properties.name.value}} | trim",
        "type": "string",
        "indexed": false
      },
      "domain": {
        "expression": "{{properties.domain.value}} | toLower | trim",
        "type": "string",
        "indexed": false
      },
      "country": {
        "expression": "{{properties.country.value}} | toUpper | trim",
        "type": "string",
        "indexed": true
      }
    }
  },
  "openapi": {
    "enabled": true,
    "operations": {
      "list": {
        "operationId": "getCompanies",
        "method": "GET",
        "path": "/crm/v3/objects/companies"
      }
    }
  }
}
```

**What this does:**
- Maps HubSpot's nested `properties.name.value` structure to a flat `name` field
- Applies transformations: `trim`, `toLower`, `toUpper`
- Defines `dimensions` for ABAC (Attribute-Based Access Control) filtering using dimensions-first model
- Configures OpenAPI operations to expose via REST API

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "fontFamily": "Poppins, Arial Rounded MT Bold, Arial, sans-serif",
    "fontSize": "16px",
    "background": "#FFFFFF",
    "primaryColor": "#F8FAFC",
    "primaryTextColor": "#0B0E15",
    "primaryBorderColor": "#E2E8F0",
    "lineColor": "#E2E8F0",
    "textColor": "#0B0E15",
    "borderRadius": 16
  },
  "flowchart": {
    "curve": "linear",
    "nodeSpacing": 34,
    "rankSpacing": 34,
    "padding": 10
  }
}}%%

flowchart LR

%% =======================
%% Styles
%% =======================
classDef base fill:#FFFFFF,color:#0B0E15,stroke:#E2E8F0,stroke-width:1.5px;
classDef medium fill:#1E3A8A,color:#ffffff,stroke-width:0px;
classDef primary fill:#0062FF,color:#ffffff,stroke-width:0px;

%% =======================
%% Flow
%% =======================
ExternalAPI[External API Response<br/>properties.name.value<br/>properties.domain.value]:::primary --> FieldMappings[Field Mappings<br/>Transformations<br/>trim, toLower, toUpper]:::medium
FieldMappings --> TransformedData[Transformed Data<br/>name: string<br/>domain: string<br/>country: string]:::base
TransformedData --> DataplaneSchema[Dataplane Schema<br/>Normalized structure<br/>ABAC dimensions]:::base
DataplaneSchema --> Query[Query via<br/>MCP/OpenAPI]:::base
```

### Step 4: Validate Configuration

```bash
# Validate entire integration
aifabrix validate hubspot --type external

# Validate individual files
aifabrix validate integration/hubspot/hubspot-system.json
aifabrix validate integration/hubspot/hubspot-datasource-company.json
aifabrix validate integration/hubspot/hubspot-datasource-contact.json
aifabrix validate integration/hubspot/hubspot-datasource-deal.json
```

**What happens:**
- Validates JSON syntax
- Checks against schemas (`external-system.schema.json`, `external-datasource.schema.json`)
- Verifies required fields are present
- Checks field mapping expressions are valid

> **Note:** For some external integrations, `aifabrix validate <app>` may fail. If that happens, validate the individual files (see Troubleshooting below).

### Step 5: Deploy

```bash
# Login to controller
aifabrix login --controller https://controller.aifabrix.dev --method device --environment dev

# Deploy to controller
aifabrix deploy hubspot
```

**What happens:**
1. `aifabrix validate` - Validates components and generates full deployment manifest
2. `aifabrix json` - Generates `<systemKey>-deploy.json` deployment manifest (combines system + datasources) for pipeline deployment
3. `aifabrix deploy` - Uses the deployment manifest to deploy via Miso Controller pipeline API (same as regular apps)
4. System is registered in the dataplane
5. Datasources are published and available for querying

**Note:** The `aifabrix json` command generates `<systemKey>-deploy.json` deployment manifest. Individual component files (`hubspot-system.json`, `hubspot-datasource-company.json`, etc.) remain in your `integration/` folder and are referenced in `variables.yaml`.

> **Note:** If the controller requires a Docker image, use `internal: true` in `variables.yaml` (externalIntegration) so the system deploys on dataplane startup; see Troubleshooting.

### Step 6: Verify Deployment

```bash
# List all datasources
aifabrix datasource list

# Validate deployed datasource
aifabrix datasource validate hubspot-company
```

**Expected output:**
```yaml
✓ External system 'hubspot' deployed
✓ Datasource 'hubspot-company' published
✓ Datasource 'hubspot-contact' published
✓ Datasource 'hubspot-deal' published
```

---

## Configuration Deep Dive

### External System Configuration

The external system JSON (`<systemKey>-system.json`) defines the connection to the third-party API.

**Required fields:**
- `key` - Unique identifier (lowercase, alphanumeric, hyphens)
- `displayName` - Human-readable name
- `description` - Description of the external system integration (required)
- `type` - `openapi`, `mcp`, or `custom`
- `authentication` - Auth configuration (see below)
- `configuration` - Array of configurable variables (see Configuration section)

**Example structure:**
```json
{
  "key": "hubspot",
  "displayName": "HubSpot CRM",
  "description": "HubSpot CRM integration",
  "type": "openapi",
  "enabled": true,
  "environment": {
    "baseUrl": "https://api.hubapi.com"
  },
  "authentication": { /* see Authentication section */ },
  "configuration": [ /* see Configuration section */ ],
  "openapi": {
    "documentKey": "hubspot-v3",
    "autoDiscoverEntities": false
  },
  "tags": ["crm", "sales", "marketing"]
}
```

### Configuration Array

The `configuration` array defines variables that can be set via the Miso Controller or Dataplane portal interface. This allows users to configure authentication and other settings without editing JSON files.

**Configuration object structure:**
```json
{
  "name": "VARIABLENAME",
  "value": "keyvault-key-name or literal-value",
  "location": "keyvault or variable",
  "required": true,
  "portalInput": {
    "field": "text|password|textarea|select|json",
    "label": "Display Label",
    "placeholder": "Placeholder text",
    "masked": true,
    "options": ["option1", "option2"],
    "validation": {
      "required": true,
      "minLength": 1,
      "maxLength": 100,
      "pattern": "^regex$"
    }
  }
}
```

**Fields:**
- `name` - Variable name (must match `{{VARIABLENAME}}` in authentication block)
- `value` - Key Vault key name (for `location: "keyvault"`) or literal value (for `location: "variable"`)
- `location` - `"keyvault"` (stored securely) or `"variable"` (literal value)
- `required` - Whether the value must be provided
- `portalInput` - **Optional** - UI configuration for custom variables (not needed for standard variables)
  - `field` - Input type: `"password"`, `"text"`, `"textarea"`, `"select"`, `"json"`
  - `label` - Display label in UI
  - `placeholder` - Placeholder text
  - `masked` - Whether to mask the input (for passwords/secrets)
  - `options` - Array of options for `select` field type
  - `validation` - Validation rules (required, minLength, maxLength, pattern, etc.)

**Important distinctions:**
- **Standard variables** (`CLIENTID`, `CLIENTSECRET`, `TOKENURL`, `APIKEY`, `USERNAME`, `PASSWORD`) are managed by the dataplane credentials system—**do not include `portalInput`**. Redirect URI for OAuth2 is managed by the dataplane and does not need to be configured in the integration.
- **Custom variables** (any other variable name) can use `portalInput` to configure UI fields in the portal interface

**How it works:**
1. Variables defined in `configuration` can be referenced in `authentication` using `{{VARIABLENAME}}`
2. Standard variables are managed by the dataplane credentials system
3. Custom variables with `portalInput` get UI fields in the portal interface
4. Users set values via the Miso Controller or Dataplane portal interface
5. Values are automatically stored in Key Vault (for `location: "keyvault"`)
6. Values are resolved at deployment time

### Standard Environment Variables

External systems use standard variable names that are **automatically managed by the dataplane credentials system**. These variables do **not** require `portalInput` configuration—they are handled by the platform's credential management.

<!-- markdownlint-disable MD060 -->
| Variable Name      | Description              | Used For              | Example            |
|-------------------|--------------------------|-----------------------|--------------------|
| `{{CLIENTID}}`     | OAuth2 Client ID         | OAuth2 authentication | `{{CLIENTID}}`     |
| `{{CLIENTSECRET}}` | OAuth2 Client Secret     | OAuth2 authentication | `{{CLIENTSECRET}}` |
| `{{TOKENURL}}`     | OAuth2 Token URL         | OAuth2 token endpoint | `{{TOKENURL}}`     |
| `{{APIKEY}}`       | API Key                  | API Key authentication| `{{APIKEY}}`       |
| `{{USERNAME}}`     | Basic Auth Username      | Basic authentication | `{{USERNAME}}`     |
| `{{PASSWORD}}`     | Basic Auth Password      | Basic authentication | `{{PASSWORD}}`     |
<!-- markdownlint-enable MD060 -->

OAuth2 redirect URI is managed by the dataplane credentials system and is not configured as a variable in the integration. **REDIRECT_URI is auto-generated; you do not need to set it.**

**Important:**
- Standard variables are managed by the dataplane credentials system—no `portalInput` needed
- Values are set via the Miso Controller or Dataplane portal interface
- Values are automatically stored in Key Vault by the platform
- Simply reference them in your `configuration` array without `portalInput`

**Example - Standard variables (no portalInput):**
```json
{
  "configuration": [
    {
      "name": "CLIENTID",
      "value": "hubspot-clientidKeyVault",
      "location": "keyvault",
      "required": true
    },
    {
      "name": "CLIENTSECRET",
      "value": "hubspot-clientsecretKeyVault",
      "location": "keyvault",
      "required": true
    },
    {
      "name": "TOKENURL",
      "value": "https://api.hubapi.com/oauth/v1/token",
      "location": "variable",
      "required": true
    }
  ]
}
```

### Custom Variables with Portal Input

For **custom variables** (non-standard), you can use `portalInput` to configure UI fields in the portal interface. Use any variable name like `{{MYVAR}}` and configure it with `portalInput`.

**Example - Custom variables with portalInput:**
```json
{
  "configuration": [
    {
      "name": "HUBSPOT_API_VERSION",
      "value": "v3",
      "location": "variable",
      "required": false,
      "portalInput": {
        "field": "select",
        "label": "HubSpot API Version",
        "placeholder": "Select API version",
        "options": ["v1", "v2", "v3"],
        "validation": {
          "required": false
        }
      }
    },
    {
      "name": "MAX_PAGE_SIZE",
      "value": "100",
      "location": "variable",
      "required": false,
      "portalInput": {
        "field": "text",
        "label": "Maximum Page Size",
        "placeholder": "100",
        "validation": {
          "required": false,
          "pattern": "^[0-9]+$",
          "minLength": 1,
          "maxLength": 1000
        }
      }
    },
    {
      "name": "CUSTOM_ENDPOINT",
      "value": "custom-endpointKeyVault",
      "location": "keyvault",
      "required": false,
      "portalInput": {
        "field": "text",
        "label": "Custom API Endpoint",
        "placeholder": "https://api.example.com/custom",
        "masked": false,
        "validation": {
          "required": false,
          "pattern": "^(http|https)://.*$"
        }
      }
    }
  ]
}
```

**When to use custom variables:**
- Configuration options specific to your integration (API version, page size, etc.)
- Optional settings that users should configure via the portal
- Any non-standard variable that needs UI configuration

### Authentication Methods

#### OAuth2

Best for production integrations with user consent flows.

```json
{
  "authentication": {
    "type": "oauth2",
    "oauth2": {
      "tokenUrl": "{{TOKENURL}}",
      "clientId": "{{CLIENTID}}",
      "clientSecret": "{{CLIENTSECRET}}",
      "scopes": ["read", "write"]
    }
  },
  "configuration": [
    {
      "name": "CLIENTID",
      "value": "hubspot-clientidKeyVault",
      "location": "keyvault",
      "required": true
    },
    {
      "name": "CLIENTSECRET",
      "value": "hubspot-clientsecretKeyVault",
      "location": "keyvault",
      "required": true
    },
    {
      "name": "TOKENURL",
      "value": "https://api.example.com/oauth/v1/token",
      "location": "variable",
      "required": true
    }
  ]
}
```

**Note:** Standard variables (`CLIENTID`, `CLIENTSECRET`, `TOKENURL`) don't need `portalInput`—they're managed by the dataplane credentials system.

**Setup steps:**
1. Register OAuth2 app in external system (HubSpot, Salesforce, etc.)
2. Get `clientId` and `clientSecret`
3. Set values via Miso Controller or Dataplane portal interface
4. Redirect URI is managed by the dataplane—configure the dataplane callback URL in the external system's OAuth2 app settings
5. Add required scopes to `scopes` array

#### API Key

Simpler for testing or private APIs.

```json
{
  "authentication": {
    "type": "apikey",
    "apikey": {
      "headerName": "X-API-Key",
      "key": "{{APIKEY}}"
    }
  },
  "configuration": [
    {
      "name": "APIKEY",
      "value": "hubspot-apikeyKeyVault",
      "location": "keyvault",
      "required": true
    }
  ]
}
```

**Note:** Standard variable `APIKEY` doesn't need `portalInput`—it's managed by the dataplane credentials system.

**Setup steps:**
1. Generate API key in external system
2. Set value via Miso Controller or Dataplane portal interface
3. Configure header name (usually `X-API-Key` or `Authorization`)

#### Basic Auth

For simple username/password authentication.

```json
{
  "authentication": {
    "type": "basic",
    "basic": {
      "username": "{{USERNAME}}",
      "password": "{{PASSWORD}}"
    }
  },
  "configuration": [
    {
      "name": "USERNAME",
      "value": "hubspot-usernameKeyVault",
      "location": "keyvault",
      "required": true
    },
    {
      "name": "PASSWORD",
      "value": "hubspot-passwordKeyVault",
      "location": "keyvault",
      "required": true
    }
  ]
}
```

**Note:** Standard variables (`USERNAME`, `PASSWORD`) don't need `portalInput`—they're managed by the dataplane credentials system.

#### Azure AD (AAD)

For Azure Active Directory authentication.

```json
{
  "authentication": {
    "type": "aad",
    "aad": {
      "tenantId": "{{TENANTID}}",
      "clientId": "{{CLIENTID}}",
      "clientSecret": "{{CLIENTSECRET}}",
      "scope": "https://graph.microsoft.com/.default"
    }
  },
  "configuration": [
    {
      "name": "TENANTID",
      "value": "azure-tenantidKeyVault",
      "location": "keyvault",
      "required": true
    },
    {
      "name": "CLIENTID",
      "value": "azure-clientidKeyVault",
      "location": "keyvault",
      "required": true
    },
    {
      "name": "CLIENTSECRET",
      "value": "azure-clientsecretKeyVault",
      "location": "keyvault",
      "required": true
    }
  ]
}
```

**Note:** Standard variables (`CLIENTID`, `CLIENTSECRET`) don't need `portalInput`—they're managed by the dataplane credentials system.

**Setup steps:**
1. Register Azure AD application in Azure Portal
2. Get `tenantId`, `clientId`, and `clientSecret`
3. Set values via Miso Controller or Dataplane portal interface
4. Configure required API permissions and scopes

### RBAC Support (Roles and Permissions)

External systems support RBAC (Role-Based Access Control) configuration via `rbac.yaml`, similar to regular applications. This allows you to define roles and permissions for your external system integration.

**RBAC Configuration:**

External systems can define roles and permissions in two ways:

1. **In `rbac.yaml` file** (recommended for separation of concerns)
2. **Directly in the system JSON file** (`<systemKey>-system.json`)

When generating deployment JSON with `aifabrix json`, roles/permissions from `rbac.yaml` are automatically merged into the system JSON. Priority: roles/permissions in system JSON > rbac.yaml (if both exist, prefer JSON).

**Example `rbac.yaml`:**

```yaml
roles:
  - name: HubSpot Admin
    value: hubspot-admin
    description: Full access to HubSpot integration
    groups:
      - "hubspot-admins@company.com"
  
  - name: HubSpot User
    value: hubspot-user
    description: Read-only access to HubSpot data

permissions:
  - name: hubspot:read
    roles:
      - hubspot-user
      - hubspot-admin
    description: Read access to HubSpot data
  
  - name: hubspot:write
    roles:
      - hubspot-admin
    description: Write access to HubSpot data
  
  - name: hubspot:admin
    roles:
      - hubspot-admin
    description: Administrative access to HubSpot integration
```

**Example in System JSON:**

```json
{
  "key": "hubspot",
  "displayName": "HubSpot CRM",
  "description": "HubSpot CRM integration",
  "type": "openapi",
  "roles": [
    {
      "name": "HubSpot Admin",
      "value": "hubspot-admin",
      "description": "Full access to HubSpot integration",
      "groups": ["hubspot-admins@company.com"]
    },
    {
      "name": "HubSpot User",
      "value": "hubspot-user",
      "description": "Read-only access to HubSpot data"
    }
  ],
  "permissions": [
    {
      "name": "hubspot:read",
      "roles": ["hubspot-user", "hubspot-admin"],
      "description": "Read access to HubSpot data"
    },
    {
      "name": "hubspot:write",
      "roles": ["hubspot-admin"],
      "description": "Write access to HubSpot data"
    }
  ]
}
```

**Role Requirements:**

- `name` - Human-readable role name (required)
- `value` - Role identifier used in JWT and ACL (required, pattern: `^[a-z-]+$`)
- `description` - Role description (required)
- `Groups` - Optional array of Azure AD groups mapped to this role

**Permission Requirements:**

- `name` - Permission identifier (required, pattern: `^[a-z0-9-:]+$`, e.g., `hubspot:read`, `documentstore:write`)
- `roles` - Array of role values that have this permission (required, must reference existing roles)
- `description` - Permission description (required)

**Validation:**

When validating external systems with `aifabrix validate`, the builder:
- Validates `rbac.yaml` structure (if present)
- Validates roles and permissions in system JSON (if present)
- Checks that all role references in permissions exist in the roles array
- Validates role value patterns (`^[a-z-]+$`)
- Validates permission name patterns (`^[a-z0-9-:]+$`)

**Usage:**

```bash
# Generate JSON with rbac.yaml merged
aifabrix json hubspot

# Validate including rbac.yaml
aifabrix validate hubspot

# Split JSON back to component files (extracts roles/permissions to rbac.yml)
aifabrix split-json hubspot
```

**Note:** RBAC configuration is registered with miso-controller during deployment. Roles and permissions are used for access control when querying external system data via MCP/OpenAPI.

### Datasource Configuration

Each datasource maps one entity type from the external system.

**Required fields:**
- `key` - Unique datasource identifier
- `systemKey` - Must match external system `key`
- `entityType` - Entity type identifier; validated against the schema enum. Allowed values (from `lib/schema/external-datasource.schema.json`): `document-storage`, `documentStorage`, `vector-store`, `vectorStore`, `record-storage`, `recordStorage`, `message-service`, `messageService`, `none`. Defines storage semantics and which type schema is used for validation (e.g. `documentStorage` → document-storage schema).
- `resourceType` - Resource type classification (pattern: `^[a-z0-9-]+$`, e.g., "customer", "contact", "deal")
- `fieldMappings` - Field transformation rules with dimensions and attributes

**Resource types (common values):**
- `customer` - Company/organization data
- `contact` - Person/contact data
- `deal` - Business deal/opportunity data
- `document` - Document/file data
- `person` - Individual person data
- `record` - Generic record data

**Note:** `resourceType` is a free-form string matching the pattern `^[a-z0-9-]+$`. Any valid lowercase alphanumeric string with hyphens is allowed.
- `person` - Individual person data
- `document` - Document/file data
- `deal` - Deal/opportunity data

**Example:**
```json
{
  "key": "hubspot-company",
  "displayName": "HubSpot Company",
  "systemKey": "hubspot",
  "entityType": "company",
  "resourceType": "customer",
  "fieldMappings": {
    "dimensions": {
      "country": "metadata.country"
    },
    "attributes": {
      "name": {
        "expression": "{{properties.name.value}} | trim",
        "type": "string",
        "indexed": false
      }
    }
  }
}
```

**Note:** Datasource files are named using the datasource key: `<system-key>-datasource-<datasource-key>.json`. For example, a datasource with `key: "hubspot-company"` and `systemKey: "hubspot"` creates the file `hubspot-datasource-company.json`.

#### entityType enum

The `entityType` field is validated against the schema enum. Allowed values (from `lib/schema/external-datasource.schema.json`):

| Value | Description |
|-------|-------------|
| `document-storage`, `documentStorage` | Document storage with vector storage |
| `vector-store`, `vectorStore` | External vector storage system |
| `record-storage`, `recordStorage` | Record-based system with metadata sync and access rights |
| `message-service`, `messageService` | Message service (Slack, Teams, Email) |
| `none` | Uses external system data directly or connects other data sources |

Both camelCase and kebab-case are accepted. The field determines which type schema is used for validation (e.g. `documentStorage` → document-storage schema).

**Example:**
```json
{
  "key": "hubspot-documents",
  "entityType": "documentStorage",
  "resourceType": "document",
  "systemKey": "hubspot",
  "documentStorage": {
    "enabled": true,
    "binaryOperationRef": "get"
  }
}
```

In this example, `entityType="documentStorage"` causes `documentStorage` to validate against `type/document-storage.json`.

### Field Mappings

Field mappings transform external API data into normalized schemas.

**Expression syntax:**
```yaml
{{path.to.value}} | transformation1 | transformation2
```

**Available transformations:**
- `trim` - Remove whitespace
- `toLower` - Convert to lowercase
- `toUpper` - Convert to uppercase
- `default("value")` - Use default if empty
- `toNumber` - Convert to number

**HubSpot example:**
HubSpot uses nested properties:
```json
{
  "properties": {
    "name": { "value": "Acme Corp" },
    "country": { "value": "us" }
  }
}
```

Map to flat structure:
```json
{
  "name": {
    "expression": "{{properties.name.value}} | trim",
    "type": "string"
  },
  "country": {
    "expression": "{{properties.country.value}} | toUpper | trim",
    "type": "string"
  }
}
```

**Dimensions:**
Dimensions are used for ABAC (Attribute-Based Access Control) filtering using the dimensions-first model. The `dimensions` object maps dimension keys (from the Dimension Catalog) to attribute paths (e.g., `metadata.country`, `metadata.domain`). Dimensions are automatically indexed for efficient filtering.

**Example:**
```json
{
  "fieldMappings": {
    "dimensions": {
      "country": "metadata.country",
      "department": "metadata.department",
      "organization": "metadata.organization"
    },
    "attributes": {
      "country": {
        "expression": "{{properties.country.value}} | toUpper",
        "type": "string",
        "indexed": false
      }
    }
  }
}
```

Dimensions should identify data ownership or access scope (e.g., `country`, `domain`, `organization`).

**Indexed attributes:**
The `indexed` property in attribute definitions controls whether a database index is created for that attribute. Set `indexed: true` for attributes that are frequently used in queries or filters. Dimensions are automatically indexed (no `indexed` property needed).

**Example:**
```json
{
  "fieldMappings": {
    "attributes": {
      "id": {
        "expression": "{{id}}",
        "type": "string",
        "indexed": true
      },
      "name": {
        "expression": "{{properties.name.value}} | trim",
        "type": "string",
        "indexed": false
      }
    }
  }
}
```

**Record references:** Use the `record_ref:` prefix in expressions to create typed relationships between records across datasources. This creates foreign key relationships in the dataplane.

**Example:**
```json
{
  "fieldMappings": {
    "attributes": {
      "customerId": {
        "expression": "record_ref:customer",
        "type": "string"
      },
      "dealId": {
        "expression": "record_ref:deal",
        "type": "string"
      }
    }
  }
}
```

The `record_ref:` prefix must be followed by a valid entity type (pattern: `^[a-z0-9-]+$`).

### Test Payloads

Test payloads allow you to test field mappings and metadata schemas locally and via integration tests. Add a `testPayload` property to your datasource configuration:

```json
{
  "key": "hubspot-company",
  "systemKey": "hubspot",
  "entityType": "company",
  "fieldMappings": {
    "dimensions": {
      "country": "metadata.country"
    },
    "attributes": {
      "name": {
        "expression": "{{properties.name.value}} | trim",
        "type": "string",
        "indexed": false
      },
      "country": {
        "expression": "{{properties.country.value}} | toUpper | trim",
        "type": "string",
        "indexed": false
      }
    }
  },
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

**Test Payload Properties:**
- `payloadTemplate` - Sample payload matching the expected API response structure. Used for testing field mappings and metadata schema validation.
- `expectedResult` - (Optional) Expected normalized result after field mapping transformations. Used for validation in unit tests.

**Using Test Payloads:**
- **Unit tests** (`aifabrix test`): Validates field mappings against `payloadTemplate` and compares with `expectedResult` if provided
- **Integration tests** (`aifabrix test-integration`): Sends `payloadTemplate` to dataplane pipeline test API for real validation

**Benefits:**
- Test field mappings locally without API calls
- Validate metadata schemas before deployment
- Catch mapping errors early in development
- Ensure consistent transformation results

### Advanced Datasource Features

The datasource schema supports additional advanced features beyond basic field mappings:

**Execution Engine:**
- `execution.engine` - Choose between `"cip"` (Composable Integration Pipeline, declarative) or `"python"` (custom handlers)
- `execution.cip` - Define CIP operations with steps (fetch, paginate, map, filter, output)
- `execution.python` - Reference Python entrypoint for custom logic

**Capabilities:**
- `capabilities` - Declare which operations are supported (`list`, `get`, `create`, `update`, `delete`)

**Data Quality & Validation:**
- `validation` - Advanced validation rules (repeating values, merge strategies)
- `quality` - Data quality rules (reject conditions, validation operators)
- `indexing` - Indexing and embedding strategy (embedding fields, unique keys, deduplication)

**AI Context:**
- `context` - Natural-language hints for AI agents (semantic tags, synonyms, natural language hints)

**Document Storage:**
- `documentStorage` - Vector storage configuration for document-based datasources. The type schema used for validation is determined by the `entityType` field (e.g., `entityType="document"` maps to `type/document-storage.json`)

**Sync Configuration:**
- `sync` - Record synchronization rules (pull/push/bidirectional, schedule, batch size)

These features are optional and can be added as needed. See the `external-datasource.schema.json` for complete schema definitions.

### OpenAPI Operations

Configure which API endpoints to expose for each datasource.

```json
{
  "openapi": {
    "enabled": true,
    "documentKey": "hubspot-v3",
    "baseUrl": "https://api.hubapi.com",
    "operations": {
      "list": {
        "operationId": "getCompanies",
        "method": "GET",
        "path": "/crm/v3/objects/companies"
      },
      "get": {
        "operationId": "getCompany",
        "method": "GET",
        "path": "/crm/v3/objects/companies/{companyId}"
      },
      "create": {
        "operationId": "createCompany",
        "method": "POST",
        "path": "/crm/v3/objects/companies"
      },
      "update": {
        "operationId": "updateCompany",
        "method": "PATCH",
        "path": "/crm/v3/objects/companies/{companyId}"
      },
      "delete": {
        "operationId": "deleteCompany",
        "method": "DELETE",
        "path": "/crm/v3/objects/companies/{companyId}"
      }
    },
    "autoRbac": true
  }
}
```

**What this does:**
- `enabled: true` - Enables OpenAPI exposure
- `documentKey` - References registered OpenAPI spec
- `operations` - Maps CRUD operations to API endpoints
- `autoRbac: true` - Auto-generates RBAC permissions (`hubspot.company.list`, `hubspot.company.get`, etc.)

### Exposed Attributes

Control which attributes are exposed via MCP/OpenAPI.

```json
{
  "exposed": {
    "attributes": ["id", "name", "email"],
    "omit": ["internalId", "secret"],
    "readonly": ["createdAt"],
    "groups": {
      "default": ["id", "name"],
      "analytics": ["id", "name", "email", "revenue"]
    }
  }
}
```

**What this does:**
- `attributes` - List of attributes to expose (default: all attributes)
- `omit` - Attributes to never expose (overrides `attributes`)
- `readonly` - Attributes that can't be modified
- `groups` - Logical groupings for different use cases

---

## HubSpot Complete Example

Here's a complete HubSpot integration with companies, contacts, and deals.

### File Structure

```yaml
integration/
  hubspot/
    variables.yaml
    hubspot-system.json                    # External system definition
    hubspot-datasource-company.json        # Datasource: key="hubspot-company"
    hubspot-datasource-contact.json         # Datasource: key="hubspot-contact"
    hubspot-datasource-deal.json            # Datasource: key="hubspot-deal"
    hubspot-deploy.json                     # Deployment manifest (generated)
    rbac.yaml                              # RBAC roles and permissions (optional)
    env.template
```

**File Naming Convention:**
- System file: `<system-key>-system.json` (e.g., `hubspot-system.json`)
- Datasource files: `<system-key>-datasource-<datasource-key>.json` (e.g., `hubspot-datasource-company.json`)
- Deployment manifest: `<system-key>-deploy.json` (e.g., `hubspot-deploy.json`) - generated by `aifabrix json`
- The `entityType` comes from the datasource's `entityType` field in the JSON

### variables.yaml

```yaml
app:
  key: hubspot
  displayName: "HubSpot CRM Integration"
  type: external

externalIntegration:
  schemaBasePath: ./
  systems:
    - hubspot-system.json
  dataSources:
    - hubspot-datasource-company.json
    - hubspot-datasource-contact.json
    - hubspot-datasource-deal.json
  autopublish: true
  version: 1.0.0
```

**Important:** Only one system is supported per application. The `systems` array should contain a single entry. Only the first system in the array will be included in the generated `<systemKey>-deploy.json`. Multiple data sources are supported and all will be included.

### hubspot-system.json

```json
{
  "key": "hubspot",
  "displayName": "HubSpot CRM",
  "description": "HubSpot CRM integration with OpenAPI support",
  "type": "openapi",
  "enabled": true,
  "environment": {
    "baseUrl": "https://api.hubapi.com"
  },
  "authentication": {
    "type": "oauth2",
    "oauth2": {
      "tokenUrl": "{{TOKENURL}}",
      "clientId": "{{CLIENTID}}",
      "clientSecret": "{{CLIENTSECRET}}",
      "scopes": [
        "crm.objects.companies.read",
        "crm.objects.companies.write",
        "crm.objects.contacts.read",
        "crm.objects.contacts.write",
        "crm.objects.deals.read",
        "crm.objects.deals.write"
      ]
    }
  },
  "configuration": [
    {
      "name": "CLIENTID",
      "value": "hubspot-clientidKeyVault",
      "location": "keyvault",
      "required": true
    },
    {
      "name": "CLIENTSECRET",
      "value": "hubspot-clientsecretKeyVault",
      "location": "keyvault",
      "required": true
    },
    {
      "name": "TOKENURL",
      "value": "https://api.hubapi.com/oauth/v1/token",
      "location": "variable",
      "required": true
    },
    {
      "name": "HUBSPOT_API_VERSION",
      "value": "v3",
      "location": "variable",
      "required": false,
      "portalInput": {
        "field": "select",
        "label": "HubSpot API Version",
        "placeholder": "Select API version",
        "options": ["v1", "v2", "v3"],
        "validation": {
          "required": false
        }
      }
    },
    {
      "name": "MAX_PAGE_SIZE",
      "value": "100",
      "location": "variable",
      "required": false,
      "portalInput": {
        "field": "text",
        "label": "Maximum Page Size",
        "placeholder": "100",
        "validation": {
          "required": false,
          "pattern": "^[0-9]+$",
          "minLength": 1,
          "maxLength": 1000
        }
      }
    }
  ],
  "openapi": {
    "documentKey": "hubspot-v3",
    "autoDiscoverEntities": false
  },
  "tags": ["crm", "sales", "marketing", "hubspot"]
}
```

**Key points:**
- **Standard variables** (`CLIENTID`, `CLIENTSECRET`, `TOKENURL`) are managed by the dataplane credentials system—no `portalInput` needed
- **Custom variables** (`HUBSPOT_API_VERSION`, `MAX_PAGE_SIZE`) use `portalInput` to configure UI fields in the portal interface
- Values are stored in Key Vault automatically by the platform
- Standard variables are set via the dataplane credentials interface
- Custom variables with `portalInput` get UI fields for user configuration

### hubspot-datasource-company.json

See the complete example in `integration/hubspot/hubspot-datasource-company.json` for:
- Full metadata schema for HubSpot company properties
- Field mappings with transformations
- OpenAPI operations configuration
- Exposed fields configuration

### env.template

```bash
# HubSpot OAuth2 Configuration
# Values are set via Miso Controller or Dataplane portal interface
# Key Vault storage is managed automatically by the platform

CLIENTID=kv://hubspot-clientidKeyVault
CLIENTSECRET=kv://hubspot-clientsecretKeyVault
TOKENURL=https://api.hubapi.com/oauth/v1/token
```

**Setup:**
1. Values are set via the Miso Controller or Dataplane portal interface
2. Key Vault storage is managed automatically by the platform
3. Values are resolved at deployment time from the `configuration` array

---

## Development Workflow

### Complete External System Development Workflow

The AI Fabrix Builder supports a complete development workflow for external systems:

1. **Download** - Get existing system from dataplane
2. **Unit Test** - Validate locally without API calls
3. **Integration Test** - Test via dataplane pipeline API
4. **Deploy** - Deploy using application-level workflow

### 1. Download External System from Dataplane

Download an existing external system from the dataplane to your local development environment:

```bash
# Download external system
aifabrix download hubspot
```

**What happens:**
- Downloads system configuration from dataplane API
- Downloads all datasource configurations
- Creates `integration/<system-key>/` folder structure
- Generates all development files (variables.yaml, JSON files, env.template, README.md)

**File structure created:**
```yaml
integration/
  hubspot/
    variables.yaml                   # App configuration with externalIntegration block
    hubspot-system.json              # External system definition
    hubspot-datasource-company.json  # Companies datasource
    hubspot-datasource-contact.json  # Contacts datasource
    hubspot-datasource-deal.json     # Deals datasource
    hubspot-deploy.json              # Deployment manifest (generated)
    rbac.yaml                        # RBAC roles and permissions (optional)
    env.template                     # Environment variables template
    README.md                        # Documentation
```

### 2. Edit Configuration Files

Edit the configuration files in `integration/<system-key>/` to make your changes:
- Update field mappings in datasource JSON files
- Modify authentication configuration
- Add or update test payloads for testing

### 3. Unit Test (Local Validation)

Test your configuration locally without making API calls:

```bash
# Test entire system
aifabrix test hubspot

# Test specific datasource
aifabrix test hubspot --datasource hubspot-company

# Verbose output
aifabrix test hubspot --verbose
```

**What happens:**
- Validates JSON syntax
- Validates against schemas
- Tests field mapping expressions
- Validates metadata schemas against test payloads (if provided)
- Validates relationships

**No API calls are made** - this is pure local validation.

### 4. Integration Test (Via Dataplane)

Test your configuration against the real dataplane pipeline API:

```bash
# Test entire system
aifabrix test-integration hubspot

# Test specific datasource
aifabrix test-integration hubspot --datasource hubspot-company

# Use custom test payload
aifabrix test-integration hubspot --payload ./test-payload.json
```

**What happens:**
- Calls dataplane pipeline test API
- Tests field mappings with real API responses
- Validates metadata schemas
- Tests endpoint connectivity
- Returns detailed validation results

### 5. Deploy to Controller

Deploy using the application-level workflow:

```bash
aifabrix deploy hubspot
```

**What happens:** The CLI sends the deployment to the **Miso Controller** (pipeline API). The controller then deploys to the dataplane (or target environment). We do not deploy directly to the dataplane from the CLI for app-level deploy; the controller orchestrates deployment.

1. Generates `<systemKey>-deploy.json` (combines one system + all datasources)
2. Sends to controller via pipeline API (validate then deploy)
3. Controller deploys to dataplane; validates and publishes
4. System and datasources are deployed together

**Note:** Only one system per application is supported. If multiple systems are listed in `variables.yaml`, only the first one is included in the generated `<systemKey>-deploy.json`.

## Deployment Workflow

### 1. Configure Authentication Values

Set authentication credentials via the Miso Controller or Dataplane portal interface:

1. Navigate to the external system configuration in the portal
2. Enter OAuth2 credentials (Client ID, Client Secret, Token URL)
3. Values are automatically stored in Key Vault by the platform
4. No manual Key Vault operations required

**Note:** The platform manages Key Vault storage automatically. You only need to provide values via the interface.

### 2. Validate Configuration

```bash
aifabrix validate hubspot
```

### 3. Generate Deployment JSON

```bash
aifabrix json hubspot
```

**What happens:**
- Combines `variables.yaml` with all JSON files
- Generates application schema structure (one system + all datasources) ready for deployment
- Validates all configurations against schemas
- The schema structure is used internally by `aifabrix deploy` command
- **Note:** Only the first system from `externalIntegration.systems` is included. All data sources from `externalIntegration.dataSources` are included.

### 4. Deploy to Controller

```bash
aifabrix deploy hubspot
```

**What happens:** The CLI sends the deployment to the **Miso Controller**. The controller then deploys to the dataplane (or target environment). We do not deploy directly to the dataplane from the CLI for app-level deploy; the controller orchestrates it.

1. Generates controller manifest (if not already generated) via `aifabrix json` internally
2. Uses the same controller pipeline as regular apps: Validate then Deploy (`POST /api/v1/pipeline/{envKey}/validate`, `POST /api/v1/pipeline/{envKey}/deploy`)
3. Controller deploys external system and datasources to the dataplane
4. Field mappings are compiled; OpenAPI operations are registered; system is ready for querying

**Controller pipeline benefits:** Same workflow as application deployment; validation before deploy; optional polling for deployment status.

### 5. Deploy Individual Datasources (Optional)

You can deploy and test individual datasources:

```bash
# Deploy a single datasource
aifabrix datasource deploy hubspot hubspot-datasource-company.json

# This is useful for:
# - Testing individual datasources
# - Incremental deployment
# - Updating specific datasources without redeploying the entire system
```

### 6. Verify Deployment

```bash
# List all datasources
aifabrix datasource list

# Validate specific datasource
aifabrix datasource validate hubspot-company

# Query via MCP
# (Use MCP client to query hubspot.company.list, etc.)
```

---

## Complete Workflow Example

Here's a complete workflow for developing an external system:

### Download and Modify Existing System

```bash
# 1. Download external system from dataplane
aifabrix download hubspot

# 2. Edit configuration files in integration/hubspot/
#    - Update field mappings
#    - Add test payloads
#    - Modify authentication

# 3. Run unit tests (local validation, no API calls)
aifabrix test hubspot

# 4. Run integration tests (via dataplane pipeline API)
aifabrix test-integration hubspot

# 5. Deploy back to dataplane (via application-level workflow)
aifabrix deploy hubspot
```

### Create New System from Scratch

```bash
# 1. Create new external system
aifabrix create hubspot --type external

# 2. Edit configuration files in integration/hubspot/
#    - Configure authentication
#    - Set up field mappings
#    - Add test payloads

# 3. Run unit tests
aifabrix test hubspot

# 4. Run integration tests
aifabrix test-integration hubspot

# 5. Deploy to dataplane
aifabrix deploy hubspot
```

---

## Common Patterns

### Pattern 1: Nested Properties (HubSpot-style)

Many APIs use nested property structures. Map them to flat attributes:

```json
{
  "fieldMappings": {
    "dimensions": {
      "country": "metadata.country"
    },
    "attributes": {
      "name": {
        "expression": "{{properties.name.value}} | trim",
        "type": "string",
        "indexed": false
      }
    }
  }
}
```

### Pattern 2: Array Extraction

Extract first item from array:

```json
{
  "associatedCompany": {
    "expression": "{{associations.companies.results[0].id}}",
    "type": "string"
  }
}
```

### Pattern 3: Multiple Transformations

Chain transformations:

```json
{
  "email": {
    "expression": "{{properties.email.value}} | toLower | trim",
    "type": "string"
  },
  "country": {
    "expression": "{{properties.country.value}} | toUpper | trim",
    "type": "string"
  }
}
```

### Pattern 4: Default Values

Use defaults for optional fields:

```json
{
  "status": {
    "expression": "{{properties.status.value}} | default('active')",
    "type": "string"
  }
}
```

---

## Troubleshooting

**"Validation failed: Invalid JSON"**
→ Check JSON syntax with a JSON validator
→ Ensure all required fields are present
→ Verify field mapping expressions are valid

**"Authentication failed"**
→ Verify Key Vault secrets exist
→ Check kv:// paths match Key Vault secret names
→ Ensure OAuth2 credentials are correct
→ Verify scopes are granted in external system

**"Field mapping error"**
→ Check expression syntax: `{{path}} | transformation`
→ Verify source path exists in API response
→ Test expressions with sample data

**"Deployment failed"**
→ Check controller URL is correct
→ Verify authentication with controller
→ Review deployment logs in controller UI

**"Application deployment requires image"**
→ External systems do not use Docker images. Use `internal: true` in `variables.yaml` (under `externalIntegration`) so the system deploys on dataplane startup; then restart the dataplane.

**"Dataplane URL not found in application configuration"**
→ External systems do not have their own dataplane URL. Dataplane URL is discovered from the controller; ensure the controller is set via `aifabrix login` or `aifabrix auth config --set-controller`.

**"Cannot read properties of undefined (reading 'forEach')"**
→ Validation may crash for some external integrations. Validate individual files: `aifabrix validate integration/<app>/<file>.json`.

**"Datasource not appearing"**
→ Check `autopublish: true` in `variables.yaml`
→ Verify datasource JSON files are listed in `dataSources`
→ Check datasource is enabled: `"enabled": true`

**"OpenAPI operations not working"**
→ Verify `documentKey` matches registered OpenAPI spec
→ Check `baseUrl` matches external API
→ Ensure `operationId` matches OpenAPI spec
→ Verify authentication is configured correctly

**Datasource deploy:** Controller and environment come from `config.yaml` (set via `aifabrix login` or `aifabrix auth config`). The dataplane URL is discovered from the controller. Example: `aifabrix datasource deploy hubspot integration/hubspot/hubspot-datasource-company.json`.

**Validate individual files:** If `aifabrix validate <app>` fails, validate files directly: `aifabrix validate integration/hubspot/hubspot-system.json`, `aifabrix validate integration/hubspot/hubspot-datasource-company.json`.

---

## Next Steps

- [Configuration: External integration](configuration/external-integration.md) - Detailed config options
- [CLI Reference](commands/external-integration.md) - All commands for external systems
- [Pipeline Deployment](.cursor/plans/pipeline.md) - Advanced deployment options
- [Field Mappings Guide](configuration/README.md) - Configuration index and variables

---

## Command Reference

**Download external system:**
```bash
aifabrix download <system-key>
```

**Delete external system:**
```bash
aifabrix delete <system-key> --type external

# Skip confirmation prompt
aifabrix delete <system-key> --type external --yes
```

**Create external system:**
```bash
aifabrix create <app> --type external [--wizard]

# Non-interactive example
aifabrix create hubspot --type external \
  --display-name "HubSpot CRM" \
  --description "HubSpot CRM integration" \
  --system-type openapi \
  --auth-type oauth2 \
  --datasources 2
```

**Validate configuration:**
```bash
aifabrix validate <app>
aifabrix validate <file-path>
```

**Unit test (local validation):**
```bash
aifabrix test <app> [--datasource <key>] [--verbose]
```

**Integration test (via dataplane):**
```bash
aifabrix test-integration <app> [--datasource <key>] [--payload <file>]
```

**Generate deployment JSON:**
```bash
aifabrix json <app>
```

**Deploy to controller:**
```bash
aifabrix deploy <app> [--skip-validation]
```

**Deploy individual datasource:** (uses controller and environment from config; dataplane is discovered from the controller)
```bash
aifabrix datasource deploy <app-key> <datasource-file>
```

**List datasources:**
```bash
aifabrix datasource list
```

**Validate datasource:**
```bash
aifabrix datasource validate <datasource-key>
```


