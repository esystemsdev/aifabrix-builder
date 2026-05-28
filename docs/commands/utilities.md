# Utility Commands

← [Documentation index](../README.md) · [Commands index](README.md)

Utility commands for managing configuration files, secrets, and deployment artifacts.

---

## Config file formats

Commands in this section work with the following conventions:

- **Application config** — `application.yaml`, `application.yml`, or `application.json` in the app directory. See [application.yaml (application config)](../configuration/application-yaml.md).
- **System and datasource config** (external integrations) — `*-system.*` and `*-datasource-*.*` may be `.yaml`, `.yml`, or `.json`.
- **Deployment manifest** — Always **JSON only**: `<appKey>-deploy.json` or `<systemKey>-deploy.json`. Not editable as YAML.

The CLI loads config via a single converter layer; use whichever format you prefer for application and system/datasource files.

---

<a id="aifabrix-resolve-app"></a>
## aifabrix resolve <app>

Generate `.env` file from template.

**What:** Resolves `kv://` references from secrets file, creates `.env`.

**When:** After secrets change, troubleshooting environment issues.

**Important — only writer of a persistent `.env`:** `aifabrix resolve <app>` is the **only** command that materializes a persistent `<appPath>/.env` (and `build.envOutputPath` when set, using the **same** resolved content for both—no second `local` vs `docker` split). `aifabrix register`, `aifabrix rotate-secret`, `aifabrix build`, and `aifabrix up-platform` / `up-miso` / `up-dataplane` resolve secrets **in memory only** (so missing `kv://` refs still surface as warnings) but never leave a `.env` on disk. `aifabrix run <app>` uses ephemeral `.env.run` / `.env.run.admin` for compose; when **`build.envOutputPath`** is set, **plain `run`** refreshes that file with **`local`**-flavored values (IDE), and **`run --reload`** merges **`.env.run`** into it **only for keys already in the file** (or seeds from the **`local`** template if the file is missing). Run **`aifabrix resolve <app>`** for a full commented file or after large template changes.

**App path:** Resolve works for **builder** apps and for **external integrations** in `integration/<systemKey>/`. If `integration/<systemKey>/env.template` exists **and** no application config file is present in that folder (`application.yaml`, `application.yml`, `application.json`), that directory is used and resolve runs in **env-only** mode. If an application config file exists there (or under `builder/<appKey>/`), the CLI uses full resolve and runs post-resolve validation unless you pass `--skip-validation`.

**Example:**
```bash
aifabrix resolve myapp
```

**Example (external integration with only env.template):**
```bash
aifabrix resolve test-e2e-hubspot
# When integration/test-e2e-hubspot/env.template exists, .env is written to integration/test-e2e-hubspot/.env
```

**Force generate missing secrets:**
```bash
aifabrix resolve myapp --force
```
This will automatically generate missing secret keys in the secrets file with placeholder values.

**Skip validation after generating .env:**
```bash
aifabrix resolve myapp --skip-validation
```
This will generate the .env file without running validation checks afterward.

**Full replace (no merge with existing `.env`):**
```bash
aifabrix resolve dataplane --fresh
```
Writes the complete resolved file from `env.template` to `<appPath>/.env` and `build.envOutputPath` (when set), without merging into an existing `.env`. Use after adding many new variables to `env.template`, or when a normal resolve did not pick up new lines. Same effect as deleting the `.env` files first, then running resolve.

**Flags:**
- `-f, --force` - Generate missing secret keys in secrets file
- `--fresh` - Replace `.env` from template (no merge with existing `.env` or `envOutputPath`)
- `--skip-validation` - Skip file validation after generating .env

**Output:** When the app is in **integration** with **env-only** (only `env.template`, no application config file), `.env` is written to `integration/<systemKey>/.env`. When the app has full config (builder or integration with application config) and `build.envOutputPath` is set, `.env` is written to that path; otherwise behaviour is as documented for run/build (e.g. temp or run-only).

**Env-only mode:** When resolving in **env-only** mode (integration + `env.template` and no application config file), post-resolve validation is skipped because there is nothing to validate as application config. Run `aifabrix validate <app>` separately when you add full config later.

**Local vs Docker:** For paths under `integration/<systemKey>/`, resolve uses **local** host/port rules (no Docker rewrite). Platform builder apps (`keycloak`, `miso-controller`, `dataplane`) and other `builder/<appKey>/` apps use **docker** transforms when generating `.env`.

**Missing `kv://` secrets:** The CLI lists each missing reference and suggests:

1. **Comment or delete** the matching line in `env.template` when the key is not required by your system file (common after switching from OAuth to apikey — run `aifabrix repair <systemKey>` to comment stale OAuth lines).
2. **Store the value:** `aifabrix secret set <systemKey>/<name> "<your-value>"` (add `--shared` when using a team secrets file). Check first with `aifabrix secret get <systemKey>/<name> --shared --exists`.

