# AI Fabrix - Builder

[![npm version](https://img.shields.io/npm/v/@aifabrix/builder.svg)](https://www.npmjs.com/package/@aifabrix/builder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Install the AI Fabrix platform and test it locally. Then add external integrations or build your own applications.

← **Full documentation:** [docs/README.md](docs/README.md) (table of contents for all guides)

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
- [Configuration](docs/configuration.md) – Config files

---

## Requirements

- **Docker Desktop** – For running containers
- **Node.js 18+** – For running the CLI
- **Azure CLI** – For deploying to Azure (optional)

---

## License

© eSystems Nordic Ltd 2025 - All Rights Reserved

`@aifabrix/builder` is part of the AI Fabrix platform.
