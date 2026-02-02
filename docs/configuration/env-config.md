# env-config and variable interpolation

← [Configuration](README.md)

Environment variables in `env.template` can use `${VAR}` syntax; values are resolved from `env-config.yaml` based on deployment context (docker vs local).

**System file:** `lib/schema/env-config.yaml`  
**User override:** Set `aifabrix-env-config` in `~/.aifabrix/config.yaml` to your custom file; it is merged with system defaults.

**Supported variables:** `${NODE_ENV}`, `${MISO_HOST}`, `${MISO_PORT}`, `${MISO_PUBLIC_PORT}`, `${DB_HOST}`, `${DB_PORT}`, `${DB_PUBLIC_PORT}`, `${REDIS_HOST}`, `${REDIS_PORT}`, `${KEYCLOAK_HOST}`, `${KEYCLOAK_PORT}`, `${KEYCLOAK_PUBLIC_PORT}`, and language-specific (`PYTHONUNBUFFERED`, etc.).

**Public port pattern (docker):** Any `*_PORT` gets a corresponding `*_PUBLIC_PORT` = `*_PORT + (developer-id * 100)` when developer-id > 0.

**Example:**
```bash
# env.template
NODE_ENV=${NODE_ENV}
MISO_CONTROLLER_URL=http://${MISO_HOST}:${MISO_PORT}
MISO_PUBLIC_URL=http://localhost:${MISO_PUBLIC_PORT}
```

See [env.template](env-template.md) for kv:// and template usage.
