# Developer Isolation Commands

← [Back to Commands Index](README.md) | [Back to Your Own Applications](../your-own-applications.md)

Commands for managing developer isolation and port configuration.

---

<a id="aifabrix-dev-config"></a>
## aifabrix dev config

View or set developer ID for port isolation.

**What:** Displays current developer configuration (developer ID and calculated ports) or sets a new developer ID. Developer isolation allows multiple developers to run applications simultaneously on the same machine without port conflicts.

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
- `aifabrix-secrets` - Default secrets file path (default: `<home>/secrets.yaml`)
- `aifabrix-env-config` - Custom environment configuration file path

These variables are only shown if they are explicitly set in the configuration file. If not set, the Configuration section is omitted from the output.

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

