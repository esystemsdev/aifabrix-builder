# Builder CLI — parameters and settings contract

This document explains the parameters the Builder CLI needs for **sync** (Mutagen) and **Docker** (including Compose), and how they are obtained from **GET /api/dev/settings** and conventions. It is the single reference so CLI and builder-server stay aligned.

---

## 1. Source: GET /api/dev/settings

The CLI calls **GET /api/dev/settings** with **client certificate authentication**. The developer is identified by the certificate CN (e.g. `dev-01` → id `01`). The response provides server-side configuration so the CLI does not hardcode URLs or paths.

### Response parameters (from builder-server)

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| **user-mutagen-folder** | string | Full server (host) path to this user's workspace root (`workspace/dev-<id>`), **no app segment**. Use as base to build remote path for Mutagen and Docker `-v`. | `/opt/aifabrix/builder-server/data/workspace/dev-01` |
| **secrets-encryption** | string | Encryption key value (hex) for local secrets decryption. Cert-protected; never log. | `685d4b7ab1ec43fa...` |
| **aifabrix-secrets** | string | Path for the developer's project secrets file. | `/aifabrix-miso/builder/secrets.local.yaml` |
| **aifabrix-env-config** | string | Path for env config. | `aifabrix-miso/builder/env-config.yaml` |
| **remote-server** | string | Builder-server base URL (HTTPS). | `https://dev.aifabrix.dev` |
| **docker-endpoint** | string | Docker API endpoint for the dev server. | `tcp://dev.aifabrix.dev:2376` |
| **sync-ssh-user** | string | SSH user for Mutagen sync (dedicated OS user on the server, no sudo). | `aifabrix-sync` |
| **sync-ssh-host** | string | SSH host for Mutagen sync (hostname to connect to). May match remote-server host or be a dedicated SSH host. | `dev.aifabrix.dev` |

### Server env vars that feed the response

| Env var | Feeds parameter | Note |
|---------|-----------------|------|
| `SHARE_ROOT` or `DATA_DIR` | user-mutagen-folder | `SHARE_ROOT` = host path to data share (for correct `-v` on host). |
| `ENCRYPTION_KEY` or key file | secrets-encryption | Key value never logged. |
| `AIFABRIX_SECRETS` | aifabrix-secrets | |
| `AIFABRIX_ENV_CONFIG` | aifabrix-env-config | |
| `REMOTE_SERVER` | remote-server | |
| `DOCKER_ENDPOINT` | docker-endpoint | |
| `SYNC_SSH_USER` | sync-ssh-user | Default `aifabrix-sync` if unset. |
| `SYNC_SSH_HOST` | sync-ssh-host | If unset, derived from `REMOTE_SERVER` URL hostname. |

---

## 2. Conventions (not in settings)

### App identifier (appKey)

- From the command: e.g. `aifabrix run myapp` → appKey = `myapp`.
- Used to build the **remote path** and **Mutagen session name**.

### Remote path formula (single convention)

- **remote_path** = `user-mutagen-folder` + `'/dev/'` + **appKey**
- Example: `user-mutagen-folder` = `/opt/aifabrix/builder-server/data/workspace/dev-01`, appKey = `myapp`  
  → **remote_path** = `/opt/aifabrix/builder-server/data/workspace/dev-01/dev/myapp`

This same path is used for:

1. **Mutagen sync** — remote target path.
2. **Docker run** — `-v <remote_path>:/app`.
3. **Docker Compose** — volume mount `remote_path:/app` (or named volume that points at that path).

### Mutagen SSH URL

- **URL** = `sync-ssh-user` + `@` + `sync-ssh-host` + `:` + **remote_path**
- Example: `aifabrix-sync@dev.aifabrix.dev:/opt/aifabrix/builder-server/data/workspace/dev-01/dev/myapp`
- SSH keys are added via **POST /api/dev/users/:id/ssh-keys** during init; Mutagen uses key-based SSH (no username/password).

### Order of operations

1. Create or resume **Mutagen session** (sync local app dir ↔ remote_path).
2. **Run container** with `-v <remote_path>:/app` (and optionally `--network <developer-network-name>`, env vars like `MISO_ENVIRONMENT=dev`, `AIFABRIX_DEV_MODE=true`).

### Local path for Mutagen

- Local side of the sync is the **app directory** (e.g. workspace root or build context for that app). The plan assumes a consistent rule (e.g. local = `./<appKey>` or workspace-relative path) so it matches the remote_path convention.

### Session naming

- Example: `aifabrix-<dev-id>-<app-name>` (e.g. `aifabrix-01-myapp`). Dev-id comes from cert CN; app name = appKey.

---

## 3. What the CLI does not get from settings

