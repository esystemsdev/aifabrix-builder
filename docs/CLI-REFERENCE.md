# CLI Reference

← [Back to Quick Start](QUICK-START.md)

Complete command reference with examples and troubleshooting.

---

## Table of Contents

### Authentication & Setup
- [aifabrix login](#aifabrix-login) - Authenticate with Miso Controller
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
- [aifabrix deploy](#aifabrix-deploy-app) - Deploy to Azure via Miso Controller
- [aifabrix deployments](#aifabrix-deployments) - List deployments for an environment

### Utilities
- [aifabrix resolve](#aifabrix-resolve-app) - Generate `.env` file from template
- [aifabrix json](#aifabrix-json-app) - Generate deployment JSON
- [aifabrix genkey](#aifabrix-genkey-app) - Generate deployment key
- [aifabrix secure](#aifabrix-secure) - Encrypt secrets in secrets.local.yaml files

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
```

**Options:**
- `-c, --controller <url>` - Controller URL (default: http://localhost:3000)
- `-m, --method <method>` - Authentication method: `device` or `credentials` (optional, prompts if not provided)
- `-a, --app <app>` - Application name (required for credentials method, reads from secrets.local.yaml using pattern `<app-name>-client-idKeyVault`)
- `--client-id <id>` - Client ID for credentials method (optional, overrides secrets.local.yaml)
- `--client-secret <secret>` - Client Secret for credentials method (optional, overrides secrets.local.yaml)
- `-e, --environment <env>` - Environment key (updates root-level environment in config.yaml, e.g., miso, dev, tst, pro)

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
   - No client credentials required
   - Useful for initial setup before application registration
   - Follows OAuth2 Device Code Flow (RFC 8628)
   - Token is saved at root level in config.yaml, keyed by controller URL (universal per controller)
   - Includes refresh token for automatic token renewal on 401 errors

**Output (Credentials):**
```
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
```
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
```
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
```
✓ Starting Postgres...
✓ Starting Redis...
✓ Infrastructure ready
  Postgres: localhost:5432
  Redis: localhost:6379
  pgAdmin: http://localhost:5050
  Redis Commander: http://localhost:8081
```

**Output (with developer ID):**
```
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
```
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
```
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
```
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
```
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
```
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
```
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
```

**Arguments:**
- `<appKey>` - Application key (identifier)

**Options:**
- `-e, --environment <env>` - Environment ID or key (required)
- `-p, --port <port>` - Override application port
- `-n, --name <name>` - Override display name
- `-d, --description <desc>` - Override description

**Process:**
1. Reads `builder/{appKey}/variables.yaml`
2. If missing, creates minimal configuration automatically
3. Validates required fields
4. Registers with Miso Controller
5. Returns ClientId and ClientSecret
6. **Note:** Credentials are displayed but not automatically saved. Copy them to your secrets file or GitHub Secrets.

**Output:**
```
✓ Application registered successfully!

📋 Application Details:
   ID:           app-123
   Key:          myapp
   Display Name: My App

🔑 CREDENTIALS (save these immediately):
   Client ID:     ctrl-dev-myapp
   Client Secret: x7K9mP2nQ4vL8wR5tY1uE3oA6sD9fG2hJ4kM7pN0qT5

⚠️  IMPORTANT: Client Secret will not be shown again!

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
```

**Options:**
- `-e, --environment <env>` - Environment ID or key (required)

**Output:**
```
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

**What:** Generates a new ClientSecret, invalidating the old one. Use when credentials are compromised or need rotation.

**Usage:**
```bash
aifabrix app rotate-secret myapp --environment dev
```

**Arguments:**
- `<appKey>` - Application key (required, positional)

**Options:**
- `-e, --environment <env>` - Environment ID or key (required)

**Output:**
```
⚠️  This will invalidate the old ClientSecret!

✓ Secret rotated successfully!

📋 Application Details:
   Key:         myapp
   Environment: dev

🔑 NEW CREDENTIALS:
   Client ID:     ctrl-dev-myapp
   Client Secret: new-secret-789

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

**Flags:**
- `-p, --port <port>` - Application port (default: 3000)
- `-d, --database` - Requires database
- `-r, --redis` - Requires Redis
- `-s, --storage` - Requires file storage
- `-a, --authentication` - Requires authentication/RBAC
- `-l, --language <lang>` - typescript or python
- `-t, --template <name>` - Template to use (e.g., miso-controller, keycloak). Template folder must exist in `templates/{template}/`
- `--app` - Generate minimal application files (package.json, index.ts or requirements.txt, main.py)
- `-g, --github` - (Optional) Generate GitHub Actions workflows
- `--github-steps <steps>` - Extra GitHub workflow steps (comma-separated, e.g., `npm`). Step templates must exist in `templates/github/steps/{step}.hbs`. When included, these steps are rendered and injected into workflow files (e.g., `release.yaml`). Available step templates: `npm.hbs` (adds NPM publishing job)
- `--main-branch <branch>` - Main branch name for workflows (default: main)

**Creates:**
- `builder/<app>/variables.yaml` - Application configuration
- `builder/<app>/env.template` - Environment template with kv:// references
- `builder/<app>/rbac.yaml` - RBAC configuration (if authentication enabled)
- `builder/<app>/aifabrix-deploy.json` - Deployment manifest
- `builder/<app>/README.md` - Application documentation
- `.github/workflows/` - GitHub Actions workflows (if --github specified)

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

---

<a id="aifabrix-build-app"></a>
## aifabrix build <app>

Build Docker image.

**What:** Detects language, generates/uses Dockerfile, builds image, creates `.env`.

**When:** After code changes, first build, when Dockerfile needs regeneration.

**Example:**
```bash
aifabrix build myapp
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
6. Generates Docker Compose configuration
7. Starts container with proper networking
8. Waits for health check to pass
9. Displays access URL

**Access:** http://localhost:<port>

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
```
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
- **"Azure CLI is not installed"** → Install from: https://docs.microsoft.com/cli/azure/install-azure-cli
- **"Authentication failed"** → Run: `az login` then `az acr login --name myacr`
- **"Docker image not found locally"** → Build first: `aifabrix build myapp`
- **"Invalid registry URL format"** → Use format: `*.azurecr.io` (e.g., `myacr.azurecr.io`)
- **"Registry URL is required"** → Provide via `--registry` flag or configure in `variables.yaml`
- **"Permission denied"** → Check ACR permissions and Azure role assignments
- **"Failed to push image"** → Check network connectivity, registry accessibility, and image size limits

---

<a id="aifabrix-deploy-app"></a>
## aifabrix deploy <app>

Deploy to Azure via Miso Controller.

**What:** Generates deployment manifest from variables.yaml, env.template, and rbac.yaml. Automatically retrieves or refreshes authentication token, validates configuration, and sends to Miso Controller API for Azure deployment. Polls deployment status by default to track progress.

**When:** Deploying to Azure after pushing images to ACR.

**Example:**
```bash
# Basic deployment (uses current environment from config.yaml and token from login)
aifabrix deploy myapp --controller https://controller.aifabrix.ai

# Deploy to specific environment (updates root-level environment in config.yaml)
aifabrix deploy myapp --controller https://controller.aifabrix.ai --environment miso
```

**Output:**
```
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
```

**Flags:**
- `-c, --controller <url>` - Controller URL (overrides variables.yaml)
- `-e, --environment <env>` - Environment (miso, dev, tst, pro) - updates root-level environment in config.yaml if provided
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

**Flags:**
- `-f, --force` - Generate missing secret keys in secrets file

**Creates:** `builder/myapp/.env`

**Issues:**
- **"Secrets file not found"** → Create `~/.aifabrix/secrets.yaml`
- **"Missing kv:// reference"** → Add secret to secrets file or use `--force` to auto-generate
- **"Permission denied"** → Check file permissions on secrets.yaml

---

<a id="aifabrix-json-app"></a>
## aifabrix json <app>

Generate deployment JSON.

**What:** Creates `aifabrix-deploy.json` from variables.yaml, env.template, rbac.yaml.

**When:** Previewing deployment configuration, debugging deployments.

**Example:**
```bash
aifabrix json myapp
```

**Creates:** `builder/myapp/aifabrix-deploy.json`

**Issues:**
- **"Validation failed"** → Check configuration files for errors
- **"Missing required fields"** → Complete variables.yaml

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
```
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

**What:** Computes SHA256 hash of `variables.yaml` for controller authentication.

**When:** Checking deployment key, troubleshooting authentication.

**Example:**
```bash
aifabrix genkey myapp
```

**Output:**
```
Deployment key for myapp:
a1b2c3d4e5f6789abcdef1234567890abcdef1234567890abcdef1234567890ab

Generated from: builder/myapp/variables.yaml
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
```
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

## aifabrix doctor

Check environment and configuration.

**What:** Validates Docker, ports, secrets, infrastructure status, configuration files.

**When:** Troubleshooting, first-time setup, environment verification.

**Example:**
```bash
aifabrix doctor
```

**Output:**
```
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
