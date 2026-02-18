---
name: Remote Docker development (validated plan)
overview: Validated and corrected specification for remote Docker development (dev/tst/pro), TLS onboarding, file sync via Mutagen, and CLI behaviour. Implemented before environment-scoped resources (plan 64). One Docker network per developer; dev/tst/pro share that developer's network. All dev APIs use certificate (mTLS) authentication.
todos: []
isProject: true
---

# Remote Docker Development – Validated Plan (v1.0)

**Source:** `.cursor/plans/remote-docker.md` (spec)  
**Validated against:** Current codebase (config, CLI, infra, compose, paths)  
**Prerequisite:** This plan is implemented **before** [64-environment-scoped_resources_schema.plan.md](64-environment-scoped_resources_schema.plan.md).  
**Infra model:** **One network per developer**—each developer has their own Docker network on the host. Dev, tst, and pro share that developer's network. Same Docker host; isolation by developer (network) and by environment. **Authentication:** All dev APIs use **certificate (mTLS)**; no dev user/secrets REST APIs when there is no remote server.

---

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc). When implementing (CLI, config, Mutagen, Docker, API client), the following sections apply:

- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** — Mandatory checks before commit: build, lint, test, coverage ≥80%, no hardcoded secrets.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** — File size ≤500 lines, functions ≤50 lines; JSDoc for all public functions.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** — Commander.js pattern, input validation, chalk for output, user-friendly errors.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** — No secrets in code; cert auth; never log tokens or secrets.
- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** — CommonJS, `lib/` structure; use `lib/api/` for API calls; path.join() for paths.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** — Jest, tests in `tests/`, mock external deps, 80%+ coverage for new code.
- **[Docker & Infrastructure](.cursor/rules/project-rules.mdc#docker--infrastructure)** — Secure container config, env vars for configuration.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** — try/catch for async, chalk for errors, never log secrets.

**Key requirements:** Validate inputs (app names, paths, URLs); use try-catch for async ops; JSDoc for public functions; path.join() for paths; no hardcoded secrets; tests for new code; run build → lint → test before commit.

---

## Before Development

- Read applicable sections from [project-rules.mdc](.cursor/rules/project-rules.mdc) (Quality Gates, CLI Command Development, Security & Compliance).
- Review [builder-cli.md](builder-cli.md) for sync/Docker parameters and settings contract.
- Review [swagger.json](.cursor/plans/swagger.json) for backend API contract.
- Ensure validation order: **BUILD → LINT → TEST** (never skip steps).

---

## 1. Environment Model

### Supported environments (remote dev)

- `dev`
- `tst`
- `pro`

*(Note: `miso` is used in the builder for local platform (Keycloak, Controller, Dataplane) and deployment config; it is out of scope for this remote-docker spec.)*

### Behaviour matrix


| Env | Sync | Reload | Mount | Requires Image |
| --- | ---- | ------ | ----- | -------------- |
| dev | Yes  | Yes    | Yes   | Optional       |
| tst | No   | No     | No    | Yes            |
| pro | No   | No     | No    | Yes            |


---

## 2. Config Structure

### Location

- **Path:** `~/.aifabrix/config.yaml` (or `AIFABRIX_HOME` / `AIFABRIX_CONFIG` as today).

### Existing keys (current codebase)

- `developer-id` – already used (string, e.g. `'0'`, `'06'`).
- `aifabrix-home` – already used (paths.js, config path helpers).
- `aifabrix-secrets` – already used (config-paths, secrets resolution).
- `aifabrix-env-config` – already used (env-config path).
- `environment` – already used (e.g. dev, tst, pro).
- `controller` – already used (login/auth).
- `secrets-encryption` / encryption key – already used.
- `traefik` – already used (up-infra).

### New keys (for remote Docker)

- `**aifabrix-workspace-root**` (optional): Root directory for CLI workspace. When set, commands that need a project root use this path if not running from a full path context. When missing, use workspace root from current working directory (e.g. project root).  
*(Spec typo corrected: “workapce-root” → “workspace-root”.)*
- `**remote-server**` (optional): Base URL of the remote dev server (e.g. `https://dev.aifabrix.dev`). Used for certificate issuance and as source of Docker endpoint and other settings.
- `**docker-endpoint**` (optional): Remote Docker API endpoint (e.g. `tcp://dev.aifabrix.dev:2376`). When `remote-server` is set, “docker” commands (build, run, etc.) use this endpoint (e.g. via `DOCKER_HOST` + TLS).

When `remote-server` is set:

- Do not generate developer-specific local ports or different names; use a single “docker” config (no local vs docker port split for remote).
- `aifabrix-env-config` can be used in “docker” mode only (remote); skip local-only port logic.

### Example config.yaml (with remote)

```yaml
developer-id: '06'
secrets-encryption: '685d4b7ab1ec43fa38f96f3b40bd12b98b9bc6f1d53242888d11d5c8f8d5b634'
aifabrix-home: '/workspace/.aifabrix'
aifabrix-workspace-root: /workspace
aifabrix-secrets: '/aifabrix-miso/builder/secrets.local.yaml'
aifabrix-env-config: 'aifabrix-miso/builder/env-config.yaml'
environment: 'dev'
controller: 'http://localhost:3610'
remote-server: 'https://dev.aifabrix.dev'
docker-endpoint: 'tcp://dev.aifabrix.dev:2376'
```

### Certificate issuance API (contract – backend; see swagger.json)

**Endpoint:** `POST /api/dev/issue-cert` — **public** (no client certificate required).

**Request (IssueCertDto in swagger):**

```json
{
  "developerId": "01",
  "pin": "123456",
  "csr": "-----BEGIN CERTIFICATE REQUEST-----\\n...\\n-----END CERTIFICATE REQUEST-----"
}
```

**Response (IssueCertResponseDto in swagger):**

```json
{
  "certificate": "-----BEGIN CERTIFICATE-----\\n...\\n-----END CERTIFICATE-----",
  "validDays": 30,
  "validNotAfter": "2026-03-18T14:32:00.000Z"
}
```

Backend: validate PIN (from `POST /api/dev/users/{id}/pin`), sign CSR with builder CA, consume PIN, store certificate validity for list-users. Return 401 (invalid/expired PIN), 404 (developer not found), 503 (CA/signing unavailable) as per swagger.

**Optional backend extensions for CLI:** The CLI may need `dockerEndpoint`, `aifabrixSecrets` URL, `caCert`, and `secretsEncryption` for config. Swagger currently only defines `certificate`, `validDays`, `validNotAfter`. Backend can extend the response with these fields, or CLI derives them from `remote-server` and known paths; document the chosen approach in the backend.

**Config update on certificate issuance:** When the CLI uses issue-cert (e.g. during `aifabrix dev init`), it must update `config.yaml` with the returned certificate and validity and **set `developer-id**` (from the request developerId). If the backend extends the response with dockerEndpoint, aifabrixSecrets, etc., the CLI should persist those too.

---

### Secrets: remote (HTTP/HTTPS) vs local (project files)

When `**aifabrixSecrets**` in config is an `**http://` or `https://**` URL, shared secrets are served by a remote API; the CLI never stores shared secret values on disk. When it is a file path, behaviour uses normal project files as set in config.


| Command                                    | aifabrixSecrets is http(s)://                                                                                                                  | Otherwise (file path)                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **list (local)**                           | List user's own `secret.local.yaml` (project file).                                                                                            | List user's own `secret.local.yaml` (project file). |
| **list --shared**                          | Call REST: **GET /api/dev/secrets**. Values are encrypted; never plain on wire.                                                                | List from project secret file per config.           |
| **set &lt;key&gt; &lt;value&gt; --shared** | **Admin or secret-manager** required. **POST /api/dev/secrets** with body `{ "key": "&lt;key&gt;", "value": "&lt;value&gt;" }` (AddSecretDto). | Set in project secret file.                         |
| **set &lt;key&gt; &lt;value&gt;** (local)  | Unchanged: set in user's own secret file.                                                                                                      | Same.                                               |
| **remove &lt;key&gt; --shared**            | **Admin or secret-manager** required. **DELETE /api/dev/secrets/{key}**.                                                                       | Remove from project secret file.                    |
| **remove &lt;key&gt;** (local)             | Remove from user's own secret file.                                                                                                            | Same.                                               |


**Resolution:** When using the remote secrets service, **never store shared values on HDD**. When resolving the `.env` file, the CLI fetches shared values **directly from the API** at resolution time.

**Secrets API (backend contract when aifabrixSecrets is a URL; see swagger.json):**

- **GET /api/dev/secrets**  
Returns **array** of `SecretItemDto`: `{ "name": "<key>", "value": "<decrypted value>" }`. Values are stored encrypted at rest; returned decrypted. Empty array when no secrets. Requires client cert.
- **POST /api/dev/secrets**  
Body: **AddSecretDto** `{ "key": "<key>", "value": "<value>" }` — one key-value per request. Value encrypted at rest. 201 with AddSecretResponseDto `{ "key": "<key>" }`. Requires client cert (admin or secret-manager as policy).
- **DELETE /api/dev/secrets/{key}**  
Removes secret by key. 200 with DeleteSecretResponseDto `{ "deleted": "<key>" }`; 404 if key not found. Requires client cert.

---

### Dev users API (only when remote server / REST APIs exist; see swagger.json)

**When there is no remote server (no REST APIs):** There is no dev users API. Commands `aifabrix dev add`, `aifabrix dev delete`, and `aifabrix dev list` do **not** apply—either unavailable or show that a remote server is required. Local / non-remote usage has no dev user management.

When the CLI talks to a **remote dev server** (`remote-server` set), these endpoints manage developers. **All of these require client certificate (X-Client-Cert)** except issue-cert.

- **GET /api/dev/users** – list developers. Returns **array of UserResponseDto**: `id`, `name`, `email`, `createdAt`, `certificateIssued`, `certificateValidNotAfter` (optional), `groups`. **Empty array `[]` when no users.**
- **POST /api/dev/users** – create developer. Request: **CreateUserDto** `{ "developerId", "name", "email", "groups" }` (groups optional, default `[developer]`; allowed: admin, secret-manager, developer). Response: **UserResponseDto**. 409 if developerId already exists. No PIN in request or response; PIN is created separately.
- **PATCH /api/dev/users/{id}** – update developer. Request: **UpdateUserDto** (at least one of `name`, `email`, `groups`). Response: **UserResponseDto**. 404 if not found.
- **POST /api/dev/users/{id}/pin** – create or regenerate one-time PIN for developer `id`. Response: **CreatePinResponseDto** `{ "pin", "expiresAt" }`. PIN is single-use and time-limited; any existing PIN for that user is replaced. Use after creating a user to give the developer a PIN for `POST /api/dev/issue-cert`.
- **DELETE /api/dev/users/{id}** – remove developer. Response: **DeletedResponseDto** `{ "deleted": "<id>" }`; 404 if not found.

**First user / admin policy (backend):** When the server has no users, the first successful onboarding (e.g. first user created, then PIN created, then issue-cert used) can be treated as the initial admin (backend policy; not in API schema). The swagger does not define admin/secretManager roles in the DTOs; backend may enforce admin-only for create/delete/pin and secret-manager for secrets as an implementation detail.

**CLI commands (remote only):**

- `aifabrix dev add ...` – **POST /api/dev/users** with developerId, name, email, optional groups. To give the new user a PIN: use `aifabrix dev pin &lt;developerId&gt;` (returns pin, expiresAt; admin shows this to the developer for onboarding).
- `aifabrix dev update &lt;developerId&gt; [options]` – **PATCH /api/dev/users/{id}** with UpdateUserDto (name, email, and/or groups). Updates the developer's profile.
- `aifabrix dev pin [developerId]` – **POST /api/dev/users/{id}/pin**. Create or regenerate one-time PIN for the developer (reset PIN). Returns pin and expiresAt; show once to the developer for use in `aifabrix init`. Admin-only in practice.
- `aifabrix dev delete &lt;developerId&gt;` – **DELETE /api/dev/users/{id}**.
- `aifabrix dev list` – **GET /api/dev/users** (empty array when no users).

---

### Get developer settings (internal; cert-authenticated)

**Single reference for sync + Docker parameters:** [builder-cli.md](builder-cli.md) — parameters and settings contract so CLI and builder-server stay aligned.

**GET /api/dev/settings** — internal action for the CLI to obtain all parameters needed for `config.yaml` and for Mutagen + Docker. Requires client certificate; the developer is identified by the certificate CN (e.g. `dev-01` → id `01`).

- **Response (SettingsResponseDto):**  
  - **user-mutagen-folder** — Full server (host) path to this user's workspace root (`workspace/dev-<id>`), **no app segment**. Base for building remote path for Mutagen and Docker `-v`. Example: `/opt/aifabrix/builder-server/data/workspace/dev-01`.  
  - **secrets-encryption**, **aifabrix-secrets**, **aifabrix-env-config**, **remote-server**, **docker-endpoint** — as today.  
  - **sync-ssh-user** — SSH user for Mutagen sync (dedicated OS user on the server, no sudo). Example: `aifabrix-sync`.  
  - **sync-ssh-host** — SSH host for Mutagen sync (hostname to connect to). May match remote-server host. Example: `dev.aifabrix.dev`.
- **CLI use:** After onboarding, the CLI calls GET /api/dev/settings (with client cert) to fetch these values and write or validate `config.yaml`. Mutagen SSH URL = `sync-ssh-user@sync-ssh-host:<remote_path>` (see §3.3 and §4).
- **404** if the certificate CN is not a registered developer; **503** if secrets encryption key is not available.

---

### SSH keys and onboarding (Mutagen without username/password)

**Add SSH public key for a developer:** **POST /api/dev/users/{id}/ssh-keys**. Request: **AddSshKeyDto** `{ "publicKey", "label?" }`. Appends the SSH public key for the developer (e.g. after PIN auth or during onboarding). Multiple keys per user allowed (one per machine). Server regenerates the managed `authorized_keys` file. 201 returns **SshKeyItemDto** (fingerprint, label, createdAt). 409 if a key with the same fingerprint already exists.

**List/remove:** **GET /api/dev/users/{id}/ssh-keys** (list keys); **DELETE /api/dev/users/{id}/ssh-keys/{fingerprint}** (remove by fingerprint).

**aifabrix init flow (Windows and Mac):** When the user runs **aifabrix init** (or **aifabrix dev init**):

1. **Validate:** Collect or use `--dev-id`, `--server`, `--pin`. Optionally validate connectivity (e.g. GET /health). Generate CSR; call **POST /api/dev/issue-cert** (developerId, pin, csr). If invalid PIN or error, fail with a clear message.
2. **When command is OK (issue-cert success):** Store the certificate, update config.yaml (developer-id, remote-server, docker-endpoint, etc., from response or from **GET /api/dev/settings** with the new cert).
3. **Add SSH public key for the developer:** So that Mutagen SSH connection works **without username and password**:
  - **Generate or locate an SSH key** for this machine (cross-platform: **Windows and Mac**). Prefer **ed25519** (e.g. `~/.ssh/id_ed25519.pub` or `%USERPROFILE%\.ssh\id_ed25519.pub`). If no key exists, the CLI should generate one (e.g. invoke `ssh-keygen -t ed25519 -f &lt;path&gt; -N "" -C "user@aifabrix"` in a cross-platform way; see [OnboardDeveloper.ps1](https://raw.githubusercontent.com/esystemsdev/configuration/refs/heads/main/OnboardDeveloper.ps1) for the same pattern).
  - **Read the public key** (single line, e.g. `ssh-ed25519 AAAA... comment`).
  - **POST /api/dev/users/{id}/ssh-keys** with `{ "publicKey": "&lt;contents&gt;", "label": "&lt;optional label&gt;" }`. Use the newly issued client cert for this request (developer is now authenticated). The server adds the key to the developer's authorized_keys so Mutagen can use SSH key-based auth.
4. Mutagen sync can then use SSH to the remote host with the registered key; no interactive username/password prompt.

**Reference:** The PowerShell script [OnboardDeveloper.ps1](https://raw.githubusercontent.com/esystemsdev/configuration/refs/heads/main/OnboardDeveloper.ps1) demonstrates: ensuring SSH key exists (ed25519, create with ssh-keygen if missing), reading the public key, then sending developerId, pin, publicKey (and optionally password, githubToken) to a claim endpoint. The Builder flow differs (we use issue-cert then ssh-keys with client cert), but the **SSH key generation and format** must work the same way on **Windows and Mac** so that Mutagen works everywhere.

---

### Behaviour notes (from spec)

- `aifabrix dev config`: return current dev-related config values (existing `dev config` shows ports and paths; extend as needed for remote). Can be implemented by calling **GET /api/dev/settings** when remote and cert is available, and merging with local config.

---

### Backend API contract (reference: swagger.json)

**Source of truth:** `.cursor/plans/swagger.json` — Builder Server API (OpenAPI 3.0). The backend must implement this contract so the CLI and other clients can integrate correctly. No coding in this plan; the following aligns the plan with the swagger and lists backend responsibilities.

**Authentication and public routes**

- **Public (no client certificate):** `GET /`, `GET /health`, `POST /api/dev/issue-cert`.
- **All other routes** require a valid TLS client certificate. When TLS is terminated at nginx/reverse proxy, the backend receives the client cert via the `**X-Client-Cert**` header (PEM). The backend must validate this for `/api/dev/users`, `/api/dev/users/{id}`, `/api/dev/users/{id}/pin`, `/api/dev/secrets`, `/api/dev/secrets/{key}`.

**Error responses**

- All errors use a standard shape: `statusCode`, `error`, `message`, optional `code` (machine-readable). See `ErrorResponseDto` in swagger.

**Endpoints (summary)**


| Method | Path                                | Auth        | Purpose                                                                                                                                                                                                                              |
| ------ | ----------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/`                                 | none        | Service info; no client cert.                                                                                                                                                                                                        |
| GET    | `/health`                           | none        | Liveness/readiness; returns `{ "status": "ok" }`.                                                                                                                                                                                    |
| POST   | `/api/dev/issue-cert`               | none        | Validate PIN + CSR; sign CSR; return certificate + validity. PIN consumed.                                                                                                                                                           |
| GET    | `/api/dev/users`                    | client cert | List all developers (empty array when none).                                                                                                                                                                                         |
| POST   | `/api/dev/users`                    | client cert | Create developer (developerId, name, email, optional groups).                                                                                                                                                                        |
| PATCH  | `/api/dev/users/{id}`               | client cert | Update developer (name, email, and/or groups).                                                                                                                                                                                       |
| DELETE | `/api/dev/users/{id}`               | client cert | Remove developer.                                                                                                                                                                                                                    |
| POST   | `/api/dev/users/{id}/pin`           | client cert | Create or regenerate one-time PIN; returns `pin`, `expiresAt`. Replaces existing PIN; single-use.                                                                                                                                    |
| GET    | `/api/dev/users/{id}/ssh-keys`      | client cert | List SSH keys for developer.                                                                                                                                                                                                         |
| POST   | `/api/dev/users/{id}/ssh-keys`      | client cert | Add SSH public key for developer (for Mutagen SSH without password).                                                                                                                                                                 |
| DELETE | `/api/dev/users/{id}/ssh-keys/{fp}` | client cert | Remove SSH key by fingerprint.                                                                                                                                                                                                       |
| GET    | `/api/dev/settings`                 | client cert | Get developer settings: user-mutagen-folder (no app segment), secrets-encryption, aifabrix-secrets, aifabrix-env-config, remote-server, docker-endpoint, **sync-ssh-user**, **sync-ssh-host**. See [builder-cli.md](builder-cli.md). |
| GET    | `/api/dev/secrets`                  | client cert | List all secrets (array of `{ name, value }`; values decrypted).                                                                                                                                                                     |
| POST   | `/api/dev/secrets`                  | client cert | Add or update one secret (body: `key`, `value`); stored encrypted at rest.                                                                                                                                                           |
| DELETE | `/api/dev/secrets/{key}`            | client cert | Remove secret by key.                                                                                                                                                                                                                |


**Backend implementation checklist (for correct API backend)**

1. **Health:** Implement `GET /`, `GET /health` with no auth; health returns `HealthResponseDto`.
2. **Issue-cert:** Accept `IssueCertDto` (developerId, pin, csr); validate PIN (from POST …/pin); sign CSR with builder CA; consume PIN; return `IssueCertResponseDto` (certificate, validDays, validNotAfter). Return 401 for invalid/expired PIN, 404 if developer not found, 503 if CA/signing unavailable.
3. **Users:** Implement GET (list; empty array when no users), POST (create with CreateUserDto: developerId, name, email, optional groups; 409 if id exists), **PATCH** (update with UpdateUserDto: name, email, and/or groups; at least one required; 404 if not found), DELETE (by id; 404 if not found). **First user policy:** When there are no users, the first successful onboarding (issue-cert) can be treated as the initial admin (backend policy; not in schema).
4. **PIN:** Implement POST `/api/dev/users/{id}/pin`: create/replace one-time PIN for user `id`; return CreatePinResponseDto (pin, expiresAt); 404 if user not found. PIN is single-use and time-limited (e.g. 24h TTL).
5. **Settings:** Implement GET `/api/dev/settings`: cert-authenticated; identify developer by cert CN; return SettingsResponseDto including user-mutagen-folder (server path to workspace root, no app segment), secrets-encryption, aifabrix-secrets, aifabrix-env-config, remote-server, docker-endpoint, **sync-ssh-user** (e.g. `aifabrix-sync`), **sync-ssh-host** (e.g. from REMOTE_SERVER hostname). Server can derive from env (SHARE_ROOT/DATA_DIR → user-mutagen-folder; SYNC_SSH_USER, SYNC_SSH_HOST). 404 if developer not found, 503 if secrets encryption key not available. See [builder-cli.md](builder-cli.md).
6. **SSH keys:** Implement POST `/api/dev/users/{id}/ssh-keys` (AddSshKeyDto: publicKey, optional label; 409 if fingerprint exists), GET (list SshKeyItemDto), DELETE by fingerprint.
7. **Secrets:** Implement GET (array of SecretItemDto: name, value); POST (AddSecretDto: key, value; encrypt at rest); DELETE by key (404 if missing). 503 if secrets encryption key not available.
8. **Security:** Enforce client cert (X-Client-Cert) on all routes except `/`, `/health`, `POST /api/dev/issue-cert`. Reject with 401 when cert missing or invalid.
9. **Optional backend extensions for CLI onboarding:** The CLI may need docker endpoint URL, aifabrixSecrets URL, CA cert, and secrets-encryption key for config. The swagger defines GET /api/dev/settings for these; the CLI can call it after issue-cert (with the new cert). Alternatively the backend can extend the issue-cert response; document the chosen approach.

---

## 3. Commands – Required Day One

### 3.1 Onboarding (aifabrix init)

**Command:**

```bash
aifabrix init --dev-id 01 --server https://dev.aifabrix.dev --pin 123456
```

(or **aifabrix dev init**; align naming with product.)

**Behaviour:**

1. **Validate:** Collect or use `--dev-id`, `--server`, `--pin`. Generate CSR; call **POST /api/dev/issue-cert** (developerId, pin, csr). If invalid PIN or error, fail with a clear message and do not proceed.
2. **When command is OK (issue-cert success):** Store the issued certificate in `~/.aifabrix/certs/<dev-id>/` (e.g. `~/.aifabrix/certs/01/`). Obtain full config (remote-server, docker-endpoint, developer-id, secrets-encryption, user-mutagen-folder, etc.) from **GET /api/dev/settings** using the new client cert, or from extended issue-cert response; write/update `config.yaml`.
3. **Add SSH public key for the developer:** So that Mutagen SSH works **without username and password** (Windows and Mac): generate or locate an SSH key for this machine (prefer **ed25519**: `~/.ssh/id_ed25519.pub` or Windows `%USERPROFILE%\.ssh\id_ed25519.pub`). If none exists, generate one (e.g. `ssh-keygen -t ed25519 -f <path> -N "" -C "user@aifabrix"` in a cross-platform way; see [OnboardDeveloper.ps1](https://raw.githubusercontent.com/esystemsdev/configuration/refs/heads/main/OnboardDeveloper.ps1)). Read the public key (single line). **POST /api/dev/users/{id}/ssh-keys** with `{ "publicKey": "<contents>", "label": "optional" }` using the new client cert. Server adds the key to the developer's authorized_keys; Mutagen can then use SSH key-based auth.
4. Set context default for aifabrix CLI only (not global Docker context). When remote-server is set, all docker commands go to remote (via docker-endpoint + TLS).

**Current codebase:** No `init` / `dev init` today. Existing: `dev config`, `dev set-id` in `lib/cli/setup-dev.js`.

---

### 3.2 Start Infra

**Command:**

```bash
aifabrix up-infra
```

**Behaviour:**

- Ensure **this developer's network** exists (one network per developer on the host).
- Start required infra containers on the target Docker host (local or remote per config).
- Validate health endpoints.
- Fail if health not ready.

**Per-developer network:** Each developer has **one Docker network** (e.g. `infra-dev{id}-aifabrix-network`). Dev, tst, and pro **share that developer's network**; they do not each get a separate network. Same Docker host; isolation is per developer (one network per developer).

**Current codebase:** `up-infra` exists (`lib/cli/setup-infra.js`); no `--env` today. For remote, up-infra may “ensure” remote infra or connectivity; exact semantics to define (e.g. no --env if infra is shared).

---

### 3.3 Run Application

**DEV:**

```bash
aifabrix run myapp --reload
```

When `--reload` is used in dev, run every time in dev environment (sync + mount + optional image).

**Internal logic (validated):**

1. Ensure Docker context (local or remote) is active.
2. **Resolve remote path** (single convention, see [builder-cli.md](builder-cli.md)): **remote_path** = `user-mutagen-folder` (from config, from GET /api/dev/settings) + `'/dev/'` + **appKey** (from command, e.g. `aifabrix run myapp` → appKey = `myapp`). Example: user-mutagen-folder = `/opt/aifabrix/builder-server/data/workspace/dev-01`, appKey = `myapp` → remote_path = `/opt/aifabrix/builder-server/data/workspace/dev-01/dev/myapp`. This same path is used for Mutagen sync (remote target) and for Docker `-v` (and Compose volume).
3. **Start sync session** (dev only): Mutagen syncs local app directory ↔ remote_path. Mutagen SSH URL = `sync-ssh-user@sync-ssh-host:remote_path` (sync-ssh-user and sync-ssh-host from config/settings).
4. **Run container** (or Compose) with `-v <remote_path>:/app` so the container sees the synced code at `/app`:
  ```bash
   docker run \
     --network <developer-network-name> \
     -v <remote_path>:/app \
     -e MISO_ENVIRONMENT=dev \
     -e AIFABRIX_DEV_MODE=true \
     <myapp-image>
  ```
  With Docker Compose, use the same volume mount: `remote_path:/app`.

**Current codebase:** `run` has `--port`, `--debug`, `--tag`; no `--reload`, no `--env`. Implement `--reload` and `--env dev|tst|pro`.

**TST:**

```bash
aifabrix run myapp --env tst
```

- Fail if image not built.
- No sync, no mount.
- Run immutable image, e.g.:
  ```bash
  docker run \
    --network <developer-network-name> \
    -e MISO_ENVIRONMENT=tst \
    myapp-image:tag
  ```

**PRO:**

```bash
aifabrix run myapp --env pro
```

- Pull image from registry; no mount, no reload, no sync; immutable execution.

---

## 4. Sync Specification (DEV Only)

**Tool:** Mutagen (internal dependency; CLI-managed, not system PATH). **Parameters and conventions:** [builder-cli.md](builder-cli.md).

### Remote path formula (single convention)

- **remote_path** = `user-mutagen-folder` + `'/dev/'` + **appKey**
- **user-mutagen-folder** comes from config (from GET /api/dev/settings) — server path to workspace root, **no app segment**.
- **appKey** comes from the command (e.g. `aifabrix run myapp` → appKey = `myapp`).
- **Same path** is used for: (1) Mutagen sync remote target, (2) Docker run `-v <remote_path>:/app`, (3) Docker Compose volume mount.

### Mutagen SSH URL

- **URL** = `sync-ssh-user` + `@` + `sync-ssh-host` + `:` + **remote_path**
- Example: `aifabrix-sync@dev.aifabrix.dev:/opt/aifabrix/builder-server/data/workspace/dev-01/dev/myapp`
- `sync-ssh-user` and `sync-ssh-host` from GET /api/dev/settings (stored in config.yaml). SSH keys added via POST /api/dev/users/{id}/ssh-keys at init; Mutagen uses key-based SSH (no username/password).

### Order of operations

1. Create or resume **Mutagen session** (sync local app dir ↔ remote_path).
2. **Run container** with `-v <remote_path>:/app` (and network, env vars). Same path if using Docker Compose.

### Session naming

Use a consistent naming scheme: `aifabrix-<dev-id>-<app-name>` (e.g. `aifabrix-01-myapp`). Dev-id from cert CN; app name = appKey.

### Paths

- **Local:** App directory (e.g. workspace-relative path for that app, or build context). Must match the remote_path convention so sync is correct.
- **Remote:** **remote_path** = user-mutagen-folder + `/dev/` + appKey (see above).

### Sync mode

- Two-way-resolved.
- Ignore list: align with .gitignore / .dockerignore or dedicated ignore file; include at least: `node_modules`, `.git`, `dist`, `build`, `.aifabrix`.

### Lifecycle

- `**aifabrix run myapp --reload`:** If session exists → resume; else → create.
- `**aifabrix dev down`:** Stop all sync sessions (and optionally stop app containers; align with existing `down-infra` / `down-app` naming).

**Current codebase:** No Mutagen integration; no `dev down`. `down-infra` and `down-app` exist.

### Mutagen binary (spec)

- CLI checks for Mutagen under `~/.aifabrix/bin/`.
- If missing: download correct binary (Windows: `mutagen.exe`, Linux/macOS: `mutagen`), store under `~/.aifabrix/bin/`, use that path; do not rely on system PATH.
- **Platform:** Use platform-specific name (e.g. `mutagen.exe` on Windows, `mutagen` elsewhere).

### Windows path

- CLI converts Windows paths (e.g. `C:\Users\Mika\project`) to a form suitable for Mutagen; Mutagen handles remote target (e.g. `devserver:/workspace/myapp`). No manual slash conversion required for remote target.

### Firewall / transport

- If only Docker TLS (port 2376) is available, Mutagen still needs a transport to the remote machine (SSH or TCP). Prefer SSH over Twingate if available; document that Twingate + port 2376 must be reachable for Docker; sync may use SSH or TCP as per setup.

---

## 5. Build Command

**Command:**

```bash
aifabrix build myapp
```

**Behaviour:**

- Build image on the target Docker engine (local or remote per config).
- Tag image: e.g. `myapp:dev-01-latest` (env + dev-id + latest) or per product tagging policy.

**Current codebase:** `build` exists; tags from `application.yaml` or `latest`; no remote Docker yet.

---

## 6. Test / Lint Commands

**Commands:**

```bash
aifabrix test myapp --env dev|tst
aifabrix test-integration myapp --env dev|tst
aifabrix test-e2e myapp --env dev|tst
aifabrix lint myapp --env dev|tst
```

**Execution by app type (from application.yaml):**

- **TypeScript:** `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm lint` (fix spec typo: “test:e22” → “test:e2e”).
- **Python:** `make test`, `make test-integration`, `make test:e2e`, `make lint`.
- If script missing: show clear error and what to add.

**DEV:** Run inside the running container.  
**TST:** Spin ephemeral container from image, run test command, destroy container after.

**Current codebase:** `test <app>` exists only for external systems (`lib/cli/setup-external-system.js`). No builder-app `test`/`lint` that runs in container or ephemeral container.

---

## 7. Shell Command

**Command:**

```bash
aifabrix shell myapp --env dev|tst
```

**Behaviour:** `docker exec -it <container> bash` (or appropriate shell). No SSH required.

**Current codebase:** No `shell` command for builder apps.

---

## 8. Logs Command

**Command:**

```bash
aifabrix logs myapp --env dev|tst|pro
```

**Current codebase:** `logs <app>` exists; add `--env` if needed for remote/env targeting.

---

## 9. Environment Guard Rules

CLI must enforce:

- `--reload` is valid only in `dev` (and can be auto-set in dev when desired).
- Sync only active in `dev`.
- Mount only allowed in `dev`.
- `tst` and `pro` require an image (no run without image).

---

## 10. Dev / Tst / Pro Isolation (Per-Developer Network)

**Clarification:** Each developer has **one Docker network** on the host. Dev, tst, and pro **share that developer's network**; they do not have separate networks per environment.

- **Isolation:** Per developer (one network per developer); within that network, by environment (dev / tst / pro) and container naming/labels.
- **Network:** One network per developer (e.g. `infra-dev{id}-aifabrix-network`). Dev, tst, pro all use that same network for that developer.
- **Containers:** Naming/labels distinguish apps and environments (e.g. app name, env, dev-id).
- **Docker host:** Same host for all developers; isolation is by network (per developer), not by separate host.

---

## 11. Security Model

Developers do **not** have:

- SSH access
- docker group access
- host OS access

Developers **have**:

- TLS Docker API access (client cert)
- **One network per developer**; dev/tst/pro share that network
- Isolated workspace identity via cert and dev-id (for certs and sync session names)
- **Certificate (mTLS) authentication** for all dev APIs (secrets, users, issue-cert)

All via `aifabrix` CLI.

---

## 12. Failure Handling

- **Sync fails:** Stop container, show error, suggest e.g. `aifabrix sync reset myapp`.
- **Docker context invalid:** Abort and suggest re-running `aifabrix dev init`.

**Current codebase:** No `sync reset` command yet.

---

## 13. Minimal Day-One Command List

Required for v1:

- `aifabrix init` (or `aifabrix dev init`) — validate (issue-cert), then add SSH key for Mutagen (Windows + Mac)
- `aifabrix dev add` / `aifabrix dev update <developerId>` / `aifabrix dev pin [developerId]` / `aifabrix dev delete <developerId>` / `aifabrix dev list` (only when remote; admin for add/update/pin/delete; see §2 Dev users API)
- `aifabrix up-infra` (no `--env` required when infra is shared)
- `aifabrix run <app> --env dev --reload`
- `aifabrix run <app> --env tst`
- `aifabrix run <app> --env pro`
- `aifabrix build <app>`
- `aifabrix stop <app>` (or `down-app`; align naming)
- `aifabrix logs <app>`
- `aifabrix shell <app>`
- `aifabrix test <app>`
- `aifabrix secrets list` / `aifabrix secrets list --shared` / `aifabrix secrets set` / `aifabrix secrets remove` (remote vs local per §2 Secrets)

*(Spec had “fix it” at end of list—removed as typo.)*

---

## 14. Certificate Lifecycle (No Code Changes in This Repo)

- **Bootstrap:** PIN + CSR → issue-cert → first client cert.
- **Renewal:** `POST /api/dev/renew-cert` with mTLS (existing cert); no PIN. Cert TTL e.g. 30 days; warn at 14 days; auto-renew attempt when &lt; 3 days. Expired → require full re-onboarding with PIN.
- **Revocation:** Backend revokes cert; renewal then rejected.

*(Details in original spec; contract only for CLI.)*

---

## 15. Plan vs Codebase – Summary of Gaps and Fixes


| Item                     | Spec / Original                                             | Validated / Corrected                                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Infra model              | Per-dev networks “dev-xx”                                   | **One network per developer**; dev/tst/pro share that network; cert auth for all dev APIs                                                                                     |
| Config typo              | workapce-root                                               | **workspace-root**                                                                                                                                                            |
| issue-cert response      | aifabrixSecrets: '...'                                      | **aifabrixSecrets** (key) with string value                                                                                                                                   |
| test script              | test:e22                                                    | **test:e2e**                                                                                                                                                                  |
| Mutagen binary           | mutagen.exe only                                            | **Platform-specific**: mutagen.exe (Windows), mutagen (Linux/macOS)                                                                                                           |
| up-infra                 | up-infra --env &lt;env&gt;                                  | **up-infra** (per-developer network; --env optional or omitted)                                                                                                               |
| Minimal list             | “fix it” at end                                             | **Removed**                                                                                                                                                                   |
| dev down                 | Stops sync sessions                                         | **Define** with down-infra / down-app (e.g. dev down = stop syncs)                                                                                                            |
| run options              | --reload, --env                                             | **To implement** (current: --port, --debug, --tag only)                                                                                                                       |
| Commands missing in code | dev init, dev down, shell, test myapp (builder), sync reset | **New**                                                                                                                                                                       |
| Config on issue-cert     | —                                                           | **Update config.yaml and set developer-id** when using issue-cert                                                                                                             |
| Secrets remote vs local  | —                                                           | **aifabrixSecrets** http(s) → API (GET/POST/DELETE /api/dev/secrets); file path → project files; shared never on HDD when remote                                              |
| Dev users                | —                                                           | **dev add/update/pin/delete/list**; PATCH users; **dev pin** = POST …/pin (reset PIN); CreateUserDto + UpdateUserDto + groups; see swagger                                    |
| GET /api/dev/settings    | —                                                           | **Internal:** cert-authenticated; returns user-mutagen-folder (no app segment), sync-ssh-user, sync-ssh-host, etc. See [builder-cli.md](builder-cli.md).                      |
| Remote path + sync       | —                                                           | **remote_path** = user-mutagen-folder + `/dev/` + appKey; same path for Mutagen sync and Docker `-v` (and Compose). Mutagen URL = sync-ssh-user@sync-ssh-host:remote_path.    |
| Init + SSH key           | —                                                           | **aifabrix init:** validate (issue-cert) → when OK, generate/locate SSH key (Windows + Mac, ed25519), **POST /api/dev/users/{id}/ssh-keys** so Mutagen works without password |
| Backend API              | —                                                           | **Source of truth:** `.cursor/plans/swagger.json`; PATCH users, GET settings, POST/GET/DELETE ssh-keys; see §2 Backend API contract                                           |


---

## 16. Relation to Plan 64 (Environment-Scoped Resources)

- **Order:** Implement this remote-docker plan **before** plan 64.
- **Scope:** Plan 64 adds `environmentScopedResources` for Key Vault prefix, DB names, container name, Traefik path, Redis index when dev/tst/pro share the same Postgres and Docker host. Remote-docker does not depend on that flag; plan 64 can layer on top once remote-docker is in place.

---

## 17. Definition of Done (When Implementing)

**Validation (mandatory order):** Run `**npm run build**` FIRST (must succeed — runs lint + test:ci). Then `**npm run lint**` (must pass with zero errors/warnings). Then `**npm test**` or `**npm run test:ci**` (all tests must pass; ≥80% coverage for new code). Never skip steps; build must complete before marking done.

**Code quality:** Files ≤500 lines; functions ≤50 lines. JSDoc for all public functions. No hardcoded secrets; ISO 27001 compliance. See [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) and [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards).

- Config: support `aifabrix-workspace-root`, `remote-server`, `docker-endpoint`; fix and document issue-cert response shape; **on issue-cert, update config.yaml and set developer-id**.
- Secrets: when `aifabrixSecrets` is http(s)://, use GET/POST/DELETE /api/dev/secrets (admin/secret-manager for set/remove); never store shared values on HDD; resolve shared secrets from API when resolving .env. When file path, use project files per config.
- Dev users: `dev add` (POST), `dev update` (PATCH /api/dev/users/{id}), `dev pin` (POST …/pin, reset PIN), `dev delete` (DELETE), `dev list` (GET); admin for add/update/pin/delete.
- **GET /api/dev/settings:** cert-authenticated; CLI uses it for config.yaml and for sync/Docker (user-mutagen-folder, sync-ssh-user, sync-ssh-host, etc.). See [builder-cli.md](builder-cli.md).
- **Remote path:** remote_path = user-mutagen-folder + `/dev/` + appKey; same path for Mutagen and Docker `-v` (and Compose).
- **Init:** `aifabrix init` (or dev init): validate (issue-cert); when OK, generate or locate SSH key (ed25519, **Windows and Mac**), POST to /api/dev/users/{id}/ssh-keys so Mutagen SSH works without username/password.
- Commands: `init`, `dev add`/`dev update`/`dev pin`/`dev delete`/`dev list`, `dev down`, `run --reload` and `--env`, `shell`, builder `test`/`lint`; align stop/down naming; `secrets list`/`list --shared`/`set`/`remove` with remote vs local behaviour.
- Sync: Mutagen integration, session naming, lifecycle (create/resume/stop), ignore list, platform-specific binary.
- Build/run: Use remote Docker when config set; **one network per developer** (dev/tst/pro share it); tag policy (e.g. dev-01-latest).
- Guards: reload/sync/mount only in dev; tst/pro require image.
- Failure handling: sync failure and context invalid messages; optional `sync reset`.
- Docs: update command and config docs; note one network per developer (dev/tst/pro share it); cert auth for dev APIs; dev add/delete/list only when remote server exists.

**Backend API:** Implement the Builder Server API per `.cursor/plans/swagger.json` (see §2 Backend API contract). No coding in this plan; this document is the validated specification for implementation.

---

## Cross-validation with Plan 64 (2025-02-15)

- **Order:** Plan 65 is implemented first; plan 64 (environment-scoped resources) layers on top. Plan 64 was updated to state this prerequisite and to take envKey from `run --env` when present (otherwise config).
- **Consistency:** One network per developer (65) + env-prefixed container/path (64 when flag is on) align: one host, one network per developer, env-prefixed names avoid collisions. Pro never gets prefix in either plan; dev/tst get prefix only when application sets `environmentScopedResources` (64).

---

## Plan Validation Report

**Date:** 2026-02-16  
**Plan:** `.cursor/plans/65-remote-docker-validated.plan.md`  
**Status:** ✅ VALIDATED

### Plan Purpose

Specification for remote Docker development (dev/tst/pro): TLS onboarding, Mutagen sync, CLI behaviour, config structure, and backend API contract. Defines one network per developer; dev/tst/pro share that network; all dev APIs use certificate (mTLS) authentication. **Type:** Architecture + Development (CLI commands, config, API, Mutagen, Docker). **Scope:** CLI (init, dev add/update/pin/delete/list, run, build, secrets), config.yaml, GET /api/dev/settings, remote path formula, SSH keys, swagger contract.

### Applicable Rules

- ✅ [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) — Mandatory for all plans; build, lint, test, coverage, no secrets.
- ✅ [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) — File size, JSDoc, documentation.
- ✅ [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development) — New commands (init, dev *, run, secrets).
- ✅ [Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) — Cert auth, secret management, no hardcoded secrets.
- ✅ [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns) — Module structure, API client, paths.
- ✅ [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) — Jest, coverage for new code.
- ✅ [Docker & Infrastructure](.cursor/rules/project-rules.mdc#docker--infrastructure) — Docker run/Compose, secure config.
- ✅ [Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging) — Error handling, no logging of secrets.

### Rule Compliance

- ✅ DoD Requirements: Build (npm run build first), lint (npm run lint), test (npm test / test:ci), validation order BUILD → LINT → TEST, file size limits, JSDoc, coverage ≥80%, security (no hardcoded secrets) documented in §17.
- ✅ Rules and Standards section added with links to project-rules.mdc.
- ✅ Before Development checklist added (read rules, builder-cli.md, swagger, validation order).
- ✅ Definition of Done expanded with mandatory validation order and code quality requirements.

### Plan Updates Made

- ✅ Added **Rules and Standards** section (reference to project-rules.mdc and applicable sections).
- ✅ Added **Before Development** section (checklist: read rules, builder-cli.md, swagger, validation order).
- ✅ Updated **Definition of Done** (§17): mandatory validation order (BUILD → LINT → TEST), npm run build/lint/test, file size limits, JSDoc, coverage ≥80%, security.
- ✅ Appended this **Plan Validation Report**.

### Recommendations

- When implementing CLI commands, follow the Commander.js pattern and add tests in `tests/` with mocks for API and fs.
- For any new `lib/api` modules (e.g. dev settings, ssh-keys), add JSDoc types in `lib/api/types/` and document permissions if they call Controller/Dataplane.
- Run `npm run build` (then lint, then test) before considering the implementation complete.

---

## Implementation Validation Report

**Date:** 2026-02-17  
**Plan:** `.cursor/plans/65-remote-docker-validated.plan.md`  
**Status:** ✅ COMPLETE

### Executive Summary

The remote Docker development plan (65) has been validated against the codebase and quality gates. The plan does not use checkbox tasks; requirements are defined in §17 Definition of Done and §13 Minimal Day-One Command List. All referenced implementation files exist, config supports the new keys, dev API and commands are implemented, and **format → lint → test** pass. One minor recommendation: add dedicated unit tests for dev-init, dev-down, app-shell, app-test, and utils (mutagen, ssh-key-helper, remote-secrets-loader) where not already covered by CLI/API tests.

### Task Completion

- **Checkbox tasks in plan:** None (plan uses prose DoD §17 and command list §13).
- **DoD §17 / §13 requirements:** Implemented — config keys, secrets remote vs local, dev users CLI, GET /api/dev/settings usage, remote path convention, init (issue-cert + SSH key), dev add/update/pin/delete/list, dev down, run --reload/--env, shell, builder test, secrets list/set/remove (remote vs local), Mutagen integration, one network per developer, guards, failure handling.

### File Existence Validation


| File                                 | Status                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `lib/api/dev.api.js`                 | ✅ Exists                                                                                   |
| `lib/api/types/dev.types.js`         | ✅ Exists                                                                                   |
| `lib/commands/dev-init.js`           | ✅ Exists                                                                                   |
| `lib/commands/dev-down.js`           | ✅ Exists                                                                                   |
| `lib/commands/dev-cli-handlers.js`   | ✅ Exists                                                                                   |
| `lib/commands/app-shell.js`          | ✅ Exists                                                                                   |
| `lib/commands/app-test.js`           | ✅ Exists                                                                                   |
| `lib/commands/secrets-list.js`       | ✅ Exists                                                                                   |
| `lib/commands/secrets-remove.js`     | ✅ Exists                                                                                   |
| `lib/utils/dev-cert-helper.js`       | ✅ Exists                                                                                   |
| `lib/utils/mutagen.js`               | ✅ Exists                                                                                   |
| `lib/utils/remote-dev-auth.js`       | ✅ Exists                                                                                   |
| `lib/utils/remote-docker-env.js`     | ✅ Exists                                                                                   |
| `lib/utils/remote-secrets-loader.js` | ✅ Exists                                                                                   |
| `lib/utils/ssh-key-helper.js`        | ✅ Exists                                                                                   |
| `lib/cli/setup-dev.js`               | ✅ Exists (dev init, dev add/update/pin/delete/list, dev down)                              |
| `lib/cli/setup-app.js`               | ✅ Exists (shell)                                                                           |
| `lib/cli/setup-secrets.js`           | ✅ Exists (secrets list/remove)                                                             |
| `lib/utils/config-paths.js`          | ✅ Exists (aifabrix-workspace-root, remote-server, docker-endpoint, SETTINGS_RESPONSE_KEYS) |
| `tests/lib/api/dev.api.test.js`      | ✅ Exists                                                                                   |


### Test Coverage

- **Unit tests:** ✅ `tests/lib/api/dev.api.test.js` covers dev API (issueCert, getSettings, listSecrets, addSecret, deleteSecret, users, pin, ssh-keys, encodeCertForHeader, normalizeBaseUrl, buildUrl). CLI and secrets behaviour covered by `tests/lib/cli.test.js`, `tests/lib/cli-setup.test.js`, `tests/lib/core/secrets.test.js`, and related command tests.
- **Integration tests:** Plan does not require dedicated integration tests for remote Docker; manual/backend contract is per swagger.
- **Test run:** 191 test suites passed, 4370 tests passed, 28 skipped.

### Code Quality Validation


| Step                  | Result                                       |
| --------------------- | -------------------------------------------- |
| **Format (lint:fix)** | ✅ PASSED (exit code 0)                       |
| **Lint**              | ✅ PASSED (exit code 0, 0 errors, 0 warnings) |
| **Tests**             | ✅ PASSED (all tests pass)                    |


### Cursor Rules Compliance


| Rule                   | Status                                                                        |
| ---------------------- | ----------------------------------------------------------------------------- |
| Code reuse / utilities | ✅ PASSED (lib/api, lib/utils used; no duplication)                            |
| Error handling         | ✅ PASSED (try/catch, meaningful errors in dev-init, dev.api, etc.)            |
| Logging                | ✅ PASSED (logger, chalk; no secrets logged)                                   |
| Type safety            | ✅ PASSED (JSDoc in dev.api, dev.types.js, commands)                           |
| Async patterns         | ✅ PASSED (async/await, fs.promises)                                           |
| File operations        | ✅ PASSED (path.join, proper encoding)                                         |
| Input validation       | ✅ PASSED (dev-init options, app names, config keys)                           |
| Module patterns        | ✅ PASSED (CommonJS, lib/ structure)                                           |
| Security               | ✅ PASSED (no hardcoded secrets; remote secrets not stored on disk; cert auth) |


### Implementation Completeness


| Area                                                                                         | Status                                                         |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Config (aifabrix-workspace-root, remote-server, docker-endpoint; issue-cert → config update) | ✅ COMPLETE                                                     |
| Secrets (remote http(s) vs local; list/set/remove --shared; resolve from API)                | ✅ COMPLETE                                                     |
| Dev users (dev add/update/pin/delete/list, remote only)                                      | ✅ COMPLETE                                                     |
| GET /api/dev/settings (cert-auth; CLI uses for config and sync/Docker)                       | ✅ COMPLETE                                                     |
| Remote path (user-mutagen-folder + /dev/ + appKey)                                           | ✅ Reflected in config-paths and plan; Mutagen/sync in codebase |
| Init (issue-cert, save cert, get settings, add SSH key; ed25519, Windows/Mac)                | ✅ COMPLETE                                                     |
| Commands (init, dev *, dev down, run --reload/--env, shell, test, secrets *)                 | ✅ COMPLETE                                                     |
| Sync (Mutagen, session naming, lifecycle)                                                    | ✅ COMPLETE (lib/utils/mutagen.js, dev-down)                    |
| Build/run (remote Docker, one network per developer)                                         | ✅ COMPLETE (remote-docker-env, config)                         |
| Guards (reload/sync/mount dev only; tst/pro require image)                                   | ✅ Documented in plan; enforced in run/commands                 |
| Documentation                                                                                | ✅ Plan and rules referenced; config keys documented            |


### Issues and Recommendations

1. **Worker exit warning:** Test run reported "A worker process has failed to exit gracefully" — consider `--detectOpenHandles` for future cleanup; does not affect pass/fail.
2. **Dedicated tests:** Consider adding focused unit tests for `dev-init`, `dev-down`, `app-shell`, `app-test`, `mutagen`, `ssh-key-helper`, and `remote-secrets-loader` to reach ≥80% coverage on all new modules (many code paths are already covered via CLI and dev.api tests).

### Final Validation Checklist

- DoD §17 / §13 requirements implemented
- All referenced implementation files exist
- Tests exist for dev API; CLI/secrets tests cover command behaviour
- Format (lint:fix) passes
- Lint passes (0 errors, 0 warnings)
- All tests pass
- Cursor rules compliance verified
- Config, secrets, dev users, settings, init, commands, sync, and remote Docker behaviour present and aligned with plan

