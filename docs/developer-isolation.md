# Developer Isolation

← [Documentation index](README.md)

## Overview

The AI Fabrix Builder supports developer isolation, allowing multiple developers to run applications simultaneously on the same machine without port conflicts. Each developer has a unique numeric ID (1, 2, 3, etc.) that determines their port assignments and infrastructure resources.

## Port Calculation

Ports are calculated using the formula: `basePort + (developer-id * 100)`

### Base Ports

- **App**: 3000
- **Postgres**: 5432
- **Redis**: 6379
- **pgAdmin**: 5050
- **Redis Commander**: 8081

### Examples

**Developer ID 1** (all ports +100):
- App: 3100
- Postgres: 5532
- Redis: 6479
- pgAdmin: 5150
- Redis Commander: 8181

**Developer ID 2** (all ports +200):
- App: 3200
- Postgres: 5632
- Redis: 6579
- pgAdmin: 5250
- Redis Commander: 8281

**Developer ID 3** (all ports +300):
- App: 3300
- Postgres: 5732
- Redis: 6679
- pgAdmin: 5350
- Redis Commander: 8381

## Controller URL Calculation

The default controller URL is automatically calculated based on developer ID using the app port formula: `http://localhost:${3000 + (developerId * 100)}`

### Controller URL Examples

**Developer ID 0** (default):
- Controller URL: `http://localhost:3000`

**Developer ID 1**:
- Controller URL: `http://localhost:3100`

**Developer ID 2**:
- Controller URL: `http://localhost:3200`

**Developer ID 3**:
- Controller URL: `http://localhost:3300`

### Controller URL Resolution Priority

For deploy, wizard, datasource, and other non-auth commands, the controller URL is resolved as (no `--controller` flag):

1. **config.controller** (`~/.aifabrix/config.yaml`) – set by `aifabrix login` or `aifabrix auth config --set-controller`
2. **Device tokens** in config
3. **Developer ID–based default** – `http://localhost:${3000 + (developerId * 100)}`

**Login**, **auth config**, and **logout** accept `--controller` to target a specific URL. **auth status** uses controller and environment from config only.

### Usage in Commands

```bash
# Login saves controller and environment to config (developer ID gives the default when omitted)
aifabrix login
# Developer ID 0: default http://localhost:3000
# Developer ID 1: default http://localhost:3100

# Or set controller explicitly (saved to config)
aifabrix login --controller https://controller.aifabrix.dev

# Deploy, wizard, etc. use controller and environment from config
aifabrix deploy myapp
```

### Checking Controller URL

You can check which controller URL is being used with the `auth status` command:

```bash
# Shows controller URL based on developer ID
aifabrix auth status

# Example output:
# 🔐 Authentication Status
# 
# Controller: http://localhost:3100
# Environment: dev
```

This ensures each developer automatically connects to their own controller instance when running locally, preventing conflicts and making it clear which controller is being used.

## Configuration

### Setting Developer ID

#### Option 1: Using CLI Command (Recommended)

```bash
# Set developer ID to 1 and start infrastructure
aifabrix up-infra --developer 1
```

This command:
- Sets the developer ID in `~/.aifabrix/config.yaml`
- Sets the `AIFABRIX_DEVELOPERID` environment variable
- Starts infrastructure with developer-specific ports

#### Option 2: Using Dev Config Command

```bash
# View current developer configuration
aifabrix dev config

# Set developer ID
aifabrix dev config --set-id 2
```

#### Option 3: Manual Configuration

Edit `~/.aifabrix/config.yaml`:

```yaml
developer-id: 1
environment: dev
```

## How It Works

### Infrastructure Isolation

Each developer gets their own:
- **Docker Compose project**: `infra-dev{id}`
- **Network**: `infra-dev{id}-aifabrix-network`
- **Volumes**: `dev{id}_postgres_data`, `dev{id}_redis_data`
- **Containers**: `aifabrix-dev{id}-postgres`, `aifabrix-dev{id}-redis`, etc.

### Application Isolation

Applications use:
- **Container names**: `aifabrix-dev{id}-{appName}`
- **Host ports**: Developer-specific (e.g., 3100 for dev 1)
- **Container ports**: Unchanged from `application.yaml` (e.g., 3000)
- **Network**: Developer-specific network

