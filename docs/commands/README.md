# CLI Commands Reference

← [Back to Your Own Applications](../your-own-applications.md)

Complete command reference organized by concept with examples and troubleshooting.

---

## Table of Contents

### Authentication & Setup
- [Authentication Commands](authentication.md) - Login and logout
  - `aifabrix login` - Authenticate with Miso Controller
  - `aifabrix logout` - Clear authentication tokens
- [Infrastructure Commands](infrastructure.md) - Local infrastructure management
  - `aifabrix up-infra` - Start local infrastructure (Postgres, Redis, optional Traefik)
  - `aifabrix up-platform` - Start platform (Keycloak, Miso Controller, Dataplane) from community images
  - `aifabrix up-miso` - Install Keycloak + Miso Controller from images (no build)
  - `aifabrix up-dataplane` - Register/rotate, run, and deploy dataplane in dev
  - `aifabrix down-infra` - Stop infrastructure or an app
  - `aifabrix status` - Show infrastructure service status
  - `aifabrix restart` - Restart infrastructure service
  - `aifabrix doctor` - Check environment and configuration
- [Developer Isolation Commands](developer-isolation.md) - Port isolation
  - `aifabrix dev config` - View or set developer ID for port isolation

### Application Management
- [Application Management Commands](application-management.md) - Application registration and management
  - `aifabrix show` - Show app info from local builder/integration (offline) or controller (--online)
  - `aifabrix app show <appKey>` - Show application from controller (online; same as show --online)
  - `aifabrix app register` - Register application and get pipeline credentials
  - `aifabrix app list` - List applications in an environment
  - `aifabrix app rotate-secret` - Rotate pipeline ClientSecret

### Application Development
- [Application Development Commands](application-development.md) - Local development
  - `aifabrix create` - Create new application with configuration files
  - `aifabrix build` - Build Docker image
  - `aifabrix run` - Run application locally in Docker container
  - `aifabrix dockerfile` - Generate Dockerfile for an application

### Deployment
- [Deployment Commands](deployment.md) - Deploy via Controller (Azure or local Docker)
  - `aifabrix push` - Push image to Azure Container Registry
  - `aifabrix environment deploy` - Deploy/setup environment in Miso Controller
  - `aifabrix deploy` - Deploy via Miso Controller (Azure Container Apps or local Docker)
  - `aifabrix deployments` - List deployments for an environment

### Validation & Comparison
- [Validation Commands](validation.md) - Configuration validation
  - `aifabrix validate` - Validate application or external integration file
  - `aifabrix diff` - Compare two configuration files

### External Integration
- [External Integration Commands](external-integration.md) - External system integration
  - `aifabrix wizard [appName]` - Interactive wizard (mode first; loads/saves integration/<appName>/wizard.yaml)
  - `aifabrix download` - Download external system from dataplane
  - `aifabrix test` - Run unit tests for external system (local validation)
  - `aifabrix test-integration` - Run integration tests via dataplane pipeline API
  - `aifabrix datasource` - Manage external data sources
    - `aifabrix datasource validate` - Validate external datasource JSON file
    - `aifabrix datasource list` - List datasources from environment
    - `aifabrix datasource diff` - Compare two datasource configuration files
    - `aifabrix datasource deploy` - Deploy datasource to dataplane

### Utilities
- [Utility Commands](utilities.md) - Configuration and secret management
  - `aifabrix resolve` - Generate `.env` file from template
  - `aifabrix json` - Generate deployment JSON
  - `aifabrix split-json` - Split deployment JSON into component files
  - `aifabrix genkey` - Generate deployment key
  - `aifabrix secure` - Encrypt secrets in secrets.local.yaml files
  - `aifabrix secrets` - Manage secrets in secrets files
    - `aifabrix secrets set` - Set a secret value in secrets file

### Reference
- [Command Reference](reference.md) - Common workflows, global options, exit codes, configuration, and getting help

---

## Quick Navigation

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

**Utilities:**
- [Utility Commands](utilities.md) - Configuration and secret management
- [Validation Commands](validation.md) - Validate and compare configurations

**Reference:**
- [Command Reference](reference.md) - Workflows, options, exit codes, configuration

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

