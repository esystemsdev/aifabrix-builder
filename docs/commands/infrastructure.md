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
```

**Options:**
- `-d, --developer <id>` - Set developer ID and start infrastructure with developer-specific ports. Developer ID must be a non-negative integer (0 = default infra, 1+ = developer-specific). When provided, sets the developer ID in `~/.aifabrix/config.yaml` and starts infrastructure with isolated ports.

**Port Calculation:**
Ports are calculated using: `basePort + (developer-id * 100)`

- **Developer ID 0** (default): App=3000, Postgres=5432, Redis=6379, pgAdmin=5050, Redis Commander=8081
- **Developer ID 1**: App=3100, Postgres=5532, Redis=6479, pgAdmin=5150, Redis Commander=8181
- **Developer ID 2**: App=3200, Postgres=5632, Redis=6579, pgAdmin=5250, Redis Commander=8281

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

