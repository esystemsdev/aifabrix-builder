# Manual tests (real API calls)

The **tests/manual** directory contains tests that call **real** Controller and Dataplane APIs. No mocks are used. Every `lib/api` module is covered with at least one real call:

- **api-auth.test.js** – auth.api (user, client-token, login, roles, permissions, validate, diagnostics, device code)
- **api-environments.test.js** – environments.api (list, get, status, applications, deployments, roles, datasources)
- **api-deployments.test.js** – deployments.api (list, list by app, get deployment, get logs)
- **api-pipeline.test.js** – pipeline.api (health, validate, get deployment)
- **api-credentials.test.js** – credentials.api (list credentials, Dataplane)
- **api-external-systems.test.js** – external-systems.api (list, get, Dataplane)
- **api-lifecycle.test.js** – lifecycle.api (GET certification report, optional details; POST run when `MANUAL_CERTIFICATION_LIFECYCLE_RUN=1`)
- **api-governance-scenario-pack.test.js** – governance-scenario-pack.api (GET pack, POST run when pack exists; Dataplane 419.0)
- **certification-cli-smoke.test.js** – plan 150.0 CLI smoke (`lifecycle --json`; `verify-* --json` when `MANUAL_CERTIFICATION_VERIFY=1`)
- **api-datasources.test.js** – datasources-core.api (list, executions, get, status, Dataplane)
- **api-datasources-extended.test.js** – datasources-extended.api (records, grants, Dataplane)
- **api-external-test-e2e.test.js** – external-test.api (test-e2e sync, getE2ETestRun; Dataplane; Bearer/API key only)
- **api-validation-run.test.js** – validation-run.api (unified POST/GET validation run; same stack as `aifabrix datasource test`)
- **api-wizard.test.js** – wizard.api (platforms, credentials, Dataplane)
- **api-integration-clients.test.js** – integration-clients.api (list; requires Controller and integration-client:read for success)

## Important

- These tests are **manual** and **must not** be run in CI or as part of default `npm test`.
- They are excluded from the default Jest run and from CI.
- **Prerequisite: you must be logged in** before running them.

## Duration

Manual tests perform **real HTTP requests** to the Controller/Dataplane. Each request has network latency and server processing, so each test file typically takes **several seconds** (not milliseconds). For fast feedback (&lt;100ms per test), use the default unit tests: `npm test` (these use mocks and exclude `tests/manual/`). Within manual tests, independent API calls are run in parallel where possible to reduce wall-clock time.

## Prerequisite: authentication

1. Run **`aifabrix login`** and complete the device flow, **or**
2. Have valid client credentials in **`~/.aifabrix/secrets.local.yaml`** (and optionally env vars such as `CLIENTID` / `CLIENTSECRET` where applicable).

Before any manual test runs, the suite runs **`aifabrix auth status --validate`**. If the token is invalid or missing, **no tests run** and the full auth status error is printed (same as when you run `aifabrix auth status`). Fix login/credentials and run again.

## How to run

```bash
npm run test:manual
```

(`pnpm run test:manual` works when using pnpm in this repo.)

Run a single file:

```bash
npx jest --config jest.config.manual.js --runInBand tests/manual/api-auth.test.js
```

### Plan 150.0 — Enterprise AI Certification (optional env)

| Variable | Effect |
| --- | --- |
| `MANUAL_CERTIFICATION_SYSTEM_KEY` | Pin system key for CLI smoke (must have `integration/<key>/` for lifecycle CLI) |
| `MANUAL_CERTIFICATION_VERIFY=1` | Enable heavy `verify-operations`, `verify-trust`, `verify-governance` CLI tests in **certification-cli-smoke.test.js** |
| `MANUAL_CERTIFICATION_LIFECYCLE_RUN=1` | Enable POST `lifecycle/run` in **api-lifecycle.test.js** (may execute missing verify steps on dataplane) |

Recommended order for full live proof (operator): `upload` → `verify-operations` → `verify-trust` → `verify-governance` → `lifecycle` (see `.cursor/plans/Done/150.0-lifecycle-ui.plan.md`).

## Required configuration

- **Controller URL** and **Dataplane URL**: from your config (set via `aifabrix login` or `aifabrix auth config`), or from environment (e.g. `CONTROLLER_URL`, `DATAPLANE_URL` if supported by the helper).
- **Auth**: device token (from `aifabrix login`) or client credentials as above.

## Coverage vs plans (109, 110, 111)

- **Plan 109 / integration clients:** Covered by **api-integration-clients.test.js** (list; create/rotate/update/delete are covered by unit tests in `tests/lib/api/integration-clients.api.test.js` and `tests/lib/commands/integration-client.test.js`). Manual run confirms real Controller list endpoint.
- **Plan 110 (ABAC validation, error messages, offline validation):** No new `lib/api` module; validation is offline. Manual testing is via CLI (`aifabrix validate`, `aifabrix datasource validate`) with real config files; no additional tests/manual file required.
- **Plan 111 (RBAC format rbac.yaml/yml/json):** No new `lib/api` module; file I/O and generator/repair. Manual testing is via CLI and existing generator/repair tests; no additional tests/manual file required.

## Note

Use of this suite involves real API calls to the platform; such usage may be logged or audited by the platform.
