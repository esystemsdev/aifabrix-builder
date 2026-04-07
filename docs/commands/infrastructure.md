# Infrastructure Commands

← [Documentation index](../README.md) · [Commands index](README.md)

Commands for managing local infrastructure services (Postgres, Redis, pgAdmin, Redis Commander).

**Docker and development only:** All `up-xxx` and `down-xxx` commands (`up-infra`, `up-platform`, `up-miso`, `up-dataplane`, `down-infra`, `down-app`) operate on Docker containers and are for local development only. They do not deploy the builder's own services to the cloud.

**Secrets on disk:** Generated `.env` files used for compose (e.g. `.env.run` in the applications or infra folder) are **temporary** and are **deleted after a successful run** so passwords are not stored on disk (ISO 27K). See [Secrets and config](../configuration/secrets-and-config.md#admin-secretsenv-and-run-env-iso-27k).

---

<a id="aifabrix-up-infra"></a>
## aifabrix up-infra

Start local infrastructure (Postgres, Redis, optional Traefik).

**What:** Starts PostgreSQL and Redis in Docker. Optionally includes pgAdmin, Redis Commander, and Traefik. Supports developer isolation with developer-specific ports and infrastructure resources. When the CLI ensures missing bootstrap secrets (for example Postgres password, Keycloak-related defaults, and platform template defaults), it uses the builder **infra parameter catalog**: shipped default values can be overridden for this run with the flags below so one password or email applies everywhere those defaults are wired.

**When:** First time setup, after system restart, when infrastructure is down.

**Usage:**
```bash
# Start infrastructure with default ports (developer ID 0)
aifabrix up-infra

# Full stack: pgAdmin, Redis Commander, Traefik
aifabrix up-infra --pgAdmin --redisAdmin --traefik

# Override shared bootstrap defaults (admin password, optional email and Keycloak default user password)
aifabrix up-infra --adminPassword mySecurePassword
aifabrix up-infra --adminEmail dev@example.com --userPassword defaultUserSecret

# Set developer ID and start infrastructure (developer-specific ports)
aifabrix up-infra --developer 1

# Exclude optional services (minimal footprint)
aifabrix up-infra --no-pgAdmin --no-redisAdmin --no-traefik

# Include Traefik reverse proxy (saves to config for future runs)
aifabrix up-infra --traefik

# Exclude Traefik and save to config
aifabrix up-infra --no-traefik

# TLS mode for application.yaml / deployment manifest (${TLS_ENABLED}, ${HTTP_ENABLED})
aifabrix up-infra --tls
aifabrix up-infra --no-tls

# One-shot: Traefik + TLS in config + catalog overrides (same values as shipped defaults in infra.parameter.yaml)
aifabrix up-infra --traefik --tls --adminPassword admin123 --adminEmail admin@aifabrix.dev --userPassword user123 --pgAdmin
```

Use `aifabrix` or your shell alias (for example `af`) the same way.

**TLS / HTTP manifest flags (`${TLS_ENABLED}`, `${HTTP_ENABLED}`):** **`${HTTP_ENABLED}`** is always the opposite of **`${TLS_ENABLED}`** (both are the strings **`true`** or **`false`**): when TLS mode is off, **`${HTTP_ENABLED}`** is **`true`** (plain HTTP); when TLS mode is on, **`${HTTP_ENABLED}`** is **`false`**. In the infra parameter catalog, **`{{HTTP_ENABLED}}`** mirrors **`{{TLS_ENABLED}}`** the same way.

Default **`${TLS_ENABLED}`** is **`false`**, so default **`${HTTP_ENABLED}`** is **`true`**. Until you run **`aifabrix up-infra --tls`**, those defaults apply in deployment JSON and in catalog placeholder expansion. Use **`aifabrix up-infra --tls`** or **`aifabrix up-infra --no-tls`** to store **`tlsEnabled: true`** or **`tlsEnabled: false`** in **`~/.aifabrix/config.yaml`**. When you generate deployment JSON (for example **`aifabrix json <app>`**), string fields in **`application.yaml`** that contain **`${TLS_ENABLED}`** or **`${HTTP_ENABLED}`** are replaced the same way as **`${REDIS_HOST}`**, **`${PORT}`**, etc. This is independent of Traefik: **`--traefik`** only adds the reverse-proxy service; **`--tls`** only drives these interpolation flags. You cannot pass **`--tls`** and **`--no-tls`** on the same command.

**Bootstrap defaults (catalog):** Shipped defaults for shared placeholders (for example admin password, admin email, and default user password) live in the builder infra parameter catalog (`defaults` in `infra.parameter.yaml`). For details, CLI overwrite of existing `kv://` literals, and Azure naming hints, see [Infra parameters](../configuration/infra-parameters.md). Values such as controller JWT and app encryption keys are **generated** when first ensured, not taken from those shared defaults.

**Options:**
- `-d, --developer <id>` - Set developer ID and start infrastructure with developer-specific ports. Developer ID must be a non-negative integer (0 = default infra, 1+ = developer-specific). When provided, sets the developer ID in `~/.aifabrix/config.yaml` and starts infrastructure with isolated ports.
- `--adminPassword <password>` - Override the catalog default for the shared admin password for this run and when filling missing bootstrap secrets that use that default (Postgres admin password, pgAdmin and Redis Commander wiring, Keycloak admin password bootstrap, controller onboarding admin password, and other catalog entries tied to the same placeholder). Also written to `admin-secrets.env` in the **same directory as `config.yaml`** (often `~/.aifabrix/`, not plain `$HOME` when `aifabrix-home` points at `$HOME`) when that file is created or updated for infra admin access. Use a strong password in shared environments.
- `--adminEmail <email>` - Override the catalog default admin email for this run (for example pgAdmin login email and controller onboarding email bootstrap where the catalog maps it).
- `--userPassword <password>` - Override the catalog default for the Keycloak default end-user password bootstrap where the catalog maps it.
- **Postgres volume caveat:** The Postgres container applies the superuser password when the data volume is **first** created. If you change `--adminPassword` after Postgres was already initialized, database login can fail until you reset the volume: `cd ~/.aifabrix/infra && docker compose -f compose.yaml -p aifabrix down -v`, then run `aifabrix up-infra --adminPassword <password>` again (use your developer-specific compose project name if you use `--developer`).
- `--pgAdmin` - Include pgAdmin web UI and save to config (default: enabled).
- `--no-pgAdmin` - Exclude pgAdmin and save to config.
- `--redisAdmin` - Include Redis Commander web UI and save to config (default: enabled).
- `--no-redisAdmin` - Exclude Redis Commander and save to config.
- `--traefik` - Include Traefik reverse proxy and save `traefik: true` to `~/.aifabrix/config.yaml` (used for this run and when neither flag is passed).
- `--no-traefik` - Exclude Traefik and save `traefik: false` to config. When neither `--traefik` nor `--no-traefik` is passed, the value is read from config.
- `--tls` - Save `tlsEnabled: true` so **`${TLS_ENABLED}`** is **`true`** and **`${HTTP_ENABLED}`** is **`false`** when building deployment JSON.
- `--no-tls` - Save `tlsEnabled: false` so **`${TLS_ENABLED}`** is **`false`** and **`${HTTP_ENABLED}`** is **`true`**. Mutually exclusive with `--tls`.

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
Set environment variables before running `aifabrix up-infra --traefik`:
- `TRAEFIK_CERT_STORE` - Certificate store name (e.g., `wildcard`)
- `TRAEFIK_CERT_FILE` - Absolute path to certificate file
- `TRAEFIK_KEY_FILE` - Absolute path to private key file

**Developer Isolation (one network per developer):**
When using `--developer`, each developer gets:
- Separate Docker Compose project: `infra-dev{id}` (compose and infra working files live under that folder **next to `config.yaml`**, e.g. `~/.aifabrix/infra-dev02`, not under `$HOME` when that differs from the config directory)
- **One network per developer:** `infra-dev{id}-aifabrix-network` — dev, tst, and pro **share this same developer network** on the host (no separate networks per environment).
- Isolated volumes: `dev{id}_postgres_data`, `dev{id}_redis_data`
- Isolated containers: `aifabrix-dev{id}-postgres`, `aifabrix-dev{id}-redis`, etc.

When `remote-server` is set in config, infrastructure may run on the remote host; see [Developer isolation commands](developer-isolation.md) for `dev init` and remote setup.

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
# Install from local/default images (application.yaml)
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
- `-f, --force` - Clean builder/keycloak and builder/miso-controller and re-fetch from templates

**Issues:**
- **"Infrastructure is not up"** → Run `aifabrix up-infra` first
- After success, run onboarding and register Keycloak from the miso-controller repo if needed

---

<a id="aifabrix-up-platform"></a>
## aifabrix up-platform

Start platform (Keycloak, Miso Controller, Dataplane) from community images. Infra must be up.

**What:** Runs `up-miso` then `up-dataplane` in sequence. Use for community edition images when you want the full platform in one step.

**When:** After `aifabrix up-infra`; when you want Keycloak, Miso Controller, and Dataplane running from images (no build).

**Usage:**
```bash
# Start full platform (up-miso then up-dataplane)
aifabrix up-platform

# With registry override
aifabrix up-platform --registry myacr.azurecr.io

# With image overrides
aifabrix up-platform --image keycloak=myreg/k:v1 --image miso-controller=myreg/m:v1 --image dataplane=myreg/d:v1
```

**Options:** Same as [up-miso](#aifabrix-up-miso) (registry, registry-mode, image), plus `-f, --force` to clean builder/keycloak, builder/miso-controller, and builder/dataplane and re-fetch from templates before starting. Passed to both up-miso and up-dataplane steps.

**Issues:**
- **"Infrastructure is not up"** → Run `aifabrix up-infra` first
- **"Login required"** (for up-dataplane step) → Run `aifabrix login` first; ensure environment is `dev`

---

<a id="aifabrix-up-dataplane"></a>
## aifabrix up-dataplane

Register or rotate, deploy to the controller, then run the dataplane app locally in dev. **Always local deployment:** this command does not deploy dataplane to the cloud; it sends the manifest to the Miso Controller then runs the dataplane container locally (same as `aifabrix deploy dataplane --local`).

**What:** If dataplane is already registered in the environment, rotates the app secret; otherwise registers the app. Then deploys via Miso Controller (sends manifest), then runs the dataplane app locally. Requires login and environment `dev`. Before checking auth, the command checks controller health (`/health`). If the controller is not available, you are prompted to enter a new controller URL; it is saved and used for this run.

**When:** Setting up or refreshing dataplane in dev for pipeline development or testing.

**Usage:**
```bash
# Login and set environment to dev first
aifabrix login --environment dev

# Register/rotate, deploy, then run dataplane locally
aifabrix up-dataplane

# With image override
aifabrix up-dataplane --image myreg/dataplane:latest
```

**Options:**
- `-r, --registry <url>` - Override registry for dataplane image
- `--registry-mode <mode>` - Override registry mode (`acr` or `external`)
- `-i, --image <ref>` - Override dataplane image reference
- `-f, --force` - Clean builder/dataplane and re-fetch from templates before registering/deploying

**Issues:**
- **"Login required"** → Run `aifabrix login` first
- **"Dataplane is only supported in dev environment"** → Run `aifabrix auth --set-environment dev`
- **"Controller at … is not available"** → You are prompted to enter a controller URL; enter a valid URL where the controller is running, or set it beforehand with `aifabrix auth --set-controller <url>`

---

<a id="aifabrix-down-infra"></a>
## aifabrix down-infra

Stop infrastructure or a specific application.

**What:**
- **Without arguments:** Stops all infrastructure containers **and all application containers on the same network** (for the current developer). Data is preserved unless `--volumes` is used. With `--volumes`, also removes all infrastructure and application Docker volumes.
- **With an app name:** Stops and removes only that application's container. With `--volumes`, also removes that app's named Docker volume.

**When:** Shutting down, freeing resources, before system maintenance.

**Usage:**
```bash
# Stop infrastructure and all applications on the same network
aifabrix down-infra

# Stop infrastructure, all applications on the same network, and delete all volumes (infra + app data)
aifabrix down-infra --volumes

# Stop a specific application container only
aifabrix down-infra myapp

# Stop an application and remove its data volume
aifabrix down-infra myapp --volumes
```

**Notes:**
- App volumes are named per developer ID:
  - Dev 0: `aifabrix_<app>_data`
  - Dev > 0: `aifabrix_dev<id>_<app>_data`
- `--volumes` for apps removes only the Docker named volume. It does not delete files in `builder/<appKey>` or `apps/<appKey>`.

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
- **"Infrastructure not running"** → Run `aifabrix up-infra` first
- **"Docker not running"** → Start Docker Desktop

---

<a id="aifabrix-restart-service"></a>
## aifabrix restart <service|app>

Restart an infrastructure service or a Docker application.

**What:** Restarts either a single infrastructure service (postgres, redis, pgadmin, redis-commander, traefik) or a running Docker application (by app name). For applications, the app must have been started with `aifabrix run <app>`; see [Application Development Commands](application-development.md#aifabrix-restart-app).

**When:** Service or app is misbehaving, after configuration changes, troubleshooting.

**Example (infrastructure):**
```bash
# Restart Postgres
aifabrix restart postgres

# Restart Redis
aifabrix restart redis
```

**Example (application):**
```bash
# Restart a running app (builder/myapp)
aifabrix restart myapp
```

**Available infrastructure services:**
- `postgres` - PostgreSQL database
- `redis` - Redis cache
- `pgadmin` - pgAdmin web UI
- `redis-commander` - Redis Commander web UI
- `traefik` - Traefik reverse proxy (when started with `--traefik`)

**Output (infrastructure):**
```yaml
✅ postgres service restarted successfully
```

**Output (application):**
```yaml
✅ myapp restarted successfully
```

**Issues:**
- **"Invalid service name"** (infra) → Use one of: postgres, redis, pgadmin, redis-commander, traefik
- **"Application 'X' is not running"** (app) → Start the app first: `aifabrix run <app>`
- **"Infrastructure not properly configured"** → Run `aifabrix up-infra` first

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

