# Declarative `url://` placeholders

← [Documentation index](../README.md) · [Configuration](README.md)

When your **`env.template`** contains values like `url://public` or `url://internal`, the Builder replaces them with concrete URLs when it generates `.env` files for **`aifabrix resolve`**, **`aifabrix run`**, and related flows. Resolution runs **after** `kv://` references are resolved, so secrets stay in the usual secret stores. **Comma-separated** values are supported (e.g. **`MISO_ALLOWED_ORIGINS=url://host-public,url://host-private`**): each `url://…` segment is expanded; other segments (e.g. `http://localhost:*`) are left as-is.

## What you declare in `application.yaml`

- **`port`** — Manifest **published** port (browser / host URL basis and port math). Host-side ports are **derived** from `port`, **`developer-id`**, and **Docker** vs **local** profile. Optional **`build.containerPort`** is the **in-container** listen port when it differs (for example published **8082** with process listening on **8080**). On **`local`** profile, the workstation **`+10`** offset applies only to the **app being resolved** (`currentAppKey`); **`url://<otherApp>-public`** / cross-app host tokens use **`port + developer-id×100`** only (no `+10`), matching published compose ports for sibling services.
- **`frontDoorRouting.pattern`** — Path pattern for public URLs (for example `/api/*`). The Builder normalizes it when building URLs.
- **`frontDoorRouting.host`** (when Traefik ingress is enabled for the app) — **Hostname template only** (no path, no `url://`). Supported placeholders: **`${DEV_USERNAME}`** (from `developer-id`) and **`${REMOTE_HOST}`** (hostname parsed from **`remote-server`** in `config.yaml`). For **`developer-id` 0, missing, or empty**, **`${DEV_USERNAME}`** is omitted so you get the **bare** remote hostname (e.g. `builder02.local`), not `dev.builder02.local` or `.builder02.local`. For non-zero ids the label is `dev01`, `dev02`, etc. Prefer **`${DEV_USERNAME}.${REMOTE_HOST}`**. If you write **`${DEV_USERNAME}${REMOTE_HOST}`** without a dot, the Builder inserts one between the two tokens. If **`remote-server`** is unset, **`${REMOTE_HOST}`** expands to empty and stray dots are trimmed. The same expansion is applied to Traefik labels in generated Compose files when **`traefik: true`** in config and **`frontDoorRouting.enabled: true`**.

Optional: **`environmentScopedResources: true`** plus **`useEnvironmentScopedResources`** in `config.yaml` can add a **`/dev`** or **`/tst`** path segment **only when `traefik: true`** in config and the derived env key is dev or tst. For **pro** and **miso**, no such prefix. With Traefik off, that env segment is not applied. **`url://internal`** on Docker is always **`http://<service>:<listenPort>`** (no path). For **`local`** profile with **no `remote-server`**, **`url://internal`**, **`url://<app>-internal`**, and **`host-internal` / `private`** surfaces expand to the **same** values as their **public** counterparts (browser localhost / published ports), so `aifabrix resolve` workstation `.env` files do not point at Docker service hostnames. **HTTPS vs HTTP** for public URLs follows infra TLS (`tlsEnabled` / `up-infra --tls`) and **`frontDoorRouting.tls`** when using the Traefik host template.

The normalized **`frontDoorRouting.pattern`** path (the same segment as **`url://vdir-*`**) is appended to **`url://public`** / **`url://internal`** (full URL) **only when both** **`traefik: true`** in `config.yaml` **and** **`frontDoorRouting.enabled: true`** for the target app. Otherwise the public base is **origin only** (no virtual-directory path), consistent with a passive front door.

## Registry: `urls.local.yaml`

The Builder maintains **`~/.aifabrix/urls.local.yaml`** (beside `config.yaml`, typically **`~/.aifabrix/`**). For each app it records:

- **`{appKey}-port`** — from manifest **`port`**
- **`{appKey}-pattern`** — from **`frontDoorRouting.pattern`** (or an infra default when omitted)
- **`{appKey}-containerPort`** — optional; set when **`build.containerPort`** is present in **`application.yaml`**

