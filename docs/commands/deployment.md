# Deployment Commands

← [Documentation index](../README.md) · [Commands index](README.md)

Commands for deploying applications and environments via Miso Controller. The controller handles deployment to Azure (Container Apps) or local Docker based on the deployment type.

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

**Example (using registry from application.yaml):**
```bash
aifabrix push myapp --tag v1.0.0
```
Automatically uses registry configured in `builder/<app>/application.yaml`:
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
- `-r, --registry <url>` - ACR registry URL (overrides application.yaml)
- `-t, --tag <tag>` - Image tag(s) - comma-separated for multiple (default: latest)

**Registry Resolution:**
1. `--registry` flag (highest priority)
2. `image.registry` in `application.yaml`
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
- **"Registry URL is required"** → Provide via `--registry` flag or configure in `application.yaml`
- **"Permission denied"** → Check ACR permissions and Azure role assignments
- **"Failed to push image"** → Check network connectivity, registry accessibility, and image size limits

---

<a id="aifabrix-environment-deploy-env"></a>
## aifabrix environment deploy <env>

Deploy/setup environment in Miso Controller. Requires Controller permission **controller:deploy**. See [Online Commands and Permissions](permissions.md).

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

# With size preset (default is s)
aifabrix env deploy dev --preset s
aifabrix env deploy dev --preset m
aifabrix env deploy dev --preset xl

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

# Size preset (s, m, l, xl); default is s when no --config is used
aifabrix env deploy dev --preset s
aifabrix env deploy dev --preset m

# With environment configuration file (overrides preset)
aifabrix environment deploy dev --config ./env-config.json

# Skip validation checks
aifabrix environment deploy dev --skip-validation
```

**Flags:**
- `--config <file>` - Environment configuration file (optional). If omitted, deployment uses `--preset` (default: s).
- `--preset <size>` - Environment size preset: `s`, `m`, `l`, `xl` (default: `s`). Used when `--config` is not provided. Case-insensitive.
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

Deploy application via Miso Controller. Requires Controller permission **applications:deploy** (pipeline validate + deploy). See [Online Commands and Permissions](permissions.md).

**What:** Generates deployment manifest from application.yaml, env.template, and rbac.yaml, retrieves or refreshes authentication token, validates configuration, and sends to Miso Controller API. The **controller** then handles the actual deployment:
- **Azure deployments:** Controller deploys to Azure Container Apps (for production/cloud environments)
- **Local Docker deployments:** Controller runs the application in Docker containers locally (for localhost/development environments)

The builder CLI only sends the deployment manifest (e.g. `builder/<app>/<appKey>-deploy.json` for regular apps) to the controller; the controller determines the deployment target based on the deployment type and executes the deployment accordingly. Polls deployment status by default to track progress. For external type applications, uses the same normal deployment flow with `<systemKey>-deploy.json` (generated by `aifabrix json` or `aifabrix build`).

With `--local`, the command sends the deployment manifest to the controller (same as default), then:
- **Apps (builder/):** Runs the application locally (same as `aifabrix run <app>`).
- **External systems (integration/):** Restarts the dataplane container so the dataplane picks up the new integration (`aifabrix restart dataplane`).

**When:** Deploying applications after pushing images to ACR (for Azure) or after building images locally (for local Docker). For external systems, after generating `<systemKey>-deploy.json` with `aifabrix json` or `aifabrix build`. Use `--local` when you want to deploy to the controller and then run the app locally (apps) or restart dataplane (external systems). For external systems, after deploy (or upload), MCP/OpenAPI docs are served by the dataplane—see [Controller and Dataplane: What, Why, When](../deploying.md#controller-and-dataplane-what-why-when).

This command uses the active `controller` and `environment` from `config.yaml` (set via `aifabrix login` or `aifabrix auth config`).

**Example:**
```bash
# Basic deployment (uses controller and environment from config)
aifabrix deploy myapp

# Switch environment first if needed
aifabrix auth config --set-environment pro
aifabrix deploy myapp

# External system in integration/<app> (resolved first; no app register needed)
aifabrix deploy test-e2e-hubspot

# Send manifest to controller, then run app locally (apps) or restart dataplane (external)
aifabrix deploy myapp --local
```

**Output (Azure Controller - Production Deployment):**
```yaml
📋 Generating deployment manifest for myapp...
✓ Manifest generated: builder/myapp/myapp-deploy.json
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
   
   Controller deployed application to Azure Container Apps
```

**Output (Localhost Controller - Local Docker Deployment):**
```yaml
📋 Generating deployment manifest for myapp...
✓ Manifest generated: builder/myapp/myapp-deploy.json
   Key: myapp
   Display Name: My Application
   Image: myapp:latest
   Port: 3000

🚀 Deploying to http://localhost:3000 (environment: dev)...
📤 Sending deployment request to http://localhost:3000/api/v1/pipeline/dev/deploy...
⏳ Polling deployment status (5000ms intervals)...

✅ Deployment initiated successfully
   Deployment ID: deploy-abc123
   Status: ✅ completed
   
   Controller deployed application to local Docker container
   Container: aifabrix-myapp
   Health check: http://localhost:3000/health