- **Network name** for the container (e.g. developer network) — CLI config or convention.
- **Env vars** for the container (e.g. `MISO_ENVIRONMENT`, `AIFABRIX_DEV_MODE`) — CLI adds when running the container.
- **Mutagen binary path**, platform (Windows/Mac), **ignore list** — CLI-local.
- **Permissions / user in container** — Server path and host job ensure sync user can write; container typically runs as user that can read the mounted path. No extra setting from this contract.

---

## 4. Summary

- **Settings endpoint** supplies: user-mutagen-folder, secrets-encryption, aifabrix-secrets, aifabrix-env-config, remote-server, docker-endpoint, **sync-ssh-user**, **sync-ssh-host**.
- **Convention** fixes: **remote_path** = user-mutagen-folder + `/dev/` + appKey; same path for Mutagen and Docker `-v`.
- **CLI** provides: appKey (from command), local path rule, network, container env, Mutagen options. No hardcoded SSH user/host once settings include sync-ssh-user and sync-ssh-host.

---

## 5. Troubleshooting after dev init (401, 400, or “Valid client certificate required”)

After `aifabrix dev init`, if **Fetching settings** or **Registering SSH key** fails (e.g. “Valid client certificate required”, **400 Bad Request**, or 401), determine whether the issue is the server or the CLI.

### 1. Test with curl (same machine as dev init)

Use the cert and key the CLI wrote (e.g. under `~/.aifabrix/certs/<dev-id>/` or `AIFABRIX_CONFIG_DIR/certs/<dev-id>/`):

```bash
curl -v --cert /path/to/certs/01/cert.pem --key /path/to/certs/01/key.pem https://dev.aifabrix.dev/api/dev/settings
```

(Replace `/path/to/certs/01/` with your actual cert dir, e.g. `/workspace/.aifabrix/certs/01/`; use the actual key filename if not `key.pem`.)

- **200 + JSON:** Nginx and the backend are fine. The CLI must use the same cert and key as TLS client certificate for settings and SSH key requests. In aifabrix-builder this is done via Node `https.Agent` with `cert` and `key` for those calls (see `lib/api/dev.api.js` → `requestWithCertImpl`, and `lib/commands/dev-init.js` passing `issueResponse.certificate` and `keyPem` to `getSettings` / `addSshKey`).
- **401:** The server is not getting (or not forwarding) the client cert. Fix on the host for the Builder Server (see §5.2).
- **400 Bad Request:** The backend is receiving an invalid `X-Client-Cert` header. When TLS is terminated at nginx, nginx forwards the client cert in `X-Client-Cert`; if nginx uses `$ssl_client_cert` directly, the header contains literal newlines (invalid per RFC 7230) and the backend may respond with 400. Fix: use nginx njs to send the cert with newlines escaped (see §5.3).

### 2. If curl returns 401: fix server / nginx

On the host for the Builder Server (e.g. dev.aifabrix.dev):

1. Open the nginx vhost (e.g. `/etc/nginx/conf.d/dev.aifabrix.dev.conf`).
2. Ensure:
   - `ssl_client_certificate /opt/aifabrix/builder-server/data/ca.crt;` (or your actual data dir),
   - `ssl_verify_client optional;`,
   - `proxy_set_header X-Client-Cert $ssl_client_cert;`
3. Ensure `ca.crt` exists in that data dir (created when builder-server runs).
4. Run: `sudo nginx -t && sudo systemctl reload nginx`.

### 3. If curl returns 400: fix nginx X-Client-Cert header

HTTP headers must not contain literal newlines. If nginx sets `proxy_set_header X-Client-Cert $ssl_client_cert;`, the variable is multi-line PEM and can cause 400. Fix by sending the cert on one line with newlines escaped as `\n` (backend normalizes with `.replace(/\\n/g, '\n')`):

1. Enable njs (if not already): `load_module modules/ngx_http_js_module.so;`
2. Create a small JS snippet (e.g. `/etc/nginx/cert-escaped.js`):

   ```js
   function cert(r) {
     return r.variables.ssl_client_cert ? r.variables.ssl_client_cert.replace(/\n/g, '\\n') : '';
   }
   ```

3. In the server block (before `location`): `js_include /etc/nginx/cert-escaped.js;` and `js_set $client_cert_escaped cert;`
4. In `location /`: use `proxy_set_header X-Client-Cert $client_cert_escaped;` (instead of `$ssl_client_cert`).
5. Reload nginx: `sudo nginx -t && sudo systemctl reload nginx`.

See builder-server docs (e.g. client certificate in header / X-Client-Cert) for the canonical server-side guide.

### 4. If curl returns 200

Then the fix is in the CLI (aifabrix-builder): after saving the cert, it must use that cert and the matching private key as the TLS client certificate for all subsequent requests to the Builder Server (settings, SSH key registration, etc.). That means configuring the HTTPS client (e.g. Node `https.Agent` with `cert` and `key`) for those calls.

---

**Summary (curl response):** 200 = OK; 401 = cert not forwarded or not accepted (nginx/client cert config); 400 = invalid header (nginx must escape newlines in X-Client-Cert).
