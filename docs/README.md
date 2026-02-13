# AI Fabrix Documentation

Table of contents for all AI Fabrix Builder documentation.

← [Back to project README](../README.md)

---

## Getting started

| Document                                                                    | Description                                                            |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [Your own applications](your-own-applications.md)                           | Create, configure, build, and run your own app (app-centric).          |
| [CLI Commands Reference](commands/README.md)                                 | All CLI commands and options (alias: use `aifx` for `aifabrix`).       |

**Example application and SDK:** For an example app and TypeScript/Python client to talk to the dataplane and controller, see [aifabrix-miso-client](https://github.com/esystemsdev/aifabrix-miso-client).

---

## Platform and infrastructure

| Document                                                                    | Description                                                            |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [Infrastructure](infrastructure.md)                                         | Local infra (Postgres, Redis, Traefik), up-platform, up-miso, up-dataplane. |
| [Configuration reference](configuration/README.md)                          | env-config, env.template, application.yaml, secrets, deployment key.     |

---

## External systems and integration

| Document                                                                    | Description                                                            |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [External systems](external-systems.md)                                     | External system integration (e.g. HubSpot), step-by-step.              |
| [Wizard](wizard.md)                                                         | Interactive or headless wizard for external systems.                   |
| [GitHub workflows](github-workflows.md)                                     | CI/CD and GitHub Actions.                                              |

---

## Applications and deployment

| Document                                                                    | Description                                                            |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [Building](building.md)                                                     | Build process and Docker images.                                       |
| [Running](running.md)                                                       | Run applications locally.                                              |
| [Deploying](deploying.md)                                                   | Deploy to Azure and environment setup.                                 |
| [Deployment – first-time environment](deployment/environment-first-time.md) | First-time environment setup.                                          |
| [Developer isolation](developer-isolation.md)                               | Port isolation for multiple developers.                                |


---

## Commands by topic

| Topic                                                                       | Document                                                               |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Authentication                                                              | [Authentication commands](commands/authentication.md)                  |
| Infrastructure                                                              | [Infrastructure commands](commands/infrastructure.md)                  |
| Developer isolation                                                         | [Developer isolation commands](commands/developer-isolation.md)        |
| Application management                                                      | [Application management commands](commands/application-management.md)  |
| Application development                                                     | [Application development commands](commands/application-development.md)|
| Deployment                                                                  | [Deployment commands](commands/deployment.md)                          |
| Validation                                                                  | [Validation commands](commands/validation.md)                          |
| External integration                                                        | [External integration commands](commands/external-integration.md)      |
| Utilities                                                                   | [Utility commands](commands/utilities.md)                              |
| Reference                                                                   | [Command reference](commands/reference.md)                             |

---

## Configuration details

| Document                                                                    | Description                                                            |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [Deployment key](configuration/deployment-key.md)                           | How deployment key is calculated; why Miso Controller and Dataplane use the same key. |
| [env-config](configuration/env-config.md)                                   | Environment configuration.                                             |
| [env.template](configuration/env-template.md)                               | Environment template and variables.                                    |
| [application.yaml](configuration/application-yaml.md)                       | Application config.                                                    |
| [Secrets and config](configuration/secrets-and-config.md)                   | Secrets and configuration.                                             |
| [External integration config](configuration/external-integration.md)        | External system configuration.                                         |