```

**Configuration:**  
Controller and environment come from `config.yaml` (set via `aifabrix login` or `aifabrix auth config`). Then run:
```bash
aifabrix deploy myapp
```

**Authentication:**

When you are **logged in** (device token or client token), the CLI uses **only your Bearer token**: it does **not** send client ID or client secret. The CLI validates that your token is valid with the controller before sending the deployment request. If the token is invalid or expired, you are prompted to run `aifabrix login` again. When no token is available, the CLI falls back to client credentials (from `~/.aifabrix/secrets.local.yaml` or `--client-id` / `--client-secret`) and sends client ID and secret for pipeline validate/deploy.

The deploy command automatically:
1. Gets controller and environment from `~/.aifabrix/config.yaml`
2. Tries authentication in this order:
   - **Device token** (from `aifabrix login --method device`): uses Bearer token only; no client ID/secret sent. Token is validated before deploy.
   - **Client token** (from `aifabrix login --method credentials`): uses Bearer token only; no client ID/secret sent. Token is validated before deploy.
   - **Client credentials** (fallback): reads clientId/secret from `~/.aifabrix/secrets.local.yaml` (or `--client-id` / `--client-secret`), obtains a token or sends credentials for pipeline validate/deploy.
3. If using a Bearer token: validates token with the controller; if invalid, errors with instructions to run `aifabrix login`.
4. Sends deployment request (Bearer header only when token auth; client id/secret only when credentials fallback).

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
- `--local` - Send manifest to controller, then for apps run locally (same as `aifabrix run <app>`), for external systems restart dataplane (`aifabrix restart dataplane`)
- `--client-id <id>` - Client ID (overrides config)
- `--client-secret <secret>` - Client Secret (overrides config)
- `--poll` - Poll for deployment status (default: true)
- `--no-poll` - Do not poll for status

**App path resolution:** The command always resolves the app by checking **`integration/<app>`** first, then **`builder/<app>`**. If neither exists, it errors. There is no option to override this order. External deployments (when the resolved path is in `integration/`) do not require `aifabrix app register`; the controller creates and deploys the application automatically.

**Process:**
1. Validates app name format
2. Resolves app path: `integration/<app>` first, then `builder/<app>`; if neither exists, errors. If the resolved app is in `integration/`: external deployment flow (validate → manifest → deploy; no app register).
3. Gets controller and environment from config.yaml
4. Gets or refreshes authentication: device token or client token (Bearer only; no client ID/secret sent) or, if no token, client credentials from secrets or flags.
5. When using Bearer token: validates token with controller; if invalid, errors with instructions to run `aifabrix login`.
6. Loads env.template and parses environment variables
7. Loads rbac.yaml for roles and permissions
8. Generates deployment manifest (e.g. `builder/<app>/<appKey>-deploy.json`)
9. Validates manifest (checks required fields, format)
10. Sends deployment request to controller API (Bearer token or client credentials; when Bearer, no client ID/secret in request body)
11. **Controller receives manifest and:**
    - Determines deployment type (Azure or local Docker)
    - For Azure: Deploys to Azure Container Apps
    - For local: Runs Docker container with parameters from manifest
12. Polls deployment status (if enabled)
13. Displays deployment results

When you are logged in (e.g. `aifabrix auth status` shows "Authenticated"), the pipeline validate and deploy requests use only the `Authorization: Bearer <token>` header; client ID and client secret are not sent.

**Generated Manifest Format:**
```json
{
  "key": "myapp",
  "displayName": "My Application",
  "description": "Application description",
  "type": "webapp",
  "port": 3000,
  "image": "myacr.azurecr.io/myapp:latest",
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
- **"Validation failed"** → Check `builder/<app>/<appKey>-deploy.json` for missing required fields
- **"Deployment key mismatch"** → Regenerate manifest: `aifabrix json <app>`
- **"Authentication failed"** / **"Your authentication token is invalid or expired"** → Run `aifabrix login` again (e.g. `aifabrix login --method device --controller <url>`). When using Bearer token, client ID/secret are not sent; ensure you are logged in.
- **"Invalid deployment manifest"** → Check configuration in application.yaml
- **"Can't reach controller"** → Check URL, network connection, firewall
- **"Request timed out"** → Controller may be overloaded, try again later
- **"Deployment timeout"** → Check controller logs, deployment may be in progress

---

<a id="aifabrix-credential-list"></a>
## aifabrix credential list

List credentials from the controller/dataplane (`GET /api/v1/credential`). Use this to see available credentials when choosing "Use existing" in the wizard (Step 3).

**Example:**
```bash
aifabrix credential list
aifabrix credential list --active-only --page-size 50
```

**Options:** `--controller <url>`, `--active-only`, `--page-size <n>` (default 50).

---

<a id="aifabrix-deployment-list"></a>
## aifabrix deployment list

List **environment deployments** for the current environment (paginated; default page size 50). Returns both application and infrastructure deployments for that environment. Uses `GET /api/v1/environments/{envKey}/deployments`.

**Example:**
```bash
aifabrix deployment list
aifabrix deployment list --environment dev --page-size 50
```

**Options:** `--controller <url>`, `--environment <env>`, `--page-size <n>` (default 50).

---

<a id="aifabrix-app-deployment-appkey"></a>
## aifabrix app deployment <appKey>

List last N deployments for a specific application in the current environment (default pageSize=50). Uses `GET /api/v1/environments/{envKey}/applications/{appKey}/deployments`.

**Example:**
```bash
aifabrix app deployment myapp
aifabrix app deployment myapp --page-size 50
```

**Options:** `--controller <url>`, `--environment <env>`, `--page-size <n>` (default 50).

