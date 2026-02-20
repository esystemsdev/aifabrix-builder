# Application Development Commands

← [Documentation index](../README.md) · [Commands index](README.md)

Commands for creating, building, and running applications locally.

---

<a id="aifabrix-create-app"></a>
## aifabrix create <app>

Create new application with configuration files.

**What:** Generates `builder/` folder with `application.yaml`, `env.template`, `rbac.yaml`, and optional GitHub Actions workflows.

**When:** Starting a new application.

**Example (interactive):**
```bash
aifabrix create myapp
```
Prompts for: port, database, redis, storage, authentication, language.

**Example (with flags):**
```bash
aifabrix create myapp --port 3000 --database --language typescript
```

**Example (with GitHub workflows):**
```bash
aifabrix create myapp --port 3000 --database --github --main-branch main
```

**Example (with template):**
```bash
aifabrix create myapp --template miso-controller --port 3000
```

**Example (with GitHub steps):**
```bash
aifabrix create myapp --github --github-steps npm
```
**Note:** Step templates must exist in `templates/github/steps/{step}.hbs`. Currently available: `npm.hbs`

**Example (external system):**
```bash
aifabrix create hubspot --type external
```
Creates in `integration/<app>/`. Prompts for: system key, display name, description, system type (openapi/mcp/custom), authentication type (oauth2/apikey/basic), number of datasources. For other commands (validate, json, deploy, delete), the CLI always resolves the app by checking `integration/<app>` first, then `builder/<app>`; if neither exists, it errors. There is no option to override this order.

**Complete HubSpot example:**
See `integration/hubspot/` for a complete HubSpot integration with companies, contacts, and deals datasources. Includes OAuth2 authentication, field mappings, and OpenAPI operations.

→ [External Systems Guide](../external-systems.md) - Complete guide with step-by-step instructions

**Flags:**
- `-p, --port <port>` - Application port (default: 3000, not used for external type)
- `-d, --database` - Requires database (not used for external type)
- `-r, --redis` - Requires Redis (not used for external type)
- `-s, --storage` - Requires file storage (not used for external type)
- `-a, --authentication` - Requires authentication/RBAC (not used for external type)
- `-l, --language <lang>` - typescript or python (not used for external type)
- `-t, --template <name>` - Template to use (e.g., miso-controller, keycloak). Template folder must exist in `templates/{template}/`
- `--type <type>` - Application type: `webapp`, `api`, `service`, `functionapp`, or `external` (default: webapp)
- `--app` - Generate minimal application files (package.json, index.ts or requirements.txt, main.py) (not used for external type)
- `-g, --github` - (Optional) Generate GitHub Actions workflows
- `--github-steps <steps>` - Extra GitHub workflow steps (comma-separated, e.g., `npm`). Step templates must exist in `templates/github/steps/{step}.hbs`. When included, these steps are rendered and injected into workflow files (e.g., `release.yaml`). Available step templates: `npm.hbs` (adds NPM publishing job)
- `--main-branch <branch>` - Main branch name for workflows (default: main)

**Creates:**
- `builder/<app>/application.yaml` - Application configuration (regular apps)
- `builder/<app>/env.template` - Environment template with kv:// references
- `builder/<app>/rbac.yaml` - RBAC configuration (if authentication enabled)
- `builder/<app>/<appKey>-deploy.json` - Deployment manifest (e.g. `builder/myapp/myapp-deploy.json`)
- `builder/<app>/README.md` - Application documentation
- `.github/workflows/` - GitHub Actions workflows (if --github specified)

**External Type (`--type external`):**
When using `--type external`, the command creates an external system integration in `integration/<app>/`:
- `integration/<app>/application.yaml` - App configuration with `app.type: "external"` and `externalIntegration` block
- `integration/<app>/<systemKey>-system.yaml` - External system configuration
- `integration/<app>/<systemKey>-datasource-<datasource-key>.yaml` - Datasource YAML files (all in same folder)
- `integration/<app>/<systemKey>-deploy.json` - Deployment manifest (generated)
- `integration/<app>/env.template` - Environment variables template
- `integration/<app>/README.md` - Application documentation
- All files are in the same folder for easy viewing and management
- External systems use the pipeline API for deployment via Miso Controller

→ [External Systems Guide](../external-systems.md) - Complete guide with HubSpot example

