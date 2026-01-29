# Keycloak Builder

Build, run, and deploy Keycloak using `@aifabrix/builder`.

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
aifabrix login --method device --environment dev --controller http://localhost:3100 --offline

# Register your application (gets you credentials automatically)
aifabrix app register keycloak --environment dev
```

### 3. Build & Run Locally

```bash
# Build the Docker image
aifabrix build keycloak

# Generate environment variables
aifabrix resolve keycloak

# Run locally
aifabrix run keycloak
```

**Access your app:** <http://dev.aifabrix:8082>

**View logs:**

```bash
docker logs aifabrix-keycloak -f
```

**Stop:**

```bash
docker stop aifabrix-keycloak
```

### 4. Deploy to Azure

```bash
# Build with version tag
aifabrix build keycloak --tag v1.0.0

# Push to registry
aifabrix push keycloak --registry myacr.azurecr.io --tag "v1.0.0,latest"

# Deploy to miso-controller
aifabrix deploy keycloak --controller https://controller.aifabrix.ai --environment dev
```

---

## Using miso-client

> [miso-client](https://github.com/esystemsdev/aifabrix-miso-client)

After registering your app, you automatically get credentials in your secret file. Use miso-client for login, RBAC, audit logs, etc.

**Rotate credentials if needed:**

```bash
aifabrix app rotate-secret keycloak --environment dev
```

---

## Reference

### Common Commands

```bash
# Development
aifabrix build keycloak                        # Build app
aifabrix run keycloak                          # Run locally
aifabrix dockerfile keycloak --force           # Generate Dockerfile
aifabrix resolve keycloak                      # Generate .env file

# Deployment
aifabrix json keycloak                         # Preview deployment JSON
aifabrix genkey keycloak                       # Generate deployment key
aifabrix push keycloak --registry myacr.azurecr.io # Push to ACR
aifabrix deploy keycloak --controller <url>    # Deploy to Azure

# Management
aifabrix app register keycloak --environment dev
aifabrix app list --environment dev
aifabrix app rotate-secret keycloak --environment dev

# Utilities
aifabrix doctor                                   # Check environment
aifabrix login --method device --environment dev  # Login
aifabrix --help                                   # Get help
```

### Build Options

```bash
aifabrix build keycloak --tag v1.0.0           # Custom tag
aifabrix build keycloak --force-template       # Force template regeneration
aifabrix build keycloak --language typescript  # Override language detection
```

### Run Options

```bash
aifabrix run keycloak --port 8082          # Custom port
aifabrix run keycloak --debug                  # Debug output
```

### Push Options

```bash
aifabrix push keycloak --registry myacr.azurecr.io --tag v1.0.0
aifabrix push keycloak --registry myacr.azurecr.io --tag "v1.0.0,latest,stable"
```

### Deploy Options

```bash
aifabrix deploy keycloak --controller <url> --environment dev
aifabrix deploy keycloak --controller <url> --environment dev --no-poll
```

### Login Methods

```bash
# Device code flow
aifabrix login --method device --environment dev

# Credentials (reads from secrets.local.yaml)
aifabrix login --method credentials --app keycloak --environment dev

# Explicit credentials
aifabrix login --method credentials --app keycloak --client-id $CLIENT_ID --client-secret $CLIENT_SECRET --environment dev
```

### Environment Variables

```bash
export AIFABRIX_HOME=/custom/path
export AIFABRIX_SECRETS=/path/to/secrets.yaml
```

---

## Troubleshooting

- **"Docker not running"** → Start Docker Desktop
- **"Not logged in"** → Run `aifabrix login` first
- **"Port already in use"** → Use `--port` flag or change `build.localPort` in `variables.yaml` (default: 8082)
- **"Authentication failed"** → Run `aifabrix login` again
- **"Build fails"** → Check Docker is running and `variables.yaml` → `build.secrets` path is correct
- **"Can't connect"** → Verify infrastructure is running and PostgreSQL is accessible

**Regenerate files:**

```bash
aifabrix resolve keycloak --force
aifabrix json keycloak
aifabrix genkey keycloak
```

---

## Prerequisites

- `@aifabrix/builder` installed globally
- Docker Desktop running
- Azure CLI installed (for push command)
- Authenticated with controller (for deploy command)
- PostgreSQL database (ensure infrastructure is running)
- Authentication/RBAC configured

---

**Application**: keycloak | **Port**: 8082 | **Registry**: myacr.azurecr.io | **Image**: aifabrix/keycloak:latest