### Developer-Specific Domains

When using `frontDoorRouting` with Traefik, the `${DEV_USERNAME}` variable automatically resolves to developer-specific hostnames:

- Developer ID 0: `dev.aifabrix.dev`
- Developer ID 1: `dev01.aifabrix.dev`
- Developer ID 2: `dev02.aifabrix.dev`

Example configuration:

```yaml
frontDoorRouting:
  enabled: true
  host: ${DEV_USERNAME}.aifabrix.dev
  pattern: /api/*
  tls: true
  certStore: wildcard  # Optional: for wildcard certificates
```

This ensures each developer gets their own domain for testing, avoiding conflicts when multiple developers run apps locally. When using wildcard certificates, specify the `certStore` name that matches your Traefik certificate store configuration.

### Port Mapping

Docker Compose maps ports as: `hostPort:containerPort`

Example for developer 1:
- Host port: 3100 (dev-specific)
- Container port: 3000 (from `application.yaml`, unchanged)
- Mapping: `3100:3000`

## Important Notes

### localPort in application.yaml
The `build.localPort` field in `application.yaml` specifies the base application port for local development (e.g., 3000). This is used when generating the local `.env` file (at `build.envOutputPath`). For local development, generated `.env` files are adjusted to reflect developer-specific ports:
- `PORT` is set to `baseAppPort + (developer-id * 100)` (e.g., 3100 for dev 1 when base is 3000).
- The base port is determined by: `build.localPort` (if set) → `port` (fallback)
- Any `http(s)://localhost:<baseAppPort>` occurrences (e.g., in `ALLOWED_ORIGINS`) are rewritten to use the developer-specific port.
- **Note:** The docker `.env` file (`builder/myapp/.env`) always uses `port` from application.yaml, not `build.localPort`.

### Dockerfile Ports

Dockerfiles use internal container ports (from `config.port` or `config.build?.containerPort`). These are **unchanged** and represent the port the application listens on inside the container.

### Environment Variables

- Split variables are used where applicable:
  - `DB_HOST` and `DB_PORT`
  - `REDIS_HOST` and `REDIS_PORT`
  - Combined URLs (e.g., `REDIS_URL`) are constructed from host/port where present.
  - PortAddition applies to all ports: `port + (developer-id * 100)`.

### Public Port Support (Docker Context)

For docker context, the system automatically calculates `*_PUBLIC_PORT` variables for any `*_PORT` variable:

- **Internal Ports (`*_PORT`)**: Remain unchanged for container-to-container communication
  - Example: `MISO_PORT=3000` (always 3000, regardless of developer-id)
- **Public Ports (`*_PUBLIC_PORT`)**: Calculated for host access when developer-id > 0
  - Calculation: `*_PUBLIC_PORT = *_PORT + (developer-id * 100)`
  - Example: `MISO_PUBLIC_PORT=3100` (for developer-id 1), `MISO_PUBLIC_PORT=3200` (for developer-id 2)
  - Not calculated when developer-id is 0 (uses base ports)

**Pattern applies automatically to all services:**
- `MISO_PORT` → `MISO_PUBLIC_PORT`
- `KEYCLOAK_PORT` → `KEYCLOAK_PUBLIC_PORT`
- `DB_PORT` → `DB_PUBLIC_PORT`
- `REDIS_PORT` → `REDIS_PUBLIC_PORT`
- Any future service with `*_PORT` variable

**Usage in env.template:**
```bash
# Internal port (container-to-container communication)
MISO_CONTROLLER_URL=http://${MISO_HOST}:${MISO_PORT}

# Public port (host access) - available in docker context when developer-id > 0
MISO_PUBLIC_URL=http://localhost:${MISO_PUBLIC_PORT}
```

**Manual Override:**
If you manually set `*_PUBLIC_PORT` in your config, it will be preserved and not recalculated.

