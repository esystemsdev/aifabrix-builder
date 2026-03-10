---
name: Secrets env and test/install/lint docs
overview: Document how NPM_TOKEN/PYPI_TOKEN (kv://) are used in build, shell, and install; add the missing install command and optional test-e2e/lint commands; and document the npm vs make script mapping for builder apps.
todos: []
isProject: false
---

# Secrets (NPM_TOKEN/PYPI_TOKEN), install/test-e2e/lint commands, and npm vs make mapping

## Current state

**Environment and secrets**

- **Run and shell**: [lib/app/run-helpers.js](lib/app/run-helpers.js) calls `resolveAndWriteRunEnv` → [lib/core/secrets-env-write.js](lib/core/secrets-env-write.js) `resolveAndWriteEnvFile` → `secrets.generateEnvContent()`, which resolves `kv://` from [lib/core/secrets.js](lib/core/secrets.js) (`loadSecrets` + `resolveKvReferences`). The resulting `.env` is passed to Docker Compose as `env_file`. So **run** and **shell** (which uses the same running container) get `NPM_TOKEN`/`PYPI_TOKEN` when those are in `env.template` and in local/project secrets.
- **Build**: [lib/utils/docker-build.js](lib/utils/docker-build.js) runs `docker build` with only `getRemoteDockerEnv()` (DOCKER_HOST, TLS). No build-args are passed; the Dockerfile templates ([templates/typescript/Dockerfile.hbs](templates/typescript/Dockerfile.hbs), [templates/python/Dockerfile.hbs](templates/python/Dockerfile.hbs)) use plain `npm install` / `pip install` with no `NODE_AUTH_TOKEN`/`NPM_TOKEN`/`PYPI_TOKEN`. So **build** does **not** currently receive secret tokens for private registries.

**Commands**


| Command                           | Exists | Notes                                                                                                                                                                                    |
| --------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aifabrix test <app>`             | Yes    | Builder: [lib/commands/app-test.js](lib/commands/app-test.js) (`getTestCommand` → `build.scripts.test` or `pnpm test` / `make test`). External: local validation.                        |
| `aifabrix test-integration <app>` | Yes    | [lib/cli/setup-external-system.js](lib/cli/setup-external-system.js) – external systems only.                                                                                            |
| `aifabrix test-e2e <app>`         | No     | [docs/developer-isolation.md](docs/developer-isolation.md) line 434 lists it as a command, but there is no CLI command; docs suggest using shell then `make test:e2e` / `pnpm test:e2e`. |
| `aifabrix lint <app>`             | No     | Same as test-e2e: documented in developer-isolation.md, [docs/commands/README.md](docs/commands/README.md) says "run shell then make test:e2e or make lint".                             |
| `aifabrix install <app>`          | No     | Not implemented.                                                                                                                                                                         |


**Script resolution**

- [lib/commands/app-test.js](lib/commands/app-test.js) `getTestCommand(appConfig)` uses `appConfig.build?.scripts?.test` or `appConfig.scripts?.test`, else language default: Python `make test`, TypeScript `pnpm test`. The [application-schema.json](lib/schema/application-schema.json) `build` object has no `scripts` property; the pattern is used in code but not documented or schema-validated.

---

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc). Applicable sections:

- **[CLI Command Development](.cursor/rules/project-rules.mdc)** – New commands `install`, optional `test-e2e` and `lint`: add in `lib/cli/setup-app.js`, implement in `lib/commands/`, input validation, error handling with chalk, tests for each command.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc)** – Files ≤500 lines, functions ≤50 lines; JSDoc for all public functions; single responsibility.
- **[Quality Gates](.cursor/rules/project-rules.mdc)** – Before commit: `npm run build` (lint + test), `npm run lint` (zero errors), all tests pass, coverage ≥80% for new code, no hardcoded secrets.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc)** – Secret management: kv:// in env.template, resolve via secrets; never log or expose secrets; document where NPM_TOKEN/PYPI_TOKEN come from for build/run/shell/install.
- **[Testing Conventions](.cursor/rules/project-rules.mdc)** – Tests in `tests/lib/commands/` mirroring source; mock fs, child_process; test success and error paths for new commands.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc)** – try-catch for async, chalk for output, meaningful messages, never log secrets.

**Key requirements**

- Commander.js pattern for new commands; validate app name and options; use `handleCommandError` for consistency.
- JSDoc for `getInstallCommand`, `runAppInstall`, and any new helpers (test-e2e, lint).
- New command modules (e.g. `app-install.js`) follow existing `app-test.js` / `app-shell.js` patterns.
- If build-args are added: allowlist which vars are passed; never log secret values.

---

## Before Development

- Read CLI Command Development and Code Quality Standards in project-rules.mdc.
- Review [lib/commands/app-test.js](lib/commands/app-test.js) and [lib/cli/setup-app.js](lib/cli/setup-app.js) for command and script-resolution patterns.
- Review [lib/core/secrets-env-write.js](lib/core/secrets-env-write.js) and run flow for env resolution (ephemeral env-file if implementing section 6).
- Confirm which deliverables are in scope (install mandatory; test-e2e/lint and build-args optional).

---

## Definition of Done

Before marking this plan complete:

1. **Build**: Run `npm run build` first (must succeed; runs lint + test).
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings).
3. **Test**: Run `npm test` or `npm run test:ci` after lint (all tests pass; ≥80% coverage for new code).
4. **Validation order**: BUILD → LINT → TEST (mandatory sequence; do not skip steps).
5. **File size**: All files ≤500 lines, functions ≤50 lines.
6. **JSDoc**: All public functions have JSDoc (params, returns, throws where applicable).
7. **Code quality**: All requirements from Rules and Standards met.
8. **Security**: No hardcoded secrets; NPM_TOKEN/PYPI_TOKEN only via kv:// and resolution; never log secret values; ISO 27001–aligned.
9. **Documentation**: env-template, application-development, and (if applicable) application-yaml and developer-isolation updated as in sections 1 and 5.
10. All chosen deliverables implemented (install required; test-e2e, lint, build-args, schema, ephemeral env optional per plan).

---

## 1. Document where build, shell, and install get env (NPM_TOKEN, PYPI_TOKEN)

**Add a single source of truth** that states:

- **Run and shell**: Environment comes from `env.template` with `kv://` resolved from local or project secrets (see [docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md), [docs/configuration/env-template.md](docs/configuration/env-template.md)). Add `NPM_TOKEN=kv://npm-token-secretKeyVault` and/or `PYPI_TOKEN=kv://pypi-token-secretKeyVault` (or project-specific keys) to `env.template` and ensure those keys exist in the configured secrets file; then `aifabrix run` / `aifabrix shell` will have them in the container.
- **Build**: Today, Docker build does **not** receive env or build-args from the CLI. For private npm/pypi during `RUN npm install` or `pip install`, either: (a) document that build does not pass secrets and recommend using a pre-authenticated context (e.g. `.npmrc` in context with a CI-injected token), or (b) extend build to resolve app env and pass selected vars (e.g. `NPM_TOKEN`, `NODE_AUTH_TOKEN`, `PYPI_TOKEN`) as `--build-arg` (see section 2).
- **Install** (once added): Will run inside the same container as run/shell (dev) or an ephemeral container (tst), with the same resolved `.env` as run, so it will see `NPM_TOKEN`/`PYPI_TOKEN` when present in `env.template` and secrets.

**Suggested places**

- [docs/configuration/env-template.md](docs/configuration/env-template.md): add a short subsection "Build, run, and shell" describing the above.
- [docs/commands/application-development.md](docs/commands/application-development.md): in the build and run sections, add a cross-reference to env-template for tokens (NPM_TOKEN, PYPI_TOKEN).

---

## 2. (Optional) Pass NPM_TOKEN/PYPI_TOKEN as build-args when building

If private registries are required **during** `docker build`:

- In [lib/build/index.js](lib/build/index.js) (or a small helper), before calling `dockerBuild.executeDockerBuildWithTag`, resolve app env once (e.g. reuse the same resolution as run: `secrets.generateEnvContent` for the app, then parse the result or use a helper that returns a key-value map).
- Define an allowlist of build-arg names (e.g. `NPM_TOKEN`, `NODE_AUTH_TOKEN`, `PYPI_TOKEN`) and pass those as `--build-arg VAR=value` to `docker build`.
- In [lib/utils/docker-build.js](lib/utils/docker-build.js), extend `runDockerBuildProcess` to accept optional `buildArgs` and add `--build-arg` to the `docker build` invocation.
- Update Dockerfile templates to use `ARG NPM_TOKEN` / `ARG PYPI_TOKEN` and use them in `RUN npm install` / `pip install` (e.g. `NODE_AUTH_TOKEN`, pip config or env).
- Document in env-template and application-development: "If you need private npm/pypi during build, add NPM_TOKEN/PYPI_TOKEN to env.template as kv://...; the build command will pass them as build-args."

If this is out of scope, document only that build does not inject secrets and that install/run/shell are the way to run with tokens.

---

## 3. Add `aifabrix install <app>`

- **CLI**: In [lib/cli/setup-app.js](lib/cli/setup-app.js), add `program.command('install <app>')` with `--env <dev|tst>` (same semantics as test). Handler: if builder app, call a new `runAppInstall(appName, { env })`; if external, either no-op or short message that install is for builder apps only.
- **Logic**: New file [lib/commands/app-install.js](lib/commands/app-install.js) (or extend a shared "app-run-script" module). Mirror [lib/commands/app-test.js](lib/commands/app-test.js):
  - `getInstallCommand(appConfig)`: `build.scripts.install` or `scripts.install`, else language default: TypeScript `pnpm install`, Python `make install`.
  - `runAppInstall(appName, options)`: same pattern as `runAppTest` – dev = exec in running container, tst = ephemeral container. For ephemeral, consider passing the same resolved `.env` as `env_file` into `docker run` so install has NPM_TOKEN/PYPI_TOKEN (today app-test does not pass env for ephemeral; can be done in this task or a follow-up).
- **Docs**: [docs/commands/application-development.md](docs/commands/application-development.md) – new section "aifabrix install ", and add to [docs/commands/README.md](docs/commands/README.md) command list.

---

## 4. Add `aifabrix test-e2e <app>` and `aifabrix lint <app>` (optional)

- **CLI**: In [lib/cli/setup-app.js](lib/cli/setup-app.js), add:
  - `program.command('test-e2e <app>')` with `--env <dev|tst>`
  - `program.command('lint <app>')` with `--env <dev|tst>`
- **Logic**: Reuse the same pattern as test/install. New helpers (in [lib/commands/app-test.js](lib/commands/app-test.js) or a shared module):
  - `getTestE2eCommand(appConfig)`: `build.scripts['test:e2e']` or `build.scripts.testE2e` or `scripts['test:e2e']`, else TypeScript `pnpm test:e2e`, Python `make test:e2e`.
  - `getLintCommand(appConfig)`: `build.scripts.lint` or `scripts.lint`, else TypeScript `pnpm lint`, Python `make lint`.
- **Commands**: `runAppTestE2e`, `runAppLint` – same as `runAppTest` (dev = exec in container, tst = ephemeral).
- **Docs**: Add sections in application-development.md and README; fix [docs/developer-isolation.md](docs/developer-isolation.md) line 434 so it accurately lists the CLI commands (test, test-integration, test-e2e, lint) and points to application-development for builder apps.

---

## 5. Document npm vs make mapping (and optional schema)

**Documentation**

- Add a subsection under [docs/configuration/application-yaml.md](docs/configuration/application-yaml.md) (or a new "Scripts and commands" section in application-development.md) with a clear table:


| CLI / usage               | application.yaml key                                | TypeScript default | Python default  |
| ------------------------- | --------------------------------------------------- | ------------------ | --------------- |
| `aifabrix test <app>`     | `build.scripts.test`                                | `pnpm test`        | `make test`     |
| `aifabrix install <app>`  | `build.scripts.install`                             | `pnpm install`     | `make install`  |
| `aifabrix test-e2e <app>` | `build.scripts.test:e2e` or `build.scripts.testE2e` | `pnpm test:e2e`    | `make test:e2e` |
| `aifabrix lint <app>`     | `build.scripts.lint`                                | `pnpm lint`        | `make lint`     |


- Note that when a key is missing, the CLI falls back to the language default. Example YAML snippet for overrides:

```yaml
build:
  language: typescript
  scripts:
    test: pnpm test
    install: pnpm install
    test:e2e: pnpm test:e2e
    lint: pnpm lint
```

**Schema (optional)**

- In [lib/schema/application-schema.json](lib/schema/application-schema.json), under `build.properties`, add an optional `scripts` object with optional keys `test`, `install`, `lint`, `testE2e` (or allow `test:e2e` as a key). This makes the mapping explicit and validatable.

---

## 6. Ephemeral container env (test/install/lint --env tst)

Currently [lib/commands/app-test.js](lib/commands/app-test.js) `runDockerRunEphemeral(fullImage, testCmd)` runs `docker run --rm <image> sh -c <cmd>` with no `--env-file`. So ephemeral runs do not get the resolved `.env` (e.g. NPM_TOKEN). For consistency with run/shell:

- Option A: When running ephemeral (tst), resolve the app `.env` (same as run) and pass it with `docker run --env-file <path> ...`. This requires generating the env file to a temp path and passing it into the run helper.
- Option B: Leave as-is and document that for commands that need secrets (e.g. install with private registry), use `--env dev` (running container) or run `aifabrix shell` and run the command manually.

Recommendation: implement Option A for install (and test-e2e/lint if added) so `aifabrix install myapp --env tst` works with private registries; document that env is the same as for run.

---

## Summary of deliverables

1. **Docs**: env-template and application-development updated to describe where build, run, shell, and install get env (NPM_TOKEN, PYPI_TOKEN, kv://).
2. **Optional**: Build passes selected tokens as build-args; Dockerfile templates and docs updated.
3. **CLI**: New `aifabrix install <app> [--env dev|tst]` with getInstallCommand and runAppInstall (mirror app-test).
4. **CLI (optional)**: New `aifabrix test-e2e <app>` and `aifabrix lint <app>` with same pattern.
5. **Docs**: Table mapping CLI commands to build.scripts keys and npm/make defaults; fix developer-isolation.md.
6. **Optional**: application-schema build.scripts; ephemeral runs (tst) get resolved .env via --env-file.

No code edits or execution in this plan phase; the above is a specification for implementation.

---

## Plan Validation Report

**Date**: 2025-02-23  
**Plan**: .cursor/plans/73-secrets_env_and_test_install_lint_docs.plan.md  
**Status**: VALIDATED

### Plan Purpose

- **Summary**: Document how NPM_TOKEN/PYPI_TOKEN (kv://) are used for build, shell, and install; add `aifabrix install <app>` and optionally `test-e2e` and `lint`; document npm vs make script mapping; optionally pass tokens as build-args and add build.scripts to schema.
- **Scope**: CLI commands (lib/cli/setup-app.js, lib/commands/), documentation (env-template, application-development, application-yaml, developer-isolation, README), optional: build/docker-build, Dockerfile templates, application-schema.
- **Type**: Development (CLI commands), Documentation, Security (secret management).

### Applicable Rules

- **CLI Command Development** – New commands (install, optional test-e2e, lint); command pattern, validation, chalk, tests.
- **Code Quality Standards** – File/function size limits, JSDoc for public functions.
- **Quality Gates** – Mandatory: build, lint, test, coverage ≥80%, no hardcoded secrets.
- **Security & Compliance (ISO 27001)** – kv:// and secret resolution; no logging of secrets.
- **Testing Conventions** – Tests for new commands; mirror structure; mock dependencies.
- **Error Handling & Logging** – try-catch, chalk, no sensitive data in messages.

### Rule Compliance

- DoD requirements: Documented (build first, then lint, then test; file size; JSDoc; security; all tasks).
- CLI Command Development: Plan references add-command pattern and app-test/app-shell as reference.
- Code Quality Standards: File/function limits and JSDoc called out in DoD.
- Quality Gates: Build/lint/test order and coverage in DoD.
- Security: Plan explicitly documents kv:// and avoiding exposure of secrets.

### Plan Updates Made

- Added **Rules and Standards** with links to project-rules.mdc and key requirements for CLI, quality, security, testing, error handling.
- Added **Before Development** checklist (read rules, review app-test/setup-app, review secrets-env-write, confirm scope).
- Added **Definition of Done** with BUILD → LINT → TEST order, file size, JSDoc, security, documentation, and optional deliverables.
- Appended this validation report.

### Recommendations

- When implementing section 3 (install), add tests in `tests/lib/commands/app-install.test.js` mirroring `app-test.test.js`.
- If implementing section 4 (test-e2e, lint), consider a shared helper (e.g. `runAppScript(appName, scriptKey, options)`) to avoid duplication with test/install.
- If implementing section 2 (build-args), restrict to an allowlist of var names and document it in env-template and application-development.