# Utility Commands

← [Back to Commands Index](README.md) | [Back to Quick Start](../quick-start.md)

Utility commands for managing configuration files, secrets, and deployment artifacts.

---

<a id="aifabrix-resolve-app"></a>
## aifabrix resolve <app>

Generate `.env` file from template.

**What:** Resolves `kv://` references from secrets file, creates `.env`.

**When:** After secrets change, troubleshooting environment issues.

**Example:**
```bash
aifabrix resolve myapp
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

**Creates:** `builder/myapp/.env`

**Issues:**
- **"Secrets file not found"** → Create `~/.aifabrix/secrets.yaml`
- **"Missing kv:// reference"** → Add secret to secrets file or use `--force` to auto-generate
- **"Permission denied"** → Check file permissions on secrets.yaml

---

<a id="aifabrix-json-app"></a>
## aifabrix json <app>

Generate deployment JSON.

**What:** Creates `aifabrix-deploy.json` from variables.yaml, env.template, rbac.yaml for normal applications. For external type applications, generates `<systemKey>-deploy.json` deployment manifest by loading the component files (`<systemKey>-system.json` and `<systemKey>-datasource-*.json`), combining them into a controller-compatible deployment manifest with inline system + datasources. This is the reverse operation of `aifabrix split-json` - it combines component files back into a deployment manifest. When you download an external system from the dataplane (via `aifabrix download`), you get `<systemKey>-deploy.json` which can then be split into component files using `aifabrix split-json`. Merges rbac.yaml (if present) into the system JSON. **Note:** Only the first system from `externalIntegration.systems` array is included in the generated `<systemKey>-deploy.json`. All data sources from `externalIntegration.dataSources` array are included.

**When:** Previewing deployment configuration, debugging deployments. For external systems, before deploying to generate the combined application schema file. For external systems with RBAC, ensures roles/permissions from rbac.yaml are merged into the system JSON.

**Example (normal app):**
```bash
aifabrix json myapp
```

**Example (external system):**
```bash
aifabrix json hubspot --type external
# Generates intefration/hubspot/<systemKey>-deploy.json
```

**Creates:**
- Normal apps: `builder/<app>/aifabrix-deploy.json`
- External systems: `integration/<app>/<systemKey>-deploy.json` (deployment manifest combining `<systemKey>-system.json` + `<systemKey>-datasource-*.json` files with rbac.yaml merged if present)

**RBAC Support for External Systems:**
- External systems can define roles and permissions in `rbac.yaml` (same format as regular apps)
- When generating JSON, roles/permissions from rbac.yaml are merged into the system JSON
- Priority: roles/permissions in system JSON > rbac.yaml (if both exist, prefer JSON)
- Supports both `builder/` and `integration/` directories

**Issues:**
- **"Validation failed"** → Check configuration files for errors
- **"Missing required fields"** → Complete variables.yaml
- **"External system file not found"** → Ensure system/datasource JSON files exist in schemas/ directory

---

<a id="aifabrix-split-json-app"></a>
## aifabrix split-json <app>

Split deployment JSON into component files.

**What:** Performs the reverse operation of `aifabrix json`. Reads a deployment JSON file (`<app-name>-deploy.json` for regular apps, `<systemKey>-deploy.json` for external systems) and splits it into component files. For regular apps, extracts `env.template`, `variables.yaml`, `rbac.yml`, and `README.md`. For external systems, splits `<systemKey>-deploy.json` into `<systemKey>-system.json` (system configuration) and `<systemKey>-datasource-*.json` files (one per datasource), plus `variables.yaml`, `env.template`, and `README.md`. This enables migration of existing deployment JSON files back to the component file structure. For external systems, extracts roles/permissions from the system JSON into rbac.yml if present.

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

**Process:**
1. Locates `<app-name>-deploy.json` (regular apps) or `<systemKey>-deploy.json` (external systems) in the application directory
2. Parses the deployment JSON structure
3. Extracts `configuration` array → `env.template` (converts keyvault references back to `kv://` format)
4. Extracts deployment metadata → `variables.yaml` (parses image reference, extracts app config, requirements, etc.)
5. Extracts `roles` and `permissions` → `rbac.yml` (only if present)
6. Generates `README.md` from deployment information

**Output:**
```text
✓ Successfully split deployment JSON into component files:
  • env.template: builder/myapp/env.template
  • variables.yaml: builder/myapp/variables.yaml
  • rbac.yml: builder/myapp/rbac.yml
  • README.md: builder/myapp/README.md
```

