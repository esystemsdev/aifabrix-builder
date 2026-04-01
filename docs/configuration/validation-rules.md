# Validation rules for `aifabrix validate <external-system-key>`

← [Configuration](README.md) · [Commands: Validation](../commands/validation.md)

When you run `aifabrix validate <external-system-key>` (or a file path), the CLI runs **three steps** in order: application configuration, component files, and the full deployment manifest. Each step applies the rules below. Validation is **offline** (no network or backend required). You can also run validation for **all** integrations or builder apps in one call using **`aifabrix validate --integration`** or **`aifabrix validate --builder`**; see [Validation commands](../commands/validation.md#aifabrix-validate-apporfile).

**Upload and download:** On **upload** (`aifabrix upload <system-key>`), configuration values are resolved before send: `location: variable` → `{{VAR}}` from the integration’s `.env`; `location: keyvault` → `kv://` from secrets. On **download** (`aifabrix download <system-key>`), when `env.template` exists, configuration entries whose `name` matches a variable in env.template have their `value` set to `{{name}}` so the downloaded file stays template-based.

**Note:** If you pass a **file path** instead of an app name, the command validates that single file against the appropriate schema (external-system or external-datasource). The same schema rules apply; see [Validation commands](../commands/validation.md#aifabrix-validate-apporfile) for usage.

---

## Relationship to dataplane validation

Builder validation is **offline**: schema and structural checks only, no network or dimension catalog. The **dataplane** applies the same schemas at create/update and deploy, plus **referential checks** when a database session is available (dimension catalog lookup, OpenAPI keys, datasource existence). Aligning Builder rules with the dataplane (e.g. grantType/authorizationUrl, rateLimit shape, configuration vs auth variables) helps configs pass both local and deploy-time validation. For full dataplane behavior (dimensions, create/update rules, troubleshooting), see the dataplane knowledgebase.

---

## Dimensions and deploy-time behavior

Builder does **not** validate dimension keys against a dimension catalog. At **deploy** the dataplane applies:

| Check | Dataplane behavior |
| ----- | ------------------ |
| Dimension key exists in Dimension Catalog | **Warning** if missing; deploy can continue (catalog may be synced later). |
| Dimension `dataType` vs attribute type | **Error** if mismatch; validation fails. |

Local validation (`aifabrix validate`) checks dimension syntax and structure only. Use `aifabrix test-integration` or deployment to validate dimensions against the catalog.

---

## Validation steps

| Step | What is checked | Scope |
| ------ | ----------------- | ----- |
| **1** | Application configuration | `application.yaml`, RBAC file (`rbac.yaml`, `rbac.yml`, or `rbac.json`), `env.template` in the app directory |
| **2** | Component files | Each external system file and each external datasource file listed in `externalIntegration.systems` and `externalIntegration.dataSources` |
| **3** | Deployment manifest | Generated manifest (structure, inline system, inline datasources, systemKey alignment) |

If Step 1 or Step 2 fails, the command reports errors and does not run the next step. Step 3 runs only when Step 2 passes.

---

## Step 1: Application configuration

The validate command checks application config, RBAC (if present), and the environment template.

### application.yaml

| Rule | Requirement |
| ------ | ----------- |
| Application schema | The file must conform to the application schema (required fields, types, patterns). |
| `app.key` | Required. Lowercase letters, numbers, hyphens only. |
| `app.type` | Required. One of: `webapp`, `functionapp`, `api`, `service`, `external`. |
| `app.displayName`, `app.description` | Required by schema when present in transformed structure. |
| `port` | If present, number between 1 and 65535 (for non-external types). |
| `externalIntegration` (when `app.type` is `external`) | **Required.** Must be present when the app type is external. |
| `externalIntegration.schemaBasePath` | Required when `externalIntegration` exists. Path to the directory containing system and datasource files. |
| `externalIntegration.systems` | Required when `externalIntegration` exists. Non-empty array of system file names. |
| `frontDoorRouting` | If `enabled` is true, `host` is required. If `pattern` is set, it must start with `/`. |

### externalIntegration block (when type is external)

| Rule | Requirement |
| ------ | ----------- |
| `schemaBasePath` | Required. Resolved relative to the application config directory; must exist and be a directory. |
| `systems` | Non-empty array. Each entry is a file name under the schema base path (e.g. `hubspot-system.yaml`). |
| `dataSources` | Optional array of datasource file names under the schema base path. |

### RBAC file (rbac.yaml, rbac.yml, or rbac.json — if present)

| Rule | Requirement |
| ------ | ----------- |
| `roles` | Must be an array. Each role must have `name`, `value`, and `description`. |
| Role `value` | No duplicate values. Use `groups` (lowercase), not `Groups`. |
| `permissions` | Must be an array. Each permission must have `name`, `roles`, and `description`. |
| Permission `name` | No duplicate names. |
| Role references | Every value in `permissions[].roles` must exist in `roles[].value`. |

### env.template

| Rule | Requirement |
| ------ | ----------- |
| Variable lines | Non-empty, non-comment lines must contain `=`. Variable name (left of `=`) must be non-empty. |
| `kv://` references | If present: path must be non-empty, must not start or end with `/`. Use form like `kv://secret-key` or `kv://path/to/key`. |

---

## Step 2: Component files

The command validates each file listed in `externalIntegration.systems` and `externalIntegration.dataSources` against the external-system or external-datasource schema. File names and paths are resolved from the schema base path.

### External system file(s)

Files (e.g. `*-system.yaml` or `*-system.json`) are validated against the external system schema.

| Field or section | Requirement |
| ----------------- | ----------- |
| `key` | Required. String, pattern lowercase letters, numbers, hyphens only. Length 3–40. |
| `displayName` | Required. String, length 1–100. |
| `description` | Required. String, length 1–500. |
| `type` | Required. One of: `openapi`, `mcp`, `custom`. |
| `authentication` | Required. Object with `method` and `variables`. |
| `authentication.method` | One of: `oauth2`, `apikey`, `basic`, `aad`, `none`, `queryParam`, `oidc`, `hmac`. |
| `authentication.variables` | Required. When method is not `none`, must include `baseUrl` (and other method-specific keys per schema). |
| `authentication.security` | When present, values must be `kv://` references only (no plain secrets). |
| **grantType (oauth2/aad)** | Optional. When present must be `client_credentials` or `authorization_code`. When `authorization_code` or omitted, `authorizationUrl` is required. |
| **rateLimit (optional)** | When present, must specify either `requestsPerWindow` + `windowSeconds` or `requestsPerSecond` + `burstSize` (enforced by schema). |
| **configuration and auth variables** | **Do not** add standard auth variable names to the `configuration` array: BASEURL, CLIENTID, CLIENTSECRET, TOKENURL, APIKEY, USERNAME, PASSWORD. They are credential parameters supplied from the selected credential at runtime. **Exception:** BASEURL is only allowed in `configuration` when `authentication.method` is `none`. Validation fails with a clear error if any of these (except BASEURL when auth is none) appear in `configuration`. |
| `roles` (optional) | If present: each role must have `name`, `value`, `description`; `value` pattern `^[a-z-]+$`; optional `groups` array. |
| `permissions` (optional) | If present: each permission must have `name`, `roles`, `description`; `roles` must reference existing `roles[].value`. |
| Other sections | `openapi`, `mcp`, `dataSources`, `configuration`, `endpoints`, `tags`, etc. follow schema (patterns, enums, structure). |

**Role references:** For external system files, the validator ensures every role referenced in `permissions[].roles` exists in `roles[].value`. If a permission references a role that is not defined, validation fails.

### External datasource file(s)

Files (e.g. `*-datasource-*.yaml` or `*-datasource-*.json`) are validated against the external datasource schema. After schema validation, the CLI runs **field reference** and **ABAC** checks so that `aifabrix validate <file>` and Step 2 component validation match the same rules as `aifabrix datasource validate <file>`. Builder aligns with dataplane procedural checks where possible; dimension catalog lookup and `crossSystemSql` parsing remain server-side.

| Field or section | Requirement |
| ----------------- | ----------- |
| `key` | Required. String, pattern lowercase letters, numbers, hyphens. Min length 3. |
| `displayName` | Required. String, min length 1. |
| `systemKey` | Required. Must match the parent external system `key`. |
| `entityType` | Required. Canonical values (see `external-datasource.schema.json`): `documentStorage`, `vectorStore`, `recordStorage`, `messageService`, `none`. |
| `resourceType` | Required. Pattern lowercase letters, numbers, hyphens (e.g. `document`, `customer`, `deal`). |
| `fieldMappings` | Required. Object with **`attributes`** (object) only at this level; **`dimensions` live at the datasource root** (v2.4), not under `fieldMappings`. |
| `fieldMappings.attributes` | Each attribute must include **`expression`** (DSL: `raw.*`, `fk.*`, `dimension.*`). Optional metadata (`description`, `semantic`, etc.) follows the schema; there is no separate `type` property on attributes in the strict v2.4 attribute shape—typing is defined in **`metadataSchema.properties`**. |
| **Field reference validation** | Each of `indexing.embedding[]`, `indexing.uniqueKey`, `validation.repeatingValues[].field`, `quality.rejectIf[].field` must reference a key in `fieldMappings.attributes`. |
| **primaryKey** | Each element must be a key in **`fieldMappings.attributes`** or a **key of root `dimensions`** (dimension binding name). |
| **`metadataSchema` (storage)** | For **`entityType`** `recordStorage` or `documentStorage`, JSON Schema requires **`metadataSchema.properties.externalId`**: `type: string`, **`index: true`** (stable join / external identity). You should define a matching **`fieldMappings.attributes.externalId`** expression. |
| **exposed.profiles** | Each field in `exposed.profiles.<name>[]` must exist in `fieldMappings.attributes`. |
| **ABAC (config.abac)** | Dimension keys and attribute paths in **`config.abac.dimensions`** must follow pattern and (where applicable) reference existing attributes. `config.abac.crossSystemJson` must have one operator per path and allowed operators only. Legacy `config.abac.crossSystem` is rejected (use `crossSystemJson` or `crossSystemSql`). |
| `exposed` | v2.4 public contract uses **`exposed.schema`** (object: response field → expression). Optional **`exposed.readonly`** / **`exposed.omit`** arrays. Legacy **`exposed.attributes`** is deprecated. |
| `execution` | If present, must include `engine`: `cip` or `python`; CIP definitions and Python entrypoints follow schema. |
| Other sections | `metadataSchema`, `sync`, `openapi`, `validation`, `quality`, `indexing`, `context`, `documentStorage`, `capabilities`, `config`, `contract`, etc. follow schema. |

---

## Step 3: Deployment manifest

After component files pass, the command builds the deployment manifest and validates it. The manifest combines application identity, the inline system object, and the inline datasources.

| Rule | Requirement |
| ------ | ----------- |
| Manifest structure | The manifest must conform to the application schema (top-level shape and types). |
| Required top-level fields | `key`, `displayName`, `description`, `type` must be present. |
| Inline `system` | When present, must satisfy the external system schema in full. |
| Inline `dataSources` | If present, must be an array; each item must satisfy the external datasource schema. |
| System required (type external) | For applications of type `external`, the manifest must include a `system` object. |
| systemKey alignment | Each datasource’s `systemKey` must equal the application system’s `key`. If any datasource has a different `systemKey`, validation fails with a clear message. |
| No datasources | If type is `external` and there are no datasources, a warning is reported (allowed). |

---

## Rules at a glance

| Category | Rule | When it applies |
| --------- | ---- | --------------- |
| Application | application.yaml conforms to application schema | Step 1 |
| Application | `externalIntegration` required when `app.type` is `external` | Step 1 |
| Application | `externalIntegration.schemaBasePath` and `externalIntegration.systems` (non-empty) required | Step 1 |
| Application | `frontDoorRouting`: if enabled, host required; pattern must start with `/` | Step 1 |
| RBAC | `roles` and `permissions` structure; no duplicate role value or permission name | Step 1 (if RBAC file present) |
| RBAC | Every `permissions[].roles` value must exist in `roles[].value` | Step 1 (if RBAC file present) |
| env.template | Valid variable lines; `kv://` path non-empty, no leading/trailing slash | Step 1 |
| External system file | Required: key, displayName, description, type, authentication; patterns and enums per schema | Step 2 |
| External system file | configuration must not contain standard auth variables (BASEURL, CLIENTID, CLIENTSECRET, TOKENURL, APIKEY, USERNAME, PASSWORD); BASEURL only when auth is none | Step 2 |
| External system file | Role references in permissions must exist in roles | Step 2 |
| External datasource file | Required: key, displayName, systemKey, entityType, resourceType, fieldMappings (`attributes`); storage types need **`metadataSchema.properties.externalId`** per schema; structure per schema | Step 2 |
| Manifest | Manifest structure and required top-level fields | Step 3 |
| Manifest | Inline system and each datasource conform to their schemas | Step 3 |
| Manifest | Each datasource `systemKey` matches application system key | Step 3 |

---

## Validation at create/update (dataplane)

When you create or update an external system or datasource via the API or pipeline deploy, the dataplane applies additional rules beyond schema and Builder checks. Summary:

- **External system:** Authentication (e.g. OAuth2/AAD grantType and authorizationUrl), rateLimit shape, OpenAPI/MCP key lookup when available, datasource key references and system ownership, RBAC structure.
- **External datasource:** **primaryKey** required for storage entity types (non-empty array of attribute or root-dimension keys); **entityType** (e.g. `none` for orchestration-only datasources); **`externalId`** in **`metadataSchema`** for **`recordStorage`/`documentStorage`**; **field names** (letters, numbers, underscores only); root **dimensions** vs **attributes** must not reuse the same logical surface inconsistently; metadata type changes and incompatible replacements can cause deploy to be rejected with a clear message.

For full dataplane rules and troubleshooting (dimension catalog, pipeline deployment), see the dataplane documentation.

---

## Prerequisites

- The argument must resolve to an external system: the app directory is under `integration/<name>/` (or the resolved path is treated as external).
- `application.yaml` must exist and include an `externalIntegration` block with `schemaBasePath` and a non-empty `systems` array.
- All system and datasource files referenced in `externalIntegration.systems` and `externalIntegration.dataSources` must exist under the schema base path.

---

## Troubleshooting

- **Validation fails at Step 1** – Fix `application.yaml`, the RBAC file (rbac.yaml / rbac.yml / rbac.json), or `env.template` as reported. Ensure `externalIntegration` is present when `app.type` is `external`, and that `schemaBasePath` and `systems` are set.
- **Role reference errors** – Ensure every role value used in `permissions[].roles` (in the RBAC file or in external system files) exists in the corresponding `roles` array with that `value`.
- **systemKey mismatch** – Ensure each datasource file’s `systemKey` matches the external system’s `key` (the same value used in the system file and in the generated manifest).
- **File not found** – Run `aifabrix repair <app>` to sync config with files on disk, or add the missing system/datasource files under the schema base path.

For full command usage, examples, and error messages, see [Validation commands](../commands/validation.md#aifabrix-validate-apporfile). Local validation does not run online checks (e.g. ABAC dimension catalog); those occur during deployment or when using test-integration.
