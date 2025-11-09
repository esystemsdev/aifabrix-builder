<!-- 4e3a9ee8-cd30-4cfa-ae3e-911daf5dd12a 948b0470-a45f-4994-949b-5e00017da485 -->
# Developer Isolation and Port Management

## Overview

Create a developer-specific configuration system that allows multiple developers to run applications simultaneously with isolated ports and infrastructure resources. Each developer has a numeric ID (1, 2, 3...) and ports are offset by (developer-id * 100). The `localPort` in variables.yaml remains unchanged - only Docker host port mappings use dev-specific offsets. Dockerfiles use internal container ports (unchanged).

## Implementation Plan

### 1. Configuration System (Extend Existing)

- **File**: `lib/config.js` (modify)
  - Extend `getConfig()` to return `{ apiUrl, token, developerId }` (default developerId: 1 if not set)
  - Extend `saveConfig()` to accept and save `developerId` alongside `apiUrl` and `token`
  - Add helper function `getDeveloperId()` that returns developerId from config (defaults to 1)
  - Add helper function `setDeveloperId(id)` that updates config with new developerId
  - Config structure in `~/.aifabrix/config.yaml`:
    ```yaml
    apiUrl: http://localhost:3000
    token: abc123...
    developer-id: 1  # Numeric ID (1, 2, 3, etc.)
    ```

  - Base ports (hardcoded in dev-config utility):
    - app: 3000
    - postgres: 5432
    - redis: 6379
    - pgadmin: 5050
    - redisCommander: 8081
  - Calculate actual ports: `basePort + (developer-id * 100)`

### 2. Developer Config Utility

- **File**: `lib/utils/dev-config.js` (new)
  - Functions: `getDevPorts(developerId)` - Calculate ports based on developer ID
  - Returns object with all calculated ports for a given developer ID
  - Example for developer-id: 1 → app=3100, postgres=5532, redis=6479, pgadmin=5150, redisCommander=8181
  - Example for developer-id: 2 → app=3200, postgres=5632, redis=6579, pgadmin=5250, redisCommander=8281

### 3. Infrastructure Isolation

- **File**: `lib/infra.js` (modify)
  - Load developer ID from config using `config.getDeveloperId()`
  - Use developer-specific container names: `aifabrix-dev{id}-postgres`, `aifabrix-dev{id}-redis`, etc.
  - Use developer-specific Docker Compose project name: `infra-dev{id}`
  - Use developer-specific network: `infra-dev{id}-aifabrix-network`
  - Use developer-specific volumes: `dev{id}_postgres_data`, `dev{id}_redis_data`
  - Use calculated ports from dev-config utility
  - Modify `startInfra()` to accept optional developer ID parameter (for --developer flag)
  - Modify `stopInfra()`, `stopInfraWithVolumes()`, `checkInfraHealth()`, `getInfraStatus()`, `restartService()`, `findContainer()` to use dev config
  - Update `waitForServices()` to use dev-specific container names

### 4. Infrastructure Template Generation

- **File**: `lib/infra.js` (modify)
  - Generate compose.yaml dynamically from template with dev-specific values
  - Use Handlebars or string replacement to inject:
    - Container names with dev ID
    - Ports with dev offsets
    - Volume names with dev ID
    - Network name with dev ID
  - Write generated compose to `~/.aifabrix/infra-dev{id}/compose.yaml`

### 5. Application Port Management

- **File**: `lib/app-run.js` (modify)
  - Load developer ID from config using `config.getDeveloperId()`
  - **IMPORTANT**: Dockerfile uses internal container port (from `config.port` or `config.build?.containerPort`) - this is UNCHANGED
  - Docker host port mapping: Use `devConfig.ports.app + (developer-id * 100)` OR use `options.port` if provided
  - Container port: Use `config.build?.containerPort || config.port` (unchanged - this is what goes in Dockerfile)
  - Use developer-specific container naming: `aifabrix-dev{id}-{appName}`
  - Update `checkContainerRunning()`, `stopAndRemoveContainer()` to use dev-specific container names
  - Ensure port doesn't conflict with infrastructure ports

### 6. Docker Compose Generation

- **File**: `lib/utils/compose-generator.js` (modify)
  - Load developer ID from config
  - Use developer-specific network name: `infra-dev{id}-aifabrix-network`
  - Pass dev config to template context
  - Host port mapping uses dev-specific port, container port uses config value (unchanged)

### 7. Dockerfile Generation (No Changes Needed)

- **File**: `lib/build.js` (no changes)
  - Dockerfiles use `{{port}}` which is the container port (internal)
  - This comes from `config.port` or `config.build?.containerPort`
  - This is correct - Dockerfiles expose the internal container port
  - Health check in Dockerfile uses internal container port (correct)
  - No changes needed - Dockerfiles work with internal ports only

### 8. Environment File Generation

- **File**: `lib/secrets.js` (modify)
  - Load developer ID from config when generating `.env` files
  - For Docker context (container-to-container):
    - Use service names: `DATABASE_HOST=postgres`, `REDIS_URL=redis://redis:6379`
  - For local context (host machine):
    - Use `localhost` with dev-specific ports: `DATABASE_HOST=localhost`, `DATABASE_PORT={devPostgresPort}`, `REDIS_URL=redis://localhost:{devRedisPort}`
  - Update `generateEnvFile()` to accept and use dev config
  - **IMPORTANT**: `PORT` variable uses `localPort` from variables.yaml (unchanged), NOT dev-specific port

