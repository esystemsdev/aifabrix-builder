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

**App path:** Resolve works for **builder** apps and for **external integrations** in `integration/<app>/`. If `integration/<app>/env.template` exists (even without `application.yaml`), that directory is used and resolve runs in **env-only** mode; otherwise the CLI resolves the app via integration then builder using full config (application.yaml or application.json).

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

**Flags:**
- `-f, --force` - Generate missing secret keys in secrets file
- `--skip-validation` - Skip file validation after generating .env

**Output:** When the app is in **integration** with **env-only** (only `env.template` present, no `application.yaml`), `.env` is written to `integration/<app>/.env`. When the app has full config (builder or integration with `application.yaml`) and `build.envOutputPath` is set, `.env` is written to that path; otherwise behaviour is as documented for run/build (e.g. temp or run-only).

**Env-only mode:** When resolving in **env-only** mode (integration + `env.template` only), post-resolve validation is skipped because there is no `application.yaml` to validate. Run `aifabrix validate <app>` separately when you add full config later.

**Issues:**
- **"Secrets file not found"** → Create `~/.aifabrix/secrets.yaml`
- **"Missing kv:// reference"** → Add secret to secrets file or use `--force` to auto-generate
- **"Permission denied"** → Check file permissions on secrets.yaml
- **"env.template not found"** → Ensure `env.template` exists in the app directory (integration or builder)

---

<a id="aifabrix-json-app"></a>
## aifabrix json <app>

Generate deployment JSON.

**What:** Creates `<appKey>-deploy.json` (e.g. `builder/<app>/<appKey>-deploy.json`) from application config, env.template, and rbac for normal applications. Application config may be `application.yaml` or `application.json`; system/datasource config may be `.yaml` or `.json`. The deployment manifest is always **JSON only** (`<appKey>-deploy.json` or `<systemKey>-deploy.json`). For external type applications, generates `<systemKey>-deploy.json` by loading the component files (`<systemKey>-system.yaml`/`.json` and `<systemKey>-datasource-*.*`), combining them into a controller-compatible deployment manifest with inline system + datasources. This is the reverse operation of `aifabrix split-json` — it combines component files back into a deployment manifest. When you download an external system from the dataplane (via `aifabrix download`), you get `<systemKey>-deploy.json`, which can then be split into component files using `aifabrix split-json`. Merges rbac.yaml (if present) into the system JSON. **Note:** Only the first system from `externalIntegration.systems` is included in the generated `<systemKey>-deploy.json`. All data sources from `externalIntegration.dataSources` are included.

**When:** Previewing deployment configuration, debugging deployments. For external systems, before deploying to generate the combined application schema file. For external systems with RBAC, ensures roles/permissions from rbac.yaml are merged into the system JSON.

**Example (normal app):**
```bash
aifabrix json myapp
```

**Example (external system):**
```bash
aifabrix json hubspot
# Resolves integration/hubspot first, then builder/hubspot; generates <systemKey>-deploy.json in the resolved directory
```

**Creates:**
- Normal apps: `builder/<app>/<appKey>-deploy.json` (e.g. `builder/myapp/myapp-deploy.json`)
- External systems: `integration/<app>/<systemKey>-deploy.json` (deployment manifest, JSON only; combines `<systemKey>-system.*` + `<systemKey>-datasource-*.*` files with rbac merged if present)

**RBAC Support for External Systems:**
- External systems can define roles and permissions in `rbac.yaml` (same format as regular apps)
- When generating JSON, roles/permissions from rbac.yaml are merged into the system JSON
- Priority: roles/permissions in system JSON > rbac.yaml (if both exist, prefer JSON)
- Supports both `builder/` and `integration/` directories

**Issues:**
- **"Validation failed"** → Check configuration files for errors
- **"Missing required fields"** → Complete application config ([application.yaml or application.json](../configuration/application-yaml.md))
- **"External system file not found"** → Ensure system/datasource config files (YAML or JSON) exist in the app directory

---

<a id="aifabrix-split-json-app"></a>
## aifabrix split-json <app>

Split deployment JSON into component files.

**What:** Performs the reverse operation of `aifabrix json`. Reads a deployment JSON file (`<app-name>-deploy.json` or `<systemKey>-deploy.json`; deployment manifest is always JSON) and splits it into component files. For regular apps, extracts `env.template`, `application.yaml` (or `application.json`), `rbac.yml`, and `README.md`. For external systems, splits into `<systemKey>-system.*` (system config) and `<systemKey>-datasource-*.*` (one per datasource), plus application config, `env.template`, and `README.md`. Component config files may be written as YAML or JSON. This enables migration of existing deployment JSON back to the component file structure. For external systems, extracts roles/permissions from the system JSON into rbac.yml if present.

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

**App path resolution:** The command resolves the app by checking **`integration/<app>`** first, then **`builder/<app>`**. If neither exists, it errors. There is no option to override this order.

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

**App path resolution:** The command resolves the app by checking **`integration/<app>`** first, then **`builder/<app>`**. If neither exists, it errors. There is no option to override this order.

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
- **"App not found"** → Ensure the app exists in `integration/<app>` or `builder/<app>`

---

<a id="aifabrix-repair-app"></a>
## aifabrix repair <app>

Repair external integration config when `application.yaml` drifts from files on disk.

