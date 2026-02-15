# Manual tests (real API calls)

The **tests/manual** directory contains tests that call **real** Controller and Dataplane APIs. No mocks are used. Every `lib/api` module is covered with at least one real call:

- **api-auth.test.js** – auth.api (user, client-token, login, roles, permissions, validate, diagnostics, device code)
- **api-environments.test.js** – environments.api (list, get, status, applications, deployments, roles, datasources)
- **api-deployments.test.js** – deployments.api (list, list by app, get deployment, get logs)
- **api-pipeline.test.js** – pipeline.api (health, validate, get deployment)
- **api-credentials.test.js** – credentials.api (list credentials, Dataplane)
- **api-external-systems.test.js** – external-systems.api (list, get, Dataplane)
- **api-datasources.test.js** – datasources-core.api (list, executions, get, status, Dataplane)
- **api-datasources-extended.test.js** – datasources-extended.api (records, grants, Dataplane)
- **api-wizard.test.js** – wizard.api (platforms, credentials, Dataplane)

## Important

- These tests are **manual** and **must not** be run in CI or as part of default `npm test`.
- They are excluded from the default Jest run and from CI.
- **Prerequisite: you must be logged in** before running them.

## Prerequisite: authentication

1. Run **`aifabrix login`** and complete the device flow, **or**
2. Have valid client credentials in **`~/.aifabrix/secrets.local.yaml`** (and optionally env vars such as `CLIENTID` / `CLIENTSECRET` where applicable).

Before any manual test runs, the suite runs **`aifabrix auth status --validate`**. If the token is invalid or missing, **no tests run** and the full auth status error is printed (same as when you run `aifabrix auth status`). Fix login/credentials and run again.

## How to run

```bash
npm run test:manual
```

Run a single file:

```bash
npx jest --config jest.config.manual.js --runInBand tests/manual/api-auth.test.js
```

## Required configuration

- **Controller URL** and **Dataplane URL**: from your config (set via `aifabrix login` or `aifabrix auth config`), or from environment (e.g. `CONTROLLER_URL`, `DATAPLANE_URL` if supported by the helper).
- **Auth**: device token (from `aifabrix login`) or client credentials as above.

## Note

Use of this suite involves real API calls to the platform; such usage may be logged or audited by the platform.
