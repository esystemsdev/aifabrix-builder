# CLI Reference

Complete command reference with examples and troubleshooting.

---

## Table of Contents

### Authentication & Setup
- [aifabrix login](#aifabrix-login) - Authenticate with Miso Controller
- [aifabrix up](#aifabrix-up) - Start infrastructure (Postgres + Redis)
- [aifabrix down](#aifabrix-down) - Stop infrastructure
- [aifabrix doctor](#aifabrix-doctor) - Check environment and configuration

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

### Additional Resources
- [Common Workflows](#common-workflows) - Typical usage patterns
- [Global Options](#global-options) - Command-line options available to all commands
- [Environment Variables](#environment-variables) - Configuration via environment
- [Exit Codes](#exit-codes) - Command exit code reference
- [Getting Help](#getting-help) - Where to find more information

---

## aifabrix login

Authenticate with Miso Controller.

**What:** Logs in to the controller and stores authentication token for subsequent operations.

**When:** First time using the CLI, when token expires, or when switching controllers.

**Usage:**
```bash
# Login with default localhost:3000 (interactive prompts)
aifabrix login

# Login with custom controller URL
aifabrix login --url https://controller.aifabrix.ai

# CI/CD: Login with credentials method
aifabrix login --url http://localhost:3010 --method credentials --client-id $CLIENT_ID --client-secret $CLIENT_SECRET

# CI/CD: Login with device code flow
aifabrix login --url http://localhost:3010 --method device --environment dev
```

**Options:**
- `-u, --url <url>` - Controller URL (default: http://localhost:3000)
- `-m, --method <method>` - Authentication method: `device` or `credentials` (optional, prompts if not provided)
- `--client-id <id>` - Client ID for credentials method (optional, prompts if not provided)
- `--client-secret <secret>` - Client Secret for credentials method (optional, prompts if not provided)
- `-e, --environment <env>` - Environment key for device method (e.g., dev, tst, pro) (optional, prompts if not provided)

**Authentication Methods:**

1. **ClientId + ClientSecret**
   - Use `--method credentials` with `--client-id` and `--client-secret` flags
   - If flags not provided, prompts for credentials interactively
   - Useful for CI/CD or non-interactive environments

2. **Device Code Flow (environment only)**
   - Use `--method device` with `--environment` flag
   - If `--environment` not provided, prompts interactively
   - Authenticate with only an environment key
   - No client credentials required
   - Useful for initial setup before application registration
   - Follows OAuth2 Device Code Flow (RFC 8628)

**Output:**
```
✓ Successfully logged in!
Controller: http://localhost:3000
Token stored securely in ~/.aifabrix/config.yaml
```

**Device Code Flow Example:**

With flags (CI/CD):
```bash
aifabrix login --url http://localhost:3010 --method device --environment dev
```

Interactive (prompts for environment):
```bash
aifabrix login --url http://localhost:3010 --method device
# Prompts: Environment key (e.g., dev, tst, pro): dev
```

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
Controller: http://localhost:3000
Token stored securely in ~/.aifabrix/config.yaml
```

**Device Code Flow Steps:**

1. CLI initiates device code flow with environment key
2. Display user code and verification URL
3. User visits URL and enters code in browser
4. User approves request in browser
5. CLI polls for token (automatically)
6. Token is saved to configuration

**CI/CD Usage Examples:**

```bash
# GitHub Actions / Azure DevOps
aifabrix login \
  --url ${{ secrets.MISO_CONTROLLER_URL }} \
  --method credentials \
  --client-id ${{ secrets.MISO_CLIENT_ID }} \
  --client-secret ${{ secrets.MISO_CLIENTSECRET }}

# Device code flow in CI/CD (if environment key is available)
aifabrix login \
  --url $CONTROLLER_URL \
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
- **"Environment key must contain only letters, numbers, hyphens, and underscores"** → Use valid environment format (e.g., dev, tst, pro)

**Next Steps:**
After logging in, you can:
- Register applications: `aifabrix app register`
- Deploy applications: `aifabrix deploy`

---

## aifabrix up

Start infrastructure (Postgres + Redis).

**What:** Starts PostgreSQL, Redis, pgAdmin, and Redis Commander in Docker.

**When:** First time setup, after system restart, when infrastructure is down.

**Example:**
```bash
aifabrix up
```

**Output:**
```
✓ Starting Postgres...
✓ Starting Redis...
✓ Infrastructure ready
  Postgres: localhost:5432
  Redis: localhost:6379
  pgAdmin: http://localhost:5050
  Redis Commander: http://localhost:8081
```

**Issues:**
- **"Port 5432 already in use"** → Stop other Postgres: `docker stop <container>`
- **"Docker not running"** → Start Docker Desktop
- **"Permission denied"** → Add user to docker group (Linux)

---

## aifabrix down

Stop infrastructure.

**What:** Stops all infrastructure containers. Data is preserved in volumes.

**When:** Shutting down, freeing resources, before system maintenance.

**Example:**
```bash
aifabrix down
```

**Delete all data:**
```bash
aifabrix down --volumes
```

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

## aifabrix app

Application management commands for registering and managing applications with the Miso Controller.

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
   MISO_CLIENT_ID = ctrl-dev-myapp
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
aifabrix app rotate-secret --app myapp --environment dev
```

**Options:**
- `-a, --app <appKey>` - Application key (required)
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
- **"Environment is required"** → Provide `--environment` flag (dev/tst/pro)
- **"Rotation failed"** → Check application key and permissions

---

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

**Issues:**
- **"Docker not running"** → Start Docker Desktop
- **"Build failed"** → Check Dockerfile syntax, dependencies
- **"Permission denied"** → Fix Docker permissions

---

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

## aifabrix deploy <app>

Deploy to Azure via Miso Controller.

**What:** Generates deployment manifest from variables.yaml, env.template, and rbac.yaml. Creates deployment key for authentication, validates configuration, and sends to Miso Controller API for Azure deployment. Polls deployment status by default to track progress.

**When:** Deploying to Azure after pushing images to ACR.

**Example:**
```bash
# Basic deployment
aifabrix deploy myapp --controller https://controller.aifabrix.ai
```

**Output:**
```
📋 Generating deployment manifest for myapp...
✓ Manifest generated: builder/myapp/aifabrix-deploy.json
   Key: myapp
   Display Name: My Application
   Image: myacr.azurecr.io/myapp:latest
   Port: 3000

🚀 Deploying to https://controller.aifabrix.ai...
📤 Sending deployment request to https://controller.aifabrix.ai...
✓ Already authenticated with myacr.azurecr.io
⏳ Polling deployment status (5000ms intervals)...

✅ Deployment initiated successfully
   URL: https://myapp.aifabrix.ai
   Deployment ID: deploy-abc123
   Status: ✅ completed
```

**With environment and credentials:**
```bash
aifabrix deploy myapp --controller https://controller.aifabrix.ai --environment dev --client-id my-client-id --client-secret my-secret
```

**Configuration in variables.yaml (recommended):**
```yaml
deployment:
  controllerUrl: 'https://controller.aifabrix.ai'
  environment: 'dev'
  clientId: 'your-client-id'
  clientSecret: 'your-client-secret'
```

Then simply run:
```bash
aifabrix deploy myapp
```

**Advanced options:**
```bash
# Without status polling
aifabrix deploy myapp --no-poll

# Override credentials from command line
aifabrix deploy myapp --client-id override-id --client-secret override-secret
```

**Flags:**
- `-c, --controller <url>` - Controller URL (overrides variables.yaml)
- `-e, --environment <env>` - Environment (dev, tst, pro) (default: dev)
- `--client-id <id>` - Client ID for authentication (overrides variables.yaml)
- `--client-secret <secret>` - Client Secret for authentication (overrides variables.yaml)
- `--poll` - Poll for deployment status (default: true)
- `--no-poll` - Do not poll for status

**Process:**
1. Validates app name format
2. Loads variables.yaml from `builder/<app>/`
3. Loads env.template and parses environment variables
4. Loads rbac.yaml for roles and permissions
5. Extracts controller URL, environment, clientId, and clientSecret from variables.yaml
6. Overrides with command-line options if provided
7. Validates all required configuration (URL, environment, credentials)
8. Generates deployment manifest
9. Validates manifest (checks required fields, format)
10. Sends deployment request to controller API with Client Credentials authentication
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
- **"Validation failed"** → Check `aifabrix-deploy.json` for missing required fields
- **"Deployment key mismatch"** → Regenerate: `aifabrix genkey <app>`
- **"Authentication failed"** → Check deployment key is valid
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

## Environment Variables

**AIFABRIX_HOME**  
Override default home directory  
Default: `~/.aifabrix`

**AIFABRIX_SECRETS**  
Override secrets file location  
Default: `~/.aifabrix/secrets.yaml`

**Example:**
```bash
export AIFABRIX_HOME=/custom/path
export AIFABRIX_SECRETS=/path/to/secrets.yaml
aifabrix build myapp
```

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
