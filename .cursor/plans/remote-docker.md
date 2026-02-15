# AIFABRIX REMOTE DEV SPEC (v1.0)

## 1. Environment Model

### Supported environments

* `dev`
* `tst`
* `pro`

### Behaviour matrix

| Env | Sync | Reload | Mount | Requires Image |
| --- | ---- | ------ | ----- | -------------- |
| dev | Yes  | Yes    | Yes   | Optional       |
| tst | No   | No     | No    | Yes            |
| pro | No   | No     | No    | Yes            |

---

# 2. Config Structure

## ~/.aifabrix/config.yaml

aifabrix-workspace-root: all commands via aifabrix CLI working as it here if not set full path. If missing full path then we use workapce-root
remote-server: this is remote server where we get certicate and remote docker endpoint and other settings
aifabrix-secrets: this support workspace-root as similar than other files

aifabrix secrets set <key> <value> --project -> new variable and if set then update secret in project secret file and not in local
aifabrix dev config >  retun a new values
when remote-server is used we do not generate different localPort or different names and we skip local in aifabrix-env-config (both files are docker - config)

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
docker-endpoint: tcp://dev.aifabrix.dev:2376 

```

POST /api/dev/issue-cert
{
  "devId": "01",
  "pin": "123456",
  "csr": "PEM-encoded CSR"
}
return
{
  "clientCert": "...",
  "caCert": "...",
  "expiresAt": "2026-03-15T00:00:00Z",
  "dockerEndpoint": "tcp://dev.aifabrix.dev:2376",
  "secretsEncryption": "685d4b7ab1ec43fa38f96f3b40bd12b98b9bc6f1d53242888d11d5c8f8d5b634"
  "aifabrixSecrets: '/aifabrix-miso/builder/secrets.local.yaml'
}


---

# 3. Commands – Required Day One

## 3.1 Onboarding

### Command

```
aifabrix dev init --dev-id 01 --server https://dev.aifabrix.dev --pin 123456
```

### Behaviour

1. Validate PIN via onboarding API
2. Download:

   * TLS client cert
   * CA cert
   * Docker endpoint info
3. Store in:

```
~/.aifabrix/certs/01/
```

4. Write config.yaml
5. Set context default for aifabrix CLI (NOT globally)
6. remote-server is set then all "docker" commands to via remote

---

## 3.2 Start Infra

```
aifabrix up-infra
```

### Behaviour

* Ensure network exists for dev-xx
* Start required infra containers
* Validate health endpoints
* Fail if health not ready

---

## 3.3 Run Application

### DEV

```
aifabrix run myapp --reload (when --reload this run everytime in dev environment)
```

### Internal Logic

1. Ensure docker context active
2. Start sync session
3. Resolve remote path:

```
E.g
/workspace/aifabrix-dataplane/builder/dataplane
we sync from application.yaml
build:
  context: ../..
this case sync is /workspace/aifabrix-dataplane
```

4. Run container:

```
This is example and validate and fix
docker run \
  --network <dev-xx-network> \
  -v remote_path:/app \
  -e MISO_ENVIRONMENT=dev \
  -e AIFABRIX_DEV_MODE=true \
  myapp-image
```

---

### TST

```
aifabrix run myapp --env tst
```

Behaviour:

* Fail if image not built
* No sync
* No mount
* Run immutable image

```
docker run \
  --network <dev-xx-network> \
  -e MISO_ENVIRONMENT=tst \
  myapp-image:tag
