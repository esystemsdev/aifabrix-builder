# Application Management Commands

← [Documentation index](../README.md) · [Commands index](README.md)

Application management commands for registering and managing applications with the Miso Controller.

---

<a id="aifabrix-show-app"></a>
## aifabrix show <app>

Show application info from local builder/ or integration/ folder (offline) or from the controller (with `--online`).

**What:** By default loads and displays app info from the local **builder/** or **integration/** folder (offline). The CLI resolves the app path by checking **`integration/<systemKey>`** first, then **`builder/<appKey>`**; if neither exists, it errors. With `--online` it fetches application data from the controller. Output clearly indicates whether the source is offline or online. Does not run schema validation — use `aifabrix validate` for that.

**When:** To inspect application key, type, roles, permissions, authentication, portal input configurations, and databases; or to compare local config with what is on the controller.

**Usage:**
```bash
# Offline: show from local builder/ or integration/ (application.yaml)
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

**Permissions (online):** Controller access and `applications:read` (or environment-scoped application read). See [Online Commands and Permissions](permissions.md).

**Output:**
- **Offline:** First line is `Source: offline (builder/myapp/application.yaml)` or the actual path (e.g. `integration/myapp/application.yaml`). Then Application (key, display name, description, type, deployment, image, registry, port, health, build), Roles, Authentication, Portal input configurations, Databases. Permissions are not shown by default; use `aifabrix app show <app> --permissions` to see only permissions. For type **external**, also shows External integration (schemaBasePath, systems, dataSources) and a hint to run `aifabrix show <app> --online` or `aifabrix app show <app>` for dataplane data.
- **Online:** First line is `Source: online (https://controller.example.com)`. Then application details from the controller API. For type **external**, the Application section shows **Status** (application status from the controller), **Dataplane Status** (from the dataplane system endpoint), and **Version** when available; it omits port, image, registry, build, URL, and internal URL. For type **external**, a section **External system (dataplane)** shows: credentialId, status, version, showOpenApiDocs, mcpServerUrl, apiDocumentUrl, openApiDocsPageUrl, dataSources, application summary, OpenAPI files/endpoints when available, and **Service links** (OpenAPI docs page URL when provided by dataplane, plus REST OpenAPI and MCP docs URLs). Online external data is fetched from the controller and from the dataplane.

**Exit codes:** `0` on success; `1` if application.yaml not found or invalid YAML (offline), or on auth failure / 404 / API error (online).

**See also:** To show application data from the controller only (online), you can use [aifabrix app show \<appKey\>](#aifabrix-app-show-appkey), which is equivalent to `aifabrix show <app> --online`.

---

## aifabrix app

Application management commands for registering and managing applications with the Miso Controller.

<a id="aifabrix-app-show-appkey"></a>
### aifabrix app show <app>

Show application from the controller (online). Same as `aifabrix show <app> --online`.

**What:** Fetches and displays application data from the controller. Use this when you want to see the registered app and, for **external** type, dataplane details (External system section, dataSources, OpenAPI/MCP links) without using the top-level `show` command with `--online`.

**When:** To inspect what is on the controller for an app (e.g. `dataplane`); to see external system data as on the dataplane.

**Usage:**
```bash
# Show application from controller (requires login)
aifabrix app show dataplane

# JSON output (for scripting)
aifabrix app show dataplane --json

# Show only list of permissions
aifabrix app show dataplane --permissions

# Permissions as JSON (for scripting)
aifabrix app show dataplane --permissions --json
```

**Arguments:**
- `<appKey>` - Application key (e.g. `dataplane`, or any registered app key)

**Options:**
- `--online` - Fetch from controller (default for this command; accepted for UX parity with `aifabrix show <app> --online`)
- `--json` - Output a single JSON object to stdout
- `--permissions` - Show only list of permissions

**Permissions:** Controller access and `applications:read` (or environment-scoped app access). For external type, Dataplane may be called and requires `external-system:read`. See [Online Commands and Permissions](permissions.md).

**Output:** Same as [aifabrix show \<appKey\>](#aifabrix-show-app) with `--online`: source line `Source: online (controller URL)`, Application details (for type **external**: Status, Dataplane Status, and Version when present; deployment-related fields omitted), and for type **external** the **External system (dataplane)** section with credentialId, status, version, showOpenApiDocs, mcpServerUrl, apiDocumentUrl, openApiDocsPageUrl, dataSources, and service links. The **Permissions** section is shown only when `--permissions` is set.

**Exit codes:** `0` on success; `1` on auth failure, 404, or API error (requires `aifabrix login`).

---

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
- `-u, --url <url>` - Application URL. If omitted: `app.url`, `deployment.dataplaneUrl`, or `deployment.appUrl` in application.yaml; else `http://localhost:{port}`. For a **localhost** controller, both the **port** sent to the controller and the fallback URL use the **developer-ID–adjusted Docker/exposed port** (base + developerId×100), e.g. developer 01 with base 3001 → port `3101`, URL `http://localhost:3101`. For non-localhost, `port` is the container port from variables (or `--port`).
- `-n, --name <name>` - Override display name
- `-d, --description <desc>` - Override description

**Controller URL Resolution:** `config.controller` → device tokens → developer ID–based default (see [Configuration](../configuration/README.md)).

**Error Messages:**

All error messages will show the controller URL that was used or attempted, helping with debugging:
```yaml
❌ Authentication Failed

Controller URL: https://controller.aifabrix.dev

Your authentication token is invalid or has expired.
...
```

**Process:**
1. Reads `builder/{appKey}/application.yaml`
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
- **"Missing required fields"** → Update application.yaml with app.key, app.name
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

**Controller URL Resolution:** `config.controller` → device tokens → developer ID–based default (see [Configuration](../configuration/README.md)).

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
  To show details for an app: aifabrix app show <app>
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
- A hint line shows how to view details: `aifabrix app show <app>`

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

**Controller URL Resolution:** Same as `app list` (see [Configuration](../configuration/README.md)).

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

---

<a id="aifabrix-integration-client-create"></a>
### aifabrix integration-client create

Create an integration client and receive a **one-time** client secret.

**What:** Registers an integration client with the Miso Controller using a stable key, display name, redirect URIs, and optional groups. The response includes `clientId` (Keycloak client id) and `clientSecret`; the secret is returned only on create and must be saved immediately.

**When:** You need a machine identity (CI, Postman OAuth2, API client) with OAuth2 redirect URIs and optional RBAC groups.

**Usage:**
```bash
# Create (key, display-name, redirect-uris required; group-names optional)
aifabrix integration-client create --key api-client-001 --display-name "API client" \
  --redirect-uris "https://app.example.com/callback" \
  --group-names "AI-Fabrix-Developers"

# Postman OAuth2 (use printed clientId/clientSecret in Postman)
aifabrix integration-client create --key postman --display-name "Postman" \
  --redirect-uris https://oauth.pstmn.io/v1/callback \
  --group-names AI-Fabrix-Platform-Admins

# Optional description, fixed Keycloak client id, multiple URIs/groups
aifabrix integration-client create --key ci-pipeline --display-name "CI Pipeline" \
  --redirect-uris "https://a.com/cb,https://oauth.pstmn.io/v1/callback" \
  --group-names "AI-Fabrix-Developers,my-api-group" \
  --keycloak-client-id miso-ci -d "For pipelines"
```

**Options:**
- `--controller <url>` - Controller URL (default: from config)
- `-k, --key <key>` - Stable key: lowercase letters, digits, hyphens (required)
- `-n, --display-name <name>` - Display name (required)
- `--redirect-uris <uris>` - Comma-separated redirect URIs for OAuth2 (required, min 1)
- `--group-names <names>` - Comma-separated group names (optional; omit for OAuth-only clients)
- `--keycloak-client-id <id>` - Optional fixed Keycloak client id (server assigns if omitted)
- `-d, --description <description>` - Optional description

**Permissions:** Controller `integration-client:create`. See [Online Commands and Permissions](permissions.md).

**Output:** On success, prints `clientId`, `clientSecret`, and a warning: *Save this secret now; it will not be shown again.*

**Issues:**
- **"Key is required"** / invalid key format → Use `--key` with lowercase alphanumeric and hyphens (e.g. `my-ci-client`)
- **"Display name is required"** → Use `--display-name`
- **"redirect URI is required"** → Provide `--redirect-uris` (comma-separated)
- **"No authentication token"** → Run `aifabrix login` first
- **"Missing permission: integration-client:create"** → Your account needs the integration-client:create permission on the controller

---

<a id="aifabrix-integration-client-list"></a>
### aifabrix integration-client list

List integration clients with optional pagination and search.

**What:** Fetches and displays integration clients from the controller in a table (id, key, display name, client id, status).

**When:** To see existing clients, find an ID for rotate-secret or update commands, or audit configuration.

**Usage:**
```bash
aifabrix integration-client list
aifabrix integration-client list --page 1 --page-size 20 --search "api"
aifabrix integration-client list --controller https://controller.example.com
```

**Options:** `--controller`, `--page`, `--page-size`, `--search`, `--sort`, `--filter`

**Permissions:** Controller `integration-client:read`. See [Online Commands and Permissions](permissions.md).

**Issues:** **"No authentication token"** → Run `aifabrix login`. **"Missing permission: integration-client:read"** → Your account needs the integration-client:read permission on the controller.

---

<a id="aifabrix-integration-client-rotate-secret"></a>
### aifabrix integration-client rotate-secret

Rotate (regenerate) the client secret for an integration client. The new secret is shown once only.

**What:** Calls the controller to regenerate the secret for the given integration client ID. The new `clientSecret` is printed once with the same one-time warning as on create.

**When:** A secret was compromised, expired, or you need to rotate credentials without creating a new client.

**Usage:**
```bash
aifabrix integration-client rotate-secret --id <uuid>
aifabrix integration-client rotate-secret --controller https://controller.example.com --id <uuid>
```

**Options:** `--controller`, `--id <uuid>` (required)

**Permissions:** Controller `integration-client:update`. See [Online Commands and Permissions](permissions.md).

**Output:** On success, prints the new `clientSecret` and: *Save this secret now; it will not be shown again.*

**Issues:** **"Integration client ID is required"** → Use `--id <uuid>`. **"Integration client not found"** → Check the ID. **"Missing permission: integration-client:update"** → Your account needs the integration-client:update permission on the controller.

---

<a id="aifabrix-integration-client-delete"></a>
### aifabrix integration-client delete

Deactivate an integration client.

**What:** Deactivates the integration client with the given ID. It can no longer be used for authentication.

**When:** Retiring an integration, CI identity, or API client.

**Usage:**
```bash
aifabrix integration-client delete --id <uuid>
aifabrix integration-client delete --controller https://controller.example.com --id <uuid>
```

**Options:** `--controller`, `--id <uuid>` (required)

**Permissions:** Controller `integration-client:delete`. See [Online Commands and Permissions](permissions.md).

**Issues:** **"Integration client ID is required"** → Use `--id <uuid>`. **"Integration client not found"** → Check the ID. **"Missing permission: integration-client:delete"** → Your account needs the integration-client:delete permission on the controller.

---

<a id="aifabrix-integration-client-update-groups"></a>
### aifabrix integration-client update-groups

Update group assignments for an integration client.

**What:** Sets the list of groups for the given integration client (replaces existing group assignments).

**When:** Changing which groups a client belongs to (e.g. after a role change).

**Usage:**
```bash
aifabrix integration-client update-groups --id <uuid> --group-names Group1,Group2
aifabrix integration-client update-groups --controller https://controller.example.com --id <uuid> --group-names AI-Fabrix-Developers
```

**Options:** `--controller`, `--id <uuid>` (required), `--group-names <names>` (comma-separated, required)

**Permissions:** Controller `integration-client:update`. See [Online Commands and Permissions](permissions.md).

**Issues:** **"Integration client ID is required"** → Use `--id <uuid>`. **"At least one group name is required"** → Use `--group-names <name1,name2,...>`. **"Missing permission: integration-client:update"** → Your account needs the integration-client:update permission on the controller.

---

<a id="aifabrix-integration-client-update-redirect-uris"></a>
### aifabrix integration-client update-redirect-uris

Update redirect URIs for an integration client.

**What:** Sets the list of OAuth2 redirect URIs for the given client (replaces existing URIs). The controller may merge in its own callback URL.

**When:** Adding or changing allowed redirect URIs (e.g. new app URL or environment).

**Usage:**
```bash
aifabrix integration-client update-redirect-uris --id <uuid> --redirect-uris https://app.example.com/callback
aifabrix integration-client update-redirect-uris --controller https://controller.example.com --id <uuid> --redirect-uris https://a.com/cb,https://b.com/cb
```

**Options:** `--controller`, `--id <uuid>` (required), `--redirect-uris <uris>` (comma-separated, required, min 1)

**Permissions:** Controller `integration-client:update`. See [Online Commands and Permissions](permissions.md).

**Issues:** **"Integration client ID is required"** → Use `--id <uuid>`. **"At least one redirect URI is required"** → Use `--redirect-uris <uri1,uri2,...>`. **"Missing permission: integration-client:update"** → Your account needs the integration-client:update permission on the controller.

