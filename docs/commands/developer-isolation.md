# Developer Isolation Commands

← [Documentation index](../README.md) · [Commands index](README.md)

Commands for managing developer isolation, port configuration, and **remote development**: onboard with **`dev init`**, then use **`dev refresh`**, **`dev add`**, and related commands once **`remote-server`** is set in config.

**Remote development:** `dev init` connects your machine to a Builder Server (using `--server`) and, on success, saves `remote-server` in `~/.aifabrix/config.yaml`. **`dev refresh`**, **`dev add`**, **`dev update`**, **`dev pin`**, **`dev delete`**, **`dev list`**, and **`dev down`** expect that onboarding has already completed (remote server URL and client certificate on disk). If you run those without a configured remote or certificate, the CLI shows: **"Remote server is not configured. Set remote-server and run \"aifabrix dev init\" first."**

---

<a id="aifabrix-dev-init"></a>
## aifabrix dev init

One-time onboarding to a **Builder Server**: verify connectivity, issue a client certificate, fetch server settings, and register SSH keys so Mutagen can sync without a password. On success, the CLI writes `remote-server` and saves certificates under `~/.aifabrix/certs/<developer-id>/`.

**When:** First connection to a dev Builder Server, or re-onboarding with a new PIN after your admin resets access.

**Usage:**
```bash
aifabrix dev init --developer-id 01 --server https://builder02.local --pin 123456

# Optional: add the server hostname to this machine’s hosts file (see below)
aifabrix dev init --developer-id 01 --server https://builder02.local --pin 123456 --add-hosts --hosts-ip 192.168.1.25

# Skip interactive prompts (untrusted CA + hosts confirmation)
aifabrix dev init --developer-id 01 --server https://builder02.local --pin 123456 -y --add-hosts --hosts-ip 192.168.1.25
```

**Options:**
- `--developer-id <id>` - Developer ID (same as `dev add`; e.g. `01`)
- `--server <url>` - Builder Server base URL (e.g. `https://builder02.local`)
- `--pin <pin>` - One-time PIN from your admin (`aifabrix dev pin <id>` on an admin machine)
- `-y, --yes` - When the server certificate is untrusted: auto-install the development CA without prompting. When combined with `--add-hosts`: also skip the confirmation before editing the hosts file
- `--no-install-ca` - Do not offer CA install; fail with manual instructions when the server certificate is untrusted
- `--add-hosts` - After showing brief guidance, optionally append to this computer’s **hosts file** so names resolve (e.g. to a LAN IP). Adds the hostname from `--server` and **`dev` + your `--developer-id` + `.` + that hostname** (e.g. `dev02.builder02.local` for id `02` and server `https://builder02.local`) on one line when applicable. Does **not** support wildcard entries (`*.zone`); see below
- `--hosts-ip <ip>` - IPv4 address to use for that hosts entry (skips DNS lookup and the interactive IP prompt when used with `--add-hosts`)

**Process (order):**
1. **Optional (`--add-hosts`):** Explain wildcard DNS vs hosts file; resolve or ask for an IP; confirm **(y/n)** before appending to the hosts file (unless `-y`). Writing the hosts file often requires an **elevated** terminal (Administrator on Windows, `sudo` on macOS/Linux). If the write fails, the CLI prints a command you can run manually with admin rights. After this step, the CLI prints **your per-developer URL** (e.g. `https://dev02.builder02.local` when `--developer-id` is `02`), using the same scheme and port as `--server`.
2. **Trust and reachability:** Health check to the Builder Server. If the certificate is not trusted, see **Untrusted certificate** below.
3. **Certificate:** Request and save client cert and key; save **`ca.pem`** when the server provides a root CA (or reuse the CA fetched during install-ca) so later CLI commands and remote Docker can trust the same chain.
4. **Config:** Merge remote settings into `~/.aifabrix/config.yaml` and set `remote-server`.
5. **SSH key:** Register your public key for Mutagen sync when the server accepts it.

**Local name resolution (`--add-hosts`):** Wildcard names such as `*.builder02.local` cannot be represented in the hosts file; use **real DNS** (router, internal DNS, Pi-hole, etc.) for that. This option adds a line mapping the **hostname from `--server`** and, when you use `--developer-id`, **`devNN` + that hostname** (e.g. `192.168.1.25 builder02.local dev02.builder02.local`) so per-developer hostnames resolve without wildcard DNS. **Default `dev init` (without `--add-hosts`) does not change the hosts file and does not require administrator rights for that step.**

