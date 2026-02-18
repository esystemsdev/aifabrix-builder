# Developer Isolation Commands

← [Documentation index](../README.md) · [Commands index](README.md)

Commands for managing developer isolation, port configuration, and **remote development** (when a remote server is configured).

**Remote-only commands:** `dev init`, `dev add`, `dev update`, `dev pin`, `dev delete`, `dev list`, and `dev down` are available **only when `remote-server` is set** in `~/.aifabrix/config.yaml`. Without a remote server, there is no dev user API or sync sessions to manage.

When you run `dev add`, `dev update`, `dev pin`, or `dev delete` without a configured remote, the CLI shows: **"Remote server is not configured. Set remote-server and run \"aifabrix dev init\" first."**

---

<a id="aifabrix-dev-init"></a>
## aifabrix dev init (remote only)

One-time setup for remote development: issue certificate, fetch server settings, and register SSH keys so Mutagen works without password.

**What:** When a remote server exists (`remote-server` in config), runs: issue-cert, then GET `/api/dev/settings`, then POST ssh-keys so Mutagen sync works. Only when `remote-server` is set.

**When:** First-time onboarding to a remote dev host, or after re-provisioning the server.

**Usage:**
```bash
aifabrix dev init

# With options (same parameter names as dev add)
aifabrix dev init --developer-id 01 --server my-remote-host --pin 123456
```

