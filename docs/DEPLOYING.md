# Deploying Applications

Deploy your application via Miso Controller. Enterprise versions deploy to Azure Container Apps, while open source versions deploy to local Docker instances.

## Prerequisites

Before deploying:

1. **Miso Controller**
   - Running instance (or URL)
   - See [Install Miso Controller](INFRASTRUCTURE.md#install-miso-controller)

2. **Built Image**
   ```bash
   aifabrix build myapp
   ```

3. **Environment Variables** (for pipeline deployment)
   Add to your `env.template`:
   ```bash
   # Pipeline deployment parameters
   ENVIRONMENT_ID=dev  # or 'tst', 'pro'
   TENANT_ID=your-azure-tenant-id
   CLIENT_ID=your-azure-client-id
   REPOSITORY_URL=https://github.com/your-org/your-repo
   CONTROLLER_API_URL=https://controller.aifabrix.ai
   CONTROLLER_API_KEY=kv://controller-api-keyKeyVault
   ```

---

## Deployment Methods

### Method 1: Using AI Fabrix Builder SDK

```bash
# Push image to registry
aifabrix push myapp --registry myacr.azurecr.io --tag v1.0.0

# Deploy via controller
aifabrix deploy myapp --controller https://controller.aifabrix.ai
```

### Method 2: Direct API Calls (CI/CD)

Use the Pipeline API for automated deployments:

#### Step 1: Validate and Get ACR Token

```bash
curl -X POST "https://controller.aifabrix.ai/api/pipeline/validate" \
  -H "Authorization: Bearer $CONTROLLER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "dev",
    "tenantId": "your-tenant-id",
    "clientId": "your-client-id", 
    "repositoryUrl": "https://github.com/your-org/your-repo",
    "applicationConfig": {
      "key": "myapp",
      "type": "webapp",
      "image": "myacr.azurecr.io/myapp:latest",
      "port": 3000,
      "configuration": [
        {"name": "NODE_ENV", "value": "production", "location": "variable", "required": true}
      ]
    }
  }'
```

**Response:**
```json
{
  "valid": true,
  "acrToken": "eyJhbGciOiJSUzI1NiIs...",
  "deploymentServer": "myacr.azurecr.io",
  "username": "00000000-0000-0000-0000-000000000000",
  "expiresAt": "2024-01-01T12:00:00Z",
  "draftDeploymentId": "draft-123"
}
```

#### Step 2: Push Image to ACR

```bash
# Login to ACR using the token
echo "$ACR_TOKEN" | docker login $DEPLOYMENT_SERVER -u $USERNAME --password-stdin

# Push your image
docker push $DEPLOYMENT_SERVER/myapp:v1.0.0
```

#### Step 3: Deploy Application

```bash
curl -X POST "https://controller.aifabrix.ai/api/pipeline/deploy" \
  -H "Authorization: Bearer $CONTROLLER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "acrToken": "eyJhbGciOiJSUzI1NiIs...",
    "imageTag": "v1.0.0"
  }'
```

**Response:**
```json
{
  "deploymentId": "deploy-456",
  "status": "deploying",
  "deploymentUrl": "https://myapp-dev.aifabrix.ai",
  "healthCheckUrl": "https://myapp-dev.aifabrix.ai/health"
}
```

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
   - POST to `/api/pipeline/deploy`
   - Includes manifest + deployment key

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

## CI/CD Integration

### GitHub Actions (Recommended)

Use the AI Fabrix GitHub Action for simplified deployment:

```yaml
name: Deploy Application

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to AI Fabrix
        uses: aifabrix/deploy-action@v1
        with:
          environment-id: 'dev'  # or 'tst', 'pro'
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          repository-url: ${{ github.server_url }}/${{ github.repository }}
          controller-url: ${{ secrets.CONTROLLER_URL }}
          controller-token: ${{ secrets.CONTROLLER_TOKEN }}
          image-tag: ${{ github.sha }}
```

### Custom GitHub Actions

For more control, use the Pipeline API directly:

```yaml
name: Deploy Application

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Image
        run: |
          docker build -t myapp:${{ github.sha }} .
      
      - name: Validate and Get ACR Token
        id: validate
        run: |
          RESPONSE=$(curl -X POST "${{ env.CONTROLLER_API_URL }}/api/pipeline/validate" \
            -H "Authorization: Bearer ${{ secrets.CONTROLLER_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "environmentId": "dev",
              "tenantId": "${{ secrets.AZURE_TENANT_ID }}",
              "clientId": "${{ secrets.AZURE_CLIENT_ID }}",
              "repositoryUrl": "${{ github.server_url }}/${{ github.repository }}",
              "applicationConfig": $(cat application.json)
            }')
          echo "acrToken=$(echo $RESPONSE | jq -r '.acrToken')" >> $GITHUB_OUTPUT
          echo "deploymentServer=$(echo $RESPONSE | jq -r '.deploymentServer')" >> $GITHUB_OUTPUT
          echo "username=$(echo $RESPONSE | jq -r '.username')" >> $GITHUB_OUTPUT
        env:
          CONTROLLER_API_URL: ${{ secrets.CONTROLLER_URL }}
      
      - name: Push to ACR
        run: |
          echo ${{ steps.validate.outputs.acrToken }} | docker login ${{ steps.validate.outputs.deploymentServer }} -u ${{ steps.validate.outputs.username }} --password-stdin
          docker tag myapp:${{ github.sha }} ${{ steps.validate.outputs.deploymentServer }}/myapp:${{ github.sha }}
          docker push ${{ steps.validate.outputs.deploymentServer }}/myapp:${{ github.sha }}
      
      - name: Deploy Application
        run: |
          curl -X POST "${{ env.CONTROLLER_API_URL }}/api/pipeline/deploy" \
            -H "Authorization: Bearer ${{ secrets.CONTROLLER_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "acrToken": "${{ steps.validate.outputs.acrToken }}",
              "imageTag": "${{ github.sha }}"
            }'
        env:
          CONTROLLER_API_URL: ${{ secrets.CONTROLLER_URL }}
```

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

### Check Status

Controller provides status endpoint:
```bash
curl -H "Authorization: Bearer $CONTROLLER_API_KEY" \
  https://controller.aifabrix.ai/api/deployments/myapp
```

### View Logs

```bash
curl -H "Authorization: Bearer $CONTROLLER_API_KEY" \
  https://controller.aifabrix.ai/api/deployments/myapp/logs
```

### List All Deployments

```bash
curl -H "Authorization: Bearer $CONTROLLER_API_KEY" \
  https://controller.aifabrix.ai/api/deployments
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

**Check URL:**
```bash
curl -H "Authorization: Bearer $CONTROLLER_API_KEY" \
  https://controller.aifabrix.ai/health
```

**Check network:**
```bash
ping controller.aifabrix.ai
```

### "Authentication failed"

**Check API key:**
```bash
curl -H "Authorization: Bearer $CONTROLLER_API_KEY" \
  https://controller.aifabrix.ai/api/controller
```

**Common issues:**
- Invalid or expired API key
- Missing Authorization header
- Wrong controller URL

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

