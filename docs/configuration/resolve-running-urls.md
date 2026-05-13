# How running URLs are resolved (`url://` in `env.template`)

This guide is for anyone using the AI Fabrix Builder CLI who needs predictable URLs in generated `.env` files. It explains which files and settings drive the result, in what order, so you can validate behavior without reading the source code. For the **full `url://` token list** and **`application.yaml`** fields, see [Declarative `url://` placeholders](declarative-urls.md).

---

## What happens when you resolve or run an app

When you run **`aifabrix resolve <app>`** or **`aifabrix run <app>`** (with a normal app layout), the CLI builds `.env` from `env.template` roughly like this:

| Step | What you should know |
| --- | --- |
| 1 | `kv://…` placeholders are resolved first (secrets / catalog). |
| 2 | Some vdir-related lines may be rewritten when the front door is not active for that app. |
| 3 | If the template still contains **`url://…`**, each token is replaced with a concrete URL. |
| 4 | While doing that, the CLI **refreshes** the URL registry file **`urls.local.yaml`** next to **`config.yaml`**, merging in ports and patterns discovered from **`application.yaml`** under your builder roots (including common monorepo `packages/` layouts). Treat `urls.local.yaml` as **maintained by the tool**, not a hand-written static file—though you may add optional keys (see below). |

If there is no app manifest in scope (for example env-only generation), **`url://` expansion is skipped**.

---

## Files that matter

| File | Role |
| --- | --- |
| **`env.template`** (per app) | Defines keys; values may include `url://` tokens (and comma-separated lists of them). |
| **`application.yaml`** (per app) | Root **`port`**, optional **`build.containerPort`**, and **`frontDoorRouting`** (pattern, `enabled`, `host`, `tls`, `internalDockerUseOriginOnly`) feed URL shape and registry refresh. |
| **`~/.aifabrix/config.yaml`** (or your configured config directory) | **`remoteServer`**, **`developer-id`**, **`tlsEnabled`**, optional **`traefik`**, per-app **`applications`** entries (including **`proxy`**), **`useEnvironmentScopedResources`**, and related fields. |
| **`urls.local.yaml`** (same directory as `config.yaml`) | Cached **per-app** `port`, `pattern`, optional `containerPort`, optional **`internalDockerUseOriginOnly`** mirror. Refreshed on resolve; optional keys can override or supplement manifest-only cases. |

---

## `urls.local.yaml` keys (per application key)

Keys use the **application key** (the `app.key` in `application.yaml`, or the builder folder name if missing).

| Key | Meaning |
| --- | --- |
| `{appKey}-port` | Published / manifest port used for browser-style and registry fallbacks (example: `keycloak-port`). |
| `{appKey}-pattern` | Front-door path pattern (normalized when used), or a default when the manifest omits it. |
| `{appKey}-containerPort` | In-container listen port when it differs from the published port (for example Keycloak published vs process port). |
| `{appKey}-internalDockerUseOriginOnly` | When set to **`true`** or **`false`**, overrides the same flag from **`application.yaml`** for **Docker internal “full” URLs** (service-to-service). Use this when the manifest is not on disk for that app but you still need origin-only internal bases (no extra path segment such as `/auth`). Accepted forms include YAML booleans and common string forms (`"true"`, `"false"`, `"0"`, `"1"`, `yes`/`no`, `on`/`off`). |

Replace `{appKey}` with your application key (the `app.key` in `application.yaml`, or the builder folder name).

Refresh copies **`internalDockerUseOriginOnly` from `application.yaml` into this file only when that property is explicitly present** in the manifest. If it is absent from YAML, the CLI does not clear an existing registry line—so a value you add only in `urls.local.yaml` can stay until you change it.

---

## `config.yaml` behavior that applies **per target app**

Each **`url://`** token refers to an **app** (the current app, or another app for cross-app tokens such as **`url://keycloak-public`**). Rules that depend on “proxy” or Traefik use that **target** app’s entry under **`applications`**, not only the app whose `.env` you are generating.

| Setting | Effect |
| --- | --- |
| **`traefik: true`** (top level) **and** `applications.{target}.proxy: true` for that token’s target app | Traefik-style public URL hints can apply for that target (host template, TLS hints), when the target’s **`application.yaml`** also has front door routing configured as required. **Exception:** if the expanded host is **loopback** (`localhost`, `127.0.0.1`, `::1`), the public scheme stays **`http://`** even when **`tlsEnabled`** is **`true`**. |
| **`applications.{target}.proxy: false`** (Docker profile) | For **public** `url://` surfaces for that target, the CLI prefers **`http://localhost:`** plus the published port (always **`http`** on loopback, regardless of **`tlsEnabled`**) instead of your remote host, so local runs do not depend on ingress when that app is marked no-proxy (for example after **`aifabrix run`** with **`--no-proxy`** for one app, another app such as Keycloak can still use **`proxy: true`** and keep public issuer-style URLs). |
| Missing **`applications`** entry for an app | Treated like **proxy off** for that app unless you rely on legacy **`noProxy`** (see below). Prefer setting **`proxy` explicitly** per app. |
| Legacy **`noProxy: true`** on an app entry | Same as **`proxy: false`**. |
| Legacy **`noProxy: false`** with no **`proxy`** | Treated like **`proxy: true`** for migration compatibility. |

