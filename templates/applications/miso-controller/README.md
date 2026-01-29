# Miso Controller Builder

Build, run, and deploy Miso Controller using `@aifabrix/builder`.

---

## Quick Start

### 1. Install

```bash
pnpm install -g @aifabrix/builder
```

### 2. First Time Setup

```bash
# Check your environment
aifabrix doctor

# Login to controller
aifabrix login --method device --environment dev --controller http://localhost:3110 --offline

# Register your application (gets you credentials automatically)
aifabrix app register miso-controller --environment miso --controller http://localhost:3100
```

### 3. Build & Run Locally

```bash
# Build the Docker image
aifabrix build miso-controller

# Generate environment variables
aifabrix resolve miso-controller

# Run locally
aifabrix run miso-controller
```

**Access your app:** <http://dev.aifabrix:3000>

**View logs:**

```bash
docker logs aifabrix-miso-controller -f
```

**Stop:**

```bash
docker stop aifabrix-miso-controller
```

### 4. Deploy to Azure

```bash
# Build with version tag
aifabrix build miso-controller --tag v1.0.0

# Push to registry
aifabrix push miso-controller --registry myacr.azurecr.io --tag "v1.0.0,latest"

# Deploy to miso-controller
aifabrix deploy miso-controller --controller https://controller.aifabrix.ai --environment dev
```

---

## Using miso-client

