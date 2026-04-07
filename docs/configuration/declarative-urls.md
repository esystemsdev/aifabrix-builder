# Declarative `url://` placeholders

← [Documentation index](../README.md) · [Configuration](README.md)

When your **`env.template`** contains values like `url://public` or `url://internal`, the Builder replaces them with concrete URLs when it generates `.env` files for **`aifabrix resolve`**, **`aifabrix run`**, and related flows. Resolution runs **after** `kv://` references are resolved, so secrets stay in the usual secret stores.

## What you declare in `application.yaml`

- **`port`** — The listen port inside the container. Host-side ports for local development are **derived** from `port`, your **`developer-id`** in `config.yaml`, and whether the output is for **Docker** (published port) or **local** (workstation) profile. You do **not** set a separate `build.localPort` (removed in favor of this model).
- **`frontDoorRouting.pattern`** — Path pattern for public URLs (for example `/api/*`). The Builder normalizes it when building URLs.
- **`frontDoorRouting.host`** (when Traefik ingress is enabled for the app) — **Hostname template only** (no path, no `url://`). Supported placeholders: **`${DEV_USERNAME}`** (from `developer-id`) and **`${REMOTE_HOST}`** (hostname parsed from **`remote-server`** in `config.yaml`). For **`developer-id` 0, missing, or empty**, **`${DEV_USERNAME}`** is omitted so you get the **bare** remote hostname (e.g. `builder02.local`), not `dev.builder02.local` or `.builder02.local`. For non-zero ids the label is `dev01`, `dev02`, etc. Prefer **`${DEV_USERNAME}.${REMOTE_HOST}`**. If you write **`${DEV_USERNAME}${REMOTE_HOST}`** without a dot, the Builder inserts one between the two tokens. If **`remote-server`** is unset, **`${REMOTE_HOST}`** expands to empty and stray dots are trimmed. The same expansion is applied to Traefik labels in generated Compose files when **`traefik: true`** in config and **`frontDoorRouting.enabled: true`**.

Optional: **`environmentScopedResources: true`** interacts with **`useEnvironmentScopedResources`** in `config.yaml` so public URLs can include a **`/dev`** or **`/tst`** path segment when the effective environment is dev or tst. For **pro** and **miso**-derived keys, no extra path prefix is added even when both flags are on.

## Registry: `urls.local.yaml`

The Builder maintains **`~/.aifabrix/urls.local.yaml`** (under your Fabrix home, or `AIFABRIX_HOME`). It records each known app’s **`{appKey}-port`** and **`{appKey}-pattern`**, updated when the Builder scans **`builder/*/application.yaml`**. Cross-app placeholders such as `url://other-app-public` use the target app’s port and pattern from this registry.

## Supported placeholder shapes

**Full URL** (scheme + host + port + env path prefix + normalized `frontDoorRouting.pattern`):

- **`url://public`** / **`url://internal`** — Current app.
- **`url://<appKey>-public`** / **`url://<appKey>-internal`** — Cross-app (for example `url://dataplane-public`, `url://keycloak-internal`). The target app must be registered from **`builder/<appKey>/application.yaml`**.

**Host only** (origin: `http://host:port` with no path prefix and no front-door path — useful when path is a separate variable, e.g. Keycloak `KC_HOSTNAME` vs `KC_HTTP_RELATIVE_PATH`):

- **`url://host-public`** / **`url://host-internal`**
- **`url://<appKey>-host-public`** / **`url://<appKey>-host-internal`**

**Virtual directory only** (normalized path from `frontDoorRouting.pattern`, e.g. `/auth` from `/auth/*`; **`vdir-public` and `vdir-internal` resolve to the same path**):

- **`url://vdir-public`** / **`url://vdir-internal`**
- **`url://<appKey>-vdir-public`** / **`url://<appKey>-vdir-internal`**

The effective URL also depends on **`remote-server`** in `config.yaml`, **`developer-id`**, **`traefik`** (whether public base uses the expanded **`frontDoorRouting.host`** vs published localhost ports or the remote origin), and (for tst with a non-zero developer id and a matching remote origin) a **developer-scoped host** on the public URL when using the remote base.

## `aifabrix run` and `--reload`

For apps with **`build.envOutputPath`**, the Builder can write a host-side `.env` next to your source tree. **Without** `--reload`, that file uses the **local** profile for URL expansion where it differs from Docker (for example different host ports). **With** `aifabrix run <app> --reload` in dev, the file written to `envOutputPath` is aligned with the **container** `.env` so `url://` values match what the running container sees.

`--reload` with a non-local remote Docker setup requires Mutagen-related settings in `config.yaml`. If they are missing, the command fails with a clear message pointing at **`aifabrix dev init`** and the sync-related keys.

## Migration from `build.localPort`

Older samples used **`build.localPort`** for a host-only port. That field is **removed**; use **`port`** only. Local host ports follow **`port + 10 + developerIdNum * 100`** (with `developerIdNum` parsed from `developer-id`; missing or invalid id is treated as **0**, giving **`port + 10`**). See **`application-schema.json`** metadata changelog **1.4.0** and the root **`CHANGELOG.md`** for the breaking change note.

## Related topics

- [env.template](env-template.md) — template file and `kv://`
- [application.yaml](application-yaml.md) — `port`, `frontDoorRouting`, scoped resources
- [Secrets and config](secrets-and-config.md) — `config.yaml`, `developer-id`, `remote-server`
- [Developer isolation](../commands/developer-isolation.md) — remote dev and `dev init`