**`tlsEnabled`** (from **`up-infra --tls`** and stored in config) affects whether **`https`** is chosen for **non-loopback** public bases and can force **`https`** on Traefik-style bases even when the manifest sets **`frontDoorRouting.tls: false`**. **Loopback** public authorities (**`localhost`**, **`127.0.0.1`**, **`::1`**) always use **`http://`**, regardless of **`tlsEnabled`**.

---

## How a **public** browser-style URL is chosen (first match wins)

This applies to tokens such as **`public`**, **`host-public`**, **`keycloak-public`**, and other **`{app}-public`** forms.

| Priority | Situation | Typical outcome |
| --- | --- | --- |
| 1 | Infra Traefik is on **for that target app**, front door path is active, and a **host template** exists in the target manifest | URL uses the expanded **front-door host** and scheme rules above. |
| 2 | Docker, and that target’s **`applications.{target}.proxy`** is **off** | **`http://localhost:`** plus the published port (loopback is always **`http`**, not **`https`**). |
| 3 | **`remoteServer`** is set in config | URL uses your **remote dev host** and port rules (scheme follows TLS config, with the **loopback** exception if the host is **`localhost`** / **`127.0.0.1`** / **`::1`**). |
| 4 | Otherwise | **`http://localhost:`** with the published or derived port for your profile and developer id (always **`http`** on loopback). |

**Local workstation:** for the **current** app, published ports may apply a **+10** style offset for local iteration; for **another** app’s token, sibling services use compose-style published offsets without that workstation bump.

---

## **Internal** and **host-only** surfaces (summary)

| You run as | Token style | Typical meaning |
| --- | --- | --- |
| **Docker** | **`internal`**, **`keycloak-internal`**, and similar **`{app}-internal`** tokens, host variants | Base **`http://{service}:{listenPort}`** for service-to-service (service name matches the Docker service / app key). Optional normalized **pattern** path after that base when the front door is active and **`internalDockerUseOriginOnly`** is not **`true`** — see the next subsection. **Vdir-internal** in Docker is intentionally empty. |
| **Local** (no remote server) | internal | Often **matches the public** origin for that token (same host/port as browser). |
| **Local** with **remote server** | internal | Mirrors the **public** construction for that token so remote dev stays consistent. |

**Docker internal “full” URL and paths:** If **`frontDoorRouting.internalDockerUseOriginOnly: true`** (in **`application.yaml`** or overridden in **`urls.local.yaml`**), internal full URLs stay at the **origin** only (no appended normalized pattern path). If **`false`**, the normalized pattern (for example **`/auth`**) may be appended after **`http://keycloak:8080`**.

---

## Token cheat sheet (`url://…`)

Tokens use letters, digits, **`.`**, **`_`**, **`-`**.

| Kind | Examples | Meaning |
| --- | --- | --- |
| Current app | **`url://public`**, **`url://internal`**, **`url://host-public`**, **`url://vdir-public`** | Target is the app whose **`env.template`** is being expanded. |
| Another app | **`url://keycloak-public`**, **`url://dataplane-internal`**, **`url://keycloak-host-public`** | Prefix before **`-public`**, **`-internal`**, **`-private`**, or before **`-host-…` / `-vdir-…`** is the **other app’s key**. Longer suffixes are matched first. |
| Pitfall | **`url://public-dataplane`** | **Not** “dataplane as target”; it is parsed as current-app **`public`** with an odd suffix. Use **`url://dataplane-public`** for cross-app. |

---

## Lines in `env.template` that change expansion

| Variable | Role |
| --- | --- |
| **`MISO_CLIENTID`** | With optional **`MISO_PIPELINE_ENV_KEY`**, influences environment segment (for example **`dev`** vs **`tst`**) when path prefixes for scoped resources apply together with Traefik. |
| Comma-separated values | Each **`url://`** segment in a list is expanded on its own. |

---

## Manual check (quick)

1. Pick **`env.template`** lines that use **`url://`** for the current app and for one **other** app.
2. Set **`~/.aifabrix/config.yaml`** the way you intend (**`traefik`**, **`applications.*.proxy`**, **`remoteServer`**, run **`up-infra --tls`** or not).
3. Run **`aifabrix resolve`** for your app (for example **`aifabrix resolve miso-controller`**) and open the generated **`.env`**.
4. Compare public lines to the **public** table, internal lines to the **internal** table, and confirm **cross-app** tokens used the **target** app’s **`applications.{target}.proxy`**, not only the app you resolved.
5. If you rely on **`{appKey}-internalDockerUseOriginOnly`** in **`urls.local.yaml`**, run resolve twice: before and after editing that key, and confirm internal URLs match the **`urls.local.yaml` keys** section above.

---

## Docker and `localhost`

For **public** URLs with **`proxy: false`**, the CLI intentionally uses **`localhost`** and the **host-published** port so your browser talks to the mapped port on the machine. The scheme is always **`http://`** for that loopback authority, even when **`tlsEnabled`** is **`true`** in **`config.yaml`**. **Inside a container**, **`localhost`** refers to that container, not the host; use your platform’s host gateway or extra hosts if a container must call another service via host-published ports.

---

## Keeping this document current

When CLI behavior for `url://` resolution changes in a release, update this page in the same release so operators see the same rules the CLI follows.
