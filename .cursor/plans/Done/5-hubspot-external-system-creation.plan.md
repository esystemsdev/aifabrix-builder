<!-- d15a4cf2-8f1c-489a-97e4-934ca5c5f118 a7ef4b77-050b-4a30-9f0c-9b30cc37a258 -->
# HubSpot External System Creation and Documentation

## Overview

Create a complete HubSpot external system integration with three datasources (companies, contacts, deals) and comprehensive documentation guide for creating external systems via the aifabrix CLI.

## Current State

- External system creation via `aifabrix create <app> --type external` exists
- Templates exist in `templates/external-system/` for system and datasource generation
- External systems use `integration/<app>/` folder structure (new implementation)
- HubSpot-specific configuration needs to be created
- Documentation exists in `docs/QUICK-START.md` but needs dedicated external systems guide

## Tasks

### Task 1: Create HubSpot External System Configuration

#### 1.1: Create HubSpot-specific external system JSON

**File**: `integration/hubspot/hubspot-deploy.json`

- Create HubSpot external system configuration with:
  - `key`: "hubspot"
  - `displayName`: "HubSpot CRM"
  - `type`: "openapi"
  - `environment.baseUrl`: "https://api.hubapi.com"
  - `authentication`: OAuth2 configuration with HubSpot-specific endpoints
    - `tokenUrl`: "https://api.hubapi.com/oauth/v1/token"
    - Required scopes: `crm.objects.companies.read`, `crm.objects.companies.write`, `crm.objects.contacts.read`, `crm.objects.contacts.write`, `crm.objects.deals.read`, `crm.objects.deals.write`
  - `openapi.documentKey`: "hubspot-v3"
  - `tags`: ["crm", "sales", "marketing", "hubspot"]

#### 1.2: Create HubSpot Companies Datasource

**File**: `integration/hubspot/hubspot-deploy-company.json`

- Configure companies datasource with:
  - `key`: "hubspot-company"
  - `systemKey`: "hubspot"
  - `entityKey`: "company"
  - `resourceType`: "customer"
  - `metadataSchema`: HubSpot company properties structure
  - `fieldMappings`: Map HubSpot company fields to normalized fields
    - Common fields: `id`, `name`, `domain`, `country`, `city`, `industry`, `website`, `phone`, `createdAt`, `updatedAt`
  - `exposed.fields`: Fields exposed via MCP/OpenAPI
  - `openapi.operations`: HubSpot Companies API operations
    - `list`: GET `/crm/v3/objects/companies`
    - `get`: GET `/crm/v3/objects/companies/{companyId}`
    - `create`: POST `/crm/v3/objects/companies`
    - `update`: PATCH `/crm/v3/objects/companies/{companyId}`
    - `delete`: DELETE `/crm/v3/objects/companies/{companyId}`

#### 1.3: Create HubSpot Contacts Datasource

**File**: `integration/hubspot/hubspot-deploy-contact.json`

- Configure contacts datasource with:
  - `key`: "hubspot-contact"
  - `systemKey`: "hubspot"
  - `entityKey`: "contact"
  - `resourceType`: "contact"
  - `metadataSchema`: HubSpot contact properties structure
  - `fieldMappings`: Map HubSpot contact fields to normalized fields
    - Common fields: `id`, `firstName`, `lastName`, `email`, `phone`, `company`, `jobTitle`, `address`, `city`, `country`, `createdAt`, `updatedAt`
  - `exposed.fields`: Fields exposed via MCP/OpenAPI
  - `openapi.operations`: HubSpot Contacts API operations
    - `list`: GET `/crm/v3/objects/contacts`
    - `get`: GET `/crm/v3/objects/contacts/{contactId}`
    - `create`: POST `/crm/v3/objects/contacts`
    - `update`: PATCH `/crm/v3/objects/contacts/{contactId}`
    - `delete`: DELETE `/crm/v3/objects/contacts/{contactId}`

#### 1.4: Create HubSpot Deals Datasource

**File**: `integration/hubspot/hubspot-deploy-deal.json` (or `builder/hubspot/schemas/hubspot-deal.json`)

- Configure deals datasource with:
  - `key`: "hubspot-deal"
  - `systemKey`: "hubspot"
  - `entityKey`: "deal"
  - `resourceType`: "deal"
  - `metadataSchema`: HubSpot deal properties structure
  - `fieldMappings`: Map HubSpot deal fields to normalized fields
    - Common fields: `id`, `dealName`, `amount`, `currency`, `stage`, `pipeline`, `closeDate`, `dealType`, `associatedCompany`, `associatedContacts`, `createdAt`, `updatedAt`
  - `exposed.fields`: Fields exposed via MCP/OpenAPI
  - `openapi.operations`: HubSpot Deals API operations
    - `list`: GET `/crm/v3/objects/deals`
    - `get`: GET `/crm/v3/objects/deals/{dealId}`
    - `create`: POST `/crm/v3/objects/deals`
    - `update`: PATCH `/crm/v3/objects/deals/{dealId}`
    - `delete`: DELETE `/crm/v3/objects/deals/{dealId}`

#### 1.5: Create HubSpot variables.yaml

**File**: `integration/hubspot/variables.yaml`

- Create application configuration with:
  - `app.type`: "external"
  - `app.key`: "hubspot"
  - `externalIntegration` block:
    - `schemaBasePath`: "./"
    - `systems`: ["hubspot-deploy.json"]
    - `dataSources`: ["hubspot-deploy-company.json", "hubspot-deploy-contact.json", "hubspot-deploy-deal.json"]
    - `autopublish`: true
    - `version`: "1.0.0"

