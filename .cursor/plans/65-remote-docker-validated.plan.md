---
name: Remote Docker development (validated plan)
overview: Validated and corrected specification for remote Docker development (dev/tst/pro), TLS onboarding, file sync via Mutagen, and CLI behaviour. Implemented before environment-scoped resources (plan 64). Infra is shared—no per-developer isolated infrastructure.
todos: []
isProject: true
---

# Remote Docker Development – Validated Plan (v1.0)

**Source:** `.cursor/plans/remote-docker.md` (spec)  
**Validated against:** Current codebase (config, CLI, infra, compose, paths)  
**Prerequisite:** This plan is implemented **before** [64-environment-scoped_resources_schema.plan.md](64-environment-scoped_resources_schema.plan.md).  
**Infra model:** **Shared infrastructure**—all developers use the same infra (same Docker host, same network). No “separated infra per developer.”

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

### Certificate issuance API (contract – backend)

**Endpoint:** `POST /api/dev/issue-cert`

Request:

```json
{
  "devId": "01",
  "pin": "123456",
  "csr": "PEM-encoded CSR"
}
```

Response (spec typo fixed: `aifabrixSecrets` key and no colon in value):

```json
{
  "clientCert": "...",
  "caCert": "...",
  "expiresAt": "2026-03-15T00:00:00Z",
  "dockerEndpoint": "tcp://dev.aifabrix.dev:2376",
  "secretsEncryption": "685d4b7ab1ec43fa38f96f3b40bd12b98b9bc6f1d53242888d11d5c8f8d5b634",
  "aifabrixSecrets": "/aifabrix-miso/builder/secrets.local.yaml"
}
```

*(Original spec had `"aifabrixSecrets: '...'"` as a single string; corrected to proper key `aifabrixSecrets` with string value.)*

### Behaviour notes (from spec)

- `aifabrix secrets set <key> <value> --project`: when set, update secret in project secret file, not only in local user secrets.
- `aifabrix dev config`: return current dev-related config values (existing `dev config` shows ports and paths; extend as needed for remote).

---

## 3. Commands – Required Day One

### 3.1 Onboarding

**Command:**

```bash
aifabrix dev init --dev-id 01 --server https://dev.aifabrix.dev --pin 123456
```

**Behaviour:**

1. Validate PIN via onboarding API (e.g. issue-cert or dedicated validate PIN).
2. Download: TLS client cert, CA cert, Docker endpoint info (from issue-cert response).
3. Store certs in: `~/.aifabrix/certs/<dev-id>/` (e.g. `~/.aifabrix/certs/01/`).
4. Write/update `config.yaml` (remote-server, docker-endpoint, developer-id, etc.).
5. Set context default for aifabrix CLI only (not global Docker context).
6. When `remote-server` is set, all “docker” commands go to remote (via docker-endpoint + TLS).

**Current codebase:** No `dev init` today. Existing: `dev config`, `dev set-id` in `lib/cli/setup-dev.js`.

---

### 3.2 Start Infra

**Command:**

```bash
aifabrix up-infra
```

**Behaviour:**

- Ensure the (shared) network exists for the environment (e.g. one network for the shared host).
- Start required infra containers on the target Docker host (local or remote per config).
- Validate health endpoints.
- Fail if health not ready.

**Shared infra:** There is a single infra; no “dev-xx” per-developer network. Current code uses `infra-aifabrix-network` (developer-id 0) or `infra-dev{id}-aifabrix-network` (developer-id > 0). For **shared infra**, use a single network name (e.g. one network on the remote host); align naming with product (e.g. `infra-aifabrix-network` or a single remote network name).

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
2. Start sync session (dev only).
3. Resolve remote path from `application.yaml` `build.context`:
  - Example: `build.context: ../..` with app in `builder/dataplane` → context root is two levels up from `builder/dataplane`, so e.g. project root; sync target path on remote should be derived consistently (e.g. `/workspace/<project>/builder/dataplane` or as defined by remote-server path layout).
4. Run container (example – validate against actual compose/run logic):
  ```bash
   docker run \
     --network <shared-network-name> \
     -v <remote_path>:/app \
     -e MISO_ENVIRONMENT=dev \
     -e AIFABRIX_DEV_MODE=true \
     <myapp-image>
  ```

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
    --network <shared-network-name> \
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

**Tool:** Mutagen (internal dependency; CLI-managed, not system PATH).

### Session naming

Use a consistent naming scheme. Spec suggested: `aifabrix-<dev-id>-<app-name>`. With shared infra, dev-id still useful to avoid session name clashes if multiple developers use same host; keep unless product decides otherwise.

### Paths

- **Local:** Absolute project directory (workspace root or app context).
- **Remote:** e.g. `/workspace/.../myapp` (or derived from `build.context` and remote path policy).

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

## 10. Dev / Tst / Pro Isolation (Shared Infra)

**Clarification:** All developers use the **same** infra (same Docker host, same network). There is no “per-developer” isolated infrastructure.

