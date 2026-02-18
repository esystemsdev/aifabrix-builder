# Configuration

← [Documentation index](../README.md) · [Configuration](README.md)

Overview of AI Fabrix configuration files and where to find details.

## Index

| Topic | Description |
|-------|-------------|
| [Deployment key](deployment-key.md) | How deployment key is calculated (SHA256 of manifest); why Miso Controller and Dataplane use the same key. |
| [application.yaml](application-yaml.md) | Application config: app.key, app.displayName, port, image, build, requires, externalIntegration, etc. |
| [env.template](env-template.md) | Environment variables template; kv:// references; `.env` generation. |
| [External integration](external-integration.md) | externalIntegration block, schemaBasePath, systems, dataSources; validation. |
| [Secrets and config](secrets-and-config.md) | config.yaml, secrets.local.yaml, encryption (aifabrix secure); **remote development** (remote-server, docker-endpoint, aifabrix-workspace-root) and remote vs local secrets (aifabrix-secrets as URL vs file). |
| [env-config](env-config.md) | Environment-specific variable interpolation (${MISO_HOST}, ${NODE_ENV}, etc.). |

## Version

Version (`app.version`) is a semantic version that tracks product/application changes. For regular apps, it can be auto-resolved from the Docker image when running or deploying. See [application.yaml](application-yaml.md#version-and-tag), [External integration](external-integration.md), and [Deploying](../deploying.md#version-vs-deployment).

## Mapping: application.yaml vs schema

- In **application.yaml** you use nested keys: `app.key`, `app.displayName`, `app.type`, `port`, `image.*`, `build.*`, `requires.*`, `externalIntegration`, etc.
- The **generator** transforms these into the flat structure expected by the deployment API and [application-schema.json](../../lib/schema/application-schema.json).
- **deploymentKey** is not set in application.yaml; it is managed by Controller internally. See [Deployment key](deployment-key.md).
- **key** in the schema corresponds to **app.key** in application.yaml; **displayName** to **app.displayName**; **type** to **app.type**.

## Remote development

When using a remote dev server, set `remote-server`, `docker-endpoint`, and `aifabrix-workspace-root` in `config.yaml`; all dev APIs use certificate (mTLS) authentication. See [Secrets and config](secrets-and-config.md) for remote vs local secrets (aifabrix-secrets as `http(s)://` URL vs file path) and [Developer isolation](../developer-isolation.md) for one network per developer and remote Docker.

## Quick links

- [Commands: Utilities](../commands/utilities.md) – resolve, json, split-json, secrets list/set/remove, secure
- [Commands: Developer isolation](../commands/developer-isolation.md) – dev init, dev config, remote setup
- [Commands: Validation](../commands/validation.md) – validate, diff
- [External systems](../external-systems.md) – External system and datasource JSON
