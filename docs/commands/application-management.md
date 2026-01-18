# Application Management Commands

← [Back to Commands Index](README.md) | [Back to Quick Start](../quick-start.md)

Application management commands for registering and managing applications with the Miso Controller.

---

## aifabrix app

Application management commands for registering and managing applications with the Miso Controller.

<a id="aifabrix-app-register-appkey"></a>
### aifabrix app register <appKey>

Register application and get pipeline credentials.

**What:** Registers an application with the controller and retrieves ClientId and ClientSecret for CI/CD deployments.

**When:** First time setting up automated deployments, before adding GitHub Actions workflows.

**Usage:**
```bash
# Register application in development environment
aifabrix app register myapp --environment dev

# Register with overrides
aifabrix app register myapp --environment dev --port 8080 --name "My Application"

# Register with explicit controller URL
aifabrix app register myapp --environment dev --controller https://controller.aifabrix.ai
```

**Arguments:**
- `<appKey>` - Application key (identifier)

**Options:**
- `-e, --environment <env>` - Environment ID or key (required)
- `-c, --controller <url>` - Controller URL (optional, overrides variables.yaml)
- `-p, --port <port>` - Override application port
- `-n, --name <name>` - Override display name
- `-d, --description <desc>` - Override description

**Controller URL Resolution:**

The controller URL is determined in the following priority order:
1. `--controller` flag (if provided)
2. `variables.yaml` → `deployment.controllerUrl` (for app register)
3. Device tokens in `~/.aifabrix/config.yaml` → `device` section

**Examples:**
```bash
# Using --controller flag (highest priority)
aifabrix app register myapp --environment dev --controller https://controller.aifabrix.ai

# Using variables.yaml (if deployment.controllerUrl is set)
aifabrix app register myapp --environment dev

# Using device token from config.yaml (fallback)
aifabrix app register myapp --environment dev
```

**Error Messages:**

All error messages will show the controller URL that was used or attempted, helping with debugging:
```yaml
❌ Authentication Failed

Controller URL: https://controller.aifabrix.ai

Your authentication token is invalid or has expired.
...
```

**Process:**
1. Reads `builder/{appKey}/variables.yaml`
2. If missing, creates minimal configuration automatically
3. Validates required fields
4. Registers with Miso Controller
5. Returns ClientId and ClientSecret
6. Updates `env.template` with new credentials (for localhost scenarios)
7. Regenerates `.env` file with updated credentials (for localhost scenarios)
8. **Note:** Credentials are displayed but not automatically saved. Copy them to your secrets file or GitHub Secrets.

**Output:**
```yaml
✓ Application registered successfully!

📋 Application Details:
   ID:           app-123
   Key:          myapp
   Display Name: My App

🔑 CREDENTIALS (save these immediately):
   Client ID:     ctrl-dev-myapp
   Client Secret: x7K9mP2nQ4vL8wR5tY1uE3oA6sD9fG2hJ4kM7pN0qT5

⚠️  IMPORTANT: Client Secret will not be shown again!

✓ .env file updated with new credentials

📝 Add to GitHub Secrets:
   MISO_CLIENTID = ctrl-dev-myapp
   MISO_CLIENTSECRET = x7K9mP2nQ4vL8wR5tY1uE3oA6sD9fG2hJ4kM7pN0qT5
   MISO_CONTROLLER_URL = http://localhost:3000
```

**Issues:**
- **"Not logged in"** → Run `aifabrix login` first
- **"Missing required fields"** → Update variables.yaml with app.key, app.name
- **"Registration failed"** → Check environment ID and controller URL

---

### aifabrix app list

List applications in an environment.

**What:** Displays all registered applications for a specific environment.

**Usage:**
```bash
aifabrix app list --environment dev

# List with explicit controller URL
aifabrix app list --environment dev --controller https://controller.aifabrix.ai
```

**Options:**
- `-e, --environment <env>` - Environment ID or key (required)
- `-c, --controller <url>` - Controller URL (optional, uses configured controller if not provided)

**Controller URL Resolution:**

The controller URL is determined in the following priority order:
1. `--controller` flag (if provided)
2. Device tokens in `~/.aifabrix/config.yaml` → `device` section

**Error Messages:**

Error messages include the controller URL for debugging:
```yaml
❌ Failed to list applications from controller: https://controller.aifabrix.ai
Error: Network timeout
```

**Output:**
```yaml
📱 Applications:

✓ ctrl-dev-myapp    - My App (active)
✗ ctrl-dev-otherapp - Other App (inactive)
```

**Issues:**
- **"Not logged in"** → Run `aifabrix login` first
- **"Failed to fetch"** → Check environment ID and network connection

---

### aifabrix app rotate-secret

Rotate pipeline ClientSecret for an application.

**What:** Generates a new ClientSecret, invalidating the old one. Updates `env.template` and regenerates `.env` file with new credentials (for localhost scenarios). Use when credentials are compromised or need rotation.

**Usage:**
```bash
aifabrix app rotate-secret myapp --environment dev

# Rotate with explicit controller URL
aifabrix app rotate-secret myapp --environment dev --controller https://controller.aifabrix.ai
```

**Arguments:**
- `<appKey>` - Application key (required, positional)

**Options:**
- `-e, --environment <env>` - Environment ID or key (required)
- `-c, --controller <url>` - Controller URL (optional, uses configured controller if not provided)

**Controller URL Resolution:**

Same as `app list` - see above.

**Error Messages:**

Error messages include the controller URL for debugging:
```yaml
❌ Failed to rotate secret via controller: https://controller.aifabrix.ai
Error: Application not found
```

**Process:**
1. Validates application key and environment
2. Rotates ClientSecret via Miso Controller API
3. Updates `env.template` with new credentials (for localhost scenarios)
4. Regenerates `.env` file with updated credentials (for localhost scenarios)
5. Displays new credentials

**Output:**
```yaml
⚠️  This will invalidate the old ClientSecret!

✓ Secret rotated successfully!

📋 Application Details:
   Key:         myapp
   Environment: dev

🔑 NEW CREDENTIALS:
   Client ID:     ctrl-dev-myapp
   Client Secret: new-secret-789

✓ .env file updated with new credentials

⚠️  Old secret is now invalid. Update GitHub Secrets!
```

**Issues:**
- **"Not logged in"** → Run `aifabrix login` first
- **"Environment is required"** → Provide `--environment` flag (miso/dev/tst/pro)
- **"Rotation failed"** → Check application key and permissions

