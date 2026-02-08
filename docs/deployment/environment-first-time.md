# Deploy Environment (First Time)

← [Documentation index](../README.md) · [Deploying](../deploying.md)

Before deploying applications, ensure the environment is set up in the Miso Controller.

## Why

Environment deploy provisions the target (dev, tst, pro, or miso) so the controller can run applications there. It creates or updates environment-level resources and isolation.

## Where you deploy

- **Local Docker:** Use a minimal config; the controller runs apps in Docker on your machine. See [templates/infra/environment-dev.json](../../templates/infra/environment-dev.json) for a minimal example.
- **Azure:** Azure deploy typically requires **Azure Marketplace** install first. The environment deploy may need more fields (e.g. subscriptionId, tenantId, deploymentType) from the infrastructure schema. See [lib/schema/environment-deploy-request.schema.json](../../lib/schema/environment-deploy-request.schema.json) and [lib/schema/infrastructure-schema.json](../../lib/schema/infrastructure-schema.json) for all supported parameters.

## Command

```bash
# Deploy/setup the environment (dev, tst, pro, miso)
# Uses controller and environment from config (set via aifabrix login or aifabrix auth config)
aifabrix environment deploy dev
```

## What Happens

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

**Note:** Environment deployment is typically done once per environment, or when updating environment-level configuration. After the environment is set up, you can deploy multiple applications to it.

## Environments

- **Open source:** Typically one environment (e.g. `dev`).
- **Standard/Enterprise:** Multiple environments (e.g. `dev`, `tst`, `pro`).

See [Deploying](../deploying.md) for application deployment steps.
