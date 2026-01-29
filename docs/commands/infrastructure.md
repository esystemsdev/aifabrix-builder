# Infrastructure Commands

← [Back to Commands Index](README.md) | [Back to Quick Start](../quick-start.md)

Commands for managing local infrastructure services (Postgres, Redis, pgAdmin, Redis Commander).

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

# Start infrastructure with Traefik reverse proxy (saves to config for future runs)
aifabrix up --traefik

# Exclude Traefik and save to config
aifabrix up --no-traefik
```

**Options:**
- `-d, --developer <id>` - Set developer ID and start infrastructure with developer-specific ports. Developer ID must be a non-negative integer (0 = default infra, 1+ = developer-specific). When provided, sets the developer ID in `~/.aifabrix/config.yaml` and starts infrastructure with isolated ports.
- `--traefik` - Include Traefik reverse proxy and save `traefik: true` to `~/.aifabrix/config.yaml` (used for this run and when neither flag is passed).
- `--no-traefik` - Exclude Traefik and save `traefik: false` to config. When neither `--traefik` nor `--no-traefik` is passed, the value is read from config.

**Port Calculation:**
Ports are calculated using: `basePort + (developer-id * 100)`

- **Developer ID 0** (default): App=3000, Postgres=5432, Redis=6379, pgAdmin=5050, Redis Commander=8081, Traefik HTTP=80, HTTPS=443
- **Developer ID 1**: App=3100, Postgres=5532, Redis=6479, pgAdmin=5150, Redis Commander=8181, Traefik HTTP=180, HTTPS=543
- **Developer ID 2**: App=3200, Postgres=5632, Redis=6579, pgAdmin=5250, Redis Commander=8281, Traefik HTTP=280, HTTPS=643

**Output (default):**
```yaml
✓ Starting Postgres...
✓ Starting Redis...
✓ Infrastructure ready
  Postgres: localhost:5432
  Redis: localhost:6379
  pgAdmin: http://localhost:5050
  Redis Commander: http://localhost:8081
```

**Output (with developer ID):**
```yaml
✓ Developer ID set to 1
✓ Starting Postgres...
✓ Starting Redis...
✓ Infrastructure ready
  Postgres: localhost:5532
  Redis: localhost:6479
  pgAdmin: http://localhost:5150
  Redis Commander: http://localhost:8181
```

**Traefik Certificate Configuration (Optional):**
Set environment variables before running `aifabrix up --traefik`:
- `TRAEFIK_CERT_STORE` - Certificate store name (e.g., `wildcard`)
- `TRAEFIK_CERT_FILE` - Absolute path to certificate file
- `TRAEFIK_KEY_FILE` - Absolute path to private key file

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

<a id="aifabrix-up-miso"></a>
## aifabrix up-miso

Install Keycloak and Miso Controller from images (no build).

**What:** Ensures builder app dirs from templates, sets URL secrets, resolves with auto-generated secrets (force), then runs Keycloak and Miso Controller. No build step; uses existing Docker images (local or from registry).

**When:** Fast platform setup for testing when you have Keycloak and Miso Controller images. Infra must already be up.

**Usage:**
```bash
# Install from local/default images (variables.yaml)
aifabrix up-miso

# Override registry for both apps
aifabrix up-miso --registry myacr.azurecr.io

# Override images per app
aifabrix up-miso --image keycloak=myreg/keycloak:v1 --image miso-controller=myreg/miso:v1
```

**Options:**
- `-r, --registry <url>` - Override registry for both apps (e.g. `myacr.azurecr.io`)
- `--registry-mode <mode>` - Override registry mode (`acr` or `external`)
- `-i, --image <key>=<value>` - Override image (e.g. `keycloak=reg/k:v1`, `miso-controller=reg/m:v1`); can be repeated

**Issues:**
- **"Infrastructure is not up"** → Run `aifabrix up` first
- After success, run onboarding and register Keycloak from the miso-controller repo if needed

---

<a id="aifabrix-up-dataplane"></a>
## aifabrix up-dataplane

Register or rotate, run locally, and deploy the dataplane app in dev.

**What:** If dataplane is already registered in the environment, rotates the app secret; otherwise registers the app. Then runs dataplane locally and deploys via Miso Controller. Requires login and environment `dev`.

**When:** Setting up or refreshing dataplane in dev for pipeline development or testing.

**Usage:**
```bash
# Login and set environment to dev first
aifabrix login --environment dev

# Register/rotate, run, deploy dataplane
aifabrix up-dataplane

# With image override
aifabrix up-dataplane --image myreg/dataplane:latest
```

**Options:**
- `-r, --registry <url>` - Override registry for dataplane image
- `--registry-mode <mode>` - Override registry mode (`acr` or `external`)
- `-i, --image <ref>` - Override dataplane image reference

**Issues:**
- **"Login required"** → Run `aifabrix login` first
- **"Dataplane is only supported in dev environment"** → Run `aifabrix auth config --set-environment dev`

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
```yaml
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

✅ traefik:
   Status: running
   Port: 80/443
   URL: http://localhost:80, https://localhost:443
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
- `traefik` - Traefik reverse proxy (when started with `--traefik`)

**Output:**
```yaml
✅ postgres service restarted successfully
```

**Issues:**
- **"Service not found"** → Use correct service name (postgres, redis, pgadmin, redis-commander)
- **"Service not running"** → Service may not be started; use `aifabrix up` to start all services

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
```yaml
✓ Docker is running
✓ Port 5432 available
✓ Port 6379 available
✓ Secrets file exists
✓ Infrastructure is running
  - Postgres: healthy
  - Redis: healthy
```

**Issues:** Shows problems and how to fix them.

