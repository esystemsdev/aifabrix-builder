# env-config and variable interpolation

← [Documentation index](../README.md) · [Configuration](README.md)

Environment variables in `env.template` can use `${VAR}` syntax; values are resolved from `env-config.yaml` based on deployment context. The only persisted `.env` is written at `build.envOutputPath` when set (or a temp path for run); there is no separate "docker vs local" file location.

**System file:** `lib/schema/env-config.yaml`  
**User override:** Set `aifabrix-env-config` in `~/.aifabrix/config.yaml` to your custom file; it is merged with system defaults.

**Supported variables:** `${NODE_ENV}`, `${PORT}`, `${MISO_HOST}`, `${MISO_PORT}`, `${MISO_PUBLIC_PORT}`, `${DB_HOST}`, `${DB_PORT}`, `${DB_PUBLIC_PORT}`, `${REDIS_HOST}`, `${REDIS_PORT}`, `${KEYCLOAK_HOST}`, `${KEYCLOAK_PORT}`, `${KEYCLOAK_PUBLIC_PORT}`, and language-specific (`PYTHONUNBUFFERED`, etc.). `${PORT}` is resolved from `application.yaml` → `port` (with developer-id offset when applicable), so values like `WEB_SERVER_URL=http://localhost:${PORT}` work.

**Public port pattern (docker):** Any `*_PORT` gets a corresponding `*_PUBLIC_PORT` = `*_PORT + (developer-id * 100)` when developer-id > 0.

**Example:**
```bash
# env.template
NODE_ENV=${NODE_ENV}
PORT=3000
WEB_SERVER_URL=http://localhost:${PORT},
MISO_CONTROLLER_URL=http://${MISO_HOST}:${MISO_PORT}
MISO_PUBLIC_URL=http://localhost:${MISO_PUBLIC_PORT}
```

When you run `aifabrix resolve <app>`, `${PORT}` is replaced with the app port from `application.yaml` → `port` (developer-id adjustment when applicable), so `WEB_SERVER_URL` ends up with the correct URL. To set the port, use `port` in `application.yaml`; you can also override via `PORT` in env-config (e.g. `~/.aifabrix/config.yaml`) if needed.

See [env.template](env-template.md) for kv:// and template usage.
