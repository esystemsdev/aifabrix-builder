# Configuration

← [Back to Your Own Applications](../your-own-applications.md)

Overview of AI Fabrix configuration files and where to find details.

## Index

| Topic | Description |
|-------|-------------|
| [variables.yaml](variables-yaml.md) | App configuration: app.key, app.displayName, port, image, build, requires, externalIntegration, etc. |
| [env.template](env-template.md) | Environment variables template; kv:// references; `.env` generation. |
| [External integration](external-integration.md) | externalIntegration block, schemaBasePath, systems, dataSources; validation. |
| [Secrets and config](secrets-and-config.md) | config.yaml, secrets.local.yaml, encryption (aifabrix secure). |
| [env-config](env-config.md) | Environment-specific variable interpolation (${MISO_HOST}, ${NODE_ENV}, etc.). |

## Mapping: variables.yaml vs schema

- In **variables.yaml** you use nested keys: `app.key`, `app.displayName`, `app.type`, `port`, `image.*`, `build.*`, `requires.*`, `externalIntegration`, etc.
- The **generator** transforms these into the flat structure expected by the deployment API and [application-schema.json](../../lib/schema/application-schema.json).
- **deploymentKey** is not set in variables.yaml; it is computed (SHA256 of the deployment manifest) during JSON generation and appears in the output only.
- **key** in the schema corresponds to **app.key** in variables.yaml; **displayName** to **app.displayName**; **type** to **app.type**.

## Quick links

- [Commands: Utilities](commands/utilities.md) – resolve, json, split-json, secrets set, secure
- [Commands: Validation](commands/validation.md) – validate, diff
- [External systems](../external-systems.md) – External system and datasource JSON
