# External integration block

← [Documentation index](../README.md) · [Configuration](README.md)

In `variables.yaml`, the **externalIntegration** block defines external systems and datasources for pipeline deployment.

**Fields:**
- **schemaBasePath** – Folder containing system and datasource JSON files (required if block present).
- **systems** – List of external-system JSON filenames; only the first entry is used per application.
- **dataSources** – List of external-datasource JSON filenames; all are included.
- **autopublish** – If true, pipeline publishes to Dataplane after deployment (default true).
- **version** – Integration version for schema diffing (e.g. `1.0.0`). Must be unique per integration; use semantic versioning and increment when the schema changes. If `app.version` is set, it overrides this value. Otherwise defaults to `1.0.0`.

Paths are relative to the variables.yaml file or absolute. Validation: `aifabrix validate <app>`; external system files are validated against `external-system.schema.json`, datasource files against `external-datasource.schema.json`.

**Example:**
```yaml
externalIntegration:
  schemaBasePath: ./schemas
  systems:
    - hubspot-system.json
  dataSources:
    - hubspot-datasource-deal.json
    - hubspot-datasource-contact.json
  autopublish: true
  version: 1.0.0
```

See [External systems](../external-systems.md) and [variables.yaml](variables-yaml.md).
