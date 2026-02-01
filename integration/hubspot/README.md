# HubSpot CRM Integration

HubSpot CRM external system integration with companies, contacts, and deals datasources.

## Overview

This integration connects to HubSpot CRM API and exposes companies, contacts, and deals data via the AI Fabrix Dataplane. Data is automatically synced and made available for querying via MCP/OpenAPI.

## Files

- `variables.yaml` - Application configuration with externalIntegration block
- `hubspot-system.json` - External system definition with OAuth2 authentication
- `hubspot-datasource-company.json` - Companies datasource with field mappings
- `hubspot-datasource-contact.json` - Contacts datasource with field mappings
- `hubspot-datasource-deal.json` - Deals datasource with field mappings
- `hubspot-deploy.json` - Deployment manifest (generated)
- `env.template` - Environment variables template with kv:// references

## Setup

### 1. Configure OAuth2 Credentials

1. Register an OAuth2 app in HubSpot:
   - Go to HubSpot Settings → Integrations → Private Apps
   - Create a new private app
   - Grant scopes:
     - `crm.objects.companies.read`
     - `crm.objects.companies.write`
     - `crm.objects.contacts.read`
     - `crm.objects.contacts.write`
     - `crm.objects.deals.read`
     - `crm.objects.deals.write`

2. Set credentials via Miso Controller or Dataplane portal:
   - Navigate to the HubSpot external system configuration
   - Enter OAuth2 Client ID and Client Secret
   - Values are automatically stored in Key Vault by the platform
   - No manual Key Vault operations required

**Note:** The platform manages Key Vault storage automatically. You only need to provide values via the interface.

### 2. Validate Configuration

```bash
aifabrix validate hubspot
```

### 3. Deploy

```bash
# Login to controller
aifabrix login --controller http://localhost:3100 --method device --environment dev

# Register application
aifabrix app register hubspot

# Deploy entire system
aifabrix deploy hubspot

# Or deploy individual datasources for testing
aifabrix datasource deploy hubspot-company --file integration/hubspot/hubspot-datasource-company.json
aifabrix datasource deploy hubspot-contact --file integration/hubspot/hubspot-datasource-contact.json
aifabrix datasource deploy hubspot-deal --file integration/hubspot/hubspot-datasource-deal.json
```

## Field Mappings

HubSpot uses a nested properties structure. Field mappings transform this to flat, normalized fields:

**HubSpot structure:**
```json
{
  "properties": {
    "name": { "value": "Acme Corp" },
    "country": { "value": "us" }
  }
}
```

**Normalized structure:**
```json
{
  "name": "Acme Corp",
  "country": "US"
}
```

Transformations applied:
- `trim` - Remove whitespace
- `toLower` - Convert to lowercase (for domains, emails)
- `toUpper` - Convert to uppercase (for country codes)

## Datasources

### Companies (`hubspot-company`)
- **Resource Type:** `customer`
- **Access Fields:** `country`, `domain` (for ABAC filtering)
- **Fields:** `id`, `name`, `domain`, `country`, `city`, `industry`, `website`, `phone`, `createdAt`, `updatedAt`

### Contacts (`hubspot-contact`)
- **Resource Type:** `contact`
- **Access Fields:** `email`, `country` (for ABAC filtering)
- **Fields:** `id`, `firstName`, `lastName`, `email`, `phone`, `company`, `jobTitle`, `address`, `city`, `country`, `createdAt`, `updatedAt`

### Deals (`hubspot-deal`)
- **Resource Type:** `deal`
- **Access Fields:** `stage`, `pipeline` (for ABAC filtering)
- **Fields:** `id`, `dealName`, `amount`, `currency`, `stage`, `pipeline`, `closeDate`, `dealType`, `associatedCompany`, `associatedContacts`, `createdAt`, `updatedAt`

## OpenAPI Operations

All datasources expose full CRUD operations:
- `list` - GET `/crm/v3/objects/{entity}`
- `get` - GET `/crm/v3/objects/{entity}/{id}`
- `create` - POST `/crm/v3/objects/{entity}`
- `update` - PATCH `/crm/v3/objects/{entity}/{id}`
- `delete` - DELETE `/crm/v3/objects/{entity}/{id}`

RBAC permissions are auto-generated: `hubspot.company.list`, `hubspot.company.get`, etc.

## Verification

```bash
# List datasources
aifabrix datasource list

# Validate specific datasource
aifabrix datasource validate hubspot-company
```

## Wizard E2E tests and use case coverage

The script `integration/hubspot/test.js` runs end-to-end wizard and validation tests. It covers all wizard use cases from [Wizard Guide](../../docs/wizard.md):

| Use case | Test ID | Description |
|----------|---------|-------------|
| **Headless config (wizard.yaml)** | | |
| Required `appName` | 2.1 | Rejects config missing `appName` |
| Valid `appName` pattern (lowercase, hyphens/underscores) | 2.2 | Rejects uppercase in app name |
| Required `mode` | 2.5 | Rejects invalid `mode` enum |
| Required `source` block | 2.3 | Rejects config without `source` |
| Valid `source.type` | 2.4 | Rejects invalid source type |
| `openapi-file` requires `filePath` | 2.7 | Rejects missing/non-existent OpenAPI file |
| `openapi-url` requires `url` | 2.8 | Rejects `openapi-url` without `url` |
| `known-platform` requires `platform` | 2.6 | Rejects known-platform without `platform` |
| **Mode: add-datasource** | | |
| `systemIdOrKey` required when mode=add-datasource | 2.9 | Rejects add-datasource without systemIdOrKey |
| **Credential** | | |
| `credential.action=select` requires `credentialIdOrKey` | 2.10 | Rejects select without credentialIdOrKey |
| `credential.action=create` requires `config` | 2.11 | Rejects create without config |
| **Positive flows** | | |
| Full wizard with OpenAPI file | 1.1 | Complete flow with local OpenAPI file |
| Wizard with known platform | 1.2 | Flow using known-platform (e.g. HubSpot) |
| Wizard with env var substitution in deployment | 1.6 | `${CONTROLLER_URL}`, `${DATAPLANE_URL}` in wizard.yaml |
| Real credential creation (real-data) | 1.3 | Credential create with real OAuth2 (optional env) |
| **Post-wizard validation (external system)** | | |
| RBAC: permissions reference existing roles | 2.12 | Rejects permission referencing non-existent role |
| RBAC: rbac.yaml valid YAML and structure | 2.13 | Rejects invalid YAML in rbac.yaml |
| Datasource: dimensions required in fieldMappings | 2.14 | Rejects missing dimensions |
| Datasource: dimension key pattern | 2.15 | Rejects invalid dimension key |
| Datasource: attribute path pattern | 2.16 | Rejects invalid attribute path |
| Datasource: dimensions must be object | 2.17 | Rejects dimensions as array |

**Run tests:**

```bash
# All tests (positive may skip if dataplane/controller unavailable)
node integration/hubspot/test.js

# Negative only (no dataplane required)
node integration/hubspot/test.js --type negative

# Specific test
node integration/hubspot/test.js --test "2.1,2.2"
```

## Documentation

- [External Systems Guide](../../docs/external-systems.md) - Complete guide with examples
- [Wizard Guide](../../docs/wizard.md) - Wizard workflow and headless config
- [CLI Reference](../../docs/cli-reference.md) - All commands
- [Configuration Reference](../../docs/CONFIGURATION.md) - Config file details


