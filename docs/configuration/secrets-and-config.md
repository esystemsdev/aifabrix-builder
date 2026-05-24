# Secrets and config.yaml

← [Documentation index](../README.md) · [Configuration](README.md)

How Fabrix handles **secrets** and **`config.yaml`**: Key Vault in Azure production, local files and CLI behaviour on developer machines, and how the pieces fit together.

**On this page:** [At a glance](#at-a-glance) · [Why secure](#why-secure-your-secrets) · [kv:// in templates](#why-use-kv-in-templates) · [Production vs developer](#production-azure-key-vault-vs-developer-cycle) · [config.yaml](#configyaml) · [aifabrix-secrets](#aifabrix-secrets-remote-vs-local) · [Security / ISO 27001](#security-posture-and-iso-27001-aligned-practices) · [secrets.local.yaml](#secretslocalyaml-file-based-secrets) · [admin-secrets.env](#admin-secretsenv-and-run-env-iso-27k) · [Encryption](#encryption-aifabrix-secure) · [External integrations](#external-integrations)

---

## At a glance

| Where | Secret storage |
| ----- | -------------- |
| **Azure production** | **Azure Key Vault** — runtime secrets are not read from `secrets.local.yaml` on the application host. |
| **Developer machine / dev CI** | **`~/.aifabrix/secrets.local.yaml`** plus optional **`aifabrix-secrets`** (YAML path or `https://` API). Default **`kv://`** resolution does **not** merge cwd-ancestor `.aifabrix/secrets.local.yaml`, `builder/secrets.local.yaml`, or `~/.aifabrix/secrets.yaml`. **`BASH_*`** → subprocess `env`, temporary `.env` for compose. |

Same **`kv://`** names in **`env.template`** line up with Key Vault secret names in production and with local YAML keys in development — one logical contract, two resolution backends.

---

## Why secure your secrets

Secrets (tokens, client credentials, controller URLs, encryption keys) need **confidentiality**, **integrity**, and **auditability**.

**Do not commit real values** in Git: not `config.yaml`, not `secrets.local.yaml`, not `.env` with live tokens. Structure and placeholders in repo are fine; production values are not.

Keeping secrets out of version control and in controlled stores supports common compliance themes (e.g. ISO 27001): access control, secure storage, and traceability.

---

## Why use kv:// in templates

**Production (Azure)**  
AI Fabrix stores application secrets in **Azure Key Vault**.

**Templates**  
Use **`kv://`** references in **`env.template`**. That keeps repos free of live secrets while staying aligned with how Key Vault names map in production.

### Local vs Azure

- **Locally:** the Builder resolves `kv://` from **`~/.aifabrix/secrets.local.yaml`** (primary user store) and **`aifabrix-secrets`** (shared file or remote dev API when configured). It does **not** merge other `secrets.local.yaml` files discovered from the current working directory or `builder/secrets.local.yaml` into that default map.
- **In Azure production:** runtime secrets come from **Key Vault** via the deployment model — **not** from `secrets.local.yaml` or Builder shared-secret files on the app host.

Process **`env`** during **`aifabrix build`**, **shell**, **install**, or **push** on a laptop is **developer-cycle only**. There is **no intended** second path that keeps production application secrets as persistent plaintext in repo or manifest if you keep manifests **reference-based**.

More detail: [Production (Azure Key Vault) vs developer cycle](#production-azure-key-vault-vs-developer-cycle). **`kv://`** usage: [env.template](env-template.md).

**After `kv://`** the Builder can expand **`url://`** placeholders — [Declarative url://](declarative-urls.md). Infra keys and Azure naming: [Infra parameters](infra-parameters.md), command **`aifabrix parameters validate`**.

---

## Production (Azure Key Vault) vs developer cycle

### Azure / production

- Runtime secrets live in **Azure Key Vault**.
- Manifests use **Key Vault references**; the same `kv://` **naming** aligns with Key Vault secret names.
- The running app does **not** use `secrets.local.yaml`, the **`aifabrix-secrets`** file or HTTPS store on the **application host**, or **`BASH_*`** merge for **production secret storage**.

**Key Vault is the source of truth in production** — not the developer file layout.

### Developer cycle only

- **`~/.aifabrix/secrets.local.yaml`** (primary user file for `kv://`)
- Optional **`aifabrix-secrets`**: file path or `https://` URL (merged after user; user wins on same key)
- **`BASH_*`** → subprocess **`env`**, temporary resolved **`.env`**
- **`aifabrix secure`** for encrypted local files (`secure://`)

These exist so you can **build, run, resolve, and push** without putting real values in Git. They **mirror** the `kv://` contract locally; they **do not replace** Key Vault in Azure.

### Operational caveat

If someone commits **literal secrets** in `application.yaml`, deployment JSON, or `env.template` (instead of references), any environment can leak them. That is **misconfiguration**, not a designed production path. Prefer references, **`aifabrix secret validate`**, and code review.

---

## config.yaml

### Where it lives

`~/.aifabrix/config.yaml`, or the directory from **`AIFABRIX_HOME`** / **`AIFABRIX_CONFIG`**.

### What it controls

Developer state: **developer-id**, **aifabrix-home**, **aifabrix-work**, **aifabrix-secrets**, **aifabrix-env-config**, **traefik**, **controller**, **environment**, **device** tokens, per-environment client tokens, **remote development** (`remote-server`, `docker-endpoint`), and related settings.

### Permissions

The CLI writes `config.yaml` with mode **`600`** and enforces **`700`** on the config directory and **`600`** on the file when reading.

### Registering `AIFABRIX_HOME` / `AIFABRIX_WORK`

**`aifabrix dev set-home`** and **`aifabrix dev set-work`** can:

- **Windows:** register variables in the user environment (new terminals / IDEs pick them up).
- **macOS / Linux:** write `aifabrix-shell-env.sh` and a marked block in `.zshrc` / `.bashrc`.

Use **`--no-register-env`** to only update `config.yaml`. **New terminals** pick up variables after profile registration. **This terminal (bash/zsh):** **`eval "$(aifabrix dev shell-env)"`**. Script-only paths: **`aifabrix dev print-home`**, **`aifabrix dev print-work`**.

### Important fields (short)

| Topic | Notes |
| ----- | ----- |
| **`aifabrix-work`** | Optional workspace root. When set (or **`AIFABRIX_WORK`** is set), platform **`builder/keycloak`**, **`builder/miso-controller`**, and **`builder/dataplane`** materialize under that tree; when unset, they use **aifabrix-home**. See [Developer isolation](../commands/developer-isolation.md#aifabrix-dev-set-work). |
| **`developer-id`** | Used by **`aifabrix up-infra`**. |
| **`format`** | Default `json` \| `yaml` — **`aifabrix dev set-format`**; used when commands omit `--format`. |
| **`useEnvironmentScopedResources`** | Optional; default **off**. When **on**, local resolution and **`aifabrix run`** can use env-prefixed resource names for apps with **`environmentScopedResources: true`** in **`application.yaml`**, only **dev** / **tst**. Prefer **`aifabrix dev set-scoped-resources`**. |
| **`traefik`** | Set by **`aifabrix up-infra --traefik`**. |
| **`platform-controller`** | Absolute Miso Controller URL for local platform install (written by **`aifabrix setup`**; same rules as the **Platform Ready** footer — localhost + dev port or Traefik/`remote-server`). |
| **`controller`**, **`environment`** | From login or **`aifabrix auth --set-controller`** / **`--set-environment`**. Setup aligns **`controller`** with **`platform-controller`**. |
| **`device`** | Device flow tokens. |
| **`environments.<env>.clients.<app>`** | Client tokens. |
| **`secrets-encryption`** | When set, file-based secret **values** can be stored encrypted (`secure://`). |

### Remote development (`remote-server`)

**`remote-server`** (SSH for remote Docker / Mutagen) and **`docker-endpoint`**. Dev APIs (settings, secrets, sync) use **certificate (mTLS)**. Refresh: **`aifabrix dev init`**; inspect: **`aifabrix dev show`**. More: [Developer isolation](../commands/developer-isolation.md).

### Declarative URLs and Traefik

The Builder parses **`remote-server`** as a URL and uses its **hostname** for **`${REMOTE_HOST}`** in **`frontDoorRouting.host`** in **`application.yaml`**. See [Declarative url://](declarative-urls.md).

---

## aifabrix-secrets: remote vs local

`aifabrix-secrets` in **`config.yaml`** points at either a **file** or an **`https://`** URL. That drives where **shared** keys are read/written and how **`aifabrix secret … --shared`** behaves.

### File path

- Secrets live in that file (e.g. `~/.aifabrix/secrets.local.yaml` or a team path).
- **`aifabrix resolve`**, run, and build read from the merge rules for your app.
- **`aifabrix secret list|set|remove|remove-all`** target that file when operating on shared keys.
- Missing keys can be auto-created on **`aifabrix up-infra`**, app create, **`aifabrix resolve --force`**, integration create; **`--shared`** reads/writes the same file. Details: [Utilities](../commands/utilities.md).

### `https://` URL

- Shared secrets are served by the **remote API** (cert-authenticated).
- **`secret list|set|remove|remove-all --shared`** call the API.
- Shared values are **not stored on disk** on the developer machine; they are fetched at resolution time for `.env` generation.
- Local (non-shared) keys can still use the user / project file.
- Shared **set/remove** typically needs **admin** or **secret-manager** on the remote service.

### Encryption key on first secret use

Running **`secret list|set|remove|remove-all`**, **`secret validate`**, **`secure`**, or app register/rotate ensures **`config.yaml`** exists and a **`secrets-encryption`** key is available (created if missing), so file-based writes can default to **encrypted** values.

### Where new keys are written

| `aifabrix-secrets` | Behaviour |
| ------------------ | --------- |
| **File path** | New keys go to that file (created if missing). |
| **`http(s)` URL** | Remote API first; on failure (403, network), user file + warning. |
| **Unset** | New keys go to the user file (`~/.aifabrix/secrets.local.yaml` or **aifabrix-home**). |

### Provisioning

When infra or apps need a secret (DB user, Redis, init scripts), the CLI **reads** from the configured store (file or API). It does **not** hardcode passwords at create time. If a secret is missing, the command fails with a clear error (e.g. run **`aifabrix up-infra`**).

### `BASH_<NAME>` keys

After the usual merge, **`BASH_<NAME>`** becomes environment variable **`NAME`** for Builder subprocesses and for resolved `.env` when **`NAME`** is not already set. Passed via **`child_process` `env`** (not interactive **`export`**). Commands and layout: [Utilities: aifabrix secret](../commands/utilities.md#aifabrix-secret).

---

## Security posture and ISO 27001-aligned practices

ISO 27001 is implemented by your **organization** (policies, roles, risk treatment). This section maps **common Annex A–style themes** to Builder behaviour. It is **not** legal certification advice — align with your security officer and ISMS.

### Production vs developer scope

- **Azure production:** secrets in **Key Vault** — see [Production vs developer](#production-azure-key-vault-vs-developer-cycle).
- **Bullets below** about local files, **`BASH_*`**, subprocess **`env`**, and temporary **`.env`** apply to **developer workstations and dev tooling**, not the intended Key Vault-backed runtime.

### What the tooling already supports

- **Confidentiality at rest:** optional **`aifabrix secure`** (`secure://`); encryption key material in **`config.yaml`**. See **Encryption** and **admin-secrets.env** sections below.
- **Disk access:** **`600`** on sensitive files, **`700`** on config directory where enforced.
- **Short-lived plaintext for compose:** temporary **`.env.run`** for Docker Compose, then deleted — see **admin-secrets.env**.
- **Remote shared secrets:** **`https://`** + **mTLS** and server RBAC for dev APIs — [Developer isolation](../commands/developer-isolation.md).
- **Separation in repo:** **`kv://`** in templates so Git stays free of live values; Key Vault naming under **secrets.local.yaml**.

### What you must still take care of

- **Classification:** treat `secrets.local.yaml`, `config.yaml`, and **`BASH_*`**-derived values as **high** sensitivity — no tickets, chat, or CI logs.
- **Workstations:** disk modes do not help if the account is compromised — disk encryption, lock screen, separate prod vs lab accounts where required.
- **`secrets-encryption` backup:** enterprise password manager or vault — not email or Git. Loss = cannot decrypt (see **No restore** under **secrets.local.yaml**).
- **RBAC:** limit **`aifabrix secret set --shared`**, remote **admin/secret-manager**, and read access to team **`aifabrix-secrets`** paths — [permissions](../commands/permissions.md).
- **CI:** forbid dumping **`env`** or resolved **`.env`**; prefer OIDC / workload identity or short-lived tokens over long-lived **`BASH_*`** where policy allows.
- **Build-time exposure:** **`BASH_*`** and **build-args** on dev hosts / CI can appear in process listings or image history; production **runtime** stays Key Vault–backed when manifests stay reference-based. Stricter image builds: BuildKit secrets, etc.
- **Rotation / incidents:** rotate and revoke via IdP and controller; document **`aifabrix secure`** key rotation and re-encryption.
- **Team shares:** if **`aifabrix-secrets`** is a network path, include that storage in access reviews, backups, and DLP scope.

### For auditors (one paragraph)

Local Fabrix: **no live secrets in application Git**, optional **encrypted local files**, **enforced permissions**, **HTTPS + certs** for remote shared secrets, **bounded temp files** for compose, **documented operator duties** — plus [Utilities: secret](../commands/utilities.md#aifabrix-secret). **Azure production:** **Key Vault**, same **`kv://`** contract, **no reliance on developer `secrets.local.yaml` on the application host**.

---

## secrets.local.yaml (file-based secrets)

### Purpose

One YAML file (user default or path from **`aifabrix-secrets`**) holds **developer-cycle** secrets the CLI resolves. Optional team location via **`aifabrix-secrets`** in **`config.yaml`**.

### Location and shape

- Default: **`~/.aifabrix/secrets.local.yaml`**, or the path when **`aifabrix-secrets`** is a **file**.
- **Flat key–value**; common patterns: `<app>-client-idKeyVault`, `<app>-client-secretKeyVault`, other **`*KeyVault`** keys.
- Used by **`aifabrix resolve`**, **`aifabrix login --method credentials`**, deploy, and related flows.

### Environment-scoped resources (dev / tst)

When **`useEnvironmentScopedResources`** is on in **`config.yaml`** and the app has **`environmentScopedResources: true`**, and the target env is **dev** or **tst**, **`kv://`** resolution **prefers** keys prefixed with that env (`dev-`, `tst-`). If only the base key exists, the Builder can treat the prefixed key as the same value in memory so you avoid duplicate YAML for local dev.

### When keys are created or updated

- **`aifabrix up-infra`**, app create, **`aifabrix resolve <app> --force`**, integration create.
- **`aifabrix secret set`** (local), **`aifabrix secure`**, app register/rotate.

### Encryption and file mode

When **`secrets-encryption`** exists (CLI ensures it on first secret use), values written to user/shared **`secrets.local.yaml`** and **`admin-secrets.env`** use **`secure://`**. Files are written **`600`**; if looser permissions are detected on read, the CLI tightens to **`600`**.

### Special key: `secrets-encryptionKeyVault`

Local key name only — **not** read from Azure Key Vault by the CLI. If present in secrets YAML and **`config.yaml`** has no **`secrets-encryption`**, the value is copied into **`config.yaml`**. If missing everywhere, the CLI generates a 32-byte key and stores it **only in `config.yaml`**. Normal decryption uses **`secrets-encryption`** in **`config.yaml`**.

### No restore if you change or lose secrets

- **No CLI backup/restore** of deleted or corrupted `secrets.local.yaml`.
- **Wrong or missing `secrets-encryption`** → encrypted values cannot be decrypted; re-enter secrets and re-run **`aifabrix secure`** as needed.
- **Back up the encryption key** in a password manager; without it, encrypted local secrets are unusable.

---

## admin-secrets.env and run .env (ISO 27K)

**File:** **`~/.aifabrix/admin-secrets.env`** — infra admin credentials (Postgres, pgAdmin, Redis Commander).

**On disk:** written **`600`**; enforced on read.

**Password sync:** **`aifabrix up-infra --adminPassword`** updates admin password and syncs to **`postgres-passwordKeyVault`** in the main secrets store.

**Encryption:** with **`secrets-encryption`**, values in **`admin-secrets.env`** are **`secure://`**; without the key, they may be plaintext.

**At compose run time:** the CLI decrypts, writes a **temporary** **`.env.run`** (plaintext) only for the Docker Compose invocation, then **deletes** it. pgAdmin **pgpass** is similarly temporary.

---

## Encryption (aifabrix secure)

```bash
aifabrix secure --secrets-encryption <key>
```

- **Key:** 32 bytes, hex or base64.
- **Values:** **`secure://`** prefix when encrypted.
- **Plaintext** values still work if no encryption key is configured; the CLI decrypts when it sees **`secure://`**.
- **Key storage:** **`secrets-encryption`** in **`config.yaml`**.

CLI reference: [Utilities](../commands/utilities.md) — **`secret set`**, **`secret validate`**, **`secure`**. Validate a file: **`aifabrix secret validate [path]`** (optional **`--naming`** for KeyVault-style names). Key names align with Key Vault secret names for production parity (e.g. **`postgres-passwordKeyVault`**, **`redis-urlKeyVault`**, **`{app-key}-databases-{index}-passwordKeyVault`**).

---

## External integrations

For **`aifabrix upload <systemKey>`** (and related flows), credentials can be supplied in two ways.

### `KV_*` variables in `integration/<systemKey>/.env`

- Pattern: **`KV_<SYSTEMKEY>_<VAR>`** (e.g. **`KV_HUBSPOT_CLIENTID`**) mapping to path-style **`kv://`** (e.g. **`kv://hubspot/clientid`**).
- Underscore segments map to **`kv://`** path segments (lowercase).
- Values can be plain or **`kv://...`**; the CLI resolves before dataplane push.
- **`aifabrix repair <systemKey>`** aligns env.template, system file, and auth; options **`--auth`**, **`--rbac`**, **`--expose`**, **`--sync`**, **`--test`** — see repair documentation.

### `kv://` in application or datasource config

Upload can resolve **`kv://`** from local or remote secret stores even without **`KV_*`** entries in **`.env`**.

### Push behaviour

- Secrets go to the dataplane credential store before upload/publish when applicable.
- **Skipped** if there is no **`.env`**, no **`KV_*`** keys, or values are empty.
- Requires dataplane permission **`credential:create`** — [permissions](../commands/permissions.md).