**Untrusted certificate (typical on local Builder Servers):** If the health check fails because the certificate is self-signed or signed by a private root, the CLI can offer to download the development root CA from **`{server}/install-ca`**, install it into the **OS trust store** (helps browsers and some tools), and retry. Separately, the CLI keeps a copy as **`ca.pem`** next to your client cert so **its own** connections to that Builder Server keep working (the OS store alone is not always enough for the Node-based CLI). Use `--yes` to auto-accept CA install, or `--no-install-ca` to stop with instructions to install the CA manually. On Linux, full trust-store install may need `sudo`; see **`{server}/install-ca-help`** if offered.

**Administrator rights:** Ordinary `dev init` **does not require admin**. Admin (or `sudo`) may be needed only if you use **`--add-hosts`** and the OS blocks writing the hosts file, or on some Linux setups when installing the CA into the system bundle.

**See Also:** [Secrets and config](../configuration/secrets-and-config.md) (remote-server, docker-endpoint), [Developer Isolation Guide](../developer-isolation.md).

---

<a id="aifabrix-dev-refresh"></a>
## aifabrix dev refresh (remote only)

Fetch settings from the Builder Server and update config. Optionally refresh your client certificate.

**What:** If your certificate expires **within 14 days** (or expiry cannot be read), the CLI automatically refreshes it: creates a new PIN, requests a new certificate, saves the new cert and key, then fetches settings and merges into config. Otherwise it fetches settings from the server (cert-authenticated) and updates `~/.aifabrix/config.yaml` (e.g. `user-mutagen-folder`, `docker-endpoint`, `sync-ssh-host`, `sync-ssh-user`). If the server does not return `docker-endpoint` or `sync-ssh-host`, the CLI derives them from `remote-server` (hostname and `tcp://<host>:2376`).

**When:** Use when `docker-endpoint` or `sync-ssh-host` are **(not set)** after `dev init`, after the server’s settings have changed, or to renew your certificate before it expires (automatic when < 14 days remaining, or use `--cert` to force).

**Usage:**
```bash
aifabrix dev refresh
aifabrix dev refresh --cert   # Force certificate refresh even when cert is still valid
```

**Options:** `--cert` – Force certificate refresh (create PIN + issue-cert) even when the certificate is still valid for 14+ days.

**Requirements:** `remote-server` must be set and a client certificate must exist (from a successful `aifabrix dev init`). Certificate refresh requires a **valid** current cert (so you can create your own PIN); if your cert is already expired, an admin must create a PIN for you and you use `aifabrix dev init --pin <pin>`.

