# Application Development Commands

← [Documentation index](../README.md) · [Commands index](README.md)

Commands for creating, building, and running applications locally.

---

<a id="aifabrix-create-app"></a>
## aifabrix create <app>

Create new application with configuration files.

**What:** Creates a new application. By default creates an **external** system in `integration/<systemKey>/`. Use `--type webapp` to create a builder app in `builder/<appKey>/` with `application.yaml`, `env.template`, `rbac.yaml`, and optional GitHub Actions workflows.

**When:** Starting a new application.

**Default type:** The default application type is **external**. To create a web app (builder app), use `aifabrix create <app> --type webapp`.

**Example (external system, default):**
```bash
aifabrix create hubspot
```
Creates `integration/hubspot-test/`. Use `--wizard` for the interactive wizard, or provide non-interactive options (e.g. `--display-name`, `--auth-type`).

**Example (web app, interactive):**
```bash
aifabrix create myapp --type webapp
```
Creates `builder/myapp/`. Prompts for: port, database, redis, storage, authentication, language.

**Example (web app with flags):**
```bash
aifabrix create myapp --type webapp --port 3000 --database --language typescript
```

**Example (with GitHub workflows):**
```bash
aifabrix create myapp --port 3000 --database --github --main-branch main --type webapp
```

**Example (with template):**
```bash
aifabrix create myapp --template miso-controller --port 3000 --type webapp
```

**Example (with GitHub steps):**
```bash
aifabrix create myapp --github --github-steps npm --type webapp
```
**Note:** Step templates must exist in `templates/github/steps/{step}.hbs`. Currently available: `npm.hbs`