> [miso-client](https://github.com/esystemsdev/aifabrix-miso-client)

After registering your app, you automatically get credentials in your secret file. Use miso-client for login, RBAC, audit logs, etc.

**Rotate credentials if needed:**

```bash
aifabrix app rotate-secret miso-controller --environment dev
```

---

## Reference

### Common Commands

```bash
# Development
aifabrix build miso-controller                        # Build app
aifabrix run miso-controller                          # Run locally
aifabrix dockerfile miso-controller --force           # Generate Dockerfile
aifabrix resolve miso-controller                      # Generate .env file

# Deployment
aifabrix json miso-controller                         # Preview deployment JSON
aifabrix genkey miso-controller                       # Generate deployment key
aifabrix push miso-controller --registry myacr.azurecr.io # Push to ACR
aifabrix deploy miso-controller --controller <url>    # Deploy to Azure

# Management
aifabrix app register miso-controller --environment dev
aifabrix app list --environment dev
aifabrix app rotate-secret miso-controller --environment dev

# Utilities
aifabrix doctor                                   # Check environment
aifabrix login --method device --environment dev  # Login
aifabrix --help                                   # Get help
```

### Build Options

```bash
aifabrix build miso-controller --tag v1.0.0           # Custom tag
aifabrix build miso-controller --force-template       # Force template regeneration
aifabrix build miso-controller --language typescript  # Override language detection
```

### Run Options

```bash
aifabrix run miso-controller --port 3000          # Custom port
aifabrix run miso-controller --debug                  # Debug output
```

### Push Options

```bash
aifabrix push miso-controller --registry myacr.azurecr.io --tag v1.0.0
aifabrix push miso-controller --registry myacr.azurecr.io --tag "v1.0.0,latest,stable"
```

### Deploy Options

```bash
aifabrix deploy miso-controller --controller <url> --environment dev
aifabrix deploy miso-controller --controller <url> --environment dev --no-poll
```

### Login Methods

```bash
# Device code flow
aifabrix login --method device --environment dev

# Credentials (reads from secrets.local.yaml)
aifabrix login --method credentials --app miso-controller --environment dev

# Explicit credentials
aifabrix login --method credentials --app miso-controller --client-id $CLIENT_ID --client-secret $CLIENT_SECRET --environment dev
```

### Environment Variables

```bash
export AIFABRIX_HOME=/custom/path
export AIFABRIX_SECRETS=/path/to/secrets.yaml
```

#### Rate Limiting Configuration

For local development, you can disable or configure rate limiting to avoid HTTP 429 errors:

```bash
# Disable rate limiting entirely (local development only)
export DISABLE_RATE_LIMIT=true

# Or configure rate limits
export RATE_LIMIT_WINDOW_MS=900000  # 15 minutes in milliseconds (default: 900000)
export RATE_LIMIT_MAX=100           # Max requests per window (default: 100)
```

**Note:** Disabling rate limiting should only be used for local development. Production deployments should always have rate limiting enabled.

---

## Troubleshooting

### Common Issues

- **"Docker not running"** → Start Docker Desktop
- **"Not logged in"** → Run `aifabrix login` first
- **"Port already in use"** → Use `--port` flag or change `build.localPort` in `variables.yaml` (default: 3000)
- **"Authentication failed"** → Run `aifabrix login` again
- **"Build fails"** → Check Docker is running and `variables.yaml` → `build.secrets` path is correct
- **"Can't connect"** → Verify infrastructure is running and PostgreSQL is accessible

#### Authentication Token Validation Issues

If you get "Authentication Failed" or "Your authentication token is invalid or has expired" when using Docker:

**Problem**: Token validation fails because the token's issuer (`iss` claim) doesn't match the Keycloak URL configured in the Docker container.

**Solution**:

1. **Ensure `keycloak-public-server-urlKeyVault` is set correctly**:

   ```bash
   # Check your Keycloak port (typically 8182 for dev01)
   docker ps | grep keycloak

   # Set the public Keycloak URL to match your Keycloak instance
   aifabrix secrets set keycloak-public-server-urlKeyVault "http://localhost:8182"
   ```

2. **Login with the same Keycloak URL that Docker uses**:

   ```bash
   # Login using the Keycloak URL that matches your Docker container's configuration
   # The token issuer must match KEYCLOAK_PUBLIC_SERVER_URL in the container
   aifabrix login --method device --environment miso --controller http://localhost:3100 --offline
   ```

3. **Verify Keycloak configuration in Docker**:

   ```bash
   # Check what Keycloak URL the Docker container is using
   docker exec aifabrix-dev01-miso-controller env | grep KEYCLOAK_PUBLIC_SERVER_URL
   ```

4. **Restart Docker container after changing secrets**:
   ```bash
   # Regenerate environment variables and restart
   aifabrix resolve miso-controller --force
   docker restart aifabrix-dev01-miso-controller
   ```

**Root Cause**: When you login with `aifabrix login --controller http://localhost:3110`, the token is issued with an issuer URL. If the Docker container (port 3100) has a different `KEYCLOAK_PUBLIC_SERVER_URL` configured, token validation will fail because the issuer doesn't match.

**IMPORTANT**: After making any changes to secrets or environment variables:

1. **Regenerate environment variables**:

   ```bash
   aifabrix resolve miso-controller --force
   ```

2. **Restart the Docker container**:

   ```bash
   docker restart aifabrix-dev01-miso-controller
   ```

3. **Login again with the Docker container URL** (to get a token with the correct issuer):

   ```bash
   # Clear any existing tokens first
   aifabrix logout

   # Login with the Docker container URL
   aifabrix login --method device --environment miso --controller http://localhost:3100 --offline
   ```

4. **Verify the token works**:
   ```bash
   # Try registering again
   aifabrix app register miso-controller --environment miso --controller http://localhost:3100
   ```

**Debugging**: If authentication still fails, check the Docker logs for detailed error messages:

```bash
docker logs aifabrix-dev01-miso-controller --tail 50 | grep -i "auth\|token\|keycloak"
```

### Deployment Issues

#### Mock Mode Configuration

If deployments are not creating actual Azure resources, check the `MOCK` environment variable:

```bash
# In env.template or .env file
MOCK=false  # Must be false for production deployments
```

**Symptoms:**

- Logs show `[AzureClientFactory] isMockMode() called - returning true`
- No actual Azure resources are created
- Deployment appears to succeed but resources don't exist

**Solution:**

- Set `MOCK=false` in your environment configuration for production deployments
- Only use `MOCK=true` for local development/testing when you don't want to create real Azure resources

#### Azure Permission Errors

If you see permission denied errors during deployment:

```
Permission denied: Service principal does not have permission to assign roles.
Grant "User Access Administrator" or "Owner" role to the service principal
```

**Solution:**

- Grant the service principal (identified by `AZURE_CLIENT_ID`) one of these roles:
  - **User Access Administrator** (recommended for least privilege)
  - **Owner** (full access, use with caution)
- Assign the role at either:
  - Subscription level (for all resource groups)
  - Resource group level (for specific resource groups)

**Azure CLI commands:**

```bash
# Get service principal object ID
az ad sp show --id <AZURE_CLIENT_ID> --query id -o tsv

# Assign User Access Administrator role at subscription level
az role assignment create \
  --assignee <SERVICE_PRINCIPAL_OBJECT_ID> \
  --role "User Access Administrator" \
  --scope /subscriptions/<SUBSCRIPTION_ID>

# Or assign at resource group level
az role assignment create \
  --assignee <SERVICE_PRINCIPAL_OBJECT_ID> \
  --role "User Access Administrator" \
  --scope /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP_NAME>
```

#### Secret Not Found Errors

If deployment fails with "Secret not found" errors:

```
Failed to getSecret postgres-adminPassword: Secret not found
```

**Possible causes:**

1. Secret doesn't exist in Key Vault
2. Secret name mismatch (e.g., `postgres-adminPassword` vs `postgres-admin-password`)
3. Service principal doesn't have Key Vault access

**Solution:**

- Verify the secret exists in Key Vault with the correct name
- Ensure the service principal has "Key Vault Secrets User" role on the Key Vault
- Check secret naming convention matches infrastructure deployment (typically `{prefix}-postgres-admin-password`)

**Regenerate files:**

```bash
aifabrix resolve miso-controller --force
aifabrix json miso-controller
aifabrix genkey miso-controller
```

---

## Prerequisites

- `@aifabrix/builder` installed globally
- Docker Desktop running
- Azure CLI installed (for push command)
- Authenticated with controller (for deploy command)
- PostgreSQL database (ensure infrastructure is running)
- Redis (ensure infrastructure is running)
- File storage configured
- Authentication/RBAC configured

---

**Application**: miso-controller | **Port**: 3000 | **Registry**: myacr.azurecr.io | **Image**: aifabrix/miso-controller:latest
