# Pipeline Deployment Guide

**Purpose**: This document provides comprehensive instructions for builder agents on how to deploy external systems and external data sources via the pipeline deployment API.

**Target Audience**: Builder agents, CI/CD pipelines, automation scripts

**Last Updated**: 2024-12-19

---

## Table of Contents

1. [Overview](#overview)
2. [Builder Agent Instructions](#builder-agent-instructions)
3. [Deploying External System](#deploying-external-system)
4. [Deploying External Data Source](#deploying-external-data-source)
5. [Schema Validation](#schema-validation)
6. [Example Workflows](#example-workflows)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The pipeline deployment API provides a standardized way to deploy external system and external data source configurations via JSON files. This approach offers:

- **Full schema validation** using JSON Schema validators
- **Field mapping compilation** with transformation expressions
- **Metadata schema validation** for data integrity
- **History tracking** for audit trails
- **Idempotent operations** (upsert by key)
- **CI/CD integration** ready

### API Endpoints

- **Deploy External System**: `POST /api/v1/pipeline/deploy`
- **Deploy External Data Source**: `POST /api/v1/pipeline/{systemIdOrKey}/deploy`

### Authentication

The pipeline endpoints support multiple authentication methods:

1. **Bearer Token (JWT)**: For RBAC user authentication
   - Required permission: `external-system:write` or `external-datasource:write`
2. **Client Credentials**: `x-client-id` + `x-client-secret` headers
3. **API Key**: If `API_KEY` env var matches Bearer token

---

## Builder Agent Instructions

### Prerequisites

Before deploying via pipeline, builder agents must:

1. **Validate JSON against schemas**:
   - External System: `app/schemas/json/external-system.schema.json`
   - External Data Source: `app/schemas/json/external-datasource.schema.json`

2. **Ensure required fields are present**:
   - External System: `key`, `displayName`, `description`, `type`, `authentication`
   - External Data Source: `key`, `displayName`, `systemKey`, `entityKey`, `fieldMappings`

3. **Verify system exists** (for datasource deployment):
   - The `systemKey` in datasource config must match an existing ExternalSystem

4. **Prepare credentials** (optional but recommended):
   - OAuth2 credentials should be created before or during deployment
   - Credentials can be linked to systems after deployment

### Deployment Order

**CRITICAL**: Always deploy in this order:

1. **External System** (must be deployed first)
2. **External Data Source** (depends on system)

### Key Principles

1. **Idempotency**: Deployments are upsert operations by `key`. Re-running the same deployment is safe.

2. **Validation First**: All configurations are validated before storage. Invalid configs will fail with detailed error messages.

3. **Compilation**: Field mappings, metadata schemas, and exposed configurations are compiled during deployment.

4. **History Tracking**: Every deployment creates a history entry for audit purposes.

5. **Error Handling**: Always check `ValidationResult` for warnings and errors.

---

## Deploying External System

### Step 1: Prepare JSON Configuration

Create a JSON file matching `external-system.schema.json`. Example structure:

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
      "tokenUrl": "https://api.hubapi.com/oauth/v1/token",
      "clientId": "{{CLIENT_ID}}",
      "clientSecret": "{{CLIENT_SECRET}}",
      "scopes": ["crm.objects.companies.read", "crm.objects.companies.write"]
    }
  },
  "openapi": {
    "documentKey": "hubspot-v3",
    "autoDiscoverEntities": false
  },
  "tags": ["crm", "sales", "marketing"]
}
```

### Step 2: Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `key` | string | Unique identifier (lowercase, alphanumeric, hyphens) | `"hubspot"` |
| `displayName` | string | Human-readable name | `"HubSpot CRM"` |
| `description` | string | System description | `"HubSpot CRM integration"` |
| `type` | enum | `"openapi"`, `"mcp"`, or `"custom"` | `"openapi"` |
| `authentication` | object | Authentication configuration | See schema |

### Step 3: Authentication Configuration

#### OAuth2 Example

```json
{
  "authentication": {
    "type": "oauth2",
    "mode": "oauth2",
    "oauth2": {
      "tokenUrl": "https://api.example.com/oauth/v1/token",
      "clientId": "{{CLIENT_ID}}",
      "clientSecret": "{{CLIENT_SECRET}}",
      "scopes": ["read", "write"]
    }
  }
}
```

#### API Key Example

```json
{
  "authentication": {
    "type": "apikey",
    "mode": "apikey",
    "apikey": {
      "headerName": "X-API-Key",
      "key": "{{API_KEY}}"
    }
  }
}
```

#### Basic Auth Example

```json
{
  "authentication": {
    "type": "basic",
    "mode": "basic",
    "basic": {
      "username": "{{USERNAME}}",
      "password": "{{PASSWORD}}"
    }
  }
}
```

### Step 4: OpenAPI Configuration (if type is "openapi")

```json
{
  "openapi": {
    "documentKey": "hubspot-v3",
    "autoDiscoverEntities": false
  }
}
```

**Note**: The `documentKey` must reference an OpenAPI spec that was previously registered via the builder API.

### Step 5: Deploy via API

**Endpoint**: `POST /api/v1/pipeline/deploy`

**Request Body**: The JSON configuration object

**Response**: `ExternalSystemResponse` with validation results

**Example using Python**:

```python
import httpx
import json

async def deploy_external_system(config_path: str, base_url: str, token: str):
    """Deploy external system via pipeline API."""
    
    # Load JSON configuration
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    # Deploy via API
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{base_url}/api/v1/pipeline/deploy",
            json=config,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
        )
        response.raise_for_status()
        return response.json()

# Usage
system = await deploy_external_system(
    config_path="data/hubspot/deployment/hubspot-external-system.json",
    base_url="http://localhost:3001",
    token="your-jwt-token"
)
```

**Example using curl**:

```bash
curl -X POST "http://localhost:3001/api/v1/pipeline/deploy" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d @data/hubspot/deployment/hubspot-external-system.json
```

### Step 6: Verify Deployment

Check the response for:

1. **System ID**: Confirms system was created/updated
2. **Validation Result**: Check for warnings or errors
3. **Configuration**: Verify compiled configuration is correct

**Example Response**:

```json
{
  "id": "clx1234567890",
  "key": "hubspot",
  "displayName": "HubSpot CRM",
  "description": "HubSpot CRM integration with OpenAPI support",
  "type": "openapi",
  "isActive": true,
  "configuration": {
    "baseUrl": "https://api.hubapi.com",
    "openapi": {
      "documentKey": "hubspot-v3"
    }
  }
}
```

### Step 7: Link Credential (Optional)

After deployment, you can link a credential to the system:

```python
from app.services.external.external_system import ExternalSystemService
from app.schemas.external_data import ExternalSystemUpdate

system_service = ExternalSystemService(db)
update_data = ExternalSystemUpdate(
    credentialIdOrKey="hubspot-oauth"
)
system = await system_service.updateExternalSystemByIdOrKey(
    "hubspot", update_data
)
```

---

## Deploying External Data Source

### Step 1: Prepare JSON Configuration

Create a JSON file matching `external-datasource.schema.json`. Example structure:

```json
{
  "key": "hubspot-companies-get-crm-v3-objects-companies",
  "displayName": "GET /crm/v3/objects/companies (companies)",
  "description": "HubSpot companies list endpoint",
  "systemKey": "hubspot",
  "entityKey": "company",
  "resourceType": "customer",
  "enabled": true,
  "version": "1.0.0",
  "metadataSchema": {
    "type": "object",
    "properties": {
      "properties": {
        "type": "object",
        "properties": {
          "country": {
            "type": "object",
            "properties": {
              "value": {"type": "string"}
            }
          },
          "name": {
            "type": "object",
            "properties": {
              "value": {"type": "string"}
            }
          }
        }
      }
    },
    "required": ["properties"]
  },
  "fieldMappings": {
    "accessFields": ["country"],
    "fields": {
      "country": {
        "expression": "{{properties.country.value}} | toUpper | trim",
        "type": "string",
        "description": "Normalized country code for ABAC filtering",
        "required": false
      },
      "name": {
        "expression": "{{properties.name.value}} | trim",
        "type": "string",
        "description": "Company name",
        "required": false
      }
    }
  },
  "exposed": {
    "fields": ["country", "name"]
  },
  "openapi": {
    "enabled": true,
    "documentKey": "hubspot-v3",
    "baseUrl": "https://api.hubapi.com",
    "operations": {
      "list": {
        "operationId": "getCompanies",
        "method": "GET",
        "path": "/crm/v3/objects/companies"
      }
    },
    "autoRbac": true
  }
}
```

### Step 2: Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `key` | string | Unique identifier | `"hubspot-companies-get"` |
| `displayName` | string | Human-readable name | `"GET /crm/v3/objects/companies"` |
| `systemKey` | string | Must match existing ExternalSystem.key | `"hubspot"` |
| `entityKey` | string | Entity identifier in external system | `"company"` |
| `fieldMappings` | object | Field transformation rules | See schema |
| `resourceType` | enum | `"customer"`, `"contact"`, `"person"`, `"document"`, `"deal"` | `"customer"` |

### Step 3: Resource Type Mapping

**CRITICAL**: The `resourceType` field must be explicitly set based on the entity type:

| Entity Type | resourceType | Example |
|-------------|--------------|---------|
| Companies | `"customer"` | HubSpot companies |
| Contacts | `"contact"` | HubSpot contacts |
| People | `"person"` | Individual persons |
| Documents | `"document"` | SharePoint documents |
| Deals | `"deal"` | HubSpot deals |

**Note**: If `resourceType` is not provided, it defaults to `"document"`, which may be incorrect for CRM entities.

### Step 4: Field Mappings Configuration

Field mappings define how raw external data is transformed into normalized fields:

```json
{
  "fieldMappings": {
    "accessFields": ["country", "region"],
    "fields": {
      "country": {
        "expression": "{{properties.country.value}} | toUpper | trim",
        "type": "string",
        "description": "Normalized country code",
        "required": false
      },
      "region": {
        "expression": "{{properties.region.value}} | toLower",
        "type": "string",
        "required": false
      }
    }
  }
}
```

**Key Points**:

- `accessFields`: List of fields used for ABAC filtering (must exist in `fields`)
- `fields`: Dictionary of normalized field names to transformation expressions
- `expression`: Pipe-based DSL: `{{raw.path}} | toUpper | trim`
- Supported transformations: `toUpper`, `toLower`, `trim`, `default`, etc.

### Step 5: Metadata Schema

Define the JSON Schema for validating raw metadata:

```json
{
  "metadataSchema": {
    "type": "object",
    "properties": {
      "properties": {
        "type": "object",
        "properties": {
          "country": {
            "type": "object",
            "properties": {
              "value": {"type": "string"}
            }
          }
        }
      }
    },
    "required": ["properties"]
  }
}
```

### Step 6: Exposed Fields Configuration

Define which normalized fields are exposed via MCP/OpenAPI:

```json
{
  "exposed": {
    "fields": ["country", "name", "domain"],
    "omit": ["internalId", "secret"],
    "readonly": ["createdAt"],
    "groups": {
      "default": ["country", "name"],
      "analytics": ["country", "name", "domain", "revenue"]
    }
  }
}
```

### Step 7: OpenAPI Operations Configuration

If using OpenAPI-driven connector:

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

### Step 8: Deploy via API

**Endpoint**: `POST /api/v1/pipeline/{systemIdOrKey}/deploy`

**Path Parameter**: `systemIdOrKey` - The system key or ID (must match `systemKey` in config)

**Request Body**: The JSON configuration object

**Response**: `ExternalDataSourceResponse` with validation results

**Example using Python**:

```python
import httpx
import json

async def deploy_external_datasource(
    config_path: str,
    system_key: str,
    base_url: str,
    token: str
):
    """Deploy external datasource via pipeline API."""
    
    # Load JSON configuration
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    # Validate systemKey matches path parameter
    if config.get("systemKey") != system_key:
        raise ValueError(
            f"systemKey '{config.get('systemKey')}' does not match "
            f"path parameter '{system_key}'"
        )
    
    # Deploy via API
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{base_url}/api/v1/pipeline/{system_key}/deploy",
            json=config,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
        )
        response.raise_for_status()
        return response.json()

# Usage
datasource = await deploy_external_datasource(
    config_path="data/hubspot/deployment/hubspot-companies-get.json",
    system_key="hubspot",
    base_url="http://localhost:3001",
    token="your-jwt-token"
)
```

**Example using curl**:

```bash
curl -X POST "http://localhost:3001/api/v1/pipeline/hubspot/deploy" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d @data/hubspot/deployment/hubspot-companies-get.json
```

### Step 9: Verify Deployment

Check the response for:

1. **Datasource ID**: Confirms datasource was created/updated
2. **Validation Result**: Check for warnings or errors
3. **Field Mappings**: Verify compiled field mappings
4. **Metadata Schema**: Verify compiled schema
5. **Resource Type**: Verify `resourceType` is set correctly

**Example Response**:

```json
{
  "id": "clx9876543210",
  "key": "hubspot-companies-get-crm-v3-objects-companies",
  "displayName": "GET /crm/v3/objects/companies (companies)",
  "systemId": "clx1234567890",
  "entityKey": "company",
  "resourceType": "customer",
  "isActive": true,
  "fieldMappings": {
    "accessFields": ["country"],
    "fields": {
      "country": {
        "expression": "{{properties.country.value}} | toUpper | trim",
        "type": "string"
      }
    }
  },
  "configuration": {
    "entityKey": "company",
    "exposed": {
      "fields": ["country", "name"]
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
}
```

---

## Schema Validation

### Validation Process

1. **JSON Schema Validation**: Validates against `external-system.schema.json` or `external-datasource.schema.json`
2. **Business Logic Validation**: Checks relationships, references, and constraints
3. **Compilation**: Compiles field mappings, metadata schemas, and exposed configurations
4. **Storage**: Stores compiled configuration in database

### Validation Result Structure

```python
class ValidationResult:
    isValid: bool
    errors: List[ValidationError]  # Blocking errors
    warnings: List[ValidationWarning]  # Non-blocking warnings
```

### Common Validation Errors

1. **Missing Required Field**: `"Field 'key' is required"`
2. **Invalid Pattern**: `"Field 'key' must match pattern '^[a-z0-9-]+$'"`
3. **System Not Found**: `"External system with key 'hubspot' not found"`
4. **Invalid Expression**: `"Field mapping expression is invalid"`
5. **Schema Mismatch**: `"Metadata schema validation failed"`

### Handling Validation Errors

Always check `ValidationResult` after deployment:

```python
system, validation = await pipeline_service.deployExternalSystem(
    rawConfig=config,
    deployedBy="builder-agent"
)

if not validation.isValid:
    print("✗ Deployment validation failed:")
    for error in validation.errors:
        print(f"    - {error.message}")
    raise ValueError("Deployment validation failed")

if validation.warnings:
    print(f"⚠ Warnings: {len(validation.warnings)}")
    for warning in validation.warnings:
        print(f"    - {warning.message}")
```

---

## Example Workflows

### Workflow 1: Complete HubSpot Integration

```python
async def deploy_hubspot_integration():
    """Deploy complete HubSpot integration."""
    
    base_url = "http://localhost:3001"
    token = "your-jwt-token"
    
    # 1. Deploy External System
    system_config = load_json("data/hubspot/deployment/hubspot-external-system.json")
    system = await deploy_external_system(system_config, base_url, token)
    print(f"✓ Deployed system: {system['key']}")
    
    # 2. Deploy Data Sources
    datasource_files = [
        "data/hubspot/deployment/hubspot-companies-get.json",
        "data/hubspot/deployment/hubspot-contacts-get.json",
        "data/hubspot/deployment/hubspot-deals-get.json",
    ]
    
    for file_path in datasource_files:
        datasource_config = load_json(file_path)
        datasource = await deploy_external_datasource(
            datasource_config,
            system_key="hubspot",
            base_url=base_url,
            token=token
        )
        print(f"✓ Deployed datasource: {datasource['key']}")
```

### Workflow 2: SharePoint Document Integration

```python
async def deploy_sharepoint_integration():
    """Deploy SharePoint document integration."""
    
    # 1. Deploy External System
    system_config = load_json("data/sharepoint/deployment/sharepoint-external-system.json")
    system = await deploy_external_system(system_config, base_url, token)
    
    # 2. Resolve site ID (if needed)
    site_id = await resolve_site_id(site_url, credential_id, db)
    
    # 3. Update datasource config with site ID
    datasource_config = load_json("data/sharepoint/deployment/sharepoint-documents-datasource.json")
    if site_id:
        datasource_config["configuration"]["graph_api"]["site_id"] = site_id
    
    # 4. Deploy Data Source
    datasource = await deploy_external_datasource(
        datasource_config,
        system_key="sharepoint",
        base_url=base_url,
        token=token
    )
```

### Workflow 3: Using Pipeline Service Directly

```python
from app.services.pipeline.pipeline_service import PipelineService
from app.core.database import AsyncSessionLocal

async def deploy_via_service():
    """Deploy using PipelineService directly (for scripts)."""
    
    async with AsyncSessionLocal() as db:
        pipeline_service = PipelineService(db)
        
        # Deploy system
        system_config = load_json("data/hubspot/deployment/hubspot-external-system.json")
        system, validation = await pipeline_service.deployExternalSystem(
            rawConfig=system_config,
            deployedBy="builder-agent"
        )
        
        if not validation.isValid:
            raise ValueError("System deployment failed")
        
        # Deploy datasource
        datasource_config = load_json("data/hubspot/deployment/hubspot-companies-get.json")
        datasource, validation = await pipeline_service.deployExternalDataSource(
            rawConfig=datasource_config,
            systemIdOrKey="hubspot",
            deployedBy="builder-agent"
        )
        
        if not validation.isValid:
            raise ValueError("Datasource deployment failed")
```

---

## Troubleshooting

### Issue: "External system with key 'X' not found"

**Cause**: Trying to deploy datasource before system is deployed.

**Solution**: Deploy external system first, then datasource.

### Issue: "systemKey in config does not match path parameter"

**Cause**: The `systemKey` in the datasource JSON doesn't match the path parameter.

**Solution**: Ensure `systemKey` in JSON matches the path parameter, or omit `systemKey` from JSON (it will be set from path parameter).

### Issue: "Field mapping expression is invalid"

**Cause**: Invalid transformation expression syntax.

**Solution**: Check expression format: `{{path.to.field}} | toUpper | trim`. Ensure:
- Path is wrapped in `{{}}`
- Transformations are separated by `|`
- Transformation names are valid

### Issue: "resourceType defaults to 'document' but should be 'customer'"

**Cause**: `resourceType` field is missing from datasource JSON.

**Solution**: Explicitly set `resourceType` in the JSON configuration:
```json
{
  "resourceType": "customer"  // or "contact", "person", "deal"
}
```

### Issue: "Validation failed: metadata schema is invalid"

**Cause**: The `metadataSchema` doesn't match the actual data structure.

**Solution**: Review the actual API response structure and update `metadataSchema` to match.

### Issue: "OpenAPI documentKey 'X' not found"

**Cause**: The OpenAPI spec hasn't been registered yet.

**Solution**: Register the OpenAPI spec via the builder API before deploying the system.

---

## Best Practices

1. **Always validate JSON before deployment**: Use JSON Schema validators
2. **Deploy systems before datasources**: Respect the dependency order
3. **Check validation results**: Always review warnings and errors
4. **Use version control**: Store JSON configs in version control
5. **Test idempotency**: Re-running deployments should be safe
6. **Document field mappings**: Include descriptions for complex expressions
7. **Set resourceType explicitly**: Don't rely on defaults for CRM entities
8. **Link credentials after deployment**: Credentials can be linked post-deployment

---

## Related Documentation

- **Schema Files**:
  - `app/schemas/json/external-system.schema.json`
  - `app/schemas/json/external-datasource.schema.json`
- **API Endpoints**:
  - `app/api/v1/endpoints/pipeline/pipeline.py`
- **Services**:
  - `app/services/pipeline/pipeline_service.py`
  - `app/services/pipeline/schema_registry_service.py`
- **Example Scripts**:
  - `data/sharepoint/run_pipeline.py`
  - `data/hubspot/run_pipeline.py` (if exists)

---

**End of Pipeline Deployment Guide**