```

---

### PRO

```
aifabrix run myapp --env pro
```

Behaviour:

* Pull image from registry
* No mount
* No reload
* No sync
* Immutable execution

---

# 4. Sync Specification (DEV Only)

## Tool: Mutagen (internal dependency)

### Session Naming Convention

```
Validate how we build image 
aifabrix-<dev-id>-<app-name>
```

### Local Path

```
absolute project directory
```

### Remote Path

```
/workspace/.../myapp
```

### Sync Mode

* Two-way-resolved
* Ignore: same than gitignore or dockerignore or own file or what?

  * node_modules
  * .git
  * dist
  * build
  * .aifabrix

---

## Sync Lifecycle

When:

```
aifabrix run myapp --reload
```

If session exists:

* Resume

If not:

* Create session

When:

```
aifabrix dev down
```

* Stop all sessions

---

# 5. Build Command

```
aifabrix build myapp
```

Behaviour:

* Build image on remote Docker engine
* Tag image:

```
myapp:dev-01-latest
```

---

# 6. Test Command

```
aifabrix test myapp --env dev|tst
aifabrix test-integration myapp --env dev|tst
aifabrix test-e2e myapp --env dev|tst
aifabrix lint myapp --env dev|tst
```
When type typescript > application.yaml
  pnpm test
  pnpm test:integration
  pnpm test:e22
  pnpm lint
> if not exsting then show error what to do

When type python > application.yaml
  make test
  make test-integration
  make test-e22
  make lint
> if not exsting then show error what to do

### DEV

* Execute inside running container

### TST

* Spin ephemeral container from image
* Run test command
* Destroy container after

---

# 7. Shell Command

```
aifabrix shell myapp --env dev|tst
```

Internally:

```
docker exec -it container bash
```

No SSH required.

---

# 8. Logs Command

```
aifabrix logs myapp --env dev|tst|pro (as we have already but -env variable can be added)
```

---

# 9. Environment Guard Rules

CLI must enforce:

* `--reload` auto set in `dev`
* Sync only active in `dev`
* Mount only allowed in `dev`
* tst/pro require image

---

# 10. Dev/Tst/Pro Isolation Rules

Each environment:

* Own Docker in same network
* Own container namespace

---

# 11. Security Model

Developers DO NOT have:

* SSH access
* docker group access
* host OS access

Developers HAVE:

* TLS Docker API access
* Per-developer isolated networks
* Per-developer isolated workspace

All via:

```
aifabrix CLI
```

---

# 12. Failure Handling

## Sync fails

* Stop container
* Show error
* Suggest:

```
aifabrix sync reset myapp
```

---

## Docker context invalid

* Abort
* Suggest re-running:

```
aifabrix dev init
```

---

# 13. Minimal Day-One Command List

Required:

```
aifabrix dev init
aifabrix up-infra --env <env>
aifabrix run <app> --env dev --reload
aifabrix run <app> --env tst
aifabrix run <app> --env pro
aifabrix build <app>
aifabrix stop <app>
aifabrix logs <app>
aifabrix shell <app>
aifabrix test <app>
fix it
```

No more required for v1.

---

# 14. Architectural Outcome

This gives you:

* Mutable dev
* Immutable tst
* Immutable pro
* No SSH workflow
* Cross-platform support
* Clean promotion boundary
* Enterprise-aligned lifecycle

---

If useful, next I can provide:

* Image tagging & promotion spec
* CI/CD integration spec
* Certificate rotation model
* Dev server hardening checklist
* Or full lifecycle diagram (Dev → Tst → Pro)

Yes — and this is the correct evolution.

You should move from **PIN-based bootstrap only** to:

> PIN = initial trust bootstrap
> Certificate = ongoing trust renewal

After first onboarding, renewal should happen automatically using the existing valid certificate.

Below is a clean, enterprise-grade renewal specification.

---

# Certificate Lifecycle Model

## 1. Trust Phases

### Phase 1 — Bootstrap (One-time)

Uses:

* Developer ID
* PIN (24h validity)
* CSR

Result:

* First client certificate issued

---

### Phase 2 — Operational Mode

Uses:

* Existing valid client certificate
* Mutual TLS authentication
* No PIN required

Renewal is authenticated using the current certificate.

---

# 2. Automatic Renewal Flow

## Renewal Trigger

CLI checks certificate expiry at every "docker" command execution.

If:

```
daysToExpiry <= 14
```
automatically issue and new certificate and show information to user

---

# 3. Renewal Protocol (No PIN Required)

## Endpoint

```
POST /api/dev/renew-cert
```

Authentication:

* mTLS using existing valid certificate

Request:

```json
{
  "devId": "01",
  "csr": "PEM-encoded CSR"
}
```

Server Flow:

1. Verify mTLS certificate is valid
2. Verify certificate subject matches devId
3. Check certificate not revoked
4. Issue new certificate
5. Return:

```json
{
  "clientCert": "...",
  "caCert": "...",
  "expiresAt": "2026-03-15T00:00:00Z"
}
```

Client replaces old certificate locally.

---

# 5. Important Security Controls

## Renewal Only Allowed If:

* Existing cert is still valid
* Cert is not revoked
* CN matches developer ID
* Cert age < max lifetime (optional control)

---

# 6. Expired Certificate Behaviour

If certificate is expired:

* Renewal endpoint must reject (no mTLS)
* CLI must require full re-onboarding:

```
aifabrix dev init --pin
```

This prevents unauthorized resurrection of old identities.

---

# 7. Recommended Certificate Policy

### Lifetime

* 30 days (recommended)
* Max 90 days

### Warning Threshold

* 14 days → auto-renew attempt

---

# 8. Revocation Strategy

If developer deleted:

1. Revoke cert in CA
2. Add to CRL or OCSP list
3. Renewal endpoint must reject

This prevents:

* Rogue continued access
* Stale certificates being reused

---

# 9. CLI Behaviour Spec

At CLI startup:

1. Load certificate
2. Parse expiry
3. If <14 days → show warning
4. If <3 days → auto renew attempt
5. If renewal fails → block execution

---

# 10. Optional: Silent Background Renewal

Advanced UX option:

If certificate <14 days:

* Renew automatically in background
* Only show message if renewal fails

Cleaner developer experience.

---

# 11. Security Model Summary

| Scenario     | PIN Needed | mTLS Needed |
| ------------ | ---------- | ----------- |
| First setup  | Yes        | No          |
| Renewal      | No         | Yes         |
| Expired cert | Yes        | No          |
| Revoked cert | Yes        | No          |

This is standard PKI lifecycle design.

---

# 12. Why This Is Architecturally Correct

You achieve:

* No recurring PIN friction
* Strong cryptographic identity
* Revocable trust
* Short-lived credentials
* Clean zero-SSH model
* Enterprise alignment (similar to Kubernetes client cert renewal)

This is production-grade identity lifecycle management.

---

# 13. Final Recommendation

Implement:

* CSR-based renewal endpoint
* mTLS enforcement
* 30-day cert TTL
* 14-day warning
* 3-day auto-renew

PIN only for bootstrap.

That is the correct maturity level.

# Managed by aifabrix CLI

When running:

```
aifabrix dev init
```

CLI should:

1. Check if mutagen exists
2. If not:

   * Download correct Windows / MAC binary
   * Store in:

```
~/.aifabrix/bin/mutagen.exe
```

3. Use internal binary path
4. Never rely on system PATH

This avoids:

* Version mismatch
* PATH problems
* Corporate install restrictions
* Admin rights issues

---

# Example CLI Detection Logic

Pseudo-code:

```
if not exists ~/.aifabrix/bin/mutagen.exe:
    download mutagen release
    extract
    chmod
```

Then always execute:

```
~/.aifabrix/bin/mutagen.exe
```

This is cleaner and fully controlled.

---

# Windows Path Handling

Your CLI must convert:

```
C:\Users\Mika\project
```

to standard Windows absolute path.

Mutagen handles remote target:

```
devserver:/workspace/myapp
```

No manual slash conversion required.

---

# Firewall / Corporate Network Note

Ensure:

* Twingate active
* Port 2376 reachable
* Mutagen uses SSH or direct TCP depending on your setup

If using Docker TLS endpoint only:
Mutagen still needs SSH or TCP-based transport to remote machine.

Best practice:

Use SSH transport inside Twingate network.

Example:

```
mutagen sync create \
  C:\Users\Mika\project \
  devserver:/workspace/myapp
```

Developers should not even know Mutagen exists.

They should only run:

```
aifabrix run myapp --env dev --reload
```

And everything works.