**See Also:** [aifabrix dev show](#aifabrix-dev-show) (view config after refresh), [aifabrix dev init](#aifabrix-dev-init).

---

<a id="aifabrix-dev-add-update-pin-delete-list"></a>
## aifabrix dev add / update / pin / delete / list (remote only)

Manage developers on the remote server. **Only when `remote-server` is set**; no dev user API without a remote server. **Admin** role is required for **add**, **update**, **pin**, and **delete** (see group table below). **Dev list** is available with a valid client certificate to **admin** (full) and **developer** (read-only list of users). **Secret-manager** does not use these user-management commands; it uses shared **secret** commands instead.

- **dev add** – Create a new developer (profile on server).
- **dev update** – Patch an existing developer's profile.
- **dev pin** – Create a one-time PIN for onboarding. The CLI prints **two copy-paste commands** for the developer: a **standard** `dev init` line (when DNS or hosts already resolve the server hostname), and a **hosts-file** variant with `--add-hosts` (when the hostname does not resolve and DNS is not provided by the organisation). Optional **`--hosts-ip <IPv4>`** fills in the server’s LAN IP in that second command.
- **dev delete** – Remove a developer from the server.
- **dev list** – List developers (as returned by the API).

**Usage:**
```bash
aifabrix dev list
aifabrix dev add --developer-id <id> --name <name> --email <email> [--groups <items>]
aifabrix dev update [developerId] [--name <name>] [--email <email>] [--groups <items>]
aifabrix dev pin [developerId] [--hosts-ip <IPv4>]
aifabrix dev delete <developer-id>
```

**Setting groups:** Use a single `--groups` option with **comma-separated** values (no spaces between group names). API groups are **admin**, **secret-manager**, **developer**, and optionally **docker** (host sync only; see table). Examples:
```bash
# Give developer 06 both admin and secret-manager
aifabrix dev update 06 --groups admin,secret-manager

# Set only developer (default)
aifabrix dev update 06 --groups developer

# Developer with host docker group (socket-level Docker on server — grant sparingly)
aifabrix dev update 08 --groups developer,docker

# Add with multiple groups
aifabrix dev add --developer-id 07 --name "Jane" --email jane@example.com --groups admin,secret-manager
```

**Parameter alignment:** `dev add`, `dev update`, and `dev init` use the same option names: `--developer-id`, `--name`, `--email`, `--groups` (and `--server`, `--pin` for init). For `dev update` you can pass the developer ID either as a positional argument or with `--developer-id`.

| Group | Capabilities |
| ------- | -------------- |
| **admin** | All dev and secrets endpoints (list/create/update/delete users, create PIN for any user, list/add/delete secrets). |
| **secret-manager** | Secrets only: list, add, delete. No user management or PIN creation. |
| **developer** | List users (read-only), create PIN for **self** only, get own settings, manage own SSH keys. No create/update/delete users, no secrets. |
| **docker** | Not an API capability: optional flag on a user so the host sync job adds the OS user `dev<id>` to the Linux `docker` group (socket-level Docker on the server). Does not grant extra HTTP routes; combine with **developer** (or another API group). Host membership in `docker` is highly sensitive—treat like root. |

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

<a id="aifabrix-dev-set-format"></a>
## aifabrix dev set-format

Set default output format for commands that generate or convert external system files.

**What:** Persists the default format (`json` or `yaml`) in `~/.aifabrix/config.yaml`. When `--format` is not passed, the following commands use this config value (or fall back to `yaml` if not set):

| Command | Uses format when |
| -------- | ----------------- |
| `aifabrix download <systemKey>` | `--format` not passed |
| `aifabrix convert <app>` | `--format` not passed |
| `aifabrix create <app> --type external` | Always (no CLI `--format`; config drives file extensions) |
| `aifabrix wizard [system-key]` | Always (no CLI `--format`; config drives file extensions) |

For `create --type external` and `wizard`, the format determines whether generated files use `.yaml` or `.json` (e.g. `application.yaml` vs `application.json`, `*-system.yaml` vs `*-system.json`, `*-datasource-*.yaml` vs `*-datasource-*.json`).

**When:** Set your preferred format once; then `download`, `convert`, `create --type external`, and `wizard` will use it. Useful when you prefer JSON for all external system files.

**Usage:**
```bash
aifabrix dev set-format json
aifabrix dev set-format yaml
```

**Arguments:**
- `<format>` - `json` or `yaml` (case-insensitive)

**Output:** Confirms the format and displays full developer configuration (same as `aifabrix dev show`).

**See Also:** [aifabrix dev show](#aifabrix-dev-show), [aifabrix download](external-integration.md#aifabrix-download-system-key), [aifabrix convert](utilities.md#aifabrix-convert-app), [aifabrix create](application-development.md#aifabrix-create-app), [aifabrix wizard](external-integration.md#aifabrix-wizard), [Secrets and config](../configuration/secrets-and-config.md).

---

<a id="aifabrix-dev-show"></a>
## aifabrix dev show

Show developer configuration (ports and config vars).

**What:** Displays current developer ID, calculated ports (app, Postgres, Redis, pgAdmin, Redis Commander), and config vars (environment, controller, aifabrix-home, resolved home path, aifabrix-work, resolved `AIFABRIX_WORK`, aifabrix-secrets, aifabrix-env-config, etc.).

**When:** After `dev refresh` or to verify your developer isolation settings.

**Usage:**
```bash
aifabrix dev show
```

**See Also:** [aifabrix dev set-id](#aifabrix-dev-set-id), [aifabrix dev set-format](#aifabrix-dev-set-format).

---

<a id="aifabrix-dev-set-id"></a>
## aifabrix dev set-id

Set developer ID for port isolation.

**What:** Sets the developer ID in `~/.aifabrix/config.yaml` and sets `AIFABRIX_DEVELOPERID` in the environment. Developer ID 0 = default infrastructure (base ports), 1+ = developer-specific (offset ports). After setting, displays the same output as `aifabrix dev show`.

**When:** Setting up developer isolation or switching between developers on the same machine.

**Usage:**
```bash
# Set developer ID to 01 (leading zeros preserved)
aifabrix dev set-id 01

# Set developer ID to 2
aifabrix dev set-id 2
```

**See Also:** [aifabrix dev show](#aifabrix-dev-show), [aifabrix dev set-format](#aifabrix-dev-set-format).

---

<a id="aifabrix-dev-set-env-config"></a>
## aifabrix dev set-env-config

Set the path to the env-config file in `config.yaml`.

**What:** Writes `aifabrix-env-config` to `~/.aifabrix/config.yaml`. This path is used by up-miso/up-dataplane to resolve `AIFABRIX_BUILDER_DIR` and load env config (e.g. for builder directory override).

If the value is a **relative** path, the CLI resolves it against **`aifabrix-work`** from the same config, or the effective workspace root from **`AIFABRIX_WORK`** / `aifabrix-work` on disk (same rules as `aifabrix dev set-work`), **before** falling back to `aifabrix-home` or the effective Fabrix home (same rules as `aifabrix dev set-home`). It does **not** use the current working directory as the anchor.

**Usage:**
```bash
aifabrix dev set-env-config /path/to/env-config.yaml
```

---

<a id="aifabrix-dev-set-home"></a>
## aifabrix dev set-home

Set the aifabrix-home path in `config.yaml`.

**What:** Writes `aifabrix-home` to `config.yaml` (under your AI Fabrix config directory). Overrides the default AI Fabrix home directory (used for applications base path when developer ID is set). Unless you pass **`--no-register-env`**, the CLI also updates **AIFABRIX_HOME** (and refreshes the paired shell env file / user env so **AIFABRIX_WORK** stays aligned with config). Open a new terminal after registration.

**Usage:**
```bash
aifabrix dev set-home /path/to/aifabrix-home
aifabrix dev set-home ""            # clear override
aifabrix dev set-home /path --no-register-env   # config only
```

**See Also:** [aifabrix dev set-work](#aifabrix-dev-set-work), [aifabrix dev print-home](#aifabrix-dev-print-home), [aifabrix dev show](#aifabrix-dev-show).

---

<a id="aifabrix-dev-set-work"></a>
## aifabrix dev set-work

Set the optional workspace root (`aifabrix-work`) in `config.yaml`.

**What:** Stores a normalized absolute path as **`aifabrix-work`** (default clone / repo root). This is separate from **`aifabrix-home`** (secrets, infra, `~/.aifabrix`-style state stay on home unless you set them there). Clearing uses an empty path argument. Unless you pass **`--no-register-env`**, the CLI registers **AIFABRIX_WORK** for new shells (Windows user env or POSIX `aifabrix-shell-env.sh` + profile snippet). **`AIFABRIX_WORK`** in the environment overrides the YAML value when resolving the workspace.

**Usage:**
```bash
aifabrix dev set-work /path/to/git-workspace
aifabrix dev set-work "" --no-register-env
```

**See Also:** [aifabrix dev set-home](#aifabrix-dev-set-home), [aifabrix dev print-work](#aifabrix-dev-print-work), [Secrets and config](../configuration/secrets-and-config.md).

---

<a id="aifabrix-dev-print-home"></a>
## aifabrix dev print-home

Print the resolved **AIFABRIX_HOME** path to stdout (no colors); intended for scripts.

**Usage:**
```bash
aifabrix dev print-home
```

**See Also:** [aifabrix dev print-work](#aifabrix-dev-print-work).

---

<a id="aifabrix-dev-print-work"></a>
## aifabrix dev print-work

Print the resolved workspace path to stdout, or a single empty line if unset (no implicit default). No colors.

**See Also:** [aifabrix dev set-work](#aifabrix-dev-set-work).

**Output (view):**
```yaml
🔧 Developer Configuration

Developer ID: 01

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

Developer ID: 01

Ports:
  App: 3100
  Postgres: 5532
  Redis: 6479
  pgAdmin: 5150
  Redis Commander: 8181

Configuration:
  environment: 'dev'
  controller: 'http://localhost:3100'
  format: 'yaml'
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
- `aifabrix-home` - Base directory for AI Fabrix local files (default: `~/.aifabrix`); **aifabrix-home (resolved)** shows the path after env/yaml resolution
- `aifabrix-work` - Optional workspace root for git repos (unset if not configured); **AIFABRIX_WORK (resolved)** shows env override or yaml (or “not set”)
- `aifabrix-secrets` - Default secrets file path or `http(s)://` URL for remote shared secrets (default: `<home>/secrets.yaml`)
- `aifabrix-env-config` - Custom environment configuration file path

**Remote development variables** (when `remote-server` is set):
- `remote-server` - SSH host for remote Docker and Mutagen
- `docker-endpoint` - Docker API endpoint on the remote host

All dev APIs (settings, secrets, sync) use certificate (mTLS) authentication when remote is configured.

**Remote Docker (docker-endpoint):** The Docker CLI requires `cert.pem`, `key.pem`, and **`ca.pem`** in `~/.aifabrix/certs/<developer-id>/`. If the Builder Server includes a CA in the issue-cert response (`caCertificate` or `ca`), it is saved as `ca.pem` during `aifabrix dev init`. If `ca.pem` is missing, the CLI does not set `DOCKER_CERT_PATH` and Docker commands use the local daemon. To use remote Docker, ensure the server provides the CA or add `ca.pem` manually to the cert directory. These variables are only shown if they are explicitly set. If not set, the Configuration section is omitted from the output.

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