**Generated Files:**
- `env.template` - Environment variables template (from `configuration` array)
- `variables.yaml` - Application configuration (from deployment JSON metadata)
- `rbac.yml` - Roles and permissions (from `roles` and `permissions` arrays, only if present)
- `README.md` - Application documentation (generated from deployment JSON)

**Notes:**
- The `deploymentKey` field is excluded from `variables.yaml` (it's generated, not configured)
- Image references are parsed into `image.registry`, `image.name`, and `image.tag` components
- Keyvault references (`location: "keyvault"`) are converted back to `kv://` format in `env.template`
- Some information may be lost in reverse conversion (e.g., comments in original `env.template`)
- The generated `variables.yaml` may not match the original exactly, but should be functionally equivalent

**Issues:**
- **"Deployment JSON file not found"** → Ensure `<app-name>-deploy.json` (regular apps) or `<systemKey>-deploy.json` (external systems) exists in the application directory
- **"Invalid JSON syntax"** → Check that the deployment JSON file is valid JSON
- **"Output directory creation failed"** → Check permissions for the output directory

---

<a id="aifabrix-genkey-app"></a>
## aifabrix genkey <app>

Generate deployment key.

**What:** Generates deployment JSON first, then extracts deployment key from it. The deployment key is a SHA256 hash of the deployment manifest (excluding the deploymentKey field) for controller authentication and integrity verification.

**When:** Checking deployment key, troubleshooting authentication.

**Example:**
```bash
aifabrix genkey myapp
```

**Output:**
```text
Deployment key for myapp:
a1b2c3d4e5f6789abcdef1234567890abcdef1234567890abcdef1234567890ab

Generated from: builder/myapp/aifabrix-deploy.json
```

**Issues:** None common.

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

## aifabrix secrets

Manage secrets in secrets files.

### aifabrix secrets set

Set a secret value in secrets file.

**What:** Dynamically sets a secret value in either the user secrets file (`~/.aifabrix/secrets.local.yaml`) or the general secrets file (from `config.yaml` `aifabrix-secrets`). Supports both full URLs and environment variable interpolation.

**When:** Setting up new secrets, updating existing secret values, or configuring environment-specific secrets.

**Usage:**
```bash
# Set secret in user secrets file (default)
aifabrix secrets set keycloak-public-server-urlKeyVault "https://mydomain.com/keycloak"

# Set secret in general secrets file (shared across projects)
aifabrix secrets set keycloak-public-server-urlKeyVault "https://mydomain.com/keycloak" --shared

# Set secret with environment variable interpolation
aifabrix secrets set keycloak-public-server-urlKeyVault "https://\${KEYCLOAK_HOST}:\${KEYCLOAK_PORT}"

# Set secret with full URL path
aifabrix secrets set keycloak-public-server-urlKeyVault "https://keycloak.example.com/auth/realms/master"
```

**Options:**
- `--shared` - Save to general secrets file (from `config.yaml` `aifabrix-secrets`) instead of user secrets file

**Secret Value Formats:**
- **Full URLs**: Direct URL values (e.g., `https://mydomain.com/keycloak`)
- **Environment Variable Interpolation**: Values with `${VAR}` placeholders (e.g., `https://${KEYCLOAK_HOST}:${KEYCLOAK_PORT}`)
  - Variables are resolved from `env-config.yaml` and `config.yaml` when secrets are loaded

**Secrets File Locations:**
- **User secrets** (default): `~/.aifabrix/secrets.local.yaml`
- **General secrets** (with `--shared`): Path specified in `config.yaml` under `aifabrix-secrets`

**Examples:**
```bash
# Set Keycloak public server URL in user secrets
aifabrix secrets set keycloak-public-server-urlKeyVault "https://keycloak.example.com"

# Set Keycloak public server URL in shared secrets file
aifabrix secrets set keycloak-public-server-urlKeyVault "https://keycloak.example.com" --shared

# Set database password in user secrets
aifabrix secrets set postgres-passwordKeyVault "my-secure-password"

# Set API key with environment variable interpolation
aifabrix secrets set api-keyKeyVault "\${API_KEY}"
```

**Output:**
```yaml
✓ Secret 'keycloak-public-server-urlKeyVault' saved to user secrets file: /home/user/.aifabrix/secrets.local.yaml
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