**Environment File Conversion:**
- Automatically detects existing `.env` file in current directory
- Converts sensitive values (passwords, keys, tokens) to `kv://` references
- Preserves non-sensitive values as-is
- Generates warnings for invalid environment variable names

**App Name Validation:**
- Must be 3-40 characters
- Lowercase letters, numbers, and dashes only
- Cannot start or end with dash
- Cannot have consecutive dashes

**Create validation:** The command fails if `integration/<name>` or `builder/<name>` already exists. Use a different name or remove the existing directory before creating.

**Issues:**
- **"Application 'name' already exists"** or **"already exists in integration/" or "already exists in builder/"** → Choose a different name or remove the existing folder
- **"Application name must be 3-40 characters"** → Use valid format (lowercase, dashes only)
- **"Port must be between 1 and 65535"** → Use valid port number
- **"Language must be either typescript or python"** → Use supported language
- **"Invalid type: <type>"** → Type must be one of: webapp, api, service, functionapp, external

---

<a id="aifabrix-build-app"></a>
## aifabrix build <app>

Build Docker image.

**What:** Detects language, generates/uses Dockerfile, builds image, creates `.env`. For external type applications, generates `<systemKey>-deploy.json` file only (does not build Docker images or deploy).

**When:** After code changes, first build, when Dockerfile needs regeneration. For external systems, when ready to generate the application schema file for deployment.

**Example:**
```bash
aifabrix build myapp
```

**Example (external system):**
```bash
aifabrix build hubspot
# For external type, this generates <systemKey>-deploy.json only (no Docker build, no deployment)
```

**Override language:**
```bash
aifabrix build myapp --language python
```

**Force template regeneration:**
```bash
aifabrix build myapp --force-template
```

**Flags:**
- `-l, --language <lang>` - Override language detection
- `-f, --force-template` - Force rebuild from template
- `-t, --tag <tag>` - Image tag (default: latest)

**Creates:**
- Docker image: `myapp:latest`
- Env is resolved in memory; the only persisted `.env` is written to `build.envOutputPath` when configured (run uses the same single .env path or temp).

**Issues:**
- **"Docker not running"** → Start Docker Desktop
- **"Build failed"** → Check Dockerfile syntax, dependencies
- **"Permission denied"** → Fix Docker permissions

---

<a id="aifabrix-run-app"></a>
## aifabrix run <app>

Run application locally in Docker container with automatic infrastructure connectivity.

**What:** Starts container, connects to infrastructure, maps ports, waits for health check. **Only applications in `builder/<app>/` can be run** (no `--type` flag; external systems in `integration/` are not run as containers—use `aifabrix build` / deploy and test via OpenAPI instead).

**When:** Testing, development, debugging, local demonstrations.

**Prerequisites:**
- Application must be in `builder/<app>/` and built: `aifabrix build <app>`
- Infrastructure must be running: `aifabrix up-infra`
- Env is generated at run time to `build.envOutputPath` when set (or to a temp path); no requirement for a pre-existing `.env` file in `builder/<app>/`

**Example:**
```bash
aifabrix run myapp
```

**With live reload (dev only):** Local Docker mounts resolved `build.context`; remote Docker uses Mutagen (local = resolved `build.context`, remote = user Mutagen folder + `/` + (build.remoteSyncPath if set, else `dev/` + appKey)). Override per app with `build.remoteSyncPath` in application.yaml.
```bash
aifabrix run myapp --reload
```

**Environment:** Run for a specific environment (dev, tst, pro):
```bash
aifabrix run myapp --env dev
```

**Custom port:**
```bash
aifabrix run myapp --port 3001
```

**Run a specific image tag:**
```bash
aifabrix run myapp --tag v1.0.0
```
Overrides `image.tag` from application.yaml so you can run a different built version without changing config.

**Flags:**
- `--reload` - (Dev only) Mount or sync app code for live reload; local = mount `build.context`, remote = Mutagen sync
- `--env <dev|tst|pro>` - Environment to run for (default: dev)
- `-p, --port <port>` - Override port (default: from application.yaml `port`, developer offset applies)
- `-d, --debug` - Enable debug output with detailed container information (port detection, container status, Docker commands, health check details)
- `-t, --tag <tag>` - Image tag to run (e.g. v1.0.0); overrides application.yaml image.tag