Use `--force` only when you intend to auto-generate placeholder keys in the secrets file (catalog-driven apps).

**Issues:**
- **"Secrets file not found"** → Create `~/.aifabrix/secrets.local.yaml` or run `aifabrix secret set …`
- **"Missing secrets: kv://…"** → Comment the line in `env.template`, run `aifabrix repair <systemKey>`, or `aifabrix secret set <path> "<value>"`
- **"Permission denied"** → Check file permissions on the secrets file
- **"env.template not found"** → Ensure `env.template` exists in the app directory (integration or builder)

---

<a id="aifabrix-json-app"></a>
## aifabrix json <app>

Generate deployment JSON.

**What:** Creates `<appKey>-deploy.json` (e.g. `builder/<appKey>/<appKey>-deploy.json`) from application config, env.template, and rbac for normal applications. Application config may be `application.yaml` or `application.json`; system/datasource config may be `.yaml` or `.json`. The deployment manifest is always **JSON only** (`<appKey>-deploy.json` or `<systemKey>-deploy.json`). For external type applications, generates `<systemKey>-deploy.json` by loading the component files (`<systemKey>-system.yaml`/`.json` and `<systemKey>-datasource-*.*`), combining them into a controller-compatible deployment manifest with inline system + datasources. This is the reverse operation of `aifabrix split-json` — it combines component files back into a deployment manifest. When you download an external system from the dataplane (via `aifabrix download`), you get `<systemKey>-deploy.json`, which can then be split into component files using `aifabrix split-json`. Merges RBAC config (rbac.yaml, rbac.yml, or rbac.json, if present) into the system JSON. **Note:** Only the first system from `externalIntegration.systems` is included in the generated `<systemKey>-deploy.json`. All data sources from `externalIntegration.dataSources` are included.

**When:** Previewing deployment configuration, debugging deployments. For external systems, before deploying to generate the combined application schema file. For external systems with RBAC, ensures roles/permissions from the RBAC file (rbac.yaml, rbac.yml, or rbac.json) are merged into the system JSON.

**Example (normal app):**
```bash
aifabrix json myapp
```

**Example (external system):**
```bash
aifabrix json hubspot
# Resolves integration/hubspot-test first, then builder/hubspot-test; generates <systemKey>-deploy.json in the resolved directory
```

**Creates:**
- Normal apps: `builder/<appKey>/<appKey>-deploy.json` (e.g. `builder/myapp/myapp-deploy.json`)
- External systems: `integration/<systemKey>/<systemKey>-deploy.json` (deployment manifest, JSON only; combines `<systemKey>-system.*` + `<systemKey>-datasource-*.*` files with rbac merged if present)

**RBAC Support for External Systems:**
- External systems can define roles and permissions in **rbac.yaml**, **rbac.yml**, or **rbac.json** (same structure; format inferred from extension)
- When generating JSON, roles/permissions from the RBAC file are merged into the system JSON
- Priority: roles/permissions in system JSON > RBAC file (if both exist, prefer JSON)
- Supports both `builder/` and `integration/` directories

**Issues:**
- **"Validation failed"** → Check configuration files for errors
- **"Missing required fields"** → Complete application config ([application.yaml or application.json](../configuration/application-yaml.md))
- **"External system file not found"** → Ensure system/datasource config files (YAML or JSON) exist in the app directory

---

<a id="aifabrix-split-json-app"></a>
## aifabrix split-json <app>

Split deployment JSON into component files.

**What:** Performs the reverse operation of `aifabrix json`. Reads a deployment JSON file (`<app-name>-deploy.json` or `<systemKey>-deploy.json`; deployment manifest is always JSON) and splits it into component files. For regular apps, extracts `env.template`, `application.yaml` (or `application.json`), RBAC file (`rbac.yaml`, `rbac.yml`, or `rbac.json`), and `README.md`. For external systems, splits into `<systemKey>-system.*` (system config) and `<systemKey>-datasource-*.*` (one per datasource), plus application config, `env.template`, and `README.md`. Component config files may be written as YAML or JSON. This enables migration of existing deployment JSON back to the component file structure. For external systems, extracts roles/permissions from the system JSON into an RBAC file (e.g. rbac.yml) if present.

**When:** Migrating existing deployment JSON files to component-based structure, recovering component files from deployment JSON, or reverse-engineering deployment configurations.

**Usage:**
```bash
# Split deployment JSON into component files (defaults to app directory)
aifabrix split-json myapp

# Split to custom output directory
aifabrix split-json myapp --output /path/to/output

# Split external system deployment JSON
aifabrix split-json hubspot
```

