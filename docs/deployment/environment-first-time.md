# Deploy Environment (First Time)

← [Documentation index](../README.md) · [Deploying](../deploying.md)

Before deploying applications, ensure the environment is set up in the Miso Controller.

## Why

Environment deploy provisions the target (dev, tst, pro, or miso) so the controller can run applications there. It creates or updates environment-level resources and isolation.

## How to deploy an environment

Use the environment deploy command with the target environment key. Controller URL and auth come from your config (set via `aifabrix login` or `aifabrix auth config`).

**Minimal command (deploy with default preset):**

```bash
aifabrix environment deploy dev
# or
aifabrix env deploy dev --preset s
aifabrix environment deploy tst
aifabrix environment deploy pro
```

By default the command uses preset **s** (small). You can pass `--preset s|m|l|xl` (case-insensitive) to choose size; for example `aifabrix env deploy dev --preset m`. No config file is required unless you need custom settings. For custom settings (e.g. Azure subscription, tenant, deployment type), use an environment configuration file and pass it with `--config <file>`.

**With a custom config file:**

```bash
aifabrix environment deploy dev --config ./my-environment-config.json
```

## Where you deploy

- **Local Docker:** Use the minimal command above; the controller runs apps in Docker on your machine. See [templates/infra/environment-dev.json](../../templates/infra/environment-dev.json) for a minimal example if you need a config file.
- **Azure:** Azure deploy typically requires **Azure Marketplace** install first. For Azure you may need a config file with extra fields (e.g. subscriptionId, tenantId, deploymentType). See [lib/schema/environment-deploy-request.schema.json](../../lib/schema/environment-deploy-request.schema.json) and [lib/schema/infrastructure-schema.json](../../lib/schema/infrastructure-schema.json) for all supported parameters.

## What happens

1. **Validates environment** – Ensures environment key is valid (miso, dev, tst, pro), checks controller accessibility.
2. **Authenticates** – Uses device token (from `aifabrix login`); requires admin/operator privileges.
3. **Deploys environment** – Provisions environment infrastructure, configures resources, sets up isolation.
4. **Verifies readiness** – Checks environment status, confirms ready for applications.

## Output

```yaml
📋 Deploying environment 'dev' to https://controller.aifabrix.dev...
✓ Environment validated
✓ Authentication successful
🚀 Deploying environment infrastructure...
✅ Environment deployed successfully
   Environment: dev
   Status: ✅ ready
✓ Environment is ready for application deployments
```

**Note:** Environment deployment is typically done once per environment, or when updating environment-level configuration. After the environment is set up, you can deploy multiple applications to it with `aifabrix deploy <app>`.

## Environments

- **Open source:** Typically one environment (e.g. `dev`).
- **Standard/Enterprise:** Multiple environments (e.g. `dev`, `tst`, `pro`).

See [Deploying](../deploying.md) for application deployment steps.
