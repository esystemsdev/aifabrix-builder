# Local Infrastructure Guide

← [Documentation index](README.md)

**Scope:** This page is for **local Docker installation only**. For Azure deployment, use **Azure Marketplace**—Azure automatically provisions infrastructure, Keycloak, Miso Controller, and Dataplane. See your Azure deployment documentation for Marketplace setup.

---

## Local Infrastructure Overview

When you run `aifabrix up-infra`, you get shared baseline services for local development:

| Service | Port | Required | Description |
|---------|------|----------|-------------|
| PostgreSQL | 5432 | Always | Database server (includes pgvector). Access: localhost:5432 |
| Redis | 6379 | Always | In-memory cache, sessions, queues. Access: localhost:6379 |
| pgAdmin | 5050 | Optional | Web UI for database management. Access: http://localhost:5050 |
| Redis Commander | 8081 | Optional | Web UI for Redis. Access: http://localhost:8081 |
| Traefik | 80/443 | Optional | Reverse proxy for local routing |

**Default credentials:** Postgres user `pgadmin`, pgAdmin login `admin@aifabrix.dev` / admin123, Redis Commander login admin / admin123. First-time run creates secrets; use `--adminPwd <password>` for a custom admin password.

---

## Quick Start

**Minimal (Postgres + Redis only):**
```bash
aifabrix up-infra
```

**Full stack (Postgres, Redis, pgAdmin, Redis Commander, Traefik):**
```bash
aifabrix up-infra --pgAdmin --redisAdmin --traefik
```

**First time?** Docker downloads images (2–3 minutes). You’ll see containers starting and health checks passing.

---

## up-infra Options

| Option | Description |
|--------|-------------|
| `--pgAdmin` | Include pgAdmin web UI and save to config |
| `--no-pgAdmin` | Exclude pgAdmin and save to config |
| `--redisAdmin` | Include Redis Commander web UI and save to config |
| `--no-redisAdmin` | Exclude Redis Commander and save to config |
| `--traefik` | Include Traefik reverse proxy and save to config |
| `--no-traefik` | Exclude Traefik and save to config |
| `--adminPwd <password>` | Override default admin password (Postgres, pgAdmin, Redis Commander) |
| `-d, --developer <id>` | Use developer-specific ports and network |

Settings are stored in `~/.aifabrix/config.yaml`. When flags are omitted, saved values are used (pgAdmin and Redis Commander default to enabled).

**Example with all optional services:**
```bash
aifabrix up-infra --pgAdmin --redisAdmin --traefik
```

---

## Service Details

### PostgreSQL (always on)
- **Access:** localhost:5432
- **Username:** pgadmin
- **Password:** from admin-secrets (default admin123 on first run)

### Redis (always on)
- **Access:** localhost:6379

### pgAdmin (optional)
- **Access:** http://localhost:5050 (port 5050 for dev 0; add 100 per developer ID)
- **Login:** admin@aifabrix.dev / admin123 (or your `--adminPwd`)

### Redis Commander (optional)
- **Access:** http://localhost:8081 (port 8081 for dev 0; add 100 per developer ID)
- **Login:** admin / admin123 (or your `--adminPwd`)

### Traefik (optional)
- **Access:** http://localhost:80, https://localhost:443
- **TLS:** Set `TRAEFIK_CERT_STORE`, `TRAEFIK_CERT_FILE`, `TRAEFIK_KEY_FILE` before `aifabrix up-infra --traefik`

---

## Commands

### Stop infrastructure
```bash
aifabrix down-infra
```
Stops all infrastructure and application containers on the same network. Data is preserved unless `--volumes` is used.

### Reset (delete all data)
```bash
aifabrix down-infra --volumes
```
Removes all volumes (databases, Redis, app data). Use for a fresh start.

### Check status
```bash
aifabrix status
```
Shows running services, ports, and URLs.

### Health check
```bash
aifabrix doctor
```
Validates Docker, ports, secrets, and infrastructure health.

---

## Platform (Local Only)

On Azure, Keycloak, Miso Controller, and Dataplane are auto-provisioned. Locally, install them with these commands:

### up-miso
Install Keycloak and Miso Controller from images (no build). Requires `aifabrix up-infra` first.
```bash
aifabrix up-miso
```

### up-platform
Full platform in one step: `up-miso` then `up-dataplane`.
```bash
aifabrix up-platform
```

### up-dataplane
Register/rotate, deploy to controller, then run dataplane locally in dev. Requires `aifabrix login` and environment `dev`.
```bash
aifabrix login --environment dev
aifabrix up-dataplane
```

→ [Infrastructure Commands](commands/infrastructure.md) for full reference.

---

## Optional: Build Keycloak and Miso from Scratch

For local development, you can create and run Keycloak and Miso Controller from templates:

**Keycloak:**
```bash
aifabrix create keycloak --port 8082 --database --template keycloak
aifabrix build keycloak
aifabrix run keycloak
```
Access: http://localhost:8082 (admin / admin123)

**Miso Controller:**
```bash
aifabrix create miso-controller --port 3000 --database --redis --template miso-controller
aifabrix build miso-controller
aifabrix run miso-controller
```
Access: http://localhost:3000

---

## Traefik Configuration

Traefik is an optional reverse proxy for local routing. Enable with `aifabrix up-infra --traefik`; disable with `aifabrix up-infra --no-traefik`. When an app has `frontDoorRouting.enabled: true` in `application.yaml`, the builder generates Traefik labels. See [application.yaml frontDoorRouting](configuration/application-yaml.md) for host and path configuration.

---

## Common Questions

**Do I need to run infrastructure all the time?**  
Only when developing. Use `aifabrix up-infra` when you start, `aifabrix down-infra` when done.

**What happens to my data when I stop?**  
It’s preserved in Docker volumes. Databases and Redis data persist between restarts.

**Can I use my own Postgres/Redis?**  
Yes. Configure connection strings in your app’s `env.template`.

**How much disk space?**  
Base infra: ~0.5–1.5 GB for images; ~256 MB–1 GB RAM when running (more if pgAdmin, Redis Commander, or Traefik are enabled).

---

## Troubleshooting

| Issue | Action |
|-------|--------|
| Port 5432 already in use | Stop other Postgres or use `--developer` for different ports |
| Port 6379 already in use | Stop other Redis |
| Docker not running | Start Docker Desktop, then run `aifabrix up-infra` again |
| Cannot connect to Docker daemon | Ensure Docker Desktop is running and you’re logged in |
| Containers start but apps can’t connect | Run `aifabrix doctor` to check connectivity |
