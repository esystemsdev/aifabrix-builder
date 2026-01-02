# CLI Reference

← [Back to Quick Start](QUICK-START.md)

Complete command reference with examples and troubleshooting.

---

## Table of Contents

### Authentication & Setup
- [aifabrix login](#aifabrix-login) - Authenticate with Miso Controller
- [aifabrix logout](#aifabrix-logout) - Clear authentication tokens
- [aifabrix up](#aifabrix-up) - Start infrastructure (Postgres + Redis)
- [aifabrix down](#aifabrix-down) - Stop infrastructure or an app
- [aifabrix status](#aifabrix-status) - Show infrastructure service status
- [aifabrix restart](#aifabrix-restart-service) - Restart infrastructure service
- [aifabrix doctor](#aifabrix-doctor) - Check environment and configuration

### Developer Isolation
- [aifabrix dev config](#aifabrix-dev-config) - View or set developer ID for port isolation

### Application Management
- [aifabrix app](#aifabrix-app) - Application management commands
  - [aifabrix app register](#aifabrix-app-register-appkey) - Register application and get pipeline credentials
  - [aifabrix app list](#aifabrix-app-list) - List applications in an environment
  - [aifabrix app rotate-secret](#aifabrix-app-rotate-secret) - Rotate pipeline ClientSecret

### Application Development
- [aifabrix create](#aifabrix-create-app) - Create new application with configuration files
- [aifabrix build](#aifabrix-build-app) - Build Docker image
- [aifabrix run](#aifabrix-run-app) - Run application locally in Docker container
- [aifabrix dockerfile](#aifabrix-dockerfile-app) - Generate Dockerfile for an application

### Deployment
- [aifabrix push](#aifabrix-push-app) - Push image to Azure Container Registry
- [aifabrix environment deploy](#aifabrix-environment-deploy-env) - Deploy/setup environment in Miso Controller
- [aifabrix deploy](#aifabrix-deploy-app) - Deploy to Azure via Miso Controller
- [aifabrix deployments](#aifabrix-deployments) - List deployments for an environment

### Validation & Comparison
- [aifabrix validate](#aifabrix-validate-apporfile) - Validate application or external integration file
- [aifabrix diff](#aifabrix-diff-file1-file2) - Compare two configuration files

### External Integration
- [aifabrix download](#aifabrix-download-system-key) - Download external system from dataplane
- [aifabrix test](#aifabrix-test-app) - Run unit tests for external system (local validation)
- [aifabrix test-integration](#aifabrix-test-integration-app) - Run integration tests via dataplane pipeline API
- [aifabrix datasource](#aifabrix-datasource) - Manage external data sources
  - [aifabrix datasource validate](#aifabrix-datasource-validate-file) - Validate external datasource JSON file
  - [aifabrix datasource list](#aifabrix-datasource-list) - List datasources from environment
  - [aifabrix datasource diff](#aifabrix-datasource-diff-file1-file2) - Compare two datasource configuration files
  - [aifabrix datasource deploy](#aifabrix-datasource-deploy-myapp-file) - Deploy datasource to dataplane

### Utilities
- [aifabrix resolve](#aifabrix-resolve-app) - Generate `.env` file from template
- [aifabrix json](#aifabrix-json-app) - Generate deployment JSON
- [aifabrix split-json](#aifabrix-split-json-app) - Split deployment JSON into component files
- [aifabrix genkey](#aifabrix-genkey-app) - Generate deployment key
- [aifabrix secure](#aifabrix-secure) - Encrypt secrets in secrets.local.yaml files
- [aifabrix secrets](#aifabrix-secrets) - Manage secrets in secrets files
  - [aifabrix secrets set](#aifabrix-secrets-set) - Set a secret value in secrets file

### Additional Resources
 - [Common Workflows](#common-workflows) - Typical usage patterns
 - [Global Options](#global-options) - Command-line options available to all commands
 - [Exit Codes](#exit-codes) - Command exit code reference
 - [Getting Help](#getting-help) - Where to find more information

---

## aifabrix login

Authenticate with Miso Controller.

**What:** Logs in to the controller and stores authentication token for subsequent operations. Supports multiple tokens per environment (device login tokens vs client credentials tokens).

**When:** First time using the CLI, when token expires, or when switching controllers/environments.

**Usage:**
```bash
# Login with default localhost:3000 (interactive prompts)
aifabrix login

# Login with custom controller URL
aifabrix login --controller https://controller.aifabrix.ai

# Credentials login with app (reads from secrets.local.yaml)
aifabrix login --controller http://localhost:3010 --method credentials --app keycloak

# Credentials login with explicit credentials
aifabrix login --controller http://localhost:3010 --method credentials --app keycloak --client-id $CLIENT_ID --client-secret $CLIENT_SECRET

# Device code flow with environment
aifabrix login --controller http://localhost:3010 --method device --environment miso

# Device code flow with offline token (long-lived refresh token)
aifabrix login --controller http://localhost:3010 --method device --environment miso --offline

# Device code flow with custom scope
aifabrix login --controller http://localhost:3010 --method device --environment miso --scope "openid profile email offline_access"
```

**Options:**
- `-c, --controller <url>` - Controller URL (default: <http://localhost:3000>)
- `-m, --method <method>` - Authentication method: `device` or `credentials` (optional, prompts if not provided)
- `-a, --app <app>` - Application name (required for credentials method, reads from secrets.local.yaml using pattern `<app-name>-client-idKeyVault`)
- `--client-id <id>` - Client ID for credentials method (optional, overrides secrets.local.yaml)
- `--client-secret <secret>` - Client Secret for credentials method (optional, overrides secrets.local.yaml)
- `-e, --environment <env>` - Environment key (updates root-level environment in config.yaml, e.g., miso, dev, tst, pro)
- `--offline` - Request offline token with `offline_access` scope (device flow only, adds to default scope)
- `--scope <scopes>` - Custom OAuth2 scope string (device flow only, default: `"openid profile email"`)

**Authentication Methods:**

1. **ClientId + ClientSecret (Credentials)**
   - Use `--method credentials` with `--app` flag (required)
   - Reads credentials from `~/.aifabrix/secrets.local.yaml` using pattern:
     - `<app-name>-client-idKeyVault` for client ID
     - `<app-name>-client-secretKeyVault` for client secret
   - If credentials not found in secrets.local.yaml, prompts interactively
   - Can override with `--client-id` and `--client-secret` flags
   - Token is saved per app and environment in config.yaml
   - Useful for application-specific deployments

2. **Device Code Flow (Environment)**
   - Use `--method device` with optional `--environment` flag
   - If `--environment` not provided, prompts interactively
   - Authenticate with only an environment key
   - **Offline Tokens**: Use `--offline` flag to request `offline_access` scope for long-lived refresh tokens
   - **Custom Scopes**: Use `--scope` option to specify custom OAuth2 scopes (default: `"openid profile email"`)
   - When `--offline` is used, `offline_access` is automatically added to the scope
   - **Note**: `--offline` and `--scope` options are only available for device flow (ignored for credentials method)
   - No client credentials required
   - Useful for initial setup before application registration
   - Follows OAuth2 Device Code Flow (RFC 8628)
   - Token is saved at root level in config.yaml, keyed by controller URL (universal per controller)
   - Includes refresh token for automatic token renewal on 401 errors

**Output (Credentials):**
```yaml
🔐 Logging in to Miso Controller...

Controller URL: http://localhost:3010
Environment: miso

✅ Successfully logged in!
Controller: http://localhost:3010
Environment: miso
App: keycloak
Token stored securely in ~/.aifabrix/config.yaml
```

**Output (Device Code):**
```yaml
🔐 Logging in to Miso Controller...

Controller URL: http://localhost:3010
Environment: miso

✅ Successfully logged in!
Controller: http://localhost:3010
Environment: miso
Token stored securely in ~/.aifabrix/config.yaml
```

**Device Code Flow Example:**

With flags:
```bash
aifabrix login --controller http://localhost:3010 --method device --environment dev
```

Interactive (prompts for environment):
```bash
aifabrix login --controller http://localhost:3010 --method device
# Prompts: Environment key (e.g., miso, dev, tst, pro): dev
```

**Credentials Login Example:**

Reads from secrets.local.yaml:
```bash
aifabrix login --controller http://localhost:3010 --method credentials --app keycloak --environment miso
```

This reads:
- `keycloak-client-idKeyVault` from `~/.aifabrix/secrets.local.yaml`
- `keycloak-client-secretKeyVault` from `~/.aifabrix/secrets.local.yaml`

And saves the token to config.yaml under `environments.miso.clients.keycloak`.

**Device Code Flow Output:**
```yaml
📱 Initiating device code flow...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Device Code Flow Authentication
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To complete authentication:
  1. Visit: https://auth.example.com/device
  2. Enter code: ABCD-EFGH
  3. Approve the request

Waiting for approval...
⏳ Waiting for approval (attempt 1)...
✅ Authentication approved!

✅ Successfully logged in!
Controller: http://localhost:3010
Environment: miso
Token stored securely in ~/.aifabrix/config.yaml
```

**Device Code Flow Steps:**

1. CLI initiates device code flow with environment key
2. Display user code and verification URL
3. User visits URL and enters code in browser
4. User approves request in browser
5. CLI polls for token (automatically)
6. Token is saved to configuration

**Environment Management:**

The `--environment` flag updates the root-level `environment` in `~/.aifabrix/config.yaml`, which indicates the currently selected environment. This environment is used by default in subsequent commands like `deploy`.

**CI/CD Usage Examples:**

```bash
# GitHub Actions / Azure DevOps
aifabrix login \
  --controller ${{ secrets.MISO_CONTROLLER_URL }} \
  --method credentials \
  --app myapp \
  --environment dev

# Device code flow in CI/CD (if environment key is available)
aifabrix login \
  --controller $CONTROLLER_URL \
  --method device \
  --environment $ENVIRONMENT_KEY
```

**Issues:**
- **"Invalid method"** → Method must be `device` or `credentials`
- **"Login failed"** → Check controller URL and credentials
- **"Token expired"** → Run login again
- **"Not logged in"** → Run `aifabrix login` before other commands
- **"Device code expired"** → Restart device code flow (codes expire after ~10 minutes)
- **"Authorization declined"** → User denied the request; run login again
- **"Device code initiation failed"** → Check environment key is valid and controller is accessible
- **"Environment key must contain only letters, numbers, hyphens, and underscores"** → Use valid environment format (e.g., miso, dev, tst, pro)

**Next Steps:**
After logging in, you can:
- Register applications: `aifabrix app register`
- Deploy applications: `aifabrix deploy`

---

## aifabrix logout

Clear authentication tokens from config.yaml.

**What:** Removes stored authentication tokens from `~/.aifabrix/config.yaml`. Supports clearing all tokens or specific tokens based on options (controller, environment, app). Preserves other configuration settings like `developer-id`, `environment`, `secrets-encryption`, etc.

**When:** When you want to log out, switch accounts, or clear expired tokens.

**Usage:**
```bash
# Clear all tokens (both device and client tokens)
aifabrix logout

# Clear device token for specific controller
aifabrix logout --controller http://localhost:3000

# Clear all client tokens for specific environment
aifabrix logout --environment dev

# Clear client token for specific app in environment
aifabrix logout --environment dev --app myapp
```

**Options:**
- `-c, --controller <url>` - Clear device tokens for specific controller (device tokens only)
- `-e, --environment <env>` - Clear client tokens for specific environment (client tokens only)
- `-a, --app <app>` - Clear client tokens for specific app (requires --environment, client tokens only)

**Token Types:**

1. **Device Tokens** (root level, keyed by controller URL)
   - Stored at `config.device[controllerUrl]`
   - Cleared with `--controller` option or when no options provided
   - Universal per controller (not environment-specific)

2. **Client Tokens** (per environment and app)
   - Stored at `config.environments[env].clients[appName]`
   - Cleared with `--environment` and/or `--app` options or when no options provided
   - Environment and app-specific

**Output (Clear All):**
```yaml
🔓 Clearing authentication tokens...

✓ Cleared 2 device token(s)
✓ Cleared 5 client token(s)

✅ Successfully cleared tokens!
Config file: ~/.aifabrix/config.yaml
```

**Output (Clear Specific Controller):**
```yaml
🔓 Clearing authentication tokens...

✓ Cleared device token for controller: http://localhost:3000

✅ Successfully cleared tokens!
Config file: ~/.aifabrix/config.yaml
```

**Output (Clear Specific Environment):**
```yaml
🔓 Clearing authentication tokens...

✓ Cleared 3 client token(s) for environment 'dev'

✅ Successfully cleared tokens!
Config file: ~/.aifabrix/config.yaml
```

**Output (No Tokens Found):**
```yaml
🔓 Clearing authentication tokens...

  No device tokens found
  No client tokens found

⚠️  No tokens found to clear
Config file: ~/.aifabrix/config.yaml
```

**What Gets Preserved:**

The logout command only removes token-related entries. The following settings are preserved:
- `developer-id` - Developer ID for port isolation
- `environment` - Currently selected environment
- `secrets-encryption` - Encryption key for token encryption
- `aifabrix-secrets` - Default secrets file path
- `aifabrix-home` - Base directory override
- `aifabrix-env-config` - Custom environment config path
- All other non-token configuration

**Examples:**

Clear all tokens:
```bash
aifabrix logout
```

Clear device token for specific controller:
```bash
aifabrix logout --controller https://controller.example.com
```

Clear all client tokens for environment:
```bash
aifabrix logout --environment dev
```

Clear specific app token:
```bash
aifabrix logout --environment dev --app myapp
```

**Validation:**

- `--app` requires `--environment` option
- Controller URL must be a valid HTTP or HTTPS URL
- Environment key must contain only letters, numbers, hyphens, and underscores

**Issues:**
- **"--app requires --environment option"** → Provide `--environment` when using `--app`
- **"Controller URL is required"** → Provide a valid controller URL
- **"Controller URL must be a valid HTTP or HTTPS URL"** → Use format like `http://localhost:3000` or `https://controller.example.com`
- **"Environment key must contain only letters, numbers, hyphens, and underscores"** → Use valid format (e.g., `dev`, `tst`, `pro`)

**Next Steps:**
After logging out, you can:
- Log in again: `aifabrix login`
- Switch to different controller/environment: `aifabrix login --controller <url> --environment <env>`

---

## aifabrix up

Start infrastructure (Postgres + Redis).

**What:** Starts PostgreSQL, Redis, pgAdmin, and Redis Commander in Docker. Supports developer isolation with developer-specific ports and infrastructure resources.

**When:** First time setup, after system restart, when infrastructure is down.

**Usage:**
```bash
# Start infrastructure with default ports (developer ID 0)
aifabrix up

# Set developer ID and start infrastructure (developer-specific ports)
aifabrix up --developer 1
```

**Options:**
- `-d, --developer <id>` - Set developer ID and start infrastructure with developer-specific ports. Developer ID must be a non-negative integer (0 = default infra, 1+ = developer-specific). When provided, sets the developer ID in `~/.aifabrix/config.yaml` and starts infrastructure with isolated ports.

**Port Calculation:**
Ports are calculated using: `basePort + (developer-id * 100)`

- **Developer ID 0** (default): App=3000, Postgres=5432, Redis=6379, pgAdmin=5050, Redis Commander=8081
- **Developer ID 1**: App=3100, Postgres=5532, Redis=6479, pgAdmin=5150, Redis Commander=8181
- **Developer ID 2**: App=3200, Postgres=5632, Redis=6579, pgAdmin=5250, Redis Commander=8281

**Output (default):**
```yaml
✓ Starting Postgres...
✓ Starting Redis...
✓ Infrastructure ready
  Postgres: localhost:5432
  Redis: localhost:6379
  pgAdmin: http://localhost:5050
  Redis Commander: http://localhost:8081
```

**Output (with developer ID):**
```yaml
✓ Developer ID set to 1
✓ Starting Postgres...
✓ Starting Redis...
✓ Infrastructure ready
  Postgres: localhost:5532
  Redis: localhost:6479
  pgAdmin: http://localhost:5150
  Redis Commander: http://localhost:8181
```

**Developer Isolation:**
When using `--developer`, each developer gets:
- Separate Docker Compose project: `infra-dev{id}`
- Isolated network: `infra-dev{id}-aifabrix-network`
- Isolated volumes: `dev{id}_postgres_data`, `dev{id}_redis_data`
- Isolated containers: `aifabrix-dev{id}-postgres`, `aifabrix-dev{id}-redis`, etc.

**Issues:**
- **"Port 5432 already in use"** → Stop other Postgres: `docker stop <container>`, or use `--developer` to use different ports
- **"Docker not running"** → Start Docker Desktop
- **"Permission denied"** → Add user to docker group (Linux)
- **"Developer ID must be a non-negative digit string"** → Use a valid integer (0, 1, 2, etc.)

---

## aifabrix down

Stop infrastructure or a specific application.

**What:**
- Without arguments: stops all infrastructure containers. Data is preserved unless `--volumes` is used.
- With an app name: stops and removes the application container. With `--volumes`, also removes the app's named Docker volume.

**When:** Shutting down, freeing resources, before system maintenance.

**Usage:**
```bash
# Stop infrastructure
aifabrix down

# Stop infrastructure and delete infra volumes (all data)
aifabrix down --volumes

# Stop a specific application container
aifabrix down myapp

# Stop an application and remove its data volume
aifabrix down myapp --volumes
```

**Notes:**
- App volumes are named per developer ID:
  - Dev 0: `aifabrix_<app>_data`
  - Dev > 0: `aifabrix_dev<id>_<app>_data`
- `--volumes` for apps removes only the Docker named volume. It does not delete files in `builder/<app>` or `apps/<app>`.

**Issues:** None common.

---

## aifabrix status

Show detailed infrastructure service status.

**What:** Displays the current status of all infrastructure services (Postgres, Redis, pgAdmin, Redis Commander) including their running state, ports, and URLs.

**When:** Checking infrastructure health, troubleshooting connection issues.

**Example:**
```bash
aifabrix status
```

**Output:**
```yaml
📊 Infrastructure Status

✅ postgres:
   Status: running
   Port: 5432
   URL: localhost:5432

✅ redis:
   Status: running
   Port: 6379
   URL: localhost:6379

✅ pgadmin:
   Status: running
   Port: 5050
   URL: http://localhost:5050

✅ redis-commander:
   Status: running
   Port: 8081
   URL: http://localhost:8081
```

**Issues:**
- **"Infrastructure not running"** → Run `aifabrix up` first
- **"Docker not running"** → Start Docker Desktop

---

<a id="aifabrix-restart-service"></a>
## aifabrix restart <service>

Restart a specific infrastructure service.

**What:** Restarts a single infrastructure service (postgres, redis, pgadmin, redis-commander) without affecting other services.

**When:** Service is misbehaving, after configuration changes, troubleshooting.

**Example:**
```bash
# Restart Postgres
aifabrix restart postgres

# Restart Redis
aifabrix restart redis
```

**Available services:**
- `postgres` - PostgreSQL database
- `redis` - Redis cache
- `pgadmin` - pgAdmin web UI
- `redis-commander` - Redis Commander web UI

**Output:**
```yaml
✅ postgres service restarted successfully
```

**Issues:**
- **"Service not found"** → Use correct service name (postgres, redis, pgadmin, redis-commander)
- **"Service not running"** → Service may not be started; use `aifabrix up` to start all services

---

<a id="aifabrix-dev-config"></a>
## aifabrix dev config

View or set developer ID for port isolation.

**What:** Displays current developer configuration (developer ID and calculated ports) or sets a new developer ID. Developer isolation allows multiple developers to run applications simultaneously on the same machine without port conflicts.

**When:** Setting up developer isolation, checking current port assignments, troubleshooting port conflicts.

**Usage:**
```bash
# View current developer configuration
aifabrix dev config

# Set developer ID
aifabrix dev config --set-id 1

# Set developer ID to 2
aifabrix dev config --set-id 2
```

**Options:**
- `--set-id <id>` - Set developer ID (non-negative integer). Developer ID 0 = default infrastructure (base ports), 1+ = developer-specific (offset ports). Updates `~/.aifabrix/config.yaml` and sets `AIFABRIX_DEVELOPERID` environment variable.

**Output (view):**
```yaml
🔧 Developer Configuration

Developer ID: 1

Ports:
  App: 3100
  Postgres: 5532
  Redis: 6479
  pgAdmin: 5150
  Redis Commander: 8181
```

**Output (view with configuration variables):**
```yaml
🔧 Developer Configuration

Developer ID: 1

Ports:
  App: 3100
  Postgres: 5532
  Redis: 6479
  pgAdmin: 5150
  Redis Commander: 8181

Configuration:
  aifabrix-home: /workspace/.aifabrix
  aifabrix-secrets: /workspace/aifabrix-miso/builder/secrets.local.yaml
  aifabrix-env-config: /workspace/aifabrix-miso/builder/env-config.yaml
```

**Output (set):**
```yaml
✓ Developer ID set to 1

🔧 Developer Configuration

Developer ID: 1

Ports:
  App: 3100
  Postgres: 5532
  Redis: 6479
  pgAdmin: 5150
  Redis Commander: 8181
```

**Output (set with configuration variables):**
```yaml
✓ Developer ID set to 1

🔧 Developer Configuration

Developer ID: 1

Ports:
  App: 3100
  Postgres: 5532
  Redis: 6479
  pgAdmin: 5150
  Redis Commander: 8181

Configuration:
  aifabrix-home: /workspace/.aifabrix
  aifabrix-secrets: /workspace/aifabrix-miso/builder/secrets.local.yaml
  aifabrix-env-config: /workspace/aifabrix-miso/builder/env-config.yaml
```

**Port Calculation:**
Ports are calculated using: `basePort + (developer-id * 100)`

- **Developer ID 0** (default): App=3000, Postgres=5432, Redis=6379, pgAdmin=5050, Redis Commander=8081
- **Developer ID 1**: App=3100, Postgres=5532, Redis=6479, pgAdmin=5150, Redis Commander=8181
- **Developer ID 2**: App=3200, Postgres=5632, Redis=6579, pgAdmin=5250, Redis Commander=8281

**How It Works:**
- Developer ID is stored in `~/.aifabrix/config.yaml` as `developer-id`
- Setting developer ID also sets `AIFABRIX_DEVELOPERID` environment variable
- All infrastructure and application commands use this developer ID for port calculation
- Each developer gets isolated Docker resources (containers, networks, volumes)

**Configuration Variables:**
The command displays configuration variables if they are set in `~/.aifabrix/config.yaml`:
- `aifabrix-home` - Base directory for AI Fabrix local files (default: `~/.aifabrix`)
- `aifabrix-secrets` - Default secrets file path (default: `<home>/secrets.yaml`)
- `aifabrix-env-config` - Custom environment configuration file path

These variables are only shown if they are explicitly set in the configuration file. If not set, the Configuration section is omitted from the output.

**Configuration File:**
The developer ID is stored in `~/.aifabrix/config.yaml`:
```yaml
developer-id: 1
environment: dev
```

**Issues:**
- **"Developer ID must be a non-negative digit string"** → Use a valid integer (0, 1, 2, etc.)
- **"Port already in use"** → Try a different developer ID or check if another process is using the port
- **"Configuration file not found"** → The config file will be created automatically when setting developer ID

**Next Steps:**
After setting developer ID:
- Start infrastructure: `aifabrix up` (or `aifabrix up --developer <id>`)
- Run applications: `aifabrix run <app>` (uses developer-specific ports automatically)
- Check status: `aifabrix status` (shows developer-specific ports)

**See Also:**
- [Developer Isolation Guide](DEVELOPER-ISOLATION.md) - Complete guide to developer isolation features

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

---

<a id="aifabrix-create-app"></a>
## aifabrix create <app>

Create new application with configuration files.

**What:** Generates `builder/` folder with `variables.yaml`, `env.template`, `rbac.yaml`, and optional GitHub Actions workflows.

**When:** Starting a new application.

**Example (interactive):**
```bash
aifabrix create myapp
```
Prompts for: port, database, redis, storage, authentication, language.

**Example (with flags):**
```bash
aifabrix create myapp --port 3000 --database --language typescript
```

**Example (with GitHub workflows):**
```bash
aifabrix create myapp --port 3000 --database --github --main-branch main
```

**Example (with template):**
```bash
aifabrix create myapp --template miso-controller --port 3000
```

**Example (with GitHub steps):**
```bash
aifabrix create myapp --github --github-steps npm
```
**Note:** Step templates must exist in `templates/github/steps/{step}.hbs`. Currently available: `npm.hbs`

**Example (external system):**
```bash
aifabrix create hubspot --type external
```
Prompts for: system key, display name, description, system type (openapi/mcp/custom), authentication type (oauth2/apikey/basic), number of datasources.

**Complete HubSpot example:**
See `integration/hubspot/` for a complete HubSpot integration with companies, contacts, and deals datasources. Includes OAuth2 authentication, field mappings, and OpenAPI operations.

→ [External Systems Guide](EXTERNAL-SYSTEMS.md) - Complete guide with step-by-step instructions

**Flags:**
- `-p, --port <port>` - Application port (default: 3000, not used for external type)
- `-d, --database` - Requires database (not used for external type)
- `-r, --redis` - Requires Redis (not used for external type)
- `-s, --storage` - Requires file storage (not used for external type)
- `-a, --authentication` - Requires authentication/RBAC (not used for external type)
- `-l, --language <lang>` - typescript or python (not used for external type)
- `-t, --template <name>` - Template to use (e.g., miso-controller, keycloak). Template folder must exist in `templates/{template}/`
- `--type <type>` - Application type: `webapp`, `api`, `service`, `functionapp`, or `external` (default: webapp)
- `--app` - Generate minimal application files (package.json, index.ts or requirements.txt, main.py) (not used for external type)
- `-g, --github` - (Optional) Generate GitHub Actions workflows
- `--github-steps <steps>` - Extra GitHub workflow steps (comma-separated, e.g., `npm`). Step templates must exist in `templates/github/steps/{step}.hbs`. When included, these steps are rendered and injected into workflow files (e.g., `release.yaml`). Available step templates: `npm.hbs` (adds NPM publishing job)
- `--main-branch <branch>` - Main branch name for workflows (default: main)

**Creates:**
- `builder/<app>/variables.yaml` - Application configuration (regular apps)
- `builder/<app>/env.template` - Environment template with kv:// references
- `builder/<app>/rbac.yaml` - RBAC configuration (if authentication enabled)
- `builder/<app>/aifabrix-deploy.json` - Deployment manifest
- `builder/<app>/README.md` - Application documentation
- `.github/workflows/` - GitHub Actions workflows (if --github specified)

**External Type (`--type external`):**
When using `--type external`, the command creates an external system integration in `integration/<app>/`:
- `integration/<app>/variables.yaml` - App configuration with `app.type: "external"` and `externalIntegration` block
- `integration/<app>/<app-name>-deploy.json` - External system JSON
- `integration/<app>/<app-name>-deploy-<datasource-key>.json` - Datasource JSON files (all in same folder)
- `integration/<app>/env.template` - Environment variables template
- `integration/<app>/README.md` - Application documentation
- All files are in the same folder for easy viewing and management
- External systems use the pipeline API for deployment via Miso Controller

→ [External Systems Guide](EXTERNAL-SYSTEMS.md) - Complete guide with HubSpot example

**Environment File Conversion:**
- Automatically detects existing `.env` file in current directory
- Converts sensitive values (passwords, keys, tokens) to `kv://` references
- Preserves non-sensitive values as-is
- Generates warnings for invalid environment variable names

**App Name Validation:**
- Must be 3-40 characters
- Lowercase letters, numbers, and dashes only
- Cannot start or end with dash
- Cannot have consecutive dashes

**Issues:**
- **"Application 'name' already exists"** → Choose different name or delete existing folder
- **"Application name must be 3-40 characters"** → Use valid format (lowercase, dashes only)
- **"Port must be between 1 and 65535"** → Use valid port number
- **"Language must be either typescript or python"** → Use supported language
- **"Invalid type: <type>"** → Type must be one of: webapp, api, service, functionapp, external

---

<a id="aifabrix-build-app"></a>
## aifabrix build <app>

Build Docker image.

**What:** Detects language, generates/uses Dockerfile, builds image, creates `.env`. For external type applications, generates `application-schema.json` file only (does not build Docker images or deploy).

**When:** After code changes, first build, when Dockerfile needs regeneration. For external systems, when ready to generate the application schema file for deployment.

**Example:**
```bash
aifabrix build myapp
```

**Example (external system):**
```bash
aifabrix build hubspot
# For external type, this generates application-schema.json only (no Docker build, no deployment)
```

**Override language:**
```bash
aifabrix build myapp --language python
```

**Force template regeneration:**
```bash
aifabrix build myapp --force-template
```

**Flags:**
- `-l, --language <lang>` - Override language detection
- `-f, --force-template` - Force rebuild from template
- `-t, --tag <tag>` - Image tag (default: latest)

**Creates:**
- Docker image: `myapp:latest`
- `.env` file in `builder/`
  - Note: build resolves variables using the local environment (run uses docker)

**Issues:**
- **"Docker not running"** → Start Docker Desktop
- **"Build failed"** → Check Dockerfile syntax, dependencies
- **"Permission denied"** → Fix Docker permissions

---

<a id="aifabrix-run-app"></a>
## aifabrix run <app>

Run application locally in Docker container with automatic infrastructure connectivity.

**What:** Starts container, connects to infrastructure, maps ports, waits for health check.

**When:** Testing, development, debugging, local demonstrations.

**Prerequisites:**
- Application must be built: `aifabrix build <app>`
- Infrastructure must be running: `aifabrix up`
- `.env` file must exist in `builder/<app>/`

**Example:**
```bash
aifabrix run myapp
```

**Custom port:**
```bash
aifabrix run myapp --port 3001
```

**Flags:**
- `-p, --port <port>` - Override local port (default: from variables.yaml)
- `-d, --debug` - Enable debug output with detailed container information (port detection, container status, Docker commands, health check details)

**Debug Mode:**
When `--debug` is enabled, the command outputs detailed information including:
- Port detection: Shows detected port, fallback logic, and Docker inspect commands
- Container status: Shows container state, running status, and port mappings
- Docker commands: Logs all Docker commands executed (docker ps, docker inspect, docker-compose, etc.)
- Health check details: Shows health check URL, response codes, response bodies (truncated), retry attempts, and timeout information

**Example with debug:**
```bash
aifabrix run myapp --debug
```

**Process:**
1. Validates app configuration
2. Checks if Docker image exists
3. Verifies infrastructure health
4. Stops existing container if running
5. Checks port availability
6. Generates `.env` file from template (if needed)
7. Generates Docker Compose configuration
8. **Creates database and user** (if `requiresDatabase: true` in variables.yaml)
   - Automatically creates database named after app key
   - Creates database user with proper permissions
   - Grants all privileges and sets schema ownership
   - Idempotent: skips if database already exists
9. Starts container with proper networking
10. Waits for health check to pass
11. Displays access URL

**Access:** <http://localhost>:<port>

**Container:** `aifabrix-<app>`

**Health Check:** `/health` endpoint

**Issues:**
- **"Docker image not found"** → Run `aifabrix build <app>` first
- **"Infrastructure not running"** → Run `aifabrix up` first
- **"Port already in use"** → Use `--port <alternative>` flag
- **"Container won't start"** → Check logs: `docker logs aifabrix-<app>`
- **"Health check timeout"** → Check application logs and health endpoint
- **"Configuration validation failed"** → Fix issues in `builder/<app>/variables.yaml`

---

<a id="aifabrix-push-app"></a>
## aifabrix push <app>

Push image to Azure Container Registry.

**What:** Authenticates with ACR using Azure CLI, tags image, pushes to registry. Supports multiple tags with a single command.

**When:** Before Azure deployment, after building application.

**Prerequisites:**
- Azure CLI installed and logged in (`az login`)
- Docker image built locally (`aifabrix build <app>`)
- ACR registry accessible

**Example (single tag):**
```bash
aifabrix push myapp --registry myacr.azurecr.io --tag v1.0.0
```

**Example (multiple tags):**
```bash
aifabrix push myapp --registry myacr.azurecr.io --tag "v1.0.0,latest,stable"
```

**Example (using registry from variables.yaml):**
```bash
aifabrix push myapp --tag v1.0.0
```
Automatically uses registry configured in `builder/<app>/variables.yaml`:
```yaml
image:
  registry: myacr.azurecr.io
```

**Example (default latest tag):**
```bash
aifabrix push myapp --registry myacr.azurecr.io
```
Pushes with `latest` tag.

**Flags:**
- `-r, --registry <url>` - ACR registry URL (overrides variables.yaml)
- `-t, --tag <tag>` - Image tag(s) - comma-separated for multiple (default: latest)

**Registry Resolution:**
1. `--registry` flag (highest priority)
2. `image.registry` in `variables.yaml`
3. Error if neither provided

**What Happens:**
1. Validates app name and configuration
2. Checks if Docker image exists locally
3. Verifies Azure CLI is installed
4. Authenticates with ACR (`az acr login`)
5. Tags image for each tag specified
6. Pushes all tags to registry
7. Displays success summary

**Output:**
```yaml
Authenticating with myacr.azurecr.io...
✓ Authenticated with myacr.azurecr.io
Tagging myapp:latest as myacr.azurecr.io/myapp:v1.0.0...
✓ Tagged: myacr.azurecr.io/myapp:v1.0.0
Tagging myapp:latest as myacr.azurecr.io/myapp:latest...
✓ Tagged: myacr.azurecr.io/myapp:latest
Pushing myacr.azurecr.io/myapp:v1.0.0...
✓ Pushed: myacr.azurecr.io/myapp:v1.0.0
Pushing myacr.azurecr.io/myapp:latest...
✓ Pushed: myacr.azurecr.io/myapp:latest

✓ Successfully pushed 2 tag(s) to myacr.azurecr.io
Image: myacr.azurecr.io/myapp:*
Tags: v1.0.0, latest
```

**Issues:**
- **"Azure CLI is not installed"** → Install from: <https://docs.microsoft.com/cli/azure/install-azure-cli>
- **"Authentication failed"** → Run: `az login` then `az acr login --name myacr`
- **"Docker image not found locally"** → Build first: `aifabrix build myapp`
- **"Invalid registry URL format"** → Use format: `*.azurecr.io` (e.g., `myacr.azurecr.io`)
- **"Registry URL is required"** → Provide via `--registry` flag or configure in `variables.yaml`
- **"Permission denied"** → Check ACR permissions and Azure role assignments
- **"Failed to push image"** → Check network connectivity, registry accessibility, and image size limits

---

<a id="aifabrix-environment-deploy-env"></a>
## aifabrix environment deploy <env>

Deploy/setup environment in Miso Controller.

**What:** Sets up and deploys an environment (miso, dev, tst, pro) in the Miso Controller. Provisions environment-level infrastructure, configures resources, and prepares the environment for application deployments. Automatically retrieves or refreshes authentication token, validates configuration, and sends environment deployment request to Miso Controller API. Polls deployment status by default to track progress.

**When:** Setting up a new environment for the first time, provisioning environment infrastructure, updating environment-level configuration, or before deploying applications to an environment. This should be done before deploying applications.

**Example:**
```bash
# Deploy development environment
aifabrix environment deploy dev --controller https://controller.aifabrix.ai

# Deploy testing environment
aifabrix environment deploy tst --controller https://controller.aifabrix.ai

# Deploy production environment
aifabrix environment deploy pro --controller https://controller.aifabrix.ai

# Deploy miso environment
aifabrix environment deploy miso --controller https://controller.aifabrix.ai

# Using alias
aifabrix env deploy dev --controller https://controller.aifabrix.ai

# Without status polling
aifabrix environment deploy dev --controller https://controller.aifabrix.ai --no-poll
```

**Output:**
```yaml
📋 Deploying environment 'dev' to https://controller.aifabrix.ai...
✓ Environment validated
✓ Authentication successful

🚀 Deploying environment infrastructure...
📤 Sending deployment request to https://controller.aifabrix.ai/api/v1/environments/dev/deploy...
⏳ Polling deployment status (5000ms intervals)...

✅ Environment deployed successfully
   Environment: dev
   Status: ✅ ready
   URL: https://controller.aifabrix.ai/environments/dev
   
✓ Environment is ready for application deployments
```

**Configuration:**

The environment deploy command requires:
- Controller URL (via `--controller` flag)
- Valid environment key (miso, dev, tst, pro)
- Authentication token (device token, obtained via `aifabrix login`)

**Authentication:**

The environment deploy command automatically:
1. Gets or refreshes device token for the controller
2. Uses device token (not app-specific client credentials)
3. Requires admin/operator privileges for environment deployment
4. If token missing or expired:
   - Prompts to run `aifabrix login` first
   - Or uses existing device token from config.yaml

**Advanced options:**
```bash
# Without status polling
aifabrix environment deploy dev --controller https://controller.aifabrix.ai --no-poll

# With environment configuration file
aifabrix environment deploy dev --controller https://controller.aifabrix.ai --config ./env-config.yaml

# Skip validation checks
aifabrix environment deploy dev --controller https://controller.aifabrix.ai --skip-validation
```

**Flags:**
- `-c, --controller <url>` - Controller URL (required)
- `--config <file>` - Environment configuration file (optional, for custom environment setup)
- `--skip-validation` - Skip environment validation checks
- `--poll` - Poll for deployment status (default: true)
- `--no-poll` - Do not poll for status

**Process:**
1. Validates environment key format (must be: miso, dev, tst, pro)
2. Validates controller URL
3. Gets or refreshes device token for authentication
4. Sends environment deployment request to controller API
5. Polls deployment status (if enabled)
6. Verifies environment is ready for application deployments
7. Displays deployment results

**Environment Deployment Request:**
```json
{
  "key": "dev",
  "displayName": "Development Environment",
  "description": "Development environment for testing and development",
  "configuration": {
    "infrastructure": {...},
    "resources": {...},
    "security": {...}
  }
}
```

**Differences from `aifabrix deploy <app>`:**

| Aspect | `environment deploy <env>` | `deploy <app>` |
| ------ | ------------------------- | -------------- |
| **Target** | Environment (dev, tst, pro, miso) | Application |
| **Purpose** | Set up environment infrastructure | Deploy application to environment |
| **Prerequisites** | Controller access, authentication | Environment must exist, app must be built |
| **Authentication** | Device token | Client credentials (app-specific) |
| **Use Case** | Environment provisioning | Application deployment |
| **Order** | First (setup environment) | Second (deploy apps to environment) |
| **Frequency** | Once per environment (or when updating) | Multiple times per app |

**When to Use:**

- ✅ **Use `environment deploy`** when:
  - Setting up a new environment for the first time
  - Provisioning environment infrastructure
  - Updating environment-level configuration
  - Before deploying applications to an environment

- ✅ **Use `deploy <app>`** when:
  - Deploying applications to an already-set-up environment
  - Application-level deployment only
  - Environment already exists and is ready

**Workflow:**

The typical deployment workflow:

1. **Deploy Environment** (first)
   ```bash
   aifabrix environment deploy dev --controller https://controller.aifabrix.ai
   ```

2. **Deploy Applications** (second)
   ```bash
   aifabrix deploy myapp --controller https://controller.aifabrix.ai --environment dev
   ```

**Issues:**
- **"Environment key is required"** → Provide environment key as argument (miso, dev, tst, pro)
- **"Invalid environment key"** → Environment must be one of: miso, dev, tst, pro
- **"Controller URL is required"** → Provide `--controller` flag with HTTPS URL
- **"Controller URL must use HTTPS"** → Use `https://` protocol
- **"Failed to get authentication token"** → Run `aifabrix login` first to get device token
- **"Authentication failed"** → Token may be expired, run `aifabrix login` again
- **"Environment already exists"** → Environment may already be deployed, check controller dashboard
- **"Insufficient permissions"** → Requires admin/operator privileges for environment deployment
- **"Can't reach controller"** → Check URL, network connection, firewall
- **"Request timed out"** → Controller may be overloaded, try again later
- **"Deployment timeout"** → Check controller logs, deployment may be in progress
- **"Environment not ready"** → Wait for environment deployment to complete, check status

---

<a id="aifabrix-deploy-app"></a>
## aifabrix deploy <app>

Deploy to Azure via Miso Controller.

**What:** Generates deployment manifest from variables.yaml, env.template, and rbac.yaml. Automatically retrieves or refreshes authentication token, validates configuration, and sends to Miso Controller API for Azure deployment. Polls deployment status by default to track progress. For external type applications, uses the same normal deployment flow with `application-schema.json` (generated by `aifabrix json` or `aifabrix build`).

**When:** Deploying to Azure after pushing images to ACR. For external systems, after generating `application-schema.json` with `aifabrix json` or `aifabrix build`.

**Example:**
```bash
# Basic deployment (uses current environment from config.yaml and token from login)
aifabrix deploy myapp --controller https://controller.aifabrix.ai

# Deploy to specific environment (updates root-level environment in config.yaml)
aifabrix deploy myapp --controller https://controller.aifabrix.ai --environment miso

# External system deployment (uses application-schema.json, deploys via normal controller flow)
aifabrix deploy hubspot --controller https://controller.aifabrix.ai --environment dev
```

**Output:**
```yaml
📋 Generating deployment manifest for myapp...
✓ Manifest generated: builder/myapp/aifabrix-deploy.json
   Key: myapp
   Display Name: My Application
   Image: myacr.azurecr.io/myapp:latest
   Port: 3000

🚀 Deploying to https://controller.aifabrix.ai (environment: miso)...
📤 Sending deployment request to https://controller.aifabrix.ai/api/v1/pipeline/miso/deploy...
⏳ Polling deployment status (5000ms intervals)...

✅ Deployment initiated successfully
   URL: https://myapp.aifabrix.ai
   Deployment ID: deploy-abc123
   Status: ✅ completed
```

**Configuration in variables.yaml (recommended):**
```yaml
deployment:
  controllerUrl: 'https://controller.aifabrix.ai'
  environment: 'dev'  # Optional, uses root-level environment from config.yaml if not specified
```

Then simply run:
```bash
aifabrix deploy myapp
```

**Authentication:**

The deploy command automatically:
1. Gets current environment from root-level `environment` in `~/.aifabrix/config.yaml`
2. Updates root-level environment if `--environment` is provided
3. Retrieves client token from config.yaml for current environment + app
4. If token missing or expired:
   - Reads clientId/secret from `~/.aifabrix/secrets.local.yaml` using pattern:
     - `<app-name>-client-idKeyVault` for client ID
     - `<app-name>-client-secretKeyVault` for client secret
   - Calls login API to get new token
   - Saves token to config.yaml (never saves credentials)
5. Uses token for deployment

**Advanced options:**
```bash
# Without status polling
aifabrix deploy myapp --no-poll

# Deploy to specific environment (updates root-level environment)
aifabrix deploy myapp --environment pro

# Deploy with explicit client credentials (overrides config)
aifabrix deploy myapp --controller https://controller.aifabrix.ai --client-id my-client-id --client-secret my-secret
```

**Flags:**
- `-c, --controller <url>` - Controller URL (overrides variables.yaml)
- `-e, --environment <env>` - Environment (miso, dev, tst, pro) - updates root-level environment in config.yaml if provided
- `--client-id <id>` - Client ID (overrides config)
- `--client-secret <secret>` - Client Secret (overrides config)
- `--poll` - Poll for deployment status (default: true)
- `--no-poll` - Do not poll for status

**Process:**
1. Validates app name format
2. Loads variables.yaml from `builder/<app>/`
3. Updates root-level environment in config.yaml if `--environment` provided
4. Gets current environment from root-level config.yaml
5. Retrieves or refreshes client token for environment + app
6. Loads env.template and parses environment variables
7. Loads rbac.yaml for roles and permissions
8. Generates deployment manifest
9. Validates manifest (checks required fields, format)
10. Sends deployment request to controller API with Bearer token authentication
11. Polls deployment status (if enabled)
12. Displays deployment results

**Generated Manifest Format:**
```json
{
  "key": "myapp",
  "displayName": "My Application",
  "description": "Application description",
  "type": "webapp",
  "port": 3000,
  "image": "myacr.azurecr.io/myapp:latest",
  "deploymentKey": "sha256hash...",
  "configuration": [
    {"name": "PORT", "value": "3000", "location": "variable", "required": true},
    {"name": "DATABASE_URL", "value": "key-name", "location": "keyvault", "required": true}
  ],
  "roles": [...],
  "permissions": [...],
  "healthCheck": {"path": "/health", "interval": 30}
}
```

**Issues:**
- **"App name is required"** → Provide app name as argument
- **"Application not found in builder/"** → Run `aifabrix create <app>` first
- **"Controller URL is required"** → Provide `--controller` flag with HTTPS URL
- **"Controller URL must use HTTPS"** → Use `https://` protocol
- **"Failed to get authentication token"** → Run `aifabrix login --method credentials --app <app>` first, or ensure credentials are in `~/.aifabrix/secrets.local.yaml` as `<app-name>-client-idKeyVault` and `<app-name>-client-secretKeyVault`
- **"Client credentials not found for app"** → Add credentials to `~/.aifabrix/secrets.local.yaml` or run `aifabrix login` first
- **"Validation failed"** → Check `aifabrix-deploy.json` for missing required fields
- **"Deployment key mismatch"** → Regenerate: `aifabrix genkey <app>`
- **"Authentication failed"** → Token may be expired, run `aifabrix login` again
- **"Invalid deployment manifest"** → Check configuration in variables.yaml
- **"Can't reach controller"** → Check URL, network connection, firewall
- **"Request timed out"** → Controller may be overloaded, try again later
- **"Deployment timeout"** → Check controller logs, deployment may be in progress

---

## aifabrix deployments

**Note:** This command is planned but not yet implemented in the current version. Deployment status can be monitored during deployment using the `--poll` option of the `deploy` command, or by checking the controller dashboard directly.

**Planned functionality:**
- List all deployments for an environment
- View specific deployment details
- View deployment logs

**Workaround:**
Use `aifabrix deploy <app> --poll` to monitor deployment status, or access the controller dashboard at `https://controller.aifabrix.ai/deployments`.

---

<a id="aifabrix-validate-apporfile"></a>
## aifabrix validate <appOrFile>

Validate application or external integration file.

**What:** Validates application configurations or external integration files (external-system.json, external-datasource.json) against their schemas. Supports both app name validation (including externalIntegration block and rbac.yaml for external systems) and direct file validation. For external systems, validates rbac.yaml if present and checks role references in permissions.

**When:** Before deployment, when troubleshooting configuration issues, validating external integration schemas, or checking configuration changes.

**Usage:**
```bash
# Validate application by name (includes externalIntegration files if present)
aifabrix validate myapp

# Validate external system file directly
aifabrix validate ./schemas/hubspot.json

# Validate external datasource file directly
aifabrix validate ./schemas/hubspot-deal.json
```

**Arguments:**
- `<appOrFile>` - Application name or path to configuration file

**Process:**
1. Detects if input is app name or file path
2. If app name:
   - Validates application configuration (variables.yaml)
   - If external system, validates rbac.yaml (if present) and checks role references in permissions
   - If `externalIntegration` block exists in variables.yaml:
     - Resolves schema base path
     - Finds all external-system.json and external-datasource.json files
     - Validates each file against its schema (including roles/permissions validation)
   - Aggregates all validation results
3. If file path:
   - Detects schema type (application, external-system, external-datasource)
   - Loads appropriate schema
   - Validates file against schema (for external-system, also validates role references in permissions)

**Output (app validation with external files):**
```yaml
✓ Validation passed!

Application:
  ✓ Application configuration is valid

External Integration Files:
  ✓ hubspot.json (system)
  ✓ hubspot-deal.json (datasource)
```

**Output (validation failed):**
```yaml
✗ Validation failed!

Application:
  ✗ Application configuration has errors:
    • Missing required field 'app.key'

External Integration Files:
  ✗ hubspot.json (system):
    • Missing required field 'key'
    • Field 'version' must match pattern ^[0-9]+\.[0-9]+\.[0-9]+$
```

**Output (file validation):**
```yaml
✓ Validation passed!

File: ./schemas/hubspot.json
Type: external-system
  ✓ File is valid
```

**Issues:**
- **"App name or file path is required"** → Provide application name or file path
- **"File not found"** → Check file path is correct
- **"Invalid JSON syntax"** → Fix JSON syntax errors in file
- **"externalIntegration block not found"** → Add externalIntegration block to variables.yaml or validate file directly
- **"schemaBasePath not found"** → Add schemaBasePath to externalIntegration block
- **"File not found: <path>"** → Check that external system/datasource files exist at specified paths
- **"Unknown schema type"** → File must be application, external-system, or external-datasource JSON

**Next Steps:**
After validation:
- Fix any errors reported
- For external integrations, ensure all referenced files exist
- Use `aifabrix diff` to compare configuration versions
- Deploy validated configuration: `aifabrix deploy <app>`

---

<a id="aifabrix-diff-file1-file2"></a>
## aifabrix diff <file1> <file2>

Compare two configuration files.

**What:** Performs deep comparison of two JSON configuration files, identifying added, removed, and changed fields. Categorizes changes as breaking or non-breaking. Used for deployment pipeline validation and schema migration detection.

**When:** Before deploying configuration changes, comparing schema versions, validating migrations, or reviewing configuration differences.

**Usage:**
```bash
# Compare two external system files
aifabrix diff ./schemas/hubspot-v1.json ./schemas/hubspot-v2.json

# Compare two datasource files
aifabrix diff ./schemas/hubspot-deal-v1.json ./schemas/hubspot-deal-v2.json

# Compare deployment configurations
aifabrix diff ./old-config.json ./new-config.json
```

**Arguments:**
- `<file1>` - Path to first configuration file
- `<file2>` - Path to second configuration file

**Process:**
1. Reads and parses both JSON files
2. Performs deep object comparison
3. Identifies:
   - Added fields (present in file2, not in file1)
   - Removed fields (present in file1, not in file2)
   - Changed fields (different values)
   - Version changes
4. Categorizes breaking changes:
   - Removed fields (potentially breaking)
   - Type changes (breaking)
5. Displays formatted diff output

**Output (identical files):**
```yaml
Comparing: hubspot-v1.json ↔ hubspot-v2.json

✓ Files are identical
```

**Output (different files):**
```yaml
Comparing: hubspot-v1.json ↔ hubspot-v2.json

Files are different

Version: 1.0.0 → 2.0.0

⚠️  Breaking Changes:
  • Field removed: apiKey.path (string)
  • Type changed: timeout (number → string)

Added Fields:
  + authentication.type: "oauth2"
  + rateLimit: 100

Removed Fields:
  - apiKey.path: "config.apiKey"

Changed Fields:
  ~ timeout:
    Old: 30
    New: "30s"
  ~ baseUrl:
    Old: "https://api.hubspot.com"
    New: "https://api.hubspot.com/v3"

Summary:
  Added: 2
  Removed: 1
  Changed: 2
  Breaking: 2
```

**Breaking Changes:**
- **Removed fields** - Fields present in file1 but not in file2
- **Type changes** - Fields with different types between files

**Non-Breaking Changes:**
- **Added fields** - New fields in file2
- **Value changes** - Same type, different values

**Exit Codes:**
- **0** - Files are identical
- **1** - Files are different

**Issues:**
- **"First file path is required"** → Provide path to first file
- **"Second file path is required"** → Provide path to second file
- **"File not found: <path>"** → Check file paths are correct
- **"Failed to parse <file>"** → Fix JSON syntax errors in file

**Next Steps:**
After comparing:
- Review breaking changes before deployment
- Update configuration if needed
- Use `aifabrix validate` to ensure new configuration is valid
- Deploy updated configuration: `aifabrix deploy <app>`

---

<a id="aifabrix-download-system-key"></a>
## aifabrix download <system-key>

Download external system from dataplane to local development structure.

**What:** Downloads an external system configuration and all its datasources from the dataplane API to a local development folder structure. Creates all necessary files for local development and testing.

**When:** Setting up local development for an existing external system, cloning a system from another environment, or retrieving a system configuration for modification.

**Usage:**
```bash
# Download external system from dataplane
aifabrix download hubspot --environment dev

# Download with custom controller URL
aifabrix download hubspot --environment dev --controller https://controller.aifabrix.ai

# Dry run to see what would be downloaded
aifabrix download hubspot --environment dev --dry-run
```

**Arguments:**
- `<system-key>` - External system key (identifier)

**Options:**
- `-e, --environment <env>` - Environment (dev, tst, pro) (default: dev)
- `-c, --controller <url>` - Controller URL (optional, uses configured controller if not provided)
- `--dry-run` - Show what would be downloaded without actually downloading

**Prerequisites:**
- Must be logged in: `aifabrix login --method device --environment <env>`
- System must exist in the dataplane

**Process:**
1. Gets dataplane URL from controller
2. Downloads system configuration from dataplane API: `GET /api/v1/external/systems/{systemKey}/config`
3. Downloads datasource configurations
4. Validates downloaded data against schemas
5. Creates `integration/<system-key>/` folder structure
6. Generates development files:
   - `variables.yaml` - Application configuration with externalIntegration block
   - `<system-key>-deploy.json` - External system definition
   - `<system-key>-deploy-<entity>.json` - Datasource files (one per entity)
   - `env.template` - Environment variables template
   - `README.md` - Documentation with setup instructions

**Output:**
```yaml
📥 Downloading external system 'hubspot' from dataplane...

🔐 Getting authentication...
✓ Authentication successful
🌐 Getting dataplane URL from controller...
✓ Dataplane URL: https://dataplane.aifabrix.ai

📥 Downloading system configuration...
✓ System configuration downloaded
📥 Downloading datasources...
✓ Downloaded 3 datasource(s)

📝 Generating development files...
✓ Created integration/hubspot/variables.yaml
✓ Created integration/hubspot/hubspot-deploy.json
✓ Created integration/hubspot/hubspot-deploy-company.json
✓ Created integration/hubspot/hubspot-deploy-contact.json
✓ Created integration/hubspot/hubspot-deploy-deal.json
✓ Created integration/hubspot/env.template
✓ Created integration/hubspot/README.md

✅ External system downloaded successfully!
   Location: integration/hubspot/
```

**File Structure:**
```text
integration/
  <system-key>/
    variables.yaml                    # App configuration with externalIntegration block
    <system-key>-deploy.json         # External system definition
    <system-key>-deploy-<entity1>.json  # Datasource 1
    <system-key>-deploy-<entity2>.json  # Datasource 2
    env.template                     # Environment variables template
    README.md                        # Documentation
```

**Issues:**
- **"System key is required"** → Provide system key as argument
- **"Not logged in"** → Run `aifabrix login --method device --environment <env>` first
- **"System not found"** → Check system key exists in the dataplane
- **"Failed to download system"** → Check dataplane URL, authentication, and network connection
- **"Partial download failed"** → Some datasources may have failed; check error messages
- **"Validation failed"** → Downloaded data doesn't match expected schema

**Next Steps:**
After downloading:
- Review configuration files in `integration/<system-key>/`
- Run unit tests: `aifabrix test <system-key>`
- Run integration tests: `aifabrix test-integration <system-key>`
- Deploy changes: `aifabrix deploy <system-key>`

---

<a id="aifabrix-test-app"></a>
## aifabrix test <app>

Run unit tests for external system (local validation, no API calls).

**What:** Validates external system configuration locally without making API calls. Tests JSON syntax, schema validation, field mapping expressions, metadata schemas, and relationships. Uses test payloads from datasource configuration if available.

**When:** Before deploying changes, validating configuration locally, or testing field mappings without network access.

**Usage:**
```bash
# Test entire external system
aifabrix test hubspot

# Test specific datasource only
aifabrix test hubspot --datasource hubspot-company

# Verbose output with detailed validation
aifabrix test hubspot --verbose
```

**Arguments:**
- `<app>` - Application name (external system)

**Options:**
- `-d, --datasource <key>` - Test specific datasource only
- `-v, --verbose` - Show detailed validation output

**Process:**
1. Loads and validates `variables.yaml` syntax
2. Loads and validates system JSON file(s) against `external-system.schema.json`
3. Loads and validates datasource JSON file(s) against `external-datasource.schema.json`
4. If `testPayload.payloadTemplate` exists in datasource:
   - Validates metadata schema against test payload
   - Tests field mapping expressions (mock transformer, no real API calls)
   - Compares with `expectedResult` if provided
5. Validates relationships (systemKey matches, entityKey consistency)
6. Returns structured test results

**Validation Checks:**
- JSON syntax validation
- Schema validation (external-system.schema.json, external-datasource.schema.json)
- Field mapping expression syntax validation:
  - Validates pipe-based DSL syntax: `{{path.to.field}} | toUpper | trim`
  - Ensures path is wrapped in `{{}}`
  - Validates transformation names (toUpper, toLower, trim, default, toNumber, etc.)
  - Checks for proper pipe separator `|`
- Metadata schema validation against test payload
- Required fields presence
- Relationship validation (systemKey, entityKey)

**Output (success):**
```yaml
🧪 Running unit tests for 'hubspot'...

✓ Application configuration is valid
✓ System configuration is valid (hubspot-deploy.json)
✓ Datasource configuration is valid (hubspot-deploy-company.json)
✓ Datasource configuration is valid (hubspot-deploy-contact.json)
✓ Datasource configuration is valid (hubspot-deploy-deal.json)

Field Mapping Tests:
  ✓ hubspot-company: All field mappings valid
  ✓ hubspot-contact: All field mappings valid
  ✓ hubspot-deal: All field mappings valid

Metadata Schema Tests:
  ✓ hubspot-company: Metadata schema valid against test payload
  ✓ hubspot-contact: Metadata schema valid against test payload
  ✓ hubspot-deal: Metadata schema valid against test payload

✅ All tests passed!
```

**Output (failure):**
```yaml
🧪 Running unit tests for 'hubspot'...

✓ Application configuration is valid
✓ System configuration is valid (hubspot-deploy.json)
✗ Datasource configuration has errors (hubspot-deploy-company.json):
  • Field mapping expression invalid: '{{properties.name.value | trim' (missing closing brace)
  • Metadata schema validation failed: Field 'country' not found in test payload

Field Mapping Tests:
  ✗ hubspot-company: 1 field mapping error(s)

❌ Tests failed!
```

**Test Payload Configuration:**
Test payloads are configured in datasource JSON files using the `testPayload` property:

```json
{
  "key": "hubspot-company",
  "testPayload": {
    "payloadTemplate": {
      "properties": {
        "name": { "value": "Acme Corp" },
        "country": { "value": "us" }
      }
    },
    "expectedResult": {
      "name": "Acme Corp",
      "country": "US"
    }
  }
}
```

**Issues:**
- **"App name is required"** → Provide application name as argument
- **"Application not found"** → Check application exists in `integration/<app>/`
- **"Validation failed"** → Fix errors reported in test output
- **"Test payload not found"** → Add `testPayload` to datasource configuration or use `--datasource` to test specific datasource
- **"Field mapping expression invalid"** → Check expression syntax: `{{path}} | transformation`

**Next Steps:**
After unit tests:
- Fix any validation errors
- Run integration tests: `aifabrix test-integration <app>`
- Deploy validated configuration: `aifabrix deploy <app>`

---

<a id="aifabrix-test-integration-app"></a>
## aifabrix test-integration <app>

Run integration tests via dataplane pipeline API.

**What:** Tests external system configuration by calling the dataplane pipeline test API. Validates field mappings, metadata schemas, and endpoint connectivity using real API calls. Requires dataplane access and authentication.

**When:** After unit tests pass, validating against real dataplane, or testing endpoint connectivity before deployment.

**Usage:**
```bash
# Test entire external system
aifabrix test-integration hubspot --environment dev

# Test specific datasource only
aifabrix test-integration hubspot --environment dev --datasource hubspot-company

# Use custom test payload file
aifabrix test-integration hubspot --environment dev --payload ./test-payload.json

# Verbose output with detailed results
aifabrix test-integration hubspot --environment dev --verbose

# Custom timeout
aifabrix test-integration hubspot --environment dev --timeout 60000
```

**Arguments:**
- `<app>` - Application name (external system)

**Options:**
- `-d, --datasource <key>` - Test specific datasource only
- `-p, --payload <file>` - Path to custom test payload file (overrides datasource testPayload)
- `-e, --environment <env>` - Environment (dev, tst, pro) (default: dev)
- `-c, --controller <url>` - Controller URL (optional)
- `-v, --verbose` - Show detailed test output
- `--timeout <ms>` - Request timeout in milliseconds (default: 30000)

**Prerequisites:**
- Must be logged in: `aifabrix login --method device --environment <env>`
- Dataplane must be accessible
- System must exist in dataplane (or be ready for testing)

**Process:**
1. Gets dataplane URL from controller
2. For each datasource (or specified one):
   - Loads test payload from datasource config (`testPayload.payloadTemplate`) or from `--payload` file
   - Calls dataplane pipeline API: `POST /api/v1/pipeline/{systemKey}/{datasourceKey}/test`
   - Request body: `{ "payloadTemplate": <testPayload> }`
   - Parses response with validation results, field mapping results, endpoint test results
3. Displays results for each datasource
4. Returns aggregated results

**Response Handling:**
- Parses `validationResults` (isValid, errors, warnings, normalizedMetadata)
- Parses `fieldMappingResults` (accessFields, mappedFields, mappingCount)
- Parses `endpointTestResults` (endpointConfigured, connectivity status)

**Output (success):**
```yaml
🧪 Running integration tests for 'hubspot' via dataplane...

🔐 Getting authentication...
✓ Authentication successful
🌐 Getting dataplane URL from controller...
✓ Dataplane URL: https://dataplane.aifabrix.ai

Testing datasource: hubspot-company
  ✓ Validation: passed
  ✓ Field mappings: 5 fields mapped successfully
  ✓ Endpoint connectivity: connected
  ✓ Metadata schema: valid

Testing datasource: hubspot-contact
  ✓ Validation: passed
  ✓ Field mappings: 8 fields mapped successfully
  ✓ Endpoint connectivity: connected
  ✓ Metadata schema: valid

Testing datasource: hubspot-deal
  ✓ Validation: passed
  ✓ Field mappings: 6 fields mapped successfully
  ✓ Endpoint connectivity: connected
  ✓ Metadata schema: valid

✅ All integration tests passed!
```

**Output (failure):**
```yaml
🧪 Running integration tests for 'hubspot' via dataplane...

🔐 Getting authentication...
✓ Authentication successful
🌐 Getting dataplane URL from controller...
✓ Dataplane URL: https://dataplane.aifabrix.ai

Testing datasource: hubspot-company
  ✗ Validation: failed
    • Field 'country' not found in payload
  ✗ Field mappings: 3 of 5 fields mapped successfully
  ✓ Endpoint connectivity: connected
  ✗ Metadata schema: invalid

❌ Integration tests failed!
```

**Test Payload:**
Test payloads can be:
1. From datasource configuration (`testPayload.payloadTemplate`)
2. From custom file (`--payload` flag)
3. Generated automatically if not provided (basic structure)

**Retry Logic:**
The command includes automatic retry logic for transient API failures:
- 3 retries with exponential backoff
- Retries on network errors, timeouts, and 5xx server errors

**Issues:**
- **"App name is required"** → Provide application name as argument
- **"Not logged in"** → Run `aifabrix login --method device --environment <env>` first
- **"Environment is required"** → Provide `--environment` flag (dev/tst/pro)
- **"Dataplane URL not found"** → Check controller configuration and network connection
- **"Test payload not found"** → Add `testPayload` to datasource configuration or use `--payload` flag
- **"API call failed"** → Check dataplane URL, authentication, and network connection
- **"Request timeout"** → Increase timeout with `--timeout` flag or check network connection
- **"Validation failed"** → Fix errors reported in test output

**Next Steps:**
After integration tests:
- Fix any validation or connectivity errors
- Re-run unit tests: `aifabrix test <app>`
- Deploy validated configuration: `aifabrix deploy <app>`

---

<a id="aifabrix-datasource"></a>
## aifabrix datasource

Manage external data sources.

**What:** Command group for managing external datasource configurations. Includes validation, listing, comparison, and deployment operations for datasources that integrate with external systems.

**Subcommands:**
- `validate` - Validate external datasource JSON file
- `list` - List datasources from environment
- `diff` - Compare two datasource configuration files
- `deploy` - Deploy datasource to dataplane

**When:** Managing external integrations, deploying datasource configurations, or validating datasource schemas.

**See Also:**
- [aifabrix datasource validate](#aifabrix-datasource-validate-file)
- [aifabrix datasource list](#aifabrix-datasource-list)
- [aifabrix datasource diff](#aifabrix-datasource-diff-file1-file2)
- [aifabrix datasource deploy](#aifabrix-datasource-deploy-myapp-file)

---

<a id="aifabrix-datasource-validate-file"></a>
### aifabrix datasource validate <file>

Validate external datasource JSON file.

**What:** Validates an external datasource JSON file against the external-datasource schema. Checks required fields, data types, and schema compliance.

**When:** Before deploying datasource, troubleshooting configuration issues, or validating schema changes.

**Usage:**
```bash
# Validate datasource file
aifabrix datasource validate ./schemas/hubspot-deal.json

# Validate with relative path
aifabrix datasource validate schemas/my-datasource.json
```

**Arguments:**
- `<file>` - Path to external datasource JSON file

**Process:**
1. Reads datasource JSON file
2. Parses JSON content
3. Loads external-datasource schema
4. Validates file against schema
5. Displays validation results

**Output (valid):**
```yaml
✓ Datasource file is valid: ./schemas/hubspot-deal.json
```

**Output (invalid):**
```yaml
✗ Datasource file has errors: ./schemas/hubspot-deal.json
  • Missing required field 'key'
  • Field 'systemKey' must be a string
  • Field 'version' must match pattern ^[0-9]+\.[0-9]+\.[0-9]+$
```

**Issues:**
- **"File path is required"** → Provide path to datasource file
- **"File not found: <path>"** → Check file path is correct
- **"Invalid JSON syntax"** → Fix JSON syntax errors in file
- **"Missing required field"** → Add required fields to datasource configuration

**Next Steps:**
After validation:
- Fix any validation errors
- Use `aifabrix datasource diff` to compare versions
- Deploy validated datasource: `aifabrix datasource deploy <app> <file>`

---

<a id="aifabrix-datasource-list"></a>
### aifabrix datasource list

List datasources from environment.

**What:** Lists all datasources registered in an environment via the Miso Controller API. Displays datasource key, display name, system key, version, and status.

**When:** Viewing available datasources, checking datasource status, or auditing environment configuration.

**Usage:**
```bash
# List datasources in environment
aifabrix datasource list --environment dev

# List datasources in production
aifabrix datasource list --environment pro
```

**Options:**
- `-e, --environment <env>` - Environment ID or key (required)

**Prerequisites:**
- Must be logged in: `aifabrix login --method device --environment <env>`

**Process:**
1. Gets authentication token from config
2. Calls controller API: `GET /api/v1/environments/{env}/datasources`
3. Extracts datasources from response
4. Displays datasources in formatted table

**Output:**
```yaml
📋 Datasources in environment: dev

Key                           Display Name                  System Key           Version         Status
------------------------------------------------------------------------------------------------------------------------
hubspot-deal                  HubSpot Deal                 hubspot              1.0.0           enabled
salesforce-contact            Salesforce Contact            salesforce           2.1.0           enabled
```

**Output (no datasources):**
```yaml
No datasources found in environment: dev
```

**Issues:**
- **"Not logged in"** → Run `aifabrix login --method device --environment <env>` first
- **"Environment is required"** → Provide `--environment` flag (miso/dev/tst/pro)
- **"Failed to list datasources"** → Check controller URL and network connection
- **"Invalid API response format"** → Controller API may have changed; check API version

**Next Steps:**
After listing:
- Validate datasource: `aifabrix datasource validate <file>`
- Deploy datasource: `aifabrix datasource deploy <app> <file>`
- Compare datasources: `aifabrix datasource diff <file1> <file2>`

---

<a id="aifabrix-datasource-diff-file1-file2"></a>
### aifabrix datasource diff <file1> <file2>

Compare two datasource configuration files.

**What:** Compares two datasource JSON files and highlights differences, with special focus on dataplane-relevant fields (fieldMappings, exposed fields, sync configuration, OpenAPI, MCP).

**When:** Before deploying datasource updates, validating schema migrations, or reviewing configuration changes for dataplane deployment.

**Usage:**
```bash
# Compare two datasource versions
aifabrix datasource diff ./schemas/hubspot-deal-v1.json ./schemas/hubspot-deal-v2.json

# Compare datasource configurations
aifabrix datasource diff ./old-datasource.json ./new-datasource.json
```

**Arguments:**
- `<file1>` - Path to first datasource file
- `<file2>` - Path to second datasource file

**Process:**
1. Compares files using standard diff logic
2. Identifies dataplane-relevant changes:
   - Field mappings changes
   - Exposed fields changes
   - Sync configuration changes
   - OpenAPI configuration changes
   - MCP configuration changes
3. Displays formatted diff with dataplane highlights

**Output:**
```yaml
Comparing: hubspot-deal-v1.json ↔ hubspot-deal-v2.json

Files are different

Version: 1.0.0 → 2.0.0

Added Fields:
  + fieldMappings.dealStage: "properties.dealstage"

Changed Fields:
  ~ exposed.fields:
    Old: ["dealname", "amount"]
    New: ["dealname", "amount", "dealstage"]
  ~ sync.interval:
    Old: 300
    New: 60

Summary:
  Added: 1
  Removed: 0
  Changed: 2
  Breaking: 0

📊 Dataplane-Relevant Changes:
  • Field Mappings: 1 changes
  • Exposed Fields: 1 changes
  • Sync Configuration: 1 changes
```

**Dataplane-Relevant Fields:**
- **fieldMappings** - Field mapping configuration changes
- **exposed** - Exposed fields changes
- **sync** - Sync configuration changes
- **openapi** - OpenAPI configuration changes
- **mcp** - MCP configuration changes

**Exit Codes:**
- **0** - Files are identical
- **1** - Files are different

**Issues:**
- **"File not found"** → Check file paths are correct
- **"Failed to parse"** → Fix JSON syntax errors in files
- **"Comparison failed"** → Check both files are valid datasource configurations

**Next Steps:**
After comparing:
- Review dataplane-relevant changes
- Validate new configuration: `aifabrix datasource validate <file2>`
- Deploy updated datasource: `aifabrix datasource deploy <app> <file2>`

---

<a id="aifabrix-datasource-deploy-myapp-file"></a>
### aifabrix datasource deploy <myapp> <file>

Deploy datasource to dataplane.

**What:** Validates and deploys an external datasource configuration to the dataplane via the Miso Controller. Gets dataplane URL from controller, then deploys datasource configuration.

**When:** Deploying new datasource, updating existing datasource, or pushing datasource configuration changes to dataplane.

**Usage:**
```bash
# Deploy datasource to dataplane
aifabrix datasource deploy myapp ./schemas/hubspot-deal.json \
  --controller https://controller.aifabrix.ai \
  --environment dev
```

**Arguments:**
- `<myapp>` - Application key
- `<file>` - Path to datasource JSON file

**Options:**
- `--controller <url>` - Controller URL (required)
- `-e, --environment <env>` - Environment (miso, dev, tst, pro) (required)

**Prerequisites:**
- Application must be registered: `aifabrix app register <myapp> --environment <env>`
- Must be logged in or have credentials in secrets.local.yaml
- Datasource file must be valid

**Process:**
1. Validates datasource file against schema
2. Loads datasource configuration
3. Extracts systemKey from configuration
4. Gets authentication (device token or client credentials)
5. Gets dataplane URL from controller API
6. Publishes datasource to dataplane:
   - POST to `http://<dataplane-url>/api/v1/pipeline/{systemKey}/publish`
   - Sends datasource configuration as request body
7. Displays deployment results

**Output:**
```yaml
📋 Deploying datasource...

🔍 Validating datasource file...
✓ Datasource file is valid
🔐 Getting authentication...
✓ Authentication successful
🌐 Getting dataplane URL from controller...
✓ Dataplane URL: https://dataplane.aifabrix.ai

🚀 Publishing datasource to dataplane...

✓ Datasource published successfully!

Datasource: hubspot-deal
System: hubspot
Environment: dev
```

**Issues:**
- **"Application key is required"** → Provide application key as first argument
- **"File path is required"** → Provide path to datasource file
- **"Controller URL is required"** → Provide `--controller` flag
- **"Environment is required"** → Provide `-e, --environment` flag
- **"File not found"** → Check datasource file path is correct
- **"Datasource validation failed"** → Fix validation errors in datasource file
- **"systemKey is required"** → Add systemKey field to datasource configuration
- **"Not logged in"** → Run `aifabrix login` first
- **"Failed to get application from controller"** → Check application is registered and controller URL is correct
- **"Dataplane URL not found"** → Application may not have dataplane configured
- **"Deployment failed"** → Check dataplane URL, authentication, and network connection

**Next Steps:**
After deployment:
- Verify datasource: `aifabrix datasource list --environment <env>`
- Check datasource status in controller dashboard
- Monitor dataplane for datasource activity

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

**What:** Creates `aifabrix-deploy.json` from variables.yaml, env.template, rbac.yaml for normal applications. For external type applications, generates `<app-name>-deploy.json` by loading the system JSON file and merging rbac.yaml (if present) into it. Also generates `application-schema.json` by combining external-system.schema.json, external-datasource.schema.json, and actual system/datasource JSON files (with rbac.yaml merged).

**When:** Previewing deployment configuration, debugging deployments. For external systems, before deploying to generate the combined application schema file. For external systems with RBAC, ensures roles/permissions from rbac.yaml are merged into the system JSON.

**Example (normal app):**
```bash
aifabrix json myapp
```

**Example (external system):**
```bash
aifabrix json hubspot
# Generates builder/hubspot/application-schema.json
```

**Creates:**
- Normal apps: `builder/<app>/aifabrix-deploy.json`
- External systems: `builder/<app>/<app-name>-deploy.json` (system JSON with rbac.yaml merged if present)
- External systems: `builder/<app>/application-schema.json` (combines schemas and JSON files with rbac.yaml merged)

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

**What:** Performs the reverse operation of `aifabrix json`. Reads a deployment JSON file (`<app-name>-deploy.json`) and extracts its components into separate files: `env.template`, `variables.yaml`, `rbac.yml`, and `README.md`. This enables migration of existing deployment JSON files back to the component file structure. For external systems, extracts roles/permissions from the system JSON into rbac.yml if present.

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
1. Locates `<app-name>-deploy.json` in the application directory
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
- **"Deployment JSON file not found"** → Ensure `<app-name>-deploy.json` exists in the application directory
- **"Invalid JSON syntax"** → Check that the deployment JSON file is valid JSON
- **"Output directory creation failed"** → Check permissions for the output directory

---

<a id="aifabrix-dockerfile-app"></a>
## aifabrix dockerfile <app>

Generate Dockerfile for an application.

**What:** Creates a Dockerfile from templates based on the application's language and configuration.

**When:** Before building an image, to review or customize the Dockerfile.

**Usage:**
```bash
# Generate Dockerfile (will fail if exists)
aifabrix dockerfile myapp

# Force overwrite existing Dockerfile
aifabrix dockerfile myapp --force

# Override language detection
aifabrix dockerfile myapp --language python
```

**Options:**
- `-l, --language <lang>` - Override language detection (typescript/python)
- `-f, --force` - Overwrite existing Dockerfile

**Process:**
1. Reads `builder/{app}/variables.yaml`
2. Detects language (TypeScript/Python)
3. Loads template from `templates/{language}/Dockerfile.hbs`
4. Generates Dockerfile with application-specific configuration
5. Saves to `builder/{app}/Dockerfile`

**Output:**
```yaml
✓ Generated Dockerfile from template
Location: builder/myapp/Dockerfile
```

**Issues:**
- **"Dockerfile already exists"** → Use `--force` flag to overwrite
- **"Failed to load configuration"** → Run `aifabrix create myapp` first
- **"Language not supported"** → Update variables.yaml with supported language

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

---

## aifabrix doctor

Check environment and configuration.

**What:** Validates Docker, ports, secrets, infrastructure status, configuration files.

**When:** Troubleshooting, first-time setup, environment verification.

**Example:**
```bash
aifabrix doctor
```

**Output:**
```yaml
✓ Docker is running
✓ Port 5432 available
✓ Port 6379 available
✓ Secrets file exists
✓ Infrastructure is running
  - Postgres: healthy
  - Redis: healthy
```

**Issues:** Shows problems and how to fix them.

---

## Common Workflows

### Local Development
```bash
# Start
aifabrix up
aifabrix create myapp
aifabrix build myapp
aifabrix run myapp

# After code changes
aifabrix build myapp
aifabrix run myapp

# View logs
docker logs aifabrix-myapp -f

# Stop
docker stop aifabrix-myapp
```

### Azure Deployment
```bash
# Build and push
aifabrix build myapp
aifabrix push myapp --registry myacr.azurecr.io --tag v1.0.0

# Deploy
aifabrix deploy myapp --controller https://controller.aifabrix.ai
```

### Troubleshooting
```bash
# Check everything
aifabrix doctor

# Regenerate files
aifabrix resolve myapp
aifabrix json myapp
aifabrix genkey myapp

# View configuration
cat builder/myapp/variables.yaml
cat builder/myapp/.env
cat builder/myapp/aifabrix-deploy.json
```

---

## Global Options

All commands support:

**`--help`** - Show help
```bash
aifabrix --help
aifabrix build --help
```

**`--version`** - Show version
```bash
aifabrix --version
```

**`--verbose`** - Detailed output
```bash
aifabrix build myapp --verbose
```

---

## Configuration (config.yaml)

Set these keys in `~/.aifabrix/config.yaml`:

- aifabrix-home: Base directory for local files (default `~/.aifabrix`)
  - Example: `aifabrix-home: "/custom/path"`
- aifabrix-secrets: Default secrets file path (default `<home>/secrets.yaml`)
  - Example: `aifabrix-secrets: "/path/to/secrets.yaml"`
- developer-id: Developer ID for port isolation (default: 0)
  - Example: `developer-id: 1` (sets ports to basePort + 100)
  - See [Developer Isolation](DEVELOPER-ISOLATION.md) for details

---

## Exit Codes

- **0** - Success
- **1** - General error
- **2** - Invalid arguments
- **3** - Docker not running
- **4** - Configuration invalid
- **5** - Build failed
- **6** - Deployment failed

**Use in scripts:**
```bash
if aifabrix build myapp; then
  echo "Build succeeded"
else
  echo "Build failed with exit code $?"
fi
```

---

## Getting Help

**Command help:**
```bash
aifabrix <command> --help
```

**Check environment:**
```bash
aifabrix doctor
```

**Documentation:**
- [Quick Start](QUICK-START.md)
- [Infrastructure](INFRASTRUCTURE.md)
- [Configuration](CONFIGURATION.md)
- [Building](BUILDING.md)
- [Running](RUNNING.md)
- [Deploying](DEPLOYING.md)
- [Developer Isolation](DEVELOPER-ISOLATION.md)