#### 1.6: Create HubSpot env.template

**File**: `integration/hubspot/env.template`

- Create environment template with:
  - `HUBSPOT_CLIENT_ID`: kv://hubspot-oauth2-client-id
  - `HUBSPOT_CLIENT_SECRET`: kv://hubspot-oauth2-client-secret
  - `HUBSPOT_REDIRECT_URI`: kv://hubspot-oauth2-redirect-uri (optional)

### Task 2: Create External Systems Documentation Guide

#### 2.1: Create comprehensive external systems guide

**File**: `docs/EXTERNAL-SYSTEMS.md` (new)

- Create guide covering:
  - Overview of external systems
  - When to use external systems vs regular applications
  - Step-by-step creation process
  - Configuration structure explanation
  - Authentication setup (OAuth2, API Key, Basic Auth)
  - Datasource configuration
  - Field mappings and transformations
  - OpenAPI/MCP configuration
  - Deployment process
  - Validation and testing
  - Troubleshooting

#### 2.2: Add HubSpot-specific example section

**File**: `docs/EXTERNAL-SYSTEMS.md`

- Add dedicated HubSpot example section with:
  - Complete HubSpot setup walkthrough
  - OAuth2 configuration steps
  - Companies, contacts, and deals datasource examples
  - Field mapping examples for HubSpot properties
  - API endpoint configuration
  - Common HubSpot-specific configurations

#### 2.3: Update QUICK-START.md

**File**: `docs/QUICK-START.md`

- Add reference to new EXTERNAL-SYSTEMS.md guide
- Update external system workflow section to point to detailed guide

#### 2.4: Update CLI-REFERENCE.md

**File**: `docs/CLI-REFERENCE.md`

- Ensure external system creation command is well documented
- Add examples for HubSpot creation
- Reference EXTERNAL-SYSTEMS.md guide

### Task 3: Integration Folder Structure

External systems are created in the `integration/<app>/` folder with all files in the same directory:

- `integration/<app>/variables.yaml` - Application configuration
- `integration/<app>/<app-name>-deploy.json` - External system JSON
- `integration/<app>/<app-name>-deploy-<datasource-key>.json` - Datasource JSON files
- `integration/<app>/env.template` - Environment variables template
- `integration/<app>/README.md` - Documentation

## Implementation Notes

### HubSpot API Configuration

- **Base URL**: `https://api.hubapi.com`
- **OAuth2 Token URL**: `https://api.hubapi.com/oauth/v1/token`
- **API Version**: v3 (REST API)
- **Required Scopes**:
  - `crm.objects.companies.read`
  - `crm.objects.companies.write`
  - `crm.objects.contacts.read`
  - `crm.objects.contacts.write`
  - `crm.objects.deals.read`
  - `crm.objects.deals.write`

### HubSpot Field Mappings

HubSpot uses a properties-based structure where each field is nested:

```json
{
  "properties": {
    "field_name": {
      "value": "actual_value"
    }
  }
}
```

Field mappings should extract values using expressions like:

- `{{properties.name.value}}` for company name
- `{{properties.email.value}}` for contact email
- `{{properties.amount.value}}` for deal amount

### File Structure

```
integration/
  hubspot/
    variables.yaml
    hubspot-deploy.json
    hubspot-deploy-company.json
    hubspot-deploy-contact.json
    hubspot-deploy-deal.json
    env.template
    README.md
```

All files are in the same folder for easy viewing and management. The `schemaBasePath` in `variables.yaml` is set to `"./"` to reference files in the same directory.

## Acceptance Criteria

- HubSpot external system JSON created with OAuth2 authentication
- Three datasources created: companies, contacts, deals
- All datasources have proper field mappings for HubSpot properties structure
- All datasources have OpenAPI operations configured for CRUD operations
- `variables.yaml` configured with externalIntegration block
- `env.template` created with kv:// references for secrets
- Comprehensive documentation guide created in `docs/EXTERNAL-SYSTEMS.md`
- HubSpot-specific examples included in documentation
- Documentation references updated in QUICK-START.md and CLI-REFERENCE.md
- All files validate against schemas
- All files created in `integration/hubspot/` folder structure

## Command Examples

```bash
# Create HubSpot/vali external system
aifabrix create hubspot --type external

# Validate configuration
aifabrix validate hubspot

# Generate deployment JSON
aifabrix json hubspot

# Deploy to controller
aifabrix deploy hubspot --controller https://controller.aifabrix.ai --environment dev
```

### To-dos

- [ ] Create HubSpot external system JSON with OAuth2 authentication configuration
- [ ] Create HubSpot companies datasource with field mappings and OpenAPI operations
- [ ] Create HubSpot contacts datasource with field mappings and OpenAPI operations
- [ ] Create HubSpot deals datasource with field mappings and OpenAPI operations
- [ ] Create variables.yaml with externalIntegration block referencing all datasources
- [ ] Create env.template with kv:// references for HubSpot OAuth2 credentials
- [ ] Create comprehensive EXTERNAL-SYSTEMS.md guide with step-by-step instructions
- [ ] Add HubSpot-specific examples and walkthrough to EXTERNAL-SYSTEMS.md
- [ ] Update QUICK-START.md to reference new EXTERNAL-SYSTEMS.md guide
- [ ] Update CLI-REFERENCE.md with HubSpot examples and reference to guide