**Options:**
- `--developer-id <id>` - Developer ID (same as `dev add`; e.g. 01)
- `--server <url>` - Builder Server base URL (e.g. https://dev.aifabrix.dev)
- `--pin <pin>` - One-time PIN for onboarding (from your admin)

**Process:**
1. Issue or use existing client certificate (mTLS for dev APIs)
2. GET `/api/dev/settings` (cert-authenticated) to receive sync and Docker parameters
3. POST SSH keys so Mutagen can sync without password prompt

**See Also:** [Secrets and config](../configuration/secrets-and-config.md) (remote-server, docker-endpoint, aifabrix-workspace-root), [Developer Isolation Guide](../developer-isolation.md).

---

<a id="aifabrix-dev-add-update-pin-delete-list"></a>
## aifabrix dev add / update / pin / delete / list (remote only)

Manage developers on the remote server. **Only when `remote-server` is set**; no dev user API without a remote server. Admin or secret-manager role required for add/update/pin/delete.

- **dev add** – Create a new developer (profile on server).
- **dev update** – Patch an existing developer's profile.
- **dev pin** – Set or display a one-time PIN for onboarding (e.g. for `aifabrix dev init --pin`).
- **dev delete** – Remove a developer from the server.
- **dev list** – List developers (as returned by the API).

**Usage:**
```bash
aifabrix dev list
aifabrix dev add --developer-id <id> --name <name> --email <email> [--groups <items>]
aifabrix dev update [developerId] --developer-id <id> [--name <name>] [--email <email>] [--groups <items>]
aifabrix dev pin [developerId]
aifabrix dev delete <developer-id>
```

**Parameter alignment:** `dev add`, `dev update`, and `dev init` use the same option names: `--developer-id`, `--name`, `--email`, `--groups` (and `--server`, `--pin` for init). For `dev update` you can pass the developer ID either as a positional argument or with `--developer-id`.

**See Also:** [Developer Isolation Guide](../developer-isolation.md), [Secrets and config](../configuration/secrets-and-config.md).

---

<a id="aifabrix-dev-down"></a>
## aifabrix dev down (remote only)

Stop Mutagen sync sessions and optionally app containers.

**What:** When using remote development, stops sync sessions (and optionally app containers). Aligns with down-infra / down-app naming. Only when `remote-server` is set.

**When:** Cleaning up after remote dev, freeing resources on the remote host.

**Usage:**
```bash
aifabrix dev down

# Optionally stop app containers as well (syntax may vary; see CLI help)
aifabrix dev down --apps
```

**See Also:** [Infrastructure commands](infrastructure.md) (down-infra, down-app), [Developer Isolation Guide](../developer-isolation.md).

---

<a id="aifabrix-dev-config"></a>
## aifabrix dev config

View or set developer ID for port isolation.

**What:** Displays current developer configuration (developer ID and calculated ports) or sets a new developer ID. When **remote-server** is set and a certificate is available, config can be **refreshed from the server** via GET `/api/dev/settings` (cert-authenticated), which provides sync and Docker parameters. Developer isolation allows multiple developers to run applications simultaneously on the same machine without port conflicts.

**When:** Setting up developer isolation, checking current port assignments, troubleshooting port conflicts.

**Usage:**
```bash
# View current developer configuration
aifabrix dev config

# Set developer ID
aifabrix dev config --set-id 1

# Set developer ID to 2
aifabrix dev config --set-id 2
```

**Options:**
- `--set-id <id>` - Set developer ID (non-negative integer). Developer ID 0 = default infrastructure (base ports), 1+ = developer-specific (offset ports). Updates `~/.aifabrix/config.yaml` and sets `AIFABRIX_DEVELOPERID` environment variable.

**Output (view):**
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

**Output (view with configuration variables):**
```yaml
🔧 Developer Configuration

Developer ID: 1

Ports:
  App: 3100
  Postgres: 5532
  Redis: 6479
  pgAdmin: 5150
  Redis Commander: 8181

Configuration:
  environment: 'dev'
  controller: 'http://localhost:3100'
  aifabrix-home: /workspace/.aifabrix
  aifabrix-secrets: /workspace/aifabrix-miso/builder/secrets.local.yaml
  aifabrix-env-config: /workspace/aifabrix-miso/builder/env-config.yaml
```

**Output (set):**
```yaml
✓ Developer ID set to 1

🔧 Developer Configuration

Developer ID: 1

Ports:
  App: 3100
  Postgres: 5532
  Redis: 6479
  pgAdmin: 5150
  Redis Commander: 8181
```

**Output (set with configuration variables):**
```yaml
✓ Developer ID set to 1

🔧 Developer Configuration

Developer ID: 1

Ports:
  App: 3100
  Postgres: 5532
  Redis: 6479
  pgAdmin: 5150
  Redis Commander: 8181

Configuration:
  aifabrix-home: /workspace/.aifabrix
  aifabrix-secrets: /workspace/aifabrix-miso/builder/secrets.local.yaml
  aifabrix-env-config: /workspace/aifabrix-miso/builder/env-config.yaml
```

**Port Calculation:**
Ports are calculated using: `basePort + (developer-id * 100)`

- **Developer ID 0** (default): App=3000, Postgres=5432, Redis=6379, pgAdmin=5050, Redis Commander=8081
- **Developer ID 1**: App=3100, Postgres=5532, Redis=6479, pgAdmin=5150, Redis Commander=8181
- **Developer ID 2**: App=3200, Postgres=5632, Redis=6579, pgAdmin=5250, Redis Commander=8281

**How It Works:**
- Developer ID is stored in `~/.aifabrix/config.yaml` as `developer-id`
- Setting developer ID also sets `AIFABRIX_DEVELOPERID` environment variable
- All infrastructure and application commands use this developer ID for port calculation
- Each developer gets isolated Docker resources (containers, networks, volumes)

**Configuration Variables:**
The command displays configuration variables if they are set in `~/.aifabrix/config.yaml`:
- `aifabrix-home` - Base directory for AI Fabrix local files (default: `~/.aifabrix`)
- `aifabrix-secrets` - Default secrets file path or `http(s)://` URL for remote shared secrets (default: `<home>/secrets.yaml`)
- `aifabrix-env-config` - Custom environment configuration file path

**Remote development variables** (when `remote-server` is set):
- `aifabrix-workspace-root` - Path on the remote host used for sync and app code
- `remote-server` - SSH host for remote Docker and Mutagen
- `docker-endpoint` - Docker API endpoint on the remote host

All dev APIs (settings, secrets, sync) use certificate (mTLS) authentication when remote is configured. These variables are only shown if they are explicitly set. If not set, the Configuration section is omitted from the output.

**Configuration File:**
The developer ID is stored in `~/.aifabrix/config.yaml`:
```yaml
developer-id: 1
environment: dev
```

**Issues:**
- **"Developer ID must be a non-negative digit string"** → Use a valid integer (0, 1, 2, etc.)
- **"Port already in use"** → Try a different developer ID or check if another process is using the port
- **"Configuration file not found"** → The config file will be created automatically when setting developer ID

**Next Steps:**
After setting developer ID:
- Start infrastructure: `aifabrix up-infra` (or `aifabrix up-infra --developer <id>`)
- Run applications: `aifabrix run <app>` (uses developer-specific ports automatically)
- Check status: `aifabrix status` (shows developer-specific ports)

**See Also:**
- [Developer Isolation Guide](../developer-isolation.md) - Complete guide to developer isolation features