**Debug Mode:**
When `--debug` is enabled, the command outputs detailed information including:
- Port detection: Shows detected port, fallback logic, and Docker inspect commands
- Container status: Shows container state, running status, and port mappings
- Docker commands: Logs all Docker commands executed (docker ps, docker inspect, docker-compose, etc.)
- Health check details: Shows health check URL, response codes, response bodies (truncated), retry attempts, and timeout information

**Example with debug:**
```bash
aifabrix run myapp --debug
```

**Process:**
1. Validates app configuration
2. Checks if Docker image exists
3. Verifies infrastructure health
4. Stops existing container if running
5. Checks port availability
6. Resolves env in memory and writes to `build.envOutputPath` or temp (no `.env` in builder/)
7. Generates Docker Compose configuration
8. **Creates database and user** (if `requiresDatabase: true` in application.yaml)
   - Automatically creates database named after app key
   - Creates database user with proper permissions
   - Grants all privileges and sets schema ownership
   - Idempotent: skips if database already exists
9. Starts container with proper networking
10. Waits for health check to pass
11. Displays access URL

**Access:** <http://localhost>:<port>

**Container:** `aifabrix-<app>`

**Health Check:** `/health` endpoint

**Issues:**
- **"Application not found in builder/"** → Only apps in `builder/<app>/` can be run. Create or copy the app into builder (e.g. `aifabrix create <app>` or copy from templates). External systems in `integration/` are not run as containers.
- **"External systems don't run as Docker containers"** → The app in `builder/<app>/` has `app.type: external`; run only supports runnable apps. Use `aifabrix build` and deploy, then test via OpenAPI.
- **"Docker image not found"** → Run `aifabrix build <app>` first
- **"Infrastructure not running"** → Run `aifabrix up-infra` first
- **"Port already in use"** → Use `--port <alternative>` flag
- **"Container won't start"** → Check logs: `aifabrix logs <app>`
- **"Health check timeout"** → Check application logs and health endpoint
- **"Configuration validation failed"** → Fix issues in `builder/<app>/application.yaml`

---

<a id="aifabrix-restart-app"></a>
## aifabrix restart <app>

Restart a running Docker application (container restart without recreating).

**What:** Restarts the application container started by `aifabrix run <app>`. Uses Docker restart so the same container and configuration are reused. Only applies to apps in `builder/<app>/`.

**When:** After code or config changes where a full stop/start is not needed, or to clear a stuck process.

**Prerequisites:**
- Application must already be running: `aifabrix run <app>` (or started via deploy with `--local`)

**Example:**
```bash
aifabrix restart myapp
```

**Output:**
```yaml
✅ myapp restarted successfully
```

**Note:** The same command is used for infrastructure services: `aifabrix restart postgres`, `aifabrix restart redis`, etc. If the argument is an infrastructure service name (postgres, redis, pgadmin, redis-commander, traefik), that service is restarted; otherwise it is treated as an application name.

**Issues:**
- **"Application 'X' is not running"** → Start the app first: `aifabrix run <app>`
- **"Invalid service name"** (infra only) → Use one of: postgres, redis, pgadmin, redis-commander, traefik

---

<a id="aifabrix-logs-app"></a>
## aifabrix logs <app>

Show application container logs and an optional env summary (with secrets masked).

**What:** Prints container name, optionally dumps environment variables (sensitive values masked), then shows Docker logs.

**When:** Debugging, inspecting env, or streaming logs.

**Example:**
```bash
aifabrix logs myapp
```
Shows env summary (masked) and last 100 lines of logs.

**Options:**
- `-f` - Follow log stream
- `-t, --tail <lines>` - Number of lines (default 100); `--tail 0` = full list
- `-l, --level <level>` - Show only logs at this level or above (debug, info, warn, error)

**Examples:**
```bash
aifabrix logs myapp           # last 100 lines
aifabrix logs myapp -t 50      # last 50 lines
aifabrix logs myapp -t 0       # full list
aifabrix logs myapp -f         # follow stream
aifabrix logs dataplane --level error   # only error lines
aifabrix logs myapp -l warn              # warn and error
```

**Validating the level filter**

To confirm that `-l error` shows all error-level lines from the full log:

