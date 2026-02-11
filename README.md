# AI Fabrix - Builder

[![npm version](https://img.shields.io/npm/v/@aifabrix/builder.svg)](https://www.npmjs.com/package/@aifabrix/builder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Install the AI Fabrix platform and test it locally. Then add external integrations or build your own applications.

← **Full documentation:** [docs/README.md](docs/README.md) (table of contents for all guides)

---

## Why AI Fabrix Builder?

- **Build perspective:** Everything is driven by declarative config and JSON schemas—no hidden logic, AI assistant–friendly.
- **Industry standards and security:** Follow industry standards and high security (e.g. ISO 27k); no secrets in version control.
- **Full lifecycle in your version control:** Configuration, apps, and integrations live in your own VCS (GitHub, GitLab, Azure DevOps).
- **One tool from day one:** Single CLI for local infra, app and integration creation, build, run, and deploy—same workflow for apps and integrations.
- **Consistency and production readiness:** Schema-driven; deploy apps and integrations to the same controller/dataplane; production-ready secrets with `kv://` and Azure Key Vault.
- **Application development:** Use **[miso-client](https://github.com/esystemsdev/aifabrix-miso-client)** for TypeScript and Python to talk to the dataplane and controller (see [templates/applications/dataplane/README.md](templates/applications/dataplane/README.md) and the repo for usage).

---

## Prerequisites

- **Node.js 18+** – Recommended for running the CLI.
- **AI Fabrix Azure / platform:** Install from **Azure Marketplace** or run via **Docker** (e.g. `aifabrix up-platform`). You need **full access to Docker** (docker commands) where applicable.
- **Secrets before platform:** Add secrets (e.g. OpenAI or Azure OpenAI) **before** running `aifabrix up-platform`; the platform reads them from the place you configure. See [Infrastructure](docs/infrastructure.md) and secrets configuration.

---

## Install

```bash
npm install -g @aifabrix/builder
```

**Alias:** You can use `aifx` instead of `aifabrix` in any command.

---

## Goal 1: Start and test the AI Fabrix platform

Get the platform running locally so you can try it.

1. **Start local infrastructure** (Postgres, Redis, optional Traefik):

   ```bash
   aifabrix up-infra
   ```

2. **Start the platform** (Keycloak, Miso Controller, Dataplane) from community images:

   ```bash
   aifabrix up-platform
   ```

   Or run platform apps separately: `aifabrix up-miso` then `aifabrix up-dataplane`. Infra must be up first.

3. **Configure secrets** – You need either **OpenAI** or **Azure OpenAI**:

   - **OpenAI:** set your API key:
     ```bash
     aifabrix secrets set secrets-openaiApiKeyVault <your-openai-secret-key>
     ```
   - **Azure OpenAI:** set endpoint and API key:
     ```bash
     aifabrix secrets set azure-openaiapi-urlKeyVault <your-azure-openai-endpoint-url>
     aifabrix secrets set secrets-azureOpenaiApiKeyVault <your-azure-openai-secret-key>
     ```

Secrets are stored in `~/.aifabrix/secrets.local.yaml` or the file from `aifabrix-secrets` in your config (e.g. `builder/secrets.local.yaml`).

→ [Infrastructure guide](docs/infrastructure.md)

---

## Goal 2: External system integration

Create and deploy an external system (e.g. HubSpot): wizard or manual setup, then validate and deploy.

**Example: HubSpot**

- Create: `aifabrix create hubspot-test --type external` (or `aifabrix wizard` for guided setup).
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

- [CLI Reference](docs/cli-reference.md) – All commands
- [Infrastructure](docs/infrastructure.md) – What runs and why
- [Configuration reference](docs/configuration/README.md) – Config files (deployment key, variables.yaml, env.template, secrets)

---

## Requirements

- **Docker Desktop** – For running containers
- **Node.js 18+** – For running the CLI
- **Azure CLI** – For deploying to Azure (optional)

---

## License

© eSystems Nordic Ltd 2025 - All Rights Reserved

`@aifabrix/builder` is part of the AI Fabrix platform.