**Options:**
- `-o, --output <dir>` - Output directory for component files (defaults to same directory as JSON file)

**App path resolution:** The command resolves the app by checking **`integration/<systemKey>`** first, then **`builder/<appKey>`**. If neither exists, it errors. There is no option to override this order.

**Process:**
1. Locates `<app-name>-deploy.json` (regular apps) or `<systemKey>-deploy.json` (external systems) in the application directory
2. Parses the deployment JSON structure
3. Extracts `configuration` array → `env.template` (converts keyvault references back to `kv://` format)
4. Extracts deployment metadata → `application.yaml` (parses image reference, extracts app config, requirements, etc.)
5. Extracts `roles` and `permissions` → `rbac.yml` (only if present)
6. Generates `README.md` from deployment information

**Output:**
```text
✓ Successfully split deployment JSON into component files:
  • env.template: builder/myapp/env.template
  • application.yaml: builder/myapp/application.yaml
  • rbac.yml: builder/myapp/rbac.yml
  • README.md: builder/myapp/README.md
```

**Generated Files:**
- `env.template` - Environment variables template (from `configuration` array)
- `application.yaml` or `application.json` - Application configuration (from deployment JSON metadata); format matches generator default or existing app convention
- `rbac.yml` - Roles and permissions (from `roles` and `permissions` arrays, only if present)
- `README.md` - Application documentation (generated from deployment JSON)

**Notes:**
- The `deploymentKey` field is not set in `application.yaml`; it is managed by Controller internally
- Image references are parsed into `image.registry`, `image.name`, and `image.tag` components
- Keyvault references (`location: "keyvault"`) are converted back to `kv://` format in `env.template`
- Some information may be lost in reverse conversion (e.g., comments in original `env.template`)
- The generated `application.yaml` may not match the original exactly, but should be functionally equivalent

**Issues:**
- **"Deployment JSON file not found"** → Ensure `<app-name>-deploy.json` (regular apps) or `<systemKey>-deploy.json` (external systems) exists in the application directory
- **"Invalid JSON syntax"** → Check that the deployment JSON file is valid JSON
- **"Output directory creation failed"** → Check permissions for the output directory

---

<a id="aifabrix-convert-app"></a>
## aifabrix convert <app>

Convert integration/external system and datasource config files between JSON and YAML.

**What:** Converts `*-system.*`, `*-datasource-*.*`, and application config between JSON and YAML; updates `externalIntegration.systems` and `externalIntegration.dataSources` in application config to the new filenames; removes old files only after writing new ones. Process: validate first, then (unless `--force`) prompt for confirmation, then convert, then delete old files. Does not convert `*-deploy.json` (deployment manifest remains JSON only).

**When:** Standardising on YAML or JSON, or after downloading an external system in one format and wanting the other.

**Usage:**
```bash
# Convert to YAML (prompt for confirmation unless --force)
aifabrix convert hubspot --format yaml

# Convert to JSON and skip confirmation
aifabrix convert hubspot --format json --force

aifabrix convert hubspot --format json --force
```

**Options:**
- `--format <format>` - Target format: `json` or `yaml` (required unless config format is set). When not passed, uses the format from `~/.aifabrix/config.yaml` (set via `aifabrix dev set-format`). If neither is set, the command fails with instructions.
- `-f, --force` - Skip "Are you sure?" confirmation prompt

**App path resolution:** The command resolves the app by checking **`integration/<systemKey>`** first, then **`builder/<appKey>`**. If neither exists, it errors. There is no option to override this order.

**Process:**
1. Validate the app; abort if validation fails.
2. If not `--force`, show which files will be converted and prompt "Are you sure? (y/N)"; abort if no.
3. Write new files in the target format.
4. Update application config so `externalIntegration.systems` and `externalIntegration.dataSources` list the new filenames; write application config in the target format.
5. Delete old files only after all writes succeed.

**Issues:**
- **"Option --format is required and must be 'json' or 'yaml'"** → Pass `--format json` or `--format yaml`, or set default with `aifabrix dev set-format json` (or `yaml`)
- **"Validation failed"** → Fix validation errors (run `aifabrix validate <app>`) before converting
- **"Convert cancelled"** → You answered no to the confirmation prompt; run again with `--force` to skip the prompt
- **"App not found"** → Ensure the app exists in `integration/<systemKey>` or `builder/<appKey>`

---

<a id="aifabrix-repair-app"></a>
## aifabrix repair <systemKey>

Repair external integration config when `application.yaml` drifts from files on disk.

