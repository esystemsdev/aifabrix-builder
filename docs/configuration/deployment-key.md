# Deployment key

← [Documentation index](../README.md) · [Configuration](README.md)

**Miso Controller** owns the deployment key. Builder and Dataplane send manifest only (no `deploymentKey`). The Controller Pipeline REST API computes the key from the manifest and stores it internally.

## CLI perspective

- **`aifabrix json <app>`** – Generates deployment manifest (without `deploymentKey`). Use before commit so version control has the correct file.
- **`aifabrix deploy <app>`** – Sends manifest to Controller. The CLI does not compute or display the key.

## When Controller does the job

The Controller Pipeline REST API:

1. Receives the manifest from Builder or Dataplane
2. Normalizes to schema and validates
3. Computes the deployment key from properties listed in the **central mapping** (`triggerPaths`)
4. Merges values per source vs target rule
5. Stores key and configuration internally

## Central mapping

Deployment rules are defined in a single file instead of schema annotations:

- **File:** `lib/schema/deployment-rules.yaml`
- **Format:** YAML with `application`, `externalSystem`, `externalDataSource` sections
- **Keys:**
  - `triggerPaths` – paths whose change affects deployment key / requires deploy
  - `overridablePaths` – paths whose value can differ per environment (preserve on promote)

A path may appear in both (e.g. `authentication.endpoints` – triggers deploy and is overridable). Child paths override parent semantics. Schemas remain clean; no `x-triggersDeployment` or `x-valueOverridable` annotations.

Implementation details are in the Controller repo.

## Path reference

The canonical source is `lib/schema/deployment-rules.yaml`. Below is a summary.

## What triggers deployment

| Path                                           | Triggers deployment | Value overridable |
| ---------------------------------------------- | ------------------ | ----------------- |
| `key`, `displayName`, `description`, `type`, `version` | Yes | No |
| `image`, `registryMode`, `port`                | Yes                | No                |
| `requiresDatabase`, `requiresRedis`, `requiresStorage`, `databases` | Yes | No |
| `healthCheck` (path, interval, probePath, etc.) | Yes              | interval, probeIntervalInSeconds |
| `frontDoorRouting`, `authentication`, `roles`, `permissions` | Yes | No |
| `authentication.endpoints` (local, custom URLs) | Yes                | Yes               |
| `configuration.items.value`                    | No                 | Yes               |
| `configuration.items.required`                 | Yes                | No                |
| `configuration.items.portalInput`              | Yes                | No                |
| `externalSystem.authentication.oauth2`, `apikey`, `basic`, `aad` | No | Yes |
| `externalSystem.openapi`, `mcp`                 | Yes                | Yes               |
| `externalSystem.configuration.items.value`     | No                 | Yes               |
| `externalSystem.configuration.items`            | Yes                | No                |
| `externalSystem.credentialIdOrKey`             | No                 | Yes               |
| `externalDataSource.key`, `displayName`, `description`, `enabled`, `systemKey`, `entityType`, `resourceType`, `version` | Yes | No |
| `externalDataSource.fieldMappings`, `exposed`, `validation`, `quality`, `indexing`, `context`, `documentStorage`, `portalInput`, `capabilities`, `execution`, `config` | Yes | No |
| `externalDataSource.sync`                      | No                 | Yes               |
| `externalDataSource.openapi`                   | Yes                | Yes               |

## Design rationale

**No secrets in the manifest:** All values are references to secrets or system links (e.g. `kv://…`, credential IDs). The manifest itself never contains actual secrets.

**Values to keep separate per environment** (`overridablePaths`): configuration values, secrets, URLs, and credentials that differ between dev, staging, and production. Examples:

- `configuration.items.value` – literal values, parameter references, secrets
- `authentication.oauth2`, `apikey`, `basic`, `aad` – credential config
- `credentialIdOrKey` – runtime credential reference
- `openapi.specUrl`, `openapi.baseUrl`, `mcp.serverUrl` – endpoints per env
- `authentication.endpoints.local`, `custom` – auth URLs per env
- `sync.schedule`, `batchSize` – sync tuning per env

**Values that impact deployment** (`triggerPaths`): structure, schema, identity, and behavior that require a redeploy when changed. Examples:

- `key`, `displayName`, `type`, `image`, `port` – identity and runtime shape
- `roles`, `permissions`, `endpoints`, `dataSources` – registered structure
- `fieldMappings`, `metadataSchema`, `execution` – data model and pipeline
- `healthCheck.path`, `frontDoorRouting.pattern` – routing and probing

## Environment promotion (dev → tst → pro)

- **Source = Target** (e.g. deploy dev → dev): Update values from manifest
- **Source ≠ Target** (e.g. deploy dev → tst): Keep target's existing values; update schema only
