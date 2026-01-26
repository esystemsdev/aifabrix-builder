# CLI Reference

← [Back to Quick Start](quick-start.md)

**Note:** The CLI reference has been reorganized into concept-based files for better navigation. All command documentation is now available in the [Commands Index](commands/README.md).

**Alias:** You can use `aifx` instead of `aifabrix` in any command (e.g. `aifx up`, `aifx create myapp`).

---

## New Structure

The CLI reference is now organized by concept in the `commands/` folder:

### Quick Access
- **[Commands Index](commands/README.md)** - Complete table of contents and navigation

### By Category
- **[Authentication Commands](commands/authentication.md)** - Login and logout
- **[Infrastructure Commands](commands/infrastructure.md)** - Local infrastructure management
- **[Developer Isolation Commands](commands/developer-isolation.md)** - Port isolation
- **[Application Management Commands](commands/application-management.md)** - Application registration
- **[Application Development Commands](commands/application-development.md)** - Local development
- **[Deployment Commands](commands/deployment.md)** - Deploy via Controller (Azure or local Docker)
- **[Validation Commands](commands/validation.md)** - Configuration validation
- **[External Integration Commands](commands/external-integration.md)** - External system integration
- **[Utility Commands](commands/utilities.md)** - Configuration and secret management
- **[Command Reference](commands/reference.md)** - Workflows, options, exit codes, configuration

---

## Legacy Anchor Links

For backward compatibility, anchor links from the old structure are preserved. If you have bookmarks or links to specific commands, they will continue to work:

- `#aifabrix-login` → [Authentication Commands](commands/authentication.md#aifabrix-login)
- `#aifabrix-logout` → [Authentication Commands](commands/authentication.md#aifabrix-logout)
- `#aifabrix-up` → [Infrastructure Commands](commands/infrastructure.md#aifabrix-up)
- `#aifabrix-down` → [Infrastructure Commands](commands/infrastructure.md#aifabrix-down)
- `#aifabrix-status` → [Infrastructure Commands](commands/infrastructure.md#aifabrix-status)
- `#aifabrix-restart-service` → [Infrastructure Commands](commands/infrastructure.md#aifabrix-restart-service)
- `#aifabrix-doctor` → [Infrastructure Commands](commands/infrastructure.md#aifabrix-doctor)
- `#aifabrix-dev-config` → [Developer Isolation Commands](commands/developer-isolation.md#aifabrix-dev-config)
- `#aifabrix-app-register-appkey` → [Application Management Commands](commands/application-management.md#aifabrix-app-register-appkey)
- `#aifabrix-app-list` → [Application Management Commands](commands/application-management.md#aifabrix-app-list)
- `#aifabrix-app-rotate-secret` → [Application Management Commands](commands/application-management.md#aifabrix-app-rotate-secret)
- `#aifabrix-create-app` → [Application Development Commands](commands/application-development.md#aifabrix-create-app)
- `#aifabrix-build-app` → [Application Development Commands](commands/application-development.md#aifabrix-build-app)
- `#aifabrix-run-app` → [Application Development Commands](commands/application-development.md#aifabrix-run-app)
- `#aifabrix-dockerfile-app` → [Application Development Commands](commands/application-development.md#aifabrix-dockerfile-app)
- `#aifabrix-push-app` → [Deployment Commands](commands/deployment.md#aifabrix-push-app)
- `#aifabrix-environment-deploy-env` → [Deployment Commands](commands/deployment.md#aifabrix-environment-deploy-env)
- `#aifabrix-deploy-app` → [Deployment Commands](commands/deployment.md#aifabrix-deploy-app)
- `#aifabrix-deployments` → [Deployment Commands](commands/deployment.md#aifabrix-deployments)
- `#aifabrix-validate-apporfile` → [Validation Commands](commands/validation.md#aifabrix-validate-apporfile)
- `#aifabrix-diff-file1-file2` → [Validation Commands](commands/validation.md#aifabrix-diff-file1-file2)
- `#aifabrix-wizard` → [External Integration Commands](commands/external-integration.md#aifabrix-wizard)
- `#aifabrix-download-system-key` → [External Integration Commands](commands/external-integration.md#aifabrix-download-system-key)
- `#aifabrix-delete-system-key` → [External Integration Commands](commands/external-integration.md#aifabrix-delete-system-key)
- `#aifabrix-test-app` → [External Integration Commands](commands/external-integration.md#aifabrix-test-app)
- `#aifabrix-test-integration-app` → [External Integration Commands](commands/external-integration.md#aifabrix-test-integration-app)
- `#aifabrix-datasource` → [External Integration Commands](commands/external-integration.md#aifabrix-datasource)
- `#aifabrix-datasource-validate-file` → [External Integration Commands](commands/external-integration.md#aifabrix-datasource-validate-file)
- `#aifabrix-datasource-list` → [External Integration Commands](commands/external-integration.md#aifabrix-datasource-list)
- `#aifabrix-datasource-diff-file1-file2` → [External Integration Commands](commands/external-integration.md#aifabrix-datasource-diff-file1-file2)
- `#aifabrix-datasource-deploy-myapp-file` → [External Integration Commands](commands/external-integration.md#aifabrix-datasource-deploy-myapp-file)
- `#aifabrix-resolve-app` → [Utility Commands](commands/utilities.md#aifabrix-resolve-app)
- `#aifabrix-json-app` → [Utility Commands](commands/utilities.md#aifabrix-json-app)
- `#aifabrix-split-json-app` → [Utility Commands](commands/utilities.md#aifabrix-split-json-app)
- `#aifabrix-genkey-app` → [Utility Commands](commands/utilities.md#aifabrix-genkey-app)
- `#aifabrix-secure` → [Utility Commands](commands/utilities.md#aifabrix-secure)
- `#aifabrix-secrets` → [Utility Commands](commands/utilities.md#aifabrix-secrets)
- `#aifabrix-secrets-set` → [Utility Commands](commands/utilities.md#aifabrix-secrets-set)

---

## Quick Links

**Getting Started:**
- [Quick Start Guide](quick-start.md)
- [Commands Index](commands/README.md)

**Common Tasks:**
- [Authentication](commands/authentication.md) - Login to Miso Controller
- [Infrastructure](commands/infrastructure.md) - Start local infrastructure
- [Application Development](commands/application-development.md) - Create and run apps
- [Deployment](commands/deployment.md) - Deploy via Controller (Azure or local Docker)

**Reference:**
- [Command Reference](commands/reference.md) - Workflows, options, exit codes, configuration