**What:** Aligns `externalIntegration.systems` and `externalIntegration.dataSources` with discovered files, syncs the system file `dataSources` array to datasource keys from discovered files (add/delete/rename), removes authentication-only variables from the system `configuration` array (keeps keyvault auth entries), fixes `app.key` to match `system.key`, aligns datasource `systemKey` values to match the system key, creates a minimal `externalIntegration` block when missing, extracts `rbac.yaml` from system roles/permissions when absent, repairs env.template so KV_ variable names and path-style `kv://` values match the system file (adds missing auth vars, corrects names/values), and regenerates `<systemKey>-deploy.json`. Repair also runs on **datasource files** (v2.4 model): it treats `fieldMappings.attributes` as the source of truth and, for entity types other than `none`, normalizes **root `dimensions`** (local bindings: drops invalid `via`, fixes FK/local shape; removes local dimensions whose `field` is not an attribute key), prunes or extends **`metadataSchema`** (adds a minimal schema if missing; removes `properties` entries not referenced by `metadata.*` in attribute expressions; adds minimal string stubs for referenced paths). It does **not** migrate legacy `fieldMappings.dimensions`; use `aifabrix convert` or edit files to v2.4 first. For **`entityType: none`**, datasource repair skips `metadataSchema`, root-dimension, and default **sync** changes so orchestration configs stay valid.

**When:** After converting files (JSON ↔ YAML), after adding/removing datasource files, when validation reports "External datasource file not found", or when `application.yaml` gets out of sync with files on disk.

