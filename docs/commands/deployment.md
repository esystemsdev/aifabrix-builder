# Deployment Commands

← [Back to Commands Index](README.md) | [Back to Quick Start](../quick-start.md)

Commands for deploying applications and environments to Azure via Miso Controller.

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

This command uses the active `controller` from `config.yaml` (set via `aifabrix login` or `aifabrix auth config`).

**Example:**
```bash
# Deploy development environment
aifabrix environment deploy dev

# Deploy testing environment
aifabrix environment deploy tst

# Deploy production environment
aifabrix environment deploy pro

# Deploy miso environment
aifabrix environment deploy miso

# Using alias
aifabrix env deploy dev

# Without status polling
aifabrix environment deploy dev --no-poll
```

**Output:**
```yaml
📋 Deploying environment 'dev' to https://controller.aifabrix.dev...
✓ Environment validated
✓ Authentication successful

🚀 Deploying environment infrastructure...
📤 Sending deployment request to https://controller.aifabrix.dev/api/v1/environments/dev/deploy...
⏳ Polling deployment status (5000ms intervals)...

✅ Environment deployed successfully
   Environment: dev
   Status: ✅ ready
   URL: https://controller.aifabrix.dev/environments/dev
   
✓ Environment is ready for application deployments
```

**Configuration:**

The environment deploy command requires:
- Controller URL from `config.controller` (set via `aifabrix login` or `aifabrix auth config --set-controller`)
- Valid environment key (miso, dev, tst, pro) as the command argument
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
aifabrix environment deploy dev --no-poll

# With environment configuration file
aifabrix environment deploy dev --config ./env-config.yaml

# Skip validation checks
aifabrix environment deploy dev --skip-validation
```

**Flags:**
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
   aifabrix environment deploy dev
   ```

2. **Deploy Applications** (second)
   ```bash
   aifabrix deploy myapp
   ```

   Controller and environment come from `config.yaml` (set via `aifabrix login` or `aifabrix auth config`).

**Issues:**
- **"Environment key is required"** → Provide environment key as argument (miso, dev, tst, pro)
- **"Invalid environment key"** → Environment must be one of: miso, dev, tst, pro
- **"Controller URL is required"** → Run `aifabrix login` or `aifabrix auth config --set-controller <url>`
- **"Controller URL must use HTTPS"** → Use `https://` when setting controller
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

**What:** Generates deployment manifest from variables.yaml, env.template, and rbac.yaml. Automatically retrieves or refreshes authentication token, validates configuration, and sends to Miso Controller API for Azure deployment. Polls deployment status by default to track progress. For external type applications, uses the same normal deployment flow with `<systemKey>-deploy.json` (generated by `aifabrix json` or `aifabrix build`).

**When:** Deploying to Azure after pushing images to ACR. For external systems, after generating `<systemKey>-deploy.json` with `aifabrix json` or `aifabrix build`.

This command uses the active `controller` and `environment` from `config.yaml` (set via `aifabrix login` or `aifabrix auth config`).

**Example:**
```bash
# Basic deployment (uses controller and environment from config)
aifabrix deploy myapp

# Switch environment first if needed
aifabrix auth config --set-environment pro
aifabrix deploy myapp

# External system deployment (uses <systemKey>-deploy.json)
aifabrix deploy hubspot
```

**Output:**
```yaml
📋 Generating deployment manifest for myapp...
✓ Manifest generated: builder/myapp/aifabrix-deploy.json
   Key: myapp
   Display Name: My Application
   Image: myacr.azurecr.io/myapp:latest
   Port: 3000

🚀 Deploying to https://controller.aifabrix.dev (environment: miso)...
📤 Sending deployment request to https://controller.aifabrix.dev/api/v1/pipeline/miso/deploy...
⏳ Polling deployment status (5000ms intervals)...

✅ Deployment initiated successfully
   URL: https://myapp.aifabrix.dev
   Deployment ID: deploy-abc123
   Status: ✅ completed
```

**Configuration:**  
Controller and environment come from `config.yaml` (set via `aifabrix login` or `aifabrix auth config`). Then run:
```bash
aifabrix deploy myapp
```

**Authentication:**

The deploy command automatically:
1. Gets controller and environment from `~/.aifabrix/config.yaml`
2. Retrieves client token from config.yaml for current environment + app
3. If token missing or expired:
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

# Deploy to specific environment: set it first, then deploy
aifabrix auth config --set-environment pro
aifabrix deploy myapp

# Deploy with explicit client credentials (overrides config)
aifabrix deploy myapp --client-id my-client-id --client-secret my-secret
```

**Flags:**
- `--client-id <id>` - Client ID (overrides config)
- `--client-secret <secret>` - Client Secret (overrides config)
- `--poll` - Poll for deployment status (default: true)
- `--no-poll` - Do not poll for status

**Process:**
1. Validates app name format
2. Loads variables.yaml from `builder/<app>/`
3. Gets controller and environment from config.yaml
4. Retrieves or refreshes client token for environment + app
5. Loads env.template and parses environment variables
6. Loads rbac.yaml for roles and permissions
7. Generates deployment manifest
8. Validates manifest (checks required fields, format)
9. Sends deployment request to controller API with Bearer token authentication
10. Polls deployment status (if enabled)
11. Displays deployment results

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
- **"Controller URL is required"** → Run `aifabrix login` or `aifabrix auth config --set-controller <url>`
- **"Controller URL must use HTTPS"** → Use `https://` when setting controller
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
Use `aifabrix deploy <app> --poll` to monitor deployment status, or access the controller dashboard at `https://controller.aifabrix.dev/deployments`.

