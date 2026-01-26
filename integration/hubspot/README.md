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

## Documentation

- [External Systems Guide](../../docs/external-systems.md) - Complete guide with examples
- [CLI Reference](../../docs/cli-reference.md) - All commands
- [Configuration Reference](../../docs/CONFIGURATION.md) - Config file details