**What:** Aligns `externalIntegration.systems` and `externalIntegration.dataSources` with discovered files, syncs the system file `dataSources` array to datasource keys from discovered files (add/delete/rename), removes authentication-only variables from the system `configuration` array (keeps keyvault auth entries), fixes `app.key` to match `system.key`, aligns datasource `systemKey` values to match the system key, creates a minimal `externalIntegration` block when missing, extracts `rbac.yaml` from system roles/permissions when absent, repairs env.template so KV_ variable names and path-style `kv://` values match the system file (adds missing auth vars, corrects names/values), and regenerates `<systemKey>-deploy.json`. Repair also runs on **datasource files**: it treats `fieldMappings.attributes` as the source of truth and aligns `fieldMappings.dimensions` (removes dimension entries whose `metadata.<attr>` is not in attributes) and `metadataSchema` (adds a minimal schema if missing; removes schema branches not referenced by any attribute expression).

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
- **Dimensions not in attributes** — Dimension values like `metadata.<attr>` must reference an existing attribute key in `fieldMappings.attributes`; repair removes invalid dimension entries
- **metadataSchema drift** — Repair adds a minimal metadataSchema when missing and removes schema fields not used by attribute expressions
- **rbac.yaml missing** — System has roles/permissions but no `rbac.yaml`; repair creates it
- **env.template key drift** — env.template has wrong or missing KV_* keys or non–path-style kv values; repair aligns names and values with the system's authentication.security and configuration
- **Stale deploy manifest** — Regenerates `<systemKey>-deploy.json` after config changes
- **Optional flags** — `--rbac` adds or merges RBAC permissions per datasource and default Admin/Reader roles if none exist; `--expose` sets `exposed.attributes` on each datasource to all attribute keys; `--sync` adds a default sync section to datasources that lack it; `--test` generates `testPayload.payloadTemplate` and `testPayload.expectedResult` from attributes

**Usage:**
```bash
# Repair and write changes
aifabrix repair hubspot

# Preview changes without writing (--dry-run)
aifabrix repair hubspot --dry-run

# Optional: ensure RBAC, exposed attributes, sync section, or test payload
aifabrix repair hubspot --rbac --expose --sync --test
```

**Options:**
- `--dry-run` — Report what would be changed; do not write
- `--rbac` — Ensure RBAC has a permission per datasource endpoint (`<resourceType>:<capability>`) and add default Admin/Reader roles if none exist
- `--expose` — Set `exposed.attributes` on each datasource to the list of all `fieldMappings.attributes` keys
- `--sync` — Add a default sync section (mode, batchSize, maxParallelRequests) to datasources that lack it
- `--test` — Generate `testPayload.payloadTemplate` and `testPayload.expectedResult` from attributes for each datasource

**Issues:**
- **"App not found"** → Ensure the app exists in `integration/<app>` or `builder/<app>`
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
- **File Permissions**: Encrypted files set to 0o600 (owner read/write only)
- **Backward Compatible**: Plaintext secrets still work if encryption key is not configured
- **Key Rotation**: Re-run `aifabrix secure` with a new key to re-encrypt all values

**Issues:**
- **"No secrets files found"** → Create `~/.aifabrix/secrets.local.yaml` or configure `aifabrix-secrets` in `config.yaml`
- **"Invalid encryption key format"** → Key must be 32 bytes (64 hex chars or 44 base64 chars)
- **"Decryption failed"** → Encryption key in config.yaml doesn't match the key used for encryption
- **"File permission error"** → Ensure you have read/write access to secrets files

---

## aifabrix secret

Manage secrets: local (project/user secrets file) and shared (file or remote API). When `aifabrix-secrets` in config is an **http(s)://** URL, shared secrets are served by the remote API; shared values are **never stored on disk** and are fetched at resolution time. When it is a file path, use the project secret file as today.

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

<a id="aifabrix-secret-set"></a>
### aifabrix secret set

Set a secret value in secrets file.

**What:** Dynamically sets a secret value in either the user secrets file (`~/.aifabrix/secrets.local.yaml`) or the general secrets file (from `config.yaml` `aifabrix-secrets`). Supports both full URLs and environment variable interpolation.

**When:** Setting up new secrets, updating existing secret values, or configuring environment-specific secrets.

You can add secrets manually in the project secrets file, but the recommended approach is to use the remote server (e.g. `aifabrix-secrets` URL in `config.yaml`).

**Usage:**
```bash
# Set secret in user secrets file (default)
aifabrix secret set keycloak-server-url "https://mydomain.com/keycloak"

# Set secret in general secrets file (shared across projects)
aifabrix secret set keycloak-server-url "https://mydomain.com/keycloak" --shared

# Set secret with environment variable interpolation
aifabrix secret set keycloak-server-url "https://\${KEYCLOAK_HOST}:\${KEYCLOAK_PORT}"

# Set secret with full URL path
aifabrix secret set keycloak-server-url "https://keycloak.example.com/auth/realms/master"
```

**Options:**
- `--shared` - Save to shared secrets: when `aifabrix-secrets` is a file path, write to that file; when it is an `http(s)://` URL, saves to the remote server (cert required; admin/secret-manager for shared when remote)

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
✓ Secret 'keycloak-server-url' saved to user secrets file: /home/user/.aifabrix/secrets.local.yaml
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

---

## See also

- [application.yaml (application config)](../configuration/application-yaml.md) — Application config format and options
- [External integration](../configuration/application-yaml.md#external-integration-and-external-system) — System and datasource config files