- **Isolation:** By environment (dev / tst / pro) and by container naming/labels, not by separate networks per developer.
- **Network:** One shared network (e.g. one network name on the remote host).
- **Containers:** Naming/labels distinguish apps and environments (e.g. app name, env, optional dev-id for session/cert identity only).

*(Spec section 10 previously said “Own Docker in same network” and “Own container namespace”—interpreted as: same shared Docker host and network; container namespace isolation by env/app, not by separate infra per developer.)*

---

## 11. Security Model

Developers do **not** have:

- SSH access
- docker group access
- host OS access

Developers **have**:

- TLS Docker API access (client cert)
- Access to shared infra (shared network, shared host)
- Isolated workspace identity via cert and dev-id (for certs and sync session names)

All via `aifabrix` CLI.

---

## 12. Failure Handling

- **Sync fails:** Stop container, show error, suggest e.g. `aifabrix sync reset myapp`.
- **Docker context invalid:** Abort and suggest re-running `aifabrix dev init`.

**Current codebase:** No `sync reset` command yet.

---

## 13. Minimal Day-One Command List

Required for v1:

- `aifabrix dev init`
- `aifabrix up-infra` (no `--env` required when infra is shared)
- `aifabrix run <app> --env dev --reload`
- `aifabrix run <app> --env tst`
- `aifabrix run <app> --env pro`
- `aifabrix build <app>`
- `aifabrix stop <app>` (or `down-app`; align naming)
- `aifabrix logs <app>`
- `aifabrix shell <app>`
- `aifabrix test <app>`

*(Spec had “fix it” at end of list—removed as typo.)*

---

## 14. Certificate Lifecycle (No Code Changes in This Repo)

- **Bootstrap:** PIN + CSR → issue-cert → first client cert.
- **Renewal:** `POST /api/dev/renew-cert` with mTLS (existing cert); no PIN. Cert TTL e.g. 30 days; warn at 14 days; auto-renew attempt when &lt; 3 days. Expired → require full re-onboarding with PIN.
- **Revocation:** Backend revokes cert; renewal then rejected.

*(Details in original spec; contract only for CLI.)*

---

## 15. Plan vs Codebase – Summary of Gaps and Fixes


| Item                     | Spec / Original                                             | Validated / Corrected                                               |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| Infra model              | Per-dev networks “dev-xx”                                   | **Shared infra** – one network, one host; no per-developer infra    |
| Config typo              | workapce-root                                               | **workspace-root**                                                  |
| issue-cert response      | aifabrixSecrets: '...'                                      | **aifabrixSecrets** (key) with string value                         |
| test script              | test:e22                                                    | **test:e2e**                                                        |
| Mutagen binary           | mutagen.exe only                                            | **Platform-specific**: mutagen.exe (Windows), mutagen (Linux/macOS) |
| up-infra                 | up-infra --env &lt;env&gt;                                  | **up-infra** (shared infra; --env optional or omitted)              |
| Minimal list             | “fix it” at end                                             | **Removed**                                                         |
| dev down                 | Stops sync sessions                                         | **Define** with down-infra / down-app (e.g. dev down = stop syncs)  |
| run options              | --reload, --env                                             | **To implement** (current: --port, --debug, --tag only)             |
| Commands missing in code | dev init, dev down, shell, test myapp (builder), sync reset | **New**                                                             |


---

## 16. Relation to Plan 64 (Environment-Scoped Resources)

- **Order:** Implement this remote-docker plan **before** plan 64.
- **Scope:** Plan 64 adds `environmentScopedResources` for Key Vault prefix, DB names, container name, Traefik path, Redis index when dev/tst/pro share the same Postgres and Docker host. Remote-docker does not depend on that flag; plan 64 can layer on top once remote-docker is in place.

---

## 17. Definition of Done (When Implementing)

- Config: support `aifabrix-workspace-root`, `remote-server`, `docker-endpoint`; fix and document issue-cert response shape.
- Commands: `dev init`, `dev down`, `run --reload` and `--env`, `shell`, builder `test`/`lint`; align stop/down naming.
- Sync: Mutagen integration, session naming, lifecycle (create/resume/stop), ignore list, platform-specific binary.
- Build/run: Use remote Docker when config set; shared network naming; tag policy (e.g. dev-01-latest).
- Guards: reload/sync/mount only in dev; tst/pro require image.
- Failure handling: sync failure and context invalid messages; optional `sync reset`.
- Docs: update command and config docs; note shared infra and no per-developer networks.

No coding in this plan; this document is the validated specification for implementation.

---

## Cross-validation with Plan 64 (2025-02-15)

- **Order:** Plan 65 is implemented first; plan 64 (environment-scoped resources) layers on top. Plan 64 was updated to state this prerequisite and to take envKey from `run --env` when present (otherwise config).
- **Consistency:** Shared infra (65) + env-prefixed container/path (64 when flag is on) align: one host, env-prefixed names avoid collisions. Pro never gets prefix in either plan; dev/tst get prefix only when application sets `environmentScopedResources` (64).