### 9. Status Command Enhancement

- **File**: `lib/infra.js` (modify)
  - Add new function `getAppStatus()` to discover running application containers
  - Find containers matching pattern: `aifabrix-dev{id}-*` (excluding infrastructure containers)
  - Extract app name, port mapping, and status from containers
  - Return array of application status objects
- **File**: `lib/cli.js` (modify)
  - Update `status` command to call both `getInfraStatus()` and `getAppStatus()`
  - Display infrastructure services first, then applications
  - Format: Show app name, container name, port mapping, status

### 10. CLI Command Updates

- **File**: `lib/cli.js` (modify)
  - Add `--developer <id>` option to `up` command
  - When `--developer` is provided:
    - Save developer ID to `~/.aifabrix/config.yaml` using `config.setDeveloperId(id)`
    - Set environment variable `AIFABRIX_DEVELOPERID={id}` for current process
    - Then proceed with infrastructure startup using the new developer ID
  - Add `aifabrix dev config` command:
    - `aifabrix dev config` - Show current developer ID and calculated ports
    - `aifabrix dev config --set-id <id>` - Set developer ID
  - Display formatted output showing all ports for current developer

### 11. Template Updates

- **File**: `templates/infra/compose.yaml` (modify)
  - Convert to Handlebars template `templates/infra/compose.yaml.hbs`
  - Parameterize: container names, ports, volumes, network name
  - Use variables: `{{devId}}`, `{{postgresPort}}`, `{{redisPort}}`, etc.

### 12. Network and Volume Management

- **File**: `lib/infra.js` (modify)
  - Ensure dev-specific networks are created/used
  - Ensure dev-specific volumes are created/used
  - Update all Docker commands to use dev-specific project name (`-p infra-dev{id}`)

### 13. Documentation

- **File**: `docs/DEVELOPER-ISOLATION.md` (new)
  - Explain developer isolation concept
  - Show port calculation: `basePort + (developer-id * 100)`
  - Examples:
    - Dev 1: app=3100, postgres=5532, redis=6479
    - Dev 2: app=3200, postgres=5632, redis=6579
  - Show how to configure: `aifabrix up --developer 1` (sets config automatically)
  - Show manual config: `developer-id: 1` in `~/.aifabrix/config.yaml`
  - Explain complete isolation (separate Docker Compose projects)
  - Clarify that `localPort` in variables.yaml is NOT changed
  - Explain Dockerfile ports are internal container ports (unchanged)

## Key Changes Summary

1. **Config Module**: Extend `lib/config.js` to store `developer-id` alongside `apiUrl` and `token`
2. **New Utility**: `lib/utils/dev-config.js` - Port calculation based on developer ID
3. **Infrastructure**: Complete isolation with dev-specific containers, networks, volumes, ports
4. **Application Running**: Use dev-specific Docker host ports, keep container ports unchanged
5. **Dockerfiles**: No changes - use internal container ports (correct behavior)
6. **Compose Generation**: Use dev-specific networks and host ports
7. **Environment Generation**: Use dev-specific infrastructure ports for local context, keep `PORT` using `localPort`
8. **Status Command**: Show both infrastructure services AND running applications
9. **CLI**: Add `--developer` option to `up` command, add `dev config` command
10. **Template**: Convert infrastructure template to Handlebars with dev variables

## Port Calculation Examples

- **Developer ID 1**: All ports +100
  - App host port: 3100, Postgres: 5532, Redis: 6479, pgAdmin: 5150, Redis Commander: 8181
  - Container port (Dockerfile): 3000 (unchanged, from config.port)
  - `localPort` in variables.yaml: Still 3000 (unchanged)
- **Developer ID 2**: All ports +200
  - App host port: 3200, Postgres: 5632, Redis: 6579, pgAdmin: 5250, Redis Commander: 8281
  - Container port (Dockerfile): 3000 (unchanged, from config.port)
  - `localPort` in variables.yaml: Still 3000 (unchanged)

## Dockerfile Port Explanation

- Dockerfiles use `EXPOSE {{port}}` where `{{port}}` = container port (internal)
- This is the port the application listens on INSIDE the container
- Docker Compose maps: `hostPort:containerPort` (e.g., `3100:3000`)
- Host port (3100) is dev-specific, container port (3000) is from config (unchanged)
- Health check in Dockerfile uses container port (correct)

## Usage Examples

```bash
# Set developer ID to 1 and start infrastructure
aifabrix up --developer 1

# Check status (shows infrastructure + applications)
aifabrix status

# View/change developer config
aifabrix dev config
aifabrix dev config --set-id 2
```

## Status Command Output Example

```
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

## Benefits

- No changes to build files required
- `localPort` in variables.yaml remains unchanged
- Dockerfiles use internal container ports (unchanged, correct behavior)
- Simple setup: `aifabrix up --developer 1` sets everything up
- Uses existing config.yaml (no new config file)
- Complete isolation between developers (separate Docker Compose projects)
- Automatic port calculation: `basePort + (developer-id * 100)`
- Status command shows both infrastructure and applications
- Easy to add new developers (just increment ID)