**Repairable issues:**
- **File list drift** — Config lists `.json` but files are `.yaml` (or vice versa)
- **Deleted datasource** — Config lists a file that no longer exists
- **Added datasource** — File exists on disk but not in config
- **System file dataSources drift** — System file `dataSources` array updated to match datasource keys from discovered files (add/delete/rename). Each entry is a **logical key** (from that datasource file's `key` property, or derived from the filename when missing, e.g. `datasource-companies.json` → `test-hubspot-companies`), not the datasource filename.
- **Authentication variables in configuration** — Standard auth variables (BASEURL, CLIENTID, CLIENTSECRET, TOKENURL, etc.) removed from `configuration`; they are supplied from the credential at runtime. Use the configuration array only for custom variables.
- **Missing externalIntegration** — No block; repair creates it from discovered files
- **Datasource systemKey mismatch** — Datasource file has `systemKey: X` but system file has `key: Y`; repair updates `systemKey` in each datasource file to match system key
- **system.key mismatch** — System file has `key: X` but `app.key` is `Y`; repair updates `app.key`
- **Root dimensions vs attributes** — For **local** dimension bindings, `field` must match a key in `fieldMappings.attributes`; repair removes orphan local dimensions. **FK** bindings are not removed by that rule.
- **metadataSchema drift** — For non-`none` entity types, repair adds a minimal metadataSchema when missing, prunes unreferenced `properties`, and adds minimal stubs for `metadata.*` paths used in expressions. **`recordStorage`** and **`documentStorage`** must also satisfy the schema rule **`metadataSchema.properties.externalId`** (`type: string`, `index: true`); add **`fieldMappings.attributes.externalId`** and keep that property when editing so validation and repair stay aligned.
- **rbac.yaml missing** — System has roles/permissions but no `rbac.yaml`; repair creates it
- **env.template key drift** — env.template has wrong or missing KV_* keys or non–path-style kv values; repair aligns names and values with the system's authentication.security and configuration
- **Stale deploy manifest** — Regenerates `<systemKey>-deploy.json` after config changes
- **Datasource key and filename normalization** — Repair normalizes datasource keys to `<systemKey>-<resourceType>` (or `<systemKey>-<resourceType>-2`, `-3` for duplicates) and filenames to `<systemKey>-datasource-<suffix>.<ext>`. Keys or filenames that already match the valid pattern (e.g. `customer-extra`, `customer-1`) are left unchanged.
- **Optional flags** — `--all` runs all repair actions (`--doc --rbac --expose --sync --api --test`) in one go; `--rbac` adds or merges RBAC permissions per datasource and default Admin/Reader roles if none exist, and moves any roles/permissions from the `*-system` file into the rbac file when both are present; `--expose` sets **`exposed.schema`** on each datasource (each key maps to `metadata.<key>` for every `fieldMappings.attributes` key) and removes deprecated `exposed.attributes` if present; `--sync` adds a default sync section (`mode`, `batchSize`) to datasources that lack it (not applied when `entityType` is `none`); `--api` validates and syncs local API contract inputs (like OpenAPI specs at `integration/<systemKey>/openapi/*.json`) so OpenAPI/MCP features can be generated correctly on publish; `--test` rebuilds `testPayload.payloadTemplate` and `testPayload.expectedResult` from attributes and strips unknown top-level `testPayload` keys
- **Authentication method** — When `--auth <method>` is provided, repair sets the integration’s authentication to that method (canonical variables and security) and updates env.template accordingly. For any repair run, if `authentication.method` is **`apikey`** or **`bearerToken`** and **`testEndpoint`** is empty, repair prints a **warning** (credential/E2E may fail). After repair, the CLI lists **changed file paths** and suggested next steps (`validate`, fix warnings).

**Usage:**
```bash
# Repair and write changes
aifabrix repair hubspot

# Set authentication method (updates system file and env.template)
aifabrix repair hubspot-demo --auth bearerToken

# Legacy header style (X-API-Key) instead of Authorization Bearer
aifabrix repair hubspot-demo --auth apikey

# Preview changes without writing (--dry-run)
aifabrix repair hubspot --dry-run

# Optional: ensure RBAC, exposed.schema, sync section, or test payload
aifabrix repair hubspot --rbac --expose --sync --test

# Run everything (doc + datasource fixes + API contract sync)
aifabrix repair hubspot --all

# Regenerate README.md from the current deployment manifest
aifabrix repair hubspot --doc
```

**Options:**
- `--all` — Run all repair actions (`--doc --rbac --expose --sync --api --test`)
- `--auth <method>` — Set authentication method (oauth2, aad, apikey, bearerToken, basic, queryParam, oidc, hmac, none); updates the system file and env.template
- `--doc` — Regenerate `README.md` from the deployment manifest
- `--dry-run` — Report what would be changed; do not write
- `--rbac` — Ensure RBAC has a permission per datasource endpoint (`<resourceType>:<capability>`) and add default Admin/Reader roles if none exist; if roles or permissions still live in the external system file while an `rbac.yaml` / `rbac.json` file exists, repair merges them into that rbac file and removes them from the system file
- `--expose` — Set `exposed.schema` on each datasource from all `fieldMappings.attributes` keys (`metadata.<key>` values); removes deprecated `exposed.attributes` if present
- `--sync` — Add a default sync section (`mode: pull`, `batchSize: 500`) to datasources that lack it (skipped for `entityType: none`)
- `--api` — Validate and sync local API contract inputs (like OpenAPI specs at `integration/<systemKey>/openapi/*.json`) so OpenAPI/MCP features can be generated correctly on publish
- `--test` — Generate `testPayload.payloadTemplate` and `testPayload.expectedResult` from attributes for each datasource

**Issues:**
- **"App not found"** → Ensure the app exists in `integration/<systemKey>` or `builder/<appKey>`
- **"No system file found"** → Add a `*-system.yaml` or `*-system.json` file first

---

<a id="aifabrix-secure"></a>
## aifabrix secure

Encrypt secrets in secrets.local.yaml files for ISO 27001 compliance.

**What:** Encrypts all plaintext secret values in secrets files using AES-256-GCM encryption. Automatically finds and encrypts user secrets (`~/.aifabrix/secrets.local.yaml`) and general secrets files (configured via `aifabrix-secrets` in `config.yaml`). Encrypted values use `secure://` prefix format and are automatically decrypted when secrets are loaded.

**When:** First-time setup for ISO 27001 compliance, securing secrets before committing to version control, or when rotating encryption keys.

**Usage:**
```bash
# Encrypt secrets (interactive - prompts for encryption key)
aifabrix secure

# Encrypt secrets with provided encryption key
aifabrix secure --secrets-encryption "a1b2c3d4e5f6789abcdef1234567890abcdef1234567890abcdef1234567890ab"

# Encrypt secrets with base64 key
aifabrix secure --secrets-encryption "YWJjZGVmZ2hpams="
```

**Options:**
- `--secrets-encryption <key>` - Encryption key (32 bytes, hex or base64 format). If not provided, prompts interactively. Key is saved to `~/.aifabrix/config.yaml` for automatic decryption.

**Encryption Key Format:**
- **Hex format**: 64 hexadecimal characters (e.g., `a1b2c3d4...`)
- **Base64 format**: 44 base64 characters (e.g., `YWJjZGVmZ2hpams=...`)
- Both formats represent 32 bytes (256 bits) required for AES-256

**What Gets Encrypted:**
- User secrets file: `~/.aifabrix/secrets.local.yaml`
- General secrets: File specified in `aifabrix-secrets` in `config.yaml` (if configured)

**Output:**
```yaml
🔐 Securing secrets files...

Found 2 secrets file(s) to process:

Processing: C:\Users\user\.aifabrix\secrets.local.yaml (user)
  ✓ Encrypted 5 of 5 values

Processing: C:\git\myapp\builder\myapp\secrets.local.yaml (app:myapp)
  ✓ Encrypted 3 of 3 values

✅ Encryption complete!
   Files processed: 2
   Values encrypted: 8 of 8 total
   Encryption key stored in: ~/.aifabrix/config.yaml
```

**How It Works:**
1. Finds all secrets files (user secrets and app build secrets)
2. Prompts for encryption key if not provided (or uses existing key from config)
3. Encrypts all plaintext string values in each file
4. Skips values already encrypted (detected by `secure://` prefix)
5. Skips URLs (values starting with `http://` or `https://`) - URLs are not secrets
6. Skips YAML primitives (numbers, booleans, null) - only encrypts string values
7. Preserves YAML structure, comments (inline and block), blank lines, and indentation
8. Sets file permissions to 0o600 (read/write for owner only)
9. Saves encryption key to `~/.aifabrix/config.yaml` for automatic decryption

**Encrypted Value Format:**
Encrypted values use the format: `secure://<iv>:<ciphertext>:<authTag>`
- All components are base64 encoded
- IV (Initialization Vector): 96 bits
- Ciphertext: Encrypted secret value
- Auth Tag: 128-bit authentication tag for integrity verification

**Example:**
```yaml
# Before encryption (secrets.local.yaml)
# API Configuration
my-api-keyKeyVault: "sk-1234567890abcdef"
database-passwordKeyVault: "admin123"

# Service URLs (not encrypted - URLs are not secrets)
api-url: "https://api.example.com"
service-endpoint: "http://localhost:3000"

# After encryption (comments and URLs preserved)
# API Configuration
my-api-keyKeyVault: "secure://xK9mP2qR5tW8vY1z:AbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcdef:ZxYwVuTsRqPoNmLkJiHgFeDcBa9876543210"
database-passwordKeyVault: "secure://yL0nQ3rS6uX9wZ2a:BcDeFgHiJkLmNoPqRsTuVwXyZa2345678901bcdefg:YwXvUtSrQpOnMlKjIhGfEdCbA8765432109"

# Service URLs (not encrypted - URLs are not secrets)
api-url: "https://api.example.com"
service-endpoint: "http://localhost:3000"
```

**What Gets Skipped:**
- **URLs**: Values starting with `http://` or `https://` (e.g., `https://api.example.com`)
- **YAML Primitives**: Numbers (e.g., `123`, `45.67`), booleans (e.g., `true`, `false`), null values
- **Already Encrypted**: Values with `secure://` prefix are left unchanged
- **Empty Values**: Empty strings and whitespace-only values

**Automatic Decryption:**
Encrypted secrets are automatically decrypted when loaded by `aifabrix resolve`, `aifabrix build`, `aifabrix deploy`, and other commands that use secrets. The encryption key is retrieved from `~/.aifabrix/config.yaml` automatically.

**Security Notes:**
- **ISO 27001 Compliance**: Encrypts secrets at rest for compliance requirements
- **AES-256-GCM**: Uses authenticated encryption (confidentiality and integrity)
- **Key Management**: Encryption key stored separately from encrypted data
- **File Permissions**: Secrets and admin files are written with mode `600` (owner read/write only). When the CLI reads `secrets.local.yaml`, `admin-secrets.env`, or `config.yaml`, it enforces these permissions: if a file has looser permissions (e.g. group or other read), the CLI restricts it to `600` automatically.
- **Backward Compatible**: Plaintext secrets still work if encryption key is not configured
- **Key Rotation**: Re-run `aifabrix secure` with a new key to re-encrypt all values

**Issues:**
- **"No secrets files found"** → Create `~/.aifabrix/secrets.local.yaml` or configure `aifabrix-secrets` in `config.yaml`
- **"Invalid encryption key format"** → Key must be 32 bytes (64 hex chars or 44 base64 chars)
- **"Decryption failed"** → Encryption key in config.yaml doesn't match the key used for encryption
- **"File permission error"** → Ensure you have read/write access to secrets files

---

## aifabrix secret

**Scope:** The commands in this section manage **developer-cycle** secret files and shared dev APIs (`aifabrix secret list|get|set|remove`, **`BASH_*`**, etc.). They do **not** define where **Azure production** runtime secrets live—in production, secrets are in **Azure Key Vault** and bound through deployment configuration; see [Secrets and config – Production vs developer cycle](../configuration/secrets-and-config.md#production-azure-key-vault-vs-developer-cycle).

Manage secrets: **local** (user file `~/.aifabrix/secrets.local.yaml`, optional **ancestor** `.aifabrix/secrets.local.yaml` files on the path from the app to the workspace root, and app-level files the merge loader picks up) and **shared** (the path or `http(s)://` URL in **`aifabrix-secrets`** in `config.yaml`). When `aifabrix-secrets` is an **http(s)://** URL, shared secrets are served by the remote API (typically **Builder Server**); shared values are **never stored on disk** on the developer machine and are fetched when secrets are merged. When it is a file path, that file is the shared store on disk (for example a team path on a shared drive).

**`BASH_<NAME>` keys (local file, shared file, or HTTPS shared store):** Any top-level secret whose key starts with **`BASH_`** is treated as “inject **`NAME`** into subprocess environment”. Example: **`BASH_NPM_TOKEN`** → the CLI supplies **`NPM_TOKEN=<value>`** to spawned tools (same idea as `export NPM_TOKEN=…` in bash). The suffix after `BASH_` must be a valid identifier (letters, digits, underscore; same rule as for `kv://BASH_*` resolution). Invalid suffixes are skipped.

The Builder does **not** rely on mutating your interactive shell on Windows or Linux: it passes these variables on the **`env`** object when it runs **`docker`**, **`az`**, install/shell helpers, and similar subprocesses, and adds matching lines to the temporary **`--env-file`** used for container **shell** and **install**. That way **cmd.exe**, **PowerShell**, and **Unix** shells all see the same behavior for those commands.

**Commands that apply the merged `BASH_*` map:** **`aifabrix build`**, **`aifabrix shell`**, **`aifabrix install`**, **`aifabrix push`**, and **`aifabrix deploy <app> --local`** (the post-deploy **`run`** / dataplane **restart** uses the same Docker environment as **`aifabrix run`**). The default **`aifabrix deploy`** (without **`--local`**) is controller HTTP only. **`aifabrix resolve`** and other flows that write a resolved `.env` also merge **`BASH_*`** into the output when a variable is not already set in the template. See [Secrets and config](../configuration/secrets-and-config.md#aifabrix-secrets-remote-vs-local).

<a id="aifabrix-secret-list"></a>
### aifabrix secret list

List secret **keys and values**. **Local:** list user's local secrets (project file from `aifabrix-secrets` or user secrets). **Shared:** `aifabrix secret list --shared` — when `aifabrix-secrets` is a file path, lists from that file; when it is an `http(s)://` URL, lists from the remote server (cert required). Output format is `key: value` per line.

**Usage:**
```bash
# List local secrets
aifabrix secret list

# List shared secrets (file path: from project file; URL: from API, cert required)
aifabrix secret list --shared
```

<a id="aifabrix-secret-get"></a>
### aifabrix secret get

Read one secret by key. **Default:** local user `secrets.local.yaml` only (same target as `secret set` without `--shared`). **`--shared`:** team store from `aifabrix-secrets` only (same as `secret set --shared`).

**Usage:**
```bash
# Local file check (fails if key is only in the shared team file)
aifabrix secret get hubspot-demo/token --exists

# Team/shared store check
aifabrix secret get hubspot-demo/token --shared --exists

# Print decrypted value from local file
aifabrix secret get myapp/clientSecret

# JSON from shared store
aifabrix secret get hubspot-demo/token --shared --json
```

**Options:**
- *(default)* — Local user secrets file only (`secrets.local.yaml` under resolved aifabrix home)
- `--shared` — Shared store only (`aifabrix-secrets` file path or https API)
- `--exists` — Exit **0** when the key is present and non-empty; print nothing (for scripts and CI)
- `--json` — Output `{ "key", "exists", "value" }`

**Key format:** Use the path **without** `kv://` (e.g. `hubspot-demo/apiKey`, not `kv://hubspot-demo/apiKey`).

**Exit codes:** **0** when the secret is found (and non-empty for `--exists`); **1** when missing, empty, or decrypt fails.

<a id="aifabrix-secret-set"></a>
### aifabrix secret set

Set a secret value in secrets file.

**What:** Dynamically sets a secret value in either the user secrets file (`~/.aifabrix/secrets.local.yaml`) or the general secrets file (from `config.yaml` `aifabrix-secrets`). On first use, the CLI ensures `config.yaml` exists and a `secrets-encryption` key is available (creating one if missing). When an encryption key is set, values are stored **encrypted** (`secure://` format) in the secrets file by default. Supports both full URLs and environment variable interpolation.

**When:** Setting up new secrets, updating existing secret values, or configuring environment-specific secrets.

You can add secrets manually in the project secrets file, but the recommended approach is to use the remote server (e.g. `aifabrix-secrets` URL in `config.yaml`).

**Usage:**
```bash
# Set secret in user secrets file (default)
aifabrix secret set keycloak-web-server-url "https://mydomain.com/keycloak"

# Set secret in general secrets file (shared across projects)
aifabrix secret set keycloak-web-server-url "https://mydomain.com/keycloak" --shared

# Shared file or HTTPS: BASH_ prefix → Builder passes NAME=value to docker/az and container env (see intro above)
aifabrix secret set BASH_NPM_TOKEN "your-token" --shared

# Set secret with environment variable interpolation
aifabrix secret set keycloak-web-server-url "https://\${KEYCLOAK_HOST}:\${KEYCLOAK_PORT}"

# Set secret with full URL path
aifabrix secret set keycloak-web-server-url "https://keycloak.example.com/auth/realms/master"
```

**Options:**
- `--shared` - Save to shared secrets: when `aifabrix-secrets` is a file path, write to that file; when it is an `http(s)://` URL, saves to the remote server (cert required; admin/secret-manager for shared when remote). A key named **`BASH_<NAME>`** in the merged store (user, shared file, or remote) is mapped to environment variable **`NAME`** for the commands listed in the introduction under [aifabrix secret](#aifabrix-secret)—not limited to HTTPS.

**Secret Value Formats:**
- **Full URLs**: Direct URL values (e.g., `https://mydomain.com/keycloak`)
- **Environment Variable Interpolation**: Values with `${VAR}` placeholders (e.g., `https://${KEYCLOAK_HOST}:${KEYCLOAK_PORT}`)
  - Variables are resolved from `env-config.yaml` and `config.yaml` when secrets are loaded

**Secrets File Locations:**
- **User secrets** (default): `~/.aifabrix/secrets.local.yaml`
- **General secrets** (with `--shared`): Path specified in `config.yaml` under `aifabrix-secrets`

**Examples:**
```bash
# Set database password in user secrets
aifabrix secret set postgres-passwordKeyVault "my-secure-password"

# Set API key with environment variable interpolation
aifabrix secret set api-keyKeyVault "\${API_KEY}"
```

**Output:**
```yaml
✓ Secret 'keycloak-web-server-url' saved to user secrets file: /home/user/.aifabrix/secrets.local.yaml
```

**Behavior:**
- Merges with existing secrets (doesn't overwrite other keys)
- Creates secrets file if it doesn't exist
- Creates directory structure if needed
- Sets proper file permissions (0o600 - owner read/write only)
- Preserves existing YAML structure and formatting

**Issues:**
- **"General secrets file not configured"** → Set `aifabrix-secrets` in `config.yaml` or use without `--shared` flag for user secrets
- **"Secret key is required"** → Provide a non-empty key name
- **"Secret value is required"** → Provide a non-empty value
- **"File permission error"** → Ensure you have read/write access to secrets files directory

<a id="aifabrix-secret-remove"></a>
### aifabrix secret remove

Remove a secret. **Local:** `aifabrix secret remove <key>` removes from user/project secrets file. **Shared:** `aifabrix secret remove <key> --shared` — when `aifabrix-secrets` is a file path, removes from that file; when it is an `http(s)://` URL, removes from the remote server (cert required).

**Usage:**
```bash
# Remove local secret
aifabrix secret remove my-keyKeyVault

# Remove shared secret (file path vs API when URL)
aifabrix secret remove my-keyKeyVault --shared
```

**Security note:** When `aifabrix-secrets` is a URL, shared secret values are never stored on disk; they are fetched at resolution time when generating `.env`.

<a id="aifabrix-secret-remove-all"></a>
### aifabrix secret remove-all

Remove **all** secret keys in one go. **Local:** clears `~/.aifabrix/secrets.local.yaml` to an empty map. **Shared:** with `--shared`, clears the shared secrets file or deletes each key via the remote API (same targets as `secret list --shared`).

**Confirmation:** Unless you pass `--yes` / `-y`, you must type `yes` when prompted; anything else cancels.

**Usage:**
```bash
aifabrix secret remove-all
aifabrix secret remove-all --yes
aifabrix secret remove-all --shared
aifabrix secret remove-all --shared --yes
```

<a id="aifabrix-secret-set-secrets-file"></a>
### aifabrix secret set-secrets-file

Set the path or URL for the secrets file in `config.yaml`.

**What:** Writes `aifabrix-secrets` to `~/.aifabrix/config.yaml`. The value can be a local file path or an `https://` URL (for remote shared secrets). Only `https://` URLs are allowed; `http://` is rejected.

**When:** Switching between local and remote secrets, or pointing the CLI at a different secrets file (e.g. team path or remote API).

**Usage:**
```bash
# Local file path
aifabrix secret set-secrets-file /path/to/secrets.local.yaml

# Remote secrets (https only)
aifabrix secret set-secrets-file https://builder.example.com/api/dev/secrets
```

**See also:** [Secrets and config](../configuration/secrets-and-config.md).

---

## See also

- [application.yaml (application config)](../configuration/application-yaml.md) — Application config format and options
- [External integration](../configuration/application-yaml.md#external-integration-and-external-system) — System and datasource config files

