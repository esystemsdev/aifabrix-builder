# Local Infrastructure Guide

← [Documentation index](README.md)

**Scope:** This page is for **local Docker installation only**. For Azure deployment, use **Azure Marketplace**—Azure automatically provisions infrastructure, Keycloak, Miso Controller, and Dataplane. See your Azure deployment documentation for Marketplace setup.

---

## Install the platform (one command)

You do not need a checklist of ten commands. Install the full local platform like this:

```bash
npm install -g @aifabrix/builder
aifabrix setup
```

**What you get:** shared infra (Postgres, Redis, optional pgAdmin and Redis Commander), then Keycloak, Miso Controller, and Dataplane containers. Setup runs `up-infra` and `up-platform` for you.

### Platform topology (single vs full)

Setup supports two platform topologies:

| Mode | Use when | What it changes |
| --- | --- | --- |
| **single** | You want the classic “direct ports per app” local install | No shared front door. No env-scoped resource prefixes by default. |
| **full** | You want one front door URL and multiple controller environments (`miso`, `dev`, `tst`, `pro`) | Enables path routing on `localhost:${3000 + developerId×100}` and enables env-scoped resources so `dev` and `tst` can use prefixed paths. |

**Examples (developer-id 06):**

```bash
# Direct ports per app (classic)
aifabrix setup --platform single

# One front door + multiple environments
aifabrix setup --platform full
```

In **full** mode, the front door uses a single base URL (example `dev06`):

- `http://localhost:3600/miso` (Miso Controller)
- `http://localhost:3600/auth` (Keycloak)
- `http://localhost:3600/data` (Dataplane in `pro`)
- `http://localhost:3600/dev/data` (Dataplane in `dev`)
- `http://localhost:3600/tst/data` (Dataplane in `tst`)

**Images:** Every setup path (fresh install and all three mode-menu choices) runs `docker compose pull` / `docker pull` for infra and platform apps before services restart.

**First run:** Image pulls and container startup typically take a few minutes. Watch the terminal until setup reports success.

**Sign in:** Platform UI username **`admin`**. Password is the one you entered in setup (dev profile) or the **platform** password from the pro profile summary (see below). Setup writes **`platform-controller`** and **`controller`** in `config.yaml` to the same absolute Miso URL. If you already have a device token for that URL, setup keeps your login; otherwise it runs the device login step during platform bring-up.

**Tear down everything:** `aifabrix teardown` (removes volumes, cleans the config directory except `config.yaml` and `certs/`, and removes materialized `builder/` under your work tree).