The file is refreshed when the Builder scans **`builder/*/application.yaml`** and after a successful **`aifabrix app register`**. Cross-app tokens such as **`url://other-app-public`** resolve the target app using **`application.yaml`** when present and the registry as a supplement (for example **`port`** / **`containerPort`** / **pattern**).

**Interpolation defaults:** Builder code splits **infra** defaults (Postgres, Redis, …) from **application service** host/port keys used for **`${DATAPLANE_HOST}`**-style placeholders until templates rely entirely on manifests and **`url://`**. See **`lib/utils/infra-env-defaults.js`** (`INFRA_*` vs **`APP_SERVICE_ENV_DEFAULTS_*`**).

## Supported placeholder shapes

**Full URL** (scheme + host + port; plus optional **`/dev`** / **`/tst`** when Traefik and scoped-resource rules apply; plus normalized **`frontDoorRouting.pattern`** only when the front door is **active** — same condition as **`url://vdir-*`**):

- **`url://public`** / **`url://internal`** — Current app. **`url://private`** is an alias for **`url://internal`** (same for **`host-private`** / **`vdir-private`** and cross-app **`*-private`**, used in Keycloak and similar templates).
- **`url://<appKey>-public`** / **`url://<appKey>-internal`** — Cross-app (for example `url://dataplane-public`, `url://keycloak-internal`). The target app must be registered from **`builder/<appKey>/application.yaml`**.

**Host only** (origin: `http://host:port` with no path prefix and no front-door path — pair with **`url://vdir-*`** when your stack splits **public origin** and **ingress path** into separate env vars):

- **`url://host-public`** / **`url://host-internal`**
- **`url://<appKey>-host-public`** / **`url://<appKey>-host-internal`**

**Virtual directory only** (normalized path from `frontDoorRouting.pattern`, e.g. `/auth` from `/auth/*`):

- **`url://vdir-public`** / **`url://vdir-internal`**
- **`url://<appKey>-vdir-public`** / **`url://<appKey>-vdir-internal`**

For the **Docker** profile, **`url://vdir-internal`** is always **empty** (container reachability uses **`http://<service>:<port>`** only). For the **local** profile, **`vdir-internal`** matches **`vdir-public`** when the front door is active.

**Passive front door (no virtual-directory segment):** When **`traefik` is not true** in `config.yaml` **or** the target app’s **`frontDoorRouting.enabled`** is not **`true`**, there is **no** front-door path on public URLs: **`url://vdir-*`** expands to an **empty string** (nothing after `=`, e.g. `MY_PATH_PREFIX=` — the token is fully replaced), and **`url://public`** / cross-app **`*-public`** resolve to the **public origin only** (no `/auth`, `/data`, etc. from `frontDoorRouting.pattern`). When **both** **`traefik: true`** and **`frontDoorRouting.enabled: true`** apply, vdir is the normalized pattern path and full public URLs include that path after any **`/dev`** / **`/tst`** segment.

The effective URL also depends on **`remote-server`**, **`developer-id`**, **`traefik`**, and **`tlsEnabled`**. **`devNN.<remote-host>`** (and any **`frontDoorRouting.host`** template) is used as the public **authority** only when **`traefik: true`** **and** the target app has **`frontDoorRouting.enabled: true`**. If Traefik is on but the front door is passive (`enabled` not **`true`**), public bases use **direct** reachability (`remote-server` + published port, or localhost)—not the ingress hostname. The optional **`/dev`** / **`/tst`** segment still applies when Traefik is on **and** both scoped-resource settings are enabled; it is **not** applied when Traefik is off.

When **Traefik is off**, **`tlsEnabled`** in `config.yaml` (`up-infra --tls`) chooses **`http`** vs **`https`** for the public base built from **`remote-server`**. If TLS is **off**, the scheme is **`http`** even when **`remote-server`** is written as **`https://…`** (typical for direct published ports). If TLS is **on**, the scheme is **`https`**.

When **`remote-server`** has **no port** (e.g. `https://builder02.local`), the public base uses that host with the app’s **published Docker port** (manifest **`port` + `developer-id` × 100). If **`remote-server`** already includes a port, that **host:port** is kept; the scheme still follows **`tlsEnabled`** as above.

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
