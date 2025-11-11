# Developer Isolation

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

## Configuration

### Setting Developer ID

#### Option 1: Using CLI Command (Recommended)

```bash
# Set developer ID to 1 and start infrastructure
aifabrix up --developer 1
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
- **Container ports**: Unchanged from `variables.yaml` (e.g., 3000)
- **Network**: Developer-specific network

### Port Mapping

Docker Compose maps ports as: `hostPort:containerPort`

Example for developer 1:
- Host port: 3100 (dev-specific)
- Container port: 3000 (from `variables.yaml`, unchanged)
- Mapping: `3100:3000`

## Important Notes

### localPort in variables.yaml

The `localPort` field in `variables.yaml` is **NOT changed**. It remains as configured (e.g., 3000). Only the Docker host port mapping uses developer-specific offsets.

### Dockerfile Ports

Dockerfiles use internal container ports (from `config.port` or `config.build?.containerPort`). These are **unchanged** and represent the port the application listens on inside the container.

### Environment Variables

For **Docker context** (container-to-container communication):
- `DATABASE_HOST=postgres` (service name)
- `REDIS_URL=redis://redis:6379` (service name)

For **local context** (host machine):
- `DATABASE_HOST=localhost`
- `DATABASE_PORT={devPostgresPort}` (dev-specific port)
- `REDIS_URL=redis://localhost:{devRedisPort}` (dev-specific port)

The `PORT` variable uses `localPort` from `variables.yaml` (unchanged), NOT the dev-specific port.

## Usage Examples

### Starting Infrastructure

```bash
# Developer 1
aifabrix up --developer 1

# Developer 2
aifabrix up --developer 2
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

### Viewing Developer Configuration

```bash
aifabrix dev config
```

Example output:

```
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
2. Start infrastructure: `aifabrix up`
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

