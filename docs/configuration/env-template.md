# env.template

← [Documentation index](../README.md) · [Configuration](README.md)

Environment variables template. `aifabrix resolve <app>` generates `.env` from this file plus secrets.

**kv:// references:** `kv://name` resolves from the secrets file (e.g. `~/.aifabrix/secrets.local.yaml`). Pattern: `<app>-client-idKeyVault`, `<app>-client-secretKeyVault`, or any `*KeyVault` key.

**Auto-added variables:** Database (if requires.database), Redis (if requires.redis), language-specific (NODE_ENV, PYTHON*), MISO_* (if controller enabled), ALLOWED_ORIGINS, WEB_SERVER_URL. Values like `${NODE_ENV}` and `${MISO_HOST}` are resolved from [env-config](env-config.md).

**Example:**
```bash
NODE_ENV=${NODE_ENV}
PORT=3000
API_KEY=kv://my-api-keyKeyVault
MISO_CONTROLLER_URL=http://${MISO_HOST}:${MISO_PORT}
```

See [application.yaml](application-yaml.md), [env-config](env-config.md), [Secrets and config](secrets-and-config.md).
