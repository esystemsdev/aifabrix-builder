# Deploying Applications

→ [Back to Quick Start](QUICK-START.md)

Deploy your application via [Azure Marketplace](https://azuremarketplace.microsoft.com/) or Miso Controller. Enterprise versions deploy to Azure Container Apps, while open source versions deploy to local Docker instances.

## Prerequisites

Before deploying:

1. **Miso Controller**
   - Running instance (or URL)
   - See [Install Miso Controller](INFRASTRUCTURE.md#install-miso-controller)

2. **Built Image**
   ```bash
   aifabrix build myapp
   ```

3. **Registered Application**
   - Run `aifabrix app register myapp --environment dev` to get pipeline credentials
   - Credentials are displayed (not automatically saved)
   - Copy credentials to GitHub Secrets for CI/CD

---

## Deployment Methods

### Method 1: Using AI Fabrix Builder SDK

```bash
# Push image to registry
aifabrix push myapp --registry myacr.azurecr.io --tag v1.0.0

# Deploy via controller
aifabrix deploy myapp --controller https://controller.aifabrix.ai
```

### Method 2: Automated CI/CD Deployment

For automated deployments using the Pipeline API, see [GitHub Workflows Guide](GITHUB-WORKFLOWS.md#pipeline-deployment-integration) for detailed workflow examples.

The pipeline API uses ClientId/ClientSecret authentication (from `aifabrix app register`), while regular controller APIs use bearer tokens (from `aifabrix login`).

---

## Enterprise vs Open Source

### Enterprise Version
- **Deployment Target**: Azure Container Apps
- **Features**: Full Azure integration, scaling, monitoring
- **Requirements**: Azure subscription, ACR access

### Open Source Version  
- **Deployment Target**: Local Docker instances
- **Features**: Basic container deployment
- **Requirements**: Docker running locally

---

## Step 1: Push to ACR

```bash
aifabrix push myapp --registry myacr.azurecr.io --tag v1.0.0
```

### What Happens

1. **Authenticates with Azure**
   - Uses Azure CLI credentials
   - Or prompts you to log in

2. **Tags image**
   ```
   myapp:latest → myacr.azurecr.io/myapp:v1.0.0
   ```

3. **Pushes to registry**
   - Uploads image layers
   - Verifies upload

### Output

```
✓ Authenticated with myacr.azurecr.io
✓ Tagged image: myacr.azurecr.io/myapp:v1.0.0
✓ Pushing...
✓ Push complete
```

### Multiple Tags

```bash
aifabrix push myapp --registry myacr.azurecr.io --tag "v1.0.0,latest,stable"
```

Tags: `v1.0.0`, `latest`, `stable`

---

## Step 2: Deploy via Controller

```bash
aifabrix deploy myapp --controller https://controller.aifabrix.ai
```

### What Happens

1. **Generates deployment manifest**
   - Creates `aifabrix-deploy.json`
   - Includes all configuration from variables.yaml, env.template, rbac.yaml

2. **Generates deployment key**
   - SHA256 hash of variables.yaml
   - Used for authentication and integrity check

3. **Sends to controller**
   - POST to `/api/v1/pipeline/{env}/deploy` (environment-aware endpoint)
   - Includes manifest + deployment key
   - Uses ClientId/ClientSecret authentication

4. **Controller processes**
   - Validates configuration
   - Checks deployment key
   - Deploys to Azure Container Apps
   - Configures database, Redis, networking
   - Sets up RBAC and permissions

### Output

```
✓ Generated deployment manifest
✓ Deployment key: a1b2c3d4...
✓ Sending to controller...
✓ Deployment started
✓ Status: https://controller.aifabrix.ai/deployments/12345
```

---

## Deployment Key

Unique key generated from your `variables.yaml` file.

### View Your Key

```bash
aifabrix genkey myapp
```

Output:
```
Deployment key for myapp:
a1b2c3d4e5f6789abcdef1234567890abcdef1234567890abcdef1234567890ab

Generated from: builder/myapp/variables.yaml
```

### Why It Exists

- **Authentication** - Controller verifies you own the config
- **Integrity** - Detects if config was modified
- **Security** - Prevents unauthorized deployments

### When It Changes

Key changes when `variables.yaml` changes. This is intentional - it means:
- New deployment is needed
- Configuration has been updated
- Old deployments can be traced

---

## Deployment Manifest

The `aifabrix-deploy.json` file sent to controller.

### View Your Manifest

```bash
aifabrix json myapp
```

Creates `builder/myapp/aifabrix-deploy.json`:
```json
{
  "key": "myapp",
  "displayName": "My Application",
  "image": "myacr.azurecr.io/myapp:v1.0.0",
  "port": 3000,
  "deploymentKey": "a1b2c3d4...",
  "configuration": [
    {
      "name": "DATABASE_URL",
      "value": "databases-0-urlKeyVault",
      "location": "keyvault",
      "required": true
    }
  ],
  "roles": [...],
  "permissions": [...]
}
```

### What's Included

- App metadata (key, name, description)
- Docker image reference
- Environment variables (kv:// references)
- Database requirements
- Redis/storage requirements
- RBAC configuration
- Health check settings
- Authentication settings

---

## Application Registration

Before deploying via pipeline API, you must register your application to get ClientId and ClientSecret credentials.

### Step 1: Login to Controller

```bash
aifabrix login --url https://controller.aifabrix.ai
```

This authenticates you via Keycloak OIDC flow.

### Step 2: Register Application

```bash
aifabrix app register myapp --environment dev
```

**Output:**
```
✓ Application registered successfully!

📋 Application Details:
   Key:          myapp
   Display Name: My Application
   Environment:  dev

🔑 CREDENTIALS (save these immediately):
   Client ID:     ctrl-dev-myapp
   Client Secret: xyz-abc-123...

⚠️  IMPORTANT: Client Secret will not be shown again!

📝 Add to GitHub Secrets:
   Repository level:
     AIFABRIX_API_URL = https://controller.aifabrix.ai
   
   Environment level (dev):
     DEV_AIFABRIX_CLIENT_ID = ctrl-dev-myapp
     DEV_AIFABRIX_CLIENT_SECRET = xyz-abc-123...
```

**Note:** Credentials are displayed but not automatically saved to a file. Copy them to GitHub Secrets manually.

### Step 3: Add to GitHub Secrets (CI/CD Only)

1. Go to repository Settings → Secrets and variables → Actions
2. Add repository-level secret:
   - `AIFABRIX_API_URL` - Controller URL (e.g., `https://controller.aifabrix.ai`)
3. Add environment-level secrets (for dev):
   - `DEV_AIFABRIX_CLIENT_ID` - From registration output
   - `DEV_AIFABRIX_CLIENT_SECRET` - From registration output
   
**Note:** For staging/production, use `TST_` or `PRO_` prefixes.

### Secret Rotation

To rotate your ClientSecret (use when credentials are compromised or need rotation):

```bash
aifabrix app rotate-secret --app myapp --environment dev
```

**Output:**
```
⚠️  This will invalidate the old ClientSecret!

✓ Secret rotated successfully!

📋 Application Details:
   Key:         myapp
   Environment: dev

🔑 NEW CREDENTIALS:
   Client ID:     ctrl-dev-myapp
   Client Secret: xyz-new-secret-789

⚠️  Old secret is now invalid. Update GitHub Secrets!
```

Updates credentials display. Copy the new credentials to `DEV_AIFABRIX_CLIENT_SECRET` in GitHub Secrets if using CI/CD.

## CI/CD Integration

### GitHub Actions Workflow

For automated CI/CD deployments, see [GitHub Workflows Guide](GITHUB-WORKFLOWS.md#integration-with-ai-fabrix) for detailed workflow examples.

**Basic workflow setup:**
1. Register application: `aifabrix app register myapp --environment dev`
2. Add secrets in GitHub repository settings (see [Application Registration](#application-registration))
3. Create workflow file in `.github/workflows/deploy.yaml`
4. Push code to trigger deployment

### GitLab CI

```yaml
deploy:
  stage: deploy
  image: node:20-alpine
  script:
    - npm install -g @aifabrix/builder
    - aifabrix build myapp
    - aifabrix push myapp --registry $ACR_REGISTRY --tag $CI_COMMIT_SHA
    - aifabrix deploy myapp --controller $CONTROLLER_URL
  only:
    - main
```

### Azure DevOps

```yaml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'
  
  - script: npm install -g @aifabrix/builder
    displayName: 'Install AI Fabrix Builder'
  
  - script: aifabrix build myapp
    displayName: 'Build Application'
  
  - script: |
      aifabrix push myapp \
        --registry $(ACR_REGISTRY) \
        --tag $(Build.BuildId)
    displayName: 'Push to ACR'
  
  - script: |
      aifabrix deploy myapp \
        --controller $(CONTROLLER_URL)
    displayName: 'Deploy to Azure'
```

---

## Environment-Specific Deployments

### Development
```bash
aifabrix deploy myapp \
  --controller https://dev-controller.aifabrix.ai \
  --environment dev
```

### Staging
```bash
aifabrix deploy myapp \
  --controller https://staging-controller.aifabrix.ai \
  --environment tst
```

### Production
```bash
aifabrix deploy myapp \
  --controller https://controller.aifabrix.ai \
  --environment pro
```

---

## Rollback

### Deploy Previous Version

```bash
# Push old version
aifabrix push myapp --registry myacr.azurecr.io --tag v0.9.0

# Deploy it
aifabrix deploy myapp --controller https://controller.aifabrix.ai
```

Controller deploys the image tag specified in variables.yaml:
```yaml
image:
  name: myapp
  tag: v0.9.0  # Change this
```

---

## Monitoring Deployments

### Check Deployments Using CLI

**Note:** The `aifabrix deployments` command is planned but not yet implemented. Deployment status is monitored during deployment using the `--poll` option of the `deploy` command.

**Current approach:**
```bash
# Deploy with status polling
aifabrix deploy myapp --controller https://controller.aifabrix.ai --poll

# Or check status via controller dashboard
# Visit: https://controller.aifabrix.ai/deployments
```

---

## Troubleshooting

### "ACR authentication failed"

**Fix:**
```bash
az acr login --name myacr
```

**Or set credentials:**
```bash
export AZURE_CREDENTIALS="..."
```

### "Push failed"

**Check image exists:**
```bash
docker images | grep myapp
```

**Check registry accessible:**
```bash
az acr repository list --name myacr
```

### "Controller validation failed"

**View manifest:**
```bash
aifabrix json myapp
cat builder/myapp/aifabrix-deploy.json
```

**Common issues:**
- Missing required fields
- Invalid environment variables
- Database names don't match

**Validate locally:**
```bash
aifabrix doctor
```

### "Deployment key mismatch"

**Regenerate key:**
```bash
aifabrix genkey myapp
```

**Cause:** `variables.yaml` changed since last deployment.

**Fix:** This is expected. New deployment with new configuration = new key.

### "Can't reach controller"

**Check authentication:**
```bash
aifabrix login --url https://controller.aifabrix.ai
```

This opens browser for Keycloak authentication. Token is stored in `~/.aifabrix/config` and auto-refreshes on subsequent commands.

**Check network:**
```bash
ping controller.aifabrix.ai
```

### "Authentication failed"

**Verify registration:**
```bash
aifabrix app register myapp --environment dev
```

**Check credentials in GitHub Secrets:**
- `DEV_AIFABRIX_CLIENT_ID` exists and is correct (for dev environment)
- `DEV_AIFABRIX_CLIENT_SECRET` exists and is correct
- `AIFABRIX_API_URL` points to correct controller (repository level)

**Common issues:**
- ClientSecret expired (rotate with `aifabrix app rotate-secret --app myapp --environment dev`)
- Wrong environment (dev/tst/pro)
- Invalid application configuration

---

## Best Practices

### Semantic Versioning

Use semantic versions for tags:
```bash
aifabrix push myapp --registry myacr.azurecr.io --tag v1.2.3
```

- **Major** (1.x.x): Breaking changes
- **Minor** (x.2.x): New features
- **Patch** (x.x.3): Bug fixes

### Tag Strategies

**Git commit SHA:**
```bash
aifabrix push myapp --registry myacr.azurecr.io --tag $(git rev-parse --short HEAD)
```

**Build number:**
```bash
aifabrix push myapp --registry myacr.azurecr.io --tag build-$BUILD_NUMBER
```

**Environment + version:**
```bash
aifabrix push myapp --registry myacr.azurecr.io --tag prod-v1.0.0
```

### Pre-Deployment Checks

```bash
# Validate configuration
aifabrix doctor

# Test locally first
aifabrix build myapp
aifabrix run myapp
# Test endpoints...

# Then deploy
aifabrix push myapp --registry myacr.azurecr.io
aifabrix deploy myapp --controller https://controller.aifabrix.ai
```

### Secrets Management

**Never commit secrets!**

- Use `kv://` references in env.template
- Store secrets in Azure Key Vault
- Controller resolves them during deployment

**Local development:**
```yaml
# ~/.aifabrix/secrets.yaml
my-api-keyKeyVault: "local-dev-key"
```

**Production:**
Controller fetches from Azure Key Vault.

---

## Implementation Details

### Manifest Generation Process

The `aifabrix deploy` command performs the following steps:

1. **Load Configuration Files**
   - Reads `builder/<app>/variables.yaml` for application metadata
   - Reads `builder/<app>/env.template` for environment variables
   - Reads `builder/<app>/rbac.yaml` for roles and permissions (optional)

2. **Generate Deployment Key**
   - Creates SHA256 hash from variables.yaml content
   - Used for authentication and integrity verification
   - Key format: 64-character hexadecimal string

3. **Parse Environment Variables**
   - Converts env.template entries to configuration array
   - Handles `kv://` references for Key Vault secrets
   - Maps variables to `location` (variable/keyvault)

4. **Build Deployment Manifest**
   - Merges all configuration into single JSON object
   - Includes: app metadata, image reference, port, configuration, roles, permissions
   - Validates required fields and format

5. **Validate Manifest**
   - Checks required fields: key, displayName, image, port, deploymentKey
   - Validates configuration array structure
   - Validates RBAC arrays (roles, permissions)
   - Returns validation errors and warnings

6. **Send to Controller**
   - POST request to `<controller>/api/v1/pipeline/{env}/deploy` (environment-aware endpoint)
   - HTTPS-only communication for security
   - Retries with exponential backoff on transient failures
   - Includes structured error handling
   - Uses ClientId/ClientSecret authentication

7. **Poll Status (Optional)**
   - Polls `/api/v1/environments/{env}/deployments/{deploymentId}` endpoint
   - Configurable interval (default: 5 seconds)
   - Maximum attempts (default: 60)
   - Terminal states: completed, failed, cancelled

### Security Features

- **HTTPS Enforcement**: All controller URLs must use HTTPS protocol
- **Dual Authentication Model**: 
  - Pipeline API uses ClientId/ClientSecret (from `aifabrix app register`)
  - Controller APIs use bearer tokens (from `aifabrix login`, stored in `~/.aifabrix/config`)
- **Credential Storage**: Client credentials displayed but not automatically saved (copy to GitHub Secrets)
- **Token Management**: Bearer tokens auto-refresh with expiry tracking
- **Deployment Key Authentication**: SHA256 hash validates configuration integrity
- **Sensitive Data Masking**: Passwords, secrets, tokens masked in logs
- **Input Validation**: App names, URLs, and configurations validated
- **Audit Logging**: All deployment attempts logged for ISO 27001 compliance
- **Error Sanitization**: No internal paths or secrets exposed in error messages

### API Endpoints

**Deploy Endpoint:**
```
POST https://controller.aifabrix.ai/api/v1/pipeline/{env}/deploy
Content-Type: application/json
Headers:
  x-client-id: <client-id>
  x-client-secret: <client-secret>

{
  "key": "myapp",
  "displayName": "My Application",
  "image": "myacr.azurecr.io/myapp:latest",
  "port": 3000,
  "deploymentKey": "sha256hash...",
  ...
}
```

**Status Endpoint:**
```
GET https://controller.aifabrix.ai/api/v1/environments/{env}/deployments/{deploymentId}
Headers:
  x-client-id: <client-id>
  x-client-secret: <client-secret>

Response: {
  "deploymentId": "deploy-123",
  "status": "completed",
  "progress": 100,
  "deploymentUrl": "https://myapp.aifabrix.ai"
}
```

### Error Handling

Common HTTP status codes and their meanings:

- **200**: Deployment initiated successfully
- **400**: Invalid deployment manifest (validation errors)
- **401**: Authentication failed (invalid deployment key)
- **403**: Authorization failed (insufficient permissions)
- **404**: Controller endpoint not found
- **500**: Internal server error (retry with exponential backoff)
- **Timeout**: Request exceeded maximum duration

### Deployment Key Details

The deployment key is a SHA256 hash of the entire variables.yaml file contents. This ensures:

- **Configuration Integrity**: Any change to variables.yaml results in a different key
- **Authentication**: Controller can verify the configuration is from the authorized source
- **Traceability**: Each deployment key uniquely identifies a configuration version
- **Security**: Prevents tampering with deployment configurations

Key changes when you modify:
- Application name or display name
- Image references or tags
- Port configurations
- Service requirements (database, Redis, storage)
- Health check settings
- Authentication settings

### Audit Trail

All deployment operations are logged with ISO 27001 compliant audit entries:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "AUDIT",
  "message": "Deployment initiated",
  "metadata": {
    "action": "deploy",
    "appName": "myapp",
    "controllerUrl": "https://controller.aifabrix.ai",
    "environment": "dev"
  }
}
```

Audit logs capture:
- Deployment attempts (success/failure)
- Error conditions with sanitized messages
- Security events (authentication failures, invalid keys)
- Controller communication (requests, responses, retries)

