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

<a id="aifabrix-service-user-create"></a>
### aifabrix service-user create

Create a service user for an integration and receive a **one-time** client secret.

**What:** Creates a service user in the Miso Controller with username, email, redirect URIs, and group IDs. The response includes `clientId` and `clientSecret`; the secret is returned only on create and must be saved immediately—no other endpoint returns it again.

**When:** You need a dedicated service account (e.g. for CI, an integration, Postman OAuth2, or another API client) with OAuth2 redirect URIs and group assignments.

**Usage:**
```bash
# Create service user (username, email, redirect-uris, group-names required)
aifabrix service-user create --username api-client-001 --email api@example.com \
  --redirect-uris "https://app.example.com/callback" \
  --group-names "AI-Fabrix-Developers"

# Postman: create a service user for OAuth2 in Postman (use clientId/clientSecret in Postman's OAuth 2.0 settings)
aifabrix service-user create -u postman -e postman@aifabrix.dev \
  --redirect-uris https://oauth.pstmn.io/v1/callback \
  --group-names AI-Fabrix-Platform-Admins

# With optional description and multiple URIs/names (comma-separated)
aifabrix service-user create -u "CI Pipeline" -e ci@example.com \
  --redirect-uris "https://a.com/cb,https://oauth.pstmn.io/v1/callback" --group-names "AI-Fabrix-Developers,my-api-group" -d "For pipelines"
```

**Options:**
- `--controller <url>` - Controller URL (default: from config)
- `-u, --username <username>` - Service user username (required)
- `-e, --email <email>` - Email address (required)
- `--redirect-uris <uris>` - Comma-separated redirect URIs for OAuth2 (required, min 1)
- `--group-names <names>` - Comma-separated group names (required, e.g. AI-Fabrix-Developers)
- `-d, --description <description>` - Optional description

**Permissions:** Controller `service-user:create`. See [Online Commands and Permissions](permissions.md).

**Output:** On success, prints `clientId`, `clientSecret`, and a warning: *Save this secret now; it will not be shown again.*

**Issues:**
- **"Username is required"** / **"Email is required"** → Provide `--username` and `--email`
- **"redirect URI is required"** / **"group name is required"** → Provide `--redirect-uris` and `--group-names` (comma-separated)
- **"No authentication token"** → Run `aifabrix login` first
- **"Missing permission: service-user:create"** → Your account needs the service-user:create permission on the controller

---

<a id="aifabrix-service-user-list"></a>
### aifabrix service-user list

List service users with optional pagination and search.

**What:** Fetches and displays service users from the controller in a table (id, username, email, clientId, active).

**When:** To see existing service users, find an ID for rotate-secret or update commands, or audit assigned groups and clients.

**Usage:**
```bash
aifabrix service-user list
aifabrix service-user list --page 1 --page-size 20 --search "api"
aifabrix service-user list --controller https://controller.example.com
```

**Options:** `--controller`, `--page`, `--page-size`, `--search`, `--sort`, `--filter`

**Permissions:** Controller `service-user:read`. See [Online Commands and Permissions](permissions.md).

**Issues:** **"No authentication token"** → Run `aifabrix login`. **"Missing permission: service-user:read"** → Your account needs the service-user:read permission on the controller.

---

<a id="aifabrix-service-user-rotate-secret"></a>
### aifabrix service-user rotate-secret

Rotate (regenerate) the client secret for a service user. The new secret is shown once only.

**What:** Calls the controller to regenerate the secret for the given service user ID. The new `clientSecret` is printed once with the same one-time warning as on create.

**When:** A secret was compromised, expired, or you need to rotate credentials without creating a new service user.

**Usage:**
```bash
aifabrix service-user rotate-secret --id <uuid>
aifabrix service-user rotate-secret --controller https://controller.example.com --id <uuid>
```

**Options:** `--controller`, `--id <uuid>` (required)

**Permissions:** Controller `service-user:update`. See [Online Commands and Permissions](permissions.md).

**Output:** On success, prints the new `clientSecret` and: *Save this secret now; it will not be shown again.*

**Issues:** **"Service user ID is required"** → Use `--id <uuid>`. **"Service user not found"** → Check the ID. **"Missing permission: service-user:update"** → Your account needs the service-user:update permission on the controller.

---

<a id="aifabrix-service-user-delete"></a>
### aifabrix service-user delete

Deactivate a service user.

**What:** Deactivates the service user with the given ID. The user can no longer be used for authentication.

**When:** Retiring an integration, CI identity, or API client.

**Usage:**
```bash
aifabrix service-user delete --id <uuid>
aifabrix service-user delete --controller https://controller.example.com --id <uuid>
```

**Options:** `--controller`, `--id <uuid>` (required)

**Permissions:** Controller `service-user:delete`. See [Online Commands and Permissions](permissions.md).

**Issues:** **"Service user ID is required"** → Use `--id <uuid>`. **"Service user not found"** → Check the ID. **"Missing permission: service-user:delete"** → Your account needs the service-user:delete permission on the controller.

---

<a id="aifabrix-service-user-update-groups"></a>
### aifabrix service-user update-groups

Update group assignments for a service user.

**What:** Sets the list of groups for the given service user (replaces existing group assignments).

**When:** Changing which groups a service user belongs to (e.g. after a role change).

**Usage:**
```bash
aifabrix service-user update-groups --id <uuid> --group-names Group1,Group2
aifabrix service-user update-groups --controller https://controller.example.com --id <uuid> --group-names AI-Fabrix-Developers
```

**Options:** `--controller`, `--id <uuid>` (required), `--group-names <names>` (comma-separated, required)

**Permissions:** Controller `service-user:update`. See [Online Commands and Permissions](permissions.md).

**Issues:** **"Service user ID is required"** → Use `--id <uuid>`. **"At least one group name is required"** → Use `--group-names <name1,name2,...>`. **"Missing permission: service-user:update"** → Your account needs the service-user:update permission on the controller.

---

<a id="aifabrix-service-user-update-redirect-uris"></a>
### aifabrix service-user update-redirect-uris

Update redirect URIs for a service user.

**What:** Sets the list of OAuth2 redirect URIs for the given service user (replaces existing URIs). The controller may merge in its own callback URL.

**When:** Adding or changing allowed redirect URIs (e.g. new app URL or environment).

**Usage:**
```bash
aifabrix service-user update-redirect-uris --id <uuid> --redirect-uris https://app.example.com/callback
aifabrix service-user update-redirect-uris --controller https://controller.example.com --id <uuid> --redirect-uris https://a.com/cb,https://b.com/cb
```

**Options:** `--controller`, `--id <uuid>` (required), `--redirect-uris <uris>` (comma-separated, required, min 1)

**Permissions:** Controller `service-user:update`. See [Online Commands and Permissions](permissions.md).

**Issues:** **"Service user ID is required"** → Use `--id <uuid>`. **"At least one redirect URI is required"** → Use `--redirect-uris <uri1,uri2,...>`. **"Missing permission: service-user:update"** → Your account needs the service-user:update permission on the controller.