1. Capture the full log: `aifabrix logs miso-controller > full.log`
2. Capture only errors: `aifabrix logs miso-controller -l error > errors.log`
3. Check that every line in `errors.log` appears in `full.log`, and that every line in `full.log` that looks like an error (e.g. starts with `error:` or `ERROR:` or has a timestamp then `error:`) appears in `errors.log`. You can diff or grep, e.g. `grep -F "error:" full.log` should match the same logical lines as in `errors.log`.

**Issues:**
- **"Failed to show logs"** - Container may not exist or be stopped; run `aifabrix run <app>` first.

---

<a id="aifabrix-stop-app"></a>
## aifabrix stop <app>

Alias for [aifabrix down-app <app>](#aifabrix-down-app). Stops and removes the application container (optionally with `--volumes`).

<a id="aifabrix-down-app"></a>
## aifabrix down-app <app>

Stop and remove the application container; optionally remove the app's Docker volume and image.

**What:** Stops the container, removes it, and removes the app's Docker image if no other container uses it. Optionally removes the app's named volume.

**When:** Cleaning up after development, freeing port or disk.

**Example:**
```bash
aifabrix down-app myapp
```

**Options:**
- `--volumes` - Also remove the application's Docker volume (data)

**Example with volumes:**
```bash
aifabrix down-app myapp --volumes
```

**Note:** Does not delete files under `builder/<app>/`. For full teardown including infra, use `aifabrix down-infra`.

---

<a id="aifabrix-shell-app"></a>
## aifabrix shell <app>

Open a shell in the running or ephemeral container (exec into the container; no SSH).

**What:** Execs into the app container so you can run commands inside it. For **dev**: uses the running container if the app is up; for **tst**: starts an ephemeral container, runs the shell, then stops it.

**When:** Debugging, running one-off commands (e.g. migrations, scripts) inside the app environment.

**Usage:**
```bash
# Dev: shell into running container (or start ephemeral if not running)
aifabrix shell myapp

# Dev environment (default)
aifabrix shell myapp --env dev

# Tst: ephemeral container
aifabrix shell myapp --env tst
```

**Options:**
- `--env <dev|tst>` - Environment (dev = running or ephemeral container; tst = ephemeral)

**See Also:** For external-system apps in `integration/`, use the external integration test flow (e.g. OpenAPI); `aifabrix shell` is for **builder** applications only.

---

<a id="aifabrix-test-app"></a>
## aifabrix test <app> (builder applications)

Run tests inside the container for **builder** applications (not external systems).

**What:** Runs the app's test suite inside the container. For **dev**: uses the running container if the app is up; for **tst**: starts an ephemeral container, runs tests, then stops it.

**When:** Running unit or integration tests in the same environment as the running app (same env, dependencies, network).

**Usage:**
```bash
# Dev: run tests in running container or ephemeral
aifabrix test myapp

# Tst: ephemeral container
aifabrix test myapp --env tst
```

**Options:**
- `--env <dev|tst>` - Environment (dev = running or ephemeral; tst = ephemeral)

**Note:** For **external-system** applications in `integration/`, testing is via the external integration flow (e.g. OpenAPI, upload, deploy); see [External Systems](../external-systems.md). `aifabrix test <app>` here refers only to builder apps in `builder/<app>/`.

---

<a id="aifabrix-dockerfile-app"></a>
## aifabrix dockerfile <app>

Generate Dockerfile for an application.

**What:** Creates a Dockerfile from templates based on the application's language and configuration.

**When:** Before building an image, to review or customize the Dockerfile.

**Usage:**
```bash
# Generate Dockerfile (will fail if exists)
aifabrix dockerfile myapp

# Force overwrite existing Dockerfile
aifabrix dockerfile myapp --force

# Override language detection
aifabrix dockerfile myapp --language python
```

**Options:**
- `-l, --language <lang>` - Override language detection (typescript/python)
- `-f, --force` - Overwrite existing Dockerfile

**Process:**
1. Reads `builder/{app}/application.yaml`
2. Detects language (TypeScript/Python)
3. Loads template from `templates/{language}/Dockerfile.hbs`
4. Generates Dockerfile with application-specific configuration
5. Saves to `builder/{app}/Dockerfile`

**Output:**
```yaml
✓ Generated Dockerfile from template
Location: builder/myapp/Dockerfile
```

**Issues:**
- **"Dockerfile already exists"** → Use `--force` flag to overwrite
- **"Failed to load configuration"** → Run `aifabrix create myapp` first
- **"Language not supported"** → Update application.yaml with supported language