For docker context (builder/.env):
- `DB_HOST=postgres`, `DB_PORT=5432` (internal, unchanged)
- `DB_PUBLIC_PORT=5432 + PortAddition` (public, calculated when developer-id > 0)
- `REDIS_HOST=redis`, `REDIS_PORT=6379` (internal, unchanged)
- `REDIS_PUBLIC_PORT=6379 + PortAddition` (public, calculated when developer-id > 0)
- `REDIS_URL=redis://redis:{REDIS_PORT}` (uses internal port)
- `MISO_HOST=miso-controller`, `MISO_PORT=3000` (internal, unchanged)
- `MISO_PUBLIC_PORT=3000 + PortAddition` (public, calculated when developer-id > 0)
- `KEYCLOAK_HOST=keycloak`, `KEYCLOAK_PORT=8082` (internal, unchanged)
- `KEYCLOAK_PUBLIC_PORT=8082 + PortAddition` (public, calculated when developer-id > 0)
- `PORT=variables.port` (unchanged, internal container port)

**Public Port Pattern (Docker Context):**
- Any `*_PORT` variable automatically gets a corresponding `*_PUBLIC_PORT` calculated
- Calculation: `*_PUBLIC_PORT = *_PORT + (developer-id * 100)` (only when developer-id > 0)
- Internal `*_PORT` values remain unchanged for container-to-container communication
- Public `*_PUBLIC_PORT` values are used for host access and Docker port mapping
- Pattern applies to all services automatically (MISO, KEYCLOAK, DB, REDIS, etc.)

For local context (apps/.env, generated when `build.envOutputPath` is set):
- `DB_HOST=localhost` (or `aifabrix-localhost` override from config.yaml)
- `DB_PORT=5432 + PortAddition`
- `REDIS_HOST=localhost` (or `aifabrix-localhost` override from config.yaml)
- `REDIS_PORT=6379 + PortAddition`
- `REDIS_URL=redis://{REDIS_HOST}:{REDIS_PORT}`
- `PORT=(build.localPort || variables.port) + PortAddition`

**Port Override Chain for Local Context:**
1. Start with `env-config.yaml` → `environments.local.PORT` (if exists)
2. Override with `config.yaml` → `environments.local.PORT` (if exists)
3. Override with `application.yaml` → `build.localPort` (if exists)
4. Fallback to `application.yaml` → `port` (if build.localPort not set)
5. Apply developer-id adjustment: `finalPort = basePort + (developerId * 100)`

**Infrastructure Port Override Chain for Local Context:**
1. Start with `env-config.yaml` → `environments.local.{REDIS_PORT|DB_PORT}` (if exists)
2. Override with `config.yaml` → `environments.local.{REDIS_PORT|DB_PORT}` (if exists)
3. Apply developer-id adjustment: `finalPort = basePort + (developerId * 100)`

Overrides and fallbacks:
- Values come from `lib/schema/env-config.yaml` per context, merged with `~/.aifabrix/config.yaml` under `environments.{context}`.
- If `env-config.yaml` or keys are missing:
  - docker: use compose service names for *_HOST and base ports for*_PORT.
  - local: use `localhost` (or `aifabrix-localhost` if set) for *_HOST and base ports for*_PORT.

## Usage Examples

### Starting Infrastructure

```bash
# Developer 1
aifabrix up-infra --developer 1

# Developer 2
aifabrix up-infra --developer 2
```

### Running Applications

```bash
# Developer 1 runs app on port 3100
aifabrix run myapp

# Developer 2 runs app on port 3200
aifabrix run myapp
```

### Checking Status

```bash
# Shows infrastructure services and running applications
aifabrix status
```

Example output:

```yaml
📊 Infrastructure Status

✅ postgres:
   Status: running
   Port: 5532
   URL: localhost:5532

✅ redis:
   Status: running
   Port: 6479
   URL: localhost:6479

📱 Running Applications

✅ myapp:
   Container: aifabrix-dev1-myapp
   Port: 3100:3000
   Status: running
   URL: http://localhost:3100
```

### Viewing Developer Configuration

```bash
aifabrix dev config
```

Example output:

```yaml
🔧 Developer Configuration

Developer ID: 1

Ports:
  App: 3100
  Postgres: 5532
  Redis: 6479
  pgAdmin: 5150
  Redis Commander: 8181
```

## Benefits

- **No port conflicts**: Each developer has isolated ports
- **Complete isolation**: Separate Docker Compose projects, networks, and volumes
- **Simple setup**: Just set developer ID and everything works
- **No build file changes**: `localPort` and container ports remain unchanged
- **Easy to add developers**: Just increment the developer ID

## Troubleshooting

