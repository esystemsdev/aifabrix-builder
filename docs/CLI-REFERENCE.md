# CLI Reference

Complete command reference with examples and troubleshooting.

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

## aifabrix create <app>

Create new application with configuration files.

**What:** Generates `builder/` folder with `variables.yaml`, `env.template`, `rbac.yaml`.

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

**Flags:**
- `-p, --port <port>` - Application port
- `-d, --database` - Requires database
- `-r, --redis` - Requires Redis
- `-s, --storage` - Requires file storage
- `-a, --authentication` - Requires authentication/RBAC
- `-l, --language <lang>` - typescript or python
- `-t, --template <name>` - Template (platform for Keycloak/Miso)

**Creates:**
- `builder/variables.yaml`
- `builder/env.template`
- `builder/rbac.yaml` (if authentication=true)

**Issues:**
- **"Folder already exists"** → Choose different name or delete existing
- **"Invalid app name"** → Use lowercase, dashes only

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

Run application locally.

**What:** Starts container, connects to infrastructure, maps ports.

**When:** Testing, development, debugging.

**Example:**
```bash
aifabrix run myapp
```

**Custom port:**
```bash
aifabrix run myapp --port 3001
```

**Flags:**
- `-p, --port <port>` - Override local port

**Access:** http://localhost:<port>

**Issues:**
- **"Infrastructure not running"** → `aifabrix up`
- **"Port already in use"** → Use different port
- **"Container won't start"** → Check logs: `docker logs aifabrix-myapp`

---

## aifabrix push <app>

Push image to Azure Container Registry.

**What:** Authenticates with ACR, tags image, pushes to registry.

**When:** Before Azure deployment.

**Example:**
```bash
aifabrix push myapp --registry myacr.azurecr.io --tag v1.0.0
```

**Multiple tags:**
```bash
aifabrix push myapp --registry myacr.azurecr.io --tag "v1.0.0,latest"
```

**Flags:**
- `-r, --registry <url>` - ACR registry URL (required)
- `-t, --tag <tag>` - Image tag (default: latest)

**Issues:**
- **"Authentication failed"** → Run: `az acr login --name myacr`
- **"Image not found"** → Build first: `aifabrix build myapp`
- **"Permission denied"** → Check ACR permissions

---

## aifabrix deploy <app>

Deploy to Azure via Miso Controller.

**What:** Generates deployment manifest with deployment key, sends to controller for Azure deployment.

**When:** Deploying to Azure.

**Example:**
```bash
aifabrix deploy myapp --controller https://controller.aifabrix.ai
```

**Specific environment:**
```bash
aifabrix deploy myapp --controller https://controller.aifabrix.ai --environment dev
```

**Flags:**
- `-c, --controller <url>` - Controller URL (required)
- `-e, --environment <env>` - Target environment

**Issues:**
- **"Validation failed"** → Check `aifabrix-deploy.json`
- **"Deployment key mismatch"** → Regenerate: `aifabrix genkey myapp`
- **"Can't reach controller"** → Check URL, network connection

---

## aifabrix resolve <app>

Generate `.env` file from template.

**What:** Resolves `kv://` references from secrets file, creates `.env`.

**When:** After secrets change, troubleshooting environment issues.

**Example:**
```bash
aifabrix resolve myapp
```

**Creates:** `builder/myapp/.env`

**Issues:**
- **"Secrets file not found"** → Create `~/.aifabrix/secrets.yaml`
- **"Missing kv:// reference"** → Add secret to secrets file
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