→ Command reference: [aifabrix setup](commands/infrastructure.md#aifabrix-setup) · [aifabrix teardown](commands/infrastructure.md#aifabrix-teardown)

---

## Dev and pro installation profiles

The builder uses **dev** and **pro** in many places (for example login environment **dev** / **tst** / **pro**). During **setup**, the same words describe **how you install on this machine**:

| Profile | Also called | Use when | Admin email | Admin passwords |
| --- | --- | --- | --- | --- |
| **dev** | development installation | Local development, training, labs (default) | You enter once in the wizard | **One password** — same value for Postgres, pgAdmin, Redis Commander, Keycloak install, and platform UI login |
| **pro** | production installation | Production-style or hardened local install | Same email prompt | **Autogenerate** three strong passwords (printed **once**) **or** enter manually (one password for all roles, or separate passwords in advanced mode) |

**Default:** `aifabrix setup` without extra flags uses the **dev** profile.

**Choose pro** in the setup wizard, or non-interactively:

```bash
aifabrix setup --installation pro --pro-password-mode autogen
aifabrix setup --installation pro --pro-password-mode manual
```

`--pro-password-mode manual` accepts one password for all admin roles, or separate passwords via `aifabrix up-infra --infraAdminPassword`, `--keycloakAdminPassword`, and `--platformAdminPassword`.

### Where credentials live

| File | Purpose |
| --- | --- |
| `~/.aifabrix/admin-secrets.env` | All **admin** passwords (infra DB, pgAdmin, Redis Commander, Keycloak install, platform login). Encrypted with `secure://` when you set a secrets encryption key in `config.yaml`. |
| `~/.aifabrix/secrets.local.yaml` | App and integration secrets (API keys, DB URLs per app, etc.) — not admin passwords. |
| `~/.aifabrix/config.yaml` | Developer ID, infra toggles, saved `setupInstallationProfile` (`dev` or `pro`), optional `adminEmail`, **`platform-controller`** (absolute Miso URL written by setup), **`controller`** (aligned with login). |

**Pro autogenerate — save the screen:** When you pick autogenerate, the CLI prints infra, Keycloak, and platform passwords **once**. Copy them to a password manager immediately; they are not shown again and are not stored in plaintext on disk.

**AI tool keys:** Setup can prompt for OpenAI or Azure OpenAI if keys are missing. You can also set them before or after setup with `aifabrix secret set` (see [README](../README.md)).

**When infra is already up**, `aifabrix setup` shows a **three-option** menu (the old “refresh platform config only” choice was removed):

| Mode | Data | Typical use |
| --- | --- | --- |
| **Re-install** | Deletes all Docker volumes | Broken volumes or full reset |
| **Wipe data** | Drops DBs/users; keeps Postgres volume | Empty databases without destroying volumes |
| **Update images** | Keeps volumes, secrets, and builder trees | Pull newer Keycloak / Miso / Dataplane images |

All three pull images, then run `up-infra` and `up-platform`. Re-install re-prompts for admin email/password; wipe data and update images use existing `admin-secrets.env`.

---

## Local Infrastructure Overview

When you run `aifabrix up-infra`, you get shared baseline services for local development:

| Service | Port | Required | Description |
| ------- | ---- | -------- | ----------- |
| PostgreSQL | 5432 | Always | Database server (includes pgvector). Access: localhost:5432 |
| Redis | 6379 | Always | In-memory cache, sessions, queues. Access: localhost:6379 |
| pgAdmin | 5050 | Optional | Web UI for database management. Access: <http://localhost:5050> |
| Redis Commander | 8081 | Optional | Web UI for Redis. Access: <http://localhost:8081> |
| Traefik | 80/443 | Optional | Reverse proxy for local routing |

**Credentials:** Come from `admin-secrets.env` after setup (not hardcoded in docs). On a fresh catalog-only run, defaults in the infra parameter catalog may apply until you run setup; prefer **`aifabrix setup`** so dev or pro profile writes your chosen values. Override one run with `aifabrix up-infra --adminPassword … --adminEmail …`.

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

**Recommended for new developers:** use `aifabrix setup` instead of calling `up-infra` and `up-platform` separately.

**First time?** Docker downloads images (2–3 minutes). You’ll see containers starting and health checks passing.

---

## up-infra Options

| Option | Description |
| ------ | ----------- |
| `--pgAdmin` | Include pgAdmin web UI and save to config |
| `--no-pgAdmin` | Exclude pgAdmin and save to config |
| `--redisAdmin` | Include Redis Commander web UI and save to config |
| `--no-redisAdmin` | Exclude Redis Commander and save to config |
| `--traefik` | Include Traefik reverse proxy and save to config |
| `--no-traefik` | Exclude Traefik and save to config |
| `--tls` | Save TLS mode on; `${TLS_ENABLED}` → `true`, `${HTTP_ENABLED}` → `false` in deployment JSON |
| `--no-tls` | Save TLS mode off; `${TLS_ENABLED}` → `false`, `${HTTP_ENABLED}` → `true` (cannot combine with `--tls`) |
| `--adminPassword <password>` | Override admin password (dev profile: all admin roles; pro profile: use role-specific flags when available) |
| `--adminEmail <email>` | Override admin email |
| `-d, --developer <id>` | Use developer-specific ports and network |

Settings are stored in `~/.aifabrix/config.yaml`. When flags are omitted, saved values are used (pgAdmin and Redis Commander default to enabled).

**`${TLS_ENABLED}` and `${HTTP_ENABLED}` in `application.yaml`:** **`${HTTP_ENABLED}`** is always the logical opposite of **`${TLS_ENABLED}`** (both expand to the strings **`true`** or **`false`**). Default **`${TLS_ENABLED}`** is **`false`** and **`${HTTP_ENABLED}`** is **`true`**. Run **`aifabrix up-infra --tls`** or **`aifabrix up-infra --no-tls`** to set **`tlsEnabled`** in **`~/.aifabrix/config.yaml`**. Commands that build the deployment manifest (for example **`aifabrix json <app>`**) substitute these placeholders like **`${REDIS_HOST}`**. Catalog literals can use **`{{TLS_ENABLED}}`** and **`{{HTTP_ENABLED}}`** the same way. This is separate from Traefik and from HTTPS certificates on the reverse proxy.

**Example with all optional services:**
```bash
aifabrix up-infra --pgAdmin --redisAdmin --traefik
```

---

## Service Details

### PostgreSQL (always on)
- **Access:** localhost:5432
- **Username:** pgadmin
- **Password:** from `admin-secrets.env` (set by setup)

### Redis (always on)
- **Access:** localhost:6379

### pgAdmin (optional)
- **Access:** <http://localhost:5050> (port 5050 for dev 0; add 100 per developer ID)
- **Login:** email and password from `admin-secrets.env`

### Redis Commander (optional)
- **Access:** <http://localhost:8081> (port 8081 for dev 0; add 100 per developer ID)
- **Login:** admin user / password from `admin-secrets.env`

### Traefik (optional)
- **Access:** <http://localhost:80>, <https://localhost:443>
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

**One-shot install:** `aifabrix setup` runs fresh install or a three-option menu (re-install, wipe data, update images), pulls Docker images in every path, and stores **`platform-controller`** in config. See [Infrastructure Commands — aifabrix setup](commands/infrastructure.md#aifabrix-setup).

### up-dataplane
Register/rotate, deploy to controller, then run dataplane locally in the **dev** runtime environment. Requires `aifabrix login` first.
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

**Miso Controller:**
```bash
aifabrix create miso-controller --port 3000 --database --redis --template miso-controller
aifabrix build miso-controller
aifabrix run miso-controller
```

Use the admin password from your setup wizard when signing in to custom template instances.

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
Technically yes (connection strings in an app’s `env.template`), but **not recommended** for local setup. `aifabrix setup` / `up-infra` provision Postgres and Redis on a shared Docker network with fixed service names and ports that platform apps expect. Pointing apps at external databases breaks that contract unless you replicate networking and naming yourself. For managed infrastructure and an **ISO 27001–ready** install path, use **Azure Marketplace** deployment instead of mixing external databases with the local Docker installer.

**How much disk space?**  
Base infra: ~0.5–1.5 GB for images; ~256 MB–1 GB RAM when running (more if pgAdmin, Redis Commander, or Traefik are enabled).

**Dev vs pro setup vs dev/tst/pro login environment?**  
Setup **dev/pro** = installation profile on your machine. Login **`--environment dev|tst|pro`** = which controller/dataplane target you use after install. Same words, different step in the workflow.

---

## Troubleshooting

| Issue | Action |
| ----- | ------ |
| Port 5432 already in use | Stop other Postgres or use `--developer` for different ports |
| Port 6379 already in use | Stop other Redis |
| Docker not running | Start Docker Desktop, then run `aifabrix setup` or `aifabrix up-infra` again |
| Cannot connect to Docker daemon | Ensure Docker Desktop is running and you’re logged in |
| Containers start but apps can’t connect | Run `aifabrix doctor` to check connectivity |
| UI login fails after password change | Re-run setup **re-install** mode or `down-infra -v` then `aifabrix setup` so DB volume matches `admin-secrets.env` |
| Wrong controller / CLI cannot reach Miso | Check **`platform-controller`** in `config.yaml` or the **Platform Ready** footer; run `aifabrix login` against that URL, or **update images** mode |
| Lost pro autogenerated passwords | They are only shown once; re-run setup re-install with pro autogen or set passwords via `up-infra` role flags when supported |
