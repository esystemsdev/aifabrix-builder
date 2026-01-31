# Application Management Commands

← [Back to Commands Index](README.md) | [Back to Quick Start](../quick-start.md)

Application management commands for registering and managing applications with the Miso Controller.

---

<a id="aifabrix-show-appkey"></a>
## aifabrix show <appKey>

Show application info from local builder/ or integration/ folder (offline) or from the controller (with `--online`).

**What:** By default loads and displays app info from the local **builder/** or **integration/** folder (offline). With `--online` it fetches application data from the controller. Output clearly indicates whether the source is offline or online. Does not run schema validation — use `aifabrix validate` for that.

**When:** To inspect application key, type, roles, permissions, authentication, portal input configurations, and databases; or to compare local config with what is on the controller.

**Usage:**
```bash
# Offline: show from local builder/ or integration/ (variables.yaml)
aifabrix show myapp

# Online: fetch from controller (requires login)
aifabrix show myapp --online

# JSON output (for scripting)
aifabrix show myapp --json
aifabrix show myapp --online --json
```

**Arguments:**
- `<appKey>` - Application key (e.g. app name or external system key)

**Options:**
- `--online` - Fetch application data from the controller (requires `aifabrix login`)
- `--json` - Output a single JSON object to stdout

**Output:**
- **Offline:** First line is `Source: offline (builder/myapp/variables.yaml)` or the actual path (e.g. `integration/myapp/variables.yaml`). Then Application (key, display name, description, type, deployment, image, registry, port, health, build), Roles, Permissions, Authentication, Portal input configurations, Databases. For type **external**, also shows External integration (schemaBasePath, systems, dataSources) and a hint to run with `--online` for dataplane data.
- **Online:** First line is `Source: online (https://controller.example.com)`. Then application details from the controller API; for type **external**, a section **External system (dataplane)** with system key, display name, type, status, dataSources, application summary, and OpenAPI files/endpoints when available.

**Exit codes:** `0` on success; `1` if variables.yaml not found or invalid YAML (offline), or on auth failure / 404 / API error (online).

---

## aifabrix app

Application management commands for registering and managing applications with the Miso Controller.

<a id="aifabrix-app-register-appkey"></a>
### aifabrix app register <appKey>

Register application and get pipeline credentials.

**What:** Registers an application with the controller and retrieves ClientId and ClientSecret for CI/CD deployments.

**When:** First time setting up automated deployments, before adding GitHub Actions workflows.

This command uses the active `controller` and `environment` from `config.yaml` (set via `aifabrix login` or `aifabrix auth config`).

**Usage:**
```bash
# Register application (uses controller and environment from config)
aifabrix app register myapp

# Register with overrides
aifabrix app register myapp --port 8080 --name "My Application"
```

**Arguments:**
- `<appKey>` - Application key (identifier)

**Options:**
- `-p, --port <port>` - Override application port (container/Docker image port; used as base for URL when no `--url`)
- `-u, --url <url>` - Application URL. If omitted: `app.url`, `deployment.dataplaneUrl`, or `deployment.appUrl` in variables.yaml; else `http://localhost:{build.localPort or port}`. For a **localhost** controller, both the **port** sent to the controller and the fallback URL use the **developer-ID–adjusted Docker/exposed port** (base + developerId×100), e.g. developer 01 with base 3001 → port `3101`, URL `http://localhost:3101`. For non-localhost, `port` is the container port from variables (or `--port`).
- `-n, --name <name>` - Override display name
- `-d, --description <desc>` - Override description

**Controller URL Resolution:** `config.controller` → device tokens → developer ID–based default (see [Configuration](configuration.md)).

**Error Messages:**

All error messages will show the controller URL that was used or attempted, helping with debugging:
```yaml
❌ Authentication Failed

Controller URL: https://controller.aifabrix.dev

Your authentication token is invalid or has expired.
...
```

**Process:**
1. Reads `builder/{appKey}/variables.yaml`
2. If missing, creates minimal configuration automatically
3. Validates required fields
4. Registers with Miso Controller
5. Returns ClientId and ClientSecret
6. Updates `env.template` with new credentials (for localhost scenarios)
7. Regenerates `.env` file with updated credentials (for localhost scenarios)
8. **Note:** Credentials are displayed but not automatically saved. Copy them to your secrets file or GitHub Secrets.

**Output:**
```yaml
✓ Application registered successfully!

📋 Application Details:
   ID:           app-123
   Key:          myapp
   Display Name: My App

🔑 CREDENTIALS (save these immediately):
   Client ID:     ctrl-dev-myapp
   Client Secret: x7K9mP2nQ4vL8wR5tY1uE3oA6sD9fG2hJ4kM7pN0qT5

⚠️  IMPORTANT: Client Secret will not be shown again!

✓ .env file updated with new credentials

📝 Add to GitHub Secrets:
   MISO_CLIENTID = ctrl-dev-myapp
   MISO_CLIENTSECRET = x7K9mP2nQ4vL8wR5tY1uE3oA6sD9fG2hJ4kM7pN0qT5
   MISO_CONTROLLER_URL = http://localhost:3000
```

**Issues:**
- **"Not logged in"** → Run `aifabrix login` first
- **"Missing required fields"** → Update variables.yaml with app.key, app.name
- **"Registration failed"** → Check environment ID and controller URL

---

### aifabrix app list

List applications in an environment.

**What:** Displays all registered applications for a specific environment.

This command uses the active `controller` and `environment` from `config.yaml` (set via `aifabrix login` or `aifabrix auth config`).

**Usage:**
```bash
aifabrix app list
```

**Controller URL Resolution:** `config.controller` → device tokens → developer ID–based default (see [Configuration](configuration.md)).

**Error Messages:**

Error messages include the controller URL for debugging:
```yaml
❌ Failed to list applications from controller: https://controller.aifabrix.dev
Error: Network timeout
```

**Output:**

When applications are found:
```yaml
📱 Applications in dev environment (https://controller.aifabrix.dev):

✓ myapp - My Application (active) (URL: https://myapp.example.com, Port: 8080)
✗ otherapp - Other Application (inactive) (URL: https://otherapp.example.com)
✓ anotherapp - Another Application (running) (Port: 3000)
```

When no applications are found:
```yaml
📱 Applications in dev environment (https://controller.aifabrix.dev):

  No applications found in this environment.
```

**Output Format:**
- **✓** indicates pipeline is active, **✗** indicates pipeline is inactive
- Application key is displayed in cyan
- Application display name follows the key
- Status is shown in parentheses (active, inactive, running, unknown, etc.)
- URL and Port are shown in blue if available (format: `(URL: {url}, Port: {port})`)
- Environment name is included in the header

**Issues:**
- **"Not logged in"** → Run `aifabrix login` first
- **"Failed to fetch"** → Check environment ID and network connection

---

### aifabrix app rotate-secret

Rotate pipeline ClientSecret for an application.

**What:** Generates a new ClientSecret, invalidating the old one. Updates `env.template` and regenerates `.env` file with new credentials (for localhost scenarios). Use when credentials are compromised or need rotation.

This command uses the active `controller` and `environment` from `config.yaml` (set via `aifabrix login` or `aifabrix auth config`).

**Usage:**
```bash
aifabrix app rotate-secret myapp
```

**Arguments:**
- `<appKey>` - Application key (required, positional)

**Controller URL Resolution:** Same as `app list` (see [Configuration](configuration.md)).

**Error Messages:**

Error messages include the controller URL for debugging:
```yaml
❌ Failed to rotate secret via controller: https://controller.aifabrix.dev
Error: Application not found
```

**Process:**
1. Validates application key and environment
2. Rotates ClientSecret via Miso Controller API
3. Updates `env.template` with new credentials (for localhost scenarios)
4. Regenerates `.env` file with updated credentials (for localhost scenarios)
5. Displays new credentials

**Output:**
```yaml
⚠️  This will invalidate the old ClientSecret!

✓ Secret rotated successfully!

📋 Application Details:
   Key:         myapp
   Environment: dev

🔑 NEW CREDENTIALS:
   Client ID:     ctrl-dev-myapp
   Client Secret: new-secret-789

✓ .env file updated with new credentials

⚠️  Old secret is now invalid. Update GitHub Secrets!
```

**Issues:**
- **"Not logged in"** → Run `aifabrix login` first
- **"Environment is required"** → Run `aifabrix login` or `aifabrix auth config --set-environment <env>`
- **"Rotation failed"** → Check application key and permissions

