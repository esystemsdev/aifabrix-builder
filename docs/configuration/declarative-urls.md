# Declarative `url://` placeholders

← [Documentation index](../README.md) · [Configuration](README.md)

When your **`env.template`** contains values like `url://public` or `url://internal`, the Builder replaces them with concrete URLs when it generates `.env` files for **`aifabrix resolve`**, **`aifabrix run`**, and related flows. Resolution runs **after** `kv://` references are resolved, so secrets stay in the usual secret stores.

## What you declare in `application.yaml`

- **`port`** — The listen port inside the container. Host-side ports for local development are **derived** from `port`, your **`developer-id`** in `config.yaml`, and whether the output is for **Docker** (published port) or **local** (workstation) profile. You do **not** set a separate `build.localPort` (removed in favor of this model).
- **`frontDoorRouting.pattern`** — Path pattern for public URLs (for example `/api/*`). The Builder normalizes it when building URLs.

Optional: **`environmentScopedResources: true`** interacts with **`useEnvironmentScopedResources`** in `config.yaml` so public URLs can include a **`/dev`** or **`/tst`** path segment when the effective environment is dev or tst. For **pro** and **miso**-derived keys, no extra path prefix is added even when both flags are on.

## Registry: `urls.local.yaml`

The Builder maintains **`~/.aifabrix/urls.local.yaml`** (under your Fabrix home, or `AIFABRIX_HOME`). It records each known app’s **`{appKey}-port`** and **`{appKey}-pattern`**, updated when the Builder scans **`builder/*/application.yaml`**. Cross-app placeholders such as `url://other-app-public` use the target app’s port and pattern from this registry.

## Supported placeholder shapes

- **`url://public`** — Public base URL for the **current** app (from `env.template`’s app).
- **`url://internal`** — Internal URL (service hostname and listen port in the Docker profile; host-reachable URL in the local profile when `remote-server` is set).
- **`url://<appKey>-public`** / **`url://<appKey>-internal`** — Same rules for another registered app key.

The effective URL also depends on **`remote-server`** in `config.yaml`, **`developer-id`**, and (for tst with a non-zero developer id and a matching remote origin) a **developer-scoped host** on the public URL.

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
