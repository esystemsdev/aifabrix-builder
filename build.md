## 🧭 Objective

Move from:

```
C:\git\esystemsdev\aifabrix-setup/
  infra/, apps/, scripts/, ps1, templates/
```

to one cross-platform SDK:

```
@aifabrix/builder   ← npm package
```

Developers will run:

```bash
npx aifabrix up
npx aifabrix build app
npx aifabrix deploy app
```

All legacy PowerShell scripts, infra compose files, and Dockerfile templates move **inside the SDK**.

---

## 🧱 Phase 1 – Preparation (1 week)

### 1. Freeze current builder

* Tag current repo → `v1-legacy`.
* Export:

  * `infra/deploy.yaml`
  * `scripts/*.ps1`
  * `apps/<app>/variables.yaml`, `env.template`, `rbac.yaml`.

### 2. Create new SDK repo

```
repos/
 └── aifabrix-builder/
     ├── package.json      (name: "@aifabrix/builder")
     ├── bin/aifabrix.js   (CLI entry)
     ├── lib/
     │    ├── cli.js
     │    ├── infra.js
     │    ├── app.js
     │    ├── secrets.js
     │    ├── generator.js
     │    └── schema/
     ├── docs/
     ├── templates/
     │    ├── typescript/
     │    │     ├── Dockerfile.hbs
     │    │     └── docker-compose.hbs
     │    └── python/
     │          ├── Dockerfile.hbs
     │          └── docker-compose.hbs
     └── README.md
```

### 3. Migrate schemas

* Convert `application`, `infra`, `rbac` YAML schemas → JSON Schema (`ajv`).
* Place in `lib/schema/`.

---

## ⚙️ Phase 2 – Core SDK Implementation (2–3 weeks)

| Component                   | Key Work                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| **CLI** (`bin/aifabrix.js`) | Commands: `up`, `down`, `build`, `push`, `deploy`, `doctor`.                                      |
| **Infra engine**            | Include default `compose.yaml`; use `docker-compose` npm; functions `startInfra()`/`stopInfra()`. |
| **App builder**             | Reads `variables.yaml`, detects language, generates or reuses Dockerfile.                         |
| **Templates**               | Node Alpine + Python Alpine Dockerfiles + compose templates.                                      |
| **Secrets manager**         | Implement `~/.aifabrix/secrets.yaml` + repo override `builder/secrets.local.yaml`.                |
| **JSON generator**          | Merge `variables.yaml`, `env.template`, `rbac.yaml` → `aifabrix-deploy.json`.                     |
| **Logger & telemetry**      | Structured console logs + optional usage telemetry (opt-in).                                      |

---

## 🧩 Phase 3 – Developer Environment Integration (1 week)

### 1. Replace PowerShell wrappers

Remove all `build.ps1` and `push.ps1` files in app repos.
Add symbolic link or npm script:

```json
{
  "scripts": {
    "dev": "aifabrix up && aifabrix build flowise",
    "deploy": "aifabrix deploy flowise"
  },
  "devDependencies": {
    "@aifabrix/builder": "^2.0.0"
  }
}
```

### 2. Refactor `.env` generation

* SDK handles `kv://` resolution automatically.
* Delete `resolve-secrets.ps1`.

### 3. Add `.aifabrix` folder to `.gitignore`

```
.aifabrix/
```

for generated compose/Dockerfile/temp files.

---

## ☁️ Phase 4 – Controller Integration (2 weeks)

1. Add REST client to SDK → `deployApp()` sends `aifabrix-deploy.json` to controller’s `/api/pipeline/deploy`.
2. Controller validates signature + version hash.
3. Update controller docs: *“Deployment via @aifabrix/builder ≥2.0”*.

---

## 🧩 Phase 5 – Decommission Legacy Setup (1 week)

* Archive PowerShell scripts.
* Replace all dev onboarding docs:

  ```bash
  npm i -g @aifabrix/builder
  npx aifabrix up
  ```
* Keep `aifabrix-setup` repo as schema repository only.

---

## 🧠 Optional Enhancements (after v2)

| Feature                    | Description                                                          |
| -------------------------- | -------------------------------------------------------------------- |
| **Azure Key Vault Plugin** | `aifabrix auth azure` → sync `~/.aifabrix/secrets.yaml`.             |
| **Template Registry**      | allow `aifabrix init --template <name>` to clone language templates. |
| **Runtime extension**      | add `.NET` and `Go` Dockerfile templates.                            |
| **Encrypted secrets**      | store `secrets.yaml` AES-GCM encrypted via OS keychain.              |

---

## 🔐 Security / Governance

| Control               | How New SDK Enforces                                                        |
| --------------------- | --------------------------------------------------------------------------- |
| **Access control**    | Local secrets stored per-user (`600` perms).                                |
| **Change management** | Each SDK release versioned; controller validates SDK version tag.           |
| **Auditability**      | Every `aifabrix deploy` logs run metadata (`~/.aifabrix/history.json`).     |
| **Integrity**         | Generated `aifabrix-deploy.json` includes file hashes and runtime language. |

---

## 🧾 Deliverables Checklist

| Item                                 | Responsibility |
| ------------------------------------ | -------------- |
| SDK repo skeleton (Node + Commander) | Platform team  |
| Templates (TS + Python)              | DevOps         |
| JSON Schema validation               | Core SDK       |
| Controller API update                | Backend        |
| Documentation / examples             | DevRel         |
| Developer onboarding script          | Platform team  |

---

## ✅ End State

**Developers use only the SDK:**

```bash
npx aifabrix up
npx aifabrix build <app>
npx aifabrix deploy <app> --controller https://controller.aifabrix.ai
```

**Controller** receives validated JSON + image tag and executes the enterprise deployment pipeline.
**Legacy PowerShell** builder is retired; governance, security, and audit move entirely into the SDK.

---

Would you like me to draft the **project README.md / migration checklist** for teams (step-by-step tasks each dev must do to move from the old builder to `@aifabrix/builder`)?
