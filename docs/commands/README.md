# CLI Commands Reference

← [Documentation index](../README.md) · [Commands index](README.md)

Complete command reference organized by concept with examples and troubleshooting. **Alias:** You can use `aifx` instead of `aifabrix` in any command (e.g. `aifx up-infra`, `aifx create myapp`). **Parameters:** `<param>` = required, `[param]` = optional (e.g. `aifabrix show <appKey>`, `aifabrix wizard [appName]`).


---

## Table of Contents

### Authentication & Setup
- [Authentication Commands](authentication.md) - Login, logout, and auth config
  - [`aifabrix login`](authentication.md#aifabrix-login) - Authenticate with Miso Controller
  - [`aifabrix logout`](authentication.md#aifabrix-logout) - Clear authentication tokens
  - [`aifabrix auth config --set-environment <env>`](authentication.md#aifabrix-auth-config) - Set default environment after login (e.g. dev, tst, pro)
- [Infrastructure Commands](infrastructure.md) - Local infrastructure management (Docker containers and development only: up-infra, up-platform, up-miso, up-dataplane, down-infra, down-app)
  - [`aifabrix up-infra`](infrastructure.md#aifabrix-up-infra) - Start local infrastructure (Postgres, Redis, optional Traefik)
  - [`aifabrix up-platform`](infrastructure.md#aifabrix-up-platform) - Start platform (Keycloak, Miso Controller, Dataplane) from community images
  - [`aifabrix up-miso`](infrastructure.md#aifabrix-up-miso) - Install Keycloak + Miso Controller from images (no build)
  - [`aifabrix up-dataplane`](infrastructure.md#aifabrix-up-dataplane) - Register/rotate, deploy, then run dataplane locally in dev (always local deployment)
  - [`aifabrix down-infra [app]`](infrastructure.md#aifabrix-down-infra) - Stop infrastructure or a specific application (omit `app` to stop all infra)
  - [`aifabrix status`](infrastructure.md#aifabrix-status) - Show infrastructure service status
  - [`aifabrix restart <service|app>`](infrastructure.md#aifabrix-restart-service) - Restart infrastructure service or Docker application (required)
  - [`aifabrix doctor`](infrastructure.md#aifabrix-doctor) - Check environment and configuration
- [Developer Isolation Commands](developer-isolation.md) - Port isolation
  - [`aifabrix dev config`](developer-isolation.md#aifabrix-dev-config) - View or set developer ID for port isolation
  - [`aifabrix dev set-id <id>`](developer-isolation.md#aifabrix-dev-config) - Set developer ID (required)

### Application Management
- [Application Management Commands](application-management.md) - Application registration and management
  - [`aifabrix show <appKey>`](application-management.md#aifabrix-show-appkey) - Show app info from local builder/integration (offline) or controller (--online)
  - [`aifabrix app show <appKey>`](application-management.md#aifabrix-app-show-appkey) - Show application from controller (online; same as show --online); `--permissions` for permissions only
  - [`aifabrix app register <appKey>`](application-management.md#aifabrix-app-register-appkey) - Register application and get pipeline credentials
  - [`aifabrix app list`](application-management.md#aifabrix-app-list) - List applications in an environment
  - [`aifabrix app rotate-secret <appKey>`](application-management.md#aifabrix-app-rotate-secret) - Rotate pipeline ClientSecret
  - [`aifabrix app deployment <appKey>`](deployment.md#aifabrix-app-deployment-appkey) - List deployments for an application in current environment
  - [`aifabrix service-user create`](application-management.md#aifabrix-service-user-create) - Create service user (requires options: username, email, redirect-uris, group-names); get one-time secret (see [permissions](permissions.md))

### Application Development
- [Application Development Commands](application-development.md) - Local development
  - [`aifabrix create <app>`](application-development.md#aifabrix-create-app) - Create new application with configuration files
  - [`aifabrix build <app>`](application-development.md#aifabrix-build-app) - Build Docker image
  - [`aifabrix run <app>`](application-development.md#aifabrix-run-app) - Run application locally in Docker container (only apps in `builder/<app>/`; no `--type`)
  - [`aifabrix restart <app>`](application-development.md#aifabrix-restart-app) - Restart a running Docker application (builder/<app>)
  - [`aifabrix logs <app>`](application-development.md#aifabrix-logs-app) - Show application container logs
  - [`aifabrix down-app <app>`](application-development.md#aifabrix-down-app) - Stop and remove application container
  - [`aifabrix dockerfile <app>`](application-development.md#aifabrix-dockerfile-app) - Generate Dockerfile for an application

### Deployment
- [Deployment Commands](deployment.md) - Deploy via Controller (Azure or local Docker)
  - [`aifabrix push <app>`](deployment.md#aifabrix-push-app) - Push image to Azure Container Registry
  - [`aifabrix environment deploy <env>`](deployment.md#aifabrix-environment-deploy-env) - Deploy/setup environment in Miso Controller
  - [`aifabrix deploy <app>`](deployment.md#aifabrix-deploy-app) - Deploy via Miso Controller (use `--local` to send manifest then run app locally or restart dataplane for external; resolves `integration/<app>/` first, then `builder/<app>/`; no app register needed for external)
  - [`aifabrix deployment list`](deployment.md#aifabrix-deployment-list) - List environment deployments for current environment

### Validation & Comparison
- [Validation Commands](validation.md) - Configuration validation
  - [`aifabrix validate <appOrFile>`](validation.md#aifabrix-validate-apporfile) - Validate application or external integration file (resolves `integration/<app>/` first, then `builder/<app>/`)
  - [`aifabrix diff <file1> <file2>`](validation.md#aifabrix-diff-file1-file2) - Compare two configuration files

### External Integration
- [External Integration Commands](external-integration.md) - External system integration
  - [`aifabrix wizard [appName]`](external-integration.md#aifabrix-wizard) - Interactive wizard (mode first; loads/saves integration/<appName>/wizard.yaml); appName optional
  - [`aifabrix download <system-key>`](external-integration.md#aifabrix-download-system-key) - Download external system from dataplane
  - [`aifabrix upload <system-key>`](external-integration.md#aifabrix-upload-system-key) - Upload external system to dataplane (upload → validate → publish; no controller deploy)
  - [`aifabrix delete <system-key>`](external-integration.md#aifabrix-delete-system-key) - Delete external system from dataplane
  - [`aifabrix test <app>`](external-integration.md#aifabrix-test-app) - Run unit tests for external system (local validation)
  - [`aifabrix test-integration <app>`](external-integration.md#aifabrix-test-integration-app) - Run integration tests via dataplane pipeline API
  - [`aifabrix datasource`](external-integration.md#aifabrix-datasource) - Manage external data sources
    - [`aifabrix datasource validate <file>`](external-integration.md#aifabrix-datasource-validate-file) - Validate external datasource JSON file
    - [`aifabrix datasource list`](external-integration.md#aifabrix-datasource-list) - List datasources from environment
    - [`aifabrix datasource diff <file1> <file2>`](external-integration.md#aifabrix-datasource-diff-file1-file2) - Compare two datasource configuration files
    - [`aifabrix datasource deploy <myapp> <file>`](external-integration.md#aifabrix-datasource-deploy-myapp-file) - Deploy datasource to dataplane

### Utilities
- [Utility Commands](utilities.md) - Configuration and secret management
  - [`aifabrix resolve <app>`](utilities.md#aifabrix-resolve-app) - Generate `.env` file from template
  - [`aifabrix json <app>`](utilities.md#aifabrix-json-app) - Generate deployment JSON to disk
  - [`aifabrix split-json <app>`](utilities.md#aifabrix-split-json-app) - Split deployment JSON into component files
  - [`aifabrix convert <app>`](utilities.md#aifabrix-convert-app) - Convert integration/external system and datasource files between JSON and YAML
  - [`aifabrix secure`](utilities.md#aifabrix-secure) - Encrypt secrets in secrets.local.yaml files
  - [`aifabrix secrets`](utilities.md#aifabrix-secrets) - Manage secrets in secrets files
    - [`aifabrix secrets set <key> <value>`](utilities.md#aifabrix-secrets-set) - Set a secret value in secrets file

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
- [External Integration Commands](external-integration.md) - Create and manage external system integrations
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

