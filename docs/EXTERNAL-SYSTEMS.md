# External Systems Guide

← [Back to Quick Start](QUICK-START.md)

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

---

## Quick Start: Create Your First External System

Let's create a HubSpot integration step by step.

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
    hubspot-deploy.json              # External system definition
    hubspot-deploy-company.json      # Companies datasource
    hubspot-deploy-contact.json      # Contacts datasource
    hubspot-deploy-deal.json         # Deals datasource
    env.template                     # Environment variables
    README.md                        # Documentation
```

All files are in the same folder for easy viewing and management.

### Step 2: Configure Authentication

Edit `integration/hubspot/hubspot-deploy.json` to configure OAuth2. Use standard environment variable references:

```json
{
  "key": "hubspot",
  "displayName": "HubSpot CRM",
  "type": "openapi",
  "environment": {
    "baseUrl": "https://api.hubapi.com"
  },
  "authentication": {
    "type": "oauth2",
    "mode": "oauth2",
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

**Example: `hubspot-deploy-company.json`**

```json
{
  "key": "hubspot-company",
  "systemKey": "hubspot",
  "entityKey": "company",
  "resourceType": "customer",
  "fieldMappings": {
    "accessFields": ["country", "domain"],
    "fields": {
      "name": {
        "expression": "{{properties.name.value}} | trim",
        "type": "string"
      },
      "domain": {
        "expression": "{{properties.domain.value}} | toLower | trim",
        "type": "string"
      },
      "country": {
        "expression": "{{properties.country.value}} | toUpper | trim",
        "type": "string"
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
- Defines `accessFields` for ABAC (Attribute-Based Access Control) filtering
- Configures OpenAPI operations to expose via REST API

### Step 4: Validate Configuration

```bash
# Validate entire integration
aifabrix validate hubspot

# Validate individual files
aifabrix validate integration/hubspot/hubspot-deploy.json
aifabrix validate integration/hubspot/hubspot-deploy-company.json
```

**What happens:**
- Validates JSON syntax
- Checks against schemas (`external-system.schema.json`, `external-datasource.schema.json`)
- Verifies required fields are present
- Checks field mapping expressions are valid

### Step 5: Deploy

```bash
# Login to controller
aifabrix login --controller https://controller.aifabrix.ai --method device --environment dev

# Register application (if not already registered)
aifabrix app register hubspot --environment dev

# Generate deployment JSON
aifabrix json hubspot

# Deploy to controller
aifabrix deploy hubspot --controller https://controller.aifabrix.ai --environment dev
```

**What happens:**
1. `aifabrix json` - Generates `hubspot-deploy.json` combining all configuration
2. `aifabrix deploy` - Deploys via Miso Controller pipeline API
3. System is registered in the dataplane
4. Datasources are published and available for querying

### Step 6: Verify Deployment

```bash
# List all datasources
aifabrix datasource list --environment dev

# Validate deployed datasource
aifabrix datasource validate hubspot-company --environment dev
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

The external system JSON (`<app-name>-deploy.json`) defines the connection to the third-party API.

**Required fields:**
- `key` - Unique identifier (lowercase, alphanumeric, hyphens)
- `displayName` - Human-readable name
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
      "pattern": "^regex$",
      "min": 1,
      "max": 100
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
  - `validation` - Validation rules (required, minLength, pattern, min, max, etc.)

**Important distinctions:**
- **Standard variables** (`CLIENTID`, `CLIENTSECRET`, `TOKENURL`, `APIKEY`, `USERNAME`, `PASSWORD`, `REDIRECT_URI`) are managed by the dataplane credentials system—**do not include `portalInput`**
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

| Variable Name | Description | Used For | Example |
|--------------|-------------|----------|---------|
| `{{CLIENTID}}` | OAuth2 Client ID | OAuth2 authentication | `{{CLIENTID}}` |
| `{{CLIENTSECRET}}` | OAuth2 Client Secret | OAuth2 authentication | `{{CLIENTSECRET}}` |
| `{{TOKENURL}}` | OAuth2 Token URL | OAuth2 token endpoint | `{{TOKENURL}}` |
| `{{APIKEY}}` | API Key | API Key authentication | `{{APIKEY}}` |
| `{{USERNAME}}` | Basic Auth Username | Basic authentication | `{{USERNAME}}`|
| `{{PASSWORD}}` | Basic Auth Password | Basic authentication | `{{PASSWORD}}` |
| `{{REDIRECT_URI}}` | OAuth2 Redirect URI | OAuth2 callback URL | `{{REDIRECT_URI}}` |

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
          "min": 1,
          "max": 1000
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
    "mode": "oauth2",
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
4. Configure redirect URI in external system
5. Add required scopes to `scopes` array

#### API Key

Simpler for testing or private APIs.

```json
{
  "authentication": {
    "type": "apikey",
    "mode": "apikey",
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
    "mode": "basic",
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

### Datasource Configuration

Each datasource maps one entity type from the external system.

**Required fields:**
- `key` - Unique datasource identifier
- `systemKey` - Must match external system `key`
- `entityKey` - Entity identifier in external system
- `fieldMappings` - Field transformation rules

**Resource types:**
- `customer` - Company/organization data
- `contact` - Person/contact data
- `person` - Individual person data
- `document` - Document/file data
- `deal` - Deal/opportunity data

**Example:**
```json
{
  "key": "hubspot-company",
  "displayName": "HubSpot Company",
  "systemKey": "hubspot",
  "entityKey": "company",
  "resourceType": "customer",
  "fieldMappings": {
    "accessFields": ["country"],
    "fields": {
      "name": {
        "expression": "{{properties.name.value}} | trim",
        "type": "string"
      }
    }
  }
}
```

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

**Access fields:**
Fields listed in `accessFields` are used for ABAC (Attribute-Based Access Control) filtering. These should be fields that identify data ownership or access scope (e.g., `country`, `domain`, `organization`).

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

### Exposed Fields

Control which fields are exposed via MCP/OpenAPI.

```json
{
  "exposed": {
    "fields": ["id", "name", "email"],
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
- `fields` - List of fields to expose (default: all fields)
- `omit` - Fields to never expose (overrides `fields`)
- `readonly` - Fields that can't be modified
- `groups` - Logical groupings for different use cases

---

## HubSpot Complete Example

Here's a complete HubSpot integration with companies, contacts, and deals.

### File Structure

```yaml
integration/
  hubspot/
    variables.yaml
    hubspot-deploy.json
    hubspot-deploy-company.json
    hubspot-deploy-contact.json
    hubspot-deploy-deal.json
    env.template
```

### variables.yaml

```yaml
app:
  key: hubspot
  displayName: "HubSpot CRM Integration"
  type: external

externalIntegration:
  schemaBasePath: ./
  systems:
    - hubspot-deploy.json
  dataSources:
    - hubspot-deploy-company.json
    - hubspot-deploy-contact.json
    - hubspot-deploy-deal.json
  autopublish: true
  version: 1.0.0
```

### hubspot-deploy.json

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
    "mode": "oauth2",
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
      "name": "REDIRECT_URI",
      "value": "hubspot-redirect-uriKeyVault",
      "location": "keyvault",
      "required": false
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
          "min": 1,
          "max": 1000
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
- **Standard variables** (`CLIENTID`, `CLIENTSECRET`, `TOKENURL`, `REDIRECT_URI`) are managed by the dataplane credentials system—no `portalInput` needed
- **Custom variables** (`HUBSPOT_API_VERSION`, `MAX_PAGE_SIZE`) use `portalInput` to configure UI fields in the portal interface
- Values are stored in Key Vault automatically by the platform
- Standard variables are set via the dataplane credentials interface
- Custom variables with `portalInput` get UI fields for user configuration

### hubspot-deploy-company.json

See the complete example in `integration/hubspot/hubspot-deploy-company.json` for:
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
REDIRECT_URI=kv://hubspot-redirect-uriKeyVault
```

**Setup:**
1. Values are set via the Miso Controller or Dataplane portal interface
2. Key Vault storage is managed automatically by the platform
3. Values are resolved at deployment time from the `configuration` array

---

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
- Generates `hubspot-deploy.json` ready for deployment
- Validates all configurations

### 4. Deploy to Controller

```bash
aifabrix deploy hubspot --controller https://controller.aifabrix.ai --environment dev
```

**What happens:**
1. External system is registered via pipeline API
2. Datasources are published to dataplane
3. Field mappings are compiled
4. OpenAPI operations are registered
5. System is ready for querying

### 5. Deploy Individual Datasources (Optional)

You can deploy and test individual datasources:

```bash
# Deploy a single datasource
aifabrix datasource deploy hubspot-company --environment dev --file integration/hubspot/hubspot-deploy-company.json

# This is useful for:
# - Testing individual datasources
# - Incremental deployment
# - Updating specific datasources without redeploying the entire system
```

### 6. Verify Deployment

```bash
# List all datasources
aifabrix datasource list --environment dev

# Validate specific datasource
aifabrix datasource validate hubspot-company --environment dev

# Query via MCP
# (Use MCP client to query hubspot.company.list, etc.)
```

---

## Common Patterns

### Pattern 1: Nested Properties (HubSpot-style)

Many APIs use nested property structures. Map them to flat fields:

```json
{
  "fieldMappings": {
    "fields": {
      "name": {
        "expression": "{{properties.name.value}} | trim",
        "type": "string"
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

**"Datasource not appearing"**
→ Check `autopublish: true` in `variables.yaml`
→ Verify datasource JSON files are listed in `dataSources`
→ Check datasource is enabled: `"enabled": true`

**"OpenAPI operations not working"**
→ Verify `documentKey` matches registered OpenAPI spec
→ Check `baseUrl` matches external API
→ Ensure `operationId` matches OpenAPI spec
→ Verify authentication is configured correctly

---

## Next Steps

- [Configuration Reference](CONFIGURATION.md#external-integration) - Detailed config options
- [CLI Reference](CLI-REFERENCE.md) - All commands for external systems
- [Pipeline Deployment](.cursor/plans/pipeline.md) - Advanced deployment options
- [Field Mappings Guide](CONFIGURATION.md#field-mappings) - Advanced mapping patterns

---

## Command Reference

**Create external system:**
```bash
aifabrix create <app> --type external
```

**Validate configuration:**
```bash
aifabrix validate <app>
aifabrix validate <file-path>
```

**Generate deployment JSON:**
```bash
aifabrix json <app>
```

**Deploy to controller:**
```bash
aifabrix deploy <app> --controller <url> --environment <env>
```

**Deploy individual datasource:**
```bash
aifabrix datasource deploy <datasource-key> --environment <env> --file <path-to-datasource-json>
```

**List datasources:**
```bash
aifabrix datasource list --environment <env>
```

**Validate datasource:**
```bash
aifabrix datasource validate <datasource-key> --environment <env>
```