**Example (external with wizard):**
```bash
aifabrix create hubspot --wizard
```
Creates in `integration/<systemKey>/` using the interactive wizard. For non-interactive external create, use `--display-name`, `--description`, `--system-type`, `--auth-type`, `--entity-type`, and `--datasources`. For other commands (validate, json, deploy, delete, **resolve**), the CLI always resolves the app by checking `integration/<systemKey>` first, then `builder/<appKey>`; if neither exists, it errors. **Resolve** additionally supports **env-only** mode: if `integration/<systemKey>/env.template` exists (even without `application.yaml`), resolve uses that directory and writes `integration/<systemKey>/.env`; see [Utility commands – resolve](utilities.md#aifabrix-resolve-app).

**External output:** Generated `env.template` includes full `kv://` paths (e.g. `KV_HUBSPOT_APIKEY=kv://hubspot-demo/apikey`) for credential secrets. The generated README includes a **Secrets** section listing `aifabrix secret set <systemKey>/<key> <your value>` per authentication type (the key has no `kv://` prefix).

**Complete HubSpot example:**
See `integration/hubspot-test/` for a complete HubSpot integration with companies, contacts, and deals datasources. Includes OAuth2 authentication, field mappings, and OpenAPI operations.

→ [External Systems Guide](../external-systems.md) - Complete guide with step-by-step instructions

**Flags:**
- `-p, --port <port>` - Application port (default: 3000, not used for external type)
- `-d, --database` - Requires database (not used for external type)
- `-r, --redis` - Requires Redis (not used for external type)
- `-s, --storage` - Requires file storage (not used for external type)
- `-a, --authentication` - Requires authentication/RBAC (not used for external type)
- `-l, --language <lang>` - typescript or python (not used for external type)
- `-t, --template <name>` - Template to use (e.g., miso-controller, keycloak). Template folder must exist in `templates/{template}/`
- `--type <type>` - Application type: `webapp`, `api`, `service`, `functionapp`, or `external` (default: **external**; use `--type webapp` for builder apps)
- `--app` - Generate minimal application files (package.json, index.ts or requirements.txt, main.py) (not used for external type)
- `-g, --github` - (Optional) Generate GitHub Actions workflows
- `--github-steps <steps>` - Extra GitHub workflow steps (comma-separated, e.g., `npm`). Step templates must exist in `templates/github/steps/{step}.hbs`. When included, these steps are rendered and injected into workflow files (e.g., `release.yaml`). Available step templates: `npm.hbs` (adds NPM publishing job)
- `--main-branch <branch>` - Main branch name for workflows (default: main)

**Creates:**
- `builder/<appKey>/application.yaml` - Application configuration (regular apps)
- `builder/<appKey>/env.template` - Environment template with kv:// references
- `builder/<appKey>/rbac.yaml` - RBAC configuration (if authentication enabled)
- `builder/<appKey>/<appKey>-deploy.json` - Deployment manifest (e.g. `builder/myapp/myapp-deploy.json`)
- `builder/<appKey>/README.md` - Application documentation
- `.github/workflows/` - GitHub Actions workflows (if --github specified)

**External type (default):** When `--type` is omitted or `--type external`:
- `--display-name <name>` - External system display name (required for non-interactive)
- `--description <desc>` - External system description (required for non-interactive)
- `--system-type <type>` - openapi, mcp, or custom (required for non-interactive)
- `--auth-type <type>` - oauth2, aad, apikey, basic, queryParam, oidc, hmac, or none (required for non-interactive)
- `--entity-type <type>` - recordStorage, documentStorage, vectorStore, messageService, or none (required for non-interactive)
- `--datasources <count>` - Number of datasources (required for non-interactive)

When using `--type external`, the command creates an external system integration in `integration/<systemKey>/`:
- `integration/<systemKey>/application.yaml` (or `application.json` if config format is `json`) - App configuration with `app.type: "external"` and `externalIntegration` block
- `integration/<systemKey>/<systemKey>-system.yaml` (or `*.json`) - External system configuration
- `integration/<systemKey>/<systemKey>-datasource-<datasource-key>.yaml` (or `*.json`) - Datasource files (all in same folder)

When `format` is set in `~/.aifabrix/config.yaml` (via `aifabrix dev set-format`), the command generates files in that format.
- `integration/<systemKey>/<systemKey>-deploy.json` - Deployment manifest (generated)
- `integration/<systemKey>/env.template` - Environment variables template
- `integration/<systemKey>/README.md` - Application documentation
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

**Image repository name:** Taken from `application.yaml` when `image` is set (same rules as run: optional `image.registry`, `image.name`, `image.tag`, or a string `image: repo:tag`). If `image` is omitted, blank, or an empty object, the CLI lists **local Docker images** and reuses a matching repository, stripping common dev suffixes (`-dev<N>`, `-extra`) so the next build tags the base name (for example a listed `myorg/app-dev2:latest` → build target `myorg/app`). When your developer id is set, a repository ending in `-dev<id>` is preferred if several lines match. If nothing in Docker matches, the name falls back to `app.key` or the app folder name.

**Creates:**
- Docker image: `<resolved-repository>:<tag>` (default tag `latest`)
- Env is resolved in memory; the only persisted `.env` is written to `build.envOutputPath` when configured (run uses the same single .env path or temp).

**Environment and tokens:** Build passes `NPM_TOKEN` and `PYPI_TOKEN` as Docker build-args when they are in `env.template` (e.g. `NPM_TOKEN=kv://npm-tokenKeyVault`) or in your secrets file, so private npm/pypi registries work during `RUN npm install` / `pip install`. Add them to `env.template` as `kv://` references; see [env.template](../configuration/env-template.md#build-run-shell-and-install). The TypeScript Dockerfile uses `NODE_AUTH_TOKEN=$NPM_TOKEN` so npm install can authenticate; for Python, use a custom Dockerfile or run `aifabrix install <app>` after build if you need private PyPI during install. Note: build-args can appear in image history; for maximum security use Docker build secrets or install-after-build.

**Issues:**
- **"Docker not running"** → Start Docker Desktop
- **"Build failed"** → Check Dockerfile syntax, dependencies
- **"Permission denied"** → Fix Docker permissions

---

<a id="aifabrix-run-app"></a>
## aifabrix run <app>

Run application locally in Docker container with automatic infrastructure connectivity.

**What:** Starts container, connects to infrastructure, maps ports, waits for health check. **Only applications in `builder/<appKey>/` can be run** (no `--type` flag; external systems in `integration/` are not run as containers—use `aifabrix build` / deploy and test via OpenAPI instead).

**When:** Testing, development, debugging, local demonstrations.

**Prerequisites:**
- Application must be in `builder/<appKey>/` and built: `aifabrix build <app>`
- Infrastructure must be running: `aifabrix up-infra`
- Env is generated at run time to `build.envOutputPath` when set (or to a temp path); no requirement for a pre-existing `.env` file in `builder/<appKey>/`. For `NPM_TOKEN`/`PYPI_TOKEN` (private registries), add them to `env.template` as `kv://` references; see [env.template](../configuration/env-template.md#build-run-shell-and-install).

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
- **"Application not found in builder/"** → Only apps in `builder/<appKey>/` can be run. Create or copy the app into builder (e.g. `aifabrix create <app>` or copy from templates). External systems in `integration/` are not run as containers.
- **"External systems don't run as Docker containers"** → The app in `builder/<appKey>/` has `app.type: external`; run only supports runnable apps. Use `aifabrix build` and deploy, then test via OpenAPI.
- **"Docker image not found"** → Run `aifabrix build <app>` first
- **"Infrastructure not running"** → Run `aifabrix up-infra` first
- **"Port already in use"** → Use `--port <alternative>` flag
- **"Container won't start"** → Check logs: `aifabrix logs <app>`
- **"Health check timeout"** → Check application logs and health endpoint
- **"Configuration validation failed"** → Fix issues in `builder/<appKey>/application.yaml`

---

<a id="aifabrix-restart-app"></a>
## aifabrix restart <app>

Restart a running Docker application (container restart without recreating).

**What:** Restarts the application container started by `aifabrix run <app>`. Uses Docker restart so the same container and configuration are reused. Only applies to apps in `builder/<appKey>/`.

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

**Note:** Does not delete files under `builder/<appKey>/`. For full teardown including infra, use `aifabrix down-infra`.

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

**Note:** For **external-system** applications in `integration/`, testing is via the external integration flow (e.g. OpenAPI, upload, deploy); see [External Systems](../external-systems.md). `aifabrix test <app>` here refers only to builder apps in `builder/<appKey>/`.

---

<a id="aifabrix-install-app"></a>
## aifabrix install <app>

Install dependencies inside the container for **builder** applications.

**What:** Runs the app's install command (e.g. `pnpm install`, `make install`) inside the container. For **dev**: uses the running container if the app is up; for **tst**: starts an ephemeral container with the same resolved `.env` as run (so `NPM_TOKEN`/`PYPI_TOKEN` from `env.template` are available for private registries).

**When:** After pulling code or when dependencies change; useful when the image was built without private registry tokens and you need to install from a private npm/pypi.

**Usage:**
```bash
# Dev: run install in running container
aifabrix install myapp

# Tst: ephemeral container with resolved .env
aifabrix install myapp --env tst
```

**Options:**
- `--env <dev|tst>` - Environment (dev = running container; tst = ephemeral with env file)

**Script:** Override with `build.scripts.install` in application.yaml; see [Scripts and commands](#scripts-and-commands) below.

**Read-only /app:** Install (and running `pnpm install` or `make install` in `aifabrix shell`) must write to `node_modules` under `/app`. If you see **EACCES** (e.g. `permission denied, rmdir '.../node_modules/.bin'` or `open '/app/_tmp_...'`), the container's `/app` is read-only. Use **`aifabrix run <app> --reload`** so the app directory is mounted and writable, or ensure the image gives the runtime user write access to `/app` (e.g. correct ownership in the Dockerfile).

---

<a id="aifabrix-test-e2e-app"></a>
## aifabrix test-e2e <app>

Run e2e tests: **builder** apps in container; **external** systems run E2E for all datasources via the dataplane.

**What:** For **builder** apps: runs the app's test:e2e command (e.g. `pnpm test:e2e`, `make test:e2e`) inside the container. For **dev**: uses the running container; for **tst**: ephemeral container with resolved `.env`. For **external** systems in `integration/<systemKey>/`: runs E2E for every datasource of that system using each datasource's test payload (no extra parameters required); results are aggregated and the command exits with non-zero if any datasource fails.

**Usage (builder):** `aifabrix test-e2e myapp` or `aifabrix test-e2e myapp --env tst`

**Usage (external system):**
```bash
aifabrix test-e2e hubspot-demo
aifabrix test-e2e hubspot-demo --env tst -v --debug
aifabrix test-e2e hubspot-demo --no-async
```

**Options:** `-e, --env <env>` — Environment (dev, tst, pro). `-v, --verbose` — Show detailed step output and poll progress. `--debug` — Include debug output and write log to `integration/<systemKey>/logs/`. `--no-async` — Use sync mode (no polling). For builder apps, override the script with `build.scripts.test:e2e` or `build.scripts.testE2e`; see [Scripts and commands](#scripts-and-commands).

---

<a id="aifabrix-test-integration-app"></a>
## aifabrix test-integration <app>

Run integration tests for **builder** applications (in container) or **external** systems (via dataplane pipeline API).

**What:** For **builder** apps in `builder/<appKey>/`: runs the app's integration test command inside the container (same pattern as [aifabrix test](#aifabrix-test-app) and [aifabrix test-e2e](#aifabrix-test-e2e-app)). For **external** systems in `integration/<systemKey>/` with an `externalIntegration` block: runs integration tests via the dataplane pipeline API (see [External Integration Testing](external-integration-testing.md)).

**When:** Running integration tests in the same environment as the app (builder) or validating external system pipelines (external).

**Usage (builder app):**
```bash
# Dev: run integration tests in running container
aifabrix test-integration myapp

# Tst: ephemeral container with resolved .env
aifabrix test-integration myapp --env tst
```

**Usage (external system):**
```bash
aifabrix test-integration hubspot
aifabrix test-integration hubspot --env tst
aifabrix test-integration hubspot --datasource hubspot-company --payload ./test-payload.json
aifabrix test-integration hubspot-test --debug  # write log to integration/hubspot-test/logs/
```

**Options:**
- `--env <dev|tst|pro>` — For builder: dev (running container) or tst (ephemeral). For external: environment for dataplane (dev, tst, pro).
- `-d, --datasource <key>` — (External only) Test a specific datasource.
- `-p, --payload <file>` — (External only) Path to custom test payload file.
- `-v, --verbose` — (External only) Show detailed test output.
- `--debug` — (External only) Include debug output and write log to `integration/<systemKey>/logs/`.
- `--timeout <ms>` — (External only) Request timeout in milliseconds (default 30000).

**Script:** For builder apps, override with `build.scripts.test:integration` or `build.scripts.testIntegration` in application.yaml. When unset, the command used is the same as [aifabrix test-e2e](#aifabrix-test-e2e-app) (e.g. `pnpm test:e2e`, `make test:e2e`). See [Scripts and commands](#scripts-and-commands).

**See also:** [External Integration Testing](external-integration-testing.md) for external system integration tests, payload configuration, and troubleshooting. For datasource-level E2E tests (including credential validation), use `aifabrix datasource test-e2e <datasourceKey>`; see [External Integration Commands](external-integration.md#aifabrix-datasource-test-e2e-datasourcekey).

---

<a id="aifabrix-lint-app"></a>
## aifabrix lint <app>

Run lint inside the container for **builder** applications.

**What:** Runs the app's lint command (e.g. `pnpm lint`, `make lint`) inside the container. For **dev**: uses the running container; for **tst**: ephemeral container with resolved `.env`.

**Usage:** `aifabrix lint myapp` or `aifabrix lint myapp --env tst`

**Options:** `--env <dev|tst>` — same as [aifabrix test](#aifabrix-test-app). Override with `build.scripts.lint`; see [Scripts and commands](#scripts-and-commands).

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

---

<a id="scripts-and-commands"></a>
## Scripts and commands

The following CLI commands resolve their shell command from `application.yaml` → `build.scripts` (or top-level `scripts`), with language defaults when a key is missing:

| CLI / usage               | application.yaml key                     | TypeScript default | Python default  |
| ------------------------- | ---------------------------------------- | ------------------ | --------------- |
| `aifabrix test <app>`     | `build.scripts.test`                     | `pnpm test`        | `make test`     |
| `aifabrix install <app>`  | `build.scripts.install`                  | `pnpm install`     | `make install`  |
| `aifabrix test-e2e <app>` | `build.scripts.test:e2e` / `testE2e`    | `pnpm test:e2e`    | `make test:e2e` |
| `aifabrix test-integration <app>` | `build.scripts.test:integration` / `testIntegration` | (falls back to test-e2e) | (falls back to test-e2e) |
| `aifabrix lint <app>`     | `build.scripts.lint`                     | `pnpm lint`        | `make lint`     |

Example override in `application.yaml`:

```yaml
build:
  language: typescript
  scripts:
    test: pnpm test
    install: pnpm install
    test:e2e: pnpm test:e2e
    test:integration: pnpm test:integration   # optional; when unset, test-integration uses test:e2e
    lint: pnpm lint
```

See [application.yaml](../configuration/application-yaml.md) for the full config reference.


