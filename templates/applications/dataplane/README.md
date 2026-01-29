# Dataplane Builder

Build, run, and deploy Dataplane using `@aifabrix/builder`.

---

## Quick Start

### 1. Install

```bash
npm install -g @aifabrix/builder
```

### 2. First Time Setup

```bash
# Check your environment
aifabrix doctor

# Login to controller (change your own port)
aifabrix login --method device --environment dev --controller http://localhost:3100

# Register your application (gets you credentials automatically)
aifabrix app register dataplane
```

### 3. Build & Run Locally

```bash
# Build the Docker image
aifabrix build dataplane

# Run locally
aifabrix run dataplane
```

**Access your app:** <http://localhost:3111> (host port from `build.localPort`; container uses 3001)

---

## Testing dataplane (use DATAPLANE_TEST_GUIDE)

**Use the builder's Dataplane Test Guide** for auth, health, wizard, external systems, and pipeline checks:

- **In aifabrix-builder:** `integration/hubspot/DATAPLANE_TEST_GUIDE.md`
- **Dataplane base URL:** `http://localhost:3111`
- **Controller:** `http://localhost:3110` (login, token)

The guide defines: token setup, `/health`, wizard API, external systems API, pipeline API, and quick checks. 
Keep `build.localPort` in `variables.yaml` at **3111** so it matches that guide.

**View logs:**

```bash
docker logs aifabrix-dataplane -f
```

**Stop:**

```bash
docker stop aifabrix-dataplane
```

### 4. Deploy to Azure

```bash
# Build with version tag
aifabrix build dataplane --tag v1.0.0

# Push to registry
aifabrix push dataplane --registry myacr.azurecr.io --tag "v1.0.0,latest"

# Deploy to miso-controller
aifabrix deploy dataplane
```

---

## Using miso-client

> [miso-client](https://github.com/esystemsdev/aifabrix-miso-client)

After registering your app, you automatically get credentials in your secret file. Use miso-client for login, RBAC, audit logs, etc.

**Rotate credentials if needed:**

```bash
aifabrix app rotate-secret dataplane
```

---

## Reference

### Common Commands

```bash
# Development
aifabrix build dataplane                        # Build app
aifabrix run dataplane                          # Run locally
aifabrix dockerfile dataplane --force           # Generate Dockerfile
aifabrix resolve dataplane                      # Generate .env file

# Deployment
aifabrix json dataplane                         # Preview deployment JSON
aifabrix genkey dataplane                       # Generate deployment key
aifabrix push dataplane --registry myacr.azurecr.io # Push to ACR
aifabrix deploy dataplane --controller <url>    # Deploy to Azure

# Management
aifabrix app register dataplane
aifabrix app list
aifabrix app rotate-secret dataplane

# Utilities
aifabrix doctor                                   # Check environment
aifabrix login --method device  # Login
aifabrix --help                                   # Get help
```

### Build Options

```bash
aifabrix build dataplane --tag v1.0.0           # Custom tag
aifabrix build dataplane --force-template       # Force template regeneration
aifabrix build dataplane --language typescript  # Override language detection
```

### Run Options

```bash
aifabrix run dataplane --port 3000          # Custom port
aifabrix run dataplane --debug                  # Debug output
```

### Push Options

```bash
aifabrix push dataplane --registry myacr.azurecr.io --tag v1.0.0
aifabrix push dataplane --registry myacr.azurecr.io --tag "v1.0.0,latest,stable"
```

### Deploy Options

```bash
aifabrix deploy dataplane
aifabrix deploy dataplane --no-poll
```

### Login Methods

```bash
# Device code flow
aifabrix login --method device --environment dev

# Credentials (reads from secrets.local.yaml)
aifabrix login --method credentials --app dataplane --environment dev

# Explicit credentials
aifabrix login --method credentials --app dataplane --client-id $CLIENT_ID --client-secret $CLIENT_SECRET --environment dev
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
- **"Port already in use"** → Use `--port` flag or change `build.localPort` in `variables.yaml` (default: 3111, must match DATAPLANE_TEST_GUIDE)
- **"Authentication failed"** → Run `aifabrix login` again
- **"Build fails"** → Check Docker is running and `variables.yaml` → `build.secrets` path is correct
- **"Can't connect"** → Verify infrastructure is running and PostgreSQL is accessible

**Regenerate files:**

```bash
aifabrix resolve dataplane --force
aifabrix json dataplane
aifabrix genkey dataplane
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

**Application**: dataplane | **Port**: 3111 (local) / 3001 (container) | **Registry**: myacr.azurecr.io | **Image**: aifabrix/dataplane:latest