### Port Already in Use

If you get a "port already in use" error:
1. Check which developer ID you're using: `aifabrix dev config`
2. Verify no other process is using the port
3. Try a different developer ID if needed

### Infrastructure Not Found

If infrastructure commands fail:
1. Ensure you've set your developer ID: `aifabrix dev config --set-id 1`
2. Start infrastructure: `aifabrix up-infra`
3. Check status: `aifabrix status`

### Container Name Conflicts

If you see container name conflicts:
1. Ensure you're using the correct developer ID
2. Stop existing containers: `docker ps` and `docker stop <container>`
3. Restart with correct developer ID

## Best Practices

1. **Assign developer IDs**: Coordinate with your team to assign unique developer IDs
2. **Use consistent IDs**: Use the same developer ID across all sessions
3. **Document assignments**: Keep a list of developer ID assignments for your team
4. **Check before starting**: Run `aifabrix dev config` to verify your developer ID before starting infrastructure

## Port Scenarios Reference

### Infrastructure Ports by Developer ID

| Service | Base Port | Dev ID 0 | Dev ID 1 | Dev ID 2 | Dev ID 3 |
| ------- | --------- | -------- | -------- | -------- | -------- |
| Postgres | 5432 | 5432 | 5532 | 5632 | 5732 |
| Redis | 6379 | 6379 | 6479 | 6579 | 6679 |
| pgAdmin | 5050 | 5050 | 5150 | 5250 | 5350 |
| Redis Commander | 8081 | 8081 | 8181 | 8281 | 8381 |

### Application Ports by Developer ID

| Base Port | Dev ID 0 | Dev ID 1 | Dev ID 2 | Dev ID 3 |
| --------- | -------- | -------- | -------- | -------- |
| 3000 | 3000 | 3100 | 3200 | 3300 |
| 3010 | 3010 | 3110 | 3210 | 3310 |
| 3014 | 3014 | 3114 | 3214 | 3314 |

### Environment Variable Scenarios

#### Docker Context (builder/.env)

| Variable | Source | Dev ID 0 | Dev ID 1 | Dev ID 2 |
| -------- | ------ | -------- | -------- | -------- |
| `DB_HOST` | env-config.yaml | postgres | postgres | postgres |
| `DB_PORT` | env-config.yaml (internal) | 5432 | 5432 | 5432 |
| `DB_PUBLIC_PORT` | Calculated (public) | - | 5532 | 5632 |
| `REDIS_HOST` | env-config.yaml | redis | redis | redis |
| `REDIS_PORT` | env-config.yaml (internal) | 6379 | 6379 | 6379 |
| `REDIS_PUBLIC_PORT` | Calculated (public) | - | 6479 | 6579 |
| `REDIS_URL` | Constructed | redis://redis:6379 | redis://redis:6379 | redis://redis:6379 |
| `MISO_HOST` | env-config.yaml | miso-controller | miso-controller | miso-controller |
| `MISO_PORT` | env-config.yaml (internal) | 3000 | 3000 | 3000 |
| `MISO_PUBLIC_PORT` | Calculated (public) | - | 3100 | 3200 |
| `KEYCLOAK_HOST` | env-config.yaml | keycloak | keycloak | keycloak |
| `KEYCLOAK_PORT` | env-config.yaml (internal) | 8082 | 8082 | 8082 |
| `KEYCLOAK_PUBLIC_PORT` | Calculated (public) | - | 8182 | 8282 |
| `PORT` | application.yaml port (internal) | 3000 | 3000 | 3000 |

**Note:** In docker context, `*_PORT` values are internal container ports (unchanged), while `*_PUBLIC_PORT` values are calculated for host access when developer-id > 0. The pattern applies automatically to all services with `*_PORT` variables.

#### Local Context (apps/.env)

| Variable | Source | Dev ID 0 | Dev ID 1 | Dev ID 2 |
| -------- | ------ | -------- | -------- | -------- |
| `DB_HOST` | env-config.yaml | localhost | localhost | localhost |
| `DB_PORT` | env-config.yaml + adjustment | 5432 | 5532 | 5632 |
| `REDIS_HOST` | env-config.yaml | localhost | localhost | localhost |
| `REDIS_PORT` | env-config.yaml + adjustment | 6379 | 6479 | 6579 |
| `REDIS_URL` | Constructed | redis://localhost:6379 | redis://localhost:6479 | redis://localhost:6579 |
| `PORT` | Override chain + adjustment | See PORT Override Scenarios below | | |

