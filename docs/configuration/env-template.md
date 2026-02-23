# env.template

← [Documentation index](../README.md) · [Configuration](README.md)

Environment variables template. `aifabrix resolve <app>` and run/build generate `.env` from this file plus secrets. The only persisted `.env` is written to `build.envOutputPath` when set (or to a temp path for run); never to `builder/<app>/.env` or `integration/<app>/.env`.

**kv:// references:** `kv://name` resolves from the secrets file (e.g. `~/.aifabrix/secrets.local.yaml`). Pattern: `<app>-client-idKeyVault`, `<app>-client-secretKeyVault`, or any `*KeyVault` key.

**Auto-added variables:** Database (if requires.database), Redis (if requires.redis), language-specific (NODE_ENV, PYTHON*), MISO_* (if controller enabled), ALLOWED_ORIGINS, WEB_SERVER_URL. Values like `${NODE_ENV}`, `${PORT}`, and `${MISO_HOST}` are resolved from [env-config](env-config.md) and application config (for `${PORT}`).

### Build, run, shell, and install

- **Run and shell:** Environment comes from `env.template` with `kv://` resolved from local or project secrets (see [Secrets and config](secrets-and-config.md)). Add `NPM_TOKEN=kv://npm-token-secretKeyVault` and/or `PYPI_TOKEN=kv://pypi-token-secretKeyVault` (or project-specific keys) to `env.template` and ensure those keys exist in the configured secrets file; then `aifabrix run <app>` and `aifabrix shell <app>` will have them in the container.
- **Build:** Build receives `NPM_TOKEN` and `PYPI_TOKEN` as Docker build-args when they are in `env.template` (e.g. `NPM_TOKEN=kv://npm-tokenKeyVault`) or in your secrets file, so private npm/pypi work during `RUN npm install` or `pip install`. Add them to `env.template` as `kv://` references (same as run/shell). Alternatively use a pre-authenticated context (e.g. `.npmrc` in context with a CI-injected token), or run `aifabrix install <app>` after build. Install, test, and lint run inside the container with the same resolved `.env` as run/shell.
- **Install (and test, test-e2e, test-integration, lint):** These commands run inside the same container as run/shell (dev) or an ephemeral container (tst), with the same resolved `.env` as run. They see `NPM_TOKEN`/`PYPI_TOKEN` when present in `env.template` and secrets.

**Example:**
```bash
NODE_ENV=${NODE_ENV}
PORT=3000
API_KEY=kv://my-api-keyKeyVault
MISO_CONTROLLER_URL=http://${MISO_HOST}:${MISO_PORT}
```

See [application.yaml](application-yaml.md), [env-config](env-config.md), [Secrets and config](secrets-and-config.md).
