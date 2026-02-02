# Deploy Environment (First Time)

← [Deploying](../deploying.md)

Before deploying applications, ensure the environment is set up in the Miso Controller.

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