### PORT Override Chain Scenarios (Local Context)

#### Scenario 1: All Sources Present

| Source | Value | Final Port (Dev ID 1) |
| ------ | ----- | --------------------- |
| env-config.yaml → environments.local.PORT | 3000 | 3100 |
| config.yaml → environments.local.PORT | 3010 | 3110 (overrides) |
| application.yaml → build.localPort | 3015 | 3115 (strongest) |
| Result | | **3115** |

#### Scenario 2: Only application.yaml Present

| Source | Value | Final Port (Dev ID 1) |
| ------ | ----- | --------------------- |
| env-config.yaml → environments.local.PORT | (not set) | - |
| config.yaml → environments.local.PORT | (not set) | - |
| application.yaml → build.localPort | 3010 | 3110 |
| Result | | **3110** |

#### Scenario 3: Only application.yaml port (no build.localPort)

| Source | Value | Final Port (Dev ID 1) |
| ------ | ----- | --------------------- |
| env-config.yaml → environments.local.PORT | (not set) | - |
| config.yaml → environments.local.PORT | (not set) | - |
| application.yaml → build.localPort | (not set) | - |
| application.yaml → port | 3000 | 3100 (fallback) |
| Result | | **3100** |

#### Scenario 4: Only env-config.yaml Present

| Source | Value | Final Port (Dev ID 1) |
| ------ | ----- | --------------------- |
| env-config.yaml → environments.local.PORT | 3000 | 3100 |
| config.yaml → environments.local.PORT | (not set) | - |
| application.yaml → build.localPort | (not set) | - |
| application.yaml → port | (not set) | - |
| Result | | **3100** |

### Infrastructure Port Override Scenarios (Local Context)

#### DB_PORT Override Chain

| Source | Value | Final Port (Dev ID 1) |
| ------ | ----- | --------------------- |
| env-config.yaml → environments.local.DB_PORT | 5432 | 5532 |
| config.yaml → environments.local.DB_PORT | 5433 | 5533 (overrides) |
| Result | | **5533** |

#### REDIS_PORT Override Chain

| Source | Value | Final Port (Dev ID 1) |
| ------ | ----- | --------------------- |
| env-config.yaml → environments.local.REDIS_PORT | 6379 | 6479 |
| config.yaml → environments.local.REDIS_PORT | 6380 | 6480 (overrides) |
| Result | | **6480** |

### Variable Interpolation Scenarios

#### Scenario: Secret with ${VAR} Reference

| Template/Secret | Value | Interpolated (Dev ID 1) |
| ---------------- | ----- | ----------------------- |
| `KEYCLOAK_SERVER_URL=kv://keycloak-server-urlKeyVault` | `"http://${KEYCLOAK_HOST}:${KEYCLOAK_PORT}"` | `http://localhost:8082` |
| `KC_PORT=${KEYCLOAK_PORT}` | (from env-config.yaml) | `8082` |
| `DATABASE_URL=kv://db-urlKeyVault` | `"postgresql://user:pass@${DB_HOST}:${DB_PORT}/db"` | `postgresql://localhost:5532/db` |

### Complete Example: Developer ID 1, Local Context

| Variable | Source | Value |
| -------- | ------ | ----- |
| `PORT` | application.yaml → build.localPort (3010) + adjustment | 3110 |
| `DB_HOST` | env-config.yaml | localhost |
| `DB_PORT` | env-config.yaml (5432) + adjustment | 5532 |
| `REDIS_HOST` | env-config.yaml | localhost |
| `REDIS_PORT` | env-config.yaml (6379) + adjustment | 6479 |
| `REDIS_URL` | Constructed from REDIS_HOST:REDIS_PORT | redis://localhost:6479 |
| `KEYCLOAK_HOST` | env-config.yaml | localhost |
| `KEYCLOAK_PORT` | env-config.yaml (8082) + adjustment | 8182 |
| `MISO_HOST` | env-config.yaml | localhost |
| `MISO_PORT` | env-config.yaml (3010) + adjustment | 3110 |

