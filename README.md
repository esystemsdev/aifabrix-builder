# AI Fabrix - Builder

[![npm version](https://img.shields.io/npm/v/@aifabrix/builder.svg)](https://www.npmjs.com/package/@aifabrix/builder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Open developer runtime for AI Fabrix ecosystem. Install the AI Fabrix platform and test it locally. Then add external integrations or build your own applications.

← **Full documentation:** [docs/README.md](docs/README.md) (table of contents for all guides)

---

## Why AI Fabrix Builder?

- **Build perspective:** Everything is driven by declarative config and JSON schemas—no hidden logic, AI assistant–friendly.
- **Industry standards and security:** Follow industry standards and high security (e.g. ISO 27k); no secrets in version control.
- **Full lifecycle in your version control:** Configuration, apps, and integrations live in your own VCS (GitHub, GitLab, Azure DevOps).
- **One tool from day one:** Single CLI for local infra, app and integration creation, build, run, and deploy—same workflow for apps and integrations.
- **Consistency and production readiness:** Schema-driven; deploy apps and integrations to the same controller/dataplane; production-ready secrets with `kv://` and Azure Key Vault.
- **Application development:** Use **[miso-client](https://github.com/esystemsdev/aifabrix-miso-client)** (TypeScript and Python) to talk to the dataplane and controller. The repo includes both TypeScript and Python SDKs; see [templates/applications/dataplane/README.md](templates/applications/dataplane/README.md) and the repo for usage.

---

## Prerequisites

- **Node.js 18+** – Recommended for running the CLI.
- **Docker Desktop** – Full access to Docker (containers for infra and platform).
- **Secrets before platform:** Add an AI tool key (OpenAI or Azure OpenAI) in setup or with `aifabrix secret set` **before** the platform needs them. See [Infrastructure](docs/infrastructure.md).

---

## Install the CLI

```bash
npm install -g @aifabrix/builder
```

**Alias:** You can use `af` instead of `aifabrix` in any command.

---

## Goal 1: Install the platform (one command)

Get Postgres, Redis, Keycloak, Miso Controller, and Dataplane running on your machine.

```bash
aifabrix setup
```

That is the whole story for most developers. The command detects whether infra is already running:

| Situation | What happens |
| --- | --- |
| **Fresh machine** | Short wizard → pull images → `up-infra` → `up-platform` |
| **Already installed** | Mode menu (3 choices): **re-install** (destroys volumes), **wipe data** (DBs only), or **update images** (keeps data) — each path pulls fresh Docker images before restart |

**Grab a coffee** — setup pulls infrastructure and platform images (a few minutes on first run or after image updates). When setup finishes, the CLI stores **`platform-controller`** in `config.yaml` (absolute Miso URL for your machine). Sign in with username **`admin`** and your admin password. If you were already logged in to that controller URL, setup keeps your session; otherwise it prompts for device login like a fresh install.

**Controller URL:** Local Docker without Traefik uses `http://localhost:` + port `3000 + developerId×100`. With Traefik and `remote-server`, use the public URL shown in the **Platform Ready** footer (path `/miso/*`). See [Infrastructure guide](docs/infrastructure.md#install-the-platform-one-command).

→ Step-by-step detail, ports, and **dev / pro** installation profiles: **[Infrastructure guide](docs/infrastructure.md#install-the-platform-one-command)**

### Dev vs pro installation (setup profile)

These names match how we talk about **environments** elsewhere (**dev**, **tst**, **pro**). Here they mean **how you install locally**, not which cloud environment you deploy to later.

| Profile | Best for | Admin email | Admin passwords |
| --- | --- | --- | --- |
| **dev** (default) | Local development, training, labs | You enter once | **One password** for Postgres, pgAdmin, Keycloak, and platform login |
| **pro** | Production-style or hardened installs | Same | **Autogenerate** strong passwords (shown once) **or** enter manually |

**Default:** **dev** (one email, one password). **Pro** is available in the setup wizard or non-interactively:

```bash
aifabrix setup --installation pro --pro-password-mode autogen
```

Use `--pro-password-mode manual` to enter passwords yourself (one password for all roles, or separate infra / Keycloak / platform passwords via `up-infra` flags).

Admin credentials are stored in **`~/.aifabrix/admin-secrets.env`** (encrypted when you configure a secrets encryption key). App and integration secrets stay in **`~/.aifabrix/secrets.local.yaml`**.

### Optional: set AI keys outside the wizard

- **OpenAI:**
  ```bash
  aifabrix secret set secrets-openaiApiKeyVault <your-openai-secret-key>
  ```
- **Azure OpenAI:**
  ```bash
  aifabrix secret set azure-openaiapi-urlKeyVault <your-azure-openai-endpoint-url>
  aifabrix secret set secrets-azureOpenaiApiKeyVault <your-azure-openai-secret-key>
  ```

Remove the platform completely: `aifabrix teardown`. Command details: [Infrastructure commands](docs/commands/infrastructure.md#aifabrix-setup).

---

## Goal 2: External system integration

Create and deploy an external system (e.g. HubSpot): wizard or manual setup, then validate and deploy.

**Example: HubSpot:**

- Create: `aifabrix create hubspot-test` (external is the default; or `aifabrix wizard` for guided setup). For a web app use `aifabrix create my-app --type webapp`.
- Configure auth and datasources under `integration/hubspot-test/`.
- Validate: `aifabrix validate hubspot-test`
- Deploy: `aifabrix deploy hubspot-test`

→ [External systems guide](docs/external-systems.md) · [Wizard](docs/wizard.md)

---

## Goal 3: Build your own application

Create, configure, and run your own AI Fabrix application locally or deploy it (create app → configure → build → run / deploy).

→ [Your own applications](docs/your-own-applications.md)

---

## Documentation

All guides and references are listed in **[docs/README.md](docs/README.md)** (table of contents).

- [CLI Commands Reference](docs/commands/README.md) – All commands
- [Infrastructure](docs/infrastructure.md) – Install the platform, services, dev/pro setup
- [Configuration reference](docs/configuration/README.md) – Config files (deployment key, application.yaml, env.template, secrets)

---

## Requirements

- **Docker Desktop** – For running containers
- **Node.js 18+** – For running the CLI
- **Azure CLI** – For deploying to Azure (optional)

---

## License

© eSystems Nordic Ltd 2026 - All Rights Reserved

`@aifabrix/builder` is part of the AI Fabrix platform.
