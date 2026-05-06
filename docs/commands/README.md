# CLI Commands Reference

← [Documentation index](../README.md) · [Commands index](README.md)

Complete command reference organized by concept with examples and troubleshooting. **Help:** `aifabrix --help` lists all top-level commands by category; `aifabrix <command> --help` shows options and examples for that command. **Alias:** You can use `af` instead of `aifabrix` (e.g. `af up-infra`, `af create myapp`). **Parameters:** `<param>` = required, `[param]` = optional (e.g. `aifabrix show <app>`, `aifabrix wizard [systemKey]`).


---

## Table of Contents

### Authentication & Setup
- [Authentication Commands](authentication.md) - Login, logout, and auth (controller/environment)
  - [`aifabrix login`](authentication.md#aifabrix-login) - Sign in to Miso Controller (device or credentials flow)
  - [`aifabrix logout`](authentication.md#aifabrix-logout) - Clear stored tokens (optional filter by controller/env/app)
  - [`aifabrix auth`](authentication.md#aifabrix-auth) - Show auth status or set default controller/environment (`auth status` for scripts)
- [Infrastructure Commands](infrastructure.md) - Local Docker infra and platform (up-infra, up-platform, up-miso, up-dataplane, down-infra, status, doctor, restart)
  - [`aifabrix up-infra`](infrastructure.md#aifabrix-up-infra) - Start Postgres, Redis; optional pgAdmin, Redis Commander, Traefik
  - [`aifabrix up-platform`](infrastructure.md#aifabrix-up-platform) - Start Keycloak, Miso Controller, dataplane from images (needs up-infra)
  - [`aifabrix up-miso`](infrastructure.md#aifabrix-up-miso) - Start Keycloak + Miso Controller only (no dataplane; needs up-infra)
  - [`aifabrix up-dataplane`](infrastructure.md#aifabrix-up-dataplane) - Register, deploy, run dataplane locally (dev env; login required)
  - [`aifabrix down-infra [service|app]`](infrastructure.md#aifabrix-down-infra) - Stop all infra, or stop one app; `-v` removes volumes
  - [`aifabrix status`](infrastructure.md#aifabrix-status) - Infra services and running apps (ports, URLs)
  - [`aifabrix restart <service|app>`](infrastructure.md#aifabrix-restart-service) - Restart an infra service or a `builder/<appKey>` container
  - [`aifabrix doctor`](infrastructure.md#aifabrix-doctor) - Check Docker, ports, secrets, and infra health
- [Developer Isolation Commands](developer-isolation.md) - Local dev config, Builder onboarding, remote admin, Mutagen/sync
  - [`aifabrix dev show`](developer-isolation.md#aifabrix-dev-show) - Show dev ports and ~/.aifabrix config
  - [`aifabrix dev set-id <id>`](developer-isolation.md#aifabrix-dev-set-id) - Set developer ID (0 = default infra, &gt;0 = dev-specific ports)
  - [`aifabrix dev set-scoped-resources <true|false>`](developer-isolation.md#aifabrix-dev-set-scoped-resources) - Set useEnvironmentScopedResources (shared dev/tst Postgres/Docker naming)
  - [`aifabrix dev set-env-config <filePath>`](developer-isolation.md#aifabrix-dev-set-env-config) - Set or clear aifabrix-env-config in config (path not validated)
  - [`aifabrix dev set-home <path>`](developer-isolation.md#aifabrix-dev-set-home) - Set or clear aifabrix-home; optional shell/user env registration
  - [`aifabrix dev set-work <path>`](developer-isolation.md#aifabrix-dev-set-work) - Set or clear aifabrix-work (workspace root); optional `AIFABRIX_WORK` registration
  - [`aifabrix dev print-home`](developer-isolation.md#aifabrix-dev-print-home) / [`print-work`](developer-isolation.md#aifabrix-dev-print-work) - Script-friendly resolved paths (stdout only)
  - [`aifabrix dev set-format <format>`](developer-isolation.md#aifabrix-dev-set-format) - Default json|yaml when `--format` is omitted (download/convert)
  - [`aifabrix dev init`](developer-isolation.md#aifabrix-dev-init) - Onboard with Builder Server (cert, settings, SSH for Mutagen)
  - [`aifabrix dev refresh`](developer-isolation.md#aifabrix-dev-refresh) - Pull server settings into config; renew cert if due or `--cert`
  - [`aifabrix dev add`](developer-isolation.md#aifabrix-dev-add-update-pin-delete-list) / [`dev update`](developer-isolation.md#aifabrix-dev-add-update-pin-delete-list) / [`dev pin`](developer-isolation.md#aifabrix-dev-add-update-pin-delete-list) / [`dev delete`](developer-isolation.md#aifabrix-dev-add-update-pin-delete-list) / [`dev list`](developer-isolation.md#aifabrix-dev-add-update-pin-delete-list) - Remote Builder Server: manage developers and groups (admin for add/update/pin/delete; [roles table](developer-isolation.md#aifabrix-dev-add-update-pin-delete-list) includes **docker** host flag)
  - [`aifabrix dev down`](developer-isolation.md#aifabrix-dev-down) - Stop Mutagen sync; `--apps` also stops app containers

### Application Management
- [Application Management Commands](application-management.md) - Application registration and management
  - [`aifabrix show <app>`](application-management.md#aifabrix-show-appkey) - Show app from local tree (default) or controller (`--online`)
  - [`aifabrix app show <app>`](application-management.md#aifabrix-app-show-appkey) - App details from controller (same as `show --online`); `--permissions` for permissions only
  - [`aifabrix app register <appKey>`](application-management.md#aifabrix-app-register-appkey) - Register app; receive pipeline credentials
  - [`aifabrix app list`](application-management.md#aifabrix-app-list) - List apps in current environment
  - [`aifabrix app rotate-secret <appKey>`](application-management.md#aifabrix-app-rotate-secret) - Rotate pipeline ClientSecret (one-time display)
  - [`aifabrix app deployment <appKey>`](deployment.md#aifabrix-app-deployment-appkey) - List recent deployments for app in current environment
  - [`aifabrix integration-client`](application-management.md#aifabrix-integration-client-create) - OAuth integration clients on Controller (`aifabrix integration-client --help`; see [permissions](permissions.md))
  - [`aifabrix integration-client create`](application-management.md#aifabrix-integration-client-create) - Create integration client (key, display-name, redirect-uris, optional group-names); one-time client secret
  - [`aifabrix integration-client list`](application-management.md#aifabrix-integration-client-list) - List integration clients (pagination and search)
  - [`aifabrix integration-client rotate-secret`](application-management.md#aifabrix-integration-client-rotate-secret) - Rotate client secret for an integration client (one-time display)
  - [`aifabrix integration-client delete`](application-management.md#aifabrix-integration-client-delete) - Deactivate an integration client
  - [`aifabrix integration-client update-groups`](application-management.md#aifabrix-integration-client-update-groups) - Update group assignments for an integration client
  - [`aifabrix integration-client update-redirect-uris`](application-management.md#aifabrix-integration-client-update-redirect-uris) - Update redirect URIs for an integration client

### Application Development
- [Application Development Commands](application-development.md) - Local development
  - [`aifabrix create <app>`](application-development.md#aifabrix-create-app) - Scaffold builder or external app (flags or `--wizard`)
  - [`aifabrix wizard [systemKey]`](external-integration.md#aifabrix-wizard) - Guided external system setup or headless `wizard.yaml`
  - [`aifabrix build <app>`](application-development.md#aifabrix-build-app) - Build Docker image (auto-detect runtime)
  - [`aifabrix run <app>`](application-development.md#aifabrix-run-app) - Run app locally or on remote Docker host (`--reload`, `--env dev|tst|pro`)
  - [`aifabrix shell <app>`](application-development.md#aifabrix-shell-app) - Interactive shell in running or ephemeral container
  - [`aifabrix test <app> [--env dev|tst]`](application-development.md#aifabrix-test-app) - Tests: builder in container; external = local validation
  - [`aifabrix install <app> [--env dev|tst]`](application-development.md#aifabrix-install-app) - Install deps in container (builder apps only)
  - [`aifabrix test-e2e <app> [--env dev|tst]`](application-development.md#aifabrix-test-e2e-app) - E2E: builder in container; external = all datasources via dataplane
  - [`aifabrix test-integration <app> [--env dev|tst]`](application-development.md#aifabrix-test-integration-app) - Integration tests: builder in container; external via dataplane
  - [`aifabrix lint <app> [--env dev|tst]`](application-development.md#aifabrix-lint-app) - Lint in container (builder apps only)
  - [`aifabrix restart <app>`](application-development.md#aifabrix-restart-app) - Restart a running Docker application (`builder/<appKey>`)
  - [`aifabrix logs <app>`](application-development.md#aifabrix-logs-app) - Tail app container logs (optional env summary; secrets masked)
  - [`aifabrix stop <app>`](application-development.md#aifabrix-stop-app) - Alias for down-app: stop and remove container
  - [`aifabrix down-app <app>`](application-development.md#aifabrix-down-app) - Stop and remove app container (`--volumes` removes data volume)
  - [`aifabrix dockerfile <app>`](application-development.md#aifabrix-dockerfile-app) - Generate Dockerfile from detected runtime

  For custom scripts, use `build.scripts` in application.yaml or run `aifabrix shell <app>` then run make/npm commands manually.

### Deployment
- [Deployment Commands](deployment.md) - Deploy via Controller (Azure or local Docker)
  - [`aifabrix push <app>`](deployment.md#aifabrix-push-app) - Push image to Azure Container Registry
  - [`aifabrix env`](deployment.md#aifabrix-env-deploy-env) - Miso environments (`env deploy <env>` — see `aifabrix env --help`)
  - [`aifabrix env deploy dev|tst|pro`](deployment.md#aifabrix-env-deploy-env) - Deploy environment infra; `--preset s|m|l|xl` or `--config <file>`
  - [`aifabrix deploy <app>`](deployment.md#aifabrix-deploy-app) - Deploy via Miso Controller (Azure or `--local`; resolves `integration/<systemKey>/` then `builder/<appKey>/`)
  - [`aifabrix deployment list`](deployment.md#aifabrix-deployment-list) - List recent deployments for current environment

### Validation & Comparison
- [Validation Commands](validation.md) - Configuration validation
  - [`aifabrix validate <appOrFile>`](validation.md#aifabrix-validate-apporfile) - Validate one app/file or all under `integration/` or `builder/` (`--integration` / `--builder`)
  - [`aifabrix parameters validate`](validation.md#aifabrix-parameters-validate) - Check `builder/*/env.template` `kv://` keys against shipped `infra.parameter.yaml` (optional `--catalog <path>`)
  - [`aifabrix diff <file1> <file2>`](validation.md#aifabrix-diff-file1-file2) - Diff two config files (optional schema validate)

### External Integration
- [Certification and trust (CLI)](certification-and-trust.md) - Local `certification` section sync, `--no-cert-sync`, `--verify-cert`, `validate --cert-sync`
- [External Integration Commands](external-integration.md) - External system integration. See [External Integration Testing](external-integration-testing.md) for unit/integration test details and payloads.
  - [`aifabrix wizard [systemKey] [--debug]`](external-integration.md#aifabrix-wizard) - Guided external system setup (OpenAPI, MCP, HubSpot, …) or headless `wizard.yaml`; `--debug` for debug manifests
  - [`aifabrix download <systemKey>`](external-integration.md#aifabrix-download-system-key) - Pull external system from dataplane into `integration/<key>/`
  - [`aifabrix upload <systemKey>`](external-integration.md#aifabrix-upload-system-key) - Validate and publish external system to dataplane; registers RBAC with controller (does not trigger controller deployment; promote via deploy)
  - [`aifabrix delete <systemKey>`](external-integration.md#aifabrix-delete-system-key) - Remove external system and datasources from dataplane
  - [`aifabrix test <app>`](external-integration.md#aifabrix-test-app) - Unit tests (external: local validation; builder: in-container tests with `--env dev|tst`)
  - [`aifabrix test-integration <app>`](external-integration.md#aifabrix-test-integration-app) - Integration tests: builder in container; external via dataplane (`-e`, `-v`, `-d` / `--debug` on external path; per-datasource flags on `datasource test-integration`)
  - [`aifabrix datasource`](external-integration.md#aifabrix-datasource) - Datasource JSON: validate, list, deploy, test, logs (`aifabrix datasource --help`)
    - [`aifabrix datasource validate <file>`](external-integration.md#aifabrix-datasource-validate-file) - Validate datasource JSON file
    - [`aifabrix datasource list`](external-integration.md#aifabrix-datasource-list) - List datasources for environment in config
    - [`aifabrix datasource diff <file1> <file2>`](external-integration.md#aifabrix-datasource-diff-file1-file2) - Diff two datasource JSON files
    - [`aifabrix datasource upload <file-or-key>`](external-integration.md#aifabrix-datasource-upload-myapp-file) - Deploy one datasource JSON to the dataplane (path or key; `systemKey` in file)
    - [`aifabrix datasource test <datasourceKey>`](external-integration.md#aifabrix-datasource-test-datasourcekey) - Structural/policy validation run for one datasource (unified dataplane API, run type test)
    - [`aifabrix datasource test-integration <datasourceKey>`](external-integration.md#aifabrix-datasource-test-integration-datasourcekey) - Integration validation run for one datasource (unified dataplane API)
    - [`aifabrix datasource test-e2e <datasourceKey>`](external-integration.md#aifabrix-datasource-test-e2e-datasourcekey) - E2E validation run for one datasource (unified dataplane API)
    - [`aifabrix datasource log-test <datasourceKey>`](external-integration.md#aifabrix-datasource-log-test-datasourcekey) - Show latest structural validation debug log (`test-*.json`)

### Utilities
- [Utility Commands](utilities.md) - Configuration and secret management
  - [`aifabrix resolve <app>`](utilities.md#aifabrix-resolve-app) - Generate `.env` from template; optional validate after
  - [`aifabrix json <app>`](utilities.md#aifabrix-json-app) - Write deployment JSON to disk for version control
  - [`aifabrix split-json <app>`](utilities.md#aifabrix-split-json-app) - Split deploy JSON into env.template, application.yaml, rbac, README, …
  - [`aifabrix convert <app>`](utilities.md#aifabrix-convert-app) - Convert integration config files between JSON and YAML
  - [`aifabrix repair <systemKey>`](utilities.md#aifabrix-repair-app) - Fix external integration drift (files, RBAC, manifest, …)
  - [`aifabrix secure`](utilities.md#aifabrix-secure) - Encrypt secrets.local.yaml at rest (ISO 27001)
  - [`aifabrix secret`](utilities.md#aifabrix-secret) - User and shared secrets: list, set, remove, set-secrets-file, validate (`aifabrix secret --help`; `--shared` + HTTPS: `BASH_<NAME>` keys → `<NAME>` exported in terminal, e.g. `NPM_TOKEN`)
    - [`aifabrix secret list`](utilities.md#aifabrix-secret-list) / [`secret list --shared`](utilities.md#aifabrix-secret-list) - List local or shared secrets
    - [`aifabrix secret set <key> <value>`](utilities.md#aifabrix-secret-set) / `--shared` - Set secret (local or shared)
    - [`aifabrix secret remove <key>`](utilities.md#aifabrix-secret-remove) / `--shared` - Remove secret (local or shared)
    - [`aifabrix secret remove-all`](utilities.md#aifabrix-secret-remove-all) / `--shared` / `--yes` - Remove all secrets (confirmation unless `--yes`)

### Reference
- [Command Reference](reference.md) - Common workflows, global options, exit codes, configuration, and getting help
- [Online Commands and Permissions](permissions.md) - Which permissions each online (Controller/Dataplane) command requires

---

## Quick Navigation

Shortcuts to all command pages and key guides (same categories as the [Table of Contents](#table-of-contents) above).

**Getting Started:**
- [Your Own Applications](../your-own-applications.md) - Create and run your own app
- [Authentication Commands](authentication.md) - Login to Miso Controller
- [Infrastructure Commands](infrastructure.md) - Start local infrastructure

**Development:**
- [Application Development Commands](application-development.md) - Create, build, and run apps locally
- [Developer Isolation Commands](developer-isolation.md) - Port isolation for multiple developers

**Deployment:**
- [Application Management Commands](application-management.md) - Register applications
- [Deployment Commands](deployment.md) - Deploy to Azure

**External Systems:**
- [Certification and trust (CLI)](certification-and-trust.md) - Trust metadata in the system file and CLI sync flags
- [External Integration Commands](external-integration.md) - Create and manage external system integrations
- [External Integration Testing](external-integration-testing.md) - Unit and integration testing, test payloads
- [Wizard Guide](../wizard.md) - Interactive wizard documentation
- [External Systems Guide](../external-systems.md) - Complete external systems guide

**Utilities & Validation:**
- [Utility Commands](utilities.md) - Configuration and secret management
- [Validation Commands](validation.md) - Validate and compare configurations

**Reference:**
- [Command Reference](reference.md) - Workflows, options, exit codes, configuration
- [Online Commands and Permissions](permissions.md) - Permissions for Controller and Dataplane commands
- [Configuration](../configuration/README.md) - Configuration file reference

---

## Related Documentation

- [Your Own Applications](../your-own-applications.md) - Getting started guide
- [Configuration](../configuration/README.md) - Configuration file reference
- [Infrastructure](../infrastructure.md) - Infrastructure guide
- [Building](../building.md) - Building applications
- [Running](../running.md) - Running applications locally
- [Deploying](../deploying.md) - Deployment guide
- [Developer Isolation](../developer-isolation.md) - Developer isolation guide
- [External Systems](../external-systems.md) - External systems guide
- [Wizard](../wizard.md) - Wizard guide
- [GitHub Workflows](../github-workflows.md) - CI/CD workflows

